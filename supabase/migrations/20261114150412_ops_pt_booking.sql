-- 153운영본부 · PT 프리미엄 1단계 — PT 예약 · 취소 규칙 · 수업 1회 1,000 마일리지
--   (2026-11-14 대표님 「PT 회원님들 관리를 효율적으로 … 스케줄 관리 혼동되지 않게 · 한번 PT 진행할때마다 1000마일리지 ·
--    당일 취소는 차감되고 하루전은 언제든지 가능 · 담당코치님이 마이복서 153을 통해 예약 하거나 관리」
--    · 보고서 https://claude.ai/artifact/KVmuJHjNQ2aqLw4ADc62xn · 캘린더 3단계 보고서 「3-6 PT 예약」(결정 5)과 같은 뼈대)
--
--   지금까지: 수업 사실은 PT 기록(ops_pt_sessions — 11/11), 남은 횟수는 브로제이(profiles.pt_remaining). 「앞으로의 일정」은 앱에 없었다.
--   이 파일: 예약(ops_pt_bookings) + 코치 예약 가능 시간(ops_pt_slots) + 지점 설정(ops_pt_book_settings) + 수업 적립(ops_pt_mileage).
--     · 회원: pt_my_home(홈 PT 카드 한 번에) · pt_open_slots · pt_book · pt_move · pt_cancel · pt_confirm_lesson(「수업 받았어요」)
--     · 코치 · 지점장 · 대표님: ops_pt_book_board · ops_pt_booking_save(여러 회원 · 매주 반복 · 시간 바꾸기) ·
--       ops_pt_booking_close(취소 · 코치 사정 · 당일취소 · 노쇼 · 수업함) · ops_pt_slots_save · ops_pt_book_setting_set(대표님만)
--     · 5분 예약 ops-pt-book-tick: 기록과 예약 맞추기 · 전날 저녁 · 1시간 전 알림 · 「수업 받았어요」 묻기 · 코치 노쇼 확인
--
--   규칙(대표님 11/11 · 11/14): 전날 자정까지 취소 · 변경 = 차감 없음 / 수업 당일 회원 취소 · 노쇼 = 차감 1회 / 코치 사정 = 차감 없음.
--     회원이 방금(10분 안) 잡은 예약은 당일이어도 차감 없이 취소(실수 방지).
--   차감되는 결과(수업 · 당일취소 · 노쇼)는 ops_pt_sessions 에 한 줄로 남긴다 — 코치가 따로 적지 않아도 되고,
--     브로제이 차감과의 대조(차감 대기 · 사유 없는 차감)는 기존 PT 기록 화면이 그대로 한다. 남은 횟수의 정본은 계속 브로제이.
--   마일리지: 수업 기록(lesson · open) 한 줄 = 설정 금액 × 횟수(uses). 기록이 어떤 길로 생기든(회원 확인 · 코치 · 자동 기록) 한 번만.
--     기록을 지우거나 종류를 바꾸면 그만큼 되돌린다. 켠 날(started_on) 앞 수업 · 지도진 · 체험 계정은 주지 않는다.
--
--   코치 넣기: 남은 횟수(브로제이) 안에서만 — 넘는 건은 건너뛰고 알려 주며(skipped limit), 화면이 한 번 더 물은 뒤 force 로 넣는다 ·
--     같은 시각에 이미 있는 예약과는 join 으로 팀 PT(6명까지) · 팀은 시간을 바꿀 때 함께 옮긴다 · 회원은 하루에 예약 하나.
--   회원 직접 예약: 코치가 열어 둔 시간 안 · 수업 4시간 전까지 · 14일 앞까지 · 남은 횟수 안 · 하루 12번까지(되풀이 누름 막기).
--   예약과 PT 기록 맞추기(5분 예약): 수업 시간이 된 예약에 그날 기록이 있으면 그 결과로 닫고, 그 기록이 지워지면 예약을 다시 열거나
--     (같은 날 다른 차감 기록이 있으면 그 기록에 잇고) 코치 사정으로 닫는다 · 기록을 다시 적으면 다시 잇는다.
--   회원 홈의 '팀 수업' 표시는 같은 팀 · 같은 시각에 다른 회원의 살아 있는 예약이 있을 때만(혼자 남으면 뺀다).
--   코치가 예약 가능 시간을 바꾸면 예전 칸은 지우지 않고 닫은 시각만 남긴다(ops_pt_slots.removed_at) — 이 파일에 줄을 지우는 문장(delete)은 없다.
--
--   새 표 4 · 새 함수 · 새 예약 1개 · 새 트리거 1개(ops_pt_sessions 적립 — 실패해도 기록 저장을 막지 않는다) ·
--   mileage_ledger 종류에 'pt' 한 칸. 기존 함수 · 표 정의 · 예약은 건드리지 않는다.
--   지점마다 대표님이 켠 곳만 돈다(ops_pt_book_settings). 예약은 PT 기록을 켠 지점에서만 켤 수 있다.

-- ───────────────────────── 마일리지 종류 ─────────────────────────
alter table public.mileage_ledger drop constraint if exists mileage_ledger_kind_check;
alter table public.mileage_ledger add constraint mileage_ledger_kind_check
  check (kind in ('attendance', 'level_up', 'title_match', 'adjust', 'record', 'milestone', 'pt'));

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_book_settings (
  branch_name text primary key references public.ops_branches(branch_name),
  booking_on boolean not null default false,      -- 예약판 · 회원 홈 PT 카드
  mileage_on boolean not null default false,      -- 수업 1회 적립
  lesson_mileage integer not null default 1000 check (lesson_mileage between 0 and 100000),
  started_on date not null default ((now() at time zone 'Asia/Seoul')::date),  -- 이 날부터의 수업만 적립
  slot_minutes smallint not null default 50 check (slot_minutes in (30, 40, 50, 60, 90)),
  min_lead_hours smallint not null default 4 check (min_lead_hours between 0 and 72),   -- 회원이 직접 잡을 때
  ahead_days smallint not null default 14 check (ahead_days between 1 and 60),          -- 회원이 직접 잡을 때
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ops_pt_book_settings enable row level security;

-- 코치가 열어 둔 「예약 가능 시간」(매주) — 회원이 그 안에서 직접 예약한다. 분은 한국 시간 자정부터.
create table if not exists public.ops_pt_slots (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid not null references public.ops_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),     -- 0 = 일
  start_min smallint not null check (start_min between 0 and 1410 and start_min % 30 = 0),
  end_min smallint not null check (end_min between 30 and 1440 and end_min % 30 = 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
-- 시간을 바꾸면 예전 칸은 지우지 않고 닫은 시각만 남긴다(다시 열면 새 줄) — 읽는 쪽은 removed_at is null 인 칸만 본다.
alter table public.ops_pt_slots add column if not exists removed_at timestamptz;
create index if not exists ops_pt_slots_coach_idx on public.ops_pt_slots (coach_staff_id, weekday);
alter table public.ops_pt_slots enable row level security;

create table if not exists public.ops_pt_bookings (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid not null references public.ops_staff(id),
  member_user_id uuid not null,
  member_name text not null check (length(btrim(member_name)) between 1 and 40),   -- 넣을 때 이름(코치 화면은 이름표를 먼저 본다)
  ticket_name text check (ticket_name is null or length(ticket_name) <= 80),
  start_at timestamptz not null,
  end_at timestamptz not null,
  day date not null,                               -- 수업 날짜(한국) — 취소 규칙 · 하루 한 예약 · PT 기록 날짜
  -- booked 예약됨 · done 수업함 · canceled 전날까지 취소 · late_canceled 당일취소(차감) · noshow 노쇼(차감) ·
  -- coach_canceled 코치 사정(차감 없음) · moved 시간 바꿈(새 예약의 moved_from 이 이 줄)
  status text not null default 'booked'
    check (status in ('booked', 'done', 'canceled', 'late_canceled', 'noshow', 'coach_canceled', 'moved')),
  made_by text not null check (made_by in ('member', 'coach')),
  team_id uuid,                                    -- 팀 PT — 같은 시간 여러 회원 묶음
  series_id uuid,                                  -- 매주 반복으로 한 번에 넣은 묶음
  moved_from uuid references public.ops_pt_bookings(id) on delete set null,
  session_id uuid references public.ops_pt_sessions(id) on delete set null,   -- 이어진 PT 기록
  confirmed_at timestamptz,                        -- 회원 「수업 받았어요」
  closed_role text check (closed_role is null or closed_role in ('member', 'coach', 'system')),
  closed_by uuid,
  closed_at timestamptz,
  close_note text check (close_note is null or length(close_note) <= 200),
  remind_day_at timestamptz,                       -- 알림은 종류마다 한 번
  remind_hour_at timestamptz,
  ask_at timestamptz,
  nudge_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists ops_pt_bookings_coach_idx on public.ops_pt_bookings (coach_staff_id, start_at);
create index if not exists ops_pt_bookings_member_idx on public.ops_pt_bookings (member_user_id, day);
create index if not exists ops_pt_bookings_branch_idx on public.ops_pt_bookings (branch_name, day);
create index if not exists ops_pt_bookings_open_idx on public.ops_pt_bookings (start_at) where status = 'booked';
-- 한 회원 · 하루에 살아 있는 예약(또는 차감된 결과)은 하나 — PT 기록의 '하루 한 차감 기록'과 같은 결
create unique index if not exists ops_pt_bookings_one_per_day
  on public.ops_pt_bookings (member_user_id, day)
  where status in ('booked', 'done', 'late_canceled', 'noshow');
alter table public.ops_pt_bookings enable row level security;

-- 수업 기록마다 적립 상태 — 지금 적립된 금액 = unit × uses (uses 0 = 되돌림). seq = 원장 열쇠 번호.
create table if not exists public.ops_pt_mileage (
  session_id uuid primary key references public.ops_pt_sessions(id) on delete cascade,
  user_id uuid not null,
  unit integer not null,
  uses smallint not null,
  seq integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.ops_pt_mileage enable row level security;

revoke all on public.ops_pt_book_settings, public.ops_pt_slots, public.ops_pt_bookings, public.ops_pt_mileage
  from anon, authenticated;

-- ───────────────────────── 안쪽 함수 ─────────────────────────
-- 알림 한 통 — 밤 10시 ~ 아침 7시는 알림함에만(휴대폰은 울리지 않는다)
create or replace function public._ops_pt_book_notify(_user uuid, _title text, _body text, _link text)
returns void language plpgsql security definer set search_path = public as $$
declare v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if _user is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (_user, left(_title, 120), left(coalesce(_body, ''), 300), _link, case when v_h >= 22 or v_h < 7 then now() end);
end $$;

-- "11월 17일(월) 오후 7:00"
create or replace function public._ops_pt_when(_at timestamptz)
returns text language sql stable set search_path = public as $$
  select to_char(k, 'FMMM"월" FMDD"일"')
         || '(' || (array['일', '월', '화', '수', '목', '금', '토'])[extract(dow from k)::int + 1] || ') '
         || case when extract(hour from k) < 12 then '오전 ' else '오후 ' end
         || (case when extract(hour from k)::int % 12 = 0 then 12 else extract(hour from k)::int % 12 end)::text
         || ':' || to_char(k, 'MI')
    from (select _at at time zone 'Asia/Seoul' as k) x;
$$;

-- 코치 이름 — 운동 달력 '그날 한 일'과 같은 순서(근무자 카드의 앱 이름 → 별명 → 카드 이름)
create or replace function public._ops_pt_coach_name(_staff uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(cp.name), ''), nullif(btrim(cp.nickname), ''), nullif(btrim(st.name), ''), '코치')
    from public.ops_staff st
    left join public.profiles cp on cp.user_id = st.user_id
   where st.id = _staff;
$$;

-- 예약을 켠 지점의 일반 회원 본인 — 아니면 줄 없음
create or replace function public._ops_pt_book_me(_uid uuid)
returns table (branch text, name text, ticket text, remaining integer, end_date date, checked_at timestamptz, active boolean)
language sql stable security definer set search_path = public as $$
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), '회원'), p.pt_ticket, p.pt_remaining, p.pt_end_date, p.pt_checked_at,
         (p.pt_until is not null and p.pt_until >= (now() at time zone 'Asia/Seoul')::date)
    from public.profiles p
   where p.user_id = _uid
     and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false) and p.merged_into is null
     and exists (select 1 from public.ops_pt_book_settings s where s.branch_name = p.branch_name and s.booking_on);
$$;

-- 회원의 담당 코치 — 마지막 예약(취소 · 옮긴 것도 — 그 코치와 잡던 회원이다) → 마지막 PT 기록 → 그 지점 PT 코치가 한 명이면 그 코치
create or replace function public._ops_pt_book_coach_of(_branch text, _member uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.coach_staff_id from public.ops_pt_bookings b
       join public.ops_staff c on c.id = b.coach_staff_id and c.active and c.pt_freelancer
      where b.member_user_id = _member and b.branch_name = _branch
      order by b.created_at desc limit 1),
    (select s.coach_staff_id from public.ops_pt_sessions s
       join public.ops_staff c on c.id = s.coach_staff_id and c.active and c.pt_freelancer
      where s.member_user_id = _member and s.branch_name = _branch and s.status = 'open'
      order by s.session_date desc, s.created_at desc limit 1),
    (select c.id from public.ops_staff c
      where c.branch_name = _branch and c.active and c.pt_freelancer
        and (select count(*) from public.ops_staff c2 where c2.branch_name = _branch and c2.active and c2.pt_freelancer) = 1));
