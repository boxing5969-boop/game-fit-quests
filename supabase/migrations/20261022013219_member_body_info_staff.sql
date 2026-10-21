-- 관리자 · 지점장이 회원 내정보를 볼 때도 회원이 넣은 키 · 몸무게 · 복싱 시간을 그대로 (2026-10-22 대표님)
--   "안내 문구를 아예 넣지 말자" — 입력창의 '나만 볼 수 있어요'를 빼고, 회원 상세 '내정보' 탭 숫자가 회원 화면과 같게.
--   · member_body_info_for(uid, since): 화면용 값 한 곳 (get_my_body_info 와 같은 모양) — since 가 있으면 그 뒤에 저장한 값만
--   · get_my_body_info(): 본인 — 전부 (그대로)
--   · get_member_body_info(p_user_id): 관리자 · 같은 지점 지점장(get_attendance_history 와 같은 범위)
--       '나만 볼 수 있어요' 안내를 보고 넣은 값은 보여 주지 않는다 — app_settings 'body_info_staff_since'(문구를 뺀 앱이
--       올라간 시각) 이후에 저장한 값만. 설정이 없으면 아무것도 안 보인다.

create or replace function public.member_body_info_for(_uid uuid, _since timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (
    select * from public.member_body_logs
     where user_id = _uid and (_since is null or updated_at >= _since)
  )
  select jsonb_build_object(
    'height_cm', (select b.height_cm from b where b.height_cm is not null order by b.measured_on desc limit 1),
    'height_on', (select b.measured_on from b where b.height_cm is not null order by b.measured_on desc limit 1),
    'weight_kg', (select b.weight_kg from b where b.weight_kg is not null order by b.measured_on desc limit 1),
    'weight_on', (select b.measured_on from b where b.weight_kg is not null order by b.measured_on desc limit 1),
    'first_weight_kg', (select b.weight_kg from b where b.weight_kg is not null order by b.measured_on asc limit 1),
    'first_weight_on', (select b.measured_on from b where b.weight_kg is not null order by b.measured_on asc limit 1),
    'count', (select count(*)::int from b),
    'session_minutes', (select s.session_minutes from public.member_workout_settings s
                         where s.user_id = _uid and (_since is null or s.updated_at >= _since))
  )
$$;
revoke all on function public.member_body_info_for(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.get_my_body_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return public.member_body_info_for(v_uid, null);
end;
$$;
revoke all on function public.get_my_body_info() from public, anon;
grant execute on function public.get_my_body_info() to authenticated;

create or replace function public.get_member_body_info(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_since timestamptz;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'member_required' using errcode = '22023'; end if;
  if p_user_id <> v_me
     and not (public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') or public.is_same_branch(p_user_id)) then
    raise exception '지점장 · 관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  if p_user_id = v_me then
    return public.member_body_info_for(v_me, null);
  end if;
  select (value->>'since')::timestamptz into v_since from public.app_settings where key = 'body_info_staff_since';
  return public.member_body_info_for(p_user_id, coalesce(v_since, 'infinity'::timestamptz));
end;
$$;
revoke all on function public.get_member_body_info(uuid) from public, anon;
grant execute on function public.get_member_body_info(uuid) to authenticated;
