-- ============================================================
-- 153 QUEST 몰입 레이어 v1 — 세컨드 응원 후보 조회 RPC (Phase 10)
-- ============================================================
-- 배경:
--   public.profiles SELECT 정책은 본인/코치/관리자만 허용 → 일반 회원이
--   같은 지점 동료를 조회할 수 없음. 응원 후보 표시를 위해 최소 정보만
--   서버에서 결정해 반환하는 SECURITY DEFINER RPC 를 추가한다.
--
-- 보호 원칙:
--   · 민감정보(phone_number, email, birth_date) 절대 미노출 — 본 RPC 가
--     반환 컬럼 화이트리스트로 제한.
--   · 자기 자신 자동 제외.
--   · auth.uid() 검증 필수.
--   · 같은 branch_name 회원만 반환 (호출자의 profile.branch_name 기준).
--   · role='member' 만 (코치/관리자/super_admin 제외).
--   · 표시명은 nickname > name 우선.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_second_cheer_candidates(
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  branch_name text,
  current_rank text,
  current_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_branch text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT p.branch_name INTO v_branch
  FROM public.profiles p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_branch IS NULL OR length(v_branch) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '회원') AS display_name,
    p.branch_name,
    mp.current_rank::text AS current_rank,
    mp.current_level
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'member'
  LEFT JOIN public.member_progress mp ON mp.user_id = p.user_id
  WHERE p.branch_name = v_branch
    AND p.user_id <> v_uid
  ORDER BY COALESCE(mp.current_level, 0) DESC, p.created_at ASC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_second_cheer_candidates(integer) TO authenticated;

-- 자체 검증:
--   · (앱 세션) SELECT * FROM public.get_second_cheer_candidates(30);
--     → 본인 제외, 같은 branch_name member 만 반환, current_level 내림차순.
--   · phone_number / email / birth_date 컬럼 미반환 — 컬럼 화이트리스트 자체에 없음.
--   · 다른 branch 회원은 0건.
