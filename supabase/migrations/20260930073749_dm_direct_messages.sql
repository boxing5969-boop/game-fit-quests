-- 2026-09-30 대표님: "상대방에게 개인적으로 인스타그램처럼 DM 메시지를 보낼 수 있게 하자."
--
-- 대표님이 고른 규칙
--   · 대상 = 같은 지점 회원 + 코치님 (본사 계정은 전 지점)
--   · 첫 메시지 = 메시지 요청함 — 회원끼리는 상대가 수락하기 전까지 1개만 보낼 수 있다
--     (코치님·본사가 보내거나 코치님께 보내는 메시지는 바로 대화함으로 간다)
--   · 내용 = 글자 + 이모지 (사진 없음, 1000자까지)
--   · 신고 확인 = 본사만 — 신고할 때 남긴 대화 사본만 본다. 신고되지 않은 대화는 본사도 볼 수 없다
--   · 차단 · 신고 · '메시지 요청 받기' 끄기 기본 제공
--
-- 보안: 테이블은 RLS 를 켜고 정책을 두지 않는다 — 앱은 아래 SECURITY DEFINER 함수로만 읽고 쓴다.
-- 보내는 사람 자격은 하트와 같다: 처음 받은 아이디·비밀번호(전화번호)를 바꾼 회원·코치님 (본사는 예외).
-- XP·지갑·레벨은 건드리지 않는다.

-- ── 1. 테이블 ────────────────────────────────────────────────────
create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  initiator uuid not null,
  -- request = 회원끼리 첫 메시지(요청함) · active = 대화 중 · declined = 받은 사람이 삭제(보낸 사람은 모른다)
  status text not null default 'request' check (status in ('request', 'active', 'declined')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_message_at timestamptz,
  last_sender uuid,
  last_preview text,
  a_last_read_at timestamptz,
  b_last_read_at timestamptz,
  -- '대화 나가기' — 이 시각까지의 메시지는 그 사람 화면에서 사라진다(상대 화면은 그대로)
  a_cleared_at timestamptz,
  b_cleared_at timestamptz,
  constraint dm_threads_pair_order check (user_a < user_b),
  constraint dm_threads_pair_unique unique (user_a, user_b),
  constraint dm_threads_initiator_in_pair check (initiator = user_a or initiator = user_b)
);
create index dm_threads_user_b_idx on public.dm_threads (user_b);
create index dm_threads_initiator_created_idx on public.dm_threads (initiator, created_at);

create table public.dm_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index dm_messages_thread_id_idx on public.dm_messages (thread_id, id desc);
create index dm_messages_sender_created_idx on public.dm_messages (sender_id, created_at);

create table public.dm_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint dm_blocks_not_self check (blocker <> blocked)
);
create index dm_blocks_blocked_idx on public.dm_blocks (blocked);

create table public.dm_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- false = 다른 회원이 새 대화를 시작할 수 없다 (이미 나눈 대화·코치님·본사 메시지는 그대로 온다)
  allow_requests boolean not null default true,
  -- 본사가 신고를 처리하며 건 제한 — 이 시각까지 메시지를 보낼 수 없다(읽기는 된다)
  suspended_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.dm_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.dm_threads(id) on delete set null,
  reporter uuid not null references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('abuse', 'sexual', 'harassment', 'spam', 'other')),
  detail text check (detail is null or char_length(detail) <= 300),
  -- 신고한 순간의 최근 대화 50개 사본 — 대화를 나가거나 계정이 지워져도 본사가 확인할 수 있게
  snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved')),
  action text check (action in ('dismiss', 'suspend7', 'suspend30', 'lift')),
  resolved_by uuid,
  resolved_at timestamptz,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index dm_reports_status_created_idx on public.dm_reports (status, created_at desc);
create index dm_reports_reporter_created_idx on public.dm_reports (reporter, created_at);
create unique index dm_reports_one_open_per_thread on public.dm_reports (reporter, thread_id) where status = 'open';

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_blocks enable row level security;
alter table public.dm_settings enable row level security;
alter table public.dm_reports enable row level security;
revoke all on table public.dm_threads, public.dm_messages, public.dm_blocks, public.dm_settings, public.dm_reports
  from anon, authenticated;

-- ── 2. 내부 도우미 (앱에서 직접 부르지 않는다) ────────────────────────
-- 누구인가: hq(전체관리자·관리자) · coach(지도진·코치·지점장) · member(지점 회원 · 체험용 계정) · null(메시지 불가)
create or replace function public._dm_kind(p_user uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when p_user is null then null
    when exists (select 1 from public.user_roles r
                  where r.user_id = p_user and r.role in ('super_admin', 'admin')) then 'hq'
    when exists (select 1 from public.profiles p where p.user_id = p_user and coalesce(p.is_staff, false))
      or exists (select 1 from public.user_roles r
                  where r.user_id = p_user and r.role in ('coach', 'branch_manager')) then 'coach'
    when public._is_rankable_member(p_user) then 'member'
    when exists (select 1 from public.profiles p
                  where p.user_id = p_user and coalesce(p.is_test_account, false) and coalesce(p.is_approved, false)) then 'member'
    else null
  end;
$$;

-- 보이는 이름: 코치님 = '실명 직함님'(홈 화면 지도진 표기와 같다) · 그 밖 = 닉네임 → 이름 → 익명 복서 (랭킹과 같다)
create or replace function public._dm_display(p_user uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p.is_staff, false) or r.role_title is not null then
      btrim(coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '') || ' ' ||
            case when right(t.title, 1) = '님' then t.title else t.title || '님' end)
    else coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서')
  end
  from public.profiles p
  left join lateral (
    select case when bool_or(ur.role = 'branch_manager') then '지점장' else '코치' end as role_title
      from public.user_roles ur
     where ur.user_id = p.user_id and ur.role in ('coach', 'branch_manager')
    having count(*) > 0
  ) r on true
  cross join lateral (select coalesce(nullif(btrim(p.staff_title), ''), r.role_title, '코치') as title) t
  where p.user_id = p_user;
