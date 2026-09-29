-- 라이센스 보기 범위 = 랭킹에 보이는 회원 (2026-09-29 검수).
-- 랭킹(get_division_ranking)은 지도진·체험용·관리자 역할만 빼고 같은 지점 회원을 모두 보여 준다.
-- 그런데 get_member_license 는 _is_rankable_member(승인 + 이용권/얼굴 출석 기록)까지 요구해서, 랭킹에서 누른
-- 회원 중 일부가 "라이센스를 볼 수 없는 계정" 으로 막혔다 → 보기 조건을 랭킹과 똑같이 맞춘다.
-- 하트는 예전대로 _is_rankable_member 인 회원만 받는다(toggle_nickname_like 규칙) — 못 받는 회원은
-- like_reason = 'target_not_member' 로 알려 줘서 화면이 누를 수 없는 하트를 내밀지 않게 한다.
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

  v_reason := case
    when p_user = v_uid then 'self'
    when not v_has_nick then 'target_no_nickname'
    when not public._is_rankable_member(p_user) then 'target_not_member'
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