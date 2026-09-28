-- 브로제이 대조 집계 + 첫 입장 회원 계정 생성 기록 (2026-09-28, 대표님 승인)
--
-- ① broj_daily_counts — 지점·날짜별 "브로제이 기준" 숫자. 출입 동기화(sync-broj-checkins)가 1분마다 갱신하고
--    관리자 홈 운영 리포트가 읽는다. 브로제이 화면 숫자와 앱 숫자를 바로 대조할 수 있게.
--      member_entries      회원 입장 건수 — 문이 열린 입장만, 나갔다 다시 들어온 것도 센다(브로제이 목록과 같은 기준)
--      member_people       그 회원 인원(전화번호 기준)
--      staff_people        직원(코치) 출근 인원
--      app_member_people   앱 회원 계정과 연결된 인원
--      staff_member_people 코치 계정인데 회원권으로 입장한 인원(앱은 코치로 센다)
--      unlinked_people     앱 계정이 없는 인원(이름 없음 · 번호 형식 오류 · 계정 생성 실패 등)
--      rejected_entries    문 거절(이용권 만료 · 월 입장 횟수 소진) — 출석에서 뺀 건수
-- ② broj_checkin_runs.created_accounts — 첫 입장 때 만든 앱 계정 수(하루 생성 한도 판단에도 쓴다).

create table if not exists public.broj_daily_counts (
  branch_name text not null,
  day date not null,
  member_entries integer not null default 0,
  member_people integer not null default 0,
  staff_people integer not null default 0,
  app_member_people integer not null default 0,
  staff_member_people integer not null default 0,
  unlinked_people integer not null default 0,
  rejected_entries integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_name, day)
);

alter table public.broj_daily_counts enable row level security;
revoke all on table public.broj_daily_counts from anon, authenticated;
grant select on table public.broj_daily_counts to authenticated;
drop policy if exists "staff managers read broj daily counts" on public.broj_daily_counts;
create policy "staff managers read broj daily counts" on public.broj_daily_counts
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')
    or ((public.has_role(auth.uid(), 'branch_manager') or public.has_role(auth.uid(), 'coach'))
        and branch_name = (select p.branch_name from public.profiles p where p.user_id = auth.uid()))
  );

alter table public.broj_checkin_runs add column if not exists created_accounts integer not null default 0;