$$;

-- 그날 그 회원의 입장이 있었나(브로제이 출석)
create or replace function public._ops_pt_book_entered(_branch text, _member uuid, _day date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.attendance_logs l
     where l.user_id = _member and l.branch_name = _branch
       and l.checked_in_at >= (_day::timestamp at time zone 'Asia/Seoul')
       and l.checked_in_at < ((_day + 1)::timestamp at time zone 'Asia/Seoul'));
$$;

-- 코치가 열어 둔 칸 — 그 날짜들의 시작 시각과 비어 있는지(그 코치의 살아 있는 예약과 겹치지 않음)
create or replace function public._ops_pt_open_slots(_coach uuid, _from date, _to date, _slot_min integer)
returns table (start_at timestamptz, free boolean)
language sql stable security definer set search_path = public as $$
  with cand as (
    select distinct ((d::date)::timestamp + make_interval(mins => m)) at time zone 'Asia/Seoul' as s
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      join public.ops_pt_slots sl on sl.coach_staff_id = _coach and sl.removed_at is null and sl.weekday = extract(dow from d)::int
      cross join lateral generate_series(sl.start_min::int, sl.end_min::int - _slot_min, ((_slot_min + 29) / 30) * 30) m
  )
  select c.s,
         not exists (
           select 1 from public.ops_pt_bookings b
            where b.coach_staff_id = _coach and b.status = 'booked'
              and b.start_at < c.s + make_interval(mins => _slot_min) and b.end_at > c.s)
    from cand c
   order by c.s;
$$;

