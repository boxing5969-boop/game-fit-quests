-- 보상 중복 막기 (2026-11-19 대표님 「진행」 · 앱 5대 점검 — 「버튼을 두 번 누르면 두 번 처리」)
--
-- 같은 요청이 같은 순간 두 번 들어오면(두 번 눌림 · 두 화면 · 느린 통신 다시 보내기)
-- 「이미 했나?」 확인을 둘 다 통과해 보상이 두 번 나갔다(출석 체크 XP · 챔피언 머니 실제 1건, 10/23).
--   · record_attendance · record_class_participation — 회원마다 한 줄로 세운다(advisory lock).
--     두 번째 요청은 첫 번째가 끝날 때까지 기다렸다가 「이미 했나?」 확인에서 멈춘다.
--   · approve_mission_submission · approve_quest_submission — 승인할 줄을 잠그고 읽는다(FOR UPDATE).
--     두 번째 승인은 첫 번째가 끝난 뒤 'Not pending' 으로 멈춘다.
-- 네 함수 모두 DB 의 지금 정의 위에 그 한 줄만 더했다(보상 금액 · 권한 · 알림 · 레벨업 그대로).
-- 실행 권한은 그대로(create or replace 는 권한을 바꾸지 않는다). 줄을 지우는 문장 없음.

CREATE OR REPLACE FUNCTION public.record_attendance(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 2026-11-19: 같은 회원의 요청은 한 번에 하나씩 — 두 번째는 여기서 기다렸다가 아래 확인에서 멈춘다
  PERFORM pg_advisory_xact_lock(hashtext('record_attendance:' || _user_id::text));

  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = _user_id AND reason = '출석 체크'
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN
    RETURN;
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_user_id, 10, '출석 체크');

  UPDATE member_progress
  SET total_xp = total_xp + 10, streak_days = streak_days + 1
  WHERE user_id = _user_id;

  -- 챔피언 머니 +20 (기존 +2)
  PERFORM grant_gems(_user_id, 20, '출석 체크 보상');
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_class_participation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_xp integer := 20;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 2026-11-19: 같은 회원의 요청은 한 번에 하나씩 — 두 번째는 여기서 기다렸다가 아래 확인에서 멈춘다
  PERFORM pg_advisory_xact_lock(hashtext('record_class_participation:' || v_uid::text));

  -- KST 기준 오늘 이미 수령했으면 no-op
  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = v_uid AND reason = '코치 수업 참여'
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN
    RETURN jsonb_build_object('success', false, 'already', true);
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason) VALUES (v_uid, v_xp, '코치 수업 참여');
  UPDATE member_progress SET total_xp = total_xp + v_xp WHERE user_id = v_uid;
  INSERT INTO notifications (user_id, title, body)
  VALUES (v_uid, '코치 수업 참여 +20XP 🧑‍🏫', '오늘도 수업에서 함께 성장했어요!');

  RETURN jsonb_build_object('success', true, 'xp_granted', v_xp);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_mission_submission(_submission_id uuid, _coach_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub record; _mission record; _progress record; _level record;
  _xp_amount int; _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name; _caller_id uuid := auth.uid(); _caller_name text;
BEGIN
  -- 2026-11-19: 줄을 잠그고 읽는다 — 같은 제출을 두 번 승인하면 두 번째는 'Not pending'
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id FOR UPDATE;
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
  PERFORM grant_gems(_sub.user_id, 5, _mission.title || ' 클리어 보상');
  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;
  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 AND _progress.current_rank IN ('white','blue') THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;
  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _mission.title || ' 완료를 승인했습니다',
    'XP +' || _xp_amount || ', 💎 +5 획득!');
  RETURN jsonb_build_object('xp_granted', _xp_amount, 'gems_granted', 5, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_quest_submission(_submission_id uuid, _coach_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub record; _quest record; _xp_amount int; _progress record; _level record;
  _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name;
  _caller_id uuid := auth.uid(); _caller_name text;
  _gem_amount int;
BEGIN
  -- 2026-11-19: 줄을 잠그고 읽는다 — 같은 제출을 두 번 승인하면 두 번째는 'Not pending'
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status::text != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _quest FROM quests WHERE id = _sub.quest_id;
  _xp_amount := COALESCE(NULLIF(_quest.xp_reward, 0), get_quest_xp(_quest.quest_type));
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  -- Determine gem amount by quest type
  _gem_amount := CASE _quest.quest_type
    WHEN 'main' THEN 3
    WHEN 'sub' THEN 5
    WHEN 'weekly' THEN 10
    WHEN 'boss' THEN 50
    ELSE 3
  END;

  UPDATE quest_submissions SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_sub.user_id, _xp_amount, _quest.title || ' 완료');
  UPDATE member_progress SET total_xp = total_xp + _xp_amount WHERE user_id = _sub.user_id;
  IF _quest.quest_type = 'boss' THEN UPDATE member_progress SET bosses_cleared = bosses_cleared + 1 WHERE user_id = _sub.user_id; END IF;

  -- Grant gems
  PERFORM grant_gems(_sub.user_id, _gem_amount, _quest.title || ' 완료 보상');

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;
  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _quest.title || ' 완료를 승인했습니다', 'XP +' || _xp_amount || ', 💎 +' || _gem_amount || ' 획득!');

  RETURN jsonb_build_object('xp_granted', _xp_amount, 'gems_granted', _gem_amount, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$function$;
