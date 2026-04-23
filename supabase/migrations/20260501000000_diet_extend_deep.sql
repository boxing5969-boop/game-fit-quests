-- =========================================================================
-- 153 다이어트 · 건강리셋 연장 프로그램 심화 (fat_loss_extend_153)
--
-- 9단계에서 만든 diet_post_program_plans 에 "재평가 + 패턴 태그 + 연장 목표 + 사이클
-- 시작/종료"를 덧붙이는 마이그레이션. 목표는 탈락률 낮추기 + 정체기 대응 + 코치 개입
-- 강화. "더 독하게" 가 아니라 "더 안정적으로".
--
-- 추가 원칙:
--   · 미달성 = 실패 프레임 금지 · 극단 제한 기본값 금지
--   · 미션은 패턴(pattern_tags)별로 클라이언트에서 선택 — 서버는 데이터 저장만
--   · 코치 권장 문구는 기존 coach_recommendation_note 재사용
-- =========================================================================

-- ───────────────────────────────────────────────────────────────────────
-- 1. 컬럼 추가 — diet_post_program_plans
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.diet_post_program_plans
  ADD COLUMN IF NOT EXISTS reassessment jsonb,
  ADD COLUMN IF NOT EXISTS pattern_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS extend_goals jsonb,
  ADD COLUMN IF NOT EXISTS extend_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS extend_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS extend_result text;
-- extend_result: 'maintenance_transition' | 'extend_again' | 'coach_consult' | null

COMMENT ON COLUMN public.diet_post_program_plans.reassessment IS
  '연장 시작 전 재평가 결과. recent_21d_adherence/weakest_habit/weekly_workouts/sleep_hours/eating_out_weekly/late_binge_weekly/biggest_obstacle';
COMMENT ON COLUMN public.diet_post_program_plans.pattern_tags IS
  '자동 분류된 약점 패턴 태그 배열. late_binge | eating_out | weekend_crash | workout_strong_diet_weak | diet_strong_attendance_weak | sleep_short';
COMMENT ON COLUMN public.diet_post_program_plans.extend_goals IS
  '연장 목표 6종 jsonb. weight_kg_target/waist_cm_target/weekly_workouts_target/weekly_checkin_rate_target/sleep_hours_target/weekend_defense_target';

CREATE INDEX IF NOT EXISTS diet_post_program_plans_pattern_idx
  ON public.diet_post_program_plans USING GIN (pattern_tags);

