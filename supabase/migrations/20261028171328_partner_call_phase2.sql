-- 운동 모집('오늘 같이 해요') 2단계 — 미리보기용 (2026-10-28 대표님 "추천대로가자" · 보고서 단계별 계획 2단계)
--   미리보기 단계 규칙: 새 칸 · 새 표 · 새 함수만 더한다. 지금 앱(main)이 쓰는 함수(get/create/join_partner_call)는 그대로.
--   예약 작업(1시간 전 알림 · 끝난 뒤 묻기)은 여기서 만들지 않는다 — 대표님 확인 뒤 _on 마이그레이션에서 켠다.
--
--   · '지금' 모집 — 체육관에 있을 때 30분짜리 (expires_at). 저요가 없으면 30분 뒤 목록에서 빠진다
--   · 코치님 모집 정원 (capacity, 코치님 · 운영진만) — 다 차면 '마감'
--   · '같이 했어요' — 올린 사람과 저요한 사람이 둘 다 누르면 서로 153(그날 첫 출석 카드에) + 각자 챔피언 머니 +30(하루 1번, 회원만)
--   · partner_call_tick() — ① 시작 1시간 전 올린 사람 · 저요한 사람에게 '곧 같이 운동해요' ② 끝나고 1시간 뒤 '같이 운동했나요?'
--     (사람마다 한 번, 밤 10시 ~ 아침 7시는 알림함에만, 커뮤니티 알림 스위치 · cheer_notify 를 따른다)

-- ── 새 칸
alter table public.boxing_partner_calls add column if not exists expires_at timestamptz;
alter table public.boxing_partner_calls add column if not exists capacity integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'boxing_partner_calls_capacity_chk') then
    alter table public.boxing_partner_calls
      add constraint boxing_partner_calls_capacity_chk check (capacity is null or capacity between 2 and 30);
  end if;
