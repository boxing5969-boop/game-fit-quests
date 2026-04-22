-- ══════════════════════════════════════════════════════════════════
-- 153 다이어트 — Streak 7 / Perfect Week 배지 + review_diet_log 확장
--
-- 이전 마이그레이션 (20260424000000) 의 후속. 기존 5종 배지에 2종 추가
-- 하고, 코치 승인 RPC 를 확장해 다음 두 케이스에서도 자동 배지 지급:
--   1. current_streak >= 7 도달 시 → diet_streak_7
--   2. 해당 주(1~7 / 8~14 / 15~21) 안의 7일 모두 approved 시 → diet_perfect_week
--
-- 기존 RPC 흐름 유지 — 별도 테이블·컬럼 변경 없음.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 신규 배지 seed
-- ──────────────────────────────────────────────────────────────────
INSERT INTO public.badges (code, name, description) VALUES
  ('diet_streak_7',     '7일 연속',     '153 다이어트 7일 연속 승인'),
  ('diet_perfect_week', '완벽한 한 주', '한 주 7일 모두 승인')
ON CONFLICT (code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────────
-- B. review_diet_log 확장 — approved 경로에 streak·perfect_week 판정 추가
--    기존 로직(멱등 gem 지급, milestone 7/14/21, enrollment 완주 전환) 유지.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_diet_log(
  _log_id uuid,
  _action diet_log_status,
  _feedback text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _caller uuid := auth.uid();
  _log public.diet_daily_logs%ROWTYPE;
  _snap public.diet_progress_snapshots%ROWTYPE;
  _approved_new int;
  _reach_7 boolean;
  _reach_14 boolean;
  _reach_21 boolean;
  _new_streak int;
  _week_start int;
  _week_end int;
  _approved_in_week int;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _action NOT IN ('approved','rejected','revision_requested') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_action');
  END IF;

  SELECT * INTO _log FROM public.diet_daily_logs WHERE id = _log_id;
  IF _log.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;

  IF NOT (public.has_role(_caller,'super_admin') OR public.is_branch_manager_of(_caller, _log.user_id)) THEN
    RETURN jsonb_build_object('success',false,'error','not_authorized');
  END IF;

  UPDATE public.diet_daily_logs SET
    status = _action,
    coach_reviewed = true,
    coach_feedback = COALESCE(_feedback, coach_feedback),
    reviewed_by = _caller,
    reviewed_at = now()
  WHERE id = _log_id;

  PERFORM public.create_notification(
    _log.user_id,
    CASE _action
      WHEN 'approved' THEN '오늘의 식습관 기록이 승인되었어요'
      WHEN 'rejected' THEN '오늘의 식습관 기록이 반려되었어요'
      ELSE '식습관 기록에 수정 요청이 도착했어요'
    END,
    COALESCE(_feedback, '')
  );

  IF _action <> 'approved' THEN
    RETURN jsonb_build_object('success', true, 'action', _action, 'granted_gems', 0);
  END IF;

  -- ────────── approved 경로 ──────────
  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _log.enrollment_id;
  _approved_new := _snap.approved_days_total + 1;

  IF _snap.last_log_date IS NOT NULL AND _log.log_date = _snap.last_log_date + 1 THEN
    _new_streak := _snap.current_streak + 1;
  ELSIF _snap.last_log_date = _log.log_date THEN
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
    last_log_date = _log.log_date,
    updated_at = now()
  WHERE enrollment_id = _log.enrollment_id;

  PERFORM public.grant_gems(_log.user_id, 3, 'diet_checkin_approved');

  -- 누적 milestone 배지
  INSERT INTO public.member_badges (user_id, badge_id)
  SELECT _log.user_id, b.id
    FROM public.badges b
   WHERE b.code IN (
     CASE WHEN NOT _snap.milestone_7_reached  AND _reach_7  THEN 'diet_week_7'     END,
     CASE WHEN NOT _snap.milestone_14_reached AND _reach_14 THEN 'diet_week_14'    END,
     CASE WHEN NOT _snap.milestone_21_reached AND _reach_21 THEN 'diet_21_complete' END,
     CASE WHEN _snap.approved_days_total = 0 THEN 'diet_starter' END
   )
  ON CONFLICT DO NOTHING;

  -- ★ 신규: 연속 7일 배지 (최초 1회)
  IF _new_streak >= 7 THEN
    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _log.user_id, b.id FROM public.badges b
     WHERE b.code = 'diet_streak_7'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ★ 신규: 완벽한 한 주 배지 — 현재 log 가 속한 주(1~7/8~14/15~21)에서
  --        status='approved' 일수 >= 7 이면 지급.
  _week_start := ((_log.day_number - 1) / 7) * 7 + 1;
  _week_end   := _week_start + 6;
  SELECT COUNT(*) INTO _approved_in_week
    FROM public.diet_daily_logs
   WHERE enrollment_id = _log.enrollment_id
     AND day_number BETWEEN _week_start AND _week_end
     AND status = 'approved';
  IF _approved_in_week >= 7 THEN
    INSERT INTO public.member_badges (user_id, badge_id)
    SELECT _log.user_id, b.id FROM public.badges b
     WHERE b.code = 'diet_perfect_week'
    ON CONFLICT DO NOTHING;
  END IF;

  -- 21일 완주 전환 + 보너스
  IF _reach_21 AND NOT _snap.milestone_21_reached THEN
    UPDATE public.diet_program_enrollments
       SET status = 'completed', finished_at = now()
     WHERE id = _log.enrollment_id;
    PERFORM public.grant_gems(_log.user_id, 50, 'diet_21_complete');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'approved',
    'granted_gems', 3,
    'approved_days_total', _approved_new,
    'current_streak', _new_streak,
    'approved_in_current_week', _approved_in_week,
    'milestones_newly_reached', jsonb_build_object(
      'm7',  NOT _snap.milestone_7_reached AND _reach_7,
      'm14', NOT _snap.milestone_14_reached AND _reach_14,
      'm21', NOT _snap.milestone_21_reached AND _reach_21,
      'streak7', _new_streak = 7,
      'perfect_week', _approved_in_week = 7
    )
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- C. PostgREST schema 캐시 리로드
-- ──────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
