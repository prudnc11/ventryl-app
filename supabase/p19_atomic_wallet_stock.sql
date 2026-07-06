-- ============================================================================
-- P19: Atomic Wallet & Stock Operations
-- Fixes: C1 (race conditions), C2 (unfunded orders), C3 (broken escrow), C6 (stock not deducted)
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- ── 1. Atomic wallet hold ────────────────────────────────────────────────────
-- Deducts balance only if sufficient. Returns true on success, false if insufficient.
-- Prevents double-spending via atomic UPDATE ... WHERE balance_ngn >= amount.

CREATE OR REPLACE FUNCTION wallet_hold(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Hold amount must be positive';
  END IF;

  -- Atomic: deduct only if balance is sufficient
  UPDATE wallets
  SET balance_ngn = balance_ngn - p_amount, updated_at = now()
  WHERE user_id = p_user_id AND balance_ngn >= p_amount
  RETURNING id INTO v_wallet_id;

  IF v_wallet_id IS NULL THEN
    RETURN false;  -- insufficient balance or wallet not found
  END IF;

  INSERT INTO transactions (wallet_id, type, amount, description, order_id)
  VALUES (v_wallet_id, 'hold', p_amount,
          'Order ' || p_order_id || ' — Payment held in escrow', p_order_id);

  RETURN true;
END;
$$;

-- ── 2. Atomic wallet credit (top-up) ────────────────────────────────────────
-- Creates wallet if it doesn't exist, then atomically adds to balance.

CREATE OR REPLACE FUNCTION wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  -- Ensure wallet exists
  INSERT INTO wallets (user_id, balance_ngn)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Atomic credit
  UPDATE wallets
  SET balance_ngn = balance_ngn + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING id INTO v_wallet_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  INSERT INTO transactions (wallet_id, type, amount, description, reference)
  VALUES (v_wallet_id, 'credit', p_amount, p_description, p_reference);
END;
$$;

-- ── 3. Atomic wallet refund ─────────────────────────────────────────────────
-- Returns escrowed funds to buyer on cancellation/rejection.

CREATE OR REPLACE FUNCTION wallet_refund(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text,
  p_reason text DEFAULT 'cancelled'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  -- Ensure wallet exists
  INSERT INTO wallets (user_id, balance_ngn)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallets
  SET balance_ngn = balance_ngn + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING id INTO v_wallet_id;

  INSERT INTO transactions (wallet_id, type, amount, description, order_id)
  VALUES (v_wallet_id, 'refund', p_amount,
          'Order ' || p_order_id || ' — Refund (order ' || p_reason || ')', p_order_id);
END;
$$;

-- ── 4. Atomic escrow release + depot payment ────────────────────────────────
-- On delivery: logs release txn on buyer wallet, credits depot owner wallet.

CREATE OR REPLACE FUNCTION wallet_release_and_pay(
  p_order_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order record;
  v_depot_owner_id uuid;
  v_buyer_wallet_id uuid;
  v_depot_wallet_id uuid;
  v_escrow_total numeric;
BEGIN
  -- Fetch order financials
  SELECT total_value, platform_fee, vat, net_to_depot, buyer_id, depot_id
  INTO v_order
  FROM orders WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  v_escrow_total := v_order.total_value + v_order.platform_fee + v_order.vat;

  -- Ensure buyer has a wallet
  INSERT INTO wallets (user_id, balance_ngn)
  VALUES (v_order.buyer_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_buyer_wallet_id FROM wallets WHERE user_id = v_order.buyer_id;

  -- Log release transaction on buyer wallet
  INSERT INTO transactions (wallet_id, type, amount, description, order_id)
  VALUES (v_buyer_wallet_id, 'release', v_escrow_total,
          'Order ' || p_order_id || ' — Payment released to depot', p_order_id);

  -- Get depot owner
  SELECT owner_id INTO v_depot_owner_id FROM depots WHERE id = v_order.depot_id;
  IF v_depot_owner_id IS NULL THEN
    RAISE EXCEPTION 'Depot owner not found for depot %', v_order.depot_id;
  END IF;

  -- Ensure depot owner has a wallet
  INSERT INTO wallets (user_id, balance_ngn)
  VALUES (v_depot_owner_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Credit depot owner with net_to_depot (total minus platform fee)
  UPDATE wallets
  SET balance_ngn = balance_ngn + v_order.net_to_depot, updated_at = now()
  WHERE user_id = v_depot_owner_id
  RETURNING id INTO v_depot_wallet_id;

  INSERT INTO transactions (wallet_id, type, amount, description, order_id)
  VALUES (v_depot_wallet_id, 'credit', v_order.net_to_depot,
          'Order ' || p_order_id || ' — Payment received from buyer', p_order_id);
END;
$$;

-- ── 5. Atomic stock deduction for confirmed orders ──────────────────────────
-- Deducts stock for all items in an order. Fails if any product has insufficient stock.

CREATE OR REPLACE FUNCTION deduct_order_stock(
  p_order_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
  v_depot_id uuid;
  v_current_stock numeric;
BEGIN
  -- Get depot from order
  SELECT depot_id INTO v_depot_id FROM orders WHERE id = p_order_id;
  IF v_depot_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Loop through each order item and deduct stock
  FOR v_item IN
    SELECT product, volume FROM order_items WHERE order_id = p_order_id
  LOOP
    -- Atomic deduct: only succeeds if stock >= volume
    UPDATE depot_products
    SET stock = stock - v_item.volume, updated_at = now()
    WHERE depot_id = v_depot_id
      AND product = v_item.product
      AND stock >= v_item.volume;

    IF NOT FOUND THEN
      -- Check if product exists
      SELECT stock INTO v_current_stock
      FROM depot_products
      WHERE depot_id = v_depot_id AND product = v_item.product;

      IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Product % not found for depot', v_item.product;
      ELSE
        RAISE EXCEPTION 'Insufficient stock for %. Required: %, available: %',
          v_item.product, v_item.volume, v_current_stock;
      END IF;
    END IF;

    -- Record in stock history
    INSERT INTO stock_history (depot_id, product, quantity, type, reference)
    VALUES (v_depot_id, v_item.product, -v_item.volume, 'order_deduction', p_order_id);
  END LOOP;
END;
$$;

-- ── 6. Restore stock on cancellation/rejection ──────────────────────────────
-- Returns stock that was deducted when order was confirmed.

CREATE OR REPLACE FUNCTION restore_order_stock(
  p_order_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
  v_depot_id uuid;
BEGIN
  SELECT depot_id INTO v_depot_id FROM orders WHERE id = p_order_id;
  IF v_depot_id IS NULL THEN
    RETURN;  -- order not found, nothing to restore
  END IF;

  -- Check if stock was previously deducted (look for deduction in history)
  IF NOT EXISTS (
    SELECT 1 FROM stock_history
    WHERE reference = p_order_id AND type = 'order_deduction'
  ) THEN
    RETURN;  -- stock was never deducted, nothing to restore
  END IF;

  FOR v_item IN
    SELECT product, volume FROM order_items WHERE order_id = p_order_id
  LOOP
    UPDATE depot_products
    SET stock = stock + v_item.volume, updated_at = now()
    WHERE depot_id = v_depot_id AND product = v_item.product;

    INSERT INTO stock_history (depot_id, product, quantity, type, reference)
    VALUES (v_depot_id, v_item.product, v_item.volume, 'order_cancelled', p_order_id);
  END LOOP;
END;
$$;

-- ── Grant execute to authenticated users ────────────────────────────────────
GRANT EXECUTE ON FUNCTION wallet_hold TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_credit TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_refund TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_release_and_pay TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_order_stock TO authenticated;
GRANT EXECUTE ON FUNCTION restore_order_stock TO authenticated;
