# 153 스토리 RPG — Stage 46 프롬프트 (UI 구현 + 서비스/훅 재배선)

> Claude Code 에 그대로 복붙. **Stage 45 DB(테이블 7 + RPC 8 + seed 176)** 가 운영에 적용된 상태가 전제. 이 단계는 **프론트엔드만** 손댄다 — 새 마이그레이션은 만들지 않는다.

---

## 사용법

1. Claude Code 열기
2. 아래 코드 블록 전체 복사
3. 붙여넣기 → 실행 (~3-4시간 소요, 컴포넌트 8개 + 서비스 + 훅 + 페이지 리팩터)
4. `bun run build` ✓ 확인
5. 운영 (Cloudflare Pages) 반영 후 스토리 RPG 진입 → 프롤로그 → 마스터 루트 챕터 1 ~ 엔딩 컷씬까지 손스모크 1회
6. git add / commit / push

---

## Stage 46 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 독립형 게임 모드의 UI 와 클라이언트 레이어를 완성하는 시니어 React/TypeScript 게임 UI 개발자다.

이번 작업은 46단계다.
목표:
1. Stage 45 에서 추가된 신규 8 RPC 를 호출하는 서비스 + 훅 추가 (기존 service/hook 파일 확장, 새 파일 신설 금지를 우선하되 분량이 커지면 storySceneService.ts / storyBattleService.ts 로 분리 가능)
2. Scene 단위 플레이 흐름을 그리는 신규 컴포넌트 8개 신규 작성
3. StoryRpgPage 를 챕터 진행 게이지 위주 → "씬 플레이어" 위주로 리팩터 (월드맵 + 루트 선택은 보존)
4. Stage 41 시절의 운동 의존 컴포넌트 (StoryQuestActions / StoryChapterProgress / StoryChapterCard / 구 StoryBattleScreen) 정리 — 삭제 또는 빈 export 처리
5. types/storyRpg.ts 에 신규 도메인 타입 추가 (StoryScene, StoryEnemy, StoryCard, StoryPlayerStats, StoryInventoryItem, StorySceneProgress, StoryEndingClaim)
6. 새 마이그레이션 / 새 RLS / 새 RPC 작성 금지 — Stage 45 에서 끝났다
7. ChatAssistant / chat-assistant Edge Function 호출 0건

가장 중요한 보호 원칙:
1. levels / missions / mission_videos / mission_submissions / member_progress 절대 미수정.
2. approve_mission_submission / record_attendance 호출 금지.
3. 공식 XP 미지급. wallet 직접 update 금지 (보상은 RPC 안에서 grant_gems 가 처리한 결과만 표시).
4. 새 RPC 작성 금지 — 이미 있는 8개만 호출.
5. ChatAssistant / chat-assistant Edge / boxing SYSTEM_PROMPT / KNOWLEDGE_153 미수정.
6. supabase/migrations 안에 새 .sql 만들지 않는다.

절대 수정 금지:
- src/components/ChatAssistant.tsx
- supabase/functions/chat-assistant/**
- supabase/functions/_shared/systemPrompt153.ts
- supabase/functions/_shared/knowledge153.ts
- supabase/migrations/** (Stage 45 까지가 최종)
- src/integrations/supabase/types.ts (자동 생성 — 손대지 않는다)
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- MissionsPage / RankUpPage / LevelAdminPanel / LiveBoardPage
- src/data/allLevelsData.ts / whiteLevel1Data / sharedConstants
- 외부 시스템 external/naver-talktalk/** / supabase/functions/talktalk-*/**

═══════════════════════════════════════════════════════════════════
0. 먼저 할 일 (Read 도구로 실제 파일 읽기)
═══════════════════════════════════════════════════════════════════

1. supabase/migrations/20260707000000_boxing_story_rpg_independent_game.sql 의 RPC 시그니처 8개 정확히 파악
   · start_story_session()
   · progress_to_scene(p_route_id uuid, p_chapter_id uuid, p_scene_index integer)
   · apply_choice(p_scene_id uuid, p_choice_index integer)
   · start_battle(p_enemy_code text, p_chapter_id uuid)
   · submit_player_command(p_command text, p_target_data jsonb)
   · claim_card_reward(p_card_code text, p_source text)
   · complete_ending(p_route_id uuid, p_ending_code text)
   · reset_story_route(p_route_id uuid)
   각 함수의 RETURNS 절(스칼라 vs jsonb vs setof)을 확인하고 TypeScript 타입에 정확히 반영
2. docs/153-story-rpg-game-scenario.md 에서 다음 데이터 확인
   · 적 11종의 code / pattern_code / weakness 매핑
   · 카드 9종의 effect_code / rarity / consumable
   · 엔딩 3종의 ending_code / cutscene_blocks 구조
