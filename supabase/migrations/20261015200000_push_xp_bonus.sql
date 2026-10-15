-- 🔔 알림 켜기 XP 보상 (2026-10-15 대표님: "푸시 알림을 켜 놓으면 보상을 더 주자 — 랭킹에 도움이 되는 XP")
--   · 처음 켤 때 +50 XP (챔피언 머니 500 과 함께, 한 사람 한 번 — push_optin_rewards 한 줄이 기준)
--   · 켜 둔 동안 체육관 출석하는 날마다 +3 XP '알림 회원 출석 보너스' (하루 1번)
--     조건: 받을 수 있는 회원(push_optin_reward_for > 0 — 시범 지점 · 회원) + 켜진 기기가 있고
--           최근 14일 안에 그 기기로 알림이 실제로 갔거나(last_success_at) 켜진 지 14일 안 — '켜고 폰에서 막아 둔' 기기는 빠진다
--   · PT 회원은 기존 PT 2배 규칙(pt_xp_bonus_trg)이 그대로 따라붙는다
-- 금액 정본: push_optin_xp() · push_member_bonus_xp()

create or replace function public.push_optin_xp() returns integer language sql immutable set search_path = public as $$ select 50 $$;
create or replace function public.push_member_bonus_xp() returns integer language sql immutable set search_path = public as $$ select 3 $$;

-- 알림이 '살아 있는' 기기가 있는지
create or replace function public.has_live_push(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.push_subscriptions s
     where s.user_id = _uid and s.active
       and coalesce(s.last_success_at, s.created_at) >= now() - interval '14 days'
  )
$$;
revoke all on function public.has_live_push(uuid) from public, anon, authenticated;

-- XP 한 줄 넣기 (다른 기능과 같은 방식: xp_logs + member_progress.total_xp)
create or replace function public._grant_push_xp(_uid uuid, _amount integer, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.xp_logs (user_id, amount, reason) values (_uid, _amount, _reason);
  update public.member_progress set total_xp = coalesce(total_xp, 0) + _amount, updated_at = now() where user_id = _uid;
end $$;
revoke all on function public._grant_push_xp(uuid, integer, text) from public, anon, authenticated;

create or replace function public.get_my_push_reward()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _amount integer;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  _amount := public.push_optin_reward_for(_uid);
  return jsonb_build_object(
    'amount', _amount,
    'xp', case when _amount > 0 then public.push_optin_xp() else 0 end,
    'daily_xp', case when _amount > 0 then public.push_member_bonus_xp() else 0 end,
    'eligible', _amount > 0,
    'claimed', exists (select 1 from push_optin_rewards where user_id = _uid)
  );
end;
$$;

create or replace function public.claim_push_optin_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _amount integer;
  _xp integer := public.push_optin_xp();
  _granted boolean := false;
begin
  if _uid is null then raise exception 'Not authorized'; end if;

  _amount := public.push_optin_reward_for(_uid);
  if _amount <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'not_eligible', 'amount', 0, 'xp', 0);
  end if;
  if not exists (select 1 from push_subscriptions where user_id = _uid and active) then
    return jsonb_build_object('granted', false, 'reason', 'no_subscription', 'amount', _amount, 'xp', _xp);
  end if;

  insert into push_optin_rewards (user_id, amount)
  values (_uid, _amount)
  on conflict (user_id) do nothing
  returning true into _granted;

  if coalesce(_granted, false) then
    perform public.grant_gems(_uid, _amount, '휴대폰 알림 켜기 보상');
    perform public._grant_push_xp(_uid, _xp, '알림 켜기 보상');
    insert into notifications (user_id, title, body, link)
    values (_uid,
            '🔔 알림 켜기 보상',
            '챔피언 머니 +' || to_char(_amount, 'FM999,999,999') || ' · XP +' || _xp
              || ' 지급! 알림을 켜 두면 체육관 출석할 때마다 XP +' || public.push_member_bonus_xp() || '를 더 받아요.',
            '/halloffame');
    return jsonb_build_object('granted', true, 'reason', 'granted', 'amount', _amount, 'xp', _xp);
  end if;

  return jsonb_build_object('granted', false, 'reason', 'already', 'amount', _amount, 'xp', _xp);
end;
$$;

revoke all on function public.get_my_push_reward() from public, anon;
revoke all on function public.claim_push_optin_reward() from public, anon;
grant execute on function public.get_my_push_reward() to authenticated;
grant execute on function public.claim_push_optin_reward() to authenticated;

-- 체육관 출석하는 날마다 +3 XP (하루 1번)
create or replace function public.attendance_push_bonus_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if new.user_id is null or new.checked_in_at < now() - interval '1 day' then return new; end if;
  if public.push_optin_reward_for(new.user_id) <= 0 then return new; end if;
  if not public.has_live_push(new.user_id) then return new; end if;
  if exists (select 1 from public.xp_logs x
              where x.user_id = new.user_id and x.reason = '알림 회원 출석 보너스' and x.created_at >= _day_start) then
    return new;
  end if;
  perform public._grant_push_xp(new.user_id, public.push_member_bonus_xp(), '알림 회원 출석 보너스');
  return new;
exception when others then
  return new;  -- 보너스가 실패해도 출석은 그대로
end $$;

do $$ begin
  create trigger attendance_push_bonus
    after insert on public.attendance_logs
    for each row
    when (new.is_duplicate is not true and new.method = any (array['broj', 'face', 'qr_manual']))
    execute function public.attendance_push_bonus_trg();
exception when duplicate_object then null;
end $$;
