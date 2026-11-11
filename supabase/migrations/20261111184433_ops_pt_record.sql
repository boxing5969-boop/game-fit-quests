-- 153운영본부 · PT 기록 1단계 — 수업 1건 기록 · 출석/차감과 맞춰 보기 · 코치 알림
--   (2026-11-11 대표님 「이런 일이 발생하는 일이 없도록 마이복서153에 PT 기록을 하게」 → 「추천대로 진행하자」
--    · Claude Docs 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ)
--
--   10월 정산에서 생긴 일: 수업 뒤 차감 누락 · 뒤늦은 보정 · 사유 없는 차감 · 출석 체크 없는 수업 · 옮긴 수업을 두 번 셈.
--   코치가 수업 1건마다 한 번 기록하고(수업 · 노쇼 · 당일취소 · 일정 변경 · 코치 사정 · 개인 운동),
--   화면이 그 기록을 브로제이 출석(attendance_logs) · 차감(ops_pt_events)과 맞춰 본다.
--   짝짓기 · 판정은 화면 src/lib/opsPtRecord.ts 한 곳(서버는 자료만 — opsPt.ts 와 같은 결).
--   수당 기준은 그대로다(차감 기록) — 2단계에서 「기록 + 차감」으로 바꾼다.
--
--   대표님 결정(11/11): 당일취소 · 노쇼 = 차감 1회 · 수당 1회 / 기록 마감 = 수업 당일 자정(넘기면 지점장 확인) /
--                      출석 체크 없는 수업 = 사유를 고르면 인정.
--
--   새 표 4 · 새 함수 · 새 예약 3개만. 기존 표 · 함수 · 트리거는 건드리지 않는다.
--   출석 표(attendance_logs)에는 트리거를 달지 않는다 — 입장 알림은 1분 예약이 훑는다(출석 저장을 막을 일이 없게).
--   지점마다 ops_pt_settings 에 켠 지점만 돈다(선릉역점 2주 시범부터). 켜기 전에는 화면 · 알림 모두 조용하다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_settings (
  branch_name text primary key references public.ops_branches(branch_name),
  record_on boolean not null default false,   -- 코치 화면 「오늘 PT」 · 확인 필요
  notify_on boolean not null default false,   -- 입장 알림 · 밤 요약 · 이틀 넘은 건
  started_on date not null default ((now() at time zone 'Asia/Seoul')::date), -- 이 날부터의 차감 · (14일 앞까지의) 기록만 맞춰 본다
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ops_pt_settings enable row level security;

create table if not exists public.ops_pt_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid references public.ops_staff(id) on delete set null,
  member_user_id uuid,
  member_name text not null check (length(btrim(member_name)) between 1 and 40),
  ticket_name text check (ticket_name is null or length(ticket_name) <= 80),
  session_date date not null,                 -- 수업(노쇼 · 취소 · 옮기기 전) 날짜
  -- lesson 수업 · noshow 노쇼 · late_cancel 당일취소 (이 셋은 수업권 1회 차감) · moved 일정 변경 · coach_cancel 코치 사정 · self 개인 운동
  kind text not null check (kind in ('lesson', 'noshow', 'late_cancel', 'moved', 'coach_cancel', 'self')),
  uses smallint not null default 1 check (uses between 1 and 4), -- 차감되는 기록이 맡는 차감 수(연속 2회 수업이면 2)
  moved_to date,                              -- moved: 옮긴 날짜
  no_entry_reason text check (no_entry_reason is null or no_entry_reason in ('door_open', 'manual', 'other')), -- 출석 체크 없이 수업한 사유
  note text check (note is null or length(note) <= 300),
  late boolean not null default false,        -- 수업 당일 자정을 넘겨 적음 → 지점장 확인
  status text not null default 'open' check (status in ('open', 'void')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz,
  check (kind <> 'moved' or moved_to is not null)
);
create index if not exists ops_pt_sessions_branch_idx on public.ops_pt_sessions (branch_name, session_date);
create index if not exists ops_pt_sessions_member_idx on public.ops_pt_sessions (member_user_id, session_date);
-- 같은 회원 · 같은 날에 차감되는 기록(수업 · 노쇼 · 당일취소)은 하나, 개인 운동 표시도 하나
create unique index if not exists ops_pt_sessions_one_use_per_day
  on public.ops_pt_sessions (branch_name, (coalesce(member_user_id::text, 'name:' || member_name)), session_date)
  where status = 'open' and kind in ('lesson', 'noshow', 'late_cancel');
create unique index if not exists ops_pt_sessions_one_self_per_day
  on public.ops_pt_sessions (branch_name, (coalesce(member_user_id::text, 'name:' || member_name)), session_date)
  where status = 'open' and kind = 'self';
alter table public.ops_pt_sessions enable row level security;

-- PT 이름표 — 앱 이름이 별명인 회원을 코치가 알아보게(이 화면 · 알림에서만 쓴다, 회원에게는 안 보인다)
create table if not exists public.ops_pt_member_labels (
  branch_name text not null references public.ops_branches(branch_name),
  member_user_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 20),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (branch_name, member_user_id)
);
alter table public.ops_pt_member_labels enable row level security;

