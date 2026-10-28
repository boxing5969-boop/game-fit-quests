-- 운동 모집('오늘 같이 해요') 1단계 (2026-10-28 대표님 "추천대로가자" · 보고서 「마이복서153 운동 모집 업그레이드 보고서」)
--   9/17 시작 뒤 모집 1건 · 저요 0명 — 닉네임 없는 회원은 이름이 빈칸, 누가 저요 했는지 · 알림이 없었다.
--   · get_partner_calls  — 올린 사람 사진 · 이름(닉네임, 없으면 이름) · 레벨 · 코치 여부 + 저요한 사람 목록
--                          + 내 평소 시간(시간 칩 기본값) · 스파링을 열 수 있나 · 닉네임을 먼저 정해야 하나. 승인 전 계정은 빈 목록
--   · create_partner_call — 스파링은 코치님 · 운영진 모집으로만 · 닉네임이 없는 회원은 먼저 정하기 · 승인 전 계정 막기
--   · join_partner_call   — 올린 사람에게 알림(같은 모집 · 같은 사람은 한 번만, 밤 10시 ~ 아침 7시는 알림함에만) · 승인 전 계정 막기
--   · get_community_home_strip — 'calls' (오늘 우리 지점에 올라온 남의 모집 수) — 홈 '오늘 우리 체육관' 띠
--   · community_weekly_metrics · community_weekly_report — 월요일 숫자에 모집 네 줄
-- 함수 본문은 2026-10-28 16:50 KST 운영 DB 지금 정의 위에 고쳤다.

-- ── 알림을 한 번만 보내려고 남기는 표 (모집 · 사람 · 종류) — 저요를 눌렀다 취소하고 다시 눌러도 알림은 한 번
create table if not exists public.boxing_partner_call_notes (
  call_id uuid not null references public.boxing_partner_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (call_id, user_id, kind),
  constraint boxing_partner_call_notes_kind_chk check (kind in ('join'))
);
alter table public.boxing_partner_call_notes enable row level security;
revoke all on public.boxing_partner_call_notes from anon, authenticated;

-- ── 오늘 모집 목록
create or replace function public.get_partner_calls()
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
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_usual int;
  v_need_nick boolean;
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

  -- 내가 평소 오는 시간 — 최근 60일 출석이 가장 많은 시각(3번 이상 왔을 때만). 모집 시간 칩의 기본값
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

  -- 이름 없이 올라가지 않게 — 닉네임이 없는 회원은 올리기 전에 정한다 (코치님 · 운영진은 이름 그대로)
  select v_kind = 'member' and coalesce(btrim(p.nickname), '') = ''
    into v_need_nick
    from public.profiles p where p.user_id = v_uid;

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
           'joiners', coalesce(j.people, '[]'::jsonb)
         ) order by c.slot_hour, c.created_at), '[]'::jsonb)
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
   where ((v_all and public.is_branch_visible(c.branch_name)) or c.branch_name = v_branch)
     and c.call_date = v_today
     and c.status = 'open';

  return jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'all_branches', v_all,
    'usualHour', v_usual,
    'canSpar', v_kind in ('coach', 'hq'),
    'needsNickname', coalesce(v_need_nick, false),
    'calls', v_calls
  );
end;
$function$;

-- ── 모집 올리기 · 바꾸기
create or replace function public.create_partner_call(p_purpose text, p_slot_hour integer, p_note text default null::text)
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
  if p_slot_hour is null or p_slot_hour < 5 or p_slot_hour > 23 then
    raise exception '시간은 오전 5시부터 오후 11시 사이로 골라주세요';
  end if;

  v_kind := coalesce(public._dm_kind(v_uid), 'member');

  -- 스파링은 코치님 · 운영진이 여는 모집으로만 (2026-10-28 — 맞대는 연습은 코치님이 보는 자리에서)
  if p_purpose = 'sparring' and v_kind not in ('coach', 'hq') then
    raise exception '스파링은 코치님이 여는 모집으로만 해요. 미트 · 같이 운동은 지금 올릴 수 있어요';
  end if;

  -- 이름 없이 올라가지 않게 — 닉네임이 없는 회원은 먼저 정한다
  if v_kind = 'member'
     and coalesce(btrim((select p.nickname from public.profiles p where p.user_id = v_uid)), '') = '' then
    raise exception '닉네임을 먼저 정해 주세요 — 모집에 보이는 이름이에요';
  end if;

  insert into public.boxing_partner_calls (user_id, branch_name, call_date, slot_hour, purpose, note)
  values (v_uid, v_branch, v_today, p_slot_hour, p_purpose, nullif(btrim(coalesce(p_note,'')), ''))
  on conflict (user_id, call_date) do update
    set slot_hour = excluded.slot_hour,
        purpose   = excluded.purpose,
        note      = excluded.note,
        status    = 'open',
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('success', true, 'call_id', v_id);
end; $function$;

