-- 풀파워 검수 후속 수정 (2026-09-22 밤)
--
-- 1. 권한: Supabase 기본 ACL(pg_default_acl) 이 public 스키마의 새 함수에 authenticated EXECUTE 를
--    자동으로 준다. `revoke … from public` 은 PUBLIC 항목만 지우므로 내부 함수가 REST 로 노출돼 있었다.
--    → 내부 함수는 anon/authenticated 에서 명시적으로 회수한다.
--      · _board_qr_token_for : 로그인 회원이 직접 토큰을 계산해 원격 출석 가능했음
--      · attendance_base_xp_trg : 트리거 함수(위생)
--      · _grant_hof_reward_once : period_key 임의 지정으로 젬 무제한 적립 가능했음 (호출자 검사 없음)
--      · create_notification : 타인에게 임의 알림 삽입 가능했음
--      · record_training_session : anon(PUBLIC) 회수
-- 2. record_training_session 이 검증 없는 attendance_logs 행(method='app')을 만들던 것을 제거 —
--    출석은 문(브로제이)·얼굴 키오스크·보드 QR 로만 생긴다. 훈련 세션(activity_sessions)은 그대로.
-- 3. 출석 기본 XP 트리거는 method 화이트리스트(broj·face·qr_manual)에만.
-- 4. 같은 회원·같은 KST 날짜의 비중복 행은 DB 가 보장한다(BEFORE INSERT 가드 + advisory lock) —
--    동기화(5분)와 QR 이 같은 순간 겹쳐도 두 번째 행은 is_duplicate=true 가 된다.
-- 5. QR 출석이 승급을 만들면 그 행이 다음 레벨 진행량에 또 들어가던 누수(같은 트랜잭션의 now() 동일값)
--    → 승급 시 level_started_at 을 now() 보다 엄격히 뒤로.
-- 6. cancel_checkin: 외부 동기화·QR 행(source_ref 있음)도 이제 XP 5 를 갖는다 → 숨길 때 회수.
-- 7. profiles 자기 행 UPDATE 로 is_staff/staff_title/membership_end/payment_total 등을 바꿀 수 있던 것을 가드.
-- 8. finish_workout_session: 직원·member_progress 없는 계정은 세션만 닫고 XP 없음 (트리거와 같은 기준).

