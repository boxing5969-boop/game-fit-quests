-- 코치님도 하트 (2026-10-27 대표님: "코치님들도 하트 줄수있게 해주세요!")
--
-- 무엇이 막혔나: 하트를 보내는 사람은 '지점 회원'(_is_rankable_member) 이거나 본사(전체관리자·관리자)여야 했다.
--   코치 · 지점장 계정(is_staff · coach · branch_manager — _dm_kind = 'coach')은 지점 회원 판정에서 빠지므로
--   카드에서 like_reason 'not_member'("지점 회원만 하트를 보낼 수 있어요") → 하트 버튼이 잠겼고, 보내도 세지 않았다.
-- 고친 것: 코치 · 지점장도 **같은 지점** 회원에게 하트를 보낸다 · 그 하트는 받은 하트로 센다(본사 하트처럼).
--   · 받는 사람 규칙은 본사와 같다 — 지점 회원 또는 승인된 지점 회원(_is_hq_heart_target, 칠금점처럼 출석 연결이 없는 지점의 새 회원).
--   · 코치 · 운영진 카드는 그대로 하트를 받지 않는다(target_staff — 2026-10-18).
--   · 처음 받은 아이디 · 비밀번호 그대로인 계정은 회원과 똑같이 바꾼 뒤에 보낸다(change_credentials).
--   · 체험용 계정 · 지점 없는 계정 · 승인 안 된 계정은 뺀다.
-- 기준: DB 의 지금 정의(pg_get_functiondef, 2026-10-27 12:3x KST) 위에 고쳤다. 고친 줄에는 (2026-10-27) 표시.

-- 1) 하트를 보낼 수 있는 지도진 (새 함수) — 코치 · 지점장 · 지점 있음 · 체험용 아님 · 승인됨(또는 지도진 권한)
--    security invoker: 하트 함수(security definer) 안에서만 쓴다 — _dm_kind 는 바깥(authenticated)에서 못 부른다.
create or replace function public._is_heart_coach(p_user uuid)
 returns boolean
 language sql
 stable security invoker
 set search_path to 'public', 'pg_temp'
as $function$
  -- 하트를 보낼 수 있는 지도진 (2026-10-27 대표님 "코치님들도 하트 줄수있게") — 코치 · 지점장, 같은 지점 회원에게만.
  -- 본사(전체관리자 · 관리자)는 _dm_kind 가 'hq' 라 여기 들지 않는다(본사는 따로 전 지점).
  select coalesce(public._dm_kind(p_user) = 'coach', false)
     and public._is_active_member(p_user)
     and exists (select 1 from public.profiles p
                  where p.user_id = p_user
                    and coalesce(p.branch_name, '') <> ''
                    and not coalesce(p.is_test_account, false));
$function$;

revoke all on function public._is_heart_coach(uuid) from public, anon, authenticated;
grant execute on function public._is_heart_coach(uuid) to service_role;

