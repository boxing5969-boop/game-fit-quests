-- 153운영본부 · PT 기록 「오류 신고」 — 코치가 기록 · 차감에서 틀린 것을 보면 대표님 · 지점장에게 바로 알린다
--   (2026-11-12 대표님 「이윤희 어제 수업인데 오늘수업으로 되어있고 권시현 어제 수업을 했는데 기록에 없음 … 일단 점검 해주고
--    만약 pt 선생님이 볼때 오류가 있으면 오류신고 할수있도록 기능 만들어줘」)
--
--   흐름: 코치(또는 지점장)가 기록 · 차감 · 회원 하나를 골라 「무엇이 틀렸나요」(날짜 · 기록 없음 · 수업 안 함 · 횟수 · 회원 · 그 밖)
--         + 실제 수업 날짜 + 메모로 보낸다 → 대표님 · 지점장 알림(→ 그 코치의 근무자 카드 'PT' 탭)
--         → 관리자가 기록을 고치거나(기존 ops_pt_session_save · ops_pt_session_void 그대로) 그대로 두고 「처리」 → 보낸 분께 알림.
--   기록 · 차감 자체는 여기서 바꾸지 않는다 — 고치는 길은 기존 함수 하나(검사 · 늦은 기록 규칙이 한 곳에 있게).
--
--   새 표 1 · 새 함수 4개만. 기존 표 · 함수 · 트리거 · 예약은 그대로다. 표는 anon · authenticated 모두 막고 함수로만.
--   보이는 범위: 코치 = 본인이 보낸 것 + 본인 담당 신고 · 관리자(대표님 · 그 지점 ops_managers) = 지점 전체. 금액은 없다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_reports (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid references public.ops_staff(id) on delete set null,   -- 어느 코치의 PT 인가
  reporter_user_id uuid not null,
  session_id uuid references public.ops_pt_sessions(id) on delete set null, -- 신고한 수업 기록(있으면)
  event_id uuid references public.ops_pt_events(id) on delete set null,     -- 신고한 차감(있으면)
  member_user_id uuid,
  member_name text check (member_name is null or length(member_name) <= 40),
  about_date date,                                                          -- 화면에 보이던 날짜(기록 날짜 · 차감이 잡힌 날)
  -- wrong_date 날짜가 달라요 · missing 수업했는데 기록이 없어요 · not_held 수업 안 했는데 잡혔어요 ·
  -- wrong_count 횟수가 달라요 · wrong_member 회원이 달라요 · other 그 밖
  kind text not null check (kind in ('wrong_date', 'missing', 'not_held', 'wrong_count', 'wrong_member', 'other')),
  right_date date,                                                          -- 실제 수업 날짜(코치가 고른 날)
  note text check (note is null or length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'fixed', 'kept')), -- 확인 중 · 고쳤어요 · 그대로 둬요
  reply text check (reply is null or length(reply) <= 300),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ops_pt_reports_branch_idx on public.ops_pt_reports (branch_name, status, created_at desc);
create index if not exists ops_pt_reports_reporter_idx on public.ops_pt_reports (reporter_user_id, created_at desc);
alter table public.ops_pt_reports enable row level security;
revoke all on public.ops_pt_reports from anon, authenticated;

-- ───────────────────────── 안쪽 함수 ─────────────────────────
-- 알림 글에 쓰는 종류 이름 — 화면 src/lib/opsPtReport.ts PT_REPORT_KIND_LABEL 과 같은 말
create or replace function public._ops_pt_report_kind_label(_kind text)
returns text language sql immutable set search_path = public as $$
  select case _kind
    when 'wrong_date' then '날짜가 달라요'
    when 'missing' then '수업했는데 기록이 없어요'
    when 'not_held' then '수업 안 했는데 잡혔어요'
    when 'wrong_count' then '횟수가 달라요'
    when 'wrong_member' then '회원이 달라요'
    else '그 밖' end;
$$;

