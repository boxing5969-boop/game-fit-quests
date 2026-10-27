-- 커뮤니티 1단계 (2026-10-27 대표님 "니가 추천해주는대로 진행" · 「마이복서153 커뮤니티 탭 업그레이드 보고서」)
--
-- 새 표 · 새 칸 · 새 함수 · 새 트리거 · 새 예약 작업만 — 기존 함수 동작은 그대로다.
-- 알림(153 · 댓글 · 월요일 숫자)은 스위치 internal_sync_config 'community_notify_since'(켠 시각)가 있을 때만 나간다.
-- 미리보기 확인 뒤 대표님 OK 에 켠다 — 켜기 전까지 예약 작업 · 트리거는 아무것도 하지 않는다.
--
--   · community_reactions.notified_at   153 알림을 보냈는지 (null = 아직)
--   · community_notify_log              하루 알림 기록 (첫 153 · 저녁 요약 · 댓글 · 월요일 숫자) — 휴대폰은 하루 3번까지
--   · _community_target_owner(type, id) 153 받은 카드의 주인
--   · _community_notify_since()         스위치 (null = 꺼짐)
--   · _community_quiet(at)              알림 쉬는 때 — 토 · 일 · 밤 10시 ~ 아침 8시 (KST)
--   · _community_push_ok(user)          지금 휴대폰 알림을 보내도 되나 (쉬는 때 아님 · 오늘 3번 미만)
--   · community_dispatch_153()          10분마다 — 첫 153 은 30분 모아 한 번, 그 뒤는 저녁 9시 요약 하나
--   · _community_comment_notify()       내 글에 댓글이 달리면 알림 (쉬는 때 · 3번 넘으면 알림함에만)
--   · get_my_received_153(days)         받은 153 — 보낸 사람별 + 돌려줄 카드
--   · get_community_home_strip(since)   홈 '오늘 우리 체육관' 띠 — 지금 운동 중 · 오늘 온 동료 · 새 소식 · 오늘 받은 153
--   · community_weekly_metrics(...)     커뮤니티 활동 회원 비율 등 매주 볼 숫자 (운영진)
--   · community_weekly_report()         월요일 08:30 KST 대표님께 지난주 숫자 알림
--
-- 알림을 받을지는 회원 설정 '응원 알림 받기'(profiles.cheer_notify)를 같이 쓴다 — 화면 글은 '응원 · 153 · 댓글 알림 받기'.

-- 1) 153 알림 표시 ────────────────────────────────────
alter table public.community_reactions add column if not exists notified_at timestamptz;
-- 지금까지 받은 153 은 알림 대상이 아니다
update public.community_reactions set notified_at = created_at where notified_at is null;
create index if not exists community_reactions_pending_idx
  on public.community_reactions (created_at) where notified_at is null;

-- 2) 알림 기록 ────────────────────────────────────────
create table if not exists public.community_notify_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  day date not null,
  kind text not null check (kind in ('first153', 'summary153', 'comment', 'weekly')),
  pushed boolean not null default true,
  notification_id uuid,
  senders integer,
  created_at timestamptz not null default now()
);
create unique index if not exists community_notify_log_once
  on public.community_notify_log (user_id, day, kind) where kind in ('first153', 'summary153', 'weekly');
create index if not exists community_notify_log_user_day on public.community_notify_log (user_id, day);
alter table public.community_notify_log enable row level security;
-- 정책 없음 = 화면에서는 읽지 못한다 (함수만 쓴다)