$$;

-- 화면에 쓰는 사람 정보 한 덩어리 (전화번호·생년월일은 넣지 않는다)
create or replace function public._dm_person(p_user uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display', public._dm_display(p.user_id),
    'kind', k.kind,
    'branch', p.branch_name,
    'rank', case when k.kind = 'coach' then 'champion' else lower(coalesce(mp.current_rank::text, 'white')) end,
    'level', coalesce(mp.current_level, 1),
    'avatar_url', p.avatar_url
  )
  from public.profiles p
  cross join lateral (select public._dm_kind(p.user_id) as kind) k
  left join public.member_progress mp on mp.user_id = p.user_id
  where p.user_id = p_user;
$$;

create or replace function public._dm_reason_text(p_code text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case p_code
    when 'self' then '나에게는 메시지를 보낼 수 없어요'
    when 'not_member' then '지점 회원·코치님만 메시지를 쓸 수 있어요'
    when 'suspended' then '신고 처리로 메시지 보내기가 잠시 제한됐어요'
    when 'change_credentials' then '처음 받은 아이디·비밀번호(전화번호)를 바꾸면 메시지를 보낼 수 있어요'
    when 'you_blocked' then '차단한 회원이에요 — 차단을 풀면 메시지를 보낼 수 있어요'
    when 'unavailable' then '지금은 이 회원에게 메시지를 보낼 수 없어요'
    when 'target_unavailable' then '메시지를 받을 수 없는 계정이에요'
    when 'other_branch' then '같은 지점 회원·코치님께만 메시지를 보낼 수 있어요'
    when 'target_closed' then '이 회원은 지금 메시지 요청을 받지 않아요'
    when 'too_many_requests' then '새 대화는 하루 10명까지 시작할 수 있어요 — 내일 다시 보내 주세요'
    when 'awaiting_accept' then '상대가 수락하면 대화를 이어 갈 수 있어요'
    else null
  end;
$$;

-- 나 자신 때문에 못 보내는 이유 (null = 보낼 수 있음)
create or replace function public._dm_self_reason(p_me uuid)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text := public._dm_kind(p_me);
begin
  if v_kind is null then
    return 'not_member';
  end if;
  if exists (select 1 from public.dm_settings s where s.user_id = p_me and s.suspended_until > now()) then
    return 'suspended';
  end if;
  if v_kind <> 'hq' and exists (select 1 from public.profiles p
                                 where p.user_id = p_me and coalesce(p.must_change_credentials, false)) then
    return 'change_credentials';
  end if;
  return null;
end;
$$;

-- 새 대화를 시작할 수 없는 이유 (null = 시작 가능)
create or replace function public._dm_start_reason(p_me uuid, p_to uuid)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
  v_mk text;
  v_ok text;
  v_mb text;
  v_ob text;
begin
  if p_to is null or p_to = p_me then
    return 'self';
  end if;
  -- 누구에게 보낼 수 있는지부터 (다른 지점·본사·차단 — 이 경우 상대 정보를 돌려주지 않는다)
  v_mk := public._dm_kind(p_me);
  if v_mk is null then
    return 'not_member';
  end if;
  v_ok := public._dm_kind(p_to);
  if v_ok is null then
    return 'target_unavailable';
  end if;
  -- 본사가 아니면 같은 지점끼리만. 회원·코치님이 본사 계정에 먼저 말을 걸 수는 없다(본사가 보낸 대화에는 답장한다)
  if v_mk <> 'hq' then
    if v_ok = 'hq' then
      return 'target_unavailable';
    end if;
    select p.branch_name into v_mb from public.profiles p where p.user_id = p_me;
    select p.branch_name into v_ob from public.profiles p where p.user_id = p_to;
    if nullif(btrim(v_mb), '') is null or v_ob is distinct from v_mb then
      return 'other_branch';
    end if;
  end if;
  if exists (select 1 from public.dm_blocks b where b.blocker = p_to and b.blocked = p_me) then
    return 'unavailable';
  end if;
  if exists (select 1 from public.dm_blocks b where b.blocker = p_me and b.blocked = p_to) then
    return 'you_blocked';
  end if;
  -- 그다음 내 상태 (제한·처음 아이디)
  v_reason := public._dm_self_reason(p_me);
  if v_reason is not null then
    return v_reason;
  end if;
  if v_mk = 'member' and v_ok = 'member'
     and exists (select 1 from public.dm_settings s where s.user_id = p_to and not s.allow_requests) then
    return 'target_closed';
  end if;
  if v_mk = 'member'
     and (select count(*) from public.dm_threads t
           where t.initiator = p_me and t.created_at > now() - interval '1 day') >= 10 then
    return 'too_many_requests';
  end if;
  return null;
end;
$$;

-- 이미 있는 대화에 보낼 수 없는 이유 (null = 보낼 수 있음)
create or replace function public._dm_thread_reason(p_me uuid, p_t public.dm_threads)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_other uuid := case when p_t.user_a = p_me then p_t.user_b else p_t.user_a end;
  v_reason text;
begin
  v_reason := public._dm_self_reason(p_me);
  if v_reason is not null then
    return v_reason;
  end if;
  if exists (select 1 from public.dm_blocks b where b.blocker = p_me and b.blocked = v_other) then
    return 'you_blocked';
  end if;
  if exists (select 1 from public.dm_blocks b where b.blocker = v_other and b.blocked = p_me) then
    return 'unavailable';
  end if;
  if public._dm_kind(v_other) is null then
    return 'target_unavailable';
  end if;
  -- 요청(또는 조용히 삭제된 요청)을 보낸 쪽은 수락 전까지 1개만 — 삭제됐는지는 알려 주지 않는다
  if p_t.status in ('request', 'declined') and p_t.initiator = p_me
     and exists (select 1 from public.dm_messages m where m.thread_id = p_t.id and m.sender_id = p_me) then
    return 'awaiting_accept';
  end if;
  return null;
end;
$$;

-- 내 대화 목록 원본 — box: inbox(대화) · requests(받은 요청). 나간 대화·내가 차단한 사람·내가 삭제한 요청은 빠진다
create or replace function public._dm_my_threads(p_me uuid)
returns table (
  thread_id uuid, other uuid, status text, initiator uuid, last_message_at timestamptz, last_preview text,
  last_sender uuid, other_read timestamptz, unread integer, box text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  -- 받은 사람이 삭제한 요청(declined)은 보낸 사람에게 그냥 '요청'으로 보인다 (받는 사람 목록에서는 빠진다)
  select m.id, m.other, case when m.status = 'declined' then 'request' else m.status end, m.initiator,
         m.last_message_at, m.last_preview, m.last_sender, m.other_read,
         (select count(*)::integer
            from (select 1 from public.dm_messages x
                   where x.thread_id = m.id and x.sender_id <> p_me
                     and x.created_at > coalesce(greatest(m.my_read, m.my_cleared), '-infinity'::timestamptz)
                   limit 99) s) as unread,
         case when m.status = 'active' or m.initiator = p_me then 'inbox' else 'requests' end as box
    from (
      select t.id, t.status, t.initiator, t.last_message_at, t.last_preview, t.last_sender,
             case when t.user_a = p_me then t.user_b else t.user_a end as other,
             case when t.user_a = p_me then t.a_last_read_at else t.b_last_read_at end as my_read,
             case when t.user_a = p_me then t.a_cleared_at else t.b_cleared_at end as my_cleared,
             case when t.user_a = p_me then t.b_last_read_at else t.a_last_read_at end as other_read
        from public.dm_threads t
       where (t.user_a = p_me or t.user_b = p_me)
         and t.last_message_at is not null
    ) m
   where (m.my_cleared is null or m.last_message_at > m.my_cleared)
     and not (m.status = 'declined' and m.initiator <> p_me)
     and not exists (select 1 from public.dm_blocks b where b.blocker = p_me and b.blocked = m.other);
$$;

-- ── 3. 앱이 부르는 함수 ─────────────────────────────────────────
-- 받은함 — p_box: 'inbox'(대화) | 'requests'(메시지 요청)
create or replace function public.dm_list_threads(p_box text default 'inbox', p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_rows jsonb;
  v_requests integer;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_box is null or p_box not in ('inbox', 'requests') then
    raise exception '잘못된 요청이에요';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'thread_id', x.thread_id,
           'peer', public._dm_person(x.other),
           'status', x.status,
           'i_am_initiator', x.initiator = v_me,
           'last_message_at', x.last_message_at,
           'last_preview', x.last_preview,
           'last_from_me', x.last_sender = v_me,
           'unread', x.unread,
           -- 읽음 표시는 대화가 시작된 뒤에만 (요청 상태에서는 읽었는지 알려 주지 않는다)
           'seen', x.status = 'active' and x.last_sender = v_me and x.other_read is not null
                   and x.other_read >= x.last_message_at
         ) order by x.last_message_at desc), '[]'::jsonb)
    into v_rows
    from (select * from public._dm_my_threads(v_me) t
           where t.box = p_box
           order by t.last_message_at desc
           limit v_limit) x;

  select count(*)::integer into v_requests from public._dm_my_threads(v_me) t where t.box = 'requests';

  return jsonb_build_object('box', p_box, 'rows', v_rows, 'requests', v_requests);
