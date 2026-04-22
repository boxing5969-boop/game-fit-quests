-- ══════════════════════════════════════════════════════════════════
-- 153 다이어트 프로그램 — Foundation (Stage 2)
--
-- 참고: docs/153-diet-implementation-plan.md
--
-- 이 마이그레이션은 기존 테이블을 건드리지 않고 다이어트 모듈 전용
-- 스키마만 추가한다. 기존 profiles / member_progress / user_wallets /
-- wallet_transactions / badges / member_badges / notifications / mission_submissions
-- 는 무수정.
--
-- 안전 장치 요약
--   1. 청소년(youth_habit) 트랙은 advanced_feature_enabled 강제 false
--   2. 체중/칼로리 컬럼 없음 (랭킹 = 승인된 일수/완주율만)
--   3. profiles.diet_program_enabled feature flag 기본 false
--   4. 모든 RPC 는 SECURITY DEFINER + SET search_path='public' + auth.uid() 기반
--   5. 모든 쓰기 경로는 RPC 경유 (RLS 직접 INSERT 는 자기 데이터만 허용)
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- Section A. ENUMs
-- ──────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE public.diet_track AS ENUM ('adult_standard','adult_advanced_hidden','youth_habit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_stage AS ENUM ('reset','burning','lifestyle'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_enrollment_status AS ENUM ('not_started','active','paused','completed','dropped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_log_status AS ENUM ('pending','approved','rejected','revision_requested'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_coach_note_template AS ENUM ('general','warning','celebration','correction','weekly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_meal_slot AS ENUM ('breakfast','lunch','dinner','snack'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.diet_age_group AS ENUM ('youth','adult'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────────
-- Section B. profiles.diet_program_enabled feature flag
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diet_program_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.diet_program_enabled IS
  '153 다이어트 모듈 노출 플래그. 기본 false. 롤아웃 시 super_admin 이 토글.';


-- ──────────────────────────────────────────────────────────────────
-- Section C. Tables
-- ──────────────────────────────────────────────────────────────────

-- C.1 Safety screening (enrollment 선행 조건)
CREATE TABLE IF NOT EXISTS public.diet_safety_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age_group diet_age_group NOT NULL,
  is_youth boolean NOT NULL,
  pregnancy_breastfeeding boolean NOT NULL DEFAULT false,
  diabetes_medication boolean NOT NULL DEFAULT false,
  eating_disorder_risk boolean NOT NULL DEFAULT false,
  other_conditions text,
  consent_accepted boolean NOT NULL DEFAULT false,
  consent_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_safety_user ON public.diet_safety_screenings(user_id, created_at DESC);

-- C.2 Enrollment
CREATE TABLE IF NOT EXISTS public.diet_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track diet_track NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_day integer NOT NULL DEFAULT 1 CHECK (current_day BETWEEN 1 AND 21),
  current_stage diet_stage NOT NULL DEFAULT 'reset',
  status diet_enrollment_status NOT NULL DEFAULT 'not_started',
  coach_assigned_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  screening_id uuid REFERENCES public.diet_safety_screenings(id) ON DELETE SET NULL,
  warning_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  advanced_feature_enabled boolean NOT NULL DEFAULT false,
  branch_name text,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 한 회원은 active/paused/not_started 상태 enrollment 최대 1개
CREATE UNIQUE INDEX IF NOT EXISTS uniq_diet_active_enrollment
  ON public.diet_program_enrollments(user_id)
  WHERE status IN ('not_started','active','paused');

CREATE INDEX IF NOT EXISTS idx_diet_enrollment_coach ON public.diet_program_enrollments(coach_assigned_id) WHERE coach_assigned_id IS NOT NULL;

-- C.3 Daily log
CREATE TABLE IF NOT EXISTS public.diet_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.diet_program_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 21),
  -- 수치 측정 (선택)
  water_ml integer CHECK (water_ml IS NULL OR (water_ml >= 0 AND water_ml <= 10000)),
  step_count integer CHECK (step_count IS NULL OR step_count >= 0),
  sleep_hours numeric(3,1) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  -- 5 핵심 습관 (체크박스)
  protein_first boolean,
  veggies_natural boolean,
  sugary_drink_avoided boolean,
  late_night_snack_avoided boolean,
  gym_attended boolean,
  -- 자유 기입
  mood text,
  memo text,
  -- 코치 검토
  status diet_log_status NOT NULL DEFAULT 'pending',
  coach_reviewed boolean NOT NULL DEFAULT false,
  coach_feedback text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date ON public.diet_daily_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_diet_logs_status ON public.diet_daily_logs(status, submitted_at DESC) WHERE status = 'pending';

-- C.4 Log photos (1:N, 식사별 사진)
CREATE TABLE IF NOT EXISTS public.diet_daily_log_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.diet_daily_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  meal_slot diet_meal_slot NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_photos_log ON public.diet_daily_log_photos(log_id);

-- C.5 Weekly reviews
CREATE TABLE IF NOT EXISTS public.diet_weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.diet_program_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_index integer NOT NULL CHECK (week_index BETWEEN 1 AND 3),
  waist_cm numeric(5,1),           -- 선택, 입력 가능. 랭킹에 사용 안 함
  body_photo_url text,             -- 선택
  reflection text,
  adherence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_week_focus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, week_index)
);

