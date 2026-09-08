-- [발견] get_boss_conquerors — get_level_cycle_progress 와 같은 "NULL 이면 전부 통과" 패턴.
--   비로그인(라이브보드 TV)은 profiles 조회가 NULL 이라 branch_filter 가 NULL 이 되고,
--   `branch_filter IS NULL OR ...` 때문에 지점 필터가 통째로 사라졌다.
--   결과: ① 넘겨준 _branch_name 이 무시돼 잠실 TV 에 과천 회원이 뜬다
--         ② 비로그인 키만 있으면 전 지점 명단(닉네임·아바타·레벨)이 나온다
-- [조치] super_admin 만 "전 지점"(_branch_name IS NULL)을 볼 수 있다.
--        그 외에는 본인 지점, 지점이 없으면 넘겨준 _branch_name 으로 좁히고,
--        둘 다 없으면 아무것도 내주지 않는다(fail-closed).
--        시그니처(기본값·반환 컬럼명 r_ 접두사)는 기존 그대로 유지 — 프론트가 여기에 물려 있다.
create or replace function public.get_boss_conquerors(
  _branch_name text default null::text,
  _limit integer default 10
)
returns table (
  r_user_id uuid, r_nickname text, r_avatar_url text,
  r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer,
  rank_position bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE COALESCE(
                  (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid()),
                  _branch_name)
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level, mp.bosses_cleared,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  -- 전 지점 조회는 super_admin 만. 나머지는 반드시 지점이 일치해야 한다.
  WHERE ((ef.is_super_admin AND ef.branch_filter IS NULL) OR p.branch_name = ef.branch_filter)
    AND mp.bosses_cleared > 0
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = mp.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = mp.user_id
         AND ur.role IN ('super_admin', 'admin')
    )
  ORDER BY mp.bosses_cleared DESC
  LIMIT _limit;
$function$;