-- 예약의 결과를 PT 기록 한 줄로 남긴다(PT 기록을 켠 지점만) — 그날 차감 기록이 이미 있으면 그 줄을 돌려준다.
--   _kind: lesson · late_cancel · noshow / _source: coach(코치가 누름) · auto(회원 · 앱)
create or replace function public._ops_pt_book_record(_b public.ops_pt_bookings, _kind text, _note text, _by uuid, _source text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_reason text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_manage boolean := (_source = 'coach' and public._ops_can_manage(_by, _b.branch_name));
  v_late boolean;
begin
  if not exists (select 1 from public.ops_pt_settings s where s.branch_name = _b.branch_name and s.record_on) then
    return null;
  end if;
  -- 늦은 기록(11/11): 차감되는 기록을 수업 다음 날부터 코치가 남기면 지점장 확인을 받는다(관리자가 남기면 확인된 것으로).
  --   회원이 누른 「수업 받았어요」 · 당일 취소는 회원 본인의 확인이라 늦은 기록으로 치지 않는다.
  v_late := (_source = 'coach' and not v_manage and _b.day < v_today);
  select s.id into v_id from public.ops_pt_sessions s
   where s.branch_name = _b.branch_name and s.member_user_id = _b.member_user_id and s.session_date = _b.day
     and s.status = 'open' and s.kind in ('lesson', 'noshow', 'late_cancel')
   limit 1;
  if v_id is not null then return v_id; end if;
  -- 출석 체크 없이 수업한 날은 사유가 있어야 한다(11/11) — 앱이 넣는 기록은 '체크 못 함'
  if _kind = 'lesson' and not public._ops_pt_book_entered(_b.branch_name, _b.member_user_id, _b.day) then
    v_reason := 'manual';
  end if;
  -- 그날 '개인 운동'으로 닫아 둔 표시는 차감 기록이 생기면 뺀다(ops_pt_session_save 와 같게)
  update public.ops_pt_sessions x
     set status = 'void', void_reason = '수업 기록으로 바뀜', updated_by = _by, updated_at = now()
   where x.branch_name = _b.branch_name and x.member_user_id = _b.member_user_id and x.session_date = _b.day
     and x.status = 'open' and x.kind = 'self';
  begin
    insert into public.ops_pt_sessions (branch_name, coach_staff_id, member_user_id, member_name, ticket_name, session_date, kind,
                                        uses, no_entry_reason, note, source, created_by,
                                        late, reviewed_by, reviewed_at)
    values (_b.branch_name, _b.coach_staff_id, _b.member_user_id, _b.member_name, _b.ticket_name, _b.day, _kind,
            1, v_reason, left(_note, 300), _source, _by,
            v_late, case when v_manage then _by end, case when v_manage then now() end)
    returning id into v_id;
  exception when unique_violation then
    select s.id into v_id from public.ops_pt_sessions s
     where s.branch_name = _b.branch_name and s.member_user_id = _b.member_user_id and s.session_date = _b.day
       and s.status = 'open' and s.kind in ('lesson', 'noshow', 'late_cancel')
     limit 1;
  end;
  return v_id;
end $$;

-- 회원이 잡을 수 있는 남은 자리 — 남은 횟수(모르면 4) − 앞으로의 예약
create or replace function public._ops_pt_book_room(_member uuid, _remaining integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(_remaining, 4)
         - (select count(*)::int from public.ops_pt_bookings b
             where b.member_user_id = _member and b.status = 'booked' and b.end_at > now());
$$;

-- ───────────────────────── 적립 (ops_pt_sessions 트리거) ─────────────────────────
-- 수업 기록(lesson · open) 한 줄 = 설정 금액 × 횟수. 지우거나 종류 · 횟수를 바꾸면 그만큼 맞춘다.
-- 실패해도 기록 저장은 막지 않는다(경고만).
create or replace function public._ops_pt_mileage_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_set public.ops_pt_book_settings;
  m public.ops_pt_mileage;
  v_target integer := 0;
  v_delta integer;
  v_day text;
begin
  begin
    if new.member_user_id is null then return new; end if;
    select * into m from public.ops_pt_mileage where session_id = new.id;
    if new.status = 'open' and new.kind = 'lesson' then
      if m.session_id is not null then
        v_target := new.uses;        -- 이미 적립한 수업은 설정이 바뀌어도 횟수만 따라간다
      else
        select * into v_set from public.ops_pt_book_settings where branch_name = new.branch_name;
        if v_set.branch_name is not null and v_set.mileage_on and v_set.lesson_mileage > 0
           and new.session_date >= v_set.started_on
           and coalesce((select (s.value ->> 'enabled')::boolean from public.app_settings s where s.key = 'mileage_rules'), false)
           and exists (select 1 from public.profiles p
                        where p.user_id = new.member_user_id
                          and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
                          and p.merged_into is null) then
          v_target := new.uses;
        end if;
      end if;
    end if;
    v_day := to_char(new.session_date, 'FMMM"월" FMDD"일"');

    if m.session_id is null then
      if v_target = 0 then return new; end if;
      if public.grant_mileage(new.member_user_id, 'pt', v_set.lesson_mileage * v_target,
                              'PT 수업 · ' || v_day || case when v_target > 1 then ' (' || v_target || '회)' else '' end,
                              'pt-lesson:' || new.id::text || ':0', new.id) then
        insert into public.ops_pt_mileage (session_id, user_id, unit, uses, seq)
        values (new.id, new.member_user_id, v_set.lesson_mileage, v_target, 1);
        -- 회원이 앱에서 직접 확인한 수업은 그 화면이 바로 보여 준다(알림을 한 번 더 보내지 않는다)
        if coalesce(current_setting('pt153.quiet', true), '') <> '1' then
          perform public._ops_pt_book_notify(new.member_user_id,
            '🥊 PT 수업 +' || to_char(v_set.lesson_mileage * v_target, 'FM999,999') || ' 마일리지',
            v_day || ' 수업이 기록됐어요', '/home?pt=1');
        end if;
      end if;
    elsif v_target <> m.uses then
      v_delta := m.unit * (v_target - m.uses);
      perform public.grant_mileage(m.user_id, 'pt', v_delta,
                                   case when v_delta < 0 then 'PT 수업 기록 정정 · ' else 'PT 수업 · ' end || v_day,
                                   'pt-lesson:' || new.id::text || ':' || m.seq::text, new.id);
      update public.ops_pt_mileage set uses = v_target, seq = seq + 1, updated_at = now() where session_id = new.id;
    end if;
  exception when others then
    raise warning '_ops_pt_mileage_sync: %', sqlerrm;
  end;
  return new;
end $$;

create or replace trigger ops_pt_sessions_mileage
  after insert or update of status, kind, uses on public.ops_pt_sessions
  for each row execute function public._ops_pt_mileage_sync();

-- ───────────────────────── 회원 ─────────────────────────
-- 홈 PT 카드 한 번에 — 수업권 · 담당 코치 · 규칙 · 앞으로의 예약(+ 확인 기다리는 지난 예약) · 지난 수업 기록
create or replace function public.pt_my_home()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  me record;
  v_set public.ops_pt_book_settings;
  v_coach uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_room integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into me from public._ops_pt_book_me(v_uid);
  if me.branch is null then return jsonb_build_object('on', false); end if;
  -- PT 수업권이 없고 최근 예약 · 수업도 없으면 보여 줄 것이 없다
  if not coalesce(me.active, false)
     and not exists (select 1 from public.ops_pt_bookings b where b.member_user_id = v_uid and b.day >= v_today - 30)
     and not exists (select 1 from public.ops_pt_sessions s
                      where s.member_user_id = v_uid and s.status = 'open' and s.session_date >= v_today - 30) then
    return jsonb_build_object('on', true, 'pt', false);
  end if;
  select * into v_set from public.ops_pt_book_settings where branch_name = me.branch;
  v_coach := public._ops_pt_book_coach_of(me.branch, v_uid);
  v_room := public._ops_pt_book_room(v_uid, me.remaining);

  return jsonb_build_object(
    'on', true,
    'pt', coalesce(me.active, false),
    'branch', me.branch,
    'now', now(),
    'today', v_today,
    'ticket', jsonb_build_object('name', me.ticket, 'remaining', me.remaining, 'end_date', me.end_date, 'checked_at', me.checked_at),
    'coach', case when v_coach is null then null
                  else jsonb_build_object('id', v_coach, 'name', public._ops_pt_coach_name(v_coach)) end,
    'rules', jsonb_build_object(
      'slot_minutes', v_set.slot_minutes, 'min_lead_hours', v_set.min_lead_hours, 'ahead_days', v_set.ahead_days,
      'mileage', case when v_set.mileage_on then v_set.lesson_mileage else 0 end, 'grace_minutes', 10),
    'room', greatest(v_room, 0),
    'can_book', coalesce(me.active, false) and v_coach is not null and v_room > 0
                and exists (select 1 from public.ops_pt_slots s where s.coach_staff_id = v_coach and s.removed_at is null),
    -- 살아 있는 예약 — 앞으로의 것 + 시작이 지났는데 아직 결과가 없는 것(이틀 안 · 「수업 받았어요」 대상)
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'start_at', b.start_at, 'end_at', b.end_at, 'day', b.day,
               'coach', public._ops_pt_coach_name(b.coach_staff_id), 'made_by', b.made_by, 'created_at', b.created_at,
               -- 팀 = 같은 팀 · 같은 시각에 다른 회원의 살아 있는 예약이 있을 때만(팀원이 취소해 혼자 남으면 팀 표시를 뺀다)
               'team', (b.team_id is not null and exists (
                          select 1 from public.ops_pt_bookings t
                           where t.team_id = b.team_id and t.start_at = b.start_at and t.status = 'booked' and t.id <> b.id)),
               'free_cancel', (b.day > v_today or (b.made_by = 'member' and b.created_at > now() - interval '10 minutes')))
             order by b.start_at)
        from public.ops_pt_bookings b
       where b.member_user_id = v_uid and b.status = 'booked' and b.day >= v_today - 2), '[]'::jsonb),
    -- 지난 수업 — PT 기록(수업 · 노쇼 · 당일취소 · 코치 사정) + 기록이 없는 예약 결과(취소 · 시간 바꿈 …)
    'history', coalesce((
      select jsonb_agg(h.j order by h.d desc, h.t desc nulls last) from (
        (select s.session_date as d, bk.start_at as t,
                jsonb_build_object(
                  'key', 's:' || s.id::text, 'day', s.session_date, 'kind', s.kind, 'uses', s.uses, 'start_at', bk.start_at,
                  'mileage', coalesce((select mm.unit * mm.uses from public.ops_pt_mileage mm where mm.session_id = s.id), 0),
                  'coach', public._ops_pt_coach_name(s.coach_staff_id)) as j
           from public.ops_pt_sessions s
           left join lateral (select b.start_at from public.ops_pt_bookings b where b.session_id = s.id order by b.start_at limit 1) bk on true
          where s.member_user_id = v_uid and s.status = 'open'
            and s.kind in ('lesson', 'noshow', 'late_cancel', 'coach_cancel')
            and s.session_date >= v_today - 180)
        union all
        (select b.day, b.start_at,
                jsonb_build_object(
                  'key', 'b:' || b.id::text, 'day', b.day,
                  'kind', case b.status when 'done' then 'lesson' when 'late_canceled' then 'late_cancel'
                                        when 'coach_canceled' then 'coach_cancel' else b.status end,
                  'uses', 1, 'start_at', b.start_at, 'mileage', 0,
                  'coach', public._ops_pt_coach_name(b.coach_staff_id), 'by', b.closed_role,
                  'moved_to', (select n.start_at from public.ops_pt_bookings n where n.moved_from = b.id order by n.created_at desc limit 1))
           from public.ops_pt_bookings b
          where b.member_user_id = v_uid and b.status <> 'booked' and b.session_id is null and b.day >= v_today - 180)
        order by 1 desc, 2 desc nulls last
        limit 60) h), '[]'::jsonb),
    'mileage_total', coalesce((select sum(l.amount) from public.mileage_ledger l where l.user_id = v_uid and l.kind = 'pt'), 0));
end $$;

-- 예약할 수 있는 칸 — 담당 코치가 열어 둔 시간(오늘 ~ ahead_days). free = 비어 있고 · 최소 시간 전이고 · 그날 내 예약이 없음
create or replace function public.pt_open_slots()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  me record;
  v_set public.ops_pt_book_settings;
  v_coach uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_min timestamptz;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into me from public._ops_pt_book_me(v_uid);
  if me.branch is null or not coalesce(me.active, false) then return jsonb_build_object('on', false, 'days', '[]'::jsonb); end if;
  select * into v_set from public.ops_pt_book_settings where branch_name = me.branch;
  v_coach := public._ops_pt_book_coach_of(me.branch, v_uid);
  if v_coach is null then return jsonb_build_object('on', true, 'coach', null, 'days', '[]'::jsonb); end if;
  v_min := now() + make_interval(hours => v_set.min_lead_hours::int);
  return jsonb_build_object(
    'on', true,
    'coach', jsonb_build_object('id', v_coach, 'name', public._ops_pt_coach_name(v_coach)),
    'slot_minutes', v_set.slot_minutes,
    'room', greatest(public._ops_pt_book_room(v_uid, me.remaining), 0),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', x.d,
               'mine', exists (select 1 from public.ops_pt_bookings b
                                where b.member_user_id = v_uid and b.day = x.d
                                  and b.status in ('booked', 'done', 'late_canceled', 'noshow')),
               'slots', x.slots) order by x.d)
        from (
          select y.d, jsonb_agg(jsonb_build_object('at', y.start_at, 'free', y.free and y.start_at >= v_min) order by y.start_at) as slots
            from (select (o.start_at at time zone 'Asia/Seoul')::date as d, o.start_at, o.free
                    from public._ops_pt_open_slots(v_coach, v_today, v_today + v_set.ahead_days::int, v_set.slot_minutes::int) o
                   where o.start_at > now()) y
           group by y.d) x), '[]'::jsonb));
