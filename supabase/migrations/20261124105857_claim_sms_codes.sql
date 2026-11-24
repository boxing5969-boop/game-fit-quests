-- 2026-11-24 보안 점검 ③ — 생년월일이 없는 회원 계정은 휴대폰 인증번호로 넘겨받기 (대표님 「일단 선릉역점만 진행하고 예외 허락할게」)
--
-- claim-member-account action sms_send 가 6자리 인증번호를 만들어 해시만 여기 남기고 153OS 문자(선릉역점 NCP SENS)로 보낸다.
-- sms_verify 가 맞으면 used_at 을 채우고 15분짜리 인증 표(smsProof)를 준다. 인증번호 5분 · 5번 틀리면 끝.
-- 개인정보: 번호 · 접속지 · 인증번호 원문은 남기지 않는다(서버 비밀값 HMAC 해시만). 사흘 지난 줄은 함수가 지운다.
-- 접근: RLS 를 켜고 정책을 두지 않는다 → 서비스 롤(에지 함수)만.
-- 되돌리기: drop table public.claim_sms_codes; + 아래 action 검사를 ('check','claim') 으로.

create table if not exists public.claim_sms_codes (
  id          uuid        primary key default gen_random_uuid(),
  phone_hash  text        not null,
  user_id     uuid        not null,
  code_hash   text        not null,
  ip_hash     text,
  attempts    int         not null default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists claim_sms_codes_phone_recent_idx on public.claim_sms_codes (phone_hash, created_at desc);
create index if not exists claim_sms_codes_ip_recent_idx on public.claim_sms_codes (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists claim_sms_codes_created_idx on public.claim_sms_codes (created_at);

alter table public.claim_sms_codes enable row level security;
revoke all on table public.claim_sms_codes from anon, authenticated;

comment on table public.claim_sms_codes is
  '기록 찾기 휴대폰 인증번호(claim-member-account sms_send/sms_verify) — 해시만, 서비스 롤 전용, 사흘 뒤 삭제.';

-- 시도 기록에 인증번호 보내기 · 확인도 남긴다.
alter table public.member_claim_attempts drop constraint if exists member_claim_attempts_action_check;
alter table public.member_claim_attempts add constraint member_claim_attempts_action_check
  check (action in ('check', 'claim', 'sms_send', 'sms_verify'));
