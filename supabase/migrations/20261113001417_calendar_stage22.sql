-- 📅 운동 달력 2-2단계 — 153 일정(운영본부 → 회원 달력 · 알림) · 약속 알림 시각 고르기 · 저녁 독려(켠 회원만) · 저요 한 모집이 그날 칸에
--   (2026-11-13 대표님 「다음」 · 153 일정은 「앱 운영본부에서」 — 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b 2-2)
--
--   감정 설계(CLAUDE.md 「회원 감정 설계 기준」 — 오기 전 = 기대):
--     · 153 일정 = 지점장님 · 대표님이 153운영본부 「일정」 탭에서 '회원 달력에 올리기'
--       (휴관 · 단축 운영 · 이벤트 · 대회 · 특강 · 그 밖 / 하루 또는 여러 날 / 한 줄 설명)
--       → 그 지점 회원 운동 달력에 바로 + 알림(그날 아침 · 하루 전 저녁 — 고른 것만, 일정마다 한 번씩).
--       휴관일엔 약속 알림을 보내지 않고 · 놓친 약속으로 세지 않는다(복귀 보너스) · 저녁 독려에서 체육관 체크를 뺀다.
--     · 약속 알림 시각 = 회원이 고른다(전날 저녁 8시 · 아침 7시 · 아침 8시 30분(기본) · 낮 12시 · 오후 5시).
--     · 저녁 독려 = 켠 회원만 저녁 8시 한 번 — 채운 것이 있고 아직 남았을 때만 '오늘 2개 채웠어요 · 하나 더 채우면 금색 별'
--       (하나도 안 채운 날 · 다 채운 날은 보내지 않는다 — 못한 것은 말하지 않는다).
--     · 저요 한 운동 모집(올렸거나 저요 한 것, 내리지 않은 것) = get_my_calendar 의 calls — 그날 칸 · 그날 카드에.
--   · 새 설정 1(app_settings.calendar_notice) · 새 표 2 · 새 칸 1(member_promises.remind) · 새 함수.
--     고친 함수: get_my_calendar(events · calls · nudge 를 덧붙임) · promise_tick(고른 시각 · 휴관일) ·
--     _promise_json · get_my_promise(remind · eve_at 을 덧붙임). 이름 · 인자 · 권한은 그대로 — set_my_promise 도 그대로 두고 v2 를 새로.
--   · 출석 표에는 트리거를 달지 않는다(보호 영역) — 10분마다(calendar-tick) 읽는다. 알림은 일정마다 한 문장으로 넣는다
--     (notifications 트리거가 문장마다 휴대폰 알림을 한 번에 보낸다).
--   · 휴대폰 캘린더(.ics)는 Edge Function calendar-ics(DB 없음 · 인자로 만든 글만).
--   · 끄기: 153 일정 알림 = 일정마다 '알림' 끄기 · 저녁 독려 = 회원이 끄기 · 전체 = select cron.unschedule('calendar-tick');

-- 1) 설정 (알림 시각 · 153 일정 알림 받는 회원)
insert into public.app_settings (key, value, updated_at)
values (
  'calendar_notice',
  jsonb_build_object(
    'note', '운동 달력 2-2단계 (2026-11-13 대표님 「다음」 · 153 일정 = 「앱 운영본부에서」). event_morning = 153 일정 그날 아침 알림 · event_eve = 하루 전 저녁 알림 · promise_eve = 운동 약속 「전날 저녁」 알림 · nudge_at = 저녁 독려(켠 회원만) · quiet_after = 이 시각부터는 보내지 않음 · audience_* = 153 일정 알림 받는 회원(그 지점 승인된 회원 중 수강권이 끝난 지 grace 일 안이거나 최근 recent 일 안에 온 회원).',
    'event_morning', '08:30',
    'event_eve', '19:00',
    'promise_eve', '20:00',
    'nudge_at', '20:00',
    'quiet_after', '21:00',
    'audience_grace_days', 7,
    'audience_recent_days', 30
  ),
  now()
)
on conflict (key) do nothing;

-- 2) 표 — 153 일정 (지점마다 · 지우지 않고 removed_at)
create table if not exists public.branch_calendar_events (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  kind text not null,
  title text not null,
  start_on date not null,
  end_on date not null,
  notify_morning boolean not null default true,
  notify_eve boolean not null default false,
  morning_sent_at timestamptz,
  morning_sent_n integer,
  eve_sent_at timestamptz,
  eve_sent_n integer,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  constraint branch_calendar_events_kind_chk check (kind in ('closed', 'short', 'event', 'match', 'class', 'etc')),
  constraint branch_calendar_events_title_chk check (char_length(title) between 1 and 40),
  constraint branch_calendar_events_dates_chk check (end_on >= start_on and end_on - start_on <= 30)
);
create index if not exists branch_calendar_events_branch_idx
  on public.branch_calendar_events (branch_name, start_on) where removed_at is null;