-- C.6 Coach notes
CREATE TABLE IF NOT EXISTS public.diet_coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.diet_program_enrollments(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  template_type diet_coach_note_template NOT NULL DEFAULT 'general',
  visibility text NOT NULL DEFAULT 'member_visible' CHECK (visibility IN ('private','member_visible')),
  related_log_id uuid REFERENCES public.diet_daily_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_coach_notes_recipient ON public.diet_coach_notes(recipient_user_id, created_at DESC);

-- C.7 Progress snapshot (per enrollment)
CREATE TABLE IF NOT EXISTS public.diet_progress_snapshots (
  enrollment_id uuid PRIMARY KEY REFERENCES public.diet_program_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  approved_days_total integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  milestone_7_reached boolean NOT NULL DEFAULT false,
  milestone_14_reached boolean NOT NULL DEFAULT false,
  milestone_21_reached boolean NOT NULL DEFAULT false,
  habit_score integer CHECK (habit_score IS NULL OR (habit_score BETWEEN 0 AND 100)),
  last_log_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_snapshots_user ON public.diet_progress_snapshots(user_id);


-- ──────────────────────────────────────────────────────────────────
-- Section D. Integrity triggers (안전 규칙)
-- ──────────────────────────────────────────────────────────────────

-- D.1 youth_habit 트랙은 advanced 금지
CREATE OR REPLACE FUNCTION public.diet_enforce_track_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.track = 'youth_habit' AND NEW.advanced_feature_enabled = true THEN
    RAISE EXCEPTION 'youth_habit track cannot enable advanced features';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diet_enforce_track_rules ON public.diet_program_enrollments;
CREATE TRIGGER trg_diet_enforce_track_rules
  BEFORE INSERT OR UPDATE ON public.diet_program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.diet_enforce_track_rules();

-- D.2 log 변경 시 updated_at 유지
CREATE OR REPLACE FUNCTION public.diet_touch_log_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_diet_logs_touch ON public.diet_daily_logs;
CREATE TRIGGER trg_diet_logs_touch
  BEFORE UPDATE ON public.diet_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.diet_touch_log_updated_at();


-- ──────────────────────────────────────────────────────────────────
-- Section E. RLS
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.diet_safety_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_daily_log_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_coach_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_progress_snapshots ENABLE ROW LEVEL SECURITY;

-- safety_screenings
DROP POLICY IF EXISTS diet_screening_read_own ON public.diet_safety_screenings;
CREATE POLICY diet_screening_read_own ON public.diet_safety_screenings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS diet_screening_write_own ON public.diet_safety_screenings;
CREATE POLICY diet_screening_write_own ON public.diet_safety_screenings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- enrollments
DROP POLICY IF EXISTS diet_enrollment_read ON public.diet_program_enrollments;
CREATE POLICY diet_enrollment_read ON public.diet_program_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS diet_enrollment_insert_own ON public.diet_program_enrollments;
CREATE POLICY diet_enrollment_insert_own ON public.diet_program_enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS diet_enrollment_update ON public.diet_program_enrollments;
CREATE POLICY diet_enrollment_update ON public.diet_program_enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));