3. src/services/storyRpgService.ts 현재 구현 (chooseStoryRoute / changeStoryRoute / claimStoryChapterReward / syncStoryChapterProgress / getMyStoryRpgState)
4. src/hooks/useStoryRpg.ts 의 query key 패턴 (["story-rpg", ...])
5. src/types/storyRpg.ts 에 이미 있는 StoryRoute / StoryChapter / StoryNode / StoryDialogue 등 (계속 보존)
6. src/pages/StoryRpgPage.tsx 의 현재 영역 분할 (header / route select / world map / dialog box / quest actions / reward / battle screen)
7. src/components/story-rpg/ 안의 21개 파일 헤더 주석을 빠르게 훑어 어느 것이 보존이고 어느 것이 폐기인지 결정
8. src/components/character/CharacterSprite.tsx — 비주얼 동기화 시 필요할 수 있음

═══════════════════════════════════════════════════════════════════
1. 신규 타입 (src/types/storyRpg.ts 확장)
═══════════════════════════════════════════════════════════════════

기존 타입 (StoryRoute / StoryChapter / StoryNode / StoryDialogue / StoryProgress / StoryRewardClaim / StoryRpgState 등) 은 호환성 유지 — 기존 컴포넌트들이 아직 참조한다.

추가 (파일 하단에 append):

A. Scene
   StorySceneType = "dialogue" | "choice" | "battle" | "node_move" | "ending"
   StorySceneScope = "prologue" | "chapter"

   StorySceneDialoguePayload = {
     speaker: string;
     body: string;
     portrait?: string | null;
     bgm_hint?: string | null;
   }

   StorySceneChoiceOption = {
     label: string;
     hint?: string;
     stat_changes?: Partial<Record<StoryStatKey, number>>;
     inventory_grants?: Array<{ card_code: string; count?: number }>;
     next_scene: number;
   }

   StorySceneChoicePayload = {
     prompt: string;
     speaker?: string;
     choices: StorySceneChoiceOption[];
   }

   StorySceneBattlePayload = {
     enemy_code: string;
     intro_line?: string;
     victory_line?: string;
     defeat_line?: string;
     reward_override?: { story_xp?: number; ring_coins?: number; card_code?: string };
   }

   StorySceneNodeMovePayload = {
     from_node_code: string;
     to_node_code: string;
     transition_message?: string;
     animation_hint?: string;
   }

   StorySceneEndingPayload = {
     ending_code: string;
     title: string;
     subtitle: string;
     cutscene_blocks: Array<
       | { kind: "narration"; text: string }
       | { kind: "dialogue"; speaker: string; text: string }
       | { kind: "image"; alt: string; theme?: string }
     >;
     reward_summary: {
       story_xp?: number;
       ring_coins?: number;
       real_gems_first_time?: number;
       title?: string;
       card_code?: string;
       badge_code?: string;
     };
   }

   StoryScenePayload =
     | StorySceneDialoguePayload
     | StorySceneChoicePayload
     | StorySceneBattlePayload
     | StorySceneNodeMovePayload
     | StorySceneEndingPayload;

   interface StoryScene {
     id: string;
     scope: StorySceneScope;
     route_id: string | null;
     chapter_id: string | null;
     scene_index: number;
     scene_type: StorySceneType;
     payload: StoryScenePayload;
     next_scene_index: number | null;
     next_scene_victory: number | null;
     next_scene_defeat: number | null;
     active: boolean;
     metadata: Record<string, unknown>;
   }

B. Enemy / Card
   interface StoryEnemy {
     code: string;
     name: string;
     description: string | null;
     hp: number;
     attack: number;
     defense: number;
     pattern_code: string;
     pattern_metadata: Record<string, unknown>;
     weakness: Record<string, number | boolean>;
     reward_story_xp: number;
     reward_ring_coins: number;
     reward_card_code: string | null;
     is_boss: boolean;
   }

   interface StoryCard {
     code: string;
     name: string;
     description: string;
     effect_code: string | null;
     effect_metadata: Record<string, unknown>;
     is_consumable: boolean;
     rarity: "common" | "rare" | "epic" | "ending";
   }

C. Player Stats / Inventory / Progress / Ending Claim
   StoryStatKey = "hp" | "focus" | "skill" | "guard" | "grit" | "respect"

   interface StoryPlayerStats {
     user_id: string;
     active_route_code: string | null;
     prologue_completed: boolean;
     hp: number; hp_max: number;
     focus: number; focus_max: number;
     skill: number; skill_max: number;
     guard: number; guard_max: number;
     grit: number; grit_max: number;
     respect: number; respect_max: number;
     story_xp: number;
     ring_coins: number;
     earned_titles: string[];
     earned_endings: string[];
     earned_badges: string[];
     battle_state: StoryBattleState | null;
     last_played_at: string | null;
   }

   interface StoryBattleState {
     enemy_code: string;
     enemy_hp: number;
     enemy_max_hp: number;
     turn: number;
     last_command: string | null;
     card_used: boolean;
     osam_advice_used: boolean;
     pattern_state?: Record<string, unknown>;
   }

   interface StoryInventoryItem {
     card_code: string;
     count: number;
     first_acquired_at: string;
   }

   interface StorySceneProgress {
     route_id: string;
     chapter_id: string | null;
     current_scene_index: number;
     completed_chapter_codes: string[];
     ending_reached: boolean;
     ending_code: string | null;
     play_count: number;
     first_clear_at: string | null;
     last_played_at: string | null;
   }

   interface StoryEndingClaim {
     route_id: string;
     ending_code: string;
     story_xp_granted: number;
     ring_coins_granted: number;
     real_gems_granted: number;
     reward_title: string | null;
     reward_card_code: string | null;
     reward_badge_code: string | null;
     claimed_at: string;
   }

