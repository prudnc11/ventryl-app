/**
 * Ventryl send-notification Edge Function
 * Handles email (Resend) and SMS (Africa's Talking) notifications.
 *
 * Deploy: supabase functions deploy send-notification
 *
 * Env vars required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY       — from resend.com
 *   AT_API_KEY           — Africa's Talking API key
 *   AT_USERNAME          — Africa's Talking username (use 'sandbox' for testing)
 *   FROM_EMAIL           — e.g. notifications@ventryl.com
 *
 * Request body:
 * {
 *   user_id: string,       // Supabase auth uid
 *   type: string,          // event type (see EVENT_TEMPLATES)
 *   channel: 'email'|'sms'|'both',
 *   to_email?: string,
 *   to_phone?: string,     // E.164 format e.g. +2348031234567
 *   data: object           // template variables
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Event Templates ────────────────────────────────────────────────────────────
const EVENT_TEMPLATES: Record<string, {
  subject: (d: Record<string, string>) => string;
  email: (d: Record<string, string>) => string;
  sms: (d: Record<string, string>) => string;
}> = {
  order_confirmed: {
    subject: (d) => `Order ${d.orderId} Confirmed — Ventryl`,
    email: (d) => `
      <p>Hi ${d.buyerName},</p>
      <p>Your order <strong>${d.orderId}</strong> for <strong>${d.vol}L of ${d.product}</strong>
         has been <strong>confirmed</strong> by <strong>${d.depotName}</strong>.</p>
      <p>The depot will begin loading and dispatch shortly. You will receive an update when your order is in transit.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/orders/${d.orderId}"
         style="background:#06C167;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Track Order →</a></p>
    `,
    sms: (d) => `Ventryl: Order ${d.orderId} confirmed by ${d.depotName}. ${d.vol}L ${d.product} loading soon.`,
  },

  order_dispatched: {
    subject: (d) => `Order ${d.orderId} Is On Its Way — Ventryl`,
    email: (d) => `
      <p>Hi ${d.buyerName},</p>
      <p>Your order <strong>${d.orderId}</strong> is now <strong>in transit</strong>.
         ${d.trucks} truck(s) departed from ${d.depotName}.</p>
      ${d.eta ? `<p>Estimated arrival: <strong>${d.eta}</strong></p>` : ''}
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/orders/${d.orderId}"
         style="background:#1D4ED8;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Live Track →</a></p>
    `,
    sms: (d) => `Ventryl: Order ${d.orderId} dispatched from ${d.depotName}.${d.eta ? ` ETA: ${d.eta}.` : ''} Track at ventryl.com`,
  },

  order_delivered: {
    subject: (d) => `Order ${d.orderId} Delivered — Please Confirm Receipt`,
    email: (d) => `
      <p>Hi ${d.buyerName},</p>
      <p>Your order <strong>${d.orderId}</strong> has been <strong>delivered</strong>.
         Please confirm receipt on the Ventryl platform within 48 hours.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/orders/${d.orderId}"
         style="background:#06C167;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Confirm Receipt →</a></p>
    `,
    sms: (d) => `Ventryl: Order ${d.orderId} delivered. Please confirm receipt at ventryl.com within 48hrs.`,
  },

  new_order_depot: {
    subject: (d) => `New Order ${d.orderId} from ${d.buyerName} — Action Required`,
    email: (d) => `
      <p>Hi ${d.depotContact},</p>
      <p>A new order has arrived at <strong>${d.depotName}</strong>:</p>
      <ul>
        <li><strong>Order:</strong> ${d.orderId}</li>
        <li><strong>Buyer:</strong> ${d.buyerName}</li>
        <li><strong>Product:</strong> ${d.product} — ${d.vol}L</li>
        <li><strong>Value:</strong> ₦${d.value}</li>
      </ul>
      <p>Please respond before SLA expires.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/depot/inbox"
         style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Review Order →</a></p>
    `,
    sms: (d) => `Ventryl: New order ${d.orderId} from ${d.buyerName} (${d.vol}L ${d.product}). Login to respond.`,
  },

  kyc_approved: {
    subject: (d) => `Your Ventryl Identity is Verified`,
    email: (d) => `
      <p>Hi ${d.name},</p>
      <p>Your identity verification (KYC) has been <strong style="color:#06C167;">approved</strong>.</p>
      <p>You can now create and manage depots on the Ventryl platform.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/settings/depot/new"
         style="background:#06C167;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Add Your Depot →</a></p>
    `,
    sms: (d) => `Ventryl: KYC approved! You can now create depots. Login at ventryl.com`,
  },

  kyc_rejected: {
    subject: (d) => `Action Required: KYC Verification Update`,
    email: (d) => `
      <p>Hi ${d.name},</p>
      <p>Unfortunately your KYC submission could not be verified${d.reason ? ': ' + d.reason : '.'}</p>
      <p>Please re-upload the required documents and resubmit.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/settings?tab=verification"
         style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Re-submit Documents →</a></p>
    `,
    sms: (d) => `Ventryl: KYC not approved. ${d.reason || 'Please resubmit your documents.'} Login at ventryl.com`,
  },

  kyb_approved: {
    subject: (d) => `Depot "${d.depotName}" KYB Verified — You Can Now Accept Orders`,
    email: (d) => `
      <p>Hi ${d.contact},</p>
      <p>Your depot <strong>${d.depotName}</strong> has been <strong style="color:#06C167;">KYB verified</strong>.</p>
      <p>Your depot is now live and can accept orders on the Ventryl marketplace.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/depot"
         style="background:#06C167;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Go to Depot →</a></p>
    `,
    sms: (d) => `Ventryl: Depot "${d.depotName}" is KYB verified and live. Start accepting orders at ventryl.com`,
  },

  sla_warning: {
    subject: (d) => `SLA Expiring Soon — Order ${d.orderId}`,
    email: (d) => `
      <p>Hi ${d.depotContact},</p>
      <p>Order <strong>${d.orderId}</strong> from <strong>${d.buyerName}</strong> SLA expires in
         <strong>${d.timeLeft}</strong>. Please respond now to avoid penalties.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/depot/inbox"
         style="background:#D97706;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;">
         Respond Now →</a></p>
    `,
    sms: (d) => `Ventryl URGENT: Order ${d.orderId} SLA expires in ${d.timeLeft}. Login now to respond.`,
  },

  dispute_filed: {
    subject: (d) => `Dispute Filed on Order ${d.orderId} — Action Required`,
    email: (d) => `
      <p>Hi ${d.depotName} Team,</p>
      <p>A dispute has been filed by <strong>${d.buyerName}</strong> on order <strong>${d.orderId}</strong>.</p>
      <ul>
        <li><strong>Reason:</strong> ${d.reason}</li>
        <li><strong>Reference:</strong> ${d.ref}</li>
      </ul>
      <p>Ventryl's team will review this within 24–48 hours. Please ensure all relevant documentation is available.</p>
      <p style="margin-top:24px;"><a href="https://app.ventryl.com/depot/orders/${d.orderId}"
         style="background:#FF3B30;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;display:inline-block;">
         View Dispute →</a></p>
    `,
    sms: (d) => `Ventryl: Dispute filed on order ${d.orderId} by buyer. Ref: ${d.ref}. Login to view details.`,
  },

  team_invite: {
    subject: (d) => `You've been invited to join ${d.depotName} on Ventryl`,
    email: (d) => `
      <p>Hi${d.name ? ` ${d.name}` : ''},</p>
      <p>You've been invited to join <strong>${d.depotName}</strong> on Ventryl as a <strong>${d.role}</strong>.</p>
      <p>Click below to accept the invitation and set up your account.</p>
      <p style="margin-top:24px;">
        <a href="https://app.ventryl.com/accept-invite?depot=${encodeURIComponent(d.depotId)}&email=${encodeURIComponent(d.email)}&token=${encodeURIComponent(d.token || '')}"
           style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;display:inline-block;">
          Accept Invitation →
        </a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:16px;">This invitation was sent by a depot administrator. If you were not expecting this, you can safely ignore this email.</p>
    `,
    sms: (d) => `Ventryl: You've been invited to join ${d.depotName} as ${d.role}. Visit ventryl.com to accept.`,
  },
};

// ── Email via Resend ───────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('FROM_EMAIL') || 'notifications@ventryl.com';
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: wrapEmailHtml(subject, html),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

function wrapEmailHtml(subject: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;}
  .wrap{max-width:560px;margin:32px auto;background:#fff;}
  .header{background:#111;padding:20px 28px;display:flex;align-items:center;gap:10px;}
  .body{padding:28px;}p{margin-bottom:14px;font-size:14px;color:#333;line-height:1.6;}
  ul{padding-left:18px;margin-bottom:14px;}li{font-size:14px;color:#333;margin-bottom:4px;}
  .footer{background:#f5f5f5;padding:16px 28px;font-size:11px;color:#888;text-align:center;}
  </style></head><body>
  <div class="wrap">
    <div class="header">
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" fill="#06C167"/><path d="M7 8h14M7 14h10M7 20h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
      <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.08em;">VENTRYL</span>
    </div>
    <div class="body">${body}</div>
    <div class="footer">Ventryl Platform · Nigeria's B2B Petroleum Marketplace<br>
      You're receiving this because you have notifications enabled. <a href="https://app.ventryl.com/settings?tab=notifications" style="color:#888;">Manage preferences</a>
    </div>
  </div></body></html>`;
}

// ── SMS via Africa's Talking ───────────────────────────────────────────────────
async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = Deno.env.get('AT_API_KEY');
  const username = Deno.env.get('AT_USERNAME') || 'sandbox';
  if (!apiKey) throw new Error('AT_API_KEY not configured');

  const params = new URLSearchParams({
    username,
    to,
    message,
    from: 'Ventryl',
  });

  const baseUrl = username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'apiKey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AT SMS error ${res.status}: ${err}`);
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const { user_id, type, channel = 'email', to_email, to_phone, data = {} } = body;

    if (!type || !EVENT_TEMPLATES[type]) {
      return new Response(JSON.stringify({ error: `Unknown notification type: ${type}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const tmpl = EVENT_TEMPLATES[type];
    const subject = tmpl.subject(data);
    const emailBody = tmpl.email(data);
    const smsBody = tmpl.sms(data);

    const results: string[] = [];

    if ((channel === 'email' || channel === 'both') && to_email) {
      await sendEmail(to_email, subject, emailBody);
      results.push('email sent');
    }

    if ((channel === 'sms' || channel === 'both') && to_phone) {
      await sendSms(to_phone, smsBody);
      results.push('sms sent');
    }

    // Log to notification_log table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    if (user_id) {
      await supabase.from('notification_log').insert({
        user_id,
        type,
        channel,
        subject,
        body: smsBody,
        status: results.length > 0 ? 'sent' : 'skipped',
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-notification]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
