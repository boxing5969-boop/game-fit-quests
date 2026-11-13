-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 📅 캘린더 3-2단계 — 운영본부 일정 기본기: 구글처럼 보고 · 옮기고 · 알림 받기
--    (2026-11-13 대표님 「3-2 시작」 · 「캘린더 3단계 보고서」 https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK)
--
--   ① ops_plans 칸 더하기 — rrule(반복 규칙 · UNTIL 없이 저장) · color(12색) · location(80자) · reminders(분 전 · 4개까지) ·
--      series_id(이 일정만 / 이후 모두로 나뉜 줄을 한 묶음으로). 예전 repeat_weekdays · until_on · skip_dates 는 그대로 읽는다
--      (rrule 이 비고 요일이 있으면 매주). 새로 저장하면 반복은 늘 rrule 로 — 매주 규칙이면 repeat_weekdays 도 함께(예전 화면용).
--   ② 반복 펼치기 한 곳 — _ops_rrule_parse · _ops_rrule_fill · _ops_rrule_text · _ops_recur_match · _ops_recur_first ·
--      _ops_recur_until · _ops_plan_rule · _ops_plan_on = 화면 src/lib/opsRecur.ts 와 같은 결과(같은 경우 40개 — opsRecur.cases.json,
--      기대값은 python dateutil). 시작 날은 규칙에 맞는 첫날로 당겨 저장 · COUNT 면 마지막 날을 until_on 에.
--   ③ 읽기 ops_plans_range(지점, 시작, 끝 — 400일까지) — 「일정」 탭 모든 보기(일 · 3일 · 주 · 월 · 목록 · 연간)의 한 곳.
--      ops_plans_week 는 그 한 주를 부르는 얇은 껍데기(이름 · 인자 · 권한 그대로). + prefs(아침 브리핑) · birthdays(회원 생일).
--   ④ 저장 ops_plan_save — scope: one(이 일정만) · following(이후 모두 = 원래 줄은 전날까지, 같은 묶음 새 줄) · all(전체).
--      새 칸을 안 보낸 예전 화면 · .ics 가져오기는 그 칸을 그대로 둔다. 지우기 ops_plan_remove_scope(같은 세 범위) ·
--      휴지통 ops_plan_trash · ops_plan_restore(30일) · 검색 ops_plan_search(제목 · 메모 · 장소) · 브리핑 끄기 ops_plan_prefs_set.
--   ⑤ 알림 — ops_plan_notices(일정 · 날짜 · 분 · 사람마다 한 번) · ops_plan_remind_tick(예약 ops-plan-remind 1분) ·
--      ops_plan_brief_tick(예약 ops-plan-brief 08:00 ~ 08:50 KST 10분마다 — 하루 한 번 · 일이 있을 때만). 밤 10시 ~ 아침 8시는
--      알림함에만(pushed_at). '보냈다' 표시를 먼저 넣고 그 줄만 보낸다(두 바퀴가 겹쳐도 한 번).
--   ⑥ 휴대폰 캘린더 구독(3-1 _calendar_feed_staff) — rrule 반복 · 장소(PT · 개인 일정은 빼고)도 내보낸다.
--
--   첨부(비공개 저장소)는 3-3 함께 쓰기와 같이(누가 보나가 거기서 정해진다) · 날씨는 공공데이터포털 키를 받은 뒤 · 할 일은 3-4.
--   기존 표 · 함수의 이름 · 인자 · 권한은 그대로. 새 표는 RLS 켜고 anon · authenticated 직접 읽기 · 쓰기 막음 → 함수로만.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── ① 칸 ─────────────────────────────────────────────────────────────────────────────────────
alter table public.ops_plans add column if not exists rrule text;
alter table public.ops_plans add column if not exists color text;
alter table public.ops_plans add column if not exists location text;
alter table public.ops_plans add column if not exists reminders smallint[] not null default '{}';
alter table public.ops_plans add column if not exists series_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_rrule_check') then
    alter table public.ops_plans add constraint ops_plans_rrule_check
      check (rrule is null or (char_length(rrule) <= 120 and rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[0-9A-Z,+-]+)*$'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_color_check') then
    alter table public.ops_plans add constraint ops_plans_color_check
      check (color is null or color in ('tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil',
                                        'peacock', 'blueberry', 'lavender', 'grape', 'graphite', 'mint'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_location_check') then
    alter table public.ops_plans add constraint ops_plans_location_check check (location is null or char_length(location) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_reminders_check') then
    alter table public.ops_plans add constraint ops_plans_reminders_check
      check (cardinality(reminders) <= 4 and reminders <@ '{0,5,10,15,30,60,120,1440}'::smallint[]);
  end if;
end $$;

create index if not exists ops_plans_series_idx on public.ops_plans (series_id) where series_id is not null;
create index if not exists ops_plans_trash_idx on public.ops_plans (user_id, deleted_at) where deleted_at is not null;
create index if not exists ops_plans_remind_idx on public.ops_plans (start_on) where deleted_at is null and cardinality(reminders) > 0;

comment on column public.ops_plans.rrule is '캘린더 3-2 — 반복 규칙(RFC 5545 좁힌 모양 · UNTIL 없이 · src/lib/opsRecur.ts 와 같은 글). 비고 repeat_weekdays 가 있으면 예전 매주';
comment on column public.ops_plans.reminders is '캘린더 3-2 — 시작 몇 분 전에 알림(0 · 5 · 10 · 15 · 30 · 60 · 120 · 1440, 4개까지 · 시각 일정만)';
comment on column public.ops_plans.series_id is '캘린더 3-2 — 이 일정만 / 이후 모두로 나뉜 줄의 묶음(처음 반복 줄의 id)';

-- ── 새 표 — 알림 한 번만 · 아침 브리핑 끄기 ─────────────────────────────────────────────────────
create table if not exists public.ops_plan_notices (
  kind text not null check (kind in ('remind', 'brief')),
  user_id uuid not null,
  plan_id uuid,
  occ_date date not null,
  minutes smallint,
  sent_at timestamptz not null default now(),
  constraint ops_plan_notices_once unique nulls not distinct (kind, user_id, plan_id, occ_date, minutes)
);
alter table public.ops_plan_notices enable row level security;
revoke all on public.ops_plan_notices from anon, authenticated;
comment on table public.ops_plan_notices is '캘린더 3-2 — 일정 알림(remind: 일정 · 날짜 · 분) · 아침 브리핑(brief: 사람 · 날짜) 보낸 표시 — 먼저 넣고 그 줄만 보낸다';

create table if not exists public.ops_plan_prefs (
  user_id uuid primary key,
  brief_on boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.ops_plan_prefs enable row level security;
revoke all on public.ops_plan_prefs from anon, authenticated;
comment on table public.ops_plan_prefs is '캘린더 3-2 — 「일정」 탭 사람마다 설정(아침 8시 브리핑 켬/끔, 기본 켬)';

-- ── ② 반복 규칙 ──────────────────────────────────────────────────────────────────────────────
-- 규칙 글 → {freq, interval, byday[], nth, nthwd, monthday, count, until} · 받지 않는 모양은 '반복 규칙을 다시 골라 주세요'
create or replace function public._ops_rrule_parse(_rrule text)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  c_err constant text := '반복 규칙을 다시 골라 주세요';
  c_wd constant text[] := array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  s text := upper(btrim(coalesce(_rrule, '')));
  seg text;
  m text[];
  kv jsonb := '{}'::jsonb;
  v_freq text;
  v_int int := 1;
  v_max int;
  v_days int[] := '{}';
  v_tok text;
  v_wd int;
  v_n int;
  v_until date;
  r jsonb;
begin
  if left(s, 6) = 'RRULE:' then s := substr(s, 7); end if;
  if s = '' then raise exception '%', c_err; end if;
  foreach seg in array string_to_array(s, ';') loop
    continue when seg = '';
    m := regexp_match(seg, '^([A-Z]+)=([^=;]+)$');
    if m is null or kv ? m[1] then raise exception '%', c_err; end if;
    kv := kv || jsonb_build_object(m[1], m[2]);
  end loop;
  if exists (select 1 from jsonb_object_keys(kv) k where k not in ('FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'COUNT', 'UNTIL', 'WKST')) then
    raise exception '%', c_err;
  end if;
  v_freq := kv ->> 'FREQ';
  if v_freq is null or v_freq not in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') then raise exception '%', c_err; end if;
  if kv ? 'WKST' and kv ->> 'WKST' <> 'MO' then raise exception '%', c_err; end if;
  v_max := case v_freq when 'DAILY' then 30 when 'WEEKLY' then 12 when 'MONTHLY' then 12 else 5 end;
  if kv ? 'INTERVAL' then
    if (kv ->> 'INTERVAL') !~ '^\d{1,3}$' then raise exception '%', c_err; end if;
    v_int := (kv ->> 'INTERVAL')::int;
    if v_int < 1 or v_int > v_max then raise exception '%', c_err; end if;
  end if;
  r := jsonb_build_object('freq', v_freq, 'interval', v_int, 'byday', '[]'::jsonb,
                          'nth', null, 'nthwd', null, 'monthday', null, 'count', null, 'until', null);

  if kv ? 'BYDAY' then
    if v_freq = 'WEEKLY' then
      foreach v_tok in array string_to_array(kv ->> 'BYDAY', ',') loop
        v_wd := array_position(c_wd, v_tok) - 1;
        if v_wd is null or v_wd = any (v_days) then raise exception '%', c_err; end if;
        v_days := v_days || v_wd;
      end loop;
      r := jsonb_set(r, '{byday}', (select to_jsonb(array_agg(x order by x)) from unnest(v_days) x));
    elsif v_freq = 'MONTHLY' then
      m := regexp_match(kv ->> 'BYDAY', '^([+-]?\d)(MO|TU|WE|TH|FR|SA|SU)$');
      if m is null then raise exception '%', c_err; end if;
      v_n := m[1]::int;
      if not (v_n = -1 or v_n between 1 and 5) then raise exception '%', c_err; end if;
      r := r || jsonb_build_object('nth', v_n, 'nthwd', array_position(c_wd, m[2]) - 1);
    else
      raise exception '%', c_err;
    end if;
  end if;

  if kv ? 'BYMONTHDAY' then
    if v_freq <> 'MONTHLY' or (r ->> 'nth') is not null then raise exception '%', c_err; end if;
    if (kv ->> 'BYMONTHDAY') !~ '^-?\d{1,2}$' then raise exception '%', c_err; end if;
    v_n := (kv ->> 'BYMONTHDAY')::int;
    if not (v_n = -1 or v_n between 1 and 31) then raise exception '%', c_err; end if;
    r := jsonb_set(r, '{monthday}', to_jsonb(v_n));
  end if;

  if kv ? 'COUNT' then
    if (kv ->> 'COUNT') !~ '^\d{1,3}$' then raise exception '%', c_err; end if;
    v_n := (kv ->> 'COUNT')::int;
    if v_n < 1 or v_n > 200 then raise exception '%', c_err; end if;
    r := jsonb_set(r, '{count}', to_jsonb(v_n));
  end if;

  if kv ? 'UNTIL' then
    if (r ->> 'count') is not null then raise exception '%', c_err; end if;
    m := regexp_match(kv ->> 'UNTIL', '^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?$');
    if m is null then raise exception '%', c_err; end if;
    begin
      v_until := make_date(m[1]::int, m[2]::int, m[3]::int);
    exception when others then
      raise exception '%', c_err;
    end;
    -- UTC 시각이면 한국 날짜로 (UNTIL=20261231T145959Z = 12/31 23:59:59 한국)
    if m[8] = 'Z' and m[5]::int * 60 + m[6]::int >= 900 then v_until := v_until + 1; end if;
    r := jsonb_set(r, '{until}', to_jsonb(v_until));
  end if;
  return r;
end
$$;

-- 빈 칸을 시작 날로 — 매주 요일 없음 = 시작 요일 · 매월 날 없음 = 시작 날
create or replace function public._ops_rrule_fill(r jsonb, _start date)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select case
    when r ->> 'freq' = 'WEEKLY' and jsonb_array_length(r -> 'byday') = 0
      then jsonb_set(r, '{byday}', jsonb_build_array(extract(dow from _start)::int))
    when r ->> 'freq' = 'MONTHLY' and (r ->> 'nth') is null and (r ->> 'monthday') is null
      then jsonb_set(r, '{monthday}', to_jsonb(extract(day from _start)::int))
    else r
  end
$$;

-- 저장하는 규칙 글 (UNTIL 없이 · FREQ · INTERVAL · BYDAY|BYMONTHDAY · COUNT 순서) = 화면 ruleText
create or replace function public._ops_rrule_text(r jsonb)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select concat_ws(';',
    'FREQ=' || (r ->> 'freq'),
    case when (r ->> 'interval')::int > 1 then 'INTERVAL=' || (r ->> 'interval') end,
    case when r ->> 'freq' = 'WEEKLY' and jsonb_array_length(r -> 'byday') > 0 then
      'BYDAY=' || (select string_agg(w.c, ',' order by w.o)
                     from (values (1, 'MO', 1), (2, 'TU', 2), (3, 'WE', 3), (4, 'TH', 4), (5, 'FR', 5), (6, 'SA', 6), (0, 'SU', 7)) w(d, c, o)
                    where (r -> 'byday') @> to_jsonb(w.d)) end,
    case when r ->> 'freq' = 'MONTHLY' and (r ->> 'nth') is not null
      then 'BYDAY=' || (r ->> 'nth') || (array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])[(r ->> 'nthwd')::int + 1] end,
    case when r ->> 'freq' = 'MONTHLY' and (r ->> 'monthday') is not null then 'BYMONTHDAY=' || (r ->> 'monthday') end,
    case when (r ->> 'count') is not null then 'COUNT=' || (r ->> 'count') end)
$$;

-- 그날이 규칙 모양에 맞나 (끝 · 빼는 날 · 횟수는 안 봄) · 간격은 _anchor(시작 날)가 든 날 · 주(월요일 시작) · 달 · 해부터
create or replace function public._ops_recur_match(r jsonb, _anchor date, _d date)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select case
    when _d < _anchor then false
    when r ->> 'freq' = 'DAILY' then (_d - _anchor) % (r ->> 'interval')::int = 0
    when r ->> 'freq' = 'WEEKLY' then
      (r -> 'byday') @> to_jsonb(extract(dow from _d)::int)
      and (((_d - (extract(isodow from _d)::int - 1)) - (_anchor - (extract(isodow from _anchor)::int - 1))) / 7) % (r ->> 'interval')::int = 0
    when r ->> 'freq' = 'MONTHLY' then
      ((extract(year from _d)::int * 12 + extract(month from _d)::int)
        - (extract(year from _anchor)::int * 12 + extract(month from _anchor)::int)) % (r ->> 'interval')::int = 0
      and case
        when (r ->> 'monthday') is not null then
          extract(day from _d)::int = case when (r ->> 'monthday')::int = -1
                                           then extract(day from (date_trunc('month', _d) + interval '1 month - 1 day'))::int
                                           else (r ->> 'monthday')::int end
        when (r ->> 'nth') is not null then
          extract(dow from _d)::int = (r ->> 'nthwd')::int
          and case when (r ->> 'nth')::int = -1
                   then extract(day from _d)::int > extract(day from (date_trunc('month', _d) + interval '1 month - 1 day'))::int - 7
                   else ceil(extract(day from _d)::numeric / 7)::int = (r ->> 'nth')::int end
        else false
      end
    when r ->> 'freq' = 'YEARLY' then
      (extract(year from _d)::int - extract(year from _anchor)::int) % (r ->> 'interval')::int = 0
      and extract(month from _d) = extract(month from _anchor)
      and extract(day from _d) = extract(day from _anchor)
    else false
  end
$$;

-- 시작 날부터 규칙에 맞는 첫날 (10년 안 · 없으면 null)
create or replace function public._ops_recur_first(r jsonb, _start date)
returns date
language plpgsql
immutable
set search_path to 'public'
as $$
declare i int;
begin
  for i in 0..3653 loop
    if public._ops_recur_match(r, _start, _start + i) then return _start + i; end if;
  end loop;
  return null;
end
$$;

-- COUNT 번째 날 (첫날부터 · 빼는 날 세기 전 · 10년 안에 못 채우면 null)
create or replace function public._ops_recur_until(r jsonb, _first date)
returns date
language plpgsql
immutable
set search_path to 'public'
as $$
declare i int; n int := 0; c int := (r ->> 'count')::int;
begin
  if c is null then return null; end if;
  for i in 0..3653 loop
    if public._ops_recur_match(r, _first, _first + i) then
      n := n + 1;
      if n = c then return _first + i; end if;
    end if;
  end loop;
  return null;
end
$$;

-- 일정의 규칙 — rrule 이 있으면 그것 · 없으면 예전 매주 요일들 · 둘 다 없으면 null(한 번 하는 일정)
create or replace function public._ops_plan_rule(_rrule text, _days smallint[], _start date)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
begin
  if nullif(btrim(coalesce(_rrule, '')), '') is not null then
    return public._ops_rrule_fill(public._ops_rrule_parse(_rrule), _start);
  end if;
  if cardinality(_days) > 0 then
    return jsonb_build_object('freq', 'WEEKLY', 'interval', 1,
                              'byday', (select to_jsonb(array_agg(distinct x::int order by x::int)) from unnest(_days) x),
                              'nth', null, 'nthwd', null, 'monthday', null, 'count', null, 'until', null);
  end if;
  return null;
end
$$;

-- 그날 이 일정이 있나 = 화면 occursOnRule (COUNT 는 저장 때 계산한 until_on 으로)
create or replace function public._ops_plan_on(p public.ops_plans, _d date)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $$
declare r jsonb := public._ops_plan_rule(p.rrule, p.repeat_weekdays, p.start_on);
begin
  if r is null then return _d between p.start_on and p.end_on; end if;
  if _d < p.start_on then return false; end if;
  if p.until_on is not null and _d > p.until_on then return false; end if;
  if _d = any (p.skip_dates) then return false; end if;
  return public._ops_recur_match(r, p.start_on, _d);
end
$$;

-- ── ③ 읽기 ───────────────────────────────────────────────────────────────────────────────────
-- 일정 한 줄 (보는 사람 기준 — 남의 '시간만 보이기' 개인 일정은 제목 · 메모 · 장소 없이, 알림은 내 것만)
create or replace function public._ops_plan_json(pl public.ops_plans, _viewer uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
    'title', case when pl.user_id = _viewer or not pl.private then pl.title end,
    'memo', case when pl.user_id = _viewer or not pl.private then pl.memo end,
    'location', case when pl.user_id = _viewer or not pl.private then pl.location end,
    'masked', pl.private and pl.user_id <> _viewer, 'private', pl.private,
    'start_on', pl.start_on, 'end_on', pl.end_on,
    'repeat_weekdays', to_jsonb(pl.repeat_weekdays), 'until_on', pl.until_on, 'skip_dates', to_jsonb(pl.skip_dates),
    'rrule', pl.rrule, 'color', pl.color,
    'reminders', case when pl.user_id = _viewer then to_jsonb(pl.reminders) else '[]'::jsonb end,
    'series_id', pl.series_id,
    'all_day', pl.all_day,
    'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI'),
    'mine', pl.user_id = _viewer, 'updated_at', pl.updated_at)
$$;

-- 회원 생일 — 「오늘 만날 회원」과 같은 사람들(그 지점 승인된 회원 · 코치진 · 체험 · 합쳐진 계정 빼고) 중
-- 수강권이 끝난 지 7일 안이거나 최근 30일 안에 온 분 · 평년 2/29 생일은 2/28 에
create or replace function public._ops_plan_birthdays(_branch text, _from date, _to date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with days as (
    select d::date as d, to_char(d, 'MM-DD') as mmdd,
           extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int as last_day
      from generate_series(_from, _to, interval '1 day') d
  ), recent as (
    select distinct a.user_id from public.attendance_logs a
     where a.branch_name = _branch and a.user_id is not null and a.checked_in_at >= now() - interval '30 days'
  ), mem as (
    select p.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') as name,
           public._birth_mmdd(p.birth_date) as mmdd
      from public.profiles p
     where p.branch_name = _branch
       and nullif(btrim(coalesce(p.birth_date, '')), '') is not null
       and coalesce(p.is_approved, false) and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and (p.membership_end >= (now() at time zone 'Asia/Seoul')::date - 7 or p.user_id in (select r.user_id from recent r))
       and not exists (select 1 from public.user_roles ur
                        where ur.user_id = p.user_id and ur.role::text in ('coach', 'branch_manager', 'admin', 'super_admin'))
  )
  select coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'user_id', x.user_id, 'name', x.name) order by x.d, x.name), '[]'::jsonb)
    from (
      select days.d, mem.user_id, mem.name
        from days join mem
          on mem.mmdd = days.mmdd or (mem.mmdd = '02-29' and days.mmdd = '02-28' and days.last_day = 28)
       order by days.d, mem.name
       limit 300
    ) x
$$;

-- 「일정」 탭 모든 보기의 읽기 — 시작 ~ 끝(400일까지). 코치님은 본인 것만 · 대표님 · 그 지점 관리자는 팀 전체
create or replace function public.ops_plans_range(p_branch text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Seoul')::date);
  v_to date := coalesce(p_to, coalesce(p_from, (now() at time zone 'Asia/Seoul')::date) + 6);
  v_all boolean;
  v_staff boolean;
  v_branches jsonb;
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_to < v_from then raise exception '날짜를 다시 골라 주세요'; end if;
  if v_to > v_from + 400 then v_to := v_from + 400; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches from public._ops_plan_branches(v_uid) b;
  if jsonb_array_length(v_branches) = 0 then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e ->> 'branch' = v_branch) then
    v_branch := coalesce(
      (select e ->> 'branch' from jsonb_array_elements(v_branches) e
        where e ->> 'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches -> 0 ->> 'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  v_staff := v_all or exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_uid);

  if v_all then
    select coalesce(array_agg(distinct u), '{}') into v_ids from (
      select t.user_id as u from public._ops_plan_team(v_branch) t
      union
      select pl.user_id from public.ops_plans pl
       where pl.branch_name = v_branch and pl.deleted_at is null and pl.start_on <= v_to
         and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)
    ) z;
  else
    v_ids := array[v_uid];
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'hq', public._strategy_hq(v_uid),
    'me', v_uid,
    'from', v_from,
    'to', v_to,
    'today', v_today,
    'now_hm', to_char(now() at time zone 'Asia/Seoul', 'HH24:MI'),
    'members', coalesce((
      select jsonb_agg(m.j order by m.rank, m.j ->> 'name')
        from (
          select jsonb_build_object('key', u::text, 'user_id', u,
                                    'name', coalesce(d ->> 'name', '코치'), 'title', coalesce(d ->> 'title', '코치'),
                                    'me', u = v_uid, 'no_app', false) as j,
                 case when d ->> 'title' = '대표' then 0 when d ->> 'title' in ('지점장', '관장') then 1 else 2 end as rank
            from (select u, public._strategy_display(u) as d from unnest(v_ids) as u) dd
          union all
          select jsonb_build_object('key', 'staff:' || s.id, 'user_id', null, 'name', s.name, 'title', '근무자',
                                    'me', false, 'no_app', true), 3
            from public.ops_staff s
           where v_all and s.branch_name = v_branch and s.active and s.user_id is null
        ) m), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(public._ops_plan_json(pl, v_uid) order by pl.start_on, pl.start_time nulls first)
        from public.ops_plans pl
       where pl.deleted_at is null and pl.user_id = any (v_ids) and pl.start_on <= v_to
         and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name, 'weekday', r.weekday,
               'start_time', to_char(r.start_time, 'HH24:MI'), 'end_time', to_char(r.end_time, 'HH24:MI'),
               'valid_from', r.valid_from, 'valid_to', r.valid_to, 'staff_start', s.start_date, 'staff_end', s.end_date)
             order by r.weekday, r.start_time)
        from public.ops_shift_rules r join public.ops_staff s on s.id = r.staff_id
       where s.active
         and (s.user_id = any (v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))
         and r.valid_from <= v_to and (r.valid_to is null or r.valid_to >= v_from)), '[]'::jsonb),
    'offs', coalesce((
      select jsonb_agg(jsonb_build_object('key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name,
                                          'date', e.work_date) order by e.work_date)
        from public.ops_day_entries e join public.ops_staff s on s.id = e.staff_id
       where e.kind = 'off' and e.status = 'approved' and e.work_date between v_from and v_to
         and (s.user_id = any (v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r.j order by r.at desc)
        from (
          select jsonb_build_object(
                   'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
                   'title', case when not pl.private then pl.title end,
                   'action', case when pl.deleted_at is not null then 'removed'
                                  when pl.updated_at > pl.created_at + interval '1 minute' then 'edit' else 'new' end,
                   'at', greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)),
                   'start_on', pl.start_on, 'end_on', pl.end_on, 'repeat_weekdays', to_jsonb(pl.repeat_weekdays),
                   'rrule', pl.rrule, 'until_on', pl.until_on,
                   'all_day', pl.all_day,
                   'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI')) as j,
                 greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) as at
            from public.ops_plans pl
           where v_all and pl.user_id = any (v_ids) and pl.user_id <> v_uid
             and greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) > now() - interval '7 days'
           order by 2 desc
           limit 8
        ) r), '[]'::jsonb),
    'prefs', jsonb_build_object('brief_on', coalesce((select pp.brief_on from public.ops_plan_prefs pp where pp.user_id = v_uid), true)),
    'birthdays', case when v_staff and v_to - v_from <= 62 then public._ops_plan_birthdays(v_branch, v_from, v_to) else '[]'::jsonb end);
