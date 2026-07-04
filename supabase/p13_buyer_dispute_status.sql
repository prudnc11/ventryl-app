-- ════════════════════════════════════════════════════════════════════
-- Ventryl P13 — Allow buyers to update their own orders to 'disputed'
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- Buyers can update their own orders (needed for filing disputes)
DROP POLICY IF EXISTS "orders:buyer:update" ON orders;
CREATE POLICY "orders:buyer:update"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id);
