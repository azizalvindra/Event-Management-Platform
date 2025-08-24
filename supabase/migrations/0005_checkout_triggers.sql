-- 005_checkout_triggers.sql
-- Enforce:
-- - role 'customer' only use voucher once (across transactions)
-- - role 'customer' max 1 ticket per event (any previous non-cancelled transaction)
-- - After transaction insert: consume points_used and mark one user_vouchers row 'used' for that promotion

-- adjust names if your transactions table columns differ (voucher_promotion_id, user_id, event_id, points_used, transaction_status)

DROP FUNCTION IF EXISTS trg_transactions_before_insert();
CREATE OR REPLACE FUNCTION trg_transactions_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_role text;
  v_count int;
BEGIN
  -- check voucher usage rule
  IF NEW.voucher_promotion_id IS NOT NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id LIMIT 1;
    IF v_role = 'customer' THEN
      SELECT COUNT(*) INTO v_count
      FROM transactions
      WHERE user_id = NEW.user_id
        AND voucher_promotion_id IS NOT NULL
        AND (transaction_status IS NULL OR transaction_status <> 'canceled');

      IF v_count > 0 THEN
        RAISE EXCEPTION 'Customer role allowed to use voucher only once';
      END IF;
    END IF;
  END IF;

  -- enforce one ticket per event for customer
  IF NEW.user_id IS NOT NULL AND NEW.event_id IS NOT NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id LIMIT 1;
    IF v_role = 'customer' THEN
      SELECT COUNT(*) INTO v_count
      FROM transactions
      WHERE user_id = NEW.user_id
        AND event_id = NEW.event_id
        AND (transaction_status IS NULL OR transaction_status <> 'canceled');

      IF v_count > 0 THEN
        RAISE EXCEPTION 'Customer role can only have 1 ticket per event';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_before_insert ON transactions;
CREATE TRIGGER transactions_before_insert
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_transactions_before_insert();


-- AFTER insert: consume points and mark voucher used
DROP FUNCTION IF EXISTS trg_transactions_after_insert();
CREATE OR REPLACE FUNCTION trg_transactions_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_used_id uuid;
BEGIN
  IF NEW.points_used IS NOT NULL AND NEW.points_used > 0 THEN
    PERFORM use_points(NEW.user_id, NEW.points_used);
  END IF;

  IF NEW.voucher_promotion_id IS NOT NULL THEN
    -- mark one user_voucher as used (the earliest assigned)
    UPDATE user_vouchers
    SET used = true
    WHERE id IN (
      SELECT id FROM user_vouchers
      WHERE user_id = NEW.user_id
        AND promotion_id = NEW.voucher_promotion_id
        AND used = false
      ORDER BY assigned_at
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_after_insert ON transactions;
CREATE TRIGGER transactions_after_insert
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION trg_transactions_after_insert();
