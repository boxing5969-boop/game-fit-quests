-- 지도진 관리 (2026-09-23)
--
-- 대표님 지시: 회원관리에서 코치진을 따로 보고 관리할 수 있게.
--   · profiles.staff_source — 지도진 지정 출처. '153os' = 153OS 직원 명단 동기화(sync-staff-to-app)가
--     지정한 사람, 'manual' = 관리자가 앱에서 직접 지정한 사람. 동기화는 '153os' 인 사람만 해제하고
--     'manual' 은 건드리지 않는다. 반대로 '153os' 인 사람은 앱에서 해제할 수 없다(153OS 에서 비활성 처리).
--   · set_staff_designation(_user_id, _is_staff, _title) — 관리자(super_admin·admin, 같은 지점 branch_manager)가
--     지도진 지정·직함 변경·해제를 하는 유일한 경로. profiles UPDATE 정책은 admin 에게만 있어서
--     super_admin 도 PostgREST 로는 직접 못 바꾼다 → RPC.
--   · get_branch_stats: "전체 회원" 에서 지도진을 뺀다(지도진은 회원 목록에서도 분리됨).

alter table public.profiles
  add column if not exists staff_source text;

alter table public.profiles drop constraint if exists profiles_staff_source_check;
alter table public.profiles
  add constraint profiles_staff_source_check check (staff_source is null or staff_source in ('153os', 'manual'));

comment on column public.profiles.staff_source is
  '지도진 지정 출처: 153os(153OS 직원 명단 동기화) | manual(관리자 수동 지정). null = 지도진 아님 또는 출처 미기록';

create or replace function public.set_staff_designation(_user_id uuid, _is_staff boolean, _title text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _p public.profiles%rowtype;
  _title_clean text := nullif(btrim(coalesce(_title, '')), '');
  _final_title text;
begin
  if _caller is null then
    raise exception '로그인이 필요합니다';
  end if;
  select * into _p from public.profiles where user_id = _user_id;
  if not found then
    raise exception '회원을 찾을 수 없습니다';
  end if;
  if not (public.has_role(_caller, 'super_admin') or public.has_role(_caller, 'admin')
          or (public.has_role(_caller, 'branch_manager') and public.is_same_branch(_user_id))) then
    raise exception '권한이 없습니다';
  end if;
  if length(coalesce(_title_clean, '')) > 20 then
    raise exception '직함은 20자 이내로 입력해 주세요';
  end if;

  if _is_staff then
    _final_title := coalesce(_title_clean, _p.staff_title, '코치');
    update public.profiles
       set is_staff = true,
           staff_title = _final_title,
           staff_source = coalesce(staff_source, 'manual'),
           membership_end = null,          -- 지도진 이용권은 무제한
           updated_at = now()
     where user_id = _user_id;
  else
    if _p.staff_source = '153os' then
      raise exception '153OS 직원 명단에 있는 지도진입니다. 153OS에서 비활성 처리하면 다음 정각에 자동 해제됩니다';
    end if;
    update public.profiles
       set is_staff = false,
           staff_title = null,
           staff_source = null,
           updated_at = now()
     where user_id = _user_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'user_id', _user_id, 'is_staff', _is_staff,
    'staff_title', case when _is_staff then _final_title else null end
  );
end;
$$;

revoke all on function public.set_staff_designation(uuid, boolean, text) from public, anon;
grant execute on function public.set_staff_designation(uuid, boolean, text) to authenticated;

-- "전체 회원" 은 지도진 제외 (회원 목록에서 지도진을 분리했으므로 숫자를 맞춘다)
CREATE OR REPLACE FUNCTION public.get_branch_stats(_branch_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_members int;
  _pending_count int;
  _weekly_levelups int;
  _today_submissions int;
BEGIN
  SELECT COUNT(*) INTO _total_members FROM profiles WHERE branch_name = _branch_name AND is_staff IS NOT TRUE;

  SELECT COUNT(*) INTO _pending_count
  FROM mission_submissions ms JOIN profiles p ON p.user_id = ms.user_id
  WHERE p.branch_name = _branch_name AND ms.status = 'pending';

  _pending_count := _pending_count + (
    SELECT COUNT(*) FROM quest_submissions qs JOIN profiles p ON p.user_id = qs.user_id
    WHERE p.branch_name = _branch_name AND qs.status::text = 'pending'
  );

  SELECT COUNT(*) INTO _weekly_levelups
  FROM xp_logs xl JOIN profiles p ON p.user_id = xl.user_id
  WHERE p.branch_name = _branch_name AND xl.created_at >= date_trunc('week', CURRENT_DATE)
    AND xl.reason LIKE '%레벨업%';

  SELECT COUNT(*) INTO _today_submissions
  FROM mission_submissions ms JOIN profiles p ON p.user_id = ms.user_id
  WHERE p.branch_name = _branch_name AND ms.requested_at::date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_members', _total_members, 'pending_count', _pending_count,
    'weekly_levelups', _weekly_levelups, 'today_submissions', _today_submissions
  );
END;
$function$;
