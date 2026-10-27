-- 회원관리 '신체 정보 안 넣음' 필터 (2026-10-28 01:05 대표님 "입력안한건 안보이나?")
--
-- get_body_info_entered() 에 missing 을 더한다 — 앱에 들어온 적 있는(auth.users.last_sign_in_at 있음) 승인된 일반 회원 중
--   키 · 몸무게를 아직 안 넣은 회원(user_id · 마지막 출석). 명단으로만 만들어지고 앱에 안 들어온 계정은 넣지 않는다
--   (선릉역점 계정 635개 중 앱 사용 40명 — 독려할 수 있는 사람만).
-- 보는 사람 · 공개 기준은 그대로(전체관리자 · 관리자 = 전 지점, 지점장 = 자기 지점 · body_info_staff_since 전 값은 안 넣은 것으로 친다).
-- rows(넣은 회원)는 그대로 — 화면이 예전 모양 그대로 읽어도 된다.

create or replace function public.get_body_info_entered()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := auth.uid();
  v_all boolean;
  v_branch text;
  v_since timestamptz;
  v_rows jsonb;
  v_missing jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  v_all := public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin');
  if not v_all then
    if not public.has_role(v_me, 'branch_manager') then
      raise exception '지점장 · 관리자만 볼 수 있어요' using errcode = '42501';
    end if;
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null then
      return jsonb_build_object('rows', '[]'::jsonb, 'missing', '[]'::jsonb);
    end if;
  end if;

  select (s.value->>'since')::timestamptz into v_since from public.app_settings s where s.key = 'body_info_staff_since';
  v_since := coalesce(v_since, 'infinity'::timestamptz);

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', x.user_id,
           'at', x.at,
           'height', x.has_h,
           'weight', x.has_w
         ) order by x.at desc), '[]'::jsonb)
    into v_rows
    from (
      select l.user_id,
             max(l.updated_at) as at,
             bool_or(l.height_cm is not null) as has_h,
             bool_or(l.weight_kg is not null) as has_w
        from public.member_body_logs l
        join public.profiles p on p.user_id = l.user_id
       where l.updated_at >= v_since
         and (l.height_cm is not null or l.weight_kg is not null)
         and (v_all or p.branch_name = v_branch)
       group by l.user_id
    ) x;

  -- 안 넣은 회원 — 앱에 들어온 적 있는 승인된 일반 회원만 (2026-10-28)
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', y.user_id,
           'came_at', y.came_at
         ) order by y.came_at desc nulls last), '[]'::jsonb)
    into v_missing
    from (
      select p.user_id,
             (select max(a.checked_in_at) from public.attendance_logs a
               where a.user_id = p.user_id and not coalesce(a.is_duplicate, false)) as came_at
        from auth.users au
        join public.profiles p on p.user_id = au.id
       where au.last_sign_in_at is not null
         and p.merged_into is null
         and coalesce(p.is_approved, false)
         and not coalesce(p.is_staff, false)
         and not coalesce(p.is_test_account, false)
         and (v_all or p.branch_name = v_branch)
         and public._dm_kind(p.user_id) = 'member'
         and not exists (select 1 from public.member_body_logs l
                          where l.user_id = p.user_id and l.updated_at >= v_since
                            and (l.height_cm is not null or l.weight_kg is not null))
    ) y;

  return jsonb_build_object('rows', v_rows, 'missing', v_missing);
end $function$;

revoke all on function public.get_body_info_entered() from public, anon;
grant execute on function public.get_body_info_entered() to authenticated;
