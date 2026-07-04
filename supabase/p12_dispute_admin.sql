-- ════════════════════════════════════════════════════════════════════
-- Ventryl P12 — Admin RLS for disputes
-- Run AFTER p10_dispute_evidence.sql
-- ════════════════════════════════════════════════════════════════════

-- Admin can read all disputes
DROP POLICY IF EXISTS "disputes:admin:select" ON disputes;
CREATE POLICY "disputes:admin:select"
  ON disputes FOR SELECT
  USING (buyer_id = auth.uid() OR is_admin());

-- Admin can update any dispute (resolve, close, add notes)
DROP POLICY IF EXISTS "disputes:admin:update" ON disputes;
CREATE POLICY "disputes:admin:update"
  ON disputes FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Depot owner can update disputes on their orders (resolve)
DROP POLICY IF EXISTS "disputes:depot:update" ON disputes;
CREATE POLICY "disputes:depot:update"
  ON disputes FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
    )
  );
