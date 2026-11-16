-- 153운영본부 「오늘 청소」 1단계 — 청소 체크리스트 (시간대 · 구역 · 요일/월 1회 미션 · 완료/보류/문제 · 걸린 시간 · 인수인계)
-- (2026-11-16 대표님 「운영본부 탭에 청소 매뉴얼 … 코치님들이 직관적으로 보고 수행할수있도록 편리하게」 → 보고서 4판 → 「올려서 반영하자」
--  · 보고서 「153복싱짐 선릉역점 청소 매뉴얼·체크리스트 보고서」 https://claude.ai/artifact/V971FZ8819azL7YQaADgaN)
--   새 표 4 · 새 함수 7(화면 함수 4 · 안쪽 3)만 — 기존 고정 업무(ops_task_presets · ops_duty_checks · ops_tasks_day · ops_duty_check)와 다른 함수는 건드리지 않는다.
--   표는 RLS 를 켜고 정책 없이 — 읽기 · 쓰기는 모두 아래 함수로만(ops_tasks 와 같은 결). 줄을 지우는 문장은 없다 — 체크를 풀면 state 를 비운다.
--   보는 범위 = 「일정」 탭과 같다(_ops_plan_branches · _ops_plan_can_view_all): 코치님은 내 시간대만 · 대표님 · 지점 관리자는 그 지점 전체.
--   체크 = 그 시간 근무자만(_ops_duty_segments — 쉰 날 · 대타 반영, 담당이 그 시각 근무면 그분만) · 대표님 · 지점 관리자는 7일 전까지 대신.
--   날짜 규칙 _ops_clean_due: 요일(weekdays) · 그 달 n번째 요일(month_nth + nth_dow) · 그날에서 며칠 떨어진 날(day_offset) · 달(months).
--     화면 src/lib/opsClean.ts cleanDue 와 같은 식 — 하나를 고치면 둘 다.
--   '문제'로 처음 바뀔 때만 대표님 · 지점 관리자에게 알림(_ops_plan_notify — 밤 10시 ~ 아침 8시는 알림함에만). 그 밖의 알림 · 예약 작업은 없다(2단계).
--   첫 자료 = 선릉역점 시간대 3 · 항목 35 (보고서 그대로 · src/lib/opsCleanSample.ts 와 같은 글 — 시험이 한 줄씩 견준다). 담당(assignee_user_id)은 DB 에서만 넣는다.

create table if not exists public.ops_clean_slots (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  slot text not null check (slot ~ '^[a-z][a-z0-9_]{1,15}$'),
  label text not null check (char_length(label) between 1 and 12),
  start_time time not null,
  budget_min smallint not null check (budget_min between 1 and 240),
  weekdays smallint[] not null default '{1,2,3,4,5}'::smallint[]
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  assignee_user_id uuid,
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_name, slot)
);
alter table public.ops_clean_slots enable row level security;
revoke all on public.ops_clean_slots from anon, authenticated;

