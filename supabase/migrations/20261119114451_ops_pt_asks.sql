-- 153운영본부 · PT 기록 「코치에게 물어보기」 — 대표님 · 지점장이 확인 필요 카드에서 그 건만 골라 담당 코치에게 묻고, 답이 그 카드에 달린다
--   (2026-11-19 대표님 「내가 그때 그때 마다 코치님한테 물어보지 않게 앱안에서 재우코치님에게 바로 이야기하는 기능」 → 「그래」)
--
--   흐름: 관리자(대표님 · 그 지점 ops_managers)가 기록 없는 입장 · 사유 없는 차감 · 차감 대기 카드에서 [코치에게 물어보기]
--         (+ 한마디) → 그 코치 알림(→ 「오늘 PT」) → 코치가 답(수업이었어요 · 개인 운동이었어요 … 한 줄) → 물은 분 알림 · 카드에 답.
--   오류 신고(ops_pt_reports — 코치 → 관리자)의 반대 방향이다. 기록 · 차감 자체는 여기서 바꾸지 않는다(고치는 길은 기존 함수 하나).
--
--   새 표 1 · 새 함수 3개만. 기존 표 · 함수 · 트리거 · 예약은 그대로다. 줄을 지우는 문장이 없다. 표는 anon · authenticated 모두 막고 함수로만.
--   보이는 범위: 관리자 = 지점 전체 · PT 위탁 코치 = 본인에게 온 것만. 금액은 없다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_pt_asks (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.ops_branches(branch_name),
  coach_staff_id uuid not null references public.ops_staff(id) on delete cascade,  -- 누구에게 묻나
  asker_user_id uuid not null,
  -- entry 기록 없는 입장 · deduct 사유 없는 차감 · wait 차감 대기 · other 그 밖
  item text not null check (item in ('entry', 'deduct', 'wait', 'other')),
  event_id uuid references public.ops_pt_events(id) on delete set null,
  session_id uuid references public.ops_pt_sessions(id) on delete set null,
  member_user_id uuid,
  member_name text check (member_name is null or length(member_name) <= 40),
  about_date date,                                                                 -- 입장한 날 · 차감이 잡힌 날 · 수업 날
  note text check (note is null or length(note) <= 200),                           -- 물은 분 한마디
  status text not null default 'open' check (status in ('open', 'answered')),
  answer text check (answer is null or length(answer) <= 300),
  answered_by uuid,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ops_pt_asks_branch_idx on public.ops_pt_asks (branch_name, status, created_at desc);
create index if not exists ops_pt_asks_coach_idx on public.ops_pt_asks (coach_staff_id, status, created_at desc);
alter table public.ops_pt_asks enable row level security;
revoke all on public.ops_pt_asks from anon, authenticated;

-- ───────────────────────── 읽기 ─────────────────────────
-- 관리자 = 지점 전체 · PT 위탁 코치 = 본인에게 온 것. 열린 것 전부 + 답한 지 30일 안 것
create or replace function public.ops_pt_asks(p_branch text)
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
        select (a.status = 'open') as open_first, a.created_at,
               jsonb_build_object(
                 'id', a.id,
                 'coach_staff_id', a.coach_staff_id,
                 'coach_name', (select c.name from public.ops_staff c where c.id = a.coach_staff_id),
                 'asker_name', coalesce(
                    (select c.name from public.ops_staff c
                      where c.user_id = a.asker_user_id and c.branch_name = a.branch_name order by c.created_at limit 1),
                    (select nullif(btrim(p.name), '') from public.profiles p where p.user_id = a.asker_user_id),
                    '운영진'),
                 'mine', a.asker_user_id = v_uid,
                 'item', a.item,
                 'event_id', a.event_id,
                 'session_id', a.session_id,
                 'member_user_id', a.member_user_id,
                 'member_name', coalesce(
                    (select l.label from public.ops_pt_member_labels l
                      where l.branch_name = a.branch_name and l.member_user_id = a.member_user_id),
                    a.member_name),
                 'about_date', a.about_date,
                 'note', a.note,
                 'status', a.status,
                 'answer', a.answer,
                 'answered_at', a.answered_at,
                 'created_at', a.created_at
               ) as j
          from public.ops_pt_asks a
         where a.branch_name = p_branch
           and (v_manage or a.coach_staff_id = v_mine)
           and (a.status = 'open' or coalesce(a.answered_at, a.created_at) > now() - interval '30 days')
         order by (a.status = 'open') desc, a.created_at desc
         limit 100
      ) x), '[]'::jsonb);