end $$;

-- 회원 예약(안쪽) — 검사하고 한 줄 넣는다. 두 사람이 같은 칸을 동시에 누르면 한 사람만(코치마다 잠금).
--   _coach: 시간 바꾸기는 그 예약의 코치 그대로(없으면 담당 코치를 찾는다)
create or replace function public._ops_pt_member_book(_uid uuid, _start timestamptz, _moved_from uuid, _coach uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_set public.ops_pt_book_settings;
  v_coach uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day date := (_start at time zone 'Asia/Seoul')::date;
  v_id uuid;
begin
  select * into me from public._ops_pt_book_me(_uid);
  if me.branch is null then raise exception '이 지점은 아직 앱 PT 예약을 쓰지 않아요'; end if;
  if not coalesce(me.active, false) then raise exception 'PT 수업권이 있어야 예약할 수 있어요'; end if;
  if _start is null then raise exception '시간을 골라 주세요'; end if;
  -- 하루에 직접 잡기 · 바꾸기는 12번까지(잡았다 풀었다 하면 코치님 알림이 쏟아진다)
  if (select count(*) from public.ops_pt_bookings b
       where b.created_by = _uid and b.made_by = 'member'
         and b.created_at >= (v_today::timestamp at time zone 'Asia/Seoul')) >= 12 then
    raise exception '오늘은 예약을 여러 번 바꿨어요 — 내일 다시 하거나 코치님께 말씀해 주세요';
  end if;
  select * into v_set from public.ops_pt_book_settings where branch_name = me.branch;
  v_coach := coalesce(
    (select c.id from public.ops_staff c where c.id = _coach and c.branch_name = me.branch and c.active and c.pt_freelancer),
    public._ops_pt_book_coach_of(me.branch, _uid));
  if v_coach is null then raise exception '담당 코치님이 아직 정해지지 않았어요 — 코치님께 예약을 부탁해 주세요'; end if;
  perform pg_advisory_xact_lock(hashtext('ptbook:' || v_coach::text));
  if public._ops_pt_book_room(_uid, me.remaining) <= 0 then
    raise exception '남은 횟수만큼만 예약할 수 있어요';
  end if;
  if _start < now() + make_interval(hours => v_set.min_lead_hours::int) then
    raise exception '수업 %시간 전까지 예약할 수 있어요', v_set.min_lead_hours;
  end if;
  if v_day > v_today + v_set.ahead_days::int then
    raise exception '%일 뒤까지만 예약할 수 있어요', v_set.ahead_days;
  end if;
  if not exists (select 1 from public._ops_pt_open_slots(v_coach, v_day, v_day, v_set.slot_minutes::int) o
                  where o.start_at = _start and o.free) then
    raise exception '방금 다른 예약이 들어왔거나 열려 있지 않은 시간이에요 — 다른 시간을 골라 주세요';
  end if;
  insert into public.ops_pt_bookings (branch_name, coach_staff_id, member_user_id, member_name, ticket_name,
                                      start_at, end_at, day, made_by, moved_from, created_by)
  values (me.branch, v_coach, _uid, left(me.name, 40), left(me.ticket, 80),
          _start, _start + make_interval(mins => v_set.slot_minutes::int), v_day, 'member', _moved_from, _uid)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception '그날은 이미 PT 예약이 있어요';
end $$;

create or replace function public.pt_book(p_start timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  b public.ops_pt_bookings;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_id := public._ops_pt_member_book(v_uid, p_start, null, null);
  select * into b from public.ops_pt_bookings where id = v_id;
  perform public._ops_pt_book_notify(
    (select c.user_id from public.ops_staff c where c.id = b.coach_staff_id),
    'PT 예약 · ' || public._ops_pt_member_name(b.branch_name, b.member_user_id) || ' 님',
    public._ops_pt_when(b.start_at) || ' · 회원이 앱에서 예약했어요', '/office?tab=work&pt=book');
  return v_id;
end $$;

-- 시간 바꾸기 — 전날까지(또는 방금 잡은 예약). 옛 예약은 moved 로 남고 새 예약이 그 줄을 가리킨다.
create or replace function public.pt_move(p_id uuid, p_start timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  b public.ops_pt_bookings;
  v_new uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into b from public.ops_pt_bookings where id = p_id for update;
  if b.id is null or b.member_user_id <> v_uid then raise exception '예약을 찾을 수 없어요'; end if;
  if b.status <> 'booked' then raise exception '이미 처리된 예약이에요'; end if;
  if not (b.day > v_today or (b.made_by = 'member' and b.created_at > now() - interval '10 minutes')) then
    raise exception '수업 당일에는 시간을 바꿀 수 없어요 — 코치님께 말씀해 주세요';
  end if;
  if p_start = b.start_at then raise exception '지금 예약과 같은 시간이에요'; end if;
  update public.ops_pt_bookings
     set status = 'moved', closed_role = 'member', closed_by = v_uid, closed_at = now()
   where id = p_id;
  v_new := public._ops_pt_member_book(v_uid, p_start, p_id, b.coach_staff_id);
  perform public._ops_pt_book_notify(
    (select c.user_id from public.ops_staff c where c.id = b.coach_staff_id),
    'PT 시간 변경 · ' || public._ops_pt_member_name(b.branch_name, b.member_user_id) || ' 님',
    public._ops_pt_when(b.start_at) || ' → ' || public._ops_pt_when(p_start), '/office?tab=work&pt=book');
  return v_new;
end $$;

-- 취소 — 전날까지(또는 방금 잡은 예약)는 차감 없음. 수업 당일은 p_late_ok 를 줘야 하고 「당일취소」 기록이 남는다(차감 1회).
create or replace function public.pt_cancel(p_id uuid, p_late_ok boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  b public.ops_pt_bookings;
  v_sid uuid;
  v_coach_uid uuid;
  v_name text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into b from public.ops_pt_bookings where id = p_id for update;
  if b.id is null or b.member_user_id <> v_uid then raise exception '예약을 찾을 수 없어요'; end if;
  if b.status <> 'booked' then raise exception '이미 처리된 예약이에요'; end if;
  if b.start_at <= now() then raise exception '수업 시간이 지난 예약이에요 — 코치님께 말씀해 주세요'; end if;
  select c.user_id into v_coach_uid from public.ops_staff c where c.id = b.coach_staff_id;
  v_name := public._ops_pt_member_name(b.branch_name, b.member_user_id);

  if b.day > v_today or (b.made_by = 'member' and b.created_at > now() - interval '10 minutes') then
    update public.ops_pt_bookings
       set status = 'canceled', closed_role = 'member', closed_by = v_uid, closed_at = now()
     where id = p_id;
    perform public._ops_pt_book_notify(v_coach_uid, 'PT 취소 · ' || v_name || ' 님',
      public._ops_pt_when(b.start_at) || ' · 차감 없는 취소예요', '/office?tab=work&pt=book');
    return jsonb_build_object('result', 'canceled', 'deducted', false);
  end if;

  if not coalesce(p_late_ok, false) then
    raise exception '오늘 수업은 취소하면 1회 차감돼요';
  end if;
  v_sid := public._ops_pt_book_record(b, 'late_cancel', '회원 당일 취소 — PT 예약(앱)', v_uid, 'auto');
  if v_sid is not null and (select s.kind from public.ops_pt_sessions s where s.id = v_sid) <> 'late_cancel' then
    raise exception '오늘은 이미 수업 기록이 있어요 — 코치님께 말씀해 주세요';
  end if;
  update public.ops_pt_bookings
     set status = 'late_canceled', closed_role = 'member', closed_by = v_uid, closed_at = now(), session_id = v_sid
   where id = p_id;
  perform public._ops_pt_book_notify(v_coach_uid, 'PT 당일 취소 · ' || v_name || ' 님',
    public._ops_pt_when(b.start_at) || ' · 1회 차감 기록을 남겼어요 — 브로제이에서 차감해 주세요', '/office?tab=work&pt=book');
  return jsonb_build_object('result', 'late_canceled', 'deducted', true);
end $$;

-- 「수업 받았어요」 — 수업 시간이 된 예약(이틀 안). 수업 기록 한 줄이 생기고(이미 있으면 그 줄) 적립은 기록 트리거가 한다.
create or replace function public.pt_confirm_lesson(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  b public.ops_pt_bookings;
  v_sid uuid;
  v_kind text;
  v_mile integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into b from public.ops_pt_bookings where id = p_id for update;
  if b.id is null or b.member_user_id <> v_uid then raise exception '예약을 찾을 수 없어요'; end if;
  if b.status = 'done' then
    return jsonb_build_object('mileage', coalesce((select m.unit * m.uses from public.ops_pt_mileage m where m.session_id = b.session_id), 0),
                              'again', true);
  end if;
  if b.status <> 'booked' then raise exception '이미 처리된 예약이에요'; end if;
  if b.start_at > now() then raise exception '수업 시간이 되면 누를 수 있어요'; end if;
  if b.day < v_today - 2 then raise exception '확인 기간이 지났어요 — 코치님께 말씀해 주세요'; end if;

  perform set_config('pt153.quiet', '1', true);
  v_sid := public._ops_pt_book_record(b, 'lesson', '회원 확인 — PT 예약(앱)', v_uid, 'auto');
  if v_sid is not null then
    select s.kind into v_kind from public.ops_pt_sessions s where s.id = v_sid;
    if v_kind <> 'lesson' then raise exception '그날은 이미 다른 기록이 있어요 — 코치님께 확인해 주세요'; end if;
  end if;
  update public.ops_pt_bookings
     set status = 'done', confirmed_at = now(), session_id = v_sid, closed_role = 'member', closed_by = v_uid, closed_at = now()
   where id = p_id;
  select m.unit * m.uses into v_mile from public.ops_pt_mileage m where m.session_id = v_sid;
  perform public._ops_pt_book_notify(
    (select c.user_id from public.ops_staff c where c.id = b.coach_staff_id),
    'PT 수업 확인 · ' || public._ops_pt_member_name(b.branch_name, b.member_user_id) || ' 님',
    public._ops_pt_when(b.start_at) || ' · 회원이 「수업 받았어요」를 눌렀어요 — 브로제이 차감만 해 주세요', '/office?tab=work&pt=book');
  return jsonb_build_object('mileage', coalesce(v_mile, 0), 'again', false);
end $$;

-- ───────────────────────── 코치 · 지점장 · 대표님 ─────────────────────────
-- 예약판 한 번에 — 관리자 = 지점 전체, PT 코치 = 본인 담당만. 금액은 여기 없다.
create or replace function public.ops_pt_book_board(p_branch text, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_mine uuid;
  v_set public.ops_pt_book_settings;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
  v_to date;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  v_mine := public._ops_pt_my_staff(v_uid, p_branch);
  if not v_manage and v_mine is null then raise exception 'PT 예약을 볼 수 없어요'; end if;
  select * into v_set from public.ops_pt_book_settings where branch_name = p_branch;
  if v_set.branch_name is null or not v_set.booking_on then
    return jsonb_build_object(
      'branch', p_branch, 'on', false, 'manage', v_manage, 'me_staff', v_mine, 'can_set', public._strategy_hq(v_uid),
      'record_on', exists (select 1 from public.ops_pt_settings s where s.branch_name = p_branch and s.record_on),
      'settings', case when v_set.branch_name is null then null else to_jsonb(v_set) - 'updated_by' end);
  end if;
  v_from := coalesce(p_from, v_today - 7);
  v_to := coalesce(p_to, v_today + 35);
  if v_to < v_from then v_to := v_from; end if;
  if v_to - v_from > 120 then v_to := v_from + 120; end if;

  return jsonb_build_object(
    'branch', p_branch,
    'on', true,
    'manage', v_manage,
    'me_staff', v_mine,
    'can_set', public._strategy_hq(v_uid),
    'record_on', exists (select 1 from public.ops_pt_settings s where s.branch_name = p_branch and s.record_on),
    'today', v_today,
    'now', now(),
    'from', v_from,
    'to', v_to,
    'settings', to_jsonb(v_set) - 'updated_by',
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', public._ops_pt_coach_name(c.id)) order by c.created_at)
        from public.ops_staff c
       where c.branch_name = p_branch and c.pt_freelancer and c.active and (v_manage or c.id = v_mine)), '[]'::jsonb),
    -- 예약을 넣을 수 있는 회원 = 이 지점 PT 수업권이 있는 회원(+ 창 안에 예약이 있는 회원)
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id,
               'name', coalesce(nullif(btrim(p.name), ''), '회원'),
               'label', (select l.label from public.ops_pt_member_labels l
                          where l.branch_name = p_branch and l.member_user_id = p.user_id),
               'tail', right(regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g'), 4),
               'ticket', p.pt_ticket, 'remaining', p.pt_remaining, 'end_date', p.pt_end_date, 'checked_at', p.pt_checked_at,
               'booked', (select count(*) from public.ops_pt_bookings b
                           where b.member_user_id = p.user_id and b.status = 'booked' and b.end_at > now()))
             order by p.name)
        from public.profiles p
       where (p.branch_name = p_branch and p.pt_ticket is not null
              and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false) and p.merged_into is null)
          or p.user_id in (select b.member_user_id from public.ops_pt_bookings b
                            where b.branch_name = p_branch
                              and (b.day between v_from and v_to
                                   or (b.status = 'booked' and b.end_at < now() and b.day >= v_today - 60))
                              and (v_manage or b.coach_staff_id = v_mine))), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'coach_staff_id', b.coach_staff_id, 'member_user_id', b.member_user_id,
               'member_name', public._ops_pt_member_name(b.branch_name, b.member_user_id),
               'start_at', b.start_at, 'end_at', b.end_at, 'day', b.day, 'status', b.status, 'made_by', b.made_by,
               'team_id', b.team_id, 'series_id', b.series_id, 'moved_from', b.moved_from, 'session_id', b.session_id,
               'confirmed_at', b.confirmed_at, 'closed_role', b.closed_role, 'close_note', b.close_note, 'created_at', b.created_at)
             order by b.start_at)
        from public.ops_pt_bookings b
       -- 창 안의 예약 + 창 밖이어도 결과가 아직 없는 지난 예약(60일 안 — 코치가 골라야 닫힌다)
       where b.branch_name = p_branch
         and (b.day between v_from and v_to or (b.status = 'booked' and b.end_at < now() and b.day >= v_today - 60))
         and (v_manage or b.coach_staff_id = v_mine)), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'coach_staff_id', s.coach_staff_id, 'weekday', s.weekday,
                                          'start_min', s.start_min, 'end_min', s.end_min)
             order by s.weekday, s.start_min)
        from public.ops_pt_slots s
       where s.branch_name = p_branch and s.removed_at is null and (v_manage or s.coach_staff_id = v_mine)), '[]'::jsonb),
    -- 최근 사흘 입장(예약 줄의 '입장' 표시)
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'date', a.d, 'at', a.first_at)) from (
        select l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d, min(l.checked_in_at) as first_at
          from public.attendance_logs l
         where l.branch_name = p_branch
           and l.checked_in_at >= ((v_today - 3)::timestamp at time zone 'Asia/Seoul')
           and not coalesce(l.is_duplicate, false)
           and l.user_id in (select b.member_user_id from public.ops_pt_bookings b
                              where b.branch_name = p_branch and b.day between v_today - 3 and v_today
                                and (v_manage or b.coach_staff_id = v_mine))
         group by 1, 2) a), '[]'::jsonb));
