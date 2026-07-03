-- ════════════════════════════════════════════════════════════════════
-- Ventryl P8 — Restore order sequence + next_order_id function
-- Run in Supabase Dashboard → SQL Editor if orders fail with PGRST116
-- ════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS order_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION next_order_id()
RETURNS TEXT LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'VTL-' || LPAD(nextval('order_seq')::TEXT, 5, '0');
END;
$$;

-- Grant execute to authenticated users so the RPC call works
GRANT EXECUTE ON FUNCTION next_order_id() TO authenticated;
