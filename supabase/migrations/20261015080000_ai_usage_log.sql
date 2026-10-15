-- 💸 AI 사용 기록 (2026-10-15 대표님: 월 200달러 Claude API 크레딧 운용 계획)
--
--   Claude 를 부를 때마다 한 줄씩 남긴다 — 기능별(채팅·오삼코치 메시지 등) 토큰과 비용을 매주 보기 위해.
--   쓰기: 엣지 함수(서비스 롤)만. 읽기: 관리자(super_admin·admin).
--   비용(cost_usd)은 _shared/claude.ts 의 가격표로 계산한 추정값 — 정산은 Claude 콘솔 Cost 화면이 기준.

create table if not exists public.ai_usage_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  feature text not null,                       -- 'chat' | 'coach_batch' | ...
  model text not null,
  user_id uuid null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  batch boolean not null default false,
  cost_usd numeric(12, 8) not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
create index if not exists ai_usage_log_feature_idx on public.ai_usage_log (feature, created_at desc);

alter table public.ai_usage_log enable row level security;

create policy "ai_usage_log admin read" on public.ai_usage_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin'));

comment on table public.ai_usage_log is 'Claude API 호출 기록 — 기능별 토큰·추정 비용. 쓰기는 서비스 롤(엣지 함수)만, 읽기는 관리자.';
