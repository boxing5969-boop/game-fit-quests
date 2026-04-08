
CREATE OR REPLACE FUNCTION public.manual_level_up(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _progress record;
  _new_level int;
BEGIN
  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF _progress.current_level >= 10 THEN
    RAISE EXCEPTION 'Level 10 requires boss battle (타이틀매치)';
  END IF;

  _new_level := _progress.current_level + 1;

  UPDATE member_progress
  SET current_level = _new_level
  WHERE user_id = _member_id;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_member_id, 0, '관리자 수동 레벨업 → Lv.' || _new_level);

  RETURN jsonb_build_object(
    'new_level', _new_level,
    'current_rank', _progress.current_rank::text
  );
END;
$$;
