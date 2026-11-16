-- 홈 「오늘의 1분 성장」 2단계 — 체육관으로 (선릉역점부터)
-- 2026-11-17 대표님 「다음진행」 (보고서 https://claude.ai/artifact/5tVEQmxgmzABfNwZaHibtq 「2단계. 체육관으로」 · 결정 ③ ④ ⑤)
--
-- 무엇을
--   ① 읽은 날 — 하루 한 줄(growth_read_days). 1단계 growth_reads 는 글마다 한 줄이라 '며칠 읽었나'를 정확히 셀 수 없었다.
--   ② 누적 도장 — 읽은 날이 10 · 30 · 100 · 365번째가 되는 날 축하 편지 한 통(growth_awards · 보상 없음 · 연속이 아니라 누적).
--   ③ 운동 달력 「오늘의 체크」 — 읽은 날이면 '1분 성장' 저절로 체크(금색 별에 셈 · check_from 날부터 · 그 앞 날은 예전 그대로).
--   ④ 코치 「오늘의 한마디」 — 수업에서 전했으면 한 번 누름(growth_coach_says · 의무 아님 · '한마디를 한 날'을 세려고).
--   ⑤ 월요일 요약 — 대표님 · 운영진께 지난주 읽은 회원 수 · 반응 좋은 글 한 줄(「영상으로 배우기」 월요일 요약과 같은 꼴).
--   TV 「오늘의 1분」은 앱이 번들 글로 그린다(DB 없음).
--
-- 기존 것
--   · growth_mark(1단계) = 운영 DB 의 지금 정의 위에 ③ 한 덩어리 + 답에 stamp 한 칸(예전 화면은 모르는 칸을 버린다).
--   · _cal_check_count(운동 달력 2-1 ~ 3-5) = 운영 DB 의 지금 정의 위에 '1분 성장' 한 칸 — 저녁 체크 알림 · 일요일 돌아보기의 별 수가 화면과 같게.
--   · get_my_calendar 는 고치지 않는다 — 화면이 get_my_growth 를 같이 읽어 붙인다(같은 함수를 여러 창이 덧대지 않게).
--   · 줄을 지우는 문장 없음.
--
-- 켠 지점 · 숫자 = app_settings 'growth_pilot' 한 줄 — 끄기 = branches 를 빈 배열로
--   (달력 체크 · 도장 · 코치 줄 · 요약의 지점 숫자가 조용해진다 · 읽은 날 기록은 전 지점에서 계속 쌓인다).
--   check_from = 이 파일을 적용한 다음 날(KST) — 그날부터 '1분 성장'이 그날의 체크에 든다(적용한 날 이미 받은 금색 별이 사라지지 않게).

-- 1) 설정 (한 번만 — 다시 적용해도 지금 값을 덮지 않는다)
insert into public.app_settings (key, value)
values (
  'growth_pilot',
  jsonb_build_object(
    'note', '오늘의 1분 성장 2단계 (2026-11-17 대표님 「다음진행」 · 선릉역점부터). branches = 켠 지점(빈 배열 = 끔) · check_from = 운동 달력 「오늘의 체크」에 1분 성장이 드는 첫날 · stamps = 누적 도장(읽은 날 n번째에 축하 편지 · 보상 없음).',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'check_from', to_char((now() at time zone 'Asia/Seoul')::date + 1, 'YYYY-MM-DD'),
    'stamps', jsonb_build_array(10, 30, 100, 365)
  )
)
on conflict (key) do nothing;

-- 2) 표 — 함수로만 읽고 쓴다
-- 읽은 날: 회원 · 날마다 한 줄 (그날 「오늘의 1분 성장」을 한 번이라도 열었다)
create table if not exists public.growth_read_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  member boolean not null default false,
  branch_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists growth_read_days_day_idx on public.growth_read_days (day);
alter table public.growth_read_days enable row level security;
revoke all on table public.growth_read_days from public, anon, authenticated;
comment on table public.growth_read_days is '오늘의 1분 성장 2단계 — 읽은 날(회원 · 날마다 한 줄). growth_mark 가 적는다. 운동 달력 체크 · 누적 도장 · 월요일 요약이 읽는다.';

