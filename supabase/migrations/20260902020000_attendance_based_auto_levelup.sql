-- =========================================================================
-- 출석 기반 자동 승급 (2026-09-02 대표님 지시)
--
--   · 출석 인정: 얼굴 인식(브로제이) 포함 전 수단, 하루 1회(is_duplicate=false)
--   · 1~9레벨: 레벨당 출석 3회 채우면 자동 승급 (+50XP, 💎+10 — 코치 승인 승급과 동일 규격)
--   · 10레벨(보스): 3회 채우면 코치 승인함에 자동 신청 — 승급은 코치만 (approve_level_review)
--   · 레벨당 카운터는 level_started_at 리셋으로 관리 (승급 순간부터 새로 3회)
--   · 훈련 분수(180분) 요건 폐지 — 얼굴 인식은 퇴장 시각이 없어 잴 수 없고,
--     앱에서 운동 시작을 누르는 회원이 사실상 없다. 분수는 참고 표시로만 남긴다.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_level_cycle_progress(_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _req_sessions constant int := 3; _req_days constant int := 3; _req_minutes constant int := 0;
begin
  if _user_id is null then raise exception 'no user'; end if;
  if _user_id <> auth.uid()
     and not (has_role(auth.uid(),'super_admin') or is_branch_manager_of(auth.uid(),_user_id) or is_coach_of(auth.uid(),_user_id)) then
    raise exception 'Not authorized';
  end if;
  select level_started_at into _since from member_progress where user_id = _user_id;
  if _since is null then _since := now() - interval '3650 days'; end if;

  -- 얼굴 인식(브로제이) 출석이 곧 정식 출석이다. QR 시절 기록도 같이 센다. 하루 1회(is_duplicate=false).
  select count(*), count(distinct ((checked_in_at at time zone 'Asia/Seoul')::date))
    into _sessions, _days
    from attendance_logs
    where user_id = _user_id and coalesce(is_duplicate,false) = false
      and checked_in_at >= _since;

  select coalesce(sum(greatest(0, floor(extract(epoch from (coalesce(ended_at, now()) - started_at))/60)))::int, 0)
    into _minutes
    from activity_sessions
    where user_id = _user_id and started_at >= _since and status in ('completed','auto_ended');

  return jsonb_build_object(
    'sessions', _sessions, 'days', _days, 'minutes', _minutes,
    'reqSessions', _req_sessions, 'reqDays', _req_days, 'reqMinutes', _req_minutes,
    'meets', (_sessions >= _req_sessions and _days >= _req_days),
    'since', _since);
end; $function$;

CREATE OR REPLACE FUNCTION public.auto_advance_from_attendance(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _p record; _visits int; _promoted int := 0; _pending_boss boolean := false;
  _old level_status_type; _ls_id uuid; _guard int := 0;
begin
  if _user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  perform pg_advisory_xact_lock(hashtext('auto_advance:' || _user_id::text));

  loop
    _guard := _guard + 1; exit when _guard > 10;

    select * into _p from member_progress where user_id = _user_id;
    if not found then exit; end if;

    select count(*) into _visits
    from attendance_logs
    where user_id = _user_id
      and coalesce(is_duplicate, false) = false
      and checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');

    exit when _visits < 3;

    if _p.current_level < 10 then
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;

      insert into level_status (user_id, rank_name, level_number, status, completed_at, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'approved', now(), '출석 3회 자동 승급')
      on conflict (user_id, rank_name, level_number)
      do update set status='approved', completed_at=now(), approval_note='출석 3회 자동 승급', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'approved', _user_id, '출석 3회 자동 승급');

      update member_progress
        set current_level = _p.current_level + 1, level_started_at = now(), updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 10, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 3회를 채워 자동으로 승급했어요. XP +50, 💎 +10');

      _promoted := _promoted + 1;
    else
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=10;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, 10, 'pending', '출석 3회 충족 — 자동 심사 신청')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending', approval_note='출석 3회 충족 — 자동 심사 신청', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, 10, coalesce(_old,'locked'), 'pending', _user_id, '출석 3회 자동 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '보스 레벨 출석을 다 채웠어요. 코치님 승인만 남았습니다!');
      _pending_boss := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', _promoted, 'pending_boss', _pending_boss);
end; $function$;

REVOKE EXECUTE ON FUNCTION public.auto_advance_from_attendance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_advance_from_attendance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_advance_from_attendance(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.auto_advance_from_attendance(uuid) TO service_role;
