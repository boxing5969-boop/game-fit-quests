-- ============================================================
-- 153 스토리 RPG — 독립형 게임 모드 DB 재설계 (Stage 45)
-- ============================================================
-- 목적: Stage 44 시나리오 (docs/153-story-rpg-game-scenario.md) 를 DB 로 구현.
--
-- 신규:
--   · 테이블 7 (scenes / enemies / cards / inventory / player_stats / scene_progress / ending_claims)
--   · RPC 8 (start_story_session / progress_to_scene / apply_choice / start_battle /
--          submit_player_command / claim_card_reward / complete_ending / reset_story_route)
--   · seed: enemies 11, cards 9, scenes ~176 (prologue 4 + chapter 172)
-- 삭제:
--   · sync_story_chapter_progress / claim_story_chapter_reward / _story_chapter_progress
--     (기존 운동 데이터 의존 RPC — 독립형 게임으로 전환)
-- 유지:
--   · boxing_story_routes / chapters / nodes / dialogues (43A 콘텐츠)
--   · get_my_story_rpg_state / choose_story_route / change_story_route
--
-- 보호 원칙:
--   · levels / missions / mission_videos / mission_submissions / member_progress 미수정.
--   · approve_mission_submission / record_attendance 호출 금지.
--   · 공식 XP 미지급. member_progress 일절 미수정.
--   · 파이트 머니는 grant_gems RPC 경유 (직접 wallet update 금지).
--   · ChatAssistant / chat-assistant Edge 호출 0건 (정적 시나리오 + 게임 로직만).
-- ============================================================

-- =====================================================================
-- 1. 신규 테이블 7개
-- =====================================================================

-- 1A. boxing_story_scenes — 게임 씬 단위
CREATE TABLE IF NOT EXISTS public.boxing_story_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'chapter'
    CHECK (scope IN ('prologue', 'chapter')),
  route_id uuid REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.boxing_story_chapters(id) ON DELETE CASCADE,
  scene_index integer NOT NULL,
  scene_type text NOT NULL
    CHECK (scene_type IN ('dialogue', 'choice', 'battle', 'node_move', 'ending')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_scene_index integer,
  next_scene_victory integer,
  next_scene_defeat integer,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ 부분 (partial) unique index 는 INSERT ... ON CONFLICT 추론과 잘 맞지 않아 42P10 오류를 유발한다.
-- 통합 NULLS NOT DISTINCT unique constraint (PostgreSQL 15+) 로 대체한다.
-- · 이전 버전 마이그레이션이 부분 인덱스를 만들었을 수 있으므로 먼저 정리.
DROP INDEX IF EXISTS public.boxing_story_scenes_chapter_unique;
DROP INDEX IF EXISTS public.boxing_story_scenes_prologue_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'boxing_story_scenes_scope_chapter_scene_uniq'
      AND conrelid = 'public.boxing_story_scenes'::regclass
  ) THEN
    -- 기존 행에 중복이 있으면 ALTER 가 실패하므로 안전 정리 (fresh table 이면 영향 없음)
    DELETE FROM public.boxing_story_scenes a
    USING public.boxing_story_scenes b
    WHERE a.id < b.id
      AND a.scope = b.scope
      AND a.scene_index = b.scene_index
      AND COALESCE(a.chapter_id::text, '') = COALESCE(b.chapter_id::text, '');

    ALTER TABLE public.boxing_story_scenes
      ADD CONSTRAINT boxing_story_scenes_scope_chapter_scene_uniq
      UNIQUE NULLS NOT DISTINCT (scope, chapter_id, scene_index);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boxing_story_scenes_route_scope
  ON public.boxing_story_scenes (route_id, scope);
CREATE INDEX IF NOT EXISTS idx_boxing_story_scenes_chapter_index
  ON public.boxing_story_scenes (chapter_id, scene_index);

ALTER TABLE public.boxing_story_scenes ENABLE ROW LEVEL SECURITY;

-- 1B. boxing_story_enemies
CREATE TABLE IF NOT EXISTS public.boxing_story_enemies (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  hp integer NOT NULL DEFAULT 50,
  attack integer NOT NULL DEFAULT 5,
  defense integer NOT NULL DEFAULT 0,
  pattern_code text NOT NULL,
  pattern_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  weakness jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_story_xp integer NOT NULL DEFAULT 0,
  reward_ring_coins integer NOT NULL DEFAULT 0,
  reward_card_code text,
  is_boss boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boxing_story_enemies ENABLE ROW LEVEL SECURITY;

-- 1C. boxing_story_cards
CREATE TABLE IF NOT EXISTS public.boxing_story_cards (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  effect_code text,
  effect_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_consumable boolean NOT NULL DEFAULT true,
  rarity text NOT NULL DEFAULT 'common',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boxing_story_cards ENABLE ROW LEVEL SECURITY;

-- 1D. boxing_story_inventory
CREATE TABLE IF NOT EXISTS public.boxing_story_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_code text NOT NULL REFERENCES public.boxing_story_cards(code) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 1,
  first_acquired_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_story_inventory_user_card_unique UNIQUE (user_id, card_code)
);
CREATE INDEX IF NOT EXISTS idx_boxing_story_inventory_user
  ON public.boxing_story_inventory (user_id, first_acquired_at DESC);
ALTER TABLE public.boxing_story_inventory ENABLE ROW LEVEL SECURITY;

-- 1E. boxing_user_player_stats
CREATE TABLE IF NOT EXISTS public.boxing_user_player_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_route_code text,
  prologue_completed boolean NOT NULL DEFAULT false,
  hp integer NOT NULL DEFAULT 100,
  hp_max integer NOT NULL DEFAULT 100,
  focus integer NOT NULL DEFAULT 10,
  focus_max integer NOT NULL DEFAULT 30,
  skill integer NOT NULL DEFAULT 10,
  skill_max integer NOT NULL DEFAULT 50,
  guard integer NOT NULL DEFAULT 10,
  guard_max integer NOT NULL DEFAULT 50,
  grit integer NOT NULL DEFAULT 10,
  grit_max integer NOT NULL DEFAULT 50,
  respect integer NOT NULL DEFAULT 0,
  respect_max integer NOT NULL DEFAULT 100,
  story_xp integer NOT NULL DEFAULT 0,
  ring_coins integer NOT NULL DEFAULT 0,
  earned_titles jsonb NOT NULL DEFAULT '[]'::jsonb,
  earned_endings jsonb NOT NULL DEFAULT '[]'::jsonb,
  earned_badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  battle_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_played_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_stats_hp_chk CHECK (hp BETWEEN 0 AND hp_max),
  CONSTRAINT player_stats_focus_chk CHECK (focus BETWEEN 0 AND focus_max),
  CONSTRAINT player_stats_skill_chk CHECK (skill BETWEEN 0 AND skill_max),
  CONSTRAINT player_stats_guard_chk CHECK (guard BETWEEN 0 AND guard_max),
  CONSTRAINT player_stats_grit_chk CHECK (grit BETWEEN 0 AND grit_max),
  CONSTRAINT player_stats_respect_chk CHECK (respect BETWEEN 0 AND respect_max),
  CONSTRAINT player_stats_story_xp_chk CHECK (story_xp >= 0),
  CONSTRAINT player_stats_ring_coins_chk CHECK (ring_coins >= 0)
);
ALTER TABLE public.boxing_user_player_stats ENABLE ROW LEVEL SECURITY;

-- 1F. boxing_user_scene_progress
CREATE TABLE IF NOT EXISTS public.boxing_user_scene_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.boxing_story_chapters(id) ON DELETE SET NULL,
  current_scene_index integer NOT NULL DEFAULT 0,
  completed_chapter_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ending_reached boolean NOT NULL DEFAULT false,
  ending_code text,
  first_clear_at timestamptz,
  last_played_at timestamptz,
  play_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scene_progress_user_route_unique UNIQUE (user_id, route_id)
);
CREATE INDEX IF NOT EXISTS idx_boxing_user_scene_progress_user
  ON public.boxing_user_scene_progress (user_id, last_played_at DESC);
ALTER TABLE public.boxing_user_scene_progress ENABLE ROW LEVEL SECURITY;

-- 1G. boxing_story_ending_claims
CREATE TABLE IF NOT EXISTS public.boxing_story_ending_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  ending_code text NOT NULL,
  story_xp_granted integer NOT NULL DEFAULT 0,
  ring_coins_granted integer NOT NULL DEFAULT 0,
  real_gems_granted integer NOT NULL DEFAULT 0,
  reward_title text,
  reward_card_code text,
  reward_badge_code text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ending_claims_user_route_ending_unique UNIQUE (user_id, route_id, ending_code)
);
CREATE INDEX IF NOT EXISTS idx_boxing_story_ending_claims_user
  ON public.boxing_story_ending_claims (user_id, claimed_at DESC);
ALTER TABLE public.boxing_story_ending_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. updated_at 트리거 (기존 boxing_engagement_set_updated_at 재사용)
-- =====================================================================
DROP TRIGGER IF EXISTS trg_boxing_story_scenes_updated_at ON public.boxing_story_scenes;
CREATE TRIGGER trg_boxing_story_scenes_updated_at
  BEFORE UPDATE ON public.boxing_story_scenes
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_story_enemies_updated_at ON public.boxing_story_enemies;
CREATE TRIGGER trg_boxing_story_enemies_updated_at
  BEFORE UPDATE ON public.boxing_story_enemies
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_user_player_stats_updated_at ON public.boxing_user_player_stats;
CREATE TRIGGER trg_boxing_user_player_stats_updated_at
  BEFORE UPDATE ON public.boxing_user_player_stats
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_user_scene_progress_updated_at ON public.boxing_user_scene_progress;
CREATE TRIGGER trg_boxing_user_scene_progress_updated_at
  BEFORE UPDATE ON public.boxing_user_scene_progress
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

-- =====================================================================
-- 3. RLS 정책
-- =====================================================================

-- 마스터 데이터 — 회원 SELECT (active=true), admin ALL
DROP POLICY IF EXISTS "story_scenes_select_active_or_admin" ON public.boxing_story_scenes;
CREATE POLICY "story_scenes_select_active_or_admin"
  ON public.boxing_story_scenes FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_scenes_admin_manage" ON public.boxing_story_scenes;
CREATE POLICY "story_scenes_admin_manage"
  ON public.boxing_story_scenes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_enemies_select_active_or_admin" ON public.boxing_story_enemies;
CREATE POLICY "story_enemies_select_active_or_admin"
  ON public.boxing_story_enemies FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_enemies_admin_manage" ON public.boxing_story_enemies;
CREATE POLICY "story_enemies_admin_manage"
  ON public.boxing_story_enemies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_cards_select_active_or_admin" ON public.boxing_story_cards;
CREATE POLICY "story_cards_select_active_or_admin"
  ON public.boxing_story_cards FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_cards_admin_manage" ON public.boxing_story_cards;
CREATE POLICY "story_cards_admin_manage"
  ON public.boxing_story_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 회원 본인 데이터 — RPC 경유 INSERT/UPDATE
DROP POLICY IF EXISTS "story_inventory_select_self_or_admin" ON public.boxing_story_inventory;
CREATE POLICY "story_inventory_select_self_or_admin"
  ON public.boxing_story_inventory FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "story_player_stats_select_self_or_admin" ON public.boxing_user_player_stats;
CREATE POLICY "story_player_stats_select_self_or_admin"
  ON public.boxing_user_player_stats FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "story_scene_progress_select_self_or_admin" ON public.boxing_user_scene_progress;
CREATE POLICY "story_scene_progress_select_self_or_admin"
  ON public.boxing_user_scene_progress FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "story_ending_claims_select_self_or_admin" ON public.boxing_story_ending_claims;
CREATE POLICY "story_ending_claims_select_self_or_admin"
  ON public.boxing_story_ending_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- =====================================================================
-- 4. 기존 RPC DROP (Stage 34 운동 의존 → Stage 45 독립형으로 전환)
-- =====================================================================
DROP FUNCTION IF EXISTS public.sync_story_chapter_progress(text);
DROP FUNCTION IF EXISTS public.claim_story_chapter_reward(uuid);
DROP FUNCTION IF EXISTS public._story_chapter_progress(uuid, public.boxing_story_chapters, uuid);

-- =====================================================================
-- 5. 신규 RPC 8개
-- =====================================================================

-- helper: stat clamp
CREATE OR REPLACE FUNCTION public._story_clamp_int(v integer, lo integer, hi integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT GREATEST(lo, LEAST(hi, COALESCE(v, lo)));
$$;

-- 5A. start_story_session
CREATE OR REPLACE FUNCTION public.start_story_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stats public.boxing_user_player_stats%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  INSERT INTO public.boxing_user_player_stats (user_id, last_played_at)
  VALUES (v_uid, now())
  ON CONFLICT (user_id) DO UPDATE SET last_played_at = now();

  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'stats', to_jsonb(v_stats),
    'active_route_code', v_stats.active_route_code,
    'prologue_completed', v_stats.prologue_completed
  );
END;
$$;

-- 5B. progress_to_scene
CREATE OR REPLACE FUNCTION public.progress_to_scene(
  p_route_id uuid,
  p_chapter_id uuid,
  p_scene_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_scene public.boxing_story_scenes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- prologue 의 경우 route_id, chapter_id NULL
  IF p_chapter_id IS NULL AND p_route_id IS NULL THEN
    SELECT * INTO v_scene FROM public.boxing_story_scenes
    WHERE scope = 'prologue' AND scene_index = p_scene_index AND active = true;
  ELSE
    SELECT * INTO v_scene FROM public.boxing_story_scenes
    WHERE chapter_id = p_chapter_id AND scene_index = p_scene_index AND active = true;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'scene not found');
  END IF;

  -- progress 갱신 (chapter 씬일 때만)
  IF p_route_id IS NOT NULL THEN
    INSERT INTO public.boxing_user_scene_progress
      (user_id, route_id, chapter_id, current_scene_index, last_played_at)
    VALUES (v_uid, p_route_id, p_chapter_id, p_scene_index, now())
    ON CONFLICT (user_id, route_id) DO UPDATE SET
      chapter_id = EXCLUDED.chapter_id,
      current_scene_index = EXCLUDED.current_scene_index,
      last_played_at = now();
  END IF;

  -- prologue 마지막 씬(3, choice) 통과 시 prologue_completed = true
  IF v_scene.scope = 'prologue' THEN
    UPDATE public.boxing_user_player_stats
    SET prologue_completed = true, last_played_at = now()
    WHERE user_id = v_uid AND prologue_completed = false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'scene_id', v_scene.id,
    'scene_type', v_scene.scene_type,
    'scene_index', v_scene.scene_index,
    'payload', v_scene.payload,
    'next_scene_index', v_scene.next_scene_index,
    'next_scene_victory', v_scene.next_scene_victory,
    'next_scene_defeat', v_scene.next_scene_defeat
  );