-- 누적 도장: 읽은 날 n번째에 받은 축하 (보상 없음 · 편지 한 통)
create table if not exists public.growth_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  n integer not null check (n between 1 and 36500),
  reached_on date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, n)
);
alter table public.growth_awards enable row level security;
revoke all on table public.growth_awards from public, anon, authenticated;
comment on table public.growth_awards is '오늘의 1분 성장 2단계 — 누적 도장(읽은 날 10 · 30 · 100 · 365번째). get_my_growth · mark_my_growth_seen.';

-- 코치 「오늘의 한마디」: 지점 · 날 · 코치마다 한 줄 (다시 누르면 said 만 바꾼다 — 지우지 않는다)
create table if not exists public.growth_coach_says (
  branch_name text not null,
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  said boolean not null default true,
  said_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_name, day, user_id)
);
alter table public.growth_coach_says enable row level security;
revoke all on table public.growth_coach_says from public, anon, authenticated;
comment on table public.growth_coach_says is '오늘의 1분 성장 2단계 — 코치 「오늘의 한마디」를 수업에서 전한 날. growth_coach_state · growth_coach_say.';

-- 월요일 요약: 주마다 한 번
create table if not exists public.growth_weekly_log (
  week date primary key,
  sent_at timestamptz not null default now(),
  recipients integer,
  summary jsonb
);
alter table public.growth_weekly_log enable row level security;
revoke all on table public.growth_weekly_log from public, anon, authenticated;

-- 3) 1단계 기록에서 읽은 날 채우기 (처음 연 날 · 마지막으로 연 날 · 약속한 날 — 이미 있으면 그대로)
insert into public.growth_read_days (user_id, day, member, branch_name, created_at)
select r.user_id, d.day, bool_or(r.member), max(r.branch_name), min(r.created_at)
  from public.growth_reads r
  cross join lateral (values (r.opened_on), (r.last_opened_on), (r.acted_on)) as d(day)
 where d.day is not null
 group by r.user_id, d.day
on conflict (user_id, day) do nothing;

-- 4) 설정 읽기 (안쪽 함수 — 화면에서 부르지 않는다)
create or replace function public._growth_conf()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'growth_pilot'), '{}'::jsonb)
$$;

-- 켠 지점인가
create or replace function public._growth_branch_on(_branch text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _branch is not null and exists (
    select 1
      from jsonb_array_elements_text(
             case when jsonb_typeof(public._growth_conf() -> 'branches') = 'array'
                  then public._growth_conf() -> 'branches' else '[]'::jsonb end) b
     where b = _branch)
$$;

-- 켠 지점의 승인된 회원인가 (코치님 · 운영진 · 체험 계정 · 합쳐진 계정은 아님)
create or replace function public._growth_member(_uid uuid)
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
       and coalesce(p.is_approved, false)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and public._growth_branch_on(p.branch_name)
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
       )
  )
$$;

-- 운동 달력 체크에 1분 성장이 드는 첫날 (설정이 비었거나 날짜가 아니면 null = 안 듦)
create or replace function public._growth_check_from()
returns date
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v text := public._growth_conf() ->> 'check_from';
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return v::date;
exception when others then
  return null;
end $$;

