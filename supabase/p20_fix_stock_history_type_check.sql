-- P20: Fix stock_history type CHECK constraint
-- The deduct_order_stock and restore_order_stock functions use 'order_deduction'
-- and 'order_cancelled' types, which weren't in the original CHECK constraint.
-- Run this in the Supabase SQL Editor.

ALTER TABLE stock_history DROP CONSTRAINT IF EXISTS stock_history_type_check;
ALTER TABLE stock_history ADD CONSTRAINT stock_history_type_check
  CHECK (type IN ('delivery','dispatch','adjustment','order_deduction','order_cancelled'));