-- ───────────────────────── 읽기 ─────────────────────────
-- 관리자 = 지점 전체 · PT 위탁 코치 = 본인이 보낸 것 + 본인 담당. 열린 신고 전부 + 처리한 지 30일 안 것
create or replace function public.ops_pt_reports(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_manage boolean;
  v_mine uuid;
  v_set public.ops_pt_settings;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  v_manage := public._ops_can_manage(v_uid, p_branch);
  if not v_manage then
    v_mine := public._ops_pt_my_staff(v_uid, p_branch);
    if v_mine is null then raise exception 'PT 자료를 볼 수 없어요'; end if;
  end if;
  select * into v_set from public.ops_pt_settings where branch_name = p_branch;
  if v_set.branch_name is null or not v_set.record_on then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(x.j order by x.open_first desc, x.created_at desc)
      from (
        select (r.status = 'open') as open_first, r.created_at,
               jsonb_build_object(
                 'id', r.id,
                 'coach_staff_id', r.coach_staff_id,
                 'coach_name', (select c.name from public.ops_staff c where c.id = r.coach_staff_id),
                 'reporter_name', coalesce(
                    (select c.name from public.ops_staff c
                      where c.user_id = r.reporter_user_id and c.branch_name = r.branch_name order by c.created_at limit 1),
                    (select nullif(btrim(p.name), '') from public.profiles p where p.user_id = r.reporter_user_id),
                    '운영진'),
                 'mine', r.reporter_user_id = v_uid,
                 'session_id', r.session_id,
                 'event_id', r.event_id,
                 'member_user_id', r.member_user_id,
                 'member_name', coalesce(
                    (select l.label from public.ops_pt_member_labels l
                      where l.branch_name = r.branch_name and l.member_user_id = r.member_user_id),
                    r.member_name),
                 'about_date', r.about_date,
                 'kind', r.kind,
                 'right_date', r.right_date,
                 'note', r.note,
                 'status', r.status,
                 'reply', r.reply,
                 'handled_at', r.handled_at,
                 'created_at', r.created_at,
                 -- 신고한 기록 · 차감의 지금 모습(그사이 고쳐졌는지 화면이 본다)
                 'session', (select jsonb_build_object('session_date', s.session_date, 'kind', s.kind, 'status', s.status, 'uses', s.uses)
                               from public.ops_pt_sessions s where s.id = r.session_id),
                 'event', (select jsonb_build_object('work_date', e.work_date, 'used', e.used, 'before', e.before_remaining,
                                                     'after', e.after_remaining, 'status', e.status)
                             from public.ops_pt_events e where e.id = r.event_id)
               ) as j
          from public.ops_pt_reports r
         where r.branch_name = p_branch
           and (v_manage or r.reporter_user_id = v_uid or r.coach_staff_id = v_mine)
           and (r.status = 'open' or coalesce(r.handled_at, r.created_at) > now() - interval '30 days')
         order by (r.status = 'open') desc, r.created_at desc
         limit 100
      ) x), '[]'::jsonb);
end $$;

