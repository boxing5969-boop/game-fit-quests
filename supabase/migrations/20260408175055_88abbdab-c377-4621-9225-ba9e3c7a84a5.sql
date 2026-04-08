
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_branch_manager_of(_manager_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles mgr
    JOIN profiles mem ON mem.branch_name = mgr.branch_name
    WHERE mgr.user_id = _manager_id
      AND mem.user_id = _member_id
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = _manager_id AND role IN ('branch_manager', 'super_admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_same_branch(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p1
    JOIN profiles p2 ON p1.branch_name = p2.branch_name
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = _user_id
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('branch_manager', 'super_admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.create_notification(_user_id uuid, _title text, _body text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO notifications (user_id, title, body)
  VALUES (_user_id, _title, _body)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- RLS for level_status
CREATE POLICY "Users view own level_status" ON public.level_status
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Branch managers manage same branch level_status" ON public.level_status
  FOR ALL TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all level_status" ON public.level_status
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'));

-- RLS for manager_notes
CREATE POLICY "Managers view own notes" ON public.manager_notes
  FOR SELECT TO authenticated USING (manager_id = auth.uid());

CREATE POLICY "Members view visible notes" ON public.manager_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND note_type = 'visible');

CREATE POLICY "Branch managers create notes" ON public.manager_notes
  FOR INSERT TO authenticated WITH CHECK (is_same_branch(user_id) AND manager_id = auth.uid());

CREATE POLICY "Managers update own notes" ON public.manager_notes
  FOR UPDATE TO authenticated USING (manager_id = auth.uid());

CREATE POLICY "Managers delete own notes" ON public.manager_notes
  FOR DELETE TO authenticated USING (manager_id = auth.uid());

CREATE POLICY "Super admins manage all notes" ON public.manager_notes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'));

-- RLS for notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System creates notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Super admins manage all notifications" ON public.notifications
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'));

-- Branch manager policies on existing tables
CREATE POLICY "Branch managers view same branch progress" ON public.member_progress
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers update same branch progress" ON public.member_progress
  FOR UPDATE TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch mission_submissions" ON public.mission_submissions
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers update same branch mission_submissions" ON public.mission_submissions
  FOR UPDATE TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch quest_submissions" ON public.quest_submissions
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers update same branch quest_submissions" ON public.quest_submissions
  FOR UPDATE TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch xp" ON public.xp_logs
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch mastery" ON public.hidden_mastery
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers update same branch mastery" ON public.hidden_mastery
  FOR UPDATE TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers view same branch cert" ON public.external_cert_progress
  FOR SELECT TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Branch managers update same branch cert" ON public.external_cert_progress
  FOR UPDATE TO authenticated USING (is_same_branch(user_id));

-- Migrate roles
UPDATE public.user_roles SET role = 'branch_manager' WHERE role = 'coach';
UPDATE public.user_roles SET role = 'super_admin' WHERE role = 'admin';

-- set_level_status function
CREATE OR REPLACE FUNCTION public.set_level_status(
  _member_id uuid, _rank rank_name, _level int, _status level_status_type, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _caller_name text;
  _rank_label text;
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;
  _rank_label := CASE _rank WHEN 'white' THEN '화이트' WHEN 'blue' THEN '블루' WHEN 'red' THEN '레드' WHEN 'black' THEN '블랙' END;

  INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  VALUES (_member_id, _rank, _level, _status,
    CASE WHEN _status IN ('approved', 'boss_cleared') THEN now() ELSE NULL END,
    _caller_id, _note)
  ON CONFLICT (user_id, rank_name, level_number)
  DO UPDATE SET status = _status,
    completed_at = CASE WHEN _status IN ('approved', 'boss_cleared') THEN now() ELSE NULL END,
    approved_by = _caller_id, approval_note = _note, updated_at = now();

  IF _status = 'approved' THEN
    PERFORM create_notification(_member_id,
      COALESCE(_caller_name, '관장님') || '님이 ' || _rank_label || ' 레벨 ' || _level || ' 완료를 승인했습니다', '');
  ELSIF _status = 'revision_requested' THEN
    PERFORM create_notification(_member_id,
      COALESCE(_caller_name, '관장님') || '님이 ' || _rank_label || ' 레벨 ' || _level || ' 보완을 요청했습니다', COALESCE(_note, ''));
  END IF;

  RETURN jsonb_build_object('status', _status::text, 'rank', _rank::text, 'level', _level);
END;
$$;

-- request_mission_revision function
CREATE OR REPLACE FUNCTION public.request_mission_revision(_submission_id uuid, _coach_note text DEFAULT '보완이 필요합니다')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _caller_id uuid := auth.uid();
  _caller_name text;
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;

  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  UPDATE mission_submissions
  SET status = 'revision_requested', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _submission_id;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 보완을 요청했습니다', COALESCE(_coach_note, ''));
END;
$$;

-- get_branch_stats function
CREATE OR REPLACE FUNCTION public.get_branch_stats(_branch_name text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_members int;
  _pending_count int;
  _weekly_levelups int;
  _today_submissions int;
BEGIN
  SELECT COUNT(*) INTO _total_members FROM profiles WHERE branch_name = _branch_name;

  SELECT COUNT(*) INTO _pending_count
  FROM mission_submissions ms JOIN profiles p ON p.user_id = ms.user_id
  WHERE p.branch_name = _branch_name AND ms.status = 'pending';

  _pending_count := _pending_count + (
    SELECT COUNT(*) FROM quest_submissions qs JOIN profiles p ON p.user_id = qs.user_id
    WHERE p.branch_name = _branch_name AND qs.status::text = 'pending'
  );

  SELECT COUNT(*) INTO _weekly_levelups
  FROM xp_logs xl JOIN profiles p ON p.user_id = xl.user_id
  WHERE p.branch_name = _branch_name AND xl.created_at >= date_trunc('week', CURRENT_DATE)
    AND xl.reason LIKE '%레벨업%';

  SELECT COUNT(*) INTO _today_submissions
  FROM mission_submissions ms JOIN profiles p ON p.user_id = ms.user_id
  WHERE p.branch_name = _branch_name AND ms.requested_at::date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_members', _total_members, 'pending_count', _pending_count,
    'weekly_levelups', _weekly_levelups, 'today_submissions', _today_submissions
  );
END;
$$;

-- Update existing functions to use new roles
CREATE OR REPLACE FUNCTION public.approve_mission_submission(_submission_id uuid, _coach_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sub record; _mission record; _progress record; _level record;
  _xp_amount int; _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name;
  _caller_id uuid := auth.uid(); _caller_name text;
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _mission FROM missions WHERE id = _sub.mission_id;
  _xp_amount := _mission.xp_reward;
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  UPDATE mission_submissions SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_sub.user_id, _xp_amount, _mission.title || ' 클리어');
  UPDATE member_progress SET total_xp = total_xp + _xp_amount WHERE user_id = _sub.user_id;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;

  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _mission.title || ' 완료를 승인했습니다',
    'XP +' || _xp_amount || ' 획득!');

  RETURN jsonb_build_object('xp_granted', _xp_amount, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_mission_submission(_submission_id uuid, _coach_note text DEFAULT '다시 도전해보세요')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _sub record; _caller_id uuid := auth.uid(); _caller_name text;
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;
  UPDATE mission_submissions SET status = 'rejected', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  PERFORM create_notification(_sub.user_id, COALESCE(_caller_name, '관장님') || '님이 미션을 반려했습니다', COALESCE(_coach_note, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_quest_submission(_submission_id uuid, _coach_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sub record; _quest record; _xp_amount int; _progress record; _level record;
  _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name;
  _caller_id uuid := auth.uid(); _caller_name text;
BEGIN
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status::text != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _quest FROM quests WHERE id = _sub.quest_id;
  _xp_amount := COALESCE(NULLIF(_quest.xp_reward, 0), get_quest_xp(_quest.quest_type));
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  UPDATE quest_submissions SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_sub.user_id, _xp_amount, _quest.title || ' 완료');
  UPDATE member_progress SET total_xp = total_xp + _xp_amount WHERE user_id = _sub.user_id;
  IF _quest.quest_type = 'boss' THEN UPDATE member_progress SET bosses_cleared = bosses_cleared + 1 WHERE user_id = _sub.user_id; END IF;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;
  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _quest.title || ' 완료를 승인했습니다', 'XP +' || _xp_amount || ' 획득!');

  RETURN jsonb_build_object('xp_granted', _xp_amount, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_quest_submission(_submission_id uuid, _coach_note text DEFAULT '다시 도전해보세요')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _sub record; _caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE quest_submissions SET status = 'rejected', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pass_boss_battle(_member_id uuid, _coach_note text DEFAULT '타이틀매치 합격')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid(); _progress record; _next_rank rank_name;
  _rank_order text[] := ARRAY['white','blue','red','black']; _current_idx int; _caller_name text;
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF _progress.current_level != 10 THEN RAISE EXCEPTION 'Member is not at level 10'; END IF;
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  _current_idx := array_position(_rank_order, _progress.current_rank::text);

  INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  VALUES (_member_id, _progress.current_rank, 10, 'boss_cleared', now(), _caller_id, _coach_note)
  ON CONFLICT (user_id, rank_name, level_number)
  DO UPDATE SET status = 'boss_cleared', completed_at = now(), approved_by = _caller_id, approval_note = _coach_note;

  IF _current_idx IS NULL OR _current_idx >= 4 THEN
    UPDATE member_progress SET bosses_cleared = bosses_cleared + 1 WHERE user_id = _member_id;
    PERFORM create_notification(_member_id, '보스전 합격! 축하합니다! 🏆', '');
    RETURN jsonb_build_object('ranked_up', false, 'new_rank', _progress.current_rank::text, 'new_level', 10);
  END IF;

  _next_rank := _rank_order[_current_idx + 1]::rank_name;
  UPDATE member_progress SET current_rank = _next_rank, current_level = 1, bosses_cleared = bosses_cleared + 1 WHERE user_id = _member_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, 100, _progress.current_rank::text || ' 타이틀매치 클리어');
  UPDATE member_progress SET total_xp = total_xp + 100 WHERE user_id = _member_id;

  INSERT INTO level_status (user_id, rank_name, level_number, status)
  VALUES (_member_id, _next_rank, 1, 'in_progress')
  ON CONFLICT (user_id, rank_name, level_number) DO UPDATE SET status = 'in_progress';

  PERFORM create_notification(_member_id,
    '축하합니다! ' || CASE _next_rank WHEN 'blue' THEN '블루' WHEN 'red' THEN '레드' WHEN 'black' THEN '블랙' ELSE _next_rank::text END || ' 레벨 1이 해금되었습니다! 🎉', '');

  RETURN jsonb_build_object('ranked_up', true, 'new_rank', _next_rank::text, 'new_level', 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_level(_member_id uuid, _rank rank_name, _level integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller_id uuid := auth.uid();
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _level < 1 OR _level > 10 THEN RAISE EXCEPTION 'Level must be between 1 and 10'; END IF;
  UPDATE member_progress SET current_rank = _rank, current_level = _level WHERE user_id = _member_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, 0, '관리자 레벨 설정 → ' || _rank::text || ' Lv.' || _level);
  RETURN jsonb_build_object('new_level', _level, 'new_rank', _rank::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_manual_xp(_member_id uuid, _amount integer, _reason text DEFAULT '수동 XP 지급')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller_id uuid := auth.uid();
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, _amount, _reason);
  UPDATE member_progress SET total_xp = total_xp + _amount WHERE user_id = _member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manual_level_up(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller_id uuid := auth.uid(); _progress record; _new_level int;
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF _progress.current_level >= 10 THEN RAISE EXCEPTION 'Level 10 requires boss battle'; END IF;

  _new_level := _progress.current_level + 1;
  UPDATE member_progress SET current_level = _new_level WHERE user_id = _member_id;

  INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by)
  VALUES (_member_id, _progress.current_rank, _progress.current_level, 'approved', now(), _caller_id)
  ON CONFLICT (user_id, rank_name, level_number) DO UPDATE SET status = 'approved', completed_at = now(), approved_by = _caller_id;

  INSERT INTO level_status (user_id, rank_name, level_number, status)
  VALUES (_member_id, _progress.current_rank, _new_level, 'in_progress')
  ON CONFLICT (user_id, rank_name, level_number) DO UPDATE SET status = 'in_progress';

  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, 0, '관리자 수동 레벨업 → Lv.' || _new_level);

  PERFORM create_notification(_member_id,
    CASE _progress.current_rank WHEN 'white' THEN '화이트' WHEN 'blue' THEN '블루' WHEN 'red' THEN '레드' WHEN 'black' THEN '블랙' END || ' 레벨 ' || _new_level || ' 해금! 🎉', '');

  RETURN jsonb_build_object('new_level', _new_level, 'current_rank', _progress.current_rank::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.manual_level_down(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid(); _progress record;
  _rank_order text[] := ARRAY['white','blue','red','black'];
  _current_idx int; _new_level int; _new_rank rank_name;
BEGIN
  IF NOT has_role(_caller_id, 'super_admin') THEN RAISE EXCEPTION 'Not authorized - super_admin only'; END IF;
  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF _progress.current_level > 1 THEN
    _new_level := _progress.current_level - 1; _new_rank := _progress.current_rank;
  ELSE
    _current_idx := array_position(_rank_order, _progress.current_rank::text);
    IF _current_idx IS NULL OR _current_idx <= 1 THEN RAISE EXCEPTION 'Cannot demote below White Lv.1'; END IF;
    _new_rank := _rank_order[_current_idx - 1]::rank_name; _new_level := 10;
    UPDATE member_progress SET bosses_cleared = GREATEST(bosses_cleared - 1, 0) WHERE user_id = _member_id;
  END IF;
  UPDATE member_progress SET current_level = _new_level, current_rank = _new_rank WHERE user_id = _member_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, 0, '관리자 수동 강등 → ' || _new_rank::text || ' Lv.' || _new_level);
  RETURN jsonb_build_object('new_level', _new_level, 'new_rank', _new_rank::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_coach_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller_id uuid := auth.uid(); _req record;
BEGIN
  IF NOT has_role(_caller_id, 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _req FROM coach_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  UPDATE user_roles SET role = 'branch_manager' WHERE user_id = _req.user_id;
  UPDATE coach_requests SET status = 'approved', reviewed_at = now(), reviewed_by = _caller_id WHERE id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_coach_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_caller_id, 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE coach_requests SET status = 'rejected', reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _request_id AND status = 'pending';
END;
$$;
