-- ══════════════════════════════════════════════════════════════════
-- HoF 보상 — 최초 입성 + 주간/월간 유지 + 시즌(placeholder)
--
-- 구조
--   A. hof_reward_config   — (kind, amount) 단일 설정 테이블
--   B. hof_reward_claims   — (user_id, kind, period_key) 감사+멱등 키
--   C. RPCs:
--        claim_hof_first_entry()
--        claim_hof_weekly_reward()
--        claim_hof_monthly_reward()
--        claim_hof_season_reward()   ← placeholder
--
-- 정책
--   • HoF 자격 판정은 is_caller_in_hall_of_fame() 만 사용 — 별도 플래그
--     컬럼을 두지 않음 (파생 상태, 기존 랭킹/HoF 로직 유지).
--   • 멱등성: hof_reward_claims.(user_id, kind, period_key) UNIQUE.
--     ON CONFLICT DO NOTHING + RETURNING 이 NULL 이면 이미 지급.
--   • 금액은 config 테이블에서 읽어 향후 정책 변경 시 DB 만 갱신하면 됨.
--   • 프론트에서 직접 젬 증가 없음. 모든 지급은 SECURITY DEFINER RPC 내부에서
--     user_wallets upsert + wallet_transactions 감사 로그.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 보상 금액 설정
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hof_reward_config (
  kind        text        PRIMARY KEY
              CHECK (kind IN ('first', 'weekly', 'monthly', 'season')),
  amount      integer     NOT NULL CHECK (amount >= 0),
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.hof_reward_config (kind, amount, description) VALUES
  ('first',   120000, 'HoF 최초 입성 1회 보상'),
  ('weekly',  15000,  'HoF 주간 유지 보상 (ISO week 단위)'),
  ('monthly', 40000,  'HoF 월간 유지 보상 (KST 달력 단위)'),
  ('season',  0,      '시즌 보상 — 정책 미정, 0 = 미지급')
ON CONFLICT (kind) DO NOTHING;

ALTER TABLE public.hof_reward_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hof_reward_config readable by authenticated" ON public.hof_reward_config;
CREATE POLICY "hof_reward_config readable by authenticated"
  ON public.hof_reward_config
  FOR SELECT TO authenticated
  USING (true);


-- ──────────────────────────────────────────────────────────────────
-- B. 보상 지급 이력 (멱등 + 감사)
--    period_key 형식
--      first   → 'once'
--      weekly  → 'YYYY-WIW'  예: '2026-W17'
--      monthly → 'YYYY-MM'   예: '2026-04'
--      season  → 'YYYY-Sn'   예: '2026-S1'  (정책 확정 후)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hof_reward_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL
              CHECK (kind IN ('first', 'weekly', 'monthly', 'season')),
  period_key  text        NOT NULL,
  amount      integer     NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_key)
);

CREATE INDEX IF NOT EXISTS hof_reward_claims_user_idx
  ON public.hof_reward_claims (user_id, granted_at DESC);

ALTER TABLE public.hof_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hof_reward_claims own read" ON public.hof_reward_claims;
CREATE POLICY "hof_reward_claims own read"
  ON public.hof_reward_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ));


-- ──────────────────────────────────────────────────────────────────
-- 공통 헬퍼 — 보상 지급 한 번 (내부 SECURITY DEFINER)
--    반환:
--      { success:true, already_granted:false, amount:N, balance:B }  새로 지급
--      { success:true, already_granted:true,  amount:0, balance:B }  이미 지급됨
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._grant_hof_reward_once(
  _user_id    uuid,
  _kind       text,
  _period_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount  int;
  v_granted int;
  v_balance int;
BEGIN
  SELECT amount INTO v_amount
    FROM hof_reward_config WHERE kind = _kind;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', true, 'already_granted', false, 'amount', 0,
      'balance', COALESCE((SELECT gems_balance FROM user_wallets WHERE user_id = _user_id), 0)
    );
  END IF;

  -- 멱등 핵: UNIQUE(user_id, kind, period_key) 충돌이면 RETURNING 이 NULL.
  INSERT INTO hof_reward_claims (user_id, kind, period_key, amount)
  VALUES (_user_id, _kind, _period_key, v_amount)
  ON CONFLICT (user_id, kind, period_key) DO NOTHING
  RETURNING amount INTO v_granted;

  IF v_granted IS NULL THEN
    SELECT gems_balance INTO v_balance FROM user_wallets WHERE user_id = _user_id;
    RETURN jsonb_build_object(
      'success', true, 'already_granted', true, 'amount', 0,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- 지갑 반영 + 감사 로그 (wallet_transactions).
  INSERT INTO user_wallets (user_id, gems_balance, total_earned)
  VALUES (_user_id, v_granted, v_granted)
  ON CONFLICT (user_id) DO UPDATE
    SET gems_balance = user_wallets.gems_balance + v_granted,
        total_earned = user_wallets.total_earned + v_granted,
        updated_at   = now()
  RETURNING gems_balance INTO v_balance;

  INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
  VALUES (
    _user_id,
    v_granted,
    'hof_reward_' || _kind,
    jsonb_build_object('kind', _kind, 'period_key', _period_key)
  );

  RETURN jsonb_build_object(
    'success', true, 'already_granted', false,
    'amount', v_granted, 'balance', v_balance
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- C. claim_hof_first_entry — 최초 입성 1회 지급
--    period_key = 'once'
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_hof_first_entry()
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
  IF NOT public.is_caller_in_hall_of_fame() THEN
    RETURN jsonb_build_object('success', false, 'error', 'hof_required');
  END IF;
  RETURN public._grant_hof_reward_once(v_user_id, 'first', 'once');
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- D. claim_hof_weekly_reward — ISO 주차 단위 1회
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_hof_weekly_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_key     text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT public.is_caller_in_hall_of_fame() THEN
    RETURN jsonb_build_object('success', false, 'error', 'hof_required');
  END IF;

  -- KST 기준 ISO 주차. 예: '2026-W17'
  v_key := to_char(timezone('Asia/Seoul', now()), 'IYYY"-W"IW');

  RETURN public._grant_hof_reward_once(v_user_id, 'weekly', v_key);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- E. claim_hof_monthly_reward — KST 월 단위 1회
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_hof_monthly_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_key     text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT public.is_caller_in_hall_of_fame() THEN
    RETURN jsonb_build_object('success', false, 'error', 'hof_required');
  END IF;

  -- KST 기준 YYYY-MM. 월 경계에 이미 지급된 경우 자동 차단.
  v_key := to_char(timezone('Asia/Seoul', now()), 'YYYY-MM');

  RETURN public._grant_hof_reward_once(v_user_id, 'monthly', v_key);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- F. claim_hof_season_reward — placeholder
--    현재는 not_implemented 반환, 향후 정책 확정 시 period_key 계산만
--    채우면 된다 (예: 시즌 종료 스케줄 기준 '2026-S1').
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_hof_season_reward()
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
  IF NOT public.is_caller_in_hall_of_fame() THEN
    RETURN jsonb_build_object('success', false, 'error', 'hof_required');
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'not_implemented',
    'message', '시즌 보상 정책 미확정'
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 권한
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public._grant_hof_reward_once(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hof_first_entry()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hof_weekly_reward()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hof_monthly_reward()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hof_season_reward()                TO authenticated;
