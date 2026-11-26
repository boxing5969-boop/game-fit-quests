-- 관장님 앱 ③ AI 관장 모드 — 오삼코치(chat-assistant)가 153OS 숫자를 꺼내 쓰는 범위 · 하루 한도 (2026-11-27 대표님 「다음가지」 · docs/features/69)
--   관장 · 지점장 · 본사이고 관장 모드를 켠 지점(leader_home.owner_ai_branches · 선릉역점부터)일 때만 도구를 준다. 회원 · 코치는 지금 오삼코치 그대로.
--   숫자를 읽는 질문은 지점마다 하루 50번(leader_home.owner_ai_daily · 결정 7 · 넘으면 다음 날) — 도구를 처음 쓸 때 한 번 센다.
--   매출은 본사 · (owner_sales_managers 에 든 지점의) 지점장만 — 관장님 홈 leader_owner_home 과 같은 판정.

-- 1) 설정 — 있는 값은 그대로, 칸만 더한다
update public.app_settings s
   set value = jsonb_build_object('owner_ai_branches', coalesce(s.value -> 'crm_branches', '[]'::jsonb), 'owner_ai_daily', 50) || s.value
               || case when coalesce(s.value ->> 'note', '') like '%owner_ai_branches%' then '{}'::jsonb
                       else jsonb_build_object('note', coalesce(s.value ->> 'note', '')
                         || ' · AI 관장 모드(2026-11-27 대표님 「다음가지」): owner_ai_branches = 오삼코치가 153OS 숫자를 꺼내 쓰는 지점(관장 · 지점장 · 본사만) · owner_ai_daily = 지점마다 하루 숫자 질문 한도(50).')
                  end
 where s.key = 'leader_home';

-- 2) 하루 쓴 횟수 — 서버(service_role)만
create table if not exists public.owner_ai_usage (
  branch_name text not null,
  day date not null,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_name, day)
);
alter table public.owner_ai_usage enable row level security;
revoke all on public.owner_ai_usage from anon, authenticated;
grant all on public.owner_ai_usage to service_role;

-- 3) 범위 — 본사(super_admin · admin)는 켠 지점(내 지점 먼저) · 지점장은 자기 지점(그 지점 지도진 명단에 있을 때)만
create or replace function public.owner_ai_scope(p_branch text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  c jsonb := public._leader_conf();
  v_on jsonb := coalesce(c -> 'owner_ai_branches', '[]'::jsonb);
  v_daily integer := greatest(0, coalesce((c ->> 'owner_ai_daily')::integer, 50));
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_role text;
  v_branch text;
  v_used integer;
  v_sales boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public._strategy_hq(v_me) then
    v_role := 'admin';
    v_branch := coalesce(
      (select x from jsonb_array_elements_text(v_on) x where x = nullif(trim(p_branch), '') limit 1),
      (select p.branch_name from public.profiles p
        where p.user_id = v_me and exists (select 1 from jsonb_array_elements_text(v_on) x where x = p.branch_name)),
      (select x from jsonb_array_elements_text(v_on) x limit 1)
    );
    if v_branch is null then
      return jsonb_build_object('on', false, 'role', v_role);
    end if;
  else
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null
       or not public.has_role(v_me, 'branch_manager')
       or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me) then
      return jsonb_build_object('on', false, 'role', 'none');
    end if;
    v_role := 'manager';
    if not exists (select 1 from jsonb_array_elements_text(v_on) x where x = v_branch) then
      return jsonb_build_object('on', false, 'role', v_role, 'branch', v_branch);
    end if;
  end if;
  v_sales := v_role = 'admin'
             or exists (select 1 from jsonb_array_elements_text(coalesce(c -> 'owner_sales_managers', '[]'::jsonb)) x where x = v_branch);
  select u.used into v_used from public.owner_ai_usage u where u.branch_name = v_branch and u.day = v_today;
  return jsonb_build_object(
    'on', true, 'role', v_role, 'branch', v_branch, 'sales_visible', v_sales,
    'daily', v_daily, 'used', coalesce(v_used, 0), 'left', greatest(0, v_daily - coalesce(v_used, 0)), 'today', v_today);
end
$function$;

revoke all on function public.owner_ai_scope(text) from public, anon;
grant execute on function public.owner_ai_scope(text) to authenticated, service_role;

-- 4) 숫자 질문 한 번 쓰기 — 한도 안이면 1 올리고 ok, 넘으면 ok:false (서버만 · 동시에 와도 한 줄씩)
create or replace function public.owner_ai_take(p_branch text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c jsonb := public._leader_conf();
  v_daily integer := greatest(0, coalesce((c ->> 'owner_ai_daily')::integer, 50));
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_used integer;
begin
  if coalesce(trim(p_branch), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_branch');
  end if;
  insert into public.owner_ai_usage as u (branch_name, day, used)
  values (p_branch, v_today, 1)
  on conflict (branch_name, day) do update
    set used = u.used + 1, updated_at = now()
    where u.used < v_daily
  returning u.used into v_used;
  if v_used is null then
    select u.used into v_used from public.owner_ai_usage u where u.branch_name = p_branch and u.day = v_today;
    return jsonb_build_object('ok', false, 'used', coalesce(v_used, v_daily), 'daily', v_daily, 'left', 0);
  end if;
  if v_used > v_daily then
    -- 한도가 0 인데 첫 줄이 들어간 경우 — 되돌린다
    update public.owner_ai_usage set used = v_daily where branch_name = p_branch and day = v_today;
    return jsonb_build_object('ok', false, 'used', v_daily, 'daily', v_daily, 'left', 0);
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'daily', v_daily, 'left', greatest(0, v_daily - v_used));
end
$function$;

revoke all on function public.owner_ai_take(text) from public, anon, authenticated;
grant execute on function public.owner_ai_take(text) to service_role;

-- 5) 자기 시험 — 로그인 없이 범위를 물으면 막힘 · 한도 세기는 되돌려지는 시험 줄로(끝에 지움)
do $$
declare
  r jsonb;
  i integer;
begin
  begin
    perform public.owner_ai_scope(null);
    raise exception 'self-test: owner_ai_scope ran without login';
  exception when insufficient_privilege then
    null;
  end;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(public._leader_conf() -> 'owner_ai_branches', '[]'::jsonb)) x
                  where x = '153복싱짐 선릉역점') then
    raise exception 'self-test: owner_ai_branches 에 선릉역점이 없다';
  end if;
  for i in 1..50 loop
    r := public.owner_ai_take('__self_test__');
    if (r ->> 'ok')::boolean is distinct from true then
      raise exception 'self-test: % 번째가 막힘 %', i, r;
    end if;
  end loop;
  r := public.owner_ai_take('__self_test__');
  if (r ->> 'ok')::boolean then
    raise exception 'self-test: 51 번째가 통과됨 %', r;
  end if;
  delete from public.owner_ai_usage where branch_name = '__self_test__';
end
$$;
