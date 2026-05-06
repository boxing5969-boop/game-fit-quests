-- ============================================================
-- 153 스토리 RPG — 전투 밸런스 패치 (Stage 47B)
-- ============================================================
-- 목적:
--   1. submit_player_command RPC 갱신
--      · 가드 시 집중 +2, 풋워크 시 집중 +1 회복 (호흡 정비)
--      · 카운터 시 집중 -2 (기존 유지), 잽 시 -1 (기존 유지)
--      · 오삼이 조언 1 회 한정 + 집중 +5
--      · weakness ? p_command 매칭 시 ×1.5
--      · 가드 시 받는 데미지 절반
--      · 패배 시 HP/Focus 절반 회복 (기존: 풀 회복 → 너무 관대 → 절반)
--   2. 적 HP 적정 조정 (회원 초반 능력치 대비)
--      · 일반 적은 hp 60~110 범위로
--      · 보스 (master_door / routine_breaker / self_compare_evolved) 그대로
--
-- 보호 원칙:
--   · levels / missions / member_progress 미수정.
--   · 공식 XP 미지급 (story_xp / ring_coins 만).
--   · wallet 직접 update 0건.
--   · 기존 Stage 45 7테이블 schema 변경 0 — 마스터 데이터 row UPDATE 만.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_player_command(
  p_command text,
  p_target_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stats public.boxing_user_player_stats%ROWTYPE;
  v_battle_state jsonb;
  v_enemy_code text;
  v_enemy public.boxing_story_enemies%ROWTYPE;
  v_enemy_hp integer;
  v_enemy_hp_max integer;
  v_player_dmg integer := 0;
  v_enemy_dmg integer := 0;
  v_focus_change integer := 0;
  v_action_log jsonb := '[]'::jsonb;
  v_status text := 'ongoing';
  v_card_used boolean;
  v_osam_used boolean;
  v_turn integer;
  v_narration text;
  v_reward_xp integer := 0;
  v_reward_coins integer := 0;
  v_reward_card text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_command NOT IN ('jab','guard','footwork','counter','osam_advice','use_card') THEN
    RAISE EXCEPTION 'invalid command';
  END IF;

  -- 현재 stats + battle_state 읽기
  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'no player stats'; END IF;

  v_battle_state := COALESCE(v_stats.battle_state, '{}'::jsonb);
  IF v_battle_state = '{}'::jsonb OR v_battle_state ->> 'enemy_code' IS NULL THEN
    RAISE EXCEPTION 'no_active_battle';
  END IF;

  v_enemy_code := v_battle_state ->> 'enemy_code';
  v_enemy_hp := COALESCE((v_battle_state ->> 'enemy_hp')::integer, 0);
  v_enemy_hp_max := COALESCE((v_battle_state ->> 'enemy_max_hp')::integer, 100);
  v_card_used := COALESCE((v_battle_state ->> 'card_used')::boolean, false);
  v_osam_used := COALESCE((v_battle_state ->> 'osam_advice_used')::boolean, false);
  v_turn := COALESCE((v_battle_state ->> 'turn')::integer, 1);

  SELECT * INTO v_enemy FROM public.boxing_story_enemies WHERE code = v_enemy_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'enemy not available'; END IF;

  -- ── 명령별 처리 ───────────────────────────────────────────
  IF p_command = 'jab' THEN
    v_player_dmg := GREATEST(1, v_stats.skill - v_enemy.defense / 2);
    v_focus_change := -1;
    v_narration := '잽이 들어갑니다.';
  ELSIF p_command = 'guard' THEN
    v_player_dmg := 0;
    v_focus_change := 2;  -- 가드 = 호흡 정비
    v_narration := '가드 자세를 잡았어요. 호흡을 정비합니다.';
  ELSIF p_command = 'footwork' THEN
    v_player_dmg := GREATEST(1, v_stats.skill / 3);
    v_focus_change := 1;  -- 풋워크 = 약하지만 회복
    v_narration := '풋워크로 회피하며 견제합니다.';
  ELSIF p_command = 'counter' THEN
    IF v_stats.focus < 2 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'not enough focus');
    END IF;
    v_player_dmg := GREATEST(1, (v_stats.skill * 5) / 2 - v_enemy.defense / 2);
    v_focus_change := -2;
    v_narration := '카운터! 정확한 타이밍입니다.';
  ELSIF p_command = 'osam_advice' THEN
    IF v_osam_used THEN
      RETURN jsonb_build_object('success', false, 'reason', 'osam_already_used');
    END IF;
    v_focus_change := 5;
    v_player_dmg := 0;
    v_osam_used := true;
    v_narration := concat(
      '오삼이의 조언: ',
      COALESCE(v_battle_state ->> 'osam_hint',
               concat('약점은 ',
                      COALESCE((SELECT string_agg(k, ', ')
                                FROM jsonb_object_keys(v_enemy.weakness) k), '없음'),
                      '. 깊게 숨을 쉬어요.'))
    );
  ELSIF p_command = 'use_card' THEN
    IF v_card_used THEN
      RETURN jsonb_build_object('success', false, 'reason', 'card_already_used');
    END IF;
    v_player_dmg := v_stats.skill * 3;  -- 단순화: 카드 = 잽 ×3
    v_card_used := true;
    v_focus_change := 0;
    v_narration := '카드 발동!';
  END IF;

  -- ── 약점 매칭 (×1.5) ──────────────────────────────────────
  IF v_enemy.weakness ? p_command THEN
    v_player_dmg := (v_player_dmg * 3) / 2;
    v_narration := v_narration || ' (약점 적중!)';
  END IF;

  -- ── 적 데미지 적용 ────────────────────────────────────────
  IF v_player_dmg > 0 THEN
    v_enemy_hp := GREATEST(0, v_enemy_hp - v_player_dmg);
  END IF;

  -- ── 승/패 판정 + 적 반격 ──────────────────────────────────
  IF v_enemy_hp <= 0 THEN
    v_status := 'victory';
    v_enemy_dmg := 0;
  ELSE
    -- 적 반격 (가드 명령 시 절반)
    v_enemy_dmg := v_enemy.attack;
    IF p_command = 'guard' THEN
      v_enemy_dmg := v_enemy_dmg / 2;
    END IF;
    -- 패배 판정
    IF (v_stats.hp - v_enemy_dmg) <= 0 THEN
      v_status := 'defeat';
      v_enemy_dmg := v_stats.hp;
    END IF;
  END IF;

  -- ── 능력치 + battle_state 업데이트 ────────────────────────
  UPDATE public.boxing_user_player_stats
     SET hp = GREATEST(0, hp - v_enemy_dmg),
         focus = LEAST(focus_max, GREATEST(0, focus + v_focus_change)),
         battle_state = CASE
           WHEN v_status IN ('victory', 'defeat') THEN '{}'::jsonb
           ELSE jsonb_build_object(
             'enemy_code', v_enemy_code,
             'enemy_hp', v_enemy_hp,
             'enemy_max_hp', v_enemy_hp_max,
             'turn', v_turn + 1,
             'last_command', p_command,
             'card_used', v_card_used,
             'osam_advice_used', v_osam_used
           )
         END,
         last_played_at = now()
   WHERE user_id = v_uid;

  -- ── 승리 보상 ─────────────────────────────────────────────
  IF v_status = 'victory' THEN
    v_reward_xp := COALESCE(v_enemy.reward_story_xp, 0);
    v_reward_coins := COALESCE(v_enemy.reward_ring_coins, 0);
    v_reward_card := v_enemy.reward_card_code;

    UPDATE public.boxing_user_player_stats
       SET story_xp = story_xp + v_reward_xp,
           ring_coins = ring_coins + v_reward_coins
     WHERE user_id = v_uid;

    IF v_reward_card IS NOT NULL THEN
      INSERT INTO public.boxing_story_inventory (user_id, card_code, count, metadata)
      VALUES (v_uid, v_reward_card, 1,
              jsonb_build_object('source', 'enemy_drop', 'enemy_code', v_enemy_code))
      ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;
    END IF;
  END IF;

  -- ── 패배 시 HP/Focus 절반 회복 (기존: 풀 회복 → 절반) ──────
  IF v_status = 'defeat' THEN
    UPDATE public.boxing_user_player_stats
       SET hp = hp_max / 2,
           focus = focus_max / 2
     WHERE user_id = v_uid;
  END IF;

  -- 응답 stats 다시 읽기
  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;

  v_action_log := jsonb_build_array(
    jsonb_build_object('actor', 'player', 'line', v_narration, 'damage', v_player_dmg),
    CASE WHEN v_enemy_dmg > 0 THEN
      jsonb_build_object('actor', 'enemy', 'line', v_enemy.name || '의 공격', 'damage', v_enemy_dmg)
    ELSE
      jsonb_build_object('actor', 'enemy', 'line', v_enemy.name || ' 잠시 멈춤', 'damage', 0)
    END
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'player_hp', v_stats.hp,
    'player_focus', v_stats.focus,
    'focus_remaining', v_stats.focus,
    'enemy_hp', v_enemy_hp,
    'enemy_max_hp', v_enemy_hp_max,
    'turn', v_turn + 1,
    'action_log', v_action_log,
    'narration', v_narration,
    'player_dmg', v_player_dmg,
    'enemy_dmg', v_enemy_dmg,
    'reward_story_xp', v_reward_xp,
    'reward_ring_coins', v_reward_coins,
    'reward_card_code', v_reward_card,
    'rewards', CASE WHEN v_status = 'victory' THEN
      jsonb_build_object(
        'story_xp', v_reward_xp,
        'ring_coins', v_reward_coins,
        'card_code', v_reward_card
      )
    ELSE NULL END,
    'battle_state', CASE WHEN v_status IN ('victory', 'defeat') THEN '{}'::jsonb
      ELSE jsonb_build_object(
        'enemy_code', v_enemy_code,
        'enemy_hp', v_enemy_hp,
        'enemy_max_hp', v_enemy_hp_max,
        'turn', v_turn + 1,
        'last_command', p_command,
        'card_used', v_card_used,
        'osam_advice_used', v_osam_used
      )
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_player_command(text, jsonb) TO authenticated;

-- ============================================================
-- 적 HP 적정 조정 (초반 회원 skill ≈ 10 기준)
--   · 잽 1회 데미지 ≈ 10, 카운터 ≈ 25
--   · 일반 적은 5~7턴 안에 클리어 가능하도록
-- ============================================================
UPDATE public.boxing_story_enemies SET hp = 50  WHERE code = 'lazy_slime' AND hp > 50;
UPDATE public.boxing_story_enemies SET hp = 80  WHERE code = 'guard_breaker' AND hp > 80;
UPDATE public.boxing_story_enemies SET hp = 80  WHERE code = 'excuse_goblin' AND hp > 80;
UPDATE public.boxing_story_enemies SET hp = 100 WHERE code = 'compare_monster' AND hp > 100;
UPDATE public.boxing_story_enemies SET hp = 110 WHERE code = 'quit_demon' AND hp > 110;
UPDATE public.boxing_story_enemies SET hp = 90  WHERE code = 'tense_wolf' AND hp > 90;
UPDATE public.boxing_story_enemies SET hp = 75  WHERE code = 'breath_holder' AND hp > 75;
UPDATE public.boxing_story_enemies SET hp = 130 WHERE code = 'overtrain_golem' AND hp > 130;
-- 보스 (master_door / routine_breaker / self_compare_evolved) — 도전감 유지, 그대로

-- 검증 SQL (Dashboard 에서 직접):
-- 1) SELECT proname FROM pg_proc WHERE proname = 'submit_player_command';   -- 1 row
-- 2) SELECT code, hp FROM public.boxing_story_enemies WHERE is_boss = false ORDER BY hp;
