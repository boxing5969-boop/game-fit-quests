-- ✅ 캘린더 3-5단계 — 회원 운동 달력 넓히기: 네이버처럼, 153식으로 (2026-11-14 대표님 「진행하자」 · 「캘린더 3단계 보고서」 https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK)
--   작업판 myboxer:calendar3-5. 새 페이지 · 새 탭 없음 — 회원 운동 달력 카드(펼친 달 · 그날 카드 · 시트) 안에서만.
--
--   ① 내 일정 — 새 표 member_calendar_events(이름 30자 · 하루 종일 / 시각 · 여러 날 한 달까지 · 반복 = 3-2 와 같은 RRULE 부분집합 ·
--      알림 2개 · 색 8 · 장소 60자 · 메모 200자 · '이날은 쉬어요' · 빼기 = removed_at) · 기념일(kind anniv — 매년 · 양력은 FREQ=YEARLY,
--      음력은 앱이 음력 표(src/lib/lunar.ts · 2026 ~ 2035)로 계산한 양력 날들 occ_dates) · 반복을 그날에서 고치면 이 날만 · 이후 모두 · 전체.
--      set_my_cal_event · remove_my_cal_event · 그날 이 일정이 있나 _my_cal_on(3-2 반복 엔진 _ops_rrule_* · _ops_recur_* 그대로) ·
--      알림 member_cal_remind_tick(1분마다 · 시각 일정 = 시작 n분 전 · 하루 종일 · 기념일 = 그날 · 전날 · 일주일 전 아침 9시 ·
--      밤 10시 ~ 아침 8시는 알림함에만 · 일정 · 날 · 알림마다 한 번 = member_calendar_notices).
--   ② '쉬어요' 날 — 약속 알림(그날 · 전날 저녁) · 저녁 체크 알림을 보내지 않고, 복귀 보너스에서 놓친 약속으로 세지 않는다(휴관일 규칙과
--      같은 곳 — promise_tick · calendar_tick 덧대기) · 그날 체크에서 체육관을 뺀다(_cal_check_count — 화면 dayChecks 와 같은 식).
--   ③ 보기 — 캘린더 켜고 끄기(153 일정 · 내 일정 · 운동 표시 · 공휴일)와 리그 테마는 member_calendar_prefs 새 칸(cals_off · theme) ·
--      set_my_calendar_view. 목록 · 한 해 도장 · 공휴일 · 생일 도장은 화면이 계산한다(한 해 도장 = 출석 기록 get_attendance_history 그대로).
--   ④ 검색 — search_my_calendar(내 일정 이름 · 장소 · 메모 + 내 한 줄 글).
--   ⑤ 다이어리 사진 3장 — set_journal_entry_photos(첫 장 = photo_url · 모두 = metadata.photos — 커뮤니티 피드는 첫 장 그대로) ·
--      get_my_calendar 한 줄에 photos.
--   ⑥ 기분 스티커 8 → 20 (153 입체 아이콘이 있는 이모지만) — set_my_day_sticker · 제약 member_check_days_sticker_chk.
--   ⑦ get_my_calendar 덧대기(이름 · 인자 · 권한 그대로) — mine(보이는 날짜에 걸친 내 일정) · birthday(내 생일 MM-DD) · league(리그) ·
--      view(켜고 끄기 · 테마) · 한 줄 photos.
--   뺀 것(보고): 날씨 도장 = 공공데이터포털(기상청) 키가 없어 · 지점 수업 시간표 = 153OS 수업 표(classes · class_schedules)가 비어 있어 ·
--      짝꿍 · 가족 공유 = 2-4 의 짝꿍(동의한 짝 · 약속 요일 · 같이 온 날) 그대로(가족 연결은 앱에 없다).
--
--   지킬 것: 새 표는 RLS 켜고 anon · authenticated 직접 읽기 · 쓰기 막음 → 함수로만(SECURITY DEFINER · search_path public).
--   덧댄 함수는 운영 지금 정의(= 로컬 기준본 · 2026-11-14 md5 확인) 위에 · 이름 · 인자 · 권한 그대로. 출석 표 트리거 없음.

-- ═══════════════════════════ 1) 표 · 칸 ═══════════════════════════
create table if not exists public.member_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'plan',
  title text not null,
  start_on date not null,
  end_on date not null,
  all_day boolean not null default true,
  start_time time,
  end_time time,
  rrule text,
  until_on date,
  skip_dates date[] not null default '{}',
  lunar jsonb,
  occ_dates date[] not null default '{}',
  reminders smallint[] not null default '{}',
  color text,
  location text,
  memo text,
  rest boolean not null default false,
  series_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint member_calendar_events_kind_chk check (kind in ('plan', 'anniv')),
  constraint member_calendar_events_title_chk check (char_length(title) between 1 and 30),
  constraint member_calendar_events_span_chk check (end_on >= start_on and end_on <= start_on + 30),
  constraint member_calendar_events_time_chk check (all_day or (start_time is not null and end_time is not null and end_time > start_time)),
  constraint member_calendar_events_color_chk check (color is null or color in ('tomato', 'tangerine', 'banana', 'basil', 'peacock', 'blueberry', 'grape', 'graphite')),
  constraint member_calendar_events_loc_chk check (location is null or char_length(location) <= 60),
  constraint member_calendar_events_memo_chk check (memo is null or char_length(memo) <= 200),
  constraint member_calendar_events_rem_chk check (cardinality(reminders) <= 2),
  constraint member_calendar_events_occ_chk check (cardinality(occ_dates) <= 12),
  constraint member_calendar_events_skip_chk check (cardinality(skip_dates) <= 120)
);
create index if not exists member_calendar_events_user_idx on public.member_calendar_events (user_id, start_on) where removed_at is null;
create index if not exists member_calendar_events_rest_idx on public.member_calendar_events (user_id) where removed_at is null and rest;
create index if not exists member_calendar_events_remind_idx on public.member_calendar_events (start_on) where removed_at is null and cardinality(reminders) > 0;
alter table public.member_calendar_events enable row level security;
revoke all on table public.member_calendar_events from anon, authenticated;
comment on table public.member_calendar_events is '캘린더 3-5 — 회원 내 일정 · 기념일(이름 30 · 하루 종일/시각 · 여러 날 한 달 · 반복 RRULE(3-2 부분집합) · 음력 기념일 occ_dates · 알림 2 · 색 8 · 장소 60 · 메모 200 · 이날은 쉬어요 rest · 빼기 removed_at). 함수로만.';

