-- 두 번째 체크(운동 끝) 검수 고침 (2026-10-22) — 20261022015445_workout_checkout_scan 다음
--   1) 들어오자마자 다시 찍은 것(문 · TV 다시 찍기, 지난 60일 34번)은 운동 끝으로 보지 않는다.
--      기본 66분보다 짧은 시간은 어차피 66분으로 치므로 잃는 것이 없고, '운동 종료' 버튼도 그대로 살아 있다.
--   2) '운동 종료' 버튼(member_app)을 먼저 눌렀으면 그 기록이 우선 — 나가며 찍은 얼굴 인식이 덮어쓰지 않는다.
--   3) 운동 끝으로 쓴 출석 줄은 '지금 운동 중'(TV 라이브보드 · 랭킹 탭)을 다시 120분 늘리지 않는다.
--      → 그날 첫 출석 시각 기준 120분 (이 기능 전과 같다).
--   4) 가장 많이 운동한 달(시간 기준, 지금까지) — 수강권 기록 카드가 '회'가 아니라 '시간'으로 보여 주게.
--   출입(문 · 얼굴 인식기 · QR 발급)은 그대로. QR 출석은 하루 두 번째를 저장하지 않아서(이미 출석) 두 번째 체크는 얼굴 인식만 된다.

-- 운동 끝으로 쓰인(쓰일) 두 번째 출석 줄인가 — 같은 날 첫 출석에서 66분 ~ 3시간 사이 · 그날 운동 끝이 적혀 있다
create or replace function public.attendance_is_exit_scan(p_user uuid, p_at timestamptz, p_dup boolean)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(p_dup, false) and p_user is not null and p_at is not null and exists (
    select 1
      from public.attendance_logs f
     where f.user_id = p_user
       and coalesce(f.is_duplicate, false) = false
       and f.ended_at is not null
       and f.checked_in_at >= p_at - interval '3 hours'
       and f.checked_in_at <= p_at - make_interval(mins => public.workout_default_minutes())
       and (f.checked_in_at at time zone 'Asia/Seoul')::date = (p_at at time zone 'Asia/Seoul')::date
  )
$$;
revoke all on function public.attendance_is_exit_scan(uuid, timestamptz, boolean) from public, anon, authenticated;

-- 두 번째 체크 = 운동 끝 (고침: 66분 안 다시 찍기 무시 · '운동 종료' 버튼 우선)
create or replace function public.attendance_checkout_scan_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _src       text;
  _xp_before int;
  _minutes   int;
  _xp        int;
  _eligible  boolean;
begin
  if new.user_id is null or new.checked_in_at is null then return null; end if;
  if not coalesce(new.is_duplicate, false) then return null; end if;
  -- 늦게 옮겨 오는 옛 기록(동기화 지연 · 되살리기)으로 지난 날을 바꾸지 않는다
  if new.checked_in_at < now() - interval '1 day' then return null; end if;

  begin
    select id, checked_in_at, ended_at, ended_source, coalesce(xp_granted, 0)
      into _id, _started, _ended, _src, _xp_before
      from public.attendance_logs
     where user_id = new.user_id
       and coalesce(is_duplicate, false) = false
       and (checked_in_at at time zone 'Asia/Seoul')::date = (new.checked_in_at at time zone 'Asia/Seoul')::date
     order by checked_in_at asc
     limit 1
     for update;

    if _id is null then return null; end if;
    -- 들어오자마자 다시 찍은 것 — 기본 시간보다 짧으면 어차피 기본으로 치니 운동 끝으로 쓰지 않는다
    if new.checked_in_at - _started < make_interval(mins => public.workout_default_minutes()) then return null; end if;
    if new.checked_in_at - _started > interval '3 hours' then return null; end if;
    -- '운동 종료' 버튼을 먼저 눌렀으면 그 기록이 우선
    if _src = 'member_app' then return null; end if;
    if _ended is not null and _ended >= new.checked_in_at then return null; end if;

    update public.attendance_logs
       set ended_at = new.checked_in_at,
           ended_source = 'checkout_scan'
     where id = _id;

    -- XP — '운동 종료' 버튼(finish_workout_session)과 같은 규칙: 이미 받은 만큼 빼고 남는 만큼만
    _minutes := public.workout_minutes(_started, new.checked_in_at);
    _xp := greatest(0, public.workout_xp(_minutes) - _xp_before);
    select exists (select 1 from public.member_progress m where m.user_id = new.user_id)
           and not coalesce((select p.is_staff from public.profiles p where p.user_id = new.user_id), false)
      into _eligible;
    if _xp > 0 and _eligible then
      insert into public.xp_logs (user_id, amount, reason)
      values (new.user_id, _xp, '운동시간 ' || _minutes || '분 기록 (두 번째 체크)');
      update public.member_progress set total_xp = total_xp + _xp where user_id = new.user_id;
      update public.attendance_logs set xp_granted = _xp_before + _xp where id = _id;
    end if;
  exception when others then
    raise warning 'attendance_checkout_scan: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.attendance_checkout_scan_trg() from public, anon, authenticated;