D. RPC 응답 타입
   interface StorySessionStartResult {
     stats: StoryPlayerStats;
     active_route_code: string | null;
     prologue_completed: boolean;
   }

   interface SceneProgressResult {
     success: boolean;
     scene_id: string;
     scene_index: number;
     scene_type: StorySceneType;
     payload: StoryScenePayload;
     next_scene_index: number | null;
   }

   interface ChoiceApplyResult {
     success: boolean;
     stats: StoryPlayerStats;
     inventory_changed: StoryInventoryItem[];
     next_scene_index: number;
   }

   interface BattleStartResult {
     success: boolean;
     enemy: StoryEnemy;
     stats: StoryPlayerStats;
     battle_state: StoryBattleState;
   }

   type BattleCommand = "jab" | "guard" | "footwork" | "counter" | "osam_advice" | "use_card";

   interface BattleCommandResult {
     status: "ongoing" | "victory" | "defeat";
     player_hp: number;
     player_focus: number;
     enemy_hp: number;
     turn: number;
     action_log: Array<{ actor: "player" | "enemy" | "osam"; line: string; damage?: number }>;
     narration?: string;
     rewards?: { story_xp: number; ring_coins: number; card_code?: string };
   }

   interface CardClaimResult {
     success: boolean;
     inventory: StoryInventoryItem[];
     newly_added: boolean;
   }

   interface EndingCompleteResult {
     success: boolean;
     already_claimed: boolean;
     story_xp_granted: number;
     ring_coins_granted: number;
     real_gems_granted: number;
     reward_title: string | null;
     reward_card_code: string | null;
     reward_badge_code: string | null;
     stats: StoryPlayerStats;
   }

   interface RouteResetResult {
     success: boolean;
     route_id: string;
   }

═══════════════════════════════════════════════════════════════════
2. 신규 서비스 (src/services/storyRpgService.ts 확장)
═══════════════════════════════════════════════════════════════════

기존 함수 (chooseStoryRoute / changeStoryRoute / getMyStoryRpgState) 는 보존.
deprecated:
  · syncStoryChapterProgress — Stage 45 에서 RPC drop 됨. **함수 본체 안에서 throw new Error("deprecated") 로 교체** + JSDoc 에 deprecated 표기. 호출자는 곧 제거됨.
  · claimStoryChapterReward — 동일 처리.

신규 함수 8개 (모두 sbRpc 래퍼 사용, 모두 mapStoryError 적용):

  startStorySession(): Promise<StorySessionStartResult>
  progressToScene(routeId: string | null, chapterId: string | null, sceneIndex: number): Promise<SceneProgressResult>
  applyChoice(sceneId: string, choiceIndex: number): Promise<ChoiceApplyResult>
  startBattle(enemyCode: string, chapterId: string): Promise<BattleStartResult>
  submitPlayerCommand(command: BattleCommand, targetData?: Record<string, unknown>): Promise<BattleCommandResult>
  claimCardReward(cardCode: string, source: "chapter_clear" | "choice" | "hidden_scene" | "enemy_drop"): Promise<CardClaimResult>
  completeEnding(routeId: string, endingCode: string): Promise<EndingCompleteResult>
  resetStoryRoute(routeId: string): Promise<RouteResetResult>

추가로 마스터 데이터 reader (선택적이지만 권장):
  fetchStoryEnemies(): Promise<StoryEnemy[]>  -- supabase.from("boxing_story_enemies").select("*").eq("active", true)
  fetchStoryCards(): Promise<StoryCard[]>     -- 동일
  fetchMyInventory(): Promise<StoryInventoryItem[]>  -- supabase.from("boxing_story_inventory").select("card_code, count, first_acquired_at").eq("user_id", auth)
  fetchMyPlayerStats(): Promise<StoryPlayerStats | null>  -- 동일

오류 매핑 추가 (STORY_ERROR_MAP):
  { match: "no_active_battle", ko: "현재 진행 중인 전투가 없습니다." }
  { match: "invalid_scene", ko: "잘못된 씬 인덱스입니다." }
  { match: "scene_not_found", ko: "씬을 찾을 수 없습니다." }
  { match: "ending_already_claimed", ko: "이미 받은 엔딩 보상입니다." }
  { match: "invalid_choice", ko: "유효하지 않은 선택지입니다." }
  { match: "stat_clamp_error", ko: "능력치가 한계에 도달했습니다." }
  { match: "card_not_found", ko: "카드를 찾을 수 없습니다." }
  { match: "battle_lock", ko: "전투 진행 중에는 이 행동을 할 수 없습니다." }