create table if not exists public.member_calendar_notices (
  event_id uuid not null references public.member_calendar_events(id) on delete cascade,
  occ_date date not null,
  minutes smallint not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, occ_date, minutes)
);
alter table public.member_calendar_notices enable row level security;
revoke all on table public.member_calendar_notices from anon, authenticated;
comment on table public.member_calendar_notices is '캘린더 3-5 — 내 일정 알림을 일정 · 날 · 알림마다 한 번만 (member_cal_remind_tick).';

alter table public.member_calendar_prefs add column if not exists cals_off text[] not null default '{}';
alter table public.member_calendar_prefs add column if not exists theme text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_calendar_prefs_cals_off_chk') then
    alter table public.member_calendar_prefs
      add constraint member_calendar_prefs_cals_off_chk check (cals_off <@ array['153', 'mine', 'marks', 'holiday']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_calendar_prefs_theme_chk') then
    alter table public.member_calendar_prefs
      add constraint member_calendar_prefs_theme_chk check (theme is null or theme = 'league');
  end if;
end $$;
comment on column public.member_calendar_prefs.cals_off is '캘린더 3-5 — 운동 달력에서 끈 캘린더(153 = 153 일정 · 같이 운동 · mine = 내 일정 · 기념일 · marks = 금색 별 · 스티커 · 그날 한 일 표시 · holiday = 공휴일)';
comment on column public.member_calendar_prefs.theme is '캘린더 3-5 — 리그 테마(league) · null = 기본';

-- (3-5 ⑥) 기분 스티커 8 → 20 — 153 입체 아이콘이 있는 이모지만 (화면 lib/calendarChecks STICKERS 와 같은 목록)
alter table public.member_check_days drop constraint if exists member_check_days_sticker_chk;
alter table public.member_check_days add constraint member_check_days_sticker_chk check (sticker is null or sticker = any (array[
  'strong', 'fire', 'proud', 'mitt', 'sweat', 'tired', 'hurt', 'rest',
  'best', 'party', 'energy', 'champ', 'focus', 'clap', 'laugh', 'stretch', 'rope', 'together', 'perfect', 'thanks']::text[]));

-- ═══════════════════════════ 2) 안쪽 함수 ═══════════════════════════

-- 그날 이 내 일정이 있나 — 음력 기념일 = occ_dates · 한 번 = 시작 ~ 끝 · 반복 = 3-2 반복 엔진(시작 · 끝 · 빼는 날 · 규칙 모양)
create or replace function public._my_cal_on(e public.member_calendar_events, _d date)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $$
declare r jsonb;
begin
  if e.removed_at is not null or _d is null then return false; end if;
  if cardinality(e.occ_dates) > 0 then
    return _d = any (e.occ_dates) and not (_d = any (e.skip_dates));
  end if;
  if e.rrule is null then return _d between e.start_on and e.end_on; end if;
  if _d < e.start_on then return false; end if;
  if e.until_on is not null and _d > e.until_on then return false; end if;
  if _d = any (e.skip_dates) then return false; end if;
  r := public._ops_rrule_fill(public._ops_rrule_parse(e.rrule), e.start_on);
  return public._ops_recur_match(r, e.start_on, _d);
end
$$;

-- '이날은 쉬어요' — 약속 알림 · 저녁 체크 알림 · 복귀 보너스 · 그날 체크(체육관)가 휴관일처럼 본다
create or replace function public._cal_rest_on(_uid uuid, _day date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _uid is not null and _day is not null and exists (
    select 1 from public.member_calendar_events e
     where e.user_id = _uid and e.rest and e.kind = 'plan' and e.removed_at is null
       and e.start_on <= _day
       and public._my_cal_on(e, _day))
$$;

-- 화면에 보내는 내 일정 한 줄
create or replace function public._my_cal_event_json(e public.member_calendar_events)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'title', e.title,
    'start_on', e.start_on, 'end_on', e.end_on, 'all_day', e.all_day,
    'start_time', to_char(e.start_time, 'HH24:MI'), 'end_time', to_char(e.end_time, 'HH24:MI'),
    'rrule', e.rrule, 'until_on', e.until_on, 'skip_dates', to_jsonb(e.skip_dates),
    'lunar', e.lunar, 'occ_dates', to_jsonb(e.occ_dates),
    'reminders', to_jsonb(e.reminders), 'color', e.color, 'location', e.location, 'memo', e.memo,
    'rest', e.rest, 'series_id', e.series_id)
$$;

-- ═══════════════════════════ 3) 회원 — 내 일정 넣기 · 고치기 · 빼기 ═══════════════════════════

