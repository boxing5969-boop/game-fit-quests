-- 전략 회의실 (2026-10-16 대표님: "코치님들과 효율적인 프로그램 관리 — 수업 내용 저장·공유, 지점장이나 내가 전략을 공유하고 지시하는 방,
--   드릴·복싱 트레이닝 영상을 올리고 그 영상으로 오늘 훈련 프로그램을 공유받아 적용")
--   기획안: claude.ai 문서 '전략 회의실 기획안'
--
--   · 직원 전용 — 지도진(profiles.is_staff, 153os 동기화) 또는 관리 권한(coach·branch_manager·admin·super_admin). 회원은 서버가 막는다.
--   · 지시를 쓰는 사람(can_direct) = 본사(super_admin·admin) · 앱 지점장(branch_manager) · 직함 지점장/관장(153os)
--   · 글 종류(kind): directive 지시 · strategy 전략 · praise 칭찬 · principle 운영 원칙(번호 고정) · program 오늘 프로그램 · class_log 수업 기록
--   · 표는 RLS 만 켜고 정책 없음 — 읽기·쓰기는 아래 SECURITY DEFINER 함수로만 (DM 과 같은 방식)
--   · 알림: 새 지시·전략·칭찬·원칙·프로그램 → 대상 코치님 알림함(🔔)·푸시. 댓글 → 글쓴이. 매일 09:00 KST 미확인 글 재알림(1인 1건)
--   · 영상: 비공개 저장소 strategy-videos (50MB, 직원만 올리고 봄) 또는 유튜브·https 링크

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.strategy_items (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('directive', 'strategy', 'praise', 'principle', 'program', 'class_log')),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 3000),
  data jsonb not null default '{}'::jsonb,
  principle_no integer,
  starred boolean not null default false,
  target_user_ids uuid[],          -- null = 지점 직원 전체
  event_date date,                 -- 프로그램 날짜 · 수업 날짜
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists strategy_items_branch_idx on public.strategy_items (branch_name, kind, created_at desc) where deleted_at is null;
alter table public.strategy_items enable row level security;

create table if not exists public.strategy_acks (
  item_id uuid not null references public.strategy_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  acked_at timestamptz,
  applied_at timestamptz,
  primary key (item_id, user_id)
);
alter table public.strategy_acks enable row level security;

