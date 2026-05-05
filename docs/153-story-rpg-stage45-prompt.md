# 153 스토리 RPG — Stage 45 프롬프트 (DB 재설계 + RPC + Seed)

> Claude Code 에 그대로 복붙. **새 migration 1개 생성** + **Stage 44 시나리오 → SQL seed 변환**.

---

## 사용법

1. Claude Code 열기
2. 아래 코드 블록 전체 복사
3. 붙여넣기 → 실행 (~3-4시간 소요, 테이블 + RPC + 176+ 씬 seed 생성)
4. 새 migration 파일 생성됨
5. PowerShell 클립보드 명령 → Supabase SQL Editor 수동 실행
6. 검증 SQL → 씬/적/카드 row 수 확인
7. git commit + push

---

## Stage 45 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 독립형 게임 모드의 DB 기반과 RPC 를 구축하는 시니어 Supabase/Postgres 개발자다.

이번 작업은 45단계다.
목표:
1. 신규 7 테이블 생성 (boxing_story_scenes, boxing_story_enemies, boxing_story_cards, boxing_story_inventory, boxing_user_player_stats, boxing_user_scene_progress, boxing_story_ending_claims)
2. 신규 8 RPC 작성
3. Stage 44 시나리오 (docs/153-story-rpg-game-scenario.md 약 2,129라인) 을 읽고 → INSERT seed 로 변환
4. 운동 의존성 RPC 3개 deprecated 처리 (sync_story_chapter_progress, claim_story_chapter_reward, _story_chapter_progress)
5. 기존 boxing_story_routes / chapters / nodes / dialogues 는 유지

생성 파일: supabase/migrations/YYYYMMDDHHMMSS_boxing_story_rpg_independent_game.sql
(timestamp 마지막 migration 20260706000000 보다 단조 증가)

가장 중요한 보호 원칙:
1. levels / missions / mission_videos / mission_submissions / member_progress 절대 미수정.
2. approve_mission_submission / record_attendance 호출 금지.
3. 공식 XP 미지급. member_progress 일절 미수정.
4. 파이트 머니는 grant_gems RPC 경유 (직접 wallet update 금지).
5. 새 RPC 도 SECURITY DEFINER + search_path 'public' 패턴 유지.

절대 수정 금지:
- levels / missions / mission_videos / mission_submissions / member_progress
- approve_mission_submission / record_attendance / useManualLevelUp / usePassBossBattle
- MissionsPage / RankUpPage / ChatAssistant / chat-assistant Edge Function
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- allLevelsData / whiteLevel1Data / sharedConstants 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정 금지
- 기존 boxing_story_routes / boxing_story_chapters / boxing_story_nodes / boxing_story_dialogues 테이블 schema 변경 금지 (콘텐츠는 유지)

═══════════════════════════════════════════════════════════════════
0. 먼저 할 일
═══════════════════════════════════════════════════════════════════

1. supabase/migrations 폴더의 마지막 migration 파일명 확인
2. docs/153-story-rpg-game-scenario.md 파일 전체 읽기 (Read 도구 사용, 2,129라인)
3. 기존 boxing_story_routes / chapters 의 id, code 매핑 파악 (UUID 가 시드 시점에 결정되어 있어야 chapter_id FK 사용 가능 — chapter.code 기준 SELECT 로 join)
4. grant_gems RPC 시그니처 확인 (이전 단계 코드 참고)
5. has_role / is_branch_manager_of helper 시그니처 확인

═══════════════════════════════════════════════════════════════════
1. 신규 테이블 7개
═══════════════════════════════════════════════════════════════════