alter table public.branch_calendar_events enable row level security;
revoke all on table public.branch_calendar_events from anon, authenticated;
comment on table public.branch_calendar_events is '153 일정 — 지점장님 · 대표님이 153운영본부 「일정」 탭에서 회원 운동 달력에 올린 휴관 · 단축 운영 · 이벤트 · 대회 · 특강 · 그 밖(31일까지). 알림 그날 아침(morning) · 하루 전 저녁(eve) 한 번씩. 함수로만(ops_cal_events · ops_cal_event_save · ops_cal_event_remove · get_my_calendar · calendar_tick).';

-- 표 — 회원 달력 설정 (저녁 독려 켜기)
create table if not exists public.member_calendar_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  evening_nudge boolean not null default false,
  last_nudge_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_calendar_prefs enable row level security;
revoke all on table public.member_calendar_prefs from anon, authenticated;
comment on table public.member_calendar_prefs is '운동 달력 설정 — 저녁 독려(evening_nudge · 켠 회원만 저녁 8시 한 번 · last_nudge_on = 마지막으로 살펴본 날). 함수로만(get_my_calendar · set_my_calendar_prefs · calendar_tick).';

-- 칸 — 운동 약속 알림 시각 (null = 설정 remind_at 그대로)
alter table public.member_promises add column if not exists remind text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'member_promises_remind_chk' and conrelid = 'public.member_promises'::regclass
  ) then
    alter table public.member_promises
      add constraint member_promises_remind_chk
      check (remind is null or remind in ('eve', '07:00', '08:30', '12:00', '17:00'));
  end if;
end
$$;
comment on column public.member_promises.remind is '약속 알림 시각 — eve = 전날 저녁(calendar_notice.promise_eve) · 07:00 · 08:30 · 12:00 · 17:00 (그날) · null = promise_pilot.remind_at';

-- 3) 안쪽 함수 (화면에서 부르지 않음)
create or replace function public._cal_conf()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'calendar_notice'), '{}'::jsonb)
$$;

