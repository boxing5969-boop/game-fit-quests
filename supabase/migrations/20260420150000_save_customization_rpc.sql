-- ══════════════════════════════════════════════════════════════════
-- Step 7: 프론트 우회 불가능한 꾸미기 저장 파이프라인
--
-- 구조
--   A. character_presets BEFORE INSERT/UPDATE 트리거
--      — 어떤 경로로 write 가 들어와도 parts_json.customization 안에
--        레벨 미달 itemKey 가 있으면 RAISE EXCEPTION 으로 차단.
--        RLS 를 건드리지 않고 모든 direct 테이블 write 를 커버.
--   B. save_member_customization(_style, _customization) RPC
--      — 구조적 JSON 에러 응답(level_locked + offending item 정보) 을
--        돌려주는 클라이언트 친화 경로. 트리거는 마지막 방어선.
--   C. 기존 purchase_customization RPC (Step 2) 는 이미 레벨/젬/중복
--      소유 검증을 포함 — 이번 단계에서 손대지 않음.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 트리거 함수 — 모든 write 경로 방어
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.character_presets_validate_unlocks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat      text;
  v_key      text;
  v_required int;
  v_level    int;
  v_bypass   boolean;
  v_is_hof   boolean;
  v_rank     rank_name;
  v_tier_lvl int;
  v_bosses   int;
BEGIN
  -- 템플릿 프리셋(관리자가 만드는 공식 프리셋) 은 검증 생략
  IF NEW.is_template THEN RETURN NEW; END IF;
  IF NEW.parts_json IS NULL THEN RETURN NEW; END IF;
  IF NEW.parts_json->'customization' IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.parts_json->'customization') <> 'object' THEN RETURN NEW; END IF;

  -- 관리자/슈퍼관리자는 우회 허용 (프론트 isAdmin 과 동일)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = NEW.created_by
       AND role IN ('admin', 'super_admin')
  ) INTO v_bypass;
  IF v_bypass THEN RETURN NEW; END IF;

  -- 대상 유저의 computeUserLevel 산출 (get_caller_user_level 은
  -- auth.uid() 에 묶여 있어 트리거 맥락에서 부정확할 수 있으므로
  -- created_by 기준으로 직접 재계산).
  SELECT mp.current_rank, mp.current_level, COALESCE(mp.bosses_cleared, 0)
    INTO v_rank, v_tier_lvl, v_bosses
    FROM member_progress mp
   WHERE mp.user_id = NEW.created_by;

  IF v_rank IS NULL THEN
    v_level := 1;
  ELSE
    v_is_hof := v_rank = 'black' AND v_tier_lvl = 10 AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = NEW.created_by
         AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    );

    IF v_is_hof THEN
      v_level := 99;
    ELSIF v_rank = 'black' AND v_tier_lvl = 10 AND v_bosses >= 4 THEN
      v_level := 50;
    ELSE
      v_level := CASE v_rank
        WHEN 'white' THEN 0
        WHEN 'blue'  THEN 10
        WHEN 'red'   THEN 20
        WHEN 'black' THEN 30
        ELSE 0
      END + COALESCE(v_tier_lvl, 1);
    END IF;
  END IF;

  -- customization JSON 의 각 (category, itemKey) 검증
  FOR v_cat, v_key IN SELECT * FROM jsonb_each_text(NEW.parts_json->'customization') LOOP
    IF v_key IS NULL OR v_key = '' OR v_key = 'none' THEN CONTINUE; END IF;
    v_required := public.get_customization_required_level(v_cat, v_key);
    IF v_required IS NOT NULL AND v_level < v_required THEN
      RAISE EXCEPTION
        'level_locked: item % (category %) requires level %, user has %',
        v_key, v_cat, v_required, v_level
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS character_presets_validate_unlocks_trg ON public.character_presets;
CREATE TRIGGER character_presets_validate_unlocks_trg
  BEFORE INSERT OR UPDATE ON public.character_presets
  FOR EACH ROW EXECUTE FUNCTION public.character_presets_validate_unlocks();


-- ──────────────────────────────────────────────────────────────────
-- B. 사용자 친화 에러를 돌려주는 메인 저장 RPC
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_member_customization(
  _style text,
  _customization jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_is_admin   boolean;
  v_level      int;
  v_cat        text;
  v_key        text;
  v_required   int;
  v_preset_id  uuid;
  v_parts_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin AND _customization IS NOT NULL
     AND jsonb_typeof(_customization) = 'object' THEN
    v_level := public.get_caller_user_level();

    FOR v_cat, v_key IN SELECT * FROM jsonb_each_text(_customization) LOOP
      IF v_key IS NULL OR v_key = '' OR v_key = 'none' THEN CONTINUE; END IF;
      v_required := public.get_customization_required_level(v_cat, v_key);
      IF v_required IS NOT NULL AND v_level < v_required THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'level_locked',
          'category', v_cat,
          'item_key', v_key,
          'required_level', v_required,
          'current_level', v_level
        );
      END IF;
    END LOOP;
  END IF;

  v_parts_json := jsonb_build_object(
    'style', _style,
    'customization', COALESCE(_customization, '{}'::jsonb)
  );

  -- 개인 프리셋 upsert (created_by + is_template=false 조합이 개인 슬롯)
  SELECT id INTO v_preset_id
    FROM character_presets
   WHERE created_by = v_user_id AND is_template = false
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_preset_id IS NOT NULL THEN
    UPDATE character_presets
       SET parts_json = v_parts_json,
           updated_at = now()
     WHERE id = v_preset_id;
  ELSE
    INSERT INTO character_presets (name, parts_json, created_by, is_template)
    VALUES (v_user_id::text || '_custom', v_parts_json, v_user_id, false)
    RETURNING id INTO v_preset_id;
  END IF;

  -- 할당 upsert
  INSERT INTO member_character_assignments (user_id, preset_id, is_active, display_mode)
  VALUES (v_user_id, v_preset_id, true, 'sprite')
  ON CONFLICT (user_id) DO UPDATE
    SET preset_id    = EXCLUDED.preset_id,
        is_active    = true,
        display_mode = 'sprite';

  RETURN jsonb_build_object(
    'success', true,
    'preset_id', v_preset_id
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 실행 권한
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.save_member_customization(text, jsonb) TO authenticated;
