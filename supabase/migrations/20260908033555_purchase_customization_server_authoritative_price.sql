-- [발견] purchase_customization(p_price) — 가격을 클라이언트가 정했다. (2026-09-08 풀파워 검수)
--        앱이 아닌 도구로 p_price=0 을 보내면 어떤 아이템이든 공짜였다.
-- [조치] 서버 가격표(customization_prices)가 유일한 진실. p_price 는 무시한다.
--        인자는 하위호환을 위해 남긴다(구버전 앱이 계속 호출한다).
create or replace function public.purchase_customization(p_category text, p_item_key text, p_price integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_user_id  UUID := auth.uid();
  v_balance  INTEGER;
  v_already  BOOLEAN;
  v_required INTEGER;
  v_level    INTEGER;
  v_is_admin BOOLEAN;
  v_price    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 서버 가격표가 유일한 진실. 클라이언트가 보낸 p_price 는 버린다.
  v_price := public.get_customization_price(p_category, p_item_key);
  IF v_price IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unknown_item',
                             'category', p_category, 'item_key', p_item_key);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
     WHERE user_id = v_user_id AND category = p_category AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  -- HoF 게이트 — 관리자도 우회하지 않는다 (전시 의미 유지).
  IF public.is_hof_required_item(p_category, p_item_key)
     AND NOT public.is_caller_in_hall_of_fame()
     AND NOT v_is_admin
  THEN
    RETURN json_build_object('success', false, 'error', 'hof_required',
                             'category', p_category, 'item_key', p_item_key);
  END IF;

  -- 레벨 게이트 — 관리자는 우회. 회원은 기존 로직 유지.
  IF NOT v_is_admin THEN
    v_required := public.get_customization_required_level(p_category, p_item_key);
    IF v_required IS NOT NULL THEN
      v_level := public.get_caller_user_level();
      IF v_level < v_required THEN
        RETURN json_build_object('success', false, 'error', 'level_locked',
                                 'required_level', v_required, 'current_level', v_level);
      END IF;
    END IF;
  END IF;

  -- 지갑 잔액 체크 & 차감 — 관리자는 전 구간 스킵.
  -- FOR UPDATE: 같은 회원이 동시에 두 번 눌러 잔액을 두 번 쓰는 경합을 막는다.
  IF NOT v_is_admin THEN
    SELECT gems_balance INTO v_balance
      FROM user_wallets WHERE user_id = v_user_id FOR UPDATE;
    IF v_balance IS NULL THEN v_balance := 0; END IF;

    IF v_price > 0 AND v_balance < v_price THEN
      RETURN json_build_object('success', false, 'error', 'insufficient_gems', 'current', v_balance);
    END IF;

    IF v_price > 0 THEN
      UPDATE user_wallets
         SET gems_balance = gems_balance - v_price,
             total_spent  = total_spent + v_price
       WHERE user_id = v_user_id;

      INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
      VALUES (v_user_id, -v_price, 'customization_purchase',
              jsonb_build_object('category', p_category, 'item_key', p_item_key, 'server_price', v_price));
    END IF;
  END IF;

  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES (v_user_id, p_category, p_item_key);

  RETURN json_build_object(
    'success', true,
    'price', v_price,
    'remaining_gems',
      CASE WHEN v_is_admin THEN NULL ELSE GREATEST(COALESCE(v_balance, 0) - v_price, 0) END,
    'admin_bypass', v_is_admin
  );
END;
$function$;
