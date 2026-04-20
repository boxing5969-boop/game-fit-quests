-- ══════════════════════════════════════════════════════════════════
-- Master Track 41~99 — schema, seed, RPCs
--
-- 정책
--   • 기존 1~40 로직 불변 — pass_boss_battle, manual_level_up,
--     set_member_level, approve_* 전부 손대지 않는다.
--   • rank_name enum 도 건드리지 않는다. 마스터 트랙은 별도 컬럼
--     (master_track_unlocked, master_level) 로 표현한다.
--   • overall_level 은 GENERATED STORED 로 두어 인덱싱/쿼리 용이.
--   • entry 는 자동 승급하지 않는다. 코치가 enter_master_track RPC
--     를 호출해야 master_level=1 로 진입. 기존 데이터는 false/0 기본값
--     이 그대로 유지되어 호환성 보장.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. member_progress 컬럼 추가
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.member_progress
  ADD COLUMN IF NOT EXISTS master_track_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_level          integer NOT NULL DEFAULT 0;

-- 기존 1~10 검증을 해치지 않고 master 영역만 별도 제약.
-- master_level=0 은 "아직 입장 안함" 상태.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_progress_master_level_range'
  ) THEN
    ALTER TABLE public.member_progress
      ADD CONSTRAINT member_progress_master_level_range
      CHECK (
        (master_track_unlocked = false AND master_level = 0) OR
        (master_track_unlocked = true  AND master_level BETWEEN 1 AND 59)
      );
  END IF;
END$$;

-- overall_level: 1..99 단일 스케일. 마스터 트랙 입장 전에는 기존 수식,
-- 입장 후에는 40 + master_level.
ALTER TABLE public.member_progress
  ADD COLUMN IF NOT EXISTS overall_level integer GENERATED ALWAYS AS (
    CASE
      WHEN master_track_unlocked THEN 40 + master_level
      ELSE
        CASE current_rank
          WHEN 'white' THEN 0
          WHEN 'blue'  THEN 10
          WHEN 'red'   THEN 20
          WHEN 'black' THEN 30
          ELSE 0
        END + COALESCE(current_level, 1)
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS member_progress_overall_level_idx
  ON public.member_progress (overall_level DESC);


-- ──────────────────────────────────────────────────────────────────
-- B. master_level_definitions — 41~99 (master_level 1~59) 시드 테이블
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.master_level_definitions (
  master_level        integer PRIMARY KEY CHECK (master_level BETWEEN 1 AND 59),
  overall_level       integer GENERATED ALWAYS AS (40 + master_level) STORED,
  title               text    NOT NULL,
  description         text,
  is_boss             boolean NOT NULL DEFAULT false,
  xp_required         integer NOT NULL DEFAULT 0,
  sessions_required   integer NOT NULL DEFAULT 0,
  days_required       integer NOT NULL DEFAULT 0,
  -- 보상 (optional) — 여기 열거된 itemKey 는 characterCustomizationData 의 키와 일치해야 함.
  gem_reward          integer NOT NULL DEFAULT 0,
  title_reward        text,
  frame_reward        text,
  aura_reward         text,
  -- 실패 시 진행도 유지율 (보스 레벨에만 실질 의미).
  fail_retention_pct  integer NOT NULL DEFAULT 50 CHECK (fail_retention_pct BETWEEN 0 AND 100),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_level_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master defs readable by authenticated" ON public.master_level_definitions;
CREATE POLICY "master defs readable by authenticated"
  ON public.master_level_definitions
  FOR SELECT TO authenticated
  USING (true);


-- ──────────────────────────────────────────────────────────────────
-- C. master_boss_attempts — 보스 시도 감사 로그
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.master_boss_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_master_level   integer NOT NULL,
  passed                boolean NOT NULL,
  xp_snapshot           integer NOT NULL DEFAULT 0,
  retained_xp           integer NOT NULL DEFAULT 0,
  coach_note            text,
  attempted_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_boss_attempts_user_idx
  ON public.master_boss_attempts (user_id, attempted_at DESC);

ALTER TABLE public.master_boss_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boss attempts own read" ON public.master_boss_attempts;
CREATE POLICY "boss attempts own read"
  ON public.master_boss_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ));