-- 넣기 · 고치기 — p: {id?, kind, title, start_on, end_on?, all_day, start_time?, end_time?, rrule?, until_on?, lunar?, occ_dates?,
--   reminders[], color?, location?, memo?, rest, scope?('one' | 'following' | 'all'), only_date?(반복을 그날에서 고칠 때 그날)}
--   반복은 3-2 운영본부 일정과 같은 규칙 · 같은 범위 처리(이 날만 = 그날 빼고 한 번 하는 일정을 새로 · 이후 모두 = 원래는 그 전날까지 + 새 반복)
create or replace function public.set_my_cal_event(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_only date := nullif(p ->> 'only_date', '')::date;
  v_scope text := coalesce(nullif(p ->> 'scope', ''), case when nullif(p ->> 'only_date', '') is not null then 'one' else 'all' end);
  v_row public.member_calendar_events%rowtype;
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'plan');
  v_title text := nullif(btrim(regexp_replace(coalesce(p ->> 'title', ''), '\s+', ' ', 'g')), '');
  v_start date := nullif(p ->> 'start_on', '')::date;
  v_end date := nullif(p ->> 'end_on', '')::date;
  v_all_day boolean := coalesce((p ->> 'all_day')::boolean, true);
  v_st time := nullif(p ->> 'start_time', '')::time;
  v_et time := nullif(p ->> 'end_time', '')::time;
  v_rule_in text := nullif(btrim(coalesce(p ->> 'rrule', '')), '');
  v_until date := nullif(p ->> 'until_on', '')::date;
  v_color text := nullif(btrim(coalesce(p ->> 'color', '')), '');
  v_loc text := nullif(btrim(regexp_replace(coalesce(p ->> 'location', ''), '\s+', ' ', 'g')), '');
  v_memo text := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_rest boolean := coalesce((p ->> 'rest')::boolean, false);
  v_r jsonb;
  v_rrule text;
  v_rem smallint[];
  v_lunar jsonb;
  v_occ date[] := '{}';
  v_lm int;
  v_ld int;
  v_series uuid;
  v_skip date[];
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '바꿀 범위를 다시 골라 주세요'; end if;
  if v_kind not in ('plan', 'anniv') then raise exception '종류를 다시 골라 주세요'; end if;
  if v_title is null then raise exception '이름을 적어 주세요'; end if;
  if char_length(v_title) > 30 then raise exception '이름은 30자 안으로 적어 주세요'; end if;
  if v_start is null then raise exception '날짜를 골라 주세요'; end if;
  if char_length(coalesce(v_loc, '')) > 60 then raise exception '장소는 60자 안으로 적어 주세요'; end if;
  if char_length(coalesce(v_memo, '')) > 200 then raise exception '메모는 200자 안으로 적어 주세요'; end if;
  if v_color is not null and v_color not in ('tomato', 'tangerine', 'banana', 'basil', 'peacock', 'blueberry', 'grape', 'graphite') then
    raise exception '색을 다시 골라 주세요';
  end if;
  if p ? 'reminders' and jsonb_typeof(p -> 'reminders') <> 'null' then
    if jsonb_typeof(p -> 'reminders') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'reminders') x
                   where case when x ~ '^\d{1,5}$' then x::int > 20000 else true end) then
      raise exception '알림을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x::int order by x::int), '{}')::smallint[] into v_rem from jsonb_array_elements_text(p -> 'reminders') x;
  else
    v_rem := '{}';
  end if;

  -- 고칠 일정 — 내 것 · 빼지 않은 것만
  if v_id is not null then
    select * into v_row from public.member_calendar_events where id = v_id and user_id = v_me and removed_at is null for update;
    if not found then raise exception '일정을 찾을 수 없어요'; end if;
  end if;
  if v_id is null or v_only is null then v_scope := 'all'; end if;

  if v_kind = 'anniv' then
    -- 기념일 — 하루 종일 · 매년 · 쉬어요 · 장소 없음 · 이 날만 바꾸기 없음
    if v_scope <> 'all' then raise exception '기념일은 전체만 바꿀 수 있어요'; end if;
    v_all_day := true; v_st := null; v_et := null; v_rest := false; v_loc := null;
    v_end := v_start;
    if jsonb_typeof(p -> 'lunar') = 'object' then
      -- 음력 — {m, d, leap} + 앱이 음력 표로 계산한 양력 날들(1 ~ 12개 · 오늘 400일 전 ~ 10년 뒤)
      if coalesce(p -> 'lunar' ->> 'm', '') !~ '^\d{1,2}$' or coalesce(p -> 'lunar' ->> 'd', '') !~ '^\d{1,2}$' then
        raise exception '음력 날짜를 다시 골라 주세요';
      end if;
      v_lm := (p -> 'lunar' ->> 'm')::int;
      v_ld := (p -> 'lunar' ->> 'd')::int;
      if v_lm not between 1 and 12 or v_ld not between 1 and 30 then raise exception '음력 날짜를 다시 골라 주세요'; end if;
      v_lunar := jsonb_build_object('m', v_lm, 'd', v_ld, 'leap', coalesce((p -> 'lunar' ->> 'leap')::boolean, false));
      if jsonb_typeof(p -> 'occ_dates') is distinct from 'array'
         or exists (select 1 from jsonb_array_elements_text(p -> 'occ_dates') x where x !~ '^\d{4}-\d{2}-\d{2}$') then
        raise exception '음력 날짜를 다시 골라 주세요';
      end if;
      select coalesce(array_agg(distinct x::date order by x::date), '{}') into v_occ from jsonb_array_elements_text(p -> 'occ_dates') x;
      if cardinality(v_occ) = 0 or cardinality(v_occ) > 12
         or exists (select 1 from unnest(v_occ) x where x < v_today - 400 or x > v_today + 3700) then
        raise exception '음력 날짜를 다시 골라 주세요';
      end if;
      v_start := v_occ[1];
      v_end := v_start;
      v_rrule := null;
      v_until := null;
    else
      if v_start < date '1900-01-01' or v_start > v_today + 400 then raise exception '날짜를 다시 골라 주세요'; end if;
      v_lunar := null;
      v_occ := '{}';
      v_rrule := 'FREQ=YEARLY';
      v_until := null;
    end if;
  else
    v_lunar := null;
    v_occ := '{}';
    if v_start < v_today - 62 or v_start > v_today + 400 then raise exception '날짜는 두 달 전부터 1년 안으로 골라 주세요'; end if;
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
    else
      v_rrule := null;
      v_until := null;
      v_end := coalesce(v_end, v_start);
      if v_end < v_start then raise exception '끝나는 날이 시작보다 빨라요'; end if;
      if v_end > v_start + 30 then raise exception '여러 날 일정은 한 달까지예요'; end if;
    end if;
    if v_all_day then
      v_st := null;
      v_et := null;
    elsif v_st is null or v_et is null or v_et <= v_st then
      raise exception '시작 · 끝 시각을 확인해 주세요';
    end if;
  end if;

  -- 알림 2개까지 — 시각 일정: 시작 0 · 10 · 30 · 60 · 120 · 1440분 전 / 하루 종일 · 기념일: 그날 · 전날 · 일주일 전 아침 9시
  if cardinality(v_rem) > 2 then raise exception '알림은 2개까지예요'; end if;
  if v_all_day and not (v_rem <@ '{0,1440,10080}'::smallint[]) then raise exception '알림을 다시 골라 주세요'; end if;
  if not v_all_day and not (v_rem <@ '{0,10,30,60,120,1440}'::smallint[]) then raise exception '알림을 다시 골라 주세요'; end if;

  if v_id is not null and v_scope = 'one' then
    -- 이 날만 — 반복에서 그날을 빼고, 같은 묶음으로 한 번 하는 일정을 새로
    if v_row.rrule is null then raise exception '반복 일정만 하루씩 바꿀 수 있어요'; end if;
    if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
    update public.member_calendar_events
       set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || v_only) x), updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_id := null;
  elsif v_id is not null and v_scope = 'following' and v_row.rrule is not null and v_only > v_row.start_on then
    -- 이후 모두 — 원래 반복은 그 전날까지(횟수는 풀고 끝나는 날로), 같은 묶음으로 새 반복
    update public.member_calendar_events
       set until_on = least(coalesce(until_on, 'infinity'::date), v_only - 1),
           rrule = regexp_replace(rrule, ';COUNT=\d+', ''),
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < v_only), '{}'),
           updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_skip := coalesce((select array_agg(x order by x) from unnest(v_row.skip_dates) x where x >= v_start), '{}');
    v_id := null;
  end if;

  if v_id is null then
    -- 동시에 두 번 눌러도 한도를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-cal-events:' || v_me::text));
    if (select count(*) from public.member_calendar_events
         where user_id = v_me and removed_at is null
           and (case when cardinality(occ_dates) > 0 then occ_dates[cardinality(occ_dates)]
                     when rrule is null then end_on
                     else coalesce(until_on, 'infinity'::date) end) >= v_today) >= 200 then
      raise exception '앞으로 잡힌 일정이 너무 많아요 — 지난 일정은 지워 주세요';
    end if;
    insert into public.member_calendar_events (user_id, kind, title, start_on, end_on, all_day, start_time, end_time, rrule, until_on,
                                               skip_dates, lunar, occ_dates, reminders, color, location, memo, rest, series_id)
    values (v_me, v_kind, v_title, v_start, v_end, v_all_day, v_st, v_et, v_rrule, v_until,
            case when v_rrule is not null then coalesce(v_skip, '{}') else '{}' end,
            v_lunar, v_occ, v_rem, v_color, v_loc, v_memo, v_rest, v_series)
    returning id into v_id;
  else
    update public.member_calendar_events
       set kind = v_kind, title = v_title, start_on = v_start, end_on = v_end, all_day = v_all_day,
           start_time = v_st, end_time = v_et, rrule = v_rrule, until_on = v_until,
           skip_dates = case when v_rrule is not null
                             then coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x >= v_start), '{}')
                             when cardinality(v_occ) > 0
                             then coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x = any (v_occ)), '{}')
                             else '{}' end,
           lunar = v_lunar, occ_dates = v_occ, reminders = v_rem, color = v_color, location = v_loc, memo = v_memo,
           rest = v_rest, updated_at = now()
     where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- 빼기 — 이 날만(반복 · 음력 기념일에서 그날 빼기) · 이후 모두(반복을 그 전날까지) · 전체(removed_at — 지우지 않는다)
