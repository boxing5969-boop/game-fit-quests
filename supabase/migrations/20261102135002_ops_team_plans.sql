-- 153운영본부 「일정」 탭 — 팀원(코치님)이 스스로 넣는 일정 · 대표님 · 지점장 팀 일정판
-- (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리할 수 있는 기능 만들어줘 · 내가 팀원들의 스케줄을 한눈에 볼 수 있도록")
--
--   새 표 · 새 함수만 (기존 함수 동작은 그대로). 표는 RLS 를 켜고 정책 없이 — 읽기 · 쓰기는 모두 아래 함수로만.
--   팀원 = 그 지점 지도진(_strategy_branch_staff) + 그 지점 근무자 카드에 앱 계정이 이어진 분(ops_staff.user_id).
--   보는 범위: 대표님(_strategy_hq) · 그 지점에 지정된 관리자(ops_managers — 지점장 · 회계매니저) = 팀 전체
--             코치님 = 본인 것만 (10/29 대표님 "코치님들이 다른 코치님들 일하는 시간 … 못 보게, 본인 자료만"과 같은 결).
--   '개인' 일정에서 '시간만 보이기'(private)를 고르면 관리자에게는 시간과 '개인 일정'만 — 제목 · 메모는 본인만.
--   일정은 근무 시간 · 급여와 따로다 — 쉰 날 인정 · 대타 · 연장은 지금처럼 「근무」 탭(ops_day_entries).
--   팀 일정판에는 「근무」 탭 시간표(ops_shift_rules)와 승인된 쉰 날도 함께 보낸다(그리는 것은 화면 src/lib/opsPlans.ts).
--   지우기는 지우지 않고 deleted_at — 반복 일정의 '이 날만 빼기'는 skip_dates.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_plans (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  user_id uuid not null,
  kind text not null check (kind in ('class', 'pt', 'work', 'out', 'off', 'personal')),
  title text check (title is null or char_length(title) <= 40),
  memo text check (memo is null or char_length(memo) <= 300),
  start_on date not null,
  -- 한 번 하는 일정: 마지막 날(여러 날 휴무 등, 두 달까지) · 반복 일정: start_on 과 같다
  end_on date not null,
  -- 매주 반복 요일 0=일 … 6=토 · 비어 있으면 반복 없음
  repeat_weekdays smallint[] not null default '{}',
  -- 반복이 끝나는 날(그날 포함) · 없으면 계속
  until_on date,
  -- 반복 중 '이 날만 빼기'
  skip_dates date[] not null default '{}',
  all_day boolean not null default false,
  start_time time,
  end_time time,
  private boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ops_plans_dates check (end_on >= start_on and end_on <= start_on + 62),
  constraint ops_plans_until check (until_on is null or until_on >= start_on),
  constraint ops_plans_time check (all_day or (start_time is not null and end_time is not null and end_time > start_time))
);
create index if not exists ops_plans_user_idx on public.ops_plans (user_id, start_on) where deleted_at is null;
create index if not exists ops_plans_branch_idx on public.ops_plans (branch_name, updated_at);
alter table public.ops_plans enable row level security;
revoke all on public.ops_plans from anon, authenticated;

-- ───────────────────────── 권한 ─────────────────────────
-- 그 지점 팀원 — 지도진 + 근무자 카드에 앱 계정이 이어진 분
create or replace function public._ops_plan_team(_branch text)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  select s.user_id from public._strategy_branch_staff(_branch) s
  union
  select o.user_id from public.ops_staff o
   where o.branch_name = _branch and o.active and o.user_id is not null;
$$;

-- 팀 전체를 보는가 — 대표님 또는 그 지점(또는 모든 지점)에 지정된 관리자(ops_managers)
create or replace function public._ops_plan_can_view_all(_uid uuid, _branch text)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and (
    public._strategy_hq(_uid)
    or exists (select 1 from public.ops_managers m
                where m.user_id = _uid and (m.branch_name is null or m.branch_name = _branch))
  );
$$;

-- 내가 일정을 쓰고 볼 수 있는 지점 — 내가 팀원인 지점 + 팀 전체를 보는 지점(팀원이 있는 곳만)
create or replace function public._ops_plan_branches(_uid uuid)
returns table(branch_name text, manage boolean, mine boolean) language sql stable security definer set search_path = public as $$
  with cand as (
    select b.name as branch_name from public.branches b where b.is_visible
    union select ob.branch_name from public.ops_branches ob where ob.enabled
    union select p.branch_name from public.profiles p where p.user_id = _uid and p.branch_name is not null
    union select o.branch_name from public.ops_staff o where o.user_id = _uid and o.active
  ), x as (
    select c.branch_name,
           public._ops_plan_can_view_all(_uid, c.branch_name) as manage,
           exists (select 1 from public._ops_plan_team(c.branch_name) t where t.user_id = _uid) as mine
      from cand c
     where _uid is not null
  )
  select x.branch_name, x.manage, x.mine from x
   where x.mine or (x.manage and exists (select 1 from public._ops_plan_team(x.branch_name)));
$$;

revoke all on function public._ops_plan_team(text) from public, anon, authenticated;
revoke all on function public._ops_plan_can_view_all(uuid, text) from public, anon, authenticated;
revoke all on function public._ops_plan_branches(uuid) from public, anon, authenticated;

-- ───────────────────────── 한 주 읽기 ─────────────────────────
-- p_from 이 든 주(월~일). 지점을 안 고르거나 못 보는 지점이면 내 지점 → 첫 지점.
--   members: 팀 전체(관리자) 또는 나만(코치님) — 관리자에게는 앱 계정이 없는 근무자 카드도 'staff:<id>' 로 (시간표만)
--   plans: 그 주에 걸치는 일정(반복 포함 — 펼치기는 화면) · shifts: 「근무」 탭 시간표 · offs: 승인된 쉰 날
--   recent: 관리자에게만 — 7일 안에 팀원이 넣고 · 고치고 · 지운 일정(내 것 빼고) 8개
create or replace function public.ops_plans_week(p_branch text, p_from date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Seoul')::date);
  v_to date;
  v_all boolean;
  v_branches jsonb;
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches from public._ops_plan_branches(v_uid) b;
  if jsonb_array_length(v_branches) = 0 then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e->>'branch' = v_branch) then
    v_branch := coalesce(
      (select e->>'branch' from jsonb_array_elements(v_branches) e
        where e->>'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches->0->>'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  v_from := v_from - (extract(isodow from v_from)::int - 1);  -- 그 주 월요일
  v_to := v_from + 6;

  if v_all then
    select coalesce(array_agg(distinct u), '{}') into v_ids from (
      select t.user_id as u from public._ops_plan_team(v_branch) t
      union
      -- 팀에서 빠졌어도 그 주에 이 지점 일정이 있는 분(대표님 본인 일정 등)
      select pl.user_id from public.ops_plans pl
       where pl.branch_name = v_branch and pl.deleted_at is null and pl.start_on <= v_to
         and (case when cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)
    ) z;
  else
    v_ids := array[v_uid];
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'hq', public._strategy_hq(v_uid),
    'me', v_uid,
    'from', v_from,
    'to', v_to,
    'today', v_today,
    'now_hm', to_char(now() at time zone 'Asia/Seoul', 'HH24:MI'),
    'members', coalesce((
      select jsonb_agg(m.j order by m.rank, m.j->>'name')
        from (
          select jsonb_build_object('key', u::text, 'user_id', u,
                                    'name', coalesce(d->>'name', '코치'), 'title', coalesce(d->>'title', '코치'),
                                    'me', u = v_uid, 'no_app', false) as j,
                 case when d->>'title' = '대표' then 0 when d->>'title' in ('지점장', '관장') then 1 else 2 end as rank
            from (select u, public._strategy_display(u) as d from unnest(v_ids) as u) dd
          union all
          select jsonb_build_object('key', 'staff:' || s.id, 'user_id', null, 'name', s.name, 'title', '근무자',
                                    'me', false, 'no_app', true), 3
            from public.ops_staff s
           where v_all and s.branch_name = v_branch and s.active and s.user_id is null
        ) m), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
               'title', case when pl.user_id = v_uid or not pl.private then pl.title end,
               'memo', case when pl.user_id = v_uid or not pl.private then pl.memo end,
               'masked', pl.private and pl.user_id <> v_uid, 'private', pl.private,
               'start_on', pl.start_on, 'end_on', pl.end_on,
               'repeat_weekdays', to_jsonb(pl.repeat_weekdays), 'until_on', pl.until_on, 'skip_dates', to_jsonb(pl.skip_dates),
               'all_day', pl.all_day,
               'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI'),
               'mine', pl.user_id = v_uid, 'updated_at', pl.updated_at)
             order by pl.start_on, pl.start_time nulls first)
        from public.ops_plans pl
       where pl.deleted_at is null and pl.user_id = any(v_ids) and pl.start_on <= v_to
         and (case when cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name, 'weekday', r.weekday,
               'start_time', to_char(r.start_time, 'HH24:MI'), 'end_time', to_char(r.end_time, 'HH24:MI'),
               'valid_from', r.valid_from, 'valid_to', r.valid_to, 'staff_start', s.start_date, 'staff_end', s.end_date)
             order by r.weekday, r.start_time)
        from public.ops_shift_rules r join public.ops_staff s on s.id = r.staff_id
       where s.active
         and (s.user_id = any(v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))
         and r.valid_from <= v_to and (r.valid_to is null or r.valid_to >= v_from)), '[]'::jsonb),
    'offs', coalesce((
      select jsonb_agg(jsonb_build_object('key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name,
                                          'date', e.work_date) order by e.work_date)
        from public.ops_day_entries e join public.ops_staff s on s.id = e.staff_id
       where e.kind = 'off' and e.status = 'approved' and e.work_date between v_from and v_to
         and (s.user_id = any(v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r.j order by r.at desc)
        from (
          select jsonb_build_object(
                   'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
                   'title', case when not pl.private then pl.title end,
                   'action', case when pl.deleted_at is not null then 'removed'
                                  when pl.updated_at > pl.created_at + interval '1 minute' then 'edit' else 'new' end,
                   'at', greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)),
                   'start_on', pl.start_on, 'end_on', pl.end_on, 'repeat_weekdays', to_jsonb(pl.repeat_weekdays),
                   'all_day', pl.all_day,
                   'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI')) as j,
                 greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) as at
            from public.ops_plans pl
           where v_all and pl.user_id = any(v_ids) and pl.user_id <> v_uid
             and greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) > now() - interval '7 days'
           order by 2 desc
           limit 8
        ) r), '[]'::jsonb));
