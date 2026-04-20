-- ─────────────────────────────────────────────────────────────
--  boxing5969@gmail.com 계정을 super_admin으로 지정
--
--  user_id: 7531ddd6-d939-436c-b532-970c7b88b6b8
--
--  안전 전략:
--    * 이미 super_admin이면 아무것도 안 함
--    * 다른 role이 있어도 덮어쓰지 않고 super_admin을 추가
--      (user_roles 테이블이 다중 role 허용 구조여도 안전하게 동작)
--
--  Supabase SQL Editor에서 그대로 실행.
-- ─────────────────────────────────────────────────────────────

-- 1. 현재 상태 확인 (변경 없음)
SELECT * FROM public.user_roles
WHERE user_id = '7531ddd6-d939-436c-b532-970c7b88b6b8';

-- 2. super_admin 역할이 없으면 추가
INSERT INTO public.user_roles (user_id, role)
SELECT '7531ddd6-d939-436c-b532-970c7b88b6b8'::uuid, 'super_admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '7531ddd6-d939-436c-b532-970c7b88b6b8'::uuid
    AND role    = 'super_admin'::app_role
);

-- 3. 결과 확인
SELECT * FROM public.user_roles
WHERE user_id = '7531ddd6-d939-436c-b532-970c7b88b6b8';

-- 예상 결과: 최소 한 줄 이상, role 컬럼에 'super_admin' 포함.
-- 이후 Cloudflare에 배포된 앱에서 해당 계정으로 로그인하면
-- HallOfFamePage에서 지점 스위처(전체 / 선릉점 / …)가 보여야 함.