END;
$$;

-- 5C. apply_choice
CREATE OR REPLACE FUNCTION public.apply_choice(
  p_scene_id uuid,
  p_choice_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_scene public.boxing_story_scenes%ROWTYPE;
  v_choices jsonb;
  v_choice jsonb;
  v_stat_changes jsonb;
  v_inventory_grants jsonb;
  v_card text;
  v_next_scene integer;
  v_route_choice text;
  v_stats public.boxing_user_player_stats%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_scene FROM public.boxing_story_scenes
  WHERE id = p_scene_id AND active = true AND scene_type = 'choice';
  IF NOT FOUND THEN RAISE EXCEPTION 'choice scene not available'; END IF;

  v_choices := COALESCE(v_scene.payload->'choices', '[]'::jsonb);
  v_choice := v_choices->p_choice_index;
  IF v_choice IS NULL THEN RAISE EXCEPTION 'choice index out of range'; END IF;

  v_stat_changes := COALESCE(v_choice->'stat_changes', '{}'::jsonb);
  v_inventory_grants := COALESCE(v_choice->'inventory_grants', '[]'::jsonb);
  v_next_scene := COALESCE((v_choice->>'next_scene')::integer, -1);
  v_route_choice := v_choice->>'route_choice';

  PERFORM public.start_story_session();

  -- stat 변경 (clamp)
  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  UPDATE public.boxing_user_player_stats SET
    hp = public._story_clamp_int(v_stats.hp + COALESCE((v_stat_changes->>'hp')::int, 0), 0, v_stats.hp_max),
    focus = public._story_clamp_int(v_stats.focus + COALESCE((v_stat_changes->>'focus')::int, 0), 0, v_stats.focus_max),
    skill = public._story_clamp_int(v_stats.skill + COALESCE((v_stat_changes->>'skill')::int, 0), 0, v_stats.skill_max),
    guard = public._story_clamp_int(v_stats.guard + COALESCE((v_stat_changes->>'guard')::int, 0), 0, v_stats.guard_max),
    grit = public._story_clamp_int(v_stats.grit + COALESCE((v_stat_changes->>'grit')::int, 0), 0, v_stats.grit_max),
    respect = public._story_clamp_int(v_stats.respect + COALESCE((v_stat_changes->>'respect')::int, 0), 0, v_stats.respect_max),
    last_played_at = now()
  WHERE user_id = v_uid;

  -- inventory 부여
  FOR v_card IN SELECT jsonb_array_elements_text(v_inventory_grants) LOOP
    INSERT INTO public.boxing_story_inventory (user_id, card_code, count)
    VALUES (v_uid, v_card, 1)
    ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;
  END LOOP;

  -- prologue 의 루트 선택 처리
  IF v_route_choice IS NOT NULL THEN
    UPDATE public.boxing_user_player_stats
    SET active_route_code = v_route_choice, prologue_completed = true
    WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'next_scene_index', v_next_scene,
    'route_choice', v_route_choice,
    'stat_changes', v_stat_changes,
    'inventory_grants', v_inventory_grants
  );
END;
$$;

-- 5D. start_battle
CREATE OR REPLACE FUNCTION public.start_battle(
  p_enemy_code text,
  p_chapter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_enemy public.boxing_story_enemies%ROWTYPE;
  v_stats public.boxing_user_player_stats%ROWTYPE;
  v_battle_state jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_enemy FROM public.boxing_story_enemies
  WHERE code = p_enemy_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'enemy not available'; END IF;

  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  IF NOT FOUND THEN
    PERFORM public.start_story_session();
    SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  END IF;

  v_battle_state := jsonb_build_object(
    'enemy_code', v_enemy.code,
    'enemy_hp', v_enemy.hp,
    'enemy_max_hp', v_enemy.hp,
    'enemy_attack', v_enemy.attack,
    'enemy_defense', v_enemy.defense,
    'pattern_code', v_enemy.pattern_code,
    'pattern_metadata', v_enemy.pattern_metadata,
    'turn', 1,
    'last_command', NULL,
    'card_used', false,
    'osam_advice_used', false,
    'chapter_id', p_chapter_id,
    'started_at', now()
  );

  UPDATE public.boxing_user_player_stats
  SET battle_state = v_battle_state, last_played_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'enemy', to_jsonb(v_enemy),
    'player_stats', to_jsonb(v_stats),
    'battle_state', v_battle_state
  );
END;
$$;

-- 5E. submit_player_command
-- 게임 로직 단순화: 클라이언트가 핵심 데미지 계산을 수행하고
-- RPC 는 결과 적용 (HP 차감, victory/defeat 판정, 보상 지급) 만 담당.
-- 보안: 클라이언트가 보낸 enemy_hp_delta 는 enemy_max_hp 범위 검증.
CREATE OR REPLACE FUNCTION public.submit_player_command(
  p_command text,
  p_target_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stats public.boxing_user_player_stats%ROWTYPE;
  v_battle jsonb;
  v_enemy_hp integer;
  v_enemy_max_hp integer;
  v_player_hp integer;
  v_focus integer;
  v_focus_cost integer := 0;
  v_enemy_hp_delta integer := 0;
  v_player_hp_delta integer := 0;
  v_status text := 'ongoing';
  v_enemy_code text;
  v_enemy public.boxing_story_enemies%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_command NOT IN ('jab','guard','footwork','counter','osam_advice','use_card') THEN
    RAISE EXCEPTION 'invalid command';
  END IF;

  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'no player stats'; END IF;

  v_battle := COALESCE(v_stats.battle_state, '{}'::jsonb);
  IF v_battle = '{}'::jsonb OR v_battle->>'enemy_code' IS NULL THEN
    RAISE EXCEPTION 'no_active_battle';
  END IF;

  v_enemy_hp := COALESCE((v_battle->>'enemy_hp')::int, 0);
  v_enemy_max_hp := COALESCE((v_battle->>'enemy_max_hp')::int, 100);
  v_player_hp := v_stats.hp;
  v_focus := v_stats.focus;
  v_enemy_code := v_battle->>'enemy_code';

  SELECT * INTO v_enemy FROM public.boxing_story_enemies WHERE code = v_enemy_code;

  -- 클라이언트가 계산한 결과 추출 (검증 필요)
  v_enemy_hp_delta := COALESCE((p_target_data->>'enemy_hp_delta')::int, 0);
  v_player_hp_delta := COALESCE((p_target_data->>'player_hp_delta')::int, 0);

  -- 클라이언트 위변조 방지: enemy_hp_delta 는 음수만 허용 (적은 회복 안 함)
  -- player_hp_delta 는 음수 (피해) 만 허용. 회복은 별도 RPC.
  IF v_enemy_hp_delta > 0 OR v_player_hp_delta > 0 THEN
    RAISE EXCEPTION 'invalid hp deltas';
  END IF;

  -- 명령별 focus 비용
  CASE p_command
    WHEN 'jab' THEN v_focus_cost := 1;
    WHEN 'guard' THEN v_focus_cost := 0;
    WHEN 'footwork' THEN v_focus_cost := 1;
    WHEN 'counter' THEN v_focus_cost := 2;
    WHEN 'osam_advice' THEN v_focus_cost := 0;
    WHEN 'use_card' THEN v_focus_cost := 0;
  END CASE;

  IF v_focus < v_focus_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not enough focus',
      'player_hp', v_player_hp, 'enemy_hp', v_enemy_hp
    );
  END IF;

  -- HP 갱신
  v_enemy_hp := GREATEST(0, v_enemy_hp + v_enemy_hp_delta);
  v_player_hp := GREATEST(0, v_player_hp + v_player_hp_delta);

  -- 상태 판정
  IF v_enemy_hp <= 0 THEN
    v_status := 'victory';
  ELSIF v_player_hp <= 0 THEN
    v_status := 'defeat';
  END IF;

  -- battle_state 업데이트
  v_battle := v_battle
    || jsonb_build_object(
        'enemy_hp', v_enemy_hp,
        'turn', COALESCE((v_battle->>'turn')::int, 1) + 1,
        'last_command', p_command,
        'osam_advice_used',
          CASE WHEN p_command = 'osam_advice' THEN true
               ELSE COALESCE((v_battle->>'osam_advice_used')::boolean, false) END,
        'card_used',
          CASE WHEN p_command = 'use_card' THEN true
               ELSE COALESCE((v_battle->>'card_used')::boolean, false) END
      );

  IF v_status = 'victory' THEN
    -- 보상 지급 (story_xp, ring_coins)
    UPDATE public.boxing_user_player_stats SET
      hp = v_player_hp,
      focus = GREATEST(0, v_focus - v_focus_cost),
      story_xp = story_xp + v_enemy.reward_story_xp,
      ring_coins = ring_coins + v_enemy.reward_ring_coins,
      battle_state = '{}'::jsonb,
      last_played_at = now()
    WHERE user_id = v_uid;

    -- enemy 가 카드 보상이 있으면 인벤토리에 추가
    IF v_enemy.reward_card_code IS NOT NULL THEN
      INSERT INTO public.boxing_story_inventory (user_id, card_code, count)
      VALUES (v_uid, v_enemy.reward_card_code, 1)
      ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;
    END IF;

  ELSIF v_status = 'defeat' THEN
    -- 패배 시 HP 회복 (재도전 가능)
    UPDATE public.boxing_user_player_stats SET
      hp = hp_max,
      focus = focus_max / 2,
      battle_state = '{}'::jsonb,
      last_played_at = now()
    WHERE user_id = v_uid;

  ELSE
    -- 진행 중
    UPDATE public.boxing_user_player_stats SET
      hp = v_player_hp,
      focus = GREATEST(0, v_focus - v_focus_cost),
      battle_state = v_battle,
      last_played_at = now()
    WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'player_hp', v_player_hp,
    'enemy_hp', v_enemy_hp,
    'focus_remaining', GREATEST(0, v_focus - v_focus_cost),
    'reward_story_xp', CASE WHEN v_status = 'victory' THEN v_enemy.reward_story_xp ELSE 0 END,
    'reward_ring_coins', CASE WHEN v_status = 'victory' THEN v_enemy.reward_ring_coins ELSE 0 END,
    'reward_card_code', CASE WHEN v_status = 'victory' THEN v_enemy.reward_card_code ELSE NULL END,
    'battle_state', v_battle
  );
END;
$$;

