-- 153운영본부 · PT 관리 1단계 (2026-10-29 대표님 "PT도 관리하자 브로제이랑 연동해서 … 재우가 와서 PT를 소진하면
--   어떤 사람 PT를 했고 PT 횟수 얼마나 남았는지 볼 수 있도록 월급 정산할 때 같이")
--
--   PT 횟수의 원본은 브로제이 PT 수업권이다. 153OS 워커가 회원마다 하루~이틀에 한 번 남은 횟수를 읽고,
--   sync-pt-members(매시 40분)가 앱 profiles.pt_ticket · pt_remaining 으로 옮긴다.
--   여기서는 그 값이 줄어드는 순간을 잡아 ops_pt_events 에 '차감 기록'으로 남긴다(같은 수업권에서 n회 줄면 n회 수업).
--   · 수업권이 사라졌는데(끝남) 남은 횟수가 있었으면 'ended' 로 남기고 지점장 · 대표님 확인(status check)을 받는다 — 마지막 수업일 수도, 기한 만료 · 환불일 수도 있다.
--   · 차감 날짜 = 앱이 알아챈 날(KST). 브로제이 확인이 하루~이틀 늦을 수 있어 관리자가 날짜를 고칠 수 있다.
--   · 담당 코치 = 그 지점의 PT 위탁 코치(ops_staff.pt_freelancer)가 한 명이면 그 코치, 아니면 비워 두고 관리자가 정한다.
--   수당 계산(1:1 · 팀 수업권별 1회 수당, 팀은 차감된 팀원 1명당 = 1회 수당 ÷ 정원)은 화면 src/lib/opsPt.ts 한 곳.
--   수당 금액(ops_pt_rates)은 저장소에 넣지 않는다(공개 저장소) — SQL 편집기 · 앱에서 넣는다.
--
--   새 표 · 새 함수 · 새 트리거만. profiles 트리거는 실패해도 회원 정보 저장을 막지 않는다(경고만).

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_rates (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  team_size smallint not null default 1 check (team_size between 1 and 10),   -- 1 = 1:1, 4 = 4인 팀 …
  sessions smallint not null check (sessions between 1 and 200),             -- 수업권 횟수(10회 · 20회)
  session_rate integer not null check (session_rate between 0 and 1000000), -- 수업 1회 코치 수당(팀은 팀 1회)
  valid_from date not null default '2026-01-01',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (branch_name, team_size, sessions, valid_from)
);
alter table public.ops_pt_rates enable row level security;

create table if not exists public.ops_pt_events (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  member_user_id uuid,
  member_name text not null check (length(btrim(member_name)) between 1 and 40),
  ticket_name text,
  before_remaining integer,
  after_remaining integer,
  used integer not null check (used between 0 and 200),
  kind text not null check (kind in ('used', 'ended', 'manual')),
  status text not null default 'auto' check (status in ('auto', 'check', 'confirmed', 'excluded')),
  coach_staff_id uuid references public.ops_staff(id) on delete set null,
  work_date date not null,
  detected_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 300),
  created_by uuid,
  updated_by uuid,
  updated_at timestamptz
);
create index if not exists ops_pt_events_branch_idx on public.ops_pt_events (branch_name, work_date);
create index if not exists ops_pt_events_member_idx on public.ops_pt_events (member_user_id);
alter table public.ops_pt_events enable row level security;

revoke all on public.ops_pt_rates, public.ops_pt_events from anon, authenticated;

-- ───────────────────────── 차감 잡기 (profiles 트리거) ─────────────────────────
create or replace function public._ops_pt_capture()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_branch text := coalesce(new.branch_name, old.branch_name);
  v_used integer;
  v_kind text;
  v_status text := 'auto';
  v_note text;
  v_coach uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  begin
    if v_branch is null or not exists (select 1 from public.ops_branches b where b.branch_name = v_branch and b.enabled) then
      return new;
    end if;
    if old.pt_ticket is not null and new.pt_ticket is not distinct from old.pt_ticket
       and old.pt_remaining is not null and new.pt_remaining is not null and new.pt_remaining < old.pt_remaining then
      v_used := old.pt_remaining - new.pt_remaining;
      v_kind := 'used';
    elsif old.pt_ticket is not null and new.pt_ticket is null and coalesce(old.pt_remaining, 0) > 0 then
      v_used := old.pt_remaining;
      v_kind := 'ended';
      v_status := 'check';
      v_note := case when old.pt_end_date is not null and old.pt_end_date < v_today
                     then '수업권 기한이 지나 끝났을 수 있어요' else '마지막 수업인지 확인해 주세요' end;
    else
      return new;
    end if;
    if v_used <= 0 or v_used > 50 then return new; end if;

    if (select count(*) from public.ops_staff s where s.branch_name = v_branch and s.active and s.pt_freelancer) = 1 then
      select s.id into v_coach from public.ops_staff s where s.branch_name = v_branch and s.active and s.pt_freelancer;
    end if;

    insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, before_remaining, after_remaining,
                                      used, kind, status, coach_staff_id, work_date, note)
    values (v_branch, new.user_id, coalesce(nullif(btrim(new.name), ''), '회원'), old.pt_ticket, old.pt_remaining, new.pt_remaining,
            v_used, v_kind, v_status, v_coach, v_today, v_note);
  exception when others then
    raise warning 'ops_pt_capture: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public._ops_pt_capture() from public, anon, authenticated;

drop trigger if exists ops_pt_capture on public.profiles;
create trigger ops_pt_capture
  after update of pt_remaining, pt_ticket on public.profiles
  for each row
  when (old.pt_remaining is distinct from new.pt_remaining or old.pt_ticket is distinct from new.pt_ticket)
  execute function public._ops_pt_capture();