-- ── 1. 권한 회수 ─────────────────────────────────────────────────────────────
revoke execute on function public._board_qr_token_for(text, bigint) from public, anon, authenticated;
revoke execute on function public.attendance_base_xp_trg() from public, anon, authenticated;
revoke execute on function public._grant_hof_reward_once(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_notification(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.record_training_session(uuid, integer) from public, anon;
grant execute on function public.record_training_session(uuid, integer) to authenticated;

-- ── 2. record_training_session: 출석 행 생성 제거 ───────────────────────────
create or replace function public.record_training_session(_routine_id uuid default null::uuid, _minutes integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _mins int := greatest(5, least(300, coalesce(_minutes, 50)));
  _branch text;
begin
  if _uid is null then raise exception 'no user'; end if;
  select branch_name into _branch from profiles where user_id = _uid;

  -- 훈련시간(완료 세션 — 라이브보드 active 아님)
  insert into activity_sessions (user_id, branch_name, status, started_at, ended_at)
  values (_uid, coalesce(_branch, ''), 'completed', now() - (_mins * interval '1 minute'), now());

  -- 출석은 여기서 만들지 않는다 (2026-09-22): 문·얼굴 키오스크·보드 QR 만 출석이다.
  -- 예전엔 오늘 비중복 출석이 없으면 method='app' 행을 넣어 승급 카운트·XP·라이브보드에 잡혔다.
  return get_level_cycle_progress(_uid);
end $function$;

-- ── 3. 기본 XP 트리거 — method 화이트리스트 ─────────────────────────────────
drop trigger if exists attendance_base_xp on public.attendance_logs;
create trigger attendance_base_xp
after insert on public.attendance_logs
for each row
when (new.is_duplicate is not true and new.method in ('broj', 'face', 'qr_manual'))
execute function public.attendance_base_xp_trg();

-- ── 4. 같은 날 비중복 행 1개 보장 (BEFORE INSERT) ────────────────────────────
create or replace function public.attendance_same_day_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _day date;
begin
  if new.user_id is null or new.checked_in_at is null then return new; end if;
  if new.is_duplicate is true then return new; end if;

  _day := (new.checked_in_at at time zone 'Asia/Seoul')::date;
  -- 같은 회원·같은 날을 동시에 넣는 두 트랜잭션을 직렬화한다 (동기화 5분 크론 vs QR).
  perform pg_advisory_xact_lock(hashtext('att_day:' || new.user_id::text || ':' || _day::text));

  if exists (
    select 1 from public.attendance_logs a
     where a.user_id = new.user_id
       and coalesce(a.is_duplicate, false) = false
       and (a.checked_in_at at time zone 'Asia/Seoul')::date = _day
  ) then
    new.is_duplicate := true;
  end if;
  return new;
end;
$$;
revoke execute on function public.attendance_same_day_guard() from public, anon, authenticated;

drop trigger if exists attendance_same_day_guard on public.attendance_logs;
create trigger attendance_same_day_guard
before insert on public.attendance_logs
for each row
execute function public.attendance_same_day_guard();

-- ── 5. 승급 시각을 now() 보다 엄격히 뒤로 (QR 행 누수 차단) ──────────────────
CREATE OR REPLACE FUNCTION public.auto_advance_from_attendance(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _p record; _visits int; _promoted int := 0; _pending_boss boolean := false;
  _old level_status_type; _ls_id uuid; _guard int := 0;
  _req int; _min_days int; _elapsed int;
  -- 승급 시각: 같은 트랜잭션에서 방금 넣은 출석 행(checked_in_at = now())이
  -- 다음 레벨의 ">= level_started_at" 집계에 다시 들어가지 않도록 now() 보다 뒤로 잡는다.
  _started_at timestamptz := greatest(clock_timestamp(), now() + interval '1 microsecond');
begin
  if _user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  perform pg_advisory_xact_lock(hashtext('auto_advance:' || _user_id::text));

  loop
    _guard := _guard + 1; exit when _guard > 12;

    select * into _p from member_progress where user_id = _user_id;
    if not found then exit; end if;

    _req      := level_visit_requirement(_p.current_rank);
    _min_days := level_min_days(_p.current_rank);
    _elapsed  := greatest(0, floor(extract(epoch from
                   (now() - coalesce(_p.level_started_at, now() - interval '3650 days'))) / 86400))::int;

    -- 출석 "횟수" 가 아니라 "진행량" 을 센다.
    -- 운동시간이 길면 한 번이 최대 1.25회로 쌓인다(workout_progress).
    -- floor 를 쓰는 이유: 요건을 실제로 다 채워야 열린다. 4.75 는 5회가 아니다.
    select floor(coalesce(sum(
             public.workout_progress(
               public.workout_minutes(a.checked_in_at, a.ended_at))), 0))::int
      into _visits
    from attendance_logs a
    where a.user_id = _user_id
      and coalesce(a.is_duplicate, false) = false
      and a.checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');

    -- ── 레드·블랙: 승인 전용 (출석을 채워도 코치가 봐야 올라간다) ──────
    if not public.level_auto_advances(_p.current_rank) then
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      exit when _visits < _req or _elapsed < _min_days;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'pending',
              '출석 '||_req||'회 충족 — 코치 승인 대기 (레드·블랙은 승인 전용)')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending',
                    approval_note='출석 '||_req||'회 충족 — 코치 승인 대기 (레드·블랙은 승인 전용)',
                    updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'pending', _user_id,
              '출석 '||_req||'회 충족 — 승인 전용 리그 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '출석은 다 채웠어요! 이 리그부터는 코치님이 직접 보고 승급합니다.');
      _pending_boss := true;
      exit;
    end if;

    -- ── 화이트·블루: 출석 충족 시 자동 승급 ───────────────────────────
    if _p.current_level < 10 then
      exit when _visits < _req;

      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;

      insert into level_status (user_id, rank_name, level_number, status, completed_at, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'approved', now(), '출석 '||_req||'회 자동 승급')
      on conflict (user_id, rank_name, level_number)
      do update set status='approved', completed_at=now(), approval_note='출석 '||_req||'회 자동 승급', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'approved', _user_id, '출석 '||_req||'회 자동 승급');

      update member_progress
        set current_level = _p.current_level + 1, level_started_at = _started_at, updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 10, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 '||_req||'회를 채워 자동으로 승급했어요. XP +50, 💎 +10');

      _promoted := _promoted + 1;

      -- 방금 10레벨(타이틀매치)에 도달했다면 즉시 승급 심사를 연다.
      if _p.current_level + 1 = 10 then
        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_user_id, _p.current_rank, 10, 'pending', '10레벨 도달 — 승급 심사 자동 신청')
        on conflict (user_id, rank_name, level_number)
        do update set status='pending', approval_note='10레벨 도달 — 승급 심사 자동 신청', updated_at=now()
        returning id into _ls_id;

        insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
        values (_ls_id, _user_id, _p.current_rank, 10, 'locked', 'pending', _user_id, '10레벨 도달 자동 심사 신청');

        perform create_notification(_user_id, '승급 심사 대기 중 🥇',
          '타이틀매치에 도달했어요! 코치님이 승인하면 다음 리그로 갑니다.');
        _pending_boss := true;
        exit;
      end if;
    else
      -- 이미 10레벨: 심사가 걸려 있지 않다면 출석 충족 후 자동 신청
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=10;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      exit when _visits < _req;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, 10, 'pending', '출석 '||_req||'회 충족 — 자동 심사 신청')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending', approval_note='출석 '||_req||'회 충족 — 자동 심사 신청', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, 10, coalesce(_old,'locked'), 'pending', _user_id, '출석 '||_req||'회 자동 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '타이틀매치 출석을 다 채웠어요. 코치님 승인만 남았습니다!');
      _pending_boss := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', _promoted, 'pending_boss', _pending_boss);