create or replace function public.remove_my_cal_event(p_id uuid, p_scope text default 'all', p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_scope text := coalesce(nullif(btrim(coalesce(p_scope, '')), ''), 'all');
  v_row public.member_calendar_events%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '뺄 범위를 다시 골라 주세요'; end if;
  select * into v_row from public.member_calendar_events where id = p_id and user_id = v_me and removed_at is null for update;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;

  if v_scope = 'one' and p_date is not null and (v_row.rrule is not null or cardinality(v_row.occ_dates) > 0) then
    if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
    update public.member_calendar_events
       set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || p_date) x), updated_at = now()
     where id = p_id;
  elsif v_scope = 'following' and p_date is not null and v_row.rrule is not null and p_date > v_row.start_on then
    update public.member_calendar_events
       set until_on = least(coalesce(until_on, 'infinity'::date), p_date - 1),
           rrule = regexp_replace(rrule, ';COUNT=\d+', ''),
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < p_date), '{}'),
           updated_at = now()
     where id = p_id;
  else
    update public.member_calendar_events set removed_at = now(), updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end
$$;

-- 검색 — 내 일정(이름 · 장소 · 메모) + 내 한 줄 글 · 각 30개까지 · 최근 것부터
create or replace function public.search_my_calendar(p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_q text := nullif(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')), '');
  v_pat text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    return jsonb_build_object('on', false);
  end if;
  if v_q is null then raise exception '찾을 말을 적어 주세요'; end if;
  if char_length(v_q) > 30 then raise exception '찾을 말은 30자 안으로 적어 주세요'; end if;
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return jsonb_build_object(
    'on', true,
    'q', v_q,
    'events', coalesce((
      select jsonb_agg(public._my_cal_event_json(x) order by x.start_on desc, x.created_at desc)
        from (select e.* from public.member_calendar_events e
               where e.user_id = v_me and e.removed_at is null
                 and (e.title ilike v_pat or coalesce(e.location, '') ilike v_pat or coalesce(e.memo, '') ilike v_pat)
               order by e.start_on desc, e.created_at desc
               limit 30) x), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.id, 'day', (j.created_at at time zone 'Asia/Seoul')::date, 'content', left(j.content, 200),
               'mood', j.mood, 'photo_url', j.photo_url) order by j.created_at desc)
        from (select je.* from public.champion_journal_entries je
               where je.user_id = v_me and coalesce(je.kind, 'journal') = 'journal' and je.content ilike v_pat
               order by je.created_at desc
               limit 30) j), '[]'::jsonb));
