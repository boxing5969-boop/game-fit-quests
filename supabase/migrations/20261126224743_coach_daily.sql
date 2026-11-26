-- 코치 매일 리포트 · 오늘 미션 1단계 (2026-11-26 대표님 「보고서쓴거는 일단 추천대로 진행하자」 · 선릉역점 · 12/1 06:40 첫 발송)
--   문서 docs/features/68-코치-매일-리포트.md
--   · 크론 coach-daily 매일 06:40 KST: 오늘 근무하는 코치님마다 「어제 숫자 + 오늘 미션 최대 3개」를 만들고(coach_daily_build),
--     시작일(start_date)부터 알림 1통(coach_daily_send). 시작일 전에는 만들기만 한다 — 대표님 미리보기(알림 없음 · 코치님 화면 없음).
--   · 내 시간 = 그날 요일 근무 시간표(시작 30분 전 ~ 끝) — 그날 출근 기록(staff_duty_logs)이 있는 코치님만.
--     휴직 등으로 최근 14일 출근 기록이 없으면 리포트 · 미션에서 빠진다(새로 온 코치님은 시작일부터 14일 동안 예외).
--   · 내 시간 회원 = 최근 28일 방문(하루 첫 출석)의 절반 이상이 그 코치님 시간인 회원.
--   · 미션 완료 = 그날 그 코치님이 그 회원에게 남긴 지도자 홈 기록(이야기함 · 안내 · 처방) · 매뉴얼은 그날 서명.
--   · 돈은 넣지 않는다(건수만). 알림에는 숫자만 — 회원 이름은 앱 안 미션 칸에서만.
--   · 신규 위험 · 기간 임박 · 끝난 회원 기준은 지도자 홈(_leader_conf)과 같은 값을 쓴다.

insert into public.app_settings (key, value, updated_at)
values (
  'coach_daily',
  jsonb_build_object(
    'note', '코치 매일 리포트 · 오늘 미션 (2026-11-26 대표님 「추천대로 진행하자」). branches = 켠 지점 · start_date = 코치님 알림 · 화면 시작일(그 전에는 대표님 미리보기만) · missions = 하루 미션 수 · grace_min = 근무 시작 몇 분 전부터 내 시간 · home_share = 내 시간 회원 기준(방문 중 내 시간 비율) · window_days = 내 시간 회원을 볼 날수 · active_days = 이 날수 안에 출근 기록이 없으면 빠짐 · target_rate = 재등록 목표(%).',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'start_date', '2026-12-01',
    'missions', 3,
    'grace_min', 30,
    'home_share', 0.5,
    'window_days', 28,
    'active_days', 14,
    'target_rate', 70
  ),
  now()
)
on conflict (key) do nothing;

create table if not exists public.coach_daily_reports (
  day date not null,
  branch_name text not null,
  coach_user_id uuid not null,
  payload jsonb not null,
  built_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (day, coach_user_id)
);
create index if not exists coach_daily_reports_branch_idx on public.coach_daily_reports (branch_name, day desc);
alter table public.coach_daily_reports enable row level security;
revoke all on table public.coach_daily_reports from anon, authenticated;
comment on table public.coach_daily_reports is
  '코치 매일 리포트 — 날짜 · 코치님마다 한 줄(payload: branch 어제 지점 출석 · month 이번 달 재등록 · mine 어제 내 시간 · today 오늘 시간표). 크론 coach-daily 가 만들고 sent_at = 알림 보낸 시각. 함수로만(coach_daily_me).';

create table if not exists public.coach_daily_missions (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  branch_name text not null,
  coach_user_id uuid not null,
  rank smallint not null check (rank between 1 and 5),
  kind text not null check (kind in ('expiring', 'starter', 'first', 'manual', 'winback')),
  member_user_id uuid,
  book text,
  chapter text,
  reasons text[] not null default '{}',
  info jsonb not null default '{}'::jsonb,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (day, coach_user_id, rank)
);
create unique index if not exists coach_daily_missions_member_day
  on public.coach_daily_missions (day, branch_name, member_user_id) where member_user_id is not null;
create index if not exists coach_daily_missions_coach_idx on public.coach_daily_missions (coach_user_id, day desc);
alter table public.coach_daily_missions enable row level security;
revoke all on table public.coach_daily_missions from anon, authenticated;
comment on table public.coach_daily_missions is
  '코치 오늘 미션 — 날짜 · 코치님마다 최대 3개(expiring 기간 임박 · starter 재미 위험 신규 · first 어제 첫 출석 · manual 매뉴얼 1장 · winback 끝난 회원). 한 회원은 하루 한 코치님에게만. done_at = 다음 날 아침에 찍는 완료 도장(그날 기록 · 서명). 함수로만.';

