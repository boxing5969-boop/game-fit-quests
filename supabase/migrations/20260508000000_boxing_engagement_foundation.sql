-- ============================================================
-- 153 QUEST 몰입 레이어 v1 — 기반 (Phase 4)
-- ============================================================
-- 목적:
--   1~40 공식 훈련 시스템(levels/missions/mission_videos/mission_submissions/member_progress)
--   과 완전히 분리된 보조 몰입 레이어. QUEST XP / RP / 파이트 머니만 지급한다.
-- 보호 원칙:
--   - 공식 XP 미지급 (member_progress 일절 미수정)
--   - approve_mission_submission / record_attendance / useManualLevelUp 흐름 미사용
--   - 파이트 머니는 반드시 public.grant_gems(_user_id, _amount, _reason) RPC 경유
--   - 클라이언트가 보낸 amount 미신뢰 — 서버 측 row/내부 규칙으로 보상량 결정
--   - 모든 보상 이벤트는 boxing_engagement_events.unique(user_id, idempotency_key) 로 중복 차단
-- 권한 patterns:
--   has_role(auth.uid(), 'admin') / is_branch_manager_of(auth.uid(), target_user)
-- ============================================================

-- =====================================================================
-- 1. boxing_engagement_profiles
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_engagement_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_xp integer NOT NULL DEFAULT 0,
  respect_points integer NOT NULL DEFAULT 0,
  quiz_correct_count integer NOT NULL DEFAULT 0,
  quiz_attempt_count integer NOT NULL DEFAULT 0,
  challenge_clear_count integer NOT NULL DEFAULT 0,
  challenge_attempt_count integer NOT NULL DEFAULT 0,
  cheer_sent_count integer NOT NULL DEFAULT 0,
  cheer_received_count integer NOT NULL DEFAULT 0,
  journal_count integer NOT NULL DEFAULT 0,
  current_quiz_streak integer NOT NULL DEFAULT 0,
  best_quiz_streak integer NOT NULL DEFAULT 0,
  last_daily_briefing_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boxing_engagement_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. boxing_engagement_events  (모든 보조 보상 이벤트 원장)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  action text NOT NULL,
  quest_xp_delta integer NOT NULL DEFAULT 0,
  gems_delta integer NOT NULL DEFAULT 0,
  respect_delta integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_engagement_events_user_idem_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_boxing_engagement_events_user_created
  ON public.boxing_engagement_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxing_engagement_events_source
  ON public.boxing_engagement_events (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_boxing_engagement_events_event_type
  ON public.boxing_engagement_events (event_type);

ALTER TABLE public.boxing_engagement_events ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 3. boxing_quiz_questions
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  lesson_text text NOT NULL,
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  explanation text,
  difficulty text NOT NULL DEFAULT 'beginner',
  reward_quest_xp integer NOT NULL DEFAULT 30,
  reward_gems integer NOT NULL DEFAULT 100,
  retry_reward_quest_xp integer NOT NULL DEFAULT 10,
  retry_reward_gems integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_quiz_questions_type_chk
    CHECK (question_type IN ('multiple_choice','ox','order','situation')),
  CONSTRAINT boxing_quiz_questions_difficulty_chk
    CHECK (difficulty IN ('beginner','normal','advanced'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_quiz_questions_active_sort
  ON public.boxing_quiz_questions (active, sort_order);

ALTER TABLE public.boxing_quiz_questions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. boxing_quiz_attempts
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.boxing_quiz_questions(id) ON DELETE CASCADE,
  selected_answer text NOT NULL,
  is_correct boolean NOT NULL,
  attempt_no integer NOT NULL DEFAULT 1,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boxing_quiz_attempts_user_question
  ON public.boxing_quiz_attempts (user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_boxing_quiz_attempts_user_created
  ON public.boxing_quiz_attempts (user_id, created_at DESC);

ALTER TABLE public.boxing_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. boxing_fun_challenges
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_fun_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  target_metric text NOT NULL,
  duration_seconds integer,
  difficulty_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards_by_difficulty jsonb NOT NULL DEFAULT '{}'::jsonb,
  pain_check_required text[] NOT NULL DEFAULT '{}',
  high_intensity boolean NOT NULL DEFAULT false,
  safety_note text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_fun_challenges_category_chk
    CHECK (category IN ('jab','one_two','squat','pushup','sandbag','jump_rope','guard','combo','community','recovery'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_fun_challenges_active_sort
  ON public.boxing_fun_challenges (active, sort_order);

ALTER TABLE public.boxing_fun_challenges ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 6. boxing_fun_challenge_attempts
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_fun_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.boxing_fun_challenges(id) ON DELETE CASCADE,
  difficulty text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  submitted_value numeric NOT NULL DEFAULT 0,
  target_value numeric NOT NULL DEFAULT 0,
  pain_check_passed boolean NOT NULL DEFAULT true,
  note text,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_fun_challenge_attempts_difficulty_chk
    CHECK (difficulty IN ('beginner','normal','advanced')),
  CONSTRAINT boxing_fun_challenge_attempts_status_chk
    CHECK (status IN ('submitted','completed','failed','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_fun_challenge_attempts_user_created
  ON public.boxing_fun_challenge_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxing_fun_challenge_attempts_user_challenge
  ON public.boxing_fun_challenge_attempts (user_id, challenge_id);

ALTER TABLE public.boxing_fun_challenge_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 7. boxing_cheers
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cheer_type text NOT NULL,
  message text,
  source_type text,
  source_id uuid,
  respect_granted integer NOT NULL DEFAULT 0,
  gems_granted_to_receiver integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_cheers_no_self_cheer CHECK (sender_user_id <> receiver_user_id),
  CONSTRAINT boxing_cheers_type_chk CHECK (cheer_type IN ('clap','sticker','comment'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_cheers_sender_created
  ON public.boxing_cheers (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxing_cheers_receiver_created
  ON public.boxing_cheers (receiver_user_id, created_at DESC);

ALTER TABLE public.boxing_cheers ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 8. champion_journal_entries
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.champion_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  content text NOT NULL,
  mood text,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_champion_journal_entries_user_created
  ON public.champion_journal_entries (user_id, created_at DESC);

ALTER TABLE public.champion_journal_entries ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- updated_at trigger (engagement 도메인 전용 — 기존 트리거와 무관)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_engagement_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boxing_engagement_profiles_updated_at
  ON public.boxing_engagement_profiles;
CREATE TRIGGER trg_boxing_engagement_profiles_updated_at
  BEFORE UPDATE ON public.boxing_engagement_profiles
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_quiz_questions_updated_at
  ON public.boxing_quiz_questions;
CREATE TRIGGER trg_boxing_quiz_questions_updated_at
  BEFORE UPDATE ON public.boxing_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_fun_challenges_updated_at
  ON public.boxing_fun_challenges;
CREATE TRIGGER trg_boxing_fun_challenges_updated_at
  BEFORE UPDATE ON public.boxing_fun_challenges
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

-- =====================================================================
-- RLS 정책
-- 회원: 자기 데이터만 SELECT. 보상 이벤트/프로필 직접 INSERT/UPDATE 불가.
-- 관리자(admin) / 지점장(is_branch_manager_of): SELECT 허용.
-- 보상 이벤트/프로필 갱신은 SECURITY DEFINER RPC 가 수행 (RLS 우회).
-- =====================================================================

-- boxing_engagement_profiles
DROP POLICY IF EXISTS "engagement_profiles_select_self_or_admin"
  ON public.boxing_engagement_profiles;
CREATE POLICY "engagement_profiles_select_self_or_admin"
  ON public.boxing_engagement_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- 회원 직접 INSERT/UPDATE/DELETE 불가 → 정책 미생성 (RLS enabled = deny by default)

-- boxing_engagement_events
DROP POLICY IF EXISTS "engagement_events_select_self_or_admin"
  ON public.boxing_engagement_events;
CREATE POLICY "engagement_events_select_self_or_admin"
  ON public.boxing_engagement_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- boxing_quiz_questions: 회원은 active=true 만 조회. 관리자는 전체.
DROP POLICY IF EXISTS "quiz_questions_select_active_or_admin"
  ON public.boxing_quiz_questions;
CREATE POLICY "quiz_questions_select_active_or_admin"
  ON public.boxing_quiz_questions FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "quiz_questions_admin_manage"
  ON public.boxing_quiz_questions;
CREATE POLICY "quiz_questions_admin_manage"
  ON public.boxing_quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- boxing_quiz_attempts
DROP POLICY IF EXISTS "quiz_attempts_select_self_or_admin"
  ON public.boxing_quiz_attempts;
CREATE POLICY "quiz_attempts_select_self_or_admin"
  ON public.boxing_quiz_attempts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- boxing_fun_challenges: 회원은 active 만, 관리자는 전체
DROP POLICY IF EXISTS "fun_challenges_select_active_or_admin"
  ON public.boxing_fun_challenges;
CREATE POLICY "fun_challenges_select_active_or_admin"
  ON public.boxing_fun_challenges FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "fun_challenges_admin_manage"
  ON public.boxing_fun_challenges;
CREATE POLICY "fun_challenges_admin_manage"
  ON public.boxing_fun_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- boxing_fun_challenge_attempts
DROP POLICY IF EXISTS "fun_challenge_attempts_select_self_or_admin"
  ON public.boxing_fun_challenge_attempts;
CREATE POLICY "fun_challenge_attempts_select_self_or_admin"
  ON public.boxing_fun_challenge_attempts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- boxing_cheers: 보낸/받은 본인 + 관리자
DROP POLICY IF EXISTS "boxing_cheers_select_party_or_admin"
  ON public.boxing_cheers;
CREATE POLICY "boxing_cheers_select_party_or_admin"
  ON public.boxing_cheers FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR receiver_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- champion_journal_entries
DROP POLICY IF EXISTS "champion_journal_select_self_or_admin"
  ON public.champion_journal_entries;
CREATE POLICY "champion_journal_select_self_or_admin"
  ON public.champion_journal_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- =====================================================================
-- ensure_boxing_engagement_profile  helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ensure_boxing_engagement_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.boxing_engagement_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- =====================================================================
-- A. get_my_boxing_engagement_summary()
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_my_boxing_engagement_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.boxing_engagement_profiles%ROWTYPE;
  v_today_xp integer;
  v_today_gems integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  SELECT * INTO v_profile
  FROM public.boxing_engagement_profiles
  WHERE user_id = v_uid;

  SELECT
    COALESCE(SUM(quest_xp_delta), 0),
    COALESCE(SUM(gems_delta), 0)
  INTO v_today_xp, v_today_gems
  FROM public.boxing_engagement_events
  WHERE user_id = v_uid
    AND created_at >= (now() AT TIME ZONE 'Asia/Seoul')::date;

  RETURN jsonb_build_object(
    'success', true,
    'quest_xp', v_profile.quest_xp,
    'respect_points', v_profile.respect_points,
    'quiz_correct_count', v_profile.quiz_correct_count,
    'quiz_attempt_count', v_profile.quiz_attempt_count,
    'challenge_clear_count', v_profile.challenge_clear_count,
    'challenge_attempt_count', v_profile.challenge_attempt_count,
    'cheer_sent_count', v_profile.cheer_sent_count,
    'cheer_received_count', v_profile.cheer_received_count,
    'journal_count', v_profile.journal_count,
    'current_quiz_streak', v_profile.current_quiz_streak,
    'best_quiz_streak', v_profile.best_quiz_streak,
    'today_quest_xp', v_today_xp,
    'today_gems', v_today_gems,
    'last_daily_briefing_date', v_profile.last_daily_briefing_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_boxing_engagement_summary() TO authenticated;

-- =====================================================================
-- B. submit_boxing_quiz_attempt(p_question_id, p_selected_answer)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_boxing_quiz_attempt(
  p_question_id uuid,
  p_selected_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q public.boxing_quiz_questions%ROWTYPE;
  v_attempt_count integer;
  v_already_rewarded boolean;
  v_is_correct boolean;
  v_xp integer := 0;
  v_gems integer := 0;
  v_idem text;
  v_msg text;
  v_streak integer;
  v_best integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_selected_answer IS NULL OR length(trim(p_selected_answer)) = 0 THEN
    RAISE EXCEPTION 'selected_answer required';
  END IF;

  SELECT * INTO v_q FROM public.boxing_quiz_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_q.active = false THEN
    RAISE EXCEPTION 'question not available';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  SELECT COUNT(*) INTO v_attempt_count
  FROM public.boxing_quiz_attempts
  WHERE user_id = v_uid AND question_id = p_question_id;

  -- 이미 정답 보상 받은 적 있는가?
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
    WHERE user_id = v_uid
      AND source_type = 'boxing_quiz'
      AND source_id = p_question_id
      AND action IN ('quiz_first_correct','quiz_retry_correct')
  ) INTO v_already_rewarded;

  v_is_correct := (trim(p_selected_answer) = trim(v_q.correct_answer));

  IF v_is_correct THEN
    IF v_already_rewarded THEN
      v_xp := 0; v_gems := 0;
      v_msg := '이미 보상 받은 문제입니다. 정답!';
    ELSIF v_attempt_count = 0 THEN
      v_xp := v_q.reward_quest_xp;
      v_gems := v_q.reward_gems;
      v_msg := '정답! 알고 치는 펀치는 더 강합니다.';
    ELSE
      v_xp := v_q.retry_reward_quest_xp;
      v_gems := v_q.retry_reward_gems;
      v_msg := '재도전 정답! 포기하지 않는 자세가 좋습니다.';
    END IF;
  ELSE
    v_xp := 0; v_gems := 0;
    v_msg := concat('아쉽! 정답은 ', v_q.correct_answer, ' 입니다. 다시 도전해보세요.');
  END IF;

  -- attempt 기록
  INSERT INTO public.boxing_quiz_attempts (
    user_id, question_id, selected_answer, is_correct,
    attempt_no, quest_xp_granted, gems_granted
  ) VALUES (
    v_uid, p_question_id, p_selected_answer, v_is_correct,
    v_attempt_count + 1, v_xp, v_gems
  );

  -- 보상 이벤트 idempotency: 정답 보상은 question 단위 1회
  IF v_is_correct AND NOT v_already_rewarded THEN
    v_idem := concat(
      'quiz_correct:',
      v_uid::text, ':', p_question_id::text
    );

    INSERT INTO public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) VALUES (
      v_uid,
      'reward',
      'boxing_quiz',
      p_question_id,
      CASE WHEN v_attempt_count = 0 THEN 'quiz_first_correct' ELSE 'quiz_retry_correct' END,
      v_xp, v_gems, 0, v_idem,
      jsonb_build_object('attempt_no', v_attempt_count + 1)
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    -- 파이트 머니는 grant_gems RPC 경유
    IF v_gems > 0 THEN
      PERFORM public.grant_gems(v_uid, v_gems, '복싱 IQ 퀴즈 정답');
    END IF;
  END IF;

  -- 프로필 누적 (streak: 정답시 +1, 오답시 0 으로 reset)
  IF v_is_correct THEN
    SELECT current_quiz_streak + 1, GREATEST(best_quiz_streak, current_quiz_streak + 1)
    INTO v_streak, v_best
    FROM public.boxing_engagement_profiles WHERE user_id = v_uid;

    UPDATE public.boxing_engagement_profiles
    SET quiz_attempt_count = quiz_attempt_count + 1,
        quiz_correct_count = quiz_correct_count + 1,
        quest_xp = quest_xp + v_xp,
        current_quiz_streak = v_streak,
        best_quiz_streak = v_best
    WHERE user_id = v_uid;
  ELSE
    UPDATE public.boxing_engagement_profiles
    SET quiz_attempt_count = quiz_attempt_count + 1,
        current_quiz_streak = 0
    WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'already_rewarded', v_already_rewarded,
    'attempt_no', v_attempt_count + 1,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'correct_answer', v_q.correct_answer,
    'explanation', v_q.explanation,
    'message', v_msg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_boxing_quiz_attempt(uuid, text) TO authenticated;

-- =====================================================================
-- C. submit_boxing_fun_challenge_attempt
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_boxing_fun_challenge_attempt(
  p_challenge_id uuid,
  p_difficulty text,
  p_submitted_value numeric,
  p_pain_check_passed boolean DEFAULT true,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c public.boxing_fun_challenges%ROWTYPE;
  v_target numeric;
  v_status text;
  v_xp integer := 0;
  v_gems integer := 0;
  v_today_count integer;
  v_today_limit integer;
  v_daily_limit_reached boolean := false;
  v_idem text;
  v_attempt_id uuid := gen_random_uuid();
  v_pain_required boolean;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_difficulty NOT IN ('beginner','normal','advanced') THEN
    RAISE EXCEPTION 'invalid difficulty';
  END IF;

  SELECT * INTO v_c FROM public.boxing_fun_challenges WHERE id = p_challenge_id;
  IF NOT FOUND OR v_c.active = false THEN
    RAISE EXCEPTION 'challenge not available';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  v_target := COALESCE((v_c.difficulty_targets ->> p_difficulty)::numeric, 0);

  v_pain_required := array_length(v_c.pain_check_required, 1) IS NOT NULL;

  -- pain check 실패 시 보상 0, status=rejected
  IF v_pain_required AND p_pain_check_passed = false THEN
    v_status := 'rejected';
    v_xp := 0; v_gems := 0;
    v_msg := '통증 체크 실패. 안전을 위해 오늘은 보상이 지급되지 않습니다.';
  ELSE
    IF p_submitted_value >= v_target AND v_target > 0 THEN
      v_status := 'completed';
    ELSE
      v_status := 'failed';
    END IF;

    -- daily reward limit
    v_today_limit := CASE WHEN v_c.high_intensity THEN 1 ELSE 3 END;

    SELECT COUNT(*) INTO v_today_count
    FROM public.boxing_fun_challenge_attempts a
    WHERE a.user_id = v_uid
      AND a.challenge_id = p_challenge_id
      AND a.status = 'completed'
      AND a.quest_xp_granted > 0
      AND a.created_at >= (now() AT TIME ZONE 'Asia/Seoul')::date;

    IF v_today_count >= v_today_limit THEN
      v_daily_limit_reached := true;
    END IF;

    IF v_status = 'completed' AND NOT v_daily_limit_reached THEN
      v_xp := COALESCE(((v_c.rewards_by_difficulty -> p_difficulty) ->> 'quest_xp')::integer, 0);
      v_gems := COALESCE(((v_c.rewards_by_difficulty -> p_difficulty) ->> 'gems')::integer, 0);
      v_msg := '챌린지 클리어! 오늘의 라운드가 기록되었습니다.';
    ELSIF v_status = 'completed' AND v_daily_limit_reached THEN
      v_xp := 0; v_gems := 0;
      v_msg := '오늘 이 챌린지의 보상 한도를 모두 채웠습니다. 기록은 저장됩니다.';
    ELSE
      v_xp := 0; v_gems := 0;
      v_msg := '아직 목표에 못 미쳤어요. 다시 한 번!';
    END IF;
  END IF;

  -- attempt insert
  INSERT INTO public.boxing_fun_challenge_attempts (
    id, user_id, challenge_id, difficulty, status,
    submitted_value, target_value, pain_check_passed, note,
    quest_xp_granted, gems_granted
  ) VALUES (
    v_attempt_id, v_uid, p_challenge_id, p_difficulty, v_status,
    p_submitted_value, v_target, p_pain_check_passed, p_note,
    v_xp, v_gems
  );

  IF v_xp > 0 OR v_gems > 0 THEN
    v_idem := concat(
      'fun_challenge:',
      v_uid::text, ':',
      p_challenge_id::text, ':',
      v_attempt_id::text
    );

    INSERT INTO public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) VALUES (
      v_uid,
      'reward',
      'boxing_fun_challenge',
      p_challenge_id,
      'fun_challenge_completed',
      v_xp, v_gems, 0, v_idem,
      jsonb_build_object(
        'difficulty', p_difficulty,
        'attempt_id', v_attempt_id,
        'submitted_value', p_submitted_value,
        'target_value', v_target
      )
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    IF v_gems > 0 THEN
      PERFORM public.grant_gems(v_uid, v_gems, concat('재미 챌린지: ', v_c.title));
    END IF;
  END IF;

  -- profile 누적
  UPDATE public.boxing_engagement_profiles
  SET challenge_attempt_count = challenge_attempt_count + 1,
      challenge_clear_count = challenge_clear_count + CASE WHEN v_status = 'completed' THEN 1 ELSE 0 END,
      quest_xp = quest_xp + v_xp
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'target_value', v_target,
    'submitted_value', p_submitted_value,
    'daily_limit_reached', v_daily_limit_reached,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'message', v_msg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_boxing_fun_challenge_attempt(uuid, text, numeric, boolean, text) TO authenticated;

-- =====================================================================
-- D. submit_champion_journal_entry
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_champion_journal_entry(
  p_prompt text,
  p_content text,
  p_mood text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_first_today boolean;
  v_xp integer := 0;
  v_gems integer := 0;
  v_entry_id uuid := gen_random_uuid();
  v_idem text;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'content required';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.champion_journal_entries
    WHERE user_id = v_uid
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today
  ) INTO v_first_today;

  IF v_first_today THEN
    v_xp := 20;
    v_gems := 50;
  END IF;

  INSERT INTO public.champion_journal_entries (
    id, user_id, prompt, content, mood, quest_xp_granted, gems_granted
  ) VALUES (
    v_entry_id, v_uid, p_prompt, p_content, p_mood, v_xp, v_gems
  );

  IF v_xp > 0 OR v_gems > 0 THEN
    v_idem := concat('journal_daily:', v_uid::text, ':', to_char(v_today, 'YYYY-MM-DD'));

    INSERT INTO public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) VALUES (
      v_uid,
      'reward',
      'champion_journal',
      v_entry_id,
      'journal_first_of_day',
      v_xp, v_gems, 0, v_idem,
      jsonb_build_object('date', v_today)
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    IF v_gems > 0 THEN
      PERFORM public.grant_gems(v_uid, v_gems, '챔피언 일기 첫 작성');
    END IF;
  END IF;

  UPDATE public.boxing_engagement_profiles
  SET journal_count = journal_count + 1,
      quest_xp = quest_xp + v_xp
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'first_of_day', v_first_today,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'entry_id', v_entry_id,
    'message', CASE WHEN v_first_today
                    THEN '오늘의 첫 일기 기록 완료. 챔피언의 한 줄.'
                    ELSE '추가 일기 기록 완료. 보상은 하루 1회입니다.'
               END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_champion_journal_entry(text, text, text) TO authenticated;

-- =====================================================================
-- E. send_boxing_cheer
-- =====================================================================
CREATE OR REPLACE FUNCTION public.send_boxing_cheer(
  p_receiver_user_id uuid,
  p_cheer_type text,
  p_message text DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_total_today integer;
  v_to_receiver_today integer;
  v_respect integer := 0;
  v_receiver_gems integer := 0;
  v_cheer_id uuid := gen_random_uuid();
  v_idem text;
  v_receiver_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_receiver_user_id IS NULL THEN
    RAISE EXCEPTION 'receiver required';
  END IF;
  IF p_receiver_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot cheer yourself';
  END IF;
  IF p_cheer_type NOT IN ('clap','sticker','comment') THEN
    RAISE EXCEPTION 'invalid cheer_type';
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_receiver_user_id) INTO v_receiver_exists;
  IF NOT v_receiver_exists THEN
    RAISE EXCEPTION 'receiver not found';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(p_receiver_user_id);

  -- 보낸 사람 일일 RP 보상 인정 횟수 (총 20회)
  SELECT COUNT(*) INTO v_total_today
  FROM public.boxing_cheers
  WHERE sender_user_id = v_uid
    AND respect_granted > 0
    AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today;

  -- 같은 receiver 일일 인정 횟수 (3회)
  SELECT COUNT(*) INTO v_to_receiver_today
  FROM public.boxing_cheers
  WHERE sender_user_id = v_uid
    AND receiver_user_id = p_receiver_user_id
    AND respect_granted > 0
    AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today;

  IF v_total_today < 20 AND v_to_receiver_today < 3 THEN
    v_respect := 5;
    -- 받은 사람 파이트 머니: 파밍 위험 최소화 위해 v1 은 0. TODO: 일일 수령 한도 + 같은 sender 디바운스 후 활성화.
    v_receiver_gems := 0;
  END IF;

  INSERT INTO public.boxing_cheers (
    id, sender_user_id, receiver_user_id, cheer_type, message,
    source_type, source_id, respect_granted, gems_granted_to_receiver
  ) VALUES (
    v_cheer_id, v_uid, p_receiver_user_id, p_cheer_type, p_message,
    p_source_type, p_source_id, v_respect, v_receiver_gems
  );

  IF v_respect > 0 THEN
    -- sender RP 이벤트
    v_idem := concat('cheer_send:', v_cheer_id::text);
    INSERT INTO public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) VALUES (
      v_uid,
      'reward',
      'boxing_cheer',
      v_cheer_id,
      'cheer_sent',
      0, 0, v_respect, v_idem,
      jsonb_build_object('receiver', p_receiver_user_id, 'cheer_type', p_cheer_type)
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    -- receiver respect 이벤트 (받음 RP +1, gems 는 v1 에서 0)
    INSERT INTO public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) VALUES (
      p_receiver_user_id,
      'reward',
      'boxing_cheer',
      v_cheer_id,
      'cheer_received',
      0, v_receiver_gems, 1,
      concat('cheer_recv:', v_cheer_id::text),
      jsonb_build_object('sender', v_uid, 'cheer_type', p_cheer_type)
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    -- profile 누적
    UPDATE public.boxing_engagement_profiles
    SET cheer_sent_count = cheer_sent_count + 1,
        respect_points = respect_points + v_respect
    WHERE user_id = v_uid;

    UPDATE public.boxing_engagement_profiles
    SET cheer_received_count = cheer_received_count + 1,
        respect_points = respect_points + 1
    WHERE user_id = p_receiver_user_id;
  ELSE
    -- 한도 초과 시 기록만 남기고 카운터는 sent 1 만 (RP 인정 없음)
    UPDATE public.boxing_engagement_profiles
    SET cheer_sent_count = cheer_sent_count + 1
    WHERE user_id = v_uid;
    UPDATE public.boxing_engagement_profiles
    SET cheer_received_count = cheer_received_count + 1
    WHERE user_id = p_receiver_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cheer_id', v_cheer_id,
    'respect_granted', v_respect,
    'receiver_gems_granted', v_receiver_gems,
    'sender_daily_count_today', v_total_today + 1,
    'limit_reached', v_respect = 0,
    'message', CASE WHEN v_respect > 0 THEN '응원 전송!' ELSE '오늘 응원 한도를 모두 사용했어요. 기록은 남습니다.' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_boxing_cheer(uuid, text, text, text, uuid) TO authenticated;

-- =====================================================================
-- SEED — boxing_quiz_questions (자체 제작 콘텐츠. 실존 인물/명언/저작물 미사용)
-- =====================================================================
INSERT INTO public.boxing_quiz_questions (
  category, title, lesson_text, question, question_type, options, correct_answer,
  explanation, difficulty, reward_quest_xp, reward_gems,
  retry_reward_quest_xp, retry_reward_gems, sort_order
) VALUES
('기본 기술', '잽의 역할',
 '잽은 단순히 약한 펀치가 아니라 거리를 재고 다음 공격을 여는 시작 버튼입니다.',
 '잽의 가장 중요한 역할은?',
 'multiple_choice',
 '["무조건 강하게 치기","거리 확인과 공격 시작 만들기","팔을 오래 뻗어두기","뒤로 물러나기"]'::jsonb,
 '거리 확인과 공격 시작 만들기',
 '잽은 상대와의 간격을 측정하고 다음 펀치 흐름을 여는 가장 기본적인 기술입니다.',
 'beginner', 30, 100, 10, 30, 1),

('기본 기술', '원투의 순서',
 '원투는 잽으로 거리를 만든 뒤 스트레이트로 마무리하는 기본 콤비네이션입니다.',
 '원투의 올바른 순서는?',
 'multiple_choice',
 '["훅 → 잽","잽 → 스트레이트","스트레이트 → 어퍼컷","바디 → 훅"]'::jsonb,
 '잽 → 스트레이트',
 '잽으로 거리를 잡고 스트레이트로 정확하게 꽂는 가장 기본적인 콤비네이션입니다.',
 'beginner', 30, 100, 10, 30, 2),

('안전 교육', '샌드백 안전',
 '손목이 꺾인 상태로 강한 펀치를 치면 손목 부상이 매우 쉽게 발생합니다.',
 '샌드백을 칠 때 가장 위험한 습관은?',
 'multiple_choice',
 '["손목을 곧게 유지하기","펀치 후 가드로 돌아오기","손목이 꺾인 상태로 강하게 치기","호흡을 짧게 내쉬기"]'::jsonb,
 '손목이 꺾인 상태로 강하게 치기',
 '핸드랩과 글러브 안에서도 손목 정렬은 직접 만들어야 합니다. 정렬이 무너진 상태의 강타는 부상의 가장 큰 원인입니다.',
 'beginner', 30, 100, 10, 30, 3),

('매너', '스파링 매너',
 '스파링은 시합이 아니라 함께 배우는 시간입니다.',
 '스파링의 목적은?',
 'multiple_choice',
 '["상대를 다치게 하는 것","함께 배우고 안전하게 성장하는 것","무조건 이기는 것","세게 치는 것"]'::jsonb,
 '함께 배우고 안전하게 성장하는 것',
 '스파링은 기술과 거리감을 함께 다듬는 협업입니다. 상대를 부수는 자리가 아닙니다.',
 'beginner', 30, 100, 10, 30, 4),

('방어 기술', '가드 복귀',
 '펀치를 뻗은 직후가 가장 무방비한 순간입니다.',
 '잽을 뻗은 뒤 가장 중요한 행동은?',
 'multiple_choice',
 '["팔을 계속 뻗어두기","바로 가드로 회수하기","고개를 뒤로 젖히기","발을 멈추기"]'::jsonb,
 '바로 가드로 회수하기',
 '한 손이 나간 상태는 같은 쪽 얼굴이 비어 있습니다. 회수 속도가 곧 방어입니다.',
 'beginner', 30, 100, 10, 30, 5),

('풋워크', '풋워크의 이유',
 '복싱은 발에서 펀치가 시작됩니다.',
 '복싱에서 발의 움직임이 중요한 이유는?',
 'multiple_choice',
 '["멋있어 보이기 위해","거리와 균형을 조절하기 위해","팔 힘을 빼기 위해","라운드를 짧게 만들기 위해"]'::jsonb,
 '거리와 균형을 조절하기 위해',
 '풋워크는 거리 만들기, 균형 유지, 각도 변경의 핵심 도구입니다.',
 'beginner', 30, 100, 10, 30, 6),

('멘탈', '호흡',
 '짧은 날숨은 코어를 잠그고 펀치 끝에 힘을 실어줍니다.',
 '펀치를 칠 때 호흡은 어떻게 하는 것이 좋은가?',
 'multiple_choice',
 '["숨을 오래 참는다","짧게 내쉬며 힘을 전달한다","입을 크게 벌린다","숨을 완전히 멈춘다"]'::jsonb,
 '짧게 내쉬며 힘을 전달한다',
 '짧은 날숨은 복압을 만들어 펀치 강도와 안전을 동시에 올립니다.',
 'beginner', 30, 100, 10, 30, 7),

('장비 지식', '핸드랩',
 '핸드랩은 손목과 주먹의 관절을 한 묶음으로 잡아주는 장비입니다.',
 '핸드랩을 착용하는 가장 중요한 이유는?',
 'multiple_choice',
 '["손목과 주먹 보호","글러브를 무겁게 만들기","땀을 감추기","펀치를 무조건 강하게 만들기"]'::jsonb,
 '손목과 주먹 보호',
 '핸드랩은 미세 골절을 막고 손목 정렬을 도와주는 가장 중요한 보호 장비입니다.',
 'beginner', 30, 100, 10, 30, 8)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- SEED — boxing_fun_challenges
-- =====================================================================
INSERT INTO public.boxing_fun_challenges (
  code, title, description, category, target_metric, duration_seconds,
  difficulty_targets, rewards_by_difficulty, pain_check_required,
  high_intensity, safety_note, sort_order
) VALUES
('lightning_jab', '번개 잽 챌린지',
 '30초 동안 정확한 잽을 가능한 많이! 손목 정렬을 잃지 않는 것이 진짜 챔피언.',
 'jab', 'count', 30,
 '{"beginner":30,"normal":50,"advanced":70}'::jsonb,
 '{"beginner":{"quest_xp":80,"gems":200},"normal":{"quest_xp":150,"gems":500},"advanced":{"quest_xp":300,"gems":1000}}'::jsonb,
 ARRAY['shoulder','wrist'],
 false,
 '어깨나 손목 통증이 있으면 즉시 중단하세요.',
 1),

('one_two_burst', '원투 폭발 챌린지',
 '60초 동안 원투 콤비네이션을 깔끔하게! 회수까지가 한 셋.',
 'one_two', 'count', 60,
 '{"beginner":20,"normal":35,"advanced":50}'::jsonb,
 '{"beginner":{"quest_xp":100,"gems":250},"normal":{"quest_xp":180,"gems":600},"advanced":{"quest_xp":350,"gems":1200}}'::jsonb,
 ARRAY['shoulder','wrist'],
 false,
 '원투는 한 동작입니다. 회수가 빠진 콤보는 카운트하지 마세요.',
 2),

('squat_engine', '하체 엔진 스쿼트 챌린지',
 '60초 동안 정직한 스쿼트! 깊이를 줄여서 횟수를 늘리지 마세요.',
 'squat', 'count', 60,
 '{"beginner":20,"normal":40,"advanced":60}'::jsonb,
 '{"beginner":{"quest_xp":80,"gems":200},"normal":{"quest_xp":150,"gems":500},"advanced":{"quest_xp":280,"gems":1000}}'::jsonb,
 ARRAY['knee','back'],
 false,
 '무릎이나 허리 통증이 느껴지면 즉시 중단하고 횟수를 낮춰주세요.',
 3),

('iron_pushup', '강철 주먹 푸시업 챌린지',
 '60초 동안 푸시업. 무릎 푸시업도 인정 — 자세가 우선입니다.',
 'pushup', 'count', 60,
 '{"beginner":10,"normal":25,"advanced":40}'::jsonb,
 '{"beginner":{"quest_xp":80,"gems":200},"normal":{"quest_xp":150,"gems":500},"advanced":{"quest_xp":280,"gems":1000}}'::jsonb,
 ARRAY['wrist','shoulder'],
 false,
 '무릎 푸시업도 한 개로 인정. 손목/어깨 통증이 있으면 무조건 중단.',
 4),

('sandbag_round', '샌드백 라운드 챌린지',
 '한 라운드는 3분. 라운드 사이는 충분히 쉬어주세요.',
 'sandbag', 'rounds', 180,
 '{"beginner":1,"normal":2,"advanced":3}'::jsonb,
 '{"beginner":{"quest_xp":150,"gems":400},"normal":{"quest_xp":280,"gems":900},"advanced":{"quest_xp":500,"gems":1800}}'::jsonb,
 ARRAY['wrist','shoulder'],
 true,
 '고강도 챌린지. 핸드랩 + 글러브 필수. 손목 정렬 무너지면 멈추세요.',
 5),

('rhythm_jump_rope', '리듬 파이터 줄넘기 챌린지',
 '리듬을 만드는 줄넘기. 분 단위 기록.',
 'jump_rope', 'minutes', NULL,
 '{"beginner":1,"normal":3,"advanced":5}'::jsonb,
 '{"beginner":{"quest_xp":60,"gems":150},"normal":{"quest_xp":140,"gems":450},"advanced":{"quest_xp":260,"gems":900}}'::jsonb,
 ARRAY[]::text[],
 false,
 '바닥이 단단하면 무릎이 부담을 받습니다. 매트나 적절한 신발 권장.',
 6),

('iron_guard', '강철 가드 챌린지',
 '가드를 무너뜨리지 않고 버티기. 분 단위 기록.',
 'guard', 'minutes', NULL,
 '{"beginner":1,"normal":2,"advanced":3}'::jsonb,
 '{"beginner":{"quest_xp":50,"gems":120},"normal":{"quest_xp":120,"gems":350},"advanced":{"quest_xp":220,"gems":700}}'::jsonb,
 ARRAY[]::text[],
 false,
 '어깨가 떨어지지 않게. 시야는 항상 정면.',
 7),

('combo_master', '콤보 마스터 챌린지',
 '서로 다른 콤보를 정확하게 몇 개나 칠 수 있나? 회수까지 포함.',
 'combo', 'combos', NULL,
 '{"beginner":3,"normal":5,"advanced":8}'::jsonb,
 '{"beginner":{"quest_xp":100,"gems":250},"normal":{"quest_xp":180,"gems":600},"advanced":{"quest_xp":320,"gems":1100}}'::jsonb,
 ARRAY['shoulder','wrist'],
 false,
 '같은 콤보 반복은 1로 카운트. 정확도가 우선.',
 8)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 자체 검증 노트 (SQL Editor 에서는 auth.uid() 가 NULL 임에 유의)
-- ---------------------------------------------------------------------
-- 1) SELECT * FROM public.boxing_quiz_questions WHERE active = true;       -- 회원 세션에서 8개 보여야 함
-- 2) SELECT * FROM public.boxing_fun_challenges WHERE active = true;       -- 회원 세션에서 8개 보여야 함
-- 3) (앱 세션) SELECT public.get_my_boxing_engagement_summary();           -- 프로필 자동 생성 + 0 값
-- 4) (앱 세션) SELECT public.submit_boxing_quiz_attempt('<id>','정답');     -- attempts/events insert + grant_gems
-- 5) (앱 세션) 동일 question 두 번 정답 → already_rewarded=true, gems=0
-- 6) member_progress / levels / missions / mission_submissions 변동 없음 (DDL/DML 모두)
-- ============================================================
