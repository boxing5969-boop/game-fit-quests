-- 📅 운동 달력 2-3단계 — 그날 한 일 · 153 D-day · 153 기념일 · 코치 한마디 도장 (+ 화면: 좌우로 밀기 · 길게 눌러 넣기)
--   (2026-11-13 대표님 「다음」 — 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b 2-3)
--
--   감정 설계(CLAUDE.md 「회원 감정 설계 기준」 — 끝났을 때 = 뿌듯함 · 들어올 때 = 환영 · 한 달 = 확신):
--     · 그날 한 일 = DB 에 이미 있는 기록만 — PT 수업(ops_pt_sessions lesson) · 153 PB(test153_records official) ·
--       타이틀매치(title_match_attempts) · 레벨업(level_status_history approved). 달력 칸 왼쪽 위 아이콘 · 그날 카드 한 줄씩.
--       타이틀매치는 통과 = '통과', 그 밖 = '도전했어요'(못한 말 없이 · 153 성장 순서 도전 → 다시 도전).
--     · 153 D-day = 내가 정한 목표일(member_goal_days · 3개까지) · 153 PB 다시 재는 날(마지막 공식 기록 + 42일 —
--       get_my_fitness_profile next_test_on 과 같은 수) · 153 기념일(30일 안) · 승급 심사(153 일정 '승급 심사' — 타이틀 레벨 회원에게만) ·
--       타이틀매치 다시 도전할 수 있는 날(title_match_retry_at_for).
--     · 153 기념일 = 153 등록일(profiles.gym_reg_date — 30명 넘게 같은 날로 옮겨 담긴 날은 '모름')로 'n주년',
--       등록일을 모르면 첫 도장(첫 출석) 날로 '첫 도장 n주년'. 100번째 출석은 출석 축하 금색 도장이 이미 있다.
--       코치 「오늘 만날 회원」에 '오늘 1주년' · '출석 100번째'(그날 채운 출석 축하) 칩.
--     · 코치 한마디 도장 = 코치님이 「오늘 만날 회원」에서 그 회원 오늘 칸에 한 줄(80자 · 의무 아님 · 하루 상한 없음 —
--       대표님 결정) → 회원 달력에 코치님 이름 + 한 줄 + 알림 한 번(고쳐도 다시 안 감 · 밤 10시 ~ 아침 8시는 알림함에만).
--       「오늘 만날 회원」에 '오늘 온 다른 회원'(접힘)도 보내 누구에게나 남길 수 있다.
--   · 153 일정 '승급 심사' — 표의 kind 검사를 바꾸지 않고(지우는 문장 없이) kind 'event' + is_exam 으로 담는다.
--     화면 · 함수에는 kind 'exam' 으로 보인다. 알림은 타이틀 레벨(레벨 10) 회원에게만 — '내일 승급 심사가 있어요'.
--   · 새 표 2 · 새 칸 1 · 새 함수. 고친 함수(이름 · 인자 · 권한 그대로): get_my_calendar(+ acts · notes · anniv · ddays · 일정 exam) ·
--     ops_meet_today(+ 1주년 · 출석 축하 칩 · 한마디 · 오늘 온 다른 회원) · ops_cal_event_save · ops_cal_events · calendar_tick ·
--     _cal_event_notice_title('승급 심사').
--   · 출석 표에는 트리거를 달지 않는다(보호 영역). 기존 표 · 제약 · 다른 함수는 그대로.
--   · 끄기: 코치 한마디 = 화면 단추만(서버는 「오늘 만날 회원」이 켜진 지점 — promise_pilot.branches) · D-day · 기념일은 회원 화면 표시만.

-- 1) 설정 — 코치 한마디 알림 조용한 시간 · 등록일 '옮겨 담은 날' 기준 (있는 값은 그대로 두고 빈 칸만)
update public.app_settings
   set value = jsonb_build_object(
                 'note_stage23', '운동 달력 2-3단계 (2026-11-13). note_quiet_from ~ note_quiet_until = 코치 한마디 알림을 휴대폰으로 보내지 않는 시간(알림함에는 들어감) · reg_bulk_min = 이만큼 넘는 회원이 같은 153 등록일이면 옮겨 담은 날로 보고 기념일에 쓰지 않음.',
                 'note_quiet_from', '22:00',
                 'note_quiet_until', '08:00',
                 'reg_bulk_min', 30
               ) || coalesce(value, '{}'::jsonb),
       updated_at = now()
 where key = 'calendar_notice'
   and not (coalesce(value, '{}'::jsonb) ? 'note_stage23');