A. boxing_story_scenes — 게임 씬 (시나리오 단위)
   id uuid PK DEFAULT gen_random_uuid()
   scope text NOT NULL DEFAULT 'chapter' CHECK IN ('prologue', 'chapter')
   route_id uuid REFERENCES boxing_story_routes(id) ON DELETE CASCADE  -- prologue 는 NULL, chapter 씬도 chapter.route_id 와 일치
   chapter_id uuid REFERENCES boxing_story_chapters(id) ON DELETE CASCADE  -- prologue 는 NULL
   scene_index integer NOT NULL  -- 챕터 내 0,1,2,...; prologue 는 0..3
   scene_type text NOT NULL CHECK IN ('dialogue', 'choice', 'battle', 'node_move', 'ending')
   payload jsonb NOT NULL DEFAULT '{}'::jsonb
   next_scene_index integer  -- dialogue/node_move 는 단순. choice/battle 은 NULL (payload 안에 분기)
   next_scene_victory integer  -- battle 전용
   next_scene_defeat integer   -- battle 전용
   active boolean NOT NULL DEFAULT true
   metadata jsonb NOT NULL DEFAULT '{}'::jsonb
   created_at, updated_at

   UNIQUE (chapter_id, scene_index) WHERE chapter_id IS NOT NULL
   UNIQUE (scope, scene_index) WHERE scope = 'prologue'

   INDEX (chapter_id, scene_index)
   INDEX (route_id, scope)

   payload 스키마 (scene_type 별):
   · dialogue: { speaker, body, portrait?, bgm_hint? }
   · choice:   { prompt, speaker?, choices: [{label, hint?, stat_changes?, inventory_grants?, next_scene}] }
   · battle:   { enemy_code, intro_line?, victory_line?, defeat_line?, reward_override? }
   · node_move:{ from_node_code, to_node_code, transition_message?, animation_hint? }
   · ending:   { ending_code, title, subtitle, cutscene_blocks: [...], reward_summary: {...} }

B. boxing_story_enemies — 적 마스터 데이터
   code text PK  -- 'lazy_slime', 'master_door', etc.
   name text NOT NULL
   description text
   hp integer NOT NULL DEFAULT 50
   attack integer NOT NULL DEFAULT 5
   defense integer NOT NULL DEFAULT 0
   pattern_code text NOT NULL  -- 'random_sleep_50', 'mirror_attack', etc.
   pattern_metadata jsonb DEFAULT '{}'::jsonb  -- 패턴별 추가 파라미터
   weakness jsonb DEFAULT '{}'::jsonb  -- {jab: false, counter: true, ...}
   reward_story_xp integer DEFAULT 0
   reward_ring_coins integer DEFAULT 0
   reward_card_code text
   is_boss boolean DEFAULT false
   active boolean DEFAULT true
   metadata jsonb DEFAULT '{}'::jsonb
   created_at, updated_at

C. boxing_story_cards — 스토리 카드 마스터
   code text PK
   name text NOT NULL
   description text NOT NULL
   effect_code text  -- 'damage_boost_20', 'next_jab_x3', 'invincible_1turn', 'cosmetic'
   effect_metadata jsonb DEFAULT '{}'::jsonb
   is_consumable boolean DEFAULT true  -- false 면 장식 카드
   rarity text DEFAULT 'common'  -- common/rare/epic/ending
   active boolean DEFAULT true
   metadata jsonb DEFAULT '{}'::jsonb
   created_at

D. boxing_story_inventory — 회원별 카드 보유
   id uuid PK
   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
   card_code text REFERENCES boxing_story_cards(code) ON DELETE CASCADE
   count integer NOT NULL DEFAULT 1
   first_acquired_at timestamptz DEFAULT now()
   metadata jsonb DEFAULT '{}'::jsonb
   UNIQUE (user_id, card_code)

