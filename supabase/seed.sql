-- ════════════════════════════════════════════════════════════════════
-- Ventryl Platform — Seed Data
-- Run AFTER schema.sql in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- ── 30-day market price history ──────────────────────────────────────
-- Generates realistic price data for all 5 petroleum products.
-- Prices drift slightly each day within NMDPRA-regulated bands.

DO $$
DECLARE
  d     DATE;
  i     INTEGER;
  pms   NUMERIC := 795;
  ago   NUMERIC := 1185;
  dpk   NUMERIC := 1338;
  lpg   NUMERIC := 1048;
  atk   NUMERIC := 1885;
BEGIN
  FOR i IN REVERSE 29..0 LOOP
    d := CURRENT_DATE - i;

    -- Small random daily drift ±2 for PMS, ±4 for others
    pms := GREATEST(785, LEAST(810, pms + (random() * 4 - 2)::INTEGER));
    ago := GREATEST(1170, LEAST(1200, ago + (random() * 8 - 4)::INTEGER));
    dpk := GREATEST(1320, LEAST(1360, dpk + (random() * 8 - 4)::INTEGER));
    lpg := GREATEST(1030, LEAST(1070, lpg + (random() * 10 - 5)::INTEGER));
    atk := GREATEST(1860, LEAST(1920, atk + (random() * 12 - 6)::INTEGER));

    INSERT INTO price_history (product, price, recorded_at) VALUES
      ('PMS', pms, d),
      ('AGO', ago, d),
      ('DPK', dpk, d),
      ('LPG', lpg, d),
      ('ATK', atk, d)
    ON CONFLICT (product, recorded_at) DO NOTHING;
  END LOOP;
END;
$$;
