-- ════════════════════════════════════════════════════════════════════
-- Ventryl P3 — VCS (Ventryl Credit Score), Escrow & Admin RLS
-- Run AFTER p2_notifications.sql
-- ════════════════════════════════════════════════════════════════════

-- ── 1. VCS columns ────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vcs               INTEGER  NOT NULL DEFAULT 300
                             CHECK (vcs BETWEEN 0 AND 900),
  ADD COLUMN IF NOT EXISTS vcs_updated_at    TIMESTAMPTZ;

ALTER TABLE depots
  ADD COLUMN IF NOT EXISTS vcs               INTEGER  NOT NULL DEFAULT 300
                             CHECK (vcs BETWEEN 0 AND 900),
  ADD COLUMN IF NOT EXISTS vcs_updated_at    TIMESTAMPTZ;

-- ── 2. VCS history (audit trail) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vcs_history (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT        NOT NULL CHECK (entity_type IN ('user','depot')),
  entity_id   UUID        NOT NULL,
  score       INTEGER     NOT NULL,
  delta       INTEGER     NOT NULL DEFAULT 0,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vcs_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vcs_history:own:select" ON vcs_history;
CREATE POLICY "vcs_history:own:select"
  ON vcs_history FOR SELECT
  USING (
    (entity_type = 'user'  AND entity_id = auth.uid())
    OR (entity_type = 'depot' AND entity_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()))
  );

-- ── 3. VCS scoring function ───────────────────────────────────────────
-- Score breakdown (max 900):
--   base                   300
--   kyc_verified           +100
--   order completion rate  +0–200  (completed / placed * 200)
--   dispute-free rate      +0–150  (1 - disputes/completed * 150)
--   payment on time        +0–100  (delivered_in_time / delivered * 100)
--   account age bonus      +0–50   (months active / 24 * 50, capped at 50)

