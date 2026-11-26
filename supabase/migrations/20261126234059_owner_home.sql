-- 관장님 홈 숫자 네 칸 — 지도자 홈 맨 위 (2026-11-26 대표님 「추천대로」 · 선릉역점만 · docs/features/69)
--   재등록률(전체) · 출석률 · 유효 회원 · 이번 달 매출 + 오늘 할 일 세 줄. 관장 · 지점장 · 본사만(코치 · 회원은 꺼짐).
--   숫자는 153OS 에서 계산해 숫자만 저장한다(이름 · 전화 없음):
--     · 출석 · 유효 회원 · 매출 · 할 일 = 153OS owner_home_kpi(사본 docs/os153/20261126233949_owner_home_kpi.sql)
--       → Edge Function leader-kpi(서버 키) → leader_owner_kpi(지금) · leader_owner_kpi_days(날마다 — 지난달 같은 날 비교용)
--     · 재등록률(전체) = leader-kpi 가 153OS registration_report 로 계산해 leader_kpi.payload.all 에(_shared/leaderKpi.ts)
--   매출은 본사 · 관장만. 지점장은 그 지점이 owner_sales_managers 에 있을 때만(관장이 켬 · 대표님 결정 3).
--   선릉의 관장 = 대표님(본사) — 다른 지점 관장 표시는 그 지점을 켤 때 더한다.

-- 1) 저장 표 — 서버(service_role)만 쓴다. 읽기는 아래 함수로만.
create table if not exists public.leader_owner_kpi (
  branch_name text primary key,
  payload jsonb not null,
  computed_at timestamptz not null default now()
);
create table if not exists public.leader_owner_kpi_days (
  branch_name text not null,
  day date not null,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (branch_name, day)
);
alter table public.leader_owner_kpi enable row level security;
alter table public.leader_owner_kpi_days enable row level security;
revoke all on public.leader_owner_kpi from anon, authenticated;
revoke all on public.leader_owner_kpi_days from anon, authenticated;
grant all on public.leader_owner_kpi to service_role;
grant all on public.leader_owner_kpi_days to service_role;

-- 2) 설정 — 지도자 홈 설정에 칸만 더한다(있는 값은 그대로)
update public.app_settings s
   set value = jsonb_build_object(
                 'owner_branches', coalesce(s.value -> 'branches', '[]'::jsonb),
                 'owner_sales_managers', '[]'::jsonb,
                 'attendance_target', 80,
                 'owner_stale_minutes', 15
               ) || s.value
               || case when coalesce(s.value ->> 'note', '') like '%owner_branches%' then '{}'::jsonb
                       else jsonb_build_object('note', coalesce(s.value ->> 'note', '')
                         || ' · 관장님 숫자(2026-11-26 대표님 「추천대로」): owner_branches = 관장님 숫자 켠 지점 · owner_sales_managers = 지점장도 매출을 보는 지점(관장이 켬) · attendance_target = 출석률 목표(%) · owner_stale_minutes = 관장님 숫자 다시 계산 간격(분).')
                  end
 where s.key = 'leader_home';

-- 3) 읽기 — 관장 · 지점장 · 본사만. 매출은 권한에 따라 뺀다.
create or replace function public.leader_owner_home(p_branch text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  c jsonb := public._leader_conf();
  v_branches jsonb := coalesce(c -> 'branches', '[]'::jsonb);
  v_owner_on jsonb := coalesce(c -> 'owner_branches', c -> 'branches', '[]'::jsonb);
  v_hq boolean;
  v_role text;
  v_branch text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_sales boolean;
  v_stale integer := greatest(5, coalesce((c ->> 'owner_stale_minutes')::integer, 15));
  v_kstale integer := greatest(1, coalesce((c ->> 'kpi_stale_hours')::integer, 6));
  v_owner jsonb;
  v_owner_at timestamptz;
  v_renew jsonb;
  v_renew_at timestamptz;
  v_ago jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_hq := public._strategy_hq(v_me);
  if v_hq then
    v_role := 'admin';
    v_branch := coalesce(
      nullif(trim(p_branch), ''),
      (select p.branch_name from public.profiles p where p.user_id = v_me and public._leader_branch_on(p.branch_name)),
      (select x from jsonb_array_elements_text(v_branches) x limit 1)
    );
  else
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null
       or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me)
       or not public.has_role(v_me, 'branch_manager') then
      return jsonb_build_object('on', false, 'role', 'none');
    end if;
    v_role := 'manager';
  end if;
  if not public._leader_branch_on(v_branch)
     or not exists (select 1 from jsonb_array_elements_text(v_owner_on) x where x = v_branch) then
    return jsonb_build_object('on', false, 'role', v_role, 'branch', v_branch);
  end if;

  v_sales := v_role = 'admin'
          or exists (select 1 from jsonb_array_elements_text(coalesce(c -> 'owner_sales_managers', '[]'::jsonb)) x where x = v_branch);

  select k.payload, k.computed_at into v_owner, v_owner_at
    from public.leader_owner_kpi k where k.branch_name = v_branch;
  if v_owner is not null and not v_sales then
    v_owner := v_owner - 'sales';
  end if;

  select k.payload -> 'all', k.computed_at into v_renew, v_renew_at
    from public.leader_kpi k where k.branch_name = v_branch;

  select jsonb_build_object(
           'day', d.day,
           'active', d.payload -> 'members' -> 'active',
           'att_rate', d.payload -> 'attendance' -> 'rate')
    into v_ago
    from public.leader_owner_kpi_days d
   where d.branch_name = v_branch and d.day between v_today - 33 and v_today - 28
   order by abs(d.day - (v_today - 30)), d.day desc
   limit 1;

  return jsonb_build_object(
    'on', true,
    'role', v_role,
    'branch', v_branch,
    'today', v_today,
    'sales_visible', v_sales,
    'conf', jsonb_build_object(
      'attendance_target', greatest(1, least(100, coalesce((c ->> 'attendance_target')::integer, 80))),
      'stale_minutes', v_stale),
    'owner', v_owner,
    'owner_at', v_owner_at,
    'owner_stale', v_owner_at is null or v_owner_at < now() - make_interval(mins => v_stale),
    'renew', v_renew,
    'renew_at', v_renew_at,
    'renew_stale', v_renew_at is null or v_renew is null or v_renew_at < now() - make_interval(hours => v_kstale),
    'month_ago', v_ago
  );
end
$function$;

revoke all on function public.leader_owner_home(text) from public, anon;
grant execute on function public.leader_owner_home(text) to authenticated, service_role;

-- 4) 자기 시험 — 로그인 없이 부르면 막혀야 한다
do $$
begin
  begin
    perform public.leader_owner_home(null);
    raise exception 'self-test: leader_owner_home ran without login';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
