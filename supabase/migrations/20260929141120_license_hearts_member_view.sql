-- 라이센스 하트 · 다른 회원 라이센스 보기 · 대표님 계정 전 지점 보기 (2026-09-29 대표님).
-- "회원님들이 라이센스에 좋아요 하트를 누를 수 있게 · 킹즈오브아너처럼 다른 분들 추천 아이디가 보이고
--  아이디를 누르면 상대방 정보를 볼 수 있게 · 마스터 계정(153본사 내 계정)은 지점 상관없이 모두 볼 수 있게"
--
-- 하트는 기존 '닉네임 좋아요'(nickname_likes, 한 사람에게 하나 · 닉네임 좋아요왕 점수)와 같은 하트다(대표님 선택).
--   1) get_member_license(p_user) — 라이센스 카드 한 장에 필요한 공개 정보만 (실명·전화번호 없음).
--      본인은 언제나, 회원은 같은 지점의 랭킹 대상 회원만, 전체관리자·관리자는 전 지점.
--      이름은 랭킹과 같은 규칙(닉네임, 비었으면 '익명xxxxxx') — 랭킹보다 더 드러내지 않는다.
--   2) get_branch_nicknames — 전체관리자·관리자는 전 지점 회원 목록(행마다 지점·리그·레벨).
--      회원에게는 예전과 같이 같은 지점만. 행에 리그·레벨을 더해 목록에서도 누군지 알아보게 한다.
--   3) toggle_nickname_like — 전체관리자·관리자는 다른 지점 회원에게도 체험용 하트를 누를 수 있다
--      (점수에는 안 들어간다 — _counted_nickname_likes 가 관리자 하트·다른 지점 하트를 뺀다). 회원 규칙은 그대로.

-- 1) 라이센스 카드 한 장
create or replace function public.get_member_license(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
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
    if not public._is_rankable_member(p_user) then
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

  v_reason := case
    when p_user = v_uid then 'self'
    when not v_has_nick then 'target_no_nickname'
    when v_admin then 'admin_test'
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
    'can_like', v_reason is null or v_reason = 'admin_test',
    'like_reason', v_reason
  );
end;
$$;
revoke all on function public.get_member_license(uuid) from public, anon;
grant execute on function public.get_member_license(uuid) to authenticated;

-- 2) 추천 복서 목록 — 관리자는 전 지점, 행마다 지점·리그·레벨
create or replace function public.get_branch_nicknames(p_search text default null, p_limit integer default 60)
returns jsonb
language plpgsql
stable
security definer
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
    v_can_like := true;  v_reason := 'admin_test';
  elsif not public._is_rankable_member(v_uid) then
    v_can_like := false; v_reason := 'not_member';
  elsif coalesce(v_me.must_change_credentials, false) then
    v_can_like := false; v_reason := 'change_credentials';
  else
    v_can_like := true;  v_reason := null;
  end if;

  -- 검색은 닉네임만 (실명 검색으로 별명 주인을 역추적하지 못하게). % _ \ 는 글자 그대로 찾는다.
  v_pat := case when v_q is null then null
                else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with counted as (
    select c.target_id, count(*)::int as n
      from public._counted_nickname_likes(null) c
     group by c.target_id
  ), cand as (
    select p.user_id,
           btrim(p.nickname) as display,
           p.branch_name as branch,
           mp.current_rank::text as rank,
           mp.current_level as level,
           coalesce(cn.n, 0) as likes,
           exists (select 1 from public.nickname_likes l where l.target_id = p.user_id and l.liker_id = v_uid) as liked_by_me
      from public.profiles p
      left join counted cn on cn.target_id = p.user_id
      left join public.member_progress mp on mp.user_id = p.user_id
     where (v_all or p.branch_name = v_me.branch_name)
       and p.user_id <> v_uid
       -- 닉네임을 정한 회원만 (일괄 등록 때 닉네임 = 실명으로 채워진 계정은 목록에 안 나온다)
       and nullif(btrim(p.nickname), '') is not null
       and btrim(p.nickname) <> btrim(coalesce(p.name, ''))
       and (v_pat is null or p.nickname ilike v_pat escape '\')
       and public._is_rankable_member(p.user_id)
     order by likes desc, display asc
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id, 'display', c.display, 'has_nickname', true,
           'likes', c.likes, 'likes_month', c.likes, 'liked_by_me', c.liked_by_me,
           'branch', c.branch, 'rank', c.rank, 'level', c.level)
         order by c.likes desc, c.display asc), '[]'::jsonb)
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

-- 3) 하트 토글 — 관리자만 다른 지점 회원에게도 (체험용, 점수 제외). 회원 규칙은 그대로.
do $$
declare
  _def text := pg_get_functiondef('public.toggle_nickname_like(uuid)'::regprocedure);
  _old text := 'if coalesce(v_me.branch_name, '''') = '''' or v_me.branch_name is distinct from v_t.branch_name then';
  _new text := 'if not (public.has_role(v_uid, ''super_admin'') or public.has_role(v_uid, ''admin'')) '
            || '/* 관리자는 전 지점 체험용 하트 (점수 제외) — 2026-09-29 */ '
            || 'and (coalesce(v_me.branch_name, '''') = '''' or v_me.branch_name is distinct from v_t.branch_name) then';
begin
  if position('관리자는 전 지점 체험용 하트' in _def) > 0 then return; end if;
  if (length(_def) - length(replace(_def, _old, ''))) / length(_old) <> 1 then
    raise exception 'toggle_nickname_like: 지점 검사 위치가 1곳이 아닙니다';
  end if;
  execute replace(_def, _old, _new);
end $$;