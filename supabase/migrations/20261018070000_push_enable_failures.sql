-- 휴대폰 알림 켜기 실패 기록 (2026-10-18 오류 신고: "설정 - 소리 켜기가 와이파이 연결 안 됐다고 오류나요").
--   예전 화면은 실패하면 무조건 "인터넷 연결을 확인"이라고 했다 → 어디서 막혔는지(서버 키 · 브라우저 등록 · 서버 저장)와
--   오류 이름만 남겨 기기별 원인을 찾는다. 연락처·알림 주소는 남기지 않는다. 한 사람 하루 20건까지. 화면: src/lib/pushClient.ts
create table if not exists public.push_enable_failures (
  id bigserial primary key,
  user_id uuid,
  stage text not null,
  detail text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_enable_failures enable row level security;
-- 정책 없음 = 앱에서 직접 읽기·쓰기 불가. 기록은 아래 함수로만, 확인은 SQL 로.
create index if not exists push_enable_failures_created_idx on public.push_enable_failures (created_at desc);

create or replace function public.log_push_enable_failure(p_stage text, p_detail text, p_ua text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  if (select count(*) from public.push_enable_failures
       where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    return;
  end if;
  insert into public.push_enable_failures (user_id, stage, detail, user_agent)
  values (v_uid, left(coalesce(p_stage, 'unknown'), 20), left(p_detail, 300), left(p_ua, 300));
end;
$$;
revoke all on function public.log_push_enable_failure(text, text, text) from public, anon;
grant execute on function public.log_push_enable_failure(text, text, text) to authenticated;
