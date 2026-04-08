
-- =============================================
-- XP constants based on quest type
-- =============================================

-- Function: get XP reward by quest type
CREATE OR REPLACE FUNCTION public.get_quest_xp(qt quest_type)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE qt
    WHEN 'main' THEN 20
    WHEN 'sub' THEN 10
    WHEN 'weekly' THEN 30
    WHEN 'boss' THEN 100
    ELSE 0
  END;
$$;

-- =============================================
-- Approve quest submission (coach/admin)
-- Returns JSON with level_up info
-- =============================================
CREATE OR REPLACE FUNCTION public.approve_quest_submission(
  _submission_id uuid,
  _coach_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _quest record;
  _xp_amount int;
  _progress record;
  _level record;
  _next_rank rank_name;
  _leveled_up boolean := false;
  _ranked_up boolean := false;
  _new_level int;
  _new_rank rank_name;
  _caller_id uuid := auth.uid();
BEGIN
  -- Get submission
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status != 'pending' THEN RAISE EXCEPTION 'Submission is not pending'; END IF;

  -- Auth check: must be coach of this member or admin
  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get quest
  SELECT * INTO _quest FROM quests WHERE id = _sub.quest_id;

  -- Calculate XP (use quest's xp_reward if set, otherwise default by type)
  _xp_amount := COALESCE(NULLIF(_quest.xp_reward, 0), get_quest_xp(_quest.quest_type));

  -- Update submission
  UPDATE quest_submissions
  SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _submission_id;

  -- Grant XP
  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_sub.user_id, _xp_amount, _quest.title || ' 완료');

  -- Update total_xp in member_progress
  UPDATE member_progress
  SET total_xp = total_xp + _xp_amount
  WHERE user_id = _sub.user_id;

  -- If boss quest, increment bosses_cleared
  IF _quest.quest_type = 'boss' THEN
    UPDATE member_progress
    SET bosses_cleared = bosses_cleared + 1
    WHERE user_id = _sub.user_id;
  END IF;

  -- Get updated progress
  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;

  -- Check level-up conditions
  SELECT * INTO _level FROM levels
  WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;

  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    -- Check if not at boss level (level 10 requires boss pass)
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1;
      _new_rank := _progress.current_rank;
      _leveled_up := true;

      UPDATE member_progress
      SET current_level = _new_level
      WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'xp_granted', _xp_amount,
    'leveled_up', _leveled_up,
    'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount
  );
END;
$$;

-- =============================================
-- Reject quest submission
-- =============================================
CREATE OR REPLACE FUNCTION public.reject_quest_submission(
  _submission_id uuid,
  _coach_note text DEFAULT '다시 도전해보세요'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;

  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE quest_submissions
  SET status = 'rejected', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _submission_id;
END;
$$;

-- =============================================
-- Manual XP grant (coach/admin)
-- =============================================
CREATE OR REPLACE FUNCTION public.grant_manual_xp(
  _member_id uuid,
  _amount int,
  _reason text DEFAULT '수동 XP 지급'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_member_id, _amount, _reason);

  UPDATE member_progress
  SET total_xp = total_xp + _amount
  WHERE user_id = _member_id;
END;
$$;

-- =============================================
-- Pass boss battle → rank up
-- =============================================
CREATE OR REPLACE FUNCTION public.pass_boss_battle(
  _member_id uuid,
  _coach_note text DEFAULT '타이틀매치 합격'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _progress record;
  _next_rank rank_name;
  _rank_order text[] := ARRAY['white','blue','red','black'];
  _current_idx int;
BEGIN
  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF _progress.current_level != 10 THEN
    RAISE EXCEPTION 'Member is not at level 10';
  END IF;

  -- Find next rank
  _current_idx := array_position(_rank_order, _progress.current_rank::text);
  IF _current_idx IS NULL OR _current_idx >= 4 THEN
    -- Already at max rank, just mark boss cleared
    UPDATE member_progress
    SET bosses_cleared = bosses_cleared + 1
    WHERE user_id = _member_id;

    RETURN jsonb_build_object('ranked_up', false, 'new_rank', _progress.current_rank::text, 'new_level', 10);
  END IF;

  _next_rank := _rank_order[_current_idx + 1]::rank_name;

  -- Rank up: reset to level 1 of next rank
  UPDATE member_progress
  SET current_rank = _next_rank, current_level = 1, bosses_cleared = bosses_cleared + 1
  WHERE user_id = _member_id;

  -- Grant boss XP
  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_member_id, 100, _progress.current_rank::text || ' 타이틀매치 클리어');

  UPDATE member_progress
  SET total_xp = total_xp + 100
  WHERE user_id = _member_id;

  RETURN jsonb_build_object('ranked_up', true, 'new_rank', _next_rank::text, 'new_level', 1);
END;
$$;

-- =============================================
-- Record daily attendance (10 XP)
-- =============================================
CREATE OR REPLACE FUNCTION public.record_attendance(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the user themselves can record attendance
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Check if already attended today
  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = _user_id AND reason = '출석 체크' AND created_at::date = CURRENT_DATE
  ) THEN
    RETURN; -- Already attended
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_user_id, 10, '출석 체크');

  UPDATE member_progress
  SET total_xp = total_xp + 10, streak_days = streak_days + 1
  WHERE user_id = _user_id;
END;
$$;

-- =============================================
-- Add INSERT policy for xp_logs (for DB functions)
-- =============================================
CREATE POLICY "System can insert xp logs"
  ON public.xp_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
