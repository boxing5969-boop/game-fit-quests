-- 🔔 휴대폰 알림 켜기 보상 — 챔피언 머니 500, 한 사람 한 번 (2026-10-15 대표님: "일곱가지 니가 제안하는대로 시작해보자")
--
--   오삼코치 AI 설계 1주차: 휴대폰 알림을 켠 회원이 3명뿐이라, 먼저 '알림 켜기'를 늘린다.
--   · 시범 지점(선릉역점)부터 — is_pilot_member(). 다른 지점은 open=false · 금액 0 (지점을 열면 자동으로 받는다).
--   · 진짜로 켠 기기가 있어야 준다 — push_subscriptions 에 active 구독이 있어야 한다.
--   · 지도진(is_staff)·관리 계정은 0 — 회원용 보상이다 (프로필 사진 보상과 같은 기준).
--   · 지갑은 grant_gems() 로만 움직인다. 기록 테이블은 함수로만 쓴다 (쓰기 정책 없음).
--   · 지급 알림을 notifications 에 넣는다 → 방금 켠 휴대폰으로 첫 푸시가 간다 (켜진 걸 바로 확인).
-- 금액 정본: push_optin_reward() — 바꾸려면 이 함수만 고친다 (앱은 서버가 준 숫자만 보여 준다).

create or replace function public.push_optin_reward()
returns integer
language sql
immutable
set search_path = public
as $$ select 500 $$;

create table if not exists public.push_optin_rewards (
  user_id uuid primary key,
  amount integer not null,
  granted_at timestamptz not null default now()
);

alter table public.push_optin_rewards enable row level security;
revoke all on public.push_optin_rewards from anon;

create policy push_optin_rewards_own_read on public.push_optin_rewards
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 이 사람이 받을 금액 — 시범 지점 회원이 아니거나 지도진·관리 계정이면 0
create or replace function public.push_optin_reward_for(_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_pilot_member(_uid) then 0
    when exists (select 1 from profiles where user_id = _uid and is_staff is true) then 0
    when exists (select 1 from user_roles where user_id = _uid
                   and role in ('super_admin', 'admin', 'branch_manager', 'coach')) then 0
    else public.push_optin_reward()
  end
$$;

-- 내 보상 상태 — 금액 · 받을 수 있는 사람인지 · 받았는지
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
    'eligible', _amount > 0,
    'claimed', exists (select 1 from push_optin_rewards where user_id = _uid)
  );
end;
$$;

-- 보상 받기 — 켜진 기기가 있고 아직 안 받았으면 한 번 지급 (여러 번 불러도 한 번)
create or replace function public.claim_push_optin_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _amount integer;
  _granted boolean := false;
begin
  if _uid is null then raise exception 'Not authorized'; end if;

  _amount := public.push_optin_reward_for(_uid);
  if _amount <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'not_eligible', 'amount', 0);
  end if;
  if not exists (select 1 from push_subscriptions where user_id = _uid and active) then
    return jsonb_build_object('granted', false, 'reason', 'no_subscription', 'amount', _amount);
  end if;

  insert into push_optin_rewards (user_id, amount)
  values (_uid, _amount)
  on conflict (user_id) do nothing
  returning true into _granted;

  if coalesce(_granted, false) then
    perform public.grant_gems(_uid, _amount, '휴대폰 알림 켜기 보상');
    insert into notifications (user_id, title, body, link)
    values (_uid,
            '🔔 알림 켜기 보상',
            '챔피언 머니 +' || to_char(_amount, 'FM999,999,999') || ' 지급! 이제 오삼코치 소식을 휴대폰으로 받아요.',
            '/character-studio');
    return jsonb_build_object('granted', true, 'reason', 'granted', 'amount', _amount);
  end if;

  return jsonb_build_object('granted', false, 'reason', 'already', 'amount', _amount);
end;
$$;

revoke all on function public.push_optin_reward_for(uuid) from public, anon, authenticated;
revoke all on function public.get_my_push_reward() from public, anon;
revoke all on function public.claim_push_optin_reward() from public, anon;
grant execute on function public.get_my_push_reward() to authenticated;
grant execute on function public.claim_push_optin_reward() to authenticated;
