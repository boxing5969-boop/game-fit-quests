-- 회원관리 '신체 정보 넣음' 필터 (2026-10-28 대표님 "회원님들이 신체정보 입력했는지 안했는지 내가 확인할수는 없나?")
--
-- get_body_info_entered() — 키 또는 몸무게를 넣은 회원 목록(누가 · 마지막으로 넣은 때 · 키/몸무게 여부), 값은 주지 않는다
--   보는 사람: get_member_body_info 와 같다 — 전체관리자 · 관리자 = 전 지점, 지점장 = 자기 지점 (코치는 아님)
--   '나만 볼 수 있어요' 안내를 보고 넣은 값(app_settings.body_info_staff_since 전)은 세지 않는다 — 회원 내정보와 같은 약속
--   화면: 회원관리(BranchManagerHome) 필터 '신체 정보 넣음 (N)' · 회원 줄 '신체 정보' 표시
-- 새 함수만 더한다 — 기존 함수 동작은 그대로.

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
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  v_all := public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin');
  if not v_all then
    if not public.has_role(v_me, 'branch_manager') then
      raise exception '지점장 · 관리자만 볼 수 있어요' using errcode = '42501';
    end if;
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null then
      return jsonb_build_object('rows', '[]'::jsonb);
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

  return jsonb_build_object('rows', v_rows);
end $function$;

revoke all on function public.get_body_info_entered() from public, anon;
grant execute on function public.get_body_info_entered() to authenticated;
