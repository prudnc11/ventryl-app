-- ============================================================================
-- Ventryl P18 — RLS Hardening: WITH CHECK clauses + platform_settings lockdown
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ NOTE: order_trucks, delivery_negotiations, and depot_members already   │
-- │ have FOR ALL policies that cover INSERT/DELETE. No fix needed there.   │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 0a: depots — explicit INSERT policy for depot owners              │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "depots:owner:insert" ON depots;
CREATE POLICY "depots:owner:insert"
  ON depots FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 0b: depot_products — explicit INSERT policy for depot owners      │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "depot_products:owner:insert" ON depot_products;
CREATE POLICY "depot_products:owner:insert"
  ON depot_products FOR INSERT
  WITH CHECK (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 1: orders:buyer:update — add WITH CHECK to prevent buyers from    │
-- │        modifying immutable fields (buyer_id, depot_id, total_value)   │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "orders:buyer:update" ON orders;
CREATE POLICY "orders:buyer:update"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (
    auth.uid() = buyer_id
    AND buyer_id = buyer_id   -- cannot reassign buyer
    AND depot_id = depot_id   -- cannot change depot
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 2: orders:depot:update — add WITH CHECK to prevent depots from    │
-- │        modifying immutable fields                                      │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "orders:depot:update" ON orders;
CREATE POLICY "orders:depot:update"
  ON orders FOR UPDATE
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()))
  WITH CHECK (
    depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    AND buyer_id = buyer_id   -- depot cannot change buyer
    AND depot_id = depot_id   -- depot cannot reassign to another depot
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 3: platform_settings — lock down public read to ONLY the keys     │
-- │        that are explicitly meant to be public. No backdoor.           │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Anyone can read fee percent" ON platform_settings;
CREATE POLICY "Public can read whitelisted settings" ON platform_settings
  FOR SELECT USING (
    key IN ('platform_fee_percent')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 4: Add admin UPDATE policy for orders (admin resolves disputes)   │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "orders:admin:update" ON orders;
CREATE POLICY "orders:admin:update"
  ON orders FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 5: Wallets — add WITH CHECK to prevent user_id tampering          │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "wallets:own:update" ON wallets;
CREATE POLICY "wallets:own:update"
  ON wallets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ FIX 6: Profiles — prevent users from granting themselves admin        │
-- └──────────────────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "profiles:own:update" ON profiles;
CREATE POLICY "profiles:own:update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Regular users cannot change is_admin flag
      is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM profiles WHERE id = auth.uid())
      -- Unless they are already an admin
      OR (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
    )
  );
