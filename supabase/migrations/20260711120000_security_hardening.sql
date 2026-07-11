-- ============================================================
-- 20260711120000_security_hardening.sql
-- 보안 하드닝 — 전체 점검 보고서(2026-07-11) C1·C2 대응
--
-- ⚠️ 적용 전 반드시 검토하세요. 프로덕션 반영은 Supabase Dashboard SQL Editor
--    또는 Lovable 위임으로 진행합니다. (기존 마이그레이션 파일은 수정하지 않음)
--    이 파일은 로컬/점검 환경에서 실행 검증되지 않았습니다 — 리뷰 후 적용.
--
-- 포함 내용:
--   1) grant_gems 무권한 호출 차단 (C1)
--      - authenticated/anon/PUBLIC 실행권한 회수
--      - 역할검사 래퍼 admin_grant_gems 신설(관리자/지점장/super_admin 전용)
--      - 다른 함수 내부의 PERFORM grant_gems 는 SECURITY DEFINER 라 계속 정상 동작
--   2) 회원의 지갑/진행도 직접 수정 차단 (C2)
--      - user_wallets / member_progress 의 "본인 UPDATE" RLS 정책 제거
--        (클라이언트는 전부 RPC 경유 — 직접 update 사용처 0건 확인.
--         SECURITY DEFINER RPC 는 RLS 를 우회하므로 정상 보상 흐름은 그대로 유지)
--   3) 회원 셀프 승인(is_approved=true) 차단 (C2)
--      - profiles 는 회원이 이름/닉네임/아바타 등을 직접 수정하므로 테이블 전체를
--        막지 않고, "본인이 is_approved 를 true 로 바꾸는 것"만 트리거로 차단
-- ============================================================

-- ── 1) grant_gems 잠금 + 역할검사 래퍼 ────────────────────────
REVOKE EXECUTE ON FUNCTION public.grant_gems(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_gems(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_gems(uuid, integer, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_gems(
  _user_id uuid,
  _amount  integer,
  _reason  text DEFAULT '관리자 지급'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 호출자 권한 확인 — 관리자/지점장/super_admin 만 타인 지갑에 지급 가능
  IF NOT (
       public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'branch_manager')
  ) THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  PERFORM public.grant_gems(_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_gems(uuid, integer, text) TO authenticated;

-- ── 2) 지갑/진행도 "본인 직접 UPDATE" 정책 제거 ────────────────
--   (관리자 정책 "Admins update all ..." 은 그대로 유지)
DROP POLICY IF EXISTS "Users update own wallet"   ON public.user_wallets;
DROP POLICY IF EXISTS "Users update own progress" ON public.member_progress;

-- ── 3) profiles 셀프 승인 차단 트리거 ─────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 서비스롤(엣지 함수) 등 JWT 없는 컨텍스트는 auth.uid() = NULL → 통과
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 관리자/지점장/super_admin 은 통과
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin')
     OR public.has_role(auth.uid(), 'branch_manager') THEN
    RETURN NEW;
  END IF;

  -- 일반 회원: 승인 상태를 스스로 true 로 바꾸는 것 차단
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     AND COALESCE(NEW.is_approved, false) = true THEN
    RAISE EXCEPTION '승인 상태는 직접 변경할 수 없습니다';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ============================================================
-- 참고(후속 권장 — 본 파일에는 미포함):
--   · 2026-07-05 일괄 GRANT 로 authenticated 에 노출된 다른 SECURITY DEFINER
--     함수들도 내부 권한검사 유무를 전수 점검할 것.
--   · purchase_customization(H3): 클라이언트 p_price 신뢰 → 서버 가격표 조회로 교체.
--   · review_diet_log(M1)/pass_boss_battle(M2): 이미-처리 멱등성 가드 추가.
--   · diet_quest_events(M3): (enrollment_id, log_date, mission_id) 중복 방지.
-- ============================================================