-- ── 저요
create or replace function public.join_partner_call(p_call_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_call record;
  v_n int;
  v_name text;
  v_when text;
  v_what text;
  v_push boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 참여할 수 있어요';
  end if;
  v_branch := public.boxing_community_my_branch();

  select * into v_call from public.boxing_partner_calls
   where id = p_call_id and status = 'open'
     and call_date = (now() at time zone 'Asia/Seoul')::date;
  if not found then raise exception '이미 마감된 모집입니다'; end if;
  if v_call.branch_name is distinct from v_branch then
    raise exception '다른 지점의 모집에는 참여할 수 없습니다';
  end if;
  if v_call.user_id = v_uid then raise exception '본인이 올린 모집입니다'; end if;

  insert into public.boxing_partner_call_joins (call_id, user_id)
  values (p_call_id, v_uid)
  on conflict (call_id, user_id) do nothing;

  -- 올린 사람에게 알림 — 같은 모집 · 같은 사람은 한 번만(취소했다 다시 눌러도). 커뮤니티 알림 스위치 ·
  -- 올린 사람의 '응원 · 153 · 댓글 알림 받기'를 따르고, 밤 10시 ~ 아침 7시는 휴대폰 알림 없이 알림함에만.
  -- 알림이 안 돼도 저요는 절대 막지 않는다.
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
      v_when := case when v_call.slot_hour < 12 then '오전 ' || v_call.slot_hour || '시'
                     when v_call.slot_hour = 12 then '낮 12시'
                     else '오후 ' || (v_call.slot_hour - 12) || '시' end;
      v_what := case v_call.purpose when 'mitt' then '미트' when 'sparring' then '스파링'
                                    when 'jump' then '줄넘기' else '같이 운동' end;
      v_push := extract(hour from (now() at time zone 'Asia/Seoul')) between 7 and 21;
      insert into public.notifications (user_id, title, body, link, pushed_at)
      values (
        v_call.user_id,
        '🙋 ' || coalesce(v_name, '동료') || '님이 저요! 했어요',
        '오늘 ' || v_when || ' ' || v_what || ' — 눌러서 누가 왔는지 보고 메시지를 보내 보세요',
        '/myboxer/community?together=1',
        case when v_push then null else now() end
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object('success', true);
end; $function$;

-- ── 홈 '오늘 우리 체육관' 띠 — 'calls' 더하기 (나머지는 지금 정의 그대로)
create or replace function public.get_community_home_strip(p_since timestamp with time zone default null::timestamp with time zone)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_since timestamptz := greatest(coalesce(p_since, now() - interval '24 hours'), now() - interval '7 days');
  v_wo jsonb;
  v_working int := 0;
  v_checkins int := 0;
  v_new int := 0;
  v_recv int := 0;
  v_calls int := 0;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    return jsonb_build_object('success', false, 'reason', 'not_active');
  end if;
  v_branch := public._community_branch_of(v_uid);
  v_all := public._dm_kind(v_uid) = 'hq';
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'branch', null);
  end if;

  begin
    v_wo := public.get_working_out_now(case when v_all then null else v_branch end);
    v_working := coalesce(jsonb_array_length(v_wo -> 'members'), 0);
  exception when others then
    v_working := 0;
  end;

  select count(distinct a.user_id)::int into v_checkins
    from public.attendance_logs a
    join public.profiles p on p.user_id = a.user_id
   where a.checked_in_at >= v_day_start and a.checked_in_at <= now()
     and coalesce(a.is_duplicate, false) = false
     and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)
     and coalesce(p.community_auto_post, true)
     and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false);

  select
    (select count(*)::int
       from public.champion_journal_entries e
       join public.profiles p on p.user_id = e.user_id
      where e.kind = 'journal' and e.created_at > v_since and e.user_id <> v_uid and e.hidden_at is null
        and ((v_all and public.is_branch_visible(p.branch_name))
             or (e.visibility = 'branch' and p.branch_name = v_branch)
             or (e.visibility = 'partners' and public.is_journal_partner(v_uid, e.user_id))))
  + (select count(*)::int
       from public.champion_journal_entries e
       join public.profiles p on p.user_id = e.user_id
      where e.kind = 'weekly_goal' and e.created_at > v_since and e.user_id <> v_uid and e.hidden_at is null
        and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch))
  + (select count(*)::int
       from public.level_status_history h
       join public.profiles p on p.user_id = h.user_id
      where h.new_status = 'boss_cleared' and h.created_at > v_since and h.user_id <> v_uid
        and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)
        and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false))
  + (select count(distinct a.user_id)::int
       from public.attendance_logs a
       join public.profiles p on p.user_id = a.user_id
      where a.checked_in_at > v_since and a.checked_in_at >= v_day_start and a.checked_in_at <= now()
        and coalesce(a.is_duplicate, false) = false and a.user_id <> v_uid
        and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)
        and coalesce(p.community_auto_post, true)
        and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
        and not exists (select 1 from public.attendance_logs b
                         where b.user_id = a.user_id and coalesce(b.is_duplicate, false) = false
                           and b.checked_in_at < v_day_start))
    into v_new;

  select count(*)::int into v_recv
    from public.community_reactions x
    left join public.champion_journal_entries e on x.target_type = 'journal' and e.id = x.target_id
    left join public.attendance_logs a on x.target_type = 'checkin' and a.id = x.target_id
    left join public.level_status_history h on x.target_type = 'promotion' and h.id = x.target_id
   where x.created_at >= v_day_start
     and coalesce(e.user_id, a.user_id, h.user_id) = v_uid
     and x.user_id <> v_uid;

  -- 오늘 올라온 남의 운동 모집 (2026-10-28 운동 모집 1단계)
  select count(*)::int into v_calls
    from public.boxing_partner_calls c
   where c.call_date = (now() at time zone 'Asia/Seoul')::date
     and c.status = 'open'
     and c.user_id <> v_uid
     and ((v_all and public.is_branch_visible(c.branch_name)) or c.branch_name = v_branch);

  return jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'all_branches', v_all,
    -- 아직 앱에서 숨겨 둔 지점(설정에서 지점별로 켜고 끔)이면 홈 띠를 보이지 않는다
    'visible', v_all or public.is_branch_visible(v_branch),
    'working_now', v_working,
    'today', v_checkins,
    'new_count', coalesce(v_new, 0),
    'received_today', v_recv,
    'calls', coalesce(v_calls, 0)
  );