end; $function$;

-- ── 6. cancel_checkin: source_ref 행도 XP 회수 ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_checkin(_log_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log attendance_logs%ROWTYPE;
  v_reverted_xp integer := 0;
  v_streak_reverted boolean := false;
BEGIN
  SELECT * INTO v_log FROM attendance_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'branch_manager'::app_role) AND is_same_branch(v_log.user_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_log.source_ref IS NOT NULL THEN
    -- 브로제이 등 외부 동기화 행: 삭제하면 다음 크론이 같은 원본을 재삽입한다(소생).
    -- 대신 중복 표시로 강등해 라이브보드·통계에서 제외한다.
    -- 2026-09-22 부터 이 행들도 기본 XP(5)를 가지므로 숨길 때 함께 회수한다.
    IF v_log.is_duplicate = false AND coalesce(v_log.xp_granted, 0) > 0 THEN
      v_reverted_xp := v_log.xp_granted;
      UPDATE member_progress
         SET total_xp = greatest(0, total_xp - v_reverted_xp)
       WHERE user_id = v_log.user_id;
      INSERT INTO xp_logs (user_id, amount, reason)
      VALUES (v_log.user_id, -v_reverted_xp, '체크인 취소 회수');
      INSERT INTO notifications (user_id, title, body)
      VALUES (v_log.user_id, '체크인이 취소되었습니다', '관리자가 출석을 취소해 XP가 회수되었습니다. 문의는 지점으로 부탁드려요.');
    END IF;
    UPDATE attendance_logs SET is_duplicate = true, xp_granted = 0 WHERE id = _log_id;
    RETURN jsonb_build_object('success', true, 'reverted_xp', v_reverted_xp, 'streak_reverted', false, 'mode', 'hidden');
  END IF;

  DELETE FROM attendance_logs WHERE id = _log_id;

  IF v_log.is_duplicate = false AND coalesce(v_log.xp_granted, 0) > 0 THEN
    v_reverted_xp := v_log.xp_granted;
    v_streak_reverted := true;

    UPDATE member_progress
    SET total_xp   = greatest(0, total_xp - v_reverted_xp),
        streak_days = greatest(0, streak_days - 1)
    WHERE user_id = v_log.user_id;

    INSERT INTO xp_logs (user_id, amount, reason)
    VALUES (v_log.user_id, -v_reverted_xp, '체크인 취소 회수');

    INSERT INTO notifications (user_id, title, body)
    VALUES (v_log.user_id, '체크인이 취소되었습니다', '관리자가 출석을 취소해 XP가 회수되었습니다. 문의는 지점으로 부탁드려요.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reverted_xp', v_reverted_xp,
    'streak_reverted', v_streak_reverted
  );
END;
$function$;

-- ── 7. profiles 특권 컬럼 가드 확장 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() 가 없으면 service_role/서버 경로(동기화·결제 콜백·자격 변경 함수) → 그대로.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin')
     OR public.has_role(auth.uid(), 'branch_manager') THEN
    RETURN NEW;
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     AND COALESCE(NEW.is_approved, false) = true THEN
    RAISE EXCEPTION '승인 상태는 직접 변경할 수 없습니다';
  END IF;
  -- 2026-09-22: 지도진 표기·이용권·결제 누적은 회원이 직접 바꿀 수 없다.
  IF NEW.is_staff IS DISTINCT FROM OLD.is_staff
     OR NEW.staff_title IS DISTINCT FROM OLD.staff_title
     OR NEW.membership_end IS DISTINCT FROM OLD.membership_end
     OR NEW.payment_total IS DISTINCT FROM OLD.payment_total
     OR NEW.must_change_credentials IS DISTINCT FROM OLD.must_change_credentials THEN
    RAISE EXCEPTION '이 항목은 직접 변경할 수 없습니다';
  END IF;
  -- 전화번호·등록일은 처음 채울 때만 (카톡/구글 가입 뒤 번호 입력 경로). 이후 변경은 데스크/연동 절차로.
  IF OLD.phone_number IS NOT NULL AND NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    RAISE EXCEPTION '전화번호는 직접 변경할 수 없습니다. 지점에 문의해 주세요';
  END IF;
  IF OLD.gym_reg_date IS NOT NULL AND NEW.gym_reg_date IS DISTINCT FROM OLD.gym_reg_date THEN
    RAISE EXCEPTION '등록일은 직접 변경할 수 없습니다';
  END IF;
  RETURN NEW;
END; $function$;

-- ── 8. finish_workout_session: 직원·member_progress 없는 계정은 XP 없음 ────────
create or replace function public.finish_workout_session(p_at_gym boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid       uuid := auth.uid();
  _today     date;
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _minutes   int;
  _xp_total  int;
  _xp_before int;
  _xp        int;
  _eligible  boolean;
begin
  if _uid is null then
    return jsonb_build_object('success', false, 'error', '로그인이 필요합니다.');
  end if;

  _today := (now() at time zone 'Asia/Seoul')::date;

  -- 오늘의 정식 출석 한 건. 여러 번 찍혔다면 가장 이른 것이 실제 입장이다.
  -- 오늘로 한정하는 것이 핵심 — 어제 열린 세션을 오늘 닫으면 24시간 기록이 나온다.
  select id, checked_in_at, ended_at, coalesce(xp_granted, 0)
    into _id, _started, _ended, _xp_before
  from public.attendance_logs
  where user_id = _uid
    and coalesce(is_duplicate, false) = false
    and (checked_in_at at time zone 'Asia/Seoul')::date = _today
  order by checked_in_at asc
  limit 1;

  if _id is null then
    return jsonb_build_object('success', false,
      'error', '오늘 출석 기록이 없습니다. 입구에서 얼굴 인식을 먼저 해주세요.');
  end if;

  if _ended is not null then
    return jsonb_build_object('success', true, 'already_finished', true,
      'minutes', public.workout_minutes(_started, _ended), 'xp_granted', 0);
  end if;

  -- ended_at is null 조건이 멱등키 역할을 한다. 동시에 두 번 눌려도 한 번만 닫히고
  -- 닫은 호출만 XP 를 받는다(xp_logs 에 멱등키 컬럼이 없어 이 방식을 쓴다).
  update public.attendance_logs
     set ended_at        = now(),
         ended_source    = 'member_app',
         at_gym_verified = p_at_gym
   where id = _id
     and ended_at is null;

  if not found then
    return jsonb_build_object('success', true, 'already_finished', true, 'xp_granted', 0);
  end if;

  select ended_at into _ended from public.attendance_logs where id = _id;
  _minutes  := public.workout_minutes(_started, _ended);
  _xp_total := public.workout_xp(_minutes);
  -- 출석 때 이미 받은 기본(50분치)을 빼고 남는 만큼만 — 50분 이하면 0.
  _xp       := greatest(0, _xp_total - _xp_before);

  -- 트리거(attendance_base_xp)와 같은 기준: 직원·member_progress 없는 계정은 XP 대상이 아니다.
  select exists (select 1 from public.member_progress m where m.user_id = _uid)
         and not coalesce((select p.is_staff from public.profiles p where p.user_id = _uid), false)
    into _eligible;
  if not _eligible then
    _xp := 0;
  end if;

  if _xp > 0 then
    insert into public.xp_logs (user_id, amount, reason)
    values (_uid, _xp, '운동시간 ' || _minutes || '분 기록 (추가)');
    update public.member_progress
       set total_xp = total_xp + _xp
     where user_id = _uid;
    update public.attendance_logs
       set xp_granted = _xp_before + _xp
     where id = _id;
  end if;

  return jsonb_build_object(
    'success', true, 'minutes', _minutes, 'xp_granted', _xp,
    'xp_total_today', _xp_before + _xp,
    'at_gym_verified', p_at_gym);
end;
$$;
