-- =========================================================================
-- 라이브보드 · COACHING STAFF 띠
--
-- 코치를 명예의 전당급 전용 띠로 보여주기 위한 데이터:
--   · profiles.staff_title — 관장/수석코치/코치 등 직함 (NULL 이면 코치)
--   · public_profiles 뷰에 staff_name(실명)·staff_title 노출
--     — 직원 계정에 한해서만. 일반 회원의 실명은 계속 감춘다.
-- =========================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_title text;

COMMENT ON COLUMN public.profiles.staff_title IS
  '코치 직함 (관장·수석코치·코치 등). 라이브보드 COACHING STAFF 띠에 이름 뒤 표기. NULL 이면 코치.';

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT user_id, nickname, avatar_url, branch_name, is_staff,
         CASE WHEN is_staff THEN name END AS staff_name,
         CASE WHEN is_staff THEN staff_title END AS staff_title
  FROM public.profiles;