create table if not exists public.ops_clean_items (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.ops_clean_slots(id),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  zone text not null check (zone ~ '^[a-z][a-z0-9_]{1,15}$'),
  title text not null check (char_length(title) between 1 and 60),
  est_min smallint not null default 1 check (est_min between 0 and 120),
  done_text text check (done_text is null or char_length(done_text) <= 120),
  how_text text check (how_text is null or char_length(how_text) <= 300),
  caution text check (caution is null or char_length(caution) <= 120),
  mission boolean not null default false,
  weekdays smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[])),
  month_nth smallint check (month_nth is null or month_nth between 1 and 5),
  nth_dow smallint check (nth_dow is null or nth_dow between 0 and 6),
  day_offset smallint not null default 0 check (day_offset between -6 and 6),
  months smallint[] check (months is null or (cardinality(months) between 1 and 12 and months <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'::smallint[])),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, code),
  constraint ops_clean_items_nth check ((month_nth is null) = (nth_dow is null) and (month_nth is not null or day_offset = 0))
);
create index if not exists ops_clean_items_slot_idx on public.ops_clean_items (slot_id, sort) where active;
alter table public.ops_clean_items enable row level security;
revoke all on public.ops_clean_items from anon, authenticated;

create table if not exists public.ops_clean_checks (
  item_id uuid not null references public.ops_clean_items(id),
  work_date date not null,
  branch_name text not null,
  slot text not null,
  state text check (state is null or state in ('done', 'hold', 'issue')),
  note text check (note is null or char_length(note) <= 200),
  by_user uuid not null,
  at timestamptz not null default now(),
  primary key (item_id, work_date)
);
create index if not exists ops_clean_checks_branch_idx on public.ops_clean_checks (branch_name, work_date);
alter table public.ops_clean_checks enable row level security;
revoke all on public.ops_clean_checks from anon, authenticated;

create table if not exists public.ops_clean_runs (
  branch_name text not null,
  work_date date not null,
  slot text not null,
  started_at timestamptz,
  started_by uuid,
  finished_at timestamptz,
  finished_by uuid,
  note text check (note is null or char_length(note) <= 200),
  primary key (branch_name, work_date, slot)
);
alter table public.ops_clean_runs enable row level security;
revoke all on public.ops_clean_runs from anon, authenticated;

-- ── 안쪽 함수 ────────────────────────────────────────────────

-- 그날 하는 항목인가 (화면 cleanDue 와 같은 식)
create or replace function public._ops_clean_due(
  _date date, _slot_days smallint[], _days smallint[], _nth smallint, _dow smallint, _off smallint, _months smallint[])
returns boolean language sql immutable set search_path = public as $$
  select _date is not null
     and extract(dow from _date)::smallint = any (_slot_days)
     and (_days is null or extract(dow from _date)::smallint = any (_days))
     and (_months is null or extract(month from (_date - coalesce(_off, 0)::int))::smallint = any (_months))
     and (_nth is null or (
           extract(dow from (_date - coalesce(_off, 0)::int))::smallint = _dow
       and ((extract(day from (_date - coalesce(_off, 0)::int))::int - 1) / 7) + 1 = _nth));
$$;

-- 그 시간대를 맡는 사람 — 그 시각 근무자(쉰 날 · 대타 반영). 담당이 그 시각 근무면 그분만
create or replace function public._ops_clean_people(_slot uuid, _date date)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  with sl as (
    select * from public.ops_clean_slots where id = _slot and active
  ), shift as (
    select distinct s.user_id
      from sl
      join public.ops_staff s on s.branch_name = sl.branch_name and s.active and s.user_id is not null
      join lateral public._ops_duty_segments(s.id, _date) g
        on g.start_time <= sl.start_time and g.end_time > sl.start_time
  ), pick as (
    select sl.assignee_user_id as user_id from sl where sl.assignee_user_id in (select sh.user_id from shift sh)
  )
  select user_id from pick
  union all
  select sh.user_id from shift sh where not exists (select 1 from pick);
$$;

-- 인수인계 — 「지난 한 바퀴」: 오늘 내 시간대보다 앞선 시간대 + 지난 근무일의 내 시간대부터 뒤
--   기록이 있는 시간대만: 요약(완료 n/m · 끝) · 한마디 · 보류 · 문제. 최근 것부터 12줄
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
             'title', i.title, 'text', c.note, 'by_name', public._ops_task_name(c.by_user, _branch))
      from src s
      join public.ops_clean_items i on i.slot_id = s.id
      join public.ops_clean_checks c on c.item_id = i.id and c.work_date = s.d and c.state in ('hold', 'issue')
  )
  select coalesce(jsonb_agg(t.j order by t.d desc, t.start_time desc, t.k, t.at), '[]'::jsonb)
    from (select * from lines l order by l.d desc, l.start_time desc, l.k, l.at limit 12) t;
$$;

revoke all on function public._ops_clean_due(date, smallint[], smallint[], smallint, smallint, smallint, smallint[]) from public, anon, authenticated;
revoke all on function public._ops_clean_people(uuid, date) from public, anon, authenticated;
revoke all on function public._ops_clean_handover(text, date, time) from public, anon, authenticated;

-- ── 화면 함수 ────────────────────────────────────────────────

