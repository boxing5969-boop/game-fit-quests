-- 승급 진행도 = 홈 카드의 바 (2026-09-22)
--
-- 대표님 결정: 홈 라이센스 카드의 막대를 "누적 XP / 300" 대신 "승급 진행도 / 필요 횟수"로 보여준다.
-- 가득 차면 화이트·블루는 자동 승급, 레드·블랙은 승급 심사 신청 — auto_advance_from_attendance 와
-- 같은 계산(workout_progress: 출석 1회 = 1.0, 운동시간 120분이면 1.25)을 그대로 돌려준다.
-- 화면과 승급 판정이 다른 숫자를 쓰지 않도록 이 RPC 가 단일 출처다.
--
-- 바뀌는 것: progress·progressFloor·autoAdvances·currentLevel 필드 추가, meets 가 floor(progress) 기준.
-- 기존 필드(sessions·days·minutes·req*·fastTrackGates·since)는 그대로 — 기존 화면은 영향 없음.

create or replace function public.get_level_cycle_progress(_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _rank rank_name; _level int := 1; _req int; _min_days int; _elapsed int; _gates int := 0;
  _progress numeric := 0; _floor int := 0;
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

  select level_started_at, current_rank, coalesce(current_level, 1), coalesce(fast_track_gates,0)
    into _since, _rank, _level, _gates
    from member_progress where user_id = _user_id;
  if _since is null then _since := now() - interval '3650 days'; end if;
  if _rank is null then _rank := 'white'::rank_name; end if;

  _req      := level_visit_requirement(_rank);
  _min_days := level_min_days(_rank);
  _elapsed  := greatest(0, floor(extract(epoch from (now() - _since)) / 86400))::int;

  -- 얼굴 인식(브로제이)·QR 출석이 곧 정식 출석이다. 하루 1회(is_duplicate=false).
  -- progress 는 auto_advance_from_attendance 와 같은 식 — 운동시간이 길면 한 번이 최대 1.25 로 쌓인다.
  select count(*),
         count(distinct ((checked_in_at at time zone 'Asia/Seoul')::date)),
         coalesce(sum(public.workout_progress(public.workout_minutes(checked_in_at, ended_at))), 0)
    into _sessions, _days, _progress
    from attendance_logs
    where user_id = _user_id and coalesce(is_duplicate,false) = false
      and checked_in_at >= _since;
  _floor := floor(_progress)::int;

  -- 훈련 분수는 참고용 (얼굴 인식은 퇴장 시각이 없다)
  select coalesce(sum(greatest(0, floor(extract(epoch from (coalesce(ended_at, now()) - started_at))/60)))::int, 0)
    into _minutes
    from activity_sessions
    where user_id = _user_id and started_at >= _since and status in ('completed','auto_ended');

  return jsonb_build_object(
    'sessions', _sessions, 'days', _days, 'minutes', _minutes,
    'reqSessions', _req, 'reqDays', _req, 'reqMinutes', 0,
    'reqMinDays', _min_days, 'elapsedDays', _elapsed, 'rank', _rank::text,
    'currentLevel', _level,
    -- 승급 진행도: 홈 카드 막대가 쓰는 값. floor 가 실제 판정값이다(4.75 는 5회가 아니다).
    'progress', round(_progress, 2),
    'progressFloor', _floor,
    'autoAdvances', public.level_auto_advances(_rank),
    -- 패스트 트랙 직행권 잔여 수. 1 이상이면 이번 타이틀매치를 통과할 때
    -- 다음 리그의 L1 이 아니라 그 리그의 타이틀매치로 바로 간다.
    'fastTrackGates', coalesce(_gates, 0),
    'meets', (_floor >= _req and _elapsed >= _min_days),
    'since', _since);
end; $function$;
