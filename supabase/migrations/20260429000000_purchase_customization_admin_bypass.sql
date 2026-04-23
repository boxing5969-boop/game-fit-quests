-- ═══════════════════════════════════════════════════════════════════
-- purchase_customization — admin/super_admin 지갑 체크 우회
--
-- 배경
-- ────
--   전체 관리자(admin/super_admin)는 클라이언트 UI 에서 "파이트 머니 ∞"
--   표기가 되어 있지만, DB 함수는 user_wallets.gems_balance 를 그대로
--   검증한다. 관리자가 보유 아이템을 늘리려면 매번 지갑 잔액을 먼저 충전해야
--   구매가 가능했음. 실제 회원 UX 와 분기되면서 불편함 · 혼동 발생.
--
-- 변경
-- ────
--   caller 의 user_roles 에 admin 또는 super_admin 이 있을 경우:
--     • 지갑 잔액 체크를 건너뛴다 (insufficient_gems 반환 안 함)
--     • gems_balance 차감 · wallet_transactions INSERT 도 스킵
--     • user_owned_customizations INSERT 만 수행
--   일반 회원 경로는 그대로 — HoF 게이트, 레벨 게이트, 지갑 체크, 차감,
--   원장 기록 모두 기존 로직 유지.
--
-- 영향 범위
-- ─────────
--   회원/코치 구매 플로우 동작 불변.
--   관리자 구매 시 user_wallets 는 건드리지 않음 — 원장(wallet_transactions)
--   에도 기록 안 남음. 관리자의 "∞" 구매는 파이트 머니 시스템 외부 동작으로 간주.
-- ═══════════════════════════════════════════════════════════════════

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
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- caller 가 전체 관리자 권한을 가진 계정인지 확인. 하나라도 매칭되면 admin 경로.
  SELECT EXISTS(
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id
       AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
     WHERE user_id = v_user_id
       AND category = p_category
       AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  -- HoF 게이트 — 관리자는 우회하지 않고 그대로 통과시킨다 (관리자도 HoF 아이템
  -- 전시 의미가 있으면 구매 가능해야 하므로 게이트 자체 유지).
  IF public.is_hof_required_item(p_category, p_item_key)
     AND NOT public.is_caller_in_hall_of_fame()
     AND NOT v_is_admin
  THEN
    RETURN json_build_object(
      'success', false,
      'error', 'hof_required',
      'category', p_category,
      'item_key', p_item_key
    );
  END IF;

  -- 레벨 게이트 — 관리자는 우회. 회원은 기존 로직 유지.
  IF NOT v_is_admin THEN
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
  END IF;

  -- 지갑 잔액 체크 & 차감 — 관리자는 전 구간 스킵.
  IF NOT v_is_admin THEN
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
  END IF;

  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES (v_user_id, p_category, p_item_key);

  RETURN json_build_object(
    'success', true,
    'remaining_gems',
      CASE
        WHEN v_is_admin THEN NULL                              -- 관리자 잔액 개념 없음
        ELSE GREATEST(COALESCE(v_balance, 0) - p_price, 0)
      END,
    'admin_bypass', v_is_admin
  );
END;
$$;

-- 권한은 기존 마이그레이션에서 부여됨 (GRANT EXECUTE ... TO authenticated).