-- 그날 청소 — 내가 볼 시간대(코치님 = 내 차례 · 관리자 = 지점 전체) · 항목 · 상태 · 시작/끝 · 인수인계
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
                               'by_name', case when c.state is null then null else public._ops_task_name(c.by_user, v_branch) end)
                             order by i.sort, i.created_at, i.id)
                        from public.ops_clean_items i
                        left join public.ops_clean_checks c on c.item_id = i.id and c.work_date = v_date
                       where i.slot_id = sl.id and i.active
                         and public._ops_clean_due(v_date, sl.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months)), '[]'::jsonb),
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

-- 항목 하나의 상태 — done 완료 · hold 보류 · issue 문제(메모 필수) · 빈 값 = 풀기
create or replace function public.ops_clean_check(p_item uuid, p_date date, p_state text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_item public.ops_clean_items%rowtype;
  v_slot public.ops_clean_slots%rowtype;
  v_all boolean;
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_old text;
  r record;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_state is not null and v_state not in ('done', 'hold', 'issue') then raise exception '상태를 다시 골라 주세요'; end if;
  select * into v_item from public.ops_clean_items where id = p_item and active;
  if not found then raise exception '청소 항목을 찾지 못했어요'; end if;
  select * into v_slot from public.ops_clean_slots where id = v_item.slot_id and active;
  if not found then raise exception '청소 항목을 찾지 못했어요'; end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_slot.branch_name);
  if p_date is null or p_date > v_today or p_date < v_today - (case when v_all then 7 else 0 end) then
    raise exception '그날은 체크할 수 없어요';
  end if;
  if not public._ops_clean_due(p_date, v_slot.weekdays, v_item.weekdays, v_item.month_nth, v_item.nth_dow, v_item.day_offset, v_item.months) then
    raise exception '그날 하는 항목이 아니에요';
  end if;
  if not (v_all or exists (select 1 from public._ops_clean_people(v_slot.id, p_date) d where d.user_id = v_uid)) then
    raise exception '그 시간 근무자만 체크할 수 있어요';
  end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception '메모는 200자까지 쓸 수 있어요'; end if;
  if v_state = 'issue' and (v_note is null or char_length(v_note) < 2) then
    raise exception '무엇이 문제인지 한 줄 적어 주세요';
  end if;
  if v_state is null or v_state = 'done' then v_note := null; end if;

  select c.state into v_old from public.ops_clean_checks c where c.item_id = p_item and c.work_date = p_date;
  insert into public.ops_clean_checks (item_id, work_date, branch_name, slot, state, note, by_user, at)
  values (p_item, p_date, v_slot.branch_name, v_slot.slot, v_state, v_note, v_uid, now())
  on conflict (item_id, work_date) do update
    set state = excluded.state, note = excluded.note, by_user = excluded.by_user, at = excluded.at;

  -- 오늘 처음 체크하면 시작 시각을 남긴다
  if v_state is not null and p_date = v_today then
    insert into public.ops_clean_runs (branch_name, work_date, slot, started_at, started_by)
    values (v_slot.branch_name, p_date, v_slot.slot, now(), v_uid)
    on conflict (branch_name, work_date, slot) do update
      set started_at = coalesce(public.ops_clean_runs.started_at, excluded.started_at),
          started_by = coalesce(public.ops_clean_runs.started_by, excluded.started_by);
  end if;

  -- '문제'로 처음 바뀔 때 — 대표님 · 지점 관리자에게 (본인 빼고)
  if v_state = 'issue' and v_old is distinct from 'issue' then
    for r in
      select u.user_id
        from (select ur.user_id from public.user_roles ur where ur.role::text in ('super_admin', 'admin')
              union
              select m.user_id from public.ops_managers m
               where m.branch_name is null or m.branch_name = v_slot.branch_name) u
       where u.user_id <> v_uid
    loop
      perform public._ops_plan_notify(
        r.user_id,
        '청소 문제 · ' || v_item.title,
        public._ops_task_name(v_uid, v_slot.branch_name) || ' · ' || v_slot.label || ' · ' || v_note,
        '/office?clean=' || v_slot.slot || '&cd=' || to_char(p_date, 'YYYY-MM-DD'));
    end loop;
  end if;
end $$;