end
$$;

-- 한 주(월~일) — 예전 이름 그대로 (주 보기 · 예전 화면 · .ics 가져오기)
create or replace function public.ops_plans_week(p_branch text, p_from date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_from date := coalesce(p_from, (now() at time zone 'Asia/Seoul')::date);
begin
  v_from := v_from - (extract(isodow from v_from)::int - 1);
  return public.ops_plans_range(p_branch, v_from, v_from + 6);
end
$$;

-- ── ④ 저장 · 지우기 · 휴지통 · 검색 · 설정 ───────────────────────────────────────────────────────
create or replace function public.ops_plan_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_only date := nullif(p ->> 'only_date', '')::date;
  v_scope text := coalesce(nullif(p ->> 'scope', ''), case when nullif(p ->> 'only_date', '') is not null then 'one' else 'all' end);
  v_row public.ops_plans%rowtype;
  v_branch text := nullif(btrim(coalesce(p ->> 'branch', '')), '');
  v_kind text := p ->> 'kind';
  v_title text := nullif(btrim(coalesce(p ->> 'title', '')), '');
  v_memo text := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_start date := nullif(p ->> 'start_on', '')::date;
  v_end date := nullif(p ->> 'end_on', '')::date;
  v_days smallint[];
  v_until date := nullif(p ->> 'until_on', '')::date;
  v_all_day boolean := coalesce((p ->> 'all_day')::boolean, false);
  v_st time := nullif(p ->> 'start_time', '')::time;
  v_et time := nullif(p ->> 'end_time', '')::time;
  v_private boolean := coalesce((p ->> 'private')::boolean, false);
  v_rule_in text;
  v_r jsonb;
  v_rrule text;
  v_color text;
  v_loc text;
  v_rem smallint[];
  v_series uuid;
  v_skip date[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '바꿀 범위를 다시 골라 주세요'; end if;
  if v_kind is null or v_kind not in ('class', 'pt', 'work', 'out', 'off', 'personal') then raise exception '일정 종류를 골라 주세요'; end if;
  if v_start is null then raise exception '날짜를 골라 주세요'; end if;
  if v_start < v_today - 62 or v_start > v_today + 400 then raise exception '날짜를 다시 골라 주세요'; end if;
  if char_length(coalesce(v_title, '')) > 40 then raise exception '제목은 40자까지예요'; end if;
  if char_length(coalesce(v_memo, '')) > 300 then raise exception '메모는 300자까지예요'; end if;

  -- 고칠 일정 — 새 칸(색 · 장소 · 알림)을 안 보낸 예전 화면은 그 칸을 그대로 둔다
  if v_id is not null then
    select * into v_row from public.ops_plans where id = v_id and deleted_at is null for update;
    if not found then raise exception '일정을 찾을 수 없어요'; end if;
    if v_row.user_id <> v_uid then raise exception '내 일정만 고칠 수 있어요'; end if;
    v_branch := coalesce(v_branch, v_row.branch_name);
  end if;
  if v_id is null or v_only is null then v_scope := 'all'; end if;

  v_color := case when p ? 'color' then nullif(btrim(coalesce(p ->> 'color', '')), '') else v_row.color end;
  if v_color is not null and v_color not in ('tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil',
                                            'peacock', 'blueberry', 'lavender', 'grape', 'graphite', 'mint') then
    raise exception '색을 다시 골라 주세요';
  end if;
  v_loc := case when p ? 'location' then nullif(btrim(coalesce(p ->> 'location', '')), '') else v_row.location end;
  if char_length(coalesce(v_loc, '')) > 80 then raise exception '장소는 80자까지예요'; end if;
  if p ? 'reminders' then
    if jsonb_typeof(p -> 'reminders') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'reminders') x where x !~ '^\d{1,4}$') then
      raise exception '알림을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v_rem from jsonb_array_elements_text(p -> 'reminders') x;
  else
    v_rem := coalesce(v_row.reminders, '{}');
  end if;

  -- 반복 규칙 — rrule 이 오면 그것 · 없으면 예전 요일들(매주) · '이 일정만'은 한 번 하는 일정
  select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
    from jsonb_array_elements_text(case when jsonb_typeof(p -> 'repeat_weekdays') = 'array' then p -> 'repeat_weekdays' else '[]'::jsonb end) d
   where d ~ '^[0-6]$';
  v_rule_in := case when p ? 'rrule' then nullif(btrim(coalesce(p ->> 'rrule', '')), '') end;
  if v_rule_in is null and cardinality(v_days) > 0 then
    v_rule_in := 'FREQ=WEEKLY;BYDAY=' || (select string_agg((array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])[d + 1], ',' order by (d + 6) % 7)
                                            from unnest(v_days) d);
  end if;
  if v_scope = 'one' then v_rule_in := null; end if;

  if v_rule_in is not null then
    v_r := public._ops_rrule_fill(public._ops_rrule_parse(v_rule_in), v_start);
    if v_until is null and (v_r ->> 'until') is not null then v_until := (v_r ->> 'until')::date; end if;
    v_r := jsonb_set(v_r, '{until}', 'null'::jsonb);
    v_start := public._ops_recur_first(v_r, v_start);
    if v_start is null then raise exception '이 반복으로는 잡히는 날이 없어요'; end if;
    v_end := v_start;
    if (v_r ->> 'count') is not null then
      v_until := public._ops_recur_until(v_r, v_start);
      if v_until is null then raise exception '반복 횟수를 줄여 주세요 — 10년 안에서 반복해요'; end if;
    end if;
    if v_until is not null and v_until < v_start then raise exception '반복이 끝나는 날이 시작보다 빨라요'; end if;
    v_rrule := public._ops_rrule_text(v_r);
    v_days := case when v_r ->> 'freq' = 'WEEKLY'
                   then (select array_agg(x::smallint order by x::smallint) from jsonb_array_elements_text(v_r -> 'byday') x)
                   else '{}' end;
  else
    v_rrule := null;
    v_days := '{}';
    v_until := null;
    v_end := coalesce(v_end, v_start);
    if v_end < v_start then raise exception '끝나는 날이 시작보다 빨라요'; end if;
    if v_end > v_start + 62 then raise exception '여러 날 일정은 두 달까지예요'; end if;
  end if;

  if v_all_day then
    v_st := null; v_et := null; v_rem := '{}';
  elsif v_st is null or v_et is null or v_et <= v_st then
    raise exception '시작 · 끝 시각을 확인해 주세요';
  end if;
  if cardinality(v_rem) > 4 or not (v_rem <@ '{0,5,10,15,30,60,120,1440}'::smallint[]) then raise exception '알림을 다시 골라 주세요'; end if;
  if v_kind <> 'personal' then v_private := false; end if;

  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch and (b.mine or b.manage)) then
    raise exception '이 지점에는 일정을 넣을 수 없어요';
  end if;

  if v_id is not null and v_scope = 'one' then
    -- 이 일정만 — 반복에서 그날을 빼고, 같은 묶음으로 한 번 하는 일정을 새로
    if v_row.rrule is null and cardinality(v_row.repeat_weekdays) = 0 then raise exception '반복 일정만 하루씩 바꿀 수 있어요'; end if;
    if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
    update public.ops_plans
       set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || v_only) x), updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_id := null;
  elsif v_id is not null and v_scope = 'following'
        and (v_row.rrule is not null or cardinality(v_row.repeat_weekdays) > 0) and v_only > v_row.start_on then
    -- 이후 모두 — 원래 반복은 그 전날까지(횟수는 풀고 끝나는 날로), 같은 묶음으로 새 반복
    update public.ops_plans
       set until_on = least(coalesce(until_on, 'infinity'::date), v_only - 1),
           rrule = case when rrule is null then null else regexp_replace(rrule, ';COUNT=\d+', '') end,
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < v_only), '{}'),
           updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_skip := coalesce((select array_agg(x order by x) from unnest(v_row.skip_dates) x where x >= v_start), '{}');
    v_id := null;
  end if;

  if v_id is null then
    if (select count(*) from public.ops_plans
         where user_id = v_uid and deleted_at is null
           and (case when rrule is null and cardinality(repeat_weekdays) = 0 then end_on else coalesce(until_on, 'infinity'::date) end) >= v_today) >= 300 then
      raise exception '앞으로 잡힌 일정이 너무 많아요 — 지난 일정은 지워 주세요';
    end if;
    insert into public.ops_plans (branch_name, user_id, kind, title, memo, start_on, end_on, repeat_weekdays, until_on, skip_dates,
                                  all_day, start_time, end_time, private, created_by, rrule, color, location, reminders, series_id)
    values (v_branch, v_uid, v_kind, v_title, v_memo, v_start, v_end, v_days, v_until,
            case when v_rrule is not null then coalesce(v_skip, '{}') else '{}' end,
            v_all_day, v_st, v_et, v_private, v_uid, v_rrule, v_color, v_loc, v_rem, v_series)
    returning id into v_id;
  else
    update public.ops_plans
       set branch_name = v_branch, kind = v_kind, title = v_title, memo = v_memo,
           start_on = v_start, end_on = v_end, repeat_weekdays = v_days, until_on = v_until, rrule = v_rrule,
           skip_dates = case when v_rrule is not null
                             then coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x >= v_start), '{}')
                             else '{}' end,
           all_day = v_all_day, start_time = v_st, end_time = v_et, private = v_private,
           color = v_color, location = v_loc, reminders = v_rem, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end