-- 3) 작은 도우미 ──────────────────────────────────────
create or replace function public._community_target_owner(p_type text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_type
    when 'journal' then (select e.user_id from public.champion_journal_entries e where e.id = p_id)
    when 'checkin' then (select a.user_id from public.attendance_logs a where a.id = p_id)
    when 'promotion' then (select h.user_id from public.level_status_history h where h.id = p_id)
  end;
$$;

create or replace function public._community_notify_since()
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  select c.value into v from public.internal_sync_config c where c.key = 'community_notify_since';
  if v is null or btrim(v) = '' or lower(btrim(v)) = 'off' then
    return null;
  end if;
  return v::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public._community_quiet(p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select extract(isodow from p_at at time zone 'Asia/Seoul') >= 6
      or extract(hour from p_at at time zone 'Asia/Seoul') < 8
      or extract(hour from p_at at time zone 'Asia/Seoul') >= 22;
$$;

create or replace function public._community_push_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not public._community_quiet(now())
     and (select count(*) from public.community_notify_log l
           where l.user_id = p_user
             and l.day = (now() at time zone 'Asia/Seoul')::date
             and l.pushed) < 3;
$$;

-- 4) 153 묶음 알림 — 10분마다 ─────────────────────────
--    첫 153: 받은 지 30분이 지나면 그동안 온 것을 묶어 한 번 ("민지님 외 2명이 153을 보냈어요")
--    그 뒤: 저녁 9시 넘어 요약 하나 ("오늘 6명이 153을 보냈어요") — 하루 최대 2번
--    쉬는 때(토 · 일 · 밤 10시 ~ 아침 8시)에 온 153 은 기다렸다가 다음 평일 아침 첫 알림으로 묶인다
create or replace function public.community_dispatch_153()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_since timestamptz := public._community_notify_since();
  v_hour int := extract(hour from now() at time zone 'Asia/Seoul')::int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_first int := 0;
  v_summary int := 0;
  v_off int := 0;
  r record;
  v_nid uuid;
  v_name text;
  v_push boolean;
  v_total int;
begin
  if v_since is null then
    return jsonb_build_object('ok', true, 'off', true);
  end if;

  -- 3일 넘게 기다린 153 은 조용히 끝낸다
  update public.community_reactions set notified_at = now()
   where notified_at is null and created_at < now() - interval '3 days';

  if public._community_quiet(now()) then
    return jsonb_build_object('ok', true, 'quiet', true);
  end if;

  for r in
    with pend as (
      select x.id, x.user_id as sender, x.created_at, x.target_type,
             public._community_target_owner(x.target_type, x.target_id) as owner
        from public.community_reactions x
       where x.notified_at is null and x.created_at >= v_since
    ), own as (
      select p.owner,
             count(distinct p.sender)::int as senders,
             min(p.created_at) as first_at,
             array_agg(p.id) as ids,
             (array_agg(p.sender order by p.created_at desc))[1] as last_sender,
             (array_agg(p.target_type order by p.created_at desc))[1] as last_type
        from pend p
       where p.owner is not null and p.owner <> p.sender
       group by p.owner
    )
    select o.*,
           exists (select 1 from public.community_notify_log l
                    where l.user_id = o.owner and l.day = v_today and l.kind = 'first153') as had_first,
           exists (select 1 from public.community_notify_log l
                    where l.user_id = o.owner and l.day = v_today and l.kind = 'summary153') as had_summary,
           coalesce(pr.cheer_notify, true) as wants
      from own o
      left join public.profiles pr on pr.user_id = o.owner
  loop
    if not r.wants then
      -- 알림을 끈 회원 — 153 은 '받은 153' 목록에만 쌓인다
      update public.community_reactions set notified_at = now() where id = any (r.ids);
      v_off := v_off + 1;
      continue;
    end if;

    if not r.had_first then
      if r.first_at > now() - interval '30 minutes' then
        continue;  -- 30분 동안 모아서 한 번에
      end if;
      select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
        into v_name from public.profiles p where p.user_id = r.last_sender;
      v_push := public._community_push_ok(r.owner);
      v_nid := gen_random_uuid();
      insert into public.notifications (id, user_id, title, body, link, pushed_at)
      values (
        v_nid, r.owner,
        '👊 ' || coalesce(v_name, '동료')
          || case when r.senders > 1 then '님 외 ' || (r.senders - 1) || '명이' else '님이' end
          || ' 153을 보냈어요',
        case r.last_type
          when 'checkin' then '오늘도 한 판 출석 카드에 153이 왔어요. 눌러서 153을 돌려주세요'
          when 'promotion' then '승급 축하 카드에 153이 왔어요. 눌러서 153을 돌려주세요'
          else '내 한 줄에 153이 왔어요. 눌러서 153을 돌려주세요'
        end,
        '/myboxer/community?received=1',
        case when v_push then null else now() end
      );
      insert into public.community_notify_log (user_id, day, kind, pushed, notification_id, senders)
      values (r.owner, v_today, 'first153', v_push, v_nid, r.senders)
      on conflict do nothing;
      update public.community_reactions set notified_at = now() where id = any (r.ids);
      v_first := v_first + 1;

    elsif v_hour >= 21 and not r.had_summary then
      select count(distinct x.user_id)::int into v_total
        from public.community_reactions x
       where x.created_at >= v_day_start
         and public._community_target_owner(x.target_type, x.target_id) = r.owner
         and x.user_id <> r.owner;
      v_total := greatest(coalesce(v_total, 0), r.senders);
      v_push := public._community_push_ok(r.owner);
      v_nid := gen_random_uuid();
      insert into public.notifications (id, user_id, title, body, link, pushed_at)
      values (
        v_nid, r.owner,
        '👊 오늘 ' || v_total || '명이 153을 보냈어요',
        '오늘 같이 운동한 동료들이 보낸 153이에요. 고마운 동료에게 153을 돌려주세요',
        '/myboxer/community?received=1',
        case when v_push then null else now() end
      );
      insert into public.community_notify_log (user_id, day, kind, pushed, notification_id, senders)
      values (r.owner, v_today, 'summary153', v_push, v_nid, v_total)
      on conflict do nothing;
      update public.community_reactions set notified_at = now() where id = any (r.ids);
      v_summary := v_summary + 1;
    end if;
    -- 그 밖(첫 알림 뒤 저녁 9시 전 · 요약 뒤에 온 153)은 기다린다
  end loop;

  return jsonb_build_object('ok', true, 'first', v_first, 'summary', v_summary, 'notify_off', v_off);
end $$;

-- 5) 댓글 알림 — 내 글에 댓글이 달리면 ───────────────────
create or replace function public._community_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_name text;
  v_push boolean;
  v_nid uuid;
