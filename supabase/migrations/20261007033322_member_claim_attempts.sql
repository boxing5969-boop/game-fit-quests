-- 기존 회원 '결제 없이 앱 가입'(claim-member-account 에지 함수)의 본인 확인 시도 기록.
--
-- 배경: 체육관(CRM)에 등록된 회원은 자동 동기화로 앱 계정이 이미 만들어져 있다(아직 넘겨받지 않은 계정).
--       신규 가입 화면에서 전화번호·이름(+ 생년월일이 등록된 회원은 생년월일까지)이 맞으면
--       수강권 결제 없이 그 계정을 본인이 정한 아이디·비밀번호로 넘겨받는다.
--       남의 번호로 이름을 맞혀 보는 시도를 막으려고 같은 번호·같은 접속지의 불일치 횟수를 센다
--       (번호 5회 / 접속지 15회 · 30분 — 판정은 에지 함수가 한다).
--
-- 개인정보: 전화번호·접속 IP 원문은 남기지 않는다. 서버 비밀값으로 만든 해시만 저장한다.
-- 접근: RLS 를 켜고 정책을 두지 않는다 → 회원·방문자는 읽기·쓰기 불가. 서비스 롤(에지 함수)만 쓴다.
-- user_id: 계정을 넘겨받은 기록(result='claimed')에만 채운다 — "내 계정을 누가 가져갔다" 문의 때 데스크가 확인.
create table if not exists public.member_claim_attempts (
  id          bigint generated always as identity primary key,
  phone_hash  text        not null,
  ip_hash     text,
  action      text        not null check (action in ('check', 'claim')),
  result      text        not null,
  user_id     uuid,
  created_at  timestamptz not null default now()
);

create index if not exists member_claim_attempts_phone_recent_idx
  on public.member_claim_attempts (phone_hash, created_at desc);
create index if not exists member_claim_attempts_ip_recent_idx
  on public.member_claim_attempts (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.member_claim_attempts enable row level security;
revoke all on table public.member_claim_attempts from anon, authenticated;

comment on table public.member_claim_attempts is
  '기존 회원 결제 없이 가입(claim-member-account) 본인 확인 시도 기록 — 번호·IP 는 해시만, 서비스 롤 전용.';
