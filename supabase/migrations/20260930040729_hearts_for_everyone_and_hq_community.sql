-- 2026-09-30 대표님: "모든 회원님들이 모든 회원님들에게 하트 1개씩" · "랭킹에서 하트를 눌러도 1이 안 올라가" · "본사는 모든 회원이 다 보이게".
--
-- 1) 하트(= 닉네임 좋아요) — 닉네임을 정하지 않은 회원도 하트를 받는다 (랭킹과 같은 이름으로 보인다).
--    · 회원: 같은 지점 회원 한 명마다 하트 1개 (다시 누르면 취소). 보내는 쪽 자격은 그대로 —
--      처음 받은 아이디·비밀번호를 바꾼 실제 지점 회원 (남의 전화번호로 몰아주기 방지). 지도진·체험 계정은 보내지도 받지도 않는다.
--    · 본사(전체관리자·관리자): 전 지점 회원 한 명마다 1개. 이제 점수에도 들어간다 — 누르면 바로 +1.
--    · 받은 하트 수 = 닉네임 좋아요왕 점수 (_counted_nickname_likes 한 곳에서 센다).
-- 2) 153 커뮤니티 — 본사 계정은 전 지점 회원·소식을 본다.
--    · 세컨드 응원 후보: 이름 검색을 서버에서 (지점 동료가 30명을 넘어도 찾을 수 있게), 최근 출석한 동료 먼저.
--      지도진·체험·관리자 계정은 뺀다 (화면 안내문과 같게).
--    · 타이틀매치 소식 · 오늘 파트너 구하기 · 장비 나눔: 본사는 전 지점 글 + 지점 이름 (all_branches).