end
$$;

-- 캘린더 켜고 끄기 · 리그 테마 (사람마다 · 기기가 바뀌어도 그대로)
create or replace function public.set_my_calendar_view(p_cals_off text[] default null, p_theme text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_off text[];
  v_theme text := nullif(btrim(coalesce(p_theme, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_off
    from unnest(coalesce(p_cals_off, '{}'::text[])) x where nullif(btrim(x), '') is not null;
  if not (v_off <@ array['153', 'mine', 'marks', 'holiday']::text[]) then raise exception '캘린더를 다시 골라 주세요'; end if;
  if v_theme is not null and v_theme <> 'league' then raise exception '테마를 다시 골라 주세요'; end if;
  insert into public.member_calendar_prefs as m (user_id, cals_off, theme)
  values (v_me, v_off, v_theme)
  on conflict (user_id) do update
     set cals_off = excluded.cals_off, theme = excluded.theme, updated_at = now();
  return jsonb_build_object('cals_off', to_jsonb(v_off), 'theme', v_theme);
end
$$;

-- 다이어리 사진 3장 — 첫 장 = photo_url(커뮤니티 피드 · 예전 화면은 그대로 첫 장) · 모두 = metadata.photos
--   사진 주소 규칙은 set_journal_entry_options 와 같다(내 폴더의 커뮤니티 사진만)
create or replace function public.set_journal_entry_photos(p_entry_id uuid, p_urls text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_urls text[];
  u text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select coalesce(array_agg(btrim(x) order by o), '{}') into v_urls
    from unnest(coalesce(p_urls, '{}'::text[])) with ordinality t(x, o)
   where nullif(btrim(x), '') is not null;
  if cardinality(v_urls) > 3 then raise exception '사진은 3장까지예요'; end if;
  foreach u in array v_urls loop
    if u !~ ('^https://whnczhxyjmyywhlfbgsd\.supabase\.co/storage/v1/object/public/community/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
      raise exception '사진 주소가 올바르지 않습니다';
    end if;
  end loop;
  update public.champion_journal_entries
     set photo_url = v_urls[1],
         metadata = case when cardinality(v_urls) > 1 then coalesce(metadata, '{}'::jsonb) || jsonb_build_object('photos', to_jsonb(v_urls))
                         else coalesce(metadata, '{}'::jsonb) - 'photos' end
   where id = p_entry_id and user_id = v_uid;
  if not found then raise exception '내 글만 바꿀 수 있습니다'; end if;
  return jsonb_build_object('success', true, 'photos', to_jsonb(v_urls));
end
$$;

-- ═══════════════════════════ 4) 내 일정 알림 ═══════════════════════════
-- 1분마다 — 시각 일정 = 시작 n분 전 · 하루 종일 · 기념일 = 그날 아침 9시에서 n분 전(0 · 1440 · 10080) · 여러 날 일정은 첫날만 ·
--   10분 안에 놓친 차례까지 · 일정 · 날 · 알림마다 한 번(member_calendar_notices) · 밤 10시 ~ 아침 8시는 알림함에만(휴대폰 X) ·
--   링크 = 운동 달력 그날(/home?cal=날짜)
create or replace function public.member_cal_remind_tick(p_at timestamp default null)
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
    select e.id, e.user_id, e.kind, e.title, e.location, e.all_day, e.start_time, e.end_time, e.rest, e.lunar,
           d.d::date as occ, m.m as mins,
           (d.d::date + case when e.all_day then time '09:00' else e.start_time end) as occ_at
      from public.member_calendar_events e
     cross join generate_series(v_today, v_today + 7, interval '1 day') d(d)
     cross join lateral unnest(e.reminders) m(m)
     where e.removed_at is null and cardinality(e.reminders) > 0
       and e.start_on <= v_today + 7
       and (e.rrule is not null or cardinality(e.occ_dates) > 0 or d.d::date = e.start_on)
       and public._my_cal_on(e, d.d::date)
  ), due as (
    select c.* from cand c
     where c.occ_at - make_interval(mins => c.mins) <= v_local
       and c.occ_at - make_interval(mins => c.mins) > v_local - interval '10 minutes'
       and (c.all_day or c.occ_at >= v_local - interval '1 minute')
       and public._is_active_member(c.user_id)
  ), ins as (
    insert into public.member_calendar_notices (event_id, occ_date, minutes, user_id)
    select due.id, due.occ, due.mins, due.user_id from due
    on conflict do nothing
    returning event_id, occ_date, minutes
  )
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select due.user_id,
         case when due.kind = 'anniv' then '🎉 ' else '⏰ ' end || due.title || ' · ' ||
           case
             when due.all_day then case due.mins when 0 then '오늘이에요' when 1440 then '내일이에요' else '일주일 남았어요' end
             when v_local - (due.occ_at - make_interval(mins => due.mins)) > interval '2 minutes'
               then case when due.occ_at - v_local <= interval '1 minute' then '곧 시작해요'
                         else ceil(extract(epoch from (due.occ_at - v_local)) / 60)::int || '분 뒤' end
             else case due.mins when 0 then '지금 시작해요' when 60 then '1시간 전' when 120 then '2시간 전'
                                when 1440 then '내일 ' || to_char(due.start_time, 'HH24:MI')
                                else due.mins || '분 전' end
           end,
         case when due.kind = 'anniv'
                then coalesce('음력 ' || (due.lunar ->> 'm') || '월 ' || (due.lunar ->> 'd') || '일'
                                || case when coalesce((due.lunar ->> 'leap')::boolean, false) then '(윤달)' else '' end,
                              '내 기념일')
              when due.all_day then '하루 종일'
              else to_char(due.start_time, 'HH24:MI') || '~' || to_char(due.end_time, 'HH24:MI') end
           || coalesce(' · ' || nullif(btrim(due.location), ''), '')
           || case when due.rest then ' · 이날은 쉬어요' else '' end,
         '/home?cal=' || to_char(due.occ, 'YYYY-MM-DD'),
         case when v_quiet then v_now end
    from ins
    join due on due.id = ins.event_id and due.occ = ins.occ_date and due.mins = ins.minutes;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n, 'quiet', v_quiet, 'at', to_char(v_local, 'HH24:MI'));
end
$$;


-- ═══════════════════════════ 5) 덧대기 (운영 지금 정의 위에 · 이름 · 인자 · 권한 그대로) ═══════════════════════════

-- (3-5 ⑦) 달력 — mine · birthday · league · view · 한 줄 photos (그 밖은 3-4 그대로)
CREATE OR REPLACE FUNCTION public.get_my_calendar(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_acts jsonb;
  v_notes jsonb;
  v_anniv jsonb;
  v_recap boolean;
  v_todos jsonb;
  v_mine jsonb;
  v_off text[];
  v_theme text;
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
           'weekdays', to_jsonb(i.weekdays), 'week_goal', i.week_goal,
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
             'visibility', coalesce(j.visibility, 'branch'), 'at', j.created_at,
             'photos', coalesce(j.metadata -> 'photos', case when j.photo_url is not null then jsonb_build_array(j.photo_url) else '[]'::jsonb end)) as entry
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

  -- (2-2) 내 지점 153 일정 — 이 날짜들에 걸친 것 (2-3 승급 심사 = kind exam)
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', case when e.is_exam then 'exam' else e.kind end,
           'title', e.title, 'start_on', e.start_on, 'end_on', e.end_on)
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

  select cp.evening_nudge, cp.weekly_recap, cp.cals_off, cp.theme into v_nudge, v_recap, v_off, v_theme
    from public.member_calendar_prefs cp where cp.user_id = v_me;

  -- (2-3) 그날 한 일 — PT 수업 · 153 PB · 타이틀매치 · 레벨업 (DB 에 이미 있는 기록만)
  with pt as (
    select distinct on (s.session_date)
           s.session_date as day,
           jsonb_build_object(
             'day', s.session_date, 'kind', 'pt',
             'coach', coalesce(nullif(btrim(cp.name), ''), nullif(btrim(cp.nickname), ''), nullif(btrim(st.name), ''))) as j,
           4 as ord
      from public.ops_pt_sessions s
      left join public.ops_staff st on st.id = s.coach_staff_id
      left join public.profiles cp on cp.user_id = st.user_id
     where s.member_user_id = v_me and s.kind = 'lesson' and s.status = 'open'
       and s.session_date between p_from and p_to
     order by s.session_date, s.created_at
  ), pb as (
    select (t.measured_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (t.measured_at at time zone 'Asia/Seoul')::date, 'kind', 'pb', 'division', t.division,
             'first', not exists (
               select 1 from public.test153_records t2
                where t2.user_id = v_me and t2.official and t2.division = t.division
                  and (t2.measured_at < t.measured_at or (t2.measured_at = t.measured_at and t2.id < t.id))),
             'best', not exists (
               select 1 from public.test153_records t3
                where t3.user_id = v_me and t3.official and t3.division = t.division
                  and (t3.measured_at < t.measured_at or (t3.measured_at = t.measured_at and t3.id < t.id))
                  and t3.score_ms <= t.score_ms)) as j,
           3 as ord
      from public.test153_records t
     where t.user_id = v_me and t.official and t.measured_at >= v_from and t.measured_at < v_to
  ), tm as (
    select (a.recorded_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (a.recorded_at at time zone 'Asia/Seoul')::date, 'kind', 'title',
             'passed', coalesce(a.passed, false), 'rank', c.rank_name::text) as j,
           1 as ord
      from public.title_match_attempts a
      left join public.title_match_challenges c on c.id = a.challenge_id
     where a.user_id = v_me and a.recorded_at >= v_from and a.recorded_at < v_to
  ), lv as (
    select (h.created_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (h.created_at at time zone 'Asia/Seoul')::date, 'kind', 'level',
             'level', least(40, max((case h.rank_name::text when 'white' then 0 when 'blue' then 1 when 'red' then 2 else 3 end) * 10
                                    + h.level_number + 1))) as j,
           2 as ord
      from public.level_status_history h
     where h.user_id = v_me and h.new_status::text = 'approved'
       and h.created_at >= v_from and h.created_at < v_to
     group by (h.created_at at time zone 'Asia/Seoul')::date
  ), all_acts as (
    select day, j, ord from pt
    union all select day, j, ord from pb
    union all select day, j, ord from tm
    union all select day, j, ord from lv
  )
  select coalesce(jsonb_agg(j order by day, ord), '[]'::jsonb) into v_acts from all_acts;

  -- (2-3) 코치 한마디 — 이 날짜들
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'day', n.day,
           'who', public._cal_staff_who(n.coach_user_id),
           'title', public._cal_staff_title(n.coach_user_id),
           'body', n.body, 'at', n.updated_at)
         order by n.day, n.created_at), '[]'::jsonb)
    into v_notes
    from public.coach_day_notes n
   where n.member_user_id = v_me and n.removed_at is null and n.day between p_from and p_to;

  -- (2-3) 153 기념일 — 이 날짜들에 든 n주년
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', (a.day + make_interval(years => g))::date, 'years', g, 'basis', a.basis)
         order by g), '[]'::jsonb)
    into v_anniv
    from public._cal_anchor(v_me) a, generate_series(1, 80) g
   where (a.day + make_interval(years => g))::date between p_from and p_to;

  -- (3-4) 보이는 날짜가 마감인 할 일 (뺀 것 빼고)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on, 'done', t.done_at is not null)
         order by t.due_on, t.created_at), '[]'::jsonb)
    into v_todos
    from public.member_todos t
   where t.user_id = v_me and t.removed_at is null and t.due_on between p_from and p_to;

  -- (3-5) 보이는 날짜에 걸친 내 일정 · 기념일 (반복 · 음력은 화면이 날마다 펼친다)
  select coalesce(jsonb_agg(public._my_cal_event_json(e) order by e.start_on, e.start_time nulls first, e.created_at), '[]'::jsonb)
    into v_mine
    from public.member_calendar_events e
   where e.user_id = v_me and e.removed_at is null
     and (case when cardinality(e.occ_dates) > 0 then exists (select 1 from unnest(e.occ_dates) x where x between p_from and p_to)
               when e.rrule is null then e.start_on <= p_to and e.end_on >= p_from
               else e.start_on <= p_to and coalesce(e.until_on, 'infinity'::date) >= p_from end);

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'todos', v_todos,
    'mine', v_mine,
    'birthday', public._birth_mmdd((select p.birth_date from public.profiles p where p.user_id = v_me)),
    'league', (select mp.current_rank::text from public.member_progress mp where mp.user_id = v_me limit 1),
    'view', jsonb_build_object('cals_off', to_jsonb(coalesce(v_off, '{}'::text[])), 'theme', v_theme),
    'days', v_days,
    'events', v_events,
    'calls', v_calls,
    'nudge', jsonb_build_object('on', coalesce(v_nudge, false), 'at', coalesce(public._cal_conf() ->> 'nudge_at', '20:00')),
    'acts', v_acts,
    'notes', v_notes,
    'anniv', v_anniv,
    'ddays', public._cal_ddays(v_me),
    'recap', jsonb_build_object(
      'on', coalesce(v_recap, true),
      'at', coalesce(public._cal_conf() ->> 'recap_at', '19:30'),
      'sends', public._promise_member(v_me) is not null),
    'partner', public._cal_partner_json(v_me, p_from, p_to));
