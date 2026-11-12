-- 153운영본부 「일정」 탭 2단계 — 할 일 · 오늘 중요한 일 3개 · 근무 시간대 고정 업무 · 6규칙 안내
-- (2026-11-08 대표님 「이방법대로 스케줄 사용할수있도록 … 코치님이 중요한 일을 먼저 정해주자 · 나도 각각 코치님 개별 스케줄러」
--  · 보고서 「153 계획 시스템 보고서」 https://claude.ai/artifact/EuQAL1HpGefZk8Nwd8GrBf)
--   새 표 · 새 함수만 (기존 함수 동작은 그대로). 표는 RLS 를 켜고 정책 없이 — 읽기 · 쓰기는 모두 아래 함수로만(ops_plans 와 같은 결).
--   팀원 · 보는 범위는 「일정」 탭과 같다: _ops_plan_team · _ops_plan_can_view_all · _ops_plan_branches
--   상태 3색: todo(파랑) · doing(노랑) · done(회색). 빨강(시간 고정)은 「일정」 탭 일정 · 「근무」 시간표가 맡는다.
--   고정 업무는 근무 시간대에 붙는다 — 지정 담당이 그 시각 근무면 그분만, 아니면 그 시각 근무자 모두.

create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  user_id uuid not null,
  title text not null check (char_length(title) between 1 and 60),
  memo text check (memo is null or char_length(memo) <= 300),
  kind text not null default 'mine' check (kind in ('mine', 'delegate')),
  effect smallint not null default 2 check (effect between 1 and 3),
  due_on date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  source text not null default 'self' check (source in ('self', 'preset', 'assigned')),
  preset_id uuid,
  reply text check (reply is null or char_length(reply) <= 200),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  deleted_at timestamptz
);
create index if not exists ops_tasks_user_idx on public.ops_tasks (user_id, status) where deleted_at is null;
create index if not exists ops_tasks_branch_idx on public.ops_tasks (branch_name, updated_at);
alter table public.ops_tasks enable row level security;
revoke all on public.ops_tasks from anon, authenticated;

create table if not exists public.ops_task_presets (
  id uuid primary key default gen_random_uuid(),
  branch_name text,
  kind text not null check (kind in ('focus', 'duty')),
  title text not null check (char_length(title) between 1 and 60),
  effect smallint not null default 2 check (effect between 1 and 3),
  due_rule text check (due_rule is null or due_rule in ('every_class', 'trial', 'expiry_14', 'absence_14', 'weekly_mon', 'weekly')),
  duty_slot text check (duty_slot is null or duty_slot in ('open', 'close')),
  duty_time time,
  assignee_user_id uuid,
  sort smallint not null default 0,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_task_presets_duty check (
    (kind = 'duty' and branch_name is not null and duty_slot is not null and duty_time is not null)
    or (kind = 'focus' and duty_slot is null and duty_time is null and assignee_user_id is null))
);
alter table public.ops_task_presets enable row level security;
revoke all on public.ops_task_presets from anon, authenticated;

create table if not exists public.ops_duty_checks (
  preset_id uuid not null references public.ops_task_presets(id) on delete cascade,
  work_date date not null,
  branch_name text not null,
  checked_by uuid not null,
  checked_at timestamptz not null default now(),
  primary key (preset_id, work_date)
);
create index if not exists ops_duty_checks_branch_idx on public.ops_duty_checks (branch_name, work_date);
alter table public.ops_duty_checks enable row level security;
revoke all on public.ops_duty_checks from anon, authenticated;

create table if not exists public.ops_daily_focus (
  user_id uuid not null,
  work_date date not null,
  branch_name text not null,
  task_ids uuid[] not null default '{}' check (cardinality(task_ids) <= 3),
  set_at timestamptz not null default now(),
  primary key (user_id, work_date)
);
create index if not exists ops_daily_focus_branch_idx on public.ops_daily_focus (branch_name, work_date);
alter table public.ops_daily_focus enable row level security;
revoke all on public.ops_daily_focus from anon, authenticated;