end $$;

-- ───────────────────────── 쓰기 (내 일정만) ─────────────────────────
-- p: {id?, branch, kind, title?, memo?, start_on, end_on?, repeat_weekdays?, until_on?, all_day, start_time?, end_time?, private?, only_date?}
--   only_date: 반복 일정의 그날 하나만 바꾸기 — 원래 반복에서 그날을 빼고, 보낸 값으로 한 번 하는 일정을 새로 만든다
create or replace function public.ops_plan_save(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_only date := nullif(p->>'only_date', '')::date;
  v_row public.ops_plans%rowtype;
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_kind text := p->>'kind';
  v_title text := nullif(btrim(coalesce(p->>'title', '')), '');
  v_memo text := nullif(btrim(coalesce(p->>'memo', '')), '');
  v_start date := nullif(p->>'start_on', '')::date;
  v_end date := nullif(p->>'end_on', '')::date;
  v_days smallint[];
  v_until date := nullif(p->>'until_on', '')::date;
  v_all_day boolean := coalesce((p->>'all_day')::boolean, false);
  v_st time := nullif(p->>'start_time', '')::time;
  v_et time := nullif(p->>'end_time', '')::time;
  v_private boolean := coalesce((p->>'private')::boolean, false);
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_kind is null or v_kind not in ('class', 'pt', 'work', 'out', 'off', 'personal') then raise exception '일정 종류를 골라 주세요'; end if;
  if v_start is null then raise exception '날짜를 골라 주세요'; end if;
  if v_start < v_today - 62 or v_start > v_today + 400 then raise exception '날짜를 다시 골라 주세요'; end if;
  if char_length(coalesce(v_title, '')) > 40 then raise exception '제목은 40자까지예요'; end if;
  if char_length(coalesce(v_memo, '')) > 300 then raise exception '메모는 300자까지예요'; end if;

  select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
    from jsonb_array_elements_text(case when jsonb_typeof(p->'repeat_weekdays') = 'array' then p->'repeat_weekdays' else '[]'::jsonb end) d
   where d ~ '^[0-6]$';
  if v_only is not null then v_days := '{}'; end if;  -- 그날 하나만 바꾸기는 한 번 하는 일정
  if cardinality(v_days) > 0 then
    v_end := v_start;
    if v_until is not null and v_until < v_start then raise exception '반복이 끝나는 날이 시작보다 빨라요'; end if;
  else
    v_until := null;
    v_end := coalesce(v_end, v_start);
    if v_end < v_start then raise exception '끝나는 날이 시작보다 빨라요'; end if;
    if v_end > v_start + 62 then raise exception '여러 날 일정은 두 달까지예요'; end if;
  end if;
  if v_all_day then
    v_st := null; v_et := null;
  elsif v_st is null or v_et is null or v_et <= v_st then
    raise exception '시작 · 끝 시각을 확인해 주세요';
  end if;
  if v_kind <> 'personal' then v_private := false; end if;  -- 시간만 보이기는 '개인' 일정만

  if v_id is not null then
    select * into v_row from public.ops_plans where id = v_id and deleted_at is null for update;
    if not found then raise exception '일정을 찾을 수 없어요'; end if;
    if v_row.user_id <> v_uid then raise exception '내 일정만 고칠 수 있어요'; end if;
    v_branch := coalesce(v_branch, v_row.branch_name);
  end if;
  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch and (b.mine or b.manage)) then
    raise exception '이 지점에는 일정을 넣을 수 없어요';
  end if;

  if v_id is not null and v_only is not null then
    if cardinality(v_row.repeat_weekdays) = 0 then raise exception '반복 일정만 하루씩 바꿀 수 있어요'; end if;
    if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
    update public.ops_plans
       set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || v_only) x), updated_at = now()
     where id = v_id;
    v_id := null;  -- 아래에서 새로 만든다
  end if;

  if v_id is null then
    if (select count(*) from public.ops_plans
         where user_id = v_uid and deleted_at is null
           and (case when cardinality(repeat_weekdays) = 0 then end_on else coalesce(until_on, 'infinity'::date) end) >= v_today) >= 300 then
      raise exception '앞으로 잡힌 일정이 너무 많아요 — 지난 일정은 지워 주세요';
    end if;
    insert into public.ops_plans (branch_name, user_id, kind, title, memo, start_on, end_on, repeat_weekdays, until_on,
                                  all_day, start_time, end_time, private, created_by)
    values (v_branch, v_uid, v_kind, v_title, v_memo, v_start, v_end, v_days, v_until,
            v_all_day, v_st, v_et, v_private, v_uid)
    returning id into v_id;
  else
    update public.ops_plans
       set branch_name = v_branch, kind = v_kind, title = v_title, memo = v_memo,
           start_on = v_start, end_on = v_end, repeat_weekdays = v_days, until_on = v_until,
           skip_dates = case when cardinality(v_days) > 0
                             then coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x >= v_start), '{}')
                             else '{}' end,
           all_day = v_all_day, start_time = v_st, end_time = v_et, private = v_private, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end $$;

