-- 🤝 회원 「153 운동 약속」 1단계 + 코치 「오늘 만날 회원」
--   (2026-11-12 대표님 「추천하는대로 진행할게」 — 문서 「153 회원 감정 설계」 https://claude.ai/artifact/LK88UcbCHRvQNx6T8kaxu2 ·
--    11/08 「153 계획 시스템 보고서」 https://claude.ai/artifact/EuQAL1HpGefZk8Nwd8GrBf 3단계 중 약속 부분 — 건강 교과서는 미룸)
--
--   감정 설계(CLAUDE.md 「회원 감정 설계 기준」):
--     오기 전 = 기대 — 약속한 날이 운동 달력에 보이고(화면) 그날 아침 알림 한 번(이미 왔으면 안 보냄)
--     안 오는 날 = 그리움 — 놓친 약속은 어디에도 표시하지 않는다(화면 · 알림 모두)
--     다시 온 날 = 복귀 보너스 — 약속한 날을 놓친 뒤 다시 온 날, 회원당 한 달 1번(11/08 확정 6 · grant_mileage idem_key 에 연월)
--     들어올 때 = 환영 — 코치 「오늘 만날 회원」: 오늘 약속한 회원 + 오늘 온 회원 중 첫 4주 · 오랜만에 온 · 수강권이 곧 끝나는 ·
--                운동 모집을 올린 회원 (153운영본부 「일정」 탭 맨 위 — 새 탭 없음)
--   지킴 = 약속한 날 출석(시간대 무관 · 11/08 확정 5) — 회원이 직접 체크하지 않는다.
--
--   · 새 설정 app_settings.promise_pilot(branches = 켠 지점 · 빈 배열이면 화면 · 예약 모두 조용) · 새 표 2(함수로만) · 새 함수만.
--     기존 함수 · 표 · 트리거 · 제약은 그대로. 출석 표(attendance_logs)는 읽기만 — 트리거를 달지 않고 10분마다 훑는다.
--   · 약속 그만하기는 지우지 않고 stopped_at (다시 걸면 비움).
--   · 알림: 약속한 날 아침 remind_at(08:30) ~ quiet_after(21:00) 사이 1번 · 복귀 보너스는 그 밖의 시간이면 알림함에만(pushed_at 채움).
--   · 끄기: promise_pilot.branches 를 빈 배열 (+ select cron.unschedule('promise-tick');)

-- 1) 설정 (켠 지점 · 보상 · 알림 시각 · 「오늘 만날 회원」 기준)
insert into public.app_settings (key, value, updated_at)
values (
  'promise_pilot',
  jsonb_build_object(
    'note', '운동 약속 1단계 + 오늘 만날 회원 (2026-11-12 대표님 「추천하는대로 진행할게」 · 선릉역점만). branches = 켠 지점(빈 배열 = 끔) · start_date = 켠 날(복귀 보너스는 이 날 뒤에 놓친 약속만) · return_bonus = 복귀 보너스 마일리지(한 달 1번) · remind_at ~ quiet_after = 휴대폰 알림 시간 · meet_* = 오늘 만날 회원 기준(첫 n일 · n일 만에 · 수강권 n일 안).',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'start_date', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'return_bonus', 5000,
    'return_window_days', 30,
    'remind_at', '08:30',
    'quiet_after', '21:00',
    'meet_starter_days', 28,
    'meet_gap_days', 14,
    'meet_expiring_days', 14
  ),
  now()
)
on conflict (key) do nothing;

-- 2) 표 — 회원마다 지금 약속 하나(매주 같은 요일) · 알림 한 번만
create table if not exists public.member_promises (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch_name text not null,
  weekdays smallint[] not null,
  time_slot text,
  plan_b text,
  notify boolean not null default true,
  started_on date not null,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_promises_weekdays_chk
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  constraint member_promises_slot_chk
    check (time_slot is null or time_slot in ('dawn', 'morning', 'noon', 'afternoon', 'evening', 'night')),
  constraint member_promises_planb_chk
    check (plan_b is null or char_length(plan_b) between 1 and 60)
);
create index if not exists member_promises_branch_idx on public.member_promises (branch_name) where stopped_at is null;
alter table public.member_promises enable row level security;
revoke all on table public.member_promises from anon, authenticated;
comment on table public.member_promises is '153 운동 약속 — 회원마다 지금 약속 하나(요일 0=일~6=토 · 시간대 · 대비책 · 알림). 함수로만(get_my_promise · set_my_promise · stop_my_promise · promise_tick · ops_meet_today).';

