-- 004_referral_trigger.sql
-- Trigger: after insert into profiles, if referred_by present then:
-- - credit referrer 10.000 points
-- - assign a promotion voucher to new user (if referral promotion exists)

-- Note: we assume profiles has columns: id, referral_code (string), referred_by (string or code).
-- If your column names differ, sesuaikan.

DROP FUNCTION IF EXISTS trg_profiles_after_insert();
CREATE OR REPLACE FUNCTION trg_profiles_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id uuid;
  v_promo_id uuid;
  v_promo_end timestamptz;
BEGIN
  IF NEW.referred_by IS NOT NULL AND NEW.referred_by <> '' THEN
    -- find referrer by referral_code
    SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = NEW.referred_by LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      -- give referrer 10.000 points
      PERFORM add_points(v_referrer_id, 10000, 'referral_reward');

      -- assign a referral promotion to the new user (pick an active promotion tagged for referral if available)
      SELECT p.id, p.end_date INTO v_promo_id, v_promo_end
      FROM promotions p
      WHERE p.status = 'active'
        AND (p.start_date IS NULL OR p.start_date <= now())
        AND (p.end_date IS NULL OR p.end_date >= now())
        AND (p.code ILIKE 'REF%' OR p.code ILIKE '%REFERRAL%' ) -- heuristic: your referral promos may follow code pattern
      ORDER BY p.created_at
      LIMIT 1;

      IF v_promo_id IS NOT NULL THEN
        INSERT INTO user_vouchers (user_id, promotion_id, assigned_at, expires_at)
        VALUES (NEW.id, v_promo_id, now(), v_promo_end);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_after_insert ON profiles;
CREATE TRIGGER profiles_after_insert
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION trg_profiles_after_insert();