end;
$$;

-- 안 읽은 수 — 메뉴·머리글 배지. 본사는 처리 안 한 신고 수도 받는다
create or replace function public.dm_summary()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_unread_threads integer := 0;
  v_unread_messages integer := 0;
  v_requests integer := 0;
  v_new_requests integer := 0;
  v_reports integer := 0;
  v_suspended timestamptz;
begin
  if v_me is null then
    return jsonb_build_object('enabled', false, 'kind', null, 'unread_threads', 0, 'unread_messages', 0,
                              'requests', 0, 'new_requests', 0, 'open_reports', 0, 'badge', 0);
  end if;
  v_kind := public._dm_kind(v_me);

  select count(*) filter (where t.box = 'inbox' and t.unread > 0),
         coalesce(sum(t.unread) filter (where t.box = 'inbox'), 0),
         count(*) filter (where t.box = 'requests'),
         count(*) filter (where t.box = 'requests' and t.unread > 0)
    into v_unread_threads, v_unread_messages, v_requests, v_new_requests
    from public._dm_my_threads(v_me) t;

  if v_kind = 'hq' then
    select count(*)::integer into v_reports from public.dm_reports r where r.status = 'open';
  end if;
  select s.suspended_until into v_suspended from public.dm_settings s
   where s.user_id = v_me and s.suspended_until > now();

  return jsonb_build_object(
    'enabled', v_kind is not null,
    'kind', v_kind,
    'unread_threads', v_unread_threads,
    'unread_messages', v_unread_messages,
    'requests', v_requests,
    'new_requests', v_new_requests,
    'open_reports', v_reports,
    'suspended_until', v_suspended,
    -- 배지 = 안 읽은 대화 + 새 요청 (+ 본사: 처리 안 한 신고)
    'badge', v_unread_threads + v_new_requests + v_reports
  );