$$;

-- 반복에서 그날 하나만 빼기 — 매월 · 매년 반복도
create or replace function public.ops_plan_skip(p_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_row public.ops_plans%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_row from public.ops_plans where id = p_id and deleted_at is null for update;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;
  if v_row.user_id <> v_uid then raise exception '내 일정만 고칠 수 있어요'; end if;
  if v_row.rrule is null and cardinality(v_row.repeat_weekdays) = 0 then raise exception '반복 일정만 하루씩 뺄 수 있어요'; end if;
  if p_date is null or p_date < v_row.start_on then raise exception '날짜를 다시 골라 주세요'; end if;
  if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
  update public.ops_plans
     set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || p_date) x), updated_at = now()
   where id = p_id;
end
$$;

-- 지우기 세 범위 — one = 그날만 빼기 · following = 그 전날까지 · all = 휴지통으로(같은 묶음 — 이 날만 바꾼 일정 · 나눈 반복 함께)
create or replace function public.ops_plan_remove_scope(p_id uuid, p_scope text, p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ops_plans%rowtype;
  v_scope text := coalesce(nullif(p_scope, ''), 'all');
  v_rep boolean;
  v_key uuid;
  v_n int;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '지울 범위를 다시 골라 주세요'; end if;
  select * into v_row from public.ops_plans where id = p_id and deleted_at is null for update;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;
  if v_row.user_id <> v_uid then raise exception '내 일정만 지울 수 있어요'; end if;
  v_rep := v_row.rrule is not null or cardinality(v_row.repeat_weekdays) > 0;
  if v_rep and v_scope = 'one' then
    perform public.ops_plan_skip(p_id, p_date);
    return 1;
  end if;
  if v_rep and v_scope = 'following' and p_date is not null and p_date > v_row.start_on then
    update public.ops_plans
       set until_on = least(coalesce(until_on, 'infinity'::date), p_date - 1),
           rrule = case when rrule is null then null else regexp_replace(rrule, ';COUNT=\d+', '') end,
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < p_date), '{}'),
           updated_at = now()
     where id = p_id;
    return 1;
  end if;
  v_key := coalesce(v_row.series_id, v_row.id);
  update public.ops_plans
     set deleted_at = now(), updated_at = now()
   where user_id = v_uid and deleted_at is null
     and (id = p_id or (v_rep and (id = v_key or series_id = v_key)));
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- 휴지통 — 지운 지 30일 안 (최근 60개)
create or replace function public.ops_plan_trash()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.at desc)
      from (select public._ops_plan_json(t, v_uid) || jsonb_build_object('deleted_at', t.deleted_at) as j, t.deleted_at as at
              from public.ops_plans t
             where t.user_id = v_uid and t.deleted_at is not null and t.deleted_at > now() - interval '30 days'
             order by t.deleted_at desc
             limit 60) x), '[]'::jsonb);
