-- 동기부여 1단계 — 첫 4주 스타터 · 이른 출석 축하 · 코치 「첫 4주 신규」 목록
-- 2026-11-12 대표님 「추천대로」 (보고서 https://claude.ai/artifact/6sAvidMfhyLhFERCK5jXFw · 선릉역점만 먼저)
--
-- 근거(선릉역점 운영 DB, 2026-11-12): 첫 출석부터 4주 안에 8번 이상 온 신규는 3개월째 77%가 남고 1~3번은 23%.
--   지금 출석 축하는 50번마다라 주 2회 회원도 첫 축하가 6개월 뒤 → 5 · 10 · 20 · 30번째에 축하 편지.
--
-- 기존 함수 · 트리거 · 표는 그대로 둔다(출석 보상 · 출석 표는 보호 영역) — 새 설정 1줄 · 새 표 1 · 새 함수 7 · 예약 1.
--   · attendance_milestones 는 50의 배수만 받는다(check) → 이른 축하 · 스타터 달성은 새 표 motivation_awards 에.
--   · 출석 표에 트리거를 달지 않고 5분마다 훑는다(motivation_tick — PT 입장 알림 ops-pt-entry-tick 과 같은 방식).
--   · 마일리지는 기존 grant_mileage(kind 'milestone', idem_key 'starter4w:<회원>' — 두 번 돌아도 한 번)로만.
--
-- 켠 지점 · 숫자는 app_settings 'motivation_pilot' 한 줄 — 끄기 = branches 를 빈 배열로(화면 · 예약 모두 조용).
--   start_date = 이 파일을 적용한 날(KST). 이른 축하는 그날 뒤에 채운 것만(켜기 전 것을 몰아서 보내지 않기).
--   첫 4주 달성은 창(첫 출석일 ~ +27일)이 켠 날과 겹치는 회원 — 이미 8번을 채운 채 4주 안에 있는 회원도 받는다.

-- 1) 설정 (한 번만 — 다시 적용해도 지금 값을 덮지 않는다)
insert into public.app_settings (key, value)
values (
  'motivation_pilot',
  jsonb_build_object(
    'note', '동기부여 1단계 (2026-11-12 대표님 「추천대로」 · 선릉역점만). branches = 켠 지점(빈 배열 = 끔) · start_date = 켠 날 · starter_days 일 안에 starter_goal 번이면 첫 4주 달성(마일리지 starter_mileage) · early = 이른 출석 축하(보상 없이 편지).',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'start_date', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'starter_days', 28,
    'starter_goal', 8,
    'starter_mileage', 3000,
    'early', jsonb_build_array(5, 10, 20, 30)
  )
)
on conflict (key) do nothing;

-- 2) 받은 축하 — 이른 축하(early: 5 · 10 · 20 · 30) · 첫 4주 달성(starter: 8)
create table if not exists public.motivation_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('early', 'starter')),
  value integer not null check (value > 0),
  reached_on date,
  mileage integer not null default 0 check (mileage >= 0),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, kind, value)
);
alter table public.motivation_awards enable row level security;
revoke all on table public.motivation_awards from anon, authenticated;
comment on table public.motivation_awards is '동기부여 1단계 — 이른 출석 축하 · 첫 4주 달성. 함수로만 읽고 쓴다(get_my_motivation · mark_my_motivation_seen · motivation_tick).';

-- 3) 설정 읽기 · 켠 지점 회원인가 · 출석한 날 세기 (안쪽 함수 — 화면에서 부르지 않음)
create or replace function public._motivation_conf()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'motivation_pilot'), '{}'::jsonb)
$$;

create or replace function public._motivation_member(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _uid is not null and exists (
    select 1
      from public.profiles p
     where p.user_id = _uid
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and p.branch_name in (
         select jsonb_array_elements_text(coalesce(public._motivation_conf() -> 'branches', '[]'::jsonb))
       )
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
       )
  )
$$;