begin
  if public._community_notify_since() is null then
    return null;
  end if;
  select e.user_id into v_owner from public.champion_journal_entries e where e.id = new.entry_id;
  if v_owner is null or v_owner = new.commenter_user_id then
    return null;
  end if;
  if not coalesce((select p.cheer_notify from public.profiles p where p.user_id = v_owner), true) then
    return null;
  end if;
  select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
    into v_name from public.profiles p where p.user_id = new.commenter_user_id;
  v_push := public._community_push_ok(v_owner);
  v_nid := gen_random_uuid();
  insert into public.notifications (id, user_id, title, body, link, pushed_at)
  values (
    v_nid, v_owner,
    '💬 ' || coalesce(v_name, '동료') || '님이 댓글을 남겼어요',
    '“' || left(new.content, 60) || case when char_length(new.content) > 60 then '…' else '' end || '”',
    '/myboxer/community?entry=' || new.entry_id,
    case when v_push then null else now() end
  );
  insert into public.community_notify_log (user_id, day, kind, pushed, notification_id)
  values (v_owner, (now() at time zone 'Asia/Seoul')::date, 'comment', v_push, v_nid);
  return null;
exception when others then
  -- 알림이 안 돼도 댓글은 절대 막지 않는다
  return null;
end $$;

drop trigger if exists community_comment_notify_after_insert on public.champion_journal_comments;
create trigger community_comment_notify_after_insert
  after insert on public.champion_journal_comments
  for each row execute function public._community_comment_notify();

-- 6) 받은 153 — 보낸 사람별 + 돌려줄 카드 ──────────────
--    돌려줄 카드 = 그 동료의 가장 최근 카드(한 줄 14일 · 출석 3일 · 승급 7일) 중 내가 153 을 누를 수 있는 것
create or replace function public.get_my_received_153(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_days int := greatest(1, least(coalesce(p_days, 7), 30));
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_hq boolean;
  v_branch text;
  v_total int;
  v_today int;
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  v_hq := public._dm_kind(v_uid) = 'hq';
  v_branch := public._community_branch_of(v_uid);

  with mine as (
    select x.user_id as sender, x.created_at
      from public.community_reactions x
      left join public.champion_journal_entries e on x.target_type = 'journal' and e.id = x.target_id
      left join public.attendance_logs a on x.target_type = 'checkin' and a.id = x.target_id
      left join public.level_status_history h on x.target_type = 'promotion' and h.id = x.target_id
     where x.created_at >= now() - make_interval(days => v_days)
       and coalesce(e.user_id, a.user_id, h.user_id) = v_uid
       and x.user_id <> v_uid
  ), by_sender as (
    select m.sender, count(*)::int as cnt, max(m.created_at) as last_at
      from mine m
     group by m.sender
  )
  select
    (select count(*)::int from mine),
    (select count(*)::int from mine where created_at >= v_day_start),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'userId', s.sender,
        'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
        'avatarUrl', p.avatar_url,
        'isStaff', coalesce(p.is_staff, false) or coalesce(public._dm_kind(s.sender), '') in ('coach', 'hq'),
        'staffTitle', p.staff_title,
        'branch', p.branch_name,
        'league', coalesce(mp.current_rank::text, 'white'),
        'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
        'count', s.cnt,
        'lastAt', s.last_at,
        'returnTarget', case when t.id is null then null
                             else jsonb_build_object('type', t.type, 'id', t.id, 'at', t.at) end,
        'returned', t.id is not null and exists (
          select 1 from public.community_reactions y
           where y.target_type = t.type and y.target_id = t.id and y.user_id = v_uid)
      ) order by s.last_at desc), '[]'::jsonb)
       from by_sender s
       left join public.profiles p on p.user_id = s.sender
       left join public.member_progress mp on mp.user_id = s.sender
       left join lateral (
         select q.type, q.id, q.at
           from (
             (select 'journal'::text as type, e.id, e.created_at as at
                from public.champion_journal_entries e
               where e.user_id = s.sender and e.kind = 'journal' and e.hidden_at is null
                 and e.created_at >= now() - interval '14 days'
                 and public.community_can_view_entry(v_uid, e.id)
               order by e.created_at desc
               limit 1)
             union all
             (select 'checkin'::text, a.id, a.checked_in_at
                from public.attendance_logs a
               where a.user_id = s.sender
                 and coalesce(a.is_duplicate, false) = false
                 and a.checked_in_at >= now() - interval '3 days' and a.checked_in_at <= now()
                 and not coalesce(p.is_staff, false)
                 and (v_hq or (v_branch is not null and v_branch = p.branch_name))
               order by a.checked_in_at desc
               limit 1)
             union all
             (select 'promotion'::text, h.id, h.created_at
                from public.level_status_history h
               where h.user_id = s.sender and h.new_status = 'boss_cleared'
                 and h.created_at >= now() - interval '7 days'
                 and (v_hq or (v_branch is not null and v_branch = p.branch_name))
               order by h.created_at desc
               limit 1)
           ) q
          order by q.at desc
          limit 1
       ) t on true)
    into v_total, v_today, v_out;

  return jsonb_build_object('success', true, 'days', v_days, 'total', coalesce(v_total, 0),
                            'today', coalesce(v_today, 0), 'senders', coalesce(v_out, '[]'::jsonb));