end
$$;

-- 되살리기 — 같이 지운 묶음(5초 안)도 함께
create or replace function public.ops_plan_restore(p_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_row public.ops_plans%rowtype; v_key uuid; v_n int;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_row from public.ops_plans where id = p_id and user_id = v_uid and deleted_at is not null for update;
  if not found then raise exception '되살릴 일정을 찾을 수 없어요'; end if;
  if v_row.deleted_at <= now() - interval '30 days' then raise exception '30일이 지난 일정은 되살릴 수 없어요'; end if;
  v_key := coalesce(v_row.series_id, v_row.id);
  update public.ops_plans
     set deleted_at = null, updated_at = now()
   where user_id = v_uid and deleted_at is not null
     and (id = p_id
          or ((id = v_key or series_id = v_key)
              and deleted_at between v_row.deleted_at - interval '5 seconds' and v_row.deleted_at + interval '5 seconds'));
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- 검색 — 내 일정 + (대표님 · 그 지점 관리자) 그 지점 팀의 공개 일정 · 제목 · 메모 · 장소 · 50개까지
create or replace function public.ops_plan_search(p_q text, p_branch text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := left(btrim(coalesce(p_q, '')), 40);
  v_like text;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_all boolean := false;
  v_ids uuid[] := '{}';
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public._ops_plan_branches(v_uid)) then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_q = '' then return '[]'::jsonb; end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_branch is not null and public._ops_plan_can_view_all(v_uid, v_branch)
     and exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch) then
    v_all := true;
    select coalesce(array_agg(t.user_id), '{}') into v_ids from public._ops_plan_team(v_branch) t;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.at desc)
      from (select public._ops_plan_json(s, v_uid) as j, s.start_on as at
              from public.ops_plans s
             where s.deleted_at is null
               and (s.user_id = v_uid or (v_all and s.branch_name = v_branch and s.user_id = any (v_ids) and not s.private))
               and (s.title ilike v_like or s.memo ilike v_like or s.location ilike v_like)
             order by s.start_on desc
             limit 50) x), '[]'::jsonb);