-- ── 1-1. 하트 세기 (점수 단일 출처) ─────────────────────────────────────
create or replace function public._counted_nickname_likes(p_until timestamptz default null)
returns table(liker_id uuid, target_id uuid, created_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select l.liker_id, l.target_id, l.created_at
    from public.nickname_likes l
    join public.profiles t  on t.user_id  = l.target_id
    join public.profiles lk on lk.user_id = l.liker_id
   where coalesce(t.branch_name, '') <> ''
     and l.created_at <= now()
     and (p_until is null or l.created_at < p_until)
     and public._is_rankable_member(l.target_id)
     and (
       -- 회원이 보낸 하트: 같은 지점 · 아이디·비밀번호를 바꾼 실제 지점 회원
       (    l.branch_name  = t.branch_name
        and lk.branch_name = t.branch_name
        and coalesce(lk.must_change_credentials, false) = false
        and public._is_rankable_member(l.liker_id))
       -- 본사(전체관리자·관리자)가 보낸 하트: 지점과 상관없이 센다 (2026-09-30)
       or public.has_role(l.liker_id, 'super_admin')
       or public.has_role(l.liker_id, 'admin')
     );
$$;

-- ── 1-2. 하트 누르기 ────────────────────────────────────────────────
create or replace function public.toggle_nickname_like(_target uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_t public.profiles%rowtype;
  v_admin boolean;
  v_deleted integer;
  v_liked boolean;
  v_likes integer;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if _target is null or _target = v_uid then raise exception '내 라이센스에는 하트를 보낼 수 없어요'; end if;

  -- 원자적 토글: 먼저 지우고, 지운 게 없을 때만 넣는다. 취소는 자격과 상관없이 언제나 된다.
  delete from public.nickname_likes where liker_id = v_uid and target_id = _target;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    v_liked := false;
  else
    select * into v_me from public.profiles where user_id = v_uid;
    select * into v_t from public.profiles where user_id = _target;
    if v_t.user_id is null then raise exception '회원을 찾을 수 없습니다'; end if;
    v_admin := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
    if not v_admin then
      -- 회원은 같은 지점 회원에게만 (본사는 전 지점)
      if coalesce(v_me.branch_name, '') = '' or v_me.branch_name is distinct from v_t.branch_name then
        raise exception '같은 지점 회원에게만 하트를 보낼 수 있어요';
      end if;
      if not public._is_rankable_member(v_uid) then
        raise exception '지점 회원만 하트를 보낼 수 있어요';
      end if;
      if coalesce(v_me.must_change_credentials, false) then
        raise exception '처음 받은 아이디·비밀번호를 바꾼 뒤에 하트를 보낼 수 있어요';
      end if;
    end if;
    -- 받는 사람: 실제 지점 회원이면 누구나 (닉네임을 안 정해도 된다 — 2026-09-30)
    if not public._is_rankable_member(_target) then
      raise exception '지점 회원에게만 하트를 보낼 수 있어요';
    end if;
    insert into public.nickname_likes (liker_id, target_id, branch_name)
    values (v_uid, _target, coalesce(nullif(v_me.branch_name, ''), '본사'))
    on conflict (liker_id, target_id) do nothing;
    v_liked := true;
  end if;

  select count(*)::int into v_likes from public._counted_nickname_likes(null) c where c.target_id = _target;

  -- likes_month · likes_total 은 이전 화면 호환용 (값은 likes 와 같다)
  return jsonb_build_object('liked', v_liked, 'likes', v_likes, 'likes_month', v_likes, 'likes_total', v_likes);
end;
$$;

-- ── 1-3. 라이센스 한 장 ─────────────────────────────────────────────
create or replace function public.get_member_license(p_user uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_t public.profiles%rowtype;
  v_mp public.member_progress%rowtype;
  v_admin boolean;
  v_has_nick boolean;
  v_parts jsonb;
  v_likes integer;
  v_reason text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_user is null then raise exception '회원을 찾을 수 없어요'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  select * into v_t from public.profiles where user_id = p_user;
  if v_t.user_id is null then raise exception '회원을 찾을 수 없어요'; end if;
  v_admin := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');

  if p_user <> v_uid then
    if not v_admin and (coalesce(v_me.branch_name, '') = '' or v_me.branch_name is distinct from v_t.branch_name) then
      raise exception '같은 지점 회원의 라이센스만 볼 수 있어요';
    end if;
    -- 랭킹과 같은 기준: 지도진·체험용·관리자 역할 계정은 라이센스 대상이 아니다
    if coalesce(v_t.is_staff, false) or coalesce(v_t.is_test_account, false)
       or exists (select 1 from public.user_roles ur
                   where ur.user_id = p_user and ur.role in ('super_admin', 'admin', 'branch_manager')) then
      raise exception '라이센스를 볼 수 없는 계정이에요';
    end if;
  end if;

  select * into v_mp from public.member_progress where user_id = p_user;
  v_has_nick := nullif(btrim(v_t.nickname), '') is not null and btrim(v_t.nickname) <> btrim(coalesce(v_t.name, ''));
  select cp.parts_json into v_parts
    from public.member_character_assignments a
    join public.character_presets cp on cp.id = a.preset_id
   where a.user_id = p_user and a.is_active
   order by a.updated_at desc nulls last
   limit 1;
  select count(*)::int into v_likes from public._counted_nickname_likes(null) c where c.target_id = p_user;

  -- 하트를 못 누르는 이유 (닉네임 조건은 2026-09-30 삭제 · 본사 하트는 이제 점수에 들어가므로 체험 표시도 없다)
  v_reason := case
    when p_user = v_uid then 'self'
    when not public._is_rankable_member(p_user) then 'target_not_member'
    when v_admin then null
    when not public._is_rankable_member(v_uid) then 'not_member'
    when coalesce(v_me.must_change_credentials, false) then 'change_credentials'
    else null
  end;

  return jsonb_build_object(
    'user_id', p_user,
    'display', coalesce(nullif(btrim(v_t.nickname), ''), '익명' || substr(p_user::text, 1, 6)),
    'has_nickname', v_has_nick,
    'branch', v_t.branch_name,
    'rank', coalesce(v_mp.current_rank::text, 'white'),
    'level', coalesce(v_mp.current_level, 1),
    'bosses_cleared', coalesce(v_mp.bosses_cleared, 0),
    'streak_days', coalesce(v_mp.streak_days, 0),
    'master_track_unlocked', coalesce(v_mp.master_track_unlocked, false),
    'master_level', coalesce(v_mp.master_level, 0),
    'overall_level', v_mp.overall_level,
    'avatar_url', v_t.avatar_url,
    'parts_json', v_parts,
    'issued_at', v_t.created_at,
    'pt', public.is_pt_active(p_user),
    'likes', v_likes,
    'liked_by_me', exists (select 1 from public.nickname_likes l where l.liker_id = v_uid and l.target_id = p_user),
    'is_me', p_user = v_uid,
    'can_like', v_reason is null,
    'like_reason', v_reason
  );
end;
$$;

-- ── 1-4. 추천 복서 목록 ─────────────────────────────────────────────
create or replace function public.get_branch_nicknames(p_search text default null, p_limit integer default 60)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_q text := left(nullif(btrim(coalesce(p_search, '')), ''), 30);
  v_pat text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 200));
  v_rows jsonb;
  v_can_like boolean;
  v_reason text;
  v_all boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  -- 전체관리자·관리자(대표님 153본사 계정 등)는 지점과 상관없이 전 지점 회원을 본다 (2026-09-29 대표님)
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if not v_all and coalesce(v_me.branch_name, '') = '' then
    return jsonb_build_object('branch', null, 'rows', '[]'::jsonb, 'my_given', 0, 'can_like', false, 'reason', 'no_branch', 'all_branches', false);
  end if;

  if v_all then
    v_can_like := true;  v_reason := null;   -- 본사 하트도 점수에 들어간다 (2026-09-30)
  elsif not public._is_rankable_member(v_uid) then
    v_can_like := false; v_reason := 'not_member';
  elsif coalesce(v_me.must_change_credentials, false) then
    v_can_like := false; v_reason := 'change_credentials';
  else
    v_can_like := true;  v_reason := null;
  end if;

  -- 검색은 보이는 이름(닉네임)만 — 실명 검색으로 별명 주인을 역추적하지 못하게. % _ \ 는 글자 그대로 찾는다.
  v_pat := case when v_q is null then null
                else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with counted as (
    select c.target_id, count(*)::int as n
      from public._counted_nickname_likes(null) c
     group by c.target_id
  ), cand as (
    -- 지점 회원이면 누구나 (닉네임을 안 정한 회원도 — 2026-09-30). 하트 많은 순 → 최근 출석 순.
    select p.user_id,
           coalesce(nullif(btrim(p.nickname), ''), '익명' || substr(p.user_id::text, 1, 6)) as display,
           (nullif(btrim(p.nickname), '') is not null and btrim(p.nickname) <> btrim(coalesce(p.name, ''))) as has_nick,
           p.branch_name as branch,
           mp.current_rank::text as rank,
           mp.current_level as level,
           coalesce(cn.n, 0) as likes,
           la.last_at,
           exists (select 1 from public.nickname_likes l where l.target_id = p.user_id and l.liker_id = v_uid) as liked_by_me
      from public.profiles p
      left join counted cn on cn.target_id = p.user_id
      left join public.member_progress mp on mp.user_id = p.user_id
      left join lateral (
        select max(a.checked_in_at) as last_at from public.attendance_logs a where a.user_id = p.user_id
      ) la on true
     where (v_all or p.branch_name = v_me.branch_name)
       and p.user_id <> v_uid
       and (v_pat is null or p.nickname ilike v_pat escape '\')
       and public._is_rankable_member(p.user_id)
     order by likes desc, la.last_at desc nulls last, display asc
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id, 'display', c.display, 'has_nickname', c.has_nick,
           'likes', c.likes, 'likes_month', c.likes, 'liked_by_me', c.liked_by_me,
           'branch', c.branch, 'rank', c.rank, 'level', c.level)
         order by c.likes desc, c.last_at desc nulls last, c.display asc), '[]'::jsonb)
    into v_rows
    from cand c;

  return jsonb_build_object(
    'branch', v_me.branch_name,
    'rows', v_rows,
    'my_given', (select count(*) from public.nickname_likes l where l.liker_id = v_uid),
    'can_like', v_can_like,
    'reason', v_reason,
    'all_branches', v_all
  );
