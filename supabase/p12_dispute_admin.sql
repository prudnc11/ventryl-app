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
