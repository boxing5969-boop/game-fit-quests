-- 🗑️ 앱 안 계정 삭제 요청 기록 (2026-10-19 — App Store 심사 5.1.1(v))
--
-- 요청은 Edge Function account-delete-request 가 받는다 (본인 확인 → 기록 → 알림 끄기 → 전체관리자 알림 → 로그인 잠금·로그아웃).
-- 기록 삭제는 7일 안에 전체관리자가 회원 화면의 '계정 삭제'(delete-user)로 마무리한다 — 그때 이 행도 같이 지워진다(cascade).
-- 화면에서 직접 읽고 쓰지 않는다 (service_role 만).

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text check (reason is null or char_length(reason) <= 300),
  source text not null default 'app' check (source in ('app', 'web')),
  member_name text,
  branch_name text
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
comment on table public.account_deletion_requests is '앱 안 계정 삭제 요청 — 요청 즉시 로그인 잠금, 7일 안에 전체관리자가 삭제 마무리 (2026-10-19)';
