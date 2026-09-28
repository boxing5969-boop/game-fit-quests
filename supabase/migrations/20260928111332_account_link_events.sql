-- 기존회원 연동(link-imported-by-phone) 이력 — 일괄등록 계정(from) → 소셜 가입 계정(to).
-- 연동 시 기존 계정을 바로 삭제하면 출석·레벨·XP·결제 기록이 사라지고(cascade) 출석 기록이 고아가 되어
-- 라이브보드에 같은 회원이 두 명(Lv.10 / Lv.1)으로 뜨던 문제(2026-09-28) 수정용. 서비스 롤 전용.
create table if not exists public.account_link_events (
  id bigserial primary key,
  from_user_id uuid not null,
  to_user_id uuid not null,
  linked_at timestamptz not null default now(),
  merged_at timestamptz,
  merge_result jsonb,
  from_deleted_at timestamptz,
  note text
);
create index if not exists account_link_events_pending_idx on public.account_link_events (linked_at) where merged_at is null;
alter table public.account_link_events enable row level security;
revoke all on table public.account_link_events from anon, authenticated;
revoke all on sequence public.account_link_events_id_seq from anon, authenticated;