-- 새 식구 환영 인사 · 회원 화면으로 보기 (2026-10-18 대표님)
--   1) "새식구가 가입하면 환영하는 문화를 만들자. 환영합니다라는 댓글을 남길수있도록"
--      → 새 식구(첫 출석) 카드에 환영 한마디. 같은 지점 회원(전체관리자는 어디든), 한 사람 한 번(다시 쓰면 고쳐짐),
--        첫 출석 뒤 7일까지. 새 식구에게 알림(휴대폰은 하루 3번째까지 — 응원과 같은 규칙). 금지어는 응원과 같은 거름망.
--   2) "회원님들에게는 어떻게 보이나?" → 전체관리자가 지점을 골라 '그 지점 일반 회원'이 보는 피드를 그대로 본다
--      (get_community_feed_member_view — 전체 공개 글 · 이번 주 목표 · 승급 · 오늘도 한 판 · 새 식구. 친구만·나만 보기·숨긴 글은 빠짐)
--   3) 장비 나눔 글쓴이 이름 — 닉네임이 없으면 이름 (예전엔 빈칸)

-- 1) 환영 인사
create table if not exists public.community_welcomes (
  id uuid primary key default gen_random_uuid(),
  newbie_user_id uuid not null references auth.users (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (newbie_user_id, sender_user_id)
);
create index if not exists community_welcomes_newbie_idx on public.community_welcomes (newbie_user_id, created_at);
alter table public.community_welcomes enable row level security; -- RPC 로만

-- 첫 출석 날 (KST) — 중복 출석은 빼고
create or replace function public._first_attendance_date(p_uid uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select min((a.checked_in_at at time zone 'Asia/Seoul')::date)
    from public.attendance_logs a
   where a.user_id = p_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at <= now();
$$;
revoke all on function public._first_attendance_date(uuid) from public, anon;

create or replace function public.send_community_welcome(p_newbie uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text := btrim(regexp_replace(coalesce(p_message, ''), '\s+', ' ', 'g'));
  v_first date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_new boolean;
  v_name text;
  v_today_cnt int;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_newbie is null or p_newbie = v_uid then raise exception '다른 회원에게 남겨 주세요'; end if;
  if char_length(v_msg) < 1 then raise exception '환영 한마디를 적어 주세요'; end if;
  if char_length(v_msg) > 100 then raise exception '100자 이하로 적어 주세요'; end if;
  if public._cheer_has_bad_word(v_msg) then raise exception '쓸 수 없는 말이 있어요. 따뜻한 말로 바꿔 주세요'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq'
     and coalesce(public._community_branch_of(v_uid) is distinct from public._community_branch_of(p_newbie), true) then
    raise exception '같은 지점 새 식구에게 남길 수 있어요';
  end if;
  v_first := public._first_attendance_date(p_newbie);
  if v_first is null or v_first < v_today - 6 then
    raise exception '첫 출석 뒤 일주일 동안 환영 인사를 남길 수 있어요';
  end if;

  insert into public.community_welcomes (newbie_user_id, sender_user_id, message)
  values (p_newbie, v_uid, v_msg)
  on conflict (newbie_user_id, sender_user_id) do update set message = excluded.message
  returning (xmax = 0) into v_new;

  if v_new then
    v_name := coalesce(public._community_display_name(v_uid), '동료');
    select count(*) into v_today_cnt
      from public.notifications n
     where n.user_id = p_newbie and n.title like '%환영 인사%'
       and n.created_at >= (v_today::timestamp at time zone 'Asia/Seoul');
    insert into public.notifications (user_id, title, body, link, pushed_at)
    values (p_newbie, '🌱 ' || v_name || '님이 환영 인사를 남겼어요', '“' || v_msg || '”', '/myboxer/community',
            -- 휴대폰 알림은 하루 3번째까지 (나머지는 알림함에만)
            case when v_today_cnt >= 3 then now() else null end);
  end if;

  return jsonb_build_object('success', true, 'new', v_new,
    'count', (select count(*) from public.community_welcomes w where w.newbie_user_id = p_newbie));
end $$;

create or replace function public.get_community_welcomes(p_newbie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_newbie is null then return jsonb_build_object('items', '[]'::jsonb); end if;
  if v_uid <> p_newbie and public._dm_kind(v_uid) is distinct from 'hq'
     and coalesce(public._community_branch_of(v_uid) is distinct from public._community_branch_of(p_newbie), true) then
    raise exception '같은 지점 회원만 볼 수 있어요';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id,
           'senderId', w.sender_user_id,
           'name', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
           'avatarUrl', p.avatar_url,
           'isStaff', coalesce(p.is_staff, false),
           'message', w.message,
           'at', w.created_at,
           'isMine', w.sender_user_id = v_uid
         ) order by w.created_at), '[]'::jsonb)
    into v_out
    from public.community_welcomes w
    left join public.profiles p on p.user_id = w.sender_user_id
   where w.newbie_user_id = p_newbie;
  return jsonb_build_object('items', v_out);
end $$;

revoke all on function public.send_community_welcome(uuid, text) from public, anon;
grant execute on function public.send_community_welcome(uuid, text) to authenticated;
revoke all on function public.get_community_welcomes(uuid) from public, anon;
grant execute on function public.get_community_welcomes(uuid) to authenticated;

-- 피드 새 식구 카드에 환영 수 · 내가 남겼는지 (지금 함수에서 그 줄만 바꾼다)
do $$
declare
  d text;
  v_old text := E'\n         ) order by r.pinned desc, r.pin_order, r.at desc), ''[]''::jsonb)';
begin
  d := pg_get_functiondef('public.get_community_feed(integer)'::regprocedure);
  if position('welcomedByMe' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_community_feed 에서 바꿀 줄이 하나가 아님';
  end if;
  d := replace(d, v_old,
    E',\n           ''welcomes'', case when r.newbie then (select count(*) from public.community_welcomes w where w.newbie_user_id = r.user_id) else 0 end,'
    || E'\n           ''welcomedByMe'', r.newbie and exists (select 1 from public.community_welcomes w where w.newbie_user_id = r.user_id and w.sender_user_id = v_uid)'
    || v_old);
  execute d;
end $$;

-- 2) 회원 화면으로 보기 — 전체관리자만. 고른 지점의 '짝꿍·친구가 없는 일반 회원'이 보는 피드
create or replace function public.get_community_feed_member_view(p_branch text, p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 80));
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_items jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '전체관리자만 볼 수 있어요'; end if;
  if v_branch is null then
    return jsonb_build_object('success', true, 'branch', null, 'all_branches', false, 'member_view', true,
                              'is_staff', false, 'items', '[]'::jsonb);
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
       and e.hidden_at is null and e.visibility = 'branch' and p.branch_name = v_branch
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
           'branch', p.branch_name,
           'hidden', false,
           'comments', case when r.type in ('journal', 'goal')
                            then (select count(*) from public.champion_journal_comments c where c.entry_id = r.id) else 0 end,
           'count153', (select count(*) from public.community_reactions x
                         where x.target_type = case when r.type = 'goal' then 'journal' else r.type end and x.target_id = r.id),
           'reacted', exists (select 1 from public.community_reactions x
                               where x.target_type = case when r.type = 'goal' then 'journal' else r.type end
                                 and x.target_id = r.id and x.user_id = v_uid),
           'welcomes', case when r.newbie then (select count(*) from public.community_welcomes w where w.newbie_user_id = r.user_id) else 0 end,
           'welcomedByMe', r.newbie and exists (select 1 from public.community_welcomes w where w.newbie_user_id = r.user_id and w.sender_user_id = v_uid)
         ) order by r.pinned desc, r.pin_order, r.at desc), '[]'::jsonb)
    into v_items
    from ranked r
    left join public.profiles p on p.user_id = r.user_id
    left join public.member_progress mp on mp.user_id = r.user_id;

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', false, 'member_view', true,
                            'is_staff', false, 'items', v_items);
end $$;
revoke all on function public.get_community_feed_member_view(text, integer) from public, anon;
grant execute on function public.get_community_feed_member_view(text, integer) to authenticated;

-- 3) 장비 나눔 글쓴이 이름 — 닉네임이 없으면 이름
do $$
declare
  d text;
  v_old text := '''nickname'', p.nickname,';
begin
  d := pg_get_functiondef('public.get_gear_posts(integer)'::regprocedure);
  if position('nullif(btrim(p.nickname)' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_gear_posts 에서 바꿀 줄이 하나가 아님';
  end if;
  execute replace(d, v_old, '''nickname'', coalesce(nullif(btrim(p.nickname), ''''), nullif(btrim(p.name), ''''), ''회원''),');
end $$;
