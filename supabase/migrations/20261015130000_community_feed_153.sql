-- 153 커뮤니티 개편 2·3단계 (2026-10-15 대표님: "커뮤니티 개편안대로 진행 — 반응 이름은 153")
--   · 오늘 운동 한 줄(챔피언 일기) — 같은 지점 공개(기본) / 짝꿍만, 사진 한 장
--   · 153 반응 — 한 줄 · 오늘도 한 판(출석) · 승급 축하 카드에 누르는 단 하나의 반응
--   · 모두의 피드 get_community_feed — 코치 이번 주 목표(고정) · 승급 축하(고정) · 한 줄 · 오늘도 한 판 · 새 식구
--   · 이번 주 153왕 — 153 을 가장 많이 보낸 회원 (TV 는 로그인 없음 → anon)
--   · 코치 이번 주 목표 글 · 글 숨기기 · 신고
--   · 출석 자동 카드 끄기 (profiles.community_auto_post)
-- 공식 1~40 레벨업·XP·지갑은 건드리지 않는다. 153 반응·댓글·목표 글에는 보상이 없다.

-- ── 1. 한 줄 옵션 ──
alter table public.champion_journal_entries
  add column if not exists visibility text not null default 'partners',
  add column if not exists photo_url text,
  add column if not exists kind text not null default 'journal',
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid;
-- 이미 쓴 일기는 '파트너만' 이라 믿고 쓴 글 → partners 로 두고, 새 글부터 지점 공개가 기본
alter table public.champion_journal_entries alter column visibility set default 'branch';
do $$ begin
  alter table public.champion_journal_entries
    add constraint champion_journal_entries_visibility_chk check (visibility in ('branch', 'partners'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.champion_journal_entries
    add constraint champion_journal_entries_kind_chk check (kind in ('journal', 'weekly_goal'));
exception when duplicate_object then null; end $$;
create index if not exists champion_journal_entries_created_idx on public.champion_journal_entries (created_at desc);

-- ── 2. 출석 자동 카드 켜기/끄기 ──
alter table public.profiles add column if not exists community_auto_post boolean not null default true;

-- ── 3. 153 반응 · 신고 ──
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('journal', 'checkin', 'promotion')),
  target_id uuid not null,
  user_id uuid not null,
  branch_name text,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);
create index if not exists community_reactions_branch_week_idx on public.community_reactions (branch_name, created_at);
alter table public.community_reactions enable row level security;  -- RPC 로만 읽고 쓴다

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  reporter_user_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (entry_id, reporter_user_id)
);
alter table public.community_reports enable row level security;

-- ── 4. 도우미 ──
create or replace function public._community_is_staff(p_uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select is_staff from public.profiles where user_id = p_uid), false)
      or public.has_role(p_uid, 'coach') or public.has_role(p_uid, 'branch_manager')
      or public.has_role(p_uid, 'admin') or public.has_role(p_uid, 'super_admin');
$$;

