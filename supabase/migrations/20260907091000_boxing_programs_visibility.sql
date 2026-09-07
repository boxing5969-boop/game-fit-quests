-- 153플레이 · 월드 라이브러리(boxing_programs) 노출 등급 컬럼
--
-- visibility  : 실제 게이트. 'public' = 전 회원 공개 / 'admin' = 관리자 전용
-- rights_tier : 그 판단 근거. official | creator | reupload | archive
--
-- (원격 적용 버전: 20260907103824 boxing_programs_visibility)

alter table public.boxing_programs
  add column if not exists visibility text not null default 'public',
  add column if not exists rights_tier text;

alter table public.boxing_programs
  drop constraint if exists boxing_programs_visibility_chk;
alter table public.boxing_programs
  add constraint boxing_programs_visibility_chk check (visibility in ('public','admin'));

create index if not exists boxing_programs_visibility_idx
  on public.boxing_programs (visibility) where is_active = true;