-- 알림을 한 번만 보내기 위한 기록(입장 = 회원 · 날짜마다 · 밤 요약 = 날짜마다 · 이틀 넘은 건 = 지점 · 날짜마다)
create table if not exists public.ops_pt_notices (
  kind text not null check (kind in ('entry', 'nightly', 'overdue')),
  ref text not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref, user_id)
);
alter table public.ops_pt_notices enable row level security;

revoke all on public.ops_pt_settings, public.ops_pt_sessions, public.ops_pt_member_labels, public.ops_pt_notices
  from anon, authenticated;

-- ───────────────────────── 안쪽 함수 ─────────────────────────
-- 이 지점 PT 위탁 코치 본인의 근무자 카드 — 아니면 null
create or replace function public._ops_pt_my_staff(_uid uuid, _branch text)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.ops_staff s
   where s.branch_name = _branch and s.user_id = _uid and s.pt_freelancer and s.active
   order by s.created_at limit 1;
$$;

-- 회원마다 개수 비교(알림용 어림 — 날짜별 짝짓기는 화면 src/lib/opsPtRecord.ts 가 한다)
--   c_all = 차감되는 기록이 맡는 차감 수(시작 14일 앞부터) · c_pre = 그중 시작일 앞 것 ·
--   c_old = 시작일 뒤 · _old_until 까지(차감이 잡혔어야 할 만큼 지난 것) · d = 시작일 뒤 차감 수
create or replace function public._ops_pt_balance(_branch text, _coach uuid, _from date, _old_until date)
returns table (member_key text, c_all integer, c_pre integer, c_old integer, d integer)
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(x.member_user_id::text, 'name:' || x.member_name) as k,
           sum(x.uses)::int as c_all,
           coalesce(sum(x.uses) filter (where x.session_date < _from), 0)::int as c_pre,
           coalesce(sum(x.uses) filter (where x.session_date >= _from and x.session_date <= _old_until), 0)::int as c_old
      from public.ops_pt_sessions x
     where x.branch_name = _branch and x.status = 'open' and x.kind in ('lesson', 'noshow', 'late_cancel')
       and x.session_date >= _from - 14 and (_coach is null or x.coach_staff_id = _coach)
     group by 1),
  e as (
    select coalesce(x.member_user_id::text, 'name:' || x.member_name) as k, sum(x.used)::int as d
      from public.ops_pt_events x
     where x.branch_name = _branch and x.status in ('auto', 'confirmed') and x.work_date >= _from
       and (_coach is null or x.coach_staff_id = _coach)
     group by 1)
  select coalesce(s.k, e.k), coalesce(s.c_all, 0), coalesce(s.c_pre, 0), coalesce(s.c_old, 0), coalesce(e.d, 0)
    from s full join e on e.k = s.k;
$$;

-- 회원의 PT 이름표(없으면 앱 이름)
create or replace function public._ops_pt_member_name(_branch text, _member uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select l.label from public.ops_pt_member_labels l where l.branch_name = _branch and l.member_user_id = _member),
    (select nullif(btrim(p.name), '') from public.profiles p where p.user_id = _member),
    '회원');
$$;

