-- 앱 오류/불편 신고 (2026-10-11 대표님: "앱 오류나 안되는 부분 보내는 기능")
-- 적용: mcp apply_migration 으로 2026-10-11 운영 반영 완료. 이 파일은 기록용.
-- 화면: src/pages/FeedbackPage.tsx (/feedback) — 전체 메뉴 + 내정보에서 진입.
-- 신고가 들어오면 트리거가 super_admin(대표님)에게 알림 → 기존 푸시 파이프라인 재사용.
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category text not null default '오류',
  content text not null check (char_length(content) between 2 and 2000),
  page_path text,
  device_info text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

create policy "feedback_insert_own" on public.app_feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy "feedback_select_own" on public.app_feedback
  for select to authenticated using (user_id = auth.uid());
create policy "feedback_select_staff" on public.app_feedback
  for select to authenticated using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'branch_manager')
  );
create policy "feedback_update_staff" on public.app_feedback
  for update to authenticated using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'super_admin')
  );

create or replace function public.notify_app_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _nick text;
  _admin record;
begin
  select coalesce(nickname, name, '회원') into _nick from public.profiles where user_id = new.user_id;
  for _admin in
    select distinct ur.user_id from public.user_roles ur where ur.role = 'super_admin'
  loop
    perform public.create_notification(
      _admin.user_id,
      '📮 앱 ' || new.category || ' 신고',
      _nick || ': ' || left(new.content, 120)
    );
  end loop;
  return new;
end;
$$;

create trigger app_feedback_notify
  after insert on public.app_feedback
  for each row execute function public.notify_app_feedback();
