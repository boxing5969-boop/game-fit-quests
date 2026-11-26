-- 관장님 앱 ② 153OS CRM 보기 — 153운영본부 「CRM」 탭 (2026-11-27 대표님 「다음가자」 · 선릉역점만 · docs/features/69)
--   회원 · 고객 · 할 일을 읽기만 한다(쓰기는 ④). 관장 · 지점장 · 본사만(코치 · 회원은 꺼짐).
--   회원 정보는 앱 DB 에 저장하지 않는다 — Edge Function os-crm 이 이 함수로 범위를 확인한 뒤
--   153OS crm_members · crm_member_card · crm_customers(사본 docs/os153/20261127002838_owner_crm.sql)를 서버 키로 불러 그대로 넘긴다.
--   회원 카드(전화 전체 · 결제)를 연 기록만 crm_access_log 에 남긴다(누가 · 언제 · 어느 지점 · 어느 회원 id — 이름 · 전화 없음).

-- 1) 설정 — 지도자 홈 설정에 칸만 더한다(있는 값은 그대로) · crm_branches = CRM 켠 지점
update public.app_settings s
   set value = jsonb_build_object('crm_branches', coalesce(s.value -> 'owner_branches', '[]'::jsonb)) || s.value
               || case when coalesce(s.value ->> 'note', '') like '%crm_branches%' then '{}'::jsonb
                       else jsonb_build_object('note', coalesce(s.value ->> 'note', '')
                         || ' · 153OS CRM(2026-11-27 대표님 「다음가자」): crm_branches = 153운영본부 「CRM」 탭을 켠 지점(관장 · 지점장 · 본사만 · 읽기만).')
                  end
 where s.key = 'leader_home';

-- 2) 회원 카드 열람 기록 — 서버(service_role)만 쓴다
create table if not exists public.crm_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid not null,
  role text not null,
  branch_name text not null,
  action text not null,
  member_id uuid
);
create index if not exists crm_access_log_branch_at on public.crm_access_log (branch_name, at desc);
alter table public.crm_access_log enable row level security;
revoke all on public.crm_access_log from anon, authenticated;
grant all on public.crm_access_log to service_role;

-- 3) 범위 — 본사(super_admin · admin)는 켠 지점 모두 · 지점장은 자기 지점(그 지점 지도진 명단에 있을 때)만
create or replace function public.crm_scope(p_branch text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  c jsonb := public._leader_conf();
  v_on jsonb := coalesce(c -> 'crm_branches', '[]'::jsonb);
  v_branch text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public._strategy_hq(v_me) then
    v_branch := coalesce(
      (select x from jsonb_array_elements_text(v_on) x where x = nullif(trim(p_branch), '') limit 1),
      (select p.branch_name from public.profiles p
        where p.user_id = v_me and exists (select 1 from jsonb_array_elements_text(v_on) x where x = p.branch_name)),
      (select x from jsonb_array_elements_text(v_on) x limit 1)
    );
    if v_branch is null then
      return jsonb_build_object('on', false, 'role', 'admin');
    end if;
    return jsonb_build_object('on', true, 'role', 'admin', 'branch', v_branch, 'branches', v_on, 'full_phone', true);
  end if;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  if v_branch is null
     or not public.has_role(v_me, 'branch_manager')
     or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me) then
    return jsonb_build_object('on', false, 'role', 'none');
  end if;
  if not exists (select 1 from jsonb_array_elements_text(v_on) x where x = v_branch) then
    return jsonb_build_object('on', false, 'role', 'manager', 'branch', v_branch);
  end if;
  return jsonb_build_object('on', true, 'role', 'manager', 'branch', v_branch, 'branches', jsonb_build_array(v_branch), 'full_phone', true);
end
$function$;

revoke all on function public.crm_scope(text) from public, anon;
grant execute on function public.crm_scope(text) to authenticated, service_role;

-- 4) 자기 시험 — 로그인 없이 부르면 막혀야 한다 · 설정에 선릉이 켜져 있어야 한다
do $$
begin
  begin
    perform public.crm_scope(null);
    raise exception 'self-test: crm_scope ran without login';
  exception when insufficient_privilege then
    null;
  end;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(public._leader_conf() -> 'crm_branches', '[]'::jsonb)) x
                  where x = '153복싱짐 선릉역점') then
    raise exception 'self-test: crm_branches 에 선릉역점이 없다';
  end if;
end
$$;