create table if not exists public.ops_task_prefs (
  user_id uuid primary key,
  focus_slot text check (focus_slot is null or focus_slot in ('dawn', 'morning', 'afternoon', 'evening', 'night')),
  manual_version text check (manual_version is null or char_length(manual_version) <= 20),
  manual_read_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ops_task_prefs enable row level security;
revoke all on public.ops_task_prefs from anon, authenticated;

create or replace function public._ops_duty_people(_preset uuid, _date date)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  with p as (
    select * from public.ops_task_presets where id = _preset and kind = 'duty' and active
  ), shift as (
    select distinct s.user_id
      from p
      join public.ops_staff s on s.branch_name = p.branch_name and s.active and s.user_id is not null
      join public.ops_shift_rules r on r.staff_id = s.id
                                   and r.weekday = extract(dow from _date)::int
                                   and (r.valid_from is null or r.valid_from <= _date)
                                   and (r.valid_to is null or r.valid_to >= _date)
                                   and r.start_time <= p.duty_time and r.end_time > p.duty_time
     where not exists (select 1 from public.ops_day_entries e
                        where e.staff_id = s.id and e.work_date = _date and e.kind = 'off' and e.status = 'approved')
  ), pick as (
    select p.assignee_user_id as user_id from p where p.assignee_user_id in (select sh.user_id from shift sh)
  )
  select user_id from pick
  union all
  select sh.user_id from shift sh where not exists (select 1 from pick);
$$;

create or replace function public._ops_task_notify(_to uuid, _title text, _body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select _to, _title, coalesce(_body, ''), '/office?tab=plan' where _to is not null;
$$;

create or replace function public._ops_task_name(_uid uuid, _branch text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.name from public.ops_staff s where s.user_id = _uid and s.branch_name = _branch order by s.active desc limit 1),
    (select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), '')) from public.profiles p where p.user_id = _uid),
    '코치');
$$;

revoke all on function public._ops_duty_people(uuid, date) from public, anon, authenticated;
revoke all on function public._ops_task_notify(uuid, text, text) from public, anon, authenticated;
revoke all on function public._ops_task_name(uuid, text) from public, anon, authenticated;

create or replace function public.ops_tasks_day(p_branch text, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Seoul')::date);
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_branches jsonb;
  v_all boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches from public._ops_plan_branches(v_uid) b;
  if jsonb_array_length(v_branches) = 0 then raise exception '할 일은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e->>'branch' = v_branch) then
    v_branch := coalesce(
      (select e->>'branch' from jsonb_array_elements(v_branches) e
        where e->>'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches->0->>'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);

  return jsonb_build_object(
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'hq', public._strategy_hq(v_uid),
    'me', v_uid,
    'date', v_date,
    'today', v_today,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'title', t.title, 'memo', t.memo, 'kind', t.kind, 'effect', t.effect,
               'due_on', t.due_on, 'status', t.status, 'source', t.source, 'preset_id', t.preset_id,
               'reply', t.reply, 'created_by', t.created_by,
               'created_by_name', case when t.created_by = v_uid then null else public._ops_task_name(t.created_by, t.branch_name) end,
               'done_at', t.done_at, 'updated_at', t.updated_at)
             order by (t.status = 'done'), t.due_on nulls last, t.effect desc, t.created_at)
        from public.ops_tasks t
       where t.user_id = v_uid and t.branch_name = v_branch and t.deleted_at is null
         and (t.status <> 'done' or t.done_at >= now() - interval '36 hours')), '[]'::jsonb),
    'focus', coalesce((select to_jsonb(f.task_ids) from public.ops_daily_focus f
                        where f.user_id = v_uid and f.work_date = v_date), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'title', p.title, 'slot', p.duty_slot, 'time', to_char(p.duty_time, 'HH24:MI'),
               'mine', exists (select 1 from public._ops_duty_people(p.id, v_date) d where d.user_id = v_uid),
               'people', (select coalesce(jsonb_agg(public._ops_task_name(d.user_id, v_branch)), '[]'::jsonb)
                            from public._ops_duty_people(p.id, v_date) d),
               'checked', c.preset_id is not null,
               'checked_at', c.checked_at,
               'checked_by_name', case when c.checked_by is null then null else public._ops_task_name(c.checked_by, v_branch) end)
             order by p.duty_time, p.sort, p.created_at)
        from public.ops_task_presets p
        left join public.ops_duty_checks c on c.preset_id = p.id and c.work_date = v_date
       where p.kind = 'duty' and p.active and p.branch_name = v_branch
         and (v_all or exists (select 1 from public._ops_duty_people(p.id, v_date) d where d.user_id = v_uid))), '[]'::jsonb),
    'presets', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'effect', p.effect, 'due_rule', p.due_rule,
                                          'branch', p.branch_name)
             order by p.sort, p.created_at)
        from public.ops_task_presets p
       where p.kind = 'focus' and p.active and (p.branch_name is null or p.branch_name = v_branch)), '[]'::jsonb),
    'prefs', coalesce((select jsonb_build_object('focus_slot', x.focus_slot, 'manual_version', x.manual_version,
                                                 'manual_read_at', x.manual_read_at)
                         from public.ops_task_prefs x where x.user_id = v_uid), '{}'::jsonb)
  );