═══════════════════════════════════════════════════════════════════
3. 신규 훅 (src/hooks/useStoryRpg.ts 확장)
═══════════════════════════════════════════════════════════════════

기존 STORY_RPG_KEY 유지. 서브 키 prefix 추가:

  STORY_RPG_KEY = ["story-rpg"]
  STORY_SESSION_KEY = ["story-rpg", "session"]
  STORY_SCENE_KEY = ["story-rpg", "scene"]
  STORY_BATTLE_KEY = ["story-rpg", "battle"]
  STORY_INVENTORY_KEY = ["story-rpg", "inventory"]
  STORY_ENEMIES_KEY = ["story-rpg", "enemies"]
  STORY_CARDS_KEY = ["story-rpg", "cards"]
  STORY_PLAYER_STATS_KEY = ["story-rpg", "stats"]

새 hook:

  useStorySession()
    - useQuery(STORY_SESSION_KEY) → startStorySession() 반환값
    - mutation 필요 없음, 페이지 마운트 시 트리거되어 player_stats row 생성/갱신

  useScene(sceneId | sceneIndex 조합)
    - 단일 씬을 그릴 때 progress_to_scene 호출
    - mutation 형태로 수동 호출

  useApplyChoice()
    - useMutation(applyChoice)
    - onSuccess 시 STORY_PLAYER_STATS_KEY / STORY_INVENTORY_KEY invalidate

  useStartBattle()
    - useMutation(startBattle)
    - onSuccess 시 STORY_BATTLE_KEY 에 적/상태 캐시 (queryClient.setQueryData)

  useSubmitBattleCommand()
    - useMutation(submitPlayerCommand)
    - onSuccess 시 STORY_BATTLE_KEY / STORY_PLAYER_STATS_KEY invalidate
    - status === "victory" 일 때 STORY_INVENTORY_KEY / wallet 도 invalidate (real_gems 가 entered 될 가능성은 엔딩에서만 — 보스는 ring_coins/카드만)

  useClaimCard()
    - useMutation(claimCardReward)

  useCompleteEnding()
    - useMutation(completeEnding)
    - onSuccess 시 STORY_RPG_KEY 전체 invalidate + ["wallet"] invalidate (real_gems 첫 클리어 보상 반영)

  useResetRoute()
    - useMutation(resetStoryRoute)

  useStoryEnemies()  -- useQuery, staleTime 5분
  useStoryCards()    -- 동일
  useMyInventory()   -- useQuery(STORY_INVENTORY_KEY), staleTime 30초
  useMyPlayerStats() -- useQuery(STORY_PLAYER_STATS_KEY), staleTime 10초

기존 useSyncStoryProgress / useClaimStoryReward 는 함수 시그니처는 유지하되 내부 mutationFn 을 throw new Error("deprecated") 로 교체. 추후 페이지 리팩터에서 호출 제거되면 함수 자체 삭제 가능.

═══════════════════════════════════════════════════════════════════
4. 신규 컴포넌트 (src/components/story-rpg/)
═══════════════════════════════════════════════════════════════════

A. StoryScenePlayer.tsx (가장 핵심)
   props: { scene: StoryScene; onAdvance: (nextSceneIndex: number) => void; onChoice: (choiceIndex: number) => void; onBattleStart: (enemyCode: string) => void; onEnding: (endingCode: string) => void }

   책임:
   · scene.scene_type 에 따라 분기:
     - dialogue → 타자기 효과로 payload.body 렌더 (speaker 위 / 본문 아래) + 클릭/탭 시 onAdvance(scene.next_scene_index)
     - choice → StoryChoicePanel 마운트
     - battle → 자동으로 onBattleStart(payload.enemy_code) 호출 (intro_line 표시 후 1초 페이드)
     - node_move → transition_message 페이드 인-아웃 후 onAdvance(scene.next_scene_index)
     - ending → StoryEndingCutscene 마운트
   · 타자기 효과: 30ms/char 기본, 스킵 가능 (탭 1회 → 즉시 완료 → 다시 탭 → 다음 씬)
   · 한 화면에 1개 씬만 렌더 (Slime/MapleStory 류 텍스트 박스 비주얼)
   · framer-motion 사용해서 씬 전환 페이드/슬라이드

B. StoryChoicePanel.tsx
   props: { payload: StorySceneChoicePayload; onSelect: (choiceIndex: number) => void; busy?: boolean }
   · choices 를 1열로 큰 버튼, 모바일/태블릿 모두 mx-auto max-w-md 안쪽
   · hint 가 있으면 버튼 아래 작은 텍스트
   · stat_changes preview (예: "투지 +3, 체력 -5") 를 hover/tap 시 노출

