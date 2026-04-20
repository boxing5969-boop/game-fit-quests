-- ══════════════════════════════════════════════════════════════════
-- Step 2: 튜토리얼 + 해금 시스템 서버측 구현
--
-- 변경 요약
--   1. profiles.tutorial_completed boolean 컬럼 추가
--   2. get_customization_required_level(_category, _item_key)
--      — unlockRules.ts 의 서버측 미러. 업데이트 시 양쪽 동기화 필수.
--   3. get_caller_user_level()
--      — computeUserLevel() 의 서버측 미러.
--   4. check_customization_unlock(_category, _item_key)
--      — (2) + (3) 결합 검증 헬퍼.
--   5. purchase_customization(p_category, p_item_key, p_price)
--      — 기존 시그니처 유지한 채 구매 전 레벨 검증 추가.
--   6. complete_tutorial_and_grant_reward()
--      — 1회성 1000젬 지급. 원자적 UPDATE ... RETURNING 으로 멱등성 보장.
--
-- 설계 메모
--   • 기존 RPC 와 동일하게 SECURITY DEFINER + SET search_path='public'.
--   • 모든 함수는 auth.uid() 를 단일 신뢰 원천으로 사용 (client 오염 방지).
--   • HoF 판정은 get_hall_of_fame RPC 의 조건 (black Lv10 + 비관리자)
--     을 그대로 미러함. computeUserLevel 의 is_in_hall_of_fame 파라미터
--     역할을 서버에서 대체.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. profiles.tutorial_completed
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tutorial_completed IS
  '튜토리얼 완료 여부. complete_tutorial_and_grant_reward() 에서만 true 로 전환.';


-- ──────────────────────────────────────────────────────────────────
-- 2. get_customization_required_level
--    src/data/unlockRules.ts 의 미러. 규칙 변경 시 양쪽 동시 수정.
--    매칭되는 규칙이 없으면 NULL 반환 = 레벨 제한 없음 (가격 전용 상품).
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customization_required_level(
  _category text,
  _item_key text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _category
    WHEN 'effect' THEN CASE _item_key
      WHEN 'sparkle'   THEN 1
      WHEN 'stars'     THEN 1
      WHEN 'wind'      THEN 1
      WHEN 'daisy'     THEN 1
      WHEN 'flame'     THEN 5
      WHEN 'hearts'    THEN 5
      WHEN 'sunflower' THEN 5
      WHEN 'lightning' THEN 10
      WHEN 'snow'      THEN 10
      WHEN 'music'     THEN 10
      WHEN 'cherry'    THEN 15
      WHEN 'tulip'     THEN 15
      WHEN 'firework'  THEN 15
      WHEN 'tornado'   THEN 20
      WHEN 'comet'     THEN 20
      WHEN 'rainbow'   THEN 20
      WHEN 'rose'      THEN 30
      WHEN 'explosion' THEN 30
      WHEN 'phoenix'   THEN 30
      WHEN 'dragon'    THEN 30
      ELSE NULL
    END
    WHEN 'frame' THEN CASE _item_key
      WHEN 'basic_white' THEN 1
      WHEN 'fire'        THEN 1
      WHEN 'ice'         THEN 5
      WHEN 'ocean'       THEN 10
      WHEN 'emerald'     THEN 10
      WHEN 'gold'        THEN 20
      WHEN 'rainbow'     THEN 20
      WHEN 'galaxy'      THEN 30
      WHEN 'holy'        THEN 30
      WHEN 'eternal'     THEN 50
      ELSE NULL
    END
    WHEN 'title' THEN CASE _item_key
      WHEN 'beginner'     THEN 1
      WHEN 'trainee'      THEN 5
      WHEN 'fighter'      THEN 10
      WHEN 'warrior'      THEN 15
      WHEN 'iron_fist'    THEN 20
      WHEN 'thunder_king' THEN 30
      WHEN 'champion'     THEN 50
      WHEN 'legend'       THEN 99
      ELSE NULL
    END
    WHEN 'aura' THEN CASE _item_key
      WHEN 'aura_ocean'      THEN 1
      WHEN 'aura_emerald'    THEN 5
      WHEN 'aura_phantom'    THEN 10
      WHEN 'aura_fire'       THEN 20
      WHEN 'halo_black_gold' THEN 30
      WHEN 'aura_rainbow'    THEN 50
      ELSE NULL
    END
    ELSE NULL
  END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 3. get_caller_user_level
--    computeUserLevel 의 서버측 미러. 로그인 안된 경우 1 반환.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_caller_user_level()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rank    rank_name;
  v_level   int;
  v_bosses  int;
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 1;
  END IF;

  SELECT mp.current_rank, mp.current_level, mp.bosses_cleared
    INTO v_rank, v_level, v_bosses
    FROM member_progress mp
   WHERE mp.user_id = v_user_id;

  IF v_rank IS NULL THEN
    RETURN 1;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id
       AND role IN ('super_admin', 'admin', 'branch_manager')
  ) INTO v_is_admin;

  -- HoF: 비관리자 black Lv10 (get_hall_of_fame 기준과 동일).
  IF v_rank = 'black' AND v_level = 10 AND NOT v_is_admin THEN
    RETURN 99;
  END IF;

  -- Master: black Lv10 + bosses >= 4.
  IF v_rank = 'black' AND v_level = 10 AND COALESCE(v_bosses, 0) >= 4 THEN
    RETURN 50;
  END IF;

  RETURN CASE v_rank
    WHEN 'white' THEN 0
    WHEN 'blue'  THEN 10
    WHEN 'red'   THEN 20
    WHEN 'black' THEN 30
    ELSE 0
  END + COALESCE(v_level, 1);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 4. check_customization_unlock
