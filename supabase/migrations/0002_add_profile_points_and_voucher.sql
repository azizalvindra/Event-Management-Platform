-- 002_add_profile_points_and_voucher.sql
-- Tambah kolom points dan voucher_promotion_id pada profiles (idempotent)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS points int4 DEFAULT 0;

-- tambahkan kolom voucher_promotion_id untuk menyimpan referensi promotion pilihan pada profile (opsional)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS voucher_promotion_id uuid;

-- buat FK secara safe (cek dulu)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'profiles'
      AND kcu.column_name = 'voucher_promotion_id'
  ) THEN
    BEGIN
      ALTER TABLE profiles
        ADD CONSTRAINT profiles_voucher_promotion_fkey
        FOREIGN KEY (voucher_promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;
    EXCEPTION WHEN undefined_table OR duplicate_object THEN
      -- if promotions or constraint missing, ignore for now
      RAISE NOTICE 'Could not create FK profiles.voucher_promotion_id -> promotions(id) (maybe promotions table missing).';
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;