-- 누적 도장 숫자 (작은 수부터 · 설정에 없으면 10 · 30 · 100 · 365)
create or replace function public._growth_stamps()
returns integer[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when jsonb_typeof(public._growth_conf() -> 'stamps') = 'array' then
      coalesce((select array_agg(distinct x::integer order by x::integer)
                  from jsonb_array_elements_text(public._growth_conf() -> 'stamps') x
                 where case when x ~ '^\d{1,5}$' then x::integer between 1 and 36500 else false end), '{}'::integer[])
    else array[10, 30, 100, 365]
  end
$$;

-- 그날의 체크에 1분 성장이 드는가 — 화면(get_my_growth 의 on · check_from)과 같은 식
create or replace function public._growth_check_on(_uid uuid, _day date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _day is not null
     and public._growth_member(_uid)
     and public._growth_check_from() is not null
     and _day >= public._growth_check_from()
$$;

revoke all on function public._growth_conf() from public, anon, authenticated;
revoke all on function public._growth_branch_on(text) from public, anon, authenticated;
revoke all on function public._growth_member(uuid) from public, anon, authenticated;
revoke all on function public._growth_check_from() from public, anon, authenticated;
revoke all on function public._growth_stamps() from public, anon, authenticated;
revoke all on function public._growth_check_on(uuid, date) from public, anon, authenticated;

-- 5) growth_mark — 운영 DB 의 지금 정의(1단계) 위에 ③ 읽은 날 · 누적 도장, 답에 stamp
create or replace function public.growth_mark(p_lesson text, p_date date, p_kind text, p_pick text default null, p_right boolean default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_lesson text := btrim(coalesce(p_lesson, ''));
  v_kind text := btrim(coalesce(p_kind, ''));
  v_pick text := upper(btrim(coalesce(p_pick, '')));
  v_no constant jsonb := jsonb_build_object('ok', false);
  v_n integer;
  v_has_row boolean := true;
  v_days integer;
  v_stamp integer;
begin
  if v_uid is null then return v_no; end if;
  if v_kind not in ('open', 'quiz', 'act', 'heart_on', 'heart_off') then return v_no; end if;
  if v_lesson !~ '^[a-z0-9][a-z0-9-]{1,39}$' then return v_no; end if;
  -- 글의 날: 첫 글(2026-10-27)부터 내일까지 (기기 시계가 조금 달라도 받게 하루 여유)
  if p_date is null or p_date < date '2026-10-27' or p_date > v_today + 1 then return v_no; end if;
  if v_kind = 'quiz' and v_pick not in ('O', 'X') then return v_no; end if;
  if not public._is_active_member(v_uid) then return v_no; end if;

  -- ① 줄이 없으면 만든다 (좋아요 취소만으로는 새 줄을 만들지 않는다)
  if not exists (select 1 from public.growth_reads r where r.user_id = v_uid and r.lesson_id = v_lesson) then
    if v_kind = 'heart_off' then
      v_has_row := false;
    else
      -- 새 줄 한도 — 하루 40줄 · 사람마다 2,000줄 (오늘 글 + 지난 7일이면 하루 8줄)
      select count(*) into v_n from public.growth_reads r
       where r.user_id = v_uid and r.created_at >= now() - interval '24 hours';
      if v_n >= 40 then return v_no; end if;
      select count(*) into v_n from public.growth_reads r where r.user_id = v_uid;
      if v_n >= 2000 then return v_no; end if;

      insert into public.growth_reads (user_id, lesson_id, lesson_date, opened_on, last_opened_on, member, branch_name)
      values (v_uid, v_lesson, p_date, v_today, v_today, public._is_rankable_member(v_uid),
              (select p.branch_name from public.profiles p where p.user_id = v_uid))
      on conflict (user_id, lesson_id) do nothing;
    end if;
  end if;

  -- ② 그 줄에 적는다 (방금 만든 줄은 last_opened_on = 오늘이라 연 날 수가 늘지 않는다)
  if v_has_row then
    update public.growth_reads r set
        open_days = case when v_kind = 'open' and r.last_opened_on < v_today then least(r.open_days + 1, 1000) else r.open_days end,
        last_opened_on = case when v_kind = 'open' and r.last_opened_on < v_today then v_today else r.last_opened_on end,
        quiz_pick = case when v_kind = 'quiz' and r.quiz_pick is null then v_pick else r.quiz_pick end,
        quiz_right = case when v_kind = 'quiz' and r.quiz_pick is null then p_right else r.quiz_right end,
        quiz_at = case when v_kind = 'quiz' and r.quiz_pick is null then now() else r.quiz_at end,
        acted_on = case when v_kind = 'act' then coalesce(r.acted_on, v_today) else r.acted_on end,
        heart = case when v_kind = 'heart_on' then true when v_kind = 'heart_off' then false else r.heart end,
        heart_at = case when v_kind in ('heart_on', 'heart_off') then now() else r.heart_at end,
        updated_at = now()
     where r.user_id = v_uid and r.lesson_id = v_lesson;
  end if;

  -- ③ (2단계) 읽은 날 — 하루 한 줄. 새 날이고 켠 지점 회원이면 누적 도장(읽은 날 10 · 30 · 100 · 365번째)
  if v_has_row and v_kind <> 'heart_off'
     and not exists (select 1 from public.growth_read_days d where d.user_id = v_uid and d.day = v_today) then
    insert into public.growth_read_days (user_id, day, member, branch_name)
    values (v_uid, v_today, public._is_rankable_member(v_uid),
            (select p.branch_name from public.profiles p where p.user_id = v_uid))
    on conflict (user_id, day) do nothing;
    if found and public._growth_member(v_uid) then
      select count(*) into v_days from public.growth_read_days d where d.user_id = v_uid;
      if v_days = any (public._growth_stamps()) then
        insert into public.growth_awards (user_id, n, reached_on) values (v_uid, v_days, v_today)
        on conflict (user_id, n) do nothing;
        if found then v_stamp := v_days; end if;
      end if;
    end if;
  end if;

  -- 좋아요 수 — 회원 줄만 · 5명이 넘을 때만 (그 아래는 null)
  select count(*) into v_n from public.growth_reads r where r.lesson_id = v_lesson and r.heart and r.member;
  return jsonb_build_object('ok', true, 'hearts', case when v_n > 5 then v_n end, 'stamp', v_stamp);
end $$;

revoke all on function public.growth_mark(text, date, text, text, boolean) from public, anon;
grant execute on function public.growth_mark(text, date, text, text, boolean) to authenticated;

-- 6) 내 읽은 날 · 누적 도장 (켠 지점 회원만 — 그 밖은 {on:false})
--    p_from · p_to 를 주면 그 사이 읽은 날도(운동 달력이 보이는 날짜 · 400일까지)
create or replace function public.get_my_growth(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_stamps integer[];
  v_days integer;
  v_next integer;
  v_unseen integer;
  v_read jsonb := '[]'::jsonb;
begin
  if v_uid is null or not public._growth_member(v_uid) then
    return jsonb_build_object('on', false);
  end if;
  v_stamps := public._growth_stamps();
  select count(*) into v_days from public.growth_read_days d where d.user_id = v_uid;
  select min(s) into v_next from unnest(v_stamps) s where s > v_days;
  select max(a.n) into v_unseen from public.growth_awards a where a.user_id = v_uid and a.seen_at is null;
  if p_from is not null and p_to is not null and p_to >= p_from then
    select coalesce(jsonb_agg(to_char(d.day, 'YYYY-MM-DD') order by d.day), '[]'::jsonb) into v_read
      from public.growth_read_days d
     where d.user_id = v_uid and d.day >= p_from and d.day <= least(p_to, p_from + 400);
  end if;
  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'days', v_days,
    'stamps', to_jsonb(v_stamps),
    'next', v_next,
    'unseen', v_unseen,
    'check_from', public._growth_check_from(),
    'read', v_read
  );
end $$;

revoke all on function public.get_my_growth(date, date) from public, anon;
grant execute on function public.get_my_growth(date, date) to authenticated;

-- 축하 편지를 봤다 (어느 기기에서도 한 번만)
create or replace function public.mark_my_growth_seen()
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
  update public.growth_awards set seen_at = now() where user_id = auth.uid() and seen_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.mark_my_growth_seen() from public, anon;
grant execute on function public.mark_my_growth_seen() to authenticated;

-- 7) _cal_check_count — 운영 DB 의 지금 정의 위에 '1분 성장' 한 칸 (그날의 체크에 드는 날 · 읽었으면 채움)
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
  ), g as (
    select public._growth_check_on(_uid, _day) as on_check,
           exists (select 1 from public.growth_read_days r where r.user_id = _uid and r.day = _day) as read
  )
  select
    ((case when x.closed and not x.gym then 0 else 1 end) + 2 + (select count(*) from items)
      + (case when g.on_check then 1 else 0 end))::integer as total,
    (x.gym::integer + x.cheer::integer + x.line::integer
      + (select count(*) from items, d where items.id = any (d.done))
      + (case when g.on_check and g.read then 1 else 0 end))::integer as done
    from x, g
