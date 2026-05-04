-- ============================================================
-- 153 스토리 RPG 기반 (단계 34)
-- ============================================================
-- 목적:
--   회원 캐릭터로 "복서의 길" 3루트(마스터/프로/챔피언) × 6챕터
--   = 18챕터를 진행하는 보조 게임 모드. 공식 1~40 마스터로드 시스템과
--   완전히 분리된다.
-- 보호 원칙:
--   - levels / missions / mission_videos / mission_submissions /
--     member_progress 테이블에 어떤 write 도 하지 않는다.
--   - approve_mission_submission / record_attendance 호출 금지.
--   - 공식 XP 미지급. member_progress 일절 미수정.
--   - 파이트 머니 지급은 반드시 public.grant_gems 경유.
--   - 진행도/카운트는 기존 boxing_engagement_* / boxing_quiz_attempts /
--     boxing_fun_challenge_attempts / champion_journal_entries / boxing_cheers
--     테이블을 read-only 로 소비한다.
--   - 챕터 보상 중복 차단: boxing_story_reward_claims.unique(user_id, chapter_id)
--     + boxing_engagement_events.unique(user_id, idempotency_key)
-- 권한 patterns:
--   has_role(auth.uid(), 'admin') / is_branch_manager_of(auth.uid(), target)
-- ============================================================

