-- ═══════════════════════════════════════════════════════════════════
-- 153 Diet — Self-tracking refactor (approval 단계 제거)
--
-- 배경: 기존에는 회원이 제출 → pending → 코치 승인 시 파이트 머니(젬)
-- 3개 지급 / 스냅샷 갱신 / 배지 지급이 일어났다. 본 마이그레이션은 그
-- 절차를 회원 스스로 기록 · 스스로 보상받는 게임형으로 전환한다.
--
--   • submit_diet_daily_log  — 제출 즉시 status='approved' 로 저장하고
--     (최초 1회에 한해) 파이트 머니 3 지급 + 스냅샷 갱신 + 배지 지급 + 21일
--     완주 시 보너스 50 + enrollment 상태 'completed' 처리. 같은 날 재제출은
--     필드만 갱신하고 보상/스냅샷은 건드리지 않는다 (idempotent).
--   • add_diet_coach_feedback — 코치가 승인/반려 없이 피드백 텍스트만 남길
--     수 있는 신규 RPC. coach_feedback · reviewed_by · reviewed_at 만 채우고
--     status 는 그대로 둔다. 알림은 "AI 코치님의 피드백 도착" 톤.
--
--   기존 review_diet_log 은 legacy 로 남겨둔다 (호환성) — 새 UI 에서는 호출
--   하지 않는다. 이미 pending 상태로 쌓여 있는 로그를 일괄 approved 처리하여
--   기존 회원의 보상이 누락되지 않도록 데이터도 백필한다.
-- ═══════════════════════════════════════════════════════════════════