create table if not exists public.coach_daily_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  day date not null,
  result jsonb not null
);
alter table public.coach_daily_runs enable row level security;
revoke all on table public.coach_daily_runs from anon, authenticated;
comment on table public.coach_daily_runs is '코치 매일 리포트 크론 실행 기록(지점마다 만든 수 · 보낸 수 · 오류). 대표님 미리보기에 마지막 실행으로 보인다.';

create or replace function public._coach_daily_conf()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'coach_daily'), '{}'::jsonb)
$$;

create or replace function public._coach_daily_on(_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _branch is not null
     and _branch in (select jsonb_array_elements_text(coalesce(public._coach_daily_conf() -> 'branches', '[]'::jsonb)))
$$;

-- 그 지점 회원(지도진 · 체험용 · 합쳐진 계정 제외) — 지도자 홈 leader_home 과 같은 기준
create or replace function public._coach_daily_members(_branch text)
returns table(user_id uuid, membership_end date)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.membership_end
    from public.profiles p
   where p.branch_name = _branch
     and not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and p.merged_into is null
     and not exists (
       select 1 from public.user_roles r
        where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
     )
$$;

-- 그날(요일) 근무 시간표 — 운영본부 근무자 카드 · 시간표(그 지점 지도진만 · 본사 제외)
--   on_duty = 그날 출근 기록이 있음 · recent = 그날 전 active_days 안에 출근 기록이 있거나 시작한 지 active_days 안
create or replace function public._coach_daily_rules(_branch text, _day date)
returns table(coach uuid, staff_name text, start_time time, end_time time, on_duty boolean, recent boolean)
language sql
stable
security definer
set search_path = public
as $$
  with conf as (
    select greatest(1, least(60, coalesce((public._coach_daily_conf() ->> 'active_days')::integer, 14))) as ad
  )
  select s.user_id, s.name, r.start_time, r.end_time,
         exists (select 1 from public.staff_duty_logs d where d.user_id = s.user_id and d.attend_date = _day),
         (s.start_date is not null and s.start_date > _day - conf.ad)
           or exists (select 1 from public.staff_duty_logs d
                       where d.user_id = s.user_id and d.attend_date between _day - conf.ad and _day - 1)
    from public.ops_shift_rules r
    join public.ops_staff s on s.id = r.staff_id
    cross join conf
   where s.branch_name = _branch and s.active and s.user_id is not null
     and r.weekday = extract(dow from _day)::integer
     and r.valid_from <= _day
     and (r.valid_to is null or r.valid_to >= _day)
     and (s.start_date is null or s.start_date <= _day)
     and (s.end_date is null or s.end_date >= _day)
     and exists (select 1 from public._strategy_branch_staff(_branch) x where x.user_id = s.user_id)
     and not coalesce(public._strategy_hq(s.user_id), false)
$$;

create or replace function public.coach_daily_build(p_branch text, p_day date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c jsonb := public._coach_daily_conf();
  lc_conf jsonb := public._leader_conf();
  v_grace interval := make_interval(mins => greatest(0, least(120, coalesce((c ->> 'grace_min')::integer, 30))));
  v_share numeric := greatest(0.1, least(1, coalesce((c ->> 'home_share')::numeric, 0.5)));
  v_win integer := greatest(7, least(90, coalesce((c ->> 'window_days')::integer, 28)));
  v_max integer := greatest(1, least(5, coalesce((c ->> 'missions')::integer, 3)));
  v_target integer := greatest(1, least(100, coalesce((c ->> 'target_rate')::integer, 70)));
  v_exp integer := greatest(1, coalesce((lc_conf ->> 'expiring_days')::integer, 14));
  v_wb integer := greatest(1, coalesce((lc_conf ->> 'winback_days')::integer, 30));
  v_sd integer := greatest(7, coalesce((lc_conf ->> 'starter_days')::integer, 28));
  v_goal integer := greatest(1, coalesce((lc_conf ->> 'starter_goal')::integer, 8));
  v_watch integer;
  v_gap integer := greatest(3, coalesce((lc_conf ->> 'gap_days')::integer, 7));
  v_y date := p_day - 1;
  v_from timestamptz := (p_day - v_win)::timestamp at time zone 'Asia/Seoul';
  v_day0 timestamptz := p_day::timestamp at time zone 'Asia/Seoul';
  v_y0 timestamptz := (p_day - 1)::timestamp at time zone 'Asia/Seoul';
  v_branch jsonb;
  v_month jsonb;
  v_mine jsonb;
  v_cands jsonb;
  v_home jsonb;
  v_coach record;
  v_cand record;
  v_rank integer;
  v_kinds text[];
  v_assigned uuid[];
  v_manual jsonb;
  v_reports integer := 0;
  v_missions integer := 0;
  v_stamped integer := 0;
begin
  if p_branch is null or p_day is null then
    raise exception 'coach_daily_build: 지점과 날짜가 필요해요';
  end if;
  v_watch := greatest(v_sd, coalesce((lc_conf ->> 'watch_days')::integer, 56));

  -- 어제 미션 완료 도장(2단계 레벨용) — 그날 그 코치님이 그 회원에게 남긴 기록, 매뉴얼은 그날 서명
  update public.coach_daily_missions dm
     set done_at = coalesce(
       (select min(l.created_at) from public.leader_contacts l
         where dm.member_user_id is not null and l.member_user_id = dm.member_user_id and l.staff_user_id = dm.coach_user_id
           and l.removed_at is null and l.created_at >= v_y0 and l.created_at < v_day0),
       (select min(r.signed_at) from public.coach_manual_reads r
         where dm.kind = 'manual' and r.user_id = dm.coach_user_id and r.signed_at >= v_y0 and r.signed_at < v_day0))
   where dm.day = v_y and dm.branch_name = p_branch and dm.done_at is null
     and ((dm.member_user_id is not null and exists (
            select 1 from public.leader_contacts l
             where l.member_user_id = dm.member_user_id and l.staff_user_id = dm.coach_user_id
               and l.removed_at is null and l.created_at >= v_y0 and l.created_at < v_day0))
       or (dm.kind = 'manual' and exists (
            select 1 from public.coach_manual_reads r
             where r.user_id = dm.coach_user_id and r.signed_at >= v_y0 and r.signed_at < v_day0)));
  get diagnostics v_stamped = row_count;

  -- 어제 지점 숫자(하루 첫 출석 기준 · 겹친 기록 제외)
  with m as (select * from public._coach_daily_members(p_branch)),
  yv as (
    select distinct a.user_id
      from public.attendance_logs a join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at >= v_y0 and a.checked_in_at < v_day0
  ), fv as (
    select a.user_id, min(a.checked_in_at) as first_at
      from public.attendance_logs a join yv on yv.user_id = a.user_id
     where not coalesce(a.is_duplicate, false)
     group by a.user_id
  ), n as (
    select (select count(*) from yv)::integer as visitors,
           (select count(*) from m where m.membership_end >= v_y)::integer as active,
           (select count(*) from fv where fv.first_at >= v_y0)::integer as first_timers
  )
  select jsonb_build_object(
    'day', v_y, 'visitors', n.visitors, 'active', n.active, 'first_timers', n.first_timers,
    'rate', case when n.active > 0 then round(n.visitors * 100.0 / n.active, 1) end
  ) into v_branch
  from n;

  -- 이번 달 재등록(153OS 매출 이름 대조 추정 — leader-kpi 가 05:12 에 계산) · 어제 등록 건수(있을 때만) · 금액은 넣지 않는다
  select jsonb_build_object(
           'month', k.payload -> 'current' ->> 'month',
           'n', coalesce((k.payload -> 'current' ->> 'n')::integer, 0),
           'renewed', coalesce((k.payload -> 'current' ->> 'renewed')::integer, 0),
           'open', coalesce((k.payload -> 'current' ->> 'open')::integer, 0),
           'target_rate', v_target,
           'recent_rate', k.payload -> 'recent' -> 'rate',
           'yesterday', case when k.payload -> 'yesterday' ->> 'day' = v_y::text then k.payload -> 'yesterday' end,
           'computed_at', k.computed_at)
    into v_month
    from public.leader_kpi k
   where k.branch_name = p_branch;

  -- 미션 후보(오늘 아침 기준) — 회원마다 「가장 많이 온 시간의 코치님」(owner: 절반 이상 · near: 가장 많음)
  with m as (select * from public._coach_daily_members(p_branch)),
  staff as (
    select x.user_id from public._strategy_branch_staff(p_branch) x where not coalesce(public._strategy_hq(x.user_id), false)
  ), v as (
    select distinct on (a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date)
           a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as d, (a.checked_in_at at time zone 'Asia/Seoul')::time as t
      from public.attendance_logs a join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at >= v_from and a.checked_in_at < v_day0
     order by a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
  ), cov as (
    select distinct v.user_id, v.d, s.user_id as coach
      from v
      join public.ops_shift_rules r
        on r.weekday = extract(dow from v.d)::integer
       and r.valid_from <= v.d and (r.valid_to is null or r.valid_to >= v.d)
       and v.t >= r.start_time - v_grace and v.t < r.end_time
      join public.ops_staff s
        on s.id = r.staff_id and s.branch_name = p_branch and s.active and s.user_id is not null
       and (s.start_date is null or s.start_date <= v.d) and (s.end_date is null or s.end_date >= v.d)
      join staff on staff.user_id = s.user_id
     where exists (select 1 from public.staff_duty_logs d where d.user_id = s.user_id and d.attend_date = v.d)
  ), tot as (
    select v.user_id, count(*) as n from v group by v.user_id
  ), sh as (
    select cov.user_id, cov.coach, count(*)::numeric / max(tot.n) as s
      from cov join tot on tot.user_id = cov.user_id
     group by cov.user_id, cov.coach
  ), mx as (
    select sh.user_id, max(sh.s) as smax from sh group by sh.user_id
  ), best as (
    -- 시간이 겹치는 코치님(예: 저녁 19~22시)은 같은 비율이면 모두 「내 시간 회원」으로 본다
    select sh.user_id, array_agg(sh.coach order by sh.coach) as coaches, max(sh.s) as s
      from sh join mx on mx.user_id = sh.user_id and sh.s = mx.smax
     group by sh.user_id
  ), lc as (
    select l.member_user_id, max(l.created_at) as last_at
      from public.leader_contacts l
     where l.branch_name = p_branch and l.removed_at is null and l.created_at < v_day0
     group by l.member_user_id
  ), allv as (
    select a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as d
      from public.attendance_logs a join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at < v_day0
     group by 1, 2
  ), st as (
    select allv.user_id, min(allv.d) as fd, max(allv.d) as ld from allv group by allv.user_id
  ), st2 as (
    -- 지도자 홈과 같은 셈: dayn = 첫 출석일부터 오늘까지(첫날 = 1) · c28 = 첫 starter_days 안 출석 일수
    select st.*, (p_day - st.fd + 1) as dayn, (p_day - st.ld) as gapn,
           (select count(*) from allv x where x.user_id = st.user_id and x.d <= st.fd + (v_sd - 1))::integer as c28
      from st
     where st.fd >= p_day - (v_watch - 1) and st.fd < p_day
  ), cands as (
    select 'expiring'::text as kind, m.user_id as member,
           case when b.s >= v_share then to_jsonb(b.coaches) end as owner, to_jsonb(b.coaches) as near,
           ((case when coalesce(f.first_term, false) then 0 else 100 end) + (m.membership_end - p_day))::numeric as prio,
           array_remove(array[case when coalesce(f.first_term, false) then 'first_term' end], null) as reasons,
           jsonb_build_object('days_left', m.membership_end - p_day, 'end', m.membership_end, 'first_term', coalesce(f.first_term, false)) as info
      from m
      left join best b on b.user_id = m.user_id
      left join public.leader_member_flags f on f.user_id = m.user_id and f.branch_name = p_branch
      left join lc on lc.member_user_id = m.user_id
     where m.membership_end between p_day and p_day + v_exp
       and (lc.last_at is null or lc.last_at < v_day0 - interval '7 days')
    union all
    select 'starter', st2.user_id,
           case when b.s >= v_share then to_jsonb(b.coaches) end, to_jsonb(b.coaches),
           (200 + (case when st2.gapn >= v_gap then 0 else 20 end) + least(st2.dayn, v_watch) / 10.0)::numeric,
           array_remove(array[
             case when st2.dayn <= v_sd and st2.c28 < floor(st2.dayn * v_goal::numeric / v_sd) then 'behind' end,
             case when st2.gapn >= v_gap then 'gap' end], null),
           jsonb_build_object('day', st2.dayn, 'count', st2.c28, 'goal', v_goal, 'gap', st2.gapn,
                              'expected', case when st2.dayn <= v_sd then floor(st2.dayn * v_goal::numeric / v_sd)::integer else v_goal end)
      from st2
      join m on m.user_id = st2.user_id
      left join best b on b.user_id = st2.user_id
      left join lc on lc.member_user_id = st2.user_id
     where not exists (select 1 from public.motivation_awards x where x.user_id = st2.user_id and x.kind = 'starter')
       and (lc.last_at is null or lc.last_at < v_day0 - interval '3 days')
       and ((st2.dayn <= v_sd and st2.c28 < floor(st2.dayn * v_goal::numeric / v_sd)) or st2.gapn >= v_gap)
    union all
    select 'first', st.user_id,
           coalesce((select to_jsonb(array_agg(cv.coach order by cv.coach)) from cov cv where cv.user_id = st.user_id and cv.d = v_y),
                    case when b.s >= v_share then to_jsonb(b.coaches) end),
           to_jsonb(b.coaches), 300::numeric, array['first'], jsonb_build_object('first_day', st.fd)
      from st
      join m on m.user_id = st.user_id
      left join best b on b.user_id = st.user_id
     where st.fd = v_y
    union all
    select 'winback', m.user_id, case when b.s >= v_share then to_jsonb(b.coaches) end, to_jsonb(b.coaches),
           (500 + (p_day - m.membership_end))::numeric, array['winback'],
           jsonb_build_object('days_since', p_day - m.membership_end, 'end', m.membership_end)
      from m
      left join best b on b.user_id = m.user_id
      left join lc on lc.member_user_id = m.user_id
     where m.membership_end between p_day - v_wb and p_day - 1
       and (lc.last_at is null or lc.last_at < v_day0 - interval '14 days')
  )
  select coalesce((select jsonb_agg(jsonb_build_object(
                     'kind', x.kind, 'member', x.member, 'owner', x.owner, 'near', x.near,
                     'prio', x.prio, 'reasons', to_jsonb(x.reasons), 'info', x.info) order by x.prio, x.member)
                     from cands x), '[]'::jsonb),
         coalesce((select jsonb_object_agg(h.coach::text, h.n)
                     from (select u.coach, count(*)::integer as n
                             from best b cross join lateral unnest(b.coaches) as u(coach)
                            where b.s >= v_share group by u.coach) h), '{}'::jsonb)
    into v_cands, v_home;

  -- 이미 만든 미션의 회원(낮에 다시 돌려도 한 회원은 한 코치님에게만)
  select coalesce(array_agg(x.member_user_id), '{}') into v_assigned
    from public.coach_daily_missions x
   where x.day = p_day and x.branch_name = p_branch and x.member_user_id is not null;

  -- 오늘 근무하는 코치님마다: 리포트 + 미션
  for v_coach in
    select tr.coach, min(tr.staff_name) as staff_name, min(tr.start_time) as st,
           string_agg(to_char(tr.start_time, 'HH24:MI') || '–' || to_char(tr.end_time, 'HH24:MI'), ' · ' order by tr.start_time) as label
      from public._coach_daily_rules(p_branch, p_day) tr
     where tr.recent
     group by tr.coach
     order by min(tr.start_time), tr.coach
  loop
    with m as (select * from public._coach_daily_members(p_branch)),
    yr as (select * from public._coach_daily_rules(p_branch, v_y) x where x.coach = v_coach.coach),
    yw as (select * from yr where yr.on_duty),
    yv as (
      select distinct on (a.user_id) a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::time as t
        from public.attendance_logs a join m on m.user_id = a.user_id
       where not coalesce(a.is_duplicate, false) and a.checked_in_at >= v_y0 and a.checked_in_at < v_day0
       order by a.user_id, a.checked_in_at
    ), mineyv as (
      select yv.user_id from yv where exists (select 1 from yw where yv.t >= yw.start_time - v_grace and yv.t < yw.end_time)
    )
    select jsonb_build_object(
      'scheduled', exists (select 1 from yr),
      'worked', exists (select 1 from yw),
      'label', (select string_agg(to_char(yw.start_time, 'HH24:MI') || '–' || to_char(yw.end_time, 'HH24:MI'), ' · ' order by yw.start_time) from yw),
      'visitors', (select count(*) from mineyv),
      'first_timers', (select count(*) from mineyv
                        where not exists (select 1 from public.attendance_logs a
                                           where a.user_id = mineyv.user_id and not coalesce(a.is_duplicate, false) and a.checked_in_at < v_y0)),
      'contacts', (select count(*) from public.leader_contacts l
                    where l.staff_user_id = v_coach.coach and l.branch_name = p_branch and l.removed_at is null
                      and l.created_at >= v_y0 and l.created_at < v_day0),
      'home', coalesce((v_home ->> v_coach.coach::text)::integer, 0),
      'missions_done', (select count(*) from public.coach_daily_missions x
                         where x.day = v_y and x.coach_user_id = v_coach.coach and x.done_at is not null),
      'missions_total', (select count(*) from public.coach_daily_missions x
                          where x.day = v_y and x.coach_user_id = v_coach.coach)
    ) into v_mine;

    insert into public.coach_daily_reports (day, branch_name, coach_user_id, payload)
    values (p_day, p_branch, v_coach.coach, jsonb_build_object(
      'branch', v_branch, 'month', v_month, 'mine', v_mine,
      'today', jsonb_build_object('label', v_coach.label, 'name', v_coach.staff_name)))
    on conflict (day, coach_user_id) do update set payload = excluded.payload, built_at = now();
    v_reports := v_reports + 1;

    -- 이미 만든 날은 미션을 다시 고르지 않는다(낮에 다시 돌려도 바뀌지 않게)
    continue when exists (select 1 from public.coach_daily_missions x where x.day = p_day and x.coach_user_id = v_coach.coach);

    v_rank := 0;
    v_kinds := '{}';
    -- 다음에 읽을 필독 장(1권 → 2권 차례 · 새 판이면 다시)
    select jsonb_build_object(
             'book', b.book,
             'chapter', ch ->> 'id',
             'book_no', coalesce(nullif(b.data ->> 'no', ''), case b.book when 'book1' then '1권' when 'book2' then '2권' else b.book end),
             'no', coalesce(nullif(ch ->> 'no', ''),
                            case when ch ->> 'id' = 'prologue' then '프롤로그'
                                 when ch ->> 'id' ~ '^ch[0-9]+$' then substr(ch ->> 'id', 3) || '장' end),
             'title', nullif(ch ->> 'title', ''),
             'minutes', ch -> 'minutes')
      into v_manual
      from public.coach_manual_books b,
           lateral jsonb_array_elements(coalesce(b.data -> 'chapters', '[]'::jsonb)) with ordinality as t(ch, ord)
     where nullif(ch ->> 'id', '') is not null
       and coalesce((ch ->> 'required')::boolean, true)
       and not exists (
         select 1 from public.coach_manual_reads r
          where r.user_id = v_coach.coach and r.book = b.book and r.chapter = ch ->> 'id' and r.signed_at is not null
            and r.version >= greatest(1, coalesce(floor((ch ->> 'version')::numeric)::integer, 1)))
     order by b.book, t.ord
     limit 1;

    -- 1차: 내 시간 회원 + 매뉴얼, 종류마다 하나씩(급한 순)
    for v_cand in
      select e ->> 'kind' as kind, nullif(e ->> 'member', '')::uuid as member, (e ->> 'prio')::numeric as prio,
             array(select jsonb_array_elements_text(e -> 'reasons')) as reasons, e -> 'info' as info
        from jsonb_array_elements(v_cands) e
       where (e -> 'owner') ? v_coach.coach::text
      union all
      select 'manual', null::uuid, 400::numeric, array[]::text[], v_manual
       where v_manual is not null
      order by 3, 1
    loop
      exit when v_rank >= v_max;
      continue when v_cand.kind = any(v_kinds);
      continue when v_cand.member is not null and v_cand.member = any(v_assigned);
      v_rank := v_rank + 1;
      insert into public.coach_daily_missions (day, branch_name, coach_user_id, rank, kind, member_user_id, book, chapter, reasons, info)
      values (p_day, p_branch, v_coach.coach, v_rank, v_cand.kind, v_cand.member,
              case when v_cand.kind = 'manual' then v_manual ->> 'book' end,
              case when v_cand.kind = 'manual' then v_manual ->> 'chapter' end,
              v_cand.reasons, coalesce(v_cand.info, '{}'::jsonb));
      v_kinds := v_kinds || v_cand.kind;
      if v_cand.member is not null then
        v_assigned := v_assigned || v_cand.member;
      end if;
    end loop;

    -- 2차: 남은 칸 — 내 시간 회원 먼저, 그다음 주인 없는 회원 중 가장 많이 온 시간이 나인 회원, 그다음 최근 4주 안 온 회원
    if v_rank < v_max then
      for v_cand in
        select e ->> 'kind' as kind, nullif(e ->> 'member', '')::uuid as member,
               array(select jsonb_array_elements_text(e -> 'reasons')) as reasons, e -> 'info' as info,
               case when (e -> 'owner') ? v_coach.coach::text then 0
                    when (e -> 'near') ? v_coach.coach::text then 1
                    else 2 end as fit,
               (e ->> 'prio')::numeric as prio
          from jsonb_array_elements(v_cands) e
         where (e -> 'owner') ? v_coach.coach::text
            or (jsonb_typeof(e -> 'owner') is distinct from 'array'
                and ((e -> 'near') ? v_coach.coach::text or jsonb_typeof(e -> 'near') is distinct from 'array'))
         order by 5, 6, 2
      loop
        exit when v_rank >= v_max;
        continue when v_cand.member is null or v_cand.member = any(v_assigned);
        v_rank := v_rank + 1;
        insert into public.coach_daily_missions (day, branch_name, coach_user_id, rank, kind, member_user_id, reasons, info)
        values (p_day, p_branch, v_coach.coach, v_rank, v_cand.kind, v_cand.member, v_cand.reasons, coalesce(v_cand.info, '{}'::jsonb));
        v_assigned := v_assigned || v_cand.member;
      end loop;
    end if;
    v_missions := v_missions + v_rank;
  end loop;

  return jsonb_build_object('ok', true, 'day', p_day, 'reports', v_reports, 'missions', v_missions,
                            'stamped', v_stamped, 'candidates', jsonb_array_length(v_cands));
end
$$;

create or replace function public.coach_daily_send(p_branch text, p_day date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c jsonb := public._coach_daily_conf();
  v_start date := coalesce(nullif(c ->> 'start_date', '')::date, date '2999-01-01');
  v_short text := regexp_replace(regexp_replace(coalesce(p_branch, ''), '^153복싱짐\s*', ''), '(역점|점)$', '');
  r record;
  v_cnt integer;
  v_need integer;
  v_mon text;
  v_goal text;
  v_title text;
  v_body text;
  v_n integer := 0;
begin
  if p_day < v_start then
    return jsonb_build_object('ok', true, 'preview', true, 'sent', 0);
  end if;
  for r in
    select d.coach_user_id, d.payload
      from public.coach_daily_reports d
     where d.day = p_day and d.branch_name = p_branch and d.sent_at is null
  loop
    select count(*) into v_cnt from public.coach_daily_missions x where x.day = p_day and x.coach_user_id = r.coach_user_id;
    v_need := greatest(0,
      ceil(coalesce((r.payload -> 'month' ->> 'n')::numeric, 0) * coalesce((r.payload -> 'month' ->> 'target_rate')::numeric, 70) / 100)
      - coalesce((r.payload -> 'month' ->> 'renewed')::integer, 0))::integer;
    v_mon := ltrim(nullif(substr(coalesce(r.payload -> 'month' ->> 'month', ''), 6, 2), ''), '0');
    v_goal := case when v_need > 0 and coalesce(v_mon, '') <> '' then v_mon || '월 재등록 목표까지 ' || v_need || '명' end;
    v_title := '📊 어제 ' || v_short || ' ' || coalesce(r.payload -> 'branch' ->> 'visitors', '0') || '명 출석'
               || case when v_cnt > 0 then ' · 오늘 미션 ' || v_cnt || '개' else '' end;
    v_body := case when coalesce((r.payload -> 'mine' ->> 'worked')::boolean, false)
                   then concat_ws(' · ', '어제 내 시간 ' || coalesce(r.payload -> 'mine' ->> 'visitors', '0') || '명', v_goal)
                   else coalesce(v_goal || ' · ', '')
                        || case when v_cnt > 0 then '눌러서 오늘 미션 보기' else '눌러서 어제 숫자 보기' end end;
    insert into public.notifications (user_id, title, body, link)
    values (r.coach_user_id, v_title, v_body, '/home');
    update public.coach_daily_reports set sent_at = now() where day = p_day and coach_user_id = r.coach_user_id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'preview', false, 'sent', v_n);
end
$$;

create or replace function public.coach_daily_run()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  b text;
  v_out jsonb := '[]'::jsonb;
  v_res jsonb;
begin
  for b in select jsonb_array_elements_text(coalesce(public._coach_daily_conf() -> 'branches', '[]'::jsonb)) loop
    begin
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'branch', b, 'build', public.coach_daily_build(b, v_day), 'send', public.coach_daily_send(b, v_day)));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('branch', b, 'error', left(sqlerrm, 300)));
    end;
  end loop;
  v_res := jsonb_build_object('day', v_day, 'branches', v_out);
  insert into public.coach_daily_runs (day, result) values (v_day, v_res);
  delete from public.coach_daily_runs where ran_at < now() - interval '120 days';
  return v_res;
