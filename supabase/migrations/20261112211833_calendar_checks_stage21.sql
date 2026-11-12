-- ✅ 운동 달력 2-1단계 — 오늘의 체크(저절로) · 나만의 체크 · 그날 스티커 · 금색 별
--   (2026-11-12 대표님 「추천대로」 — 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b ·
--    선릉역점 봄 회원님 11/11 제안: 앱 활동을 하면 저절로 체크되는 체크리스트(퀘스트 깨는 기분) · 내가 고르는 체크리스트
--    (잽 연습 몇 번) · 오늘 운동한 걸 간단히 기록)
--
--   · 오늘의 체크(저절로) = 이미 DB 에 남는 행동만 읽는다 — 체육관(출석: 화면이 get_attendance_history 로) ·
--     응원(boxing_cheers 에서 보낸 것 또는 community_reactions 의 153) · 한 줄(champion_journal_entries kind journal).
--     오삼코치 브리핑은 읽은 기록이 어디에도 남지 않아 넣지 않았다.
--   · 나만의 체크 = 새 표 member_check_items (회원마다 3개까지 · 지우지 않고 archived_at).
--     그날 한 체크 · 그날 스티커 = 새 표 member_check_days (회원 · 날짜마다 한 줄).
--   · 금색 별(그날 체크를 다 채운 날)은 화면이 센다(src/lib/calendarChecks.ts) — 보상 없음(대표님 결정: 별만).
--   · 고치기는 오늘부터 6일 전까지만(기억해서 적는 기록) · 앞날은 안 된다. 놓친 체크는 어디에도 표시하지 않는다(화면).
--   · 쓰는 사람 = 승인된 회원 · 지도진(_is_active_member — 새 회원용 함수 규칙).
--   · 새 표 2 · 새 함수만 — 기존 함수 · 표 · 트리거 · 제약은 그대로. 표는 함수로만(본인 것만).

-- 1) 표 — 나만의 체크 항목 (회원마다 3개까지)
create table if not exists public.member_check_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  target integer,
  unit text,
  weekdays smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint member_check_items_label_chk check (char_length(label) between 1 and 20),
  constraint member_check_items_target_chk check (target is null or target between 1 and 9999),
  constraint member_check_items_unit_chk check (unit is null or unit in ('번', '분', '라운드', '세트', 'km', '개')),
  constraint member_check_items_weekdays_chk
    check (weekdays is null or (cardinality(weekdays) between 1 and 6 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]))
);
create index if not exists member_check_items_user_idx on public.member_check_items (user_id, created_at);
alter table public.member_check_items enable row level security;
revoke all on table public.member_check_items from anon, authenticated;
comment on table public.member_check_items is '운동 달력 나만의 체크 — 회원이 만든 항목(잽 100번 · 줄넘기 10분 …) 3개까지 · weekdays null = 매일 · 지우지 않고 archived_at. 함수로만(get_my_calendar · set_my_check_item · remove_my_check_item · set_my_check_done).';

-- 2) 표 — 그날 한 체크 · 그날 스티커 (회원 · 날짜마다 한 줄)
create table if not exists public.member_check_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  done uuid[] not null default '{}'::uuid[],
  sticker text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint member_check_days_done_chk check (cardinality(done) <= 10),
  constraint member_check_days_sticker_chk
    check (sticker is null or sticker in ('strong', 'fire', 'proud', 'mitt', 'sweat', 'tired', 'hurt', 'rest'))
);
alter table public.member_check_days enable row level security;
revoke all on table public.member_check_days from anon, authenticated;
comment on table public.member_check_days is '운동 달력 그날 기록 — 한 나만의 체크(done = member_check_items.id) · 기분 스티커 하나. 함수로만(get_my_calendar · set_my_check_done · set_my_day_sticker).';

-- 3) 안쪽 함수 — 지금 나만의 체크 목록 (저장 · 빼기 뒤 돌려줌)
create or replace function public._my_check_items(_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'label', i.label, 'target', i.target, 'unit', i.unit,
           'weekdays', to_jsonb(i.weekdays),
           'created_on', (i.created_at at time zone 'Asia/Seoul')::date,
           'archived_on', null)
         order by i.created_at), '[]'::jsonb)
    from public.member_check_items i
   where i.user_id = _uid and i.archived_at is null
$$;

-- 4) 회원 화면 — 보이는 날짜(달력 한 화면 · 63일까지)의 체크 · 한 줄 · 스티커 + 나만의 체크 항목
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

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'days', v_days);
end
$$;

