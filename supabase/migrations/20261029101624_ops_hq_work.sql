-- 153운영본부 1단계 — 근무(근태) (2026-10-29 대표님 · Claude Docs 보고서 「153운영본부 — 코치 계약 · 근태 · 급여 자동화」)
--
--   대표님 결정(10-29): 선릉역점 · 칠금점 먼저 · 출근은 입구 얼굴 인식(브로제이 → staff_duty_logs) 필수,
--   퇴근은 코치님이 따로 하지 않고 시간표 끝 시각으로 자동 · 일찍 감/늦게 옴은 지점장 · 대표님이 고침 ·
--   연장 근무는 코치 신청 → 대표님 승인 · 수업 대타(PT 대타 없음) · 시급 · 급여는 대표님 · 지점장 + 지정한 회계매니저만.
--
--   새 표 · 새 함수만 (기존 함수 동작은 그대로). 표는 RLS 를 켜고 정책 없이 — 읽기 · 쓰기는 모두 아래 함수로만.
--   근무자 명단 · 시급 같은 실제 값은 이 파일에 넣지 않는다(공개 저장소) — 앱 화면이나 SQL 편집기에서 넣는다.
--   계산(인정 시간 · 지각 · 누락 · 기본급)은 화면 src/lib/opsWork.ts 한 곳 — 2단계 월 마감 때 확정값을 저장한다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_branches (
  branch_name text primary key,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ops_branches enable row level security;
insert into public.ops_branches (branch_name) values ('153복싱짐 선릉역점'), ('153복싱짐 칠금점')
on conflict (branch_name) do nothing;

-- 근무자 카드 — 앱 계정이 없어도 만들 수 있다(user_id 없음 → 얼굴 출근은 이름으로 맞춤)
create table if not exists public.ops_staff (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  user_id uuid,
  name text not null check (length(btrim(name)) between 1 and 40),
  -- parttime 아르바이트(시급) · freelancer 3.3% · employee 4대보험 근로자 · intern 수습 · volunteer 무급 도우미
  kind text not null default 'parttime' check (kind in ('parttime', 'freelancer', 'employee', 'intern', 'volunteer')),
  pay_type text not null default 'hourly' check (pay_type in ('hourly', 'monthly', 'none')),
  hourly_wage integer check (hourly_wage is null or hourly_wage between 0 and 1000000),
  monthly_salary integer check (monthly_salary is null or monthly_salary between 0 and 100000000),
  pt_freelancer boolean not null default false,          -- PT 는 3.3% 따로(2단계 · 3단계)
  checkin_required boolean not null default true,        -- false = 얼굴 출근 없이 시간표대로 인정(출근 단말이 없는 지점)
  start_date date,
  end_date date,
  active boolean not null default true,
  note text check (note is null or length(note) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ops_staff_branch_idx on public.ops_staff (branch_name);
create index if not exists ops_staff_user_idx on public.ops_staff (user_id);
alter table public.ops_staff enable row level security;

-- 주간 시간표 — 요일마다 구간 여러 개(예: 10~12 · 15~17 · 18~22:30). 바꾸면 그날부터 새 줄, 예전 줄은 valid_to 로 닫는다
create table if not exists public.ops_shift_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.ops_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = 일요일
  start_time time not null,
  end_time time not null,
  valid_from date not null,
  valid_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists ops_shift_rules_staff_idx on public.ops_shift_rules (staff_id);
alter table public.ops_shift_rules enable row level security;

-- 날짜별 — adjust(인정 시간 고침) · off(쉰 날) · overtime(연장 근무 신청) · cover(수업 대타: staff → cover_staff)
create table if not exists public.ops_day_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.ops_staff(id) on delete cascade,
  work_date date not null,
  kind text not null check (kind in ('adjust', 'off', 'overtime', 'cover')),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  minutes integer check (minutes is null or minutes between 0 and 1440),
  start_time time,
  end_time time,
  cover_staff_id uuid references public.ops_staff(id) on delete set null,
  reason text check (reason is null or length(reason) <= 300),
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decide_note text check (decide_note is null or length(decide_note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists ops_day_entries_staff_idx on public.ops_day_entries (staff_id, work_date);
create index if not exists ops_day_entries_cover_idx on public.ops_day_entries (cover_staff_id, work_date);
alter table public.ops_day_entries enable row level security;

-- 회계매니저 · 지점장 — 시급 · 급여를 볼 수 있고 시간표 · 근무를 고칠 수 있는 사람(대표님이 지정, branch_name null = 모든 지점)
create table if not exists public.ops_managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  branch_name text references public.ops_branches(branch_name),
  title text not null default '지점장' check (title in ('지점장', '회계매니저')),
  granted_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists ops_managers_uniq on public.ops_managers (user_id, coalesce(branch_name, '*'));
alter table public.ops_managers enable row level security;

revoke all on public.ops_branches, public.ops_staff, public.ops_shift_rules, public.ops_day_entries, public.ops_managers
  from anon, authenticated;

-- ───────────────────────── 권한 ─────────────────────────
-- 관리 = 대표님(hq) 또는 그 지점(또는 모든 지점)에 지정된 지점장 · 회계매니저. 앱 권한 'branch_manager' 만으로는 아니다
-- (선릉역점은 코치님 몇 분에게도 앱 관리 권한이 있어 시급이 보이면 안 된다 — 대표님 "나랑 지점장 둘만").
create or replace function public._ops_can_manage(_uid uuid, _branch text)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null
     and exists (select 1 from public.ops_branches b where b.branch_name = _branch and b.enabled)
     and (public._strategy_hq(_uid)
          or exists (select 1 from public.ops_managers m
                      where m.user_id = _uid and (m.branch_name is null or m.branch_name = _branch)));
$$;

create or replace function public._ops_branch_of(_staff uuid)
returns text language sql stable security definer set search_path = public as $$
  select branch_name from public.ops_staff where id = _staff;
$$;

create or replace function public._ops_is_mine(_uid uuid, _staff uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and exists (select 1 from public.ops_staff s where s.id = _staff and s.user_id = _uid);
$$;

-- 알림 한 건 (알림함 · 휴대폰 푸시는 notifications 트리거가 보낸다)
create or replace function public._ops_notify(_to uuid, _title text, _body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select _to, _title, coalesce(_body, ''), '/office?tab=work' where _to is not null;
$$;

-- 그 지점 관리자(대표님 + 지정된 지점장 · 회계매니저)에게 알림
create or replace function public._ops_notify_managers(_branch text, _title text, _body text, _hq_only boolean default false)
returns void language sql security definer set search_path = public as $$
  select public._ops_notify(u.user_id, _title, _body)
    from (
      select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
      union
      select m.user_id from public.ops_managers m
       where not _hq_only and (m.branch_name is null or m.branch_name = _branch)
    ) u;
$$;

revoke all on function public._ops_can_manage(uuid, text) from public, anon, authenticated;
revoke all on function public._ops_branch_of(uuid) from public, anon, authenticated;
revoke all on function public._ops_is_mine(uuid, uuid) from public, anon, authenticated;
revoke all on function public._ops_notify(uuid, text, text) from public, anon, authenticated;
revoke all on function public._ops_notify_managers(text, text, text, boolean) from public, anon, authenticated;

-- ───────────────────────── 읽기 ─────────────────────────
-- 내가 볼 수 있는 것 — 관리하는 지점 · 내 근무자 카드
create or replace function public.ops_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('manage', '[]'::jsonb, 'mine', '[]'::jsonb); end if;
  return jsonb_build_object(
    'me', v_uid,
    'hq', public._strategy_hq(v_uid),
    'manage', coalesce((select jsonb_agg(b.branch_name order by b.branch_name)
                          from public.ops_branches b
                         where b.enabled and public._ops_can_manage(v_uid, b.branch_name)), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'branch', s.branch_name, 'name', s.name) order by s.branch_name)
                        from public.ops_staff s join public.ops_branches b on b.branch_name = s.branch_name and b.enabled
                       where s.user_id = v_uid and s.active), '[]'::jsonb));
end $$;

-- 한 달 근무 자료 — 관리자는 지점 전체(시급 포함), 코치님은 내 것만(시급 없음) + 대타 고를 동료 이름
create or replace function public.ops_month(p_branch text, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_manage boolean := public._ops_can_manage(v_uid, p_branch);
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_manage then
    select coalesce(array_agg(id), '{}') into v_ids from public.ops_staff where branch_name = p_branch;
  else
    select coalesce(array_agg(id), '{}') into v_ids from public.ops_staff where branch_name = p_branch and user_id = v_uid;
    if cardinality(v_ids) = 0 then raise exception '이 지점 근무 자료를 볼 수 없어요'; end if;
  end if;

  return jsonb_build_object(
    'branch', p_branch,
    'month', to_char(v_from, 'YYYY-MM-DD'),
    'manage', v_manage,
    'hq', public._strategy_hq(v_uid),
    'today', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'now_hm', to_char(now() at time zone 'Asia/Seoul', 'HH24:MI'),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'user_id', s.user_id, 'name', s.name, 'kind', s.kind, 'pay_type', s.pay_type,
               'hourly_wage', case when v_manage then s.hourly_wage end,
               'monthly_salary', case when v_manage then s.monthly_salary end,
               'pt_freelancer', s.pt_freelancer, 'checkin_required', s.checkin_required,
               'start_date', s.start_date, 'end_date', s.end_date, 'active', s.active,
               'note', case when v_manage then s.note end, 'mine', s.user_id = v_uid)
             order by s.active desc, s.name)
        from public.ops_staff s where s.id = any(v_ids)), '[]'::jsonb),
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'staff_id', r.staff_id, 'weekday', r.weekday,
               'start_time', to_char(r.start_time, 'HH24:MI'), 'end_time', to_char(r.end_time, 'HH24:MI'),
               'valid_from', r.valid_from, 'valid_to', r.valid_to)
             order by r.staff_id, r.weekday, r.start_time)
        from public.ops_shift_rules r
       where r.staff_id = any(v_ids) and r.valid_from <= v_to and (r.valid_to is null or r.valid_to >= v_from)), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'staff_id', e.staff_id, 'work_date', e.work_date, 'kind', e.kind, 'status', e.status,
               'minutes', e.minutes,
               'start_time', to_char(e.start_time, 'HH24:MI'), 'end_time', to_char(e.end_time, 'HH24:MI'),
               'cover_staff_id', e.cover_staff_id, 'reason', e.reason, 'decide_note', e.decide_note,
               'requested_by_me', e.requested_by = v_uid, 'created_at', e.created_at, 'decided_at', e.decided_at)
             order by e.work_date, e.created_at)
        from public.ops_day_entries e
       where (e.staff_id = any(v_ids) or e.cover_staff_id = any(v_ids))
         and e.work_date between v_from and v_to and e.status <> 'canceled'), '[]'::jsonb),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', x.staff_id, 'work_date', x.d,
                                          'at_hm', to_char(x.first_at at time zone 'Asia/Seoul', 'HH24:MI'))
             order by x.d)
        from (select s.id as staff_id, l.attend_date as d, min(l.checked_in_at) as first_at
                from public.ops_staff s
                join public.staff_duty_logs l
                  on l.branch_name = s.branch_name
                 and l.attend_date between v_from and v_to
                 and ((s.user_id is not null and l.user_id = s.user_id) or l.staff_name = s.name)
               where s.id = any(v_ids)
               group by s.id, l.attend_date) x), '[]'::jsonb),
    -- 대타로 고를 수 있는 같은 지점 동료 (이름만)
    'colleagues', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name)
        from public.ops_staff s
       where s.branch_name = p_branch and s.active and s.kind <> 'volunteer'), '[]'::jsonb));