-- 회원 달력에 올리기 = 대표님 · 그 지점 관리자(ops_managers — 앱 권한 branch_manager 만으로는 안 됨, 「일정」 탭 팀 일정과 같은 기준)
create or replace function public._cal_event_can_edit(_uid uuid, _branch text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _uid is not null and _branch is not null and public._ops_plan_can_view_all(_uid, _branch)
$$;

-- 보기 = 올릴 수 있는 분 + 그 지점 「일정」 탭 팀(지도진 · 앱 계정이 이어진 근무자 카드)
create or replace function public._cal_event_can_view(_uid uuid, _branch text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public._cal_event_can_edit(_uid, _branch)
      or (_uid is not null and exists (select 1 from public._ops_plan_team(_branch) t where t.user_id = _uid))
$$;

-- 그 지점 그날이 휴관인가
create or replace function public._cal_closed_on(_branch text, _day date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _branch is not null and _day is not null and exists (
    select 1 from public.branch_calendar_events e
     where e.branch_name = _branch and e.kind = 'closed' and e.removed_at is null
       and _day between e.start_on and e.end_on)
$$;

-- 153 일정 알림 받는 회원 — 그 지점 승인된 회원(코치님 · 운영진 · 체험 · 합쳐진 계정 빼고) 중
--   수강권이 끝난 지 grace 일 안이거나 최근 recent 일 안에 온 회원
create or replace function public._cal_event_audience(_branch text)
returns table(user_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  with k as (
    select greatest(0, coalesce((public._cal_conf() ->> 'audience_grace_days')::integer, 7)) as grace,
           greatest(1, coalesce((public._cal_conf() ->> 'audience_recent_days')::integer, 30)) as recent,
           (now() at time zone 'Asia/Seoul')::date as today
  )
  select p.user_id
    from public.profiles p, k
   where p.branch_name = _branch
     and coalesce(p.is_approved, false)
     and not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and p.merged_into is null
     and not exists (
       select 1 from public.user_roles r
        where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin'))
     and (p.membership_end >= k.today - k.grace
          or exists (
            select 1 from public.attendance_logs a
             where a.user_id = p.user_id and not coalesce(a.is_duplicate, false)
               and a.checked_in_at >= now() - make_interval(days => k.recent)))
$$;

-- '11/14(금)' (알림 글)
create or replace function public._cal_day_label(_d date)
returns text
language sql
stable
set search_path to 'public'
as $$
  select to_char(_d, 'FMMM/FMDD') || '(' || (array['일', '월', '화', '수', '목', '금', '토'])[extract(dow from _d)::integer + 1] || ')'
$$;

-- 153 일정 알림 제목 — 그날 아침 · 하루 전 저녁
create or replace function public._cal_event_notice_title(_kind text, _eve boolean)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select (case when _eve then '내일' else '오늘' end)
      || case _kind
           when 'closed' then '은 휴관이에요'
           when 'short' then '은 단축 운영해요'
           when 'event' then ' 153 이벤트가 있어요'
           when 'match' then ' 대회가 있어요'
           when 'class' then ' 특강이 있어요'
           else ' 153 일정이 있어요'
         end
$$;

-- 그날의 체크 수 (저녁 독려) — 화면 lib/calendarChecks dayChecks 와 같은 식:
--   저절로 3개(체육관 · 응원(응원 또는 153) · 한 줄) + 그날의 나만의 체크 · 휴관일에 안 왔으면 체육관은 빼고 센다
create or replace function public._cal_check_count(_uid uuid, _day date)
returns table(total integer, done integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with b as (
    select (_day::timestamp at time zone 'Asia/Seoul') as f,
           ((_day + 1)::timestamp at time zone 'Asia/Seoul') as t,
           (select p.branch_name from public.profiles p where p.user_id = _uid) as branch
  ), x as (
    select
      exists (select 1 from public.attendance_logs a
               where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                 and a.checked_in_at >= b.f and a.checked_in_at < b.t) as gym,
      public._cal_closed_on(b.branch, _day) as closed,
      (exists (select 1 from public.boxing_cheers c
                where c.sender_user_id = _uid and c.created_at >= b.f and c.created_at < b.t)
       or exists (select 1 from public.community_reactions r
                   where r.user_id = _uid and r.created_at >= b.f and r.created_at < b.t)) as cheer,
      exists (select 1 from public.champion_journal_entries j
               where j.user_id = _uid and coalesce(j.kind, 'journal') = 'journal'
                 and j.created_at >= b.f and j.created_at < b.t) as line
      from b
  ), items as (
    select i.id
      from public.member_check_items i
     where i.user_id = _uid
       and (i.created_at at time zone 'Asia/Seoul')::date <= _day
       and (i.archived_at is null or (i.archived_at at time zone 'Asia/Seoul')::date > _day)
       and (i.weekdays is null or extract(dow from _day)::smallint = any (i.weekdays))
  ), d as (
    select coalesce((select m.done from public.member_check_days m where m.user_id = _uid and m.day = _day), '{}'::uuid[]) as done
  )
  select
    ((case when x.closed and not x.gym then 0 else 1 end) + 2 + (select count(*) from items))::integer as total,
    (x.gym::integer + x.cheer::integer + x.line::integer
      + (select count(*) from items, d where items.id = any (d.done)))::integer as done
    from x
$$;

-- 4) 운영본부 「일정」 탭 — 회원 달력 153 일정 (지난 14일 ~ 앞으로 · 60개까지)
create or replace function public.ops_cal_events(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  k jsonb := public._cal_conf();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text;
  v_edit boolean;
  v_events jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_branch := coalesce(nullif(btrim(coalesce(p_branch, '')), ''),
                       (select p.branch_name from public.profiles p where p.user_id = v_me));
  if v_branch is null or not public._cal_event_can_view(v_me, v_branch) then
    return jsonb_build_object('on', false, 'branch', v_branch);
  end if;
  v_edit := public._cal_event_can_edit(v_me, v_branch);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', e.kind, 'title', e.title, 'start_on', e.start_on, 'end_on', e.end_on,
           'notify_morning', e.notify_morning, 'notify_eve', e.notify_eve,
           'morning_sent_at', e.morning_sent_at, 'morning_sent_n', e.morning_sent_n,
           'eve_sent_at', e.eve_sent_at, 'eve_sent_n', e.eve_sent_n,
           'by', coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '운영진'),
           'updated_at', e.updated_at)
         order by e.start_on, e.created_at), '[]'::jsonb)
    into v_events
    from (
      select * from public.branch_calendar_events e0
       where e0.branch_name = v_branch and e0.removed_at is null and e0.end_on >= v_today - 14
       order by e0.start_on, e0.created_at
       limit 60
    ) e
    left join public.profiles p on p.user_id = coalesce(e.updated_by, e.created_by);

  return jsonb_build_object(
    'on', true,
    'branch', v_branch,
    'today', v_today,
    'can_edit', v_edit,
    'audience', case when v_edit then (select count(*) from public._cal_event_audience(v_branch)) end,
    'morning_at', coalesce(k ->> 'event_morning', '08:30'),
    'eve_at', coalesce(k ->> 'event_eve', '19:00'),
    'quiet_after', coalesce(k ->> 'quiet_after', '21:00'),
    'events', v_events);
end
$$;

-- 153 일정 올리기 · 고치기 — 날짜가 바뀌면 알림을 새 날짜로 다시 보낸다(보낸 표시를 비움)
create or replace function public.ops_cal_event_save(
  p_id uuid default null,
  p_branch text default null,
  p_kind text default null,
  p_title text default null,
  p_start date default null,
  p_end date default null,
  p_notify_morning boolean default true,
  p_notify_eve boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text;
  v_kind text := nullif(btrim(coalesce(p_kind, '')), '');
  v_title text := nullif(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), '');
  v_end date := coalesce(p_end, p_start);
  v_old public.branch_calendar_events%rowtype;
  v_n integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    v_branch := nullif(btrim(coalesce(p_branch, '')), '');
    if v_branch is null
       or not (exists (select 1 from public.branches b where b.name = v_branch)
               or exists (select 1 from public.ops_branches ob where ob.branch_name = v_branch)) then
      raise exception '지점을 다시 골라 주세요';
    end if;
  else
    select * into v_old from public.branch_calendar_events where id = p_id and removed_at is null for update;
    if not found then
      raise exception '일정을 찾지 못했어요';
    end if;
    v_branch := v_old.branch_name;
  end if;
  if not public._cal_event_can_edit(v_me, v_branch) then
    raise exception '회원 달력에는 대표님 · 지점장님만 올릴 수 있어요' using errcode = '42501';
  end if;
  if v_kind is null or v_kind not in ('closed', 'short', 'event', 'match', 'class', 'etc') then
    raise exception '종류를 골라 주세요';
  end if;
  if v_title is null then
    raise exception '한 줄 설명을 적어 주세요';
  end if;
  if char_length(v_title) > 40 then
    raise exception '한 줄 설명은 40자 안으로 적어 주세요';
  end if;
  if p_start is null then
    raise exception '날짜를 골라 주세요';
  end if;
  if v_end < p_start then
    raise exception '끝나는 날을 시작하는 날 뒤로 골라 주세요';
  end if;
  if v_end - p_start > 30 then
    raise exception '기간은 31일 안으로 골라 주세요';
  end if;
  if v_end < v_today then
    raise exception '지난 날짜에는 올릴 수 없어요';
  end if;
  if p_start > v_today + 400 then
    raise exception '1년 안의 날짜로 골라 주세요';
  end if;

  if p_id is null then
    -- 동시에 두 번 눌러도 지점마다 다가오는 일정 60개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('branch-calendar-events:' || v_branch));
    select count(*)::integer into v_n
      from public.branch_calendar_events
     where branch_name = v_branch and removed_at is null and end_on >= v_today;
    if v_n >= 60 then
      raise exception '다가오는 153 일정이 너무 많아요 · 지난 일정부터 정리해 주세요';
    end if;
    insert into public.branch_calendar_events
      (branch_name, kind, title, start_on, end_on, notify_morning, notify_eve, created_by, updated_by)
    values
      (v_branch, v_kind, v_title, p_start, v_end, coalesce(p_notify_morning, true), coalesce(p_notify_eve, false), v_me, v_me);
  else
    update public.branch_calendar_events
       set kind = v_kind,
           title = v_title,
           start_on = p_start,
           end_on = v_end,
           notify_morning = coalesce(p_notify_morning, true),
           notify_eve = coalesce(p_notify_eve, false),
           morning_sent_at = case when p_start = v_old.start_on then morning_sent_at end,
           morning_sent_n = case when p_start = v_old.start_on then morning_sent_n end,
           eve_sent_at = case when p_start = v_old.start_on then eve_sent_at end,
           eve_sent_n = case when p_start = v_old.start_on then eve_sent_n end,
           updated_by = v_me,
           updated_at = now()
     where id = p_id;
  end if;
  return public.ops_cal_events(v_branch);
end
$$;

-- 153 일정 빼기 — 지우지 않고 removed_at (회원 달력에서 바로 사라짐 · 아직 안 간 알림도 안 감)
create or replace function public.ops_cal_event_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select e.branch_name into v_branch from public.branch_calendar_events e where e.id = p_id and e.removed_at is null;
  if v_branch is null then
    raise exception '일정을 찾지 못했어요';
  end if;
  if not public._cal_event_can_edit(v_me, v_branch) then
    raise exception '회원 달력에는 대표님 · 지점장님만 올릴 수 있어요' using errcode = '42501';
  end if;
  update public.branch_calendar_events
     set removed_at = now(), removed_by = v_me, updated_by = v_me, updated_at = now()
   where id = p_id and removed_at is null;
  return public.ops_cal_events(v_branch);
end
$$;

-- 5) 회원 화면 — 보이는 날짜(63일까지)의 체크 · 한 줄 · 스티커 + 나만의 체크 + (2-2) 153 일정 · 저요 한 모집 · 저녁 독려
create or replace function public.get_my_calendar(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_from timestamptz;
  v_to timestamptz;
  v_items jsonb;
  v_days jsonb;
  v_branch text;
  v_events jsonb;
  v_calls jsonb;
  v_nudge boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    return jsonb_build_object('on', false);
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception '날짜를 다시 골라 주세요';
  end if;
  v_from := (p_from::timestamp at time zone 'Asia/Seoul');
  v_to := ((p_to + 1)::timestamp at time zone 'Asia/Seoul');

  -- 이 날짜들에 있던 항목(그 뒤에 뺀 것 포함 — 그날의 체크를 세려고)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'label', i.label, 'target', i.target, 'unit', i.unit,
           'weekdays', to_jsonb(i.weekdays),
           'created_on', (i.created_at at time zone 'Asia/Seoul')::date,
           'archived_on', (i.archived_at at time zone 'Asia/Seoul')::date)
         order by i.created_at), '[]'::jsonb)
    into v_items
    from public.member_check_items i
   where i.user_id = v_me
     and i.created_at < v_to
     and (i.archived_at is null or i.archived_at >= v_from);

  with d as (
    select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ), ch as (
    select distinct (c.created_at at time zone 'Asia/Seoul')::date as day
      from public.boxing_cheers c
     where c.sender_user_id = v_me and c.created_at >= v_from and c.created_at < v_to
  ), rx as (
    select distinct (r.created_at at time zone 'Asia/Seoul')::date as day
      from public.community_reactions r
     where r.user_id = v_me and r.created_at >= v_from and r.created_at < v_to
  ), jr as (
    select distinct on ((j.created_at at time zone 'Asia/Seoul')::date)
           (j.created_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'id', j.id, 'content', j.content, 'mood', j.mood, 'photo_url', j.photo_url,
             'visibility', coalesce(j.visibility, 'branch'), 'at', j.created_at) as entry
      from public.champion_journal_entries j
     where j.user_id = v_me
       and coalesce(j.kind, 'journal') = 'journal'
       and j.created_at >= v_from and j.created_at < v_to
     order by (j.created_at at time zone 'Asia/Seoul')::date, j.created_at desc
  ), md as (
    select m.day, m.done, m.sticker
      from public.member_check_days m
     where m.user_id = v_me and m.day between p_from and p_to
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', d.day,
           'cheer', ch.day is not null,
           'give153', rx.day is not null,
           'journal', jr.entry,
           'done', coalesce(to_jsonb(md.done), '[]'::jsonb),
           'sticker', md.sticker)
         order by d.day), '[]'::jsonb)
    into v_days
    from d
    left join ch on ch.day = d.day
    left join rx on rx.day = d.day
    left join jr on jr.day = d.day
    left join md on md.day = d.day
   where ch.day is not null or rx.day is not null or jr.day is not null or md.day is not null;

  -- (2-2) 내 지점 153 일정 — 이 날짜들에 걸친 것
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', e.kind, 'title', e.title, 'start_on', e.start_on, 'end_on', e.end_on)
         order by e.start_on, e.created_at), '[]'::jsonb)
    into v_events
    from public.branch_calendar_events e
   where v_branch is not null and e.branch_name = v_branch and e.removed_at is null
     and e.start_on <= p_to and e.end_on >= p_from;

  -- (2-2) 내가 올렸거나 저요 한 운동 모집 (내리지 않은 것)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'day', c.call_date, 'hour', c.slot_hour, 'purpose', c.purpose,
           'mine', c.user_id = v_me,
           'host', coalesce(nullif(btrim(hp.nickname), ''), nullif(btrim(hp.name), ''), '동료'),
           'joiners', (select count(*) from public.boxing_partner_call_joins j where j.call_id = c.id),
           'done', exists (select 1 from public.boxing_partner_call_done dn where dn.call_id = c.id and dn.user_id = v_me),
           'now', c.expires_at is not null)
         order by c.call_date, c.slot_hour nulls first, c.created_at), '[]'::jsonb)
    into v_calls
    from public.boxing_partner_calls c
    left join public.profiles hp on hp.user_id = c.user_id
   where c.status = 'open'
     and c.call_date between p_from and p_to
     and (c.user_id = v_me
          or exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id and j.user_id = v_me));

  select cp.evening_nudge into v_nudge from public.member_calendar_prefs cp where cp.user_id = v_me;

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'days', v_days,
    'events', v_events,
    'calls', v_calls,
    'nudge', jsonb_build_object('on', coalesce(v_nudge, false), 'at', coalesce(public._cal_conf() ->> 'nudge_at', '20:00')));