end
$$;

-- 아침 브리핑 켜기 · 끄기 (사람마다)
create or replace function public.ops_plan_prefs_set(p_brief boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public._ops_plan_branches(v_uid)) then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  insert into public.ops_plan_prefs (user_id, brief_on, updated_at) values (v_uid, coalesce(p_brief, true), now())
  on conflict (user_id) do update set brief_on = excluded.brief_on, updated_at = now();
  return jsonb_build_object('brief_on', coalesce(p_brief, true));
end
$$;

-- ── ⑤ 알림 ───────────────────────────────────────────────────────────────────────────────────
create or replace function public._ops_plan_kind_label(_kind text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case _kind when 'class' then '수업' when 'pt' then 'PT' when 'work' then '업무' when 'out' then '외부'
                    when 'off' then '휴무' when 'personal' then '개인 일정' else '일정' end
$$;

-- 매분 — 시작 n분 전 알림 (사람 · 일정 · 날짜 · 분마다 한 번 · 10분 안에 못 보낸 것은 버림 · 밤 10시 ~ 아침 8시는 알림함에만)
--   p_at = 한국 시각을 정해 돌리기(시험 · 다시 돌리기 — 서버 키만 부른다), 비우면 지금
create or replace function public.ops_plan_remind_tick(p_at timestamp default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_local timestamp := coalesce(p_at, now() at time zone 'Asia/Seoul');
  v_today date := coalesce(p_at, now() at time zone 'Asia/Seoul')::date;
  v_hm int := extract(hour from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int * 60
              + extract(minute from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int;
  v_quiet boolean;
  v_n int := 0;
begin
  v_quiet := v_hm < 480 or v_hm >= 1320;
  with cand as (
    select pl.id, pl.user_id, pl.branch_name, pl.kind, pl.title, pl.location, pl.start_time, pl.end_time,
           d.d::date as occ, m.m as mins, (d.d::date + pl.start_time) as occ_at
      from public.ops_plans pl
     cross join generate_series(v_today, v_today + 1, interval '1 day') d(d)
     cross join lateral unnest(pl.reminders) m(m)
     where pl.deleted_at is null and not pl.all_day and cardinality(pl.reminders) > 0
       and pl.start_on <= v_today + 1
       and public._ops_plan_on(pl, d.d::date)
  ), due as (
    select c.* from cand c
     where c.occ_at - make_interval(mins => c.mins) <= v_local
       and c.occ_at - make_interval(mins => c.mins) > v_local - interval '10 minutes'
       and c.occ_at >= v_local - interval '1 minute'
       and exists (select 1 from public._ops_plan_branches(c.user_id) b where b.branch_name = c.branch_name)
  ), ins as (
    insert into public.ops_plan_notices (kind, user_id, plan_id, occ_date, minutes)
    select 'remind', due.user_id, due.id, due.occ, due.mins from due
    on conflict do nothing
    returning user_id, plan_id, occ_date, minutes
  )
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select due.user_id,
         '⏰ ' || coalesce(nullif(btrim(due.title), ''), public._ops_plan_kind_label(due.kind)) || ' · ' ||
           case when v_local - (due.occ_at - make_interval(mins => due.mins)) > interval '2 minutes'
                then case when due.occ_at - v_local <= interval '1 minute' then '곧 시작해요'
                          else ceil(extract(epoch from (due.occ_at - v_local)) / 60)::int || '분 뒤' end
                else case due.mins when 0 then '지금 시작해요' when 60 then '1시간 전' when 120 then '2시간 전'
                                   when 1440 then '내일 ' || to_char(due.start_time, 'HH24:MI')
                                   else due.mins || '분 전' end
           end,
         to_char(due.start_time, 'HH24:MI') || '~' || to_char(due.end_time, 'HH24:MI')
           || coalesce(' · ' || nullif(btrim(due.location), ''), ''),
         '/office?tab=plan&d=' || to_char(due.occ, 'YYYY-MM-DD'),
         case when v_quiet then v_now end
    from ins
    join due on due.user_id = ins.user_id and due.id = ins.plan_id and due.occ = ins.occ_date and due.mins = ins.minutes;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n, 'quiet', v_quiet, 'at', to_char(v_local, 'HH24:MI'));
end
$$;

-- 아침 8시 — 그날 수업 · PT · 업무 · 외부 · (운동 약속을 켠 지점에서 근무하는 날) 약속한 회원이 하나라도 있을 때만 한 통
--   08:00 ~ 08:59 에만 · 사람마다 하루 한 번 · p_at = 한국 시각을 정해 돌리기(시험 — 서버 키만 부른다)
create or replace function public.ops_plan_brief_tick(p_at timestamp default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today date := coalesce(p_at, now() at time zone 'Asia/Seoul')::date;
  v_hm int := extract(hour from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int * 60
              + extract(minute from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int;
  v_dow int := extract(dow from coalesce(p_at, now() at time zone 'Asia/Seoul')::date)::int;
  v_n int := 0;
begin
  if v_hm < 480 or v_hm >= 540 then return jsonb_build_object('sent', 0, 'skip', 'time'); end if;
  with plans as (
    select pl.user_id, pl.kind, pl.start_time, pl.all_day
      from public.ops_plans pl
     where pl.deleted_at is null and pl.kind in ('class', 'pt', 'work', 'out')
       and pl.start_on <= v_today
       and (pl.end_on >= v_today or pl.rrule is not null or cardinality(pl.repeat_weekdays) > 0)
       and public._ops_plan_on(pl, v_today)
  ), working as (
    select distinct s.user_id, s.branch_name
      from public.ops_staff s
     cross join lateral public._ops_duty_segments(s.id, v_today) g
     where s.active and s.user_id is not null
  ), meet as (
    select mp.branch_name, count(*)::int as n
      from public.member_promises mp
     where mp.stopped_at is null and v_dow = any (mp.weekdays) and mp.started_on <= v_today
       and public._promise_branch_on(mp.branch_name) and not public._cal_closed_on(mp.branch_name, v_today)
       and public._promise_member(mp.user_id) is not null
     group by mp.branch_name
  ), meet_staff as (
    select w.user_id, sum(m.n)::int as n from working w join meet m on m.branch_name = w.branch_name group by w.user_id
  ), people as (
    select user_id from plans union select user_id from meet_staff
  ), rows as (
    select u.user_id,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'class')::int as c_class,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'pt')::int as c_pt,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'work')::int as c_work,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'out')::int as c_out,
           (select min(x.start_time) from plans x where x.user_id = u.user_id and not x.all_day) as first_at,
           coalesce((select ms.n from meet_staff ms where ms.user_id = u.user_id), 0) as c_meet
      from people u
     where coalesce((select pp.brief_on from public.ops_plan_prefs pp where pp.user_id = u.user_id), true)
       and exists (select 1 from public._ops_plan_branches(u.user_id))
  ), ins as (
    insert into public.ops_plan_notices (kind, user_id, plan_id, occ_date, minutes)
    select 'brief', r.user_id, null, v_today, null from rows r
     where r.c_class + r.c_pt + r.c_work + r.c_out + r.c_meet > 0
    on conflict do nothing
    returning user_id
  )
  insert into public.notifications (user_id, title, body, link)
  select r.user_id,
         '📅 오늘 일정',
         concat_ws(' · ',
           case when r.c_class > 0 then '수업 ' || r.c_class end,
           case when r.c_pt > 0 then 'PT ' || r.c_pt end,
           case when r.c_work > 0 then '업무 ' || r.c_work end,
           case when r.c_out > 0 then '외부 ' || r.c_out end,
           case when r.c_meet > 0 then '약속한 회원 ' || r.c_meet || '명' end,
           case when r.first_at is not null then '첫 일정 ' || to_char(r.first_at, 'HH24:MI') end),
         '/office?tab=plan&d=' || to_char(v_today, 'YYYY-MM-DD')
    from rows r join ins on ins.user_id = r.user_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n);
end
$$;

-- ── ⑥ 휴대폰 캘린더 구독(3-1) — rrule 반복 · 장소(PT · 개인 일정은 빼고) ─────────────────────────────
create or replace function public._calendar_feed_staff(_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branches text[];
  v_multi boolean;
  v_plans jsonb;
  v_shifts jsonb;
  v_events jsonb;
  v_meetings jsonb;
begin
  select coalesce(array_agg(distinct b.branch_name), '{}') into v_branches from public._ops_plan_branches(_uid) b;
  v_multi := cardinality(v_branches) > 1;

  -- ① 내 일정 — 반복은 rrule(3-2 · 횟수는 계산해 둔 끝나는 날로) 또는 예전 매주 · 이 날만 빼기 = EXDATE ·
  --    여러 날 시각 일정은 날마다 같은 시각 · PT 는 이름 없이 · 개인 일정은 제목 없이 · 장소는 PT · 개인 일정만 빼고
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'plan-' || p.id,
           'title', case p.kind
                      when 'pt' then 'PT 수업'
                      when 'personal' then '개인 일정'
                      else (case p.kind when 'class' then '수업' when 'work' then '업무' when 'out' then '외부' when 'off' then '휴무' else '일정' end)
                           || coalesce(' · ' || nullif(btrim(p.title), ''), '')
                    end,
           'day', p.start_on,
           'end_day', p.end_on,
           'start', case when p.all_day then null else to_char(p.start_time, 'HH24:MI') end,
           'end', case when p.all_day then null else to_char(p.end_time, 'HH24:MI') end,
           'weekly', case when p.rrule is null and cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.repeat_weekdays) end,
           'rrule', case when p.rrule is not null then regexp_replace(p.rrule, ';COUNT=\d+', '') end,
           'until', p.until_on,
           'exdates', case when p.rrule is not null or cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.skip_dates) else '[]'::jsonb end,
           'location', case when p.kind in ('pt', 'personal') then null else nullif(btrim(p.location), '') end,
           'busy', not p.all_day and p.kind <> 'off',
           'updated', p.updated_at)
         order by p.start_on, p.created_at), '[]'::jsonb)
    into v_plans
    from public.ops_plans p
   where p.user_id = _uid and p.deleted_at is null
     and p.start_on <= v_today + 365
     and case when p.rrule is not null or cardinality(p.repeat_weekdays) > 0 then coalesce(p.until_on, v_today) >= v_today - 30
              else p.end_on >= v_today - 30 end;

  -- ② 「근무」 시간표 — 지난 7일 ~ 앞 60일 (쉰 날 · 대타 넘김/받음은 _ops_duty_segments 가 이미 반영)
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'shift-' || s.id || '-' || to_char(d.d, 'YYYYMMDD') || '-' || to_char(g.start_time, 'HH24MI'),
           'title', '근무' || case when v_multi then coalesce(' · ' || public._calendar_feed_short(s.branch_name), '') else '' end,
           'day', d.d::date,
           'end_day', d.d::date,
           'start', to_char(g.start_time, 'HH24:MI'),
           'end', to_char(g.end_time, 'HH24:MI'),
           'busy', true,
           'location', s.branch_name)
         order by d.d, g.start_time), '[]'::jsonb)
    into v_shifts
    from public.ops_staff s
   cross join generate_series(v_today - 7, v_today + 60, interval '1 day') d(d)
   cross join lateral public._ops_duty_segments(s.id, d.d::date) g
   where s.user_id = _uid and s.active and g.end_time > g.start_time;

  -- ③ 153 일정 — 「일정」 탭을 쓰는 지점들 (코치진은 승급 심사도)
  v_events := public._calendar_feed_branch_events(v_branches, true, v_today - 30, v_today + 365, v_multi);

  -- ④ 사무실 정기 회의 — 지점 회의실을 쓰는 분 (매주 · 한 번 · 다음 한 번 쉬기 = EXDATE) · 길이는 1시간으로
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'meeting-' || o.id,
           'title', '회의 · ' || coalesce(nullif(btrim(o.title), ''), '정기 회의'),
           'day', case when cardinality(o.weekdays) > 0 then greatest((o.created_at at time zone 'Asia/Seoul')::date, v_today - 30) else o.once_on end,
           'end_day', case when cardinality(o.weekdays) > 0 then greatest((o.created_at at time zone 'Asia/Seoul')::date, v_today - 30) else o.once_on end,
           'start', to_char(o.at_time, 'HH24:MI'),
           'end', to_char(case when o.at_time >= time '23:00' then time '23:59' else o.at_time + interval '1 hour' end, 'HH24:MI'),
           'weekly', case when cardinality(o.weekdays) > 0 then to_jsonb(o.weekdays) end,
           'exdates', case when o.skip_at is not null then jsonb_build_array((o.skip_at at time zone 'Asia/Seoul')::date) else '[]'::jsonb end,
           'busy', true,
           'location', o.branch_name,
           'url', o.video_url,
           'updated', o.updated_at)
         order by o.at_time), '[]'::jsonb)
    into v_meetings
    from public.office_schedules o
   where o.branch_name = any (v_branches)
     and public._office_role(_uid, o.branch_name) is not null
     and o.active and o.canceled_at is null
     and (cardinality(o.weekdays) > 0 or o.once_on >= v_today - 30);

  return jsonb_build_object(
    'kind', 'staff',
    'name', '153 운영본부 일정',
    'events', v_plans || v_shifts || v_events || v_meetings);
