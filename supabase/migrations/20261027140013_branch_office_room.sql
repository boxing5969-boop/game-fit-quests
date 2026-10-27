-- 지점 회의실 1단계 (2026-10-27 대표님 「마이복서153 지점 회의실 상세 보고서」(10/22) — 추천안대로)
--   선릉역점 지도진이 앱 안 가상 사무실에 캐릭터로 앉아 있고(앱을 열면 앉고, 닫으면 30초 뒤 나감),
--   대표님 · 지점장이 회의를 열면 지도진에게 알림 → 채팅으로 회의 → 끝내면 채팅 · 정한 것 · 참석이 회의록으로 남는다.
--   2단계(음성 · 카메라, Cloudflare RealtimeKit) · 3단계(회의록 → 전략 회의실 지시 · 불참자 요약)는 따로.
--
--   · 누가: 사무실 보기 · 회의 들어가기 = 그 지점 지도진(코치 · 지점장, 앱에서 '지도진'으로 표시된 분 포함) + 대표님(본사)
--           회의 열기 · 끝내기 = 대표님 · 그 지점 지점장(_strategy_can_direct — 전략 회의실 지시 권한과 같음)
--           다른 지점 지도진 · 회원 · 체험용 계정은 서버가 막는다.
--   · 표는 RLS 만 켜고 정책 없음 — 읽기 · 쓰기는 아래 SECURITY DEFINER 함수로만 (전략 회의실 · DM 과 같은 방식)
--   · 실시간: 접속 표시(앉기 · 나가기)는 Supabase Realtime Presence, 바뀜 신호는 realtime.send — 둘 다 비공개 채널
--     'office:<지점 코드>' 이고, realtime.messages 정책이 그 지점 사람만 들어오게 한다. 신호에는 내용 없이 무엇이 바뀌었는지만.
--   · 새 표 · 새 함수만 더한다 (기존 함수 · 표는 건드리지 않음).

-- ───────────────────────── 표 ─────────────────────────

/** 회의실을 켠 지점 — 지금은 선릉역점만 (보고서: 선릉역점 한 채) */
create table if not exists public.office_branches (
  branch_name text primary key,
  topic text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.office_branches enable row level security;

insert into public.office_branches (branch_name, topic)
select b.name, 'office:' || coalesce(nullif(btrim(b.code), ''), substr(md5(b.name), 1, 12))
  from public.branches b
 where b.name = '153복싱짐 선릉역점'
on conflict (branch_name) do nothing;

/** 자리 — 사람마다 정해진 책상 (이름표). mgr 지점장 책상 · c1~c8 코치 책상 · x1~x4 자리가 모자랄 때(문 옆).
 *  처음 사무실을 그릴 때 자동으로 정하고, 지도진이 아니게 되면 자리를 비운다. 대표님은 늘 대표 책상(저장 안 함). */
create table if not exists public.office_seats (
  branch_name text not null references public.office_branches(branch_name) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat text not null check (seat ~ '^(mgr|c[1-8]|x[1-4])$'),
  assigned_at timestamptz not null default now(),
  primary key (branch_name, user_id),
  unique (branch_name, seat)
);
alter table public.office_seats enable row level security;

/** 자리 위 상태 말풍선 — 본인이 누른다 (보고서 결정: '수업 중'은 본인이 누르기). 3시간 지나면 '자리에 있음'으로 본다. */
create table if not exists public.office_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'on' check (status in ('on', 'class', 'away')),
  updated_at timestamptz not null default now()
);
alter table public.office_status enable row level security;