C. StoryBattleEngine.tsx
   props: { enemyCode: string; chapterId: string; onVictory: (rewards: BattleCommandResult["rewards"]) => void; onDefeat: () => void }

   책임:
   · 마운트 시 startBattle 호출 → enemy / battle_state 받기
   · 화면 분할:
     - 상단 30%: 적 그래픽 영역 (StoryObstacleCreature 또는 새로 만든 SVG; 보스는 큰 버전)
       + 적 이름, HP 바 (StoryHpBar 재사용), 패턴 hint 작은 글씨
     - 중단 30%: 텍스트 로그 (action_log 순차적 렌더, 자동 스크롤)
     - 하단 40%: 5개 액션 버튼 grid-cols-2 (잽 / 가드 / 풋워크 / 카운터 / 오삼이 조언) + 인벤토리 토글
   · 5개 액션 클릭 시 useSubmitBattleCommand 호출, status === "victory"/"defeat" 면 즉시 분기
   · "오삼이 조언" 은 1전투 1회 제한 (battle_state.osam_advice_used)
   · 인벤토리 토글 → StoryInventoryPanel(mode="battle") → 카드 사용 시 use_card 명령
   · framer-motion 으로 데미지 +N 텍스트 떠오르기, 적 흔들리기
   · 모바일 우선: mx-auto max-w-md, 태블릿 이상은 max-w-2xl

D. StoryInventoryPanel.tsx
   props: { mode: "battle" | "browse"; onUseCard?: (cardCode: string) => void; onClose?: () => void }
   · useMyInventory + useStoryCards join
   · 카드 그리드 (2~3열), 각 카드는 rarity 별 테두리 색
   · battle 모드에서는 클릭 시 onUseCard, browse 는 설명만
   · is_consumable=false 카드는 "장식" 라벨 + 사용 비활성

E. StoryEndingCutscene.tsx
   props: { payload: StorySceneEndingPayload; routeId: string; onClaimed: (result: EndingCompleteResult) => void }
   · 마운트 시 cutscene_blocks 를 순차 렌더 (block 당 2초 페이드)
   · narration: 화면 가득 텍스트 + 어두운 배경
   · dialogue: 좌하단 캐릭터 + 말풍선
   · image: theme 따라 그라디언트 배경 (예: "ring_lights_only" → 검은 배경 + 가운데 노란 원)
   · cutscene_blocks 끝나면 큰 보상 카드 (title + reward_summary 표시) + "보상 받기" 버튼
   · 버튼 클릭 → useCompleteEnding(routeId, payload.ending_code) → 결과를 onClaimed 로 전달
   · 이미 claim 된 경우 (already_claimed=true) → "이전에 이미 받은 엔딩" 안내, real_gems 0

F. StoryPlayerStatsHud.tsx
   props: { stats: StoryPlayerStats }
   · 페이지 상단 고정 HUD
   · 6 stat (체력/집중/기술/가드/투지/리스펙트) 를 작은 게이지 + 숫자로
   · 스토리 XP, 링 코인 별도 표시
   · 색상: 체력 빨강 / 집중 노랑 / 기술 파랑 / 가드 회색 / 투지 주황 / 리스펙트 보라

G. StorySceneShell.tsx
   props: { children: ReactNode; bgmHint?: string; backgroundTheme?: string }
   · 16:9 또는 4:3 비주얼 박스, 안쪽에 children
   · 배경은 backgroundTheme 별 그라디언트 (gym/ring/master_room/...)
   · 모바일 우선: mx-auto w-full max-w-md (태블릿 max-w-xl)

H. StoryWorldOverview.tsx (월드맵 보존판)
   · 기존 StoryWorldMap / StoryWorldMapVisual 을 이 신규 컴포넌트가 감싸서, "현재 씬이 진행 중인 챕터 = 강조" 로직만 추가
   · 챕터 노드 클릭 시 onSelectChapter(chapterCode) — StoryRpgPage 가 받아서 progress_to_scene 으로 점프 (단, 이미 잠금 해제된 챕터에 한해)

═══════════════════════════════════════════════════════════════════
5. StoryRpgPage 리팩터
═══════════════════════════════════════════════════════════════════

기존 페이지의 영역:
  · header (보존)
  · protection notice (보존)
  · route select (보존, 단 `useChooseStoryRoute` 성공 시 startStorySession 도 같이 호출)
  · world map (StoryWorldOverview 로 교체)
  · dialog box (StoryScenePlayer 가 흡수)
  · quest actions (제거)
  · chapter progress (제거 — 월드맵 강조로 대체)
  · battle screen (StoryBattleEngine 으로 교체)
  · victory overlay (보존, 단 챕터 클리어 시점 → 챕터 마지막 씬이 ending 이면 미사용 / 일반 챕터 보스 클리어 시점에 한 번만 표시)
  · reward panel (보존, 다만 표시 데이터를 StoryPlayerStats / StoryInventoryItem 기반으로 교체)