-- 2) 표 — 내가 정한 목표일 (3개까지 · 지우지 않고 removed_at)
create table if not exists public.member_goal_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint member_goal_days_title_chk check (char_length(title) between 1 and 20)
);
create index if not exists member_goal_days_user_idx on public.member_goal_days (user_id, day) where removed_at is null;
alter table public.member_goal_days enable row level security;
revoke all on table public.member_goal_days from anon, authenticated;
comment on table public.member_goal_days is '운동 달력 153 D-day — 회원이 정한 목표일(내일부터 2년 안 · 3개까지 · 이름 20자). 함수로만(get_my_calendar · set_my_goal_day · remove_my_goal_day).';

-- 표 — 코치 한마디 도장 (회원 · 날 · 코치마다 한 줄 · 고치면 덮어씀 · 빼기 = removed_at)
create table if not exists public.coach_day_notes (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  branch_name text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  notified_at timestamptz,
  constraint coach_day_notes_body_chk check (char_length(body) between 1 and 80),
  constraint coach_day_notes_one unique (member_user_id, day, coach_user_id)
);
create index if not exists coach_day_notes_branch_idx on public.coach_day_notes (branch_name, day);
alter table public.coach_day_notes enable row level security;
revoke all on table public.coach_day_notes from anon, authenticated;
comment on table public.coach_day_notes is '운동 달력 코치 한마디 도장 — 코치님(그 지점 지도진 · 대표님)이 「오늘 만날 회원」에서 그 회원 오늘 칸에 남긴 한 줄(80자). 회원 · 날 · 코치마다 한 줄, 알림은 처음 한 번(notified_at). 함수로만(coach_day_note_save · coach_day_note_remove · get_my_calendar · ops_meet_today).';

-- 칸 — 153 일정 '승급 심사' (kind 검사는 그대로 두고 kind 'event' + is_exam)
alter table public.branch_calendar_events add column if not exists is_exam boolean not null default false;
comment on column public.branch_calendar_events.is_exam is '153 일정 승급 심사(2-3단계) — 저장은 kind event + is_exam true, 화면 · 함수에는 kind exam. 알림은 타이틀 레벨(레벨 10) 회원에게만.';

-- 3) 안쪽 함수 (화면에서 부르지 않음)

-- 153 등록일 — 믿을 수 있을 때만 (같은 날로 reg_bulk_min 명 넘게 들어온 날 = 옮겨 담은 날 → 모름)
create or replace function public._cal_reg_day(_uid uuid)
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.gym_reg_date
    from public.profiles p
   where p.user_id = _uid
     and p.gym_reg_date is not null
     and p.gym_reg_date <= (now() at time zone 'Asia/Seoul')::date
     and (select count(*) from public.profiles x where x.gym_reg_date = p.gym_reg_date)
         < greatest(2, coalesce((public._cal_conf() ->> 'reg_bulk_min')::integer, 30))
$$;

-- 첫 도장(첫 출석) 날
create or replace function public._cal_first_day(_uid uuid)
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select min((a.checked_in_at at time zone 'Asia/Seoul')::date)
    from public.attendance_logs a
   where a.user_id = _uid and not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
$$;

-- 기념일 기준 날 — 등록일이 첫 도장보다 앞이거나 같으면 등록일('reg'), 아니면 첫 도장('stamp')
create or replace function public._cal_anchor_of(_reg date, _first date)
returns table(day date, basis text)
language sql
immutable
set search_path to 'public'
as $$
  select least(_reg, _first),
         case when _reg is not null and (_first is null or _reg <= _first) then 'reg' else 'stamp' end
   where coalesce(_reg, _first) is not null
$$;

create or replace function public._cal_anchor(_uid uuid)
returns table(day date, basis text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.day, a.basis from public._cal_anchor_of(public._cal_reg_day(_uid), public._cal_first_day(_uid)) a
$$;

-- 그날이 기념일이면 몇 주년 (2/29 기준은 평년 2/28)
create or replace function public._cal_anniv_years(_anchor date, _day date)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select t.y
    from (select (extract(year from _day) - extract(year from _anchor))::integer as y) t
   where _anchor is not null and _day is not null and t.y >= 1
     and (_anchor + make_interval(years => t.y))::date = _day
$$;

-- 지도진 이름 · 직함 (회원 달력 · 알림에 '○○ 코치님')
create or replace function public._cal_staff_who(_uid uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''))
                     from public.profiles p where p.user_id = _uid), '코치')
