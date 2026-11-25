-- ============================================================
-- 얼굴 출석 키오스크 — [퇴장] 버튼으로 운동 시간 저장 (2026-11-25)
--   대표님 11/25 17:42 「10초 자동출석으로 하자 나갈때 퇴장없이 가는사람은 한시간운동으로 처리하자
--   퇴장 버튼을 누른사람만 모든 운동 시간 기록하고」
--
-- 1) 새 함수 kiosk_finish_workout(p_user_id) — 키오스크 [퇴장]. face-kiosk Edge Function(서비스 키)만 부른다.
--    오늘(KST) 그날 첫 정식 출석을 지금 시각으로 닫고, '운동 종료' 버튼(finish_workout_session)과 같은 규칙으로
--    운동 시간(workout_minutes)과 XP(workout_xp — 이미 받은 만큼 빼고 남는 만큼만)를 정산한다. ended_source = 'kiosk_exit'.
--    · 회원이 앱에서 직접 남긴 끝(member_app 운동 종료 · member_fix 시간 고침)이 있으면 그대로 둔다(already_finished).
--    · 두 번째 체크(checkout_scan)나 앞서 누른 퇴장(kiosk_exit)은 지금 시각으로 다시 닫는다 —
--      퇴장을 일찍 잘못 눌렀어도 나갈 때 다시 누르면 고쳐진다. XP 는 차액만이라 두 번 받지 않는다.
--    · 퇴장을 안 누르고 간 날은 아무것도 바뀌지 않는다 → 기본 운동 시간(workout_default_minutes, 지금 66분).
-- 2) attendance_checkout_scan_trg — 퇴장(kiosk_exit)으로 닫힌 날은 두 번째 체크가 덮지 않는다(운동 종료 버튼과 같다).
--    본문은 2026-11-25 운영 DB 정의 그대로에 그 한 줄만 바꿨다.
-- ============================================================

create or replace function public.kiosk_finish_workout(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _today     date := (now() at time zone 'Asia/Seoul')::date;
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _src       text;
  _xp_before int;
  _minutes   int;
  _xp        int;
  _eligible  boolean;
begin
  if p_user_id is null then
    return jsonb_build_object('success', false, 'code', 'BAD_INPUT');
  end if;

  -- 오늘의 정식 출석 한 건(가장 이른 것 = 실제 입장). 잠가서 두 번 눌러도 한 번씩 차례로 정산한다.
  select id, checked_in_at, ended_at, ended_source, coalesce(xp_granted, 0)
    into _id, _started, _ended, _src, _xp_before
    from public.attendance_logs
   where user_id = p_user_id
     and coalesce(is_duplicate, false) = false
     and (checked_in_at at time zone 'Asia/Seoul')::date = _today
   order by checked_in_at asc
   limit 1
   for update;

  if _id is null then
    return jsonb_build_object('success', false, 'code', 'NO_ATTENDANCE');
  end if;

  -- 회원이 앱에서 직접 남긴 끝(운동 종료 버튼 · 시간 고침)이 이긴다
  if _ended is not null and _src in ('member_app', 'member_fix') then
    return jsonb_build_object('success', true, 'already_finished', true, 'source', _src,
      'started_at', _started, 'ended_at', _ended,
      'minutes', public.workout_minutes(_started, _ended), 'xp_granted', 0);
  end if;

  _ended := now();
  update public.attendance_logs
     set ended_at = _ended,
         ended_source = 'kiosk_exit'
   where id = _id;

  _minutes := public.workout_minutes(_started, _ended);
  _xp := greatest(0, public.workout_xp(_minutes) - _xp_before);

  -- XP 대상은 운동 종료 버튼과 같다: 직원 · member_progress 없는 계정은 0
  select exists (select 1 from public.member_progress m where m.user_id = p_user_id)
         and not coalesce((select p.is_staff from public.profiles p where p.user_id = p_user_id), false)
    into _eligible;
  if not _eligible then
    _xp := 0;
  end if;

  if _xp > 0 then
    insert into public.xp_logs (user_id, amount, reason)
    values (p_user_id, _xp, '운동시간 ' || _minutes || '분 기록 (퇴장)');
    update public.member_progress
       set total_xp = total_xp + _xp
     where user_id = p_user_id;
    update public.attendance_logs
       set xp_granted = _xp_before + _xp
     where id = _id;
  end if;

  return jsonb_build_object('success', true, 'already_finished', false, 'source', 'kiosk_exit',
    'started_at', _started, 'ended_at', _ended, 'minutes', _minutes, 'xp_granted', _xp);
end;
$function$;

revoke all on function public.kiosk_finish_workout(uuid) from public, anon, authenticated;
grant execute on function public.kiosk_finish_workout(uuid) to service_role;

-- 두 번째 체크 트리거 — 2026-11-25 운영 정의 그대로 + 퇴장(kiosk_exit) 우선 한 줄
create or replace function public.attendance_checkout_scan_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _src       text;
  _xp_before int;
  _minutes   int;
  _xp        int;
  _eligible  boolean;
begin
  if new.user_id is null or new.checked_in_at is null then return null; end if;
  if not coalesce(new.is_duplicate, false) then return null; end if;
  -- 늦게 옮겨 오는 옛 기록(동기화 지연 · 되살리기)으로 지난 날을 바꾸지 않는다
  if new.checked_in_at < now() - interval '1 day' then return null; end if;

  begin
    select id, checked_in_at, ended_at, ended_source, coalesce(xp_granted, 0)
      into _id, _started, _ended, _src, _xp_before
      from public.attendance_logs
     where user_id = new.user_id
       and coalesce(is_duplicate, false) = false
       and (checked_in_at at time zone 'Asia/Seoul')::date = (new.checked_in_at at time zone 'Asia/Seoul')::date
     order by checked_in_at asc
     limit 1
     for update;

    if _id is null then return null; end if;
    -- 들어오자마자 다시 찍은 것 — 기본 시간보다 짧으면 어차피 기본으로 치니 운동 끝으로 쓰지 않는다
    if new.checked_in_at - _started < make_interval(mins => public.workout_default_minutes()) then return null; end if;
    if new.checked_in_at - _started > interval '3 hours' then return null; end if;
    -- '운동 종료' 버튼 · 키오스크 [퇴장](2026-11-25)을 먼저 눌렀으면 그 기록이 우선
    if _src in ('member_app', 'kiosk_exit') then return null; end if;
    if _ended is not null and _ended >= new.checked_in_at then return null; end if;

    update public.attendance_logs
       set ended_at = new.checked_in_at,
           ended_source = 'checkout_scan'
     where id = _id;

    -- XP — '운동 종료' 버튼(finish_workout_session)과 같은 규칙: 이미 받은 만큼 빼고 남는 만큼만
    _minutes := public.workout_minutes(_started, new.checked_in_at);
    _xp := greatest(0, public.workout_xp(_minutes) - _xp_before);
    select exists (select 1 from public.member_progress m where m.user_id = new.user_id)
           and not coalesce((select p.is_staff from public.profiles p where p.user_id = new.user_id), false)
      into _eligible;
    if _xp > 0 and _eligible then
      insert into public.xp_logs (user_id, amount, reason)
      values (new.user_id, _xp, '운동시간 ' || _minutes || '분 기록 (두 번째 체크)');
      update public.member_progress set total_xp = total_xp + _xp where user_id = new.user_id;
      update public.attendance_logs set xp_granted = _xp_before + _xp where id = _id;
    end if;
  exception when others then
    raise warning 'attendance_checkout_scan: %', sqlerrm;
  end;
  return null;
end;
$function$;
