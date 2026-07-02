/**
 * Ventryl Payment — Paystack Integration
 *
 * Env var required:
 *   VITE_PAYSTACK_PUBLIC_KEY  — from paystack.com Dashboard → Settings → API Keys
 *
 * Flow:
 *   1. initializePayment(amount, email, metadata) → reference string
 *   2. openPaystackPopup(reference, onSuccess, onClose) → loads Paystack inline JS
 *   3. On success callback → verifyPayment(reference) → Supabase Edge Function
 *      credits the wallet (or webhook handles it server-side)
 *
 * Amount is always in KOBO (1 NGN = 100 kobo). Pass raw NGN × 100.
 */

import { supabase } from './supabase';

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

/**
 * Load the Paystack inline JS SDK once.
 */
function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(window.PaystackPop); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Failed to load Paystack SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Open Paystack payment popup.
 *
 * @param {object} opts
 *   email       - payer email
 *   amountKobo  - amount in kobo (NGN × 100)
 *   metadata    - arbitrary key/value passed through to webhook
 *   onSuccess   - called with { reference } on payment success
 *   onClose     - called when modal is dismissed
 */
export async function openPaystackPopup({ email, amountKobo, metadata = {}, onSuccess, onClose }) {
  if (!PAYSTACK_KEY) {
    throw new Error('VITE_PAYSTACK_PUBLIC_KEY is not configured. Add it to your .env file.');
  }

  const PaystackPop = await loadPaystackScript();

  const handler = PaystackPop.setup({
    key: PAYSTACK_KEY,
    email,
    amount: amountKobo,
    currency: 'NGN',
    ref: `VTL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    metadata: {
      custom_fields: Object.entries(metadata).map(([display_name, value]) => ({
        display_name,
        variable_name: display_name.toLowerCase().replace(/\s+/g, '_'),
        value: String(value),
      })),
    },
    callback: (response) => {
      onSuccess?.(response);
    },
    onClose: () => {
      onClose?.();
    },
  });

  handler.openIframe();
}

/**
 * Verify a Paystack payment reference via our Edge Function.
 * Credits the wallet on the server side.
 *
 * @param {string} reference - Paystack transaction reference
 * @param {string} userId    - Supabase user id
 * @returns {{ credited: boolean, amount: number }} amount in kobo
 */
export async function verifyAndCreditWallet(reference, userId) {
  const { data, error } = await supabase.functions.invoke('paystack-webhook', {
    body: { action: 'verify', reference, user_id: userId },
  });
  if (error) throw new Error(error.message || 'Payment verification failed');
  return data;
}

/**
 * Format kobo amount to NGN display string.
 */
export function formatNGN(kobo) {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Quick presets for fund amounts (in naira, converted to kobo on use).
 */
export const FUND_PRESETS = [
  { label: '₦5M',  naira: 5_000_000 },
  { label: '₦10M', naira: 10_000_000 },
  { label: '₦25M', naira: 25_000_000 },
  { label: '₦50M', naira: 50_000_000 },
  { label: '₦100M',naira: 100_000_000 },
];
