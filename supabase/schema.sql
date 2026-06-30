-- ════════════════════════════════════════════════════════════════════
-- Ventryl Platform — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (extends auth.users) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT        NOT NULL,
  company_name  TEXT        NOT NULL DEFAULT '',
  role          TEXT        NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('buyer', 'depot_owner', 'admin')),
  phone         TEXT,
  state         TEXT,
  lga           TEXT,
  cac_number    TEXT,
  kyb_status    TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (kyb_status IN ('pending', 'submitted', 'verified', 'rejected')),
  vcs_score     INTEGER     NOT NULL DEFAULT 500,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Wallets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance_ngn NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance_ngn >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Depots ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS depots (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  location        TEXT        NOT NULL,
  state           TEXT        NOT NULL,
  lga             TEXT,
  address         TEXT,
  license_number  TEXT,
  license_expiry  DATE,
  capacity        INTEGER     DEFAULT 0,
  bays            INTEGER     DEFAULT 0,
  eta             TEXT        DEFAULT '4–6h',
  kyb_status      TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (kyb_status IN ('pending', 'submitted', 'verified', 'rejected')),
  rating          NUMERIC(2,1) NOT NULL DEFAULT 0
                    CHECK (rating >= 0 AND rating <= 5),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Depot Products / Inventory ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS depot_products (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  depot_id        UUID        NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  product         TEXT        NOT NULL CHECK (product IN ('PMS','AGO','DPK','LPG','ATK')),
  price_per_litre NUMERIC(10,2) NOT NULL CHECK (price_per_litre > 0),
  stock           INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  threshold       INTEGER     NOT NULL DEFAULT 5000,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (depot_id, product)
);

-- ── Stock History ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_history (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  depot_id  UUID        NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  product   TEXT        NOT NULL CHECK (product IN ('PMS','AGO','DPK','LPG','ATK')),
  quantity  INTEGER     NOT NULL,  -- positive = receipt, negative = dispatch
  type      TEXT        NOT NULL CHECK (type IN ('delivery','dispatch','adjustment')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Order ID Sequence ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION next_order_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'VTL-' || LPAD(nextval('order_seq')::TEXT, 5, '0');
END;
$$;

-- ── Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT        PRIMARY KEY,  -- VTL-00XXX
  buyer_id         UUID        NOT NULL REFERENCES profiles(id),
  depot_id         UUID        NOT NULL REFERENCES depots(id),
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending','confirmed','loading','in_transit',
                       'delivered','collected','disputed','cancelled','rejected'
                     )),
  delivery_mode    TEXT        NOT NULL CHECK (delivery_mode IN ('delivery','pickup')),
  delivery_state   TEXT,
  delivery_lga     TEXT,
  delivery_address TEXT,
  pickup_note      TEXT,
  total_volume     INTEGER     NOT NULL,
  total_value      NUMERIC(15,2) NOT NULL,
  platform_fee     NUMERIC(12,2),
  vat              NUMERIC(12,2),
  net_to_depot     NUMERIC(15,2),
  trucks_count     INTEGER     NOT NULL DEFAULT 0,
  bay_assigned     TEXT,
  loading_ref      TEXT,
  waybill_ref      TEXT,
  sla_deadline     TIMESTAMPTZ,
  placed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ,
  dispatched_at    TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ
);

-- ── Order Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product         TEXT        NOT NULL CHECK (product IN ('PMS','AGO','DPK','LPG','ATK')),
  volume          INTEGER     NOT NULL,
  price_per_litre NUMERIC(10,2) NOT NULL,
  value           NUMERIC(15,2) NOT NULL
);

-- ── Order Status Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT        NOT NULL,
  note        TEXT,
  actor_id    UUID        REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Order Trucks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_trucks (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  truck_index   INTEGER NOT NULL,
  product       TEXT,
  driver_name   TEXT,
  plate_number  TEXT,
  volume        INTEGER,
  departure_time TEXT,
  eta           TEXT,
  arrival_time  TEXT,
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status        TEXT    NOT NULL DEFAULT 'pending'
);