end;
$$;

-- 한 사람과의 대화 열기 전 확인 — 라이센스 카드의 '메시지' 버튼·새 메시지 화면이 쓴다
create or replace function public.dm_peer(p_user uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_reason text;
  v_person jsonb;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_user is null then
    raise exception '받는 사람을 골라 주세요';
  end if;
  v_person := public._dm_person(p_user);
  if v_person is null then
    raise exception '회원을 찾을 수 없어요';
  end if;
  -- 대화가 이미 있으면 그 대화 기준, 없으면 새 대화 규칙. 다른 지점·차단 등으로 열 수 없는 사람은 정보를 돌려주지 않는다
  select * into v_t from public.dm_threads t
   where t.user_a = least(v_me, p_user) and t.user_b = greatest(v_me, p_user);
  if v_t.id is not null then
    v_reason := public._dm_thread_reason(v_me, v_t);
  else
    v_reason := public._dm_start_reason(v_me, p_user);
    if v_reason in ('other_branch', 'target_unavailable', 'unavailable', 'self', 'not_member') then
      -- 대화를 열 수 없는 사람 — 버튼을 숨기는 데만 쓰고 자세한 정보는 돌려주지 않는다
      return jsonb_build_object('user_id', p_user, 'thread_id', null, 'status', null, 'can_open', false,
                                'can_send', false, 'reason', v_reason, 'reason_text', public._dm_reason_text(v_reason),
                                'peer', null);
    end if;
  end if;
  return jsonb_build_object(
    'user_id', p_user,
    'thread_id', v_t.id,
    'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
    'i_am_initiator', case when v_t.id is null then null else v_t.initiator = v_me end,
    'can_open', v_t.id is not null or v_reason is null
                or v_reason in ('change_credentials', 'you_blocked', 'too_many_requests', 'suspended'),
    'can_send', v_reason is null,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason),
    'peer', v_person
  );
end;
$$;

-- 대화방 — 최신 메시지 p_limit 개(p_before 를 주면 그보다 오래된 것). 최신 쪽을 읽으면 읽음 처리
create or replace function public.dm_get_thread(p_thread uuid, p_before bigint default null, p_limit integer default 40)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_other uuid;
  v_cleared timestamptz;
  v_my_read timestamptz;
  v_other_read timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_msgs jsonb;
  v_more boolean;
  v_reason text;
  v_suspended timestamptz;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into v_t from public.dm_threads t where t.id = p_thread;
  if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
    raise exception '대화를 찾을 수 없어요';
  end if;
  if v_t.user_a = v_me then
    v_other := v_t.user_b; v_cleared := v_t.a_cleared_at; v_my_read := v_t.a_last_read_at; v_other_read := v_t.b_last_read_at;
  else
    v_other := v_t.user_a; v_cleared := v_t.b_cleared_at; v_my_read := v_t.b_last_read_at; v_other_read := v_t.a_last_read_at;
  end if;

  select count(*) > v_limit into v_more
    from (select 1 from public.dm_messages m
           where m.thread_id = v_t.id
             and (v_cleared is null or m.created_at > v_cleared)
             and (p_before is null or m.id < p_before)
           limit v_limit + 1) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'mine', q.sender_id = v_me, 'body', q.body, 'created_at', q.created_at
         ) order by q.id), '[]'::jsonb)
    into v_msgs
    from (select m.id, m.sender_id, m.body, m.created_at
            from public.dm_messages m
           where m.thread_id = v_t.id
             and (v_cleared is null or m.created_at > v_cleared)
             and (p_before is null or m.id < p_before)
           order by m.id desc
           limit v_limit) q;

  -- 최신 쪽을 봤으면 읽음 (새 메시지가 있을 때만 쓴다 — 몇 초마다 새로 읽어도 매번 쓰지 않게)
  if p_before is null and v_t.last_message_at is not null
     and (v_my_read is null or v_my_read < v_t.last_message_at) then
    update public.dm_threads t
       set a_last_read_at = case when t.user_a = v_me then now() else t.a_last_read_at end,
           b_last_read_at = case when t.user_b = v_me then now() else t.b_last_read_at end
     where t.id = v_t.id;
  end if;

  v_reason := public._dm_thread_reason(v_me, v_t);
  select s.suspended_until into v_suspended from public.dm_settings s
   where s.user_id = v_me and s.suspended_until > now();

  return jsonb_build_object(
    'thread', jsonb_build_object('id', v_t.id,
                                 'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
                                 'i_am_initiator', v_t.initiator = v_me,
                                 'created_at', v_t.created_at),
    'peer', public._dm_person(v_other),
    'can_send', v_reason is null,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason),
    'suspended_until', v_suspended,
    'needs_response', v_t.status = 'request' and v_t.initiator <> v_me,
    'i_blocked', exists (select 1 from public.dm_blocks b where b.blocker = v_me and b.blocked = v_other),
    'other_read_at', case when v_t.status = 'active' then v_other_read end,
    'messages', v_msgs,
    'has_more', v_more
  );
end;
$$;

