-- 20250824_001_add_constraints.sql (repaired)
-- 1. Buat enum type untuk discount (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_discount_type') THEN
    CREATE TYPE promotion_discount_type AS ENUM ('percent', 'nominal');
  END IF;
END
$$ LANGUAGE plpgsql;

-- 2. Ubah kolom type di promotions jadi enum promotion_discount_type (jika kolom promotions ada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='type') THEN
    -- only try alter if promotions table exists
    BEGIN
      ALTER TABLE promotions
      ALTER COLUMN type TYPE promotion_discount_type
      USING (
        CASE
          WHEN lower(type::text) LIKE '%percent%' THEN 'percent'::promotion_discount_type
          WHEN lower(type::text) LIKE '%nominal%' THEN 'nominal'::promotion_discount_type
          ELSE NULL
        END
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not alter promotions.type to enum (maybe values incompatible).';
    END;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 3. Constraint: start_date harus <= end_date untuk promotions (tambahkan hanya kalau promotions ada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotions_dates') THEN
      ALTER TABLE promotions
        ADD CONSTRAINT chk_promotions_dates CHECK (
          start_date IS NULL OR end_date IS NULL OR start_date <= end_date
        );
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;
