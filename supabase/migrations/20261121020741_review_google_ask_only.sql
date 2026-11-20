-- 리뷰 미션 — 구글은 보상 없이 부탁만 (2026-11-21 02:07 대표님 「구글은 보상없이 부탁만하자 리뷰가 큰힘이 된다고」)
--   구글 지도 정책은 대가를 준 리뷰를 금지한다 → 구글 칸은 「리뷰가 큰 힘이 돼요」 부탁 + 리뷰 쓰기 버튼만.
--   마일리지 0 · 선물 없음 · 인증 사진 없음 · 「모두 마치면」 세트는 보상이 있는 플랫폼(네이버 · 당근)만 센다.
--   예전 구글 선물(사파이어 바탕 · 별 스티커)은 기본 꾸미기로(free_skin_sapphire · free_sticker_star — 앱 cardDeco.ts).

update public.review_mission_links set mileage = 0 where platform = 'google';

create or replace function public._review_gifts(_platform text)
returns text[]
language sql
immutable
set search_path to 'public'
as $$
  select case _platform
           when 'naver'  then array['skin_emerald', 'sticker_bolt']
           when 'daangn' then array['skin_sunset', 'sticker_heart']
           when 'all'    then array['frame_supporter', 'sticker_crown', 'title_supporter']
           else array[]::text[]
         end
$$;

-- 보상이 있는 미션인가 — 구글은 부탁만
create or replace function public._review_rewarded(_platform text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select _platform in ('naver', 'daangn')
$$;
revoke all on function public._review_rewarded(text) from public, anon, authenticated;

create or replace function public.get_my_review_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text;
  v_list   jsonb;
  v_open   int;
  v_total  int;
  v_done   int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  v_branch := public._review_member_branch(v_uid);
  if v_branch is null then
    return jsonb_build_object('on', false, 'reason', 'not_member');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'platform', l.platform,
           'url', l.url,
           'mileage', case when public._review_rewarded(l.platform) then l.mileage else 0 end,
           'gifts', to_jsonb(public._review_gifts(l.platform)),
           'ask_only', not public._review_rewarded(l.platform),
           'status', coalesce(c.status, 'none'),
           'reject_reason', c.reject_reason,
           'submitted_at', c.submitted_at,
           'decided_at', c.decided_at,
           'reward_mileage', c.reward_mileage
         ) order by array_position(array['naver', 'daangn', 'google'], l.platform)), '[]'::jsonb),
         count(*),
         count(*) filter (where public._review_rewarded(l.platform)),
         count(*) filter (where public._review_rewarded(l.platform) and c.status = 'approved')
    into v_list, v_open, v_total, v_done
    from public.review_mission_links l
    left join public.review_mission_claims c on c.user_id = v_uid and c.platform = l.platform
   where l.branch_name = v_branch and l.enabled and l.url is not null;

  return jsonb_build_object(
    'on', v_open > 0,
    'branch', v_branch,
    'missions', v_list,
    'all_gifts', case when v_total >= 2 then to_jsonb(public._review_gifts('all')) else '[]'::jsonb end,
    'all_done', v_total > 0 and v_done >= v_total,
    'done', v_done,
    'total', v_total
  );
end $$;

