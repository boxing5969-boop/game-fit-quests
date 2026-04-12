-- 1. Create admin_bulk_actions audit log table
CREATE TABLE public.admin_bulk_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  executed_by uuid NOT NULL,
  action_type text NOT NULL DEFAULT 'bulk_complete',
  summary text NOT NULL DEFAULT '',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  can_rollback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_bulk_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage bulk actions"
  ON public.admin_bulk_actions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins insert bulk actions"
  ON public.admin_bulk_actions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin') AND executed_by = auth.uid());

-- 2. Create bulk_complete_member function
CREATE OR REPLACE FUNCTION public.bulk_complete_member(
  _member_id uuid,
  _reason text DEFAULT '관리자 일괄 완료',
  _send_notification boolean DEFAULT false,
  _options jsonb DEFAULT '{"missions":true,"levels":true,"bosses":true,"badges":true,"master40":true}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _caller_name text;
  _rank_order text[] := ARRAY['white','blue','red','black'];
  _r text;
  _lvl int;
  _badge record;
  _badge_count int := 0;
  _level_count int := 0;
  _mission_count int := 0;
  _boss_count int := 0;
  _prev_xp int;
  _target_xp int := 2000; -- base target XP for full completion
  _xp_diff int;
  _do_missions boolean;
  _do_levels boolean;
  _do_bosses boolean;
  _do_badges boolean;
  _do_master boolean;
BEGIN
  -- Only super_admin can execute
  IF NOT has_role(_caller_id, 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized - super_admin only';
  END IF;

  -- Check target exists
  IF NOT EXISTS (SELECT 1 FROM member_progress WHERE user_id = _member_id) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  -- Parse options
  _do_missions := COALESCE((_options->>'missions')::boolean, true);
  _do_levels := COALESCE((_options->>'levels')::boolean, true);
  _do_bosses := COALESCE((_options->>'bosses')::boolean, true);
  _do_badges := COALESCE((_options->>'badges')::boolean, true);
  _do_master := COALESCE((_options->>'master40')::boolean, true);

  -- Get current XP
  SELECT total_xp INTO _prev_xp FROM member_progress WHERE user_id = _member_id;

  -- A. Complete all levels
  IF _do_levels THEN
    FOREACH _r IN ARRAY _rank_order LOOP
      FOR _lvl IN 1..10 LOOP
        INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
        VALUES (_member_id, _r::rank_name, _lvl,
          CASE WHEN _lvl = 10 THEN 'boss_cleared'::level_status_type ELSE 'approved'::level_status_type END,
          now(), _caller_id, _reason)
        ON CONFLICT (user_id, rank_name, level_number)
        DO UPDATE SET
          status = CASE WHEN _lvl = 10 THEN 'boss_cleared'::level_status_type ELSE 'approved'::level_status_type END,
          completed_at = now(), approved_by = _caller_id, approval_note = _reason, updated_at = now();
        _level_count := _level_count + 1;
      END LOOP;
    END LOOP;
  END IF;

  -- B. Complete all boss battles & update progress
  IF _do_bosses OR _do_master THEN
    UPDATE member_progress
    SET current_rank = 'black', current_level = 10, bosses_cleared = 4
    WHERE user_id = _member_id;
    _boss_count := 4;
  END IF;

  -- C. Grant all badges
  IF _do_badges THEN
    FOR _badge IN SELECT id FROM badges LOOP
      INSERT INTO member_badges (user_id, badge_id)
      VALUES (_member_id, _badge.id)
      ON CONFLICT DO NOTHING;
      _badge_count := _badge_count + 1;
    END LOOP;
  END IF;

  -- D. Adjust XP
  _xp_diff := GREATEST(0, _target_xp - _prev_xp);
  IF _xp_diff > 0 THEN
    INSERT INTO xp_logs (user_id, amount, reason)
    VALUES (_member_id, _xp_diff, 'super_admin 일괄 완료: ' || _reason);
    UPDATE member_progress SET total_xp = total_xp + _xp_diff WHERE user_id = _member_id;
  END IF;

  -- E. Audit log
  INSERT INTO admin_bulk_actions (target_user_id, executed_by, action_type, summary, payload_json, reason)
  VALUES (
    _member_id, _caller_id, 'bulk_complete',
    '레벨 ' || _level_count || '개, 보스전 ' || _boss_count || '회, 배지 ' || _badge_count || '개 완료 처리',
    jsonb_build_object(
      'options', _options,
      'levels_completed', _level_count,
      'bosses_cleared', _boss_count,
      'badges_granted', _badge_count,
      'xp_added', _xp_diff,
      'prev_xp', _prev_xp
    ),
    _reason
  );

  -- F. Notification
  IF _send_notification THEN
    PERFORM create_notification(_member_id,
      '축하합니다! 전체 과정이 완료 처리되었습니다 🏆',
      COALESCE(_caller_name, '관리자') || '님이 ' || _reason || ' 사유로 처리했습니다.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'levels_completed', _level_count,
    'bosses_cleared', _boss_count,
    'badges_granted', _badge_count,
    'xp_added', _xp_diff,
    'final_rank', 'black',
    'final_level', 10,
    'master40', _do_master
  );
END;
$$;