신규 페이지 상태 머신 (단일 useState mode):
  type StoryRpgMode =
    | { kind: "loading" }
    | { kind: "no_route" }                 // 루트 선택 전
    | { kind: "prologue"; sceneIndex: number }
    | { kind: "world" }                     // 월드맵 + 가벼운 stats hud
    | { kind: "scene"; routeId: string; chapterId: string | null; sceneIndex: number }
    | { kind: "battle"; enemyCode: string; chapterId: string }
    | { kind: "ending"; routeId: string; endingCode: string }
    | { kind: "ending_claimed"; result: EndingCompleteResult }

진입 흐름:
  1. useStorySession 결과 도착
  2. prologue_completed === false → mode = "prologue" + sceneIndex 0
  3. prologue_completed === true && active_route_code === null → mode = "no_route" → 라우트 선택 UI
  4. active_route_code 있음 → mode = "world"
  5. 월드맵 챕터 클릭 → progressToScene → 첫 씬 받기 → mode = "scene"
  6. scene 렌더 → 다음 씬 인덱스에 따라 mode 전환
     · scene.scene_type === "battle" → mode = "battle"
     · scene.scene_type === "ending" → mode = "ending"
     · 그 외 → 같은 chapter 안에서 sceneIndex 증가
  7. battle onVictory → progressToScene(next_scene_victory) → mode = "scene"
     battle onDefeat → 같은 챕터의 패배 분기 (next_scene_defeat) 로 progressToScene → mode = "scene"
  8. ending onClaimed → mode = "ending_claimed" → 보상 요약 + "월드맵으로" 버튼 → mode = "world"

레이아웃:
  · 전체 mx-auto max-w-md md:max-w-xl lg:max-w-2xl px-4 py-6
  · 상단: StoryRpgPageHeader + StoryPlayerStatsHud
  · mode 별 컴포넌트 한 개만 렌더 (배경 그라디언트는 StorySceneShell 이 담당)
  · 하단 상시: "← 월드맵으로" 또는 "← 그만두기" 작은 버튼 (전투 중에는 숨김)

protection notice: 기존 그대로 페이지 맨 아래에 1번만 표시 ("이 모드의 보상은 게임 내 재화이며 공식 XP / 미션과 무관합니다").

═══════════════════════════════════════════════════════════════════
6. 폐기 처리
═══════════════════════════════════════════════════════════════════

다음 컴포넌트는 페이지에서 import 제거 → 사용처 0건 확인 후 파일 삭제 (또는 빈 default export + JSDoc deprecated 안전 모드):

  · src/components/story-rpg/StoryQuestActions.tsx  -- 운동 액션 버튼 (사용처 없음 확인 후 삭제)
  · src/components/story-rpg/StoryChapterProgress.tsx
  · src/components/story-rpg/StoryChapterCard.tsx
  · src/components/story-rpg/StoryBattleScreen.tsx  -- StoryBattleEngine 으로 교체
  · src/components/story-rpg/StoryWorldNode.tsx     -- StoryWorldMapVisual 안에서 다시 정의되지 않으면 보존
  · src/components/story-rpg/StoryObstacleBadge.tsx -- 사용처 확인 후 결정

훅:
  · useSyncStoryProgress / useClaimStoryReward — 호출처 제거 후 hooks 파일에서 export 삭제
  · syncStoryChapterProgress / claimStoryChapterReward — service 에서 export 삭제

타입:
  · StoryChapterSyncEntry / StorySyncResult / StoryChapterProgressDetail / StoryRewardResult — 사용처 0건이면 삭제, 아니면 deprecated JSDoc

데이터:
  · src/data/storyRpgCopy.ts 의 STORY_NOT_COMPLETE_BODY / STORY_ALREADY_CLAIMED_BODY 등 — 신규 흐름에서 다시 쓰는 메시지면 보존, 아니면 정리

═══════════════════════════════════════════════════════════════════
7. 비주얼/모션 가이드
═══════════════════════════════════════════════════════════════════

· 폰트: 본문 system-ui / 제목 'PFStardust', 'NeoDunggeunmo', monospace fallback (기존 retro 톤 유지)
· 컬러: 기존 토큰 (--story-amber / --story-deep-blue / --story-respect-violet) 사용. 새 토큰 추가 금지.
· 타자기: useEffect 안 setInterval 30ms; 한 글자씩 substr; 중간 탭 시 즉시 풀텍스트
· 페이드: framer-motion variants { initial: opacity 0 y 8, animate: opacity 1 y 0, exit: opacity 0 y -8, transition: 0.25s }
· 데미지 숫자: 적 위 -20 ~ -50 떠오른 후 0.6s 페이드 아웃; 색은 normal=흰색, weakness 적중=노랑, critical=빨강
· 적 흔들리기: 피격 시 0.2s, x: [-4, 4, -3, 3, 0]
· 카드 사용 모션: 0.4s scale [1, 1.15, 1] + 빛 번짐 (mix-blend-mode: lighten)

