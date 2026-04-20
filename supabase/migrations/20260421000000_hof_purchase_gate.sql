-- ══════════════════════════════════════════════════════════════════
-- HoF 구매 게이트 — purchase_customization 에 hall_of_fame 검증 추가
--
-- 정책
--   • 기존 검증 (not_authenticated / already_owned / level_locked /
--     insufficient_gems) 모두 유지, HoF 검증만 추가.
--   • HoF 판정은 get_hall_of_fame RPC 와 동일한 기준을 쓴다:
--       current_rank='black' AND current_level=10 AND 비관리자
--   • HoF 필수 아이템 목록은 characterCustomizationData.ts 의
--     requirement:"hall_of_fame" 필드와 동기화된 하드코딩 리스트
--     (현재 title 3종 + aura 3종). 프리셋은 이 RPC 의 대상 카테고리
--     (effect/frame/title/aura) 밖이라 여기서는 처리하지 않는다.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. HoF 자격 헬퍼 (auth.uid() 기준)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_caller_in_hall_of_fame()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_progress mp
     WHERE mp.user_id = auth.uid()
       AND mp.current_rank = 'black'
       AND mp.current_level = 10
       AND NOT EXISTS (
         SELECT 1 FROM user_roles ur
          WHERE ur.user_id = mp.user_id
            AND ur.role IN ('super_admin', 'admin', 'branch_manager')
       )
  );
$$;


-- ──────────────────────────────────────────────────────────────────
-- B. HoF 필수 아이템 여부 — 프론트 requirement:"hall_of_fame" 의 서버 미러
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hof_required_item(
  _category text,
  _item_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _category
    WHEN 'title' THEN _item_key IN ('eternal_153', 'king_of_ring', 'god_fist')
    WHEN 'aura'  THEN _item_key IN ('halo_rainbow_master', 'divine', 'aura_celestial')
    ELSE false
  END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- C. purchase_customization — HoF 검증 삽입 (기존 시그니처/흐름 유지)
--
-- 검증 순서 (위에서 아래로, 실패 시 즉시 반환):
--   1. not_authenticated
--   2. already_owned (short-circuit success)
--   3. hof_required  ← 신규
--   4. level_locked
--   5. insufficient_gems
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purchase_customization(
  p_category text,
  p_item_key text,
  p_price integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_balance  INTEGER;
  v_already  BOOLEAN;
  v_required INTEGER;
  v_level    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
     WHERE user_id = v_user_id
       AND category = p_category
       AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  -- 신규: HoF 필수 아이템은 명예의 전당 자격자만 구매 가능.
  IF public.is_hof_required_item(p_category, p_item_key)
     AND NOT public.is_caller_in_hall_of_fame()
  THEN
    RETURN json_build_object(
      'success', false,
      'error', 'hof_required',
      'category', p_category,
      'item_key', p_item_key
    );
  END IF;

  -- 기존: 레벨 게이트.
  v_required := public.get_customization_required_level(p_category, p_item_key);
  IF v_required IS NOT NULL THEN
    v_level := public.get_caller_user_level();
    IF v_level < v_required THEN
      RETURN json_build_object(
        'success', false,
        'error', 'level_locked',
        'required_level', v_required,
        'current_level', v_level
      );
    END IF;
  END IF;

  -- 기존: 지갑 잔액 확인.
  SELECT gems_balance INTO v_balance
    FROM user_wallets WHERE user_id = v_user_id;
  IF v_balance IS NULL THEN v_balance := 0; END IF;

  IF p_price > 0 AND v_balance < p_price THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_gems', 'current', v_balance);
  END IF;

  IF p_price > 0 THEN
    UPDATE user_wallets
       SET gems_balance = gems_balance - p_price,
           total_spent  = total_spent + p_price
     WHERE user_id = v_user_id;

    INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
    VALUES (
      v_user_id,
      -p_price,
      'customization_purchase',
      jsonb_build_object('category', p_category, 'item_key', p_item_key)
    );
  END IF;

  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES (v_user_id, p_category, p_item_key);

  RETURN json_build_object(
    'success', true,
    'remaining_gems', GREATEST(v_balance - p_price, 0)
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 권한
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_caller_in_hall_of_fame()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hof_required_item(text, text)     TO authenticated, anon;
-- purchase_customization 권한은 이전 마이그레이션에서 이미 부여됨.