end $$;

-- 근무자 카드에 이을 앱 계정 후보 — 그 지점 지도진(관리자만)
create or replace function public.ops_candidates(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._ops_can_manage(v_uid, p_branch) then raise exception '관리 권한이 없어요'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', p.name,
                                        'linked', exists (select 1 from public.ops_staff s where s.user_id = p.user_id and s.branch_name = p_branch))
           order by p.name)
      from public.profiles p
     where p.user_id in (select user_id from public._strategy_branch_staff(p_branch))
        or p.user_id in (select l.user_id from public.staff_duty_logs l
                          where l.branch_name = p_branch and l.user_id is not null and l.attend_date > current_date - 60)), '[]'::jsonb);
end $$;

-- ───────────────────────── 쓰기 (관리자) ─────────────────────────
create or replace function public.ops_staff_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text;
  v_kind text := coalesce(nullif(p->>'kind', ''), 'parttime');
  v_pay text := coalesce(nullif(p->>'pay_type', ''), case when coalesce(nullif(p->>'kind', ''), 'parttime') = 'volunteer' then 'none' else 'hourly' end);
  v_wage integer := nullif(p->>'hourly_wage', '')::integer;
  v_salary integer := nullif(p->>'monthly_salary', '')::integer;
begin
  if v_id is not null then
    select branch_name into v_branch from public.ops_staff where id = v_id;
    if v_branch is null then raise exception '근무자를 찾을 수 없어요'; end if;
  else
    v_branch := p->>'branch';
  end if;
  if not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  if length(btrim(coalesce(p->>'name', ''))) = 0 then raise exception '이름을 넣어 주세요'; end if;
  if v_kind = 'volunteer' then v_pay := 'none'; end if;
  -- 최저시급 (2026년 10,320원 · 2027년 10,700원 — 앱이 1월 전에 미리 알린다)
  if v_pay = 'hourly' and (v_wage is null or v_wage < 10320) then
    raise exception '시급은 최저시급(2026년 10,320원) 이상이어야 해요';
  end if;
  if v_pay = 'monthly' and coalesce(v_salary, 0) <= 0 then raise exception '월급을 넣어 주세요'; end if;

  if v_id is null then
    insert into public.ops_staff (branch_name, user_id, name, kind, pay_type, hourly_wage, monthly_salary, pt_freelancer,
                                  checkin_required, start_date, end_date, active, note, created_by)
    values (v_branch, nullif(p->>'user_id', '')::uuid, btrim(p->>'name'), v_kind, v_pay,
            case when v_pay = 'hourly' then v_wage end, case when v_pay = 'monthly' then v_salary end,
            coalesce((p->>'pt_freelancer')::boolean, false), coalesce((p->>'checkin_required')::boolean, true),
            nullif(p->>'start_date', '')::date, nullif(p->>'end_date', '')::date,
            coalesce((p->>'active')::boolean, true), nullif(btrim(coalesce(p->>'note', '')), ''), v_uid)
    returning id into v_id;
  else
    update public.ops_staff set
      user_id = nullif(p->>'user_id', '')::uuid,
      name = btrim(p->>'name'),
      kind = v_kind, pay_type = v_pay,
      hourly_wage = case when v_pay = 'hourly' then v_wage end,
      monthly_salary = case when v_pay = 'monthly' then v_salary end,
      pt_freelancer = coalesce((p->>'pt_freelancer')::boolean, false),
      checkin_required = coalesce((p->>'checkin_required')::boolean, true),
      start_date = nullif(p->>'start_date', '')::date,
      end_date = nullif(p->>'end_date', '')::date,
      active = coalesce((p->>'active')::boolean, true),
      note = nullif(btrim(coalesce(p->>'note', '')), ''),
      updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;