end
$$;

-- 저녁 독려 켜기 · 끄기
create or replace function public.set_my_calendar_prefs(p_evening_nudge boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_on boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  insert into public.member_calendar_prefs as m (user_id, evening_nudge)
  values (v_me, coalesce(p_evening_nudge, false))
  on conflict (user_id) do update
     set evening_nudge = excluded.evening_nudge, updated_at = now()
  returning m.evening_nudge into v_on;
  return jsonb_build_object('on', v_on, 'at', coalesce(public._cal_conf() ->> 'nudge_at', '20:00'));
end
$$;

-- 6) 운동 약속 — 알림 시각(remind)을 함께 (예전 함수 이름 · 인자는 그대로)
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
           'remind', mp.remind,
           'started_on', mp.started_on,
           'updated_at', mp.updated_at)
    from public.member_promises mp
   where mp.user_id = _uid and mp.stopped_at is null
$$;

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
    'eve_at', coalesce(public._cal_conf() ->> 'promise_eve', '20:00'),
    'promise', public._promise_json(v_me)
  );
end
$$;

-- 약속 걸기 · 고치기 + 알림 시각 — 검사 · 저장은 set_my_promise 그대로, 그 뒤 remind 만
create or replace function public.set_my_promise_v2(
  p_weekdays integer[],
  p_time_slot text default null,
  p_plan_b text default null,
  p_notify boolean default true,
  p_remind text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_remind text := nullif(btrim(coalesce(p_remind, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_remind is not null and v_remind not in ('eve', '07:00', '08:30', '12:00', '17:00') then
    raise exception '알림 시각을 다시 골라 주세요';
  end if;
  perform public.set_my_promise(p_weekdays, p_time_slot, p_plan_b, p_notify);
  update public.member_promises set remind = v_remind, updated_at = now() where user_id = v_me;
  return public.get_my_promise();
end
$$;

-- 10분마다 — ① 약속 알림(회원이 고른 때 · 휴관일 빼고) ② 복귀 보너스(휴관일은 놓친 약속으로 안 셈)
create or replace function public.promise_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c jsonb := public._promise_conf();
  k jsonb := public._cal_conf();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_tomorrow date := (now() at time zone 'Asia/Seoul')::date + 1;
  v_from timestamptz;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_wd smallint := extract(dow from (now() at time zone 'Asia/Seoul'))::smallint;
  v_wd_next smallint := ((extract(dow from (now() at time zone 'Asia/Seoul'))::integer + 1) % 7)::smallint;
  v_remind text := coalesce(c ->> 'remind_at', '08:30');
  v_quiet text := coalesce(c ->> 'quiet_after', '21:00');
  v_eve text := coalesce(k ->> 'promise_eve', '20:00');
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

  -- ① 약속 알림 — 알림 켬 · 한 번만 (휴대폰 알림 시간 quiet_after 전까지)
  --    그날(remind 07:00 · 08:30 · 12:00 · 17:00, 없으면 remind_at): 오늘 약속한 요일 · 고른 시각이 지남 · 아직 안 옴 · 휴관일 아님
  --    전날 저녁(remind eve): 내일 약속한 요일 · promise_eve 가 지남 · 내일이 휴관일 아님 — 알림 기록의 날 = 내일
  if v_hm < v_quiet then
    for r in
      select mp.user_id, mp.time_slot, mp.plan_b, coalesce(mp.remind = 'eve', false) as eve
        from public.member_promises mp
       where mp.stopped_at is null
         and mp.notify
         and public._promise_member(mp.user_id) is not null
         and (
           (coalesce(mp.remind, '') <> 'eve'
             and v_wd = any(mp.weekdays)
             and mp.started_on <= v_today
             and v_hm >= coalesce(mp.remind, v_remind)
             and not public._cal_closed_on(mp.branch_name, v_today)
             and not exists (
               select 1 from public.member_promise_notices n
                where n.user_id = mp.user_id and n.kind = 'remind' and n.day = v_today)
             and not exists (
               select 1 from public.attendance_logs a
                where a.user_id = mp.user_id and not coalesce(a.is_duplicate, false)
                  and a.checked_in_at >= v_from and a.checked_in_at < v_from + interval '1 day'))
           or
           (mp.remind = 'eve'
             and v_wd_next = any(mp.weekdays)
             and mp.started_on <= v_tomorrow
             and v_hm >= v_eve
             and not public._cal_closed_on(mp.branch_name, v_tomorrow)
             and not exists (
               select 1 from public.member_promise_notices n
                where n.user_id = mp.user_id and n.kind = 'remind' and n.day = v_tomorrow))
         )
    loop
      insert into public.member_promise_notices (user_id, kind, day)
      values (r.user_id, 'remind', case when r.eve then v_tomorrow else v_today end)
      on conflict do nothing;
      if found then
        v_slot := public._promise_slot_label(r.time_slot);
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id,
                case when r.eve then '내일은 운동 약속한 날이에요' else '오늘은 운동 약속한 날이에요' end,
                coalesce(v_slot || '에 만나요', case when r.eve then '내일 체육관에서 만나요' else '오늘 체육관에서 만나요' end)
                  || coalesce(' · 대비책: ' || r.plan_b, ''),
                '/home');
        v_remind_n := v_remind_n + 1;
      end if;
    end loop;
  end if;

  -- ② 복귀 보너스 — 오늘 온 회원 중 약속한 날을 놓친 뒤 다시 온 회원 · 한 달 1번 (알림 시간 밖이면 알림함에만)
  if v_bonus > 0 then
    for r in
      select mp.user_id, mp.weekdays, mp.started_on, mp.branch_name
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
      -- 놓친 약속 = (마지막 출석 다음 날 ~ 어제) 중 약속한 요일 — 약속을 건 날 · 켠 날 · 창(window) 뒤만 · 휴관일은 빼고
      select count(*)::integer into v_missed
        from generate_series(
               greatest(coalesce(v_last + 1, r.started_on), r.started_on, v_start, v_today - v_window),
               v_today - 1,
               interval '1 day') g(d)
       where extract(dow from g.d)::smallint = any(r.weekdays)
         and not public._cal_closed_on(r.branch_name, g.d::date);
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

-- 7) 10분마다 — ① 153 일정 그날 아침 ② 하루 전 저녁 ③ 저녁 독려(켠 회원만)
create or replace function public.calendar_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  k jsonb := public._cal_conf();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_morning text := coalesce(k ->> 'event_morning', '08:30');
  v_eve text := coalesce(k ->> 'event_eve', '19:00');
  v_nudge text := coalesce(k ->> 'nudge_at', '20:00');
  v_quiet text := coalesce(k ->> 'quiet_after', '21:00');
  r record;
  v_n integer;
  v_events integer := 0;
  v_sent integer := 0;
  v_total integer;
  v_done integer;
  v_uids uuid[] := '{}';
  v_titles text[] := '{}';
  v_bodies text[] := '{}';
begin
  -- ① · ② 153 일정 — 일정마다 한 번 · 그 지점 알림 받는 회원 모두에게 한 문장으로
  if v_hm < v_quiet then
    for r in
      select e.id, e.branch_name, e.kind, e.title, e.start_on, e.end_on, false as eve
        from public.branch_calendar_events e
       where e.removed_at is null and e.notify_morning and e.morning_sent_at is null
         and e.start_on = v_today and v_hm >= v_morning
      union all
      select e.id, e.branch_name, e.kind, e.title, e.start_on, e.end_on, true as eve
        from public.branch_calendar_events e
       where e.removed_at is null and e.notify_eve and e.eve_sent_at is null
         and e.start_on = v_today + 1 and v_hm >= v_eve
    loop
      if r.eve then
        update public.branch_calendar_events set eve_sent_at = v_now where id = r.id and eve_sent_at is null;
      else
        update public.branch_calendar_events set morning_sent_at = v_now where id = r.id and morning_sent_at is null;
      end if;
      continue when not found;

      insert into public.notifications (user_id, title, body, link)
      select a.user_id,
             public._cal_event_notice_title(r.kind, r.eve),
             r.title || case when r.end_on > r.start_on then ' · ' || public._cal_day_label(r.end_on) || '까지' else '' end,
             '/home'
        from public._cal_event_audience(r.branch_name) a;
      get diagnostics v_n = row_count;

      if r.eve then
        update public.branch_calendar_events set eve_sent_n = v_n where id = r.id;
      else
        update public.branch_calendar_events set morning_sent_n = v_n where id = r.id;
      end if;
      v_events := v_events + 1;
      v_sent := v_sent + v_n;
    end loop;
  end if;

  -- ③ 저녁 독려 — 켠 회원만 · 하루 한 번 살펴보고 · 채운 것이 있고 아직 남았을 때만 (못한 것은 말하지 않는다)
  if v_hm >= v_nudge and v_hm < v_quiet then
    for r in
      select cp.user_id
        from public.member_calendar_prefs cp
       where cp.evening_nudge
         and cp.last_nudge_on is distinct from v_today
         and public._is_active_member(cp.user_id)
       for update of cp skip locked
    loop
      update public.member_calendar_prefs set last_nudge_on = v_today where user_id = r.user_id;
      select x.total, x.done into v_total, v_done from public._cal_check_count(r.user_id, v_today) x;
      continue when coalesce(v_done, 0) < 1 or v_done >= v_total;
      v_uids := v_uids || r.user_id;
      v_titles := v_titles || ('오늘 ' || v_done || '개 채웠어요');
      v_bodies := v_bodies || (case when v_total - v_done = 1 then '하나 더 채우면 금색 별이에요'
                                    else (v_total - v_done) || '개 더 채우면 금색 별이에요' end);
    end loop;
    if cardinality(v_uids) > 0 then
      insert into public.notifications (user_id, title, body, link)
      select u, t, b, '/home' from unnest(v_uids, v_titles, v_bodies) as x(u, t, b);
    end if;
  end if;

  return jsonb_build_object('events', v_events, 'event_sent', v_sent, 'nudge', cardinality(v_uids), 'hm', v_hm);
end
$$;

-- 8) 권한 — 화면은 ops_cal_events · ops_cal_event_save · ops_cal_event_remove · set_my_calendar_prefs · set_my_promise_v2 를 새로
--    (get_my_calendar · get_my_promise · _promise_json · promise_tick 은 create or replace 라 권한이 그대로)
revoke all on function public._cal_conf() from public, anon, authenticated;
revoke all on function public._cal_event_can_edit(uuid, text) from public, anon, authenticated;
revoke all on function public._cal_event_can_view(uuid, text) from public, anon, authenticated;
revoke all on function public._cal_closed_on(text, date) from public, anon, authenticated;
revoke all on function public._cal_event_audience(text) from public, anon, authenticated;
revoke all on function public._cal_day_label(date) from public, anon, authenticated;
revoke all on function public._cal_event_notice_title(text, boolean) from public, anon, authenticated;
revoke all on function public._cal_check_count(uuid, date) from public, anon, authenticated;
revoke all on function public.calendar_tick() from public, anon, authenticated;
revoke all on function public.ops_cal_events(text) from public, anon;
revoke all on function public.ops_cal_event_save(uuid, text, text, text, date, date, boolean, boolean) from public, anon;
revoke all on function public.ops_cal_event_remove(uuid) from public, anon;
revoke all on function public.set_my_calendar_prefs(boolean) from public, anon;
revoke all on function public.set_my_promise_v2(integer[], text, text, boolean, text) from public, anon;
grant execute on function public.ops_cal_events(text) to authenticated;
grant execute on function public.ops_cal_event_save(uuid, text, text, text, date, date, boolean, boolean) to authenticated;
grant execute on function public.ops_cal_event_remove(uuid) to authenticated;
grant execute on function public.set_my_calendar_prefs(boolean) to authenticated;
grant execute on function public.set_my_promise_v2(integer[], text, text, boolean, text) to authenticated;

-- 9) 예약 — 10분마다 (같은 이름이면 pg_cron 이 바꾼다)
select cron.schedule('calendar-tick', '*/10 * * * *', $$select public.calendar_tick()$$);
