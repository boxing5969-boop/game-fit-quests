-- ──────────────────────────────────────────────────────────────────
-- 153 다이어트 — 21일 안 채우고 조기 사후 프로그램 시작 RPC
--
-- 목적:
--   기존 ensure_post_program_plan 은 enrollment.status='completed' 만 허용 →
--   "21일 이후 프로그램부터 바로 하고 싶은 회원" 진입 불가.
--   본 RPC 는 회원이 명시적으로 "조기 시작" 을 선택했을 때:
--     1) enrollment.status active → completed 강제 전환 (finished_at = now)
--     2) ensure_post_program_plan 의 plan 생성 로직과 동일하게 plan insert
--   결과: 즉시 NextStepChooser/PostProgramRouter 진입 가능.
--
-- 정책:
--   · 본인 또는 매니저/super_admin 만 호출 가능 (기존 권한 동일).
--   · enrollment 가 active/not_started 상태에서만 동작. 이미 completed/dropped 면 그대로 plan 만 보장.
--   · 21일 자가 기록은 사라지지 않음 — 단지 status 만 completed 로 전환.
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.early_start_post_program(
  _enrollment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _enr public.diet_program_enrollments%ROWTYPE;
  _snap public.diet_progress_snapshots%ROWTYPE;
  _summary jsonb;
  _plan public.diet_post_program_plans%ROWTYPE;
  _approved_days int;
  _pending_days int;
  _total_logs int;
  _gym_days int;
  _best_habit text;
  _weak_habit text;
  _reco public.diet_post_program_recommendation;
BEGIN
  SELECT * INTO _enr FROM public.diet_program_enrollments WHERE id = _enrollment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'enrollment_not_found');
  END IF;

  -- 권한
  IF NOT (_enr.user_id = _caller
          OR public.is_branch_manager_of(_caller, _enr.user_id)
          OR public.has_role(_caller,'super_admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- dropped 는 거부 — 명시적 재등록 필요
  IF _enr.status = 'dropped' THEN
    RETURN jsonb_build_object('success', false, 'error', 'enrollment_dropped');
  END IF;

  -- active / not_started / paused 면 status 강제 전환
  IF _enr.status IN ('active','not_started','paused') THEN
    UPDATE public.diet_program_enrollments
       SET status = 'completed',
           finished_at = COALESCE(finished_at, now())
     WHERE id = _enrollment_id
     RETURNING * INTO _enr;
  END IF;

  -- 기존 plan 있으면 그대로 반환 (멱등)
  SELECT * INTO _plan FROM public.diet_post_program_plans WHERE enrollment_id = _enrollment_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'plan_id', _plan.id,
      'summary', _plan.completion_summary,
      'recommended_path', _plan.recommended_path,
      'selected_path', _plan.selected_path,
      'created', false,
      'early_start', true
    );
  END IF;

  -- 새 plan 생성 — ensure_post_program_plan 의 요약 계산 로직과 동일.
  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _enrollment_id;

  SELECT
    COUNT(*) FILTER (WHERE status='approved'),
    COUNT(*) FILTER (WHERE status='pending'),
    COUNT(*),
    COUNT(*) FILTER (WHERE gym_attended = true)
  INTO _approved_days, _pending_days, _total_logs, _gym_days
  FROM public.diet_daily_logs
  WHERE enrollment_id = _enrollment_id;

  WITH stats AS (
    SELECT
      SUM(CASE WHEN protein_first THEN 1 ELSE 0 END) AS protein_first,
      SUM(CASE WHEN veggies_natural THEN 1 ELSE 0 END) AS veggies_natural,
      SUM(CASE WHEN sugary_drink_avoided THEN 1 ELSE 0 END) AS sugary_drink_avoided,
      SUM(CASE WHEN late_night_snack_avoided THEN 1 ELSE 0 END) AS late_night_snack_avoided,
      SUM(CASE WHEN gym_attended THEN 1 ELSE 0 END) AS gym_attended
    FROM public.diet_daily_logs
    WHERE enrollment_id = _enrollment_id AND status='approved'
  ), melted AS (
    SELECT 'protein_first' AS habit, protein_first AS cnt FROM stats
    UNION ALL SELECT 'veggies_natural', veggies_natural FROM stats
    UNION ALL SELECT 'sugary_drink_avoided', sugary_drink_avoided FROM stats
    UNION ALL SELECT 'late_night_snack_avoided', late_night_snack_avoided FROM stats
    UNION ALL SELECT 'gym_attended', gym_attended FROM stats
  )
  SELECT
    (SELECT habit FROM melted ORDER BY cnt DESC NULLS LAST LIMIT 1),
    (SELECT habit FROM melted ORDER BY cnt ASC NULLS LAST LIMIT 1)
  INTO _best_habit, _weak_habit;

  -- 조기 시작은 데이터가 적어서 보통 extend 추천. 18일 이상이면 maintenance.
  _reco := CASE
    WHEN COALESCE(_approved_days, 0) >= 18 THEN 'maintenance'::diet_post_program_recommendation
    WHEN COALESCE(_approved_days, 0) >= 14 THEN 'either'::diet_post_program_recommendation
    ELSE 'extend'::diet_post_program_recommendation
  END;

  _summary := jsonb_build_object(
    'start_date', _enr.start_date,
    'end_date', COALESCE(_enr.finished_at, now())::date,
    'approved_days', COALESCE(_approved_days, 0),
    'pending_days', COALESCE(_pending_days, 0),
    'checkin_rate',
      CASE WHEN 21 > 0 THEN ROUND(COALESCE(_total_logs,0)::numeric / 21 * 100, 1) ELSE 0 END,
    'attendance_rate',
      CASE WHEN COALESCE(_total_logs,0) > 0
        THEN ROUND(COALESCE(_gym_days,0)::numeric / _total_logs * 100, 1)
        ELSE 0 END,
    'habit_score', COALESCE(_snap.habit_score, 0),
    'best_streak', COALESCE(_snap.best_streak, 0),
    'best_habit', _best_habit,
    'weakest_habit', _weak_habit,
    'early_start', true
  );

  INSERT INTO public.diet_post_program_plans (
    enrollment_id, user_id, completion_summary, recommended_path
  ) VALUES (
    _enrollment_id, _enr.user_id, _summary, _reco
  )
  RETURNING * INTO _plan;

  RETURN jsonb_build_object(
    'success', true,
    'plan_id', _plan.id,
    'summary', _summary,
    'recommended_path', _reco,
    'selected_path', 'pending',
    'created', true,
    'early_start', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.early_start_post_program(uuid) TO authenticated;

COMMENT ON FUNCTION public.early_start_post_program(uuid) IS
  '21일 안 채우고 조기 사후 프로그램(유지/연장) 시작. enrollment status active→completed 강제 전환 + plan 생성. 멱등.';