-- 시간표 저장 — p_rules = [{weekday, start, end}], p_from 부터 새 시간표(그 전 날까지는 예전 시간표 그대로)
create or replace function public.ops_schedule_save(p_staff uuid, p_rules jsonb, p_from date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text := public._ops_branch_of(p_staff); v_n integer := 0; r jsonb;
begin
  if v_branch is null then raise exception '근무자를 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  if p_from is null then raise exception '언제부터인지 골라 주세요'; end if;
  if jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_rules, '[]'::jsonb)) > 40 then
    raise exception '시간표 모양이 이상해요';
  end if;
  delete from public.ops_shift_rules where staff_id = p_staff and valid_from >= p_from;
  update public.ops_shift_rules set valid_to = p_from - 1
   where staff_id = p_staff and (valid_to is null or valid_to >= p_from);
  for r in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    if (r->>'end')::time <= (r->>'start')::time then raise exception '끝나는 시각이 시작보다 늦어야 해요'; end if;
    insert into public.ops_shift_rules (staff_id, weekday, start_time, end_time, valid_from, created_by)
    values (p_staff, (r->>'weekday')::smallint, (r->>'start')::time, (r->>'end')::time, p_from, v_uid);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 날짜별 기록 — adjust · off 는 관리자(바로 반영), overtime 은 신청 → 대표님 승인, cover 는 신청 → 관리자 승인