-- ───────────────────────── 읽기 ─────────────────────────
-- 한 달 PT — 관리자(대표님 · 지정 지점장 · 회계매니저): 지점 전체 + 수당표 / PT 위탁 코치: 지점 PT 회원 · 내 차감 기록(수당표 없음)
create or replace function public.ops_pt_month(p_branch text, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_manage boolean := public._ops_can_manage(v_uid, p_branch);
  v_mine uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not v_manage then
    select s.id into v_mine from public.ops_staff s
     where s.branch_name = p_branch and s.user_id = v_uid and s.pt_freelancer and s.active limit 1;
    if v_mine is null then raise exception 'PT 자료를 볼 수 없어요'; end if;
  end if;

  return jsonb_build_object(
    'branch', p_branch,
    'month', to_char(v_from, 'YYYY-MM-DD'),
    'manage', v_manage,
    'me_staff', v_mine,
    -- 지금 PT 수업권이 있는 회원 (브로제이 → 153OS → 앱)
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(nullif(btrim(p.name), ''), '회원'),
                                          'ticket', p.pt_ticket, 'remaining', p.pt_remaining,
                                          'end_date', p.pt_end_date, 'checked_at', p.pt_checked_at)
             order by p.pt_remaining nulls last, p.name)
        from public.profiles p
       where p.branch_name = p_branch and p.pt_ticket is not null and coalesce(p.is_test_account, false) = false), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'member_user_id', e.member_user_id, 'member_name', e.member_name,
                                          'ticket_name', e.ticket_name, 'before', e.before_remaining, 'after', e.after_remaining,
                                          'used', e.used, 'kind', e.kind, 'status', e.status, 'coach_staff_id', e.coach_staff_id,
                                          'work_date', e.work_date, 'detected_at', e.detected_at, 'note', e.note)
             order by e.work_date desc, e.detected_at desc)
        from public.ops_pt_events e
       where e.branch_name = p_branch and e.work_date between v_from and v_to
         and (v_manage or e.coach_staff_id = v_mine)), '[]'::jsonb),
    'rates', case when v_manage then coalesce((
      select jsonb_agg(jsonb_build_object('team_size', r.team_size, 'sessions', r.sessions, 'session_rate', r.session_rate,
                                          'valid_from', r.valid_from) order by r.team_size, r.sessions, r.valid_from)
        from public.ops_pt_rates r where r.branch_name = p_branch), '[]'::jsonb) else '[]'::jsonb end);
end $$;

-- ───────────────────────── 쓰기 (관리자) ─────────────────────────
-- 차감 기록 고치기 — 상태(수업으로 인정 confirmed · 빼기 excluded · 되돌리기 auto) · 담당 코치 · 횟수 · 날짜 · 메모
create or replace function public.ops_pt_event_set(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); e public.ops_pt_events; v_coach uuid;
begin
  select * into e from public.ops_pt_events where id = p_id for update;
  if e.id is null then raise exception '기록을 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, e.branch_name) then raise exception '관리 권한이 없어요'; end if;
  if p ? 'coach_staff_id' then
    v_coach := nullif(p->>'coach_staff_id', '')::uuid;
    if v_coach is not null and public._ops_branch_of(v_coach) is distinct from e.branch_name then
      raise exception '같은 지점 코치만 고를 수 있어요';
    end if;
  end if;
  update public.ops_pt_events set
    status = case when p ? 'status' then
               case when p->>'status' in ('auto', 'check', 'confirmed', 'excluded') then p->>'status' else status end
             else status end,
    coach_staff_id = case when p ? 'coach_staff_id' then v_coach else coach_staff_id end,
    used = case when p ? 'used' then greatest(0, least(200, (p->>'used')::integer)) else used end,
    work_date = case when p ? 'work_date' then (p->>'work_date')::date else work_date end,
    note = case when p ? 'note' then nullif(btrim(coalesce(p->>'note', '')), '') else note end,
    updated_by = v_uid, updated_at = now()
  where id = p_id;
end $$;

-- 직접 넣기 — 앱이 놓친 차감(수업권이 바뀐 날 등)을 관리자가 더한다
create or replace function public.ops_pt_event_add(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text := p->>'branch'; v_id uuid; v_coach uuid := nullif(p->>'coach_staff_id', '')::uuid;
begin
  if not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  if length(btrim(coalesce(p->>'member_name', ''))) = 0 then raise exception '회원 이름을 넣어 주세요'; end if;
  if coalesce((p->>'used')::integer, 0) <= 0 then raise exception '횟수를 넣어 주세요'; end if;
  if v_coach is not null and public._ops_branch_of(v_coach) is distinct from v_branch then
    raise exception '같은 지점 코치만 고를 수 있어요';
  end if;
  insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, used, kind, status, coach_staff_id,
                                    work_date, note, created_by)
  values (v_branch, nullif(p->>'member_user_id', '')::uuid, btrim(p->>'member_name'), nullif(p->>'ticket_name', ''),
          (p->>'used')::integer, 'manual', 'confirmed', v_coach,
          coalesce(nullif(p->>'work_date', '')::date, (now() at time zone 'Asia/Seoul')::date),
          nullif(btrim(coalesce(p->>'note', '')), ''), v_uid)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ops_pt_month(text, date) from public, anon;
revoke all on function public.ops_pt_event_set(uuid, jsonb) from public, anon;
revoke all on function public.ops_pt_event_add(jsonb) from public, anon;
grant execute on function public.ops_pt_month(text, date) to authenticated;
grant execute on function public.ops_pt_event_set(uuid, jsonb) to authenticated;
grant execute on function public.ops_pt_event_add(jsonb) to authenticated;