create or replace function public._community_branch_of(p_uid uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select branch_name from public.profiles where user_id = p_uid;
$$;

create or replace function public._community_display_name(p_uid uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(nickname, ''), nullif(name, ''), '회원') from public.profiles where user_id = p_uid;
$$;

-- 이 한 줄을 볼 수 있나 — 본인 · 같은 지점 공개 글 · 짝꿍(코너맨)·서로 응원한 동료
create or replace function public.community_can_view_entry(p_viewer uuid, p_entry_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  e record;
  v_branch text;
begin
  if p_viewer is null then return false; end if;
  select user_id, visibility, hidden_at into e from public.champion_journal_entries where id = p_entry_id;
  if not found then return false; end if;
  if e.user_id = p_viewer then return true; end if;
  if e.hidden_at is not null then return false; end if;
  if e.visibility = 'branch' then
    v_branch := public._community_branch_of(p_viewer);
    if v_branch is not null and v_branch = public._community_branch_of(e.user_id) then return true; end if;
  end if;
  return public.is_journal_partner(p_viewer, e.user_id);
end $$;

-- ── 5. 한 줄 공개 범위·사진 (submit_champion_journal_entry 직후 본인만) ──
create or replace function public.set_journal_entry_options(p_entry_id uuid, p_visibility text, p_photo_url text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_visibility not in ('branch', 'partners') then raise exception '공개 범위가 올바르지 않습니다'; end if;
  if p_photo_url is not null and p_photo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/community/' then
    raise exception '사진 주소가 올바르지 않습니다';
  end if;
  update public.champion_journal_entries
     set visibility = p_visibility, photo_url = p_photo_url
   where id = p_entry_id and user_id = v_uid;
  if not found then raise exception '내 글만 바꿀 수 있습니다'; end if;
  return jsonb_build_object('success', true);
end $$;

-- ── 6. 모두의 피드 ──
create or replace function public.get_community_feed(p_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 80));
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_items jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public._community_branch_of(v_uid);
  if v_branch is null then
    return jsonb_build_object('success', true, 'branch', null, 'is_staff', public._community_is_staff(v_uid), 'items', '[]'::jsonb);
  end if;

  with
  goal as (
    select 'goal'::text as type, e.id, e.user_id, e.created_at as at, true as pinned, 1 as pin_order,
           e.prompt, e.content, null::text as mood, e.photo_url, e.visibility, false as newbie,
           null::text as rank_name, null::int as level_number
      from public.champion_journal_entries e
      join public.profiles p on p.user_id = e.user_id
     where e.kind = 'weekly_goal' and e.hidden_at is null
       and e.created_at >= v_week_start and p.branch_name = v_branch
     order by e.created_at desc limit 1
  ),
  promo as (
    select 'promotion'::text, h.id, h.user_id, h.created_at, true, 2,
           null::text, null::text, null::text, null::text, null::text, false,
           h.rank_name::text, h.level_number
      from public.level_status_history h
      join public.profiles p on p.user_id = h.user_id
     where h.new_status = 'boss_cleared' and h.created_at >= now() - interval '7 days'
       and p.branch_name = v_branch
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
  ),
  posts as (
    select 'journal'::text, e.id, e.user_id, e.created_at, false, 9,
           e.prompt, e.content, e.mood, e.photo_url, e.visibility, false,
           null::text, null::int
      from public.champion_journal_entries e
      join public.profiles p on p.user_id = e.user_id
     where e.kind = 'journal' and e.created_at >= now() - interval '14 days'
       and (e.user_id = v_uid
            or (e.hidden_at is null and e.visibility = 'branch' and p.branch_name = v_branch)
            or (e.hidden_at is null and e.visibility = 'partners' and public.is_journal_partner(v_uid, e.user_id)))
  ),
  checkins as (
    select distinct on (a.user_id) 'checkin'::text, a.id, a.user_id, a.checked_in_at, false, 9,
           null::text, null::text, null::text, null::text, null::text,
           not exists (select 1 from public.attendance_logs b
                        where b.user_id = a.user_id and coalesce(b.is_duplicate, false) = false
                          and (b.checked_in_at at time zone 'Asia/Seoul')::date < v_today),
           null::text, null::int
      from public.attendance_logs a
      join public.profiles p on p.user_id = a.user_id
     where (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
       and a.checked_in_at <= now()
       and coalesce(a.is_duplicate, false) = false
       and p.branch_name = v_branch
       and coalesce(p.community_auto_post, true)
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
     order by a.user_id, a.checked_in_at
  ),
  allx as (
    select * from goal union all select * from promo union all select * from posts
  ),
  ranked as (
    -- 오늘도 한 판(출석) 카드는 개수 제한 밖 — 화면에서 한 장으로 묶는다
    (select * from allx order by pinned desc, pin_order, at desc limit v_limit) union all (select * from checkins)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', r.type,
           'id', r.id,
           'userId', r.user_id,
           'nickname', coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '회원'),
           'avatarUrl', p.avatar_url,
           'isStaff', coalesce(p.is_staff, false),
           'staffTitle', p.staff_title,
           'league', coalesce(mp.current_rank::text, 'white'),
           'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
           'at', r.at,
           'pinned', r.pinned,
           'prompt', r.prompt,
           'content', r.content,
           'mood', r.mood,
           'photoUrl', r.photo_url,
           'visibility', r.visibility,
           'newbie', r.newbie,
           'promoRank', r.rank_name,
           'promoLevel', case when r.rank_name is null then null
                              else (coalesce(array_position(v_order, r.rank_name), 1) - 1) * 10 + r.level_number end,
           'isMine', r.user_id = v_uid,
           'comments', case when r.type in ('journal', 'goal')
                            then (select count(*) from public.champion_journal_comments c where c.entry_id = r.id) else 0 end,
           'count153', (select count(*) from public.community_reactions x
                         where x.target_type = case when r.type = 'goal' then 'journal' else r.type end and x.target_id = r.id),
           'reacted', exists (select 1 from public.community_reactions x
                               where x.target_type = case when r.type = 'goal' then 'journal' else r.type end
                                 and x.target_id = r.id and x.user_id = v_uid)
         ) order by r.pinned desc, r.pin_order, r.at desc), '[]'::jsonb)
    into v_items
    from ranked r
    left join public.profiles p on p.user_id = r.user_id
    left join public.member_progress mp on mp.user_id = r.user_id;

  return jsonb_build_object('success', true, 'branch', v_branch,
                            'is_staff', public._community_is_staff(v_uid), 'items', v_items);