-- 보내기 — p_thread 가 있으면 그 대화에, 없으면 p_to 와의 대화(없으면 새로 만든다)에
create or replace function public.dm_send(p_thread uuid default null, p_to uuid default null, p_body text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_body text;
  v_reason text;
  v_status text;
  v_msg public.dm_messages%rowtype;
  v_recent integer;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) = 0 then
    raise exception '메시지를 입력해 주세요';
  end if;
  if char_length(v_body) > 1000 then
    raise exception '메시지는 1000자까지 보낼 수 있어요';
  end if;

  if p_thread is not null then
    select * into v_t from public.dm_threads t where t.id = p_thread for update;
    if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
      raise exception '대화를 찾을 수 없어요';
    end if;
  else
    if p_to is null then
      raise exception '받는 사람을 골라 주세요';
    end if;
    if p_to = v_me then
      raise exception '%', public._dm_reason_text('self');
    end if;
    select * into v_t from public.dm_threads t
     where t.user_a = least(v_me, p_to) and t.user_b = greatest(v_me, p_to)
       for update;
    if v_t.id is null then
      v_reason := public._dm_start_reason(v_me, p_to);
      if v_reason is not null then
        raise exception '%', public._dm_reason_text(v_reason);
      end if;
      -- 회원끼리는 요청함으로, 코치님·본사가 끼면 바로 대화
      v_status := case when public._dm_kind(v_me) = 'member' and public._dm_kind(p_to) = 'member'
                       then 'request' else 'active' end;
      insert into public.dm_threads (user_a, user_b, initiator, status, accepted_at)
      values (least(v_me, p_to), greatest(v_me, p_to), v_me, v_status,
              case when v_status = 'active' then now() end)
      on conflict (user_a, user_b) do nothing;
      -- 두 사람이 동시에 만들었으면 먼저 생긴 대화로 이어 간다
      select * into v_t from public.dm_threads t
       where t.user_a = least(v_me, p_to) and t.user_b = greatest(v_me, p_to)
         for update;
    end if;
  end if;

  v_reason := public._dm_thread_reason(v_me, v_t);
  if v_reason is not null then
    raise exception '%', public._dm_reason_text(v_reason);
  end if;

  -- 너무 빠른 연속 전송·도배 막기
  select count(*) into v_recent from public.dm_messages m
   where m.sender_id = v_me and m.created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception '메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요';
  end if;
  select count(*) into v_recent from public.dm_messages m
   where m.sender_id = v_me and m.created_at > now() - interval '1 day';
  if v_recent >= 500 then
    raise exception '오늘 보낼 수 있는 메시지(500개)를 모두 보냈어요';
  end if;

  insert into public.dm_messages (thread_id, sender_id, body)
  values (v_t.id, v_me, v_body)
  returning * into v_msg;

  -- 받은 요청에 답장하면 수락 · 내가 보낸 시각까지는 읽은 것으로
  update public.dm_threads t
     set status = case when t.status in ('request', 'declined') and t.initiator <> v_me then 'active' else t.status end,
         accepted_at = case when t.status in ('request', 'declined') and t.initiator <> v_me then now() else t.accepted_at end,
         last_message_at = v_msg.created_at,
         last_sender = v_me,
         last_preview = left(regexp_replace(v_body, '\s+', ' ', 'g'), 80),
         a_last_read_at = case when t.user_a = v_me then v_msg.created_at else t.a_last_read_at end,
         b_last_read_at = case when t.user_b = v_me then v_msg.created_at else t.b_last_read_at end
   where t.id = v_t.id
  returning * into v_t;

  return jsonb_build_object(
    'thread_id', v_t.id,
    'status', case when v_t.status = 'declined' and v_t.initiator = v_me then 'request' else v_t.status end,
    'message', jsonb_build_object('id', v_msg.id, 'mine', true, 'body', v_msg.body, 'created_at', v_msg.created_at)
  );
end;
$$;

-- 받은 요청 수락·삭제 (삭제해도 보낸 사람에게 알리지 않는다)
create or replace function public.dm_respond(p_thread uuid, p_action text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into v_t from public.dm_threads t where t.id = p_thread for update;
  if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
    raise exception '대화를 찾을 수 없어요';
  end if;
  if v_t.initiator = v_me then
    raise exception '보낸 요청은 상대가 수락해야 해요';
  end if;
  if p_action = 'accept' then
    if v_t.status in ('request', 'declined') then
      update public.dm_threads t set status = 'active', accepted_at = now() where t.id = v_t.id
      returning * into v_t;
    end if;
  elsif p_action = 'decline' then
    if v_t.status = 'request' then
      update public.dm_threads t
         set status = 'declined',
             a_cleared_at = case when t.user_a = v_me then now() else t.a_cleared_at end,
             b_cleared_at = case when t.user_b = v_me then now() else t.b_cleared_at end
       where t.id = v_t.id
      returning * into v_t;
    end if;
  else
    raise exception '잘못된 요청이에요';
  end if;
  return jsonb_build_object('thread_id', v_t.id, 'status', v_t.status);
end;
$$;

-- 대화 나가기 — 내 화면에서만 지운다(상대 화면은 그대로). 새 메시지가 오면 그 뒤부터 다시 보인다
create or replace function public.dm_hide_thread(p_thread uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_n integer;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  update public.dm_threads t
     set a_cleared_at = case when t.user_a = v_me then now() else t.a_cleared_at end,
         b_cleared_at = case when t.user_b = v_me then now() else t.b_cleared_at end,
         a_last_read_at = case when t.user_a = v_me then now() else t.a_last_read_at end,
         b_last_read_at = case when t.user_b = v_me then now() else t.b_last_read_at end
   where t.id = p_thread and (t.user_a = v_me or t.user_b = v_me);
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception '대화를 찾을 수 없어요';
  end if;
  return jsonb_build_object('thread_id', p_thread, 'hidden', true);
end;
$$;

-- 차단 · 차단 풀기
create or replace function public.dm_block(p_user uuid, p_block boolean default true)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_user is null or p_user = v_me then
    raise exception '잘못된 요청이에요';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = p_user) then
    raise exception '회원을 찾을 수 없어요';
  end if;
  if coalesce(p_block, true) then
    insert into public.dm_blocks (blocker, blocked) values (v_me, p_user) on conflict do nothing;
  else
    delete from public.dm_blocks b where b.blocker = v_me and b.blocked = p_user;
  end if;
  return jsonb_build_object('user_id', p_user, 'blocked', coalesce(p_block, true));
end;
$$;

-- 내 설정 — 메시지 요청 받기 · 차단 목록 · 제한 여부
create or replace function public.dm_get_settings()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_allow boolean;
  v_suspended timestamptz;
  v_blocks jsonb;
  v_reason text;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  select s.allow_requests, case when s.suspended_until > now() then s.suspended_until end
    into v_allow, v_suspended
    from public.dm_settings s where s.user_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', b.blocked,
           'display', coalesce(public._dm_display(b.blocked), '알 수 없는 회원'),
           'branch', p.branch_name,
           'blocked_at', b.created_at
         ) order by b.created_at desc), '[]'::jsonb)
    into v_blocks
    from public.dm_blocks b
    left join public.profiles p on p.user_id = b.blocked
   where b.blocker = v_me;
  v_reason := public._dm_self_reason(v_me);
  return jsonb_build_object(
    'kind', public._dm_kind(v_me),
    'allow_requests', coalesce(v_allow, true),
    'suspended_until', v_suspended,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason),
    'blocks', v_blocks
  );
