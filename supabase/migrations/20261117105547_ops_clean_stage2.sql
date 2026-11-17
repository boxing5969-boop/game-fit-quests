-- 153운영본부 「오늘 청소」 2단계 — 대표님 · 지점장 현황 · 문제 처리 · 미완료 알림 · 항목 · 시간대 고치기 · 지점 고르기
-- (2026-11-17 대표님 「1단계 추천대로 적용하고 다음단계가자」 · 보고서 「153복싱짐 선릉역점 청소 매뉴얼·체크리스트 보고서」 제작 순서 2단계
--  https://claude.ai/artifact/V971FZ8819azL7YQaADgaN)
--   새 칸 5(ops_clean_checks.resolved_at · resolved_by · resolve_note / ops_clean_slots.alert_min · alert_loud) · 새 표 1(ops_clean_notices)
--   · 새 함수 6(화면 5 · 예약 1) · 고친 함수 2(ops_clean_day · _ops_clean_handover — 처리한 문제 표시 · 그날 체크한 항목은 그 뒤에 고치거나 빼도 그날 목록에 남김)
--   줄을 지우는 문장은 없다 — 항목을 빼면 active = false.
--   현황 · 문제 처리 · 고치기 = 대표님 · 그 지점 관리자(_ops_plan_can_view_all — 1단계 '대신 체크'와 같은 기준).
--   문제 처리: 처리한 시각이 그 문제를 남긴 시각(at)보다 뒤면 '처리됨' — 코치님이 같은 항목을 다시 '문제'로 남기면 at 이 바뀌어 다시 열린다.
--     처음 처리할 때 그 문제를 남긴 분께 알림(_ops_plan_notify — 밤 10시 ~ 아침 8시는 알림함에만).
--   미완료 알림(5분마다 ops-clean-late): 시작 + alert_min 분이 지나도 끝내기 전이고 체크 안 한 항목이 남으면 그 지점 지점장(없으면 전체관리자)께 그날 한 번
--     · 1시간 넘게 지난 차례 · 휴관일 · 도는 요일이 아닌 날은 안 보냄 · alert_loud = false 면 밤 10시 ~ 아침 8시는 알림함에만
--     · 처음 값: 오픈 · 마감 = 끝낼 때까지 분(선릉역점 11:50 · 23:00) · 저녁은 끔 — 마감 23:00 알림을 휴대폰으로 받으려면 alert_loud = true
--   항목별 '보통 걸린 분' = 바로 앞 체크(첫 항목은 청소 시작)부터 이 항목을 완료로 누를 때까지 — 30초 안에 연달아 누른 것 · 1시간 넘는 것 ·
--     청소 시작 전 · 끝낸 뒤(끝내기 전이면 시작 3시간 뒤) 체크는 빼고 가운데 값. 화면은 3번 넘게 잰 항목만 보여 준다.
--   화면 src/lib/opsCleanReport.ts 와 같은 검사 말 · 시험 opsCleanReport.test.ts

-- ── 새 칸 · 새 표 ────────────────────────────────────────────

alter table public.ops_clean_checks add column if not exists resolved_at timestamptz;
alter table public.ops_clean_checks add column if not exists resolved_by uuid;
alter table public.ops_clean_checks add column if not exists resolve_note text
  check (resolve_note is null or char_length(resolve_note) <= 200);

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ops_clean_slots' and column_name = 'alert_min') then
    alter table public.ops_clean_slots add column alert_min smallint check (alert_min is null or alert_min between 0 and 240);
    -- 처음 한 번만: 오픈 · 마감은 끝낼 때까지 분에 알림
    update public.ops_clean_slots set alert_min = budget_min where slot in ('open', 'close');
  end if;
end $$;
alter table public.ops_clean_slots add column if not exists alert_loud boolean not null default false;

create table if not exists public.ops_clean_notices (
  branch_name text not null,
  work_date date not null,
  slot text not null,
  kind text not null check (kind in ('late')),
  left_n int,
  sent_to int not null default 0,
  sent_at timestamptz not null default now(),
  primary key (branch_name, work_date, slot, kind)
);
alter table public.ops_clean_notices enable row level security;
revoke all on public.ops_clean_notices from anon, authenticated;

-- ── 고친 함수 (DB 의 지금 정의 = 1단계 파일 위에) ───────────────

-- 인수인계 — 문제 줄에 '처리됨'
create or replace function public._ops_clean_handover(_branch text, _date date, _time time)
returns jsonb language sql stable security definer set search_path = public as $$
  with prev as (
    select max(x.d) as d from (
      select r.work_date as d from public.ops_clean_runs r
       where r.branch_name = _branch and r.work_date < _date and r.work_date >= _date - 7
      union all
      select c.work_date from public.ops_clean_checks c
       where c.branch_name = _branch and c.work_date < _date and c.work_date >= _date - 7 and c.state is not null
    ) x
  ), src as (
    select sl.id, sl.slot, sl.label, sl.start_time, sl.weekdays, _date as d
      from public.ops_clean_slots sl
     where sl.branch_name = _branch and sl.active and sl.start_time < _time
    union all
    select sl.id, sl.slot, sl.label, sl.start_time, sl.weekdays, p.d
      from public.ops_clean_slots sl cross join prev p
     where sl.branch_name = _branch and sl.active and p.d is not null and sl.start_time >= _time
  ), lines as (
    select s.d, s.start_time, 0 as k, null::timestamptz as at,
           jsonb_build_object('kind', 'sum', 'date', s.d, 'slot', s.slot, 'label', s.label, 'time', to_char(s.start_time, 'HH24:MI'),
             'done', (select count(*) from public.ops_clean_checks c join public.ops_clean_items i on i.id = c.item_id
                       where i.slot_id = s.id and c.work_date = s.d and c.state = 'done'),
             'due', (select count(*) from public.ops_clean_items i
                      where i.slot_id = s.id and i.active
                        and public._ops_clean_due(s.d, s.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months)),
             'finished', exists (select 1 from public.ops_clean_runs r
                                  where r.branch_name = _branch and r.work_date = s.d and r.slot = s.slot and r.finished_at is not null)) as j
      from src s
     where exists (select 1 from public.ops_clean_runs r where r.branch_name = _branch and r.work_date = s.d and r.slot = s.slot)
        or exists (select 1 from public.ops_clean_checks c join public.ops_clean_items i on i.id = c.item_id
                    where i.slot_id = s.id and c.work_date = s.d and c.state is not null)
    union all
    select s.d, s.start_time, 1, r.finished_at,
           jsonb_build_object('kind', 'note', 'date', s.d, 'slot', s.slot, 'label', s.label, 'time', to_char(s.start_time, 'HH24:MI'),
             'text', r.note,
             'by_name', case when r.finished_by is null then null else public._ops_task_name(r.finished_by, _branch) end)
      from src s
      join public.ops_clean_runs r on r.branch_name = _branch and r.work_date = s.d and r.slot = s.slot
     where nullif(btrim(coalesce(r.note, '')), '') is not null
    union all
    select s.d, s.start_time, case when c.state = 'issue' then 2 else 3 end, c.at,
           jsonb_build_object('kind', c.state, 'date', s.d, 'slot', s.slot, 'label', s.label, 'time', to_char(s.start_time, 'HH24:MI'),
             'title', i.title, 'text', c.note, 'by_name', public._ops_task_name(c.by_user, _branch),
             -- 2단계: 처리한 문제 (처리한 시각이 그 문제를 남긴 시각 뒤일 때만)
             'resolved', coalesce(c.state = 'issue' and c.resolved_at >= c.at, false),
             'resolve_note', case when c.state = 'issue' and c.resolved_at >= c.at then c.resolve_note end,
             'resolved_by_name', case when c.state = 'issue' and c.resolved_at >= c.at and c.resolved_by is not null
                                      then public._ops_task_name(c.resolved_by, _branch) end)
      from src s
      join public.ops_clean_items i on i.slot_id = s.id
      join public.ops_clean_checks c on c.item_id = i.id and c.work_date = s.d and c.state in ('hold', 'issue')
  )
  select coalesce(jsonb_agg(t.j order by t.d desc, t.start_time desc, t.k, t.at), '[]'::jsonb)
    from (select * from lines l order by l.d desc, l.start_time desc, l.k, l.at limit 12) t;
$$;

-- 그날 청소 — 항목에 '처리됨' · 그날 체크한 항목은 그대로
create or replace function public.ops_clean_day(p_branch text, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_date date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_branches jsonb;
  v_all boolean;
  v_closed boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches
    from public._ops_plan_branches(v_uid) b
   where exists (select 1 from public.ops_clean_slots sl where sl.branch_name = b.branch_name and sl.active);
  if jsonb_array_length(v_branches) = 0 then return jsonb_build_object('on', false); end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e->>'branch' = v_branch) then
    v_branch := coalesce(
      (select e->>'branch' from jsonb_array_elements(v_branches) e
        where e->>'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches->0->>'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  v_date := least(coalesce(p_date, v_today), v_today);
  if v_date < v_today - (case when v_all then 7 else 0 end) then v_date := v_today; end if;
  v_closed := public._cal_closed_on(v_branch, v_date);

  return jsonb_build_object(
    'on', true,
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'me', v_uid,
    'date', v_date,
    'today', v_today,
    'closed', v_closed,
    -- 그 지점 청소가 도는 요일(0=일 … 6=토) — 관리자가 날짜를 넘길 때 청소 없는 요일은 건너뛴다
    'days', coalesce((select jsonb_agg(distinct d.dow order by d.dow)
                        from public.ops_clean_slots sl cross join lateral unnest(sl.weekdays) as d(dow)
                       where sl.branch_name = v_branch and sl.active), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(x.j order by x.start_time, x.sort)
        from (
          select sl.start_time, sl.sort,
                 jsonb_build_object(
                   'slot', sl.slot, 'label', sl.label, 'time', to_char(sl.start_time, 'HH24:MI'), 'budget', sl.budget_min,
                   'mine', me.yes,
                   'people', (select coalesce(jsonb_agg(public._ops_task_name(d.user_id, v_branch)), '[]'::jsonb)
                                from public._ops_clean_people(sl.id, v_date) d),
                   'run', (select jsonb_build_object(
                                    'started_at', r.started_at, 'finished_at', r.finished_at, 'note', r.note,
                                    'finished_by_name', case when r.finished_by is null then null
                                                             else public._ops_task_name(r.finished_by, v_branch) end)
                             from public.ops_clean_runs r
                            where r.branch_name = v_branch and r.work_date = v_date and r.slot = sl.slot),
                   'items', coalesce((
                      select jsonb_agg(jsonb_build_object(
                               'id', i.id, 'zone', i.zone, 'title', i.title, 'min', i.est_min,
                               'done_text', i.done_text, 'how', i.how_text, 'caution', i.caution,
                               'mission', i.mission, 'monthly', i.month_nth is not null,
                               'state', c.state, 'note', c.note,
                               'at', case when c.state is null then null else c.at end,
                               'by_name', case when c.state is null then null else public._ops_task_name(c.by_user, v_branch) end,
                               -- 2단계: 처리한 문제
                               'resolved', coalesce(c.state = 'issue' and c.resolved_at >= c.at, false),
                               'resolve_note', case when c.state = 'issue' and c.resolved_at >= c.at then c.resolve_note end)
                             order by i.sort, i.created_at, i.id)
                        from public.ops_clean_items i
                        left join public.ops_clean_checks c on c.item_id = i.id and c.work_date = v_date
                       where i.slot_id = sl.id
                         -- 2단계: 그날 체크한 항목은 그 뒤에 고치거나 빼도 그날 목록에 남긴다
                         and ((i.active and public._ops_clean_due(v_date, sl.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months))
                              or c.state is not null)), '[]'::jsonb),
                   'handover', public._ops_clean_handover(v_branch, v_date, sl.start_time)) as j
            from public.ops_clean_slots sl
            cross join lateral (
              select exists (select 1 from public._ops_clean_people(sl.id, v_date) d where d.user_id = v_uid) as yes
            ) me
           where sl.branch_name = v_branch and sl.active and not v_closed
             and extract(dow from v_date)::smallint = any (sl.weekdays)
             and (v_all or me.yes)
        ) x), '[]'::jsonb)
  );
end $$;

-- ── 새 화면 함수 ─────────────────────────────────────────────

-- 현황 — 대표님 · 지점 관리자. 기간(최대 62일) 동안 날마다 시간대마다 완료 · 보류 · 문제 · 시작/끝,
--   항목마다 횟수 · 보통 걸린 분, 최근 30일 문제(처리 안 한 것 먼저 · 처리한 것은 14일), 시간대 설정 · 담당 고르기용 근무자.
--   항목은 그 시간대의 뺀 항목까지 모두(고치기 화면이 같은 값을 쓴다).
create or replace function public.ops_clean_report(p_branch text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  v_min int := (extract(hour from v_now at time zone 'Asia/Seoul') * 60 + extract(minute from v_now at time zone 'Asia/Seoul'))::int;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_branches jsonb;
  v_from date;
  v_to date;
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', x.branch_name, 'mine', x.mine) order by x.mine desc, x.branch_name), '[]'::jsonb)
    into v_branches
    from (select b.branch_name,
                 exists (select 1 from public.profiles p where p.user_id = v_uid and p.branch_name = b.branch_name) as mine
            from (select distinct sl.branch_name from public.ops_clean_slots sl where sl.active) b
           where public._ops_plan_can_view_all(v_uid, b.branch_name)) x;
  if jsonb_array_length(v_branches) = 0 then return jsonb_build_object('on', false); end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e->>'branch' = v_branch) then
    v_branch := v_branches->0->>'branch';
  end if;
  v_to := least(coalesce(p_to, v_today), v_today);
  v_from := least(coalesce(p_from, v_to - 6), v_to);
  if v_to - v_from > 61 then v_from := v_to - 61; end if;

  with sl as (
    select s.* from public.ops_clean_slots s where s.branch_name = v_branch and s.active
  ), cells as (   -- (날, 시간대) — 그 시간대가 도는 요일만
    select g.d::date as d, s.id as slot_id, s.slot, s.start_time, s.budget_min, s.weekdays, s.sort,
           public._cal_closed_on(v_branch, g.d::date) as closed
      from generate_series(v_from, v_to, interval '1 day') g(d)
      join sl s on extract(dow from g.d)::smallint = any (s.weekdays)
  ), ci as (      -- 그날 그 시간대 항목 — 그날 하는 항목 + 그날 체크한 항목(그 뒤에 고치거나 뺀 것)
    select ce.d, ce.slot, ce.start_time, ce.budget_min, i.id as item_id, c.state
      from cells ce
      join public.ops_clean_items i on i.slot_id = ce.slot_id
      left join public.ops_clean_checks c on c.item_id = i.id and c.work_date = ce.d
     where not ce.closed
       and ((i.active and public._ops_clean_due(ce.d, ce.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months))
            or c.state is not null)
  ), cnt as (
    select ci.d, ci.slot, count(*)::int as due,
           count(*) filter (where ci.state = 'done')::int as done,
           count(*) filter (where ci.state = 'hold')::int as hold,
           count(*) filter (where ci.state = 'issue')::int as issue
      from ci group by ci.d, ci.slot
  ), st as (      -- 항목마다 — 지난 날 + 오늘은 끝낼 시각이 지난 시간대만
    select ci.item_id, count(*)::int as due_n,
           count(*) filter (where ci.state = 'done')::int as done_n,
           count(*) filter (where ci.state = 'hold')::int as hold_n,
           count(*) filter (where ci.state = 'issue')::int as issue_n
      from ci
     where ci.d < v_today
        or (ci.d = v_today and v_min >= (extract(epoch from ci.start_time) / 60)::int + ci.budget_min)
     group by ci.item_id
  ), seq as (     -- 걸린 분 — 바로 앞 체크(첫 항목은 청소 시작)부터
    select c.item_id, c.state, c.at, r.started_at,
           lag(c.at) over (partition by c.work_date, c.slot order by c.at, c.item_id) as prev_at
      from public.ops_clean_checks c
      join public.ops_clean_runs r on r.branch_name = c.branch_name and r.work_date = c.work_date and r.slot = c.slot
     where c.branch_name = v_branch and c.work_date between v_from and v_to
       and c.state is not null and r.started_at is not null
       and c.at >= r.started_at
       and c.at <= coalesce(r.finished_at, r.started_at + interval '3 hours') + interval '1 minute'
  ), meas as (
    select m.item_id, count(*)::int as n,
           round((percentile_cont(0.5) within group (order by m.gap))::numeric, 1) as med
      from (select q.item_id, extract(epoch from (q.at - greatest(q.prev_at, q.started_at))) / 60.0 as gap
              from seq q where q.state = 'done') m
     where m.gap >= 0.5 and m.gap <= 60
     group by m.item_id
  )
  select jsonb_build_object(
    'on', true,
    'branch', v_branch,
    'branches', v_branches,
    'today', v_today,
    'now', lpad((v_min / 60)::text, 2, '0') || ':' || lpad((v_min % 60)::text, 2, '0'),
    'from', v_from,
    'to', v_to,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slot', s.slot, 'label', s.label, 'time', to_char(s.start_time, 'HH24:MI'), 'budget', s.budget_min,
               'weekdays', to_jsonb(s.weekdays), 'alert_min', s.alert_min, 'alert_loud', s.alert_loud,
               'assignee', s.assignee_user_id,
               'assignee_name', case when s.assignee_user_id is null then null else public._ops_task_name(s.assignee_user_id, v_branch) end)
             order by s.start_time, s.sort)
        from sl s), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('date', x.d, 'closed', x.closed, 'runs', x.runs) order by x.d)
        from (select ce.d, bool_or(ce.closed) as closed,
                     coalesce(jsonb_agg(jsonb_build_object(
                       'slot', ce.slot,
                       'due', coalesce(n.due, 0), 'done', coalesce(n.done, 0), 'hold', coalesce(n.hold, 0), 'issue', coalesce(n.issue, 0),
                       'started_at', r.started_at, 'finished_at', r.finished_at, 'note', r.note,
                       'finished_by_name', case when r.finished_by is null then null else public._ops_task_name(r.finished_by, v_branch) end)
                       order by ce.start_time, ce.sort) filter (where not ce.closed), '[]'::jsonb) as runs
                from cells ce
                left join cnt n on n.d = ce.d and n.slot = ce.slot
                left join public.ops_clean_runs r on r.branch_name = v_branch and r.work_date = ce.d and r.slot = ce.slot
               group by ce.d) x), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'slot', s.slot, 'slot_id', s.id, 'code', i.code, 'zone', i.zone, 'title', i.title, 'min', i.est_min,
               'done_text', i.done_text, 'how', i.how_text, 'caution', i.caution, 'mission', i.mission,
               'weekdays', to_jsonb(i.weekdays), 'month_nth', i.month_nth, 'nth_dow', i.nth_dow, 'day_offset', i.day_offset,
               'months', to_jsonb(i.months), 'sort', i.sort, 'active', i.active,
               'due_n', coalesce(t.due_n, 0), 'done_n', coalesce(t.done_n, 0), 'hold_n', coalesce(t.hold_n, 0), 'issue_n', coalesce(t.issue_n, 0),
               'samples', coalesce(m.n, 0), 'typical', m.med)
             order by s.start_time, s.sort, i.sort, i.created_at, i.id)
        from public.ops_clean_items i
        join sl s on s.id = i.slot_id
        left join st t on t.item_id = i.id
        left join meas m on m.item_id = i.id), '[]'::jsonb),
    'issues', coalesce((
      select jsonb_agg(y.j order by y.open desc, y.d desc, y.at desc)
        from (select c.work_date as d, c.at, not coalesce(c.resolved_at >= c.at, false) as open,
                     jsonb_build_object(
                       'item_id', c.item_id, 'date', c.work_date, 'slot', c.slot,
                       'label', coalesce((select s3.label from public.ops_clean_slots s3
                                           where s3.branch_name = c.branch_name and s3.slot = c.slot), c.slot),
                       'title', i.title, 'note', c.note, 'by_name', public._ops_task_name(c.by_user, v_branch), 'at', c.at,
                       'resolved_at', case when c.resolved_at >= c.at then c.resolved_at end,
                       'resolved_by_name', case when c.resolved_at >= c.at and c.resolved_by is not null
                                                then public._ops_task_name(c.resolved_by, v_branch) end,
                       'resolve_note', case when c.resolved_at >= c.at then c.resolve_note end) as j
                from public.ops_clean_checks c
                join public.ops_clean_items i on i.id = c.item_id
               where c.branch_name = v_branch and c.state = 'issue' and c.work_date >= v_today - 30
                 and (not coalesce(c.resolved_at >= c.at, false) or c.resolved_at >= v_now - interval '14 days')
               order by 3 desc, 1 desc, 2 desc
               limit 60) y), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.user_id, 'name', z.name) order by z.name)
        from (select distinct on (o.user_id) o.user_id, o.name
                from public.ops_staff o
               where o.branch_name = v_branch and o.active and o.user_id is not null
               order by o.user_id, o.name) z), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- 문제 처리 — 대표님 · 지점 관리자. 메모(선택 · 200자). 다시 부르면 메모만 바뀐다(알림은 처음 한 번)
