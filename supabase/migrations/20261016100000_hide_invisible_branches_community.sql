-- 숨긴 지점은 본사 '전 지점' 보기에서도 뺀다 — 커뮤니티 · 지금 운동 중 (2026-10-16 대표님:
--   "선릉점만 또 잠실이랑 역삼도 나오네" · "커뮤니티 기능에도 선릉만 나오는게 아니라 전부 나와 역삼 잠실도")
--   20261015143000_branch_visibility.sql 이 랭킹·명예의 전당·153 챌린지에 넣은 조건을 커뮤니티 쪽에도 똑같이 넣는다:
--     전 지점 보기(본사) → public.is_branch_visible(지점) 인 것만 · 내 지점 것은 그대로
--   대상: get_community_feed(피드·오늘도 한 판) · get_second_cheer_candidates(응원 보내기) · get_cornerman_candidates(운동 짝꿍)
--         · get_partner_calls(오늘 같이 해요) · get_gear_posts(장비 나눔) · get_titlematch_feed(승급 축하) · get_working_out_now(지금 운동 중)

-- 1) 지금 운동 중 — 전 지점이면 켜 둔 지점에서 운동 중인 회원만
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
     -- 전 지점 보기는 켜 둔 지점만 (설정 > 지점 관리)
     and (v_branch is not null or public.is_branch_visible(coalesce(l.at_branch, p.branch_name)))
     and (v_hq or l.user_id = v_uid or coalesce(p.community_auto_post, true));

  return jsonb_build_object('branch', v_branch, 'all_branches', v_hq and v_branch is null, 'members', v_out);
end $$;

revoke all on function public.get_working_out_now(text) from public, anon;
grant execute on function public.get_working_out_now(text) to authenticated;

-- 2) 커뮤니티 함수들 — 전 지점 조건 한 줄씩만 바꾼다 (본문 나머지는 그대로)
do $$
declare
  f record;
  d text;
  d2 text;
begin
  for f in
    select * from (values
      -- 피드: 이번 주 목표 · 승급 축하 · 오늘도 한 판(출석) 세 곳이 같은 줄이다
      ('public.get_community_feed(integer)',
       '(v_all or p.branch_name = v_branch)',
       '((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)'),
      -- 피드: 오늘 운동 한 줄 글
      ('public.get_community_feed(integer)',
       E'and (v_all\n            or e.user_id = v_uid',
       E'and ((v_all and public.is_branch_visible(p.branch_name))\n            or e.user_id = v_uid'),
      ('public.get_second_cheer_candidates(integer,text)',
       'where (v_all or p.branch_name = v_branch)',
       'where ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)'),
      ('public.get_cornerman_candidates(integer)',
       'AND (v_all OR p.branch_name = v_my_branch)',
       'AND ((v_all AND public.is_branch_visible(p.branch_name)) OR p.branch_name = v_my_branch)'),
      ('public.get_partner_calls()',
       'where (v_all or c.branch_name = v_branch)',
       'where ((v_all and public.is_branch_visible(c.branch_name)) or c.branch_name = v_branch)'),
      ('public.get_gear_posts(integer)',
       'where (v_all or g.branch_name = v_branch)',
       'where ((v_all and public.is_branch_visible(g.branch_name)) or g.branch_name = v_branch)'),
      ('public.get_titlematch_feed(integer)',
       'and (v_all or p.branch_name = v_branch)',
       'and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_branch)')
    ) as t(sig, old_txt, new_txt)
  loop
    d := pg_get_functiondef(f.sig::regprocedure);
    if position(f.new_txt in d) > 0 then
      continue; -- 이미 바뀜
    end if;
    d2 := replace(d, f.old_txt, f.new_txt);
    if d2 = d then
      raise exception '바꿀 줄을 못 찾음: % / %', f.sig, f.old_txt;
    end if;
    execute d2;
  end loop;
end $$;
