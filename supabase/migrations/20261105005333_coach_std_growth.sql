-- 153 코치 기준 · 4주 성장 · 수업 관찰 피드백 (2026-11-05 대표님 「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
--
--   · 153 기준 다섯 가지(브랜드 공통 — 대표님만 고침) · 코치님마다 4주 과정 · 대표님 · 지점장님의 수업 관찰(잘한 것 2 · 바꿀 것 1)
--   · 코치님 자기 점검은 새 표 없이 수업 기록(strategy_items kind class_log)의 data.std = {"1":"y"|"s"|"n", …} 에 담는다
--     (strategy_save 는 p_data 를 그대로 저장한다 — 이 파일은 기존 함수를 하나도 바꾸지 않는다)
--   · 보이는 범위: 코치님 = 본인 과정 · 본인이 받은 피드백만 / 대표님 · 지점장님(_strategy_can_direct) = 그 지점 코치님들
--     · 돌아보기 결정(decision · decision_note)은 대표님 · 지점장님만
--   · 표는 직접 읽기 · 쓰기를 막고 SECURITY DEFINER 함수로만 (RLS 켬 · 정책 없음)
--   · 알림 링크: /office?tab=strategy&s=std (153운영본부 › 전략 회의 › 153 기준)

-- ───────────────────────── 표 ─────────────────────────

create table if not exists public.coach_std_items (
  no smallint primary key check (no between 1 and 9),
  title text not null check (char_length(title) between 1 and 40),
  why text not null default '',
  how text not null default '',
  say text not null default '',
  check_q text not null default '',
  active boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_growth_plans (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  coach_id uuid not null,
  start_on date not null,
  weeks smallint not null default 4 check (weeks between 1 and 12),
  status text not null default 'active' check (status in ('active', 'done', 'stopped')),
  decision text check (decision in ('keep', 'extend', 'talk')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists coach_growth_plans_one_active on public.coach_growth_plans (coach_id) where status = 'active';
create index if not exists coach_growth_plans_coach_idx on public.coach_growth_plans (coach_id, created_at desc);

create table if not exists public.coach_observations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.coach_growth_plans (id),
  branch_name text not null,
  coach_id uuid not null,
  observer_id uuid not null,
  class_on date not null,
  class_hour smallint check (class_hour between 0 and 23),
  marks jsonb not null default '{}'::jsonb,
  good1 text not null,
  good2 text,
  fix1 text not null,
  fix_no smallint check (fix_no between 1 and 9),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists coach_observations_coach_idx on public.coach_observations (coach_id, class_on desc) where deleted_at is null;

alter table public.coach_std_items enable row level security;
alter table public.coach_growth_plans enable row level security;
alter table public.coach_observations enable row level security;
revoke all on table public.coach_std_items, public.coach_growth_plans, public.coach_observations from anon, authenticated;

-- 153 기준 다섯 가지 (처음 판 — 대표님이 앱에서 고칠 수 있다)
insert into public.coach_std_items (no, title, why, how, say, check_q) values
  (1, '이름을 불러요',
      '이름이 불린 회원은 ''여기는 나를 안다''고 느껴요. 다시 오는 이유가 돼요.',
      '수업 중 회원마다 이름을 한 번 이상 불러요. 모르는 이름은 수업 전에 출석 화면에서 먼저 봐요.',
      E'"○○님, 지금 잽 좋아요!"\n"○○님 오늘 표정이 좋은데요?"',
      '오늘 이름을 한 번도 못 부른 회원이 있었나요?'),
  (2, '시작과 끝은 인사로',
      '첫 1분과 마지막 1분이 그날 수업의 기억으로 남아요.',
      '문 앞에서 눈 맞추고 맞이해요. 끝나면 한 분씩 수고했다고 말하고 다음에 올 날을 물어봐요.',
      E'"오늘도 와 주셔서 고마워요!"\n"수고하셨어요. 목요일에 봬요!"',
      '오늘 인사 없이 들어오거나 나간 회원이 있었나요?'),
  (3, '칭찬은 구체적으로',
      '''잘했어요''보다 무엇이 나아졌는지 들을 때 회원은 늘고 있다고 느껴요.',
      '회원마다 수업 중 한 번, 지난번보다 나아진 한 가지를 짚어서 말해요.',
      E'"○○님 가드가 지난주보다 안 내려와요"\n"원투 리듬이 훨씬 가벼워졌어요"',
      '오늘 칭찬을 못 들은 회원이 있었나요?'),
  (4, '처음 온 회원을 먼저',
      '첫날의 어색함은 그만두는 가장 큰 이유예요. 첫 수업이 다음 수업을 정해요.',
      '체험 · 신규 회원 곁에서 시작을 같이 해요. 끝나면 꼭 말을 걸고 다음 방문 날을 같이 정해요.',
      E'"처음엔 다 어색해요. 오늘 정말 잘하셨어요"\n"다음엔 언제 오세요? 그날 제가 또 봐 드릴게요"',
      '오늘 처음 온 회원과 다음 방문 날을 정했나요?'),
  (5, '다음 목표를 알려줘요',
      '다음 목표가 보이면 회원은 다음 수업에 와요. 153 레벨이 그 목표예요.',
      '레벨업까지 남은 것(출석 · 영상)을 알려 줘요. 영상 올릴 때가 되면 수업 끝에 바로 말해요.',
      E'"레벨업까지 두 번 남았어요"\n"오늘로 조건 채우셨어요. 영상 하나 찍어요!"',
      '오늘 다음 목표를 들은 회원이 몇 명인가요?')
on conflict (no) do nothing;

-- ───────────────────────── 안쪽 도우미 ─────────────────────────

create or replace function public._coach_today()
returns date language sql stable set search_path to 'public' as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

create or replace function public._coach_std_json()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('no', s.no, 'title', s.title, 'why', s.why, 'how', s.how,
                                               'say', s.say, 'check_q', s.check_q) order by s.no), '[]'::jsonb)
    from public.coach_std_items s where s.active;
$$;

-- 점검표 → 기준마다 {rate (했어요 1 · 조금 0.5 · 못 했어요 0 평균), n}
create or replace function public._coach_rates_self(p_uid uuid, p_from date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(t.no, jsonb_build_object('rate', round(t.rate, 3), 'n', t.n)), '{}'::jsonb)
    from (select k.key as no,
                 avg(case k.value when 'y' then 1.0 when 's' then 0.5 else 0.0 end) as rate,
                 count(*) as n
            from public.strategy_items i
           cross join lateral jsonb_each_text(case when jsonb_typeof(i.data -> 'std') = 'object' then i.data -> 'std' else '{}'::jsonb end) k
           where i.kind = 'class_log' and i.deleted_at is null and i.author_id = p_uid
             and coalesce(i.event_date, (i.created_at at time zone 'Asia/Seoul')::date) >= p_from
             and k.key ~ '^[1-9]$' and k.value in ('y', 's', 'n')
           group by k.key) t;
$$;

create or replace function public._coach_rates_obs(p_uid uuid, p_from date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(t.no, jsonb_build_object('rate', round(t.rate, 3), 'n', t.n)), '{}'::jsonb)
    from (select k.key as no,
                 avg(case k.value when 'y' then 1.0 when 's' then 0.5 else 0.0 end) as rate,
                 count(*) as n
            from public.coach_observations o
           cross join lateral jsonb_each_text(case when jsonb_typeof(o.marks) = 'object' then o.marks else '{}'::jsonb end) k
           where o.coach_id = p_uid and o.deleted_at is null and o.class_on >= p_from
             and k.key ~ '^[1-9]$' and k.value in ('y', 's', 'n')
           group by k.key) t;
$$;

-- 코치님 한 분 — 과정 · 자기 점검 · 관찰 숫자 (p_manager = 돌아보기 결정까지)
create or replace function public._coach_growth_person(p_uid uuid, p_manager boolean)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_today date := public._coach_today();
  v_plan public.coach_growth_plans%rowtype;
  v_week_no int := null;
  v_from date;
  v_week_from date;
begin
  select * into v_plan from public.coach_growth_plans
   where coach_id = p_uid
   order by (status = 'active') desc, created_at desc
   limit 1;
  -- 끝난 지 30일 넘은 과정은 다시 보여 주지 않는다
  if v_plan.id is not null and v_plan.status <> 'active'
     and coalesce(v_plan.decided_at, v_plan.updated_at) < now() - interval '30 days' then
    v_plan := null;
  end if;

  if v_plan.id is not null then
    v_week_no := case when v_today < v_plan.start_on then 0 else ((v_today - v_plan.start_on) / 7) + 1 end;
    v_from := v_plan.start_on;
    v_week_from := v_plan.start_on + 7 * greatest(least(v_week_no, v_plan.weeks) - 1, 0);
  else
    v_from := v_today - 27;
    v_week_from := date_trunc('week', v_today::timestamp)::date;
  end if;

  return jsonb_build_object(
    'person', public._strategy_display(p_uid),
    'plan', case when v_plan.id is null then null else
              jsonb_build_object('id', v_plan.id, 'start_on', v_plan.start_on, 'weeks', v_plan.weeks,
                                 'status', v_plan.status, 'week_no', v_week_no)
              || case when p_manager
                      then jsonb_build_object('decision', v_plan.decision, 'decision_note', v_plan.decision_note,
                                              'decided_at', v_plan.decided_at)
                      else '{}'::jsonb end
            end,
    'self', public._coach_rates_self(p_uid, v_from),
    'obs', public._coach_rates_obs(p_uid, v_from),
    'checks_total', (select count(*) from public.strategy_items i
                      where i.kind = 'class_log' and i.deleted_at is null and i.author_id = p_uid
                        and jsonb_typeof(i.data -> 'std') = 'object' and i.data -> 'std' <> '{}'::jsonb
                        and coalesce(i.event_date, (i.created_at at time zone 'Asia/Seoul')::date) >= v_from),
    'checks_week', (select count(*) from public.strategy_items i
                     where i.kind = 'class_log' and i.deleted_at is null and i.author_id = p_uid
                       and jsonb_typeof(i.data -> 'std') = 'object' and i.data -> 'std' <> '{}'::jsonb
                       and coalesce(i.event_date, (i.created_at at time zone 'Asia/Seoul')::date) >= v_week_from),
    'obs_total', (select count(*) from public.coach_observations o
                   where o.coach_id = p_uid and o.deleted_at is null and o.class_on >= v_from),
    'obs_week', (select count(*) from public.coach_observations o
                  where o.coach_id = p_uid and o.deleted_at is null and o.class_on >= v_week_from),
    'last_obs_at', (select max(o.created_at) from public.coach_observations o
                     where o.coach_id = p_uid and o.deleted_at is null),
    'unseen', (select count(*) from public.coach_observations o
                where o.coach_id = p_uid and o.deleted_at is null and o.seen_at is null),
    'first_marks', (select o.marks from public.coach_observations o
                     where o.coach_id = p_uid and o.deleted_at is null and o.class_on >= v_from
                     order by o.class_on, o.created_at limit 1),
    'last_marks', (select o.marks from public.coach_observations o
                    where o.coach_id = p_uid and o.deleted_at is null and o.class_on >= v_from
                    order by o.class_on desc, o.created_at desc limit 1)
  );
end $$;

-- 관찰 · 시작 대상 코치님 확인 — 그 지점 지도진이고, 부른 분이 그 지점을 볼 수 있어야 한다
create or replace function public._coach_target_branch(p_caller uuid, p_coach uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare v_coach_branch text; v_branch text;
begin
  select branch_name into v_coach_branch from public.profiles where user_id = p_coach;
  if v_coach_branch is null
     or not exists (select 1 from public._strategy_branch_staff(v_coach_branch) s where s.user_id = p_coach) then
    raise exception '코치님을 찾을 수 없어요';
  end if;
  v_branch := public._strategy_scope(p_caller, v_coach_branch);
  if v_branch is distinct from v_coach_branch then raise exception '다른 지점 코치님이에요'; end if;
  if public._strategy_hq(p_coach) then raise exception '대표님 계정은 대상이 아니에요'; end if;
  if p_coach = p_caller then raise exception '본인은 대상으로 고를 수 없어요'; end if;
  return v_branch;
end $$;

-- ───────────────────────── 화면이 부르는 함수 ─────────────────────────

create or replace function public.coach_std_list()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._strategy_staff(auth.uid()) then raise exception '코치진만 볼 수 있어요'; end if;
  return public._coach_std_json();
end $$;

create or replace function public.coach_std_save(
  p_no smallint, p_title text, p_why text, p_how text, p_say text, p_check text, p_active boolean default true)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if not public._strategy_hq(v_uid) then raise exception '153 기준은 대표님만 고칠 수 있어요'; end if;
  if p_no is null or p_no not between 1 and 9 then raise exception '기준 번호가 잘못됐어요'; end if;
  if char_length(btrim(coalesce(p_title, ''))) = 0 then raise exception '기준 이름을 써 주세요'; end if;
  insert into public.coach_std_items as s (no, title, why, how, say, check_q, active, updated_by, updated_at)
  values (p_no, left(btrim(p_title), 40), left(btrim(coalesce(p_why, '')), 300), left(btrim(coalesce(p_how, '')), 400),
          left(btrim(coalesce(p_say, '')), 400), left(btrim(coalesce(p_check, '')), 200), coalesce(p_active, true), v_uid, now())
  on conflict (no) do update
     set title = excluded.title, why = excluded.why, how = excluded.how, say = excluded.say,
         check_q = excluded.check_q, active = excluded.active, updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.coach_growth_me(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_dir boolean;
  v_me jsonb;
  v_board jsonb := null;
begin
  if not public._strategy_staff(v_uid) then return jsonb_build_object('staff', false); end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_dir := public._strategy_can_direct(v_uid);

  v_me := public._coach_growth_person(v_uid, false)
          || jsonb_build_object('observations', coalesce((
               select jsonb_agg(jsonb_build_object('id', o.id, 'class_on', o.class_on, 'class_hour', o.class_hour,
                                                   'marks', o.marks, 'good1', o.good1, 'good2', o.good2,
                                                   'fix1', o.fix1, 'fix_no', o.fix_no, 'seen_at', o.seen_at,
                                                   'created_at', o.created_at,
                                                   'observer', public._strategy_display(o.observer_id))
                                order by o.class_on desc, o.created_at desc)
                 from (select * from public.coach_observations o2
                        where o2.coach_id = v_uid and o2.deleted_at is null
                        order by o2.class_on desc, o2.created_at desc limit 10) o), '[]'::jsonb));

  if v_dir then
    select coalesce(jsonb_agg(public._coach_growth_person(s.user_id, true)
                              order by (exists (select 1 from public.coach_growth_plans p
                                                 where p.coach_id = s.user_id and p.status = 'active')) desc,
                                       (select coalesce(nullif(btrim(pr.name), ''), pr.nickname) from public.profiles pr
                                         where pr.user_id = s.user_id)), '[]'::jsonb)
      into v_board
      from public._strategy_branch_staff(v_branch) s
     where s.user_id <> v_uid and not public._strategy_hq(s.user_id);
  end if;

  return jsonb_build_object(
    'staff', true,
    'hq', public._strategy_hq(v_uid),
    'can_direct', v_dir,
    'branch', v_branch,
    'ai_polish', exists (select 1 from public.internal_sync_config c where c.key = 'coach_feedback_ai' and c.value = 'on'),
    'standards', public._coach_std_json(),
    'me', v_me,
    'board', v_board
  );
end $$;

create or replace function public.coach_growth_start(p_coach uuid, p_start_on date default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._coach_today();
  v_start date := coalesce(p_start_on, public._coach_today());
  v_branch text;
  v_id uuid;
  v_by jsonb;
begin
  if not public._strategy_can_direct(v_uid) then raise exception '4주 과정은 대표님 · 지점장님만 시작할 수 있어요'; end if;
  v_branch := public._coach_target_branch(v_uid, p_coach);
  if v_start < v_today - 28 or v_start > v_today + 28 then raise exception '시작일은 오늘 앞뒤 4주 안으로 골라 주세요'; end if;
  if exists (select 1 from public.coach_growth_plans where coach_id = p_coach and status = 'active') then
    raise exception '이미 진행 중인 4주 과정이 있어요';
  end if;

  insert into public.coach_growth_plans (branch_name, coach_id, start_on, created_by)
  values (v_branch, p_coach, v_start, v_uid)
  returning id into v_id;

  v_by := public._strategy_display(v_uid);
  insert into public.notifications (user_id, title, body, link)
  values (p_coach, '📈 153 코치 4주가 시작됐어요',
          coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', '') || '님과 1주차 「이름과 인사」부터 함께해요',
          '/office?tab=strategy&s=std');
  return v_id;
end $$;

create or replace function public.coach_observe_save(
  p_coach uuid, p_class_on date, p_class_hour smallint, p_marks jsonb,
  p_good1 text, p_good2 text, p_fix1 text, p_fix_no smallint)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._coach_today();
  v_branch text;
  v_plan uuid;
  v_id uuid;
  v_by jsonb;
  v_marks jsonb := '{}'::jsonb;
  v_g1 text := left(btrim(coalesce(p_good1, '')), 120);
  v_g2 text := nullif(left(btrim(coalesce(p_good2, '')), 120), '');
  v_f1 text := left(btrim(coalesce(p_fix1, '')), 120);
  r record;
begin
  if not public._strategy_can_direct(v_uid) then raise exception '수업 관찰은 대표님 · 지점장님만 남길 수 있어요'; end if;
  v_branch := public._coach_target_branch(v_uid, p_coach);
  if v_g1 = '' then raise exception '잘한 점을 하나 써 주세요'; end if;
  if v_f1 = '' then raise exception '다음에 바꿀 점을 하나 써 주세요'; end if;
  if p_class_on is null or p_class_on > v_today or p_class_on < v_today - 60 then raise exception '수업 날짜를 확인해 주세요'; end if;
  if p_class_hour is not null and p_class_hour not between 0 and 23 then raise exception '수업 시간이 잘못됐어요'; end if;
  if p_fix_no is not null and not exists (select 1 from public.coach_std_items where no = p_fix_no) then
    raise exception '기준 번호가 잘못됐어요';
  end if;
  if p_marks is not null and jsonb_typeof(p_marks) <> 'object' then raise exception '점검표 값이 잘못됐어요'; end if;
  for r in select key, value from jsonb_each_text(coalesce(p_marks, '{}'::jsonb)) loop
    if r.key !~ '^[1-9]$' or r.value not in ('y', 's', 'n') then raise exception '점검표 값이 잘못됐어요'; end if;
    v_marks := v_marks || jsonb_build_object(r.key, r.value);
  end loop;

  select id into v_plan from public.coach_growth_plans where coach_id = p_coach and status = 'active';

  insert into public.coach_observations (plan_id, branch_name, coach_id, observer_id, class_on, class_hour,
                                         marks, good1, good2, fix1, fix_no)
  values (v_plan, v_branch, p_coach, v_uid, p_class_on, p_class_hour, v_marks, v_g1, v_g2, v_f1, p_fix_no)
  returning id into v_id;

  v_by := public._strategy_display(v_uid);
  insert into public.notifications (user_id, title, body, link)
  values (p_coach, '👀 수업 피드백이 왔어요 · ' || coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', ''),
          left(v_g1, 60), '/office?tab=strategy&s=std');
  return v_id;
end $$;

create or replace function public.coach_observe_seen(p_ids uuid[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  update public.coach_observations
     set seen_at = now()
   where id = any (coalesce(p_ids, '{}'::uuid[])) and coach_id = v_uid and seen_at is null and deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.coach_observe_delete(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.coach_observations o
                  where o.id = p_id and o.deleted_at is null
                    and (o.observer_id = v_uid or public._strategy_hq(v_uid))) then
    raise exception '지울 수 없는 피드백이에요';
  end if;
  update public.coach_observations set deleted_at = now() where id = p_id;
end $$;

create or replace function public.coach_growth_review(p_plan uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.coach_growth_plans%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public._strategy_can_direct(v_uid) then raise exception '돌아보기는 대표님 · 지점장님만 할 수 있어요'; end if;
  if p_decision is null or p_decision not in ('keep', 'extend', 'talk') then raise exception '고르는 값이 잘못됐어요'; end if;
  select * into v_p from public.coach_growth_plans where id = p_plan;
  if v_p.id is null then raise exception '4주 과정을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, v_p.branch_name) is distinct from v_p.branch_name then raise exception '다른 지점 과정이에요'; end if;
  if v_p.coach_id = v_uid then raise exception '본인 과정은 돌아볼 수 없어요'; end if;
  if v_p.status <> 'active' then raise exception '이미 끝난 과정이에요'; end if;

  if p_decision = 'extend' then
    if v_p.weeks + 2 > 12 then raise exception '더 늘릴 수 없어요'; end if;
    update public.coach_growth_plans
       set weeks = weeks + 2, decision = 'extend', decision_note = v_note, decided_by = v_uid, decided_at = now(), updated_at = now()
     where id = p_plan;
    insert into public.notifications (user_id, title, body, link)
    values (v_p.coach_id, '📈 153 코치 과정 2주 더 함께해요', '가장 키우고 싶은 한 가지에 집중하는 2주예요', '/office?tab=strategy&s=std');
  else
    update public.coach_growth_plans
       set status = 'done', decision = p_decision, decision_note = v_note, decided_by = v_uid, decided_at = now(), updated_at = now()
     where id = p_plan;
    if p_decision = 'keep' then
      insert into public.notifications (user_id, title, body, link)
      values (v_p.coach_id, '🎉 153 코치 4주 과정을 마쳤어요', '함께해 주셔서 고마워요. 다섯 가지는 앞으로도 매 수업 그대로예요',
              '/office?tab=strategy&s=std');
    end if;
  end if;
end $$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public._coach_today() from public, anon, authenticated;
revoke all on function public._coach_std_json() from public, anon, authenticated;
revoke all on function public._coach_rates_self(uuid, date) from public, anon, authenticated;
revoke all on function public._coach_rates_obs(uuid, date) from public, anon, authenticated;
revoke all on function public._coach_growth_person(uuid, boolean) from public, anon, authenticated;
revoke all on function public._coach_target_branch(uuid, uuid) from public, anon, authenticated;

revoke all on function public.coach_std_list() from public, anon;
revoke all on function public.coach_std_save(smallint, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.coach_growth_me(text) from public, anon;
revoke all on function public.coach_growth_start(uuid, date) from public, anon;
revoke all on function public.coach_observe_save(uuid, date, smallint, jsonb, text, text, text, smallint) from public, anon;
revoke all on function public.coach_observe_seen(uuid[]) from public, anon;
revoke all on function public.coach_observe_delete(uuid) from public, anon;
revoke all on function public.coach_growth_review(uuid, text, text) from public, anon;

grant execute on function public.coach_std_list() to authenticated;
grant execute on function public.coach_std_save(smallint, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.coach_growth_me(text) to authenticated;
grant execute on function public.coach_growth_start(uuid, date) to authenticated;
grant execute on function public.coach_observe_save(uuid, date, smallint, jsonb, text, text, text, smallint) to authenticated;
grant execute on function public.coach_observe_seen(uuid[]) to authenticated;
grant execute on function public.coach_observe_delete(uuid) to authenticated;
grant execute on function public.coach_growth_review(uuid, text, text) to authenticated;
