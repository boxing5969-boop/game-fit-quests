-- 운동 모집 2단계 켜기 + 예시 (2026-10-28 17:48 대표님 "올려" · "게시물5개 올라올때까지는 다양한 예시 넣어놓자")
--   · 예약 작업 partner-call-tick (5분마다) — ① 시작 1시간 전 '곧 같이 운동해요' ② 끝나고 1시간 뒤 '같이 운동했나요?'
--     (partner_call_tick — 20261028171328_partner_call_phase2.sql). 끄기: select cron.unschedule('partner-call-tick');
--   · get_community_home_strip — calls 에서 30분 지난 '지금' 모집(저요 없음)은 빼기 (나머지는 지금 정의 그대로)
--   · get_partner_calls_v2 — 'branchPosts'(우리 지점에 지금까지 올라온 모집 수) 더하기 (나머지는 지금 정의 그대로)
-- 함수 본문은 2026-10-28 17:50 KST 운영 DB 지금 정의(저장소와 같음 확인) 위에 고쳤다.

select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'partner-call-tick';
select cron.schedule('partner-call-tick', '*/5 * * * *', $$select public.partner_call_tick();$$);

-- ── 홈 '오늘 우리 체육관' 띠
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
     -- 30분이 지난 '지금' 모집(저요 없음)은 세지 않는다 — 모집 목록(get_partner_calls_v2)과 같게 (2026-10-28 2단계)
     and (c.expires_at is null or c.expires_at > now()
          or exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id))
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

-- ── 오늘 모집 목록 (2단계) — branchPosts
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
  v_branch_posts int := 0;
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

  -- 우리 지점에 지금까지 올라온 모집 수 — 5개가 될 때까지 화면이 '이렇게 올려 보세요' 예시를 함께 보여 준다
  -- (2026-10-28 대표님 "게시물5개 올라올때까지는 다양한 예시 넣어놓자")
  select count(*)::int into v_branch_posts
    from public.boxing_partner_calls c
   where (v_branch is not null and c.branch_name = v_branch)
      or (v_branch is null and public.is_branch_visible(c.branch_name));

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
    'branchPosts', v_branch_posts,
    'calls', v_calls
  );
end;
$function$;