-- daily_logs
DROP POLICY IF EXISTS diet_log_read ON public.diet_daily_logs;
CREATE POLICY diet_log_read ON public.diet_daily_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS diet_log_insert_own ON public.diet_daily_logs;
CREATE POLICY diet_log_insert_own ON public.diet_daily_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS diet_log_update ON public.diet_daily_logs;
CREATE POLICY diet_log_update ON public.diet_daily_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));

-- daily_log_photos
DROP POLICY IF EXISTS diet_photo_read ON public.diet_daily_log_photos;
CREATE POLICY diet_photo_read ON public.diet_daily_log_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS diet_photo_insert_own ON public.diet_daily_log_photos;
CREATE POLICY diet_photo_insert_own ON public.diet_daily_log_photos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS diet_photo_delete_own ON public.diet_daily_log_photos;
CREATE POLICY diet_photo_delete_own ON public.diet_daily_log_photos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- weekly_reviews
DROP POLICY IF EXISTS diet_weekly_read ON public.diet_weekly_reviews;
CREATE POLICY diet_weekly_read ON public.diet_weekly_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS diet_weekly_upsert_own ON public.diet_weekly_reviews;
CREATE POLICY diet_weekly_upsert_own ON public.diet_weekly_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS diet_weekly_update_own ON public.diet_weekly_reviews;
CREATE POLICY diet_weekly_update_own ON public.diet_weekly_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- coach_notes
DROP POLICY IF EXISTS diet_coach_note_read ON public.diet_coach_notes;
CREATE POLICY diet_coach_note_read ON public.diet_coach_notes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR author_id = auth.uid()
    OR (visibility = 'member_visible' AND recipient_user_id = auth.uid())
    OR public.is_branch_manager_of(auth.uid(), recipient_user_id)
  );
DROP POLICY IF EXISTS diet_coach_note_insert_coach ON public.diet_coach_notes;
CREATE POLICY diet_coach_note_insert_coach ON public.diet_coach_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (public.has_role(auth.uid(),'super_admin') OR public.is_branch_manager_of(auth.uid(), recipient_user_id))
  );

-- progress_snapshots (읽기만 허용, 쓰기는 trigger/RPC)
DROP POLICY IF EXISTS diet_snapshot_read ON public.diet_progress_snapshots;
CREATE POLICY diet_snapshot_read ON public.diet_progress_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_branch_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'super_admin'));


-- ──────────────────────────────────────────────────────────────────
-- Section F. Storage bucket (diet-photos, private)
-- ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('diet-photos', 'diet-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 경로 규약: {user_id}/{yyyy-mm-dd}/{meal_slot}-{uuid}.jpg
-- foldername[1] == user_id

DROP POLICY IF EXISTS "diet_photos_read_own_or_coach" ON storage.objects;
CREATE POLICY "diet_photos_read_own_or_coach" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'diet-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_branch_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(),'super_admin')
    )
  );

DROP POLICY IF EXISTS "diet_photos_insert_own" ON storage.objects;
CREATE POLICY "diet_photos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'diet-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "diet_photos_update_own" ON storage.objects;
CREATE POLICY "diet_photos_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'diet-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "diet_photos_delete_own" ON storage.objects;
CREATE POLICY "diet_photos_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'diet-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'super_admin')
    )
  );


-- ──────────────────────────────────────────────────────────────────
-- Section G. RPC 함수들
-- ──────────────────────────────────────────────────────────────────

