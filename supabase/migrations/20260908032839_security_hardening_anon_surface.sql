-- ============================================================================
-- 153 보안 강화 #1 — 비로그인(anon) 노출면 축소   (2026-09-08 풀파워 검수)
--
-- [발견] get_level_cycle_progress 가 비로그인 호출자에게 타 회원의 출석/레벨
--        데이터를 그대로 반환했다. 실제로 다른 회원 payload 추출을 재현했다.
--   원인: `_user_id <> auth.uid()` 에서 auth.uid() 가 NULL 이면 비교식 전체가
--         NULL 이 되고 `NULL and true` = NULL 이라 IF 블록이 통째로 건너뛰어졌다.
--         게다가 PUBLIC 에 EXECUTE 가 열려 있어 anon 키로 바로 호출됐다.
--   조치: is distinct from(NULL 안전 비교) + 로그인 필수 가드 + PUBLIC EXECUTE 회수.
-- ============================================================================

create or replace function public.get_level_cycle_progress(_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _rank rank_name; _req int; _min_days int; _elapsed int;
  _caller uuid := auth.uid();
begin
  -- 로그인하지 않은 호출은 무조건 차단 (예전엔 NULL 비교로 통과했다)
  if _caller is null then raise exception 'Not authorized'; end if;
  if _user_id is null then raise exception 'no user'; end if;

  -- is distinct from: NULL 안전 비교
  if _user_id is distinct from _caller
     and not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_user_id) or is_coach_of(_caller,_user_id)) then
    raise exception 'Not authorized';
  end if;

  select level_started_at, current_rank into _since, _rank from member_progress where user_id = _user_id;
  if _since is null then _since := now() - interval '3650 days'; end if;
  if _rank is null then _rank := 'white'::rank_name; end if;

  _req      := level_visit_requirement(_rank);
  _min_days := level_min_days(_rank);
  _elapsed  := greatest(0, floor(extract(epoch from (now() - _since)) / 86400))::int;

  -- 얼굴 인식(브로제이) 출석이 곧 정식 출석이다. 하루 1회(is_duplicate=false).
  select count(*), count(distinct ((checked_in_at at time zone 'Asia/Seoul')::date))
    into _sessions, _days
    from attendance_logs
    where user_id = _user_id and coalesce(is_duplicate,false) = false
      and checked_in_at >= _since;

  -- 훈련 분수는 참고용 (얼굴 인식은 퇴장 시각이 없다)
  select coalesce(sum(greatest(0, floor(extract(epoch from (coalesce(ended_at, now()) - started_at))/60)))::int, 0)
    into _minutes
    from activity_sessions
    where user_id = _user_id and started_at >= _since and status in ('completed','auto_ended');

  return jsonb_build_object(
    'sessions', _sessions, 'days', _days, 'minutes', _minutes,
    'reqSessions', _req, 'reqDays', _req, 'reqMinutes', 0,
    'reqMinDays', _min_days, 'elapsedDays', _elapsed, 'rank', _rank::text,
    'meets', (_sessions >= _req and _elapsed >= _min_days),
    'since', _since);
end; $function$;

-- PUBLIC(=anon 포함) EXECUTE 회수. authenticated 는 명시 GRANT 가 따로 있어 영향 없음.
revoke execute on function public.get_level_cycle_progress(uuid) from public;
revoke execute on function public.level_visit_requirement(rank_name) from public;
revoke execute on function public.level_min_days(rank_name)          from public;
revoke execute on function public.request_level_review()             from public;
revoke execute on function public.approve_level_review(uuid, boolean, text) from public;

grant execute on function public.get_level_cycle_progress(uuid)      to authenticated;
grant execute on function public.level_visit_requirement(rank_name)  to authenticated;
grant execute on function public.level_min_days(rank_name)           to authenticated;
grant execute on function public.request_level_review()              to authenticated;
grant execute on function public.approve_level_review(uuid, boolean, text) to authenticated;

-- ============================================================================
-- boxing_programs: anon 쓰기 권한 회수 (RLS 로도 막혀 있지만 이중 잠금)
-- SELECT 는 건드리지 않는다 — 공개 라이브러리 페이지가 살아 있어야 한다.
-- ============================================================================
revoke insert, update, delete, truncate, references on public.boxing_programs from anon;

-- ============================================================================
-- xp_logs: 회원이 스스로 XP 원장을 써넣을 수 있던 INSERT 정책 제거.
-- 모든 정상 적립 경로는 SECURITY DEFINER 함수(=RLS 우회)라 영향 없음.
-- 프론트 전수 확인: xp_logs 는 select 만 한다.
-- ============================================================================
drop policy if exists "System can insert xp logs" on public.xp_logs;

-- ============================================================================
-- user_owned_customizations: RPC 를 건너뛰고 아이템을 공짜로 꽂아 넣을 수 있던
-- INSERT 정책 제거. 정상 구매는 purchase_customization(SECURITY DEFINER) 경유.
-- ============================================================================
drop policy if exists "Users can insert own customizations" on public.user_owned_customizations;

-- ============================================================================
-- 라이브보드용 anon 열람 창을 "최근 2일"로 축소.
-- 기존 qual=true 는 출석 이력 전량 + 이름 스냅샷을 비로그인에 노출했다(2,991행).
-- 라이브보드/체크인보드는 모두 오늘 것만 조회하므로 화면 영향 없음(적용 후 127행).
-- ============================================================================
drop policy if exists "Anon view attendance for live board" on public.attendance_logs;
create policy "Anon view attendance for live board"
  on public.attendance_logs for select to anon
  using (
    checked_in_at >= (((now() at time zone 'Asia/Seoul')::date - interval '1 day') at time zone 'Asia/Seoul')
  );

drop policy if exists "Anon view sessions for live board" on public.activity_sessions;
create policy "Anon view sessions for live board"
  on public.activity_sessions for select to anon
  using (
    started_at >= (((now() at time zone 'Asia/Seoul')::date - interval '1 day') at time zone 'Asia/Seoul')
  );