end $$;

-- ───────────────────────── 물어보기 ─────────────────────────
-- p: {branch, coach_staff_id, item, event_id?, session_id?, member_user_id?, member_name?, about_date?, note?}
--   관리자만. 같은 건의 열린 질문이 있으면 새로 만들지 않고(한마디만 바꿈) 알림도 다시 보내지 않는다.
create or replace function public.ops_pt_ask_send(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_coach uuid := nullif(p->>'coach_staff_id', '')::uuid;
  v_item text := p->>'item';
  v_event uuid := nullif(p->>'event_id', '')::uuid;
  v_session uuid := nullif(p->>'session_id', '')::uuid;
  v_member uuid := nullif(p->>'member_user_id', '')::uuid;
  v_name text := nullif(btrim(coalesce(p->>'member_name', '')), '');
  v_about date := nullif(p->>'about_date', '')::date;
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_set public.ops_pt_settings;
  c public.ops_staff;
  v_id uuid;
  v_label text;
  v_asker text;
  v_what text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null then raise exception '지점을 알 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, v_branch) then raise exception '관리 권한이 없어요'; end if;
  select * into v_set from public.ops_pt_settings where branch_name = v_branch;
  if v_set.branch_name is null or not v_set.record_on then raise exception '이 지점은 아직 PT 기록을 쓰지 않아요'; end if;

  if v_item is null or v_item not in ('entry', 'deduct', 'wait', 'other') then raise exception '무엇을 물을지 알 수 없어요'; end if;
  if v_note is not null and length(v_note) > 200 then raise exception '한마디는 200자까지 적을 수 있어요'; end if;
  if v_item = 'other' and (v_note is null or length(v_note) < 2) then raise exception '물어볼 말을 적어 주세요'; end if;

  select * into c from public.ops_staff where id = v_coach;
  if c.id is null or c.branch_name <> v_branch or not c.pt_freelancer or not c.active then raise exception '이 지점 PT 코치를 골라 주세요'; end if;
  if c.user_id is null then raise exception '이 코치님은 앱 계정이 없어 물어볼 수 없어요'; end if;
  if c.user_id = v_uid then raise exception '내게는 물어볼 수 없어요'; end if;

  if v_event is not null and not exists (select 1 from public.ops_pt_events e where e.id = v_event and e.branch_name = v_branch) then
    raise exception '차감 기록을 찾을 수 없어요';
  end if;
  if v_session is not null and not exists (select 1 from public.ops_pt_sessions s where s.id = v_session and s.branch_name = v_branch) then
    raise exception '기록을 찾을 수 없어요';
  end if;
  if v_member is not null then
    if not exists (select 1 from public.profiles p2 where p2.user_id = v_member and p2.branch_name = v_branch) then
      raise exception '이 지점 회원이 아니에요';
    end if;
    v_name := coalesce((select nullif(btrim(p2.name), '') from public.profiles p2 where p2.user_id = v_member), v_name);
  end if;
  if v_item <> 'other' and v_member is null and v_name is null then raise exception '회원을 알 수 없어요'; end if;
  v_name := left(v_name, 40);
  if v_about is not null and (v_about < v_today - 150 or v_about > v_today + 1) then raise exception '날짜가 너무 멀어요'; end if;

  -- 같은 건의 열린 질문(같은 코치 · 종류 · 차감 · 기록 · 회원 · 날짜) — 새로 만들지 않는다
  if v_item <> 'other' then
    select a.id into v_id from public.ops_pt_asks a
     where a.branch_name = v_branch and a.coach_staff_id = v_coach and a.status = 'open' and a.item = v_item
       and a.event_id is not distinct from v_event and a.session_id is not distinct from v_session
       and a.member_user_id is not distinct from v_member and a.about_date is not distinct from v_about
     order by a.created_at desc limit 1;
    if v_id is not null then
      if v_note is not null then update public.ops_pt_asks set note = v_note where id = v_id; end if;
      return jsonb_build_object('id', v_id, 'dup', true);
    end if;
  end if;
  if (select count(*) from public.ops_pt_asks a where a.asker_user_id = v_uid and a.created_at > now() - interval '1 day') >= 50 then
    raise exception '오늘은 많이 물어봤어요 — 내일 다시 보내 주세요';
  end if;

  insert into public.ops_pt_asks (branch_name, coach_staff_id, asker_user_id, item, event_id, session_id, member_user_id, member_name, about_date, note)
  values (v_branch, v_coach, v_uid, v_item, v_event, v_session, v_member, v_name, v_about, v_note)
  returning id into v_id;

  -- 코치 알림 → 「오늘 PT」(그 질문 카드가 맨 위)
  v_label := coalesce(
    (select l.label from public.ops_pt_member_labels l where l.branch_name = v_branch and l.member_user_id = v_member),
    v_name);
  v_asker := coalesce(
    (select s.name from public.ops_staff s where s.user_id = v_uid and s.branch_name = v_branch order by s.created_at limit 1),
    (select nullif(btrim(p3.name), '') from public.profiles p3 where p3.user_id = v_uid),
    '운영진');
  v_what := case v_item
    when 'entry' then concat_ws(' ', v_label, to_char(v_about, 'FMMM/FMDD'), '입장 — PT 수업이었나요?')
    when 'deduct' then concat_ws(' ', v_label, to_char(v_about, 'FMMM/FMDD'), '차감 — 어떤 수업이었나요?')
    when 'wait' then concat_ws(' ', v_label, to_char(v_about, 'FMMM/FMDD'), '수업 — 브로제이 차감이 안 보여요')
    else null end;
  insert into public.notifications (user_id, title, body, link)
  values (c.user_id,
          left('PT 확인 부탁 · ' || v_asker, 120),
          left(concat_ws(' · ', v_what, v_note), 300),
          '/office?tab=work&pt=today&ask=' || v_id::text);

  return jsonb_build_object('id', v_id, 'dup', false);
end $$;

-- ───────────────────────── 답하기 ─────────────────────────
-- 질문을 받은 코치 본인(또는 그 지점 관리자 — 말로 들은 답을 대신 적을 때). 물은 분께 알림(답한 사람이 본인이 아니면)
create or replace function public.ops_pt_ask_answer(p_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_answer text := nullif(btrim(coalesce(p_answer, '')), '');
  a public.ops_pt_asks;
  v_label text;
  v_who text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into a from public.ops_pt_asks where id = p_id for update;
  if a.id is null then raise exception '질문을 찾을 수 없어요'; end if;
  if not public._ops_can_manage(v_uid, a.branch_name)
     and not exists (select 1 from public.ops_staff s where s.id = a.coach_staff_id and s.user_id = v_uid) then
    raise exception '내게 온 질문만 답할 수 있어요';
  end if;
  if v_answer is null or length(v_answer) < 2 then raise exception '답을 적어 주세요'; end if;
  if length(v_answer) > 300 then raise exception '답은 300자까지 적을 수 있어요'; end if;
  if a.status = 'answered' and a.answer is not distinct from v_answer then return; end if;

  update public.ops_pt_asks
     set status = 'answered', answer = v_answer, answered_by = v_uid, answered_at = now()
   where id = p_id;

  if a.asker_user_id <> v_uid then
    v_label := coalesce(
      (select l.label from public.ops_pt_member_labels l where l.branch_name = a.branch_name and l.member_user_id = a.member_user_id),
      a.member_name);
    v_who := coalesce((select s.name from public.ops_staff s where s.id = a.coach_staff_id), '코치');
    insert into public.notifications (user_id, title, body, link)
    values (a.asker_user_id,
            left('PT 확인 답 · ' || v_who, 120),
            left(concat_ws(' — ', concat_ws(' ', v_label, to_char(a.about_date, 'FMMM/FMDD')), v_answer), 300),
            '/office?tab=work&ptcoach=' || a.coach_staff_id::text);
  end if;
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public.ops_pt_asks(text) from public, anon;
revoke all on function public.ops_pt_ask_send(jsonb) from public, anon;
revoke all on function public.ops_pt_ask_answer(uuid, text) from public, anon;
grant execute on function public.ops_pt_asks(text) to authenticated;
grant execute on function public.ops_pt_ask_send(jsonb) to authenticated;
grant execute on function public.ops_pt_ask_answer(uuid, text) to authenticated;
