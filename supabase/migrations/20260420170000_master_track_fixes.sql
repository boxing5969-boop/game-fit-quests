-- ══════════════════════════════════════════════════════════════════
-- Master Track QA 패치 — 20260420160000 의 직접 후속
--
-- 수정 항목
--   1. advance_master_level
--      - 보스 레벨에 "도달" 할 때는 gem_reward 를 주지 않는다.
--        (보상은 보스 통과 RPC 에서만 지급.)
--      - _expected_current 선택 파라미터 추가. 클라이언트가 현재로
--        알고 있는 master_level 과 서버 값이 다르면 stale_state 반환
--        → 동시 연타로 인한 2레벨 점프 방지.
--   2. attempt_master_boss
--      - _expected_current 선택 파라미터 추가. 동일한 동시성 방어.
--   3. get_division_ranking
--      - 마스터 트랙 진입자들이 전원 black Lv10 으로 묶여 구별이 안
--        되던 문제 해결. overall_level DESC 를 최상위 타이브레이커로.
--   4. get_hall_of_fame
--      - overall_level DESC 를 최상위 타이브레이커로 추가.
--        기존 (bosses_cleared, total_xp) 순서는 뒤로 밀린다.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. advance_master_level (shadowing the prior definition)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.advance_master_level(
  _member_id uuid,
  _expected_current integer DEFAULT NULL
)
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
  v_cur_is_boss boolean;
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

  -- Stale-state guard: clients pass the level they believe is current.
  IF _expected_current IS NOT NULL AND v_current <> _expected_current THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'stale_state',
      'current_master_level', v_current
    );
  END IF;

  IF v_current >= 59 THEN
    RETURN jsonb_build_object('success', false, 'error', 'at_grand_champion');
  END IF;

  v_target := v_current + 1;

  SELECT is_boss INTO v_cur_is_boss
    FROM master_level_definitions
   WHERE master_level = v_current;

  IF v_cur_is_boss THEN
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

  -- 보상은 "비-보스 target 에 도달" 할 때만 지급.
  -- 보스 도착은 통과 전까지 미지급 — 통과 시 attempt_master_boss 가 지급.
  IF v_def.gem_reward > 0 AND NOT v_def.is_boss THEN
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
    'granted_gems', CASE WHEN v_def.is_boss THEN 0 ELSE v_def.gem_reward END,
    'arrived_at_boss', v_def.is_boss
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 2. attempt_master_boss — add _expected_current guard
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attempt_master_boss(
  _member_id        uuid,
  _passed           boolean,
  _coach_note       text    DEFAULT NULL,
  _expected_current integer DEFAULT NULL
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

  IF _expected_current IS NOT NULL AND v_current <> _expected_current THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'stale_state',
      'current_master_level', v_current
    );
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


-- ──────────────────────────────────────────────────────────────────
-- 3. get_division_ranking — master 진입자 정렬 타이브레이커
--    기존 WHERE 과 파라미터는 그대로. ORDER BY 와 ROW_NUMBER()
--    파티션 ORDER 에 overall_level 우선 적용.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_division_ranking(
  _branch_name text DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  r_total_xp integer,
  r_streak_days integer,
  rank_position bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
      ) THEN _branch_name
      ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
    END AS branch_filter
  ),
  scoped AS (
    SELECT
      mp.user_id,
      p.nickname,
      p.avatar_url,
      mp.current_rank,
      mp.current_level,
      mp.bosses_cleared,
      mp.total_xp,
      mp.streak_days,
      mp.overall_level,
      ROW_NUMBER() OVER (
        ORDER BY mp.overall_level DESC,
                 mp.bosses_cleared DESC,
                 mp.total_xp DESC
      ) AS rank_position
    FROM member_progress mp
    JOIN profiles p ON p.user_id = mp.user_id
    CROSS JOIN effective_filter ef
    WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
  )
  SELECT
    user_id, nickname, avatar_url, current_rank, current_level,
    bosses_cleared, total_xp, streak_days, rank_position
  FROM scoped
  ORDER BY rank_position
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 4. get_hall_of_fame — overall_level 최상위 타이브레이커
--    기존 조건 (black Lv10 + 비관리자) 그대로. master 트랙 진입자는
--    여전히 black Lv10 이므로 동일 집합. 단 master 59 가 master 1 보다
--    위에 오도록 정렬 강화.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hall_of_fame(_limit integer DEFAULT 20)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  r_total_xp integer,
  r_branch_name text,
  rank_position bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, p.branch_name,
    ROW_NUMBER() OVER (
      ORDER BY mp.overall_level DESC,
               mp.bosses_cleared DESC,
               mp.total_xp DESC
    ) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE mp.current_rank = 'black' AND mp.current_level = 10
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = mp.user_id
         AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  ORDER BY mp.overall_level DESC,
           mp.bosses_cleared DESC,
           mp.total_xp DESC
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 권한 재부여 (시그니처 변경된 경우만 필요)
-- ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.advance_master_level(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attempt_master_boss(uuid, boolean, text, integer) TO authenticated;
