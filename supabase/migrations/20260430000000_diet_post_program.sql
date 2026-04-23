-- =========================================================================
-- 153 다이어트 · 21일 종료 후 분기 (Post-21 Branch)
--
-- 목적: 21일 완주 후 "끝난" 느낌이 아니라, 회원이 두 갈래 중 하나로
--      자연스럽게 이동하도록 데이터 구조·RPC·배지를 추가.
--
--   A. 유지 컨설팅 모드 (path='maintenance', track_key=maintenance_153)
--      — 목표 달성자 / 유지가 적절한 회원. 유연식 대응 + 조기 감지.
--   B. 건강리셋 연장 프로그램 (path='extend', track_key=fat_loss_extend_153)
--      — 목표 미달성자. 습관 기반 유지 + 안정적 감량 14/21일 사이클.
--
-- 원칙:
--   · 체중 경쟁 금지 · 극단 제한 금지 · 죄책감 유발 금지
--   · adherence / streak 중심. 공개 랭킹과 완전히 분리.
--   · 모든 쓰기는 SECURITY DEFINER RPC 로만 (RLS read-only).
-- =========================================================================

-- ───────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ───────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diet_post_program_path') THEN
    CREATE TYPE public.diet_post_program_path AS ENUM (
      'pending',       -- 아직 선택 안 함
      'maintenance',   -- 유지 컨설팅 모드
      'extend'         -- 건강리셋 연장 프로그램
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diet_post_program_follow_up') THEN
    CREATE TYPE public.diet_post_program_follow_up AS ENUM (
      'pending',       -- 21일 완료 후 아직 경로 선택 없음
      'active',        -- 유지/연장 진행 중
      'paused',        -- 코치 판단 일시 중지
      'abandoned',     -- 14일 이상 미활동 (서버 집계)
      'succeeded'      -- 유지/연장 사이클 완료
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diet_post_program_recommendation') THEN
    CREATE TYPE public.diet_post_program_recommendation AS ENUM (
      'maintenance',
      'extend',
      'either'         -- 둘 다 가능, 코치 상담 권장
    );
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────────────
-- 2. diet_post_program_plans — enrollment 당 1개
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_post_program_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.diet_program_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 21일 종료 시점 캡쳐 요약(jsonb)
  -- 예: { "start_date":"...", "end_date":"...", "approved_days":21,
  --       "attendance_rate":0.76, "checkin_rate":0.95, "habit_score_avg":82,
  --       "best_habit":"protein_first", "weakest_habit":"late_night_snack_avoided",
  --       "weight_change_kg":null, "waist_change_cm":null }
  completion_summary jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- 목표/분기
  target_achieved boolean,                   -- nullable: 사용자 자기보고
  recommended_path public.diet_post_program_recommendation NOT NULL DEFAULT 'either',
  selected_path public.diet_post_program_path NOT NULL DEFAULT 'pending',
  selected_at timestamptz,

  -- 유지 모드 파라미터
  maintenance_target_weight_kg numeric(5,2),
  maintenance_range_kg numeric(4,2) NOT NULL DEFAULT 2.0,
  maintenance_waist_target_cm numeric(5,2),
  maintenance_waist_range_cm numeric(4,2) NOT NULL DEFAULT 3.0,
  regain_alert_threshold_kg numeric(4,2) NOT NULL DEFAULT 3.0,

  -- 연장 프로그램 파라미터
  extension_cycle_length int NOT NULL DEFAULT 14 CHECK (extension_cycle_length IN (14, 21)),
  extension_cycle_index int NOT NULL DEFAULT 0,
  next_cycle_start_date date,

  -- 코치 추천
  coach_recommendation_note text,
  coach_recommended_path public.diet_post_program_recommendation,
  coach_recommended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_recommended_at timestamptz,

  -- 상태
  follow_up_status public.diet_post_program_follow_up NOT NULL DEFAULT 'pending',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS diet_post_program_plans_enrollment_uk
  ON public.diet_post_program_plans(enrollment_id);
CREATE INDEX IF NOT EXISTS diet_post_program_plans_user_idx
  ON public.diet_post_program_plans(user_id);
CREATE INDEX IF NOT EXISTS diet_post_program_plans_path_idx
  ON public.diet_post_program_plans(selected_path) WHERE selected_path <> 'pending';

-- ───────────────────────────────────────────────────────────────────────
-- 3. diet_post_program_checkins — 유지/연장 공용 주간 체크인
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_post_program_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.diet_post_program_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_index int NOT NULL CHECK (week_index >= 1),
  checkin_date date NOT NULL,

  -- 선택 입력
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),

  -- 요약 지표 (0~100)
  adherence_score int CHECK (adherence_score IS NULL OR (adherence_score BETWEEN 0 AND 100)),

  -- 자기보고 카운터
  flexible_meals_count int NOT NULL DEFAULT 0,
  late_binge_count int NOT NULL DEFAULT 0,
  attended_workouts int NOT NULL DEFAULT 0,
  protein_first_days int NOT NULL DEFAULT 0,

  -- 복귀 미션 트리거
  needs_recovery boolean NOT NULL DEFAULT false,
  recovery_reason text,

  reflection text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diet_post_program_checkins_plan_week_idx
  ON public.diet_post_program_checkins(plan_id, week_index);
CREATE INDEX IF NOT EXISTS diet_post_program_checkins_user_idx
  ON public.diet_post_program_checkins(user_id, checkin_date DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 4. RLS — read-only(본인/지점장/슈퍼). 쓰기는 RPC only.
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.diet_post_program_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_post_program_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_plan_read" ON public.diet_post_program_plans;
CREATE POLICY "post_plan_read"
  ON public.diet_post_program_plans FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP POLICY IF EXISTS "post_checkin_read" ON public.diet_post_program_checkins;
CREATE POLICY "post_checkin_read"
  ON public.diet_post_program_checkins FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(),'super_admin')
  );

