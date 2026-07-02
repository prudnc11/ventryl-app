-- Full reset — drops all Ventryl tables and triggers.
-- Run this first, then run schema.sql, then seed.sql.

-- Drop triggers first
DROP TRIGGER IF EXISTS profiles_updated_at  ON profiles;
DROP TRIGGER IF EXISTS wallets_updated_at   ON wallets;
DROP TRIGGER IF EXISTS depots_updated_at    ON depots;
DROP TRIGGER IF EXISTS negot_updated_at     ON delivery_negotiations;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop tables (order matters — child tables first)
DROP TABLE IF EXISTS delivery_rounds          CASCADE;
DROP TABLE IF EXISTS delivery_negotiations    CASCADE;
DROP TABLE IF EXISTS order_trucks             CASCADE;
DROP TABLE IF EXISTS order_status_logs        CASCADE;
DROP TABLE IF EXISTS order_items              CASCADE;
DROP TABLE IF EXISTS orders                   CASCADE;
DROP TABLE IF EXISTS transactions             CASCADE;
DROP TABLE IF EXISTS stock_history            CASCADE;
DROP TABLE IF EXISTS depot_products           CASCADE;
DROP TABLE IF EXISTS depots                   CASCADE;
DROP TABLE IF EXISTS wallets                  CASCADE;
DROP TABLE IF EXISTS price_history            CASCADE;
DROP TABLE IF EXISTS profiles                 CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user()    CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()     CASCADE;
DROP FUNCTION IF EXISTS next_order_id()      CASCADE;

-- Drop sequence
DROP SEQUENCE IF EXISTS order_seq;
