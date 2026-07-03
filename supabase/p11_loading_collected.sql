-- ════════════════════════════════════════════════════════════════════
-- Ventryl P11 — Allow loading → collected transition (pickup orders)
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_order_transition(
  current_status TEXT,
  new_status     TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  allowed JSONB := '{
    "pending":    ["confirmed","rejected","cancelled"],
    "confirmed":  ["loading","cancelled"],
    "loading":    ["in_transit","collected"],
    "in_transit": ["delivered","collected","disputed"],
    "delivered":  ["disputed"],
    "collected":  [],
    "disputed":   ["delivered","collected"],
    "rejected":   [],
    "cancelled":  []
  }';
BEGIN
  IF current_status = new_status THEN RETURN TRUE; END IF;
  RETURN (allowed->current_status) @> to_jsonb(new_status);
END;
$$;

-- Also update the error message in enforce_order_state_machine to reflect new rules
CREATE OR REPLACE FUNCTION enforce_order_state_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT validate_order_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION
        'Invalid order status transition: % → %. Allowed from %: %',
        OLD.status, NEW.status, OLD.status,
        (SELECT jsonb_agg(x) FROM jsonb_array_elements_text(
          ('{"pending":["confirmed","rejected","cancelled"],"confirmed":["loading","cancelled"],"loading":["in_transit","collected"],"in_transit":["delivered","collected","disputed"],"delivered":["disputed"],"collected":[],"disputed":["delivered","collected"],"rejected":[],"cancelled":[]}')
          ->OLD.status
        ) x)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
