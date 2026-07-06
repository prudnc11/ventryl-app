/**
 * Admin OTP Edge Function — server-side OTP generation and verification.
 * Prevents client-side OTP bypass by keeping the code server-only.
 *
 * Actions:
 *   POST { action: "generate", admin_id, email, context }
 *     → generates OTP, stores in DB, sends via email, returns { ok: true }
 *   POST { action: "verify", admin_id, code }
 *     → checks code against stored OTP, returns { valid: true/false }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@ventryl.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { action, admin_id, email, context, code } = body;

    // Verify caller is actually an admin
    const { data: profile } = await sb
      .from("profiles")
      .select("is_admin")
      .eq("id", admin_id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

      // Store OTP in platform_settings (upsert keyed by admin_id)
      await sb.from("platform_settings").upsert({
        key: `admin_otp_${admin_id}`,
        value: JSON.stringify({ code: otp, expires_at: expiresAt }),
        updated_at: new Date().toISOString(),
        updated_by: admin_id,
      });

      // Send OTP email via Resend
      if (RESEND_KEY && email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: "Ventryl Admin — OTP Verification Code",
            html: `
              <div style="font-family:'Manrope',sans-serif;max-width:500px;margin:0 auto;padding:32px;">
                <p>Hi Admin,</p>
                <p>Your one-time verification code is:</p>
                <div style="margin:24px 0;padding:20px;background:#111;text-align:center;">
                  <span style="font-size:32px;font-weight:800;letter-spacing:0.3em;color:#06C167;">${otp}</span>
                </div>
                <p style="font-size:13px;color:#666;">This code expires in <strong>5 minutes</strong>.</p>
                <p style="font-size:13px;color:#666;">Action: <strong>${context || "Platform settings change"}</strong></p>
                <p style="font-size:12px;color:#999;margin-top:24px;">If you did not request this code, your account may be compromised. Change your password immediately.</p>
              </div>
            `,
          }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      // Read stored OTP
      const { data: otpRow } = await sb
        .from("platform_settings")
        .select("value")
        .eq("key", `admin_otp_${admin_id}`)
        .maybeSingle();

      if (!otpRow?.value) {
        return new Response(JSON.stringify({ valid: false, error: "No OTP found. Request a new one." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stored = JSON.parse(otpRow.value);
      const expired = new Date(stored.expires_at).getTime() < Date.now();

      if (expired) {
        // Clean up expired OTP
        await sb.from("platform_settings").delete().eq("key", `admin_otp_${admin_id}`);
        return new Response(JSON.stringify({ valid: false, error: "OTP expired. Request a new one." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (stored.code !== code) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid OTP code." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // OTP valid — clean up
      await sb.from("platform_settings").delete().eq("key", `admin_otp_${admin_id}`);

      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