create table if not exists public.member_promise_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('remind', 'return')),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.member_promise_notices enable row level security;
revoke all on table public.member_promise_notices from anon, authenticated;
comment on table public.member_promise_notices is '운동 약속 알림 기록 — 약속한 날 아침 알림(remind) · 복귀 보너스(return)를 한 번만. promise_tick 이 쓴다.';

-- 3) 안쪽 함수 (화면에서 부르지 않음)
create or replace function public._promise_conf()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'promise_pilot'), '{}'::jsonb)
$$;

create or replace function public._promise_branch_on(_branch text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _branch is not null
     and _branch in (select jsonb_array_elements_text(coalesce(public._promise_conf() -> 'branches', '[]'::jsonb)))
$$;

-- 켠 지점의 회원이면 그 지점 이름 (코치님 · 운영진 · 체험 계정 · 합쳐진 계정은 null)
create or replace function public._promise_member(_uid uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.branch_name
    from public.profiles p
   where p.user_id = _uid
     and not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and p.merged_into is null
     and public._promise_branch_on(p.branch_name)
     and not exists (
       select 1 from public.user_roles r
        where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
     )
$$;

create or replace function public._promise_json(_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
           'weekdays', to_jsonb(mp.weekdays),
           'time_slot', mp.time_slot,
           'plan_b', mp.plan_b,
           'notify', mp.notify,
           'started_on', mp.started_on,
           'updated_at', mp.updated_at)
    from public.member_promises mp
   where mp.user_id = _uid and mp.stopped_at is null
$$;

-- 시간대 이름 (알림 글)
create or replace function public._promise_slot_label(_slot text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case _slot
           when 'dawn' then '새벽' when 'morning' then '아침' when 'noon' then '점심'
           when 'afternoon' then '오후' when 'evening' then '저녁' when 'night' then '밤'
         end
$$;

-- 4) 회원 화면 — 켠 지점 회원이 아니면 {on:false}
create or replace function public.get_my_promise()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  c jsonb := public._promise_conf();
  v_branch text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_branch := public._promise_member(v_me);
  if v_branch is null then
    return jsonb_build_object('on', false);
  end if;
  return jsonb_build_object(
    'on', true,
    'branch', v_branch,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'return_bonus', greatest(0, coalesce((c ->> 'return_bonus')::integer, 0)),
    'remind_at', coalesce(c ->> 'remind_at', '08:30'),
    'promise', public._promise_json(v_me)
  );
end
$$;

-- 약속 걸기 · 고치기 — 요일이 바뀌면 그날부터 새 약속(started_on), 같은 요일이면 시간대 · 대비책 · 알림만 바뀐다
create or replace function public.set_my_promise(
  p_weekdays integer[],
  p_time_slot text default null,
  p_plan_b text default null,
  p_notify boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
  v_days smallint[];
  v_slot text := nullif(btrim(coalesce(p_time_slot, '')), '');
  v_plan text := nullif(btrim(regexp_replace(coalesce(p_plan_b, ''), '\s+', ' ', 'g')), '');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_old public.member_promises%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_branch := public._promise_member(v_me);
  if v_branch is null then
    raise exception '운동 약속은 아직 우리 지점에서 준비하고 있어요' using errcode = '42501';
  end if;
  if p_weekdays is null or exists (select 1 from unnest(p_weekdays) d where d is null or d < 0 or d > 6) then
    raise exception '요일을 다시 골라 주세요';
  end if;
  select coalesce(array_agg(x order by x), '{}'::smallint[]) into v_days
    from (select distinct d::smallint as x from unnest(p_weekdays) d) s;
  if cardinality(v_days) = 0 then
    raise exception '약속할 요일을 하나 이상 골라 주세요';
  end if;
  if v_slot is not null and v_slot not in ('dawn', 'morning', 'noon', 'afternoon', 'evening', 'night') then
    raise exception '시간대를 다시 골라 주세요';
  end if;
  if v_plan is not null and char_length(v_plan) > 60 then
    raise exception '대비책은 60자 안으로 적어 주세요';
  end if;

  select * into v_old from public.member_promises where user_id = v_me for update;
  if found then
    update public.member_promises
       set branch_name = v_branch,
           weekdays = v_days,
           time_slot = v_slot,
           plan_b = v_plan,
           notify = coalesce(p_notify, true),
           started_on = case when v_old.stopped_at is null and v_old.weekdays = v_days then v_old.started_on else v_today end,
           stopped_at = null,
           updated_at = now()
     where user_id = v_me;
  else
    insert into public.member_promises (user_id, branch_name, weekdays, time_slot, plan_b, notify, started_on)
    values (v_me, v_branch, v_days, v_slot, v_plan, coalesce(p_notify, true), v_today);
  end if;
  return public.get_my_promise();
end
$$;

-- 약속 그만하기 — 지우지 않고 멈춤(다시 걸면 그날부터 새 약속)
create or replace function public.stop_my_promise()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.member_promises
     set stopped_at = now(), updated_at = now()
   where user_id = v_me and stopped_at is null;
  return jsonb_build_object('ok', true);
end
$$;

-- 5) 10분마다 — ① 약속한 날 아침 알림 ② 복귀 보너스
create or replace function public.promise_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c jsonb := public._promise_conf();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from timestamptz;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_wd smallint := extract(dow from (now() at time zone 'Asia/Seoul'))::smallint;
  v_remind text := coalesce(c ->> 'remind_at', '08:30');
  v_quiet text := coalesce(c ->> 'quiet_after', '21:00');
  v_bonus integer := greatest(0, coalesce((c ->> 'return_bonus')::integer, 0));
  v_window integer := greatest(7, coalesce((c ->> 'return_window_days')::integer, 30));
  v_start date := coalesce((c ->> 'start_date')::date, (now() at time zone 'Asia/Seoul')::date);
  v_loud boolean;
  r record;
  v_last date;
  v_missed integer;
  v_ok boolean;
  v_slot text;
  v_remind_n integer := 0;
  v_return_n integer := 0;
begin
  if jsonb_array_length(coalesce(c -> 'branches', '[]'::jsonb)) = 0 then
    return jsonb_build_object('off', true);
  end if;
  v_from := (v_today::timestamp at time zone 'Asia/Seoul');
  v_loud := v_hm >= v_remind and v_hm < v_quiet;

  -- ① 약속한 날 아침 알림 — 오늘 약속 · 알림 켬 · 아직 안 옴 · 오늘 처음 (휴대폰 알림 시간에만)
  if v_loud then
    for r in
      select mp.user_id, mp.time_slot, mp.plan_b
        from public.member_promises mp
       where mp.stopped_at is null
         and mp.notify
         and v_wd = any(mp.weekdays)
         and mp.started_on <= v_today
         and public._promise_member(mp.user_id) is not null
         and not exists (
           select 1 from public.member_promise_notices n
            where n.user_id = mp.user_id and n.kind = 'remind' and n.day = v_today)
         and not exists (
           select 1 from public.attendance_logs a
            where a.user_id = mp.user_id and not coalesce(a.is_duplicate, false)
              and a.checked_in_at >= v_from and a.checked_in_at < v_from + interval '1 day')
    loop
      insert into public.member_promise_notices (user_id, kind, day)
      values (r.user_id, 'remind', v_today)
      on conflict do nothing;
      if found then
        v_slot := public._promise_slot_label(r.time_slot);
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id,
                '오늘은 운동 약속한 날이에요',
                coalesce(v_slot || '에 만나요', '오늘 체육관에서 만나요') || coalesce(' · 대비책: ' || r.plan_b, ''),
                '/home');
        v_remind_n := v_remind_n + 1;
      end if;
    end loop;
  end if;

  -- ② 복귀 보너스 — 오늘 온 회원 중 약속한 날을 놓친 뒤 다시 온 회원 · 한 달 1번 (알림 시간 밖이면 알림함에만)
  if v_bonus > 0 then
    for r in
      select mp.user_id, mp.weekdays, mp.started_on
        from public.member_promises mp
       where mp.stopped_at is null
         and mp.started_on < v_today
         and public._promise_member(mp.user_id) is not null
         and exists (
           select 1 from public.attendance_logs a
            where a.user_id = mp.user_id and not coalesce(a.is_duplicate, false)
              and a.checked_in_at >= v_from and a.checked_in_at < v_from + interval '1 day')
         and not exists (
           select 1 from public.member_promise_notices n
            where n.user_id = mp.user_id and n.kind = 'return' and n.day >= date_trunc('month', v_today)::date)
    loop
      select max((a.checked_in_at at time zone 'Asia/Seoul')::date) into v_last
        from public.attendance_logs a
       where a.user_id = r.user_id
         and not coalesce(a.is_duplicate, false)
         and a.checked_in_at < v_from
         and a.checked_in_at >= ((v_today - v_window)::timestamp at time zone 'Asia/Seoul');
      -- 놓친 약속 = (마지막 출석 다음 날 ~ 어제) 중 약속한 요일 — 약속을 건 날 · 켠 날 · 창(window) 뒤만
      select count(*)::integer into v_missed
        from generate_series(
               greatest(coalesce(v_last + 1, r.started_on), r.started_on, v_start, v_today - v_window),
               v_today - 1,
               interval '1 day') g(d)
       where extract(dow from g.d)::smallint = any(r.weekdays);
      continue when coalesce(v_missed, 0) = 0;

      v_ok := public.grant_mileage(
        r.user_id, 'milestone', v_bonus, '다시 시작 보너스 — 운동 약속',
        'promise-return:' || r.user_id::text || ':' || to_char(v_today, 'YYYY-MM'), null);
      insert into public.member_promise_notices (user_id, kind, day)
      values (r.user_id, 'return', v_today)
      on conflict do nothing;
      if coalesce(v_ok, false) then
        insert into public.notifications (user_id, title, body, link, pushed_at)
        values (r.user_id,
                '다시 와서 반가워요',
                '복귀 보너스 ' || to_char(v_bonus, 'FM999,999,999') || '점이 들어왔어요 · 다음 약속도 기다릴게요',
                '/home',
                case when v_loud then null else v_now end);
        v_return_n := v_return_n + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object('remind', v_remind_n, 'return', v_return_n, 'hm', v_hm, 'loud', v_loud);
end
$$;

-- 6) 코치 「오늘 만날 회원」 — 그 지점 지도진 · 대표님(전체관리자 · 관리자는 지점 고르기)
--    줄 = 오늘 약속한 회원 + 오늘 온 회원 중 첫 4주 · 오랜만에 온 · 수강권이 곧 끝나는 · 운동 모집을 올린 회원.
--    인사말 · 순서는 화면(src/lib/promise153.ts meetReasons). 대비책 글은 회원 본인만 — 여기 없음.
create or replace function public.ops_meet_today(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  c jsonb := public._promise_conf();
  v_all boolean;
  v_branch text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from timestamptz;
  v_wd smallint := extract(dow from (now() at time zone 'Asia/Seoul'))::smallint;
  v_starter integer := greatest(7, coalesce((c ->> 'meet_starter_days')::integer, 28));
  v_gap integer := greatest(7, coalesce((c ->> 'meet_gap_days')::integer, 14));
  v_exp integer := greatest(1, coalesce((c ->> 'meet_expiring_days')::integer, 14));
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_all := public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin');
  v_branch := coalesce(nullif(btrim(p_branch), ''), (select p.branch_name from public.profiles p where p.user_id = v_me));
  if not v_all and (v_branch is null or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me)) then
    raise exception '지점 지도진만 볼 수 있어요' using errcode = '42501';
  end if;
  if not public._promise_branch_on(v_branch) then
    return jsonb_build_object('on', false, 'branch', v_branch, 'rows', '[]'::jsonb);
  end if;
  v_from := (v_today::timestamp at time zone 'Asia/Seoul');

  with m as (
    select p.user_id, p.name, p.nickname, p.avatar_url, p.membership_end
      from public.profiles p
     where p.branch_name = v_branch
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin'))
  ), came as (
    select a.user_id, min(a.checked_in_at) as came_at
      from public.attendance_logs a
      join m on m.user_id = a.user_id
     where a.checked_in_at >= v_from and a.checked_in_at < v_from + interval '1 day'
       and not coalesce(a.is_duplicate, false)
     group by a.user_id
  ), prom as (
    select mp.user_id, mp.time_slot
      from public.member_promises mp
      join m on m.user_id = mp.user_id
     where mp.stopped_at is null and v_wd = any(mp.weekdays) and mp.started_on <= v_today
  ), base as (
    select user_id from came
    union
    select user_id from prom
  ), hist as (
    select b.user_id,
           (select min((a.checked_in_at at time zone 'Asia/Seoul')::date)
              from public.attendance_logs a
             where a.user_id = b.user_id and not coalesce(a.is_duplicate, false) and a.checked_in_at is not null) as first_day,
           (select max((a.checked_in_at at time zone 'Asia/Seoul')::date)
              from public.attendance_logs a
             where a.user_id = b.user_id and not coalesce(a.is_duplicate, false) and a.checked_in_at < v_from) as prev_day
      from base b
  ), calc as (
    select h.user_id, h.first_day, h.prev_day,
           case when h.first_day is not null and v_today - h.first_day < v_starter then
             (select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::integer
                from public.attendance_logs a
               where a.user_id = h.user_id and not coalesce(a.is_duplicate, false)
                 and a.checked_in_at >= (h.first_day::timestamp at time zone 'Asia/Seoul')
                 and a.checked_in_at < v_from + interval '1 day')
           end as starter_count,
           exists (select 1 from public.boxing_partner_calls pc
                    where pc.user_id = h.user_id and pc.call_date = v_today and pc.status = 'open') as partner_call
      from hist h
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'name', coalesce(nullif(btrim(m.nickname), ''), m.name),
           'real_name', m.name,
           'avatar_url', m.avatar_url,
           'came_at', came.came_at,
           'promised', prom.user_id is not null,
           'time_slot', prom.time_slot,
           'starter_day', case when calc.starter_count is not null then v_today - calc.first_day + 1 end,
           'starter_count', calc.starter_count,
           'gap_days', case when came.user_id is not null and calc.prev_day is not null and v_today - calc.prev_day >= v_gap
                            then v_today - calc.prev_day end,
           'days_left', case when came.user_id is not null and m.membership_end is not null
                              and m.membership_end >= v_today and m.membership_end - v_today <= v_exp
                             then m.membership_end - v_today end,
           'partner_call', calc.partner_call
         ) order by came.came_at desc nulls last, coalesce(nullif(btrim(m.nickname), ''), m.name)), '[]'::jsonb)
    into v_rows
    from calc
    join m on m.user_id = calc.user_id
    left join came on came.user_id = calc.user_id
    left join prom on prom.user_id = calc.user_id
   where prom.user_id is not null
      or (came.user_id is not null and (
            calc.starter_count is not null
         or (calc.prev_day is not null and v_today - calc.prev_day >= v_gap)
         or (m.membership_end is not null and m.membership_end >= v_today and m.membership_end - v_today <= v_exp)
         or calc.partner_call));

  return jsonb_build_object(
    'on', true, 'branch', v_branch, 'today', v_today,
    'starter_days', v_starter, 'gap_days', v_gap, 'expiring_days', v_exp,
    'rows', v_rows);
end
$$;

-- 7) 권한 — 화면은 get_my_promise · set_my_promise · stop_my_promise · ops_meet_today 만
revoke all on function public._promise_conf() from public, anon, authenticated;
revoke all on function public._promise_branch_on(text) from public, anon, authenticated;
revoke all on function public._promise_member(uuid) from public, anon, authenticated;
revoke all on function public._promise_json(uuid) from public, anon, authenticated;
revoke all on function public._promise_slot_label(text) from public, anon, authenticated;
revoke all on function public.promise_tick() from public, anon, authenticated;
revoke all on function public.get_my_promise() from public, anon;
revoke all on function public.set_my_promise(integer[], text, text, boolean) from public, anon;
revoke all on function public.stop_my_promise() from public, anon;
revoke all on function public.ops_meet_today(text) from public, anon;
grant execute on function public.get_my_promise() to authenticated;
grant execute on function public.set_my_promise(integer[], text, text, boolean) to authenticated;
grant execute on function public.stop_my_promise() to authenticated;
grant execute on function public.ops_meet_today(text) to authenticated;

-- 8) 예약 — 10분마다 (같은 이름이면 pg_cron 이 바꾼다)
select cron.schedule('promise-tick', '*/10 * * * *', $$select public.promise_tick()$$);
