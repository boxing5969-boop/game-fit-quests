-- 153운영본부 「근무」 1단계 — 출근 확정(코치 신고 → 지점장 승인 · 출근 알림) · PT 차감 × 입장 자동 기록
-- (2026-11-12 대표님 「추천대로하자」 · 보고서 「코치 근무·PT 정직 체크 방법 보고서」 https://claude.ai/artifact/THLBCi9iNUkyaonYXc3z2U)
--
-- 원칙: 코치는 한 번만 한다(출근 = 입구 얼굴 인식 · PT = 브로제이 차감) · 코치가 바꿀 수 없는 기록이 기준 · 어긋난 것만 사람이 본다.
--
-- ① 출근 확정 (근로 코치 — 아르바이트 · 4대보험 · 수습. 3.3% 위탁 · 무급 도우미는 출근 알림 없음)
--   · ops_duty_settings  지점마다 출근 알림 켜기(대표님) · 코치 알림 N분(기본 15) · 지점장 알림 M분(기본 60)
--   · ops_duty_reports   코치 신고 — here 와 있었어요(얼굴 인식 안 됨, 온 시각) · early 일찍 퇴근(나간 시각) · off 쉬는 날
--                        → 지점장 · 대표님 승인 = ops_day_entries 에 approved adjust / off 한 줄(ops_entry_save 의 관리자 길과 같은 모양)
--   · ops_duty_notices   알림 한 번만(코치 · 지점장, 사람 · 날짜마다)
--   · 예약 ops-duty-tick(5분) — 오늘 시간표 시작 N분 뒤에도 얼굴 출근 · 신고 · 고친 기록이 없으면 코치에게, M분 뒤엔 지점장에게
--   시간표 계산은 「근무」 탭 computeDay(src/lib/opsWork.ts) · public_staff_on_duty 와 같은 기준(근무 기간 · 쉰 날 · 대타 넘김/받음),
--   출근부 짝은 ops_month 와 같은 식(앱 계정, 없으면 이름).
--
-- ② PT 자동 기록 (지점마다 ops_pt_settings.auto_record — 대표님이 켠다, 기본 꺼짐)
--   · 브로제이 차감 중 짝지을 기록이 없는 것(화면 matchPtRecord 와 같은 짝짓기)에 그 회원이 차감 전 이틀 안에 입장한 날이 있으면
--     그날 '수업' 기록을 저절로 넣는다(source 'auto', 담당 코치 = 차감의 코치). 한 차감은 한 번만(ops_pt_auto_log) —
--     코치 · 지점장이 지운 자동 기록은 되살리지 않는다. 예약 ops-pt-auto-record(매시 50분 — sync-pt-members 45분 뒤).
--   · 켠 지점만 달라지는 기존 함수 4개: ops_pt_record('auto' · 기록 'source') · _ops_pt_entry_tick(입장 알림 글 — 「수업 완료」 대신 '차감만') ·
--     _ops_pt_nightly(오늘 기록 안 한 회원 → 이틀 넘게 차감이 안 잡힌 입장) · _ops_pt_overdue(입장 확인을 하루 더 기다림).
--     차감은 153OS 가 회원마다 하루~이틀에 한 번 읽어 늦게 잡히므로, 이틀 안의 입장은 묻지 않는다. 꺼진 지점은 예전과 같다.
--
-- 새 표 4 · 새 칸 2 · 새 함수 12 · 예약 2 + 위 기존 함수 4(켠 지점만). 표는 anon · authenticated 모두 막고 함수로만.

-- ───────────────────────── ① 출근 확정 ─────────────────────────
create table if not exists public.ops_duty_settings (
  branch_name text primary key references public.ops_branches(branch_name) on delete cascade,
  nudge_on boolean not null default false,
  coach_after_min smallint not null default 15 check (coach_after_min between 5 and 120),
  manager_after_min smallint not null default 60 check (manager_after_min between 15 and 240),
  started_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ops_duty_settings enable row level security;

create table if not exists public.ops_duty_reports (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  staff_id uuid not null references public.ops_staff(id) on delete cascade,
  work_date date not null,
  -- here 와 있었어요(얼굴 인식 안 됨) · early 일찍 퇴근 · off 쉬는 날
  kind text not null check (kind in ('here', 'early', 'off')),
  at_time time,                                -- here: 온 시각 · early: 나간 시각
  minutes integer check (minutes is null or minutes between 0 and 1440), -- 신고대로 인정할 시간(앱이 시간표로 계산 — 승인 때 고칠 수 있음)
  note text check (note is null or length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'canceled')),
  entry_id uuid references public.ops_day_entries(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decide_note text check (decide_note is null or length(decide_note) <= 200),
  check (kind = 'off' or at_time is not null)
);
create unique index if not exists ops_duty_reports_one_open on public.ops_duty_reports (staff_id, work_date, kind) where status = 'open';
create index if not exists ops_duty_reports_branch_idx on public.ops_duty_reports (branch_name, work_date desc);
alter table public.ops_duty_reports enable row level security;

create table if not exists public.ops_duty_notices (
  kind text not null check (kind in ('coach', 'manager')),
  staff_id uuid not null references public.ops_staff(id) on delete cascade,
  work_date date not null,
  sent_at timestamptz not null default now(),
  primary key (kind, staff_id, work_date)
);
alter table public.ops_duty_notices enable row level security;

revoke all on public.ops_duty_settings, public.ops_duty_reports, public.ops_duty_notices from anon, authenticated;

-- 그날 시간표 구간 — computeDay 와 같은 기준: 근무 기간 안 · 승인된 쉰 날이면 없음 · 대타로 넘긴 수업은 빼고 · 대타로 받은 수업은 더함
create or replace function public._ops_duty_segments(_staff uuid, _date date)
returns table (start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select r.start_time, r.end_time
    from public.ops_staff s
    join public.ops_shift_rules r on r.staff_id = s.id
   where s.id = _staff
     and (s.start_date is null or s.start_date <= _date)
     and (s.end_date is null or s.end_date >= _date)
     and not exists (select 1 from public.ops_day_entries o
                      where o.staff_id = s.id and o.work_date = _date and o.kind = 'off' and o.status = 'approved')
     and r.weekday = extract(dow from _date)::int
     and r.valid_from <= _date and (r.valid_to is null or r.valid_to >= _date)
     and not exists (select 1 from public.ops_day_entries g
                      where g.staff_id = s.id and g.work_date = _date and g.kind = 'cover' and g.status = 'approved'
                        and g.start_time is not null and g.end_time is not null
                        and r.start_time < g.end_time and g.start_time < r.end_time)
  union all
  select c.start_time, c.end_time
    from public.ops_day_entries c
   where c.cover_staff_id = _staff and c.work_date = _date and c.kind = 'cover' and c.status = 'approved'
     and c.start_time is not null and c.end_time is not null;
$$;

-- 그날 얼굴 출근(브로제이 · QR → staff_duty_logs)이 있나 — ops_month 와 같은 짝(앱 계정, 없으면 이름)
create or replace function public._ops_duty_checked(_staff uuid, _date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.ops_staff s
      join public.staff_duty_logs d on d.branch_name = s.branch_name and d.attend_date = _date
                                   and ((s.user_id is not null and d.user_id = s.user_id) or d.staff_name = s.name)
     where s.id = _staff);
$$;

-- 신고 한 줄 — 알림 · 처리 기록에 쓴다 (화면 src/lib/opsDuty.ts DUTY_KIND_TEXT 와 같은 말)
create or replace function public._ops_duty_kind_text(_kind text, _at time)
returns text language sql immutable set search_path = public as $$
  select case _kind
           when 'here' then '와 있었어요 ' || left(_at::text, 5) || '(얼굴 인식 안 됨)'
           when 'early' then '일찍 퇴근 ' || left(_at::text, 5)
           else '쉬는 날이에요' end;
$$;

-- 135 → '2시간 15분' (화면 fmtDuration 과 같은 말)
create or replace function public._ops_duty_hm(_min integer)
returns text language sql immutable as $$
  select case when _min is null then ''
              when _min < 60 then _min || '분'
              when _min % 60 = 0 then (_min / 60) || '시간'
              else (_min / 60) || '시간 ' || (_min % 60) || '분' end;
$$;

-- 목록 — 관리자(대표님 · ops_managers) = 지점 전체 · 코치 = 내 근무자 카드 것만. 열린 것 + 30일 안에 낸 것
create or replace function public.ops_duty_reports(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_mine uuid[];
  v_set public.ops_duty_settings;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  if not v_manage then
    select array_agg(s.id) into v_mine from public.ops_staff s where s.branch_name = p_branch and s.user_id = v_uid;
    if v_mine is null then raise exception '근무 자료를 볼 수 없어요'; end if;
  end if;
  select * into v_set from public.ops_duty_settings where branch_name = p_branch;
  return jsonb_build_object(
    'branch', p_branch,
    'manage', v_manage,
    'can_set', public._strategy_hq(v_uid),
    'today', (now() at time zone 'Asia/Seoul')::date,
    'setting', jsonb_build_object(
      'on', coalesce(v_set.nudge_on, false),
      'coach_after_min', coalesce(v_set.coach_after_min, 15),
      'manager_after_min', coalesce(v_set.manager_after_min, 60),
      'started_on', v_set.started_on),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'staff_id', r.staff_id, 'staff_name', s.name, 'work_date', r.work_date, 'kind', r.kind,
               'at_time', left(r.at_time::text, 5), 'minutes', r.minutes, 'note', r.note, 'status', r.status,
               'created_at', r.created_at, 'mine', r.created_by = v_uid,
               'decided_at', r.decided_at, 'decide_note', r.decide_note)
             order by (r.status = 'open') desc, r.work_date desc, r.created_at desc)
        from public.ops_duty_reports r
        join public.ops_staff s on s.id = r.staff_id
       where r.branch_name = p_branch
         and (v_manage or r.staff_id = any(v_mine))
         and (r.status = 'open' or r.created_at > now() - interval '30 days')), '[]'::jsonb));
