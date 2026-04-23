-- =========================================================================
-- 153 다이어트 · 개인 영양 프로필 (21일 이후 자동 식단 생성용)
--
-- 목적: 유지/연장 프로그램에서 회원별로 BMR·TDEE·칼로리·매크로 타겟을 계산하고
-- 메뉴 라이브러리에서 하루 식단을 자동 생성하기 위한 최소 신체/선호 정보 저장.
--
-- 원칙:
--   · 체중 경쟁 금지 — 수치는 자기 점검·계산 용도. 공개 랭킹과 분리.
--   · 극단 제한 금지 — 감량 칼로리 하한(BMR) · 최대 -500kcal 만 허용.
--   · 알레르기/식이 제한은 빌려쓰지 않고 별도 배열로 저장.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.diet_nutrition_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  sex text CHECK (sex IN ('male','female')),
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  target_weight_kg numeric(5,1),

  -- sedentary 1.2 · light 1.375 · moderate 1.55 · active 1.725 · very_active 1.9
  activity_level text CHECK (activity_level IN
    ('sedentary','light','moderate','active','very_active')) DEFAULT 'light',

  -- 알레르기·비건·할랄 등 — 서버는 단순 저장. 클라이언트가 메뉴 필터.
  dietary_restrictions text[] NOT NULL DEFAULT '{}'::text[],

  -- 추가 선호 (불호 재료 등 자유 텍스트 배열)
  disliked_ingredients text[] NOT NULL DEFAULT '{}'::text[],

  -- 하루 식사 패턴 — 일부는 아침 스킵
  meals_per_day int NOT NULL DEFAULT 3 CHECK (meals_per_day BETWEEN 2 AND 4),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_nutrition_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutrition_profile_read_own" ON public.diet_nutrition_profiles;
CREATE POLICY "nutrition_profile_read_own"
  ON public.diet_nutrition_profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP TRIGGER IF EXISTS trg_diet_nutrition_profiles_updated ON public.diet_nutrition_profiles;
CREATE TRIGGER trg_diet_nutrition_profiles_updated
  BEFORE UPDATE ON public.diet_nutrition_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────
-- RPC — upsert_nutrition_profile (본인만)
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_nutrition_profile(
  _sex text,
  _height_cm numeric,
  _weight_kg numeric,
  _target_weight_kg numeric,
  _activity_level text,
  _dietary_restrictions text[] DEFAULT NULL,
  _disliked_ingredients text[] DEFAULT NULL,
  _meals_per_day int DEFAULT 3
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF _sex IS NOT NULL AND _sex NOT IN ('male','female') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_sex');
  END IF;
  IF _activity_level IS NOT NULL AND _activity_level NOT IN
     ('sedentary','light','moderate','active','very_active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_activity');
  END IF;
  IF _height_cm IS NOT NULL AND (_height_cm < 120 OR _height_cm > 230) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_height');
  END IF;
  IF _weight_kg IS NOT NULL AND (_weight_kg < 30 OR _weight_kg > 250) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_weight');
  END IF;

  INSERT INTO public.diet_nutrition_profiles (
    user_id, sex, height_cm, weight_kg, target_weight_kg, activity_level,
    dietary_restrictions, disliked_ingredients, meals_per_day
  ) VALUES (
    _caller, _sex, _height_cm, _weight_kg, _target_weight_kg,
    COALESCE(_activity_level, 'light'),
    COALESCE(_dietary_restrictions, '{}'::text[]),
    COALESCE(_disliked_ingredients, '{}'::text[]),
    COALESCE(_meals_per_day, 3)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    sex = COALESCE(EXCLUDED.sex, diet_nutrition_profiles.sex),
    height_cm = COALESCE(EXCLUDED.height_cm, diet_nutrition_profiles.height_cm),
    weight_kg = COALESCE(EXCLUDED.weight_kg, diet_nutrition_profiles.weight_kg),
    target_weight_kg = COALESCE(EXCLUDED.target_weight_kg, diet_nutrition_profiles.target_weight_kg),
    activity_level = COALESCE(EXCLUDED.activity_level, diet_nutrition_profiles.activity_level),
    dietary_restrictions = EXCLUDED.dietary_restrictions,
    disliked_ingredients = EXCLUDED.disliked_ingredients,
    meals_per_day = EXCLUDED.meals_per_day,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_nutrition_profile(
  text, numeric, numeric, numeric, text, text[], text[], int
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- RPC — get_nutrition_profile (본인 또는 지점장/슈퍼)
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nutrition_profile(
  _user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _target uuid := COALESCE(_user_id, auth.uid());
  _row public.diet_nutrition_profiles%ROWTYPE;
  _has_row boolean := false;
  _age int;
  _bd text;
  _dt date;
BEGIN
  IF _target <> _caller
     AND NOT public.is_branch_manager_of(_caller, _target)
     AND NOT public.has_role(_caller,'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _row FROM public.diet_nutrition_profiles WHERE user_id = _target;
  _has_row := FOUND;

  -- 나이 — profiles.birth_date 는 text 이므로 안전 파싱
  SELECT birth_date INTO _bd FROM public.profiles WHERE user_id = _target;
  IF _bd IS NOT NULL AND _bd <> '' THEN
    BEGIN
      _dt := _bd::date;
    EXCEPTION WHEN others THEN
      BEGIN _dt := to_date(_bd, 'YYYY-MM-DD'); EXCEPTION WHEN others THEN _dt := NULL; END;
    END;
    IF _dt IS NOT NULL THEN
      _age := EXTRACT(YEAR FROM age(current_date, _dt))::int;
    END IF;
  END IF;

  IF NOT _has_row THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_profile', false,
      'age', COALESCE(_age, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_profile', true,
    'profile', row_to_json(_row),
    'age', COALESCE(_age, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nutrition_profile(uuid) TO authenticated;

COMMENT ON TABLE public.diet_nutrition_profiles IS
  '유지/연장 프로그램의 개인화 식단 생성을 위한 신체/선호 정보. 공개 랭킹과 분리.';