$$;

revoke all on function public._cal_check_count(uuid, date) from public, anon, authenticated;

-- 8) 코치 「오늘의 한마디」 — 켠 지점 지도진 · 대표님 · 운영진 (오늘 만날 회원과 같은 사람)
create or replace function public._growth_coach_branch(_me uuid, p_branch text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_all boolean;
  v_branch text;
begin
  if _me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_all := public.has_role(_me, 'super_admin') or public.has_role(_me, 'admin');
  v_branch := coalesce(nullif(btrim(p_branch), ''), (select p.branch_name from public.profiles p where p.user_id = _me));
  if not v_all and (v_branch is null or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = _me)) then
    raise exception '지점 지도진만 볼 수 있어요' using errcode = '42501';
  end if;
  return v_branch;
end $$;

create or replace function public._growth_coach_json(_me uuid, _branch text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'on', true,
    'branch', _branch,
    'today', t.day,
    'mine', exists (select 1 from public.growth_coach_says s
                     where s.branch_name = _branch and s.day = t.day and s.user_id = _me and s.said),
    'count', (select count(*) from public.growth_coach_says s
               where s.branch_name = _branch and s.day = t.day and s.said))
    from (select (now() at time zone 'Asia/Seoul')::date as day) t
$$;

create or replace function public.growth_coach_state(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_branch text := public._growth_coach_branch(v_me, p_branch);
begin
  if not public._growth_branch_on(v_branch) then
    return jsonb_build_object('on', false, 'branch', v_branch);
  end if;
  return public._growth_coach_json(v_me, v_branch);
end $$;

-- 수업에서 전했어요 · 취소 (오늘 칸만 · 다시 눌러도 한 줄)
create or replace function public.growth_coach_say(p_branch text default null, p_on boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_branch text := public._growth_coach_branch(v_me, p_branch);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public._growth_branch_on(v_branch) then
    return jsonb_build_object('on', false, 'branch', v_branch);
  end if;
  insert into public.growth_coach_says as s (branch_name, day, user_id, said)
  values (v_branch, v_today, v_me, coalesce(p_on, true))
  on conflict (branch_name, day, user_id)
  do update set said = excluded.said,
                said_at = case when excluded.said and not s.said then now() else s.said_at end,
                updated_at = now();
  return public._growth_coach_json(v_me, v_branch);
end $$;

revoke all on function public._growth_coach_branch(uuid, text) from public, anon, authenticated;
revoke all on function public._growth_coach_json(uuid, text) from public, anon, authenticated;
revoke all on function public.growth_coach_state(text) from public, anon;
grant execute on function public.growth_coach_state(text) to authenticated;
revoke all on function public.growth_coach_say(text, boolean) from public, anon;
grant execute on function public.growth_coach_say(text, boolean) to authenticated;

-- 9) 월요일 요약 — 지난주(월 ~ 일 · 한국) 읽은 회원 수 · 반응 좋은 글 한 줄 → 대표님 · 운영진 알림 한 통씩
--    글 제목은 앱에만 있어 날짜와 요일 코너로 말한다(코너 이름 = 앱 GROWTH_CORNERS · 0 = 일요일). 링크를 누르면 그 글이 열린다.
create or replace function public._growth_day_label(_day date)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select to_char(_day, 'FMMM/FMDD') || '(' || (array['일', '월', '화', '수', '목', '금', '토'])[extract(dow from _day)::integer + 1] || ') '
      || (array['한 주 돌아보기', '이번 주 한 가지', '복싱 상식 O/X', '기술 한 끗', '몸이 받는 선물', '링 위의 이야기', '집에서 1분'])[extract(dow from _day)::integer + 1]
$$;

create or replace function public._growth_weekly()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_monday date := v_today - (extract(isodow from v_today)::integer - 1);
  v_since date := v_monday - 7;
  v_until date := v_monday - 1;
  v_all integer := 0;
  v_pilot integer := 0;
  v_branches text[];
  v_top_day date;
  v_top_n integer;
  v_heart_day date;
  v_heart_n integer;
  v_quiz integer := 0;
  v_right integer := 0;
  v_acts integer := 0;
  v_coach integer := 0;
  v_parts text[] := '{}';
  v_title text;
  v_body text;
  v_link text;
  v_sent integer := 0;
begin
  -- 주마다 한 번 — 같은 주를 다시 부르면 그대로 끝
  insert into public.growth_weekly_log (week) values (v_since) on conflict (week) do nothing;
  if not found then return jsonb_build_object('ok', true, 'week', v_since, 'skipped', true); end if;

  select coalesce(array_agg(b), '{}'::text[]) into v_branches
    from jsonb_array_elements_text(
           case when jsonb_typeof(public._growth_conf() -> 'branches') = 'array'
                then public._growth_conf() -> 'branches' else '[]'::jsonb end) b;

  -- 읽은 회원 (회원 줄만 · 사람 수) — 전 지점 · 켠 지점
  select count(distinct d.user_id), count(distinct d.user_id) filter (where d.branch_name = any (v_branches))
    into v_all, v_pilot
    from public.growth_read_days d
   where d.member and d.day >= v_since and d.day <= v_until;

  -- 지난주 글 가운데 가장 많이 읽은 글 · 좋아요가 가장 많은 글
  select r.lesson_date, count(*)::integer into v_top_day, v_top_n
    from public.growth_reads r
   where r.member and r.lesson_date >= v_since and r.lesson_date <= v_until
   group by r.lesson_id, r.lesson_date
   order by count(*) desc, r.lesson_date
   limit 1;
  select r.lesson_date, count(*)::integer into v_heart_day, v_heart_n
    from public.growth_reads r
   where r.member and r.heart and r.lesson_date >= v_since and r.lesson_date <= v_until
   group by r.lesson_id, r.lesson_date
   order by count(*) desc, r.lesson_date
   limit 1;

  -- O/X 를 푼 회원 · 맞힌 회원 (지난주 글) · 「해 볼게요」 · 코치 한마디를 전한 날(켠 지점)
  select count(*)::integer, (count(*) filter (where r.quiz_right))::integer into v_quiz, v_right
    from public.growth_reads r
   where r.member and r.quiz_pick is not null and r.lesson_date >= v_since and r.lesson_date <= v_until;
  select count(*)::integer into v_acts
    from public.growth_reads r
   where r.member and r.acted_on >= v_since and r.acted_on <= v_until;
  select count(distinct s.day)::integer into v_coach
    from public.growth_coach_says s
   where s.said and s.day >= v_since and s.day <= v_until and s.branch_name = any (v_branches);

  if v_all = 0 and v_coach = 0 then
    update public.growth_weekly_log set recipients = 0, summary = jsonb_build_object('empty', true) where week = v_since;
    return jsonb_build_object('ok', true, 'week', v_since, 'sent', 0, 'empty', true);
  end if;

  if coalesce(array_length(v_branches, 1), 0) = 1 and v_pilot > 0 then
    v_parts := v_parts || (regexp_replace(v_branches[1], '^153복싱짐\s*', '') || ' ' || v_pilot || '명');
  end if;
  if v_top_day is not null then
    v_parts := v_parts || ('많이 읽은 글 ' || public._growth_day_label(v_top_day) || ' ' || v_top_n || '명');
  end if;
  if v_heart_day is not null then
    v_parts := v_parts || ('좋아요 많은 글 ' || public._growth_day_label(v_heart_day) || ' ' || v_heart_n || '명');
  end if;
  if v_quiz > 0 then
    v_parts := v_parts || ('O/X ' || v_quiz || '명 중 ' || v_right || '명 맞힘');
  end if;
  if v_acts > 0 then
    v_parts := v_parts || ('「해 볼게요」 ' || v_acts || '번');
  end if;
  if v_coach > 0 then
    v_parts := v_parts || ('코치 한마디 ' || v_coach || '일');
  end if;

  v_title := '📖 지난주 오늘의 1분 성장' || case when v_all > 0 then ' · 회원 ' || v_all || '명이 읽었어요' else '' end;
  v_body := left(coalesce(nullif(array_to_string(v_parts, ' · '), ''), '지난주 글을 읽은 회원이 있어요'), 300);
  v_link := '/home?growth=' || coalesce(to_char(coalesce(v_heart_day, v_top_day), 'YYYY-MM-DD'), '1');
  insert into public.notifications (user_id, title, body, link)
  select distinct ur.user_id, v_title, v_body, v_link
    from public.user_roles ur
   where ur.role::text in ('super_admin', 'admin');
  get diagnostics v_sent = row_count;
  update public.growth_weekly_log
     set recipients = v_sent,
         summary = jsonb_build_object('title', v_title, 'body', v_body, 'link', v_link,
                                      'readers', v_all, 'pilot_readers', v_pilot, 'quiz', v_quiz, 'right', v_right,
                                      'acts', v_acts, 'coach_days', v_coach)
   where week = v_since;
  return jsonb_build_object('ok', true, 'week', v_since, 'sent', v_sent, 'title', v_title, 'body', v_body, 'link', v_link);
end $$;

revoke all on function public._growth_day_label(date) from public, anon, authenticated;
revoke all on function public._growth_weekly() from public, anon, authenticated;

-- 월요일 08:43 KST (= 일요일 23:43 UTC · 같은 이름이면 pg_cron 이 바꾼다 · 끄기 select cron.unschedule('growth-weekly');)
select cron.schedule('growth-weekly', '43 23 * * 0', $$select public._growth_weekly()$$);
