-- 153플레이 · 월드 라이브러리(boxing_programs) 접근 제한
--
-- boxing_programs 는 전 세계 외부 채널 유튜브 큐레이션(2,827건)이라 저작권 이슈가 있다.
-- 기존 정책은 public 읽기여서 로그인만 하면 누구나 API 로 목록을 가져갈 수 있었다.
-- 관리자(admin / super_admin) 에게만 열어 일반 회원 계정에서는 조회 자체가 되지 않게 한다.
-- UI(153플레이 '월드' 탭) 도 같은 조건으로 숨겨져 있어 두 겹으로 막힌다.

drop policy if exists boxing_programs_public_read on public.boxing_programs;

create policy boxing_programs_admin_read
  on public.boxing_programs
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
