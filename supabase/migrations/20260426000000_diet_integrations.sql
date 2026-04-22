-- ══════════════════════════════════════════════════════════════════
-- 153 다이어트 — 기존 앱과의 통합 레이어 (Stage 7)
--
-- 이 마이그레이션은 기존 테이블/RPC 를 파괴적으로 수정하지 않고,
-- 분석 이벤트 로그와 환경설정 테이블을 추가한다. 또한 리더보드 RPC
-- `get_diet_ranking` 에 ranking_visible 설정 필터만 조건부로 붙여
-- 기존 시그니처를 유지한다.
--
-- 변경 요약
--   A. diet_analytics_events — 분석 이벤트 로그 (append-only)
--   B. diet_preferences       — 사용자별 설정 (리마인더/알림/프라이버시)
--   C. RPC 3종 (log_diet_event, get_diet_preferences, upsert_diet_preferences)
--   D. get_diet_ranking 확장 — privacy.ranking_visible=false 제외
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 분석 이벤트 로그
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_events_user ON public.diet_analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diet_events_type ON public.diet_analytics_events(event_type, created_at DESC);

ALTER TABLE public.diet_analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diet_events_read ON public.diet_analytics_events;
CREATE POLICY diet_events_read ON public.diet_analytics_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS diet_events_insert_own ON public.diet_analytics_events;
CREATE POLICY diet_events_insert_own ON public.diet_analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────
-- B. 사용자 환경설정
--   jsonb 로 저장해 미래 확장 시 컬럼 추가 없이 가능.
--   기본값은 클라이언트가 보정 — DB 는 순수 저장소.
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diet_prefs_read ON public.diet_preferences;
CREATE POLICY diet_prefs_read ON public.diet_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS diet_prefs_upsert_own ON public.diet_preferences;
CREATE POLICY diet_prefs_upsert_own ON public.diet_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS diet_prefs_update_own ON public.diet_preferences;
CREATE POLICY diet_prefs_update_own ON public.diet_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────
-- C. RPCs
-- ──────────────────────────────────────────────────────────────────

-- C.1 이벤트 로그 (best-effort)
CREATE OR REPLACE FUNCTION public.log_diet_event(
  _event_type text,
  _event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _event_type IS NULL OR _event_type = '' THEN
    RETURN jsonb_build_object('success',false,'error','invalid_type');
  END IF;
  INSERT INTO public.diet_analytics_events (user_id, event_type, event_data)
  VALUES (_uid, _event_type, COALESCE(_event_data, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN jsonb_build_object('success', true, 'event_id', _id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_diet_event(text, jsonb) TO authenticated;

-- C.2 설정 조회 (없으면 빈 jsonb)
CREATE OR REPLACE FUNCTION public.get_diet_preferences()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _settings jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT settings INTO _settings FROM public.diet_preferences WHERE user_id = _uid;
  RETURN jsonb_build_object('success', true, 'settings', COALESCE(_settings, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_diet_preferences() TO authenticated;

-- C.3 설정 upsert
CREATE OR REPLACE FUNCTION public.upsert_diet_preferences(_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  INSERT INTO public.diet_preferences (user_id, settings, updated_at)
  VALUES (_uid, COALESCE(_settings, '{}'::jsonb), now())
  ON CONFLICT (user_id) DO UPDATE SET
    settings = EXCLUDED.settings,
    updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_diet_preferences(jsonb) TO authenticated;


-- ──────────────────────────────────────────────────────────────────
-- D. get_diet_ranking 확장 — privacy.ranking_visible=false 제외
--    기존 시그니처/컬럼 그대로 유지, WHERE 절에 LEFT JOIN 조건만 추가.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_diet_ranking(
  _branch_name text,
  _limit int DEFAULT 50
)
RETURNS TABLE (
  rank_position int,
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_approved_days int,
  r_best_streak int,
  r_habit_score int,
  r_completion_rate int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY s.approved_days_total DESC, s.best_streak DESC, p.nickname ASC
    )::int AS rank_position,
    s.user_id,
    p.nickname,
    p.avatar_url,
    s.approved_days_total,
    s.best_streak,
    COALESCE(s.habit_score, 0),
    LEAST(100, ROUND((s.approved_days_total::numeric / 21) * 100)::int)
  FROM public.diet_progress_snapshots s
  JOIN public.diet_program_enrollments e ON e.id = s.enrollment_id AND e.status IN ('active','completed')
  JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.diet_preferences pref ON pref.user_id = s.user_id
  WHERE p.branch_name = _branch_name
    AND COALESCE((pref.settings->'privacy'->>'ranking_visible')::boolean, true) = true
  ORDER BY s.approved_days_total DESC, s.best_streak DESC, p.nickname ASC
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- E. PostgREST schema 캐시 리로드
-- ──────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