-- ───────────────────────────────────────────────────────────────────────
-- 5. Trigger — updated_at 자동 갱신
-- ───────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_diet_post_program_plans_updated ON public.diet_post_program_plans;
CREATE TRIGGER trg_diet_post_program_plans_updated
  BEFORE UPDATE ON public.diet_post_program_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────
-- 6. RPC — ensure_post_program_plan(_enrollment_id)
--   21일 완주 enrollment 에 대해 요약 캡쳐 + plan 레코드 upsert.
--   이미 존재하면 summary 재계산 없이 기존 레코드 반환.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_post_program_plan(
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

  -- 권한: 본인 또는 지점장·슈퍼
  IF NOT (_enr.user_id = _caller
          OR public.is_branch_manager_of(_caller, _enr.user_id)
          OR public.has_role(_caller,'super_admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- 21일 완주 상태만 허용
  IF _enr.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_completed_yet');
  END IF;

  -- 기존 plan 있으면 그대로 반환
  SELECT * INTO _plan FROM public.diet_post_program_plans WHERE enrollment_id = _enrollment_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'plan_id', _plan.id,
      'summary', _plan.completion_summary,
      'recommended_path', _plan.recommended_path,
      'selected_path', _plan.selected_path,
      'created', false
    );
  END IF;

  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _enrollment_id;

  -- 요약 계산
  SELECT
    COUNT(*) FILTER (WHERE status='approved'),
    COUNT(*) FILTER (WHERE status='pending'),
    COUNT(*),
    COUNT(*) FILTER (WHERE gym_attended = true)
  INTO _approved_days, _pending_days, _total_logs, _gym_days
  FROM public.diet_daily_logs
  WHERE enrollment_id = _enrollment_id;

  -- 가장 잘 지킨 / 자주 무너진 습관 — 5개 체크박스 중 승인된 일수 기준
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

  -- 서버 추천 경로 초기 계산 (클라이언트에서도 보강):
  --   approved_days >= 18 이면 maintenance 후보. 아니면 extend. 경계는 either.
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
    'weakest_habit', _weak_habit
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
    'created', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_post_program_plan(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 7. RPC — select_post_program_path
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.select_post_program_path(
  _plan_id uuid,
  _path public.diet_post_program_path,
  _target_achieved boolean DEFAULT NULL,
  _maintenance_target_weight_kg numeric DEFAULT NULL,
  _maintenance_target_waist_cm numeric DEFAULT NULL,
  _extension_cycle_length int DEFAULT 14
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

  IF _path = 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_path');
  END IF;

  IF _path = 'extend' AND _extension_cycle_length IS NOT NULL
     AND _extension_cycle_length NOT IN (14, 21) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_cycle_length');
  END IF;

  UPDATE public.diet_post_program_plans SET
    selected_path = _path,
    selected_at = now(),
    target_achieved = COALESCE(_target_achieved, target_achieved),
    maintenance_target_weight_kg = COALESCE(_maintenance_target_weight_kg, maintenance_target_weight_kg),
    maintenance_waist_target_cm = COALESCE(_maintenance_target_waist_cm, maintenance_waist_target_cm),
    extension_cycle_length = CASE WHEN _path = 'extend' THEN COALESCE(_extension_cycle_length, 14) ELSE extension_cycle_length END,
    next_cycle_start_date = CASE WHEN _path = 'extend' AND next_cycle_start_date IS NULL THEN CURRENT_DATE ELSE next_cycle_start_date END,
    follow_up_status = 'active'
  WHERE id = _plan_id;

  -- 경로 선택 배지
  IF _path = 'maintenance' THEN
    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _plan.user_id, id FROM public.badges WHERE code='diet_maintenance_start'
    ON CONFLICT DO NOTHING;
  ELSIF _path = 'extend' THEN
    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _plan.user_id, id FROM public.badges WHERE code='diet_extend_start'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan_id', _plan_id, 'selected_path', _path);
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_post_program_path(
  uuid, public.diet_post_program_path, boolean, numeric, numeric, int
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 8. RPC — submit_post_program_checkin (주간)
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_post_program_checkin(
  _plan_id uuid,
  _week_index int,
  _weight_kg numeric DEFAULT NULL,
  _waist_cm numeric DEFAULT NULL,
  _adherence_score int DEFAULT NULL,
  _flexible_meals_count int DEFAULT 0,
  _late_binge_count int DEFAULT 0,
  _attended_workouts int DEFAULT 0,
  _protein_first_days int DEFAULT 0,
  _reflection text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _plan public.diet_post_program_plans%ROWTYPE;
  _needs_recovery boolean := false;
  _recovery_reason text := NULL;
  _delta numeric;
  _checkin_id uuid;
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

  IF _plan.selected_path = 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'path_not_selected');
  END IF;

  -- 복귀 미션 자동 트리거 — 유지 모드에서만
  IF _plan.selected_path = 'maintenance' THEN
    IF _plan.maintenance_target_weight_kg IS NOT NULL AND _weight_kg IS NOT NULL THEN
      _delta := _weight_kg - _plan.maintenance_target_weight_kg;
      IF _delta > _plan.regain_alert_threshold_kg THEN
        _needs_recovery := true;
        _recovery_reason := 'weight_regain_over_threshold';
      END IF;
    END IF;
    IF _late_binge_count >= 3 THEN
      _needs_recovery := true;
      _recovery_reason := COALESCE(_recovery_reason, 'late_binge_repeat');
    END IF;
  END IF;

  INSERT INTO public.diet_post_program_checkins (
    plan_id, user_id, week_index, checkin_date,
    weight_kg, waist_cm, adherence_score,
    flexible_meals_count, late_binge_count, attended_workouts, protein_first_days,
    needs_recovery, recovery_reason, reflection
  ) VALUES (
    _plan_id, _plan.user_id, _week_index, CURRENT_DATE,
    _weight_kg, _waist_cm, _adherence_score,
    COALESCE(_flexible_meals_count,0),
    COALESCE(_late_binge_count,0),
    COALESCE(_attended_workouts,0),
    COALESCE(_protein_first_days,0),
    _needs_recovery, _recovery_reason, _reflection
  )
  RETURNING id INTO _checkin_id;

  -- 유지 4주 + 연장 사이클 완주 배지
  IF _plan.selected_path = 'maintenance' AND _week_index >= 4 THEN
    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _plan.user_id, id FROM public.badges WHERE code='diet_maintenance_4w'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', _checkin_id,
    'needs_recovery', _needs_recovery,
    'recovery_reason', _recovery_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_post_program_checkin(
  uuid, int, numeric, numeric, int, int, int, int, int, text
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 9. RPC — get_post_program_plan (본인/코치)
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_post_program_plan(
  _user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _target uuid := COALESCE(_user_id, auth.uid());
  _plan public.diet_post_program_plans%ROWTYPE;
  _checkins jsonb;
BEGIN
  IF _target <> _caller
     AND NOT public.is_branch_manager_of(_caller, _target)
     AND NOT public.has_role(_caller,'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- 가장 최근 completed enrollment 의 plan
  SELECT p.* INTO _plan
  FROM public.diet_post_program_plans p
  JOIN public.diet_program_enrollments e ON e.id = p.enrollment_id
  WHERE p.user_id = _target
  ORDER BY e.finished_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'has_plan', false);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.week_index DESC), '[]'::jsonb)
  INTO _checkins
  FROM public.diet_post_program_checkins c
  WHERE c.plan_id = _plan.id;

  RETURN jsonb_build_object(
    'success', true,
    'has_plan', true,
    'plan', row_to_json(_plan),
    'checkins', _checkins
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_program_plan(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 10. RPC — coach_recommend_post_program_path
--   코치가 권장 경로 + 문구 저장. 회원 선택을 덮어쓰지 않는다.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.coach_recommend_post_program_path(
  _plan_id uuid,
  _path public.diet_post_program_recommendation,
  _note text DEFAULT NULL
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

  UPDATE public.diet_post_program_plans SET
    coach_recommended_path = _path,
    coach_recommendation_note = _note,
    coach_recommended_by = _caller,
    coach_recommended_at = now()
  WHERE id = _plan_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_recommend_post_program_path(
  uuid, public.diet_post_program_recommendation, text
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 11. RPC — coach_list_post_program_members
--   지점장: 본인 지점의 21일 완주자 + 경로 상태 목록.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.coach_list_post_program_members(
  _filter text DEFAULT 'all' -- 'pending' | 'maintenance' | 'extend' | 'all'
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

GRANT EXECUTE ON FUNCTION public.coach_list_post_program_members(text) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 12. Badges — 유지/연장/복귀 계열 4종
--   기존 badges 테이블 재사용. ON CONFLICT 로 멱등 보장.
-- ───────────────────────────────────────────────────────────────────────
INSERT INTO public.badges (code, name, description) VALUES
  ('diet_maintenance_start', '유지 모드 시작',  '21일 이후 유지 컨설팅 모드를 선택'),
  ('diet_maintenance_4w',    '4주 유지 성공',    '유지 모드 4주간 주간 체크인 유지'),
  ('diet_extend_start',      '건강리셋 연장 시작', '21일 이후 건강리셋 연장 프로그램을 선택'),
  ('diet_extend_complete',   '2차 리셋 완주',     '건강리셋 연장 사이클 1회 완주'),
  ('diet_comeback_strong',   '복귀력 우수',      '급증·일탈 후 3일 복귀 미션 완주')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.diet_post_program_plans IS
  '21일 완주 후 유지(maintenance) 또는 연장(extend) 경로 분기 레코드. enrollment 당 1개.';
COMMENT ON TABLE public.diet_post_program_checkins IS
  '유지/연장 공용 주간 체크인. 복귀 미션 자동 트리거 · 유지 배지 조건 판정.';