-- ───────────────────────── 보내기 ─────────────────────────
-- p: {branch, kind, session_id?, event_id?, member_user_id?, member_name?, about_date?, right_date?, note?, coach_staff_id?}
--   코치 = 본인 담당 기록 · 차감 · 지점 PT 회원만 · 관리자 = 지점 전체. 같은 것을 다시 보내면(열린 신고) 새로 만들지 않는다.
create or replace function public.ops_pt_report_send(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_kind text := p->>'kind';
  v_session uuid := nullif(p->>'session_id', '')::uuid;
  v_event uuid := nullif(p->>'event_id', '')::uuid;
  v_member uuid := nullif(p->>'member_user_id', '')::uuid;
  v_name text := nullif(btrim(coalesce(p->>'member_name', '')), '');
  v_about date := nullif(p->>'about_date', '')::date;
  v_right date := nullif(p->>'right_date', '')::date;
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_coach uuid := nullif(p->>'coach_staff_id', '')::uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_manage boolean;
  v_mine uuid;
  v_set public.ops_pt_settings;
  s public.ops_pt_sessions;
  e public.ops_pt_events;
  v_id uuid;
  v_label text;
  v_coach_name text;
  v_dates text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null then raise exception '지점을 알 수 없어요'; end if;
  v_manage := public._ops_can_manage(v_uid, v_branch);
  v_mine := public._ops_pt_my_staff(v_uid, v_branch);
  if not v_manage and v_mine is null then raise exception 'PT 기록 권한이 없어요'; end if;
  select * into v_set from public.ops_pt_settings where branch_name = v_branch;
  if v_set.branch_name is null or not v_set.record_on then raise exception '이 지점은 아직 PT 기록을 쓰지 않아요'; end if;

  if v_kind is null or v_kind not in ('wrong_date', 'missing', 'not_held', 'wrong_count', 'wrong_member', 'other') then
    raise exception '무엇이 틀렸는지 골라 주세요';
  end if;
  if v_note is not null and length(v_note) > 300 then raise exception '메모는 300자까지 적을 수 있어요'; end if;

  -- 신고하는 것 — 기록 · 차감이면 회원 · 날짜 · 코치는 그것에서 가져온다
  if v_session is not null then
    select * into s from public.ops_pt_sessions where id = v_session;
    if s.id is null or s.branch_name <> v_branch then raise exception '기록을 찾을 수 없어요'; end if;
    if not v_manage and s.coach_staff_id is distinct from v_mine then raise exception '내 기록만 신고할 수 있어요'; end if;
    v_member := s.member_user_id;
    v_name := s.member_name;
    v_about := s.session_date;
    v_coach := s.coach_staff_id;
  end if;
  if v_event is not null then
    select * into e from public.ops_pt_events where id = v_event;
    if e.id is null or e.branch_name <> v_branch then raise exception '차감 기록을 찾을 수 없어요'; end if;
    if not v_manage and e.coach_staff_id is distinct from v_mine then raise exception '내 담당 차감만 신고할 수 있어요'; end if;
    if v_session is null then
      v_member := e.member_user_id;
      v_name := e.member_name;
      v_about := e.work_date;
      v_coach := e.coach_staff_id;
    end if;
  end if;
  if v_session is null and v_event is null and v_member is not null then
    if not exists (select 1 from public.profiles p2 where p2.user_id = v_member and p2.branch_name = v_branch) then
      raise exception '이 지점 회원이 아니에요';
    end if;
    v_name := coalesce((select nullif(btrim(p2.name), '') from public.profiles p2 where p2.user_id = v_member), v_name);
  end if;
  if v_member is null and v_name is null and v_kind <> 'other' then raise exception '회원을 골라 주세요'; end if;
  v_name := left(v_name, 40);

  if v_about is not null and (v_about < v_today - 150 or v_about > v_today + 62) then raise exception '날짜가 너무 멀어요'; end if;
  if v_kind in ('wrong_date', 'missing') and v_right is null then raise exception '실제 수업 날짜를 골라 주세요'; end if;
  if v_right is not null and v_right > v_today then raise exception '아직 오지 않은 날은 고를 수 없어요'; end if;
  if v_right is not null and v_right < v_today - 120 then raise exception '날짜가 너무 멀어요'; end if;
  if v_kind = 'wrong_date' and v_right = v_about then raise exception '지금 날짜와 같아요 — 실제 수업 날짜를 골라 주세요'; end if;
  if v_kind = 'other' and (v_note is null or length(v_note) < 2) then raise exception '무엇이 틀렸는지 적어 주세요'; end if;

  -- 어느 코치의 PT 인가: 코치는 늘 본인 · 관리자는 기록 · 차감의 코치 → 고른 코치 → 지점 PT 코치가 한 명이면 그 코치
  if not v_manage then
    v_coach := v_mine;
  else
    if v_coach is null and (select count(*) from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active) = 1 then
      select c.id into v_coach from public.ops_staff c where c.branch_name = v_branch and c.pt_freelancer and c.active;
    end if;
    if v_coach is not null and not exists (select 1 from public.ops_staff c where c.id = v_coach and c.branch_name = v_branch) then
      raise exception '같은 지점 코치만 고를 수 있어요';
    end if;
  end if;

  -- 같은 것을 다시 보냄(두 번 누름 — 같은 기록 · 차감 · 회원 · 종류 · 메모의 열린 신고, 7일 안) — 새로 만들지 않고 알림도 다시 보내지 않는다.
  --   메모가 다르면 다른 말이라 새 신고로 받는다(앞 메모를 덮지 않게). 대상 없는 「그 밖」은 늘 새 신고.
  if v_session is not null or v_event is not null or v_member is not null then
    select r.id into v_id from public.ops_pt_reports r
     where r.reporter_user_id = v_uid and r.branch_name = v_branch and r.status = 'open' and r.kind = v_kind
       and r.created_at > now() - interval '7 days'
       and r.session_id is not distinct from v_session and r.event_id is not distinct from v_event
       and r.member_user_id is not distinct from v_member and r.about_date is not distinct from v_about
       and (v_note is null or r.note is not distinct from v_note)
     order by r.created_at desc limit 1;
    if v_id is not null then
      update public.ops_pt_reports set right_date = coalesce(v_right, right_date) where id = v_id;
      return jsonb_build_object('id', v_id, 'dup', true);
    end if;
  end if;
  if (select count(*) from public.ops_pt_reports r where r.reporter_user_id = v_uid and r.created_at > now() - interval '1 day') >= 30 then
    raise exception '오늘은 신고를 많이 보냈어요 — 내일 다시 보내 주세요';
  end if;

  insert into public.ops_pt_reports (branch_name, coach_staff_id, reporter_user_id, session_id, event_id, member_user_id, member_name,
                                     about_date, kind, right_date, note)
  values (v_branch, v_coach, v_uid, v_session, v_event, v_member, v_name, v_about, v_kind, v_right, v_note)
  returning id into v_id;

  -- 대표님(전체관리자 · 관리자) · 그 지점 관리자에게 — 보낸 분은 빼고. 누르면 그 코치의 근무자 카드 'PT' 탭
  v_label := coalesce(
    (select l.label from public.ops_pt_member_labels l where l.branch_name = v_branch and l.member_user_id = v_member),
    v_name, '회원');
  v_coach_name := (select c.name from public.ops_staff c where c.id = v_coach);
  v_dates := case
    when v_about is not null and v_right is not null then to_char(v_about, 'FMMM/FMDD') || ' → ' || to_char(v_right, 'FMMM/FMDD')
    when v_right is not null then to_char(v_right, 'FMMM/FMDD')
    when v_about is not null then to_char(v_about, 'FMMM/FMDD') end;
  insert into public.notifications (user_id, title, body, link)
  select u.user_id,
         'PT 기록 오류 신고' || coalesce(' · ' || v_coach_name, ''),
         concat_ws(' · ', v_label, public._ops_pt_report_kind_label(v_kind), v_dates, left(v_note, 60)),
         '/office?tab=work' || coalesce('&ptcoach=' || v_coach::text, '')
    from (
      select r.user_id from public.user_roles r where r.role::text in ('super_admin', 'admin')
      union
      select m.user_id from public.ops_managers m where m.branch_name is null or m.branch_name = v_branch
    ) u
   where u.user_id is not null and u.user_id <> v_uid;

  return jsonb_build_object('id', v_id, 'dup', false);
end $$;

-- ───────────────────────── 처리 ─────────────────────────
-- 대표님 · 지점장 — fixed 고쳤어요 · kept 그대로 둬요 + 한마디. 보낸 분께 알림(상태나 한마디가 바뀔 때만)
create or replace function public.ops_pt_report_resolve(p_id uuid, p_status text, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
  r public.ops_pt_reports;
  v_label text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into r from public.ops_pt_reports where id = p_id for update;
  if r.id is null then raise exception '신고를 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, r.branch_name) then raise exception '관리 권한이 없어요'; end if;
  if p_status is null or p_status not in ('fixed', 'kept') then raise exception '처리 결과를 골라 주세요'; end if;
  if v_reply is not null and length(v_reply) > 300 then raise exception '답은 300자까지 적을 수 있어요'; end if;
  if r.status = p_status and r.reply is not distinct from v_reply then return; end if;

  update public.ops_pt_reports
     set status = p_status, reply = v_reply, handled_by = v_uid, handled_at = now()
   where id = p_id;

  if r.reporter_user_id <> v_uid then
    v_label := coalesce(
      (select l.label from public.ops_pt_member_labels l where l.branch_name = r.branch_name and l.member_user_id = r.member_user_id),
      r.member_name, '회원');
    insert into public.notifications (user_id, title, body, link)
    values (r.reporter_user_id,
            case when p_status = 'fixed' then 'PT 오류 신고 · 고쳤어요' else 'PT 오류 신고 · 확인했어요' end,
            concat_ws(' — ', v_label || ' · ' || public._ops_pt_report_kind_label(r.kind),
                      coalesce(v_reply, case when p_status = 'fixed' then '말씀하신 대로 고쳤어요' else '지금 기록 그대로 둘게요' end)),
            '/office?tab=work&pt=today');
  end if;
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public._ops_pt_report_kind_label(text) from public, anon, authenticated;
revoke all on function public.ops_pt_reports(text) from public, anon;
revoke all on function public.ops_pt_report_send(jsonb) from public, anon;
revoke all on function public.ops_pt_report_resolve(uuid, text, text) from public, anon;
grant execute on function public.ops_pt_reports(text) to authenticated;
grant execute on function public.ops_pt_report_send(jsonb) to authenticated;
grant execute on function public.ops_pt_report_resolve(uuid, text, text) to authenticated;