-- TV 라이브보드 오늘 출석 — 운동 끝으로 쓴 두 번째 줄은 빼서 '운동 중'이 나간 뒤로 늘어나지 않게
create or replace function public.board_checkins_today(p_branch text, p_key text default null)
returns table(id uuid, user_id uuid, display_name_snapshot text, league_snapshot text, level_snapshot integer,
              checked_in_at timestamptz, is_duplicate boolean, age_sec integer)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
begin
  if v_name is null then
    return;
  end if;
  return query
    select a.id, a.user_id, a.display_name_snapshot, a.league_snapshot, a.level_snapshot, a.checked_in_at,
           coalesce(a.is_duplicate, false),
           greatest(0, extract(epoch from (now() - coalesce(a.created_at, a.checked_in_at))))::integer
      from public.attendance_logs a
     where a.branch_name = v_name
       and a.checked_in_at >= (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul')
       and not public.attendance_is_exit_scan(a.user_id, a.checked_in_at, a.is_duplicate)
     order by a.checked_in_at desc
     limit 500;
end $$;
revoke all on function public.board_checkins_today(text, text) from public;
grant execute on function public.board_checkins_today(text, text) to anon, authenticated;

-- 랭킹 탭 '지금 운동 중' — TV 와 같이 운동 끝으로 쓴 두 번째 줄은 세지 않는다
create or replace function public.get_working_out_now(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hq boolean;
  v_branch text;
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_hq := public._dm_kind(v_uid) = 'hq';
  v_branch := case when v_hq then nullif(btrim(p_branch), '') else public._community_branch_of(v_uid) end;
  if not v_hq and v_branch is null then
    return jsonb_build_object('branch', null, 'all_branches', false, 'members', '[]'::jsonb);
  end if;

  -- TV 와 같이: 앱 세션이 있으면 그 시작 시각, 없으면 오늘 마지막 출석 시각 (같은 날 두 번째 출석(is_duplicate)도 다시 온 것이라 센다)
  --   단 운동 끝으로 쓴 두 번째 출석(첫 출석 66분 ~ 3시간 뒤)은 나간 것이라 세지 않는다 (2026-10-22)
  with pres as (
    select s.user_id, s.started_at as since, s.branch_name as at_branch, 0 as prio
      from public.activity_sessions s
     where s.status = 'active' and s.ended_at is null
       and s.started_at >= now() - interval '60 minutes'
       and (v_branch is null or s.branch_name = v_branch)
    union all
    select a.user_id, a.checked_in_at, a.branch_name, 1
      from public.attendance_logs a
     where a.checked_in_at >= greatest(v_today_start, now() - interval '120 minutes')
       and a.checked_in_at <= now()
       and (v_branch is null or a.branch_name = v_branch)
       and not public.attendance_is_exit_scan(a.user_id, a.checked_in_at, a.is_duplicate)
  ),
  latest as (
    select distinct on (pres.user_id) pres.user_id, pres.since, pres.at_branch
      from pres order by pres.user_id, pres.prio, pres.since desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', l.user_id,
           'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
           'avatar_url', p.avatar_url,
           'league', coalesce(mp.current_rank::text, 'white'),
           'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
           'since', l.since,
           'branch', coalesce(l.at_branch, p.branch_name),
           'is_me', l.user_id = v_uid
         ) order by l.since desc), '[]'::jsonb)
    into v_out
    from latest l
    join public.profiles p on p.user_id = l.user_id
    left join public.member_progress mp on mp.user_id = l.user_id
   where not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     -- 전 지점 보기는 켜 둔 지점만 (설정 > 지점 관리)
     and (v_branch is not null or public.is_branch_visible(coalesce(l.at_branch, p.branch_name)))
     and (v_hq or l.user_id = v_uid or coalesce(p.community_auto_post, true));

  return jsonb_build_object('branch', v_branch, 'all_branches', v_hq and v_branch is null, 'members', v_out);
end $$;

revoke all on function public.get_working_out_now(text) from public, anon;
grant execute on function public.get_working_out_now(text) to authenticated;

-- 운동 시간 합계 + 가장 많이 운동한 달(시간 기준, 지금까지 · 같으면 최근 달)
create or replace function public.attendance_minutes_summary(_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (
    select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
           (a.checked_in_at at time zone 'Asia/Seoul')::date as kday,
           public.workout_minutes(a.checked_in_at, a.ended_at) as minutes
      from public.attendance_logs a
     where a.user_id = _uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
     order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
  ),
  m as (select date_trunc('month', (now() at time zone 'Asia/Seoul'))::date as m0)
  select jsonb_build_object(
    'total_minutes', coalesce((select sum(minutes) from d), 0),
    'month_minutes', coalesce((select sum(minutes) from d, m where kday >= m.m0), 0),
    'last_month_minutes', coalesce((select sum(minutes) from d, m where kday >= (m.m0 - interval '1 month')::date and kday < m.m0), 0),
    'best_month_minutes', (
      select jsonb_build_object('month', to_char(x.mo, 'YYYY-MM'), 'minutes', x.mins, 'days', x.cnt)
        from (select date_trunc('month', kday)::date as mo, sum(minutes) as mins, count(*) as cnt
                from d group by 1 order by 2 desc, 1 desc limit 1) x)
  )
$$;
revoke all on function public.attendance_minutes_summary(uuid) from public, anon, authenticated;
