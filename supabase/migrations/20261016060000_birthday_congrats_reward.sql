-- 🎂 생일 축하 보상 (2026-10-16 대표님: "축하를 보낸 회원에게 챔피언머니 보상 주자")
--   축하를 보내면 보낸 회원에게 챔피언 머니 +100 (체육관 출석 보상과 같은 크기).
--   같은 생일 회원에게는 하루 한 번만 보낼 수 있으니 보상도 생일 회원 1명당 하루 1번. 코치(지도진)·테스트 계정은 보상 없음.
--   지급은 grant_gems (지갑 + wallet_transactions '생일 축하 보상').

create or replace function public.send_birthday_congrats(p_receiver uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_me public.profiles%rowtype;
  v_to public.profiles%rowtype;
  v_hq boolean;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 60), '');
  v_id uuid;
  v_sender text;
  v_reward integer := 0;
begin
  if v_uid is null then raise exception '다시 로그인해 주세요'; end if;
  if p_receiver is null or p_receiver = v_uid then raise exception '축하를 보낼 수 없어요'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  select * into v_to from public.profiles where user_id = p_receiver;
  v_hq := exists (select 1 from public.user_roles r where r.user_id = v_uid and r.role::text in ('super_admin', 'admin'));
  -- 오늘 생일이고 오늘 이 지점에 온 회원에게만 (같은 지점 회원 · 본사). 어떤 조건이 틀렸는지는 말하지 않는다.
  if v_to.user_id is null
     or coalesce(v_to.is_staff, false) or coalesce(v_to.is_test_account, false)
     or not public._is_birthday_today(v_to.birth_date)
     or not public._present_today(v_to.user_id, v_to.branch_name)
     or not (v_hq or v_me.branch_name = v_to.branch_name) then
    raise exception '지금은 축하를 보낼 수 없어요';
  end if;

  insert into public.birthday_congrats (receiver_id, sender_id, birthday_on, message)
  values (p_receiver, v_uid, v_today, v_msg)
  on conflict (receiver_id, sender_id, birthday_on) do nothing
  returning id into v_id;

  if v_id is not null then
    v_sender := coalesce(nullif(btrim(v_me.nickname), ''), nullif(btrim(v_me.name), ''), '동료');
    insert into public.notifications (user_id, title, body, link)
    values (p_receiver, '🎂 생일 축하가 도착했어요',
            left(v_sender || '님: ' || coalesce(v_msg, '생일 축하해요! 🎉'), 120), '/');
    -- 보낸 회원 보상 (처음 보낼 때만 — 이미 보낸 사람이면 v_id 가 비어 여기 오지 않는다)
    if not coalesce(v_me.is_staff, false) and not coalesce(v_me.is_test_account, false) then
      v_reward := 100;
      perform public.grant_gems(v_uid, v_reward, '생일 축하 보상');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'already', v_id is null, 'reward', v_reward,
                            'congrats', public._birthday_congrats_today(p_receiver));
end $$;

revoke all on function public.send_birthday_congrats(uuid, text) from public, anon;
grant execute on function public.send_birthday_congrats(uuid, text) to authenticated;