-- 반복 일정에서 그날 하나만 빼기
create or replace function public.ops_plan_skip(p_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.ops_plans%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_row from public.ops_plans where id = p_id and deleted_at is null for update;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;
  if v_row.user_id <> v_uid then raise exception '내 일정만 고칠 수 있어요'; end if;
  if cardinality(v_row.repeat_weekdays) = 0 then raise exception '반복 일정만 하루씩 뺄 수 있어요'; end if;
  if p_date is null or p_date < v_row.start_on then raise exception '날짜를 다시 골라 주세요'; end if;
  if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
  update public.ops_plans
     set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || p_date) x), updated_at = now()
   where id = p_id;
end $$;

-- 일정 지우기 (반복이면 반복 전체) — 남겨 두고 deleted_at
create or replace function public.ops_plan_remove(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  update public.ops_plans set deleted_at = now(), updated_at = now()
   where id = p_id and user_id = v_uid and deleted_at is null;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;
end $$;

revoke all on function public.ops_plans_week(text, date) from public, anon;
revoke all on function public.ops_plan_save(jsonb) from public, anon;
revoke all on function public.ops_plan_skip(uuid, date) from public, anon;
revoke all on function public.ops_plan_remove(uuid) from public, anon;
grant execute on function public.ops_plans_week(text, date) to authenticated;
grant execute on function public.ops_plan_save(jsonb) to authenticated;
grant execute on function public.ops_plan_skip(uuid, date) to authenticated;
grant execute on function public.ops_plan_remove(uuid) to authenticated;
