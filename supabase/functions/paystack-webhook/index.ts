/**
 * Ventryl paystack-webhook Edge Function
 * Handles two modes:
 *   1. Direct verification call from frontend: { action: 'verify', reference, user_id }
 *   2. Paystack server-to-server webhook: POST with X-Paystack-Signature header
 *
 * Deploy: supabase functions deploy paystack-webhook
 *
 * Env vars required (Supabase Dashboard → Edge Functions → Secrets):
 *   PAYSTACK_SECRET_KEY    — from Paystack Dashboard → Settings → API Keys (sk_live_...)
 *   SUPABASE_URL           — auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

async function verifyPaystackReference(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  if (!res.ok) throw new Error(`Paystack verify failed: ${res.status}`);
  const json = await res.json();
  if (!json.status || json.data?.status !== 'success') {
    throw new Error(`Payment not successful: ${json.message || json.data?.gateway_response}`);
  }
  return json.data as { amount: number; email: string; metadata: Record<string, unknown>; reference: string };
}

async function creditWallet(supabase: ReturnType<typeof supabaseAdmin>, userId: string, amountKobo: number, reference: string) {
  // Idempotency: check if this reference was already processed
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('ref', reference)
    .eq('type', 'topup')
    .maybeSingle();

  if (existing) return { already_processed: true };

  // Credit wallet
  const { error: walletErr } = await supabase.rpc('credit_wallet', {
    p_user_id: userId,
    p_amount: amountKobo,
  });
  if (walletErr) throw new Error(`Wallet credit failed: ${walletErr.message}`);

  // Log transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'topup',
    amount: amountKobo,
    currency: 'NGN',
    ref: reference,
    description: `Wallet top-up via Paystack (ref: ${reference})`,
    status: 'completed',
  });

  return { credited: true, amount: amountKobo };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.text();

  try {
    // ── Mode 1: Server-to-server Paystack webhook ─────────────────────
    const paystackSig = req.headers.get('x-paystack-signature');
    if (paystackSig) {
      if (!PAYSTACK_SECRET) {
        return new Response(JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // Verify webhook signature
      const expected = hmac('sha512', PAYSTACK_SECRET, body, 'utf8', 'hex');
      if (expected !== paystackSig) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const event = JSON.parse(body);
      if (event.event !== 'charge.success') {
        return new Response(JSON.stringify({ ignored: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const txn = event.data;
      const userId = txn.metadata?.user_id as string;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id missing from metadata' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const supabase = supabaseAdmin();
      const result = await creditWallet(supabase, userId, txn.amount, txn.reference);
      return new Response(JSON.stringify(result), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Mode 2: Frontend verification call ───────────────────────────
    const payload = JSON.parse(body);

    if (payload.action === 'verify') {
      const { reference, user_id } = payload;
      if (!reference || !user_id) {
        return new Response(JSON.stringify({ error: 'reference and user_id required' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const txnData = await verifyPaystackReference(reference);
      const supabase = supabaseAdmin();
      const result = await creditWallet(supabase, user_id, txnData.amount, reference);

      return new Response(JSON.stringify({ ...result, amount: txnData.amount }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[paystack-webhook]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
