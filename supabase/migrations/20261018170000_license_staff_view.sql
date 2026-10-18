-- 코치·지점장·운영진 이름을 눌러도 라이센스 카드가 열린다 (2026-10-18 대표님: "강건형은 라이센스를 볼 수 없는 계정인가?"
--   — 이름을 누르면 '항상' 회원 카드가 열려야 한다). 예전(2026-09-29)에는 랭킹과 같은 기준으로 지도진·관리자 역할 계정을
--   "라이센스를 볼 수 없는 계정이에요"로 막았다 → 이제 체험용(테스트) 계정만 막는다.
--   · staff_role: 'admin'(운영진) · 'branch_manager'(지점장) · 'coach'(코치) · null(회원) — 화면이 카드에 표시를 붙인다
--   · 하트: 운영진 계정은 받지 않는다(랭킹 밖) → like_reason = 'target_staff' (화면은 하트 대신 메시지·응원)
--   · 같은 지점 규칙 · 전체관리자 전 지점 보기 · 돌려주는 공개 정보는 그대로
create or replace function public.get_member_license(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
  v_staff text;
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
  v_reason := case
    when p_user = v_uid then 'self'
    when v_staff is not null then 'target_staff'
    when not public._is_rankable_member(p_user) then 'target_not_member'
    when v_admin then null
    when not public._is_rankable_member(v_uid) then 'not_member'
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
    'staff_role', v_staff
  );
end;
$function$;