/** 회의 — 한 지점에 열린 회의는 하나 */
create table if not exists public.office_meetings (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null references public.office_branches(branch_name) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  agenda text[] not null default '{}' check (coalesce(array_length(agenda, 1), 0) <= 5),
  opened_by uuid not null references auth.users(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz
);
create unique index if not exists office_meetings_one_open on public.office_meetings (branch_name) where closed_at is null;
create index if not exists office_meetings_branch_idx on public.office_meetings (branch_name, opened_at desc);
alter table public.office_meetings enable row level security;

/** 참석 체크 — 들어온 사람 자동 기록 (나갔다 다시 들어오면 last_joined_at) */
create table if not exists public.office_meeting_attendees (
  meeting_id uuid not null references public.office_meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  last_joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (meeting_id, user_id)
);
alter table public.office_meeting_attendees enable row level security;

/** 회의 채팅 — kind: chat 보통 말 · decision 정한 것(회의를 연 쪽만) · system 열림/끝남 */
create table if not exists public.office_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.office_meetings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'chat' check (kind in ('chat', 'decision', 'system')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists office_messages_meeting_idx on public.office_messages (meeting_id, created_at);
alter table public.office_messages enable row level security;

-- ───────────────────────── 누가 들어오나 ─────────────────────────

/** 'host'(회의 열기 · 끝내기) · 'member'(보기 · 들어가기) · null(못 들어옴) */
create or replace function public._office_role(_uid uuid, _branch text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when _uid is null or _branch is null then null
    when not exists (select 1 from public.office_branches b where b.branch_name = _branch and b.enabled) then null
    when public._strategy_hq(_uid) then 'host'
    when exists (select 1 from public._strategy_branch_staff(_branch) s where s.user_id = _uid)
      then case when public._strategy_can_direct(_uid) then 'host' else 'member' end
    else null
  end;
$$;

/** 실시간 채널 정책에서 쓴다 — 지금 로그인한 사람이 이 채널(office:<지점 코드>)에 들어올 수 있나 */
create or replace function public._office_can_topic(p_topic text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_topic, '') like 'office:%'
     and exists (select 1 from public.office_branches b
                  where b.topic = p_topic and b.enabled
                    and public._office_role(auth.uid(), b.branch_name) is not null);
$$;

/** 내 자리를 볼 지점 — 본사는 고른 지점(없으면 켜진 첫 지점), 나머지는 내 지점 */
create or replace function public._office_scope(_uid uuid, _branch text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_req text := nullif(btrim(coalesce(_branch, '')), ''); v_mine text;
begin
  if _uid is null then raise exception '로그인이 필요해요'; end if;
  if public._strategy_hq(_uid) then
    if v_req is not null and public._office_role(_uid, v_req) is not null then return v_req; end if;
    return (select b.branch_name from public.office_branches b where b.enabled order by b.branch_name limit 1);
  end if;
  select branch_name into v_mine from public.profiles where user_id = _uid;
  if public._office_role(_uid, v_mine) is null then raise exception '지점 회의실은 우리 지점 코치님 · 지점장님만 들어올 수 있어요'; end if;
  return v_mine;
end $$;

/** 지점 회의실 사람들 — 그 지점 지도진 + 대표님(본사). 체험용 계정 제외. */
create or replace function public._office_people(_branch text)
returns table(user_id uuid, hq boolean) language sql stable security definer set search_path = public as $$
  select s.user_id, false from public._strategy_branch_staff(_branch) s
   where not public._strategy_hq(s.user_id)
  union
  select r.user_id, true from public.user_roles r
    join public.profiles p on p.user_id = r.user_id
   where r.role::text in ('super_admin', 'admin') and not coalesce(p.is_test_account, false);
$$;

/** 자리 정하기 — 지점장 직함(또는 앱 권한 지점장)이 먼저 지점장 책상, 나머지는 들어온 순서로 코치 책상 */
create or replace function public._office_assign_seats(_branch text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_seat text;
begin
  -- 더 이상 그 지점 지도진이 아니면 자리를 비운다
  delete from public.office_seats os
   where os.branch_name = _branch
     and (not exists (select 1 from public._strategy_branch_staff(_branch) s where s.user_id = os.user_id)
          or public._strategy_hq(os.user_id));

  for r in
    select s.user_id,
           coalesce(p.staff_title, '') in ('지점장', '관장') as title_mgr,
           exists (select 1 from public.user_roles ur where ur.user_id = s.user_id and ur.role::text = 'branch_manager') as role_mgr
      from public._strategy_branch_staff(_branch) s
      join public.profiles p on p.user_id = s.user_id
     where not public._strategy_hq(s.user_id)
       and not exists (select 1 from public.office_seats os where os.branch_name = _branch and os.user_id = s.user_id)
     order by (coalesce(p.staff_title, '') in ('지점장', '관장')) desc,
              exists (select 1 from public.user_roles ur where ur.user_id = s.user_id and ur.role::text = 'branch_manager') desc,
              p.created_at nulls last, s.user_id
  loop
    v_seat := null;
    if (r.title_mgr or r.role_mgr)
       and not exists (select 1 from public.office_seats os where os.branch_name = _branch and os.seat = 'mgr') then
      v_seat := 'mgr';
    end if;
    if v_seat is null then
      select x.seat into v_seat
        from unnest(array['c1','c2','c3','c4','c5','c6','c7','c8','x1','x2','x3','x4']) with ordinality as x(seat, ord)
       where not exists (select 1 from public.office_seats os where os.branch_name = _branch and os.seat = x.seat)
       order by x.ord limit 1;
    end if;
    continue when v_seat is null;  -- 12명이 넘으면 자리 없이 문 옆에 선다(화면)
    insert into public.office_seats (branch_name, user_id, seat) values (_branch, r.user_id, v_seat)
    on conflict do nothing;
  end loop;
end $$;

/** 바뀜 신호 — 내용 없이 무엇이 바뀌었는지만 (비공개 채널) */
create or replace function public._office_ping(_branch text, _what text)
returns void language plpgsql security definer set search_path = public as $$
declare v_topic text;
begin
  select topic into v_topic from public.office_branches where branch_name = _branch and enabled;
  if v_topic is null then return; end if;
  begin
    perform realtime.send(jsonb_build_object('t', _what), 'changed', v_topic, true);
  exception when others then
    null; -- 신호가 실패해도 기록은 그대로 (화면은 1분마다 다시 읽는다)
  end;
end $$;

/** 회의 한 건 + 들어올 수 있는지 */
create or replace function public._office_meeting_for(_uid uuid, _meeting uuid)
returns public.office_meetings language plpgsql stable security definer set search_path = public as $$
declare m public.office_meetings;
begin
  select * into m from public.office_meetings where id = _meeting;
  if m.id is null then raise exception '회의를 찾을 수 없어요'; end if;
  if public._office_role(_uid, m.branch_name) is null then raise exception '이 지점 회의실에는 들어올 수 없어요'; end if;
  return m;
end $$;

create or replace function public._office_display(_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._strategy_display(_uid);
$$;

revoke all on function public._office_role(uuid, text) from public, anon, authenticated;
revoke all on function public._office_can_topic(text) from public, anon;
grant execute on function public._office_can_topic(text) to authenticated;  -- 실시간 채널 정책에서 쓴다
revoke all on function public._office_scope(uuid, text) from public, anon, authenticated;
revoke all on function public._office_people(text) from public, anon, authenticated;
revoke all on function public._office_assign_seats(text) from public, anon, authenticated;
revoke all on function public._office_ping(text, text) from public, anon, authenticated;
revoke all on function public._office_meeting_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public._office_display(uuid) from public, anon, authenticated;

-- ───────────────────────── 실시간 채널 정책 (비공개 채널만 해당 — 라이브보드 board-ping 같은 공개 채널은 그대로) ─────────────────────────
drop policy if exists office_topic_select on realtime.messages;
create policy office_topic_select on realtime.messages
  for select to authenticated
  using (public._office_can_topic(realtime.topic()));

drop policy if exists office_topic_insert on realtime.messages;
create policy office_topic_insert on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('presence', 'broadcast') and public._office_can_topic(realtime.topic()));

-- ───────────────────────── 나 ─────────────────────────

/** 내가 들어갈 수 있는 회의실 (홈 카드 · 전체 메뉴 · 앱 전체 접속 신호) — 코치는 내 지점 하나, 대표님은 켜진 지점 모두 */
create or replace function public.office_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('offices', '[]'::jsonb); end if;
  return jsonb_build_object(
    'me', v_uid,
    'offices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'branch', b.branch_name,
               'label', btrim(replace(b.branch_name, '153복싱짐', '')),
               'topic', b.topic,
               'role', public._office_role(v_uid, b.branch_name),
               'meeting', (select jsonb_build_object('id', m.id, 'title', m.title, 'opened_at', m.opened_at)
                             from public.office_meetings m
                            where m.branch_name = b.branch_name and m.closed_at is null))
             order by b.branch_name)
        from public.office_branches b
       where b.enabled and public._office_role(v_uid, b.branch_name) is not null), '[]'::jsonb));
end $$;

-- ───────────────────────── 사무실 (사람 · 자리 · 상태 · 열린 회의) ─────────────────────────
create or replace function public.office_state(p_branch text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_meeting public.office_meetings;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  if v_branch is null then raise exception '켜진 지점 회의실이 없어요'; end if;
  perform public._office_assign_seats(v_branch);
  select * into v_meeting from public.office_meetings where branch_name = v_branch and closed_at is null;

  return jsonb_build_object(
    'branch', v_branch,
    'label', btrim(replace(v_branch, '153복싱짐', '')),
    'topic', (select topic from public.office_branches where branch_name = v_branch),
    'me', v_uid,
    'role', public._office_role(v_uid, v_branch),
    'branches', case when public._strategy_hq(v_uid)
                     then coalesce((select jsonb_agg(b.branch_name order by b.branch_name) from public.office_branches b where b.enabled), '[]'::jsonb)
                     else jsonb_build_array(v_branch) end,
    'people', coalesce((
      select jsonb_agg(public._office_display(pp.user_id) || jsonb_build_object(
               'hq', pp.hq,
               'host', public._office_role(pp.user_id, v_branch) = 'host',
               'seat', case when pp.hq then 'boss'
                            else (select os.seat from public.office_seats os where os.branch_name = v_branch and os.user_id = pp.user_id) end,
               'status', coalesce((select st.status from public.office_status st
                                    where st.user_id = pp.user_id and st.updated_at > now() - interval '3 hours'), 'on'),
               'style', (select cp.parts_json ->> 'style'
                           from public.member_character_assignments a
                           join public.character_presets cp on cp.id = a.preset_id
                          where a.user_id = pp.user_id and a.is_active
                          order by a.updated_at desc nulls last limit 1))
             order by pp.hq desc, (select coalesce(nullif(btrim(p.name), ''), p.nickname) from public.profiles p where p.user_id = pp.user_id))
        from public._office_people(v_branch) pp), '[]'::jsonb),
    'meeting', case when v_meeting.id is null then null else jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'agenda', to_jsonb(v_meeting.agenda),
      'opened_at', v_meeting.opened_at,
      'opened_by', public._office_display(v_meeting.opened_by),
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'first_joined_at', a.first_joined_at,
                                            'last_joined_at', a.last_joined_at, 'in_room', a.left_at is null)
                         order by a.first_joined_at)
          from public.office_meeting_attendees a where a.meeting_id = v_meeting.id), '[]'::jsonb)) end
  );