end $$;

-- ── 7. 153 누르기 / 취소 ──
create or replace function public.toggle_community_153(p_type text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_owner uuid;
  v_ok boolean := false;
  v_reacted boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_type not in ('journal', 'checkin', 'promotion') then raise exception '잘못된 대상입니다'; end if;
  v_branch := public._community_branch_of(v_uid);

  if p_type = 'journal' then
    select user_id into v_owner from public.champion_journal_entries where id = p_id;
    v_ok := public.community_can_view_entry(v_uid, p_id);
  elsif p_type = 'checkin' then
    select user_id into v_owner from public.attendance_logs where id = p_id;
    v_ok := v_owner is not null and v_branch is not null and v_branch = public._community_branch_of(v_owner);
  else
    select user_id into v_owner from public.level_status_history where id = p_id;
    v_ok := v_owner is not null and v_branch is not null and v_branch = public._community_branch_of(v_owner);
  end if;

  if not v_ok then raise exception '볼 수 없는 글입니다'; end if;
  if v_owner = v_uid then raise exception '내 글에는 153을 누를 수 없어요'; end if;

  if exists (select 1 from public.community_reactions where target_type = p_type and target_id = p_id and user_id = v_uid) then
    delete from public.community_reactions where target_type = p_type and target_id = p_id and user_id = v_uid;
    v_reacted := false;
  else
    insert into public.community_reactions (target_type, target_id, user_id, branch_name)
    values (p_type, p_id, v_uid, v_branch);
    v_reacted := true;
  end if;

  return jsonb_build_object('success', true, 'reacted', v_reacted,
    'count153', (select count(*) from public.community_reactions where target_type = p_type and target_id = p_id));
end $$;

-- ── 8. 코치 이번 주 목표 ──
create or replace function public.post_weekly_goal(p_content text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_content, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._community_is_staff(v_uid) then raise exception '코치님만 이번 주 목표를 올릴 수 있어요'; end if;
  if public._community_branch_of(v_uid) is null then raise exception '지점이 정해진 계정만 올릴 수 있어요'; end if;
  if char_length(v_clean) < 2 then raise exception '목표를 적어주세요'; end if;
  if char_length(v_clean) > 300 then raise exception '300자 이하로 적어주세요'; end if;
  insert into public.champion_journal_entries (user_id, prompt, content, kind, visibility, quest_xp_granted, gems_granted)
  values (v_uid, '이번 주 목표', v_clean, 'weekly_goal', 'branch', 0, 0)
  returning id into v_id;
  return jsonb_build_object('success', true, 'entry_id', v_id);
end $$;

-- ── 9. 숨기기 (본인 · 같은 지점 코치님 · 관리자) / 신고 ──
create or replace function public.hide_community_entry(p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select user_id into v_owner from public.champion_journal_entries where id = p_entry_id;
  if v_owner is null then raise exception '글을 찾을 수 없습니다'; end if;
  if not (v_owner = v_uid
          or public.has_role(v_uid, 'admin') or public.has_role(v_uid, 'super_admin')
          or (public._community_is_staff(v_uid) and public._community_branch_of(v_uid) = public._community_branch_of(v_owner))) then
    raise exception '숨길 권한이 없습니다';
  end if;
  update public.champion_journal_entries set hidden_at = now(), hidden_by = v_uid where id = p_entry_id;
  return jsonb_build_object('success', true);
end $$;

create or replace function public.report_community_entry(p_entry_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public.community_can_view_entry(v_uid, p_entry_id) then raise exception '볼 수 없는 글입니다'; end if;
  insert into public.community_reports (entry_id, reporter_user_id, reason)
  values (p_entry_id, v_uid, nullif(v_reason, ''))
  on conflict (entry_id, reporter_user_id) do nothing;
  if found then
    insert into public.app_feedback (user_id, category, content, page_path)
    values (v_uid, '커뮤니티 신고',
            concat('글 ', p_entry_id::text, case when v_reason <> '' then ' · ' || v_reason else '' end),
            '/myboxer/community');
  end if;
  return jsonb_build_object('success', true);
end $$;

-- ── 10. 출석 자동 카드 켜기/끄기 ──
create or replace function public.set_community_auto_post(p_on boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  update public.profiles set community_auto_post = coalesce(p_on, true) where user_id = auth.uid();
  return jsonb_build_object('success', true, 'on', coalesce(p_on, true));
end $$;

-- ── 11. 이번 주 153왕 (TV — 로그인 없음) ──
create or replace function public.get_weekly_153_king(p_branch text, p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_week_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_rows jsonb;
begin
  if p_branch is null or btrim(p_branch) = '' then
    return jsonb_build_object('success', true, 'since', v_week_start, 'board', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank', t.rn, 'display_name', t.display_name, 'score', t.n) order by t.rn), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (order by count(*) desc, max(r.created_at) asc) as rn,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '회원') as display_name,
             count(*)::int as n
        from public.community_reactions r
        join public.profiles p on p.user_id = r.user_id
       where r.created_at >= v_week_start
         and p.branch_name = p_branch
         and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
       group by r.user_id, p.nickname, p.name
       order by count(*) desc, max(r.created_at) asc
       limit greatest(1, least(coalesce(p_limit, 3), 10))
    ) t;
  return jsonb_build_object('success', true, 'since', v_week_start, 'board', v_rows);
end $$;

-- ── 12. 댓글 — 볼 수 있는 글이면 댓글도 (지점 공개 글은 같은 지점 회원 누구나) ──
create or replace function public.add_journal_comment(p_entry_id uuid, p_content text)
returns table(success boolean, comment_id uuid, message text)
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_viewer uuid := auth.uid();
  v_clean text;
  v_id uuid;
begin
  if v_viewer is null then raise exception 'auth required'; end if;
  v_clean := btrim(coalesce(p_content, ''));
  if char_length(v_clean) < 1 then raise exception '댓글 내용을 입력해주세요.'; end if;
  if char_length(v_clean) > 500 then raise exception '댓글은 500자 이하로 작성해주세요.'; end if;
  if not exists (select 1 from public.champion_journal_entries where id = p_entry_id) then
    raise exception '일기를 찾을 수 없습니다.';
  end if;
  if not public.community_can_view_entry(v_viewer, p_entry_id) then
    raise exception '이 글에는 댓글을 남길 수 없습니다.';
  end if;
  insert into public.champion_journal_comments (entry_id, commenter_user_id, content)
  values (p_entry_id, v_viewer, v_clean)
  returning id into v_id;
  return query select true, v_id, '댓글이 등록되었습니다.'::text;
end $$;

create or replace function public.list_journal_comments(p_entry_id uuid)
returns table(id uuid, entry_id uuid, commenter_user_id uuid, commenter_name text, content text, created_at timestamptz, is_mine boolean)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_viewer uuid := auth.uid();
begin
  if v_viewer is null then raise exception 'auth required'; end if;
  if not exists (select 1 from public.champion_journal_entries e where e.id = p_entry_id) then
    raise exception 'entry not found';
  end if;
  if not public.community_can_view_entry(v_viewer, p_entry_id) then
    raise exception 'not authorized to view comments for this entry';
  end if;
  return query
  select c.id, c.entry_id, c.commenter_user_id,
         coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '회원') as commenter_name,
         c.content, c.created_at, (c.commenter_user_id = v_viewer) as is_mine
    from public.champion_journal_comments c
    left join public.profiles p on p.user_id = c.commenter_user_id
   where c.entry_id = p_entry_id
   order by c.created_at asc;
end $$;

-- ── 13. 권한 ──
revoke all on function public._community_is_staff(uuid) from public, anon;
revoke all on function public._community_branch_of(uuid) from public, anon;
revoke all on function public._community_display_name(uuid) from public, anon;
revoke all on function public.community_can_view_entry(uuid, uuid) from public, anon;
grant execute on function public.community_can_view_entry(uuid, uuid) to authenticated;
grant execute on function public.set_journal_entry_options(uuid, text, text) to authenticated;
grant execute on function public.get_community_feed(integer) to authenticated;
grant execute on function public.toggle_community_153(text, uuid) to authenticated;
grant execute on function public.post_weekly_goal(text) to authenticated;
grant execute on function public.hide_community_entry(uuid) to authenticated;
grant execute on function public.report_community_entry(uuid, text) to authenticated;
grant execute on function public.set_community_auto_post(boolean) to authenticated;
grant execute on function public.get_weekly_153_king(text, integer) to anon, authenticated;

-- ── 14. 사진 저장소 (공개 · 본인 폴더에만 올리기) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$ begin
  create policy "Community photos upload own folder" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Community photos delete own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Community photos are public" on storage.objects
    for select using (bucket_id = 'community');
exception when duplicate_object then null; end $$;