end $$;

-- 예약 넣기 · 시간 바꾸기.
--   p: {branch, coach_staff_id?, members: [uuid…](1~6 · 여러 명 = 팀 PT), start_at, weeks?(1~12 매주 반복),
--       force?(남은 횟수를 넘어도 넣기 — 재등록 예정 회원), join?(같은 시간에 이미 있는 예약과 팀으로 묶기)}
--      또는 {id, start_at} = 그 예약의 시간 바꾸기(팀 PT 는 같은 팀이 함께 옮겨진다)
--   코치 = 본인 담당만(코치는 늘 본인) · 관리자 = 지점 PT 코치 고르기.
--   겹치는 시간 · 그날 이미 예약 · 남은 횟수를 넘는 주는 건너뛰고 skipped 로 알려 준다.
create or replace function public.ops_pt_booking_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text := p->>'branch';
  v_manage boolean;
  v_mine uuid;
  v_coach uuid := nullif(p->>'coach_staff_id', '')::uuid;
  v_start timestamptz := nullif(p->>'start_at', '')::timestamptz;
  v_weeks integer := least(greatest(coalesce(nullif(p->>'weeks', '')::integer, 1), 1), 12);
  v_force boolean := coalesce((p->>'force')::boolean, false);
  v_join boolean := coalesce((p->>'join')::boolean, false);
  v_set public.ops_pt_book_settings;
  v_members uuid[];
  v_member uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_series uuid;
  v_team uuid;
  v_s timestamptz;
  v_e timestamptz;
  v_day date;
  v_made integer := 0;
  v_ids uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_first timestamptz;
  v_cnt integer;
  w integer;
  pr record;
  r record;
  b public.ops_pt_bookings;
  v_new uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_id is not null then
    select * into b from public.ops_pt_bookings where id = v_id for update;
    if b.id is null or b.status <> 'booked' then raise exception '예약을 찾을 수 없어요'; end if;
    v_branch := b.branch_name;
  end if;
  v_manage := public._ops_can_manage(v_uid, v_branch);
  v_mine := public._ops_pt_my_staff(v_uid, v_branch);
  if not v_manage and v_mine is null then raise exception 'PT 예약 권한이 없어요'; end if;
  select * into v_set from public.ops_pt_book_settings where branch_name = v_branch;
  if v_set.branch_name is null or not v_set.booking_on then raise exception '이 지점은 아직 앱 PT 예약을 쓰지 않아요'; end if;
  if v_start is null then raise exception '날짜와 시간을 골라 주세요'; end if;
  if v_start < now() - interval '10 minutes' then raise exception '지난 시간에는 예약을 넣을 수 없어요'; end if;
  if v_start > now() + interval '120 days' then raise exception '날짜가 너무 멀어요'; end if;

  -- ── 시간 바꾸기 ──
  if v_id is not null then
    if not v_manage and b.coach_staff_id is distinct from v_mine then raise exception '내 담당 예약만 바꿀 수 있어요'; end if;
    if v_start = b.start_at then raise exception '지금 예약과 같은 시간이에요'; end if;
    perform pg_advisory_xact_lock(hashtext('ptbook:' || b.coach_staff_id::text));
    v_e := v_start + (b.end_at - b.start_at);
    v_day := (v_start at time zone 'Asia/Seoul')::date;
    if exists (select 1 from public.ops_pt_bookings x
                where x.coach_staff_id = b.coach_staff_id and x.status = 'booked' and x.id <> b.id
                  and x.start_at < v_e and x.end_at > v_start
                  and (b.team_id is null or x.team_id is distinct from b.team_id)) then
      raise exception '그 시간에 다른 예약이 있어요';
    end if;
    -- 팀 PT 는 한 수업이라 같은 팀(같은 시간)의 예약을 함께 옮긴다
    for r in
      select x.* from public.ops_pt_bookings x
       where x.status = 'booked'
         and (x.id = b.id or (b.team_id is not null and x.team_id = b.team_id and x.start_at = b.start_at))
       order by x.created_at
       for update
    loop
      update public.ops_pt_bookings
         set status = 'moved', closed_role = 'coach', closed_by = v_uid, closed_at = now()
       where id = r.id;
      begin
        insert into public.ops_pt_bookings (branch_name, coach_staff_id, member_user_id, member_name, ticket_name,
                                            start_at, end_at, day, made_by, team_id, series_id, moved_from, created_by)
        values (r.branch_name, r.coach_staff_id, r.member_user_id, r.member_name, r.ticket_name,
                v_start, v_e, v_day, 'coach', r.team_id, r.series_id, r.id, v_uid)
        returning id into v_new;
      exception when unique_violation then
        raise exception '그날은 % 님의 PT 예약이 이미 있어요', public._ops_pt_member_name(r.branch_name, r.member_user_id);
      end;
      v_ids := v_ids || v_new;
      v_made := v_made + 1;
      perform public._ops_pt_book_notify(r.member_user_id, 'PT 시간이 바뀌었어요',
        public._ops_pt_when(r.start_at) || ' → ' || public._ops_pt_when(v_start), '/home?pt=1');
    end loop;
    return jsonb_build_object('made', v_made, 'ids', to_jsonb(v_ids), 'skipped', '[]'::jsonb);
  end if;

  -- ── 새 예약 ──
  if not v_manage then
    v_coach := v_mine;
  else
    if v_coach is null then v_coach := v_mine; end if;
    if v_coach is null and (select count(*) from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active) = 1 then
      select c.id into v_coach from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active;
    end if;
    if v_coach is not null and not exists (
      select 1 from public.ops_staff c where c.id = v_coach and c.branch_name = v_branch and c.pt_freelancer and c.active) then
      raise exception '같은 지점 PT 코치만 고를 수 있어요';
    end if;
  end if;
  if v_coach is null then raise exception '담당 코치를 골라 주세요'; end if;

  select array_agg(distinct x::uuid) into v_members
    from jsonb_array_elements_text(case when jsonb_typeof(p->'members') = 'array' then p->'members' else '[]'::jsonb end) x;
  if v_members is null or array_length(v_members, 1) = 0 then raise exception '회원을 골라 주세요'; end if;
  if array_length(v_members, 1) > 6 then raise exception '한 번에 6명까지 넣을 수 있어요'; end if;

  -- 회원 확인은 한 번만(주마다 되풀이하지 않는다)
  for pr in
    select m.uid, p2.user_id, p2.branch_name, p2.is_staff, p2.pt_ticket
      from unnest(v_members) m(uid)
      left join public.profiles p2 on p2.user_id = m.uid
  loop
    if pr.user_id is null or pr.branch_name is distinct from v_branch or coalesce(pr.is_staff, false) then
      raise exception '이 지점 회원이 아니에요';
    end if;
    if pr.pt_ticket is null then raise exception 'PT 수업권이 있는 회원만 예약할 수 있어요'; end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('ptbook:' || v_coach::text));
  if v_weeks > 1 then v_series := gen_random_uuid(); end if;

  for w in 0 .. v_weeks - 1 loop
    v_s := v_start + make_interval(days => 7 * w);
    v_e := v_s + make_interval(mins => v_set.slot_minutes::int);
    v_day := (v_s at time zone 'Asia/Seoul')::date;
    v_team := null;
    if exists (select 1 from public.ops_pt_bookings x
                where x.coach_staff_id = v_coach and x.status = 'booked' and x.start_at < v_e and x.end_at > v_s) then
      -- 그 시간에 이 코치의 다른 예약이 있다 — 「팀으로 묶기」를 골랐고 시작 시각이 똑같은 예약뿐이면 그 팀에 넣는다
      if v_join
         and not exists (select 1 from public.ops_pt_bookings x
                          where x.coach_staff_id = v_coach and x.status = 'booked'
                            and x.start_at < v_e and x.end_at > v_s and x.start_at <> v_s)
         and (select count(*) from public.ops_pt_bookings x
               where x.coach_staff_id = v_coach and x.status = 'booked' and x.start_at = v_s) + array_length(v_members, 1) <= 6 then
        select x.team_id into v_team from public.ops_pt_bookings x
         where x.coach_staff_id = v_coach and x.status = 'booked' and x.start_at = v_s and x.team_id is not null
         limit 1;
        v_team := coalesce(v_team, gen_random_uuid());
        update public.ops_pt_bookings x set team_id = v_team
         where x.coach_staff_id = v_coach and x.status = 'booked' and x.start_at = v_s and x.team_id is distinct from v_team;
      else
        v_skipped := v_skipped || jsonb_build_object('day', v_day, 'reason', 'busy');
        continue;
      end if;
    elsif array_length(v_members, 1) > 1 then
      v_team := gen_random_uuid();
    end if;

    foreach v_member in array v_members loop
      select p2.name, p2.pt_ticket, p2.pt_remaining into pr from public.profiles p2 where p2.user_id = v_member;
      if not v_force and public._ops_pt_book_room(v_member, pr.pt_remaining) <= 0 then
        v_skipped := v_skipped || jsonb_build_object('day', v_day, 'reason', 'limit', 'member', v_member);
        continue;
      end if;
      begin
        insert into public.ops_pt_bookings (branch_name, coach_staff_id, member_user_id, member_name, ticket_name,
                                            start_at, end_at, day, made_by, team_id, series_id, created_by)
        values (v_branch, v_coach, v_member, left(coalesce(nullif(btrim(pr.name), ''), '회원'), 40), left(pr.pt_ticket, 80),
                v_s, v_e, v_day, 'coach', v_team, v_series, v_uid)
        returning id into v_new;
        v_ids := v_ids || v_new;
        v_made := v_made + 1;
      exception when unique_violation then
        v_skipped := v_skipped || jsonb_build_object('day', v_day, 'reason', 'same_day', 'member', v_member);
      end;
    end loop;
  end loop;

  -- 회원마다 알림 한 통(여러 주를 넣어도)
  for pr in
    select x.member_user_id, min(x.start_at) as first_at, count(*) as n
      from public.ops_pt_bookings x where x.id = any(v_ids) group by 1
  loop
    v_first := pr.first_at;
    v_cnt := pr.n;
    perform public._ops_pt_book_notify(pr.member_user_id,
      'PT 예약이 잡혔어요',
      public._ops_pt_when(v_first) || case when v_cnt > 1 then ' 외 ' || (v_cnt - 1) || '건' else '' end
        || ' · ' || public._ops_pt_coach_name(v_coach) || ' 코치',
      '/home?pt=1');
  end loop;
  return jsonb_build_object('made', v_made, 'ids', to_jsonb(v_ids), 'skipped', v_skipped);