-- ──────────────────────────────────────────────────────────────────
-- D. 시드 데이터 — 마스터 1~59단계
--    보스 레벨: 10/20/30/40/50/59 (overall 50/60/70/80/90/99)
--    normal 레벨: 100젬 / 보스: 보상 확대
-- ──────────────────────────────────────────────────────────────────
INSERT INTO public.master_level_definitions (
  master_level, title, description, is_boss,
  xp_required, sessions_required, days_required,
  gem_reward, title_reward, frame_reward, aura_reward, fail_retention_pct
)
SELECT
  gs,
  CASE
    WHEN gs = 10 THEN '챔피언 자격심사'
    WHEN gs = 20 THEN '제1방어전'
    WHEN gs = 30 THEN '제2방어전'
    WHEN gs = 40 THEN '제3방어전'
    WHEN gs = 50 THEN '제4방어전'
    WHEN gs = 59 THEN '그랜드 챔피언'
    ELSE '마스터 Lv.' || gs::text
  END,
  CASE
    WHEN gs = 10 THEN '마스터 트랙 첫 번째 관문. 통과 시 챔피언 칭호와 영원의 프레임을 획득합니다.'
    WHEN gs = 20 THEN '챔피언 방어전 — 통과 시 큰 보상이 있습니다.'
    WHEN gs = 30 THEN '챔피언 방어전 — 정상을 향한 시험.'
    WHEN gs = 40 THEN '챔피언 방어전 — 절반을 넘어섰습니다.'
    WHEN gs = 50 THEN '챔피언 방어전 — 그랜드 챔피언을 앞둔 관문.'
    WHEN gs = 59 THEN '그랜드 챔피언 시험. 레전드 칭호가 기다립니다.'
    ELSE '마스터 구간 정규 훈련 단계.'
  END,
  gs IN (10, 20, 30, 40, 50, 59),
  -- 보스는 좀 더 큰 XP/세션 요구
  CASE WHEN gs IN (10, 20, 30, 40, 50, 59) THEN 2000 ELSE 500 END,
  CASE WHEN gs IN (10, 20, 30, 40, 50, 59) THEN 12 ELSE 4 END,
  CASE WHEN gs IN (10, 20, 30, 40, 50, 59) THEN 21 ELSE 7 END,
  -- 젬
  CASE
    WHEN gs = 59 THEN 5000
    WHEN gs = 50 THEN 3000
    WHEN gs = 40 THEN 2500
    WHEN gs = 30 THEN 2000
    WHEN gs = 20 THEN 1500
    WHEN gs = 10 THEN 1000
    ELSE 100
  END,
  -- 칭호 (itemKey 는 characterCustomizationData 키와 일치)
  CASE gs
    WHEN 10 THEN 'champion'
    WHEN 59 THEN 'legend'
    ELSE NULL
  END,
  -- 프레임
  CASE gs
    WHEN 10 THEN 'eternal'
    ELSE NULL
  END,
  -- 오라
  CASE gs
    WHEN 10 THEN 'aura_rainbow'
    ELSE NULL
  END,
  -- 실패 유지율: 보스만 50%, normal 은 어차피 실패 개념 없으므로 100% 의미 없음
  50