end $$;

-- 7) 홈 '오늘 우리 체육관' 띠 ───────────────────────────
--    지금 운동 중(랭킹 탭 · TV 와 같은 기준) · 오늘 온 동료(피드 '오늘도 한 판'과 같은 기준)
--    · 새 소식(p_since 이후 한 줄 · 승급 · 이번 주 목표 · 새 식구) · 오늘 받은 153
create or replace function public.get_community_home_strip(p_since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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

  return jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'all_branches', v_all,
    -- 아직 앱에서 숨겨 둔 지점(설정에서 지점별로 켜고 끔)이면 홈 띠를 보이지 않는다
    'visible', v_all or public.is_branch_visible(v_branch),
    'working_now', v_working,
    'today', v_checkins,
    'new_count', coalesce(v_new, 0),
    'received_today', v_recv
  );
end $$;

-- 8) 매주 볼 숫자 (운영진) ───────────────────────────────
--    핵심: 커뮤니티 활동 회원 비율 = 그 주 커뮤니티에서 누르거나 쓴 회원 ÷ 그 주 출석 회원 (코치 · 운영진 · 체험 계정 제외)
--    p_week_start 없으면 지난주(월~일, KST)
create or replace function public.community_weekly_metrics(p_branch text default null, p_week_start date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
                         else 0 end
  ) into v_out;

  return v_out;
end $$;

-- 9) 월요일 08:30 KST — 대표님께 지난주 숫자 ───────────────
create or replace function public.community_weekly_report()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
end $$;

-- 10) 권한 ───────────────────────────────────────────────
revoke all on function public._community_target_owner(text, uuid) from public, anon, authenticated;
revoke all on function public._community_notify_since() from public, anon, authenticated;
revoke all on function public._community_quiet(timestamptz) from public, anon, authenticated;
revoke all on function public._community_push_ok(uuid) from public, anon, authenticated;
revoke all on function public.community_dispatch_153() from public, anon, authenticated;
revoke all on function public._community_comment_notify() from public, anon, authenticated;
revoke all on function public.community_weekly_report() from public, anon, authenticated;
revoke all on function public.get_my_received_153(integer) from public, anon;
revoke all on function public.get_community_home_strip(timestamptz) from public, anon;
revoke all on function public.community_weekly_metrics(text, date) from public, anon;
grant execute on function public.get_my_received_153(integer) to authenticated;
grant execute on function public.get_community_home_strip(timestamptz) to authenticated;
grant execute on function public.community_weekly_metrics(text, date) to authenticated;

-- 11) 예약 작업 — 스위치가 꺼져 있으면 아무것도 하지 않는다 ──
select cron.schedule('community-153-dispatch', '*/10 * * * *', $$select public.community_dispatch_153()$$);
-- 월요일 08:30 KST = 일요일 23:30 UTC
select cron.schedule('community-weekly-report', '30 23 * * 0', $$select public.community_weekly_report()$$);
