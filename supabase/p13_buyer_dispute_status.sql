-- ════════════════════════════════════════════════════════════════════
-- Ventryl P13 — Allow buyers to update their own orders to 'disputed'
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- Buyers can update their own orders (needed for filing disputes)
-- WITH CHECK prevents modifying immutable fields (buyer_id, depot_id)
DROP POLICY IF EXISTS "orders:buyer:update" ON orders;
CREATE POLICY "orders:buyer:update"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (
    auth.uid() = buyer_id
    AND buyer_id = buyer_id
    AND depot_id = depot_id
  );
