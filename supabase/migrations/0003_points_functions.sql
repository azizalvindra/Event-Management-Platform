-- 003_points_functions.sql
-- Functions: add_points, use_points, get_available_points
-- Use deterministic bigint key for advisory lock derived from md5(uuid)

-- helper: produce bigint from uuid/text for advisory lock
CREATE OR REPLACE FUNCTION _uuid_to_bigint(text) RETURNS bigint
LANGUAGE sql IMMUTABLE AS $$
  SELECT (('x' || substr(md5($1),1,16))::bit(64))::bigint;
$$;

-- drop existing functions if incompatible
DROP FUNCTION IF EXISTS use_points(uuid, int4);
DROP FUNCTION IF EXISTS add_points(uuid, int4, text);

-- add_points(user_id, points, reason)
CREATE OR REPLACE FUNCTION add_points(p_user_id uuid, p_points int4, p_reason text DEFAULT 'credit')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'p_points must be > 0';
  END IF;

  -- per-user advisory xact lock
  PERFORM pg_advisory_xact_lock(_uuid_to_bigint(p_user_id::text));

  INSERT INTO points_history (user_id, points, points_remaining, expired_at, reason, created_at)
  VALUES (p_user_id, p_points, p_points, now() + interval '3 months', p_reason, now());

  UPDATE profiles
  SET points = COALESCE(points,0) + p_points
  WHERE id = p_user_id;
END;
$$;

-- use_points(user_id, amount): deduct FIFO oldest-first, serialized by advisory lock
CREATE OR REPLACE FUNCTION use_points(p_user_id uuid, p_amount int4)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_total int4;
  v_remaining int4 := p_amount;
  rec RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;

  PERFORM pg_advisory_xact_lock(_uuid_to_bigint(p_user_id::text));

  SELECT COALESCE(SUM(points_remaining),0)::int4 INTO v_total
  FROM points_history
  WHERE user_id = p_user_id
    AND expired_at > now();

  IF v_total < p_amount THEN
    RAISE EXCEPTION 'Not enough available points: have % need %', v_total, p_amount;
  END IF;

  FOR rec IN
    SELECT id, points_remaining
    FROM points_history
    WHERE user_id = p_user_id
      AND points_remaining > 0
      AND expired_at > now()
    ORDER BY created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF rec.points_remaining <= v_remaining THEN
      v_remaining := v_remaining - rec.points_remaining;
      UPDATE points_history SET points_remaining = 0 WHERE id = rec.id;
    ELSE
      UPDATE points_history SET points_remaining = points_remaining - v_remaining WHERE id = rec.id;
      v_remaining := 0;
    END IF;
  END LOOP;

  -- update profile points
  UPDATE profiles
  SET points = GREATEST(COALESCE(points,0) - p_amount, 0)
  WHERE id = p_user_id;
END;
$$;

-- helper: get_available_points(user_id)
CREATE OR REPLACE FUNCTION get_available_points(p_user_id uuid)
RETURNS int4 LANGUAGE sql AS $$
  SELECT COALESCE(SUM(points_remaining),0)::int4
  FROM points_history
  WHERE user_id = p_user_id
    AND expired_at > now();
$$;