create or replace function public.ops_clean_issue_resolve(p_item uuid, p_date date, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_item public.ops_clean_items%rowtype;
  v_c public.ops_clean_checks%rowtype;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_first boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_item from public.ops_clean_items where id = p_item;
  if not found then raise exception '청소 항목을 찾지 못했어요'; end if;
  select * into v_c from public.ops_clean_checks where item_id = p_item and work_date = p_date for update;
  if not found or v_c.state is distinct from 'issue' then raise exception '이미 풀린 문제예요'; end if;
  if not public._ops_plan_can_view_all(v_uid, v_c.branch_name) then
    raise exception '대표님 · 지점 관리자만 처리할 수 있어요';
  end if;
  if p_date < v_today - 60 then raise exception '60일 안의 문제만 처리할 수 있어요'; end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception '메모는 200자까지 쓸 수 있어요'; end if;
  v_first := v_c.resolved_at is null or v_c.resolved_at < v_c.at;
  update public.ops_clean_checks
     set resolved_at = case when v_first then now() else resolved_at end,
         resolved_by = case when v_first then v_uid else resolved_by end,
         resolve_note = v_note
   where item_id = p_item and work_date = p_date;
  if v_first and v_c.by_user <> v_uid then
    perform public._ops_plan_notify(
      v_c.by_user,
      '✅ 청소 문제 처리 · ' || v_item.title,
      public._ops_task_name(v_uid, v_c.branch_name) || ' · ' || coalesce(v_note, '처리했어요'),
      '/office?clean=' || v_c.slot || '&cd=' || to_char(p_date, 'YYYY-MM-DD'));
  end if;
end $$;

-- 항목 더하기 · 고치기 · 빼기(active = false) · 다시 넣기 — 대표님 · 지점 관리자
--   p = {id?, slot_id, zone, title, min, done_text, how, caution, weekdays|null, month_nth|null, nth_dow|null, day_offset, months|null, active}
--   구역 'mission' = 「오늘의 미션」 카드. 새 항목 · 구역이나 시간대를 바꾼 항목 · 다시 넣은 항목은 그 구역 맨 뒤로
create or replace function public.ops_clean_item_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_old public.ops_clean_items%rowtype;
  v_slot public.ops_clean_slots%rowtype;
  v_title text := nullif(btrim(regexp_replace(coalesce(p->>'title', ''), '\s+', ' ', 'g')), '');
  v_zone text := nullif(btrim(coalesce(p->>'zone', '')), '');
  v_min int;
  v_done text := nullif(btrim(coalesce(p->>'done_text', '')), '');
  v_how text := nullif(btrim(coalesce(p->>'how', '')), '');
  v_caution text := nullif(btrim(coalesce(p->>'caution', '')), '');
  v_active boolean := coalesce((p->>'active')::boolean, true);
  v_days smallint[];
  v_months smallint[];
  v_nth smallint;
  v_dow smallint;
  v_off smallint := 0;
  v_sort smallint;
  v_move boolean;
  v_code text := 'c' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '_' || substr(md5(gen_random_uuid()::text), 1, 6);
  v_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception '항목을 다시 적어 주세요'; end if;
  if nullif(p->>'id', '') is not null then
    if p->>'id' !~ v_uuid then raise exception '청소 항목을 찾지 못했어요'; end if;
    v_id := (p->>'id')::uuid;
    select * into v_old from public.ops_clean_items where id = v_id for update;
    if not found then raise exception '청소 항목을 찾지 못했어요'; end if;
  end if;
  if nullif(p->>'slot_id', '') is not null then
    if p->>'slot_id' !~ v_uuid then raise exception '청소 시간대를 찾지 못했어요'; end if;
    select * into v_slot from public.ops_clean_slots where id = (p->>'slot_id')::uuid and active;
  elsif v_id is not null then
    select * into v_slot from public.ops_clean_slots where id = v_old.slot_id and active;
  end if;
  if v_slot.id is null then raise exception '청소 시간대를 찾지 못했어요'; end if;
  if not public._ops_plan_can_view_all(v_uid, v_slot.branch_name) then
    raise exception '대표님 · 지점 관리자만 고칠 수 있어요';
  end if;
  if v_id is not null and not exists (select 1 from public.ops_clean_slots s
                                       where s.id = v_old.slot_id and s.branch_name = v_slot.branch_name) then
    raise exception '다른 지점으로는 옮길 수 없어요';
  end if;

  -- 검사 (화면 src/lib/opsCleanReport.ts itemDraftError 와 같은 말)
  if v_title is null then raise exception '항목 이름을 적어 주세요'; end if;
  if char_length(v_title) > 60 then raise exception '항목 이름은 60자까지 쓸 수 있어요'; end if;
  if v_zone is null or v_zone !~ '^[a-z][a-z0-9_]{1,15}$' then raise exception '구역을 골라 주세요'; end if;
  if coalesce(p->>'min', '') !~ '^\d{1,3}$' or (p->>'min')::int > 120 then raise exception '목표 분은 0 ~ 120분이에요'; end if;
  v_min := (p->>'min')::int;
  if v_done is not null and char_length(v_done) > 120 then raise exception '끝난 상태는 120자까지 쓸 수 있어요'; end if;
  if v_how is not null and char_length(v_how) > 300 then raise exception '방법은 300자까지 쓸 수 있어요'; end if;
  if v_caution is not null and char_length(v_caution) > 120 then raise exception '주의는 120자까지 쓸 수 있어요'; end if;

  if jsonb_typeof(p->'weekdays') = 'array' then
    if jsonb_array_length(p->'weekdays') = 0
       or exists (select 1 from jsonb_array_elements(p->'weekdays') e where e::text !~ '^[0-6]$') then
      raise exception '요일을 다시 골라 주세요';
    end if;
    select array_agg(distinct e::text::smallint order by e::text::smallint) into v_days from jsonb_array_elements(p->'weekdays') e;
    if not (v_days && v_slot.weekdays) then raise exception '이 시간대가 도는 요일 중에서 골라 주세요'; end if;
  elsif p ? 'weekdays' and jsonb_typeof(p->'weekdays') <> 'null' then
    raise exception '요일을 다시 골라 주세요';
  end if;

  if jsonb_typeof(p->'months') = 'array' then
    if jsonb_array_length(p->'months') = 0
       or exists (select 1 from jsonb_array_elements(p->'months') e where e::text !~ '^([1-9]|1[0-2])$') then
      raise exception '달을 다시 골라 주세요';
    end if;
    select array_agg(distinct e::text::smallint order by e::text::smallint) into v_months from jsonb_array_elements(p->'months') e;
  elsif p ? 'months' and jsonb_typeof(p->'months') <> 'null' then
    raise exception '달을 다시 골라 주세요';
  end if;

  if nullif(p->>'month_nth', '') is not null then
    if p->>'month_nth' !~ '^[1-5]$' or coalesce(p->>'nth_dow', '') !~ '^[0-6]$'
       or coalesce(nullif(p->>'day_offset', ''), '0') !~ '^-?[0-6]$' then
      raise exception '한 달에 한 번 규칙을 다시 골라 주세요';
    end if;
    v_nth := (p->>'month_nth')::smallint;
    v_dow := (p->>'nth_dow')::smallint;
    v_off := coalesce(nullif(p->>'day_offset', ''), '0')::smallint;
    if not ((((v_dow + v_off) % 7 + 7) % 7)::smallint = any (v_slot.weekdays))
       or (v_days is not null and not ((((v_dow + v_off) % 7 + 7) % 7)::smallint = any (v_days))) then
      raise exception '그날은 이 시간대가 쉬는 요일이에요';
    end if;
  elsif nullif(p->>'nth_dow', '') is not null or coalesce(nullif(p->>'day_offset', ''), '0') <> '0' then
    raise exception '한 달에 한 번 규칙을 다시 골라 주세요';
  end if;

  if v_active and (select count(*) from public.ops_clean_items i
                    where i.slot_id = v_slot.id and i.active and i.id is distinct from v_id) >= 80 then
    raise exception '한 시간대에 항목은 80개까지예요';
  end if;

  -- 자리: 새 항목 · 구역이나 시간대를 바꾼 항목 · 다시 넣은 항목 → 그 구역 맨 뒤(구역이 없으면 시간대 맨 뒤)
  v_move := v_active and (v_id is null or v_old.zone <> v_zone or v_old.slot_id <> v_slot.id or not v_old.active);
  if v_move then
    select max(i.sort) into v_sort from public.ops_clean_items i
     where i.slot_id = v_slot.id and i.active and i.zone = v_zone and i.id is distinct from v_id;
    if v_sort is null then
      select coalesce(max(i.sort), 0) into v_sort from public.ops_clean_items i
       where i.slot_id = v_slot.id and i.active and i.id is distinct from v_id;
    end if;
    v_sort := v_sort + 1;
    update public.ops_clean_items set sort = sort + 1
     where slot_id = v_slot.id and active and sort >= v_sort and id is distinct from v_id;
  end if;

  if v_id is null then
    insert into public.ops_clean_items
      (slot_id, code, zone, title, est_min, done_text, how_text, caution, mission, weekdays, month_nth, nth_dow, day_offset, months, sort, active)
    values (v_slot.id, v_code, v_zone, v_title, v_min, v_done, v_how, v_caution, v_zone = 'mission',
            v_days, v_nth, v_dow, v_off, v_months, coalesce(v_sort, 1), v_active)
    returning id into v_id;
  else
    update public.ops_clean_items
       set slot_id = v_slot.id,
           code = case when v_old.slot_id <> v_slot.id
                        and exists (select 1 from public.ops_clean_items x where x.slot_id = v_slot.id and x.code = v_old.code and x.id <> v_id)
                       then v_code else code end,
           zone = v_zone, title = v_title, est_min = v_min, done_text = v_done, how_text = v_how, caution = v_caution,
           mission = v_zone = 'mission', weekdays = v_days, month_nth = v_nth, nth_dow = v_dow, day_offset = v_off, months = v_months,
           sort = case when v_move then v_sort else sort end,
           active = v_active, updated_at = now()
     where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- 순서 — 그 시간대의 넣은 항목 전부를 새 순서로(목록이 그사이 바뀌었으면 막는다)
create or replace function public.ops_clean_items_order(p_slot uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slot public.ops_clean_slots%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_slot from public.ops_clean_slots where id = p_slot and active;
  if not found then raise exception '청소 시간대를 찾지 못했어요'; end if;
  if not public._ops_plan_can_view_all(v_uid, v_slot.branch_name) then
    raise exception '대표님 · 지점 관리자만 고칠 수 있어요';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200
     or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then
    raise exception '순서를 다시 정해 주세요';
  end if;
  if exists (select 1 from public.ops_clean_items i where i.slot_id = p_slot and i.active and not (i.id = any (p_ids)))
     or exists (select 1 from unnest(p_ids) x
                 where not exists (select 1 from public.ops_clean_items i where i.id = x and i.slot_id = p_slot and i.active)) then
    raise exception '항목 목록이 바뀌었어요 — 다시 불러올게요';
  end if;
  update public.ops_clean_items i
     set sort = o.n::smallint, updated_at = now()
    from unnest(p_ids) with ordinality o(id, n)
   where i.id = o.id and i.sort is distinct from o.n::smallint;
end $$;

-- 시간대 고치기 — 이름 · 시작 시각 · 끝낼 때까지 분 · 요일 · 담당 · 미완료 알림. 보낸 칸만 바뀐다
create or replace function public.ops_clean_slot_save(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s public.ops_clean_slots%rowtype;
  v_label text;
  v_time time;
  v_budget int;
  v_days smallint[];
  v_assignee uuid;
  v_alert int;
  v_loud boolean;
  v_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or coalesce(p->>'id', '') !~ v_uuid then raise exception '청소 시간대를 찾지 못했어요'; end if;
  select * into v_s from public.ops_clean_slots where id = (p->>'id')::uuid and active for update;
  if not found then raise exception '청소 시간대를 찾지 못했어요'; end if;
  if not public._ops_plan_can_view_all(v_uid, v_s.branch_name) then
    raise exception '대표님 · 지점 관리자만 고칠 수 있어요';
  end if;
  v_label := case when p ? 'label' then nullif(btrim(regexp_replace(coalesce(p->>'label', ''), '\s+', ' ', 'g')), '') else v_s.label end;
  if v_label is null or char_length(v_label) > 12 then raise exception '시간대 이름은 1 ~ 12자예요'; end if;
  if p ? 'time' then
    if coalesce(p->>'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception '시작 시각을 다시 골라 주세요'; end if;
    v_time := (p->>'time')::time;
  else v_time := v_s.start_time; end if;
  if p ? 'budget' then
    if coalesce(p->>'budget', '') !~ '^\d{1,3}$' or (p->>'budget')::int not between 1 and 240 then
      raise exception '끝낼 때까지 분은 1 ~ 240분이에요';
    end if;
    v_budget := (p->>'budget')::int;
  else v_budget := v_s.budget_min; end if;
  if p ? 'weekdays' then
    if jsonb_typeof(p->'weekdays') <> 'array' or jsonb_array_length(p->'weekdays') = 0
       or exists (select 1 from jsonb_array_elements(p->'weekdays') e where e::text !~ '^[0-6]$') then
      raise exception '요일을 하나 이상 골라 주세요';
    end if;
    select array_agg(distinct e::text::smallint order by e::text::smallint) into v_days from jsonb_array_elements(p->'weekdays') e;
  else v_days := v_s.weekdays; end if;
  if p ? 'assignee' then
    if jsonb_typeof(p->'assignee') = 'null' or nullif(p->>'assignee', '') is null then v_assignee := null;
    elsif p->>'assignee' !~ v_uuid or not exists (
            select 1 from public.ops_staff o
             where o.branch_name = v_s.branch_name and o.active and o.user_id = (p->>'assignee')::uuid) then
      raise exception '담당은 이 지점 근무자 중에서 골라 주세요';
    else v_assignee := (p->>'assignee')::uuid; end if;
  else v_assignee := v_s.assignee_user_id; end if;
  if p ? 'alert_min' then
    if jsonb_typeof(p->'alert_min') = 'null' or nullif(p->>'alert_min', '') is null then v_alert := null;
    elsif p->>'alert_min' !~ '^\d{1,3}$' or (p->>'alert_min')::int > 240 then raise exception '알림 시각을 다시 골라 주세요';
    else v_alert := (p->>'alert_min')::int; end if;
  else v_alert := v_s.alert_min; end if;
  v_loud := case when p ? 'alert_loud' then coalesce((p->>'alert_loud')::boolean, false) else v_s.alert_loud end;

  update public.ops_clean_slots
     set label = v_label, start_time = v_time, budget_min = v_budget, weekdays = v_days,
         assignee_user_id = v_assignee, alert_min = v_alert, alert_loud = v_loud, updated_at = now()
   where id = v_s.id;
end $$;

-- ── 미완료 알림 (예약 ops-clean-late · 5분마다) ───────────────
create or replace function public._ops_clean_late_tick()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  v_min int := (extract(hour from v_now at time zone 'Asia/Seoul') * 60 + extract(minute from v_now at time zone 'Asia/Seoul'))::int;
  v_sent int := 0;
  s record;
  u record;
  v_due int;
  v_done int;
  v_left int;
  v_n int;
  v_started boolean;
  v_people text;
  v_title text;
  v_body text;
  v_link text;
begin
  for s in
    select sl.* from public.ops_clean_slots sl
     where sl.active and sl.alert_min is not null
       and extract(dow from v_today)::smallint = any (sl.weekdays)
       and v_min >= (extract(epoch from sl.start_time) / 60)::int + sl.alert_min
       and v_min < (extract(epoch from sl.start_time) / 60)::int + sl.alert_min + 60
       and not public._cal_closed_on(sl.branch_name, v_today)
       and not exists (select 1 from public.ops_clean_notices n
                        where n.branch_name = sl.branch_name and n.work_date = v_today and n.slot = sl.slot and n.kind = 'late')
       and not exists (select 1 from public.ops_clean_runs r
                        where r.branch_name = sl.branch_name and r.work_date = v_today and r.slot = sl.slot and r.finished_at is not null)
     order by sl.branch_name, sl.start_time
  loop
    select count(*)::int, count(*) filter (where c.state = 'done')::int, count(*) filter (where c.state is null)::int
      into v_due, v_done, v_left
      from public.ops_clean_items i
      left join public.ops_clean_checks c on c.item_id = i.id and c.work_date = v_today
     where i.slot_id = s.id and i.active
       and public._ops_clean_due(v_today, s.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months);
    continue when v_due = 0 or v_left = 0;
    insert into public.ops_clean_notices (branch_name, work_date, slot, kind, left_n)
    values (s.branch_name, v_today, s.slot, 'late', v_left)
    on conflict do nothing;
    continue when not found;
    v_started := exists (select 1 from public.ops_clean_runs r
                          where r.branch_name = s.branch_name and r.work_date = v_today and r.slot = s.slot and r.started_at is not null);
    select string_agg(public._ops_task_name(d.user_id, s.branch_name), ' · ') into v_people
      from public._ops_clean_people(s.id, v_today) d;
    v_title := '⏰ ' || s.label || ' 청소 · 남은 ' || v_left || '개';
    v_body := to_char(s.start_time + make_interval(mins => s.alert_min), 'HH24:MI') || ' · '
              || case when v_started then '완료 ' || v_done || '/' || v_due else '아직 시작 전' end
              || coalesce(' · ' || v_people, '');
    v_link := '/office?clean=' || s.slot;
    v_n := 0;
    for u in
      select m.user_id from public.ops_managers m
       where m.title = '지점장' and (m.branch_name is null or m.branch_name = s.branch_name)
      union
      select ur.user_id from public.user_roles ur
       where ur.role::text = 'super_admin'
         and not exists (select 1 from public.ops_managers m2
                          where m2.title = '지점장' and (m2.branch_name is null or m2.branch_name = s.branch_name))
    loop
      if s.alert_loud then
        insert into public.notifications (user_id, title, body, link) values (u.user_id, left(v_title, 120), left(v_body, 300), v_link);
      else
        perform public._ops_plan_notify(u.user_id, v_title, v_body, v_link);
      end if;
      v_n := v_n + 1;
    end loop;
    update public.ops_clean_notices set sent_to = v_n
     where branch_name = s.branch_name and work_date = v_today and slot = s.slot and kind = 'late';
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

-- ── 권한 · 예약 ──────────────────────────────────────────────
revoke all on function public._ops_clean_late_tick() from public, anon, authenticated;
revoke all on function public.ops_clean_report(text, date, date) from public, anon;
revoke all on function public.ops_clean_issue_resolve(uuid, date, text) from public, anon;
revoke all on function public.ops_clean_item_save(jsonb) from public, anon;
revoke all on function public.ops_clean_items_order(uuid, uuid[]) from public, anon;
revoke all on function public.ops_clean_slot_save(jsonb) from public, anon;
grant execute on function public.ops_clean_report(text, date, date) to authenticated;
grant execute on function public.ops_clean_issue_resolve(uuid, date, text) to authenticated;
grant execute on function public.ops_clean_item_save(jsonb) to authenticated;
grant execute on function public.ops_clean_items_order(uuid, uuid[]) to authenticated;
grant execute on function public.ops_clean_slot_save(jsonb) to authenticated;

select cron.schedule('ops-clean-late', '*/5 * * * *', $cron$select public._ops_clean_late_tick()$cron$);
-- 끄기: select cron.unschedule('ops-clean-late');  (사람마다 끄기 = 시간대 고치기에서 '미완료 알림' 끔 = alert_min null)
