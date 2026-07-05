/**
 * Ventryl order-status-webhook Edge Function
 * Automatically sends email notifications when order status changes.
 *
 * Triggered by a Supabase Database Webhook on the `orders` table (UPDATE)
 * and on INSERT (new orders).
 *
 * Deploy: supabase functions deploy order-status-webhook --no-verify-jwt
 *
 * Env vars required (Supabase Dashboard -> Edge Functions -> Secrets):
 *   RESEND_API_KEY        — from resend.com
 *   FROM_EMAIL            — e.g. Ventryl <notifications@ventryl.com>
 *   APP_URL               — e.g. https://ventryl-app.vercel.app
 *   SUPABASE_URL          — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config ───────────────────────────────────────────────────────────────────

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Ventryl <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') || 'https://ventryl-app.vercel.app';

function sb() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

// ── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  buyerSubject: string;
  buyerHeading: string;
  buyerBody: string;
  buyerCta: { label: string; color: string } | null;
  depotSubject: string;
  depotHeading: string;
  depotBody: string;
  depotCta: { label: string; color: string } | null;
}

function statusConfig(
  status: string,
  d: { orderId: string; product: string; vol: string; depotName: string; buyerName: string; value: string; trucks: string },
): StatusConfig | null {
  const configs: Record<string, StatusConfig> = {
    pending: {
      buyerSubject: `Order ${d.orderId} Placed Successfully`,
      buyerHeading: 'Order Placed',
      buyerBody: `Your order <strong>${d.orderId}</strong> for <strong>${d.vol} of ${d.product}</strong> has been submitted to <strong>${d.depotName}</strong>.<br><br>You'll receive a confirmation once the depot reviews your order.`,
      buyerCta: { label: 'Track Order', color: '#06C167' },
      depotSubject: `New Order ${d.orderId} — Action Required`,
      depotHeading: 'New Order Received',
      depotBody: `A new order has arrived:<br><br>
        <table cellpadding="6" cellspacing="0" style="font-size:14px;color:#333;">
          <tr><td style="color:#888;">Order</td><td><strong>${d.orderId}</strong></td></tr>
          <tr><td style="color:#888;">Buyer</td><td><strong>${d.buyerName}</strong></td></tr>
          <tr><td style="color:#888;">Product</td><td><strong>${d.product}</strong></td></tr>
          <tr><td style="color:#888;">Volume</td><td><strong>${d.vol}</strong></td></tr>
          <tr><td style="color:#888;">Trucks</td><td><strong>${d.trucks}</strong></td></tr>
          <tr><td style="color:#888;">Value</td><td><strong>${d.value}</strong></td></tr>
        </table><br>Please confirm or reject before SLA expires.`,
      depotCta: { label: 'Review Order', color: '#111' },
    },
    confirmed: {
      buyerSubject: `Order ${d.orderId} Confirmed by ${d.depotName}`,
      buyerHeading: 'Order Confirmed',
      buyerBody: `Great news! Your order <strong>${d.orderId}</strong> for <strong>${d.vol} of ${d.product}</strong> has been <strong style="color:#06C167;">confirmed</strong> by <strong>${d.depotName}</strong>.<br><br>The depot will begin loading your order shortly.`,
      buyerCta: { label: 'Track Order', color: '#06C167' },
      depotSubject: `Order ${d.orderId} Confirmed — Assign Loading Bay`,
      depotHeading: 'Order Confirmed',
      depotBody: `You confirmed order <strong>${d.orderId}</strong> from <strong>${d.buyerName}</strong>.<br><br>Next step: assign a loading bay and begin loading.`,
      depotCta: { label: 'Manage Order', color: '#06C167' },
    },
    loading: {
      buyerSubject: `Order ${d.orderId} — Loading in Progress`,
      buyerHeading: 'Loading Started',
      buyerBody: `Your order <strong>${d.orderId}</strong> is now being <strong>loaded</strong> at <strong>${d.depotName}</strong>.<br><br>You'll be notified when the trucks are dispatched.`,
      buyerCta: { label: 'Track Order', color: '#1D4ED8' },
      depotSubject: `Order ${d.orderId} — Loading Started`,
      depotHeading: 'Loading in Progress',
      depotBody: `Order <strong>${d.orderId}</strong> for <strong>${d.buyerName}</strong> is now loading.<br><br>Dispatch all trucks when loading is complete.`,
      depotCta: { label: 'Manage Order', color: '#1D4ED8' },
    },
    in_transit: {
      buyerSubject: `Order ${d.orderId} Is On Its Way!`,
      buyerHeading: 'Order Dispatched',
      buyerBody: `Your order <strong>${d.orderId}</strong> with <strong>${d.trucks} truck(s)</strong> has been <strong>dispatched</strong> from <strong>${d.depotName}</strong>.<br><br>You'll be notified upon delivery.`,
      buyerCta: { label: 'Live Track', color: '#1D4ED8' },
      depotSubject: `Order ${d.orderId} — Trucks Dispatched`,
      depotHeading: 'Order In Transit',
      depotBody: `Order <strong>${d.orderId}</strong> for <strong>${d.buyerName}</strong> is in transit with <strong>${d.trucks} truck(s)</strong>.<br><br>Mark trucks as delivered when they arrive.`,
      depotCta: { label: 'Track Delivery', color: '#1D4ED8' },
    },
    delivered: {
      buyerSubject: `Order ${d.orderId} Delivered — Please Confirm`,
      buyerHeading: 'Order Delivered',
      buyerBody: `Your order <strong>${d.orderId}</strong> has been <strong style="color:#06C167;">delivered</strong>.<br><br>Please confirm receipt on the platform within 48 hours. If there's an issue, you can file a dispute.`,
      buyerCta: { label: 'Confirm Receipt', color: '#06C167' },
      depotSubject: `Order ${d.orderId} — Delivered Successfully`,
      depotHeading: 'Delivery Complete',
      depotBody: `Order <strong>${d.orderId}</strong> for <strong>${d.buyerName}</strong> has been marked as <strong>delivered</strong>.<br><br>Payment will be released once the buyer confirms receipt.`,
      depotCta: null,
    },
    collected: {
      buyerSubject: `Order ${d.orderId} — Collection Confirmed`,
      buyerHeading: 'Order Collected',
      buyerBody: `Your order <strong>${d.orderId}</strong> has been <strong style="color:#06C167;">collected</strong> from <strong>${d.depotName}</strong>.<br><br>This order is now complete.`,
      buyerCta: null,
      depotSubject: `Order ${d.orderId} — Buyer Collected`,
      depotHeading: 'Collection Complete',
      depotBody: `Order <strong>${d.orderId}</strong> has been collected by <strong>${d.buyerName}</strong>. Payment will be released shortly.`,
      depotCta: null,
    },
    rejected: {
      buyerSubject: `Order ${d.orderId} Was Not Accepted`,
      buyerHeading: 'Order Rejected',
      buyerBody: `Unfortunately, your order <strong>${d.orderId}</strong> was <strong style="color:#FF3B30;">not accepted</strong> by <strong>${d.depotName}</strong>.<br><br>You can place a new order with a different depot.`,
      buyerCta: { label: 'Browse Depots', color: '#111' },
      depotSubject: `Order ${d.orderId} — Rejected`,
      depotHeading: 'Order Rejected',
      depotBody: `You rejected order <strong>${d.orderId}</strong> from <strong>${d.buyerName}</strong>.`,
      depotCta: null,
    },
    disputed: {
      buyerSubject: `Dispute Filed — Order ${d.orderId}`,
      buyerHeading: 'Dispute Under Review',
      buyerBody: `Your dispute on order <strong>${d.orderId}</strong> has been filed and is under review.<br><br>Ventryl's team will review the evidence and respond within 24-48 hours.`,
      buyerCta: { label: 'View Dispute', color: '#D97706' },
      depotSubject: `Dispute Filed on Order ${d.orderId} — Action Required`,
      depotHeading: 'Dispute Filed',
      depotBody: `A dispute has been filed by <strong>${d.buyerName}</strong> on order <strong>${d.orderId}</strong>.<br><br>Please review the dispute details and provide any supporting evidence. You can also resolve the dispute directly from your dashboard.`,
      depotCta: { label: 'View Dispute', color: '#FF3B30' },
    },
  };
  return configs[status] || null;
}

// ── Email sending ────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, heading: string, body: string, cta: { label: string; color: string; url: string } | null) {
  if (!RESEND_API_KEY) { console.error('RESEND_API_KEY not set'); return; }

  const ctaHtml = cta
    ? `<p style="margin-top:24px;"><a href="${cta.url}" style="background:${cta.color};color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${cta.label} &rarr;</a></p>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; }
  .header { background: #111; padding: 22px 28px; }
  .header-inner { display: flex; align-items: center; gap: 10px; }
  .logo { width: 28px; height: 28px; background: #06C167; display: inline-flex; align-items: center; justify-content: center; }
  .brand { color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; }
  .status-bar { padding: 14px 28px; border-bottom: 1px solid #eee; }
  .body { padding: 28px; }
  .body p { margin-bottom: 14px; font-size: 14px; color: #333; line-height: 1.7; }
  .footer { background: #fafafa; padding: 18px 28px; font-size: 11px; color: #999; text-align: center; line-height: 1.6; border-top: 1px solid #eee; }
  .footer a { color: #999; }
  table { width: 100%; }
</style>
</head><body>
<div class="wrap">
  <div class="header">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:28px;height:28px;background:#06C167;text-align:center;vertical-align:middle;">
        <span style="color:#fff;font-weight:800;font-size:14px;">V</span>
      </td>
      <td style="padding-left:10px;">
        <span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.08em;">VENTRYL</span>
      </td>
    </tr></table>
  </div>
  <div class="status-bar">
    <span style="font-size:13px;font-weight:800;color:#111;">${heading}</span>
  </div>
  <div class="body">
    <p>${body}</p>
    ${ctaHtml}
  </div>
  <div class="footer">
    Ventryl Platform &middot; Nigeria's B2B Petroleum Marketplace<br>
    <a href="${APP_URL}/settings">Manage notification preferences</a>
  </div>
</div>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[email] Resend ${res.status}: ${err}`);
    } else {
      console.log(`[email] Sent to ${to}: ${subject}`);
    }
  } catch (e) {
    console.error(`[email] Failed:`, e.message);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Database webhooks don't need CORS but handle OPTIONS just in case
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;

    // Debug: log env vars availability and payload
    const hasResend = !!RESEND_API_KEY;
    const hasSupaUrl = !!Deno.env.get('SUPABASE_URL');
    const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log(`[webhook] type=${type} hasResend=${hasResend} hasSupaUrl=${hasSupaUrl} hasServiceKey=${hasServiceKey}`);
    console.log(`[webhook] record:`, JSON.stringify(record)?.slice(0, 200));

    // type = INSERT | UPDATE | DELETE
    if (!record) {
      return new Response(JSON.stringify({ skipped: 'no record' }), { status: 200 });
    }

    // For UPDATE, only fire on actual status changes
    if (type === 'UPDATE' && record.status === old_record?.status) {
      return new Response(JSON.stringify({ skipped: 'no status change' }), { status: 200 });
    }

    const supabase = sb();
    const orderId = record.id;
    const status = record.status;

    // Fetch buyer profile
    const { data: buyer, error: buyerErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, company_name, phone')
      .eq('id', record.buyer_id)
      .maybeSingle();
    if (buyerErr) console.error(`[webhook] buyer lookup failed:`, buyerErr.message);

    // Fetch depot with owner profile
    const { data: depot, error: depotErr } = await supabase
      .from('depots')
      .select('id, name, owner_id, contact_email, contact_name')
      .eq('id', record.depot_id)
      .maybeSingle();
    if (depotErr) console.error(`[webhook] depot lookup failed:`, depotErr.message);
    console.log(`[webhook] buyer=${buyer?.email || 'none'} depot=${depot?.name || 'none'} depotOwner=${depot?.owner_id || 'none'}`);

    // Fetch depot owner profile for email
    let depotOwner: { full_name: string; email: string } | null = null;
    if (depot?.owner_id) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', depot.owner_id)
        .maybeSingle();
      depotOwner = data;
    }

    // Compute order items summary
    const { data: items } = await supabase
      .from('order_items')
      .select('product, quantity, price_per_litre')
      .eq('order_id', orderId);

    const product = (items || []).map((i: { product: string }) => i.product).join(' + ') || 'N/A';
    const vol = record.total_volume
      ? `${(record.total_volume / 1000).toFixed(0)}k L`
      : 'N/A';
    const value = record.total_value
      ? `\u20A6${Number(record.total_value).toLocaleString('en-NG')}`
      : 'N/A';

    const templateData = {
      orderId,
      product,
      vol,
      value,
      trucks: String(record.trucks_count || 0),
      depotName: depot?.name || 'Depot',
      buyerName: buyer?.company_name || buyer?.full_name || 'Buyer',
    };

    const config = statusConfig(status, templateData);
    if (!config) {
      return new Response(JSON.stringify({ skipped: `no template for status: ${status}` }), { status: 200 });
    }

    const emails: Promise<void>[] = [];

    // Email the buyer
    if (buyer?.email) {
      const buyerOrderUrl = `${APP_URL}/orders/${orderId}`;
      emails.push(
        sendEmail(
          buyer.email,
          config.buyerSubject,
          config.buyerHeading,
          config.buyerBody,
          config.buyerCta ? { ...config.buyerCta, url: buyerOrderUrl } : null,
        ),
      );
    }

    // Email the depot owner (or depot contact)
    const depotEmail = depotOwner?.email || depot?.contact_email;
    if (depotEmail) {
      const depotOrderUrl = `${APP_URL}/depot/${record.depot_id}/order/${orderId}`;
      emails.push(
        sendEmail(
          depotEmail,
          config.depotSubject,
          config.depotHeading,
          config.depotBody,
          config.depotCta ? { ...config.depotCta, url: depotOrderUrl } : null,
        ),
      );
    }

    await Promise.allSettled(emails);

    // Log to notification_log if the table exists
    try {
      const logEntries = [];
      if (buyer?.id) {
        logEntries.push({
          user_id: buyer.id,
          type: `order_${status}`,
          channel: 'email',
          subject: config.buyerSubject,
          body: config.buyerHeading,
          status: buyer.email ? 'sent' : 'skipped',
        });
      }
      if (depot?.owner_id) {
        logEntries.push({
          user_id: depot.owner_id,
          type: `order_${status}`,
          channel: 'email',
          subject: config.depotSubject,
          body: config.depotHeading,
          status: depotEmail ? 'sent' : 'skipped',
        });
      }
      if (logEntries.length > 0) {
        await supabase.from('notification_log').insert(logEntries);
      }
    } catch (logErr) {
      // notification_log table may not exist yet — non-fatal
      console.warn('[log] Could not write notification_log:', logErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, status, buyer: buyer?.email || null, depot: depotEmail || null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[order-status-webhook]', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
