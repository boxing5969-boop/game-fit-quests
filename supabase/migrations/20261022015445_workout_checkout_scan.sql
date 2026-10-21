-- 출석 '횟수' 대신 '운동 시간'으로 + 운동 끝나고 한 번 더 찍으면 그 시각이 운동 끝 (2026-10-22 대표님)
--   "이번 달 · 지난달 총 몇 회 출석했는지 말고 총 몇 시간 운동했는지로 체크하자.
--    오래 운동한 사람들은 체크인하고 3시간 안에 한 번 더 출첵하면 그만큼 인정하자 —
--    오래 하신 분들은 운동 후 한 번 더 안면 인식해서 출석 시간이 저장되게"
--   대표님 확정 (2026-10-22):
--     · 두 번째 체크(얼굴 인식 · QR · 앱) = 운동 끝. 첫 출석에서 3시간 안이면 그 시각까지가 운동 시간 (최대 3시간).
--       기본보다 짧으면 기본 그대로 (줄지 않음). 3시간 넘어서 찍은 건 따로 온 것으로 보고 쓰지 않는다.
--     · 두 번째 체크가 없는 날 = 66분 (복싱 60분 + 줄넘기 2분 × 3라운드) — 승급 진행도 · XP · 운동시간 랭킹 · 이룬 것 모두 같은 기준.
--     · 늘어난 시간만큼 XP · 승급 진행도도 '운동 종료' 버튼과 같은 규칙으로 (120분까지 XP 10분당 1 · 진행도 1.00 → 1.25).
--
--   출입(문 · 얼굴 인식기 · QR 발급)은 건드리지 않는다. 두 번째 체크는 지금도 is_duplicate 출석 줄로 들어오고 있어서
--   그 줄이 들어올 때 그날 첫 출석의 ended_at 만 채운다. 이 트리거가 어떤 이유로 실패해도 출석 저장은 그대로 된다.

-- 1) 기본 시간 66분
create or replace function public.workout_default_minutes()
returns integer language sql immutable as $$ select 66 $$;

-- 2) 하루 운동 시간 — 끝 시각이 없거나 이상하면 기본, 4시간 넘으면(종료를 잊은 것) 기본, 그 밖엔 실제 시간(기본 ~ 180분)
create or replace function public.workout_minutes(p_started timestamptz, p_ended timestamptz)
returns integer language sql immutable as $$
  select case
    when p_started is null then public.workout_default_minutes()
    when p_ended   is null then public.workout_default_minutes()
    when p_ended  <= p_started then public.workout_default_minutes()
    when p_ended - p_started > interval '4 hours' then public.workout_default_minutes()
    else least(180, greatest(
      public.workout_default_minutes(),
      ceil(extract(epoch from (p_ended - p_started)) / 60.0)::int
    ))
  end;
$$;

-- 3) 승급 진행도 — 기본(66분) = 1.00, 120분 이상 = 1.25 (예전 50분 기준 식을 기본 시간에 맞춤)
create or replace function public.workout_progress(p_minutes integer)
returns numeric language sql immutable as $$
  select 1.0 + (least(greatest(coalesce(p_minutes, public.workout_default_minutes()), public.workout_default_minutes()), 120)
                - public.workout_default_minutes())::numeric
               / ((120 - public.workout_default_minutes()) * 4);
$$;

-- 4) 규칙 안내 — 두 번째 체크 창(3시간) · 인정 상한(180분)을 같이 내보낸다
create or replace function public.get_workout_rules()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with cap as (
    select min(m) as minutes
      from generate_series(public.workout_default_minutes(), 600) as m
     where public.workout_progress(m) >= public.workout_progress(600)
  )
  select jsonb_build_object(
    'defaultMinutes',  public.workout_default_minutes(),
    'bonusCapMinutes', (select minutes from cap),
    'maxProgress',     public.workout_progress(600),
    'xpDefault',       public.workout_xp(public.workout_default_minutes()),
    'xpMax',           public.workout_xp(600),
    'maxSessionHours', 4,
    'checkoutWindowHours', 3,
    'maxCreditMinutes', 180
  );
$$;

-- 5) 두 번째 체크 = 운동 끝 — is_duplicate 출석 줄이 들어오면 그날 첫 출석의 ended_at 을 채운다
create or replace function public.attendance_checkout_scan_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
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
    select id, checked_in_at, ended_at, coalesce(xp_granted, 0)
      into _id, _started, _ended, _xp_before
      from public.attendance_logs
     where user_id = new.user_id
       and coalesce(is_duplicate, false) = false
       and (checked_in_at at time zone 'Asia/Seoul')::date = (new.checked_in_at at time zone 'Asia/Seoul')::date
     order by checked_in_at asc
     limit 1
     for update;

    if _id is null then return null; end if;
    if new.checked_in_at <= _started then return null; end if;
    if new.checked_in_at - _started > interval '3 hours' then return null; end if;
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

drop trigger if exists attendance_checkout_scan on public.attendance_logs;
create trigger attendance_checkout_scan
  after insert on public.attendance_logs
  for each row when (new.is_duplicate is true)
  execute function public.attendance_checkout_scan_trg();

-- 6) 운동 시간 합계 — 지금까지 · 이번 달 · 지난달 (분). 하루 1번(그날 첫 출석) × workout_minutes
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
    'last_month_minutes', coalesce((select sum(minutes) from d, m where kday >= (m.m0 - interval '1 month')::date and kday < m.m0), 0)
  )
$$;
revoke all on function public.attendance_minutes_summary(uuid) from public, anon, authenticated;