-- 5F. claim_card_reward
CREATE OR REPLACE FUNCTION public.claim_card_reward(
  p_card_code text,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_card public.boxing_story_cards%ROWTYPE;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_card FROM public.boxing_story_cards WHERE code = p_card_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not available'; END IF;

  INSERT INTO public.boxing_story_inventory (user_id, card_code, count, metadata)
  VALUES (v_uid, p_card_code, 1, jsonb_build_object('source', COALESCE(p_source, 'unknown')))
  ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;

  SELECT count INTO v_count FROM public.boxing_story_inventory
  WHERE user_id = v_uid AND card_code = p_card_code;

  RETURN jsonb_build_object(
    'success', true,
    'card_code', p_card_code,
    'count', v_count,
    'card', to_jsonb(v_card)
  );
END;
$$;

-- 5G. complete_ending
CREATE OR replace FUNCTION public.complete_ending(
  p_route_id uuid,
  p_ending_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_already boolean;
  v_route public.boxing_story_routes%ROWTYPE;
  v_scene public.boxing_story_scenes%ROWTYPE;
  v_summary jsonb;
  v_story_xp int;
  v_ring_coins int;
  v_real_gems int;
  v_title text;
  v_card text;
  v_badge text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_route FROM public.boxing_story_routes WHERE id = p_route_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'route not available'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.boxing_story_ending_claims
    WHERE user_id = v_uid AND route_id = p_route_id AND ending_code = p_ending_code
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object(
      'success', true, 'already_claimed', true,
      'story_xp_granted', 0, 'ring_coins_granted', 0, 'real_gems_granted', 0
    );
  END IF;

  -- 시나리오에서 ending scene 의 reward_summary 조회
  SELECT * INTO v_scene FROM public.boxing_story_scenes
  WHERE route_id = p_route_id AND scene_type = 'ending'
    AND payload->>'ending_code' = p_ending_code AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ending scene not found';
  END IF;

  v_summary := COALESCE(v_scene.payload->'reward_summary', '{}'::jsonb);
  v_story_xp := COALESCE((v_summary->>'story_xp')::int, 0);
  v_ring_coins := COALESCE((v_summary->>'ring_coins')::int, 0);
  v_real_gems := COALESCE((v_summary->>'real_gems_first_time')::int, 0);
  v_title := v_summary->>'title';
  v_card := v_summary->>'card_code';
  v_badge := v_summary->>'badge_code';

  -- player stats 누적
  UPDATE public.boxing_user_player_stats SET
    story_xp = story_xp + v_story_xp,
    ring_coins = ring_coins + v_ring_coins,
    earned_endings = CASE WHEN earned_endings ? p_ending_code THEN earned_endings
                          ELSE earned_endings || to_jsonb(p_ending_code) END,
    earned_titles = CASE WHEN v_title IS NULL OR earned_titles ? v_title THEN earned_titles
                         ELSE earned_titles || to_jsonb(v_title) END,
    earned_badges = CASE WHEN v_badge IS NULL OR earned_badges ? v_badge THEN earned_badges
                         ELSE earned_badges || to_jsonb(v_badge) END,
    last_played_at = now()
  WHERE user_id = v_uid;

  -- 카드 보상
  IF v_card IS NOT NULL THEN
    PERFORM public.claim_card_reward(v_card, 'ending_clear');
  END IF;

  -- claim 기록
  INSERT INTO public.boxing_story_ending_claims
    (user_id, route_id, ending_code,
     story_xp_granted, ring_coins_granted, real_gems_granted,
     reward_title, reward_card_code, reward_badge_code)
  VALUES
    (v_uid, p_route_id, p_ending_code,
     v_story_xp, v_ring_coins, v_real_gems,
     v_title, v_card, v_badge)
  ON CONFLICT (user_id, route_id, ending_code) DO NOTHING;

  -- scene_progress 갱신
  UPDATE public.boxing_user_scene_progress SET
    ending_reached = true,
    ending_code = p_ending_code,
    first_clear_at = COALESCE(first_clear_at, now()),
    play_count = play_count + 1,
    last_played_at = now()
  WHERE user_id = v_uid AND route_id = p_route_id;

  -- 파이트 머니 — grant_gems 경유 (직접 wallet update 금지)
  IF v_real_gems > 0 THEN
    PERFORM public.grant_gems(
      v_uid, v_real_gems,
      concat('스토리 RPG 엔딩: ', COALESCE(v_title, p_ending_code))
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'story_xp_granted', v_story_xp,
    'ring_coins_granted', v_ring_coins,
    'real_gems_granted', v_real_gems,
    'reward_title', v_title,
    'reward_card_code', v_card,
    'reward_badge_code', v_badge
  );
END;
$$;

-- 5H. reset_story_route
CREATE OR REPLACE FUNCTION public.reset_story_route(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  UPDATE public.boxing_user_scene_progress SET
    chapter_id = NULL,
    current_scene_index = 0,
    completed_chapter_codes = '[]'::jsonb,
    last_played_at = now()
  WHERE user_id = v_uid AND route_id = p_route_id;

  UPDATE public.boxing_user_player_stats SET
    active_route_code = NULL,
    battle_state = '{}'::jsonb,
    last_played_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'route_id', p_route_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_story_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.progress_to_scene(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_choice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_battle(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_player_command(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_card_reward(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ending(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_story_route(uuid) TO authenticated;

-- =====================================================================
-- 6. SEED — boxing_story_enemies (11)
-- =====================================================================
INSERT INTO public.boxing_story_enemies
  (code, name, description, hp, attack, defense, pattern_code, pattern_metadata, weakness, reward_story_xp, reward_ring_coins, reward_card_code, is_boss)
VALUES
  ('lazy_slime', '게으름 슬라임', '이불 속에서 들리는 그 목소리가 형체를 가졌습니다.',
   30, 5, 0, 'random_sleep_50', '{"sleep_chance": 50}'::jsonb, '{"jab": 1.5}'::jsonb, 30, 20, NULL, false),
  ('guard_breaker', '가드 브레이커', '자세가 무너지길 기다리는 그 습관.',
   60, 10, 5, 'charge_3turn_breakguard', '{"charge_turns": 3, "damage_multiplier": 2.0}'::jsonb, '{"footwork": true}'::jsonb, 50, 40, NULL, false),
  ('excuse_goblin', '핑계 도깨비', '손가락으로 다른 곳을 가리키는 마음.',
   50, 6, 3, 'tempt_skip', '{"grit_on_refuse": 1}'::jsonb, '{"counter": true}'::jsonb, 40, 30, NULL, false),
  ('compare_monster', '비교 괴물', '여러 개의 눈으로 다른 사람과 나를 견주는 마음.',
   80, 8, 4, 'copy_player_stat', '{}'::jsonb, '{"respect_threshold": 50, "multiplier": 1.5}'::jsonb, 60, 50, NULL, false),
  ('quit_demon', '포기 악마', '"이 정도면 됐어" 라고 속삭이는 그 목소리.',
   100, 12, 5, 'drain_focus', '{"focus_drain_per_turn": 1}'::jsonb, '{"footwork_counter_combo": true}'::jsonb, 80, 60, NULL, false),
  ('tense_wolf', '긴장 늑대', '종소리 직전에 송곳니를 드러내는 그 마음.',
   70, 15, 3, 'first_turn_strong', '{"first_turn_multiplier": 1.0, "later_multiplier": 0.5}'::jsonb, '{"first_turn_guard_then_counter": true}'::jsonb, 50, 40, NULL, false),
  ('breath_holder', '숨참기 유령', '힘들 때 호흡을 잠가버리는 그 습관.',
   60, 7, 2, 'high_evasion', '{"evasion_pct": 60, "negate_on_counter": true}'::jsonb, '{"counter": true}'::jsonb, 50, 40, NULL, false),
  ('overtrain_golem', '과훈련 골렘', '"좀 더, 좀 더" 라고 속삭이는 그 마음.',
   150, 6, 8, 'long_battle_drain', '{"stamina_drain_per_turn": 1}'::jsonb, '{"jab_accumulation": true}'::jsonb, 70, 60, NULL, false),
  ('master_door', '마스터의 문', '내가 가르친 동작이 다시 자기에게 옵니다.',
   200, 12, 6, 'mirror_attack_two_phase', '{"phase_2_hp_threshold": 100, "phase_1_requires_respect": 80}'::jsonb, '{"respect_required": 80}'::jsonb, 200, 300, 'card_master_candidate', true),
  ('routine_breaker', '루틴 파괴자', '매 턴 능력치 1개를 영구 -1 시키는 적.',
   180, 10, 5, 'random_stat_drain', '{"stat_drain_per_turn": 1}'::jsonb, '{"jab_accumulation": true, "patience_required": true}'::jsonb, 200, 300, 'card_pro_routine', true),
  ('self_compare_evolved', '처음의 나 / 비교 괴물 진화형', '거울 속의 두 형체.',
   250, 14, 7, 'two_phase_self_compare', '{"phase_1_hp": 50, "phase_1_attack": 4, "phase_1_defense": 2, "phase_2_hp": 250}'::jsonb, '{"respect_grit_combined_threshold": 100, "multiplier": 1.5}'::jsonb, 250, 400, 'card_champion_spirit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  hp = EXCLUDED.hp, attack = EXCLUDED.attack, defense = EXCLUDED.defense,
  pattern_code = EXCLUDED.pattern_code, pattern_metadata = EXCLUDED.pattern_metadata,
  weakness = EXCLUDED.weakness,
  reward_story_xp = EXCLUDED.reward_story_xp,
  reward_ring_coins = EXCLUDED.reward_ring_coins,
  reward_card_code = EXCLUDED.reward_card_code,
  is_boss = EXCLUDED.is_boss;

-- =====================================================================
-- 7. SEED — boxing_story_cards (9)
-- =====================================================================
INSERT INTO public.boxing_story_cards
  (code, name, description, effect_code, effect_metadata, is_consumable, rarity)
VALUES
  ('card_glove_first', '첫 글러브', '체육관 첫날의 기억.', 'damage_boost_20', '{"multiplier": 1.2, "uses": 1}'::jsonb, true, 'common'),
  ('card_jab_master', '잽 마스터', '한 개의 잽이 세 배의 무게로.', 'next_jab_x3', '{"multiplier": 3.0, "uses": 1}'::jsonb, true, 'rare'),
  ('card_guard_iron', '강철 가드', '한 턴 동안 어떤 공격도 받지 않습니다.', 'invincible_1turn', '{"turns": 1}'::jsonb, true, 'rare'),
  ('card_footwork_wind', '바람의 풋워크', '두 턴 동안 회피율 100%.', 'evasion_100_2turn', '{"turns": 2}'::jsonb, true, 'rare'),
  ('card_counter_lightning', '번개 카운터', '다음 카운터가 무조건 성공합니다.', 'next_counter_guaranteed', '{"uses": 1}'::jsonb, true, 'epic'),
  ('card_respect_warmth', '따뜻함의 마음', '적이 한 턴 행동을 멈추고 리스펙트 +5.', 'enemy_skip_1turn_respect_5', '{"turns": 1, "respect_gain": 5}'::jsonb, true, 'epic'),
  ('card_master_candidate', '마스터 후보', '잘하는 사람이 아니라, 안전하게 이끄는 사람.', 'cosmetic', '{}'::jsonb, false, 'ending'),
  ('card_pro_routine', '프로 루틴 후보', '매일 같은 자리에 서는 사람.', 'cosmetic', '{}'::jsonb, false, 'ending'),
  ('card_champion_spirit', '챔피언의 정신', '트로피보다 길게 남는 마음.', 'cosmetic', '{}'::jsonb, false, 'ending')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  effect_code = EXCLUDED.effect_code, effect_metadata = EXCLUDED.effect_metadata,
  is_consumable = EXCLUDED.is_consumable, rarity = EXCLUDED.rarity;

-- =====================================================================
-- 8. SEED — boxing_story_scenes
-- =====================================================================
-- 패턴: chapter scene 은 chapter.code 기준 SELECT 후 INSERT.
-- 통합 unique: (scope, chapter_id, scene_index) NULLS NOT DISTINCT
-- · chapter scene → chapter_id 가 NOT NULL 로 분리됨
-- · prologue → chapter_id NULL, scope='prologue' 로 분리됨
-- · NULLS NOT DISTINCT 덕에 (prologue, NULL, 0) ↔ (prologue, NULL, 0) 중복 검출됨
-- =====================================================================

-- 8.1 PROLOGUE (4 씬)
INSERT INTO public.boxing_story_scenes (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
VALUES
  ('prologue', NULL, NULL, 0, 'dialogue',
   jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','calm',
     'body','안녕하세요. 저는 153복싱짐의 작은 마스코트, 오삼이에요. 오늘 당신은 처음 이 문 앞에 섰습니다... 들어오기 전, 잠깐 숨을 골라요.'), 1),
  ('prologue', NULL, NULL, 1, 'dialogue',
   jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','calm',
     'body','체육관 안에서 글러브가 샌드백을 치는 소리. 누군가의 줄넘기 소리. 거울 앞에 선 사람의 그림자... 모두가 처음엔 이 문 앞에서 망설였어요. 망설임은 부끄러운 게 아니에요. 시작의 신호예요.'), 2),
  ('prologue', NULL, NULL, 2, 'dialogue',
   jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
     'body','어... 처음이지? 들어와요. 너무 무겁게 생각하지 말고. 오늘은 — 거울만 봐. 거울 속의 자기 모습이 어색해도, 그 어색함이 — 시작의 증거야.'), 3),
  ('prologue', NULL, NULL, 3, 'choice',
   jsonb_build_object('speaker','오삼이',
     'prompt','오삼이가 묻습니다. ''당신의 복서의 길은 어떤 모습인가요?'' (한 번 정해도 나중에 바꿀 수 있어요.)',
     'choices', jsonb_build_array(
       jsonb_build_object('label','후배에게 도움이 되는 사람이 되고 싶어요','hint','마스터의 길 → 리스펙트 +5','stat_changes',jsonb_build_object('respect',5),'route_choice','master_path','next_scene',-1),
       jsonb_build_object('label','매일 같은 자리에 서는 사람이 되고 싶어요','hint','프로의 길 → 투지 +5','stat_changes',jsonb_build_object('grit',5),'route_choice','pro_path','next_scene',-1),
       jsonb_build_object('label','어제의 나를 이기는 사람이 되고 싶어요','hint','챔피언 로드 → 기술 +5','stat_changes',jsonb_build_object('skill',5),'route_choice','champion_road','next_scene',-1)
     )), -1)
ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
  scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload, next_scene_index = EXCLUDED.next_scene_index;

-- =====================================================================
-- 8.2 챕터 시드 헬퍼 — 각 챕터 INSERT 의 반복 패턴을 줄이기 위해 임시 함수 사용
-- =====================================================================
CREATE OR REPLACE FUNCTION public._story_seed_dialogue(
  p_chapter_code text, p_scene_index integer, p_payload jsonb, p_next integer
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.boxing_story_scenes
    (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
  SELECT 'chapter', c.route_id, c.id, p_scene_index, 'dialogue', p_payload, p_next
  FROM public.boxing_story_chapters c WHERE c.code = p_chapter_code
  ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
    scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload,
    next_scene_index = EXCLUDED.next_scene_index;
END $$;

CREATE OR REPLACE FUNCTION public._story_seed_choice(
  p_chapter_code text, p_scene_index integer, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.boxing_story_scenes
    (scope, route_id, chapter_id, scene_index, scene_type, payload)
  SELECT 'chapter', c.route_id, c.id, p_scene_index, 'choice', p_payload
  FROM public.boxing_story_chapters c WHERE c.code = p_chapter_code
  ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
    scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload;
END $$;

CREATE OR REPLACE FUNCTION public._story_seed_battle(
  p_chapter_code text, p_scene_index integer, p_payload jsonb,
  p_next_victory integer, p_next_defeat integer
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.boxing_story_scenes
    (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_victory, next_scene_defeat)
  SELECT 'chapter', c.route_id, c.id, p_scene_index, 'battle', p_payload, p_next_victory, p_next_defeat
  FROM public.boxing_story_chapters c WHERE c.code = p_chapter_code
  ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
    scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload,
    next_scene_victory = EXCLUDED.next_scene_victory,
    next_scene_defeat = EXCLUDED.next_scene_defeat;
END $$;

CREATE OR REPLACE FUNCTION public._story_seed_node_move(
  p_chapter_code text, p_scene_index integer, p_payload jsonb, p_next integer
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.boxing_story_scenes
    (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
  SELECT 'chapter', c.route_id, c.id, p_scene_index, 'node_move', p_payload, p_next
  FROM public.boxing_story_chapters c WHERE c.code = p_chapter_code
  ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
    scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload,
    next_scene_index = EXCLUDED.next_scene_index;
END $$;

CREATE OR REPLACE FUNCTION public._story_seed_ending(
  p_chapter_code text, p_scene_index integer, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.boxing_story_scenes
    (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
  SELECT 'chapter', c.route_id, c.id, p_scene_index, 'ending', p_payload, -1
  FROM public.boxing_story_chapters c WHERE c.code = p_chapter_code
  ON CONFLICT (scope, chapter_id, scene_index) DO UPDATE SET
    scene_type = EXCLUDED.scene_type, payload = EXCLUDED.payload,
    next_scene_index = EXCLUDED.next_scene_index;
END $$;

-- =====================================================================
-- 8.3 마스터의 길 — 6 챕터
-- =====================================================================

-- ── 챕터 1: 첫 글러브 (9 씬) ──
SELECT public._story_seed_dialogue('master_01_first_glove', 0,
  jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','calm',
    'body','체육관 문을 열 때, 누구나 한 번 망설입니다. 거울 속의 내가 어색하고, 글러브가 무겁고, 옆 사람의 펀치 소리가 너무 큽니다... 오늘이 그 첫날이에요.'), 1);
SELECT public._story_seed_node_move('master_01_first_glove', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','gym_entrance','transition_message','153복싱짐 입구','animation_hint','walk'), 2);
SELECT public._story_seed_dialogue('master_01_first_glove', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','오늘 처음이지? 글러브 끈, 너무 꽉 묶지 마... 손목이 살짝 움직여야 정직한 펀치가 나와. 첫 라운드는 아무도 안 봐요. 거울만 봐.'), 3);
SELECT public._story_seed_choice('master_01_first_glove', 3,
  jsonb_build_object(
    'prompt','강 관장이 글러브를 건네줍니다. 당신은 어떻게 받겠어요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','두 손으로 정중히 받는다','hint','리스펙트 +5','stat_changes',jsonb_build_object('respect',5),'next_scene',4),
      jsonb_build_object('label','한 손으로 받아 바로 끼워본다','hint','기술 +1, 리스펙트 +1','stat_changes',jsonb_build_object('skill',1,'respect',1),'next_scene',4),
      jsonb_build_object('label','어색하게 머뭇거린다','hint','투지 +2','stat_changes',jsonb_build_object('grit',2),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_01_first_glove', 4,
  jsonb_build_object('speaker','박 선배','portrait','park','bgm_hint','warm',
    'body','내가 처음 왔을 때도 똑같았어요. 줄넘기 100개도 못 넘었지... 근데 알아요? 내가 그날 끝까지 안 나가서 — 지금 여기 있는 거예요. 끝까지 있는 사람이 결국 복서가 되더라고요.'), 5);
SELECT public._story_seed_dialogue('master_01_first_glove', 5,
  jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','tense',
    'body','거울 앞에 섰을 때, 익숙한 그림자가 따라옵니다. 게으름의 그림자. 어제도 오늘도 ''내일부터'' 라고 속삭이는...'), 6);
SELECT public._story_seed_battle('master_01_first_glove', 6,
  jsonb_build_object('enemy_code','lazy_slime',
    'intro_line','이불 속에서 들리던 목소리가 형체를 가집니다... 게으름 슬라임.',
    'victory_line','녹색 거품이 천천히 흩어집니다. 오늘만큼은 이불 속에서 빠져나왔어요.',
    'defeat_line','괜찮아요. 한 번 더 — 게으름은 한 번에 안 사라져요.'), 7, 5);
SELECT public._story_seed_dialogue('master_01_first_glove', 7,
  jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','warm',
    'body','첫 라운드가 끝났습니다. 숨이 차고 어색하지만, 거울 속의 당신은 어제와 다른 사람이에요. 첫 라운드를 끝까지 뛴 사람만이 두 번째 라운드를 가질 수 있습니다.'), 8);
SELECT public._story_seed_dialogue('master_01_first_glove', 8,
  jsonb_build_object('speaker','오삼이','portrait','osam',
    'body','[챕터 1 클리어] 보상: 스토리 XP +60, 링 코인 +150, 카드 ''첫 글러브'' 획득. 다음 챕터 — 거울 앞에서 같은 자세를 반복합니다. 기본기의 벽.',
    'reward_grant', jsonb_build_object('story_xp',60,'ring_coins',150,'card','card_glove_first')), -1);

-- ── 챕터 2: 기본기의 벽 (8 씬) ──
SELECT public._story_seed_dialogue('master_02_basic_wall', 0,
  jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','calm',
    'body','거울 앞에 또 섰습니다. 어제도, 그제도, 같은 자세를. 화려한 콤비네이션은 한참 멉니다. 가드를 올리고, 발을 옮기고, 잽 한 개. 다시 잽 한 개...'), 1);
SELECT public._story_seed_node_move('master_02_basic_wall', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','mirror_zone','transition_message','거울 앞'), 2);
SELECT public._story_seed_dialogue('master_02_basic_wall', 2,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','tense',
    'body','왼쪽 어깨 떨어졌어요. 다시. 가드는 광대뼈 옆. 잽 칠 때 발이 같이 나가야 돼요. 하나, 둘. 다시. 자세 하나가 평생을 가요.'), 3);
SELECT public._story_seed_choice('master_02_basic_wall', 3,
  jsonb_build_object(
    'prompt','김 코치의 잔소리가 100개째입니다. 당신은?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','묵묵히 한 번 더 잽을 친다','hint','기술 +3, 가드 +2','stat_changes',jsonb_build_object('skill',3,'guard',2),'next_scene',4),
      jsonb_build_object('label','''네!'' 큰 소리로 답하고 다시 시작','hint','리스펙트 +3, 투지 +2','stat_changes',jsonb_build_object('respect',3,'grit',2),'next_scene',4),
      jsonb_build_object('label','''코치님, 이 자세 조금 다르게 해도 돼요?'' 묻는다','hint','리스펙트 +5, 기술 -1','stat_changes',jsonb_build_object('respect',5,'skill',-1),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_02_basic_wall', 4,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','잽이 깨끗해졌네... 이제 보일 거야. 다른 사람의 자세도. 자기 자세가 잡혀야 — 다른 사람 자세가 보여요.'), 5);
SELECT public._story_seed_dialogue('master_02_basic_wall', 5,
  jsonb_build_object('speaker','오삼이','portrait','osam','bgm_hint','tense',
    'body','거울 옆에서 가드 브레이커가 노립니다. 자세가 무너지길 기다리는 그 습관 — ''한 번쯤은 괜찮겠지'' 그 한 번이 모든 걸 바꿔요.'), 6);
SELECT public._story_seed_battle('master_02_basic_wall', 6,
  jsonb_build_object('enemy_code','guard_breaker',
    'intro_line','가드 브레이커가 3턴 동안 차지합니다. 풋워크로 회피하세요.',
    'victory_line','균열이 봉합됩니다. 가드는 — 무너지지 않았어요.',
    'defeat_line','한 번쯤은 괜찮다는 마음 — 그게 가드를 무너뜨려요. 다시.'), 7, 5);
SELECT public._story_seed_dialogue('master_02_basic_wall', 7,
  jsonb_build_object('speaker','오삼이','portrait','osam',
    'body','[챕터 2 클리어] 거울 속 자세가 — 어느새 흔들리지 않아요. 기본기는 자랑할 게 없지만, 가장 오래 남는 무기예요. 보상: XP +80, 코인 +200.',
    'reward_grant', jsonb_build_object('story_xp',80,'ring_coins',200,'card','card_jab_master')), -1);

-- ── 챕터 3: 반복의 방 (9 씬) ──
SELECT public._story_seed_dialogue('master_03_repeat_room', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','calm',
    'body','오늘도 같은 동작입니다. 같은 라운드, 같은 시간, 같은 거울. 처음에는 지루합니다. 두 번째에는 짜증이 나고요. 세 번째부터 — 무언가 달라집니다.'), 1);
SELECT public._story_seed_node_move('master_03_repeat_room', 1,
  jsonb_build_object('from_node_code','mirror_zone','to_node_code','sandbag_zone','transition_message','샌드백 존'), 2);
SELECT public._story_seed_dialogue('master_03_repeat_room', 2,
  jsonb_build_object('speaker','박 선배','portrait','park',
    'body','저도 그 시기 있었어요. 한 달 동안 같은 거 하니까 진짜 지겹더라고요. 그래서 ''오늘 안 갈래'' 한 적도 있고. 근데 그 다음 날 갔더니 — 동작 하나가 달라져 있더라고요.'), 3);
SELECT public._story_seed_choice('master_03_repeat_room', 3,
  jsonb_build_object('prompt','오늘 100번째 같은 콤비네이션. 마음이 흔들립니다.',
    'choices', jsonb_build_array(
      jsonb_build_object('label','그래도 한 라운드 더','hint','투지 +5, HP -10','stat_changes',jsonb_build_object('grit',5,'hp',-10),'next_scene',4),
      jsonb_build_object('label','잠깐 쉬고 호흡 정리','hint','집중 +3, HP +5','stat_changes',jsonb_build_object('focus',3,'hp',5),'next_scene',4),
      jsonb_build_object('label','박 선배에게 ''지겨워요'' 솔직히 말한다','hint','리스펙트 +5, 투지 -1','stat_changes',jsonb_build_object('respect',5,'grit',-1),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_03_repeat_room', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','거울 앞으로 핑계 도깨비가 다가옵니다. 손가락으로 ''오늘은 너무 더워서'' 라고 가리키며...'), 5);
SELECT public._story_seed_battle('master_03_repeat_room', 5,
  jsonb_build_object('enemy_code','excuse_goblin',
    'intro_line','핑계 도깨비가 매 턴 ''오늘만 쉬자'' 라고 유혹합니다. 거절하면 grit +1.',
    'victory_line','도깨비가 슬며시 사라집니다. 오늘은 — 핑계가 안 통했어요.',
    'defeat_line','한 번 들어주면 끝없이 늘어나요. 다시 거절해봅시다.'), 6, 4);
SELECT public._story_seed_dialogue('master_03_repeat_room', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','오늘은 같은 동작이 — 지루하지 않았어요. 내 몸이 내 동작을 믿기 시작한 거예요. 의심하지 않는 잽 한 개. 그게 백 개의 잽보다 무서워요.'), 7);
SELECT public._story_seed_choice('master_03_repeat_room', 7,
  jsonb_build_object('prompt','오늘 노트에 무엇을 적을까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''오늘 잽 1000개 — 내일도 한다''','hint','투지 +3','stat_changes',jsonb_build_object('grit',3),'next_scene',8),
      jsonb_build_object('label','''반복은 신뢰다''','hint','집중 +3','stat_changes',jsonb_build_object('focus',3),'next_scene',8)
    )));
SELECT public._story_seed_dialogue('master_03_repeat_room', 8,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 3 클리어] 보상: XP +100, 코인 +250.',
    'reward_grant', jsonb_build_object('story_xp',100,'ring_coins',250,'card','card_guard_iron')), -1);

-- ── 챕터 4: 후배의 등장 (11 씬) ──
SELECT public._story_seed_dialogue('master_04_new_member', 0,
  jsonb_build_object('speaker','오삼이',
    'body','오늘 신입이 들어왔어요. 어색하게 글러브를 묶고, 거울 앞에서 어쩔 줄 모르는 모습... 익숙한 풍경이에요. 그게 몇 달 전의 당신이었으니까.'), 1);
SELECT public._story_seed_node_move('master_04_new_member', 1,
  jsonb_build_object('from_node_code','sandbag_zone','to_node_code','corner','transition_message','코너 — 회복과 작전의 자리'), 2);
SELECT public._story_seed_dialogue('master_04_new_member', 2,
  jsonb_build_object('speaker','민지','portrait','minji','bgm_hint','warm',
    'body','저... 안녕하세요. 줄넘기를... 어떻게 해야 잘 넘어요? 어제 100번 넘기다가 50번에서 자꾸 걸려서요... 부끄러워서 사람들 안 보는 새벽에 와요.'), 3);
SELECT public._story_seed_choice('master_04_new_member', 3,
  jsonb_build_object('prompt','민지가 당신을 보며 묻습니다. 어떻게 답할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''괜찮아요, 천천히 해도 돼요. 50번도 시작이에요.''','hint','리스펙트 +8, grit +2','stat_changes',jsonb_build_object('respect',8,'grit',2),'next_scene',4),
      jsonb_build_object('label','''손목 살짝 풀고, 발끝으로 가볍게.'' 자세 시범','hint','기술 +3, 리스펙트 +4','stat_changes',jsonb_build_object('skill',3,'respect',4),'next_scene',4),
      jsonb_build_object('label','''음... 저도 배우는 중이에요.''','hint','리스펙트 +1','stat_changes',jsonb_build_object('respect',1),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_04_new_member', 4,
  jsonb_build_object('speaker','박 선배','portrait','park','bgm_hint','warm',
    'body','이제 당신 차례예요. 제가 했던 그 말 — 기억나요? ''끝까지 있는 사람이 결국 복서가 된다.'' 이번엔 당신이 민지한테 해줄 차례예요.'), 5);
SELECT public._story_seed_dialogue('master_04_new_member', 5,
  jsonb_build_object('speaker','오삼이',
    'body','신입은 자꾸 사람들 시선을 신경 써요. 거울 보기 부끄러워하고, 줄넘기 한 번 걸리면 얼굴이 빨개지고. 누가 와서 한마디 해주길 — 속으로 기다리고 있어요.'), 6);
SELECT public._story_seed_dialogue('master_04_new_member', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','거울 너머로 비교 괴물이 보여요. 여러 개의 눈으로 다른 사람과 나를 끊임없이 견주는 그 마음이에요. 후배의 성장을 시기하는 그 작은 결도 — 같은 뿌리예요.'), 7);
SELECT public._story_seed_battle('master_04_new_member', 7,
  jsonb_build_object('enemy_code','compare_monster',
    'intro_line','비교 괴물이 당신의 능력치 하나를 복사해 사용합니다.',
    'victory_line','괴물의 눈이 하나씩 감깁니다. 오늘만큼은 — 다른 사람과 견주지 않았어요.',
    'defeat_line','비교의 눈은 자기 안에 있어요. 다시 — 자신을 보세요.'), 8, 6);
SELECT public._story_seed_dialogue('master_04_new_member', 8,
  jsonb_build_object('speaker','민지','portrait','minji','bgm_hint','warm',
    'body','선배님!! 저 방금 줄넘기 100번 성공했어요!! 진짜요!! 선배님 한마디 덕분이에요... 진짜요. 감사합니다.'), 9);
SELECT public._story_seed_dialogue('master_04_new_member', 9,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','민지가 처음으로 줄넘기 100번을 성공했습니다. 거울 속에서 환하게 웃네요. 당신의 한마디 덕분이에요. ''괜찮아요, 천천히 해도 돼요.'' — 짧지만, 그게 다였어요.'), 10);
SELECT public._story_seed_dialogue('master_04_new_member', 10,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 4 클리어] 내가 받았던 한마디를 — 내가 줘야 하는 그 시점이 마스터의 길의 본격 시작이에요. 보상: XP +120, 코인 +300, 카드 ''따뜻함의 마음''.',
    'reward_grant', jsonb_build_object('story_xp',120,'ring_coins',300,'card','card_respect_warmth')), -1);

-- ── 챕터 5: 지도자의 눈 (9 씬) ──
SELECT public._story_seed_dialogue('master_05_trainer_eye', 0,
  jsonb_build_object('speaker','오삼이',
    'body','지도자의 눈은 다릅니다. 잘 치는지 보는 게 아니라, 다치지 않는지를 봐요. ''팔꿈치가 너무 떨어졌어요'' — 이 한마디가 누군가의 1년을 지킵니다.'), 1);
SELECT public._story_seed_node_move('master_05_trainer_eye', 1,
  jsonb_build_object('from_node_code','corner','to_node_code','mirror_zone','transition_message','거울 앞 — 지도자의 자리'), 2);
SELECT public._story_seed_dialogue('master_05_trainer_eye', 2,
  jsonb_build_object('speaker','민지','portrait','minji','bgm_hint','tense',
    'body','선배님!! 저 오늘 미트 처음 쳐봐요!! 이렇게 치는 거 맞죠? 손목 이렇게 꺾으면 더 세지는 거 아니에요?'), 3);
SELECT public._story_seed_choice('master_05_trainer_eye', 3,
  jsonb_build_object('prompt','민지의 손목이 살짝 꺾여 있습니다. 무엇을 할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''잠깐, 손목 꺾으면 다쳐요. 이렇게.'' 즉시 멈추고 시범','hint','리스펙트 +10, 기술 +2 + 카드','stat_changes',jsonb_build_object('respect',10,'skill',2),'inventory_grants',jsonb_build_array('card_footwork_wind'),'next_scene',4),
      jsonb_build_object('label','''세게 치는 건 좋아요. 다음 라운드에 자세 봐줄게요.''','hint','리스펙트 +1','stat_changes',jsonb_build_object('respect',1),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_05_trainer_eye', 4,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','잘 가르치는 게 아니라... 안 다치게 보는 거. 그게 다야. 칭찬은 짧고, 말리는 건 빨리. 소리 없이 끄덕이는 것 — 그게 가장 큰 칭찬이고.'), 5);
SELECT public._story_seed_dialogue('master_05_trainer_eye', 5,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','거울 옆으로 거대한 그림자가 다가와요. 과훈련 골렘. ''좀 더, 좀 더'' 라고 속삭이는 그 마음. 멈춰야 할 때 못 멈추는 — 가장 위험한 적.'), 6);
SELECT public._story_seed_battle('master_05_trainer_eye', 6,
  jsonb_build_object('enemy_code','overtrain_golem',
    'intro_line','골렘의 HP 가 매우 높습니다. 잽 누적으로 정직하게 깎아내세요.',
    'victory_line','균열이 무너집니다. 멈출 때를 안 사람만이 — 골렘을 이깁니다.',
    'defeat_line','조급함이 패배 원인이에요. 잽 한 개씩 정직하게.'), 7, 5);
SELECT public._story_seed_dialogue('master_05_trainer_eye', 7,
  jsonb_build_object('speaker','민지','portrait','minji','bgm_hint','warm',
    'body','선배님 덕분에 손목 안 다쳤어요! 진짜요! 어제 그 말 안 해주셨으면... 저 지금 한 달 쉬고 있었을걸요. 감사해요. 진짜 감사해요.'), 8);
SELECT public._story_seed_dialogue('master_05_trainer_eye', 8,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 5 클리어] 지도자의 눈은 평가하는 눈이 아니에요. 다치지 않게 살피는 시각 — 그게 진짜 시선이에요. 보상: XP +150, 코인 +400.',
    'reward_grant', jsonb_build_object('story_xp',150,'ring_coins',400,'card','card_counter_lightning')), -1);

-- ── 챕터 6: 마스터 테스트 (12 씬) — 보스 + 엔딩 ──
SELECT public._story_seed_dialogue('master_06_master_test', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','마스터룸에 들어왔어요. 처음 글러브를 낀 그 자리와 같은 거울이에요. 거울 속의 당신은 — 같은 사람이지만, 같은 사람이 아니에요.'), 1);
SELECT public._story_seed_node_move('master_06_master_test', 1,
  jsonb_build_object('from_node_code','mirror_zone','to_node_code','master_room','transition_message','마스터룸'), 2);
SELECT public._story_seed_dialogue('master_06_master_test', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','epic',
    'body','여기까지 왔네... 마지막 시험은 — 내가 가르친 자세를 네가 다시 받는 거야. 거울 앞으로.'), 3);
SELECT public._story_seed_choice('master_06_master_test', 3,
  jsonb_build_object('prompt','거울 앞에 섰어요. 마스터의 문이 천천히 열립니다. 첫 호흡을 어떻게 잡을까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','코로 천천히 들이쉬고 — 입으로 짧게 내뱉는다','hint','집중 +5, 가드 +3','stat_changes',jsonb_build_object('focus',5,'guard',3),'next_scene',4),
      jsonb_build_object('label','민지가 했던 첫 호흡을 떠올린다','hint','리스펙트 +5, 투지 +3','stat_changes',jsonb_build_object('respect',5,'grit',3),'next_scene',4),
      jsonb_build_object('label','박 선배의 한마디 — ''끝까지 있는 사람'' 을 마음 속에','hint','투지 +5, 집중 +3','stat_changes',jsonb_build_object('grit',5,'focus',3),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('master_06_master_test', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','마스터의 문이 — 당신이 가르친 자세를 그대로 보여줍니다. 1페이즈: 미러 어택. 가드와 풋워크는 리스펙트 80+ 일 때만 통합니다.'), 5);
SELECT public._story_seed_battle('master_06_master_test', 5,
  jsonb_build_object('enemy_code','master_door',
    'intro_line','마스터의 문이 열립니다. 1페이즈 — 거울 어택. 2페이즈 — 강공격.',
    'victory_line','문이 — 당신을 알아봅니다. ''잘 했어. 이제 너도 이 자리에서, 다음 사람을 보면 돼.''',
    'defeat_line','거울 속의 당신을 다시 보세요. 가드는 — 자기 자세가 잡혀야 통해요.'), 6, 3);
SELECT public._story_seed_dialogue('master_06_master_test', 6,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','잘 했어... 이제 너도 이 자리에서, 다음 사람을 보면 돼. 가르치는 게 아니라 — 안 다치게 보는 일. 그거면 충분해.'), 7);
SELECT public._story_seed_dialogue('master_06_master_test', 7,
  jsonb_build_object('speaker','박 선배','portrait','park','bgm_hint','warm',
    'body','6개월 만에 여기까지 왔네요. 처음 왔을 때 줄넘기 50번에서 걸리던 그 사람이... 이제 후배 가르치고 있어요. 시간이 한 사람을 이렇게 바꾸네요.'), 8);
SELECT public._story_seed_dialogue('master_06_master_test', 8,
  jsonb_build_object('speaker','민지','portrait','minji','bgm_hint','warm',
    'body','선배님!! 진짜 마스터 되셨어요?! 저도 언젠가... 저도 누군가한테 한마디 해줄 수 있을까요? 선배님이 저한테 해주신 것처럼요!'), 9);
SELECT public._story_seed_dialogue('master_06_master_test', 9,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','warm',
    'body','자세 — 이제 안 봐도 돼요. 본인이 보여요. 다음 사람도 — 본인이 봐줘요.'), 10);
SELECT public._story_seed_dialogue('master_06_master_test', 10,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','잘하는 사람이 마스터가 아니라, 안전하게 이끄는 사람이 마스터입니다. 그 자리에 — 당신이 서 있어요.'), 11);
SELECT public._story_seed_ending('master_06_master_test', 11,
  jsonb_build_object('ending_code','master_candidate','title','마스터 후보','subtitle','잘하는 사람이 아니라, 안전하게 이끄는 사람',
    'cutscene_blocks', jsonb_build_array(
      jsonb_build_object('type','narration','body','마스터의 문이 열립니다. 안에는 거울과 글러브, 그리고 신입 회원들의 명단.','background','master_room'),
      jsonb_build_object('type','image_caption','speaker','강 관장','body','이제 당신은 후배에게 글러브 끈 묶는 법을 알려줄 사람이에요. 잘하라는 말은 안 해요. 안전하게 — 그것만 부탁해.','background','master_room'),
      jsonb_build_object('type','image_caption','speaker','박 선배','body','축하해요. 내가 받았던 그 한마디를 — 이제 당신이 줄 차례.'),
      jsonb_build_object('type','image_caption','speaker','민지','body','선배님... 처음 왔을 때 ''괜찮아요, 천천히'' 그 말... 잊지 못해요. 고맙습니다.'),
      jsonb_build_object('type','narration','body','마스터 후보. 잘하는 사람이 아니라, 안전하게 이끄는 사람.','background','sunrise'),
      jsonb_build_object('type','credits','body','[엔딩: 마스터 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 ''마스터 후보'', 카드 ''card_master_candidate'', 파이트 머니 +300 (최초 1회)')
    ),
    'reward_summary', jsonb_build_object(
      'story_xp',200,'ring_coins',300,'real_gems_first_time',300,
      'title','마스터 후보','card_code','card_master_candidate','badge_code','badge_master')));

-- =====================================================================
-- 8.4 프로의 길 — 6 챕터
-- =====================================================================

-- ── 챕터 1: 취미반의 시작 (8 씬) ──
SELECT public._story_seed_dialogue('pro_01_hobby_start', 0,
  jsonb_build_object('speaker','오삼이',
    'body','오늘 처음 와봤어요. 거창한 결심이 아니에요. 그냥 — 한 번 와본 거예요. 그게 복싱의 시작입니다.'), 1);
SELECT public._story_seed_node_move('pro_01_hobby_start', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','gym_entrance'), 2);
SELECT public._story_seed_dialogue('pro_01_hobby_start', 2,
  jsonb_build_object('speaker','박 선배','portrait','park','bgm_hint','warm',
    'body','취미여도 매일 오면 그게 프로예요. 진짜로요. 저도 처음에 ''그냥 한 번 와봐야지'' 했는데 — 5년이 됐네요. 시작은 가벼워도 돼요. 다만 — 다음 날에 또 오면.'), 3);
SELECT public._story_seed_choice('pro_01_hobby_start', 3,
  jsonb_build_object('prompt','오늘이 첫날입니다. 어떤 마음으로 들어왔어요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''그냥 한 번 와봤어요''','hint','투지 +5','stat_changes',jsonb_build_object('grit',5),'next_scene',4),
      jsonb_build_object('label','''살 빼려고요...''','hint','기술 +2, 집중 +2','stat_changes',jsonb_build_object('skill',2,'focus',2),'next_scene',4),
      jsonb_build_object('label','''멋있어 보여서요''','hint','리스펙트 +3','stat_changes',jsonb_build_object('respect',3),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('pro_01_hobby_start', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','이불 속에서 들리던 목소리가 형체를 가집니다... 게으름 슬라임. 가장 자주 만나고 — 가장 끈질긴 적.'), 5);
SELECT public._story_seed_battle('pro_01_hobby_start', 5,
  jsonb_build_object('enemy_code','lazy_slime',
    'intro_line','가장 단순한 적. 잽으로 시작해보세요.',
    'victory_line','거품이 흩어져요. 첫 라운드 — 끝까지 안 도망갔어요.',
    'defeat_line','괜찮아요. 게으름은 한 번에 안 사라져요.'), 6, 4);
SELECT public._story_seed_dialogue('pro_01_hobby_start', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','한 라운드 더 뛰었어요. 거창한 결심 없이. 그게 시작이에요. ''그냥 와본 사람'' 의 발걸음은 — 이상하게 안 사라져요.'), 7);
SELECT public._story_seed_dialogue('pro_01_hobby_start', 7,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 1 클리어] 보상: XP +60, 코인 +150, 카드 ''첫 글러브''.',
    'reward_grant', jsonb_build_object('story_xp',60,'ring_coins',150,'card','card_glove_first')), -1);

-- ── 챕터 2: 루틴의 탄생 (8 씬) ──
SELECT public._story_seed_dialogue('pro_02_routine_birth', 0,
  jsonb_build_object('speaker','오삼이',
    'body','월화수목금. 같은 시간에 같은 자리. 처음 2주는 의지로 가요. 3주부터는 — 안 가면 이상해요. 의지가 습관으로 바뀌는 그 결이에요.'), 1);
SELECT public._story_seed_node_move('pro_02_routine_birth', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','rope_zone'), 2);
SELECT public._story_seed_dialogue('pro_02_routine_birth', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','오늘도 왔네... 그래. 잘하는 거 안 봐. 매일 오는 거만 봐. 매일 오는 사람이 결국 — 잘하더라.'), 3);
SELECT public._story_seed_choice('pro_02_routine_birth', 3,
  jsonb_build_object('prompt','오늘은 비가 오고 야근으로 늦었어요. 어떻게 할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','줄넘기 3라운드만 — 짧게라도','hint','투지 +5, 가드 +2','stat_changes',jsonb_build_object('grit',5,'guard',2),'next_scene',4),
      jsonb_build_object('label','오늘은 회복일로 한다','hint','집중 +5, HP +10','stat_changes',jsonb_build_object('focus',5,'hp',10),'next_scene',4),
      jsonb_build_object('label','거울 앞 섀도복싱만 10분','hint','기술 +3, 리스펙트 +2','stat_changes',jsonb_build_object('skill',3,'respect',2),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('pro_02_routine_birth', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','줄넘기 코너에서 핑계 도깨비가 손가락을 가리킵니다. ''오늘은 비가 오니까'', ''오늘은 야근이니까''...'), 5);
SELECT public._story_seed_battle('pro_02_routine_birth', 5,
  jsonb_build_object('enemy_code','excuse_goblin',
    'victory_line','도깨비가 슬며시 사라져요. ''이상하게 와버린 사람'' 이 — 결국 이깁니다.',
    'defeat_line','한 번 들어주면 — 다음에 두 번 들어줘요. 다시 거절.'), 6, 4);
SELECT public._story_seed_dialogue('pro_02_routine_birth', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','한 달이 지났어요. 어제도 오고, 오늘도 왔어요. 흔들리지 않는 마음이 생긴 게 아니에요. 흔들려도 가는 발걸음이 — 생긴 거예요.'), 7);
SELECT public._story_seed_dialogue('pro_02_routine_birth', 7,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 2 클리어] 보상: XP +80, 코인 +200, 카드 ''강철 가드''.',
    'reward_grant', jsonb_build_object('story_xp',80,'ring_coins',200,'card','card_guard_iron')), -1);

-- ── 챕터 3: 첫 스파링의 긴장 (10 씬) ──
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 0,
  jsonb_build_object('speaker','오삼이',
    'body','심장이 빠르게 뜁니다. 첫 스파링. 도망가고 싶어요. 한 라운드만 해보자... 그게 시작이에요.'), 1);
SELECT public._story_seed_node_move('pro_03_first_spar_tension', 1,
  jsonb_build_object('from_node_code','rope_zone','to_node_code','ring','transition_message','링 — 처음으로'), 2);
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 2,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','tense',
    'body','들어가기 전에. 가드는 광대 옆. 호흡은 코로 들이쉬고 입으로 — 짧게. 잽 두 번, 발 한 번. 안 맞아도 돼요. 도망가지만 마요.'), 3);
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 3,
  jsonb_build_object('speaker','도훈','portrait','dohun','bgm_hint','warm',
    'body','나도 처음이야. 살살 갈게. 너도 살살 가. 우리 둘 다 — 오늘이 첫 라운드잖아. 잘 치는 거 보다 — 끝까지 안 도망가는 거. 그거만 해보자.'), 4);
SELECT public._story_seed_choice('pro_03_first_spar_tension', 4,
  jsonb_build_object('prompt','종이 울리기 직전. 마음 속에 무엇을 떠올릴까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','김 코치의 자세 — 가드 광대 옆','hint','가드 +5','stat_changes',jsonb_build_object('guard',5),'next_scene',5),
      jsonb_build_object('label','도훈의 한마디 — ''같이 가자''','hint','리스펙트 +5, 투지 +3','stat_changes',jsonb_build_object('respect',5,'grit',3),'next_scene',5),
      jsonb_build_object('label','박 선배의 회상 — ''끝까지 있는 사람''','hint','투지 +5, 집중 +3','stat_changes',jsonb_build_object('grit',5,'focus',3),'next_scene',5)
    )));
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 5,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','긴장 늑대가 송곳니를 드러냅니다. 첫 턴 강력 공격 — 그 후 데미지 -50%. 첫 턴은 가드, 그 다음 카운터.'), 6);
SELECT public._story_seed_battle('pro_03_first_spar_tension', 6,
  jsonb_build_object('enemy_code','tense_wolf',
    'intro_line','긴장 늑대 — 첫 턴이 가장 무서워요.',
    'victory_line','늑대가 — 천천히 친구가 됩니다. 도망가지 않은 그 1분 — 평생을 바꿉니다.',
    'defeat_line','두려움 안에서 한 발만 내딛으면 돼요. 다시.'), 7, 5);
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 7,
  jsonb_build_object('speaker','도훈','portrait','dohun','bgm_hint','warm',
    'body','끝까지 갔네. 너 안 도망갔어. 나도 안 도망갔고. 우린 — 오늘 같이 한 라운드 끝낸 거야.'), 8);
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 8,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','warm',
    'body','잘 했어요. 가드 좋았고. 호흡 — 다음엔 더 짧게. 두려움은 사라지지 않아요. 두려움 안에서 한 발 내딛는 법을 배우는 거고.'), 9);
SELECT public._story_seed_dialogue('pro_03_first_spar_tension', 9,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 3 클리어] 보상: XP +100, 코인 +250, 카드 ''바람의 풋워크''.',
    'reward_grant', jsonb_build_object('story_xp',100,'ring_coins',250,'card','card_footwork_wind')), -1);

-- ── 챕터 4: 체력의 벽 (8 씬) ──
SELECT public._story_seed_dialogue('pro_04_stamina_wall', 0,
  jsonb_build_object('speaker','오삼이',
    'body','3라운드 후 다리가 풀려요. 가드가 무거워요. ''오늘은 여기까지'' 라고 몸이 말해요. 그 목소리가 가장 클 때 — 한 발 더 내딛는 사람이 있어요.'), 1);
SELECT public._story_seed_node_move('pro_04_stamina_wall', 1,
  jsonb_build_object('from_node_code','ring','to_node_code','sandbag_zone','transition_message','샌드백 존 — 5라운드'), 2);
SELECT public._story_seed_dialogue('pro_04_stamina_wall', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan',
    'body','벽 앞에서 한 발 더... 가는 사람을 우리는 복서라고 불러. 한 발 안 가도 괜찮아. 다음 날에 또 오면 돼.'), 3);
SELECT public._story_seed_choice('pro_04_stamina_wall', 3,
  jsonb_build_object('prompt','5라운드. 다리가 풀립니다. 그래도 가시겠어요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','한 라운드 더','hint','투지 +8, HP -15','stat_changes',jsonb_build_object('grit',8,'hp',-15),'next_scene',4),
      jsonb_build_object('label','호흡 정리하고 천천히','hint','집중 +5, HP -5','stat_changes',jsonb_build_object('focus',5,'hp',-5),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('pro_04_stamina_wall', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','샌드백 옆에서 숨참기 유령이 다가옵니다. 회피율 60% — 풋워크가 안 통해요. 카운터로만 잡을 수 있어요.'), 5);
SELECT public._story_seed_battle('pro_04_stamina_wall', 5,
  jsonb_build_object('enemy_code','breath_holder',
    'intro_line','유령 — 가드가 안 통해요. 카운터를 쳐야 회피가 무효화됩니다.',
    'victory_line','유령이 사라집니다. 호흡이 살아있어야 — 라운드도 살아있어요.',
    'defeat_line','가드만으로는 안 잡혀요. 카운터로 — 정직하게 한 방.'), 6, 4);
SELECT public._story_seed_dialogue('pro_04_stamina_wall', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','5라운드를 끝까지 뛰었어요. 다리는 후들거리고 숨은 차요. 그래도 — 종소리를 들었어요. 벽 앞에서 한 발 더 — 그게 복서의 정의예요.'), 7);
SELECT public._story_seed_dialogue('pro_04_stamina_wall', 7,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 4 클리어] 보상: XP +120, 코인 +300, 카드 ''번개 카운터''.',
    'reward_grant', jsonb_build_object('story_xp',120,'ring_coins',300,'card','card_counter_lightning')), -1);

-- ── 챕터 5: 나의 스타일 (9 씬) ──
SELECT public._story_seed_dialogue('pro_05_my_style', 0,
  jsonb_build_object('speaker','오삼이',
    'body','교과서 같은 폼이 있어요. 좋은 폼이에요. 그런데 어느 날 — 내 몸이 만든 폼이 따로 있다는 걸 발견해요.'), 1);
SELECT public._story_seed_node_move('pro_05_my_style', 1,
  jsonb_build_object('from_node_code','sandbag_zone','to_node_code','mirror_zone'), 2);
SELECT public._story_seed_dialogue('pro_05_my_style', 2,
  jsonb_build_object('speaker','김 코치','portrait','kim',
    'body','교과서대로 안 해도 돼요. 다만 — 안 다치게만. 본인 거리에서 본인 박자로. 그 안에서 자라는 폼이 — 진짜예요.'), 3);
SELECT public._story_seed_dialogue('pro_05_my_style', 3,
  jsonb_build_object('speaker','박 선배','portrait','park',
    'body','저는 5년 됐는데도 — 제 스타일이 뭔지 잘 모르겠어요. 근데 어느 날 보니까, 제 잽이 — 다른 사람과 좀 다르더라고요. 따라하려고 한 적 없는데. 자라는 거예요. 천천히.'), 4);
SELECT public._story_seed_choice('pro_05_my_style', 4,
  jsonb_build_object('prompt','거울 앞에서 자기 자세를 봅니다. 어떻게 잡을까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','내 몸이 편한 거리로','hint','기술 +5, 가드 +2','stat_changes',jsonb_build_object('skill',5,'guard',2),'next_scene',5),
      jsonb_build_object('label','내 박자로 — 천천히','hint','집중 +5, 투지 +2','stat_changes',jsonb_build_object('focus',5,'grit',2),'next_scene',5),
      jsonb_build_object('label','내 한 방에 집중 — 잽 한 개','hint','기술 +7','stat_changes',jsonb_build_object('skill',7),'next_scene',5)
    )));
SELECT public._story_seed_dialogue('pro_05_my_style', 5,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','거울 너머로 비교 괴물이 또 나타나요. 옆 사람의 폼을 자꾸 따라하게 만드는 그 마음. 이번엔 — 자기 폼을 보여주세요.'), 6);
SELECT public._story_seed_battle('pro_05_my_style', 6,
  jsonb_build_object('enemy_code','compare_monster',
    'intro_line','비교 괴물 — 당신의 능력치를 복사합니다. respect 50+ 시 데미지 1.5배.',
    'victory_line','괴물의 눈이 감깁니다. 자기 폼이 — 가장 무서워요.',
    'defeat_line','옆 사람과 견주지 마세요. 내 거울만 보세요.'), 7, 5);
SELECT public._story_seed_dialogue('pro_05_my_style', 7,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','나만의 거리, 나만의 박자, 나만의 한 방. 다른 사람과 다른 게 — 약점이 아니에요. 그게 — 내 무기예요.'), 8);
SELECT public._story_seed_dialogue('pro_05_my_style', 8,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 5 클리어] 보상: XP +150, 코인 +400, 카드 ''잽 마스터''.',
    'reward_grant', jsonb_build_object('story_xp',150,'ring_coins',400,'card','card_jab_master')), -1);

-- ── 챕터 6: 프로 루틴 테스트 (11 씬) — 보스 + 엔딩 ──
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','오늘은 컨디션이 별로예요. 어제 잠을 설쳤고, 어깨가 뻐근해요. 그래도 — 같은 루틴. 줄넘기 5라운드, 섀도복싱 3라운드, 미트 4라운드.'), 1);
SELECT public._story_seed_node_move('pro_06_pro_routine_test', 1,
  jsonb_build_object('from_node_code','mirror_zone','to_node_code','ring'), 2);
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan',
    'body','컨디션 안 좋다고 안 빠진 거 봤어... 잘했어. 더 안 해도 돼. 같은 거 했으면 그게 프로야.'), 3);
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 3,
  jsonb_build_object('speaker','도훈','portrait','dohun','bgm_hint','warm',
    'body','야, 너 진짜 매일 같은 루틴 하더라. 부럽다. 나는 컨디션 나쁘면 빠지는데 — 너는 안 빠지더라고. 그게 — 진짜 차이인 거 같아.'), 4);
SELECT public._story_seed_choice('pro_06_pro_routine_test', 4,
  jsonb_build_object('prompt','오늘의 루틴 — 평소처럼 갈까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','평소 그대로 — 5라운드 / 3라운드 / 4라운드','hint','투지 +8, 집중 +3','stat_changes',jsonb_build_object('grit',8,'focus',3),'next_scene',5),
      jsonb_build_object('label','조금 줄여서 — 4 / 3 / 3','hint','집중 +5, HP +10','stat_changes',jsonb_build_object('focus',5,'hp',10),'next_scene',5),
      jsonb_build_object('label','기본기만 잽 100개','hint','기술 +5','stat_changes',jsonb_build_object('skill',5),'next_scene',5)
    )));
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 5,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','링 가운데로 루틴 파괴자가 들어옵니다. 매 턴 능력치 1개를 영구적으로 -1 시켜요. 가드/풋워크로 버티며 잽으로 정직하게.'), 6);
SELECT public._story_seed_battle('pro_06_pro_routine_test', 6,
  jsonb_build_object('enemy_code','routine_breaker',
    'intro_line','루틴 파괴자 — 조급함이 패배 원인이에요.',
    'victory_line','파괴자가 — 서서히 무너집니다. 같은 자리에 선 사람이 — 결국 이깁니다.',
    'defeat_line','조급해지면 졌어요. 잽 한 개씩 — 같은 박자로.'), 7, 4);
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 7,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','컨디션 나빠도 같은 루틴을 끝냈어요. 잘하는 사람이 프로가 아니에요. 같은 사람이 — 프로예요.'), 8);
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 8,
  jsonb_build_object('speaker','강 관장','portrait','gwan',
    'body','잘 갔어... 비 와도 오는 사람. 컨디션 나빠도 같은 루틴 하는 사람. 그게 프로의 정의야.'), 9);
SELECT public._story_seed_dialogue('pro_06_pro_routine_test', 9,
  jsonb_build_object('speaker','도훈','portrait','dohun',
    'body','너 보고 — 나도 안 빠지기로 했어. 다음 시즌엔 — 같이 가자.'), 10);
SELECT public._story_seed_ending('pro_06_pro_routine_test', 10,
  jsonb_build_object('ending_code','pro_routine','title','프로 루틴 후보','subtitle','매일 같은 자리에 서는 사람',
    'cutscene_blocks', jsonb_build_array(
      jsonb_build_object('type','narration','body','비가 오는 화요일 저녁. 체육관은 평소보다 한산하다. 그래도 거울 앞에는 — 같은 자세, 같은 시간.','background','ring_lights'),
      jsonb_build_object('type','image_caption','speaker','강 관장','body','비 와도 오는 사람. 컨디션 나빠도 같은 루틴 하는 사람... 그게 프로의 정의야. 잘 왔어.'),
      jsonb_build_object('type','image_caption','speaker','도훈','body','야, 너 진짜 매일 오더라. 나도 이젠 안 빠져. 너 때문에...'),
      jsonb_build_object('type','narration','body','프로 루틴 후보. 매일 같은 자리에 서는 사람이 가장 무서운 복서.','background','ring_lights'),
      jsonb_build_object('type','credits','body','[엔딩: 프로 루틴 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 ''프로 루틴 후보'', 카드 ''card_pro_routine'', 파이트 머니 +300 (최초 1회)')
    ),
    'reward_summary', jsonb_build_object(
      'story_xp',200,'ring_coins',300,'real_gems_first_time',300,
      'title','프로 루틴 후보','card_code','card_pro_routine','badge_code','badge_pro')));

-- =====================================================================
-- 8.5 챔피언 로드 — 6 챕터
-- =====================================================================

-- ── 챕터 1: 도전자의 문 (9 씬) ──
SELECT public._story_seed_dialogue('champ_01_contender_gate', 0,
  jsonb_build_object('speaker','오삼이',
    'body','체육관 벽에 액자가 하나 걸려있어요. 153짐 출신 선배 한 분의 빛바랜 사진. 그 앞에 잠시 멈춥니다.'), 1);
SELECT public._story_seed_node_move('champ_01_contender_gate', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','gym_entrance','transition_message','체육관 입구 — 액자 앞'), 2);
SELECT public._story_seed_dialogue('champ_01_contender_gate', 2,
  jsonb_build_object('speaker','한 챔피언','portrait','han_champion','bgm_hint','epic',
    'body','(액자 속 빛바랜 글자가 또렷해진다) 나도 처음엔 도전자였다. 잘 친 적도, 못 친 적도 있었지. 그저 — 다음 날에 또 왔을 뿐이다.'), 3);
SELECT public._story_seed_choice('champ_01_contender_gate', 3,
  jsonb_build_object('prompt','액자 앞에서 한 호흡을 골라요. 무엇을 마음에 두시겠어요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''나도 다음 날에 또 와야지''','hint','투지 +5, 리스펙트 +3','stat_changes',jsonb_build_object('grit',5,'respect',3),'next_scene',4),
      jsonb_build_object('label','''잘 친 적도 못 친 적도 — 같은 무게''','hint','집중 +5, 가드 +2','stat_changes',jsonb_build_object('focus',5,'guard',2),'next_scene',4),
      jsonb_build_object('label','''챔피언도 — 처음엔 평범한 사람이었구나''','hint','리스펙트 +7','stat_changes',jsonb_build_object('respect',7),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('champ_01_contender_gate', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','도전자의 문 앞에서 긴장 늑대가 송곳니를 드러냅니다. ''내가 감히 도전을?'' 그 두려움.'), 5);
SELECT public._story_seed_battle('champ_01_contender_gate', 5,
  jsonb_build_object('enemy_code','tense_wolf',
    'intro_line','첫 턴 가드, 다음 턴 카운터 — 그 콤보.',
    'victory_line','늑대가 도망갑니다. 도전자의 문 — 열렸어요.',
    'defeat_line','두려움 안에서 한 발만. 다시.'), 6, 4);
SELECT public._story_seed_dialogue('champ_01_contender_gate', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','도전자의 문을 열었어요. 거창한 의식 없이 — 조용히. 진짜 시작은 — 이렇게 조용해요. 큰 결심이 아니라, 작은 한 걸음.'), 7);
SELECT public._story_seed_dialogue('champ_01_contender_gate', 7,
  jsonb_build_object('speaker','한 챔피언','portrait','han_champion',
    'body','(다시 한번) 챔피언은 — 도전자였던 사람만 될 수 있다. 너도 — 시작했다.'), 8);
SELECT public._story_seed_dialogue('champ_01_contender_gate', 8,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 1 클리어] 보상: XP +60, 코인 +150, 카드 ''첫 글러브''.',
    'reward_grant', jsonb_build_object('story_xp',60,'ring_coins',150,'card','card_glove_first')), -1);

-- ── 챕터 2: 그림자 복서 (8 씬, NPC 없음) ──
SELECT public._story_seed_dialogue('champ_02_shadow_boxer', 0,
  jsonb_build_object('speaker','오삼이',
    'body','거울 앞에 섰어요. 거울 속의 그 사람은 — 어제의 나입니다. 잘 안 풀린 라운드도, 포기하고 싶었던 순간도 거기 다 있어요.'), 1);
SELECT public._story_seed_node_move('champ_02_shadow_boxer', 1,
  jsonb_build_object('from_node_code','gym_entrance','to_node_code','mirror_zone','transition_message','거울 앞 — 어제의 나'), 2);
SELECT public._story_seed_dialogue('champ_02_shadow_boxer', 2,
  jsonb_build_object('speaker','self','portrait','self','bgm_hint','tense',
    'body','(거울 속의 어제의 나) 어제는 — 한 라운드 일찍 멈췄지. 오늘은 — 한 라운드 더 갈래?'), 3);
SELECT public._story_seed_choice('champ_02_shadow_boxer', 3,
  jsonb_build_object('prompt','거울 속 어제의 나에게 무엇이라 답할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''한 라운드 더 가자''','hint','투지 +5','stat_changes',jsonb_build_object('grit',5),'next_scene',4),
      jsonb_build_object('label','''어제는 잘 했어. 오늘은 같이 가자''','hint','리스펙트 +5, 집중 +3','stat_changes',jsonb_build_object('respect',5,'focus',3),'next_scene',4),
      jsonb_build_object('label','''잽 한 개만 더 — 그게 다야''','hint','기술 +5','stat_changes',jsonb_build_object('skill',5),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('champ_02_shadow_boxer', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','거울 옆 비교 괴물이 다가옵니다. 옆 거울을 자꾸 보게 만드는 — 가장 미세한 적이에요.'), 5);
SELECT public._story_seed_battle('champ_02_shadow_boxer', 5,
  jsonb_build_object('enemy_code','compare_monster',
    'intro_line','이번엔 어제의 나를 겨루는 거예요. 옆 거울 보지 마세요.',
    'victory_line','거울 속의 어제의 나가 살짝 끄덕입니다. ''잘 했어.''',
    'defeat_line','옆 거울 봤어요. 다시 — 내 거울만.'), 6, 4);
SELECT public._story_seed_dialogue('champ_02_shadow_boxer', 6,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','오늘의 나는 어제의 나와 — 싸웠어요. 잽 한 개가 더 깨끗해요. 발 한 걸음이 더 가벼워요. 작은 차이지만 — 거울은 정직하게 보여줘요.'), 7);
SELECT public._story_seed_dialogue('champ_02_shadow_boxer', 7,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 2 클리어] 보상: XP +80, 코인 +200, 카드 ''강철 가드''.',
    'reward_grant', jsonb_build_object('story_xp',80,'ring_coins',200,'card','card_guard_iron')), -1);

-- ── 챕터 3: 라이벌 매칭 (10 씬, 도훈 핵심) ──
SELECT public._story_seed_dialogue('champ_03_rival_match', 0,
  jsonb_build_object('speaker','오삼이',
    'body','비슷한 시기에 들어온 사람이 있어요. 비슷한 레벨, 비슷한 고민. 처음엔 견제했어요.'), 1);
SELECT public._story_seed_node_move('champ_03_rival_match', 1,
  jsonb_build_object('from_node_code','mirror_zone','to_node_code','rival_arena','transition_message','라이벌 아레나'), 2);
SELECT public._story_seed_dialogue('champ_03_rival_match', 2,
  jsonb_build_object('speaker','도훈','portrait','dohun','bgm_hint','warm',
    'body','한 라운드 더 가자. 너 잘 치는 거 알아. 나도 너 만나면서 늘었어. 우리 — 누가 이긴다보다 — 같이 한 발 더 가는 거. 그거 하자.'), 3);
SELECT public._story_seed_choice('champ_03_rival_match', 3,
  jsonb_build_object('prompt','도훈을 어떻게 마주할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''그래. 같이 가자.'' 글러브 맞대기','hint','리스펙트 +10, grit +3','stat_changes',jsonb_build_object('respect',10,'grit',3),'next_scene',4),
      jsonb_build_object('label','''살살 가자'' 웃으며','hint','리스펙트 +5, 집중 +3','stat_changes',jsonb_build_object('respect',5,'focus',3),'next_scene',4),
      jsonb_build_object('label','''오늘은 진심으로 — 둘 다 한계까지.''','hint','기술 +5, 투지 +5, HP -10','stat_changes',jsonb_build_object('skill',5,'grit',5,'hp',-10),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('champ_03_rival_match', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','라이벌 아레나에 긴장 늑대가 다시 나타나요. 라이벌과 마주할 때 송곳니를 드러내는 그 마음.'), 5);
SELECT public._story_seed_battle('champ_03_rival_match', 5,
  jsonb_build_object('enemy_code','tense_wolf',
    'intro_line','이번엔 — 이기고 싶은 욕망이 적이에요.',
    'victory_line','늑대가 사라지고 — 도훈이 글러브를 내립니다. 둘 다 — 한 라운드 더 강해졌어요.',
    'defeat_line','이기려는 마음이 너무 컸어요. 다시 — 같이 가는 마음으로.'), 6, 4);
SELECT public._story_seed_dialogue('champ_03_rival_match', 6,
  jsonb_build_object('speaker','도훈','portrait','dohun','bgm_hint','warm',
    'body','잘 치네. 진심으로. 너 만나서 — 나 진짜 늘었어. 다음 시즌도 — 같이 가자.'), 7);
SELECT public._story_seed_dialogue('champ_03_rival_match', 7,
  jsonb_build_object('speaker','오삼이',
    'body','어느 날 깨달아요 — 라이벌은 적이 아니에요. 함께 자라는 거울이에요. 좋은 라이벌은 내 한계를 보여주는 사람이에요.'), 8);
SELECT public._story_seed_choice('champ_03_rival_match', 8,
  jsonb_build_object('prompt','도훈에게 무엇을 줄까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','물 한 잔','hint','리스펙트 +5','stat_changes',jsonb_build_object('respect',5),'next_scene',9),
      jsonb_build_object('label','수건 던져주기','hint','리스펙트 +3, 가드 +2','stat_changes',jsonb_build_object('respect',3,'guard',2),'next_scene',9),
      jsonb_build_object('label','엄지 척','hint','투지 +3','stat_changes',jsonb_build_object('grit',3),'next_scene',9)
    )));
SELECT public._story_seed_dialogue('champ_03_rival_match', 9,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 3 클리어] 보상: XP +100, 코인 +250, 카드 ''바람의 풋워크''.',
    'reward_grant', jsonb_build_object('story_xp',100,'ring_coins',250,'card','card_footwork_wind')), -1);

-- ── 챕터 4: 파이트 캠프 (9 씬) ──
SELECT public._story_seed_dialogue('champ_04_fight_camp', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','calm',
    'body','캠프에 들어왔어요. 사람도 줄이고 약속도 줄이고. 자기 자신과만 마주해요. 외로워요. 하지만 — 외로움 속에서 단단해지는 결이 있어요.'), 1);
SELECT public._story_seed_node_move('champ_04_fight_camp', 1,
  jsonb_build_object('from_node_code','rival_arena','to_node_code','fight_camp','transition_message','파이트 캠프 — 혼자만의 시간'), 2);
SELECT public._story_seed_dialogue('champ_04_fight_camp', 2,
  jsonb_build_object('speaker','김 코치','portrait','kim',
    'body','오늘은 줄넘기 5라운드만. 더 안 해요. 캠프는 더 하는 시간이 아니라 — 정확히 하는 시간이에요. 휴식도 훈련의 일부고.'), 3);
SELECT public._story_seed_choice('champ_04_fight_camp', 3,
  jsonb_build_object('prompt','캠프 셋째 날 — 어깨가 뻐근해요. 어떻게 할까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','쉰다 — 안 다치게','hint','집중 +5, HP +20, 리스펙트 +5','stat_changes',jsonb_build_object('focus',5,'hp',20,'respect',5),'next_scene',4),
      jsonb_build_object('label','가벼운 줄넘기 — 회복용','hint','집중 +3, 가드 +2','stat_changes',jsonb_build_object('focus',3,'guard',2),'next_scene',4),
      jsonb_build_object('label','''한 번만 더'' — 무시','hint','기술 +3, HP -15','stat_changes',jsonb_build_object('skill',3,'hp',-15),'next_scene',4)
    )));
SELECT public._story_seed_dialogue('champ_04_fight_camp', 4,
  jsonb_build_object('speaker','오삼이','bgm_hint','tense',
    'body','캠프 안에서 과훈련 골렘이 나타나요. ''더, 더'' 라고 속삭이는 그 마음. 멈춰야 할 때 못 멈추게 만드는 가장 큰 적.'), 5);
SELECT public._story_seed_battle('champ_04_fight_camp', 5,
  jsonb_build_object('enemy_code','overtrain_golem',
    'intro_line','골렘 — HP 가 매우 높아요. 잽 누적, 정직하게.',
    'victory_line','골렘이 무너집니다. 멈출 때를 안 사람만이 — 마지막 라운드를 갖습니다.',
    'defeat_line','조급함이 이겨버렸어요. 한 번 쉬고 — 다시.'), 6, 3);
SELECT public._story_seed_dialogue('champ_04_fight_camp', 6,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','warm',
    'body','잘 멈췄어요. 다음 라운드를 위해 — 오늘은 그게 최선이에요. 캠프는 — 안 다치고 다음 시즌 가는 거예요.'), 7);
SELECT public._story_seed_dialogue('champ_04_fight_camp', 7,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','캠프가 끝났어요. 외로움을 견딘 자리에 — 단단함이 남았어요. 다른 사람이 없을 때 비로소 보이는 — 내 자세, 내 호흡, 내 의도.'), 8);
SELECT public._story_seed_dialogue('champ_04_fight_camp', 8,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 4 클리어] 보상: XP +130, 코인 +350, 카드 ''번개 카운터''.',
    'reward_grant', jsonb_build_object('story_xp',130,'ring_coins',350,'card','card_counter_lightning')), -1);

-- ── 챕터 5: 마지막 라운드 (10 씬) ──
SELECT public._story_seed_dialogue('champ_05_last_round', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','마지막 라운드. 가드는 무겁고 발은 안 떨어져요. 한 발만 더. 한 잽만 더. 챔피언의 정신은 — 결과가 아니라 마음이에요.'), 1);
SELECT public._story_seed_node_move('champ_05_last_round', 1,
  jsonb_build_object('from_node_code','fight_camp','to_node_code','ring','transition_message','링 — 마지막 라운드'), 2);
SELECT public._story_seed_dialogue('champ_05_last_round', 2,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','tense',
    'body','코너에서 들어. 가드 올려. 오른발만 신경 써. 잽 두 번, 백 스텝. 1분 남았어. 끝까지만 가. 잘 칠 필요 없어. 안 멈추기만 해.'), 3);
SELECT public._story_seed_dialogue('champ_05_last_round', 3,
  jsonb_build_object('speaker','강 관장','portrait','gwan',
    'body','한 발 더... 그게 다야. 잘 친 거 안 봐. 안 멈춘 거만 봐. 안 멈췄으면 — 이미 챔피언이야.'), 4);
SELECT public._story_seed_choice('champ_05_last_round', 4,
  jsonb_build_object('prompt','1분 남았어요. 어떻게 갈까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','잽 두 번, 백 스텝 — 김 코치 작전','hint','기술 +3, 가드 +3','stat_changes',jsonb_build_object('skill',3,'guard',3),'next_scene',5),
      jsonb_build_object('label','마지막 한 방 — 카운터','hint','기술 +5, 투지 +3, HP -10','stat_changes',jsonb_build_object('skill',5,'grit',3,'hp',-10),'next_scene',5),
      jsonb_build_object('label','그냥 — 안 멈춘다','hint','투지 +8','stat_changes',jsonb_build_object('grit',8),'next_scene',5)
    )));
SELECT public._story_seed_dialogue('champ_05_last_round', 5,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','마지막 30초 — 포기 악마가 가장 크게 속삭여요. ''이 정도면 됐어.'' 끝나기 직전이 — 가장 위험해요.'), 6);
SELECT public._story_seed_battle('champ_05_last_round', 6,
  jsonb_build_object('enemy_code','quit_demon',
    'intro_line','포기 악마 — 매 턴 집중 -1. 풋워크 + 카운터 콤보.',
    'victory_line','악마가 사라지고 — 종이 울려요. 끝까지 갔어요.',
    'defeat_line','포기는 한 발 직전에 와요. 다시 — 한 발 더.'), 7, 4);
SELECT public._story_seed_dialogue('champ_05_last_round', 7,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','마지막 종이 울렸어요. 다리는 후들거리지만 — 끝까지 갔어요. 이 한 발이 — 챔피언의 정신이에요. 트로피보다 길게 남는 마음의 흔적.'), 8);
SELECT public._story_seed_dialogue('champ_05_last_round', 8,
  jsonb_build_object('speaker','김 코치','portrait','kim','bgm_hint','warm',
    'body','코너에서 본 마지막 1분 — 평생 못 잊어요. 안 멈추는 그 발걸음. 그게 — 챔피언이에요.'), 9);
SELECT public._story_seed_dialogue('champ_05_last_round', 9,
  jsonb_build_object('speaker','오삼이',
    'body','[챕터 5 클리어] 보상: XP +160, 코인 +450, 카드 ''잽 마스터''.',
    'reward_grant', jsonb_build_object('story_xp',160,'ring_coins',450,'card','card_jab_master')), -1);

-- ── 챕터 6: 챔피언 나이트 (14 씬) — 보스 + 엔딩 ──
SELECT public._story_seed_dialogue('champ_06_champion_night', 0,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','시즌이 끝나는 밤이에요. 트로피를 들거나, 못 들거나. 양쪽 다 — 오늘 끝까지 라운드를 뛴 사람들이에요.'), 1);
SELECT public._story_seed_node_move('champ_06_champion_night', 1,
  jsonb_build_object('from_node_code','ring','to_node_code','boxing_hall','transition_message','복싱 전당 — 챔피언의 밤'), 2);
SELECT public._story_seed_dialogue('champ_06_champion_night', 2,
  jsonb_build_object('speaker','강 관장','portrait','gwan','bgm_hint','warm',
    'body','잘 했어... 진짜로. 트로피 봐도 안 봐도 — 같아. 끝까지 간 거. 그게 다야.'), 3);
SELECT public._story_seed_dialogue('champ_06_champion_night', 3,
  jsonb_build_object('speaker','박 선배','portrait','park',
    'body','같이 시즌 뛰어줘서 고마워요. 저 혼자였으면 — 중간에 포기했을 거예요. 옆에서 떨고 있는 사람이 있다는 게 — 가장 큰 힘이에요.'), 4);
SELECT public._story_seed_dialogue('champ_06_champion_night', 4,
  jsonb_build_object('speaker','민지','portrait','minji',
    'body','선배님!! 진짜 시즌 끝까지 가셨어요?! 저는 오늘 처음 응원 왔는데 — 끝나는 그 순간 — 너무 멋있었어요!'), 5);
SELECT public._story_seed_dialogue('champ_06_champion_night', 5,
  jsonb_build_object('speaker','도훈','portrait','dohun',
    'body','같이 시즌 뛰어서 다행이야. 너 없었으면 — 내 한계 못 봤을 거야. 다음 시즌도 — 같이 가자. 적이 아니라, 같은 길 가는 사람으로.'), 6);
SELECT public._story_seed_choice('champ_06_champion_night', 6,
  jsonb_build_object('prompt','마지막 거울 앞. 어제의 나와 마주합니다. 무엇을 마음에 둘까요?',
    'choices', jsonb_build_array(
      jsonb_build_object('label','''어제의 나, 잘 왔어''','hint','리스펙트 +10, 집중 +5','stat_changes',jsonb_build_object('respect',10,'focus',5),'next_scene',7),
      jsonb_build_object('label','''한 발만 더 — 그게 다야''','hint','투지 +10, 기술 +3','stat_changes',jsonb_build_object('grit',10,'skill',3),'next_scene',7),
      jsonb_build_object('label','''이번 시즌 — 정말 고마웠어''','hint','리스펙트 +15','stat_changes',jsonb_build_object('respect',15),'next_scene',7)
    )));
SELECT public._story_seed_dialogue('champ_06_champion_night', 7,
  jsonb_build_object('speaker','오삼이','bgm_hint','epic',
    'body','거울 너머로 — 두 형체가 보입니다. 처음의 나, 그리고 비교 괴물의 진화형. 1페이즈는 가벼워요. 2페이즈는 — 모든 능력치를 합산해서 옵니다.'), 8);
SELECT public._story_seed_battle('champ_06_champion_night', 8,
  jsonb_build_object('enemy_code','self_compare_evolved',
    'intro_line','1페이즈: 처음의 나 (약함). 카운터로 절제된 한 방. 2페이즈: 비교 괴물 진화형 (강함). respect + grit 합 100+ 시 1.5배.',
    'victory_line','거울 속의 두 형체가 합쳐집니다 — 그 자리에 당신만 남아요.',
    'defeat_line','1페이즈에 너무 강했거나, 2페이즈에 너무 약했어요. 다시.'), 9, 6);
SELECT public._story_seed_dialogue('champ_06_champion_night', 9,
  jsonb_build_object('speaker','한 챔피언','portrait','han_champion','bgm_hint','epic',
    'body','내가 오늘 한 라운드를 뛴 이유는 — 어제의 내가 뛰었기 때문이야. 그게 챔피언의 정신이지.'), 10);
SELECT public._story_seed_dialogue('champ_06_champion_night', 10,
  jsonb_build_object('speaker','오삼이','bgm_hint','warm',
    'body','챔피언 로드 — 6장이 끝났어요. 트로피보다 길게 남는 건 — 그날 코너에서 같이 떨었던 사람들의 얼굴이에요.'), 11);
SELECT public._story_seed_dialogue('champ_06_champion_night', 11,
  jsonb_build_object('speaker','강 관장','portrait','gwan',
    'body','잘했어. 가서 좀 자.'), 12);
SELECT public._story_seed_dialogue('champ_06_champion_night', 12,
  jsonb_build_object('speaker','김 코치','portrait','kim',
    'body','다음 캠프에서 뵙죠.'), 13);
SELECT public._story_seed_ending('champ_06_champion_night', 13,
  jsonb_build_object('ending_code','champion_spirit','title','챔피언의 정신','subtitle','트로피보다 길게 남는 마음',
    'cutscene_blocks', jsonb_build_array(
      jsonb_build_object('type','narration','body','체육관 문을 닫고 나오는 새벽 5시. 거리는 아직 어둡고, 차가운 공기가 글러브 냄새와 섞인다.','background','starfield'),
      jsonb_build_object('type','image_caption','speaker','오삼이','body','오늘도 한 라운드를 끝까지 뛰었어요. 트로피는 없어요. 하지만 그 마음은 — 평생 남아요.'),
      jsonb_build_object('type','image_caption','speaker','한 챔피언','body','내가 오늘 한 라운드를 뛴 이유는 — 어제의 내가 뛰었기 때문이야. 그게 챔피언의 정신이지.','background','sunrise'),
      jsonb_build_object('type','image_caption','speaker','강 관장','body','잘했어. 가서 좀 자.'),
      jsonb_build_object('type','image_caption','speaker','박 선배','body','수고했어요!'),
      jsonb_build_object('type','image_caption','speaker','민지','body','선배 짱!'),
      jsonb_build_object('type','image_caption','speaker','도훈','body','내일 또 봐.'),
      jsonb_build_object('type','image_caption','speaker','김 코치','body','다음 캠프에서 뵙죠.'),
      jsonb_build_object('type','narration','body','챔피언의 정신. 오늘 한 라운드를 끝까지 뛴 사람은 모두 자신의 챔피언입니다.','background','sunrise'),
      jsonb_build_object('type','credits','body','[엔딩: 챔피언의 정신] 보상: 스토리 XP +250, 링 코인 +400, 칭호 ''챔피언의 정신'', 카드 ''card_champion_spirit'', 배지 ''badge_champion'', 파이트 머니 +500 (최초 1회)')
    ),
    'reward_summary', jsonb_build_object(
      'story_xp',250,'ring_coins',400,'real_gems_first_time',500,
      'title','챔피언의 정신','card_code','card_champion_spirit','badge_code','badge_champion')));

-- =====================================================================
-- 9. 헬퍼 함수 정리 (시드 후 제거 — 마이그레이션 끝나면 더 필요 없음)
-- =====================================================================
DROP FUNCTION IF EXISTS public._story_seed_dialogue(text, integer, jsonb, integer);
DROP FUNCTION IF EXISTS public._story_seed_choice(text, integer, jsonb);
DROP FUNCTION IF EXISTS public._story_seed_battle(text, integer, jsonb, integer, integer);
DROP FUNCTION IF EXISTS public._story_seed_node_move(text, integer, jsonb, integer);
DROP FUNCTION IF EXISTS public._story_seed_ending(text, integer, jsonb);

-- ============================================================
-- VERIFY (Supabase SQL Editor 에서 별도 New query 로 실행)
-- ------------------------------------------------------------
-- 1) SELECT count(*) FROM public.boxing_story_scenes WHERE scope='prologue';     -- 4
-- 2) SELECT count(*) FROM public.boxing_story_scenes WHERE scope='chapter';      -- 172
-- 3) SELECT count(*) FROM public.boxing_story_scenes;                             -- 176
-- 4) SELECT count(*) FROM public.boxing_story_enemies;                            -- 11
-- 5) SELECT count(*) FROM public.boxing_story_cards;                              -- 9
-- 6) SELECT proname FROM pg_proc WHERE proname IN
--    ('start_story_session','progress_to_scene','apply_choice','start_battle',
--     'submit_player_command','claim_card_reward','complete_ending','reset_story_route')
--    ORDER BY proname;                                                             -- 8 rows
-- 7) SELECT chapter_id, count(*) FROM public.boxing_story_scenes WHERE scope='chapter'
--    GROUP BY chapter_id ORDER BY count(*) DESC;                                   -- 챕터당 8-14
-- 8) SELECT proname FROM pg_proc WHERE proname IN
--    ('sync_story_chapter_progress','claim_story_chapter_reward','_story_chapter_progress');
--    -- 0 rows (deprecated)
-- 9) SELECT scene_type, count(*) FROM public.boxing_story_scenes
--    GROUP BY scene_type ORDER BY scene_type;
--    -- battle 18 / choice ~25 / dialogue ~110 / ending 3 / node_move 18
-- ============================================================