end $$;

-- 코치 신고 — 내 근무자 카드 · 오늘부터 14일 앞까지. 같은 날 · 같은 종류가 열려 있으면 그 신고를 고친다(두 번 누름 · 시각 바꿈)
-- p: {staff_id, work_date, kind, at_time?, minutes?, note?}
create or replace function public.ops_duty_report_send(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid := nullif(p->>'staff_id', '')::uuid;
  v_kind text := nullif(p->>'kind', '');
  v_date date := nullif(p->>'work_date', '')::date;
  v_at time := nullif(p->>'at_time', '')::time;
  v_min integer := nullif(p->>'minutes', '')::integer;
  v_note text := left(nullif(btrim(coalesce(p->>'note', '')), ''), 200);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_now time := (now() at time zone 'Asia/Seoul')::time;
  v_s public.ops_staff;
  v_old uuid;
  v_id uuid;
  v_n integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_s from public.ops_staff where id = v_staff;
  if v_s.id is null or not v_s.active then raise exception '근무자를 찾을 수 없어요'; end if;
  if not public._ops_is_mine(v_uid, v_staff) then raise exception '내 근무만 신고할 수 있어요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = v_s.branch_name and b.enabled) then
    raise exception '운영본부를 켠 지점이 아니에요';
  end if;
  if v_kind is null or v_kind not in ('here', 'early', 'off') then raise exception '무엇을 알릴지 골라 주세요'; end if;
  if v_date is null then raise exception '날짜를 골라 주세요'; end if;
  if v_date > v_today then raise exception '아직 오지 않은 날은 신고할 수 없어요'; end if;
  if v_date < v_today - 14 then raise exception '14일이 지난 날은 지점장님께 말씀해 주세요'; end if;
  if v_kind = 'off' then
    v_at := null;
    v_min := null;
  elsif v_at is null then
    raise exception '시각을 넣어 주세요';
  elsif v_date = v_today and v_at - v_now > interval '5 minutes' then
    raise exception '아직 오지 않은 시각이에요';
  end if;
  if v_min is not null and (v_min < 0 or v_min > 1440) then raise exception '인정 시간이 이상해요'; end if;
  if v_kind = 'here' and public._ops_duty_checked(v_staff, v_date) then
    raise exception '이날은 얼굴 출근이 찍혀 있어요 — 시각이 다르면 지점장님께 말씀해 주세요';
  end if;

  select r.id into v_old from public.ops_duty_reports r
   where r.staff_id = v_staff and r.work_date = v_date and r.kind = v_kind and r.status = 'open';
  if v_old is not null then
    update public.ops_duty_reports set at_time = v_at, minutes = v_min, note = v_note where id = v_old;
    return jsonb_build_object('id', v_old, 'updated', true);
  end if;
  select count(*) into v_n from public.ops_duty_reports r where r.staff_id = v_staff and r.created_at > now() - interval '1 day';
  if v_n >= 10 then raise exception '하루에 10건까지 신고할 수 있어요'; end if;

  insert into public.ops_duty_reports (branch_name, staff_id, work_date, kind, at_time, minutes, note, created_by)
  values (v_s.branch_name, v_staff, v_date, v_kind, v_at, v_min, v_note, v_uid)
  returning id into v_id;

  -- 대표님 · 그 지점 관리자에게(보낸 분 빼고)
  insert into public.notifications (user_id, title, body, link)
  select u.user_id, '📍 출근 신고 · ' || v_s.name,
         to_char(v_date, 'MM/DD') || ' ' || public._ops_duty_kind_text(v_kind, v_at) || ' — 확인해 주세요', '/office?tab=work'
    from (select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
          union
          select m.user_id from public.ops_managers m where m.branch_name is null or m.branch_name = v_s.branch_name) u
   where u.user_id <> v_uid;
  return jsonb_build_object('id', v_id, 'updated', false);
end $$;

-- 처리 — 지점 관리자 · 대표님(내가 보낸 신고는 대표님만). 승인 = 그날 인정 시간을 고친 기록(ops_day_entries)으로
create or replace function public.ops_duty_report_decide(p_id uuid, p_approve boolean, p_minutes integer default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r public.ops_duty_reports;
  v_s public.ops_staff;
  v_min integer;
  v_entry uuid;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 200);
  v_text text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_r from public.ops_duty_reports where id = p_id for update;
  if v_r.id is null then raise exception '신고를 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, v_r.branch_name) then raise exception '지점장 · 대표님만 처리할 수 있어요'; end if;
  if v_r.created_by = v_uid and not public._strategy_hq(v_uid) then raise exception '내가 보낸 신고는 대표님이 처리해요'; end if;
  if v_r.status <> 'open' then raise exception '이미 처리된 신고예요'; end if;
  select * into v_s from public.ops_staff where id = v_r.staff_id;
  v_text := public._ops_duty_kind_text(v_r.kind, v_r.at_time);

  if coalesce(p_approve, false) then
    if v_r.kind <> 'off' then
      v_min := coalesce(p_minutes, v_r.minutes);
      if v_min is null then raise exception '인정할 시간을 넣어 주세요'; end if;
      if v_min < 0 or v_min > 1440 then raise exception '인정 시간이 이상해요'; end if;
    end if;
    -- ops_entry_save 의 관리자 길과 같다 — 그날 반영된 시간 고침 · 쉰 날은 새 것으로 바뀐다
    update public.ops_day_entries set status = 'canceled'
     where staff_id = v_r.staff_id and work_date = v_r.work_date and kind in ('adjust', 'off') and status = 'approved';
    insert into public.ops_day_entries (staff_id, work_date, kind, status, minutes, reason, requested_by, decided_by, decided_at, decide_note)
    values (v_r.staff_id, v_r.work_date, case when v_r.kind = 'off' then 'off' else 'adjust' end, 'approved',
            case when v_r.kind = 'off' then 0 else v_min end,
            left('코치 신고 · ' || v_text || coalesce(' · ' || v_r.note, ''), 200),
            v_r.created_by, v_uid, now(), v_note)
    returning id into v_entry;
    update public.ops_duty_reports
       set status = 'approved', minutes = coalesce(v_min, minutes), entry_id = v_entry,
           decided_by = v_uid, decided_at = now(), decide_note = v_note
     where id = p_id;
    perform public._ops_notify(v_s.user_id, '✅ 출근 신고를 확인했어요',
      to_char(v_r.work_date, 'MM/DD') || ' ' || v_text ||
      case when v_r.kind = 'off' then ' · 쉰 날로 반영' else ' · 인정 ' || public._ops_duty_hm(v_min) end ||
      coalesce(' · ' || v_note, ''));
    return jsonb_build_object('id', p_id, 'status', 'approved', 'entry_id', v_entry, 'minutes', v_min);
  end if;

  update public.ops_duty_reports set status = 'rejected', decided_by = v_uid, decided_at = now(), decide_note = v_note where id = p_id;
  perform public._ops_notify(v_s.user_id, '출근 신고가 반려됐어요',
    to_char(v_r.work_date, 'MM/DD') || ' ' || v_text || coalesce(' · ' || v_note, ' · 지점장님께 말씀해 주세요'));
  return jsonb_build_object('id', p_id, 'status', 'rejected');
end $$;

-- 신고 취소 — 보낸 분 · 내 근무자 카드, 처리 전만
create or replace function public.ops_duty_report_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r public.ops_duty_reports;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_r from public.ops_duty_reports where id = p_id for update;
  if v_r.id is null then raise exception '신고를 찾을 수 없어요'; end if;
  if v_r.created_by is distinct from v_uid and not public._ops_is_mine(v_uid, v_r.staff_id) then
    raise exception '내가 보낸 신고만 취소할 수 있어요';
  end if;
  if v_r.status <> 'open' then raise exception '이미 처리된 신고예요'; end if;
  update public.ops_duty_reports set status = 'canceled' where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'canceled');