-- =====================================================================
-- 1. boxing_story_routes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_story_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text NOT NULL,
  route_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_story_routes_route_type_chk
    CHECK (route_type IN ('master','pro','champion'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_story_routes_active_sort
  ON public.boxing_story_routes (active, sort_order);

ALTER TABLE public.boxing_story_routes ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. boxing_story_nodes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_story_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  node_type text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_story_nodes_type_chk
    CHECK (node_type IN ('gym','mirror','rope','sandbag','ring','corner','hall','master_room','camp','rival_arena'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_story_nodes_active_sort
  ON public.boxing_story_nodes (active, sort_order);

ALTER TABLE public.boxing_story_nodes ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 3. boxing_story_chapters
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_story_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  chapter_number integer NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text NOT NULL,
  world_node_code text NOT NULL,
  obstacle_code text,
  unlock_condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_quest_xp integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  reward_title text,
  reward_card_code text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_story_chapters_route_chapter_unique UNIQUE (route_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_boxing_story_chapters_route
  ON public.boxing_story_chapters (route_id, chapter_number);

ALTER TABLE public.boxing_story_chapters ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. boxing_story_dialogues
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_story_dialogues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.boxing_story_chapters(id) ON DELETE CASCADE,
  speaker text NOT NULL DEFAULT '오삼이',
  dialogue_type text NOT NULL DEFAULT 'intro',
  body text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_story_dialogues_type_chk
    CHECK (dialogue_type IN ('intro','progress','complete','locked','reward','boss'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_story_dialogues_chapter
  ON public.boxing_story_dialogues (chapter_id, dialogue_type, sort_order);
CREATE INDEX IF NOT EXISTS idx_boxing_story_dialogues_route
  ON public.boxing_story_dialogues (route_id, dialogue_type, sort_order);

ALTER TABLE public.boxing_story_dialogues ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. boxing_user_story_progress
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_user_story_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  current_chapter_id uuid REFERENCES public.boxing_story_chapters(id) ON DELETE SET NULL,
  current_chapter_number integer NOT NULL DEFAULT 1,
  completed_chapter_count integer NOT NULL DEFAULT 0,
  route_completed boolean NOT NULL DEFAULT false,
  selected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_user_story_progress_user_route_unique UNIQUE (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_user_story_progress_user
  ON public.boxing_user_story_progress (user_id, updated_at DESC);

ALTER TABLE public.boxing_user_story_progress ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 6. boxing_user_story_route_state
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_user_story_route_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_route_id uuid REFERENCES public.boxing_story_routes(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boxing_user_story_route_state ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 7. boxing_story_reward_claims
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_story_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.boxing_story_routes(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.boxing_story_chapters(id) ON DELETE CASCADE,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  reward_title text,
  reward_card_code text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_story_reward_claims_user_chapter_unique UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_story_reward_claims_user
  ON public.boxing_story_reward_claims (user_id, claimed_at DESC);

ALTER TABLE public.boxing_story_reward_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- updated_at trigger (스토리 RPG 도메인 — 기존 트리거 재사용)
-- =====================================================================
DROP TRIGGER IF EXISTS trg_boxing_story_routes_updated_at
  ON public.boxing_story_routes;
CREATE TRIGGER trg_boxing_story_routes_updated_at
  BEFORE UPDATE ON public.boxing_story_routes
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_story_chapters_updated_at
  ON public.boxing_story_chapters;
CREATE TRIGGER trg_boxing_story_chapters_updated_at
  BEFORE UPDATE ON public.boxing_story_chapters
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

DROP TRIGGER IF EXISTS trg_boxing_user_story_progress_updated_at
  ON public.boxing_user_story_progress;
CREATE TRIGGER trg_boxing_user_story_progress_updated_at
  BEFORE UPDATE ON public.boxing_user_story_progress
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

CREATE OR REPLACE FUNCTION public.boxing_story_route_state_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boxing_user_story_route_state_updated_at
  ON public.boxing_user_story_route_state;
CREATE TRIGGER trg_boxing_user_story_route_state_updated_at
  BEFORE UPDATE ON public.boxing_user_story_route_state
  FOR EACH ROW EXECUTE FUNCTION public.boxing_story_route_state_set_updated_at();

-- =====================================================================
-- RLS 정책
-- =====================================================================

-- routes / chapters / nodes / dialogues : 회원은 active=true 만 SELECT, 관리자는 전체
DROP POLICY IF EXISTS "story_routes_select_active_or_admin" ON public.boxing_story_routes;
CREATE POLICY "story_routes_select_active_or_admin"
  ON public.boxing_story_routes FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_routes_admin_manage" ON public.boxing_story_routes;
CREATE POLICY "story_routes_admin_manage"
  ON public.boxing_story_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_chapters_select_active_or_admin" ON public.boxing_story_chapters;
CREATE POLICY "story_chapters_select_active_or_admin"
  ON public.boxing_story_chapters FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_chapters_admin_manage" ON public.boxing_story_chapters;
CREATE POLICY "story_chapters_admin_manage"
  ON public.boxing_story_chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_nodes_select_active_or_admin" ON public.boxing_story_nodes;
CREATE POLICY "story_nodes_select_active_or_admin"
  ON public.boxing_story_nodes FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_nodes_admin_manage" ON public.boxing_story_nodes;
CREATE POLICY "story_nodes_admin_manage"
  ON public.boxing_story_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_dialogues_select_active_or_admin" ON public.boxing_story_dialogues;
CREATE POLICY "story_dialogues_select_active_or_admin"
  ON public.boxing_story_dialogues FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "story_dialogues_admin_manage" ON public.boxing_story_dialogues;
CREATE POLICY "story_dialogues_admin_manage"
  ON public.boxing_story_dialogues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 회원 진행도/상태/보상 — 본인만 SELECT (insert/update 는 RPC 경유)
DROP POLICY IF EXISTS "story_user_progress_select_self_or_admin" ON public.boxing_user_story_progress;
CREATE POLICY "story_user_progress_select_self_or_admin"
  ON public.boxing_user_story_progress FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "story_user_route_state_select_self_or_admin" ON public.boxing_user_story_route_state;
CREATE POLICY "story_user_route_state_select_self_or_admin"
  ON public.boxing_user_story_route_state FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "story_reward_claims_select_self_or_admin" ON public.boxing_story_reward_claims;
CREATE POLICY "story_reward_claims_select_self_or_admin"
  ON public.boxing_story_reward_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- =====================================================================
-- SEED — story_nodes (10)
-- =====================================================================
INSERT INTO public.boxing_story_nodes (code, title, description, node_type, icon, sort_order)
VALUES
  ('gym_entrance', '체육관 입구', '오늘도 링이 열립니다. 모든 복서의 길은 이 문을 여는 것에서 시작합니다.', 'gym', 'door-open', 10),
  ('mirror_zone',  '거울 앞',     '나의 자세, 나의 호흡, 나의 표정을 마주하는 자리입니다.',                  'mirror', 'mirror', 20),
  ('rope_zone',    '줄넘기 존',   '리듬은 발에서 시작합니다. 가장 단순한 도구가 가장 정직합니다.',          'rope', 'activity', 30),
  ('sandbag_zone', '샌드백 존',   '맞지 않는 상대 앞에서 가장 정직한 펀치를 배웁니다.',                       'sandbag', 'package', 40),
  ('ring',         '링',          '실제로 움직이는 사람과 마주하는 자리. 합의된 규칙 안에서 성장합니다.',     'ring', 'square', 50),
  ('corner',       '코너',        '회복과 호흡과 작전을 다듬는 자리. 코너는 패배가 아니라 전략입니다.',       'corner', 'corner-down-right', 60),
  ('boxing_hall',  '복싱 전당',   '오늘의 한 라운드가 누군가에게 영감이 되는 곳.',                            'hall', 'star', 70),
  ('master_room',  '마스터룸',    '나만 잘하는 사람이 아니라 다른 사람을 안전하게 이끄는 사람의 자리.',       'master_room', 'graduation-cap', 80),
  ('fight_camp',   '파이트 캠프', '다음 시즌을 위해 자기 자신을 다듬는 집중 훈련 공간.',                      'camp', 'tent', 90),
  ('rival_arena',  '라이벌 아레나','어제의 나와, 그리고 비슷한 길을 걷는 동료와 마주하는 자리.',              'rival_arena', 'swords', 100)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  node_type = EXCLUDED.node_type,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- =====================================================================
-- SEED — story_routes (3)
-- =====================================================================
INSERT INTO public.boxing_story_routes (code, title, subtitle, description, route_type, sort_order)
VALUES
  ('master_path',
   '마스터의 길',
   '회원에서 복싱 지도자 후보로',
   '기본기를 익히고 후배를 도울 수 있는 복싱 리더로 성장하는 서사입니다. 잘 치는 사람보다, 안전하게 이끄는 사람이 되는 길.',
   'master', 10),
  ('pro_path',
   '프로의 길',
   '회원에서 프로복서 루틴 후보로',
   '취미로 시작해 선수처럼 루틴을 완성하는 도전 서사입니다. 매일 같은 자리에 서는 사람이 가장 무서운 복서입니다.',
   'pro', 20),
  ('champion_road',
   '챔피언 로드',
   '회원에서 챔피언의 정신으로',
   '어제의 나와 겨루고 시즌을 완주하며 챔피언의 정신을 완성하는 서사입니다. 우승은 결과이고, 챔피언의 마음은 매일의 선택입니다.',
   'champion', 30)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  route_type = EXCLUDED.route_type,
  sort_order = EXCLUDED.sort_order;

-- =====================================================================
-- SEED — story_chapters (18)
-- 보상 가이드: 챕터 +50~200 QUEST XP / +100~500 파이트 머니
-- completion_condition jsonb 스키마:
--   {
--     "quiz_correct_total": int,        -- boxing_quiz_attempts 정답 누적
--     "challenge_clear_total": int,     -- boxing_fun_challenge_attempts 'completed' 누적
--     "journal_total": int,             -- champion_journal_entries 누적
--     "cheer_sent_total": int,          -- boxing_cheers 보낸 횟수 누적
--     "engagement_quest_xp": int,       -- boxing_engagement_profiles.quest_xp 임계
--     "active_route_required": bool     -- 해당 route 가 active 일 때만 카운트
--   }
-- (sync_story_chapter_progress 가 이 구조를 읽어 진행률 판정)
-- =====================================================================

-- ----- master_path ------------------------------------------------------
INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code,
   unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id,
       'master_01_first_glove', 1,
       '첫 글러브',
       '체육관 입구',
       '오늘 처음 글러브를 낀 마음을 잊지 않는 챕터. 시작은 작아도 좋습니다.',
       'gym_entrance', 'lazy_slime',
       '{}'::jsonb,
       jsonb_build_object('journal_total', 1, 'active_route_required', true),
       60, 150, '첫 글러브', 'card_first_glove'
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description, world_node_code = EXCLUDED.world_node_code,
  obstacle_code = EXCLUDED.obstacle_code,
  completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems,
  reward_title = EXCLUDED.reward_title, reward_card_code = EXCLUDED.reward_card_code;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'master_02_basic_wall', 2,
       '기본기의 벽', '거울 앞',
       '거울 앞에서 같은 자세를 반복합니다. 기본기는 화려하지 않지만 가장 무서운 무기입니다.',
       'mirror_zone', 'guard_breaker',
       '{}'::jsonb,
       jsonb_build_object('quiz_correct_total', 3, 'challenge_clear_total', 1, 'active_route_required', true),
       80, 200, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, world_node_code = EXCLUDED.world_node_code,
  obstacle_code = EXCLUDED.obstacle_code,
  completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'master_03_repeat_room', 3,
       '반복의 방', '샌드백 존',
       '같은 동작을 다시. 그리고 또 다시. 반복은 지루함이 아니라 신뢰입니다.',
       'sandbag_zone', 'excuse_goblin',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 3, 'journal_total', 2, 'active_route_required', true),
       100, 250, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'master_04_new_member', 4,
       '후배의 등장', '코너',
       '신입 회원이 들어옵니다. 내가 받았던 도움을 내가 줄 차례입니다.',
       'corner', 'compare_monster',
       '{}'::jsonb,
       jsonb_build_object('cheer_sent_total', 3, 'engagement_quest_xp', 200, 'active_route_required', true),
       120, 300, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'master_05_trainer_eye', 5,
       '지도자의 눈', '거울 앞',
       '평가가 아니라 안전. 지도자의 눈은 다른 사람을 다치지 않게 보는 눈입니다.',
       'mirror_zone', 'overtrain_golem',
       '{}'::jsonb,
       jsonb_build_object('quiz_correct_total', 10, 'journal_total', 5, 'cheer_sent_total', 5, 'active_route_required', true),
       150, 400, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'master_06_master_test', 6,
       '마스터 테스트', '마스터룸',
       '내가 가르친 동작을 내가 다시 받는 자리. 마스터의 길의 마지막 관문.',
       'master_room', 'quit_demon',
       '{}'::jsonb,
       jsonb_build_object('engagement_quest_xp', 500, 'journal_total', 7, 'cheer_sent_total', 7, 'active_route_required', true),
       200, 500, '마스터 후보', 'card_master_candidate'
FROM public.boxing_story_routes r WHERE r.code = 'master_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems,
  reward_title = EXCLUDED.reward_title, reward_card_code = EXCLUDED.reward_card_code;

-- ----- pro_path ---------------------------------------------------------
INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_01_hobby_start', 1,
       '취미반의 시작', '체육관 입구',
       '복싱은 거창한 결심으로 시작되지 않습니다. 그냥 오늘 한 번 가본 사람이 시작한 것입니다.',
       'gym_entrance', 'lazy_slime',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 1, 'active_route_required', true),
       60, 150, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_02_routine_birth', 2,
       '루틴의 탄생', '줄넘기 존',
       '리듬이 생기면 흔들리지 않습니다. 매일 같은 시간에 같은 자리에 서는 일이 가장 위대합니다.',
       'rope_zone', 'excuse_goblin',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 3, 'active_route_required', true),
       80, 200, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_03_first_spar_tension', 3,
       '첫 스파링의 긴장', '링',
       '심장이 빠르게 뜁니다. 도망가고 싶은 마음과 한 라운드만 해보자는 마음이 부딪힙니다.',
       'ring', 'tense_wolf',
       '{}'::jsonb,
       jsonb_build_object('quiz_correct_total', 3, 'journal_total', 2, 'active_route_required', true),
       100, 250, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_04_stamina_wall', 4,
       '체력의 벽', '샌드백 존',
       '3라운드 후 다리가 풀립니다. 벽 앞에서 한 발 더 가는 사람을 우리는 복서라 부릅니다.',
       'sandbag_zone', 'breath_holder',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 5, 'active_route_required', true),
       120, 300, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_05_my_style', 5,
       '나의 스타일', '거울 앞',
       '교과서 같은 폼이 아니라 내 몸이 만든 폼. 나만의 거리, 나만의 박자, 나만의 한 방.',
       'mirror_zone', 'compare_monster',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 5, 'quiz_correct_total', 10, 'active_route_required', true),
       150, 400, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'pro_06_pro_routine_test', 6,
       '프로 루틴 테스트', '링',
       '오늘 컨디션이 나빠도 같은 루틴을 그대로 수행하는 사람. 그게 프로의 정의입니다.',
       'ring', 'overtrain_golem',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 8, 'journal_total', 4, 'engagement_quest_xp', 500, 'active_route_required', true),
       200, 500, '프로 루틴 후보', 'card_pro_routine'
FROM public.boxing_story_routes r WHERE r.code = 'pro_path'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems,
  reward_title = EXCLUDED.reward_title, reward_card_code = EXCLUDED.reward_card_code;

-- ----- champion_road ----------------------------------------------------
INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_01_contender_gate', 1,
       '도전자의 문', '체육관 입구',
       '챔피언이 되는 사람은 처음부터 챔피언이 아니었습니다. 도전자의 문을 여는 마음이 시작입니다.',
       'gym_entrance', 'tense_wolf',
       '{}'::jsonb,
       jsonb_build_object('quiz_correct_total', 1, 'challenge_clear_total', 1, 'active_route_required', true),
       60, 150, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_02_shadow_boxer', 2,
       '그림자 복서', '거울 앞',
       '오늘의 상대는 어제의 나입니다. 가장 정직한 라이벌은 거울 안에 있습니다.',
       'mirror_zone', 'compare_monster',
       '{}'::jsonb,
       jsonb_build_object('engagement_quest_xp', 200, 'challenge_clear_total', 3, 'active_route_required', true),
       80, 200, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_03_rival_match', 3,
       '라이벌 매칭', '라이벌 아레나',
       '비슷한 길을 걷는 동료를 찾습니다. 라이벌은 적이 아니라 함께 자라는 거울입니다.',
       'rival_arena', 'tense_wolf',
       '{}'::jsonb,
       jsonb_build_object('cheer_sent_total', 5, 'challenge_clear_total', 4, 'active_route_required', true),
       100, 250, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_04_fight_camp', 4,
       '파이트 캠프', '파이트 캠프',
       '시즌을 앞두고 모든 것을 다듬는 시간. 가장 외롭고 가장 단단해지는 구간.',
       'fight_camp', 'overtrain_golem',
       '{}'::jsonb,
       jsonb_build_object('challenge_clear_total', 5, 'journal_total', 4, 'active_route_required', true),
       130, 350, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_05_last_round', 5,
       '마지막 라운드', '링',
       '체력은 바닥, 시간은 1분. 그래도 한 라운드 더. 이 한 발이 챔피언의 정신입니다.',
       'ring', 'quit_demon',
       '{}'::jsonb,
       jsonb_build_object('journal_total', 7, 'engagement_quest_xp', 400, 'active_route_required', true),
       160, 450, NULL, NULL
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems;

INSERT INTO public.boxing_story_chapters
  (route_id, code, chapter_number, title, subtitle, description,
   world_node_code, obstacle_code, unlock_condition, completion_condition,
   reward_quest_xp, reward_gems, reward_title, reward_card_code)
SELECT r.id, 'champ_06_champion_night', 6,
       '챔피언 나이트', '복싱 전당',
       '오늘 한 라운드를 끝까지 뛴 사람은 모두 자신의 챔피언입니다. 트로피보다 그 마음이 길게 남습니다.',
       'boxing_hall', NULL,
       '{}'::jsonb,
       jsonb_build_object('engagement_quest_xp', 800, 'journal_total', 10, 'cheer_sent_total', 8, 'active_route_required', true),
       200, 500, '챔피언의 정신', 'card_champion_spirit'
FROM public.boxing_story_routes r WHERE r.code = 'champion_road'
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description, completion_condition = EXCLUDED.completion_condition,
  reward_quest_xp = EXCLUDED.reward_quest_xp, reward_gems = EXCLUDED.reward_gems,
  reward_title = EXCLUDED.reward_title, reward_card_code = EXCLUDED.reward_card_code;

-- =====================================================================
-- SEED — 오삼이 dialogue (intro × 18, 자체 카피)
-- =====================================================================
WITH chapters AS (
  SELECT id, code FROM public.boxing_story_chapters
)
INSERT INTO public.boxing_story_dialogues
  (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT
  c2.route_id,
  c.id,
  '오삼이',
  'intro',
  d.body,
  10
FROM chapters c
JOIN public.boxing_story_chapters c2 ON c2.id = c.id
JOIN (VALUES
  ('master_01_first_glove', '처음 글러브를 낀 날, 모든 동작은 어색합니다. 하지만 복싱은 완벽한 시작이 아니라 반복으로 만들어집니다.'),
  ('master_02_basic_wall',  '거울 앞에서 같은 자세를 반복합니다. 화려하지 않아도 됩니다. 정직하면 됩니다.'),
  ('master_03_repeat_room', '오늘도 같은 동작입니다. 지루함을 견디는 사람이 결국 정확한 사람이 됩니다.'),
  ('master_04_new_member',  '오늘 처음 온 회원이 보입니다. 내가 받았던 한마디를 내가 줄 차례입니다.'),
  ('master_05_trainer_eye', '지도자의 눈은 평가하는 눈이 아닙니다. 다른 사람을 다치지 않게 보는 눈입니다.'),
  ('master_06_master_test', '내가 가르친 자세를 내가 다시 받습니다. 마스터는 잘하는 사람이 아니라 안전하게 이끄는 사람입니다.'),

  ('pro_01_hobby_start',     '오늘도 링이 열렸습니다. 거창한 결심은 필요 없습니다. 한 번 와보면 됩니다.'),
  ('pro_02_routine_birth',   '리듬은 발에서 시작합니다. 매일 같은 자리에 서는 일이 가장 위대합니다.'),
  ('pro_03_first_spar_tension', '심장이 빠르게 뜁니다. 도망가고 싶어도 괜찮습니다. 한 라운드만 해봅시다.'),
  ('pro_04_stamina_wall',    '3라운드 후 다리가 풀립니다. 벽 앞에서 한 발 더. 그게 복서의 정의입니다.'),
  ('pro_05_my_style',        '교과서 같은 폼이 아니라 내 몸이 만든 폼. 나만의 거리와 나만의 박자가 생깁니다.'),
  ('pro_06_pro_routine_test', '컨디션이 나빠도 같은 루틴을 수행하는 사람. 그게 프로입니다.'),

  ('champ_01_contender_gate', '챔피언은 처음부터 챔피언이 아니었습니다. 도전자의 문을 여는 마음이 시작입니다.'),
  ('champ_02_shadow_boxer',   '오늘의 상대는 어제의 나입니다. 가장 정직한 라이벌은 거울 안에 있습니다.'),
  ('champ_03_rival_match',    '비슷한 길을 걷는 동료가 있습니다. 라이벌은 적이 아니라 함께 자라는 거울입니다.'),
  ('champ_04_fight_camp',     '시즌을 앞두고 모든 것을 다듬는 시간입니다. 외롭지만 단단해지는 구간입니다.'),
  ('champ_05_last_round',     '체력은 바닥, 시간은 1분. 그래도 한 라운드 더. 이 한 발이 챔피언의 정신입니다.'),
  ('champ_06_champion_night', '오늘 한 라운드를 끝까지 뛴 사람은 모두 자신의 챔피언입니다. 트로피보다 그 마음이 길게 남습니다.')
) AS d(code, body) ON d.code = c.code
ON CONFLICT DO NOTHING;

-- =====================================================================
-- RPC A. get_my_story_rpg_state()
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_my_story_rpg_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active_route_id uuid;
  v_routes jsonb;
  v_chapters jsonb;
  v_nodes jsonb;
  v_dialogues jsonb;
  v_progress jsonb;
  v_claims jsonb;
  v_official jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- active route 조회 (없을 수 있음)
  SELECT active_route_id INTO v_active_route_id
  FROM public.boxing_user_story_route_state
  WHERE user_id = v_uid;

  -- routes
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order), '[]'::jsonb)
  INTO v_routes
  FROM public.boxing_story_routes r WHERE r.active = true;

  -- chapters
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.chapter_number), '[]'::jsonb)
  INTO v_chapters
  FROM public.boxing_story_chapters c WHERE c.active = true;

  -- nodes
  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.sort_order), '[]'::jsonb)
  INTO v_nodes
  FROM public.boxing_story_nodes n WHERE n.active = true;

  -- dialogues
  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.sort_order), '[]'::jsonb)
  INTO v_dialogues
  FROM public.boxing_story_dialogues d WHERE d.active = true;

  -- 사용자 progress (모든 route)
  SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  INTO v_progress
  FROM public.boxing_user_story_progress p WHERE p.user_id = v_uid;

  -- 보상 claim 기록
  SELECT COALESCE(jsonb_agg(to_jsonb(rc)), '[]'::jsonb)
  INTO v_claims
  FROM public.boxing_story_reward_claims rc WHERE rc.user_id = v_uid;

  -- 공식 리그/레벨 read-only summary (member_progress 미수정 — SELECT only)
  SELECT to_jsonb(mp) INTO v_official
  FROM public.member_progress mp WHERE mp.user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'active_route_id', v_active_route_id,
    'routes', v_routes,
    'chapters', v_chapters,
    'nodes', v_nodes,
    'dialogues', v_dialogues,
    'progress', v_progress,
    'reward_claims', v_claims,
    'official_summary', v_official
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_story_rpg_state() TO authenticated;