$$;

create or replace function public._cal_staff_title(_uid uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select nullif(btrim(p.staff_title), '') from public.profiles p where p.user_id = _uid),
    case when public.has_role(_uid, 'super_admin') then '대표'
         when public.has_role(_uid, 'admin') then '운영진'
         else '코치' end)
$$;

-- 타이틀 레벨(리그 레벨 10 — 타이틀매치 차례)인가
create or replace function public._cal_title_level(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select coalesce(mp.current_level, 1) = 10 from public.member_progress mp where mp.user_id = _uid), false)
$$;

-- 코치 한마디를 남길 수 있나 → 그 회원 지점 (못 하면 null)
--   회원 = 「오늘 만날 회원」이 켜진 지점(promise_pilot)의 승인된 회원(코치님 · 운영진 · 체험 · 합쳐진 계정 빼고)
--   남기는 분 = 그 지점 지도진(_strategy_branch_staff) 또는 대표님(_strategy_hq)
create or replace function public._cal_note_branch(_coach uuid, _member uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.branch_name
    from public.profiles p
   where p.user_id = _member
     and _coach is not null and _coach <> _member
     and coalesce(p.is_approved, false)
     and not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and p.merged_into is null
     and not exists (
       select 1 from public.user_roles r
        where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin'))
     and public._promise_branch_on(p.branch_name)
     and (public._strategy_hq(_coach)
          or exists (select 1 from public._strategy_branch_staff(p.branch_name) s where s.user_id = _coach))
$$;

-- 그 회원 그날 한마디 목록 (보는 사람 기준 mine)
create or replace function public._cal_day_notes(_member uuid, _day date, _viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'who', public._cal_staff_who(n.coach_user_id),
           'title', public._cal_staff_title(n.coach_user_id),
           'body', n.body,
           'mine', n.coach_user_id = _viewer,
           'at', n.updated_at)
         order by n.created_at), '[]'::jsonb)
    from public.coach_day_notes n
   where n.member_user_id = _member and n.day = _day and n.removed_at is null
$$;

-- 153 D-day — 목표일 · 153 PB 다시 재는 날 · 기념일(30일 안) · 승급 심사(타이틀 레벨 · 60일 안) · 타이틀매치 다시 도전 (가까운 날 순)
create or replace function public._cal_ddays(_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_out jsonb := '[]'::jsonb;
  v_pb date;
  v_branch text;
  v_rank text;
  v_retry timestamptz;
  r record;
begin
  if _uid is null then
    return v_out;
  end if;

  -- 내가 정한 목표일
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'goal', 'id', g.id, 'day', g.day, 'title', g.title)
                            order by g.day, g.created_at), '[]'::jsonb)
    into v_out
    from public.member_goal_days g
   where g.user_id = _uid and g.removed_at is null and g.day >= v_today;

  -- 153 PB 다시 재는 날 — 마지막 공식 기록 + 42일 (지났으면 그날 그대로 · 화면은 '다시 잴 때예요')
  select (max(t.measured_at) at time zone 'Asia/Seoul')::date + 42 into v_pb
    from public.test153_records t
   where t.user_id = _uid and t.official;
  if v_pb is not null then
    v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'pb', 'day', v_pb));
  end if;

  -- 153 기념일 — 30일 안의 다음 기념일
  for r in
    select (a.day + make_interval(years => g))::date as d, g as years, a.basis
      from public._cal_anchor(_uid) a, generate_series(1, 80) g
     where (a.day + make_interval(years => g))::date between v_today and v_today + 30
     order by 1
     limit 1
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'anniv', 'day', r.d, 'years', r.years, 'basis', r.basis));
  end loop;

  -- 승급 심사 — 타이틀 레벨 회원에게만 · 내 지점 '승급 심사' 153 일정 중 60일 안의 가장 가까운 것
  select p.branch_name into v_branch from public.profiles p where p.user_id = _uid;
  if v_branch is not null and public._cal_title_level(_uid) then
    for r in
      select e.id, greatest(e.start_on, v_today) as d, e.title
        from public.branch_calendar_events e
       where e.branch_name = v_branch and e.removed_at is null and e.is_exam
         and e.end_on >= v_today and e.start_on <= v_today + 60
       order by e.start_on, e.created_at
       limit 1
    loop
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'exam', 'id', r.id, 'day', r.d, 'title', r.title));
    end loop;
  end if;

  -- 타이틀매치 다시 도전할 수 있는 날
  select mp.current_rank::text into v_rank from public.member_progress mp where mp.user_id = _uid;
  if v_rank is not null then
    v_retry := public.title_match_retry_at_for(_uid, v_rank::rank_name);
    if v_retry is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'retry', 'day', (v_retry at time zone 'Asia/Seoul')::date));
    end if;
  end if;

  return coalesce((select jsonb_agg(x order by (x ->> 'day'), (x ->> 'kind')) from jsonb_array_elements(v_out) x), '[]'::jsonb);