-- ───────────────────────── 읽기 ─────────────────────────
-- 관리자(대표님 · 지점장) = 지점 전체, PT 위탁 코치 = 본인 담당만. 금액은 여기 없다(수당은 ops_pt_month).
create or replace function public.ops_pt_record(p_branch text, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_mine uuid;
  v_set public.ops_pt_settings;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
  v_to date;
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  if not v_manage then
    v_mine := public._ops_pt_my_staff(v_uid, p_branch);
    if v_mine is null then raise exception 'PT 자료를 볼 수 없어요'; end if;
  end if;

  select * into v_set from public.ops_pt_settings where branch_name = p_branch;
  if v_set.branch_name is null or not v_set.record_on then
    return jsonb_build_object('branch', p_branch, 'on', false, 'manage', v_manage, 'me_staff', v_mine,
                              'can_set', public._strategy_hq(v_uid));
  end if;

  v_to := least(coalesce(p_to, v_today + 31), v_today + 31);   -- 미리 적어 둔 일정 변경 · 코치 사정도 보이게
  -- 기본 = 넉 달 앞부터(시작 14일 앞까지만) — 짝짓기는 이 창 안에서 한다(오래된 차감이 늦게 잡혀도 그 기록이 창 안에 있게)
  v_from := greatest(coalesce(p_from, v_today - 120), v_set.started_on - 14);
  if v_to < v_from then v_to := v_from; end if;
  if v_to - v_from > 160 then v_from := v_to - 160; end if;

  select array_agg(distinct x.user_id) into v_ids from (
    select p.user_id from public.profiles p
     where p.branch_name = p_branch and p.pt_ticket is not null and coalesce(p.is_test_account, false) = false
    union
    select s.member_user_id from public.ops_pt_sessions s
     where s.branch_name = p_branch and s.member_user_id is not null and s.status = 'open'
       and s.session_date between v_from and v_to and (v_manage or s.coach_staff_id = v_mine)
    union
    select e.member_user_id from public.ops_pt_events e
     where e.branch_name = p_branch and e.member_user_id is not null
       and e.work_date between greatest(v_from, v_set.started_on) and v_to and (v_manage or e.coach_staff_id = v_mine)
  ) x;

  return jsonb_build_object(
    'branch', p_branch,
    'on', true,
    'notify', v_set.notify_on,
    'started_on', v_set.started_on,
    'from', v_from,
    'to', v_to,
    'today', v_today,
    'manage', v_manage,
    'can_set', public._strategy_hq(v_uid),
    'me_staff', v_mine,
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.created_at)
        from public.ops_staff c
       where c.branch_name = p_branch and c.pt_freelancer and c.active and (v_manage or c.id = v_mine)), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id,
               'name', coalesce(nullif(btrim(p.name), ''), '회원'),
               'label', (select l.label from public.ops_pt_member_labels l
                          where l.branch_name = p_branch and l.member_user_id = p.user_id),
               'tail', right(regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g'), 4),
               'ticket', p.pt_ticket, 'remaining', p.pt_remaining, 'end_date', p.pt_end_date, 'checked_at', p.pt_checked_at)
             order by p.name)
        from public.profiles p where p.user_id = any(coalesce(v_ids, '{}'::uuid[]))), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'member_user_id', s.member_user_id, 'member_name', s.member_name, 'ticket_name', s.ticket_name,
               'coach_staff_id', s.coach_staff_id, 'session_date', s.session_date, 'kind', s.kind, 'uses', s.uses,
               'moved_to', s.moved_to,
               'no_entry_reason', s.no_entry_reason, 'note', s.note, 'late', s.late, 'reviewed_at', s.reviewed_at,
               'created_at', s.created_at)
             order by s.session_date desc, s.created_at desc)
        from public.ops_pt_sessions s
       where s.branch_name = p_branch and s.status = 'open' and s.session_date between v_from and v_to
         and (v_manage or s.coach_staff_id = v_mine)), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'member_user_id', e.member_user_id, 'member_name', e.member_name, 'ticket_name', e.ticket_name,
               'before', e.before_remaining, 'after', e.after_remaining, 'used', e.used, 'kind', e.kind, 'status', e.status,
               'coach_staff_id', e.coach_staff_id, 'work_date', e.work_date, 'detected_at', e.detected_at, 'note', e.note)
             order by e.work_date desc, e.detected_at desc)
        from public.ops_pt_events e
       where e.branch_name = p_branch and e.work_date between greatest(v_from, v_set.started_on) and v_to
         and (v_manage or e.coach_staff_id = v_mine)), '[]'::jsonb),
    -- 회원 · 날짜마다 첫 입장 시각(브로제이 출석 → 앱 attendance_logs)
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'date', a.d, 'at', a.first_at) order by a.d desc, a.first_at desc)
        from (
          select l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d, min(l.checked_in_at) as first_at
            from public.attendance_logs l
           where l.branch_name = p_branch and l.user_id = any(coalesce(v_ids, '{}'::uuid[]))
             and l.checked_in_at >= (v_from::timestamp at time zone 'Asia/Seoul')
             and l.checked_in_at < ((v_to + 1)::timestamp at time zone 'Asia/Seoul')
             and not coalesce(l.is_duplicate, false)
           group by 1, 2) a), '[]'::jsonb));