create or replace function public.ops_entry_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid := (p->>'staff_id')::uuid;
  v_kind text := p->>'kind';
  v_date date := (p->>'work_date')::date;
  v_branch text := public._ops_branch_of(v_staff);
  v_manage boolean;
  v_hq boolean := public._strategy_hq(v_uid);
  v_mine boolean := public._ops_is_mine(v_uid, v_staff);
  v_status text;
  v_id uuid;
  v_name text;
  v_cover uuid := nullif(p->>'cover_staff_id', '')::uuid;
  v_cover_name text;
  v_min integer := nullif(p->>'minutes', '')::integer;
begin
  if v_branch is null then raise exception '근무자를 찾을 수 없어요'; end if;
  v_manage := public._ops_can_manage(v_uid, v_branch);
  if v_kind not in ('adjust', 'off', 'overtime', 'cover') then raise exception '알 수 없는 기록이에요'; end if;
  if v_date is null then raise exception '날짜를 골라 주세요'; end if;
  select name into v_name from public.ops_staff where id = v_staff;

  if v_kind in ('adjust', 'off') then
    if not v_manage then raise exception '근무 시간은 지점장 · 대표님만 고칠 수 있어요'; end if;
    if v_kind = 'adjust' and v_min is null then raise exception '인정할 시간을 넣어 주세요'; end if;
    update public.ops_day_entries set status = 'canceled'
     where staff_id = v_staff and work_date = v_date and kind in ('adjust', 'off') and status = 'approved';
    v_status := 'approved';
  elsif v_kind = 'overtime' then
    if not (v_mine or v_manage) then raise exception '내 근무만 신청할 수 있어요'; end if;
    if coalesce(v_min, 0) <= 0 then raise exception '연장한 시간을 넣어 주세요'; end if;
    v_status := case when v_hq then 'approved' else 'pending' end;
  else -- cover
    if not (v_mine or v_manage) then raise exception '내 수업만 대타를 요청할 수 있어요'; end if;
    if v_cover is null or v_cover = v_staff then raise exception '대타 코치님을 골라 주세요'; end if;
    if public._ops_branch_of(v_cover) is distinct from v_branch then raise exception '같은 지점 코치님만 대타를 할 수 있어요'; end if;
    if nullif(p->>'start_time', '') is null or nullif(p->>'end_time', '') is null
       or (p->>'end_time')::time <= (p->>'start_time')::time then
      raise exception '대타 수업 시간을 골라 주세요';
    end if;
    select name into v_cover_name from public.ops_staff where id = v_cover;
    v_min := (extract(epoch from ((p->>'end_time')::time - (p->>'start_time')::time)) / 60)::integer;
    v_status := case when v_manage then 'approved' else 'pending' end;
  end if;

  insert into public.ops_day_entries (staff_id, work_date, kind, status, minutes, start_time, end_time, cover_staff_id,
                                      reason, requested_by, decided_by, decided_at)
  values (v_staff, v_date, v_kind, v_status, case when v_kind = 'off' then 0 else v_min end,
          nullif(p->>'start_time', '')::time, nullif(p->>'end_time', '')::time, v_cover,
          nullif(btrim(coalesce(p->>'reason', '')), ''), v_uid,
          case when v_status = 'approved' then v_uid end, case when v_status = 'approved' then now() end)
  returning id into v_id;

  if v_status = 'pending' and v_kind = 'overtime' then
    perform public._ops_notify_managers(v_branch, '⏱ 연장 근무 신청',
      format('%s · %s %s분 — 승인해 주세요', v_name, to_char(v_date, 'MM/DD'), v_min), true);
  elsif v_status = 'pending' and v_kind = 'cover' then
    perform public._ops_notify_managers(v_branch, '🔁 수업 대타 요청',
      format('%s → %s · %s %s~%s', v_name, v_cover_name, to_char(v_date, 'MM/DD'), p->>'start_time', p->>'end_time'), false);
  elsif v_status = 'approved' and v_kind = 'cover' then
    perform public._ops_notify((select user_id from public.ops_staff where id = v_cover), '🔁 수업 대타가 정해졌어요',
      format('%s %s~%s · %s 코치님 수업', to_char(v_date, 'MM/DD'), p->>'start_time', p->>'end_time', v_name));
  end if;
  return v_id;