-- 7) 내 출석 기록(내정보 카드) — 위 합계를 더한다 (나머지는 그대로)
create or replace function public.get_my_attendance_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_last_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul';
  v_total integer;
  v_month integer;
  v_last integer;
  v_since date;
  v_staff boolean;
  v_next integer;
  v_streak jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select coalesce(is_staff, false) into v_staff from public.profiles where user_id = v_uid;

  select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date) filter (where a.checked_in_at >= v_month_start)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)
           filter (where a.checked_in_at >= v_last_start and a.checked_in_at < v_month_start)::integer,
         min((a.checked_in_at at time zone 'Asia/Seoul')::date)
    into v_total, v_month, v_last, v_since
    from public.attendance_logs a
   where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null;

  v_next := ((coalesce(v_total, 0) / 50) + 1) * 50;
  v_streak := public.attendance_week_streaks(v_uid);
  return jsonb_build_object(
    'total', coalesce(v_total, 0),
    'month', coalesce(v_month, 0),
    'last_month', coalesce(v_last, 0),
    'since', v_since,
    'records_since', '2026-02-01',
    'is_staff', coalesce(v_staff, false),
    'step', 50,
    'next', v_next,
    'next_gems', public.attendance_milestone_gems(v_next),
    'next_mileage', public.attendance_milestone_mileage(v_next),
    'week_streak', v_streak -> 'current',
    'best_week_streak', v_streak -> 'best',
    'this_week', v_streak -> 'this_week',
    'best_month', public.attendance_best_month(v_uid),
    'days_with', case when v_since is null then 0 else (now() at time zone 'Asia/Seoul')::date - v_since + 1 end,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('milestone', m.milestone, 'reached_on', m.reached_on, 'gems', m.gems,
                                          'mileage', m.mileage, 'seen', m.seen_at is not null) order by m.milestone)
        from public.attendance_milestones m where m.user_id = v_uid), '[]'::jsonb),
    'unseen', (
      select case when count(*) = 0 then null else
               jsonb_build_object('milestone', max(m.milestone), 'count', count(*),
                                  'gems', sum(m.gems), 'mileage', sum(m.mileage)) end
        from public.attendance_milestones m where m.user_id = v_uid and m.seen_at is null)
  ) || public.attendance_minutes_summary(v_uid);
end
$$;

-- 8) 출석 기록 전체 — 날마다 운동 시간(minutes) · 달마다 합계 · 합계 (나머지는 그대로)
create or replace function public.get_attendance_history(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_result jsonb;
  v_streak jsonb;
begin
  if v_me is null then raise exception '로그인이 필요합니다'; end if;
  if v_uid <> v_me
     and not (public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') or public.is_same_branch(v_uid)) then
    raise exception '지점장 · 관리자만 볼 수 있어요';
  end if;

  with d as (
    select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
           (a.checked_in_at at time zone 'Asia/Seoul')::date as day,
           a.checked_in_at as at,
           a.ended_at,
           a.ended_source,
           a.method,
           a.branch_name,
           public.workout_minutes(a.checked_in_at, a.ended_at) as minutes,
           extract(hour from (a.checked_in_at at time zone 'Asia/Seoul'))::int as hr,
           extract(isodow from (a.checked_in_at at time zone 'Asia/Seoul'))::int as dow
      from public.attendance_logs a
     where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
     order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
  ),
  months as (
    select (v_month - make_interval(months => g))::date as m
      from generate_series(0, 11) g
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'month', (select count(*) from d where day >= v_month),
    'last_month', (select count(*) from d where day >= (v_month - interval '1 month')::date and day < v_month),
    'weeks8', (select count(*) from d where day > v_today - 56),
    'total_minutes', coalesce((select sum(minutes) from d), 0),
    'month_minutes', coalesce((select sum(minutes) from d where day >= v_month), 0),
    'last_month_minutes', coalesce((select sum(minutes) from d where day >= (v_month - interval '1 month')::date and day < v_month), 0),
    'first_day', (select min(day) from d),
    'last_day', (select max(day) from d),
    'days_with', coalesce((select v_today - min(day) + 1 from d), 0),
    'records_since', '2026-02-01',
    'monthly', (select jsonb_agg(jsonb_build_object('month', to_char(mo.m, 'YYYY-MM'),
                                                    'days', (select count(*) from d where date_trunc('month', d.day)::date = mo.m),
                                                    'minutes', coalesce((select sum(d.minutes) from d where date_trunc('month', d.day)::date = mo.m), 0))
                                 order by mo.m)
                  from months mo),
    'weekday', (select jsonb_agg((select count(*) from d where d.dow = w) order by w) from generate_series(1, 7) w),
    'hours', jsonb_build_object(
      'dawn', (select count(*) from d where hr < 6),
      'morning', (select count(*) from d where hr >= 6 and hr < 11),
      'noon', (select count(*) from d where hr >= 11 and hr < 14),
      'afternoon', (select count(*) from d where hr >= 14 and hr < 18),
      'evening', (select count(*) from d where hr >= 18 and hr < 21),
      'night', (select count(*) from d where hr >= 21)),
    'list', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'at', at, 'end', ended_at, 'end_source', ended_source,
                                                          'minutes', minutes, 'method', method, 'branch', branch_name)
                                       order by day desc)
                        from d), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('milestone', m.milestone, 'reached_on', m.reached_on,
                                                                'gems', m.gems, 'mileage', m.mileage) order by m.milestone)
                              from public.attendance_milestones m where m.user_id = v_uid), '[]'::jsonb)
  ) into v_result;

  v_streak := public.attendance_week_streaks(v_uid);
  return v_result || jsonb_build_object(
    'week_streak', v_streak -> 'current',
    'best_week_streak', v_streak -> 'best',
    'this_week', v_streak -> 'this_week',
    'best_month', public.attendance_best_month(v_uid)
  );
end
$$;