end;
$$;

create or replace function public.dm_set_settings(p_allow_requests boolean)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  insert into public.dm_settings (user_id, allow_requests, updated_at)
  values (v_me, coalesce(p_allow_requests, true), now())
  on conflict (user_id) do update set allow_requests = excluded.allow_requests, updated_at = now();
  return jsonb_build_object('allow_requests', coalesce(p_allow_requests, true));
end;
$$;

-- 새 메시지 — 보낼 수 있는 사람 찾기. 회원·코치님: 같은 지점(코치님 먼저 → 앱을 쓰는 회원 → 최근 출석 순). 본사: 전 지점
create or replace function public.dm_people(p_search text default null, p_limit integer default 40)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_all boolean;
  v_branch text;
  v_pat text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_rows jsonb;
  v_reason text;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  v_kind := public._dm_kind(v_me);
  v_all := v_kind = 'hq';
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  v_reason := public._dm_self_reason(v_me);
  if v_kind is null or (not v_all and nullif(btrim(v_branch), '') is null) then
    return jsonb_build_object('branch', v_branch, 'all_branches', false, 'rows', '[]'::jsonb,
                              'reason', coalesce(v_reason, 'not_member'),
                              'reason_text', public._dm_reason_text(coalesce(v_reason, 'not_member')));
  end if;
  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    v_pat := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- 사람마다 _dm_kind·_dm_display 를 부르면 전 지점(본사) 목록이 2초 가까이 걸려서, 같은 규칙을 한 번에 계산한다.
  -- 규칙은 _dm_kind(누구인가) · _dm_display(보이는 이름)와 같아야 한다 (롤백 테스트로 전체 계정 대조).
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id,
           'display', c.disp,
           'kind', c.kind,
           'branch', c.branch_name,
           'rank', case when c.kind = 'coach' then 'champion' else lower(coalesce(c.current_rank, 'white')) end,
           'level', coalesce(c.current_level, 1),
           'avatar_url', c.avatar_url,
           'thread_id', c.thread_id
         ) order by c.ord_kind, c.ord_app, c.last_at desc nulls last, c.disp), '[]'::jsonb)
    into v_rows
    from (
      select k.user_id, k.branch_name, k.avatar_url, k.kind, k.disp,
             mp.current_rank::text as current_rank, mp.current_level,
             t.id as thread_id,
             case k.kind when 'coach' then 0 when 'member' then 1 else 2 end as ord_kind,
             case when u.last_sign_in_at is not null then 0 else 1 end as ord_app,
             la.last_at
        from (
          select b.*,
                 case when b.kind = 'coach' then
                        btrim(coalesce(nullif(btrim(b.name), ''), nullif(btrim(b.nickname), ''), '') || ' ' ||
                              case when right(b.title, 1) = '님' then b.title else b.title || '님' end)
                      else coalesce(nullif(btrim(b.nickname), ''), nullif(btrim(b.name), ''), '익명 복서')
                 end as disp
            from (
              select p.user_id, p.branch_name, p.avatar_url, p.name, p.nickname, p.is_test_account,
                     coalesce(nullif(btrim(p.staff_title), ''),
                              case when rr.has_bm then '지점장' when rr.has_coach then '코치' end, '코치') as title,
                     case
                       when rr.has_hq then 'hq'
                       when coalesce(p.is_staff, false) or rr.has_coach then 'coach'
                       when coalesce(p.is_approved, false) and not coalesce(p.is_test_account, false)
                            and (p.membership_end is not null
                                 or exists (select 1 from public.attendance_logs a
                                             where a.user_id = p.user_id and a.method in ('broj', 'face'))) then 'member'
                       when coalesce(p.is_test_account, false) and coalesce(p.is_approved, false) then 'member'
                     end as kind
                from public.profiles p
                left join lateral (
                  select coalesce(bool_or(ur.role in ('super_admin', 'admin')), false) as has_hq,
                         coalesce(bool_or(ur.role in ('coach', 'branch_manager')), false) as has_coach,
                         coalesce(bool_or(ur.role = 'branch_manager'), false) as has_bm
                    from public.user_roles ur where ur.user_id = p.user_id
                ) rr on true
               where p.user_id <> v_me
                 and (v_all or p.branch_name = v_branch)
            ) b
        ) k
        left join public.member_progress mp on mp.user_id = k.user_id
        left join auth.users u on u.id = k.user_id
        left join public.dm_threads t on t.user_a = least(v_me, k.user_id) and t.user_b = greatest(v_me, k.user_id)
        left join lateral (
          select max(a.checked_in_at) as last_at from public.attendance_logs a where a.user_id = k.user_id
        ) la on true
       where k.kind is not null
         and (v_all or k.kind <> 'hq')
         and (v_all or not coalesce(k.is_test_account, false))
         and not exists (select 1 from public.dm_blocks bl
                          where (bl.blocker = v_me and bl.blocked = k.user_id)
                             or (bl.blocker = k.user_id and bl.blocked = v_me))
         and (v_pat is null or k.disp ilike v_pat escape '\')
       order by ord_kind, ord_app, la.last_at desc nulls last, k.disp
       limit v_limit
    ) c;

  return jsonb_build_object(
    'branch', v_branch,
    'all_branches', v_all,
    'rows', v_rows,
    'reason', v_reason,
    'reason_text', public._dm_reason_text(v_reason)
  );
end;
$$;

-- 신고 — 본사만 확인한다. 최근 대화 50개 사본을 함께 남기고, 원하면 바로 차단
create or replace function public.dm_report(p_thread uuid, p_reason text, p_detail text default null, p_block boolean default true)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_t public.dm_threads%rowtype;
  v_other uuid;
  v_detail text := nullif(btrim(coalesce(p_detail, '')), '');
  v_snapshot jsonb;
  v_id uuid;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into v_t from public.dm_threads t where t.id = p_thread;
  if v_t.id is null or (v_t.user_a <> v_me and v_t.user_b <> v_me) then
    raise exception '대화를 찾을 수 없어요';
  end if;
  if p_reason is null or p_reason not in ('abuse', 'sexual', 'harassment', 'spam', 'other') then
    raise exception '신고 이유를 골라 주세요';
  end if;
  if v_detail is not null and char_length(v_detail) > 300 then
    raise exception '자세한 내용은 300자까지 쓸 수 있어요';
  end if;
  if (select count(*) from public.dm_reports r
       where r.reporter = v_me and r.created_at > now() - interval '1 day') >= 10 then
    raise exception '신고는 하루 10건까지 할 수 있어요';
  end if;
  v_other := case when v_t.user_a = v_me then v_t.user_b else v_t.user_a end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'from', case when m.sender_id = v_me then 'reporter' else 'reported' end,
           'body', m.body,
           'at', m.created_at
         ) order by m.id), '[]'::jsonb)
    into v_snapshot
    from (select mm.id, mm.sender_id, mm.body, mm.created_at from public.dm_messages mm
           where mm.thread_id = v_t.id order by mm.id desc limit 50) m;

  update public.dm_reports r
     set reason = p_reason, detail = v_detail, snapshot = v_snapshot, created_at = now()
   where r.reporter = v_me and r.thread_id = v_t.id and r.status = 'open'
  returning r.id into v_id;
  if v_id is null then
    insert into public.dm_reports (thread_id, reporter, reported, reason, detail, snapshot)
    values (v_t.id, v_me, v_other, p_reason, v_detail, v_snapshot)
    returning id into v_id;
  end if;

  if coalesce(p_block, true) then
    insert into public.dm_blocks (blocker, blocked) values (v_me, v_other) on conflict do nothing;
  end if;
  return jsonb_build_object('report_id', v_id, 'blocked', coalesce(p_block, true));