-- 2) 하트 누르기 — 코치 · 지점장도 같은 지점 회원에게
create or replace function public.toggle_nickname_like(_target uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_t public.profiles%rowtype;
  v_admin boolean;
  v_coach boolean;
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
    -- 코치 · 지점장 (2026-10-27) — 같은 지점 회원에게만
    v_coach := not v_admin and public._is_heart_coach(v_uid);
    if not v_admin then
      -- 회원 · 코치는 같은 지점 회원에게만 (본사는 전 지점)
      if coalesce(v_me.branch_name, '') = '' or v_me.branch_name is distinct from v_t.branch_name then
        raise exception '같은 지점 회원에게만 하트를 보낼 수 있어요';
      end if;
      if not v_coach and not public._is_rankable_member(v_uid) then
        raise exception '지점 회원만 하트를 보낼 수 있어요';
      end if;
      if coalesce(v_me.must_change_credentials, false) then
        raise exception '처음 받은 아이디·비밀번호를 바꾼 뒤에 하트를 보낼 수 있어요';
      end if;
    end if;
    -- 받는 사람: 실제 지점 회원이면 누구나 (닉네임을 안 정해도 된다 — 2026-09-30)
    --   본사 · 코치 하트는 승인된 지점 회원이면 지점 회원 판정과 상관없이 (2026-10-25 — 칠금점 새 회원 · 2026-10-27 코치)
    if not (public._is_rankable_member(_target) or ((v_admin or v_coach) and public._is_hq_heart_target(_target))) then
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
$function$;

-- 3) 센 하트 — 코치 · 지점장이 같은 지점 회원에게 보낸 하트도 센다
create or replace function public._counted_nickname_likes(p_until timestamp with time zone default null::timestamp with time zone)
 returns table(liker_id uuid, target_id uuid, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select l.liker_id, l.target_id, l.created_at
    from public.nickname_likes l
    join public.profiles t  on t.user_id  = l.target_id
    join public.profiles lk on lk.user_id = l.liker_id
   where coalesce(t.branch_name, '') <> ''
     and l.created_at <= now()
     and (p_until is null or l.created_at < p_until)
     and (public._is_rankable_member(l.target_id)
          -- 본사 하트는 승인된 지점 회원이면 받은 하트로 센다 (2026-10-25 — 칠금점처럼 출석 연결이 없는 지점의 새 회원)
          or ((public.has_role(l.liker_id, 'super_admin') or public.has_role(l.liker_id, 'admin'))
              and public._is_hq_heart_target(l.target_id))
          -- 코치 · 지점장 하트도 같은 지점의 승인된 회원이면 센다 (2026-10-27)
          or (lk.branch_name = t.branch_name
              and public._is_heart_coach(l.liker_id)
              and public._is_hq_heart_target(l.target_id)))
     and (
       -- 회원이 보낸 하트: 같은 지점 · 아이디·비밀번호를 바꾼 실제 지점 회원
       (    l.branch_name  = t.branch_name
        and lk.branch_name = t.branch_name
        and coalesce(lk.must_change_credentials, false) = false
        and public._is_rankable_member(l.liker_id))
       -- 코치 · 지점장이 보낸 하트: 같은 지점 · 아이디·비밀번호를 바꾼 지도진 (2026-10-27)
       or (    l.branch_name  = t.branch_name
           and lk.branch_name = t.branch_name
           and coalesce(lk.must_change_credentials, false) = false
           and public._is_heart_coach(l.liker_id))
       -- 본사(전체관리자·관리자)가 보낸 하트: 지점과 상관없이 센다 (2026-09-30)
       or public.has_role(l.liker_id, 'super_admin')
       or public.has_role(l.liker_id, 'admin')
     );
$function$;

-- 4) 라이센스 카드 — 코치 · 지점장이 보면 같은 지점 회원은 하트 가능
create or replace function public.get_member_license(p_user uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_t public.profiles%rowtype;
  v_mp public.member_progress%rowtype;
  v_admin boolean;
  v_coach boolean;
  v_has_nick boolean;
  v_parts jsonb;
  v_likes integer;
  v_reason text;
  v_staff text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(auth.uid()) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  if p_user is null then raise exception '회원을 찾을 수 없어요'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  select * into v_t from public.profiles where user_id = p_user;
  if v_t.user_id is null then raise exception '회원을 찾을 수 없어요'; end if;
  v_admin := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  -- 코치 · 지점장 (2026-10-27) — 같은 지점 회원에게 하트
  v_coach := not v_admin and public._is_heart_coach(v_uid);

  if p_user <> v_uid then
    if not v_admin and (coalesce(v_me.branch_name, '') = '' or v_me.branch_name is distinct from v_t.branch_name) then
      raise exception '같은 지점 회원의 라이센스만 볼 수 있어요';
    end if;
    -- 체험용(테스트) 계정만 막는다 — 코치·지점장·운영진은 카드가 열리고 표시가 붙는다 (2026-10-18)
    if coalesce(v_t.is_test_account, false) then
      raise exception '라이센스를 볼 수 없는 계정이에요';
    end if;
  end if;

  v_staff := case
    when exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role in ('super_admin', 'admin')) then 'admin'
    when exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'branch_manager') then 'branch_manager'
    when coalesce(v_t.is_staff, false)
      or exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'coach') then 'coach'
    else null
  end;

  select * into v_mp from public.member_progress where user_id = p_user;
  v_has_nick := nullif(btrim(v_t.nickname), '') is not null and btrim(v_t.nickname) <> btrim(coalesce(v_t.name, ''));
  select cp.parts_json into v_parts
    from public.member_character_assignments a
    join public.character_presets cp on cp.id = a.preset_id
   where a.user_id = p_user and a.is_active
   order by a.updated_at desc nulls last
   limit 1;
  select count(*)::int into v_likes from public._counted_nickname_likes(null) c where c.target_id = p_user;

  -- 하트를 못 누르는 이유 (닉네임 조건은 2026-09-30 삭제 · 운영진 계정은 하트를 받지 않는다 2026-10-18)
  --   본사가 보면 승인된 지점 회원은 지점 회원 판정과 상관없이 하트 가능 (2026-10-25)
  --   코치 · 지점장도 같은 지점 회원에게 하트 — 받는 사람 규칙은 본사와 같다 (2026-10-27)
  v_reason := case
    when p_user = v_uid then 'self'
    when v_staff is not null then 'target_staff'
    when not public._is_rankable_member(p_user)
         and not ((v_admin or v_coach) and public._is_hq_heart_target(p_user)) then 'target_not_member'
    when v_admin then null
    when not v_coach and not public._is_rankable_member(v_uid) then 'not_member'
    when coalesce(v_me.must_change_credentials, false) then 'change_credentials'
    else null
  end;

  return jsonb_build_object(
    'user_id', p_user,
    'display', coalesce(nullif(btrim(v_t.nickname), ''), nullif(btrim(v_t.name), ''), '익명 복서'),
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
    'like_reason', v_reason,
    'staff_role', v_staff,
    'staff_title', case when v_staff is not null then nullif(btrim(v_t.staff_title), '') end
  );
end;
$function$;

-- 5) 추천 복서 목록(닉네임 좋아요) — 코치 · 지점장은 같은 지점 회원 목록에서 하트 가능
create or replace function public.get_branch_nicknames(p_search text default null::text, p_limit integer default 60)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  elsif not public._is_rankable_member(v_uid) and not public._is_heart_coach(v_uid) then
    -- 코치 · 지점장은 같은 지점 회원에게 하트 (2026-10-27)
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
           coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서') as display,
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
     where (v_all or p.branch_name = v_me.branch_name) and public.is_branch_visible(p.branch_name)
       and p.user_id <> v_uid
       and (v_pat is null or coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '') ilike v_pat escape '\')
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
$function$;
