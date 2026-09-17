-- 패스트 트랙을 화면에 보이게 한다 (2026-09-17)
--
-- 직행권(member_progress.fast_track_gates)을 부여한 것만으로는 회원도 코치도
-- 그 사실을 알 수 없었다. 조회 함수 두 개에 fastTrackGates 를 실어
-- 회원 카드·코치 승인함·가이드가 모두 같은 값을 읽게 한다.
-- 권한은 건드리지 않는다 — create or replace 는 기존 ACL 을 유지한다.

create or replace function public.get_level_cycle_progress(_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _rank rank_name; _req int; _min_days int; _elapsed int; _gates int := 0;
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

  select level_started_at, current_rank, coalesce(fast_track_gates,0)
    into _since, _rank, _gates
    from member_progress where user_id = _user_id;
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
    -- 패스트 트랙 직행권 잔여 수. 1 이상이면 이번 타이틀매치를 통과할 때
    -- 다음 리그의 L1 이 아니라 그 리그의 타이틀매치로 바로 간다.
    'fastTrackGates', coalesce(_gates, 0),
    'meets', (_sessions >= _req and _elapsed >= _min_days),
    'since', _since);
end; $function$;

create or replace function public.get_level_review_checklist(_member_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _caller uuid := auth.uid();
  _p record; _checked jsonb; _need text; _items jsonb;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id)
          or is_coach_of(_caller,_member_id) or _member_id = _caller) then
    raise exception 'Not authorized';
  end if;

  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  select coalesce(checked_items,'{}'::jsonb) into _checked from level_status
    where user_id=_member_id and rank_name=_p.current_rank and level_number=_p.current_level;
  _checked := coalesce(_checked, '{}'::jsonb);

  _need := public.level_gate_authority(_p.current_rank, _p.current_level);

  select coalesce(jsonb_agg(jsonb_build_object(
           'missionId', m.id,
           'title',     m.title,
           'keyPoints', (select jsonb_agg(k) from unnest(array[m.key_point_1, m.key_point_2, m.key_point_3]) k where k is not null),
           'passed',    coalesce((_checked -> m.id::text ->> 'passed')::boolean, false),
           'by',        _checked -> m.id::text ->> 'by',
           'at',        _checked -> m.id::text ->> 'at'
         ) order by m.sort_order), '[]'::jsonb)
    into _items
    from missions m join levels l on l.id = m.level_id
   where l.rank_name = _p.current_rank and l.level_number = _p.current_level and m.is_active = true;

  return jsonb_build_object(
    'rank', _p.current_rank::text,
    'level', _p.current_level,
    'isTitleMatch', (_p.current_level = 10),
    'requiredAuthority', _need,
    'canApprove', public.can_clear_level_gate(_caller, _member_id, _p.current_rank, _p.current_level),
    -- 이 회원이 패스트 트랙인지 — 통과시키면 다음 리그 타이틀매치로 직행한다.
    -- 코치가 "왜 이 회원이 L1 이 아니라 L10 에 있는지" 알 수 있어야 한다.
    'fastTrackGates', coalesce(_p.fast_track_gates, 0),
    'items', _items,
    'total', jsonb_array_length(_items),
    'passedCount', (select count(*) from jsonb_array_elements(_items) e where (e->>'passed')::boolean)
  );
end; $function$;
