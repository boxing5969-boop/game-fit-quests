-- 랭킹 탭 '지금 운동 중' (2026-10-16 대표님: "마이복서 153랭킹 탭에서 현재 운동중인 회원 확인할수있게 해줘~")
--   기준은 체육관 TV(라이브보드)와 같다:
--     · 앱 운동 세션이 켜져 있다 (activity_sessions active, 60분 안 — end_stale_sessions 와 같은 기준)
--     · 또는 오늘 출입구 얼굴·QR 출석 후 120분 안 (브로제이는 퇴실을 남기지 않아 시간으로 본다 — LiveBoardPage CHECKIN_ACTIVE_MINUTES)
--   코치님(지도진)·테스트 계정은 뺀다.
--   보는 범위: 회원 = 자기 지점. 본사(전체관리자·관리자) = 고른 지점, 비우면 전 지점.
--   내정보 '출석하면 커뮤니티에 알리기'를 끈 회원은 다른 회원 화면에 나오지 않는다 (본인·본사에게는 보인다).

create or replace function public.get_working_out_now(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hq boolean;
  v_branch text;
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_hq := public._dm_kind(v_uid) = 'hq';
  v_branch := case when v_hq then nullif(btrim(p_branch), '') else public._community_branch_of(v_uid) end;
  if not v_hq and v_branch is null then
    return jsonb_build_object('branch', null, 'all_branches', false, 'members', '[]'::jsonb);
  end if;

  -- TV 와 같이: 앱 세션이 있으면 그 시작 시각, 없으면 오늘 마지막 출석 시각 (같은 날 두 번째 출석(is_duplicate)도 다시 온 것이라 센다)
  with pres as (
    select s.user_id, s.started_at as since, s.branch_name as at_branch, 0 as prio
      from public.activity_sessions s
     where s.status = 'active' and s.ended_at is null
       and s.started_at >= now() - interval '60 minutes'
       and (v_branch is null or s.branch_name = v_branch)
    union all
    select a.user_id, a.checked_in_at, a.branch_name, 1
      from public.attendance_logs a
     where a.checked_in_at >= greatest(v_today_start, now() - interval '120 minutes')
       and a.checked_in_at <= now()
       and (v_branch is null or a.branch_name = v_branch)
  ),
  latest as (
    select distinct on (pres.user_id) pres.user_id, pres.since, pres.at_branch
      from pres order by pres.user_id, pres.prio, pres.since desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', l.user_id,
           'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
           'avatar_url', p.avatar_url,
           'league', coalesce(mp.current_rank::text, 'white'),
           'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
           'since', l.since,
           'branch', coalesce(l.at_branch, p.branch_name),
           'is_me', l.user_id = v_uid
         ) order by l.since desc), '[]'::jsonb)
    into v_out
    from latest l
    join public.profiles p on p.user_id = l.user_id
    left join public.member_progress mp on mp.user_id = l.user_id
   where not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and (v_hq or l.user_id = v_uid or coalesce(p.community_auto_post, true));

  return jsonb_build_object('branch', v_branch, 'all_branches', v_hq and v_branch is null, 'members', v_out);
end $$;

revoke all on function public.get_working_out_now(text) from public, anon;
grant execute on function public.get_working_out_now(text) to authenticated;