end
$$;

-- 153 일정 알림 제목 — 그날 아침 · 하루 전 저녁 (+ 승급 심사)
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
           when 'exam' then ' 승급 심사가 있어요'
           when 'class' then ' 특강이 있어요'
           else ' 153 일정이 있어요'
         end
$$;

-- 4) 운영본부 「일정」 탭 — 회원 달력 153 일정 (+ 승급 심사는 kind exam 으로)
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
           'id', e.id, 'kind', case when e.is_exam then 'exam' else e.kind end,
           'title', e.title, 'start_on', e.start_on, 'end_on', e.end_on,
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

-- 153 일정 올리기 · 고치기 (+ 승급 심사 = kind 'exam' → 저장은 event + is_exam) — 날짜가 바뀌면 알림을 새 날짜로 다시
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
  v_exam boolean;
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
  if v_kind is null or v_kind not in ('closed', 'short', 'event', 'match', 'exam', 'class', 'etc') then
    raise exception '종류를 골라 주세요';
  end if;
  v_exam := v_kind = 'exam';
  if v_exam then
    v_kind := 'event';
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
      (branch_name, kind, is_exam, title, start_on, end_on, notify_morning, notify_eve, created_by, updated_by)
    values
      (v_branch, v_kind, v_exam, v_title, p_start, v_end, coalesce(p_notify_morning, true), coalesce(p_notify_eve, false), v_me, v_me);
  else
    update public.branch_calendar_events
       set kind = v_kind,
           is_exam = v_exam,
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

-- 5) 회원 화면 — 보이는 날짜(63일까지)의 체크 · 한 줄 · 스티커 · 153 일정 · 저요 한 모집 · 저녁 독려
--    + (2-3) 그날 한 일(acts) · 코치 한마디(notes) · 기념일(anniv) · 153 D-day(ddays — 보이는 날짜와 상관없이 다가오는 것)
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
  v_acts jsonb;
  v_notes jsonb;
  v_anniv jsonb;
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

  select cp.evening_nudge into v_nudge from public.member_calendar_prefs cp where cp.user_id = v_me;

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

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'days', v_days,
    'events', v_events,
    'calls', v_calls,
    'nudge', jsonb_build_object('on', coalesce(v_nudge, false), 'at', coalesce(public._cal_conf() ->> 'nudge_at', '20:00')),
    'acts', v_acts,
    'notes', v_notes,
    'anniv', v_anniv,
    'ddays', public._cal_ddays(v_me));
end
$$;

-- 목표일 정하기 · 고치기 (내일부터 2년 안 · 3개까지 · 이름 20자)
create or replace function public.set_my_goal_day(p_id uuid default null, p_day date default null, p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_title text := nullif(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), '');
  v_n integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if v_title is null then
    raise exception '목표 이름을 적어 주세요';
  end if;
  if char_length(v_title) > 20 then
    raise exception '목표 이름은 20자 안으로 적어 주세요';
  end if;
  if p_day is null then
    raise exception '날짜를 골라 주세요';
  end if;
  if p_day <= v_today then
    raise exception '목표일은 내일부터 골라 주세요';
  end if;
  if p_day > v_today + 730 then
    raise exception '목표일은 2년 안으로 골라 주세요';
  end if;

  if p_id is null then
    -- 동시에 두 번 눌러도 3개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-goal-days:' || v_me::text));
    select count(*)::integer into v_n
      from public.member_goal_days
     where user_id = v_me and removed_at is null and day >= v_today;
    if v_n >= 3 then
      raise exception '목표일은 3개까지 정할 수 있어요 · 하나를 빼면 새로 정할 수 있어요';
    end if;
    insert into public.member_goal_days (user_id, day, title) values (v_me, p_day, v_title);
  else
    update public.member_goal_days
       set day = p_day, title = v_title, updated_at = now()
     where id = p_id and user_id = v_me and removed_at is null;
    if not found then
      raise exception '목표일을 찾지 못했어요';
    end if;
  end if;
  return public._cal_ddays(v_me);
end
$$;

