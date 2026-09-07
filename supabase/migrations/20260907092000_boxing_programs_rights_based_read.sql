-- 153플레이 · 월드 라이브러리 접근을 '권리 등급'으로 나눈다.
--
-- ⚠️ 직전 20260907090000_boxing_programs_admin_only.sql 을 대체한다(supersedes).
--    그 마이그레이션은 2,827건 전량을 관리자 전용으로 막아서, 문제 없는 영상까지
--    회원이 못 보게 됐다. rights_tier 분류가 이미 있으므로 그걸 게이트로 쓴다.
--
--   official / creator  → 공식 채널 · 제작자 본인 채널. 유튜브 임베드 허용 범위. 전 회원 공개
--   reupload / archive  → 재업로드 · 방송 아카이브. 저작권 소지.                  관리자만
--   (미분류)            → 판단 전.                                              관리자만 (안전 우선)
--
-- visibility 컬럼이 실제 게이트이고, rights_tier 는 그 근거다.
-- 서버(RLS)에서 행 자체를 막으므로 UI 조건과 무관하게 회원 계정에는 내려가지 않는다.
--
-- (원격 적용 버전: 20260907104334 boxing_programs_rights_based_read)

drop policy if exists boxing_programs_admin_read  on public.boxing_programs;
drop policy if exists boxing_programs_public_read on public.boxing_programs;

-- 회원: 권리 확인된 것만
create policy boxing_programs_member_read
  on public.boxing_programs
  for select
  to authenticated
  using (is_active = true and visibility = 'public');

-- 관리자: 전량
create policy boxing_programs_admin_read_all
  on public.boxing_programs
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 미분류가 실수로 공개되지 않도록 기본값을 admin 으로
alter table public.boxing_programs alter column visibility set default 'admin';
