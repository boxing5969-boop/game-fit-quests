-- ============================================================
-- BOXER 풀파워 검수 확정 수정 4건 (2026-07-30 운영 적용 완료)
-- ① 브리지 크론 days 1→2 : CRM 이 다음날 00:05 에 넣는 어제 데이터가
--    스캔 창(오늘만) 밖이라 자동 유입이 구조적으로 0 이던 문제.
-- ② 레벨업 사이클: 브로제이 출입은 sessions/days 집계에서 제외 (정책: 레벨업은 QR 로만)
-- ③ 체크인 취소: 브로제이 행은 삭제하면 10분 뒤 크론이 재삽입(소생) → 삭제 대신 중복 마킹
-- ④ 앱 접속 출석 XP: 중복 방지 날짜가 UTC(=KST 09시 경계)라 이중지급/미지급 → KST 로 교정
-- ============================================================

DO $$ BEGIN PERFORM cron.unschedule('sync-broj-checkins'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('sync-broj-checkins', '*/10 * * * *', $job$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/sync-broj-checkins',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('days', 2),
    timeout_milliseconds := 120000
  );
$job$);

CREATE OR REPLACE FUNCTION public.get_level_cycle_progress(_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _req_sessions constant int := 3; _req_days constant int := 3; _req_minutes constant int := 180;
begin
  if _user_id is null then raise exception 'no user'; end if;
  if _user_id <> auth.uid()
     and not (has_role(auth.uid(),'super_admin') or is_branch_manager_of(auth.uid(),_user_id) or is_coach_of(auth.uid(),_user_id)) then
    raise exception 'Not authorized';
  end if;
  select level_started_at into _since from member_progress where user_id = _user_id;
  if _since is null then _since := now() - interval '3650 days'; end if;

  -- 브로제이(얼굴인식) 출입은 라이브보드 표시용 — 레벨업 요건(QR 출석)에 포함하지 않는다.
  select count(*), count(distinct ((checked_in_at at time zone 'Asia/Seoul')::date))
    into _sessions, _days
    from attendance_logs
    where user_id = _user_id and coalesce(is_duplicate,false) = false
      and coalesce(method,'qr') <> 'broj'
      and checked_in_at >= _since;

  select coalesce(sum(greatest(0, floor(extract(epoch from (coalesce(ended_at, now()) - started_at))/60)))::int, 0)
    into _minutes
    from activity_sessions
    where user_id = _user_id and started_at >= _since and status in ('completed','auto_ended');

  return jsonb_build_object(
    'sessions', _sessions, 'days', _days, 'minutes', _minutes,
    'reqSessions', _req_sessions, 'reqDays', _req_days, 'reqMinutes', _req_minutes,
    'meets', (_sessions >= _req_sessions and _days >= _req_days and _minutes >= _req_minutes),
    'since', _since);
end; $function$;

CREATE OR REPLACE FUNCTION public.cancel_checkin(_log_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log attendance_logs%ROWTYPE;
  v_reverted_xp integer := 0;
  v_streak_reverted boolean := false;
BEGIN
  SELECT * INTO v_log FROM attendance_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'branch_manager'::app_role) AND is_same_branch(v_log.user_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_log.source_ref IS NOT NULL THEN
    -- 브로제이 등 외부 동기화 행: 삭제하면 다음 크론이 같은 원본을 재삽입한다(소생).
    -- 대신 중복 표시로 강등해 라이브보드·통계에서 제외한다. XP 회수 대상 아님(xp 0).
    UPDATE attendance_logs SET is_duplicate = true WHERE id = _log_id;
    RETURN jsonb_build_object('success', true, 'reverted_xp', 0, 'streak_reverted', false, 'mode', 'hidden');
  END IF;

  DELETE FROM attendance_logs WHERE id = _log_id;

  IF v_log.is_duplicate = false AND coalesce(v_log.xp_granted, 0) > 0 THEN
    v_reverted_xp := v_log.xp_granted;
    v_streak_reverted := true;

    UPDATE member_progress
    SET total_xp   = greatest(0, total_xp - v_reverted_xp),
        streak_days = greatest(0, streak_days - 1)
    WHERE user_id = v_log.user_id;

    INSERT INTO xp_logs (user_id, amount, reason)
    VALUES (v_log.user_id, -v_reverted_xp, '체크인 취소 회수');

    INSERT INTO notifications (user_id, title, body)
    VALUES (v_log.user_id, '체크인이 취소되었습니다', '관리자가 출석을 취소해 XP가 회수되었습니다. 문의는 지점으로 부탁드려요.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reverted_xp', v_reverted_xp,
    'streak_reverted', v_streak_reverted
  );
END;
$function$;

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

  -- Grant gems (+2)
  PERFORM grant_gems(_user_id, 2, '출석 체크 보상');
END;
$function$;