E. boxing_user_player_stats — 회원별 게임 능력치/세션
   user_id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE
   active_route_code text  -- 'master_path' / 'pro_path' / 'champion_road' / NULL
   prologue_completed boolean DEFAULT false
   hp integer DEFAULT 100, hp_max integer DEFAULT 100
   focus integer DEFAULT 10, focus_max integer DEFAULT 30
   skill integer DEFAULT 10, skill_max integer DEFAULT 50
   guard integer DEFAULT 10, guard_max integer DEFAULT 50
   grit integer DEFAULT 10, grit_max integer DEFAULT 50
   respect integer DEFAULT 0, respect_max integer DEFAULT 100
   story_xp integer DEFAULT 0
   ring_coins integer DEFAULT 0
   earned_titles jsonb DEFAULT '[]'::jsonb  -- ['마스터 후보', ...]
   earned_endings jsonb DEFAULT '[]'::jsonb  -- ['master_candidate', ...]
   earned_badges jsonb DEFAULT '[]'::jsonb
   battle_state jsonb DEFAULT '{}'::jsonb  -- 진행 중 전투 임시 상태 (enemy_hp, turn, etc.)
   last_played_at timestamptz
   metadata jsonb DEFAULT '{}'::jsonb
   created_at, updated_at

   CHECK 제약:
   - hp BETWEEN 0 AND hp_max
   - focus BETWEEN 0 AND focus_max
   - skill BETWEEN 0 AND skill_max
   - guard BETWEEN 0 AND guard_max
   - grit BETWEEN 0 AND grit_max
   - respect BETWEEN 0 AND respect_max
   - story_xp >= 0
   - ring_coins >= 0

F. boxing_user_scene_progress — 회원 × 루트 진행
   id uuid PK
   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
   route_id uuid REFERENCES boxing_story_routes(id) ON DELETE CASCADE
   chapter_id uuid REFERENCES boxing_story_chapters(id) ON DELETE SET NULL
   current_scene_index integer DEFAULT 0
   completed_chapter_codes jsonb DEFAULT '[]'::jsonb  -- ['master_01_first_glove', ...]
   ending_reached boolean DEFAULT false
   ending_code text
   first_clear_at timestamptz
   last_played_at timestamptz
   play_count integer DEFAULT 0
   metadata jsonb DEFAULT '{}'::jsonb
   UNIQUE (user_id, route_id)

G. boxing_story_ending_claims — 엔딩 보상 idempotency
   id uuid PK
   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
   route_id uuid REFERENCES boxing_story_routes(id) ON DELETE CASCADE
   ending_code text NOT NULL
   story_xp_granted integer DEFAULT 0
   ring_coins_granted integer DEFAULT 0
   real_gems_granted integer DEFAULT 0  -- 최초 1회 소량
   reward_title text
   reward_card_code text
   reward_badge_code text
   claimed_at timestamptz DEFAULT now()
   metadata jsonb DEFAULT '{}'::jsonb
   UNIQUE (user_id, route_id, ending_code)

═══════════════════════════════════════════════════════════════════
2. RLS 정책
═══════════════════════════════════════════════════════════════════

마스터 데이터 (회원 SELECT 가능, 관리자 ALL):
- boxing_story_scenes: SELECT TO authenticated USING (active = true OR has_role admin); ALL TO authenticated USING (has_role admin)
- boxing_story_enemies: 동일 패턴
- boxing_story_cards: 동일 패턴

회원 본인 전용 (RPC 경유 INSERT/UPDATE):
- boxing_story_inventory: SELECT TO authenticated USING (user_id = auth.uid() OR has_role admin OR is_branch_manager_of)
- boxing_user_player_stats: 동일
- boxing_user_scene_progress: 동일
- boxing_story_ending_claims: 동일

INSERT/UPDATE 는 RPC SECURITY DEFINER 만 — 직접 INSERT 정책 없음.

═══════════════════════════════════════════════════════════════════
3. 신규 RPC 8개
═══════════════════════════════════════════════════════════════════

A. start_story_session()
   - auth.uid() 확인
   - boxing_user_player_stats 가 없으면 INSERT (기본값으로)
   - 있으면 last_played_at 갱신
   - 반환: 현재 stats + active_route + prologue_completed

B. progress_to_scene(p_route_id uuid, p_chapter_id uuid, p_scene_index integer)
   - 현재 위치를 boxing_user_scene_progress 에 갱신
   - prologue 의 경우 p_route_id, p_chapter_id 모두 NULL 가능
   - 반환: { current_scene_index, scene_payload, scene_type, success }

