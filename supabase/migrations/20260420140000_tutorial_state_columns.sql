-- ══════════════════════════════════════════════════════════════════
-- Step 2B: 튜토리얼/해금 상태의 서버 권위화 + 감사 추적성 확장
--
-- 이 마이그레이션은 20260420130000_tutorial_and_unlock_rpcs.sql
-- 의 후속편. 기존 tutorial_completed 컬럼은 유지하고, 프론트
-- localStorage 로 관리되던 상태들을 서버 컬럼으로 승격한다.
--
-- 변경 요약
--   A. profiles 테이블에 4개 컬럼 추가
--      - tutorial_step               int     DEFAULT 0
--      - tutorial_completed_at       timestamptz (nullable)
--      - tutorial_reward_claimed     boolean DEFAULT false
--      - last_unlock_check_level     int     DEFAULT 1
--   B. 기존 완료된 유저를 위한 백필 (false-positive 토스트 방지)
--   C. complete_tutorial_once(_final_step)  — 스펙에 맞춘 신 RPC
--   D. update_tutorial_step(_step)          — 스텝 저장
--   E. update_last_unlock_check_level(_lvl) — 해금 스냅샷 저장
--   F. complete_tutorial_and_grant_reward() — 이전 이름은 신 RPC 로
--      위임하는 호환 래퍼로 축소 (하위 호출부 보호)
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 컬럼 추가 (모두 IF NOT EXISTS — 재실행 안전)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_step           integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tutorial_completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS tutorial_reward_claimed boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_unlock_check_level integer     NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.profiles.tutorial_step IS
  '마지막으로 진입한 튜토리얼 단계의 order (0=미시작, 5=완료). 단일 감소 불가 — update_tutorial_step 가 GREATEST 로만 올린다.';
COMMENT ON COLUMN public.profiles.tutorial_completed_at IS
  '튜토리얼 완료 및 1000젬 지급 시점. complete_tutorial_once 가 최초 지급 시에만 기록.';
COMMENT ON COLUMN public.profiles.tutorial_reward_claimed IS
  '1000젬 지급 완료 플래그. tutorial_completed 와 분리되어 재시도 루프를 안전하게 해준다.';
COMMENT ON COLUMN public.profiles.last_unlock_check_level IS
  '신규 해금 토스트 베이스라인. 클라이언트가 computeUserLevel 상승 감지 후 update_last_unlock_check_level 로 올린다.';


-- ──────────────────────────────────────────────────────────────────
-- B. 백필
--   1) 이미 tutorial_completed=true 인 기존 유저는
--      reward_claimed 도 true 로 맞추고 completed_at 을 지금 찍는다.
--   2) last_unlock_check_level 은 현재 진도에 맞춰 초기화해야
--      마이그레이션 직후 전구간 해금 토스트가 폭주하지 않는다.
-- ──────────────────────────────────────────────────────────────────
UPDATE public.profiles
   SET tutorial_reward_claimed = true,
       tutorial_completed_at = COALESCE(tutorial_completed_at, now()),
       tutorial_step = GREATEST(tutorial_step, 5)
 WHERE tutorial_completed = true
   AND tutorial_reward_claimed = false;

UPDATE public.profiles p
   SET last_unlock_check_level = sub.baseline
  FROM (
    SELECT
      mp.user_id,
      CASE mp.current_rank
        WHEN 'white' THEN 0
        WHEN 'blue'  THEN 10
        WHEN 'red'   THEN 20
        WHEN 'black' THEN 30
        ELSE 0
      END + COALESCE(mp.current_level, 1) AS baseline
    FROM member_progress mp
  ) AS sub
 WHERE sub.user_id = p.user_id
   AND p.last_unlock_check_level = 1;  -- 최초 기본값만 대체 (수동 조정 보호)


-- ──────────────────────────────────────────────────────────────────
-- C. complete_tutorial_once
--    인자: _final_step integer DEFAULT 5
--      - 최종 도달 스텝 (NULL 허용 안됨 — default 로 5 사용)
--    반환: jsonb {
--      success, already_granted, granted_gems, balance, error?
--    }
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
  v_reward  int  := 1000;
  v_flipped boolean;
  v_balance int;
  v_step    int  := GREATEST(1, LEAST(COALESCE(_final_step, 5), 5));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 원자 플립: reward_claimed false→true 로 뒤집은 단 한 세션만 보상 지급.
  -- completed / completed_at / step 는 함께 세팅되어 정합성 유지.
  UPDATE public.profiles
     SET tutorial_reward_claimed = true,
         tutorial_completed      = true,
         tutorial_completed_at   = COALESCE(tutorial_completed_at, now()),
         tutorial_step           = GREATEST(tutorial_step, v_step)
   WHERE user_id = v_user_id
     AND tutorial_reward_claimed = false
  RETURNING true INTO v_flipped;

  IF v_flipped IS NULL THEN
    -- 이미 지급된 유저. step 은 전진 허용.
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

  -- 최초 지급: 지갑 upsert + 감사 로그.
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
    jsonb_build_object('source', 'complete_tutorial_once', 'step', v_step)
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
-- D. update_tutorial_step — 중간 진척 저장
--    GREATEST 로만 전진. 리플레이/중복호출에도 후퇴 불가.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_tutorial_step(_step integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_step    int  := GREATEST(0, LEAST(COALESCE(_step, 0), 5));
  v_new     int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET tutorial_step = GREATEST(tutorial_step, v_step)
   WHERE user_id = v_user_id
  RETURNING tutorial_step INTO v_new;

  RETURN v_new;
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- E. update_last_unlock_check_level — 해금 스냅샷 저장
--    UI-only 데이터라 엄격한 검증 없이 직접 대입 (너무 낮추면 본인이
--    다음 방문에서 토스트를 더 많이 볼 뿐, 보안 이슈 없음).
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_last_unlock_check_level(_level integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level   int  := GREATEST(1, LEAST(COALESCE(_level, 1), 99));
  v_new     int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET last_unlock_check_level = v_level
   WHERE user_id = v_user_id
  RETURNING last_unlock_check_level INTO v_new;

  RETURN v_new;
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- F. 이전 이름 호환 래퍼 — 20260420130000 에서 만든 함수가 useTutorialState
--    에서 직접 호출 중이므로, 훅을 새 이름으로 바꾸기 전까지 깨지지 않도록
--    본체를 새 RPC 로 위임시킨다 (규칙3: 기존 call site 무손상).
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_tutorial_and_grant_reward()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.complete_tutorial_once(5);
$$;


-- ──────────────────────────────────────────────────────────────────
-- 권한 부여
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.complete_tutorial_once(integer)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tutorial_step(integer)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_unlock_check_level(integer)      TO authenticated;
-- complete_tutorial_and_grant_reward 는 이전 마이그레이션에서 이미 GRANT 되어 있음.