-- 목표일 빼기 (지우지 않고 removed_at)
create or replace function public.remove_my_goal_day(p_id uuid)
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
  update public.member_goal_days
     set removed_at = now(), updated_at = now()
   where id = p_id and user_id = v_me and removed_at is null;
  if not found then
    raise exception '목표일을 찾지 못했어요';
  end if;
  return public._cal_ddays(v_me);
end
$$;

-- 6) 코치 한마디 도장 — 오늘 칸에 한 줄 (회원 · 날 · 코치마다 한 줄 · 고치면 덮어씀 · 알림은 처음 한 번)
create or replace function public.coach_day_note_save(p_member uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  k jsonb := public._cal_conf();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_body text := nullif(btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')), '');
  v_branch text;
  v_id uuid;
  v_notified timestamptz;
  v_quiet boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_branch := public._cal_note_branch(v_me, p_member);
  if v_branch is null then
    raise exception '이 회원에게는 한마디를 남길 수 없어요' using errcode = '42501';
  end if;
  if v_body is null then
    raise exception '한마디를 적어 주세요';
  end if;
  if char_length(v_body) > 80 then
    raise exception '한마디는 80자 안으로 적어 주세요';
  end if;

  insert into public.coach_day_notes as n (member_user_id, day, coach_user_id, branch_name, body)
  values (p_member, v_today, v_me, v_branch, v_body)
  on conflict (member_user_id, day, coach_user_id) do update
     set body = excluded.body, branch_name = excluded.branch_name, removed_at = null, updated_at = now()
  returning n.id, n.notified_at into v_id, v_notified;

  -- 알림은 처음 한 번 (고치거나 뺐다 다시 남겨도 다시 안 감) · 조용한 시간엔 알림함에만
  if v_notified is null then
    update public.coach_day_notes set notified_at = now() where id = v_id and notified_at is null;
    if found then
      v_quiet := v_hm >= coalesce(k ->> 'note_quiet_from', '22:00') or v_hm < coalesce(k ->> 'note_quiet_until', '08:00');
      insert into public.notifications (user_id, title, body, link, pushed_at)
      values (p_member,
              '💬 ' || public._cal_staff_who(v_me) || ' ' || public._cal_staff_title(v_me) || '님의 오늘 한마디',
              v_body,
              '/home?cal=' || to_char(v_today, 'YYYY-MM-DD'),
              case when v_quiet then now() end);
    end if;
  end if;
  return jsonb_build_object('member', p_member, 'day', v_today, 'notes', public._cal_day_notes(p_member, v_today, v_me));
end
$$;

-- 코치 한마디 빼기 — 오늘 내가 남긴 것만 (이미 간 알림은 그대로)
create or replace function public.coach_day_note_remove(p_member uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.coach_day_notes
     set removed_at = now(), updated_at = now()
   where member_user_id = p_member and day = v_today and coach_user_id = v_me and removed_at is null;
  if not found then
    raise exception '오늘 남긴 한마디가 없어요';
  end if;
  return jsonb_build_object('member', p_member, 'day', v_today, 'notes', public._cal_day_notes(p_member, v_today, v_me));
end
$$;

-- 7) 153운영본부 「오늘 만날 회원」 (+ 2-3: 오늘 n주년 · 출석 축하를 채운 날 · 코치 한마디 · 오늘 온 다른 회원)
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
  v_others jsonb;
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
    return jsonb_build_object('on', false, 'branch', v_branch, 'rows', '[]'::jsonb, 'others', '[]'::jsonb);
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
  ), mil as (
    select am.user_id, max(am.milestone) as milestone
      from public.attendance_milestones am
      join m on m.user_id = am.user_id
     where am.reached_on = v_today
     group by am.user_id
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
                    where pc.user_id = h.user_id and pc.call_date = v_today and pc.status = 'open') as partner_call,
           an.basis as anniv_basis,
           public._cal_anniv_years(an.day, v_today) as anniv_years
      from hist h
      left join lateral (
        select x.day, x.basis from public._cal_anchor_of(public._cal_reg_day(h.user_id), h.first_day) x
      ) an on true
  ), r as (
    select m.user_id, m.name, m.nickname, m.avatar_url, m.membership_end,
           came.user_id is not null as came_today, came.came_at,
           prom.user_id is not null as promised, prom.time_slot,
           calc.first_day, calc.prev_day, calc.starter_count, calc.partner_call,
           calc.anniv_years, case when calc.anniv_years is not null then calc.anniv_basis end as anniv_basis,
           mil.milestone,
           (prom.user_id is not null
            or (came.user_id is not null and (
                  calc.starter_count is not null
               or (calc.prev_day is not null and v_today - calc.prev_day >= v_gap)
               or (m.membership_end is not null and m.membership_end >= v_today and m.membership_end - v_today <= v_exp)
               or calc.partner_call
               or calc.anniv_years is not null
               or mil.milestone is not null))) as special,
           public._cal_day_notes(m.user_id, v_today, v_me) as notes
      from calc
      join m on m.user_id = calc.user_id
      left join came on came.user_id = calc.user_id
      left join prom on prom.user_id = calc.user_id
      left join mil on mil.user_id = calc.user_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
           'user_id', r.user_id,
           'name', coalesce(nullif(btrim(r.nickname), ''), r.name),
           'real_name', r.name,
           'avatar_url', r.avatar_url,
           'came_at', r.came_at,
           'promised', r.promised,
           'time_slot', r.time_slot,
           'starter_day', case when r.starter_count is not null then v_today - r.first_day + 1 end,
           'starter_count', r.starter_count,
           'gap_days', case when r.came_today and r.prev_day is not null and v_today - r.prev_day >= v_gap
                            then v_today - r.prev_day end,
           'days_left', case when r.came_today and r.membership_end is not null
                              and r.membership_end >= v_today and r.membership_end - v_today <= v_exp
                             then r.membership_end - v_today end,
           'partner_call', r.partner_call,
           'anniv_years', r.anniv_years,
           'anniv_basis', r.anniv_basis,
           'milestone', r.milestone,
           'notes', r.notes
         ) order by r.came_at desc nulls last, coalesce(nullif(btrim(r.nickname), ''), r.name)) filter (where r.special), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
           'user_id', r.user_id,
           'name', coalesce(nullif(btrim(r.nickname), ''), r.name),
           'real_name', r.name,
           'avatar_url', r.avatar_url,
           'came_at', r.came_at,
           'notes', r.notes
         ) order by r.came_at desc, coalesce(nullif(btrim(r.nickname), ''), r.name)) filter (where not r.special and r.came_today), '[]'::jsonb)
    into v_rows, v_others
    from r;

  return jsonb_build_object(
    'on', true, 'branch', v_branch, 'today', v_today,
    'starter_days', v_starter, 'gap_days', v_gap, 'expiring_days', v_exp,
    'can_note', true, 'note_max', 80,
    'rows', v_rows,
    'others', v_others);