C. apply_choice(p_scene_id uuid, p_choice_index integer)
   - boxing_story_scenes 에서 scene 가져와서 payload.choices[p_choice_index] 찾기
   - stat_changes 적용 (boxing_user_player_stats 의 hp/focus/skill/guard/grit/respect ± 변동, 상한/하한 clamp)
   - inventory_grants 처리 (boxing_story_inventory UPSERT count +1)
   - next_scene 반환
   - 공식 XP / member_progress 미수정

D. start_battle(p_enemy_code text, p_chapter_id uuid)
   - boxing_story_enemies 에서 적 데이터 조회
   - boxing_user_player_stats.battle_state 에 { enemy_hp, enemy_max_hp, turn: 1, last_command: null, card_used: false, osam_advice_used: false } 저장
   - 반환: 적 데이터 + 플레이어 stats + 전투 상태

E. submit_player_command(p_command text, p_target_data jsonb)
   - p_command IN ('jab', 'guard', 'footwork', 'counter', 'osam_advice', 'use_card')
   - 현재 battle_state 읽기 (battle_state 가 비었으면 'no_active_battle' 에러)
   - 명령별 처리 (잽: skill × 1.0 데미지, 가드: 다음 턴 받는 피해 50%, etc.)
   - 적 패턴 발동 (pattern_code 별 분기 SQL CASE 또는 별도 helper 함수)
   - HP 계산, 적 공격, 결과 도출
   - 반환: { player_hp, enemy_hp, action_log, status: 'ongoing' / 'victory' / 'defeat', narration }
   - victory 면 boxing_story_battle_log INSERT, 적 보상 (story_xp, ring_coins, card) 적용
   - defeat 면 hp 회복 (재도전 가능)
   - 공식 XP / member_progress 미수정

F. claim_card_reward(p_card_code text, p_source text)
   - boxing_story_inventory UPSERT (count +1)
   - p_source: 'chapter_clear' / 'choice' / 'hidden_scene' / 'enemy_drop'
   - 중복 획득 시 count 증가
   - 반환: 인벤토리 갱신 결과

G. complete_ending(p_route_id uuid, p_ending_code text)
   - boxing_story_ending_claims UNIQUE 제약으로 1회 검증
   - 이미 claim 했으면 already_claimed=true, real_gems 0 반환
   - 신규 claim 시:
     · story_xp 누적 (boxing_user_player_stats.story_xp += scene.payload.reward_summary.story_xp)
     · ring_coins 누적
     · earned_endings, earned_titles, earned_badges jsonb 추가
     · reward_card 인벤토리 추가 (claim_card_reward 헬퍼 호출)
     · real_gems_first_time 만큼 grant_gems RPC 호출 (실제 wallet 갱신)
     · boxing_user_scene_progress.ending_reached = true, ending_code, first_clear_at, play_count++
   - 반환: 보상 요약

H. reset_story_route(p_route_id uuid)
   - boxing_user_scene_progress 의 해당 route_id 행을 current_scene_index = 0, completed_chapter_codes = [] 로 리셋
   - ending_reached / ending_code / first_clear_at 보존 (기록 유지)
   - boxing_user_player_stats 의 active_route_code 는 NULL 로
   - 인벤토리 / 능력치 / 보상 이력 보존
   - 반환: 리셋 결과

═══════════════════════════════════════════════════════════════════
4. 기존 RPC deprecated 처리
═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.sync_story_chapter_progress(text);
DROP FUNCTION IF EXISTS public.claim_story_chapter_reward(uuid);
DROP FUNCTION IF EXISTS public._story_chapter_progress(uuid, public.boxing_story_chapters, uuid);

유지:
- get_my_story_rpg_state() — 메타 데이터 reader 로 활용 (routes, chapters, nodes, dialogues)
- choose_story_route(text) — 호환성 유지하되 내부적으로 boxing_user_player_stats.active_route_code 도 갱신하도록 수정
- change_story_route(text) — 동일

═══════════════════════════════════════════════════════════════════
5. SEED 데이터
═══════════════════════════════════════════════════════════════════

A. boxing_story_enemies (11종 — Stage 44 시나리오 6장 표 참고)

