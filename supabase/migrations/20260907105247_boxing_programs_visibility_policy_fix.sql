-- [원격 전용 마이그레이션 회수] 2026-09-08 검수 중 발견.
-- 이 SQL 은 운영 DB 에만 적용돼 있고 레포에는 없었다. 그래서 레포를 그대로 재적용해도
-- 운영과 같은 상태가 재현되지 않았다(=사고 조사·롤백 불가). 원문 그대로 회수한다.
--
-- 새 publishable 키(sb_publishable_…)가 anon 롤로 매핑되지 않아 읽기가 0건이 되었다.
-- 기존과 동일하게 public 롤 대상으로 두되, 공개분만 보이도록 조건은 유지한다.
--
-- ⚠️ 주의: to public 은 비로그인(anon) 포함이다. 공개 라이브러리 페이지
--    (153library.pages.dev / boxing-library Edge Function)가 이 정책에 의존한다.
--    없애려면 그 페이지를 먼저 로그인 전용으로 바꿔야 한다.
drop policy if exists boxing_programs_public_read on public.boxing_programs;
create policy boxing_programs_public_read on public.boxing_programs
  for select to public
  using (is_active = true and visibility = 'public');
