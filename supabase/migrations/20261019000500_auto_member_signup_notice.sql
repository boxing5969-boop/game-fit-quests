-- 브로제이 등록 회원의 '가입 승인 요청' 알림이 잘못 가던 것 고치기 (2026-10-19 대표님: "13분 전 가입 요청해서 들어갔는데
--   누가 승인한 거야? 난 승인 안 눌렀는데")
--   · 실제 흐름: 브로제이에 새 회원 등록 → 153OS 가 가져옴(signup_source 'broj_auto', 매일 00:05 무렵) → sync-members-to-app 이
--     앱 계정(아이디 = 전화번호@153rankup.app)을 만들고 1초 안에 is_approved = true 로 바꾼다. 아무도 누르지 않았다.
--   · 그런데 profile_signup_alert 트리거는 프로필이 처음 들어가는 순간(is_approved = false)에 울려서
--     "가입 승인을 기다려요 · 눌러서 바로 승인하세요" 가 나갔다(임정우 · 고다감).
--   → 전화번호 아이디(브로제이 등록 회원) 계정은 승인 요청 대신 '새 회원 · 자동 등록' 안내만 보낸다. 직접 가입은 그대로 승인 요청.

create or replace function public.notify_auto_member_joined(_member uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_branch text;
  v_name text;
  v_title text := '🎉 새 회원 · 자동 등록';
begin
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_name
    from public.profiles p where p.user_id = _member;

  insert into public.notifications (user_id, title, body, link)
  select r.uid, v_title,
         v_name || '님 — 브로제이에 등록된 회원이라 앱 계정이 자동으로 만들어지고 승인됐어요. 따로 승인할 것은 없어요',
         '/manager'
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
   where r.uid <> _member;
exception when others then
  null;
end $function$;
revoke all on function public.notify_auto_member_joined(uuid) from public, anon, authenticated;

create or replace function public.profile_signup_alert_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_auto boolean;
begin
  if new.is_approved is distinct from false then return new; end if;
  -- 브로제이 등록 회원: 동기화가 계정을 만들고 곧바로 승인한다 → 승인 요청 대신 안내만
  select u.email ~ '^01[0-9]{8,9}@153rankup\.app$' into v_auto from auth.users u where u.id = new.user_id;
  if coalesce(v_auto, false) then
    perform public.notify_auto_member_joined(new.user_id);
    return new;
  end if;
  perform public.notify_approval_request(new.user_id, '가입', '새로 가입했어요. 가입 승인을 기다려요');
  return new;
exception when others then return new;
end $function$;

-- 이미 잘못 나간 알림(최근 3일, 브로제이 등록 회원)은 맞는 안내로 고친다
update public.notifications n
   set title = '🎉 새 회원 · 자동 등록',
       body = split_part(n.body, '님 — ', 1) || '님 — 브로제이에 등록된 회원이라 앱 계정이 자동으로 만들어지고 승인됐어요. 따로 승인할 것은 없어요',
       link = '/manager'
 where n.title = '🔔 승인 요청 · 가입'
   and n.created_at > now() - interval '3 days'
   and exists (
     select 1
       from public.profiles p
       join auth.users u on u.id = p.user_id
      where u.email ~ '^01[0-9]{8,9}@153rankup\.app$'
        and p.is_approved
        and n.body like coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원') || '님 — %'
        and p.created_at > now() - interval '3 days'
   );