end $$;

-- ───────────────────────── 쓰기 ─────────────────────────
-- p: {id?, branch, coach_staff_id?, member_user_id?, member_name?, ticket_name?, session_date, kind, uses?, moved_to?, no_entry_reason?, note?}
--   코치 = 본인 담당 기록만(코치는 늘 본인) · 관리자 = 지점 전체. 회원은 처음 넣을 때만 정한다.
create or replace function public.ops_pt_session_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text := p->>'branch';
  v_manage boolean;
  v_mine uuid;
  v_coach uuid := nullif(p->>'coach_staff_id', '')::uuid;
  v_member uuid := nullif(p->>'member_user_id', '')::uuid;
  v_name text := btrim(coalesce(p->>'member_name', ''));
  v_ticket text := nullif(btrim(coalesce(p->>'ticket_name', '')), '');
  v_kind text := p->>'kind';
  v_date date := nullif(p->>'session_date', '')::date;
  v_moved date := nullif(p->>'moved_to', '')::date;
  v_reason text := nullif(p->>'no_entry_reason', '');
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_uses integer := coalesce(nullif(p->>'uses', '')::integer, 1);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_set public.ops_pt_settings;
  v_use boolean;
  v_late boolean := false;
  v_key text;
  s public.ops_pt_sessions;
  pr record;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_id is not null then
    select * into s from public.ops_pt_sessions where id = v_id for update;
    if s.id is null or s.status <> 'open' then raise exception '기록을 찾을 수 없어요'; end if;
    v_branch := s.branch_name;
  end if;
  v_manage := public._ops_can_manage(v_uid, v_branch);
  v_mine := public._ops_pt_my_staff(v_uid, v_branch);
  if not v_manage and v_mine is null then raise exception 'PT 기록 권한이 없어요'; end if;
  select * into v_set from public.ops_pt_settings where branch_name = v_branch;
  if v_set.branch_name is null or not v_set.record_on then raise exception '이 지점은 아직 PT 기록을 쓰지 않아요'; end if;

  if v_kind is null or v_kind not in ('lesson', 'noshow', 'late_cancel', 'moved', 'coach_cancel', 'self') then
    raise exception '기록 종류를 골라 주세요';
  end if;
  v_use := v_kind in ('lesson', 'noshow', 'late_cancel');
  if v_date is null then raise exception '날짜를 골라 주세요'; end if;
  if v_date < v_set.started_on - 14 then raise exception 'PT 기록을 시작하기 전 수업은 적지 않아요'; end if;
  if v_date < v_today - 62 and not v_manage then raise exception '두 달이 지난 수업은 지점장님께 말씀해 주세요'; end if;
  if v_kind in ('lesson', 'noshow', 'late_cancel', 'self') and v_date > v_today then raise exception '아직 오지 않은 날은 적을 수 없어요'; end if;
  if v_date > v_today + 31 then raise exception '날짜가 너무 멀어요'; end if;
  if v_kind = 'moved' then
    if v_moved is null then raise exception '옮긴 날짜를 골라 주세요'; end if;
    if v_moved = v_date then raise exception '옮긴 날짜가 원래 날짜와 같아요'; end if;
    if abs(v_moved - v_date) > 62 then raise exception '옮긴 날짜가 너무 멀어요'; end if;
  else
    v_moved := null;
  end if;
  if v_kind <> 'lesson' or v_reason not in ('door_open', 'manual', 'other') then v_reason := null; end if;
  if v_note is not null and length(v_note) > 300 then v_note := left(v_note, 300); end if;
  -- 연속 2회 수업처럼 한 번에 여러 회가 빠지는 날 — 수업만 1~4회, 나머지는 늘 1
  if v_kind <> 'lesson' then v_uses := 1; end if;
  if v_uses < 1 or v_uses > 4 then raise exception '횟수는 1~4회로 넣어 주세요'; end if;
  -- 출석 체크 없는 수업은 사유가 있어야 한다(대표님 11/11 — 사유를 고르면 인정). 앱 계정이 이어진 회원만 본다
  if v_id is not null then v_member := s.member_user_id; end if;   -- 회원은 처음 넣을 때만 정한다
  if v_kind = 'lesson' and v_reason is null and v_member is not null
     and not exists (
       select 1 from public.attendance_logs l
        where l.user_id = v_member and l.branch_name = v_branch
          and l.checked_in_at >= (v_date::timestamp at time zone 'Asia/Seoul')
          and l.checked_in_at < ((v_date + 1)::timestamp at time zone 'Asia/Seoul')) then
    raise exception '그날 출석 체크가 없어요 — 사유를 골라 주세요';
  end if;

  -- 담당 코치: 코치는 늘 본인 · 관리자는 고르거나(같은 지점 PT 코치) 한 명뿐이면 그 코치
  if not v_manage then
    v_coach := v_mine;
  else
    if v_coach is null then v_coach := coalesce(s.coach_staff_id, v_mine); end if;
    if v_coach is null and (select count(*) from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active) = 1 then
      select c.id into v_coach from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active;
    end if;
    if v_coach is not null and not exists (
      select 1 from public.ops_staff c where c.id = v_coach and c.branch_name = v_branch and c.pt_freelancer) then
      raise exception '같은 지점 PT 코치만 고를 수 있어요';
    end if;
  end if;
  if v_coach is null then raise exception '담당 코치를 골라 주세요'; end if;

  -- 늦은 기록: 차감되는 기록을 수업 다음 날부터 코치가 적으면 지점장 확인을 받는다(관리자가 적으면 확인된 것으로)
  if v_use and not v_manage and v_date < v_today then v_late := true; end if;

  if v_id is null then
    if v_member is not null then
      select p2.user_id, p2.name, p2.pt_ticket, p2.branch_name into pr from public.profiles p2 where p2.user_id = v_member;
      if pr.user_id is null or pr.branch_name is distinct from v_branch then raise exception '이 지점 회원이 아니에요'; end if;
      v_name := coalesce(nullif(btrim(pr.name), ''), nullif(v_name, ''), '회원');
      v_ticket := coalesce(v_ticket, pr.pt_ticket);
    end if;
    if length(v_name) = 0 then raise exception '회원을 골라 주세요'; end if;
    v_name := left(v_name, 40);
    v_key := coalesce(v_member::text, 'name:' || v_name);

    if v_kind = 'self' and exists (
      select 1 from public.ops_pt_sessions x
       where x.branch_name = v_branch and x.status = 'open' and x.session_date = v_date
         and x.kind in ('lesson', 'noshow', 'late_cancel')
         and coalesce(x.member_user_id::text, 'name:' || x.member_name) = v_key) then
      raise exception '그날 수업 기록이 이미 있어요';
    end if;
    if v_use then
      -- 그날 '개인 운동'으로 닫아 둔 표시는 수업 기록이 생기면 뺀다
      update public.ops_pt_sessions x
         set status = 'void', void_reason = '수업 기록으로 바뀜', updated_by = v_uid, updated_at = now()
       where x.branch_name = v_branch and x.status = 'open' and x.session_date = v_date and x.kind = 'self'
         and coalesce(x.member_user_id::text, 'name:' || x.member_name) = v_key;
    end if;

    insert into public.ops_pt_sessions (branch_name, coach_staff_id, member_user_id, member_name, ticket_name, session_date, kind,
                                        uses, moved_to, no_entry_reason, note, late, reviewed_by, reviewed_at, created_by)
    values (v_branch, v_coach, v_member, v_name, v_ticket, v_date, v_kind, v_uses, v_moved, v_reason, v_note, v_late,
            case when v_manage then v_uid end, case when v_manage then now() end, v_uid)
    returning id into v_id;
  else
    if not v_manage and s.coach_staff_id is distinct from v_mine then raise exception '내 기록만 고칠 수 있어요'; end if;
    update public.ops_pt_sessions
       set kind = v_kind, session_date = v_date, uses = v_uses, moved_to = v_moved, no_entry_reason = v_reason, note = v_note,
           coach_staff_id = v_coach,
           late = case when v_manage then false else (late or v_late) end,
           reviewed_by = case when v_manage then v_uid when (late or v_late) then null else reviewed_by end,
           reviewed_at = case when v_manage then now() when (late or v_late) then null else reviewed_at end,
           updated_by = v_uid, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception '그날 이 회원 기록이 이미 있어요';