end $$;

create or replace function public.ops_task_board(p_branch text, p_from date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Seoul')::date);
  v_to date;
  v_all boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch) then
    raise exception '지점을 다시 골라 주세요';
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  v_from := v_from - (extract(isodow from v_from)::int - 1);
  v_to := v_from + 6;

  return jsonb_build_object(
    'branch', v_branch, 'from', v_from, 'to', v_to, 'today', v_today, 'manage', v_all,
    'people', coalesce((
      with team as (
        select t.user_id from public._ops_plan_team(v_branch) t where v_all
        union select v_uid
      ), staff as (
        select tm.user_id,
               (select s.id from public.ops_staff s where s.user_id = tm.user_id and s.branch_name = v_branch and s.active limit 1) as staff_id,
               (select s.kind from public.ops_staff s where s.user_id = tm.user_id and s.branch_name = v_branch and s.active limit 1) as staff_kind
          from team tm
      ), days as (
        select st.user_id, d::date as work_date
          from staff st
          cross join generate_series(v_from, least(v_to, v_today), interval '1 day') d
         where st.staff_id is not null
           and exists (select 1 from public.ops_shift_rules r
                        where r.staff_id = st.staff_id and r.weekday = extract(dow from d)::int
                          and (r.valid_from is null or r.valid_from <= d::date) and (r.valid_to is null or r.valid_to >= d::date))
           and not exists (select 1 from public.ops_day_entries e
                            where e.staff_id = st.staff_id and e.work_date = d::date and e.kind = 'off' and e.status = 'approved')
      )
      select jsonb_agg(jsonb_build_object(
               'user_id', st.user_id,
               'name', public._ops_task_name(st.user_id, v_branch),
               'staff_kind', st.staff_kind,
               'open', (select count(*) from public.ops_tasks t where t.user_id = st.user_id and t.branch_name = v_branch
                          and t.deleted_at is null and t.status = 'todo'),
               'doing', (select count(*) from public.ops_tasks t where t.user_id = st.user_id and t.branch_name = v_branch
                           and t.deleted_at is null and t.status = 'doing'),
               'done_week', (select count(*) from public.ops_tasks t where t.user_id = st.user_id and t.branch_name = v_branch
                               and t.deleted_at is null and t.status = 'done'
                               and (t.done_at at time zone 'Asia/Seoul')::date between v_from and v_to),
               'overdue', (select count(*) from public.ops_tasks t where t.user_id = st.user_id and t.branch_name = v_branch
                             and t.deleted_at is null and t.status <> 'done' and t.due_on < v_today),
               'assigned_open', (select count(*) from public.ops_tasks t where t.user_id = st.user_id and t.branch_name = v_branch
                                   and t.deleted_at is null and t.status <> 'done' and t.source = 'assigned'),
               'work_days', (select count(*) from days dd where dd.user_id = st.user_id),
               'focus_days', (select count(*) from days dd
                                join public.ops_daily_focus f on f.user_id = dd.user_id and f.work_date = dd.work_date
                               where dd.user_id = st.user_id and cardinality(f.task_ids) > 0),
               'shift_weekdays', (select count(distinct r.weekday) from public.ops_shift_rules r
                                   where st.staff_id is not null and r.staff_id = st.staff_id
                                     and (r.valid_from is null or r.valid_from <= v_to) and (r.valid_to is null or r.valid_to >= v_from)))
             order by public._ops_task_name(st.user_id, v_branch))
        from staff st), '[]'::jsonb),
    'duties', case when v_all then coalesce((
      select jsonb_build_object(
               'due', count(*),
               'done', count(*) filter (where c.preset_id is not null))
        from public.ops_task_presets p
        cross join generate_series(v_from, least(v_to, v_today), interval '1 day') d
        left join public.ops_duty_checks c on c.preset_id = p.id and c.work_date = d::date
       where p.kind = 'duty' and p.active and p.branch_name = v_branch
         and exists (select 1 from public._ops_duty_people(p.id, d::date))), '{}'::jsonb) else null end
  );
