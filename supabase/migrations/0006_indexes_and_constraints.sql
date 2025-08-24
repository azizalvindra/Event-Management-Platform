-- 006_indexes_and_constraints.sql
-- create indexes and check constraints with safe guards

-- indexes
CREATE INDEX IF NOT EXISTS idx_promotions_event_id ON promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status_start_end ON promotions(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_promo ON user_vouchers(user_id, promotion_id, used, expires_at);

-- check constraint for promotions.start_date <= promotions.end_date (add safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotions_dates'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT chk_promotions_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
      );
  END IF;
END;
$$ LANGUAGE plpgsql;