-- ───────────────────────────────────────────────────────────────────────
-- 2. RPC — submit_extend_reassessment
--   재평가 결과 저장 + 패턴 태그 자동 분류 + 연장 시작(extend_started_at) 세팅.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_extend_reassessment(
  _plan_id uuid,
  _recent_21d_adherence int,
  _weakest_habit text,
  _weekly_workouts int,
  _sleep_hours numeric,
  _eating_out_weekly int,
  _late_binge_weekly int,
  _biggest_obstacle text,
  _extend_goals jsonb,
  _user_pattern_overrides text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _plan public.diet_post_program_plans%ROWTYPE;
  _tags text[] := ARRAY[]::text[];
  _reassessment jsonb;
BEGIN
  SELECT * INTO _plan FROM public.diet_post_program_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  IF _plan.user_id <> _caller
     AND NOT public.is_branch_manager_of(_caller, _plan.user_id)
     AND NOT public.has_role(_caller,'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF _plan.selected_path <> 'extend' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_extend_path');
  END IF;

  -- 패턴 자동 분류 (우선순위: 가장 뚜렷한 신호부터)
  IF COALESCE(_late_binge_weekly, 0) >= 3 THEN
    _tags := array_append(_tags, 'late_binge');
  END IF;
  IF COALESCE(_eating_out_weekly, 0) >= 4 THEN
    _tags := array_append(_tags, 'eating_out');
  END IF;
  IF _biggest_obstacle = 'weekend_crash' THEN
    _tags := array_append(_tags, 'weekend_crash');
  END IF;
  IF COALESCE(_weekly_workouts, 0) >= 3
     AND _weakest_habit IN ('protein_first','veggies_natural','sugary_drink_avoided') THEN
    _tags := array_append(_tags, 'workout_strong_diet_weak');
  END IF;
  IF COALESCE(_weekly_workouts, 0) < 2
     AND _weakest_habit NOT IN ('protein_first','veggies_natural') THEN
    _tags := array_append(_tags, 'diet_strong_attendance_weak');
  END IF;
  IF COALESCE(_sleep_hours, 0) < 6 THEN
    _tags := array_append(_tags, 'sleep_short');
  END IF;

  -- 사용자 override (회원이 체감 장애물 추가 선택)
  IF _user_pattern_overrides IS NOT NULL THEN
    _tags := (
      SELECT ARRAY(SELECT DISTINCT unnest(_tags || _user_pattern_overrides) ORDER BY 1)
    );
  END IF;

  -- 아무 태그도 없으면 기본으로 weekend_crash (가장 흔함) 1개만
  IF array_length(_tags, 1) IS NULL THEN
    _tags := ARRAY['weekend_crash'];
  END IF;

  _reassessment := jsonb_build_object(
    'recent_21d_adherence', COALESCE(_recent_21d_adherence, 0),
    'weakest_habit', _weakest_habit,
    'weekly_workouts', COALESCE(_weekly_workouts, 0),
    'sleep_hours', COALESCE(_sleep_hours, 0),
    'eating_out_weekly', COALESCE(_eating_out_weekly, 0),
    'late_binge_weekly', COALESCE(_late_binge_weekly, 0),
    'biggest_obstacle', _biggest_obstacle,
    'submitted_at', now()
  );

  UPDATE public.diet_post_program_plans SET
    reassessment = _reassessment,
    pattern_tags = _tags,
    extend_goals = COALESCE(_extend_goals, extend_goals),
    extend_started_at = COALESCE(extend_started_at, now()),
    follow_up_status = 'active'
  WHERE id = _plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'pattern_tags', _tags,
    'reassessment', _reassessment
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_extend_reassessment(
  uuid, int, text, int, numeric, int, int, text, jsonb, text[]
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 3. RPC — coach_tag_pattern
--   코치가 특정 패턴 태그를 추가/제거.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.coach_tag_pattern(
  _plan_id uuid,
  _tag text,
  _action text  -- 'add' | 'remove'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _plan public.diet_post_program_plans%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.diet_post_program_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  IF NOT (public.is_branch_manager_of(_caller, _plan.user_id)
          OR public.has_role(_caller,'super_admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF _tag NOT IN ('late_binge','eating_out','weekend_crash',
                  'workout_strong_diet_weak','diet_strong_attendance_weak','sleep_short') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tag');
  END IF;

  IF _action = 'add' THEN
    UPDATE public.diet_post_program_plans SET
      pattern_tags = (
        SELECT ARRAY(SELECT DISTINCT unnest(pattern_tags || ARRAY[_tag]) ORDER BY 1)
      )
    WHERE id = _plan_id;
  ELSIF _action = 'remove' THEN
    UPDATE public.diet_post_program_plans SET
      pattern_tags = array_remove(pattern_tags, _tag)
    WHERE id = _plan_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_tag_pattern(uuid, text, text) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 4. RPC — end_extend_cycle
--   연장 사이클 종료 + 다음 경로 선택 기록.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_extend_cycle(
  _plan_id uuid,
  _result text  -- 'maintenance_transition' | 'extend_again' | 'coach_consult'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _plan public.diet_post_program_plans%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.diet_post_program_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  IF _plan.user_id <> _caller
     AND NOT public.is_branch_manager_of(_caller, _plan.user_id)
     AND NOT public.has_role(_caller,'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF _result NOT IN ('maintenance_transition','extend_again','coach_consult') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_result');
  END IF;

  IF _plan.selected_path <> 'extend' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_extend_path');
  END IF;

  -- 결과별 상태 전이
  IF _result = 'maintenance_transition' THEN
    UPDATE public.diet_post_program_plans SET
      extend_ended_at = COALESCE(extend_ended_at, now()),
      extend_result = _result,
      selected_path = 'maintenance',
      selected_at = now(),
      follow_up_status = 'active'
    WHERE id = _plan_id;

    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _plan.user_id, id FROM public.badges WHERE code='diet_maintenance_start'
    ON CONFLICT DO NOTHING;

  ELSIF _result = 'extend_again' THEN
    -- 다음 사이클 — index 증가, 재평가는 유지. 주간 체크인만 리셋(클라이언트 판정).
    UPDATE public.diet_post_program_plans SET
      extend_ended_at = now(),
      extend_result = _result,
      extension_cycle_index = extension_cycle_index + 1,
      extend_started_at = now(),
      next_cycle_start_date = CURRENT_DATE,
      follow_up_status = 'active'
    WHERE id = _plan_id;

    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _plan.user_id, id FROM public.badges WHERE code='diet_extend_complete'
    ON CONFLICT DO NOTHING;

  ELSE -- coach_consult
    UPDATE public.diet_post_program_plans SET
      extend_ended_at = COALESCE(extend_ended_at, now()),
      extend_result = _result,
      follow_up_status = 'paused'
    WHERE id = _plan_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'result', _result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_extend_cycle(uuid, text) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 5. RPC replace — coach_list_post_program_members 에 pattern_tags 포함
--   9단계 함수를 CREATE OR REPLACE 로 덮어씀 (시그니처 동일).
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.coach_list_post_program_members(
  _filter text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _rows jsonb;
BEGIN
  IF NOT (public.has_role(_caller,'super_admin')
          OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_caller AND role='branch_manager')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.finished_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      p.id AS plan_id,
      p.user_id,
      pr.name AS member_name,
      pr.branch_name,
      p.recommended_path,
      p.selected_path,
      p.follow_up_status,
      p.coach_recommended_path,
      p.completion_summary,
      p.pattern_tags,
      p.extend_started_at,
      p.extend_ended_at,
      p.extend_result,
      e.finished_at
    FROM public.diet_post_program_plans p
    JOIN public.diet_program_enrollments e ON e.id = p.enrollment_id
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE
      (public.has_role(_caller,'super_admin')
       OR public.is_branch_manager_of(_caller, p.user_id))
      AND (
        _filter = 'all'
        OR (_filter = 'pending' AND p.selected_path = 'pending')
        OR (_filter = 'maintenance' AND p.selected_path = 'maintenance')
        OR (_filter = 'extend' AND p.selected_path = 'extend')
      )
  ) r;

  RETURN jsonb_build_object('success', true, 'rows', _rows);
END;
$$;