end $$;

create or replace function public.ops_task_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_to uuid := coalesce(nullif(p->>'user_id', '')::uuid, auth.uid());
  v_preset uuid := nullif(p->>'preset_id', '')::uuid;
  v_title text := nullif(btrim(coalesce(p->>'title', '')), '');
  v_memo text := nullif(btrim(coalesce(p->>'memo', '')), '');
  v_kind text := coalesce(nullif(p->>'kind', ''), 'mine');
  v_effect smallint := coalesce(nullif(p->>'effect', '')::smallint, 2);
  v_due date := nullif(p->>'due_on', '')::date;
  v_pre public.ops_task_presets%rowtype;
  v_row public.ops_tasks%rowtype;
  v_all boolean;
  v_source text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_kind not in ('mine', 'delegate') then raise exception '내 일 · 넘길 일을 골라 주세요'; end if;
  if v_effect not between 1 and 3 then raise exception '효과 점수는 1~3 이에요'; end if;
  if v_due is not null and (v_due < v_today - 31 or v_due > v_today + 366) then raise exception '기한을 다시 골라 주세요'; end if;
  if char_length(coalesce(v_memo, '')) > 300 then raise exception '메모는 300자까지예요'; end if;

  if v_id is not null then
    select * into v_row from public.ops_tasks where id = v_id and deleted_at is null for update;
    if not found then raise exception '할 일을 찾지 못했어요'; end if;
    v_all := public._ops_plan_can_view_all(v_uid, v_row.branch_name);
    if not (v_row.user_id = v_uid or (v_all and v_row.created_by = v_uid)) then
      raise exception '본인 할 일 · 내가 배정한 일만 고칠 수 있어요';
    end if;
    if v_title is null then raise exception '할 일을 적어 주세요'; end if;
    if char_length(v_title) > 60 then raise exception '할 일은 60자까지예요'; end if;
    update public.ops_tasks
       set title = v_title, memo = v_memo, kind = v_kind, effect = v_effect, due_on = v_due, updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch) then
    raise exception '지점을 다시 골라 주세요';
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  if v_to <> v_uid then
    if not v_all then raise exception '다른 분에게 일을 넣는 것은 지점장님 · 대표님만 할 수 있어요'; end if;
    if not exists (select 1 from public._ops_plan_team(v_branch) t where t.user_id = v_to) then
      raise exception '그 지점 팀원에게만 넣을 수 있어요';
    end if;
  elsif not exists (select 1 from public._ops_plan_team(v_branch) t where t.user_id = v_uid) and not v_all then
    raise exception '그 지점 팀원만 쓸 수 있어요';
  end if;

  if v_preset is not null then
    select * into v_pre from public.ops_task_presets
     where id = v_preset and kind = 'focus' and active and (branch_name is null or branch_name = v_branch);
    if not found then raise exception '기본 목록에서 찾지 못했어요'; end if;
    v_title := coalesce(v_title, v_pre.title);
    if nullif(p->>'effect', '') is null then v_effect := v_pre.effect; end if;
  end if;
  if v_title is null then raise exception '할 일을 적어 주세요'; end if;
  if char_length(v_title) > 60 then raise exception '할 일은 60자까지예요'; end if;
  v_source := case when v_to <> v_uid then 'assigned' when v_preset is not null then 'preset' else 'self' end;

  insert into public.ops_tasks (branch_name, user_id, title, memo, kind, effect, due_on, source, preset_id, created_by)
  values (v_branch, v_to, v_title, v_memo, v_kind, v_effect, v_due, v_source, v_preset, v_uid)
  returning id into v_id;

  if v_source = 'assigned' then
    perform public._ops_task_notify(v_to, '새 할 일이 왔어요',
      public._ops_task_name(v_uid, v_branch) || ' · ' || v_title
      || case when v_due is not null then ' · 기한 ' || to_char(v_due, 'FMMM/FMDD') else '' end);
  end if;
  return v_id;