INSERT INTO public.boxing_story_enemies (code, name, description, hp, attack, defense, pattern_code, pattern_metadata, weakness, reward_story_xp, reward_ring_coins, reward_card_code, is_boss)
VALUES
  ('lazy_slime', '게으름 슬라임', '이불 속에서 들리는 그 목소리가 형체를 가졌습니다.', 30, 5, 0, 'random_sleep_50',
   '{"sleep_chance": 50}'::jsonb, '{"jab": 1.5}'::jsonb, 30, 20, NULL, false),
  ('guard_breaker', '가드 브레이커', '...', 60, 10, 5, 'charge_3turn_breakguard',
   '{"charge_turns": 3, "damage_multiplier": 2.0}'::jsonb, '{"footwork": true}'::jsonb, 50, 40, NULL, false),
  -- ... 11종 전체
  ('master_door', '마스터의 문', '...', 200, 12, 6, 'mirror_attack',
   '{"phase_2_hp_threshold": 100}'::jsonb, '{"respect_required": 80}'::jsonb, 200, 300, 'card_master_candidate', true),
  ('routine_breaker', '루틴 파괴자', '...', 180, 10, 5, 'random_stat_drain',
   '{}'::jsonb, '{"jab_accumulation": true}'::jsonb, 200, 300, 'card_pro_routine', true),
  ('self_compare_evolved', '처음의 나 / 비교 괴물 진화형', '...', 250, 14, 7, 'two_phase_self_compare',
   '{"phase_1_hp": 50, "phase_2_hp": 250}'::jsonb, '{"respect_grit_combined": 100}'::jsonb, 250, 400, 'card_champion_spirit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  hp = EXCLUDED.hp, attack = EXCLUDED.attack, defense = EXCLUDED.defense,
  pattern_code = EXCLUDED.pattern_code, pattern_metadata = EXCLUDED.pattern_metadata,
  weakness = EXCLUDED.weakness,
  reward_story_xp = EXCLUDED.reward_story_xp, reward_ring_coins = EXCLUDED.reward_ring_coins,
  reward_card_code = EXCLUDED.reward_card_code, is_boss = EXCLUDED.is_boss;

(Stage 44 시나리오 §6 적 마스터 데이터 표 모든 행 변환)

B. boxing_story_cards (9종)

INSERT INTO public.boxing_story_cards (code, name, description, effect_code, effect_metadata, is_consumable, rarity)
VALUES
  ('card_glove_first', '첫 글러브', '체육관 첫날의 기억', 'damage_boost_20', '{"multiplier": 1.2}'::jsonb, true, 'common'),
  ('card_jab_master', '잽 마스터', '...', 'next_jab_x3', '{"multiplier": 3.0, "uses": 1}'::jsonb, true, 'rare'),
  -- ... 9종 전체
  ('card_master_candidate', '마스터 후보', '엔딩 인증', 'cosmetic', '{}'::jsonb, false, 'ending'),
  ('card_pro_routine', '프로 루틴 후보', '엔딩 인증', 'cosmetic', '{}'::jsonb, false, 'ending'),
  ('card_champion_spirit', '챔피언의 정신', '엔딩 인증', 'cosmetic', '{}'::jsonb, false, 'ending')
ON CONFLICT (code) DO UPDATE SET ...;

(Stage 44 시나리오 §7 카드 표 모든 행 변환)

C. boxing_story_scenes (176+)

** 가장 중요한 작업 **

docs/153-story-rpg-game-scenario.md 를 chapter 별로 파싱:

각 chapter 의 씬들 → INSERT INTO boxing_story_scenes 로 변환

매핑 패턴:
```sql
-- 마스터의 길 챕터 1 의 씬 0 (dialogue)
INSERT INTO public.boxing_story_scenes
  (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index, next_scene_victory, next_scene_defeat)
SELECT
  'chapter',
  c.route_id,
  c.id,
  0,
  'dialogue',
  jsonb_build_object(
    'speaker', '오삼이',
    'body', '체육관 문을 열 때, 누구나 한 번 망설입니다...',
    'bgm_hint', 'calm'
  ),
  1,  -- next_scene_index
  NULL,
  NULL
FROM public.boxing_story_chapters c
WHERE c.code = 'master_01_first_glove'
ON CONFLICT (chapter_id, scene_index) DO UPDATE SET
  payload = EXCLUDED.payload,
  next_scene_index = EXCLUDED.next_scene_index;
```

choice 씬:
```sql
INSERT INTO public.boxing_story_scenes
  (scope, route_id, chapter_id, scene_index, scene_type, payload)
SELECT
  'chapter', c.route_id, c.id, 3, 'choice',
  jsonb_build_object(
    'prompt', '강 관장이 글러브를 건네줍니다. 어떻게 받을까?',
    'choices', jsonb_build_array(
      jsonb_build_object('label', '두 손으로 정중히', 'stat_changes', jsonb_build_object('respect', 5), 'next_scene', 4),
      jsonb_build_object('label', '한 손으로', 'stat_changes', jsonb_build_object('skill', 1), 'next_scene', 4),
      jsonb_build_object('label', '어색하게', 'stat_changes', jsonb_build_object('grit', 2), 'next_scene', 4)
    )
  )
FROM public.boxing_story_chapters c
WHERE c.code = 'master_01_first_glove'
ON CONFLICT (chapter_id, scene_index) DO UPDATE SET payload = EXCLUDED.payload;
```

battle 씬:
```sql
INSERT INTO public.boxing_story_scenes
  (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_victory, next_scene_defeat)
SELECT
  'chapter', c.route_id, c.id, 6, 'battle',
  jsonb_build_object(
    'enemy_code', 'lazy_slime',
    'intro_line', '이불 속에서 들리던 목소리가 형체를 가집니다...',
    'victory_line', '녹색 거품이 천천히 흩어집니다...',
    'defeat_line', '괜찮아요. 한 번 더 — 게으름은 한 번에 안 사라져요.'
  ),
  7,  -- victory next
  5   -- defeat next (재도전)
FROM public.boxing_story_chapters c
WHERE c.code = 'master_01_first_glove';
```

ending 씬 (각 루트의 6번째 챕터 마지막 씬):
```sql
INSERT INTO public.boxing_story_scenes
  (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
SELECT
  'chapter', c.route_id, c.id, 12, 'ending',
  jsonb_build_object(
    'ending_code', 'master_candidate',
    'title', '마스터 후보',
    'subtitle', '잘하는 사람이 아니라, 안전하게 이끄는 사람',
    'cutscene_blocks', jsonb_build_array(
      jsonb_build_object('type', 'narration', 'body', '마스터의 문이 열립니다...'),
      jsonb_build_object('type', 'narration', 'speaker', '강 관장', 'body', '이제 당신은...'),
      -- ...
    ),
    'reward_summary', jsonb_build_object(
      'story_xp', 200, 'ring_coins', 300,
      'real_gems_first_time', 300,
      'title', '마스터 후보',
      'card_code', 'card_master_candidate',
      'badge_code', NULL
    )
  ),
  -1  -- 엔딩 끝
FROM public.boxing_story_chapters c
WHERE c.code = 'master_06_master_test';
```

prologue 씬 (4개):
```sql
INSERT INTO public.boxing_story_scenes
  (scope, route_id, chapter_id, scene_index, scene_type, payload, next_scene_index)
VALUES
  ('prologue', NULL, NULL, 0, 'dialogue',
    '{"speaker": "오삼이", "body": "..."}'::jsonb, 1),
  ('prologue', NULL, NULL, 1, 'dialogue', '{}'::jsonb, 2),
  ('prologue', NULL, NULL, 2, 'dialogue', '{}'::jsonb, 3),
  ('prologue', NULL, NULL, 3, 'choice',
    jsonb_build_object(
      'prompt', '...',
      'choices', jsonb_build_array(
        jsonb_build_object('label', '후배에게 도움이 되는 사람', 'route_choice', 'master_path', 'next_scene', -1),
        jsonb_build_object('label', '매일 같은 자리에 서는 사람', 'route_choice', 'pro_path', 'next_scene', -1),
        jsonb_build_object('label', '어제의 나를 이기는 사람', 'route_choice', 'champion_road', 'next_scene', -1)
      )
    ),
    -1
  )
ON CONFLICT (scope, scene_index) WHERE scope = 'prologue' DO UPDATE SET payload = EXCLUDED.payload;
```

** 모든 18 챕터 × 평균 8-10 씬 = 약 170 INSERT 문 작성 필요 **

작업 효율:
- 챕터별로 묶어서 작성 (18 블록)
- 같은 패턴 반복 — 첫 챕터 작성 후 나머지는 시나리오 doc 따라 변환
- ON CONFLICT (chapter_id, scene_index) DO UPDATE SET payload, next_scene_* — idempotent

═══════════════════════════════════════════════════════════════════
6. updated_at 트리거 + 권한 GRANT
═══════════════════════════════════════════════════════════════════

기존 boxing_engagement_set_updated_at() 함수 재사용.

DROP TRIGGER IF EXISTS trg_boxing_story_scenes_updated_at ON public.boxing_story_scenes;
CREATE TRIGGER trg_boxing_story_scenes_updated_at
  BEFORE UPDATE ON public.boxing_story_scenes
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

(7 테이블 모두 적용)

권한:
GRANT EXECUTE ON FUNCTION public.start_story_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.progress_to_scene(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_choice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_battle(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_player_command(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_card_reward(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ending(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_story_route(uuid) TO authenticated;

═══════════════════════════════════════════════════════════════════
7. 검증 SQL (Supabase SQL Editor 에서 적용 후 실행)
═══════════════════════════════════════════════════════════════════

마이그레이션 끝에 주석으로 추가:

-- 검증 SQL (별도 New query 로 실행):
-- 1) SELECT count(*) FROM public.boxing_story_scenes WHERE scope = 'prologue';   -- 4
-- 2) SELECT count(*) FROM public.boxing_story_scenes WHERE scope = 'chapter';     -- ~172
-- 3) SELECT count(*) FROM public.boxing_story_scenes;                              -- ~176
-- 4) SELECT count(*) FROM public.boxing_story_enemies;                             -- 11
-- 5) SELECT count(*) FROM public.boxing_story_cards;                               -- 9
-- 6) SELECT proname FROM pg_proc WHERE proname IN
--    ('start_story_session','progress_to_scene','apply_choice','start_battle',
--     'submit_player_command','claim_card_reward','complete_ending','reset_story_route')
--    ORDER BY proname;                                                              -- 8 rows
-- 7) SELECT chapter_id, count(*) FROM public.boxing_story_scenes WHERE scope='chapter'
--    GROUP BY chapter_id ORDER BY count(*) DESC;                                    -- 챕터당 6-12 씬
-- 8) SELECT proname FROM pg_proc WHERE proname IN
--    ('sync_story_chapter_progress','claim_story_chapter_reward','_story_chapter_progress');
--    -- 0 rows (deprecated 됨)