-- G.1 나이 계산 (profiles.birth_date 가 text 이므로 안전 파싱)
CREATE OR REPLACE FUNCTION public.get_caller_age()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _bd text;
  _dt date;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT birth_date INTO _bd FROM public.profiles WHERE user_id = _uid;
  IF _bd IS NULL OR _bd = '' THEN RETURN NULL; END IF;
  BEGIN
    _dt := _bd::date;
  EXCEPTION WHEN others THEN
    BEGIN _dt := to_date(_bd, 'YYYY-MM-DD'); EXCEPTION WHEN others THEN RETURN NULL; END;
  END;
  RETURN EXTRACT(YEAR FROM age(current_date, _dt))::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caller_age() TO authenticated;

-- G.2 트랙 자동 결정 (18세 미만 = youth_habit, 이상 = adult_standard)
CREATE OR REPLACE FUNCTION public.resolve_diet_track()
RETURNS diet_track LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _age int;
BEGIN
  _age := public.get_caller_age();
  IF _age IS NULL THEN RETURN NULL; END IF;
  IF _age < 18 THEN RETURN 'youth_habit'::diet_track; END IF;
  RETURN 'adult_standard'::diet_track;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_diet_track() TO authenticated;

-- G.3 Safety screening 기록
CREATE OR REPLACE FUNCTION public.record_diet_safety_screening(
  _pregnancy_breastfeeding boolean,
  _diabetes_medication boolean,
  _eating_disorder_risk boolean,
  _other_conditions text,
  _consent_accepted boolean,
  _consent_version integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _age int;
  _is_youth boolean;
  _group diet_age_group;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _consent_accepted = false THEN RETURN jsonb_build_object('success',false,'error','consent_required'); END IF;

  _age := public.get_caller_age();
  IF _age IS NULL THEN RETURN jsonb_build_object('success',false,'error','birth_date_missing'); END IF;

  _is_youth := _age < 18;
  _group := CASE WHEN _is_youth THEN 'youth'::diet_age_group ELSE 'adult'::diet_age_group END;

  INSERT INTO public.diet_safety_screenings (
    user_id, age_group, is_youth,
    pregnancy_breastfeeding, diabetes_medication, eating_disorder_risk,
    other_conditions, consent_accepted, consent_version
  ) VALUES (
    _uid, _group, _is_youth,
    COALESCE(_pregnancy_breastfeeding,false),
    COALESCE(_diabetes_medication,false),
    COALESCE(_eating_disorder_risk,false),
    _other_conditions,
    true, COALESCE(_consent_version, 1)
  )
  RETURNING id INTO _id;

  RETURN jsonb_build_object('success', true, 'screening_id', _id, 'is_youth', _is_youth);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_diet_safety_screening(boolean,boolean,boolean,text,boolean,integer) TO authenticated;

-- G.4 Enrollment 생성 (youth 강제, 중복 차단)
CREATE OR REPLACE FUNCTION public.enroll_diet_program(
  _screening_id uuid,
  _coach_assigned_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _screen public.diet_safety_screenings%ROWTYPE;
  _track diet_track;
  _branch text;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;

  -- 활성 enrollment 중복 차단
  IF EXISTS (
    SELECT 1 FROM public.diet_program_enrollments
    WHERE user_id = _uid AND status IN ('not_started','active','paused')
  ) THEN
    RETURN jsonb_build_object('success',false,'error','already_enrolled');
  END IF;

  SELECT * INTO _screen FROM public.diet_safety_screenings WHERE id = _screening_id AND user_id = _uid;
  IF _screen.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','screening_not_found'); END IF;
  IF _screen.consent_accepted = false THEN RETURN jsonb_build_object('success',false,'error','consent_not_accepted'); END IF;

  _track := CASE WHEN _screen.is_youth THEN 'youth_habit'::diet_track ELSE 'adult_standard'::diet_track END;
  SELECT branch_name INTO _branch FROM public.profiles WHERE user_id = _uid;

  INSERT INTO public.diet_program_enrollments (
    user_id, track, status, coach_assigned_id, screening_id, warning_flags, branch_name
  ) VALUES (
    _uid, _track, 'active', _coach_assigned_id, _screening_id,
    jsonb_build_object(
      'pregnancy_breastfeeding', _screen.pregnancy_breastfeeding,
      'diabetes_medication', _screen.diabetes_medication,
      'eating_disorder_risk', _screen.eating_disorder_risk,
      'is_youth', _screen.is_youth
    ),
    _branch
  )
  RETURNING id INTO _id;

  INSERT INTO public.diet_progress_snapshots (enrollment_id, user_id) VALUES (_id, _uid);

  RETURN jsonb_build_object('success', true, 'enrollment_id', _id, 'track', _track);
END;
$$;
GRANT EXECUTE ON FUNCTION public.enroll_diet_program(uuid, uuid) TO authenticated;

-- G.5 Daily log upsert (청소년 추가 검증: advanced 관련 field 없으므로 자동 안전)
CREATE OR REPLACE FUNCTION public.submit_diet_daily_log(
  _log_date date,
  _habits jsonb,           -- { protein_first, veggies_natural, sugary_drink_avoided, late_night_snack_avoided, gym_attended, water_ml, step_count, sleep_hours, mood, memo }
  _note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _enr public.diet_program_enrollments%ROWTYPE;
  _day int;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;

  SELECT * INTO _enr FROM public.diet_program_enrollments
   WHERE user_id = _uid AND status IN ('active','not_started') ORDER BY created_at DESC LIMIT 1;
  IF _enr.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','no_active_enrollment'); END IF;

  -- day_number 계산 (start_date 기준)
  _day := GREATEST(1, LEAST(21, (_log_date - _enr.start_date)::int + 1));

  INSERT INTO public.diet_daily_logs (
    enrollment_id, user_id, log_date, day_number,
    water_ml, step_count, sleep_hours,
    protein_first, veggies_natural, sugary_drink_avoided, late_night_snack_avoided, gym_attended,
    mood, memo, status
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
    'pending'
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
    status = CASE WHEN diet_daily_logs.status = 'approved' THEN diet_daily_logs.status ELSE 'pending' END,
    submitted_at = now()
  RETURNING id INTO _id;

  RETURN jsonb_build_object('success', true, 'log_id', _id, 'day_number', _day);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_diet_daily_log(date, jsonb, text) TO authenticated;

-- G.6 사진 첨부
CREATE OR REPLACE FUNCTION public.add_diet_log_photo(
  _log_id uuid,
  _storage_path text,
  _meal_slot diet_meal_slot
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT user_id INTO _owner FROM public.diet_daily_logs WHERE id = _log_id;
  IF _owner IS NULL OR _owner <> _uid THEN RETURN jsonb_build_object('success',false,'error','not_authorized'); END IF;

  INSERT INTO public.diet_daily_log_photos (log_id, user_id, storage_path, meal_slot)
  VALUES (_log_id, _uid, _storage_path, _meal_slot)
  RETURNING id INTO _id;
  RETURN jsonb_build_object('success', true, 'photo_id', _id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_diet_log_photo(uuid, text, diet_meal_slot) TO authenticated;

-- G.7 코치 리뷰 (approve/reject/revision_requested)
CREATE OR REPLACE FUNCTION public.review_diet_log(
  _log_id uuid,
  _action diet_log_status,       -- approved / rejected / revision_requested
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
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _action NOT IN ('approved','rejected','revision_requested') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_action');
  END IF;

  SELECT * INTO _log FROM public.diet_daily_logs WHERE id = _log_id;
  IF _log.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;

  -- 권한: 해당 회원의 지점장/코치 또는 super_admin
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

  -- 회원에게 알림
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

  -- ────────── approved 경로: 보상 + 스냅샷 업데이트 + 배지 ──────────
  -- snapshot 갱신
  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _log.enrollment_id;

  _approved_new := _snap.approved_days_total + 1;

  -- 연속 스트릭: 직전 승인 날짜가 바로 어제 같은 enrollment 안이면 +1, 아니면 1
  IF _snap.last_log_date IS NOT NULL AND _log.log_date = _snap.last_log_date + 1 THEN
    _new_streak := _snap.current_streak + 1;
  ELSIF _snap.last_log_date = _log.log_date THEN
    _new_streak := _snap.current_streak;  -- idempotent
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

  -- 보상 젬
  PERFORM public.grant_gems(_log.user_id, 3, 'diet_checkin_approved');

  -- 배지 자동 지급 (member_badges + badges seed 전제)
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

  -- 21일 완주 시 enrollment 종료 + 보너스
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
    'milestones_newly_reached', jsonb_build_object(
      'm7',  NOT _snap.milestone_7_reached AND _reach_7,
      'm14', NOT _snap.milestone_14_reached AND _reach_14,
      'm21', NOT _snap.milestone_21_reached AND _reach_21
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_diet_log(uuid, diet_log_status, text) TO authenticated;

-- G.8 주간 리뷰 upsert
CREATE OR REPLACE FUNCTION public.submit_diet_weekly_review(
  _enrollment_id uuid,
  _week_index integer,
  _waist_cm numeric DEFAULT NULL,
  _body_photo_url text DEFAULT NULL,
  _reflection text DEFAULT NULL,
  _next_week_focus text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _adherence jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT user_id INTO _owner FROM public.diet_program_enrollments WHERE id = _enrollment_id;
  IF _owner IS NULL OR _owner <> _uid THEN RETURN jsonb_build_object('success',false,'error','not_authorized'); END IF;

  -- 해당 주의 실천 요약 계산 (승인된 일수)
  SELECT jsonb_build_object(
    'approved_days', COUNT(*) FILTER (WHERE status='approved'),
    'pending_days',  COUNT(*) FILTER (WHERE status='pending'),
    'rejected_days', COUNT(*) FILTER (WHERE status='rejected')
  ) INTO _adherence
  FROM public.diet_daily_logs
  WHERE enrollment_id = _enrollment_id
    AND day_number BETWEEN ((_week_index - 1) * 7 + 1) AND (_week_index * 7);

  INSERT INTO public.diet_weekly_reviews (
    enrollment_id, user_id, week_index,
    waist_cm, body_photo_url, reflection, adherence_summary, next_week_focus
  ) VALUES (
    _enrollment_id, _uid, _week_index,
    _waist_cm, _body_photo_url, _reflection, COALESCE(_adherence,'{}'::jsonb), _next_week_focus
  )
  ON CONFLICT (enrollment_id, week_index) DO UPDATE SET
    waist_cm = EXCLUDED.waist_cm,
    body_photo_url = EXCLUDED.body_photo_url,
    reflection = EXCLUDED.reflection,
    adherence_summary = EXCLUDED.adherence_summary,
    next_week_focus = EXCLUDED.next_week_focus;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_diet_weekly_review(uuid,integer,numeric,text,text,text) TO authenticated;

-- G.9 코치 노트 작성
CREATE OR REPLACE FUNCTION public.create_diet_coach_note(
  _enrollment_id uuid,
  _note_text text,
  _template_type diet_coach_note_template DEFAULT 'general',
  _visibility text DEFAULT 'member_visible',
  _related_log_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _caller uuid := auth.uid();
  _member uuid;
  _id uuid;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT user_id INTO _member FROM public.diet_program_enrollments WHERE id = _enrollment_id;
  IF _member IS NULL THEN RETURN jsonb_build_object('success',false,'error','enrollment_not_found'); END IF;
  IF NOT (public.has_role(_caller,'super_admin') OR public.is_branch_manager_of(_caller, _member)) THEN
    RETURN jsonb_build_object('success',false,'error','not_authorized');
  END IF;
  IF _visibility NOT IN ('private','member_visible') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_visibility');
  END IF;

  INSERT INTO public.diet_coach_notes (enrollment_id, recipient_user_id, author_id, note_text, template_type, visibility, related_log_id)
  VALUES (_enrollment_id, _member, _caller, _note_text, _template_type, _visibility, _related_log_id)
  RETURNING id INTO _id;

  IF _visibility = 'member_visible' THEN
    PERFORM public.create_notification(_member, '코치 피드백이 도착했어요', LEFT(_note_text, 80));
  END IF;
  RETURN jsonb_build_object('success', true, 'note_id', _id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_diet_coach_note(uuid,text,diet_coach_note_template,text,uuid) TO authenticated;

-- G.10 진척도 조회
CREATE OR REPLACE FUNCTION public.get_diet_progress(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _target uuid := COALESCE(_user_id, auth.uid());
  _caller uuid := auth.uid();
  _enr public.diet_program_enrollments%ROWTYPE;
  _snap public.diet_progress_snapshots%ROWTYPE;
  _pending int;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _target <> _caller AND NOT (public.has_role(_caller,'super_admin') OR public.is_branch_manager_of(_caller, _target)) THEN
    RETURN jsonb_build_object('success',false,'error','not_authorized');
  END IF;

  SELECT * INTO _enr FROM public.diet_program_enrollments
   WHERE user_id = _target AND status IN ('active','not_started','paused') ORDER BY created_at DESC LIMIT 1;
  IF _enr.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'has_active', false);
  END IF;

  SELECT * INTO _snap FROM public.diet_progress_snapshots WHERE enrollment_id = _enr.id;
  SELECT COUNT(*) INTO _pending FROM public.diet_daily_logs WHERE enrollment_id = _enr.id AND status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'has_active', true,
    'enrollment', jsonb_build_object(
      'id', _enr.id,
      'track', _enr.track,
      'start_date', _enr.start_date,
      'current_day', _enr.current_day,
      'current_stage', _enr.current_stage,
      'status', _enr.status,
      'advanced_feature_enabled', _enr.advanced_feature_enabled
    ),
    'snapshot', to_jsonb(_snap),
    'pending_days', _pending
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_diet_progress(uuid) TO authenticated;

-- G.11 랭킹 (승인된 일수/스트릭 기반, 체중 미노출)
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
  WHERE p.branch_name = _branch_name
  ORDER BY s.approved_days_total DESC, s.best_streak DESC, p.nickname ASC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_diet_ranking(text,int) TO authenticated;

-- G.12 상태 전환 유틸
CREATE OR REPLACE FUNCTION public.update_diet_enrollment_status(
  _enrollment_id uuid,
  _next_status diet_enrollment_status
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _caller uuid := auth.uid();
  _owner uuid;
BEGIN
  IF _caller IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT user_id INTO _owner FROM public.diet_program_enrollments WHERE id = _enrollment_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF NOT (_owner = _caller OR public.has_role(_caller,'super_admin') OR public.is_branch_manager_of(_caller,_owner)) THEN
    RETURN jsonb_build_object('success',false,'error','not_authorized');
  END IF;

  UPDATE public.diet_program_enrollments
     SET status = _next_status,
         finished_at = CASE WHEN _next_status IN ('completed','dropped') THEN now() ELSE finished_at END
   WHERE id = _enrollment_id;

  RETURN jsonb_build_object('success', true, 'status', _next_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_diet_enrollment_status(uuid, diet_enrollment_status) TO authenticated;


-- ──────────────────────────────────────────────────────────────────
-- Section H. 배지 seed (badges 테이블에 5개 추가)
-- ──────────────────────────────────────────────────────────────────
INSERT INTO public.badges (code, name, description) VALUES
  ('diet_starter',        '첫 걸음',    '153 다이어트 첫 체크인 코치 승인'),
  ('diet_week_7',         '7일 리셋',   '153 다이어트 누적 승인 7일 달성'),
  ('diet_week_14',        '14일 연소',  '153 다이어트 누적 승인 14일 달성'),
  ('diet_21_complete',    '21일 완주',  '153 다이어트 21일 완주'),
  ('diet_coach_favorite', '코치 추천',  '코치가 지정한 모범 식습관 기록')
ON CONFLICT (code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────────
-- Section I. PostgREST schema 캐시 리로드
-- ──────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