end;
$$;

-- ── 4. 본사 — 신고 확인·처리 ─────────────────────────────────────
create or replace function public.dm_admin_reports(p_status text default 'open', p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_rows jsonb;
begin
  if v_me is null or public._dm_kind(v_me) is distinct from 'hq' then
    raise exception '본사 계정만 볼 수 있어요';
  end if;
  if p_status is null or p_status not in ('open', 'resolved', 'all') then
    raise exception '잘못된 요청이에요';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'status', r.status,
           'reason', r.reason,
           'detail', r.detail,
           'created_at', r.created_at,
           'resolved_at', r.resolved_at,
           'action', r.action,
           'message_count', jsonb_array_length(r.snapshot),
           'reporter', jsonb_build_object('user_id', r.reporter, 'display', coalesce(public._dm_display(r.reporter), '알 수 없는 회원'),
                                          'branch', pr.branch_name),
           'reported', jsonb_build_object('user_id', r.reported, 'display', coalesce(public._dm_display(r.reported), '알 수 없는 회원'),
                                          'branch', pd.branch_name,
                                          'suspended_until', case when s.suspended_until > now() then s.suspended_until end)
         ) order by (r.status = 'open') desc, r.created_at desc), '[]'::jsonb)
    into v_rows
    from (select * from public.dm_reports rr
           where p_status = 'all' or rr.status = p_status
           order by (rr.status = 'open') desc, rr.created_at desc
           limit v_limit) r
    left join public.profiles pr on pr.user_id = r.reporter
    left join public.profiles pd on pd.user_id = r.reported
    left join public.dm_settings s on s.user_id = r.reported;
  return jsonb_build_object('rows', v_rows,
                            'open', (select count(*) from public.dm_reports r2 where r2.status = 'open'));
end;
$$;