═══════════════════════════════════════════════════════════════════
8. 작업 출력
═══════════════════════════════════════════════════════════════════

작업 완료 후:
1. 생성한 migration 파일명
2. 신규 테이블 7개 목록
3. 신규 RPC 8개 목록
4. 삭제한 기존 RPC 3개
5. seed row 수: scenes ~176, enemies 11, cards 9
6. Supabase SQL Editor 실행 안내 (PowerShell 클립보드 명령 + 검증 SQL)
7. git diff --stat 결과
8. 다음 단계 (Stage 46 — UI 구현) 안내

═══════════════════════════════════════════════════════════════════
중요 작업 흐름
═══════════════════════════════════════════════════════════════════

1. 먼저 docs/153-story-rpg-game-scenario.md Read (전체 읽기 — 분할 읽기 가능)
2. supabase/migrations 폴더 마지막 timestamp 확인
3. 새 migration 파일 생성 (시간순 단조 증가)
4. DDL (테이블 7개 + 트리거 + RLS) 작성
5. RPC 8개 작성 (SECURITY DEFINER + search_path 'public')
6. 기존 RPC 3개 DROP
7. SEED INSERT 문 작성:
   a. enemies 11 row
   b. cards 9 row
   c. prologue 4 scene
   d. master 6 chapter × 평균 8-12 scene = ~58 scene
   e. pro 6 chapter × 평균 8-11 scene = ~54 scene
   f. champion 6 chapter × 평균 8-14 scene = ~60 scene