═══════════════════════════════════════════════════════════════════
8. 에러/엣지 케이스
═══════════════════════════════════════════════════════════════════

· 비로그인 → 페이지 진입 차단 (기존 경로 보존)
· startStorySession 실패 → toast.error + 빈 stats fallback, route select 단계로
· progressToScene 실패 → toast.error, 같은 씬 유지 (재시도 버튼)
· submitPlayerCommand 가 "no_active_battle" → battle_state 가 깨졌을 가능성. startBattle 재호출 옵션 제공
· 보스 전투 패배 시 hp_max 의 50% 까지만 회복 + 챕터 시작점으로 sceneIndex 점프 (server 측 로직 — UI 는 결과만 따라간다)
· completeEnding already_claimed=true → 보상 표시 0 + "이전에 받은 엔딩" 안내 + 월드맵 복귀
· 인벤토리 카드 사용 시 count = 0 이 되면 카드 disabled 처리
· focus 가 0 일 때 카운터 / 오삼이 조언 비활성

═══════════════════════════════════════════════════════════════════
9. 빌드/검증 체크리스트
═══════════════════════════════════════════════════════════════════

작업 끝나고:

1. npx tsc --noEmit  → 0 error
2. bun run build       → "✓ built in …"
3. grep 자기검열:
   · grep -R "ChatAssistant\|chat-assistant" src/components/story-rpg src/services/storyRpgService.ts src/hooks/useStoryRpg.ts src/pages/StoryRpgPage.tsx
     → 0 hit
   · grep -R "approve_mission_submission\|record_attendance" src/components/story-rpg src/services/storyRpgService.ts src/hooks/useStoryRpg.ts src/pages/StoryRpgPage.tsx
     → 0 hit
   · grep -R "member_progress\|member-progress" src/components/story-rpg src/services/storyRpgService.ts src/hooks/useStoryRpg.ts src/pages/StoryRpgPage.tsx
     → 0 hit
   · grep -R "wallet\|fight_money" src/components/story-rpg src/services/storyRpgService.ts src/hooks/useStoryRpg.ts src/pages/StoryRpgPage.tsx
     → useCompleteEnding 의 wallet invalidate 1줄만 허용 (실제 update 0건)
   · grep -R "syncStoryChapterProgress\|claimStoryChapterReward" src/
     → service 파일에 deprecated stub 만 (혹은 0 hit)