end $$;

/** 상태 말풍선 — on 자리에 있음 · class 수업 중 · away 자리 비움 */
create or replace function public.office_set_status(p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); b record;
begin
  if p_status is null or p_status not in ('on', 'class', 'away') then raise exception '상태를 다시 골라 주세요'; end if;
  if not exists (select 1 from public.office_branches ob where ob.enabled and public._office_role(v_uid, ob.branch_name) is not null) then
    raise exception '지점 회의실은 우리 지점 코치님 · 지점장님만 쓸 수 있어요';
  end if;
  insert into public.office_status (user_id, status, updated_at) values (v_uid, p_status, now())
  on conflict (user_id) do update set status = excluded.status, updated_at = excluded.updated_at;
  for b in select ob.branch_name from public.office_branches ob
            where ob.enabled and public._office_role(v_uid, ob.branch_name) is not null loop
    perform public._office_ping(b.branch_name, 'status');
  end loop;
end $$;

-- ───────────────────────── 회의 ─────────────────────────

/** 회의 열기 — 대표님 · 지점장. 지점 지도진 + 대표님에게 알림(휴대폰 푸시는 알림 트리거가 보낸다). 연 사람은 바로 들어간다. */
create or replace function public.office_open_meeting(p_branch text, p_title text, p_agenda text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_branch text; v_id uuid; v_title text := btrim(coalesce(p_title, ''));
  v_agenda text[]; v_me jsonb;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  if public._office_role(v_uid, v_branch) is distinct from 'host' then
    raise exception '회의는 대표님 · 지점장님이 열 수 있어요';
  end if;
  if v_title = '' then raise exception '안건을 한 줄 적어 주세요'; end if;
  if char_length(v_title) > 80 then raise exception '안건은 80자까지 적을 수 있어요'; end if;
  select coalesce(array_agg(left(btrim(x), 60) order by ord), '{}') into v_agenda
    from unnest(coalesce(p_agenda, '{}')) with ordinality as t(x, ord)
   where btrim(coalesce(x, '')) <> '' and ord <= 5;
  if exists (select 1 from public.office_meetings where branch_name = v_branch and closed_at is null) then
    raise exception '이미 열린 회의가 있어요';
  end if;

  insert into public.office_meetings (branch_name, title, agenda, opened_by)
  values (v_branch, v_title, v_agenda, v_uid) returning id into v_id;
  insert into public.office_meeting_attendees (meeting_id, user_id) values (v_id, v_uid);
  v_me := public._office_display(v_uid);
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (v_id, v_uid, 'system', coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '') || '님이 회의를 열었어요');

  insert into public.notifications (user_id, title, body, link)
  select pp.user_id, '지금 지점 회의가 열렸어요',
         left(v_title || ' · ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''), 120),
         '/office'
    from public._office_people(v_branch) pp
   where pp.user_id <> v_uid;

  perform public._office_ping(v_branch, 'meeting');
  return v_id;
end $$;

/** 회의 들어가기 (참석 자동 기록) */
create or replace function public.office_join_meeting(p_meeting uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if m.closed_at is not null then raise exception '이미 끝난 회의예요'; end if;
  insert into public.office_meeting_attendees (meeting_id, user_id) values (m.id, v_uid)
  on conflict (meeting_id, user_id) do update set last_joined_at = now(), left_at = null;
  perform public._office_ping(m.branch_name, 'attendees');
end $$;

/** 회의 나가기 (내 자리로) */
create or replace function public.office_leave_meeting(p_meeting uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  update public.office_meeting_attendees set left_at = now()
   where meeting_id = m.id and user_id = v_uid and left_at is null;
  perform public._office_ping(m.branch_name, 'attendees');
end $$;

/** 회의 채팅 보내기 — 열린 회의에서만. 'decision'(정한 것)은 회의를 열 수 있는 사람만. 보내면 참석으로 남는다. */
create or replace function public.office_send_message(p_meeting uuid, p_body text, p_kind text default 'chat')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_body text := btrim(coalesce(p_body, '')); v_kind text := coalesce(p_kind, 'chat'); v_id uuid;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if m.closed_at is not null then raise exception '이미 끝난 회의예요'; end if;
  if v_body = '' then raise exception '내용을 적어 주세요'; end if;
  if char_length(v_body) > 1000 then raise exception '한 번에 1,000자까지 보낼 수 있어요'; end if;
  if v_kind not in ('chat', 'decision') then raise exception '보낼 수 없는 종류예요'; end if;
  if v_kind = 'decision' and public._office_role(v_uid, m.branch_name) is distinct from 'host' then
    raise exception '정한 것은 대표님 · 지점장님이 남겨요';
  end if;
  insert into public.office_meeting_attendees as att (meeting_id, user_id) values (m.id, v_uid)
  on conflict (meeting_id, user_id) do update set left_at = null,
    last_joined_at = case when att.left_at is null then att.last_joined_at else now() end;
  insert into public.office_messages (meeting_id, author_id, kind, body) values (m.id, v_uid, v_kind, v_body)
  returning id into v_id;
  perform public._office_ping(m.branch_name, 'msg');
  return jsonb_build_object('id', v_id);
end $$;

/** 보낸 말을 '정한 것'으로 / 되돌리기 — 대표님 · 지점장, 열린 회의에서만 */
create or replace function public.office_mark_decision(p_message uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_msg public.office_messages; m public.office_meetings;
begin
  select * into v_msg from public.office_messages where id = p_message and deleted_at is null;
  if v_msg.id is null or v_msg.kind = 'system' then raise exception '바꿀 수 없는 말이에요'; end if;
  m := public._office_meeting_for(v_uid, v_msg.meeting_id);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then raise exception '정한 것은 대표님 · 지점장님이 남겨요'; end if;
  if m.closed_at is not null then raise exception '이미 끝난 회의예요'; end if;
  update public.office_messages set kind = case when p_on then 'decision' else 'chat' end where id = v_msg.id;
  perform public._office_ping(m.branch_name, 'msg');
end $$;

/** 회의 끝내기 — 대표님 · 지점장. 들어와 있던 사람은 모두 자리로. 채팅 · 정한 것 · 참석이 회의록으로 남는다. */
create or replace function public.office_close_meeting(p_meeting uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings; v_me jsonb;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  if public._office_role(v_uid, m.branch_name) is distinct from 'host' then raise exception '회의는 대표님 · 지점장님이 끝낼 수 있어요'; end if;
  if m.closed_at is not null then return; end if;
  v_me := public._office_display(v_uid);
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (m.id, v_uid, 'system', coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '') || '님이 회의를 끝냈어요');
  update public.office_meetings set closed_at = now(), closed_by = v_uid where id = m.id;
  update public.office_meeting_attendees set left_at = now() where meeting_id = m.id and left_at is null;
  perform public._office_ping(m.branch_name, 'meeting');
end $$;

/** 회의 채팅 · 회의록 읽기 — 그 지점 회의실 사람만 (끝난 회의도) */
create or replace function public.office_messages(p_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.office_meetings;
begin
  m := public._office_meeting_for(v_uid, p_meeting);
  return jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', m.id, 'branch', m.branch_name, 'title', m.title, 'agenda', to_jsonb(m.agenda),
      'opened_at', m.opened_at, 'closed_at', m.closed_at,
      'opened_by', public._office_display(m.opened_by),
      'closed_by', case when m.closed_by is null then null else public._office_display(m.closed_by) end,
      'attendees', coalesce((
        select jsonb_agg(public._office_display(a.user_id) || jsonb_build_object(
                 'first_joined_at', a.first_joined_at, 'in_room', a.left_at is null and m.closed_at is null)
               order by a.first_joined_at)
          from public.office_meeting_attendees a where a.meeting_id = m.id), '[]'::jsonb)),
    'messages', coalesce((
      select jsonb_agg(x.j order by x.created_at, x.id)
        from (select om.created_at, om.id,
                     jsonb_build_object('id', om.id, 'kind', om.kind, 'body', om.body, 'created_at', om.created_at,
                                        'mine', om.author_id = v_uid, 'author', public._office_display(om.author_id)) as j
                from public.office_messages om
               where om.meeting_id = m.id and om.deleted_at is null
               order by om.created_at desc, om.id desc
               limit 400) x), '[]'::jsonb)
  );
end $$;

/** 지난 회의 목록 (회의록) */
create or replace function public.office_meetings_list(p_branch text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_limit integer := greatest(1, least(coalesce(p_limit, 20), 60));
begin
  v_branch := public._office_scope(v_uid, p_branch);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'title', m.title, 'opened_at', m.opened_at, 'closed_at', m.closed_at,
             'opened_by', public._office_display(m.opened_by),
             'attendees', (select count(*) from public.office_meeting_attendees a where a.meeting_id = m.id),
             'decisions', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind = 'decision' and om.deleted_at is null),
             'messages', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind <> 'system' and om.deleted_at is null))
           order by m.opened_at desc)
      from (select * from public.office_meetings where branch_name = v_branch order by opened_at desc limit v_limit) m), '[]'::jsonb);