8. 검증 SQL 주석 추가
9. 파일 저장
10. 출력 안내문 작성

이 작업은 매우 많은 INSERT 문 작성이 필요하다. 시나리오 doc 의 각 씬을 정확히 jsonb 로 변환해야 하니 신중히. 같은 형식 반복이라 일관성 유지가 핵심.

작업 완료 후 절대 수정 금지 영역 (보호 파일 목록) 미수정 확인하고 보고하라.
```

---

## Stage 45 완료 후 — Supabase 적용 + push

### 1. PowerShell 에서 클립보드 복사

```powershell
[System.IO.File]::ReadAllText("C:\Users\82104\game-fit-quests\supabase\migrations\새_파일명.sql", [System.Text.Encoding]::UTF8) | Set-Clipboard
```

(파일명은 Claude Code 가 알려줍니다)

### 2. Supabase Dashboard 적용

- https://supabase.com/dashboard/project/raoqefkwdpovwlgbibis
- SQL Editor → New query → Ctrl + V → Run

### 3. 검증 SQL 실행 (별도 New query)

```sql
SELECT count(*) AS prologue_scenes FROM public.boxing_story_scenes WHERE scope = 'prologue';   -- 기대: 4
SELECT count(*) AS chapter_scenes  FROM public.boxing_story_scenes WHERE scope = 'chapter';    -- 기대: ~172
SELECT count(*) AS total_scenes    FROM public.boxing_story_scenes;                            -- 기대: ~176
SELECT count(*) AS enemies         FROM public.boxing_story_enemies;                           -- 기대: 11
SELECT count(*) AS cards           FROM public.boxing_story_cards;                             -- 기대: 9

