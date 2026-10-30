-- 만족도 조사 자동 답변 · 의견 알림 (2026-10-30 대표님: "의견 없고 긍정적인 답변만 하신 분들에게는 하루 지나고 내가 남긴 것처럼
--   대신 남겨 줘 … 의견이나 개선됐으면 좋겠다고 한 것은 나한테 알림으로")
--   · survey_replies.auto — 자동으로 단 답변 표시(회원 화면에는 안 보인다 · 본사가 나중에 구분하려고)
--   · survey_auto_watch — 응답마다 '대표님께 알림 보냄' · '자동 답변 함' 시각 (같은 일을 두 번 안 하게). 직접 읽기·쓰기 막음.
--   · 크론 survey-auto-reply 15분마다 → Edge Function survey-auto-reply (x-auto-key)
--   · 새 칸 1 · 새 표 1 · 새 크론 1 — 기존 함수는 바꾸지 않는다.

alter table public.survey_replies add column if not exists auto boolean not null default false;

create table if not exists public.survey_auto_watch (
  response_id uuid primary key,
  kind text not null check (kind in ('positive', 'opinion')),
  notified_at timestamptz,
  auto_replied_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.survey_auto_watch enable row level security;
revoke all on table public.survey_auto_watch from anon, authenticated;
