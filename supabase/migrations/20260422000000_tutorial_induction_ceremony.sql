-- ══════════════════════════════════════════════════════════════════
-- 랭킹업 입단식 — 단계별 보상 + 신입 칭호/이펙트 + 다시시작
--
-- 이전 마이그레이션 (20260420130000, 20260420140000) 의 후속.
-- 기존 컬럼/RPC 는 전부 유지하고 확장만 한다.
--
-- 정책
--   • 총 보상 1000 파이트 머니 = step1:100 + step2:100 + step3:200 +
--     step4:200 + step5:400. 단계별 즉시 지급으로 도파민 강화.
--   • 단계별 보상 멱등성: tutorial_step_claims (user_id, step_order)
--     UNIQUE. 기존 reward_claimed flag 와 별도 트랙.
--   • 최종 단계는 추가로 신입 챌린저 칭호 + 기본 이펙트(sparkle) 자동 지급.
--   • 백필: tutorial_completed=true 인 기존 회원은 step_claims 5행을
--     1회 일괄 INSERT 하고 잔액 1000 파이트 머니 + 칭호/이펙트 일괄 지급.
--   • restart_tutorial: tutorial_completed/step/skipped 를 리셋하지만
--     step_claims 와 reward_claimed 는 보존 → 보상 재지급 0건 보장.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 컬럼 추가
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tutorial_skipped IS
  '튜토리얼 스킵 여부. 스킵 시 최종 보상 지급 안 됨. restart_tutorial 호출로 false 리셋.';


-- ──────────────────────────────────────────────────────────────────
-- B. tutorial_step_claims — 단계별 멱등 + 감사 로그
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutorial_step_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_order  integer     NOT NULL CHECK (step_order BETWEEN 1 AND 5),
  amount      integer     NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_order)
);

CREATE INDEX IF NOT EXISTS tutorial_step_claims_user_idx
  ON public.tutorial_step_claims (user_id, step_order);

ALTER TABLE public.tutorial_step_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutorial_step_claims own read" ON public.tutorial_step_claims;
CREATE POLICY "tutorial_step_claims own read"
  ON public.tutorial_step_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ));