end $function$;

-- ── 매주 볼 숫자 — 운동 모집 네 줄 더하기 (나머지는 지금 정의 그대로)
create or replace function public.community_weekly_metrics(p_branch text default null::text, p_week_start date default null::date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text := coalesce(nullif(btrim(p_branch), ''), '153복싱짐 선릉역점');
  v_ws date := coalesce(p_week_start,
                        (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '7 days')::date);
  v_from timestamptz;
  v_to timestamptz;
  v_out jsonb;
begin
  -- 로그인한 사람은 운영진만 · 예약 작업(로그인 없음)은 통과 — anon 에게는 실행 권한이 없다
  if v_uid is not null and public._dm_kind(v_uid) is distinct from 'hq' then
    raise exception '운영진만 볼 수 있어요' using errcode = '42501';
  end if;
  v_ws := date_trunc('week', v_ws::timestamp)::date;
  v_from := v_ws::timestamp at time zone 'Asia/Seoul';
  v_to := (v_ws + 7)::timestamp at time zone 'Asia/Seoul';

  with mem as (
    select p.user_id
      from public.profiles p
     where p.branch_name = v_branch
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
       and public._dm_kind(p.user_id) = 'member'
  ), att as (
    select distinct a.user_id
      from public.attendance_logs a
      join mem m on m.user_id = a.user_id
     where a.checked_in_at >= v_from and a.checked_in_at < v_to
       and coalesce(a.is_duplicate, false) = false
  ), att30 as (
    select distinct a.user_id
      from public.attendance_logs a
      join mem m on m.user_id = a.user_id
     where a.checked_in_at >= least(v_to, now()) - interval '30 days' and a.checked_in_at < least(v_to, now())
       and coalesce(a.is_duplicate, false) = false
  ), acts as (
    select e.user_id as u, 'post'::text as t from public.champion_journal_entries e
     where e.kind = 'journal' and e.created_at >= v_from and e.created_at < v_to
    union all
    select x.user_id, 'react' from public.community_reactions x where x.created_at >= v_from and x.created_at < v_to
    union all
    select c.commenter_user_id, 'comment' from public.champion_journal_comments c where c.created_at >= v_from and c.created_at < v_to
    union all
    select b.sender_user_id, 'cheer' from public.boxing_cheers b where b.created_at >= v_from and b.created_at < v_to
    union all
    select w.sender_user_id, 'welcome' from public.community_welcomes w where w.created_at >= v_from and w.created_at < v_to
    union all
    select l.liker_id, 'heart' from public.nickname_likes l where l.created_at >= v_from and l.created_at < v_to
  ), macts as (
    select a.u, a.t from acts a join mem m on m.user_id = a.u
  ), calls as (
    -- 운동 모집 (2026-10-28 1단계) — 그 주에 그 지점에 올라온 모집 (코치님 모집 포함)
    select c.id, c.user_id, c.call_date
      from public.boxing_partner_calls c
     where c.branch_name = v_branch and c.call_date >= v_ws and c.call_date < v_ws + 7
  )
  select jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'week_start', v_ws,
    'week_end', v_ws + 6,
    'attendees', (select count(*)::int from att),
    'active', (select count(distinct u)::int from macts),
    'active_rate', case when (select count(*) from att) > 0
                        then round(100.0 * (select count(distinct u) from macts) / (select count(*) from att))::int
                        else 0 end,
    'member_153', (select count(*)::int from macts where t = 'react'),
    'posters', (select count(distinct u)::int from macts where t = 'post'),
    'posts', (select count(*)::int from macts where t = 'post'),
    'comments', (select count(*)::int from macts where t = 'comment'),
    'cheers', (select count(*)::int from macts where t = 'cheer'),
    'hearts', (select count(*)::int from macts where t = 'heart'),
    'welcomes', (select count(*)::int from macts where t = 'welcome'),
    'attendees_30d', (select count(*)::int from att30),
    'app_30d', (select count(*)::int from att30 a join auth.users u on u.id = a.user_id where u.last_sign_in_at is not null),
    'app_rate_30d', case when (select count(*) from att30) > 0
                         then round(100.0 * (select count(*) from att30 a join auth.users u on u.id = a.user_id
                                              where u.last_sign_in_at is not null) / (select count(*) from att30))::int
                         else 0 end,
    -- 운동 모집 네 줄: 올라온 모집 · 저요가 붙은 모집 · 같이 운동한 쌍(저요한 사람과 올린 사람이 그날 둘 다 출석) · 회원이 올린 모집
    'calls', (select count(*)::int from calls),
    'calls_joined', (select count(*)::int from calls c
                      where exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id)),
    'call_pairs', (select count(*)::int
                     from calls c
                     join public.boxing_partner_call_joins j on j.call_id = c.id
                    where exists (select 1 from public.attendance_logs a
                                   where a.user_id = c.user_id and coalesce(a.is_duplicate, false) = false
                                     and (a.checked_in_at at time zone 'Asia/Seoul')::date = c.call_date)
                      and exists (select 1 from public.attendance_logs a
                                   where a.user_id = j.user_id and coalesce(a.is_duplicate, false) = false
                                     and (a.checked_in_at at time zone 'Asia/Seoul')::date = c.call_date)),
    'member_calls', (select count(*)::int from calls c join mem m on m.user_id = c.user_id)
  ) into v_out;

  return v_out;
