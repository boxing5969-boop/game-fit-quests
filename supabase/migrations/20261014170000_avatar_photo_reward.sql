-- 📸 프로필 사진 첫 등록 보상 — 챔피언 머니(예전 파이트 머니) 5,000 (2026-10-14 대표님: "사진을 올리면 파이트머니 많이 보상하자")
--
--   · 한 사람에 한 번 — 사진을 바꿔도, 지웠다 다시 올려도 다시 주지 않는다 (user_id 가 기본키).
--   · 진짜로 올린 사진만 — profiles.avatar_url 이 내 폴더(avatars/{내 id}/…)를 가리키고 저장소에 파일이 있어야 한다.
--   · 지도진(is_staff)·관리 계정은 0 — 회원용 보상이다 (붕대 감기 보상과 같은 기준).
--   · 이미 사진을 올려 둔 회원도 앱을 열면 한 번 받는다 (앱이 claim 을 부른다).
--   · 지갑은 grant_gems() 로만 움직인다 (직접 update 금지 규칙). 기록 테이블은 함수로만 쓴다 (쓰기 정책 없음).
-- 금액 정본: avatar_photo_reward() — 바꾸려면 이 함수만 고친다 (앱은 서버가 준 숫자만 보여 준다).

create or replace function public.avatar_photo_reward()
returns integer
language sql
immutable
set search_path = public
as $$ select 5000 $$;

create table if not exists public.avatar_photo_rewards (
  user_id uuid primary key,
  amount integer not null,
  granted_at timestamptz not null default now()
);

alter table public.avatar_photo_rewards enable row level security;
revoke all on public.avatar_photo_rewards from anon;

do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avatar_photo_rewards'
                   and policyname = 'avatar_photo_rewards_own_read') then
    create policy avatar_photo_rewards_own_read on public.avatar_photo_rewards
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$p$;

-- 이 사람이 받을 금액 — 지도진·관리 계정이면 0
create or replace function public.avatar_photo_reward_for(_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from profiles where user_id = _uid and is_staff is true) then 0
    when exists (select 1 from user_roles where user_id = _uid
                   and role in ('super_admin', 'admin', 'branch_manager', 'coach')) then 0
    else public.avatar_photo_reward()
  end
$$;

-- 내 폴더에 진짜로 올린 사진이 있나
create or replace function public.avatar_photo_uploaded(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from profiles p
            where p.user_id = _uid
              and position('/storage/v1/object/public/avatars/' || _uid::text || '/' in coalesce(p.avatar_url, '')) > 0
         )
     and exists (
           select 1 from storage.objects o
            where o.bucket_id = 'avatars' and o.name like _uid::text || '/%'
         )
$$;

-- 내 보상 상태 — 금액 · 받았는지 · 받을 수 있는 사람인지 · 사진이 있는지
create or replace function public.get_my_avatar_reward()
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
  _amount := public.avatar_photo_reward_for(_uid);
  return jsonb_build_object(
    'amount', public.avatar_photo_reward(),
    'eligible', _amount > 0,
    'claimed', exists (select 1 from avatar_photo_rewards where user_id = _uid),
    'hasPhoto', public.avatar_photo_uploaded(_uid)
  );
end;
$$;

-- 보상 받기 — 사진이 있고 아직 안 받았으면 한 번 지급 (여러 번 불러도 한 번)
create or replace function public.claim_avatar_photo_reward()
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

  _amount := public.avatar_photo_reward_for(_uid);
  if _amount <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'not_eligible', 'amount', 0);
  end if;
  if not public.avatar_photo_uploaded(_uid) then
    return jsonb_build_object('granted', false, 'reason', 'no_photo', 'amount', _amount);
  end if;

  insert into avatar_photo_rewards (user_id, amount)
  values (_uid, _amount)
  on conflict (user_id) do nothing
  returning true into _granted;

  if coalesce(_granted, false) then
    perform public.grant_gems(_uid, _amount, '프로필 사진 첫 등록 보상');
    insert into notifications (user_id, title, body, link)
    values (_uid,
            '📸 프로필 사진 등록 보상',
            '챔피언 머니 +' || to_char(_amount, 'FM999,999,999') || ' 지급! 캐릭터 꾸미기에서 쓸 수 있어요.',
            '/character-studio');
    return jsonb_build_object('granted', true, 'reason', 'granted', 'amount', _amount);
  end if;

  return jsonb_build_object('granted', false, 'reason', 'already', 'amount', _amount);
end;
$$;

revoke all on function public.avatar_photo_reward_for(uuid) from public, anon, authenticated;
revoke all on function public.avatar_photo_uploaded(uuid) from public, anon, authenticated;
revoke all on function public.get_my_avatar_reward() from public, anon;
revoke all on function public.claim_avatar_photo_reward() from public, anon;
grant execute on function public.get_my_avatar_reward() to authenticated;
grant execute on function public.claim_avatar_photo_reward() to authenticated;