end $$;

revoke all on function public.office_me() from public, anon;
revoke all on function public.office_state(text) from public, anon;
revoke all on function public.office_set_status(text) from public, anon;
revoke all on function public.office_open_meeting(text, text, text[]) from public, anon;
revoke all on function public.office_join_meeting(uuid) from public, anon;
revoke all on function public.office_leave_meeting(uuid) from public, anon;
revoke all on function public.office_send_message(uuid, text, text) from public, anon;
revoke all on function public.office_mark_decision(uuid, boolean) from public, anon;
revoke all on function public.office_close_meeting(uuid) from public, anon;
revoke all on function public.office_messages(uuid) from public, anon;
revoke all on function public.office_meetings_list(text, integer) from public, anon;
grant execute on function public.office_me() to authenticated;
grant execute on function public.office_state(text) to authenticated;
grant execute on function public.office_set_status(text) to authenticated;
grant execute on function public.office_open_meeting(text, text, text[]) to authenticated;
grant execute on function public.office_join_meeting(uuid) to authenticated;
grant execute on function public.office_leave_meeting(uuid) to authenticated;
grant execute on function public.office_send_message(uuid, text, text) to authenticated;
grant execute on function public.office_mark_decision(uuid, boolean) to authenticated;
grant execute on function public.office_close_meeting(uuid) to authenticated;
grant execute on function public.office_messages(uuid) to authenticated;
grant execute on function public.office_meetings_list(text, integer) to authenticated;