-- =====================================================================
-- RPC B. choose_story_route(p_route_code)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.choose_story_route(p_route_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route public.boxing_story_routes%ROWTYPE;
  v_first_chapter public.boxing_story_chapters%ROWTYPE;
  v_progress_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_route FROM public.boxing_story_routes
  WHERE code = p_route_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'route not available'; END IF;

  -- 첫 챕터 (chapter_number = 1)
  SELECT * INTO v_first_chapter FROM public.boxing_story_chapters
  WHERE route_id = v_route.id AND chapter_number = 1 AND active = true
  LIMIT 1;

  -- progress upsert (기존 있으면 보존)
  INSERT INTO public.boxing_user_story_progress
    (user_id, route_id, current_chapter_id, current_chapter_number)
  VALUES
    (v_uid, v_route.id, v_first_chapter.id, 1)
  ON CONFLICT (user_id, route_id) DO NOTHING
  RETURNING id INTO v_progress_id;

  -- active route state
  INSERT INTO public.boxing_user_story_route_state (user_id, active_route_id)
  VALUES (v_uid, v_route.id)
  ON CONFLICT (user_id) DO UPDATE SET
    active_route_id = EXCLUDED.active_route_id,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'route_id', v_route.id,
    'route_code', v_route.code,
    'first_chapter_id', v_first_chapter.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.choose_story_route(text) TO authenticated;

-- =====================================================================
-- RPC C. change_story_route(p_route_code)
--   기존 진행도 보존, active route 만 변경. progress 없으면 생성.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.change_story_route(p_route_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route public.boxing_story_routes%ROWTYPE;
  v_first_chapter public.boxing_story_chapters%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_route FROM public.boxing_story_routes
  WHERE code = p_route_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'route not available'; END IF;

  SELECT * INTO v_first_chapter FROM public.boxing_story_chapters
  WHERE route_id = v_route.id AND chapter_number = 1 AND active = true
  LIMIT 1;

  -- progress 가 없을 때만 생성 (있으면 보존)
  INSERT INTO public.boxing_user_story_progress
    (user_id, route_id, current_chapter_id, current_chapter_number)
  VALUES
    (v_uid, v_route.id, v_first_chapter.id, 1)
  ON CONFLICT (user_id, route_id) DO NOTHING;

  -- active route 만 변경
  INSERT INTO public.boxing_user_story_route_state (user_id, active_route_id)
  VALUES (v_uid, v_route.id)
  ON CONFLICT (user_id) DO UPDATE SET
    active_route_id = EXCLUDED.active_route_id,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'route_id', v_route.id,
    'route_code', v_route.code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_story_route(text) TO authenticated;

-- =====================================================================
-- helper: 챕터 completion_condition 충족 여부 + 진행률 계산
--   기존 read-only 데이터 소스만 사용. member_progress / missions / levels
--   는 절대 수정하지 않는다.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._story_chapter_progress(
  p_user_id uuid,
  p_chapter public.boxing_story_chapters,
  p_active_route_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cond jsonb := COALESCE(p_chapter.completion_condition, '{}'::jsonb);
  v_active_required boolean := COALESCE((v_cond->>'active_route_required')::boolean, false);
  v_quiz_required int := COALESCE((v_cond->>'quiz_correct_total')::int, 0);
  v_chal_required int := COALESCE((v_cond->>'challenge_clear_total')::int, 0);
  v_journal_required int := COALESCE((v_cond->>'journal_total')::int, 0);
  v_cheer_required int := COALESCE((v_cond->>'cheer_sent_total')::int, 0);
  v_xp_required int := COALESCE((v_cond->>'engagement_quest_xp')::int, 0);

  v_quiz_count int := 0;
  v_chal_count int := 0;
  v_journal_count int := 0;
  v_cheer_count int := 0;
  v_engagement_xp int := 0;

  v_required_total int;
  v_have_total int;
  v_complete boolean := true;
BEGIN
  -- active route 미일치면 잠금 — 단 chapter 의 route 가 현재 active route 면 진행 가능
  IF v_active_required AND (p_active_route_id IS NULL OR p_active_route_id <> p_chapter.route_id) THEN
    RETURN jsonb_build_object(
      'complete', false,
      'locked_by_active_route', true,
      'progress', jsonb_build_object()
    );
  END IF;

  IF v_quiz_required > 0 THEN
    SELECT COUNT(*) INTO v_quiz_count FROM public.boxing_quiz_attempts
    WHERE user_id = p_user_id AND is_correct = true;
    IF v_quiz_count < v_quiz_required THEN v_complete := false; END IF;
  END IF;

  IF v_chal_required > 0 THEN
    SELECT COUNT(*) INTO v_chal_count FROM public.boxing_fun_challenge_attempts
    WHERE user_id = p_user_id AND status = 'completed';
    IF v_chal_count < v_chal_required THEN v_complete := false; END IF;
  END IF;

  IF v_journal_required > 0 THEN
    SELECT COUNT(*) INTO v_journal_count FROM public.champion_journal_entries
    WHERE user_id = p_user_id;
    IF v_journal_count < v_journal_required THEN v_complete := false; END IF;
  END IF;

  IF v_cheer_required > 0 THEN
    SELECT COUNT(*) INTO v_cheer_count FROM public.boxing_cheers
    WHERE sender_user_id = p_user_id;
    IF v_cheer_count < v_cheer_required THEN v_complete := false; END IF;
  END IF;

  IF v_xp_required > 0 THEN
    SELECT COALESCE(quest_xp, 0) INTO v_engagement_xp
    FROM public.boxing_engagement_profiles WHERE user_id = p_user_id;
    IF v_engagement_xp < v_xp_required THEN v_complete := false; END IF;
  END IF;

  -- 단일 진행률 (모든 조건 합산 정규화)
  v_required_total := v_quiz_required + v_chal_required + v_journal_required + v_cheer_required + v_xp_required;
  v_have_total := LEAST(v_quiz_count, v_quiz_required)
                + LEAST(v_chal_count, v_chal_required)
                + LEAST(v_journal_count, v_journal_required)
                + LEAST(v_cheer_count, v_cheer_required)
                + LEAST(v_engagement_xp, v_xp_required);

  RETURN jsonb_build_object(
    'complete', v_complete,
    'locked_by_active_route', false,
    'required_total', v_required_total,
    'have_total', v_have_total,
    'progress', jsonb_build_object(
      'quiz_correct_total',    jsonb_build_object('have', v_quiz_count,    'need', v_quiz_required),
      'challenge_clear_total', jsonb_build_object('have', v_chal_count,    'need', v_chal_required),
      'journal_total',         jsonb_build_object('have', v_journal_count, 'need', v_journal_required),
      'cheer_sent_total',      jsonb_build_object('have', v_cheer_count,   'need', v_cheer_required),
      'engagement_quest_xp',   jsonb_build_object('have', v_engagement_xp, 'need', v_xp_required)
    )
  );
END;
$$;

-- =====================================================================
-- RPC D. sync_story_chapter_progress(p_route_code)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_story_chapter_progress(p_route_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active_route_id uuid;
  v_route public.boxing_story_routes%ROWTYPE;
  v_chapter public.boxing_story_chapters%ROWTYPE;
  v_completed_count int := 0;
  v_current_number int := 1;
  v_current_id uuid;
  v_completed boolean;
  v_route_done boolean := false;
  v_progress_summary jsonb := '[]'::jsonb;
  v_p jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT active_route_id INTO v_active_route_id
  FROM public.boxing_user_story_route_state WHERE user_id = v_uid;

  SELECT * INTO v_route FROM public.boxing_story_routes
  WHERE code = p_route_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'route not available'; END IF;

  -- 현재 active 와 다른 route 면 동기화는 가능하지만 active_route_required 충족은 막힘
  FOR v_chapter IN
    SELECT * FROM public.boxing_story_chapters
    WHERE route_id = v_route.id AND active = true
    ORDER BY chapter_number
  LOOP
    v_p := public._story_chapter_progress(v_uid, v_chapter, v_active_route_id);
    v_completed := COALESCE((v_p->>'complete')::boolean, false);

    v_progress_summary := v_progress_summary || jsonb_build_object(
      'chapter_id', v_chapter.id,
      'chapter_code', v_chapter.code,
      'chapter_number', v_chapter.chapter_number,
      'complete', v_completed,
      'detail', v_p
    );

    IF v_completed THEN
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;

  v_current_number := LEAST(v_completed_count + 1, 6);
  SELECT id INTO v_current_id FROM public.boxing_story_chapters
  WHERE route_id = v_route.id AND chapter_number = v_current_number AND active = true
  LIMIT 1;

  v_route_done := (v_completed_count >= 6);

  -- progress 행이 없으면 생성
  INSERT INTO public.boxing_user_story_progress
    (user_id, route_id, current_chapter_id, current_chapter_number,
     completed_chapter_count, route_completed, last_synced_at)
  VALUES
    (v_uid, v_route.id, v_current_id, v_current_number,
     v_completed_count, v_route_done, now())
  ON CONFLICT (user_id, route_id) DO UPDATE SET
    current_chapter_id = EXCLUDED.current_chapter_id,
    current_chapter_number = EXCLUDED.current_chapter_number,
    completed_chapter_count = EXCLUDED.completed_chapter_count,
    route_completed = EXCLUDED.route_completed,
    last_synced_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'route_code', v_route.code,
    'completed_chapter_count', v_completed_count,
    'current_chapter_number', v_current_number,
    'route_completed', v_route_done,
    'chapters', v_progress_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_story_chapter_progress(text) TO authenticated;

-- =====================================================================
-- RPC E. claim_story_chapter_reward(p_chapter_id)
--   - 조건 충족 + 미수령 시 보상 지급
--   - 파이트 머니는 grant_gems 경유
--   - boxing_engagement_events 에 idempotency_key 로 중복 차단
--   - 공식 XP / member_progress / missions 일절 미수정
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_story_chapter_reward(p_chapter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chapter public.boxing_story_chapters%ROWTYPE;
  v_active_route_id uuid;
  v_progress_check jsonb;
  v_already_claimed boolean;
  v_idem text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_chapter FROM public.boxing_story_chapters
  WHERE id = p_chapter_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'chapter not available'; END IF;

  SELECT active_route_id INTO v_active_route_id
  FROM public.boxing_user_story_route_state WHERE user_id = v_uid;

  -- 이미 수령?
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_story_reward_claims
    WHERE user_id = v_uid AND chapter_id = p_chapter_id
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'quest_xp_granted', 0,
      'gems_granted', 0
    );
  END IF;

  -- 조건 충족 여부 확인
  v_progress_check := public._story_chapter_progress(v_uid, v_chapter, v_active_route_id);
  IF NOT COALESCE((v_progress_check->>'complete')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'chapter not complete',
      'detail', v_progress_check
    );
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  -- claim 기록 (unique 제약으로 중복 차단)
  INSERT INTO public.boxing_story_reward_claims
    (user_id, route_id, chapter_id,
     quest_xp_granted, gems_granted, reward_title, reward_card_code)
  VALUES
    (v_uid, v_chapter.route_id, v_chapter.id,
     v_chapter.reward_quest_xp, v_chapter.reward_gems,
     v_chapter.reward_title, v_chapter.reward_card_code)
  ON CONFLICT (user_id, chapter_id) DO NOTHING;

  -- engagement event 원장 + idempotency
  v_idem := 'story_rpg_chapter:' || v_chapter.id::text;

  INSERT INTO public.boxing_engagement_events
    (user_id, event_type, source_type, source_id, action,
     quest_xp_delta, gems_delta, idempotency_key, metadata)
  VALUES
    (v_uid, 'story_rpg_reward', 'boxing_story_chapter', v_chapter.id, 'chapter_clear',
     v_chapter.reward_quest_xp, v_chapter.reward_gems, v_idem,
     jsonb_build_object(
       'chapter_code', v_chapter.code,
       'route_id', v_chapter.route_id,
       'reward_title', v_chapter.reward_title,
       'reward_card_code', v_chapter.reward_card_code
     ))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- QUEST XP 누적 (engagement profile)
  UPDATE public.boxing_engagement_profiles
  SET quest_xp = quest_xp + v_chapter.reward_quest_xp
  WHERE user_id = v_uid;

  -- 파이트 머니 — grant_gems 경유 (직접 update 금지)
  IF v_chapter.reward_gems > 0 THEN
    PERFORM public.grant_gems(
      v_uid,
      v_chapter.reward_gems,
      concat('스토리 RPG: ', v_chapter.title)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'quest_xp_granted', v_chapter.reward_quest_xp,
    'gems_granted', v_chapter.reward_gems,
    'reward_title', v_chapter.reward_title,
    'reward_card_code', v_chapter.reward_card_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_story_chapter_reward(uuid) TO authenticated;

-- ============================================================
-- VERIFY (Supabase SQL Editor 에서 수동 확인)
-- ------------------------------------------------------------
-- 1) SELECT count(*) FROM public.boxing_story_routes;        -- expect 3
-- 2) SELECT count(*) FROM public.boxing_story_chapters;      -- expect 18
-- 3) SELECT count(*) FROM public.boxing_story_nodes;         -- expect 10
-- 4) SELECT count(*) FROM public.boxing_story_dialogues;     -- expect ≥18
-- 5) SELECT proname FROM pg_proc
--    WHERE proname IN ('get_my_story_rpg_state','choose_story_route',
--                      'change_story_route','sync_story_chapter_progress',
--                      'claim_story_chapter_reward')
--    ORDER BY proname;                                       -- expect 5
-- 6) member_progress / levels / missions / mission_submissions DDL/DML 변동 0 (이 migration 안에 write 없음)
-- ============================================================