-- 출석한 날(KST) — 하루 여러 번 = 1번, 중복 기록 빼기 (출석 축하 attendance_day_count 와 같은 기준)
create or replace function public._motivation_days(_uid uuid, _window integer default 28)
returns table(total integer, first_day date, in_window integer, last_day date)
language sql
stable
security definer
set search_path to 'public'
as $$
  with d as (
    select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as day
      from public.attendance_logs a
     where a.user_id = _uid
       and not coalesce(a.is_duplicate, false)
       and a.checked_in_at is not null
  ), f as (
    select min(day) as first_day, max(day) as last_day, count(*)::integer as total from d
  )
  select f.total,
         f.first_day,
         (select count(*)::integer from d
           where f.first_day is not null and d.day between f.first_day and f.first_day + (greatest(_window, 1) - 1)),
         f.last_day
    from f
$$;

-- 4) 회원 화면 — 첫 4주 스타터 · 다음 이른 축하 · 안 본 축하 (켠 지점 회원이 아니면 {on:false})
create or replace function public.get_my_motivation()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  c jsonb;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_win integer;
  v_goal integer;
  v_mileage integer;
  v_early integer[];
  v_total integer := 0;
  v_first date;
  v_in integer := 0;
  v_next integer;
  v_prev integer := 0;
  m integer;
  v_done_at timestamptz;
  v_done_mileage integer;
  v_unseen jsonb;
begin
  if v_uid is null or not public._motivation_member(v_uid) then
    return jsonb_build_object('on', false);
  end if;
  c := public._motivation_conf();
  v_win := greatest(7, coalesce((c ->> 'starter_days')::integer, 28));
  v_goal := greatest(1, coalesce((c ->> 'starter_goal')::integer, 8));
  v_mileage := greatest(0, coalesce((c ->> 'starter_mileage')::integer, 0));
  select coalesce(array_agg(x::integer order by x::integer), '{}'::integer[]) into v_early
    from jsonb_array_elements_text(coalesce(c -> 'early', '[]'::jsonb)) x;

  select d.total, d.first_day, d.in_window into v_total, v_first, v_in
    from public._motivation_days(v_uid, v_win) d;
  v_total := coalesce(v_total, 0);
  v_in := coalesce(v_in, 0);

  foreach m in array v_early loop
    if m > v_total then
      v_next := m;
      exit;
    end if;
    v_prev := m;
  end loop;

  select a.created_at, a.mileage into v_done_at, v_done_mileage
    from public.motivation_awards a
   where a.user_id = v_uid and a.kind = 'starter'
   limit 1;

  select case when count(*) = 0 then null else jsonb_build_object(
           'starter', coalesce(bool_or(a.kind = 'starter'), false),
           'early', max(a.value) filter (where a.kind = 'early'),
           'mileage', coalesce(sum(a.mileage), 0)) end
    into v_unseen
    from public.motivation_awards a
   where a.user_id = v_uid and a.seen_at is null;

  return jsonb_build_object(
    'on', true,
    'today', v_today,
    'total', v_total,
    'first_day', v_first,
    'starter', jsonb_build_object(
      'days', v_win,
      'goal', v_goal,
      'mileage', v_mileage,
      'count', v_in,
      'active', v_first is not null and v_today - v_first < v_win,
      'ends_on', case when v_first is null then null else v_first + (v_win - 1) end,
      'done_at', v_done_at,
      'done_mileage', v_done_mileage
    ),
    'early', jsonb_build_object(
      'steps', to_jsonb(v_early),
      'next', v_next,
      'prev', case when v_next is null then null else v_prev end
    ),
    'unseen', v_unseen
  );
end
$$;

-- 축하 편지를 닫으면 — 안 본 이른 축하 · 첫 4주 달성을 모두 본 것으로
create or replace function public.mark_my_motivation_seen()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.motivation_awards set seen_at = now() where user_id = auth.uid() and seen_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- 5) 5분마다 — 최근 출석한 켠 지점 회원의 이른 축하 · 첫 4주 달성을 남기고 알린다
create or replace function public.motivation_tick(p_lookback interval default interval '3 days')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c jsonb := public._motivation_conf();
  v_start date;
  v_win integer;
  v_goal integer;
  v_mileage integer;
  v_early integer[];
  r record;
  d record;
  m integer;
  v_on date;
  v_next integer;
  v_early_n integer := 0;
  v_starter_n integer := 0;