create or replace function public.dm_admin_report(p_report uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_r public.dm_reports%rowtype;
  v_suspended timestamptz;
begin
  if v_me is null or public._dm_kind(v_me) is distinct from 'hq' then
    raise exception '본사 계정만 볼 수 있어요';
  end if;
  select * into v_r from public.dm_reports r where r.id = p_report;
  if v_r.id is null then
    raise exception '신고를 찾을 수 없어요';
  end if;
  select case when s.suspended_until > now() then s.suspended_until end into v_suspended
    from public.dm_settings s where s.user_id = v_r.reported;
  return jsonb_build_object(
    'id', v_r.id,
    'status', v_r.status,
    'reason', v_r.reason,
    'detail', v_r.detail,
    'created_at', v_r.created_at,
    'resolved_at', v_r.resolved_at,
    'action', v_r.action,
    'note', v_r.note,
    'reporter', coalesce(public._dm_person(v_r.reporter), jsonb_build_object('user_id', v_r.reporter, 'display', '알 수 없는 회원')),
    'reported', coalesce(public._dm_person(v_r.reported), jsonb_build_object('user_id', v_r.reported, 'display', '알 수 없는 회원'))
                || jsonb_build_object('suspended_until', v_suspended),
    'messages', v_r.snapshot
  );
end;
$$;

-- p_action: dismiss(문제 없음) · suspend7 / suspend30(메시지 보내기 7일·30일 제한) · lift(제한 풀기)
create or replace function public.dm_admin_resolve(p_report uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_r public.dm_reports%rowtype;
  v_until timestamptz;
begin
  if v_me is null or public._dm_kind(v_me) is distinct from 'hq' then
    raise exception '본사 계정만 처리할 수 있어요';
  end if;
  if p_action is null or p_action not in ('dismiss', 'suspend7', 'suspend30', 'lift') then
    raise exception '처리 방법을 골라 주세요';
  end if;
  select * into v_r from public.dm_reports r where r.id = p_report for update;
  if v_r.id is null then
    raise exception '신고를 찾을 수 없어요';
  end if;
  if p_action in ('suspend7', 'suspend30') then
    v_until := now() + case when p_action = 'suspend7' then interval '7 days' else interval '30 days' end;
    insert into public.dm_settings as s (user_id, suspended_until, updated_at)
    values (v_r.reported, v_until, now())
    on conflict (user_id) do update
      set suspended_until = greatest(coalesce(s.suspended_until, now()), excluded.suspended_until),
          updated_at = now();
  elsif p_action = 'lift' then
    update public.dm_settings s set suspended_until = null, updated_at = now() where s.user_id = v_r.reported;
  end if;
  update public.dm_reports r
     set status = 'resolved', action = p_action, resolved_by = v_me, resolved_at = now(),
         note = left(nullif(btrim(coalesce(p_note, '')), ''), 300)
   where r.id = v_r.id;
  return jsonb_build_object('report_id', v_r.id, 'status', 'resolved', 'action', p_action,
                            'suspended_until', (select case when s.suspended_until > now() then s.suspended_until end
                                                  from public.dm_settings s where s.user_id = v_r.reported));
end;
$$;

-- ── 5. 권한 — 도우미는 막고, 앱 함수는 로그인한 사람만 ───────────────────
revoke all on function public._dm_kind(uuid) from public, anon, authenticated;
revoke all on function public._dm_display(uuid) from public, anon, authenticated;
revoke all on function public._dm_person(uuid) from public, anon, authenticated;
revoke all on function public._dm_reason_text(text) from public, anon, authenticated;
revoke all on function public._dm_self_reason(uuid) from public, anon, authenticated;
revoke all on function public._dm_start_reason(uuid, uuid) from public, anon, authenticated;
revoke all on function public._dm_thread_reason(uuid, public.dm_threads) from public, anon, authenticated;
revoke all on function public._dm_my_threads(uuid) from public, anon, authenticated;

revoke all on function public.dm_list_threads(text, integer) from public, anon;
revoke all on function public.dm_summary() from public, anon;
revoke all on function public.dm_peer(uuid) from public, anon;
revoke all on function public.dm_get_thread(uuid, bigint, integer) from public, anon;
revoke all on function public.dm_send(uuid, uuid, text) from public, anon;
revoke all on function public.dm_respond(uuid, text) from public, anon;
revoke all on function public.dm_hide_thread(uuid) from public, anon;
revoke all on function public.dm_block(uuid, boolean) from public, anon;
revoke all on function public.dm_get_settings() from public, anon;
revoke all on function public.dm_set_settings(boolean) from public, anon;
revoke all on function public.dm_people(text, integer) from public, anon;
revoke all on function public.dm_report(uuid, text, text, boolean) from public, anon;
revoke all on function public.dm_admin_reports(text, integer) from public, anon;
revoke all on function public.dm_admin_report(uuid) from public, anon;
revoke all on function public.dm_admin_resolve(uuid, text, text) from public, anon;

grant execute on function public.dm_list_threads(text, integer) to authenticated;
grant execute on function public.dm_summary() to authenticated;
grant execute on function public.dm_peer(uuid) to authenticated;
grant execute on function public.dm_get_thread(uuid, bigint, integer) to authenticated;
grant execute on function public.dm_send(uuid, uuid, text) to authenticated;
grant execute on function public.dm_respond(uuid, text) to authenticated;
grant execute on function public.dm_hide_thread(uuid) to authenticated;
grant execute on function public.dm_block(uuid, boolean) to authenticated;
grant execute on function public.dm_get_settings() to authenticated;
grant execute on function public.dm_set_settings(boolean) to authenticated;
grant execute on function public.dm_people(text, integer) to authenticated;
grant execute on function public.dm_report(uuid, text, text, boolean) to authenticated;
grant execute on function public.dm_admin_reports(text, integer) to authenticated;
grant execute on function public.dm_admin_report(uuid) to authenticated;
grant execute on function public.dm_admin_resolve(uuid, text, text) to authenticated;