end
$$;

create or replace function public.coach_daily_me(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  c jsonb := public._coach_daily_conf();
  v_hq boolean;
  v_role text;
  v_branch text;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_day0 timestamptz := (now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul';
  v_start date := coalesce(nullif(c ->> 'start_date', '')::date, date '2999-01-01');
  v_preview boolean;
  v_report jsonb;
  v_any jsonb;
  v_missions jsonb;
  v_team jsonb := null;
  v_run jsonb := null;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_hq := public._strategy_hq(v_me);
  if v_hq then
    v_role := 'admin';
    v_branch := coalesce(
      nullif(trim(p_branch), ''),
      (select p.branch_name from public.profiles p where p.user_id = v_me and public._coach_daily_on(p.branch_name)),
      (select x from jsonb_array_elements_text(coalesce(c -> 'branches', '[]'::jsonb)) x limit 1));
  else
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me) then
      return jsonb_build_object('on', false);
    end if;
    v_role := case when public.has_role(v_me, 'branch_manager') then 'manager' else 'coach' end;
  end if;
  if not public._coach_daily_on(v_branch) then
    return jsonb_build_object('on', false);
  end if;
  v_preview := v_day < v_start;
  if v_preview and v_role <> 'admin' then
    return jsonb_build_object('on', false, 'preview', true, 'start_date', v_start);
  end if;

  select d.payload into v_report from public.coach_daily_reports d where d.day = v_day and d.coach_user_id = v_me;
  select d.payload into v_any from public.coach_daily_reports d
   where d.day = v_day and d.branch_name = v_branch order by d.built_at desc limit 1;

  -- 미션 한 줄(완료 = 오늘 그 회원에게 남긴 기록 · 매뉴얼은 오늘 서명)
  with ms as (
    select dm.*,
           coalesce(nullif(trim(mp.nickname), ''), mp.name, '회원') as member_name, mp.name as real_name,
           mp.avatar_url, ph.path as photo_path,
           (dm.done_at is not null
             or (dm.member_user_id is not null and exists (
                   select 1 from public.leader_contacts l
                    where l.member_user_id = dm.member_user_id and l.staff_user_id = dm.coach_user_id
                      and l.removed_at is null and l.created_at >= v_day0))
             or (dm.kind = 'manual' and exists (
                   select 1 from public.coach_manual_reads r where r.user_id = dm.coach_user_id and r.signed_at >= v_day0))) as is_done
      from public.coach_daily_missions dm
      left join public.profiles mp on mp.user_id = dm.member_user_id
      left join public.member_coach_photos ph on ph.user_id = dm.member_user_id and ph.removed_at is null
     where dm.day = v_day and dm.branch_name = v_branch
  ), mj as (
    select ms.coach_user_id, ms.rank,
           jsonb_build_object(
             'id', ms.id, 'rank', ms.rank, 'kind', ms.kind, 'reasons', to_jsonb(ms.reasons), 'info', ms.info,
             'member', ms.member_user_id,
             'name', case when ms.member_user_id is not null then ms.member_name end,
             'real_name', case when ms.member_user_id is not null then ms.real_name end,
             'avatar_url', case when ms.member_user_id is not null then ms.avatar_url end,
             'photo_path', ms.photo_path, 'book', ms.book, 'chapter', ms.chapter, 'done', ms.is_done) as j,
           ms.is_done
      from ms
  )
  select coalesce((select jsonb_agg(mj.j order by mj.rank) from mj where mj.coach_user_id = v_me), '[]'::jsonb),
         case when v_role in ('manager', 'admin') then
           coalesce((select jsonb_agg(jsonb_build_object(
                       'coach', d.coach_user_id,
                       'name', coalesce(d.payload -> 'today' ->> 'name', nullif(trim(sp.name), ''), '코치'),
                       'today', d.payload -> 'today' ->> 'label',
                       'mine', d.payload -> 'mine',
                       'sent', d.sent_at is not null,
                       'missions', coalesce((select jsonb_agg(mj.j order by mj.rank) from mj where mj.coach_user_id = d.coach_user_id), '[]'::jsonb),
                       'done', (select count(*) from mj where mj.coach_user_id = d.coach_user_id and mj.is_done),
                       'total', (select count(*) from mj where mj.coach_user_id = d.coach_user_id)
                     ) order by d.payload -> 'today' ->> 'label', d.coach_user_id)
                       from public.coach_daily_reports d
                       left join public.profiles sp on sp.user_id = d.coach_user_id
                      where d.day = v_day and d.branch_name = v_branch), '[]'::jsonb)
         end
    into v_missions, v_team;

  if v_role = 'admin' then
    select jsonb_build_object('ran_at', x.ran_at, 'day', x.day,
                              'error', (select bool_or(e ? 'error') from jsonb_array_elements(x.result -> 'branches') e))
      into v_run
      from public.coach_daily_runs x
     order by x.ran_at desc
     limit 1;
  end if;

  return jsonb_build_object(
    'on', true,
    'role', v_role,
    'branch', v_branch,
    'day', v_day,
    'preview', v_preview,
    'start_date', v_start,
    'has_mine', v_report is not null,
    'report', coalesce(v_report, case when v_any is not null then jsonb_build_object('branch', v_any -> 'branch', 'month', v_any -> 'month') end),
    'missions', v_missions,
    'team', v_team,
    'last_run', v_run
  );
end
$$;

revoke all on function public._coach_daily_conf() from public, anon, authenticated;
revoke all on function public._coach_daily_on(text) from public, anon, authenticated;
revoke all on function public._coach_daily_members(text) from public, anon, authenticated;
revoke all on function public._coach_daily_rules(text, date) from public, anon, authenticated;
revoke all on function public.coach_daily_build(text, date) from public, anon, authenticated;
revoke all on function public.coach_daily_send(text, date) from public, anon, authenticated;
revoke all on function public.coach_daily_run() from public, anon, authenticated;
revoke all on function public.coach_daily_me(text) from public, anon;
grant execute on function public.coach_daily_me(text) to authenticated;

do $do$
begin
  if exists (select 1 from cron.job where jobname = 'coach-daily') then
    perform cron.unschedule('coach-daily');
  end if;
  perform cron.schedule('coach-daily', '40 21 * * *', 'select public.coach_daily_run();');
end
$do$;