--    레벨 규칙이 없는 아이템 (NULL) 은 항상 해금 (= 가격만 제약).
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_customization_unlock(
  _category text,
  _item_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    public.get_customization_required_level(_category, _item_key),
    0
  ) <= public.get_caller_user_level();
$$;


-- ──────────────────────────────────────────────────────────────────
-- 5. purchase_customization — 레벨 검증 추가 (기존 시그니처 유지)
--    useCustomizationPurchase.ts 가 이미 3-arg 로 호출 중이므로
--    signature 는 변경하지 않고 함수 본체에만 가드 추가.
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
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_already BOOLEAN;
  v_required INTEGER;
  v_level INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 이미 소유 → 즉시 성공 (레벨 체크 생략 — 과거 해금분 보호).
  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
    WHERE user_id = v_user_id AND category = p_category AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  -- 레벨 해금 규칙이 있는 아이템이면 서버측에서 재검증.
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

  SELECT gems_balance INTO v_balance
  FROM user_wallets WHERE user_id = v_user_id;

  IF v_balance IS NULL THEN
    v_balance := 0;
  END IF;

  IF p_price > 0 AND v_balance < p_price THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_gems', 'current', v_balance);
  END IF;

  IF p_price > 0 THEN
    UPDATE user_wallets
    SET gems_balance = gems_balance - p_price,
        total_spent = total_spent + p_price
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
-- 6. complete_tutorial_and_grant_reward
--    원자적 UPDATE ... RETURNING 으로 중복 호출에서도 1회만 지급.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_tutorial_and_grant_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reward  int  := 1000;
  v_flipped boolean;
  v_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 멱등 전환. 이전값이 false 였던 행만 반환되므로 동시 호출에도
  -- 최대 1건만 진입. 이미 true 였다면 v_flipped = NULL.
  UPDATE public.profiles
     SET tutorial_completed = true
   WHERE user_id = v_user_id
     AND tutorial_completed = false
  RETURNING true INTO v_flipped;

  IF v_flipped IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_granted', true,
      'granted_gems', 0
    );
  END IF;

  -- 지갑 upsert (없으면 생성).
  INSERT INTO public.user_wallets (user_id, gems_balance, total_earned)
  VALUES (v_user_id, v_reward, v_reward)
  ON CONFLICT (user_id) DO UPDATE
    SET gems_balance = user_wallets.gems_balance + v_reward,
        total_earned = user_wallets.total_earned + v_reward,
        updated_at   = now()
  RETURNING gems_balance INTO v_balance;

  INSERT INTO public.wallet_transactions (user_id, amount, reason, meta_json)
  VALUES (
    v_user_id,
    v_reward,
    'tutorial_completion',
    jsonb_build_object('source', 'complete_tutorial_and_grant_reward')
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_granted', false,
    'granted_gems', v_reward,
    'balance', v_balance
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 실행 권한 (기존 RPC 와 동일 패턴)
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_customization_required_level(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_caller_user_level()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_customization_unlock(text, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_tutorial_and_grant_reward()         TO authenticated;