end
$$;

-- 8) 10분마다 — 153 일정 알림 (+ 승급 심사는 kind exam 제목 · 타이틀 레벨 회원에게만) · 저녁 독려 (그 밖은 2-2 그대로)
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

-- 9) 권한 — 화면은 set_my_goal_day · remove_my_goal_day · coach_day_note_save · coach_day_note_remove 를 새로
--    (get_my_calendar · ops_meet_today · ops_cal_events · ops_cal_event_save · calendar_tick · _cal_event_notice_title 은
--     create or replace 라 권한이 그대로)
revoke all on function public._cal_reg_day(uuid) from public, anon, authenticated;
revoke all on function public._cal_first_day(uuid) from public, anon, authenticated;
revoke all on function public._cal_anchor_of(date, date) from public, anon, authenticated;
revoke all on function public._cal_anchor(uuid) from public, anon, authenticated;
revoke all on function public._cal_anniv_years(date, date) from public, anon, authenticated;
revoke all on function public._cal_staff_who(uuid) from public, anon, authenticated;
revoke all on function public._cal_staff_title(uuid) from public, anon, authenticated;
revoke all on function public._cal_title_level(uuid) from public, anon, authenticated;
revoke all on function public._cal_note_branch(uuid, uuid) from public, anon, authenticated;
revoke all on function public._cal_day_notes(uuid, date, uuid) from public, anon, authenticated;
revoke all on function public._cal_ddays(uuid) from public, anon, authenticated;
revoke all on function public.set_my_goal_day(uuid, date, text) from public, anon;
revoke all on function public.remove_my_goal_day(uuid) from public, anon;
revoke all on function public.coach_day_note_save(uuid, text) from public, anon;
revoke all on function public.coach_day_note_remove(uuid) from public, anon;
grant execute on function public.set_my_goal_day(uuid, date, text) to authenticated;
grant execute on function public.remove_my_goal_day(uuid) to authenticated;
grant execute on function public.coach_day_note_save(uuid, text) to authenticated;
grant execute on function public.coach_day_note_remove(uuid) to authenticated;