end $$;

-- 승인 · 거절 — 연장 근무는 대표님만, 대타는 지점장 · 대표님
create or replace function public.ops_entry_decide(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); e public.ops_day_entries; v_branch text; v_name text; v_cover_name text;
begin
  select * into e from public.ops_day_entries where id = p_id for update;
  if e.id is null then raise exception '기록을 찾을 수 없어요'; end if;
  if e.status <> 'pending' then raise exception '이미 처리된 요청이에요'; end if;
  v_branch := public._ops_branch_of(e.staff_id);
  if e.kind = 'overtime' and not public._strategy_hq(v_uid) then raise exception '연장 근무는 대표님만 승인할 수 있어요'; end if;
  if e.kind = 'cover' and not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  update public.ops_day_entries
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = v_uid, decided_at = now(), decide_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id;
  select name into v_name from public.ops_staff where id = e.staff_id;
  perform public._ops_notify((select user_id from public.ops_staff where id = e.staff_id),
    case when e.kind = 'overtime' then (case when p_approve then '✅ 연장 근무 승인' else '연장 근무 반려' end)
         else (case when p_approve then '✅ 대타 승인' else '대타 요청 반려' end) end,
    format('%s%s', to_char(e.work_date, 'MM/DD'), coalesce(' · ' || nullif(btrim(coalesce(p_note, '')), ''), '')));
  if e.kind = 'cover' and p_approve then
    perform public._ops_notify((select user_id from public.ops_staff where id = e.cover_staff_id), '🔁 수업 대타가 정해졌어요',
      format('%s %s~%s · %s 코치님 수업', to_char(e.work_date, 'MM/DD'), to_char(e.start_time, 'HH24:MI'), to_char(e.end_time, 'HH24:MI'), v_name));
  end if;