end $$;

-- 예약 닫기 — p_kind:
--   cancel       회원 요청 취소(전날까지 · 차감 없음)
--   coach_cancel 코치 사정(언제든 · 차감 없음)
--   late_cancel  회원 당일 취소(수업 당일부터 · 차감 1회)
--   noshow       노쇼(수업 시간이 된 뒤 · 차감 1회)
--   lesson       수업함(수업 시간이 된 뒤 · 차감 1회 · 적립)
create or replace function public.ops_pt_booking_close(p_id uuid, p_kind text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  b public.ops_pt_bookings;
  v_sid uuid;
  v_kind text;
  v_when text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into b from public.ops_pt_bookings where id = p_id for update;
  if b.id is null then raise exception '예약을 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, b.branch_name)
     and b.coach_staff_id is distinct from public._ops_pt_my_staff(v_uid, b.branch_name) then
    raise exception '내 담당 예약만 바꿀 수 있어요';
  end if;
  if b.status <> 'booked' then raise exception '이미 처리된 예약이에요'; end if;
  if p_kind is null or p_kind not in ('cancel', 'coach_cancel', 'late_cancel', 'noshow', 'lesson') then
    raise exception '처리 종류를 골라 주세요';
  end if;
  if v_note is not null and length(v_note) > 200 then v_note := left(v_note, 200); end if;
  v_when := public._ops_pt_when(b.start_at);

  if p_kind = 'cancel' then
    if b.day <= v_today then raise exception '수업 당일에는 「당일 취소」나 「코치 사정」으로 처리해 주세요'; end if;
    update public.ops_pt_bookings
       set status = 'canceled', closed_role = 'coach', closed_by = v_uid, closed_at = now(), close_note = v_note
     where id = p_id;
    perform public._ops_pt_book_notify(b.member_user_id, 'PT 예약이 취소됐어요', v_when || ' · 차감 없는 취소예요', '/home?pt=1');
  elsif p_kind = 'coach_cancel' then
    update public.ops_pt_bookings
       set status = 'coach_canceled', closed_role = 'coach', closed_by = v_uid, closed_at = now(), close_note = v_note
     where id = p_id;
    perform public._ops_pt_book_notify(b.member_user_id, 'PT 예약이 취소됐어요',
      v_when || ' · 코치님 사정으로 취소됐어요 · 차감은 없어요', '/home?pt=1');
  elsif p_kind = 'late_cancel' then
    if b.day > v_today then raise exception '전날까지는 「취소」로 처리해 주세요 — 차감이 없어요'; end if;
    v_sid := public._ops_pt_book_record(b, 'late_cancel', coalesce(v_note, '당일 취소 — PT 예약'), v_uid, 'coach');
    if v_sid is not null and (select s.kind from public.ops_pt_sessions s where s.id = v_sid) <> 'late_cancel' then
      raise exception '그날은 이미 다른 기록이 있어요 — PT 기록에서 먼저 고쳐 주세요';
    end if;
    update public.ops_pt_bookings
       set status = 'late_canceled', closed_role = 'coach', closed_by = v_uid, closed_at = now(), close_note = v_note, session_id = v_sid
     where id = p_id;
    perform public._ops_pt_book_notify(b.member_user_id, 'PT 당일 취소로 기록됐어요', v_when || ' 수업 · 1회가 차감돼요', '/home?pt=1');
  elsif p_kind = 'noshow' then
    if b.start_at > now() then raise exception '수업 시간이 된 뒤에 누를 수 있어요'; end if;
    v_sid := public._ops_pt_book_record(b, 'noshow', coalesce(v_note, '노쇼 — PT 예약'), v_uid, 'coach');
    if v_sid is not null and (select s.kind from public.ops_pt_sessions s where s.id = v_sid) <> 'noshow' then
      raise exception '그날은 이미 다른 기록이 있어요 — PT 기록에서 먼저 고쳐 주세요';
    end if;
    update public.ops_pt_bookings
       set status = 'noshow', closed_role = 'coach', closed_by = v_uid, closed_at = now(), close_note = v_note, session_id = v_sid
     where id = p_id;
    perform public._ops_pt_book_notify(b.member_user_id, 'PT 수업 기록 안내',
      v_when || ' 수업이 「미참석」으로 기록돼 1회가 차감돼요 · 사실과 다르면 코치님께 알려 주세요', '/home?pt=1');
  else
    if b.start_at > now() then raise exception '수업 시간이 된 뒤에 누를 수 있어요'; end if;
    v_sid := public._ops_pt_book_record(b, 'lesson', coalesce(v_note, '수업 — PT 예약'), v_uid, 'coach');
    if v_sid is not null then
      select s.kind into v_kind from public.ops_pt_sessions s where s.id = v_sid;
      if v_kind <> 'lesson' then raise exception '그날은 이미 다른 기록(노쇼 · 당일취소)이 있어요 — PT 기록에서 먼저 고쳐 주세요'; end if;
    end if;
    update public.ops_pt_bookings
       set status = 'done', closed_role = 'coach', closed_by = v_uid, closed_at = now(), close_note = v_note, session_id = v_sid
     where id = p_id;
  end if;
end $$;

-- 예약 가능 시간(매주) 통째로 바꾸기 — p_slots: [{weekday 0~6, start_min, end_min}] (30분 단위 · 28칸까지 · 빈 배열 = 닫기)
--   예전 칸은 지우지 않고 닫은 시각(removed_at)만 남긴다 — 이미 잡힌 예약은 그대로다.
create or replace function public.ops_pt_slots_save(p_branch text, p_coach uuid, p_slots jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_coach uuid := p_coach;
  v_mine uuid;
  r record;
  n integer := 0;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_mine := public._ops_pt_my_staff(v_uid, p_branch);
  if not public._ops_can_manage(v_uid, p_branch) then
    if v_mine is null then raise exception 'PT 예약 권한이 없어요'; end if;
    v_coach := v_mine;
  end if;
  v_coach := coalesce(v_coach, v_mine);
  if v_coach is null or not exists (
    select 1 from public.ops_staff c where c.id = v_coach and c.branch_name = p_branch and c.pt_freelancer and c.active) then
    raise exception '같은 지점 PT 코치만 고를 수 있어요';
  end if;
  if not exists (select 1 from public.ops_pt_book_settings s where s.branch_name = p_branch and s.booking_on) then
    raise exception '이 지점은 아직 앱 PT 예약을 쓰지 않아요';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then raise exception '시간 형식이 올바르지 않아요'; end if;
  if jsonb_array_length(p_slots) > 28 then raise exception '시간대는 28칸까지 넣을 수 있어요'; end if;

  update public.ops_pt_slots set removed_at = now() where coach_staff_id = v_coach and removed_at is null;
  for r in
    select (x->>'weekday')::int as wd, (x->>'start_min')::int as s, (x->>'end_min')::int as e
      from jsonb_array_elements(p_slots) x
  loop
    if r.wd is null or r.wd < 0 or r.wd > 6 or r.s is null or r.e is null
       or r.s < 0 or r.e > 1440 or r.e <= r.s or r.s % 30 <> 0 or r.e % 30 <> 0 then
      raise exception '시간대를 다시 확인해 주세요';
    end if;
    insert into public.ops_pt_slots (branch_name, coach_staff_id, weekday, start_min, end_min, created_by)
    values (p_branch, v_coach, r.wd, r.s, r.e, v_uid);
    n := n + 1;
  end loop;
  return n;
end $$;

-- 켜기 · 끄기 · 금액 — 대표님만. p: {booking_on?, mileage_on?, lesson_mileage?, started_on?, slot_minutes?, min_lead_hours?, ahead_days?}
create or replace function public.ops_pt_book_setting_set(p_branch text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_set public.ops_pt_book_settings;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 바꿀 수 있어요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = p_branch and b.enabled) then
    raise exception '운영본부를 켠 지점이 아니에요';
  end if;
  if coalesce((p->>'booking_on')::boolean, false)
     and not exists (select 1 from public.ops_pt_settings s where s.branch_name = p_branch and s.record_on) then
    raise exception 'PT 기록을 먼저 켜 주세요';
  end if;
  insert into public.ops_pt_book_settings (branch_name, booking_on, mileage_on, lesson_mileage, started_on,
                                          slot_minutes, min_lead_hours, ahead_days, updated_by)
  values (p_branch,
          coalesce((p->>'booking_on')::boolean, false), coalesce((p->>'mileage_on')::boolean, false),
          coalesce(nullif(p->>'lesson_mileage', '')::integer, 1000),
          coalesce(nullif(p->>'started_on', '')::date, (now() at time zone 'Asia/Seoul')::date),
          coalesce(nullif(p->>'slot_minutes', '')::smallint, 50), coalesce(nullif(p->>'min_lead_hours', '')::smallint, 4),
          coalesce(nullif(p->>'ahead_days', '')::smallint, 14), v_uid)
  on conflict (branch_name) do update
     set booking_on = coalesce((p->>'booking_on')::boolean, public.ops_pt_book_settings.booking_on),
         mileage_on = coalesce((p->>'mileage_on')::boolean, public.ops_pt_book_settings.mileage_on),
         lesson_mileage = coalesce(nullif(p->>'lesson_mileage', '')::integer, public.ops_pt_book_settings.lesson_mileage),
         started_on = coalesce(nullif(p->>'started_on', '')::date, public.ops_pt_book_settings.started_on),
         slot_minutes = coalesce(nullif(p->>'slot_minutes', '')::smallint, public.ops_pt_book_settings.slot_minutes),
         min_lead_hours = coalesce(nullif(p->>'min_lead_hours', '')::smallint, public.ops_pt_book_settings.min_lead_hours),
         ahead_days = coalesce(nullif(p->>'ahead_days', '')::smallint, public.ops_pt_book_settings.ahead_days),
         updated_by = v_uid, updated_at = now()
  returning * into v_set;
  return to_jsonb(v_set) - 'updated_by';
end $$;

-- ───────────────────────── 5분 예약 ─────────────────────────
-- 구역마다 따로 감싼다 — 한 구역이 실패해도 나머지(알림 등)는 돈다.
create or replace function public._ops_pt_book_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hm integer := (extract(hour from now() at time zone 'Asia/Seoul') * 60 + extract(minute from now() at time zone 'Asia/Seoul'))::int;
begin
  -- ① 기록과 맞추기 — 수업 시간이 된 예약에 그날 PT 기록이 있으면(코치 · 자동 기록) 그 결과로 닫는다
  begin
    for r in
      select b.id, s.id as sid, s.kind
        from public.ops_pt_bookings b
        join public.ops_pt_book_settings st on st.branch_name = b.branch_name and st.booking_on
        join lateral (
          select x.id, x.kind from public.ops_pt_sessions x
           where x.branch_name = b.branch_name and x.member_user_id = b.member_user_id and x.session_date = b.day
             and x.status = 'open' and x.kind in ('lesson', 'noshow', 'late_cancel', 'coach_cancel')
           order by (x.kind = 'coach_cancel'), x.created_at limit 1) s on true
       where b.status = 'booked' and b.start_at <= v_now and b.day >= v_today - 14
    loop
      update public.ops_pt_bookings
         set status = case r.kind when 'lesson' then 'done' when 'noshow' then 'noshow'
                                  when 'late_cancel' then 'late_canceled' else 'coach_canceled' end,
             session_id = r.sid, closed_role = 'system', closed_at = v_now
       where id = r.id and status = 'booked';
      n := n + 1;
    end loop;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '①', sqlerrm;
  end;

  -- ② 이어진 기록이 지워졌으면(잘못된 기록): 그날 다른 차감 기록이 있으면 그 결과로, 없으면 차감 없는 취소로 남긴다
  begin
    for r in
      select b.id, b.status as bstatus, b.member_user_id, b.day, s.void_reason, x.id as nid, x.kind as nkind
        from public.ops_pt_bookings b
        join public.ops_pt_sessions s on s.id = b.session_id and s.status = 'void'
        left join lateral (
          select y.id, y.kind from public.ops_pt_sessions y
           where y.branch_name = b.branch_name and y.member_user_id = b.member_user_id and y.session_date = b.day
             and y.status = 'open' and y.kind in ('lesson', 'noshow', 'late_cancel')
           order by y.created_at limit 1) x on true
       where b.status in ('done', 'noshow', 'late_canceled', 'coach_canceled') and b.day >= v_today - 62
    loop
      -- (코치 사정으로 닫혀 있던 예약을 차감 결과로 되돌릴 때는 그날 다른 살아 있는 예약이 없을 때만 — 하루 한 예약)
      if r.nid is not null
         and (r.bstatus <> 'coach_canceled'
              or not exists (select 1 from public.ops_pt_bookings o
                              where o.member_user_id = r.member_user_id and o.day = r.day and o.id <> r.id
                                and o.status in ('booked', 'done', 'late_canceled', 'noshow'))) then
        update public.ops_pt_bookings
           set status = case r.nkind when 'lesson' then 'done' when 'noshow' then 'noshow' else 'late_canceled' end,
               session_id = r.nid, closed_role = 'system', closed_at = v_now, close_note = null
         where id = r.id;
      else
        update public.ops_pt_bookings
           set status = 'coach_canceled', closed_role = 'system', closed_at = v_now, session_id = null,
               close_note = left('기록이 지워졌어요' || coalesce(' — ' || r.void_reason, ''), 200)
         where id = r.id;
      end if;
      n := n + 1;
    end loop;
    -- ②-2 기록이 지워져 취소로 남은 예약에, 코치가 그날 기록을 다시 적었으면(노쇼로 고쳐 적기 등) 그 결과로 이어 준다
    for r in
      select b.id, x.id as nid, x.kind as nkind
        from public.ops_pt_bookings b
        join lateral (
          select y.id, y.kind from public.ops_pt_sessions y
           where y.branch_name = b.branch_name and y.member_user_id = b.member_user_id and y.session_date = b.day
             and y.status = 'open' and y.kind in ('lesson', 'noshow', 'late_cancel')
           order by y.created_at limit 1) x on true
       where b.status = 'coach_canceled' and b.closed_role = 'system' and b.session_id is null
         and b.close_note like '기록이 지워졌어요%' and b.day >= v_today - 14
         and not exists (select 1 from public.ops_pt_bookings o
                          where o.member_user_id = b.member_user_id and o.day = b.day and o.id <> b.id
                            and o.status in ('booked', 'done', 'late_canceled', 'noshow'))
    loop
      update public.ops_pt_bookings
         set status = case r.nkind when 'lesson' then 'done' when 'noshow' then 'noshow' else 'late_canceled' end,
             session_id = r.nid, closed_at = v_now, close_note = null
       where id = r.id;
      n := n + 1;
    end loop;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '②', sqlerrm;
  end;

  -- ③ 전날 저녁 8시 ~ 9시 반: 내일 수업 알림(그날 오후 6시 뒤에 잡은 예약은 건너뜀)
  begin
    if v_hm between 20 * 60 and 21 * 60 + 30 then
      for r in
        select b.id, b.member_user_id, b.start_at, b.coach_staff_id
          from public.ops_pt_bookings b
          join public.ops_pt_book_settings st on st.branch_name = b.branch_name and st.booking_on
         where b.status = 'booked' and b.day = v_today + 1 and b.remind_day_at is null
           and b.created_at < ((v_today::timestamp + interval '18 hours') at time zone 'Asia/Seoul')
      loop
        update public.ops_pt_bookings set remind_day_at = v_now where id = r.id and remind_day_at is null;
        if found then
          perform public._ops_pt_book_notify(r.member_user_id, '내일 PT 수업이 있어요',
            public._ops_pt_when(r.start_at) || ' · ' || public._ops_pt_coach_name(r.coach_staff_id)
              || ' 코치 · 오늘 자정까지는 차감 없이 바꿀 수 있어요', '/home?pt=1');
          n := n + 1;
        end if;
      end loop;
    end if;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '③', sqlerrm;
  end;

  -- ④ 1시간 전(50 ~ 70분 전 · 두 시간 넘게 전에 잡은 예약만)
  begin
    for r in
      select b.id, b.member_user_id, b.start_at, b.coach_staff_id
        from public.ops_pt_bookings b
        join public.ops_pt_book_settings st on st.branch_name = b.branch_name and st.booking_on
       where b.status = 'booked' and b.remind_hour_at is null
         and b.start_at between v_now + interval '50 minutes' and v_now + interval '70 minutes'
         and b.created_at < b.start_at - interval '2 hours'
    loop
      update public.ops_pt_bookings set remind_hour_at = v_now where id = r.id and remind_hour_at is null;
      if found then
        perform public._ops_pt_book_notify(r.member_user_id, '1시간 뒤 PT 수업',
          public._ops_pt_when(r.start_at) || ' · ' || public._ops_pt_coach_name(r.coach_staff_id) || ' 코치', '/home?pt=1');
        n := n + 1;
      end if;
    end loop;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '④', sqlerrm;
  end;

  -- ⑤ 수업이 끝났으면 회원에게 한 번: 「수업 받았어요」(하루 안)
  begin
    for r in
      select b.id, b.member_user_id, b.start_at, st.mileage_on, st.lesson_mileage
        from public.ops_pt_bookings b
        join public.ops_pt_book_settings st on st.branch_name = b.branch_name and st.booking_on
       where b.status = 'booked' and b.ask_at is null
         and b.end_at <= v_now and b.end_at > v_now - interval '24 hours'
    loop
      update public.ops_pt_bookings set ask_at = v_now where id = r.id and ask_at is null;
      if found then
        perform public._ops_pt_book_notify(r.member_user_id, '오늘 PT 수업 받으셨나요?',
          '「수업 받았어요」를 누르면 기록이 남아요'
            || case when r.mileage_on and r.lesson_mileage > 0
                    then ' · +' || to_char(r.lesson_mileage, 'FM999,999') || ' 마일리지' else '' end,
          '/home?pt=1');
        n := n + 1;
      end if;
    end loop;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '⑤', sqlerrm;
  end;

  -- ⑥ 수업이 끝나고 30분이 지났는데 입장도 결과도 없으면 코치에게 한 번(노쇼인지)
  begin
    for r in
      select b.id, b.branch_name, b.member_user_id, b.start_at, c.user_id as coach_uid
        from public.ops_pt_bookings b
        join public.ops_pt_book_settings st on st.branch_name = b.branch_name and st.booking_on
        join public.ops_staff c on c.id = b.coach_staff_id and c.user_id is not null
       where b.status = 'booked' and b.nudge_at is null
         and b.end_at <= v_now - interval '30 minutes' and b.end_at > v_now - interval '48 hours'
         and not public._ops_pt_book_entered(b.branch_name, b.member_user_id, b.day)
    loop
      update public.ops_pt_bookings set nudge_at = v_now where id = r.id and nudge_at is null;
      if found then
        perform public._ops_pt_book_notify(r.coach_uid,
          'PT 예약 확인 · ' || public._ops_pt_member_name(r.branch_name, r.member_user_id) || ' 님',
          public._ops_pt_when(r.start_at) || ' 수업 · 입장 기록이 없어요 — 노쇼 · 코치 사정 · 수업함 중에 골라 주세요',
          '/office?tab=work&pt=book');
        n := n + 1;
      end if;
    end loop;
  exception when others then
    raise warning '_ops_pt_book_tick %: %', '⑥', sqlerrm;
  end;

  return n;
exception when others then
  raise warning '_ops_pt_book_tick: %', sqlerrm;
  return -1;
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public._ops_pt_book_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._ops_pt_when(timestamptz) from public, anon, authenticated;
revoke all on function public._ops_pt_coach_name(uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_book_me(uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_book_coach_of(text, uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_book_entered(text, uuid, date) from public, anon, authenticated;
revoke all on function public._ops_pt_open_slots(uuid, date, date, integer) from public, anon, authenticated;
revoke all on function public._ops_pt_book_record(public.ops_pt_bookings, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public._ops_pt_book_room(uuid, integer) from public, anon, authenticated;
revoke all on function public._ops_pt_mileage_sync() from public, anon, authenticated;
revoke all on function public._ops_pt_member_book(uuid, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_book_tick() from public, anon, authenticated;

revoke all on function public.pt_my_home() from public, anon;
revoke all on function public.pt_open_slots() from public, anon;
revoke all on function public.pt_book(timestamptz) from public, anon;
revoke all on function public.pt_move(uuid, timestamptz) from public, anon;
revoke all on function public.pt_cancel(uuid, boolean) from public, anon;
revoke all on function public.pt_confirm_lesson(uuid) from public, anon;
revoke all on function public.ops_pt_book_board(text, date, date) from public, anon;
revoke all on function public.ops_pt_booking_save(jsonb) from public, anon;
revoke all on function public.ops_pt_booking_close(uuid, text, text) from public, anon;
revoke all on function public.ops_pt_slots_save(text, uuid, jsonb) from public, anon;
revoke all on function public.ops_pt_book_setting_set(text, jsonb) from public, anon;
grant execute on function public.pt_my_home() to authenticated;
grant execute on function public.pt_open_slots() to authenticated;
grant execute on function public.pt_book(timestamptz) to authenticated;
grant execute on function public.pt_move(uuid, timestamptz) to authenticated;
grant execute on function public.pt_cancel(uuid, boolean) to authenticated;
grant execute on function public.pt_confirm_lesson(uuid) to authenticated;
grant execute on function public.ops_pt_book_board(text, date, date) to authenticated;
grant execute on function public.ops_pt_booking_save(jsonb) to authenticated;
grant execute on function public.ops_pt_booking_close(uuid, text, text) to authenticated;
grant execute on function public.ops_pt_slots_save(text, uuid, jsonb) to authenticated;
grant execute on function public.ops_pt_book_setting_set(text, jsonb) to authenticated;

-- ───────────────────────── 예약 (같은 이름이면 덮어쓴다) ─────────────────────────
-- 끄기: select cron.unschedule('ops-pt-book-tick');  ·  지점마다 끄기: ops_pt_book_setting_set(지점, '{"booking_on":false}')
select cron.schedule('ops-pt-book-tick', '*/5 * * * *', $cron$select public._ops_pt_book_tick()$cron$);