end $$;

-- 출근 알림 켜기 · 끄기 · 시각(대표님만). 켜는 날부터 알린다
create or replace function public.ops_duty_setting_set(p_branch text, p_on boolean, p_coach_min integer default null, p_manager_min integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_set public.ops_duty_settings;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 바꿀 수 있어요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = p_branch and b.enabled) then
    raise exception '운영본부를 켠 지점이 아니에요';
  end if;
  if p_coach_min is not null and (p_coach_min < 5 or p_coach_min > 120) then raise exception '코치 알림은 5~120분 사이로 골라 주세요'; end if;
  if p_manager_min is not null and (p_manager_min < 15 or p_manager_min > 240) then raise exception '지점장 알림은 15~240분 사이로 골라 주세요'; end if;
  insert into public.ops_duty_settings (branch_name, nudge_on, coach_after_min, manager_after_min, started_on, updated_by)
  values (p_branch, coalesce(p_on, false), coalesce(p_coach_min, 15), coalesce(p_manager_min, 60), v_today, v_uid)
  on conflict (branch_name) do update
     set nudge_on = coalesce(p_on, public.ops_duty_settings.nudge_on),
         coach_after_min = coalesce(p_coach_min, public.ops_duty_settings.coach_after_min),
         manager_after_min = coalesce(p_manager_min, public.ops_duty_settings.manager_after_min),
         started_on = case when coalesce(p_on, false) and not public.ops_duty_settings.nudge_on then v_today
                           else public.ops_duty_settings.started_on end,
         updated_by = v_uid, updated_at = now()
  returning * into v_set;
  if v_set.manager_after_min <= v_set.coach_after_min then raise exception '지점장 알림은 코치 알림보다 늦어야 해요'; end if;
  return jsonb_build_object('on', v_set.nudge_on, 'coach_after_min', v_set.coach_after_min,
                            'manager_after_min', v_set.manager_after_min, 'started_on', v_set.started_on);