end
$function$;

-- (3-5 ②) 그날 체크 수 — '쉬어요' 날은 휴관일처럼 체육관을 뺀다 (그 밖은 3-4 그대로)
CREATE OR REPLACE FUNCTION public._cal_check_count(_uid uuid, _day date)
 RETURNS TABLE(total integer, done integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with b as (
    select (_day::timestamp at time zone 'Asia/Seoul') as f,
           ((_day + 1)::timestamp at time zone 'Asia/Seoul') as t,
           (select p.branch_name from public.profiles p where p.user_id = _uid) as branch
  ), x as (
    select
      exists (select 1 from public.attendance_logs a
               where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                 and a.checked_in_at >= b.f and a.checked_in_at < b.t) as gym,
      (public._cal_closed_on(b.branch, _day) or public._cal_rest_on(_uid, _day)) as closed,
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
       and i.week_goal is null
  ), d as (
    select coalesce((select m.done from public.member_check_days m where m.user_id = _uid and m.day = _day), '{}'::uuid[]) as done
  )
  select
    ((case when x.closed and not x.gym then 0 else 1 end) + 2 + (select count(*) from items))::integer as total,
    (x.gym::integer + x.cheer::integer + x.line::integer
      + (select count(*) from items, d where items.id = any (d.done)))::integer as done
    from x
$function$;

-- (3-5 ②) 약속 알림 · 복귀 보너스 — '쉬어요' 날 빼기 (그 밖은 2-2 그대로)
CREATE OR REPLACE FUNCTION public.promise_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- ① 약속 알림 — 알림 켬 · 한 번만 (휴대폰 알림 시간 quiet_after 전까지) · (3-5) 내 일정 '이날은 쉬어요'인 날은 보내지 않는다
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
             and not public._cal_rest_on(mp.user_id, v_today)
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
             and not public._cal_rest_on(mp.user_id, v_tomorrow)
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
         and not public._cal_closed_on(r.branch_name, g.d::date)
         and not public._cal_rest_on(r.user_id, g.d::date);
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
$function$;

-- (3-5 ②) 저녁 독려 — '쉬어요' 날 빼기 (그 밖은 2-4 그대로)
CREATE OR REPLACE FUNCTION public.calendar_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k jsonb := public._cal_conf();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_morning text := coalesce(k ->> 'event_morning', '08:30');
  v_eve text := coalesce(k ->> 'event_eve', '19:00');
  v_nudge text := coalesce(k ->> 'nudge_at', '20:00');
  v_quiet text := coalesce(k ->> 'quiet_after', '21:00');
  v_recap text := coalesce(k ->> 'recap_at', '19:30');
  r record;
  v_n integer;
  v_events integer := 0;
  v_sent integer := 0;
  v_total integer;
  v_done integer;
  v_uids uuid[] := '{}';
  v_titles text[] := '{}';
  v_bodies text[] := '{}';
  v_rc jsonb;
  v_ru uuid[] := '{}';
  v_rt text[] := '{}';
  v_rb text[] := '{}';
begin
  -- ① · ② 153 일정 — 일정마다 한 번 · 그 지점 알림 받는 회원 모두에게 한 문장으로 (승급 심사는 타이틀 레벨 회원만)
  if v_hm < v_quiet then
    for r in
      select e.id, e.branch_name, case when e.is_exam then 'exam' else e.kind end as kind, e.is_exam,
             e.title, e.start_on, e.end_on, false as eve
        from public.branch_calendar_events e
       where e.removed_at is null and e.notify_morning and e.morning_sent_at is null
         and e.start_on = v_today and v_hm >= v_morning
      union all
      select e.id, e.branch_name, case when e.is_exam then 'exam' else e.kind end as kind, e.is_exam,
             e.title, e.start_on, e.end_on, true as eve
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
        from public._cal_event_audience(r.branch_name) a
       where not r.is_exam or public._cal_title_level(a.user_id);
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
      -- (3-5) 내 일정 '이날은 쉬어요'인 날은 독려하지 않는다
      continue when public._cal_rest_on(r.user_id, v_today);
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

  -- ④ 일요일 주간 돌아보기 — 약속 시범 지점 회원 · 이번 주 한 번이라도 온 회원 · 끈 회원 빼고 · 일요일마다 한 번 (잘한 것만)
  if extract(isodow from (now() at time zone 'Asia/Seoul')) = 7 and v_hm >= v_recap and v_hm < v_quiet then
    for r in
      select p.user_id
        from public.profiles p
       where coalesce(p.is_approved, false)
         and public._promise_member(p.user_id) is not null
         and exists (select 1 from public.attendance_logs a
                      where a.user_id = p.user_id and not coalesce(a.is_duplicate, false)
                        and a.checked_in_at >= ((v_today - 6)::timestamp at time zone 'Asia/Seoul')
                        and a.checked_in_at < ((v_today + 1)::timestamp at time zone 'Asia/Seoul'))
         and not exists (select 1 from public.member_calendar_prefs cp
                          where cp.user_id = p.user_id and (not cp.weekly_recap or cp.last_recap_on = v_today))
    loop
      -- 먼저 표시하고 보낸다 — 두 바퀴가 겹쳐도 한 번
      insert into public.member_calendar_prefs as m (user_id, last_recap_on)
      values (r.user_id, v_today)
      on conflict (user_id) do update
         set last_recap_on = excluded.last_recap_on, updated_at = now()
       where m.weekly_recap and m.last_recap_on is distinct from excluded.last_recap_on;
      continue when not found;
      v_rc := public._cal_week_recap(r.user_id, v_today);
      continue when v_rc is null;
      v_ru := v_ru || r.user_id;
      v_rt := v_rt || (v_rc ->> 'title');
      v_rb := v_rb || (v_rc ->> 'body');
    end loop;
    if cardinality(v_ru) > 0 then
      insert into public.notifications (user_id, title, body, link)
      select u, tt, bb, '/home?cal=' || to_char(v_today, 'YYYY-MM-DD') from unnest(v_ru, v_rt, v_rb) as x(u, tt, bb);
    end if;
  end if;

  return jsonb_build_object('events', v_events, 'event_sent', v_sent, 'nudge', cardinality(v_uids), 'recap', cardinality(v_ru), 'hm', v_hm);
end
$function$;

-- (3-5 ⑥) 기분 스티커 20 (그 밖은 2-1 그대로)
CREATE OR REPLACE FUNCTION public.set_my_day_sticker(p_day date, p_sticker text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_st text := nullif(btrim(coalesce(p_sticker, '')), '');
  v_row public.member_check_days%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 6 then
    raise exception '오늘부터 6일 전까지만 고칠 수 있어요';
  end if;
  if v_st is not null and v_st not in ('strong', 'fire', 'proud', 'mitt', 'sweat', 'tired', 'hurt', 'rest',
                                       'best', 'party', 'energy', 'champ', 'focus', 'clap', 'laugh', 'stretch',
                                       'rope', 'together', 'perfect', 'thanks') then
    raise exception '스티커를 다시 골라 주세요';
  end if;

  insert into public.member_check_days as m (user_id, day, sticker)
  values (v_me, p_day, v_st)
  on conflict (user_id, day) do update
     set sticker = excluded.sticker, updated_at = now()
  returning * into v_row;

  return jsonb_build_object('day', v_row.day, 'done', to_jsonb(v_row.done), 'sticker', v_row.sticker);
end
$function$;


-- ═══════════════════════════ 6) 실행 권한 · 예약 ═══════════════════════════
-- 덧댄 함수(get_my_calendar · _cal_check_count · promise_tick · calendar_tick · set_my_day_sticker)는 create or replace 라 권한이 그대로다.
-- 새 함수만 맞춘다(Supabase 기본 권한으로 anon 이 부를 수 있는 틈을 안 남기게) — 안쪽 · 예약 함수 = 서버만 · 화면 함수 = authenticated.
revoke all on function public._my_cal_on(public.member_calendar_events, date) from public, anon, authenticated;
revoke all on function public._cal_rest_on(uuid, date) from public, anon, authenticated;
revoke all on function public._my_cal_event_json(public.member_calendar_events) from public, anon, authenticated;
revoke all on function public.member_cal_remind_tick(timestamp) from public, anon, authenticated;
revoke all on function public.set_my_cal_event(jsonb) from public, anon;
revoke all on function public.remove_my_cal_event(uuid, text, date) from public, anon;
revoke all on function public.search_my_calendar(text) from public, anon;
revoke all on function public.set_my_calendar_view(text[], text) from public, anon;
revoke all on function public.set_journal_entry_photos(uuid, text[]) from public, anon;
grant execute on function public.set_my_cal_event(jsonb) to authenticated;
grant execute on function public.remove_my_cal_event(uuid, text, date) to authenticated;
grant execute on function public.search_my_calendar(text) to authenticated;
grant execute on function public.set_my_calendar_view(text[], text) to authenticated;
grant execute on function public.set_journal_entry_photos(uuid, text[]) to authenticated;

-- 내 일정 알림 — 1분마다 · 끄기: select cron.unschedule('member-calendar-remind');
select cron.schedule('member-calendar-remind', '* * * * *', 'select public.member_cal_remind_tick()');