end;
$$;

-- ── 2-1. 세컨드 응원 후보 — 서버 검색 + 본사 전 지점 ─────────────────────
drop function if exists public.get_second_cheer_candidates(integer);
create function public.get_second_cheer_candidates(p_limit integer default 30, p_search text default null)
returns table(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_q text := left(nullif(btrim(coalesce(p_search, '')), ''), 30);
  v_pat text;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid limit 1;
  -- 본사(전체관리자·관리자)는 전 지점 회원을 본다 (2026-09-30 대표님)
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if not v_all and (v_branch is null or length(v_branch) = 0) then
    return;
  end if;

  -- 보이는 이름으로만 찾는다 (닉네임을 정한 회원은 실명으로 역추적되지 않게)
  v_pat := case when v_q is null then null
                else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  return query
  select p.user_id,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')::text as display_name,
         p.branch_name::text,
         mp.current_rank::text,
         mp.current_level
    from public.profiles p
    left join public.member_progress mp on mp.user_id = p.user_id
    left join lateral (
      select max(a.checked_in_at) as last_at from public.attendance_logs a where a.user_id = p.user_id
    ) la on true
   where (v_all or p.branch_name = v_branch)
     and p.user_id <> v_uid
     -- 코치·지점장·관리자·체험 계정은 뺀다 (화면 안내문 "코치·관리자 계정은 제외"와 같게)
     and coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)
     and exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role = 'member')
     and not exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role <> 'member')
     and (v_pat is null
          or coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '') ilike v_pat escape '\')
   -- 최근 출석한 동료 먼저 ("오늘 링에 오른 동료에게 박수")
   order by la.last_at desc nulls last, coalesce(mp.current_level, 0) desc, p.created_at asc
   limit v_limit;
