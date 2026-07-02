/**
 * Ventryl Realtime — Supabase Realtime subscription hooks.
 * Each hook subscribes on mount and cleans up on unmount.
 */
import { useEffect, useRef } from 'react';
import { supabase, isConfigured } from './supabase';

/**
 * Subscribe to all changes on a single order:
 * - orders row (status changes)
 * - order_trucks rows (progress, arrival)
 * - order_status_logs inserts (timeline events)
 * - delivery_negotiations changes (quote rounds)
 *
 * onEvent(payload) receives the Supabase postgres_changes payload:
 *   { table, eventType, new, old }
 */
export function useOrderRealtime(orderId, onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!orderId || !isConfigured) return;

    const channel = supabase
      .channel(`order_detail:${orderId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (p) => cbRef.current?.(p))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_trucks', filter: `order_id=eq.${orderId}` },
        (p) => cbRef.current?.(p))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_status_logs', filter: `order_id=eq.${orderId}` },
        (p) => cbRef.current?.(p))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_negotiations', filter: `order_id=eq.${orderId}` },
        (p) => cbRef.current?.(p))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);
}

/**
 * Subscribe to order activity for a depot (new orders + status changes).
 * Fires onEvent whenever an order targeting this depot is inserted or updated.
 */
export function useDepotInboxRealtime(depotId, onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!depotId || !isConfigured) return;

    const channel = supabase
      .channel(`depot_inbox:${depotId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `depot_id=eq.${depotId}` },
        (p) => cbRef.current?.(p))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `depot_id=eq.${depotId}` },
        (p) => cbRef.current?.(p))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [depotId]);
}

/**
 * Subscribe to a user's own profile row.
 * Fires onEvent(payload) when kyc_status, notif_prefs, or any profile field changes.
 * Use this in Settings or the root app to keep profile state in sync without a refresh.
 */
export function useProfileRealtime(userId, onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!userId || !isConfigured) return;

    const channel = supabase
      .channel(`profile:${userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (p) => cbRef.current?.(p))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);
}

/**
 * Subscribe to live market price inserts.
 * Fires onEvent({ product, price, recorded_at }) on every new price record.
 */
export function usePriceRealtime(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!isConfigured) return;

    const channel = supabase
      .channel('market_prices')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_history' },
        (p) => cbRef.current?.(p))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