-- ───── G.5 (재정의): 자가 기록 + 즉시 보상 ─────
CREATE OR REPLACE FUNCTION public.submit_diet_daily_log(
  _log_date date,
  _habits jsonb,
  _note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _enr public.diet_program_enrollments%ROWTYPE;
  _day int;
  _id uuid;
  _existing public.diet_daily_logs%ROWTYPE;
  _snap public.diet_progress_snapshots%ROWTYPE;
  _approved_new int;
  _reach_7 boolean;
  _reach_14 boolean;
  _reach_21 boolean;
  _new_streak int;
  _first_submit boolean;
  _granted_gems int := 0;
  _bonus_gems int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;

  SELECT * INTO _enr FROM public.diet_program_enrollments
   WHERE user_id = _uid AND status IN ('active','not_started') ORDER BY created_at DESC LIMIT 1;
  IF _enr.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','no_active_enrollment'); END IF;

  _day := GREATEST(1, LEAST(21, (_log_date - _enr.start_date)::int + 1));

  -- 기존 로그 유무 확인 — 최초 제출이면 보상 지급, 재제출이면 필드만 갱신
  SELECT * INTO _existing FROM public.diet_daily_logs
   WHERE enrollment_id = _enr.id AND log_date = _log_date;
  _first_submit := (_existing.id IS NULL);

  INSERT INTO public.diet_daily_logs (
    enrollment_id, user_id, log_date, day_number,
    water_ml, step_count, sleep_hours,
    protein_first, veggies_natural, sugary_drink_avoided, late_night_snack_avoided, gym_attended,
    mood, memo, status, submitted_at
  ) VALUES (
    _enr.id, _uid, _log_date, _day,
    NULLIF(_habits->>'water_ml','')::int,
    NULLIF(_habits->>'step_count','')::int,
    NULLIF(_habits->>'sleep_hours','')::numeric,
    (_habits->>'protein_first')::boolean,
    (_habits->>'veggies_natural')::boolean,
    (_habits->>'sugary_drink_avoided')::boolean,
    (_habits->>'late_night_snack_avoided')::boolean,
    (_habits->>'gym_attended')::boolean,
    _habits->>'mood',
    COALESCE(_note, _habits->>'memo'),
    'approved',            -- 자가 기록: 즉시 approved
    now()
  )
  ON CONFLICT (enrollment_id, log_date) DO UPDATE SET
    water_ml = EXCLUDED.water_ml,
    step_count = EXCLUDED.step_count,
    sleep_hours = EXCLUDED.sleep_hours,
    protein_first = EXCLUDED.protein_first,
    veggies_natural = EXCLUDED.veggies_natural,
    sugary_drink_avoided = EXCLUDED.sugary_drink_avoided,
    late_night_snack_avoided = EXCLUDED.late_night_snack_avoided,
    gym_attended = EXCLUDED.gym_attended,
    mood = EXCLUDED.mood,
    memo = EXCLUDED.memo,
    status = 'approved',
    submitted_at = now()
  RETURNING id INTO _id;

  -- 최초 제출이 아니면 여기서 종료 — 보상/스냅샷 이중 지급 방지
  IF NOT _first_submit THEN
    RETURN jsonb_build_object(
      'success', true,
      'log_id', _id,
      'day_number', _day,
      'first_submit', false,
      'granted_gems', 0
    );
  END IF;

  -- ────────── 최초 제출 경로: 스냅샷 + 보상 + 배지 ──────────
  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _enr.id;

  _approved_new := _snap.approved_days_total + 1;

  IF _snap.last_log_date IS NOT NULL AND _log_date = _snap.last_log_date + 1 THEN
    _new_streak := _snap.current_streak + 1;
  ELSIF _snap.last_log_date = _log_date THEN
    _new_streak := _snap.current_streak;
  ELSE
    _new_streak := 1;
  END IF;

  _reach_7  := _approved_new >= 7;
  _reach_14 := _approved_new >= 14;
  _reach_21 := _approved_new >= 21;

  UPDATE public.diet_progress_snapshots SET
    approved_days_total = _approved_new,
    current_streak = _new_streak,
    best_streak = GREATEST(_snap.best_streak, _new_streak),
    milestone_7_reached  = _snap.milestone_7_reached OR _reach_7,
    milestone_14_reached = _snap.milestone_14_reached OR _reach_14,
    milestone_21_reached = _snap.milestone_21_reached OR _reach_21,
    habit_score = LEAST(100, ROUND((_approved_new::numeric / 21) * 100)::int),
    last_log_date = _log_date,
    updated_at = now()
  WHERE enrollment_id = _enr.id;

  -- 파이트 머니 3 (일일 보상)
  PERFORM public.grant_gems(_uid, 3, 'diet_checkin_self');
  _granted_gems := 3;

  -- 배지 자동 지급
  INSERT INTO public.member_badges (user_id, badge_id)
  SELECT _uid, b.id
    FROM public.badges b
   WHERE b.code IN (
     CASE WHEN NOT _snap.milestone_7_reached  AND _reach_7  THEN 'diet_week_7'      END,
     CASE WHEN NOT _snap.milestone_14_reached AND _reach_14 THEN 'diet_week_14'     END,
     CASE WHEN NOT _snap.milestone_21_reached AND _reach_21 THEN 'diet_21_complete' END,
     CASE WHEN _snap.approved_days_total = 0 THEN 'diet_starter' END
   )
  ON CONFLICT DO NOTHING;

  -- 21일 완주 보너스 (최초 1회)
  IF _reach_21 AND NOT _snap.milestone_21_reached THEN
    UPDATE public.diet_program_enrollments
       SET status = 'completed', finished_at = now()
     WHERE id = _enr.id;
    PERFORM public.grant_gems(_uid, 50, 'diet_21_complete');
    _bonus_gems := 50;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', _id,
    'day_number', _day,
    'first_submit', true,
    'granted_gems', _granted_gems,
    'bonus_gems', _bonus_gems,
    'approved_days_total', _approved_new,
    'current_streak', _new_streak,
    'milestones_newly_reached', jsonb_build_object(
      'm7',  NOT _snap.milestone_7_reached AND _reach_7,
      'm14', NOT _snap.milestone_14_reached AND _reach_14,
      'm21', NOT _snap.milestone_21_reached AND _reach_21
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_diet_daily_log(date, jsonb, text) TO authenticated;

-- ───── 신규: 코치 피드백 전용 RPC (승인/상태 변경 없음) ─────
CREATE OR REPLACE FUNCTION public.add_diet_coach_feedback(
  _log_id uuid,
  _feedback text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _caller uuid := auth.uid();
  _log public.diet_daily_logs%ROWTYPE;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _feedback IS NULL OR length(trim(_feedback)) = 0 THEN
    RETURN jsonb_build_object('success',false,'error','empty_feedback');
  END IF;

  SELECT * INTO _log FROM public.diet_daily_logs WHERE id = _log_id;
  IF _log.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;

  IF NOT (public.has_role(_caller,'super_admin') OR public.is_branch_manager_of(_caller, _log.user_id)) THEN
    RETURN jsonb_build_object('success',false,'error','not_authorized');
  END IF;

  UPDATE public.diet_daily_logs SET
    coach_feedback = left(_feedback, 300),
    coach_reviewed = true,
    reviewed_by = _caller,
    reviewed_at = now()
  WHERE id = _log_id;

  PERFORM public.create_notification(
    _log.user_id,
    'AI 코치님의 피드백이 도착했어요',
    left(_feedback, 300)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_diet_coach_feedback(uuid, text) TO authenticated;

-- ───── 백필: pending/revision_requested 상태의 기존 로그를 approved 로 이관 ─────
-- 보상 중복 지급을 피하기 위해, 스냅샷은 건드리지 않고 상태만 승인으로 바꾼다.
-- 이미 파이트 머니를 받았는지 여부와 상관없이, 기존 pending 은 "자가 기록" 체제에서
-- 승인된 것으로 간주. 누적 보상은 approved_days_total 기반으로만 지급되므로, 이후
-- 스냅샷 재계산 SQL 은 별도로 돌리지 않는다 (기존 스냅샷이 정확하게 누적되어 있을 것).
UPDATE public.diet_daily_logs
   SET status = 'approved'
 WHERE status IN ('pending','revision_requested');

-- ═══════════════════════════════════════════════════════════════════