create or replace function public.review_mission_submit(p_platform text, p_proof_path text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text := public._review_member_branch(auth.uid());
  v_status text;
  v_name   text;
  v_staff  uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v_branch is null then
    raise exception '회원만 참여할 수 있어요' using errcode = '42501';
  end if;
  if not public._review_rewarded(p_platform) then
    raise exception '구글 리뷰는 인증 없이 남겨 주시면 돼요';
  end if;
  if p_proof_path is null or p_proof_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception '인증 사진을 다시 올려 주세요';
  end if;
  if not exists (select 1 from public.review_mission_links l
                  where l.branch_name = v_branch and l.platform = p_platform and l.enabled and l.url is not null) then
    raise exception '지금은 이 미션이 닫혀 있어요';
  end if;
  select c.status into v_status from public.review_mission_claims c where c.user_id = v_uid and c.platform = p_platform;
  if v_status = 'approved' then
    return jsonb_build_object('status', 'approved', 'already', true);
  end if;

  insert into public.review_mission_claims (user_id, branch_name, platform, status, proof_path, note, submitted_at, reject_reason)
  values (v_uid, v_branch, p_platform, 'submitted', p_proof_path, left(nullif(btrim(coalesce(p_note, '')), ''), 200), now(), null)
  on conflict (user_id, platform) do update
     set status = 'submitted', proof_path = excluded.proof_path, note = excluded.note,
         submitted_at = now(), reject_reason = null, branch_name = excluded.branch_name;

  select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') into v_name
    from public.profiles p where p.user_id = v_uid;
  for v_staff in
    select p.user_id from public.profiles p
     where p.branch_name = v_branch and p.user_id is not null and public.has_role(p.user_id, 'branch_manager')
  loop
    perform public._review_notify(v_staff, '리뷰 미션 확인 요청',
      v_name || '님이 ' || public._review_platform_ko(p_platform) || ' 리뷰 인증 사진을 올렸어요. 확인하고 승인해 주세요.',
      '/manager?review=1');
  end loop;
  return jsonb_build_object('status', 'submitted');
end $$;

create or replace function public.review_mission_link_save(p_branch text, p_platform text, p_url text, p_enabled boolean, p_mileage integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_scope  text := public._goods_staff_scope();
  v_branch text;
  v_url    text := nullif(btrim(coalesce(p_url, '')), '');
  v_mile   int := case when public._review_rewarded(p_platform) then p_mileage else 0 end;
begin
  if v_scope <> '*' and not public.has_role(auth.uid(), 'branch_manager') then
    raise exception '지점장님 · 관리자만 바꿀 수 있어요' using errcode = '42501';
  end if;
  v_branch := case when v_scope = '*' then nullif(btrim(coalesce(p_branch, '')), '') else v_scope end;
  if v_branch is null or not exists (select 1 from public.branches b where b.name = v_branch) then
    raise exception '지점을 찾을 수 없어요';
  end if;
  if p_platform not in ('naver', 'google', 'daangn') then
    raise exception '플랫폼이 잘못됐어요';
  end if;
  if v_url is not null and (v_url !~ '^https://[^ ]+$' or length(v_url) > 500) then
    raise exception '주소는 https:// 로 시작하는 링크로 넣어 주세요';
  end if;
  if v_mile is null or v_mile < 0 or v_mile > 50000 then
    raise exception '마일리지는 0 ~ 50,000점으로 넣어 주세요';
  end if;
  insert into public.review_mission_links (branch_name, platform, url, enabled, mileage, updated_by, updated_at)
  values (v_branch, p_platform, v_url, coalesce(p_enabled, true), v_mile, auth.uid(), now())
  on conflict (branch_name, platform) do update
     set url = excluded.url, enabled = excluded.enabled, mileage = excluded.mileage,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return public.review_mission_admin_board(v_branch);
end $$;

create or replace function public.review_mission_decide(p_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_scope   text := public._goods_staff_scope();
  v_c       public.review_mission_claims;
  v_mileage int;
  v_item    text;
  v_total   int;
  v_done    int;
  v_bonus   boolean := false;
  v_pk      text;
begin
  select * into v_c from public.review_mission_claims where id = p_id for update;
  if v_c.id is null then
    raise exception '찾을 수 없어요';
  end if;
  if v_scope <> '*' and v_scope <> v_c.branch_name then
    raise exception '우리 지점 미션만 확인할 수 있어요' using errcode = '42501';
  end if;
  if v_c.status = 'approved' then
    return jsonb_build_object('status', 'approved', 'already', true);
  end if;
  if v_c.status <> 'submitted' then
    raise exception '확인 요청이 들어온 미션만 정할 수 있어요';
  end if;
  if not public._review_rewarded(v_c.platform) then
    raise exception '구글 리뷰는 보상 없이 부탁만 해요';
  end if;
  v_pk := public._review_platform_ko(v_c.platform);

  if not coalesce(p_approve, false) then
    update public.review_mission_claims
       set status = 'rejected', decided_at = now(), decided_by = auth.uid(),
           reject_reason = left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '인증 사진에서 리뷰를 확인하지 못했어요'), 120)
     where id = v_c.id;
    perform public._review_notify(v_c.user_id, v_pk || ' 리뷰 미션 · 다시 올려 주세요',
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '인증 사진에서 리뷰를 확인하지 못했어요') || ' · 리뷰가 보이게 다시 찍어 올려 주시면 바로 확인할게요.',
      '/home?sheet=review');
    return jsonb_build_object('status', 'rejected');
  end if;

  select coalesce(l.mileage, 3000) into v_mileage
    from public.review_mission_links l where l.branch_name = v_c.branch_name and l.platform = v_c.platform;
  v_mileage := coalesce(v_mileage, 3000);

  update public.review_mission_claims
     set status = 'approved', decided_at = now(), decided_by = auth.uid(), reject_reason = null, reward_mileage = v_mileage
   where id = v_c.id;

  if v_mileage > 0 then
    perform public.grant_mileage(v_c.user_id, 'adjust', v_mileage, '리뷰 미션 · ' || v_pk || ' 리뷰',
                                 'review:' || v_c.platform || ':' || v_c.user_id::text, v_c.id);
  end if;
  foreach v_item in array public._review_gifts(v_c.platform) loop
    insert into public.card_deco_owned (user_id, item_id, source) values (v_c.user_id, v_item, 'review_' || v_c.platform)
    on conflict (user_id, item_id) do nothing;
  end loop;

  -- 보상이 있는 미션(네이버 · 당근)을 모두 마치면 서포터 세트
  select count(*) into v_total from public.review_mission_links l
   where l.branch_name = v_c.branch_name and l.enabled and l.url is not null and public._review_rewarded(l.platform);
  select count(*) into v_done from public.review_mission_claims rc
    join public.review_mission_links l on l.branch_name = v_c.branch_name and l.platform = rc.platform and l.enabled and l.url is not null
   where rc.user_id = v_c.user_id and rc.status = 'approved' and public._review_rewarded(rc.platform);
  if v_total >= 2 and v_done >= v_total then
    foreach v_item in array public._review_gifts('all') loop
      insert into public.card_deco_owned (user_id, item_id, source) values (v_c.user_id, v_item, 'review_all')
      on conflict (user_id, item_id) do nothing;
      if found then v_bonus := true; end if;
    end loop;
  end if;

  perform public._review_notify(v_c.user_id, v_pk || ' 리뷰 미션 완료 · 선물이 도착했어요',
    case when v_mileage > 0 then '153 마일리지 ' || to_char(v_mileage, 'FM999,999') || '점 · ' else '' end
      || '카드 꾸미기 선물을 받았어요.'
      || case when v_bonus then ' 리뷰 미션을 모두 마쳐 153 서포터 세트도 열렸어요.' else '' end
      || ' 내 카드를 꾸며 보세요.',
    '/home?sheet=card-deco');
  return jsonb_build_object('status', 'approved', 'mileage', v_mileage, 'bonus', v_bonus);
end $$;