end $$;

-- 취소 — 내가 낸 대기 중 요청, 또는 관리자
create or replace function public.ops_entry_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); e public.ops_day_entries;
begin
  select * into e from public.ops_day_entries where id = p_id for update;
  if e.id is null then raise exception '기록을 찾을 수 없어요'; end if;
  if not (public._ops_can_manage(v_uid, public._ops_branch_of(e.staff_id))
          or (e.requested_by = v_uid and e.status = 'pending')) then
    raise exception '취소할 수 없어요';
  end if;
  update public.ops_day_entries set status = 'canceled' where id = p_id;
end $$;

-- 지점장 · 회계매니저 지정 (대표님만)
create or replace function public.ops_manager_set(p_user uuid, p_branch text, p_title text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._strategy_hq(v_uid) then raise exception '대표님만 지정할 수 있어요'; end if;
  if p_on then
    insert into public.ops_managers (user_id, branch_name, title, granted_by)
    values (p_user, nullif(p_branch, ''), coalesce(nullif(p_title, ''), '지점장'), v_uid)
    on conflict (user_id, (coalesce(branch_name, '*'))) do update set title = excluded.title;
  else
    delete from public.ops_managers where user_id = p_user and coalesce(branch_name, '*') = coalesce(nullif(p_branch, ''), '*');
  end if;
end $$;

create or replace function public.ops_manager_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._strategy_hq(v_uid) then raise exception '대표님만 볼 수 있어요'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.name, 'branch', m.branch_name, 'title', m.title)
                                    order by m.branch_name nulls first, p.name)
                     from public.ops_managers m left join public.profiles p on p.user_id = m.user_id), '[]'::jsonb);
end $$;

revoke all on function public.ops_me() from public, anon;
revoke all on function public.ops_month(text, date) from public, anon;
revoke all on function public.ops_candidates(text) from public, anon;
revoke all on function public.ops_staff_save(jsonb) from public, anon;
revoke all on function public.ops_schedule_save(uuid, jsonb, date) from public, anon;
revoke all on function public.ops_entry_save(jsonb) from public, anon;
revoke all on function public.ops_entry_decide(uuid, boolean, text) from public, anon;
revoke all on function public.ops_entry_cancel(uuid) from public, anon;
revoke all on function public.ops_manager_set(uuid, text, text, boolean) from public, anon;
revoke all on function public.ops_manager_list() from public, anon;
grant execute on function public.ops_me() to authenticated;
grant execute on function public.ops_month(text, date) to authenticated;
grant execute on function public.ops_candidates(text) to authenticated;
grant execute on function public.ops_staff_save(jsonb) to authenticated;
grant execute on function public.ops_schedule_save(uuid, jsonb, date) to authenticated;
grant execute on function public.ops_entry_save(jsonb) to authenticated;
grant execute on function public.ops_entry_decide(uuid, boolean, text) to authenticated;
grant execute on function public.ops_entry_cancel(uuid) to authenticated;
grant execute on function public.ops_manager_set(uuid, text, text, boolean) to authenticated;
grant execute on function public.ops_manager_list() to authenticated;