end;
$$;
revoke all on function public.get_second_cheer_candidates(integer, text) from public, anon;
grant execute on function public.get_second_cheer_candidates(integer, text) to authenticated, service_role;

-- ── 2-2. 타이틀매치 소식 — 본사 전 지점 ─────────────────────────────────
create or replace function public.get_titlematch_feed(p_limit integer default 20)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_limit int := greatest(1, least(coalesce(p_limit,20), 50));
  v_rows jsonb;
  v_order text[] := array['white','blue','red','black'];
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t->>'at' desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
               'id', h.id,
               'userId', h.user_id,
               'nickname', p.nickname,
               'branch', p.branch_name,
               'isMine', h.user_id = v_uid,
               'rank', h.rank_name::text,
               'globalLevel', (coalesce(array_position(v_order, h.rank_name::text), 1) - 1) * 10 + h.level_number,
               'at', h.created_at,
               'claps', (
                 select count(*) from public.boxing_cheers ch
                  where ch.source_type = 'titlematch_feed' and ch.source_id = h.id
               ),
               'clapped', exists (
                 select 1 from public.boxing_cheers ch
                  where ch.source_type = 'titlematch_feed' and ch.source_id = h.id
                    and ch.sender_user_id = v_uid
               )
             ) as t
        from public.level_status_history h
        join public.profiles p on p.user_id = h.user_id
       where h.new_status = 'boss_cleared'
         and h.created_at >= now() - interval '30 days'
         and (v_all or p.branch_name = v_branch)
         and coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)
       order by h.created_at desc
       limit v_limit
    ) s;

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', v_all, 'items', v_rows);
end;
$$;

-- ── 2-3. 오늘 파트너 구하기 — 본사 전 지점 (참여는 서버가 같은 지점만 허용) ─────────
create or replace function public.get_partner_calls()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_calls jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'calls', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'nickname', p.nickname,
           'branch', c.branch_name,
           'isMine', c.user_id = v_uid,
           'slotHour', c.slot_hour,
           'purpose', c.purpose,
           'note', c.note,
           'rank', coalesce(mp.current_rank::text, 'white'),
           'joinCount', coalesce(j.cnt, 0),
           'joined', exists (
             select 1 from public.boxing_partner_call_joins x
             where x.call_id = c.id and x.user_id = v_uid
           )
         ) order by c.slot_hour, c.created_at), '[]'::jsonb)
    into v_calls
    from public.boxing_partner_calls c
    join public.profiles p on p.user_id = c.user_id
    left join public.member_progress mp on mp.user_id = c.user_id
    left join (
      select call_id, count(*)::int as cnt
      from public.boxing_partner_call_joins group by call_id
    ) j on j.call_id = c.id
   where (v_all or c.branch_name = v_branch)
     and c.call_date = v_today
     and c.status = 'open';

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', v_all, 'calls', v_calls);
end;
$$;

-- ── 2-4. 장비 나눔 — 본사 전 지점 ─────────────────────────────────────
create or replace function public.get_gear_posts(p_limit integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_limit int := greatest(1, least(coalesce(p_limit,30), 100));
  v_posts jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'posts', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t->>'createdAt' desc), '[]'::jsonb)
    into v_posts
    from (
      select jsonb_build_object(
               'id', g.id,
               'nickname', p.nickname,
               'branch', g.branch_name,
               'isMine', g.user_id = v_uid,
               'kind', g.kind,
               'size', g.gear_size,
               'condition', g.gear_condition,
               'deal', g.deal,
               'note', g.note,
               'createdAt', g.created_at
             ) as t
        from public.boxing_gear_posts g
        join public.profiles p on p.user_id = g.user_id
       where (v_all or g.branch_name = v_branch) and g.status = 'open'
       order by g.created_at desc
       limit v_limit
    ) s;

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', v_all, 'posts', v_posts);
end;
$$;