4. 새 마이그레이션 0개:
   · ls supabase/migrations/*independent* → 1개만 (Stage 45 의 20260707000000_*.sql)
5. 손스모크 시나리오 (개발자 콘솔에서 수동):
   · 신규 계정 로그인 → 스토리 RPG 진입 → 프롤로그 4 씬 → 마스터 루트 선택 → 챕터 1 첫 씬 ~ 게으름 슬라임 전투 → 잽 5번 → 승리 → 카드 획득 → 다음 씬 진행
   · 챔피언 루트 잠금 상태에서 카드 클릭 → "잠금" 메시지
   · 엔딩 직전까지 진행 → completeEnding → real_gems +N 실제 wallet 반영 (운영 환경에서 테스트 시 grant_gems 가 실제 fight_money 갱신)

═══════════════════════════════════════════════════════════════════
10. 작업 순서 (의존도 정렬)
═══════════════════════════════════════════════════════════════════

1) types/storyRpg.ts append (Stage 46 신규 타입 9개 묶음)
2) services/storyRpgService.ts 8 신규 함수 + 마스터 reader 4개 + 에러 매핑 추가
3) hooks/useStoryRpg.ts 신규 hook 11개 추가, deprecated stub 처리
4) StorySceneShell / StoryPlayerStatsHud (가장 leaf)
5) StoryChoicePanel
6) StoryInventoryPanel
7) StoryScenePlayer (dialogue/choice/node_move 분기, battle/ending 은 placeholder 로 시작)
8) StoryBattleEngine
9) StoryEndingCutscene
10) StoryWorldOverview (기존 월드맵 wrap)
11) StoryRpgPage 리팩터 (mode 머신)
12) 폐기 컴포넌트 삭제
13) tsc / build / grep 자기검열
14) 손스모크 (개발자 본인이 1회는 돌려본다)

═══════════════════════════════════════════════════════════════════
11. 커밋 메시지 (작업 완료 후)
═══════════════════════════════════════════════════════════════════

feat(story-rpg): 독립형 게임 UI 구현 (46단계) — Scene Player / 턴제 전투 / 인벤토리 / 엔딩 컷씬

변경 파일 (예상):
- src/types/storyRpg.ts — Scene/Enemy/Card/PlayerStats/Inventory/Progress/Ending 타입 묶음
- src/services/storyRpgService.ts — RPC 8 + 마스터 reader 4 + 에러 매핑
- src/hooks/useStoryRpg.ts — 신규 hook 11
- src/components/story-rpg/StoryScenePlayer.tsx (신규)
- src/components/story-rpg/StoryChoicePanel.tsx (신규)
- src/components/story-rpg/StoryBattleEngine.tsx (신규)
- src/components/story-rpg/StoryInventoryPanel.tsx (신규)
- src/components/story-rpg/StoryEndingCutscene.tsx (신규)
- src/components/story-rpg/StoryPlayerStatsHud.tsx (신규)
- src/components/story-rpg/StorySceneShell.tsx (신규)
- src/components/story-rpg/StoryWorldOverview.tsx (신규, 기존 월드맵 wrap)
- src/components/story-rpg/StoryQuestActions.tsx (삭제)
- src/components/story-rpg/StoryChapterProgress.tsx (삭제)
- src/components/story-rpg/StoryChapterCard.tsx (삭제)
- src/components/story-rpg/StoryBattleScreen.tsx (삭제)
- src/pages/StoryRpgPage.tsx — mode 머신 기반 전면 리팩터

이유: Stage 45 에서 DB/RPC 가 독립형 게임 형태로 재설계되었으므로, Stage 41~43A 의 운동 의존 UI 를 씬 기반 게임 UI 로 교체. 보호 영역 (member_progress / 공식 XP / wallet 직접 update / ChatAssistant) 모두 미수정.

확인:
- npx tsc --noEmit ✓
- bun run build ✓
- grep 자기검열 ✓ (보호 영역 호출 0건)
- 손스모크: 프롤로그 → 마스터 루트 챕터 1 → 게으름 슬라임 전투 → 카드 획득 → 다음 씬 ✓

═══════════════════════════════════════════════════════════════════
주의 (절대 하지 말 것)
═══════════════════════════════════════════════════════════════════

1. 새 supabase/migrations/*.sql 만들지 말 것 — Stage 45 가 최종.
2. src/integrations/supabase/types.ts 직접 수정 금지 — service 안에서 sbRpc cast 로 우회.
3. 새 ChatAssistant / chat-assistant Edge / 다른 LLM 엔드포인트 호출 금지.
4. wallet 테이블 직접 update 금지 (real_gems 보상은 RPC 안 grant_gems 가 처리하고 우리는 invalidate 만).
5. member_progress 직접 SELECT 또는 UPDATE 금지.
6. 새 challenge / 새 mission 시스템 만지지 말 것.
7. 디자인 토큰 새로 만들지 말 것 — 기존 storyRpgVisuals.ts 토큰만 재사용.
8. 컴포넌트를 하나의 거대 파일로 합치지 말 것 — 위 분할 유지.
9. localStorage / sessionStorage 사용 금지 — 모든 상태는 React state + React Query.
10. console.log 흩어두지 말 것 — DEV 가드 (`if (import.meta.env.DEV)`) 안에서만.

지금부터 위 순서대로 작업해. 작업 완료 후 마지막에 변경 파일 목록 + tsc/build 결과 + grep 결과 보고.
```

---

## Stage 46 가 끝난 뒤

| 단계 | 내용 | 결과물 |
|---|---|---|
| 47 | (옵션) 시각 자산 강화 — 적 SVG 11종 + 카드 일러스트 9종 + 엔딩 컷씬 배경 3종 | `src/components/story-rpg/visuals/*` |
| 48 | (옵션) BGM/SE 톤 매핑 — bgm_hint 별 짧은 chiptune (외부 무료 라이선스 또는 자체 생성) | `public/audio/story-rpg/*` |
| 49 | (옵션) 게임 모드 통계 페이지 — 회원이 본 엔딩 / 보유 카드 컬렉션 viewer | `src/pages/StoryRpgCollectionPage.tsx` |
| 50 | QA 회귀 + LiveBoard 격리 검증 | `docs/153-story-rpg-stage46-qa.md` |

47~50 은 각각 다시 실행 프롬프트로 분리해서 진행한다.

---

## 빠른 손스모크 가이드 (운영 반영 후)

1. https://my-boxer-153.app (혹은 로컬 dev) 로그인
2. 좌측 메뉴 → "153 스토리 RPG" 진입
3. 프롤로그 4 씬 — 타자기 효과 / "다음" 클릭 정상
4. 라우트 선택 → "마스터 로드" 클릭
5. 월드맵 → 챕터 1 ("첫 글러브") 클릭
6. dialogue 씬 통과 → choice 씬에서 "잽" 선택 → stat_change 로 hp/skill 변동 확인
7. battle 씬 → 게으름 슬라임 등장 → 잽 4~5회 → 승리 → 카드 "첫 글러브" 획득 알림
8. 인벤토리 패널 열기 → 카드 1장 보임
9. 챕터 클리어 → 월드맵으로 자동 복귀, 챕터 1 = 클리어 표시
10. 챔피언 로드 카드 클릭 → "잠금" 안내 (마스터 클리어 전)

손스모크 통과 시 git push → Lovable 동기화 → Cloudflare Pages 배포 완료까지 2~4분 대기.
