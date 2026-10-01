-- 🔔 회원 앱 안 알림함 (2026-10-01 대표님)
--
-- 관리자 '전체 공지 발송'·출석 취소·수업 참여 알림이 notifications 에 쌓이기만 하고 회원 화면 어디에도
-- 보이지 않았다 (789건 중 읽힌 것 0건). 회원 앱에 알림함(/notifications)과 머리글 종을 붙이면서 서버 쪽을 정리한다.
--
--   1) link — 누르면 열 앱 안 화면. '/' 로 시작하는 앱 안 주소만 받는다 (바깥 주소·//host·역슬래시·공백 거부)
--      → 나중에 휴대폰 알림(푸시)으로 나가도 바깥 피싱 주소가 될 수 없다.
--   2) 인덱스 — 내 알림 최신순 · 안 읽은 수
--   3) mark_notifications_read(p_ids) — 서버 시각으로 '내' 알림만 읽음 처리 (본사 계정도 남의 알림은 건드리지 않는다)

alter table public.notifications add column if not exists link text;

alter table public.notifications drop constraint if exists notifications_link_internal;
alter table public.notifications add constraint notifications_link_internal
  check (link is null or (char_length(link) <= 300 and link ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$'));

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language sql
security invoker
set search_path = public
as $$
  with done as (
    update public.notifications
       set read_at = now()
     where user_id = auth.uid()
       and read_at is null
       and (p_ids is null or id = any (p_ids))
    returning 1
  )
  select count(*)::int from done;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

comment on column public.notifications.link is '누르면 열 앱 안 화면 (/로 시작하는 앱 주소만, 2026-10-01)';
comment on function public.mark_notifications_read(uuid[]) is '내 알림 읽음 처리 — p_ids 가 없으면 전부 (2026-10-01)';