-- 5) 나만의 체크 만들기 · 고치기 — 3개까지 · 목표 숫자 없으면 단위도 없음 · 요일 7개 = 매일(null)
create or replace function public.set_my_check_item(
  p_id uuid default null,
  p_label text default null,
  p_target integer default null,
  p_unit text default null,
  p_weekdays integer[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_label text := nullif(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), '');
  v_unit text := case when p_target is null then null else nullif(btrim(coalesce(p_unit, '')), '') end;
  v_days smallint[];
  v_n integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if v_label is null then
    raise exception '체크 이름을 적어 주세요';
  end if;
  if char_length(v_label) > 20 then
    raise exception '체크 이름은 20자 안으로 적어 주세요';
  end if;
  if p_target is not null and (p_target < 1 or p_target > 9999) then
    raise exception '목표 숫자는 1부터 9,999까지 적어 주세요';
  end if;
  if v_unit is not null and v_unit not in ('번', '분', '라운드', '세트', 'km', '개') then
    raise exception '단위를 다시 골라 주세요';
  end if;
  if p_weekdays is not null then
    if exists (select 1 from unnest(p_weekdays) d where d is null or d < 0 or d > 6) then
      raise exception '요일을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(x order by x), '{}'::smallint[]) into v_days
      from (select distinct d::smallint as x from unnest(p_weekdays) d) s;
    if cardinality(v_days) = 0 then
      raise exception '요일을 하나 이상 골라 주세요';
    end if;
    if cardinality(v_days) = 7 then
      v_days := null;
    end if;
  end if;

  if p_id is null then
    -- 동시에 두 번 눌러도 3개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-check-items:' || v_me::text));
    select count(*)::integer into v_n from public.member_check_items where user_id = v_me and archived_at is null;
    if v_n >= 3 then
      raise exception '나만의 체크는 3개까지 만들 수 있어요';
    end if;
    insert into public.member_check_items (user_id, label, target, unit, weekdays)
    values (v_me, v_label, p_target, v_unit, v_days);
  else
    update public.member_check_items
       set label = v_label, target = p_target, unit = v_unit, weekdays = v_days, updated_at = now()
     where id = p_id and user_id = v_me and archived_at is null;
    if not found then
      raise exception '체크를 찾지 못했어요';
    end if;
  end if;
  return jsonb_build_object('items', public._my_check_items(v_me));
end
$$;

-- 6) 나만의 체크 빼기 — 지우지 않고 archived_at (지난 날 기록은 그대로)
create or replace function public.remove_my_check_item(p_id uuid)
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
  update public.member_check_items
     set archived_at = now(), updated_at = now()
   where id = p_id and user_id = v_me and archived_at is null;
  if not found then
    raise exception '체크를 찾지 못했어요';
  end if;
  return jsonb_build_object('items', public._my_check_items(v_me));
end
$$;

-- 7) 나만의 체크 했어요 · 취소 — 오늘부터 6일 전까지 · 그날 있던 항목 · 그 요일 항목만
create or replace function public.set_my_check_done(p_day date, p_item uuid, p_done boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_item public.member_check_items%rowtype;
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
  select * into v_item from public.member_check_items where id = p_item and user_id = v_me;
  if not found then
    raise exception '체크를 찾지 못했어요';
  end if;
  if (v_item.created_at at time zone 'Asia/Seoul')::date > p_day
     or (v_item.archived_at is not null and (v_item.archived_at at time zone 'Asia/Seoul')::date <= p_day)
     or (v_item.weekdays is not null and not (extract(dow from p_day)::smallint = any (v_item.weekdays))) then
    raise exception '이날의 체크가 아니에요';
  end if;

  insert into public.member_check_days as m (user_id, day, done)
  values (v_me, p_day, case when coalesce(p_done, true) then array[p_item] else '{}'::uuid[] end)
  on conflict (user_id, day) do update
     set done = case
                  when coalesce(p_done, true) then
                    (select coalesce(array_agg(distinct x), '{}'::uuid[]) from unnest(m.done || p_item) x)
                  else array_remove(m.done, p_item)
                end,
         updated_at = now()
  returning * into v_row;

  return jsonb_build_object('day', v_row.day, 'done', to_jsonb(v_row.done), 'sticker', v_row.sticker);
end
$$;

-- 8) 그날 기분 스티커 — 오늘부터 6일 전까지 · 하나만(null = 빼기)
create or replace function public.set_my_day_sticker(p_day date, p_sticker text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
  if v_st is not null and v_st not in ('strong', 'fire', 'proud', 'mitt', 'sweat', 'tired', 'hurt', 'rest') then
    raise exception '스티커를 다시 골라 주세요';
  end if;

  insert into public.member_check_days as m (user_id, day, sticker)
  values (v_me, p_day, v_st)
  on conflict (user_id, day) do update
     set sticker = excluded.sticker, updated_at = now()
  returning * into v_row;

  return jsonb_build_object('day', v_row.day, 'done', to_jsonb(v_row.done), 'sticker', v_row.sticker);
end
$$;

-- 9) 권한 — 화면은 get_my_calendar · set_my_check_item · remove_my_check_item · set_my_check_done · set_my_day_sticker 만
revoke all on function public._my_check_items(uuid) from public, anon, authenticated;
revoke all on function public.get_my_calendar(date, date) from public, anon;
revoke all on function public.set_my_check_item(uuid, text, integer, text, integer[]) from public, anon;
revoke all on function public.remove_my_check_item(uuid) from public, anon;
revoke all on function public.set_my_check_done(date, uuid, boolean) from public, anon;
revoke all on function public.set_my_day_sticker(date, text) from public, anon;
grant execute on function public.get_my_calendar(date, date) to authenticated;
grant execute on function public.set_my_check_item(uuid, text, integer, text, integer[]) to authenticated;
grant execute on function public.remove_my_check_item(uuid) to authenticated;
grant execute on function public.set_my_check_done(date, uuid, boolean) to authenticated;
grant execute on function public.set_my_day_sticker(date, text) to authenticated;