create table if not exists public.strategy_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.strategy_items(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists strategy_comments_item_idx on public.strategy_comments (item_id, created_at);
alter table public.strategy_comments enable row level security;

create table if not exists public.strategy_videos (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  category text not null default 'drill' check (category in ('warmup', 'drill', 'mitt', 'defense', 'conditioning', 'etc')),
  level_min integer,
  minutes integer check (minutes is null or minutes between 1 and 120),
  equipment text check (equipment is null or char_length(equipment) <= 80),
  points text[] not null default '{}',
  source text not null check (source in ('upload', 'youtube', 'url')),
  storage_path text,
  url text check (url is null or url ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists strategy_videos_branch_idx on public.strategy_videos (branch_name, created_at desc) where deleted_at is null;
alter table public.strategy_videos enable row level security;

-- ───────────────────────── 누가 직원인가 ─────────────────────────
create or replace function public._strategy_hq(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = _uid and r.role::text in ('super_admin', 'admin'));
$$;

create or replace function public._strategy_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and (
    public._strategy_hq(_uid)
    or exists (select 1 from public.user_roles r where r.user_id = _uid and r.role::text in ('coach', 'branch_manager'))
    or exists (select 1 from public.profiles p where p.user_id = _uid and coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false))
  );
$$;

create or replace function public._strategy_can_direct(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and (
    public._strategy_hq(_uid)
    or exists (select 1 from public.user_roles r where r.user_id = _uid and r.role::text = 'branch_manager')
    or exists (select 1 from public.profiles p where p.user_id = _uid and coalesce(p.is_staff, false)
                 and coalesce(p.staff_title, '') in ('지점장', '관장'))
  );
$$;

/** 내가 볼 지점 — 본사는 고른 지점(없으면 내 지점, 꺼진 지점이면 켜진 첫 지점), 나머지는 내 지점 */
create or replace function public._strategy_scope(_uid uuid, _branch text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_mine text; v_req text := nullif(btrim(coalesce(_branch, '')), '');
begin
  if not public._strategy_staff(_uid) then raise exception '전략 회의실은 코치진만 쓸 수 있어요'; end if;
  select branch_name into v_mine from public.profiles where user_id = _uid;
  if public._strategy_hq(_uid) then
    if v_req is not null then return v_req; end if;
    if v_mine is not null and public.is_branch_visible(v_mine) then return v_mine; end if;
    return (select b.name from public.branches b where b.is_visible order by b.name limit 1);
  end if;
  if v_mine is null then raise exception '내 지점이 정해져 있지 않아요'; end if;
  return v_mine;
end $$;

/** 지점 직원 목록 (테스트 계정 제외) */
create or replace function public._strategy_branch_staff(_branch text)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  select p.user_id from public.profiles p
   where p.branch_name = _branch
     and not coalesce(p.is_test_account, false)
     and (coalesce(p.is_staff, false)
          or exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager')));
$$;

create or replace function public._strategy_display(_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'name', coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '코치'),
    'title', case when public._strategy_hq(p.user_id) then '대표'
                  when nullif(btrim(coalesce(p.staff_title, '')), '') is not null then p.staff_title
                  when exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role::text = 'branch_manager') then '지점장'
                  else '코치' end,
    'avatar_url', p.avatar_url)
  from public.profiles p where p.user_id = _uid;
$$;

revoke all on function public._strategy_hq(uuid) from public, anon, authenticated;
revoke all on function public._strategy_staff(uuid) from public, anon;
revoke all on function public._strategy_can_direct(uuid) from public, anon, authenticated;
revoke all on function public._strategy_scope(uuid, text) from public, anon, authenticated;
revoke all on function public._strategy_branch_staff(text) from public, anon, authenticated;
revoke all on function public._strategy_display(uuid) from public, anon, authenticated;
grant execute on function public._strategy_staff(uuid) to authenticated;  -- 저장소 정책에서 쓴다

-- ───────────────────────── 나 · 지점 정보 ─────────────────────────
create or replace function public.strategy_me(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  if not public._strategy_staff(v_uid) then
    return jsonb_build_object('staff', false);
  end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  return jsonb_build_object(
    'staff', true,
    'me', v_uid,
    'hq', public._strategy_hq(v_uid),
    'can_direct', public._strategy_can_direct(v_uid),
    'branch', v_branch,
    'branches', case when public._strategy_hq(v_uid)
                     then coalesce((select jsonb_agg(b.name order by b.name) from public.branches b where b.is_visible), '[]'::jsonb)
                     else jsonb_build_array(v_branch) end,
    'my_push', exists (select 1 from public.push_subscriptions s where s.user_id = v_uid),
    'staff_list', coalesce((
      select jsonb_agg(public._strategy_display(s.user_id)
                       || jsonb_build_object('has_push', exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id))
                       order by (select coalesce(nullif(btrim(p.name), ''), p.nickname) from public.profiles p where p.user_id = s.user_id))
        from public._strategy_branch_staff(v_branch) s), '[]'::jsonb)
  );
end $$;

-- ───────────────────────── 글 목록 ─────────────────────────
create or replace function public.strategy_feed(p_branch text default null, p_kinds text[] default null, p_limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_limit integer := greatest(1, least(coalesce(p_limit, 60), 200)); v_rows jsonb;
begin
  v_branch := public._strategy_scope(v_uid, p_branch);
  with staff as (select user_id from public._strategy_branch_staff(v_branch)),
  items as (
    select i.* from public.strategy_items i
     where i.branch_name = v_branch and i.deleted_at is null
       and (p_kinds is null or i.kind = any (p_kinds))
       -- 대상이 정해진 글은 대상 · 글쓴이 · 지시권자만
       and (i.target_user_ids is null or v_uid = any (i.target_user_ids) or i.author_id = v_uid or public._strategy_can_direct(v_uid))
     order by case when i.kind = 'principle' then 0 else 1 end, coalesce(i.principle_no, 0), i.created_at desc
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'kind', i.kind, 'title', i.title, 'body', i.body, 'data', i.data,
           'principle_no', i.principle_no, 'starred', i.starred, 'event_date', i.event_date,
           'target_user_ids', i.target_user_ids,
           'created_at', i.created_at, 'updated_at', i.updated_at,
           'author', public._strategy_display(i.author_id),
           'mine', i.author_id = v_uid,
           'my_ack', (select jsonb_build_object('read_at', a.read_at, 'acked_at', a.acked_at, 'applied_at', a.applied_at)
                        from public.strategy_acks a where a.item_id = i.id and a.user_id = v_uid),
           'targets', (select count(*) from staff s
                        where s.user_id <> i.author_id and (i.target_user_ids is null or s.user_id = any (i.target_user_ids))),
           'acked', (select count(*) from public.strategy_acks a join staff s on s.user_id = a.user_id
                      where a.item_id = i.id and a.acked_at is not null and a.user_id <> i.author_id
                        and (i.target_user_ids is null or a.user_id = any (i.target_user_ids))),
           'applied', (select count(*) from public.strategy_acks a where a.item_id = i.id and a.applied_at is not null),
           'comments', (select count(*) from public.strategy_comments c where c.item_id = i.id and c.deleted_at is null)
         ) order by case when i.kind = 'principle' then 0 else 1 end, coalesce(i.principle_no, 0), i.created_at desc), '[]'::jsonb)
    into v_rows
    from items i;
  return jsonb_build_object('branch', v_branch, 'rows', v_rows);
end $$;

/** 확인 현황 — 누가 확인했고 누가 아직인지 (글쓴이 · 지시권자) */
create or replace function public.strategy_ack_status(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype;
begin
  select * into i from public.strategy_items where id = p_item and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  return coalesce((
    select jsonb_agg(public._strategy_display(s.user_id) || jsonb_build_object(
             'read_at', a.read_at, 'acked_at', a.acked_at, 'applied_at', a.applied_at)
           order by a.acked_at nulls last)
      from public._strategy_branch_staff(i.branch_name) s
      left join public.strategy_acks a on a.item_id = i.id and a.user_id = s.user_id
     where s.user_id <> i.author_id and (i.target_user_ids is null or s.user_id = any (i.target_user_ids))), '[]'::jsonb);
end $$;

-- ───────────────────────── 쓰기 · 고치기 · 지우기 ─────────────────────────
create or replace function public.strategy_save(
  p_id uuid, p_branch text, p_kind text, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb, p_event_date date default null, p_targets uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_id uuid;
  v_old public.strategy_items%rowtype;
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_body text := left(btrim(coalesce(p_body, '')), 3000);
  v_label text;
  v_author jsonb;
begin
  if p_kind not in ('directive', 'strategy', 'praise', 'principle', 'program', 'class_log') then raise exception '글 종류가 잘못됐어요'; end if;
  if p_kind <> 'class_log' and not public._strategy_can_direct(v_uid) then
    raise exception '지시·전략·프로그램은 대표님·지점장님만 쓸 수 있어요';
  end if;
  if v_title = '' and v_body = '' and p_kind not in ('program', 'class_log') then raise exception '내용을 써 주세요'; end if;

  if p_id is not null then
    select * into v_old from public.strategy_items where id = p_id and deleted_at is null;
    if v_old.id is null then raise exception '글을 찾을 수 없어요'; end if;
    v_branch := public._strategy_scope(v_uid, v_old.branch_name);
    if v_branch <> v_old.branch_name then raise exception '다른 지점 글이에요'; end if;
    if v_old.author_id <> v_uid and not public._strategy_hq(v_uid) then raise exception '내가 쓴 글만 고칠 수 있어요'; end if;
    update public.strategy_items
       set title = v_title, body = v_body, data = coalesce(p_data, '{}'::jsonb),
           event_date = p_event_date, target_user_ids = p_targets, updated_at = now()
     where id = p_id;
    return p_id;
  end if;

  v_branch := public._strategy_scope(v_uid, p_branch);
  insert into public.strategy_items (branch_name, author_id, kind, title, body, data, event_date, target_user_ids, principle_no)
  values (v_branch, v_uid, p_kind, v_title, v_body, coalesce(p_data, '{}'::jsonb), p_event_date, p_targets,
          case when p_kind = 'principle'
               then coalesce((select max(principle_no) from public.strategy_items
                               where branch_name = v_branch and kind = 'principle' and deleted_at is null), 0) + 1 end)
  returning id into v_id;

  -- 글쓴이는 바로 확인한 것으로
  insert into public.strategy_acks (item_id, user_id, read_at, acked_at) values (v_id, v_uid, now(), now())
  on conflict do nothing;

  -- 알림 (수업 기록은 알림 없이 탭에서 본다)
  if p_kind <> 'class_log' then
    v_label := case p_kind when 'directive' then '📌 새 지시' when 'strategy' then '🧭 새 전략' when 'praise' then '👏 칭찬'
                           when 'principle' then '📏 운영 원칙' else '🥊 오늘 프로그램' end;
    v_author := public._strategy_display(v_uid);
    insert into public.notifications (user_id, title, body, link)
    select s.user_id,
           v_label || ' · ' || coalesce(v_author ->> 'name', '') || ' ' || coalesce(v_author ->> 'title', ''),
           left(coalesce(nullif(v_title, ''), v_body), 120),
           '/messages?tab=strategy'
      from public._strategy_branch_staff(v_branch) s
     where s.user_id <> v_uid and (p_targets is null or s.user_id = any (p_targets));
  end if;
  return v_id;
end $$;

create or replace function public.strategy_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype;
begin
  select * into i from public.strategy_items where id = p_id and deleted_at is null;
  if i.id is null then return; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  if i.author_id <> v_uid and not public._strategy_hq(v_uid) and not public._strategy_can_direct(v_uid) then
    raise exception '내가 쓴 글만 지울 수 있어요';
  end if;
  update public.strategy_items set deleted_at = now() where id = p_id;
end $$;

/** 읽음 · 확인했어요 · 적용했어요 */
create or replace function public.strategy_ack(p_id uuid, p_what text default 'ack')
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype;
begin
  select * into i from public.strategy_items where id = p_id and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  insert into public.strategy_acks (item_id, user_id, read_at, acked_at, applied_at)
  values (p_id, v_uid, now(),
          case when p_what in ('ack', 'applied') then now() end,
          case when p_what = 'applied' then now() end)
  on conflict (item_id, user_id) do update
     set read_at = coalesce(public.strategy_acks.read_at, excluded.read_at),
         acked_at = coalesce(public.strategy_acks.acked_at, excluded.acked_at),
         applied_at = coalesce(public.strategy_acks.applied_at, excluded.applied_at);
end $$;

/** 추천 수업(별표) — 지시권자 */
create or replace function public.strategy_star(p_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype;
begin
  select * into i from public.strategy_items where id = p_id and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  if not public._strategy_can_direct(v_uid) then raise exception '추천은 대표님·지점장님만 할 수 있어요'; end if;
  update public.strategy_items set starred = coalesce(p_on, false) where id = p_id;
  if coalesce(p_on, false) and i.author_id <> v_uid then
    insert into public.notifications (user_id, title, body, link)
    values (i.author_id, '⭐ 추천 수업으로 뽑혔어요', left(coalesce(nullif(i.title, ''), '수업 기록'), 120), '/messages?tab=strategy');
  end if;
end $$;

-- ───────────────────────── 댓글 ─────────────────────────
create or replace function public.strategy_comments(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype;
begin
  select * into i from public.strategy_items where id = p_item and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
            'id', c.id, 'body', c.body, 'created_at', c.created_at, 'mine', c.author_id = v_uid,
            'author', public._strategy_display(c.author_id)) order by c.created_at)
           from public.strategy_comments c where c.item_id = p_item and c.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.strategy_comment_add(p_item uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype; v_id uuid; v_body text := btrim(coalesce(p_body, '')); v_me jsonb;
begin
  select * into i from public.strategy_items where id = p_item and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  if char_length(v_body) = 0 then raise exception '댓글을 써 주세요'; end if;
  if char_length(v_body) > 1000 then raise exception '댓글은 1000자까지예요'; end if;
  insert into public.strategy_comments (item_id, author_id, body) values (p_item, v_uid, v_body) returning id into v_id;
  insert into public.strategy_acks (item_id, user_id, read_at) values (p_item, v_uid, now()) on conflict do nothing;
  if i.author_id <> v_uid then
    v_me := public._strategy_display(v_uid);
    insert into public.notifications (user_id, title, body, link)
    values (i.author_id,
            case when i.kind = 'class_log' then '💬 수업 기록에 피드백' else '💬 댓글' end
              || ' · ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''),
            left(v_body, 120), '/messages?tab=strategy');
  end if;
  return v_id;
end $$;

create or replace function public.strategy_comment_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  update public.strategy_comments set deleted_at = now()
   where id = p_id and deleted_at is null and (author_id = v_uid or public._strategy_hq(v_uid));
end $$;

-- ───────────────────────── 영상 ─────────────────────────
create or replace function public.strategy_videos_list(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  v_branch := public._strategy_scope(v_uid, p_branch);
  return coalesce((select jsonb_agg(jsonb_build_object(
            'id', v.id, 'title', v.title, 'category', v.category, 'level_min', v.level_min, 'minutes', v.minutes,
            'equipment', v.equipment, 'points', to_jsonb(v.points), 'source', v.source, 'storage_path', v.storage_path,
            'url', v.url, 'created_at', v.created_at, 'mine', v.uploader_id = v_uid,
            'uploader', public._strategy_display(v.uploader_id)) order by v.created_at desc)
           from public.strategy_videos v where v.branch_name = v_branch and v.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.strategy_video_add(
  p_branch text, p_title text, p_category text, p_level_min integer, p_minutes integer,
  p_equipment text, p_points text[], p_source text, p_storage_path text, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_id uuid;
begin
  v_branch := public._strategy_scope(v_uid, p_branch);
  if p_source = 'upload' and (p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_uid::text) then
    raise exception '영상 파일 경로가 잘못됐어요';
  end if;
  if p_source in ('youtube', 'url') and (p_url is null or p_url !~ '^https://[^[:space:]]+$') then
    raise exception 'https 로 시작하는 영상 주소를 넣어 주세요';
  end if;
  insert into public.strategy_videos (branch_name, uploader_id, title, category, level_min, minutes, equipment, points, source, storage_path, url)
  values (v_branch, v_uid, left(btrim(coalesce(p_title, '')), 80), coalesce(nullif(p_category, ''), 'drill'), p_level_min, p_minutes,
          nullif(left(btrim(coalesce(p_equipment, '')), 80), ''),
          coalesce((select array_agg(left(btrim(x), 80)) from unnest(coalesce(p_points, '{}')) x where btrim(x) <> ''), '{}'),
          p_source, case when p_source = 'upload' then p_storage_path end, case when p_source <> 'upload' then p_url end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.strategy_video_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  update public.strategy_videos set deleted_at = now()
   where id = p_id and deleted_at is null
     and (uploader_id = v_uid or public._strategy_hq(v_uid)
          or (public._strategy_can_direct(v_uid) and branch_name = public._strategy_scope(v_uid, branch_name)));
end $$;

-- ───────────────────────── 수업 기록 도우미: 그 시간 입실 인원 · 출근 코치 ─────────────────────────
create or replace function public.strategy_class_headcount(p_branch text, p_date date, p_hour integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text; v_from timestamptz; v_to timestamptz;
begin
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_from := (p_date::timestamp + make_interval(hours => greatest(0, least(coalesce(p_hour, 0), 23)))) at time zone 'Asia/Seoul';
  v_to := v_from + interval '1 hour';
  return jsonb_build_object(
    'attendees', (select count(distinct a.user_id) from public.attendance_logs a
                   where a.branch_name = v_branch and a.checked_in_at >= v_from and a.checked_in_at < v_to
                     and not coalesce(a.is_duplicate, false)),
    'staff_checked_in', coalesce((select jsonb_agg(distinct d.staff_name) from public.staff_duty_logs d
                                   where d.branch_name = v_branch and d.attend_date = p_date and d.checked_in_at < v_to), '[]'::jsonb));
end $$;

-- ───────────────────────── 탭 빨간 점: 내가 아직 확인 안 한 글 수 ─────────────────────────
create or replace function public.strategy_badge()
returns integer language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  if not public._strategy_staff(v_uid) then return 0; end if;
  select branch_name into v_branch from public.profiles where user_id = v_uid;
  return (select count(*)::int from public.strategy_items i
           where i.branch_name = v_branch and i.deleted_at is null and i.author_id <> v_uid
             and i.kind in ('directive', 'strategy', 'principle', 'program', 'praise')
             and i.created_at > now() - interval '14 days'
             and (i.target_user_ids is null or v_uid = any (i.target_user_ids))
             and not exists (select 1 from public.strategy_acks a where a.item_id = i.id and a.user_id = v_uid and a.acked_at is not null));
end $$;

-- ───────────────────────── 매일 09:00 미확인 재알림 (1인 1건) ─────────────────────────
create or replace function public.strategy_remind_unacked()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with pending as (
    select s.user_id, count(*) as n
      from public.strategy_items i
      cross join lateral public._strategy_branch_staff(i.branch_name) s
     where i.deleted_at is null and i.kind in ('directive', 'principle', 'program')
       and i.created_at > now() - interval '7 days' and i.created_at < now() - interval '6 hours'
       and s.user_id <> i.author_id
       and (i.target_user_ids is null or s.user_id = any (i.target_user_ids))
       and not exists (select 1 from public.strategy_acks a where a.item_id = i.id and a.user_id = s.user_id and a.acked_at is not null)
     group by s.user_id
  )
  insert into public.notifications (user_id, title, body, link)
  select p.user_id, '📌 확인하지 않은 전략 회의실 글 ' || p.n || '개', '읽고 "확인했어요"를 눌러 주세요', '/messages?tab=strategy'
    from pending p;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.strategy_remind_unacked() from public, anon, authenticated;

-- 권한
do $$
declare f text;
begin
  foreach f in array array[
    'strategy_me(text)', 'strategy_feed(text, text[], integer)', 'strategy_ack_status(uuid)',
    'strategy_save(uuid, text, text, text, text, jsonb, date, uuid[])', 'strategy_delete(uuid)', 'strategy_ack(uuid, text)',
    'strategy_star(uuid, boolean)', 'strategy_comments(uuid)', 'strategy_comment_add(uuid, text)', 'strategy_comment_delete(uuid)',
    'strategy_videos_list(text)', 'strategy_video_add(text, text, text, integer, integer, text, text[], text, text, text)',
    'strategy_video_delete(uuid)', 'strategy_class_headcount(text, date, integer)', 'strategy_badge()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ───────────────────────── 영상 저장소 (비공개, 50MB) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('strategy-videos', 'strategy-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do nothing;

do $$ begin
  create policy "strategy videos staff upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'strategy-videos' and public._strategy_staff(auth.uid())
                and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "strategy videos staff read" on storage.objects for select to authenticated
    using (bucket_id = 'strategy-videos' and public._strategy_staff(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "strategy videos owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'strategy-videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

-- 매일 09:00 KST(= 00:00 UTC) 미확인 재알림
select cron.schedule('strategy-remind-unacked', '0 0 * * *', $$select public.strategy_remind_unacked()$$);