end
$$;

-- ── 권한 ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public._ops_rrule_parse(text) from public, anon, authenticated;
revoke execute on function public._ops_rrule_fill(jsonb, date) from public, anon, authenticated;
revoke execute on function public._ops_rrule_text(jsonb) from public, anon, authenticated;
revoke execute on function public._ops_recur_match(jsonb, date, date) from public, anon, authenticated;
revoke execute on function public._ops_recur_first(jsonb, date) from public, anon, authenticated;
revoke execute on function public._ops_recur_until(jsonb, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_rule(text, smallint[], date) from public, anon, authenticated;
revoke execute on function public._ops_plan_on(public.ops_plans, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_json(public.ops_plans, uuid) from public, anon, authenticated;
revoke execute on function public._ops_plan_birthdays(text, date, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_kind_label(text) from public, anon, authenticated;
revoke execute on function public.ops_plan_remind_tick(timestamp) from public, anon, authenticated;
revoke execute on function public.ops_plan_brief_tick(timestamp) from public, anon, authenticated;
revoke execute on function public._calendar_feed_staff(uuid) from public, anon, authenticated;

revoke execute on function public.ops_plans_range(text, date, date) from public, anon;
revoke execute on function public.ops_plans_week(text, date) from public, anon;
revoke execute on function public.ops_plan_save(jsonb) from public, anon;
revoke execute on function public.ops_plan_skip(uuid, date) from public, anon;
revoke execute on function public.ops_plan_remove_scope(uuid, text, date) from public, anon;
revoke execute on function public.ops_plan_trash() from public, anon;
revoke execute on function public.ops_plan_restore(uuid) from public, anon;
revoke execute on function public.ops_plan_search(text, text) from public, anon;
revoke execute on function public.ops_plan_prefs_set(boolean) from public, anon;
grant execute on function public.ops_plans_range(text, date, date) to authenticated;
grant execute on function public.ops_plans_week(text, date) to authenticated;
grant execute on function public.ops_plan_save(jsonb) to authenticated;
grant execute on function public.ops_plan_skip(uuid, date) to authenticated;
grant execute on function public.ops_plan_remove_scope(uuid, text, date) to authenticated;
grant execute on function public.ops_plan_trash() to authenticated;
grant execute on function public.ops_plan_restore(uuid) to authenticated;
grant execute on function public.ops_plan_search(text, text) to authenticated;
grant execute on function public.ops_plan_prefs_set(boolean) to authenticated;

grant execute on function public._ops_rrule_parse(text) to service_role;
grant execute on function public._ops_rrule_fill(jsonb, date) to service_role;
grant execute on function public._ops_rrule_text(jsonb) to service_role;
grant execute on function public._ops_recur_match(jsonb, date, date) to service_role;
grant execute on function public._ops_recur_first(jsonb, date) to service_role;
grant execute on function public._ops_recur_until(jsonb, date) to service_role;
grant execute on function public._ops_plan_rule(text, smallint[], date) to service_role;
grant execute on function public._ops_plan_on(public.ops_plans, date) to service_role;
grant execute on function public._ops_plan_json(public.ops_plans, uuid) to service_role;
grant execute on function public._ops_plan_birthdays(text, date, date) to service_role;
grant execute on function public._ops_plan_kind_label(text) to service_role;
grant execute on function public.ops_plan_remind_tick(timestamp) to service_role;
grant execute on function public.ops_plan_brief_tick(timestamp) to service_role;
grant execute on function public._calendar_feed_staff(uuid) to service_role;

-- ── 예약 작업 — 끄기: select cron.unschedule('ops-plan-remind'); select cron.unschedule('ops-plan-brief'); ──────────
select cron.schedule('ops-plan-remind', '* * * * *', 'select public.ops_plan_remind_tick()');
select cron.schedule('ops-plan-brief', '*/10 23 * * *', 'select public.ops_plan_brief_tick()');
