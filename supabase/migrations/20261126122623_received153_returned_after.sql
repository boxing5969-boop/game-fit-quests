-- 받은 153 「돌려줬어요」 — 받은 뒤에 돌려준 것만 (2026-11-26 대표님 「돌려줬어요를 눌러도 반응없어」 · 작업판 myboxer:community)
--
--   예전: returned = 그 동료의 가장 최근 카드에 내 153 이 「언제든」 있으면 참.
--     → 11/21 에 그 동료의 11/20 운동 한 줄에 153 을 줬고, 그 동료가 11/25 밤 내 출석 카드에 153 을 보냈는데,
--       그 동료는 그사이 새 카드(출석 3일 · 한 줄 14일 · 승급 7일 안)가 없어 돌려줄 곳이 같은 11/20 카드였다
--       → 화면이 「돌려줬어요」(누를 수 없음)로 떠서 대표님이 눌러도 아무 일이 없었다.
--   이제: returned  = 그 동료가 마지막으로 153 을 보낸 뒤(last_at 이후)에 내가 그 카드에 153 을 줬을 때만
--         cardHas153 = 그 카드에 내 153 이 이미 있음(언제든) — 같은 카드에 또 줄 수 없으니 화면은 「응원 보내기」로 바꾼다
--   나머지(받은 153 셈 · 돌려줄 카드 고르기 · 권한)는 20261027231653 정의(운영 DB md5 = 저장소) 그대로.
create or replace function public.get_my_received_153(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
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
        -- 2026-11-26: 그 동료가 마지막으로 보낸 뒤에 돌려준 것만 「돌려줬어요」
        'returned', t.id is not null and exists (
          select 1 from public.community_reactions y
           where y.target_type = t.type and y.target_id = t.id and y.user_id = v_uid
             and y.created_at >= s.last_at),
        -- 그 카드에 내 153 이 이미 있음(받기 전에 준 것 포함) — 같은 카드엔 또 못 주니 화면은 「응원 보내기」
        'cardHas153', t.id is not null and exists (
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