-- 청소 시작 — 오늘 것만 · 이미 시작했으면 그대로
create or replace function public.ops_clean_start(p_branch text, p_date date, p_slot text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_slot public.ops_clean_slots%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_slot from public.ops_clean_slots where branch_name = p_branch and slot = p_slot and active;
  if not found then raise exception '청소 시간대를 찾지 못했어요'; end if;
  if p_date is distinct from v_today then raise exception '오늘 청소만 시작할 수 있어요'; end if;
  if not (public._ops_plan_can_view_all(v_uid, v_slot.branch_name)
          or exists (select 1 from public._ops_clean_people(v_slot.id, p_date) d where d.user_id = v_uid)) then
    raise exception '그 시간 근무자만 체크할 수 있어요';
  end if;
  insert into public.ops_clean_runs (branch_name, work_date, slot, started_at, started_by)
  values (v_slot.branch_name, p_date, v_slot.slot, now(), v_uid)
  on conflict (branch_name, work_date, slot) do update
    set started_at = coalesce(public.ops_clean_runs.started_at, excluded.started_at),
        started_by = coalesce(public.ops_clean_runs.started_by, excluded.started_by);
end $$;

-- 청소 끝 — 모든 항목에 상태(완료 · 보류 · 문제)가 있어야 한다. 다음 근무자에게 한마디(선택). 다시 부르면 한마디만 바뀐다
create or replace function public.ops_clean_finish(p_branch text, p_date date, p_slot text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_slot public.ops_clean_slots%rowtype;
  v_all boolean;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_left int;
  v_first timestamptz;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_slot from public.ops_clean_slots where branch_name = p_branch and slot = p_slot and active;
  if not found then raise exception '청소 시간대를 찾지 못했어요'; end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_slot.branch_name);
  if p_date is null or p_date > v_today or p_date < v_today - (case when v_all then 7 else 0 end) then
    raise exception '그날은 체크할 수 없어요';
  end if;
  if not (v_all or exists (select 1 from public._ops_clean_people(v_slot.id, p_date) d where d.user_id = v_uid)) then
    raise exception '그 시간 근무자만 체크할 수 있어요';
  end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception '메모는 200자까지 쓸 수 있어요'; end if;
  select count(*) into v_left
    from public.ops_clean_items i
    left join public.ops_clean_checks c on c.item_id = i.id and c.work_date = p_date
   where i.slot_id = v_slot.id and i.active and c.state is null
     and public._ops_clean_due(p_date, v_slot.weekdays, i.weekdays, i.month_nth, i.nth_dow, i.day_offset, i.months);
  if v_left > 0 then raise exception '아직 체크하지 않은 항목이 %개 있어요', v_left; end if;
  select min(c.at) into v_first
    from public.ops_clean_checks c join public.ops_clean_items i on i.id = c.item_id
   where i.slot_id = v_slot.id and c.work_date = p_date and c.state is not null;
  insert into public.ops_clean_runs (branch_name, work_date, slot, started_at, started_by, finished_at, finished_by, note)
  values (v_slot.branch_name, p_date, v_slot.slot, coalesce(v_first, now()), v_uid, now(), v_uid, v_note)
  on conflict (branch_name, work_date, slot) do update
    set started_at = coalesce(public.ops_clean_runs.started_at, excluded.started_at),
        started_by = coalesce(public.ops_clean_runs.started_by, excluded.started_by),
        finished_at = coalesce(public.ops_clean_runs.finished_at, excluded.finished_at),
        finished_by = coalesce(public.ops_clean_runs.finished_by, excluded.finished_by),
        note = excluded.note;
end $$;

revoke all on function public.ops_clean_day(text, date) from public, anon;
revoke all on function public.ops_clean_check(uuid, date, text, text) from public, anon;
revoke all on function public.ops_clean_start(text, date, text) from public, anon;
revoke all on function public.ops_clean_finish(text, date, text, text) from public, anon;
grant execute on function public.ops_clean_day(text, date) to authenticated;
grant execute on function public.ops_clean_check(uuid, date, text, text) to authenticated;
grant execute on function public.ops_clean_start(text, date, text) to authenticated;
grant execute on function public.ops_clean_finish(text, date, text, text) to authenticated;

-- ── 첫 자료: 선릉역점 (보고서 4판 그대로 · 분은 「목표 분」) ──────────────
--   오픈 11:00(11:50 까지) 매일 30분 + 요일 미션 = 월 40 · 화 42 · 수 48 · 목 47 · 금 47분 · 저녁 19:50 5분 · 마감 22:50 10분.
--   이미 있는 시간대 · 항목은 그대로 둔다(다시 돌려도 같은 결과).

insert into public.ops_clean_slots (branch_name, slot, label, start_time, budget_min, weekdays, sort)
select '153복싱짐 선릉역점', v.slot, v.label, v.at::time, v.budget, v.weekdays::smallint[], v.sort
  from (values
    ('open', '오픈', '11:00', 50, '{1,2,3,4,5}', 1),
    ('evening', '저녁', '19:50', 10, '{1,2,3,4,5}', 2),
    ('close', '마감', '22:50', 10, '{1,2,3,4,5}', 3)
  ) as v(slot, label, at, budget, weekdays, sort)
 where exists (select 1 from public.ops_branches b where b.branch_name = '153복싱짐 선릉역점')
on conflict (branch_name, slot) do nothing;

insert into public.ops_clean_items
  (slot_id, code, zone, title, est_min, done_text, how_text, caution, mission, weekdays, month_nth, nth_dow, day_offset, months, sort)
select sl.id, v.code, v.zone, v.title, v.est_min::smallint, v.done_text, v.how_text, v.caution, v.mission,
       v.weekdays::smallint[], v.month_nth::smallint, v.nth_dow::smallint, v.day_offset::smallint, v.months::smallint[], v.sort::smallint
  from (values
    ('open', 'start', 'start', '창문 열기 · 바닥 물건 치우기 · 로봇청소기 켜기', 2, '바닥에 줄넘기·붕대·물병 없음', '창문 열기 → 바닥 물건 치우기 → 로봇청소기 시작', null, false, '{1,2,3,5}', null, null, 0, null, 10),
    ('open', 'start_thu', 'start', '창문 열기 · 바닥 물건 치우기', 2, '바닥에 줄넘기·붕대·물병 없음', '로봇청소기는 어젯밤 마감 때 돌았어요. 오늘은 켜지 않고 바로 물걸레로 가요.', null, false, '{4}', null, null, 0, null, 10),
    ('open', 'm_mon_dust', 'mission', '걸레받이 · 창가 먼지', 8, '손가락으로 훑어 먼지가 안 묻음', '긴 먼지떨이로 한 바퀴, 창틀은 젖은 걸레', '높은 곳은 발판 사용', true, '{1}', null, null, 0, null, 20),
    ('open', 'm_mon_ring', 'mission', '링 줄 · 코너 패드 닦기', 2, '링 줄·코너 패드에 땀 자국 없음', '초록 걸레로 링 줄 → 코너 패드', null, true, '{1}', null, null, 0, null, 21),
    ('open', 'm_tue_mirror', 'mission', '인피니티 미러 · 내부 거울 · 출입문 유리', 12, '조명 켜고 봐도 손자국·줄 없음', '극세사 걸레로 위에서 아래로', '인피니티 미러 세정제는 제조사 권장 확인', true, '{2}', null, null, 0, null, 20),
    ('open', 'm_tue_filter', 'mission', '에어컨 필터 먼지 제거 (절반)', 8, '빛에 비춰 막힌 곳 없음', '전원 끄기 → 필터 분리 → 청소기로 먼지 → 다시 끼우기. 나머지 절반은 내일 해요.', '물로 씻으면 완전히 말린 뒤 끼워요', true, '{2}', 1, 3, -1, null, 22),
    ('open', 'm_wed_bag', 'mission', '샌드백 윗부분 먼지', 8, '윗부분 먼지 없음', '발판에 올라 윗부분 먼지 닦기 (치는 면은 금요일)', '락스·진한 알코올 금지', true, '{3}', null, null, 0, null, 20),
    ('open', 'm_wed_filter', 'mission', '에어컨 필터 먼지 제거 (나머지)', 10, '빛에 비춰 막힌 곳 없음', '전원 끄기 → 필터 분리 → 청소기로 먼지 → 다시 끼우기', '물로 씻으면 완전히 말린 뒤 끼워요', true, '{3}', 1, 3, 0, null, 23),
    ('open', 'm_wed_drain', 'mission', '샤워실 배수구 뚜껑 열고 이물질 제거', 10, '물 한 바가지가 바로 빠짐', '뚜껑 열기 → 머리카락·이물질 → 솔질. 줄눈·실리콘 곰팡이도 같이 봐요.', '장갑 착용', true, '{3}', 2, 3, 0, null, 23),
    ('open', 'm_wed_tape', 'mission', '바닥 기본기 가이드 테이프 보수', 10, '발에 걸리는 모서리 없음', '들뜬 곳·끊긴 곳 교체', '같은 색·폭 테이프로', true, '{3}', 3, 3, 0, null, 23),
    ('open', 'm_wed_robot', 'mission', '로봇청소기 정비 · 소모품 재고 세기', 10, '브러시에 감긴 것 없음, 모자란 소모품은 ''문제''로 알림', '브러시·필터 청소 → 세제·휴지·핸드타월·테이프 재고 세기', null, true, '{3}', 4, 3, 0, null, 23),
    ('open', 'm_wed_quarter', 'mission', '분기 미션: 환풍기 그릴 · 락커 위 · 드라이기 흡입구 · 천장 모서리', 10, '먼지 덩어리 없음', '위에서 아래로 한 곳씩', '높은 곳은 발판 사용', true, '{3}', 5, 3, 0, null, 23),
    ('open', 'm_thu_mop', 'mission', '바닥 물걸레 (입구 포함)', 20, '10분 뒤 마름, 발자국 없음', '꼭 짠 밀대로 안쪽에서 입구로', '수업 20분 전까지 끝내요', true, '{4}', null, null, 0, null, 20),
    ('open', 'm_fri_gear', 'mission', '운동 기구 · 소도구 · 선반 먼지', 10, '손잡이 끈적임 없음', '손잡이 위주, 선반은 위 칸부터', '전자 패널은 마른 걸레', true, '{5}', null, null, 0, null, 20),
    ('open', 'm_fri_bag', 'mission', '샌드백 치는 면 땀 닦기', 5, '치는 면 끈적임 없음', '치는 면을 위에서 아래로 닦기', '락스·진한 알코올 금지', true, '{5}', null, null, 0, null, 21),
    ('open', 'm_fri_glove', 'mission', '대여 글러브 안쪽 닦기', 2, '안쪽이 축축하지 않음', '안쪽을 닦고 벌려서 말리기', null, true, '{5}', null, null, 0, null, 22),
    ('open', 'women_locker', 'women', '여자 탈의실', 2, '바닥과 화장대에 머리카락 없음', '바닥 머리카락 → 화장대·드라이기 주변 → 벤치·분실물 → 휴지통·면봉통 → 거울 물자국', null, false, null, null, null, 0, null, 31),
    ('open', 'women_shower', 'women', '여자 샤워실', 2, '거름망 머리카락 없음, 샴푸·바디워시 3분의 1 이상', '배수구 거름망 → 바닥 헹구기 → 샴푸·바디워시 확인 → 물기 밀기', null, false, null, null, null, 0, null, 32),
    ('open', 'women_toilet', 'women', '여자 화장실', 3, '변기·세면대 얼룩 없음, 휴지 여분 1개 이상', '변기 솔질·시트 → 세면대·수전 → 휴지통 → 휴지·핸드타월·비누 → 바닥 얼룩', '빨강 걸레(화장실 전용)만 써요', false, null, null, null, 0, null, 33),
    ('open', 'men_locker', 'men', '남자 탈의실', 2, '바닥과 화장대에 머리카락 없음', '바닥 머리카락 → 화장대·드라이기 주변 → 벤치·분실물 → 휴지통·면봉통 → 거울 물자국', null, false, null, null, null, 0, null, 41),
    ('open', 'men_shower', 'men', '남자 샤워실', 2, '거름망 머리카락 없음, 샴푸·바디워시 3분의 1 이상', '배수구 거름망 → 바닥 헹구기 → 샴푸·바디워시 확인 → 물기 밀기', null, false, null, null, null, 0, null, 42),
    ('open', 'men_toilet', 'men', '남자 화장실', 3, '변기·세면대 얼룩 없음, 휴지 여분 1개 이상', '변기 솔질·시트 → 세면대·수전 → 휴지통 → 휴지·핸드타월·비누 → 바닥 얼룩', '빨강 걸레(화장실 전용)만 써요', false, null, null, null, 0, null, 43),
    ('open', 'ring', 'ring', '링 땀 자국 닦기', 4, '땀 자국 없음, 밟아도 미끄럽지 않음', '물 뿌리기 → 링 전용 밀대 → 마른 패드', '초록 걸레(링 전용)만 써요', false, null, null, null, 0, null, 50),
    ('open', 'entry', 'entry', '입구 신발 벗는 곳', 3, '모래·먼지 없음', '쓸기 → 닦기 → 매트 털기 → 신발장 앞 정리', null, false, '{1,2,3,5}', null, null, 0, null, 60),
    ('open', 'hall_bins', 'hall', '휴지통 · 빨래통 비우기', 2, '휴지통·빨래통이 비어 있음', '휴지통 봉투 교체 → 빨래통 비우기', null, false, null, null, null, 0, null, 71),
    ('open', 'hall_tidy', 'hall', '정리정돈 · 데스크 · 정수기 · 손잡이', 2, '바닥에 장비 없음, 데스크 먼지 없음', '글러브·소도구 제자리 → 데스크·정수기·손잡이 닦기', '파랑 걸레(거울·데스크 전용)만 써요', false, null, null, null, 0, null, 72),
    ('open', 'finish', 'finish', '로봇 먼지통 · 걸레 널기 · 도구 제자리', 3, '젖은 걸레가 뭉쳐 있지 않음', '로봇 먼지통 → 걸레 빨아 널기 → 도구 제자리 → 냄새 확인', null, false, null, null, null, 0, null, 80),
    ('evening', 'laundry', 'laundry', '빨래통 비우기 · 빨래 주머니 내놓기', 4, '빨래통이 비어 있고 새 주머니가 걸려 있음', '빨래통 비우기 → 꽉 찬 빨래 주머니 밖에 내놓기 → 새 주머니 걸기', null, false, null, null, null, 0, null, 10),
    ('evening', 'bins', 'hall', '넘친 휴지통 봉투 교체 · 종이컵 보충', 1, '넘친 휴지통 없음, 종이컵 채워짐', null, null, false, null, null, null, 0, null, 20),
    ('close', 'tidy', 'hall', '홀 정리정돈 · 대여 글러브 벌려서 말리기', 3, '바닥에 장비 없음, 글러브는 벌려 둠', null, null, false, null, null, null, 0, null, 10),
    ('close', 'bins', 'hall', '홀 휴지통 · 종이컵 정리 · 정수기 물받이', 2, '휴지통 비움, 물받이에 물 없음', null, null, false, null, null, null, 0, null, 11),
    ('close', 'laundry', 'laundry', '빨래통 비우기 · 세탁 끝난 운동복 정리', 3, '빨래통이 비어 있음, 운동복은 제자리', null, null, false, null, null, null, 0, null, 20),
    ('close', 'men_tidy', 'men', '남자 탈의실 눈에 보이는 것 정리', 1, '바닥·벤치에 물건 없음', null, null, false, null, null, null, 0, null, 30),
    ('close', 'lock', 'lock', '문단속: 창문 · 전원 · 에어컨·난방', 1, '창문 닫힘, 전원·에어컨·난방 꺼짐', null, null, false, null, null, null, 0, null, 40),
    ('close', 'robot_wed', 'lock', '퇴근 직전 로봇청소기 켜기', 0, '로봇청소기가 돌기 시작함', '목요일 아침 물걸레 준비예요. 바닥 물건을 치우고 켜요.', null, false, '{3}', null, null, 0, null, 41)
  ) as v(slot, code, zone, title, est_min, done_text, how_text, caution, mission, weekdays, month_nth, nth_dow, day_offset, months, sort)
  join public.ops_clean_slots sl on sl.branch_name = '153복싱짐 선릉역점' and sl.slot = v.slot
on conflict (slot_id, code) do nothing;