end $$;

-- 5분마다 — 오늘 시간표 시작 N분 뒤(6시간 안) 코치에게 · M분 뒤(8시간 안) 지점장에게 한 번씩.
--   얼굴 출근이 있거나 · 그날 고친 기록(시간 고침 · 쉰 날)이 있거나 · 신고가 열렸거나 승인됐으면 보내지 않는다.
create or replace function public.ops_duty_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_tm time := (now() at time zone 'Asia/Seoul')::time;
  v_nm integer := extract(hour from (now() at time zone 'Asia/Seoul'))::int * 60 + extract(minute from (now() at time zone 'Asia/Seoul'))::int;
  v_first time;
  v_fm integer;
  v_rows integer;
begin
  for r in
    select s.id, s.name, s.user_id, s.branch_name, st.coach_after_min, st.manager_after_min
      from public.ops_duty_settings st
      join public.ops_branches b on b.branch_name = st.branch_name and b.enabled
      join public.ops_staff s on s.branch_name = st.branch_name and s.active and s.checkin_required
                             and s.kind in ('parttime', 'employee', 'intern')
     where st.nudge_on and st.started_on <= v_today
  loop
    select min(g.start_time) into v_first from public._ops_duty_segments(r.id, v_today) g;
    continue when v_first is null or v_first > v_tm;
    v_fm := extract(hour from v_first)::int * 60 + extract(minute from v_first)::int;
    continue when v_nm < v_fm + r.coach_after_min;
    continue when public._ops_duty_checked(r.id, v_today);
    continue when exists (select 1 from public.ops_day_entries e
                           where e.staff_id = r.id and e.work_date = v_today and e.kind in ('adjust', 'off') and e.status = 'approved');
    continue when exists (select 1 from public.ops_duty_reports x
                           where x.staff_id = r.id and x.work_date = v_today and x.status in ('open', 'approved'));
    if r.user_id is not null and v_nm < v_fm + 360 then
      insert into public.ops_duty_notices (kind, staff_id, work_date) values ('coach', r.id, v_today) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.notifications (user_id, title, body, link)
        values (r.user_id, '⏰ 출근 기록이 아직 없어요',
                left(v_first::text, 5) || ' 근무예요 — 와 있다면 눌러서 알려 주세요(얼굴 인식이 안 됐을 수 있어요)',
                '/office?tab=work&duty=' || v_today::text);
        n := n + 1;
      end if;
    end if;
    if v_nm >= v_fm + r.manager_after_min and v_nm < v_fm + 480 then
      insert into public.ops_duty_notices (kind, staff_id, work_date) values ('manager', r.id, v_today) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        perform public._ops_notify_managers(r.branch_name, '📍 출근 기록 없음 · ' || r.name,
          to_char(v_today, 'MM/DD') || ' ' || left(v_first::text, 5) || ' 근무 · ' || r.manager_after_min ||
          '분이 지나도 출근 기록 · 신고가 없어요');
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning 'ops_duty_tick: %', sqlerrm;
  return -1;
