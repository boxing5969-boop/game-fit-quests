-- 초대 링크에 초대 코드 (2026-10-19 대표님 "4번 진행")
--   예전: 초대 기록을 먼저 남긴 사람이 보상을 받았다 — 링크를 실제로 누가 보냈는지와 상관없이.
--   이제: 초대 링크에 초대한 사람의 코드가 들어간다(https://myboxer153.com/?inv=<코드>).
--         초대받은 회원이 그 링크로 들어와 처음 로그인했을 때, 그 코드 주인이 그 회원을 미리 초대해 둔 경우에만
--         코드 주인에게 챔피언 머니 1,000 (한 달 20번까지). 링크 없이 들어오면 보상 없이 초대 기록만 닫는다.
--   예전 claim_invite_reward() 는 코드 없이 부른 것으로 본다 (캐시된 옛 화면 호환 — 보상 없음).

create table if not exists public.member_invite_codes (
  user_id uuid primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.member_invite_codes enable row level security;
revoke all on table public.member_invite_codes from anon, authenticated;

-- 내 초대 코드 (없으면 만든다) — 8자리 영문 대문자·숫자
create or replace function public.get_my_invite_code()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  select c.code into v_code from public.member_invite_codes c where c.user_id = v_uid;
  if v_code is not null then
    return v_code;
  end if;
  loop
    v_try := v_try + 1;
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      insert into public.member_invite_codes (user_id, code) values (v_uid, v_code);
      return v_code;
    exception when unique_violation then
      -- 같은 순간 내 코드가 먼저 만들어졌으면 그걸 쓴다, 아니면 다른 코드로 다시
      select c.code into v_code from public.member_invite_codes c where c.user_id = v_uid;
      if v_code is not null then
        return v_code;
      end if;
      if v_try >= 5 then
        raise;
      end if;
    end;
  end loop;
end $$;
revoke all on function public.get_my_invite_code() from public, anon;
grant execute on function public.get_my_invite_code() to authenticated;

-- 초대 보상 — 들어온 링크의 코드로 (done = 이 계정의 초대 확인이 끝났다 → 앱은 저장해 둔 코드를 지운다)
create or replace function public.claim_invite_reward_v2(p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_phone text;
  v_created timestamptz;
  v_inviter uuid;
  v_inv public.member_invites%rowtype;
  v_cnt int;
  v_rewarded boolean := false;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  -- 아직 로그인 전이거나 승인·계정 합치기 전 — 코드는 앱에 남겨 두고 다음에 다시
  if v_uid is null or not public._is_active_member(v_uid) then
    return jsonb_build_object('success', true, 'rewarded', false, 'done', false);
  end if;

  select nullif(regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g'), ''), u.created_at
    into v_phone, v_created
    from public.profiles p join auth.users u on u.id = p.user_id
   where p.user_id = v_uid;

  if v_code is not null then
    select c.user_id into v_inviter from public.member_invite_codes c where c.code = v_code;
  end if;

  -- 그 코드 주인이 나를 미리 초대해 둔 기록 (아직 닫히지 않은 것)
  if v_inviter is not null and v_inviter <> v_uid then
    select i.* into v_inv
      from public.member_invites i
     where i.inviter_user_id = v_inviter and i.joined_at is null
       and (i.invitee_user_id = v_uid
            or (v_phone is not null and i.invitee_phone = v_phone and v_created > i.created_at))
     order by i.created_at asc
     limit 1
     for update;
  end if;

  -- 내게 온 초대는 모두 '들어옴'으로 닫는다 — 링크 없이 들어와도 (나중에 다른 링크로 보상을 가져가지 못하게)
  update public.member_invites i
     set joined_at = now(), joined_user_id = v_uid
   where i.joined_at is null
     and (i.invitee_user_id = v_uid
          or (v_phone is not null and i.invitee_phone = v_phone and v_created > i.created_at));

  if v_inv.id is null then
    return jsonb_build_object('success', true, 'rewarded', false, 'done', true);
  end if;

  perform pg_advisory_xact_lock(hashtext('invite_reward:' || v_inv.inviter_user_id::text));
  if public._is_active_member(v_inv.inviter_user_id) then
    select count(*) into v_cnt from public.member_invites i
     where i.inviter_user_id = v_inv.inviter_user_id and i.rewarded and i.joined_at >= v_month_start;
    if v_cnt < 20 then
      perform public.grant_gems(v_inv.inviter_user_id, 1000, '친구 초대 보상');
      update public.member_invites set rewarded = true, reward_amount = 1000 where id = v_inv.id;
      insert into public.notifications (user_id, title, body, link)
      values (v_inv.inviter_user_id,
              '🎉 ' || coalesce(public._community_display_name(v_uid), '회원') || '님이 앱에 들어왔어요',
              '초대 링크로 들어와서 챔피언 머니 +1,000을 받았어요. 운동 짝꿍도 신청해 보세요!',
              '/myboxer/community');
      v_rewarded := true;
    end if;
  end if;

  return jsonb_build_object('success', true, 'rewarded', v_rewarded, 'done', true,
                            'inviter', public._community_display_name(v_inv.inviter_user_id));
end $$;
revoke all on function public.claim_invite_reward_v2(text) from public, anon;
grant execute on function public.claim_invite_reward_v2(text) to authenticated;

-- 예전 함수 — 코드 없이 부른 것과 같다 (보상 없음, 초대 기록만 닫는다)
create or replace function public.claim_invite_reward()
returns jsonb
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.claim_invite_reward_v2(null);
$$;