begin
  if jsonb_array_length(coalesce(c -> 'branches', '[]'::jsonb)) = 0 then
    return jsonb_build_object('off', true);
  end if;
  v_start := coalesce((c ->> 'start_date')::date, (now() at time zone 'Asia/Seoul')::date);
  v_win := greatest(7, coalesce((c ->> 'starter_days')::integer, 28));
  v_goal := greatest(1, coalesce((c ->> 'starter_goal')::integer, 8));
  v_mileage := greatest(0, coalesce((c ->> 'starter_mileage')::integer, 0));
  select coalesce(array_agg(x::integer order by x::integer), '{}'::integer[]) into v_early
    from jsonb_array_elements_text(coalesce(c -> 'early', '[]'::jsonb)) x;

  for r in
    select distinct a.user_id
      from public.attendance_logs a
     where a.checked_in_at >= now() - p_lookback
       and a.user_id is not null
       and not coalesce(a.is_duplicate, false)
  loop
    continue when not public._motivation_member(r.user_id);
    continue when not exists (select 1 from public.member_progress mp where mp.user_id = r.user_id);
    select * into d from public._motivation_days(r.user_id, v_win);
    continue when coalesce(d.total, 0) = 0;

    -- 이른 출석 축하 — m번째 출석일이 켠 날 뒤인 것만
    foreach m in array v_early loop
      exit when m > d.total;
      continue when exists (
        select 1 from public.motivation_awards w where w.user_id = r.user_id and w.kind = 'early' and w.value = m
      );
      v_on := null;
      select x.day into v_on
        from (select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as day
                from public.attendance_logs a
               where a.user_id = r.user_id and not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
               order by 1) x
       offset m - 1 limit 1;
      continue when v_on is null or v_on < v_start;
      insert into public.motivation_awards (user_id, kind, value, reached_on)
      values (r.user_id, 'early', m, v_on)
      on conflict do nothing;
      if found then
        select min(e) into v_next from unnest(v_early) e where e > m;
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id,
                '출석 ' || m || '번째! 🎉',
                '축하 편지가 왔어요. 다음 축하는 출석 ' || coalesce(v_next, 50) || '번째예요',
                '/home');
        v_early_n := v_early_n + 1;
      end if;
    end loop;

    -- 첫 4주 v_goal 번 — 창(첫 출석일 ~ +v_win-1일)이 켠 날과 겹치고, 창 안 출석이 v_goal 번 이상
    if d.first_day >= v_start - (v_win - 1)
       and coalesce(d.in_window, 0) >= v_goal
       and not exists (select 1 from public.motivation_awards w where w.user_id = r.user_id and w.kind = 'starter') then
      v_on := null;
      select x.day into v_on
        from (select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as day
                from public.attendance_logs a
               where a.user_id = r.user_id and not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
               order by 1) x
       offset v_goal - 1 limit 1;
      insert into public.motivation_awards (user_id, kind, value, reached_on, mileage)
      values (r.user_id, 'starter', v_goal, v_on, v_mileage)
      on conflict do nothing;
      if found then
        if v_mileage > 0 then
          perform public.grant_mileage(r.user_id, 'milestone', v_mileage,
                                       '첫 4주 ' || v_goal || '번 달성',
                                       'starter4w:' || r.user_id::text, null);
        end if;
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id,
                '첫 4주 ' || v_goal || '번 달성! 🥊',
                case when v_mileage > 0
                     then '마일리지 +' || to_char(v_mileage, 'FM999,999,999') || '점을 드렸어요. 153이 습관이 되기 시작했어요'
                     else '153이 습관이 되기 시작했어요. 앱에서 축하 편지를 열어 보세요' end,
                '/home');
        v_starter_n := v_starter_n + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('early', v_early_n, 'starter', v_starter_n);
end
$$;