end $$;

-- ───────────────────────── ② PT 자동 기록 ─────────────────────────
alter table public.ops_pt_settings add column if not exists auto_record boolean not null default false;
alter table public.ops_pt_sessions add column if not exists source text not null default 'coach' check (source in ('coach', 'auto'));

create table if not exists public.ops_pt_auto_log (
  event_id uuid primary key references public.ops_pt_events(id) on delete cascade,
  session_id uuid references public.ops_pt_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ops_pt_auto_log enable row level security;
revoke all on public.ops_pt_auto_log from anon, authenticated;

-- 매시 50분 — 짝지을 기록이 없는 차감(최근 30일 · 담당 코치 있음 · 처음 보는 차감)에 입장한 날이 있으면 그날 '수업' 기록을 넣는다.
--   짝짓기 · 어림은 화면(matchPtRecord · ptGuessClassDay)과 같은 순서: 칸 = 차감되는 기록(날짜 · 만든 순, uses 만큼) ·
--   ① 차감이 잡힌 날에서 이틀 앞까지 ② 더 오래된 기록 ③ 남은 차감은 이른 것부터 — 그날에서 이틀 앞까지 · 앱이 알아채기 전 ·
--   그날 기록이 없는(어떤 종류든) 가장 늦은 입장. 한 입장은 한 차감에만.
create or replace function public._ops_pt_auto_record()
returns integer language plpgsql security definer set search_path = public as $$
declare
  st record;
  m record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
  v_min date;
  n integer := 0;
  v_sd date[];
  v_st boolean[];
  v_ue uuid[];
  v_uw date[];
  v_ua timestamptz[];
  v_ul integer[];
  v_uc uuid[];
  v_ut text[];
  v_taken date[];
  v_ns integer;
  v_nu integer;
  i integer;
  j integer;
  v_guess date;
  v_sid uuid;
  v_name text;
begin
  for st in select s.branch_name, s.started_on from public.ops_pt_settings s where s.record_on and s.auto_record loop
    v_from := greatest(v_today - 120, st.started_on - 14);   -- ops_pt_record 와 같은 창
    v_min := st.started_on - 14;
    for m in
      select distinct e.member_user_id as uid
        from public.ops_pt_events e
       where e.branch_name = st.branch_name and e.member_user_id is not null
         and e.status in ('auto', 'confirmed') and e.used > 0
         and e.work_date >= greatest(st.started_on, v_today - 30)
    loop
      -- 칸
      select coalesce(array_agg(x.d order by x.d, x.c), '{}'::date[]) into v_sd
        from (select s.session_date as d, s.created_at as c
                from public.ops_pt_sessions s
                cross join lateral generate_series(1, greatest(1, s.uses::int)) g
               where s.branch_name = st.branch_name and s.member_user_id = m.uid and s.status = 'open'
                 and s.kind in ('lesson', 'noshow', 'late_cancel') and s.session_date >= v_from) x;
      v_ns := coalesce(array_length(v_sd, 1), 0);
      v_st := array_fill(false, array[greatest(v_ns, 1)]);
      -- 차감
      select coalesce(array_agg(e.id order by e.work_date, e.detected_at), '{}'::uuid[]),
             coalesce(array_agg(e.work_date order by e.work_date, e.detected_at), '{}'::date[]),
             coalesce(array_agg(e.detected_at order by e.work_date, e.detected_at), '{}'::timestamptz[]),
             coalesce(array_agg(e.used order by e.work_date, e.detected_at), '{}'::integer[]),
             coalesce(array_agg(e.coach_staff_id order by e.work_date, e.detected_at), '{}'::uuid[]),
             coalesce(array_agg(e.ticket_name order by e.work_date, e.detected_at), '{}'::text[])
        into v_ue, v_uw, v_ua, v_ul, v_uc, v_ut
        from public.ops_pt_events e
       where e.branch_name = st.branch_name and e.member_user_id = m.uid
         and e.status in ('auto', 'confirmed') and e.used > 0
         and e.work_date >= greatest(v_from, st.started_on);
      v_nu := coalesce(array_length(v_ue, 1), 0);
      continue when v_nu = 0;

      -- ① 제때(이틀 안)
      for i in 1 .. v_nu loop
        j := 1;
        while v_ul[i] > 0 and j <= v_ns loop
          if not v_st[j] and v_sd[j] <= v_uw[i] and v_uw[i] - v_sd[j] <= 2 then
            v_st[j] := true;
            v_ul[i] := v_ul[i] - 1;
          end if;
          j := j + 1;
        end loop;
      end loop;
      -- ② 늦은 차감 — 더 오래된 기록
      for i in 1 .. v_nu loop
        j := 1;
        while v_ul[i] > 0 and j <= v_ns loop
          if not v_st[j] and v_sd[j] < v_uw[i] then
            v_st[j] := true;
            v_ul[i] := v_ul[i] - 1;
          end if;
          j := j + 1;
        end loop;
      end loop;

      -- ③ 남은 차감 — 입장한 날 어림
      select coalesce(array_agg(distinct s.session_date), '{}'::date[]) into v_taken
        from public.ops_pt_sessions s
       where s.branch_name = st.branch_name and s.member_user_id = m.uid and s.status = 'open';
      for i in 1 .. v_nu loop
        continue when v_ul[i] <= 0;
        select a.d into v_guess
          from (select (l.checked_in_at at time zone 'Asia/Seoul')::date as d, min(l.checked_in_at) as first_at
                  from public.attendance_logs l
                 where l.branch_name = st.branch_name and l.user_id = m.uid and not coalesce(l.is_duplicate, false)
                   and l.checked_in_at >= ((v_uw[i] - 2)::timestamp at time zone 'Asia/Seoul')
                   and l.checked_in_at < ((v_uw[i] + 1)::timestamp at time zone 'Asia/Seoul')
                 group by 1) a
         where a.first_at < v_ua[i] and a.d >= v_min and not (a.d = any(v_taken))
         order by a.d desc
         limit 1;
        continue when v_guess is null;
        v_taken := v_taken || v_guess;                -- 넣지 않고 넘겨도 그 입장은 이 차감 몫(화면과 같게)
        continue when v_uw[i] < v_today - 30;         -- 오래된 차감은 사람 몫
        continue when v_uc[i] is null;                -- 담당 코치가 없으면 지점장 몫
        continue when exists (select 1 from public.ops_pt_auto_log g where g.event_id = v_ue[i]);   -- 한 번 넣은 차감은 다시 안 넣는다
        select coalesce(nullif(btrim(p.name), ''), '회원') into v_name from public.profiles p where p.user_id = m.uid;
        begin
          insert into public.ops_pt_sessions (branch_name, coach_staff_id, member_user_id, member_name, ticket_name,
                                              session_date, kind, uses, note, source)
          values (st.branch_name, v_uc[i], m.uid, left(coalesce(v_name, '회원'), 40), left(v_ut[i], 80),
                  v_guess, 'lesson', least(greatest(v_ul[i], 1), 4), '자동 기록 — 브로제이 차감 + 그날 입장', 'auto')
          returning id into v_sid;
          insert into public.ops_pt_auto_log (event_id, session_id) values (v_ue[i], v_sid);
          n := n + 1;
        exception when unique_violation then
          null;   -- 그사이 그날 기록이 들어왔다
        end;
      end loop;
    end loop;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_auto_record: %', sqlerrm;
  return -1;
end $$;

-- 자동 기록 켜기 · 끄기(대표님만, PT 기록을 켠 지점) — 켜면 바로 한 번 돈다
create or replace function public.ops_pt_auto_set(p_branch text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
  v_made integer := 0;
begin
  if v_uid is null or not public._strategy_hq(v_uid) then raise exception '대표님만 바꿀 수 있어요'; end if;
  update public.ops_pt_settings set auto_record = coalesce(p_on, false), updated_by = v_uid, updated_at = now()
   where branch_name = p_branch and record_on;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'PT 기록을 켠 지점에서만 쓸 수 있어요'; end if;
  if coalesce(p_on, false) then v_made := public._ops_pt_auto_record(); end if;
  return jsonb_build_object('branch', p_branch, 'auto', coalesce(p_on, false), 'made', v_made);
end $$;

-- ───────────────────────── 기존 함수 — 자동 기록을 켠 지점만 달라진다 ─────────────────────────
-- (아래 넷은 20261111184433_ops_pt_record.sql 정의 위에 고친 것 — 2026-11-12 운영 DB 와 지문이 같음을 확인)

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
    'auto', v_set.auto_record,
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
               'created_at', s.created_at, 'source', s.source)
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

create or replace function public._ops_pt_entry_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_rows integer;
begin
  for r in
    select distinct on (l.user_id, c.user_id)
           l.user_id as member, l.branch_name, c.user_id as coach_uid, st.auto_record as auto,
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
      values (r.coach_uid, 'PT · ' || r.member_name || ' 님 입장', case when r.auto then 'PT 수업이면 끝나고 브로제이에서 차감만 해 주세요 — 앱이 알아서 기록해요'
                   else 'PT 수업이면 수업 뒤 「수업 완료」를 눌러 주세요' end,
              '/office?tab=work&pt=today');
      n := n + 1;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_entry_tick: %', sqlerrm;
  return -1;
end $$;


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
    select st.branch_name, st.started_on, st.auto_record as auto, c.id as staff_id, c.user_id as coach_uid
      from public.ops_pt_settings st
      join public.ops_staff c on c.branch_name = st.branch_name and c.pt_freelancer and c.active and c.user_id is not null
     where st.record_on and st.notify_on
  loop
    if r.auto then
      -- 자동 기록(2026-11-12): 오늘 입장은 차감이 잡히면 저절로 적힌다 — 이틀이 꽉 지나도 기록이 안 생긴 입장(회원 · 날짜)만 센다
      select count(*) into v_miss from (
        select distinct l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d
          from public.attendance_logs l
          join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                                and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
         where l.branch_name = r.branch_name
           and l.checked_in_at >= (r.started_on::timestamp at time zone 'Asia/Seoul')
           and l.checked_in_at < ((v_today - 2)::timestamp at time zone 'Asia/Seoul')
           and not coalesce(l.is_duplicate, false)) a
       where not exists (select 1 from public.ops_pt_sessions s
                          where s.branch_name = r.branch_name and s.member_user_id = a.user_id
                            and s.session_date = a.d and s.status = 'open');
    else
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
    end if;
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
                  case when v_miss > 0 then case when r.auto then '차감이 안 잡힌 입장 ' || v_miss || '건'
                                                 else '오늘 기록 안 한 회원 ' || v_miss || '명' end end,
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
  for r in select st.branch_name, st.started_on, st.auto_record as auto from public.ops_pt_settings st where st.record_on and st.notify_on
  loop
    -- 이틀 넘게 '수업이었는지' 답이 없는 입장(회원 · 날짜)
    select count(*) into v_miss from (
      select distinct l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d
        from public.attendance_logs l
        join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                              and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
       where l.branch_name = r.branch_name
         and l.checked_in_at >= (r.started_on::timestamp at time zone 'Asia/Seoul')
         and l.checked_in_at < ((v_today - case when r.auto then 2 else 1 end)::timestamp at time zone 'Asia/Seoul')
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

revoke all on function public._ops_duty_segments(uuid, date) from public, anon, authenticated;
revoke all on function public._ops_duty_checked(uuid, date) from public, anon, authenticated;
revoke all on function public._ops_duty_kind_text(text, time) from public, anon, authenticated;
revoke all on function public._ops_duty_hm(integer) from public, anon, authenticated;
revoke all on function public.ops_duty_tick() from public, anon, authenticated;
revoke all on function public._ops_pt_auto_record() from public, anon, authenticated;
revoke all on function public.ops_duty_reports(text) from public, anon;
revoke all on function public.ops_duty_report_send(jsonb) from public, anon;
revoke all on function public.ops_duty_report_decide(uuid, boolean, integer, text) from public, anon;
revoke all on function public.ops_duty_report_cancel(uuid) from public, anon;
revoke all on function public.ops_duty_setting_set(text, boolean, integer, integer) from public, anon;
revoke all on function public.ops_pt_auto_set(text, boolean) from public, anon;
grant execute on function public.ops_duty_reports(text) to authenticated;
grant execute on function public.ops_duty_report_send(jsonb) to authenticated;
grant execute on function public.ops_duty_report_decide(uuid, boolean, integer, text) to authenticated;
grant execute on function public.ops_duty_report_cancel(uuid) to authenticated;
grant execute on function public.ops_duty_setting_set(text, boolean, integer, integer) to authenticated;
grant execute on function public.ops_pt_auto_set(text, boolean) to authenticated;

-- 예약 — 출근 알림(5분) · PT 자동 기록(매시 50분, sync-pt-members 45분 뒤). 켠 지점이 없으면 아무것도 안 한다.
-- 끄기: select cron.unschedule('ops-duty-tick'); select cron.unschedule('ops-pt-auto-record');
select cron.schedule('ops-duty-tick', '*/5 * * * *', $cron$select public.ops_duty_tick()$cron$);
select cron.schedule('ops-pt-auto-record', '50 * * * *', $cron$select public._ops_pt_auto_record()$cron$);