end $$;

create or replace function public.ops_task_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ops_tasks%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p_status not in ('todo', 'doing', 'done') then raise exception '상태를 다시 골라 주세요'; end if;
  select * into v_row from public.ops_tasks where id = p_id and deleted_at is null for update;
  if not found then raise exception '할 일을 찾지 못했어요'; end if;
  if not (v_row.user_id = v_uid or public._ops_plan_can_view_all(v_uid, v_row.branch_name)) then
    raise exception '본인 할 일만 바꿀 수 있어요';
  end if;
  if v_row.status = p_status then return; end if;
  update public.ops_tasks
     set status = p_status,
         done_at = case when p_status = 'done' then now() else null end,
         updated_at = now()
   where id = p_id;
  if p_status = 'done' and v_row.source = 'assigned' and v_row.created_by <> v_uid then
    perform public._ops_task_notify(v_row.created_by, '배정한 일이 끝났어요',
      public._ops_task_name(v_row.user_id, v_row.branch_name) || ' · ' || v_row.title);
  end if;
end $$;

create or replace function public.ops_task_remove(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ops_tasks%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_row from public.ops_tasks where id = p_id and deleted_at is null for update;
  if not found then return; end if;
  if not ((v_row.user_id = v_uid and v_row.source <> 'assigned')
          or v_row.created_by = v_uid
          or public._ops_plan_can_view_all(v_uid, v_row.branch_name)) then
    raise exception '배정받은 일은 배정한 분만 지울 수 있어요 — 질문을 남겨 주세요';
  end if;
  update public.ops_tasks set deleted_at = now(), updated_at = now() where id = p_id;
end $$;

create or replace function public.ops_task_reply(p_id uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_row public.ops_tasks%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_text is null then raise exception '질문을 적어 주세요'; end if;
  if char_length(v_text) > 200 then raise exception '질문은 200자까지예요'; end if;
  select * into v_row from public.ops_tasks where id = p_id and deleted_at is null for update;
  if not found then raise exception '할 일을 찾지 못했어요'; end if;
  if v_row.user_id <> v_uid then raise exception '받은 분만 질문할 수 있어요'; end if;
  update public.ops_tasks set reply = v_text, updated_at = now() where id = p_id;
  if v_row.created_by <> v_uid then
    perform public._ops_task_notify(v_row.created_by, '할 일에 질문이 왔어요',
      public._ops_task_name(v_uid, v_row.branch_name) || ' · ' || v_row.title || ' — ' || v_text);
  end if;
end $$;

create or replace function public.ops_focus_set(p_branch text, p_date date, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p_date is null or p_date < v_today or p_date > v_today + 1 then raise exception '오늘이나 내일만 정할 수 있어요'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_ids, '{}')) x where x is not null;
  if cardinality(v_ids) > 3 then raise exception '중요한 일은 3개까지예요'; end if;
  if exists (select 1 from unnest(v_ids) x
              where not exists (select 1 from public.ops_tasks t
                                 where t.id = x and t.user_id = v_uid and t.branch_name = p_branch
                                   and t.deleted_at is null and t.status <> 'done')) then
    raise exception '내 열린 할 일만 고를 수 있어요';
  end if;
  insert into public.ops_daily_focus (user_id, work_date, branch_name, task_ids, set_at)
  values (v_uid, p_date, p_branch, v_ids, now())
  on conflict (user_id, work_date) do update set task_ids = excluded.task_ids, branch_name = excluded.branch_name, set_at = now();
end $$;

create or replace function public.ops_duty_check(p_preset uuid, p_date date, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_pre public.ops_task_presets%rowtype;
  v_all boolean;
  v_min date;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_pre from public.ops_task_presets where id = p_preset and kind = 'duty' and active;
  if not found then raise exception '고정 업무를 찾지 못했어요'; end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_pre.branch_name);
  v_min := v_today - (case when v_all then 7 else 0 end);
  if p_date is null or p_date > v_today or p_date < v_min then
    raise exception '그날은 체크할 수 없어요';
  end if;
  if not (v_all or exists (select 1 from public._ops_duty_people(p_preset, p_date) d where d.user_id = v_uid)) then
    raise exception '그 시간 근무자만 체크할 수 있어요';
  end if;
  if coalesce(p_on, true) then
    insert into public.ops_duty_checks (preset_id, work_date, branch_name, checked_by)
    values (p_preset, p_date, v_pre.branch_name, v_uid)
    on conflict (preset_id, work_date) do nothing;
  else
    delete from public.ops_duty_checks where preset_id = p_preset and work_date = p_date;
  end if;
end $$;

create or replace function public.ops_preset_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_kind text := p->>'kind';
  v_title text := nullif(btrim(coalesce(p->>'title', '')), '');
  v_effect smallint := coalesce(nullif(p->>'effect', '')::smallint, 2);
  v_rule text := nullif(p->>'due_rule', '');
  v_slot text := nullif(p->>'duty_slot', '');
  v_time time := nullif(p->>'duty_time', '')::time;
  v_assignee uuid := nullif(p->>'assignee_user_id', '')::uuid;
  v_sort smallint := coalesce(nullif(p->>'sort', '')::smallint, 0);
  v_active boolean := coalesce((p->>'active')::boolean, true);
  v_old public.ops_task_presets%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_id is not null then
    select * into v_old from public.ops_task_presets where id = v_id;
    if not found then raise exception '기본 목록에서 찾지 못했어요'; end if;
    v_kind := v_old.kind;
    v_branch := v_old.branch_name;
  end if;
  if v_kind not in ('focus', 'duty') then raise exception '종류를 골라 주세요'; end if;
  if v_branch is null then
    if v_kind = 'duty' then raise exception '고정 업무는 지점을 골라 주세요'; end if;
    if not public._strategy_hq(v_uid) then raise exception '모든 지점 목록은 대표님만 고칠 수 있어요'; end if;
  elsif not public._ops_plan_can_view_all(v_uid, v_branch) then
    raise exception '그 지점 관리자만 고칠 수 있어요';
  end if;
  if v_title is null or char_length(v_title) > 60 then raise exception '이름은 1~60자예요'; end if;
  if v_effect not between 1 and 3 then raise exception '효과 점수는 1~3 이에요'; end if;
  if v_kind = 'duty' then
    if v_slot is null or v_slot not in ('open', 'close') or v_time is null then raise exception '오픈 · 마감과 시각을 골라 주세요'; end if;
    if v_assignee is not null and not exists (select 1 from public._ops_plan_team(v_branch) t where t.user_id = v_assignee) then
      raise exception '그 지점 팀원만 담당으로 정할 수 있어요';
    end if;
    v_rule := null;
  else
    v_slot := null; v_time := null; v_assignee := null;
  end if;

  if v_id is null then
    insert into public.ops_task_presets (branch_name, kind, title, effect, due_rule, duty_slot, duty_time, assignee_user_id, sort, active, created_by)
    values (v_branch, v_kind, v_title, v_effect, v_rule, v_slot, v_time, v_assignee, v_sort, v_active, v_uid)
    returning id into v_id;
  else
    update public.ops_task_presets
       set title = v_title, effect = v_effect, due_rule = v_rule, duty_slot = v_slot, duty_time = v_time,
           assignee_user_id = v_assignee, sort = v_sort, active = v_active, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.ops_task_pref_set(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slot text := nullif(p->>'focus_slot', '');
  v_ver text := nullif(p->>'manual_version', '');
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_slot is not null and v_slot not in ('dawn', 'morning', 'afternoon', 'evening', 'night') then raise exception '시간대를 다시 골라 주세요'; end if;
  if v_ver is not null and char_length(v_ver) > 20 then raise exception '판 이름이 길어요'; end if;
  insert into public.ops_task_prefs (user_id, focus_slot, manual_version, manual_read_at, updated_at)
  values (v_uid, v_slot, v_ver, case when v_ver is not null then now() end, now())
  on conflict (user_id) do update
     set focus_slot = case when p ? 'focus_slot' then excluded.focus_slot else public.ops_task_prefs.focus_slot end,
         manual_version = coalesce(excluded.manual_version, public.ops_task_prefs.manual_version),
         manual_read_at = case when excluded.manual_version is not null then now() else public.ops_task_prefs.manual_read_at end,
         updated_at = now();
end $$;

revoke all on function public.ops_tasks_day(text, date) from public, anon;
revoke all on function public.ops_task_board(text, date) from public, anon;
revoke all on function public.ops_task_save(jsonb) from public, anon;
revoke all on function public.ops_task_set_status(uuid, text) from public, anon;
revoke all on function public.ops_task_remove(uuid) from public, anon;
revoke all on function public.ops_task_reply(uuid, text) from public, anon;
revoke all on function public.ops_focus_set(text, date, uuid[]) from public, anon;
revoke all on function public.ops_duty_check(uuid, date, boolean) from public, anon;
revoke all on function public.ops_preset_save(jsonb) from public, anon;
revoke all on function public.ops_task_pref_set(jsonb) from public, anon;
grant execute on function public.ops_tasks_day(text, date) to authenticated;
grant execute on function public.ops_task_board(text, date) to authenticated;
grant execute on function public.ops_task_save(jsonb) to authenticated;
grant execute on function public.ops_task_set_status(uuid, text) to authenticated;
grant execute on function public.ops_task_remove(uuid) to authenticated;
grant execute on function public.ops_task_reply(uuid, text) to authenticated;
grant execute on function public.ops_focus_set(text, date, uuid[]) to authenticated;
grant execute on function public.ops_duty_check(uuid, date, boolean) to authenticated;
grant execute on function public.ops_preset_save(jsonb) to authenticated;
grant execute on function public.ops_task_pref_set(jsonb) to authenticated;

insert into public.ops_task_presets (branch_name, kind, title, effect, due_rule, sort)
select null, 'focus', v.title, v.effect, v.rule, v.sort
  from (values
    ('수업 15분 전 준비 (미트 · 글러브 · 라운드 타이머 · 음악)', 3, 'every_class', 1),
    ('체험 첫 수업: 4라운드 안에 잽이 미트에 「팡」', 3, 'trial', 2),
    ('체험 수업 직후 등록 상담 연결', 3, 'trial', 3),
    ('이용권 만료 14일 전 회원 재등록 안내', 3, 'expiry_14', 4),
    ('2주 이상 안 온 회원 안부 연락', 2, 'absence_14', 5),
    ('회원 운동 약속 확인 + 응원 한마디', 2, 'weekly_mon', 6),
    ('근무 시간표 · 근태 확인', 1, 'weekly', 7)
  ) as v(title, effect, rule, sort)
 where not exists (select 1 from public.ops_task_presets p where p.kind = 'focus' and p.branch_name is null);

insert into public.ops_task_presets (branch_name, kind, title, effect, duty_slot, duty_time, sort)
select '153복싱짐 선릉역점', 'duty', v.title, 2, v.slot, v.at::time, v.sort
  from (values
    ('남녀 샤워실 · 남녀 탈의실 청소', 'open', '11:00', 1),
    ('배수구 머리카락 청소', 'open', '11:00', 2),
    ('화장실 쓰레기통 비우기', 'open', '11:00', 3),
    ('종이컵 정리', 'close', '22:50', 4),
    ('남자 탈의실 · 샤워실 정리', 'close', '22:50', 5),
    ('세탁 끝난 운동복 정리', 'close', '22:50', 6)
  ) as v(title, slot, at, sort)
 where exists (select 1 from public.ops_branches b where b.branch_name = '153복싱짐 선릉역점')
   and not exists (select 1 from public.ops_task_presets p where p.kind = 'duty' and p.branch_name = '153복싱짐 선릉역점');