-- 6) 코치 화면 — 첫 4주 신규 (위험 탭 맨 위). 대표님 · 관리자 = 고른 지점(없으면 내 지점) · 지점 지도진 = 내 지점
--    켠 지점이 아니면 {on:false}. 이름 · 사진 · 첫 출석일 · 며칠째 · 창 안 출석 · 마지막 출석 · 지금쯤 와 있으면 좋은 횟수
create or replace function public.get_starter_watchlist(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  c jsonb := public._motivation_conf();
  v_all boolean;
  v_branch text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_win integer;
  v_goal integer;
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_all := public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin');
  if v_all then
    v_branch := coalesce(nullif(trim(p_branch), ''), (select p.branch_name from public.profiles p where p.user_id = v_me));
  else
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me) then
      raise exception '지점 지도진만 볼 수 있어요' using errcode = '42501';
    end if;
  end if;
  if v_branch is null
     or v_branch not in (select jsonb_array_elements_text(coalesce(c -> 'branches', '[]'::jsonb))) then
    return jsonb_build_object('on', false, 'branch', v_branch, 'rows', '[]'::jsonb);
  end if;
  v_win := greatest(7, coalesce((c ->> 'starter_days')::integer, 28));
  v_goal := greatest(1, coalesce((c ->> 'starter_goal')::integer, 8));

  with m as (
    select p.user_id, p.name, p.nickname, p.avatar_url
      from public.profiles p
     where p.branch_name = v_branch
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
       )
  ), days as (
    select a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as day
      from public.attendance_logs a
      join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
     group by 1, 2
  ), s as (
    select user_id, min(day) as first_day, max(day) as last_day from days group by user_id
  ), w as (
    select s.user_id, s.first_day, s.last_day,
           (select count(*)::integer from days d
             where d.user_id = s.user_id and d.day between s.first_day and s.first_day + (v_win - 1)) as cnt
      from s
     where v_today - s.first_day < v_win
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', w.user_id,
           'name', coalesce(nullif(trim(m.nickname), ''), m.name),
           'real_name', m.name,
           'avatar_url', m.avatar_url,
           'first_day', w.first_day,
           'day', v_today - w.first_day + 1,
           'count', w.cnt,
           'last_day', w.last_day,
           'expected', floor((v_today - w.first_day + 1) * v_goal::numeric / v_win)::integer,
           'done', exists (select 1 from public.motivation_awards x where x.user_id = w.user_id and x.kind = 'starter')
         ) order by (w.cnt::numeric - (v_today - w.first_day + 1) * v_goal::numeric / v_win), w.first_day), '[]'::jsonb)
    into v_rows
    from w
    join m on m.user_id = w.user_id;

  return jsonb_build_object('on', true, 'branch', v_branch, 'goal', v_goal, 'days', v_win, 'today', v_today, 'rows', v_rows);
end
$$;

-- 7) 권한 — 화면은 get_my_motivation · mark_my_motivation_seen · get_starter_watchlist 만
revoke all on function public._motivation_conf() from public, anon, authenticated;
revoke all on function public._motivation_member(uuid) from public, anon, authenticated;
revoke all on function public._motivation_days(uuid, integer) from public, anon, authenticated;
revoke all on function public.motivation_tick(interval) from public, anon, authenticated;
revoke all on function public.get_my_motivation() from public, anon;
revoke all on function public.mark_my_motivation_seen() from public, anon;
revoke all on function public.get_starter_watchlist(text) from public, anon;
grant execute on function public.get_my_motivation() to authenticated;
grant execute on function public.mark_my_motivation_seen() to authenticated;
grant execute on function public.get_starter_watchlist(text) to authenticated;

-- 8) 예약 — 5분마다 (같은 이름이면 pg_cron 이 바꾼다 · 끄기 select cron.unschedule('motivation-tick');)
select cron.schedule('motivation-tick', '*/5 * * * *', $$select public.motivation_tick()$$);

-- 켠 날 한 번 — 지금 첫 4주 안에 있는 회원부터 (다시 적용해도 이미 남긴 것은 건너뛴다)
select public.motivation_tick(interval '28 days');
