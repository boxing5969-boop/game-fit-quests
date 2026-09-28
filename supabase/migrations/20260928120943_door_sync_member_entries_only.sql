-- 브로제이 출입 동기화 정리 (2026-09-28)
-- ① 문이 안 열린 입장(broj FAILURE: 이용권 기간 만료·월간 입장 횟수 소진)이 회원 출석으로 들어가 있던 행을
--    지우기 전에 그대로 보관한다(되돌릴 수 있게). 서비스 롤 전용.
-- ② 직원 출근은 이제 출근부(staff_duty_logs)에만 적힌다 → 지도진 관리 화면이 오늘 출근을 출근부에서 읽도록
--    관리자(전 지점)·지점장/코치(자기 지점)에게 읽기 권한을 준다.
create table if not exists public.attendance_rejected_entries (
  like public.attendance_logs,
  removed_at timestamptz not null default now(),
  removed_reason text,
  xp_action text
);
alter table public.attendance_rejected_entries enable row level security;
revoke all on table public.attendance_rejected_entries from anon, authenticated;

grant select on table public.staff_duty_logs to authenticated;
drop policy if exists "staff managers read duty logs" on public.staff_duty_logs;
create policy "staff managers read duty logs" on public.staff_duty_logs
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')
    or ((public.has_role(auth.uid(), 'branch_manager') or public.has_role(auth.uid(), 'coach'))
        and branch_name = (select p.branch_name from public.profiles p where p.user_id = auth.uid()))
  );