FROM generate_series(1, 59) AS gs
ON CONFLICT (master_level) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════
-- E. RPC — 마스터 트랙 진입
--    조건: black Lv10 + bosses_cleared >= 4 (기존 마스터 조건)
--    코치/관리자 또는 본인 호출 허용 (현재 코치 승인 플로우 유연)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enter_master_track(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_is_staff boolean;
  v_rank     rank_name;
  v_level    int;
  v_bosses   int;
  v_unlocked boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_caller
       AND role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ) INTO v_is_staff;

  IF NOT v_is_staff AND v_caller <> _member_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT current_rank, current_level, COALESCE(bosses_cleared, 0), master_track_unlocked
    INTO v_rank, v_level, v_bosses, v_unlocked
    FROM member_progress
   WHERE user_id = _member_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_unlocked THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true, 'master_level', NULL);
  END IF;

  -- 기존 마스터 조건 그대로: black Lv10 + bosses_cleared >= 4
  IF v_rank <> 'black' OR v_level <> 10 OR v_bosses < 4 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_eligible',
      'required', 'black Lv10 + 4 bosses cleared',
      'current_rank', v_rank,
      'current_level', v_level,
      'bosses_cleared', v_bosses
    );
  END IF;

  UPDATE member_progress
     SET master_track_unlocked = true,
         master_level = 1,
         updated_at = now()
   WHERE user_id = _member_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_unlocked', false,
    'master_level', 1,
    'overall_level', 41
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════════
-- F. RPC — 마스터 레벨 일반 승급 (non-boss)
--    조건: master 트랙 활성 + 다음 레벨이 보스가 아니어야 함
--    (보스 레벨은 attempt_master_boss 로 통과해야 지나감)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_master_level(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_is_staff boolean;
  v_unlocked boolean;
  v_current  int;
  v_target   int;
  v_is_boss  boolean;
  v_def      master_level_definitions%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_caller
       AND role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT master_track_unlocked, master_level
    INTO v_unlocked, v_current
    FROM member_progress
   WHERE user_id = _member_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_unlocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'master_track_locked');
  END IF;

  IF v_current >= 59 THEN
    RETURN jsonb_build_object('success', false, 'error', 'at_grand_champion');
  END IF;

  v_target := v_current + 1;

  SELECT is_boss INTO v_is_boss
    FROM master_level_definitions
   WHERE master_level = v_current;

  -- 현재 위치가 보스 레벨이면 일반 승급 RPC 로는 못 빠져나감.
  -- 반드시 attempt_master_boss 로 통과해야 한다.
  IF v_is_boss THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'boss_required',
      'current_master_level', v_current
    );
  END IF;

  SELECT * INTO v_def
    FROM master_level_definitions
   WHERE master_level = v_target;

  UPDATE member_progress
     SET master_level = v_target,
         updated_at = now()
   WHERE user_id = _member_id;

  -- 일반 레벨 도달 보상 (젬) — 칭호/프레임/오라는 보스에만 배정되어 있음
  IF v_def.gem_reward > 0 THEN
    INSERT INTO user_wallets (user_id, gems_balance, total_earned)
    VALUES (_member_id, v_def.gem_reward, v_def.gem_reward)
    ON CONFLICT (user_id) DO UPDATE
      SET gems_balance = user_wallets.gems_balance + v_def.gem_reward,
          total_earned = user_wallets.total_earned + v_def.gem_reward,
          updated_at   = now();

    INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
    VALUES (
      _member_id,
      v_def.gem_reward,
      'master_level_up',
      jsonb_build_object('master_level', v_target, 'overall_level', 40 + v_target)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'master_level', v_target,
    'overall_level', 40 + v_target,
    'granted_gems', v_def.gem_reward
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════════
-- G. RPC — 마스터 보스 시도 (통과 OR 실패 기록)
--    통과: master_level++, 보상 지급 (젬 + title/frame/aura 해금 이벤트)
--    실패: 진행도 일부 유지 (total_xp × retention_pct), level 유지
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.attempt_master_boss(
  _member_id uuid,
  _passed    boolean,
  _coach_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_is_staff   boolean;
  v_unlocked   boolean;
  v_current    int;
  v_xp         int;
  v_is_boss    boolean;
  v_def        master_level_definitions%ROWTYPE;
  v_target     int;
  v_retained   int;
  v_lost       int;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_caller
       AND role IN ('coach', 'branch_manager', 'admin', 'super_admin')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT master_track_unlocked, master_level, COALESCE(total_xp, 0)
    INTO v_unlocked, v_current, v_xp
    FROM member_progress
   WHERE user_id = _member_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_unlocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'master_track_locked');
  END IF;

  SELECT * INTO v_def
    FROM master_level_definitions
   WHERE master_level = v_current;

  IF NOT FOUND OR NOT v_def.is_boss THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_at_boss_level',
                              'current_master_level', v_current);
  END IF;

  IF _passed THEN
    v_target := LEAST(v_current + 1, 59);

    UPDATE member_progress
       SET master_level = v_target,
           updated_at = now()
     WHERE user_id = _member_id;

    -- 보상 지급 — 젬은 지갑에 반영, 칭호/프레임/오라는 user_owned_customizations 해금
    IF v_def.gem_reward > 0 THEN
      INSERT INTO user_wallets (user_id, gems_balance, total_earned)
      VALUES (_member_id, v_def.gem_reward, v_def.gem_reward)
      ON CONFLICT (user_id) DO UPDATE
        SET gems_balance = user_wallets.gems_balance + v_def.gem_reward,
            total_earned = user_wallets.total_earned + v_def.gem_reward,
            updated_at   = now();

      INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
      VALUES (
        _member_id,
        v_def.gem_reward,
        'master_boss_pass',
        jsonb_build_object('master_level', v_current, 'overall_level', 40 + v_current)
      );
    END IF;

    IF v_def.title_reward IS NOT NULL THEN
      INSERT INTO user_owned_customizations (user_id, category, item_key)
      VALUES (_member_id, 'title', v_def.title_reward)
      ON CONFLICT (user_id, category, item_key) DO NOTHING;
    END IF;
    IF v_def.frame_reward IS NOT NULL THEN
      INSERT INTO user_owned_customizations (user_id, category, item_key)
      VALUES (_member_id, 'frame', v_def.frame_reward)
      ON CONFLICT (user_id, category, item_key) DO NOTHING;
    END IF;
    IF v_def.aura_reward IS NOT NULL THEN
      INSERT INTO user_owned_customizations (user_id, category, item_key)
      VALUES (_member_id, 'aura', v_def.aura_reward)
      ON CONFLICT (user_id, category, item_key) DO NOTHING;
    END IF;

    INSERT INTO master_boss_attempts (
      user_id, target_master_level, passed, xp_snapshot, retained_xp, coach_note
    ) VALUES (
      _member_id, v_current, true, v_xp, v_xp, _coach_note
    );

    RETURN jsonb_build_object(
      'success', true,
      'passed', true,
      'master_level', v_target,
      'overall_level', 40 + v_target,
      'granted_gems', v_def.gem_reward,
      'title_reward', v_def.title_reward,
      'frame_reward', v_def.frame_reward,
      'aura_reward', v_def.aura_reward
    );
  ELSE
    -- 실패: master_level 유지, total_xp 의 (1 - retention%) 만 차감
    v_retained := (v_xp * v_def.fail_retention_pct / 100)::int;
    v_lost     := v_xp - v_retained;

    UPDATE member_progress
       SET total_xp   = v_retained,
           updated_at = now()
     WHERE user_id = _member_id;

    INSERT INTO master_boss_attempts (
      user_id, target_master_level, passed, xp_snapshot, retained_xp, coach_note
    ) VALUES (
      _member_id, v_current, false, v_xp, v_retained, _coach_note
    );

    RETURN jsonb_build_object(
      'success', true,
      'passed', false,
      'master_level', v_current,
      'overall_level', 40 + v_current,
      'xp_before', v_xp,
      'xp_after', v_retained,
      'xp_lost', v_lost,
      'retention_pct', v_def.fail_retention_pct
    );
  END IF;
