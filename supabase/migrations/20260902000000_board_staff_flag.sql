-- =========================================================================
-- 라이브보드 · 코치/직원 분리 표시
--
-- 배경: 브로제이 직원 출근이 회원과 똑같이 "운동 중"에 섞여 나왔다.
--       코치는 회원 카운트·티커·그리드에서 빼고 헤더의 코치 줄로 따로 보여준다.
--
-- 자동화: sync-broj-checkins 가 CRM attendance_logs.user_type='직원' 을 보고
--         profiles.is_staff 를 자동으로 켠다 (새 코치도 손댈 필요 없음).
-- =========================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_staff IS
  '코치·직원 계정 여부. 라이브보드에서 회원 목록과 분리해 코치 줄로 표시한다. 브로제이 직원 출근(user_type=직원) 감지 시 sync-broj-checkins 가 자동 세팅.';

-- 익명(TV)에서 읽는 공개 뷰에 컬럼 추가 (기존 컬럼 순서 유지, 뒤에만 붙임)
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT user_id, nickname, avatar_url, branch_name, is_staff
  FROM public.profiles;