SELECT proname FROM pg_proc WHERE proname IN
  ('start_story_session','progress_to_scene','apply_choice','start_battle',
   'submit_player_command','claim_card_reward','complete_ending','reset_story_route')
ORDER BY proname;
-- 기대: 8 rows

SELECT proname FROM pg_proc WHERE proname IN
  ('sync_story_chapter_progress','claim_story_chapter_reward','_story_chapter_progress');
-- 기대: 0 rows (deprecated)

SELECT
  c.code AS chapter_code,
  count(s.*) AS scene_count
FROM public.boxing_story_chapters c
LEFT JOIN public.boxing_story_scenes s ON s.chapter_id = c.id
GROUP BY c.code
ORDER BY c.code;
-- 기대: 챕터당 6-14 (Stage 44 분포: 마스터 9+8+9+11+9+12, 프로 8+8+10+8+9+11, 챔피언 9+8+10+9+10+14)
```

### 4. git push

```powershell
cd C:\Users\82104\game-fit-quests
git add supabase/migrations
git commit -m "feat(story-rpg): 독립형 게임 DB/RPC (45단계) — 7테이블 + 8 RPCs + ~176씬 seed + 11적 + 9카드"
git push origin main
```

---

## Stage 45 결과 검토

검증 SQL 모두 기대값 일치 확인 후:
- **Stage 46 (UI 구현)** prompt 요청 → Scene Renderer + 턴제 전투 + 엔딩 컷씬

검증 실패 시:
- 어느 검증이 실패했는지 알려주세요 — 즉시 fix prompt 작성

---

## 예상 작업 시간

- Claude Code: ~3-4시간 (대량 INSERT 작성 + RPC 로직 구현)
- migration 파일 크기: ~200-300KB
- Supabase 적용: ~30초-1분
- 검증: ~5분
