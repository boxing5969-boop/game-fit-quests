-- 승인 요청 알림 (2026-10-15 대표님: "승인 문의가 오면 지점장이나 코치, 나에게 승인 푸시 메시지와 알림 종 모양에 —
-- 빠르게 승인할 수 있게")
--   대상 = 운영 리포트 '처리 대기' 와 같은 것: 미션 제출(mission_submissions) · 퀘스트 제출(quest_submissions) ·
--          가입 승인 대기(profiles.is_approved = false 로 새로 생김) · 코치 신청(coach_requests)
--   받는 사람 = 전체관리자 + 그 회원 지점의 지점장·코치 (본인 제외)
--   notifications 에 넣으면 알림함(종)에 뜨고, 휴대폰 알림을 켠 사람에게는 푸시가 간다 (기존 트리거).
--   누르면 /manager?tab=inbox (승인 탭). 같은 사람에게 2분 안에 같은 종류가 또 오면 한 번만 (한꺼번에 제출할 때 폭탄 방지).

create or replace function public.notify_approval_request(_member uuid, _kind text, _what text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_branch text;
  v_name text;
  v_title text;
begin
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_name
    from public.profiles p where p.user_id = _member;
  v_title := '🔔 승인 요청 · ' || _kind;

  insert into public.notifications (user_id, title, body, link)
  select r.uid, v_title, v_name || '님 — ' || _what || ' · 눌러서 바로 승인하세요', '/manager?tab=inbox'
    from (
      select ur.user_id as uid
        from public.user_roles ur
       where ur.role = 'super_admin'
      union
      select ur.user_id
        from public.user_roles ur
        join public.profiles sp on sp.user_id = ur.user_id
       where ur.role in ('branch_manager', 'coach')
         and v_branch is not null and sp.branch_name = v_branch
    ) r
   where r.uid <> _member
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.uid and n.title = v_title and n.created_at > now() - interval '2 minutes'
     );
exception when others then
  null; -- 알림이 실패해도 제출·가입은 그대로
end $$;
revoke all on function public.notify_approval_request(uuid, text, text) from public, anon, authenticated;

create or replace function public.mission_submission_alert_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.status is distinct from 'pending' then return new; end if;
  select m.title into v_title from public.missions m where m.id = new.mission_id;
  perform public.notify_approval_request(new.user_id, '미션', coalesce('"' || v_title || '" ', '') || '미션 승인을 요청했어요');
  return new;
exception when others then return new;
end $$;

create or replace function public.quest_submission_alert_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text is distinct from 'pending' then return new; end if;
  perform public.notify_approval_request(new.user_id, '퀘스트', '퀘스트 승인을 요청했어요');
  return new;
exception when others then return new;
end $$;

create or replace function public.profile_signup_alert_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_approved is distinct from false then return new; end if;
  perform public.notify_approval_request(new.user_id, '가입', '새로 가입했어요. 가입 승인을 기다려요');
  return new;
exception when others then return new;
end $$;

create or replace function public.coach_request_alert_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from 'pending' then return new; end if;
  perform public.notify_approval_request(new.user_id, '코치 신청', '코치 계정 승인을 요청했어요');
  return new;
exception when others then return new;
end $$;

do $$ begin
  create trigger mission_submission_alert after insert on public.mission_submissions
    for each row execute function public.mission_submission_alert_trg();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger quest_submission_alert after insert on public.quest_submissions
    for each row execute function public.quest_submission_alert_trg();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger profile_signup_alert after insert on public.profiles
    for each row execute function public.profile_signup_alert_trg();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger coach_request_alert after insert on public.coach_requests
    for each row execute function public.coach_request_alert_trg();
exception when duplicate_object then null; end $$;

-- 보완 요청 뒤 다시 제출(상태가 pending 으로 돌아옴)도 알린다
do $$ begin
  create trigger mission_submission_alert_resubmit after update of status on public.mission_submissions
    for each row when (new.status = 'pending' and old.status is distinct from 'pending')
    execute function public.mission_submission_alert_trg();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger quest_submission_alert_resubmit after update of status on public.quest_submissions
    for each row when (new.status::text = 'pending' and old.status::text is distinct from 'pending')
    execute function public.quest_submission_alert_trg();
exception when duplicate_object then null; end $$;