end $$;
comment on column public.boxing_partner_calls.expires_at is '''지금'' 모집 — 이 시각까지(올린 뒤 30분). null 이면 그날 하루';
comment on column public.boxing_partner_calls.capacity is '코치님 모집 정원 — null 이면 제한 없음';

-- ── 알림 한 번만: 종류 더하기 (remind = 1시간 전 · ask = 끝난 뒤 묻기)
alter table public.boxing_partner_call_notes drop constraint if exists boxing_partner_call_notes_kind_chk;
alter table public.boxing_partner_call_notes
  add constraint boxing_partner_call_notes_kind_chk check (kind in ('join', 'remind', 'ask'));

-- ── '같이 했어요'
create table if not exists public.boxing_partner_call_done (
  call_id uuid not null references public.boxing_partner_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
alter table public.boxing_partner_call_done enable row level security;
revoke all on public.boxing_partner_call_done from anon, authenticated;

-- ── 말 만들기 (서버 알림 글 · 화면 src/lib/partnerCallTime.ts formatHour 와 같은 말)
create or replace function public._partner_when(p_slot_hour integer, p_expires_at timestamptz)
 returns text
 language sql
 immutable
as $function$
  select case when p_expires_at is not null then '지금'
              when p_slot_hour < 12 then '오전 ' || p_slot_hour || '시'
              when p_slot_hour = 12 then '낮 12시'
              else '오후 ' || (p_slot_hour - 12) || '시' end;
$function$;

create or replace function public._partner_what(p_purpose text)
 returns text
 language sql
 immutable
as $function$
  select case p_purpose when 'mitt' then '미트' when 'sparring' then '스파링'
                        when 'jump' then '줄넘기' else '같이 운동' end;
$function$;

-- ── 오늘 모집 목록 (2단계)
create or replace function public.get_partner_calls_v2()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_kind text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_usual int;
  v_need_nick boolean;
  v_at_gym boolean;
  v_pairs_today int := 0;
  v_calls jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    return jsonb_build_object('success', false, 'reason', 'not_active', 'calls', '[]'::jsonb);
  end if;
  v_branch := public.boxing_community_my_branch();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'calls', '[]'::jsonb);
  end if;
  v_kind := coalesce(public._dm_kind(v_uid), 'member');

  -- 내가 평소 오는 시간 — 최근 60일 출석이 가장 많은 시각(3번 이상 왔을 때만)
  select t.h into v_usual
    from (select extract(hour from (a.checked_in_at at time zone 'Asia/Seoul'))::int as h,
                 count(*) as n,
                 sum(count(*)) over () as total
            from public.attendance_logs a
           where a.user_id = v_uid
             and coalesce(a.is_duplicate, false) = false
             and a.checked_in_at >= now() - interval '60 days'
           group by 1) t
   where t.total >= 3 and t.h between 5 and 23
   order by t.n desc, t.h desc
   limit 1;

  select v_kind = 'member' and coalesce(btrim(p.nickname), '') = ''
    into v_need_nick
    from public.profiles p where p.user_id = v_uid;

  -- 지금 체육관에 있나 — 3시간 안에 출석했으면 '지금' 칩을 먼저 보인다
  v_at_gym := exists (select 1 from public.attendance_logs a
                       where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false
                         and a.checked_in_at > now() - interval '3 hours' and a.checked_in_at <= now());

  -- 오늘 같이 운동한 짝 (올린 사람과 저요한 사람이 둘 다 '같이 했어요')
  select count(*)::int into v_pairs_today
    from public.boxing_partner_calls c
    join public.boxing_partner_call_done pd on pd.call_id = c.id and pd.user_id = c.user_id
    join public.boxing_partner_call_done jd on jd.call_id = c.id and jd.user_id <> c.user_id
   where c.call_date = v_today
     and ((v_all and public.is_branch_visible(c.branch_name)) or c.branch_name = v_branch);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'userId', c.user_id,
           'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
           'avatarUrl', p.avatar_url,
           'isStaff', coalesce(public._dm_kind(c.user_id), 'member') in ('coach', 'hq'),
           'staffTitle', p.staff_title,
           'branch', c.branch_name,
           'isMine', c.user_id = v_uid,
           'slotHour', c.slot_hour,
           'purpose', c.purpose,
           'note', c.note,
           'rank', coalesce(mp.current_rank::text, 'white'),
           'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
           'joinCount', coalesce(j.cnt, 0),
           'joined', coalesce(j.me, false),
           'joiners', coalesce(j.people, '[]'::jsonb),
           'isNow', c.expires_at is not null,
           'expiresAt', c.expires_at,
           'capacity', c.capacity,
           'full', c.capacity is not null and coalesce(j.cnt, 0) >= c.capacity,
           'started', c.expires_at is not null or v_hour >= c.slot_hour,
           'joinable', case when c.expires_at is not null then c.expires_at > now() else v_hour <= c.slot_hour end,
           'myDone', coalesce(d.me, false),
           'doneUsers', coalesce(d.users, '[]'::jsonb),
           'pairs', case when coalesce(d.poster, false) then coalesce(d.others, 0) else 0 end
         ) order by (c.expires_at is null), c.slot_hour, c.created_at), '[]'::jsonb)
    into v_calls
    from public.boxing_partner_calls c
    join public.profiles p on p.user_id = c.user_id
    left join public.member_progress mp on mp.user_id = c.user_id
    left join lateral (
      select count(*)::int as cnt,
             bool_or(x.user_id = v_uid) as me,
             jsonb_agg(jsonb_build_object(
               'userId', x.user_id,
               'nickname', coalesce(nullif(btrim(xp.nickname), ''), nullif(btrim(xp.name), ''), '회원'),
               'avatarUrl', xp.avatar_url
             ) order by x.created_at) as people
        from public.boxing_partner_call_joins x
        join public.profiles xp on xp.user_id = x.user_id
       where x.call_id = c.id
    ) j on true
    left join lateral (
      select bool_or(y.user_id = v_uid) as me,
             bool_or(y.user_id = c.user_id) as poster,
             (count(*) filter (where y.user_id <> c.user_id))::int as others,
             jsonb_agg(y.user_id) as users
        from public.boxing_partner_call_done y
       where y.call_id = c.id
    ) d on true
   where ((v_all and public.is_branch_visible(c.branch_name)) or c.branch_name = v_branch)
     and c.call_date = v_today
     and c.status = 'open'
     -- '지금' 모집은 30분이 지나면 빠진다 — 저요가 있었으면 '같이 했어요'를 누를 수 있게 남긴다
     and (c.expires_at is null or c.expires_at > now() or coalesce(j.cnt, 0) > 0);

  return jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'all_branches', v_all,
    'usualHour', v_usual,
    'canSpar', v_kind in ('coach', 'hq'),
    'canCapacity', v_kind in ('coach', 'hq'),
    'needsNickname', coalesce(v_need_nick, false),
    'atGym', v_at_gym,
    'pairsToday', v_pairs_today,
    'calls', v_calls
  );
end;
$function$;

-- ── 모집 올리기 · 바꾸기 (2단계 — '지금' · 정원)
create or replace function public.create_partner_call_v2(
  p_purpose text,
  p_slot_hour integer,
  p_note text default null::text,
  p_now boolean default false,
  p_capacity integer default null::integer
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_kind text;
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_slot int := p_slot_hour;
  v_expires timestamptz;
  v_cap int;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 모집을 올릴 수 있어요';
  end if;

  v_branch := public.boxing_community_my_branch();
  if v_branch is null or length(trim(v_branch)) = 0 then
    raise exception '지점 정보가 없어 모집 글을 올릴 수 없습니다 — 데스크에 문의해 주세요';
  end if;

  if p_purpose not in ('mitt','sparring','jump','together') then
    raise exception '모집 종류가 올바르지 않습니다';
  end if;

  -- '지금' 모집 — 지금 시각으로, 30분 동안
  if coalesce(p_now, false) then
    if v_hour < 5 or v_hour > 23 then
      raise exception '지금은 모집할 수 없는 시간이에요 (오전 5시 ~ 오후 11시)';
    end if;
    v_slot := v_hour;
    v_expires := now() + interval '30 minutes';
  end if;
  if v_slot is null or v_slot < 5 or v_slot > 23 then
    raise exception '시간은 오전 5시부터 오후 11시 사이로 골라주세요';
  end if;

  v_kind := coalesce(public._dm_kind(v_uid), 'member');

  if p_purpose = 'sparring' and v_kind not in ('coach', 'hq') then
    raise exception '스파링은 코치님이 여는 모집으로만 해요. 미트 · 같이 운동은 지금 올릴 수 있어요';
  end if;

  if v_kind = 'member'
     and coalesce(btrim((select p.nickname from public.profiles p where p.user_id = v_uid)), '') = '' then
    raise exception '닉네임을 먼저 정해 주세요 — 모집에 보이는 이름이에요';
  end if;

  -- 정원은 코치님 · 운영진 모집만 (회원 모집은 제한 없음)
  if p_capacity is not null and v_kind in ('coach', 'hq') then
    if p_capacity < 2 or p_capacity > 30 then
      raise exception '정원은 2명부터 30명까지예요';
    end if;
    v_cap := p_capacity;
  end if;

  insert into public.boxing_partner_calls (user_id, branch_name, call_date, slot_hour, purpose, note, expires_at, capacity)
  values (v_uid, v_branch, v_today, v_slot, p_purpose, nullif(btrim(coalesce(p_note,'')), ''), v_expires, v_cap)
  on conflict (user_id, call_date) do update
    set slot_hour  = excluded.slot_hour,
        purpose    = excluded.purpose,
        note       = excluded.note,
        expires_at = excluded.expires_at,
        capacity   = excluded.capacity,
        status     = 'open',
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('success', true, 'call_id', v_id);
end; $function$;

-- ── 저요 (2단계 — 끝난 '지금' 모집 · 지난 시간 · 정원)
create or replace function public.join_partner_call_v2(p_call_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_call record;
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_cnt int;
  v_n int;
  v_name text;
  v_push boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 참여할 수 있어요';
  end if;
  v_branch := public.boxing_community_my_branch();

  -- 정원을 셀 때 두 사람이 동시에 눌러도 넘치지 않게 모집 줄을 잠근다
  select * into v_call from public.boxing_partner_calls
   where id = p_call_id and status = 'open'
     and call_date = (now() at time zone 'Asia/Seoul')::date
   for update;
  if not found then raise exception '이미 마감된 모집입니다'; end if;
  if v_call.branch_name is distinct from v_branch then
    raise exception '다른 지점의 모집에는 참여할 수 없습니다';
  end if;
  if v_call.user_id = v_uid then raise exception '본인이 올린 모집입니다'; end if;
  if exists (select 1 from public.boxing_partner_call_joins j where j.call_id = p_call_id and j.user_id = v_uid) then
    return jsonb_build_object('success', true);
  end if;
  if v_call.expires_at is not null and v_call.expires_at <= now() then
    raise exception '이미 끝난 모집이에요';
  end if;
  if v_call.expires_at is null and v_hour > v_call.slot_hour then
    raise exception '이미 지난 모집이에요';
  end if;
  if v_call.capacity is not null then
    select count(*)::int into v_cnt from public.boxing_partner_call_joins j where j.call_id = p_call_id;
    if v_cnt >= v_call.capacity then raise exception '정원이 다 찼어요'; end if;
  end if;

  insert into public.boxing_partner_call_joins (call_id, user_id)
  values (p_call_id, v_uid)
  on conflict (call_id, user_id) do nothing;

  -- 올린 사람에게 알림 (1단계와 같은 규칙 — 같은 모집 · 같은 사람은 한 번만)
  begin
    insert into public.boxing_partner_call_notes (call_id, user_id, kind)
    values (p_call_id, v_uid, 'join')
    on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0
       and public._community_notify_since() is not null
       and coalesce((select p.cheer_notify from public.profiles p where p.user_id = v_call.user_id), true) then
      select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
        into v_name from public.profiles p where p.user_id = v_uid;
      v_push := extract(hour from (now() at time zone 'Asia/Seoul')) between 7 and 21;
      insert into public.notifications (user_id, title, body, link, pushed_at)
      values (
        v_call.user_id,
        '🙋 ' || coalesce(v_name, '동료') || '님이 저요! 했어요',
        case when v_call.expires_at is not null then '지금 ' else '오늘 ' end
          || case when v_call.expires_at is not null then '' else public._partner_when(v_call.slot_hour, null) || ' ' end
          || public._partner_what(v_call.purpose) || ' — 눌러서 누가 왔는지 보고 메시지를 보내 보세요',
        '/myboxer/community?together=1',
        case when v_push then null else now() end
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object('success', true);
end; $function$;

-- ── 서로 153 — 그날 첫 출석 카드(피드 '오늘도 한 판')에 153 하나 (이미 눌렀으면 그대로)
create or replace function public._partner_mutual_153(p_from uuid, p_to uuid, p_day date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_target uuid;
  v_start timestamptz := p_day::timestamp at time zone 'Asia/Seoul';
begin
  select a.id into v_target
    from public.attendance_logs a
   where a.user_id = p_to and coalesce(a.is_duplicate, false) = false
     and a.checked_in_at >= v_start and a.checked_in_at < v_start + interval '1 day'
     and a.checked_in_at <= now()
   order by a.checked_in_at
   limit 1;
  if v_target is null then return; end if;
  insert into public.community_reactions (target_type, target_id, user_id, branch_name)
  values ('checkin', v_target, p_from, public._community_branch_of(p_from))
  on conflict (target_type, target_id, user_id) do nothing;
exception when others then
  null;
end $function$;

-- ── 같이 운동 보상 — 챔피언 머니 +30, 사람마다 하루 1번 (회원만 — 코치님 · 운영진은 보상 없음)
create or replace function public._partner_reward(p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if coalesce(public._dm_kind(p_user), 'member') <> 'member' then return false; end if;
  if exists (select 1 from public.wallet_transactions w
              where w.user_id = p_user and w.reason = '같이 운동 보상' and w.created_at >= v_day_start) then
    return false;
  end if;
  perform public.grant_gems(p_user, 30, '같이 운동 보상');
  return true;
end $function$;

-- ── '같이 했어요'
create or replace function public.partner_call_done(p_call_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_call record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'))::int;
  v_is_poster boolean;
  v_n int;
  v_paired int := 0;
  v_reward int := 0;
  v_other_reward boolean;
  v_me text;
  v_push boolean := extract(hour from (now() at time zone 'Asia/Seoul')) between 7 and 21;
  r record;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 할 수 있어요';
  end if;

  select * into v_call from public.boxing_partner_calls where id = p_call_id;
  if not found then raise exception '모집을 찾지 못했어요'; end if;
  -- 오늘 · 어제 모집까지 (밤늦게 끝난 운동은 다음 날 눌러도 된다)
  if v_call.call_date < v_today - 1 then raise exception '지난 모집이라 기록할 수 없어요'; end if;

  v_is_poster := v_call.user_id = v_uid;
  if not v_is_poster
     and not exists (select 1 from public.boxing_partner_call_joins j where j.call_id = p_call_id and j.user_id = v_uid) then
    raise exception '저요한 사람과 올린 사람만 누를 수 있어요';
  end if;
  if not exists (select 1 from public.boxing_partner_call_joins j where j.call_id = p_call_id) then
    raise exception '아직 저요한 사람이 없어요';
  end if;
  if v_call.call_date = v_today and v_call.expires_at is null and v_hour < v_call.slot_hour then
    raise exception '운동 시간이 된 뒤에 눌러 주세요';
  end if;

  insert into public.boxing_partner_call_done (call_id, user_id)
  values (p_call_id, v_uid)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('success', true, 'already', true);
  end if;

  select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
    into v_me from public.profiles p where p.user_id = v_uid;

  -- 이번에 짝이 된 사람 — 올린 사람이 누르면 이미 누른 저요한 사람들, 저요한 사람이 누르면 (이미 누른) 올린 사람
  for r in
    select case when v_is_poster then j.user_id else v_call.user_id end as other
      from public.boxing_partner_call_joins j
     where j.call_id = p_call_id
       and (v_is_poster or j.user_id = v_uid)
       and exists (select 1 from public.boxing_partner_call_done d
                    where d.call_id = p_call_id
                      and d.user_id = case when v_is_poster then j.user_id else v_call.user_id end)
  loop
    v_paired := v_paired + 1;
    perform public._partner_mutual_153(v_uid, r.other, v_call.call_date);
    perform public._partner_mutual_153(r.other, v_uid, v_call.call_date);
    if public._partner_reward(v_uid) then v_reward := 30; end if;
    v_other_reward := public._partner_reward(r.other);
    -- 먼저 눌러 둔 상대에게 알림
    begin
      if public._community_notify_since() is not null
         and coalesce((select p.cheer_notify from public.profiles p where p.user_id = r.other), true) then
        insert into public.notifications (user_id, title, body, link, pushed_at)
        values (
          r.other,
          '🤝 ' || coalesce(v_me, '동료') || '님과 같이 운동했어요',
          '서로 153을 보냈어요' || case when v_other_reward then ' · 챔피언 머니 +30' else '' end,
          '/myboxer/community?together=1',
          case when v_push then null else now() end
        );
      end if;
    exception when others then
      null;
    end;
  end loop;

  return jsonb_build_object('success', true, 'paired', v_paired, 'reward', v_reward, 'waiting', v_paired = 0);
end; $function$;

-- ── 예약 작업이 부를 함수 (켜는 것은 _on 마이그레이션) — ① 1시간 전 ② 끝나고 1시간 뒤 묻기
create or replace function public.partner_call_tick()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_push boolean := extract(hour from (now() at time zone 'Asia/Seoul')) between 7 and 21;
  v_remind int := 0;
  v_ask int := 0;
  v_names text;
  r record;
begin
  if public._community_notify_since() is null then
    return jsonb_build_object('ok', true, 'off', true);
  end if;

  -- ① 시작 1시간 전 ~ 5분 전 — 저요가 있는 모집의 올린 사람 · 저요한 사람에게 한 번
  for r in
    select c.id, c.slot_hour, c.purpose, c.user_id as poster, m.uid
      from public.boxing_partner_calls c
      cross join lateral (
        select c.user_id as uid
        union
        select j.user_id from public.boxing_partner_call_joins j where j.call_id = c.id
      ) m
     where c.call_date = v_today and c.status = 'open' and c.expires_at is null
       and exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id)
       and ((v_today + make_time(c.slot_hour, 0, 0)) at time zone 'Asia/Seoul') - v_now
           between interval '5 minutes' and interval '60 minutes'
       and not exists (select 1 from public.boxing_partner_call_notes n
                        where n.call_id = c.id and n.user_id = m.uid and n.kind = 'remind')
  loop
    insert into public.boxing_partner_call_notes (call_id, user_id, kind)
    values (r.id, r.uid, 'remind') on conflict do nothing;
    if coalesce((select p.cheer_notify from public.profiles p where p.user_id = r.uid), true) then
      select string_agg(coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료'), ' · ')
        into v_names
        from (select r.poster as u union all
              select j.user_id from public.boxing_partner_call_joins j where j.call_id = r.id) x
        join public.profiles p on p.user_id = x.u
       where x.u <> r.uid;
      insert into public.notifications (user_id, title, body, link, pushed_at)
      values (
        r.uid,
        '⏰ 곧 같이 운동해요 · ' || public._partner_when(r.slot_hour, null) || ' ' || public._partner_what(r.purpose),
        coalesce(v_names, '동료') || ' — 체육관에서 만나요',
        '/myboxer/community?together=1',
        case when v_push then null else now() end
      );
      v_remind := v_remind + 1;
    end if;
  end loop;

  -- ② 끝나고 1시간 뒤 — 아직 '같이 했어요'를 안 누른 사람에게 한 번 ('지금' 모집은 끝나고 30분 뒤)
  for r in
    select c.id, c.slot_hour, c.purpose, m.uid
      from public.boxing_partner_calls c
      cross join lateral (
        select c.user_id as uid
        union
        select j.user_id from public.boxing_partner_call_joins j where j.call_id = c.id
      ) m
     where c.call_date = v_today and c.status = 'open'
       and exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id)
       and v_now >= coalesce(c.expires_at + interval '30 minutes',
                             ((v_today + make_time(c.slot_hour, 0, 0)) at time zone 'Asia/Seoul') + interval '60 minutes')
       and not exists (select 1 from public.boxing_partner_call_done d where d.call_id = c.id and d.user_id = m.uid)
       and not exists (select 1 from public.boxing_partner_call_notes n
                        where n.call_id = c.id and n.user_id = m.uid and n.kind = 'ask')
  loop
    insert into public.boxing_partner_call_notes (call_id, user_id, kind)
    values (r.id, r.uid, 'ask') on conflict do nothing;
    if coalesce((select p.cheer_notify from public.profiles p where p.user_id = r.uid), true) then
      insert into public.notifications (user_id, title, body, link, pushed_at)
      values (
        r.uid,
        '🤝 오늘 같이 운동했나요?',
        '‘같이 했어요’를 누르면 서로 153 · 챔피언 머니 +30',
        '/myboxer/community?together=1',
        case when v_push then null else now() end
      );
      v_ask := v_ask + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'remind', v_remind, 'ask', v_ask);
end $function$;

-- ── 권한: 화면이 부르는 것만 로그인한 사람에게
revoke all on function public.get_partner_calls_v2() from public, anon;
revoke all on function public.create_partner_call_v2(text, integer, text, boolean, integer) from public, anon;
revoke all on function public.join_partner_call_v2(uuid) from public, anon;
revoke all on function public.partner_call_done(uuid) from public, anon;
grant execute on function public.get_partner_calls_v2() to authenticated;
grant execute on function public.create_partner_call_v2(text, integer, text, boolean, integer) to authenticated;
grant execute on function public.join_partner_call_v2(uuid) to authenticated;
grant execute on function public.partner_call_done(uuid) to authenticated;
revoke all on function public._partner_mutual_153(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public._partner_reward(uuid) from public, anon, authenticated;
revoke all on function public.partner_call_tick() from public, anon, authenticated;
