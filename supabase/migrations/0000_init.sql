-- 000_init.sql
-- Baseline schema (init) untuk project event-mgmt-platform
-- Idempotent: bisa di-run berulang tanpa merusak schema yang sudah ada

-- 0) extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Tabel profiles (users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  full_name text,
  referral_code text,    -- kode yang user bagikan
  referred_by text,      -- kode referral yang dipakai saat registrasi
  role text DEFAULT 'customer', -- contoh: 'customer', 'admin', 'staff'
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- points bisa ditambahkan oleh migration berikutnya (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
  -- voucher_promotion_id juga akan ditambahkan/di-link oleh migration incremental
  meta jsonb
);

-- 2) Tabel events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  venue text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  meta jsonb
);

-- 3) Tabel promotions (promosi/voucher)
-- Note: kolom "type" didefinisikan sebagai text di init; nanti migration akan convert ke ENUM jika diinginkan
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text,
  description text,
  discount numeric,          -- nilai diskon (persen atau nominal), interpretasi oleh kolom type
  type text,                 -- awalnya text; nanti di-migrate ke promotion_discount_type enum
  start_date timestamptz,
  end_date timestamptz,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  status text DEFAULT 'active', -- 'active'|'inactive'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  meta jsonb
);

-- 4) Tabel transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  total_amount numeric DEFAULT 0,
  total_quantity int4 DEFAULT 1,
  voucher_promotion_id uuid, -- link ke promotions (nullable)
  points_used int4 DEFAULT 0,
  transaction_status text DEFAULT 'pending', -- pending|completed|canceled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  meta jsonb
);

-- 5) Tabel transaction_items (detail tiket per transaction)
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  price numeric DEFAULT 0,
  quantity int4 DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  meta jsonb
);

-- 6) Tabel user_vouchers (voucher owned by user)
CREATE TABLE IF NOT EXISTS user_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  used boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  meta jsonb
);

-- 7) Tabel points_history (ledger untuk points)
CREATE TABLE IF NOT EXISTS points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points int4 NOT NULL CHECK (points >= 0),
  points_remaining int4 NOT NULL CHECK (points_remaining >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz NOT NULL,
  reason text,
  meta jsonb
);

-- 8) Helper trigger/function: set updated_at on updated rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tables that have updated_at
DO $$
BEGIN
  -- profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_profiles'
  ) THEN
    CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- events
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_events'
  ) THEN
    CREATE TRIGGER set_updated_at_events
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- promotions
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_promotions'
  ) THEN
    CREATE TRIGGER set_updated_at_promotions
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- transactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_transactions'
  ) THEN
    CREATE TRIGGER set_updated_at_transactions
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 9) Index-basic (bisa ditambah oleh migration khusus indexes)
CREATE INDEX IF NOT EXISTS idx_events_start_end ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_event_id ON promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_points_history_user_id ON points_history(user_id);

-- 10) Small sanity data (optional, non-destructive seeds)
-- only insert if not exists (helpful for local dev)
INSERT INTO events (id, title, start_date, end_date)
SELECT gen_random_uuid(), 'Sample Event (local)', now() + interval '7 days', now() + interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Sample Event (local)');

INSERT INTO profiles (email, full_name, referral_code)
SELECT 'local-admin@example.com', 'Local Admin', 'LOCALADMIN'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'local-admin@example.com');

-- End of 000_init.sql