-- ── Delivery Cost Negotiations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_negotiations (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       TEXT        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'none'
                   CHECK (status IN ('none','depot_pending','buyer_pending','agreed','rejected')),
  agreed_amount  NUMERIC(12,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_rounds (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  negotiation_id   UUID        NOT NULL REFERENCES delivery_negotiations(id) ON DELETE CASCADE,
  from_party       TEXT        NOT NULL CHECK (from_party IN ('depot','buyer')),
  amount           NUMERIC(12,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Transactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id   UUID        NOT NULL REFERENCES wallets(id),
  type        TEXT        NOT NULL CHECK (type IN ('credit','debit','hold','release','fee')),
  amount      NUMERIC(15,2) NOT NULL,
  description TEXT        NOT NULL,
  reference   TEXT,
  order_id    TEXT        REFERENCES orders(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Market Price History ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  product     TEXT  NOT NULL CHECK (product IN ('PMS','AGO','DPK','LPG','ATK')),
  price       NUMERIC(10,2) NOT NULL,
  recorded_at DATE  NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (product, recorded_at)
);

-- ════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════════

-- Auto-create profile + wallet when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, company_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id, balance_ngn) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER wallets_updated_at    BEFORE UPDATE ON wallets    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER depots_updated_at     BEFORE UPDATE ON depots     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER negot_updated_at      BEFORE UPDATE ON delivery_negotiations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE depots                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE depot_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_trucks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_negotiations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rounds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history          ENABLE ROW LEVEL SECURITY;

-- ── Profiles ─────────────────────────────────────────────────────────
CREATE POLICY "profiles:own:select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles:own:update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Wallets ──────────────────────────────────────────────────────────
CREATE POLICY "wallets:own:select" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets:own:update" ON wallets FOR UPDATE USING (auth.uid() = user_id);

-- ── Depots — public read for active, owner manages ───────────────────
CREATE POLICY "depots:public:select"
  ON depots FOR SELECT USING (is_active = true);
CREATE POLICY "depots:owner:all"
  ON depots FOR ALL USING (auth.uid() = owner_id);

-- ── Depot Products ───────────────────────────────────────────────────
CREATE POLICY "depot_products:public:select"
  ON depot_products FOR SELECT
  USING (depot_id IN (SELECT id FROM depots WHERE is_active = true));
CREATE POLICY "depot_products:owner:all"
  ON depot_products FOR ALL
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));

-- ── Stock History ────────────────────────────────────────────────────
CREATE POLICY "stock_history:owner:select"
  ON stock_history FOR SELECT
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));
CREATE POLICY "stock_history:owner:insert"
  ON stock_history FOR INSERT
  WITH CHECK (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));

-- ── Orders ───────────────────────────────────────────────────────────
CREATE POLICY "orders:buyer:select"
  ON orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "orders:depot:select"
  ON orders FOR SELECT
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));
CREATE POLICY "orders:buyer:insert"
  ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "orders:depot:update"
  ON orders FOR UPDATE
  USING (depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid()));

-- ── Order Items ──────────────────────────────────────────────────────
CREATE POLICY "order_items:buyer:select"
  ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));
CREATE POLICY "order_items:depot:select"
  ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));
CREATE POLICY "order_items:buyer:insert"
  ON order_items FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

-- ── Order Status Logs ────────────────────────────────────────────────
CREATE POLICY "order_status_logs:parties:select"
  ON order_status_logs FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid()
    UNION
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));
CREATE POLICY "order_status_logs:parties:insert"
  ON order_status_logs FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid()
    UNION
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));

-- ── Order Trucks ─────────────────────────────────────────────────────
CREATE POLICY "order_trucks:parties:select"
  ON order_trucks FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid()
    UNION
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));
CREATE POLICY "order_trucks:depot:all"
  ON order_trucks FOR ALL
  USING (order_id IN (
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));

-- ── Delivery Negotiations ────────────────────────────────────────────
CREATE POLICY "negot:parties:select"
  ON delivery_negotiations FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid()
    UNION
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));
CREATE POLICY "negot:parties:all"
  ON delivery_negotiations FOR ALL
  USING (order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid()
    UNION
    SELECT id FROM orders WHERE depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));

CREATE POLICY "rounds:parties:select"
  ON delivery_rounds FOR SELECT
  USING (negotiation_id IN (
    SELECT dn.id FROM delivery_negotiations dn
    JOIN orders o ON o.id = dn.order_id
    WHERE o.buyer_id = auth.uid()
       OR o.depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));
CREATE POLICY "rounds:parties:insert"
  ON delivery_rounds FOR INSERT
  WITH CHECK (negotiation_id IN (
    SELECT dn.id FROM delivery_negotiations dn
    JOIN orders o ON o.id = dn.order_id
    WHERE o.buyer_id = auth.uid()
       OR o.depot_id IN (SELECT id FROM depots WHERE owner_id = auth.uid())
  ));

-- ── Transactions ─────────────────────────────────────────────────────
CREATE POLICY "txn:own:select"
  ON transactions FOR SELECT
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));
CREATE POLICY "txn:own:insert"
  ON transactions FOR INSERT
  WITH CHECK (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- ── Price History — public read ──────────────────────────────────────
CREATE POLICY "price_history:public:select"
  ON price_history FOR SELECT USING (true);