-- ──────────────────────────────────────────────────────────────────
-- C. 단계별 보상 금액 매핑 — 1단계 IMMUTABLE 헬퍼
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tutorial_step_reward_amount(_step integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _step
    WHEN 1 THEN 100
    WHEN 2 THEN 100
    WHEN 3 THEN 200
    WHEN 4 THEN 200
    WHEN 5 THEN 400
    ELSE 0
  END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- D. claim_tutorial_step_reward — 단계 즉시 보상 지급 (멱등)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_tutorial_step_reward(_step integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount  int  := public.tutorial_step_reward_amount(_step);
  v_granted boolean;
  v_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF _step IS NULL OR _step < 1 OR _step > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_step');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'amount', 0, 'already_granted', false);
  END IF;

  -- 멱등 핵: UNIQUE(user_id, step_order) 충돌이면 RETURNING 이 NULL.
  INSERT INTO tutorial_step_claims (user_id, step_order, amount)
  VALUES (v_user_id, _step, v_amount)
  ON CONFLICT (user_id, step_order) DO NOTHING
  RETURNING true INTO v_granted;

  IF v_granted IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_granted', true,
      'amount', 0,
      'step', _step
    );
  END IF;

  -- 지갑 + 트랜잭션 로그
  INSERT INTO user_wallets (user_id, gems_balance, total_earned)
  VALUES (v_user_id, v_amount, v_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET gems_balance = user_wallets.gems_balance + v_amount,
        total_earned = user_wallets.total_earned + v_amount,
        updated_at   = now()
  RETURNING gems_balance INTO v_balance;

  INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
  VALUES (
    v_user_id,
    v_amount,
    'tutorial_step',
    jsonb_build_object('step', _step)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_granted', false,
    'amount', v_amount,
    'step', _step,
    'balance', v_balance
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- E. complete_tutorial_once 확장 — 칭호 + 이펙트 추가 지급
--    기존 함수 시그니처/멱등성 유지. 1000 → 400 으로 보상 줄이고
--    step1~4 (100+100+200+200=600) 와 합쳐 총 1000 파이트 머니.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_tutorial_once(
  _final_step integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reward  int  := public.tutorial_step_reward_amount(5); -- step5 = 400
  v_flipped boolean;
  v_balance int;
  v_step    int  := GREATEST(1, LEAST(COALESCE(_final_step, 5), 5));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 원자 플립: reward_claimed false→true 로 뒤집은 단 한 세션만 보상 지급.
  UPDATE public.profiles
     SET tutorial_reward_claimed = true,
         tutorial_completed      = true,
         tutorial_completed_at   = COALESCE(tutorial_completed_at, now()),
         tutorial_step           = GREATEST(tutorial_step, v_step)
   WHERE user_id = v_user_id
     AND tutorial_reward_claimed = false
  RETURNING true INTO v_flipped;

  IF v_flipped IS NULL THEN
    -- 이미 지급된 유저. step 만 전진 허용.
    UPDATE public.profiles
       SET tutorial_step      = GREATEST(tutorial_step, v_step),
           tutorial_completed = true
     WHERE user_id = v_user_id;

    SELECT gems_balance INTO v_balance
      FROM user_wallets
     WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_granted', true,
      'granted_gems', 0,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- step 5 보상 (400 파이트 머니) — claim_tutorial_step_reward 와 별도 경로로
  -- 이중 지급 방지 위해 step_claims 에 INSERT (충돌 시 skip).
  INSERT INTO tutorial_step_claims (user_id, step_order, amount)
  VALUES (v_user_id, 5, v_reward)
  ON CONFLICT (user_id, step_order) DO NOTHING;

  -- 지갑 (이미 step5 가 step_claims 에 있다면 amount 만큼은 advance 시점에 이미 들어감)
  INSERT INTO user_wallets (user_id, gems_balance, total_earned)
  VALUES (v_user_id, v_reward, v_reward)
  ON CONFLICT (user_id) DO UPDATE
    SET gems_balance = user_wallets.gems_balance + v_reward,
        total_earned = user_wallets.total_earned + v_reward,
        updated_at   = now()
  RETURNING gems_balance INTO v_balance;

  INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
  VALUES (
    v_user_id,
    v_reward,
    'tutorial_completion',
    jsonb_build_object('source', 'complete_tutorial_once', 'step', v_step)
  );

  -- 신입 챌린저 칭호 + 기본 이펙트(sparkle) 자동 보유
  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES
    (v_user_id, 'title', 'rookie_challenger'),
    (v_user_id, 'effect', 'sparkle')
  ON CONFLICT (user_id, category, item_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'already_granted', false,
    'granted_gems', v_reward,
    'balance', v_balance,
    'title_reward', 'rookie_challenger',
    'effect_reward', 'sparkle'
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- F. restart_tutorial — 다시 시작 (보상 중복 방지)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restart_tutorial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- tutorial_completed/step/skipped 만 리셋. reward_claimed 와
  -- step_claims 는 그대로 → 다시 진행해도 보상 0원 (이미 지급).
  UPDATE public.profiles
     SET tutorial_completed = false,
         tutorial_step      = 0,
         tutorial_skipped   = false
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- G. mark_tutorial_skipped — 스킵 표시
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_tutorial_skipped()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.profiles
     SET tutorial_skipped = true
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- H. 백필 — 기존 회원 일괄 지급
--    조건: tutorial_completed=true AND step_claims 비어있음
--    → 5단계 step_claims 행 INSERT + wallet +1000 + 칭호/이펙트
-- ──────────────────────────────────────────────────────────────────
DO $backfill$
DECLARE
  v_row record;
  v_total int;
BEGIN
  FOR v_row IN
    SELECT p.user_id
      FROM profiles p
     WHERE p.tutorial_completed = true
       AND NOT EXISTS (SELECT 1 FROM tutorial_step_claims tsc WHERE tsc.user_id = p.user_id)
  LOOP
    -- 5단계 step_claims 일괄 INSERT
    INSERT INTO tutorial_step_claims (user_id, step_order, amount)
    SELECT v_row.user_id, gs, public.tutorial_step_reward_amount(gs)
      FROM generate_series(1, 5) gs
    ON CONFLICT DO NOTHING;

    -- 지갑 합산 1000 파이트 머니
    v_total := 1000;
    INSERT INTO user_wallets (user_id, gems_balance, total_earned)
    VALUES (v_row.user_id, v_total, v_total)
    ON CONFLICT (user_id) DO UPDATE
      SET gems_balance = user_wallets.gems_balance + v_total,
          total_earned = user_wallets.total_earned + v_total,
          updated_at   = now();

    INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
    VALUES (
      v_row.user_id,
      v_total,
      'tutorial_backfill',
      jsonb_build_object('source', 'induction_ceremony_backfill')
    );

    -- 칭호 + 이펙트 자동 보유
    INSERT INTO user_owned_customizations (user_id, category, item_key)
    VALUES
      (v_row.user_id, 'title', 'rookie_challenger'),
      (v_row.user_id, 'effect', 'sparkle')
    ON CONFLICT (user_id, category, item_key) DO NOTHING;
  END LOOP;
END
$backfill$;


-- ──────────────────────────────────────────────────────────────────
-- I. get_customization_required_level — 신규 항목 동기화
--    (unlockRules.ts EFFECT/TITLE 변경 미러 — 동일 정책 단일 소스 유지)
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
      -- Lv1
      WHEN 'sparkle'      THEN 1
      WHEN 'stars'        THEN 1
      WHEN 'wind'         THEN 1
      WHEN 'daisy'        THEN 1
      -- Lv5
      WHEN 'flame'        THEN 5
      WHEN 'hearts'       THEN 5
      WHEN 'sunflower'    THEN 5
      WHEN 'clover'       THEN 5
      -- Lv10
      WHEN 'lightning'    THEN 10
      WHEN 'snow'         THEN 10
      WHEN 'music'        THEN 10
      -- Lv15
      WHEN 'cherry'       THEN 15
      WHEN 'tulip'        THEN 15
      WHEN 'firework'     THEN 15
      WHEN 'hibiscus'     THEN 15
      -- Lv20
      WHEN 'tornado'      THEN 20
      WHEN 'comet'        THEN 20
      WHEN 'rainbow'      THEN 20
      -- Lv25
      WHEN 'bouquet'      THEN 25
      WHEN 'ghost'        THEN 25
      WHEN 'star_shoot'   THEN 25
      -- Lv30
      WHEN 'rose'         THEN 30
      WHEN 'explosion'    THEN 30
      WHEN 'phoenix'      THEN 30
      WHEN 'dragon'       THEN 30
      WHEN 'crown_effect' THEN 30
      WHEN 'lotus'        THEN 30
      -- Lv35
      WHEN 'skull'        THEN 35
      WHEN 'diamond_rain' THEN 35
      WHEN 'sakura_storm' THEN 35
      -- Lv40
      WHEN 'inferno_dual' THEN 40
      WHEN 'thunder_god'  THEN 40
      -- Lv50
      WHEN 'cosmic_dust'  THEN 50
      WHEN 'sword_aura'   THEN 50
      WHEN 'dark_flame'   THEN 50
      WHEN 'rose_gold'    THEN 50
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
      WHEN 'rookie_challenger' THEN 1
      WHEN 'beginner'          THEN 1
      WHEN 'trainee'           THEN 5
      WHEN 'fighter'           THEN 10
      WHEN 'warrior'           THEN 15
      WHEN 'iron_fist'         THEN 20
      WHEN 'thunder_king'      THEN 30
      WHEN 'champion'          THEN 50
      WHEN 'legend'            THEN 99
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
-- J. 권한
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.tutorial_step_reward_amount(integer)         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_tutorial_step_reward(integer)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.restart_tutorial()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tutorial_skipped()                      TO authenticated;
-- complete_tutorial_once 권한은 이전 마이그레이션에서 부여됨.
