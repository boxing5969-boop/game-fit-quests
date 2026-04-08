
-- Function to demote a member by 1 level
CREATE OR REPLACE FUNCTION public.manual_level_down(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _progress record;
  _rank_order text[] := ARRAY['white','blue','red','black'];
  _current_idx int;
  _new_level int;
  _new_rank rank_name;
BEGIN
  IF NOT has_role(_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF _progress.current_level > 1 THEN
    -- Simple level down
    _new_level := _progress.current_level - 1;
    _new_rank := _progress.current_rank;
  ELSE
    -- At level 1, need to go to previous rank level 10
    _current_idx := array_position(_rank_order, _progress.current_rank::text);
    IF _current_idx IS NULL OR _current_idx <= 1 THEN
      RAISE EXCEPTION 'Cannot demote below White Lv.1';
    END IF;
    _new_rank := _rank_order[_current_idx - 1]::rank_name;
    _new_level := 10;
    -- Also decrement bosses_cleared since they're going back
    UPDATE member_progress
    SET bosses_cleared = GREATEST(bosses_cleared - 1, 0)
    WHERE user_id = _member_id;
  END IF;

  UPDATE member_progress
  SET current_level = _new_level, current_rank = _new_rank
  WHERE user_id = _member_id;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_member_id, 0, '관리자 수동 강등 → ' || _new_rank::text || ' Lv.' || _new_level);

  RETURN jsonb_build_object(
    'new_level', _new_level,
    'new_rank', _new_rank::text
  );
END;
$$;

-- Function to set member level directly
CREATE OR REPLACE FUNCTION public.set_member_level(_member_id uuid, _rank rank_name, _level int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;

  IF _level < 1 OR _level > 10 THEN
    RAISE EXCEPTION 'Level must be between 1 and 10';
  END IF;

  UPDATE member_progress
  SET current_rank = _rank, current_level = _level
  WHERE user_id = _member_id;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_member_id, 0, '관리자 레벨 설정 → ' || _rank::text || ' Lv.' || _level);

  RETURN jsonb_build_object(
    'new_level', _level,
    'new_rank', _rank::text
  );
END;
$$;