end $$;

-- 지우기(무효) — 지우지 않고 남긴다. 사유가 있어야 한다. 코치 = 본인 기록 · 관리자 = 지점 전체
create or replace function public.ops_pt_session_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  s public.ops_pt_sessions;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into s from public.ops_pt_sessions where id = p_id for update;
  if s.id is null or s.status <> 'open' then raise exception '기록을 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, s.branch_name)
     and s.coach_staff_id is distinct from public._ops_pt_my_staff(v_uid, s.branch_name) then
    raise exception '내 기록만 지울 수 있어요';
  end if;
  if v_reason is null or length(v_reason) < 2 then raise exception '지우는 이유를 적어 주세요'; end if;
  update public.ops_pt_sessions
     set status = 'void', void_reason = left(v_reason, 300), updated_by = v_uid, updated_at = now()
   where id = p_id;
end $$;

-- 늦은 기록 확인 — 대표님 · 지점장
create or replace function public.ops_pt_session_review(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.ops_pt_sessions;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into s from public.ops_pt_sessions where id = p_id for update;
  if s.id is null or s.status <> 'open' then raise exception '기록을 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, s.branch_name) then raise exception '관리 권한이 없어요'; end if;
  update public.ops_pt_sessions
     set reviewed_by = v_uid, reviewed_at = now(), updated_by = v_uid, updated_at = now()
   where id = p_id;
end $$;

-- PT 이름표 넣기 · 지우기(빈 글) — 대표님 · 지점장 · 그 지점 PT 코치
create or replace function public.ops_pt_member_label_set(p_branch text, p_member uuid, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not public._ops_can_manage(v_uid, p_branch) and public._ops_pt_my_staff(v_uid, p_branch) is null then
    raise exception 'PT 기록 권한이 없어요';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = p_member and p.branch_name = p_branch) then
    raise exception '이 지점 회원이 아니에요';
  end if;
  if v_label is null then
    delete from public.ops_pt_member_labels where branch_name = p_branch and member_user_id = p_member;
    return;
  end if;
  if length(v_label) > 20 then raise exception '이름표는 20자까지예요'; end if;
  insert into public.ops_pt_member_labels (branch_name, member_user_id, label, updated_by)
  values (p_branch, p_member, v_label, v_uid)
  on conflict (branch_name, member_user_id) do update
     set label = excluded.label, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- 켜기 · 끄기 — 대표님만. p: {record_on?, notify_on?, started_on?}
create or replace function public.ops_pt_setting_set(p_branch text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_set public.ops_pt_settings;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 바꿀 수 있어요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = p_branch and b.enabled) then
    raise exception '운영본부를 켠 지점이 아니에요';
  end if;
  insert into public.ops_pt_settings (branch_name, record_on, notify_on, started_on, updated_by)
  values (p_branch, coalesce((p->>'record_on')::boolean, false), coalesce((p->>'notify_on')::boolean, false),
          coalesce(nullif(p->>'started_on', '')::date, (now() at time zone 'Asia/Seoul')::date), v_uid)
  on conflict (branch_name) do update
     set record_on = coalesce((p->>'record_on')::boolean, public.ops_pt_settings.record_on),
         notify_on = coalesce((p->>'notify_on')::boolean, public.ops_pt_settings.notify_on),
         started_on = coalesce(nullif(p->>'started_on', '')::date, public.ops_pt_settings.started_on),
         updated_by = v_uid, updated_at = now()
  returning * into v_set;
  return jsonb_build_object('branch', v_set.branch_name, 'record_on', v_set.record_on, 'notify_on', v_set.notify_on,
                            'started_on', v_set.started_on);
end $$;

-- ───────────────────────── 알림 (예약) ─────────────────────────
-- 1분마다: PT 수업권이 있는 회원이 들어오면 그 지점 PT 코치에게 한 번(회원 · 날짜마다, 그날 기록이 아직 없을 때)
create or replace function public._ops_pt_entry_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_rows integer;
begin
  for r in
    select distinct on (l.user_id, c.user_id)
           l.user_id as member, l.branch_name, c.user_id as coach_uid,
           public._ops_pt_member_name(l.branch_name, l.user_id) as member_name,
           (l.checked_in_at at time zone 'Asia/Seoul')::date as d
      from public.attendance_logs l
      join public.ops_pt_settings st on st.branch_name = l.branch_name and st.record_on and st.notify_on
      join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                            and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
      join public.ops_staff c on c.branch_name = l.branch_name and c.pt_freelancer and c.active and c.user_id is not null
     where l.checked_in_at > now() - interval '20 minutes'
       and not coalesce(l.is_duplicate, false)
       and c.user_id <> l.user_id
     order by l.user_id, c.user_id, l.checked_in_at
  loop
    if exists (select 1 from public.ops_pt_sessions s
                where s.branch_name = r.branch_name and s.member_user_id = r.member
                  and s.session_date = r.d and s.status = 'open') then
      continue;
    end if;
    insert into public.ops_pt_notices (kind, ref, user_id)
    values ('entry', r.member::text || ':' || r.d::text, r.coach_uid)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      insert into public.notifications (user_id, title, body, link)
      values (r.coach_uid, 'PT · ' || r.member_name || ' 님 입장', 'PT 수업이면 수업 뒤 「수업 완료」를 눌러 주세요',
              '/office?tab=work&pt=today');
      n := n + 1;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_entry_tick: %', sqlerrm;
  return -1;
end $$;

-- 밤 10시(KST): 오늘 기록 안 한 회원 · 이틀 넘은 차감 대기 · 사유 없는 차감이 있으면 코치에게 한 번
create or replace function public._ops_pt_nightly()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_miss integer;
  v_wait integer;
  v_extra integer;
  v_rows integer;
begin
  for r in
    select st.branch_name, st.started_on, c.id as staff_id, c.user_id as coach_uid
      from public.ops_pt_settings st
      join public.ops_staff c on c.branch_name = st.branch_name and c.pt_freelancer and c.active and c.user_id is not null
     where st.record_on and st.notify_on
  loop
    select count(distinct l.user_id) into v_miss
      from public.attendance_logs l
      join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                            and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
     where l.branch_name = r.branch_name
       and l.checked_in_at >= (v_today::timestamp at time zone 'Asia/Seoul')
       and l.checked_in_at < ((v_today + 1)::timestamp at time zone 'Asia/Seoul')
       and not coalesce(l.is_duplicate, false)
       and not exists (select 1 from public.ops_pt_sessions s
                        where s.branch_name = r.branch_name and s.member_user_id = l.user_id
                          and s.session_date = v_today and s.status = 'open');
    -- 밤 10시: 그제까지의 수업은 차감이 잡혔어야 한다(차감은 회원마다 하루~이틀에 한 번 읽는다)
    select coalesce(sum(greatest(b.c_old - greatest(b.d - b.c_pre, 0), 0)), 0)::int,
           coalesce(sum(greatest(b.d - b.c_all, 0)), 0)::int
      into v_wait, v_extra
      from public._ops_pt_balance(r.branch_name, r.staff_id, r.started_on, v_today - 2) b;

    if v_miss + v_wait + v_extra > 0 then
      insert into public.ops_pt_notices (kind, ref, user_id) values ('nightly', v_today::text, r.coach_uid)
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.notifications (user_id, title, body, link)
        values (r.coach_uid, 'PT 기록 확인',
                concat_ws(' · ',
                  case when v_miss > 0 then '오늘 기록 안 한 회원 ' || v_miss || '명' end,
                  case when v_wait > 0 then '차감 대기 ' || v_wait || '건' end,
                  case when v_extra > 0 then '사유 없는 차감 ' || v_extra || '회' end),
                '/office?tab=work&pt=today');
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_nightly: %', sqlerrm;
  return -1;
end $$;

-- 아침 10시(KST): 이틀 넘게 남은 건이 있으면 대표님 · 지점장에게 하루 한 번
create or replace function public._ops_pt_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_miss integer;
  v_wait integer;
  v_extra integer;
  v_rows integer;
begin
  for r in select st.branch_name, st.started_on from public.ops_pt_settings st where st.record_on and st.notify_on
  loop
    -- 이틀 넘게 '수업이었는지' 답이 없는 입장(회원 · 날짜)
    select count(*) into v_miss from (
      select distinct l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d
        from public.attendance_logs l
        join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                              and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
       where l.branch_name = r.branch_name
         and l.checked_in_at >= (r.started_on::timestamp at time zone 'Asia/Seoul')
         and l.checked_in_at < ((v_today - 1)::timestamp at time zone 'Asia/Seoul')
         and not coalesce(l.is_duplicate, false)) a
     where not exists (select 1 from public.ops_pt_sessions s
                        where s.branch_name = r.branch_name and s.member_user_id = a.user_id
                          and s.session_date = a.d and s.status = 'open');
    -- 아침 10시: 사흘 전까지의 수업(이틀이 꽉 지난 것)
    select coalesce(sum(greatest(b.c_old - greatest(b.d - b.c_pre, 0), 0)), 0)::int,
           coalesce(sum(greatest(b.d - b.c_all, 0)), 0)::int
      into v_wait, v_extra
      from public._ops_pt_balance(r.branch_name, null, r.started_on, v_today - 3) b;

    if v_miss + v_wait + v_extra > 0 then
      insert into public.ops_pt_notices (kind, ref, user_id)
      values ('overdue', r.branch_name || ':' || v_today::text, '00000000-0000-0000-0000-000000000000')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        perform public._ops_notify_managers(r.branch_name, 'PT 기록 · 이틀 넘은 확인 필요',
          concat_ws(' · ',
            replace(r.branch_name, '153복싱짐 ', ''),
            case when v_miss > 0 then '기록 없는 입장 ' || v_miss || '건' end,
            case when v_wait > 0 then '차감 대기 ' || v_wait || '건' end,
            case when v_extra > 0 then '사유 없는 차감 ' || v_extra || '회' end));
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_overdue: %', sqlerrm;
  return -1;
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public._ops_pt_my_staff(uuid, text) from public, anon, authenticated;
revoke all on function public._ops_pt_balance(text, uuid, date, date) from public, anon, authenticated;
revoke all on function public._ops_pt_member_name(text, uuid) from public, anon, authenticated;
revoke all on function public._ops_pt_entry_tick() from public, anon, authenticated;
revoke all on function public._ops_pt_nightly() from public, anon, authenticated;
revoke all on function public._ops_pt_overdue() from public, anon, authenticated;
revoke all on function public.ops_pt_record(text, date, date) from public, anon;
revoke all on function public.ops_pt_session_save(jsonb) from public, anon;
revoke all on function public.ops_pt_session_void(uuid, text) from public, anon;
revoke all on function public.ops_pt_session_review(uuid) from public, anon;
revoke all on function public.ops_pt_setting_set(text, jsonb) from public, anon;
revoke all on function public.ops_pt_member_label_set(text, uuid, text) from public, anon;
grant execute on function public.ops_pt_record(text, date, date) to authenticated;
grant execute on function public.ops_pt_session_save(jsonb) to authenticated;
grant execute on function public.ops_pt_session_void(uuid, text) to authenticated;
grant execute on function public.ops_pt_session_review(uuid) to authenticated;
grant execute on function public.ops_pt_setting_set(text, jsonb) to authenticated;
grant execute on function public.ops_pt_member_label_set(text, uuid, text) to authenticated;

-- ───────────────────────── 예약 (같은 이름이면 덮어쓴다) ─────────────────────────
select cron.schedule('ops-pt-entry-tick', '* * * * *', $cron$select public._ops_pt_entry_tick()$cron$);
select cron.schedule('ops-pt-nightly', '0 13 * * *', $cron$select public._ops_pt_nightly()$cron$);   -- 22:00 KST
select cron.schedule('ops-pt-overdue', '0 1 * * *', $cron$select public._ops_pt_overdue()$cron$);    -- 10:00 KST