END;
$$;


-- ══════════════════════════════════════════════════════════════════
-- H. RPC — 클라이언트 조회용 통합 유저 레벨
--    get_caller_user_level 이 이미 있으므로 master 트랙 인식하도록 교체.
--    기존 입력/반환 시그니처 유지 (하위 호환).
-- ══════════════════════════════════════════════════════════════════
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
  v_master_unlocked boolean;
  v_master_level    int;
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 1;
  END IF;

  SELECT mp.current_rank, mp.current_level, mp.bosses_cleared,
         mp.master_track_unlocked, mp.master_level
    INTO v_rank, v_level, v_bosses, v_master_unlocked, v_master_level
    FROM member_progress mp
   WHERE mp.user_id = v_user_id;

  IF v_rank IS NULL THEN
    RETURN 1;
  END IF;

  -- Master 트랙 진입자는 40 + master_level 로 즉시 매핑 (우선순위 최상위)
  IF v_master_unlocked THEN
    RETURN 40 + COALESCE(v_master_level, 1);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id
       AND role IN ('super_admin', 'admin', 'branch_manager')
  ) INTO v_is_admin;

  -- 이하 기존 1~40 / 50 / 99 로직 보존 (master_track_unlocked=false 인 케이스용)
  IF v_rank = 'black' AND v_level = 10 AND NOT v_is_admin THEN
    RETURN 99;
  END IF;

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
-- I. 권한
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.enter_master_track(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_master_level(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.attempt_master_boss(uuid, boolean, text)   TO authenticated;
-- get_caller_user_level 권한은 이전 마이그레이션에서 이미 부여됨.