end $function$;

-- ── 월요일 08:30 알림 — 모집 한 줄 더하기 (나머지는 지금 정의 그대로)
create or replace function public.community_weekly_report()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  m jsonb;
  v_body text;
  v_n int := 0;
  r record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if public._community_notify_since() is null then
    return jsonb_build_object('ok', true, 'off', true);
  end if;
  m := public.community_weekly_metrics('153복싱짐 선릉역점', null);
  v_body := '활동 회원 ' || (m ->> 'active') || '명 / 출석 ' || (m ->> 'attendees') || '명 ('
         || (m ->> 'active_rate') || '%, 목표 25%) · 회원 153 ' || (m ->> 'member_153') || '번 · 글쓴이 '
         || (m ->> 'posters') || '명 · 댓글 ' || (m ->> 'comments') || ' · 응원 ' || (m ->> 'cheers')
         || ' · 운동 모집 ' || coalesce(m ->> 'calls', '0') || '건(저요 ' || coalesce(m ->> 'calls_joined', '0')
         || ') · 같이 운동 ' || coalesce(m ->> 'call_pairs', '0') || '쌍'
         || ' · 앱 로그인 ' || (m ->> 'app_rate_30d') || '%';
  for r in
    select distinct ur.user_id from public.user_roles ur where ur.role = 'super_admin'
  loop
    if exists (select 1 from public.community_notify_log l
                where l.user_id = r.user_id and l.day = v_today and l.kind = 'weekly') then
      continue;
    end if;
    insert into public.notifications (user_id, title, body, link)
    values (r.user_id, '📊 지난주 커뮤니티 숫자 · 선릉역점', v_body, '/myboxer/community?metrics=1');
    insert into public.community_notify_log (user_id, day, kind, pushed)
    values (r.user_id, v_today, 'weekly', true)
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', v_n, 'metrics', m);
end $function$;