CREATE OR REPLACE FUNCTION calculate_user_vcs(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_score        INTEGER := 300;
  kyc_bonus         INTEGER := 0;
  completion_bonus  INTEGER := 0;
  dispute_bonus     INTEGER := 0;
  age_bonus         INTEGER := 0;
  total_orders      INTEGER;
  completed_orders  INTEGER;
  disputed_orders   INTEGER;
  months_active     NUMERIC;
  kyc_status        TEXT;
  result            INTEGER;
BEGIN
  -- KYC bonus
  SELECT p.kyc_status INTO kyc_status FROM profiles p WHERE p.id = p_user_id;
  IF kyc_status = 'verified' THEN kyc_bonus := 100; END IF;

  -- Order metrics (buyer placed orders)
  SELECT
    COUNT(*)                                              INTO total_orders
  FROM orders WHERE buyer_id = p_user_id;

  SELECT
    COUNT(*)                                              INTO completed_orders
  FROM orders WHERE buyer_id = p_user_id AND status IN ('delivered','collected');

  SELECT
    COUNT(*)                                              INTO disputed_orders
  FROM orders WHERE buyer_id = p_user_id AND status = 'disputed';

  -- Completion rate bonus (0-200)
  IF total_orders > 0 THEN
    completion_bonus := LEAST(200, ROUND((completed_orders::NUMERIC / total_orders) * 200));
  END IF;

  -- Dispute rate penalty (0-150 bonus for clean record)
  IF completed_orders > 0 THEN
    dispute_bonus := GREATEST(0, 150 - ROUND((disputed_orders::NUMERIC / GREATEST(completed_orders,1)) * 150));
  ELSE
    dispute_bonus := 75; -- Neutral for new users
  END IF;

  -- Account age bonus (0-50, capped at 24 months)
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / (30 * 86400) INTO months_active
  FROM profiles WHERE id = p_user_id;
  age_bonus := LEAST(50, ROUND(months_active / 24.0 * 50));

  result := base_score + kyc_bonus + completion_bonus + dispute_bonus + age_bonus;
  RETURN GREATEST(300, LEAST(900, result));
END;
$$;

CREATE OR REPLACE FUNCTION calculate_depot_vcs(p_depot_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_score        INTEGER := 300;
  kyb_bonus         INTEGER := 0;
  fulfillment_bonus INTEGER := 0;
  dispute_bonus     INTEGER := 0;
  age_bonus         INTEGER := 0;
  total_orders      INTEGER;
  fulfilled_orders  INTEGER;
  disputed_orders   INTEGER;
  months_active     NUMERIC;
  kyb_status        TEXT;
  result            INTEGER;
BEGIN
  SELECT d.kyb_status INTO kyb_status FROM depots d WHERE d.id = p_depot_id;
  IF kyb_status = 'verified' THEN kyb_bonus := 100; END IF;

  SELECT COUNT(*) INTO total_orders    FROM orders WHERE depot_id = p_depot_id;
  SELECT COUNT(*) INTO fulfilled_orders FROM orders WHERE depot_id = p_depot_id AND status IN ('delivered','collected');
  SELECT COUNT(*) INTO disputed_orders  FROM orders WHERE depot_id = p_depot_id AND status = 'disputed';

  IF total_orders > 0 THEN
    fulfillment_bonus := LEAST(200, ROUND((fulfilled_orders::NUMERIC / total_orders) * 200));
  END IF;

  IF fulfilled_orders > 0 THEN
    dispute_bonus := GREATEST(0, 150 - ROUND((disputed_orders::NUMERIC / GREATEST(fulfilled_orders,1)) * 150));
  ELSE
    dispute_bonus := 75;
  END IF;

  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / (30 * 86400) INTO months_active
  FROM depots WHERE id = p_depot_id;
  age_bonus := LEAST(50, ROUND(months_active / 24.0 * 50));

  result := base_score + kyb_bonus + fulfillment_bonus + dispute_bonus + age_bonus;
  RETURN GREATEST(300, LEAST(900, result));
END;
$$;

-- ── 4. Trigger: recalculate VCS on order status change ────────────────
CREATE OR REPLACE FUNCTION trigger_recalculate_vcs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_user_score  INTEGER;
  new_depot_score INTEGER;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('delivered','collected','disputed','cancelled') THEN RETURN NEW; END IF;

  -- Recalculate user VCS
  IF NEW.buyer_id IS NOT NULL THEN
    new_user_score := calculate_user_vcs(NEW.buyer_id);
    UPDATE profiles SET vcs = new_user_score, vcs_updated_at = NOW() WHERE id = NEW.buyer_id;
    INSERT INTO vcs_history(entity_type, entity_id, score, delta, reason)
    VALUES('user', NEW.buyer_id, new_user_score,
           new_user_score - (SELECT vcs FROM profiles WHERE id = NEW.buyer_id),
           'Order ' || NEW.id || ' → ' || NEW.status);
  END IF;

  -- Recalculate depot VCS
  IF NEW.depot_id IS NOT NULL THEN
    new_depot_score := calculate_depot_vcs(NEW.depot_id);
    UPDATE depots SET vcs = new_depot_score, vcs_updated_at = NOW() WHERE id = NEW.depot_id;
    INSERT INTO vcs_history(entity_type, entity_id, score, delta, reason)
    VALUES('depot', NEW.depot_id, new_depot_score,
           new_depot_score - (SELECT vcs FROM depots WHERE id = NEW.depot_id),
           'Order ' || NEW.id || ' → ' || NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_vcs_recalc ON orders;
CREATE TRIGGER order_vcs_recalc
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_vcs();

-- ── 5. Escrow columns on wallets & transactions ────────────────────────
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS escrow_balance  BIGINT NOT NULL DEFAULT 0;  -- kobo

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS escrow_ref   UUID,     -- order_id that the escrow is for
  ADD COLUMN IF NOT EXISTS escrow_state TEXT
    CHECK (escrow_state IN ('locked','released','refunded'));

-- ── 6. Escrow functions ───────────────────────────────────────────────
-- lock_escrow: deduct from buyer wallet balance → add to escrow
CREATE OR REPLACE FUNCTION lock_escrow(
  p_buyer_id UUID,
  p_order_id UUID,
  p_amount   BIGINT    -- amount in kobo
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets
  SET balance = balance - p_amount,
      escrow_balance = escrow_balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_buyer_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient wallet balance to lock escrow (need % kobo)', p_amount
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO transactions(user_id, type, amount, currency, ref, description, escrow_ref, escrow_state)
  VALUES(p_buyer_id, 'escrow_lock', p_amount, 'NGN', p_order_id::text,
         'Escrow locked for order ' || p_order_id, p_order_id, 'locked');
END;
$$;

-- release_escrow: release from buyer escrow → credit depot wallet
CREATE OR REPLACE FUNCTION release_escrow(
  p_buyer_id  UUID,
  p_depot_id  UUID,
  p_order_id  UUID,
  p_amount    BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_depot_owner UUID;
BEGIN
  SELECT owner_id INTO v_depot_owner FROM depots WHERE id = p_depot_id;

  UPDATE wallets
  SET escrow_balance = escrow_balance - p_amount, updated_at = NOW()
  WHERE user_id = p_buyer_id;

  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = v_depot_owner;

  INSERT INTO transactions(user_id, type, amount, currency, ref, description, escrow_ref, escrow_state)
  VALUES
    (p_buyer_id, 'escrow_release', p_amount, 'NGN', p_order_id::text,
     'Escrow released for order ' || p_order_id, p_order_id, 'released'),
    (v_depot_owner, 'order_credit', p_amount, 'NGN', p_order_id::text,
     'Payment received for order ' || p_order_id, p_order_id, 'released');
END;
$$;

-- refund_escrow: return escrow back to buyer wallet
CREATE OR REPLACE FUNCTION refund_escrow(
  p_buyer_id UUID,
  p_order_id UUID,
  p_amount   BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount,
      escrow_balance = escrow_balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_buyer_id;

  INSERT INTO transactions(user_id, type, amount, currency, ref, description, escrow_ref, escrow_state)
  VALUES(p_buyer_id, 'escrow_refund', p_amount, 'NGN', p_order_id::text,
         'Escrow refunded for order ' || p_order_id, p_order_id, 'refunded');
END;
$$;

-- ── 7. Admin RLS additions ────────────────────────────────────────────
-- Admin users (is_admin = true) can read all profiles, depots, orders.
-- These policies use SECURITY DEFINER functions to avoid infinite recursion.

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Admin can read all profiles
DROP POLICY IF EXISTS "profiles:admin:select" ON profiles;
CREATE POLICY "profiles:admin:select"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

-- Admin can update any profile (e.g., set kyc_status)
DROP POLICY IF EXISTS "profiles:admin:update" ON profiles;
CREATE POLICY "profiles:admin:update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

-- Admin can read/update all depots (for KYB review)
DROP POLICY IF EXISTS "depots:admin:select" ON depots;
CREATE POLICY "depots:admin:select"
  ON depots FOR SELECT
  USING (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "depots:admin:update" ON depots;
CREATE POLICY "depots:admin:update"
  ON depots FOR UPDATE
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

-- Admin can read all orders
DROP POLICY IF EXISTS "orders:admin:select" ON orders;
CREATE POLICY "orders:admin:select"
  ON orders FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    OR is_admin()
  );

-- Admin can read all KYC/KYB docs
DROP POLICY IF EXISTS "kyc_docs:admin:select" ON kyc_documents;
CREATE POLICY "kyc_docs:admin:select"
  ON kyc_documents FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "kyc_docs:admin:update" ON kyc_documents;
CREATE POLICY "kyc_docs:admin:update"
  ON kyc_documents FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "kyb_docs:admin:select" ON kyb_documents;
CREATE POLICY "kyb_docs:admin:select"
  ON kyb_documents FOR SELECT
  USING (
    depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "kyb_docs:admin:update" ON kyb_documents;
CREATE POLICY "kyb_docs:admin:update"
  ON kyb_documents FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── 8. credit_wallet RPC (called by paystack-webhook Edge Function) ───────────
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount   BIGINT    -- kobo
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO wallets(user_id, balance, currency)
    VALUES(p_user_id, p_amount, 'NGN');
  END IF;
END;
$$;
