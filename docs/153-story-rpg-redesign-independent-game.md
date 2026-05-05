# 153 스토리 RPG — 독립형 게임으로 재설계

> 회원이 실제 운동을 해야 클리어되는 모드 → **앱 안에서 바로 플레이 가능한 독립형 레트로 RPG** 로 방향 전환.

---

## 1. 기존 설계에서 바꿔야 할 점

### A. DB 레벨 (변경 필요)

| 기존 | 새 방향 |
|---|---|
| `boxing_story_chapters.completion_condition` jsonb 가 운동 데이터 (quiz_correct_total, challenge_clear_total, journal_total, cheer_sent_total, engagement_quest_xp) 임계값으로 챕터 클리어 판정 | **씬 시퀀스 / 보스전 결과** 로 클리어 판정. completion_condition 은 게임 전용 조건으로 의미 변경 |
| `_story_chapter_progress` 헬퍼가 boxing_quiz_attempts / boxing_fun_challenge_attempts / champion_journal_entries / boxing_cheers / boxing_engagement_profiles 를 읽어서 진행률 계산 | 이 헬퍼는 **사용 중단** — 게임 자체 저장 데이터 (boxing_story_game_saves) 만 읽음 |
| `sync_story_chapter_progress(p_route_code text)` RPC 가 운동 데이터 동기화 | **삭제 또는 폐기** — 게임은 자체 진행을 가짐 |
| `claim_story_chapter_reward(p_chapter_id uuid)` RPC 가 운동 조건 충족 확인 후 grant_gems 호출 | **재작성** — 게임 엔딩 클리어 시 1회 한정 소량 보상으로 변경 |

### B. UI 레벨 (변경 필요)

| 기존 | 새 방향 |
|---|---|
| `StoryBattleScreen` 의 4 액션 버튼 (공격/방어/도구/응원) 이 외부 페이지 (`/home`, `/missions`) 로 navigate | **게임 안에서 턴제 전투** — 잽/가드/풋워크/카운터/오삼이 조언 5 명령. navigate X. |
| `StoryQuestActions` 컴포넌트 — 외부 QUEST 기능으로 연결 버튼 | **삭제 또는 재용도** — 게임 클리어 후 "추천 운동 가기" 단일 진입점으로 |
| `StoryChapterProgress` — 운동 활동 카운터 (퀴즈 N/M, 챌린지 N/M) 표시 | **씬 진행도** (현재 씬 / 총 씬, 보스 HP) 로 변경 |
| 자동 visibilitychange/focus sync (운동 후 돌아오면 진행도 갱신) | **삭제** — 게임은 자체 저장만 |

### C. 보존할 것

- `boxing_story_routes` (3루트 메타) — 그대로
- `boxing_story_chapters` (18챕터 메타) — 그대로 (단, completion_condition 의미 변경)
- `boxing_story_nodes` (10 월드맵 노드) — 그대로
- `boxing_story_dialogues` (43A 에서 추가될 ~100 대사) — 게임 내 씬에서 활용
- `StoryRpgPage` — 컨테이너로 유지, 내부 흐름만 게임화
- `StoryWorldMapVisual` — 노드 시각화 그대로
- `OsamMascot` — 주인공/조언자
- `StoryDialogBox` — 타이프라이터 등 그대로

---

## 2. 새 독립형 RPG 구조

```
[프롤로그 씬] (1회만, 게임 처음 시작 시)
  ↓
[루트 선택 화면]
  ├─ 마스터의 길
  ├─ 프로의 길
  └─ 챔피언 로드
  ↓
[게임 시작]
  ↓
챕터 1
  ├─ 1. 오삼이 인트로 대화 (씬 1)
  ├─ 2. 맵 노드 이동 (예: 체육관 입구 → 거울 앞)
  ├─ 3. NPC 등장 또는 사건 (예: 강 관장 등장)
  ├─ 4. 선택지 (대화 분기 — 결과는 능력치 ± 또는 인벤토리 변화)
  ├─ 5. 턴제 전투 (예: 게으름 슬라임)
  ├─ 6. 보상 (스토리 XP + 링 코인 + 가끔 카드/칭호)
  └─ 7. 다음 장 예고
  ↓
챕터 2 ~ 6 (동일 구조)
  ↓
[챕터 6 = 최종 보스전]
  ↓
[엔딩 씬]
  ├─ 마스터의 길 → "마스터의 문" 보스 → 마스터 후보 엔딩
  ├─ 프로의 길 → "루틴 파괴자" 보스 → 프로 루틴 후보 엔딩
  └─ 챔피언 로드 → "처음의 나 / 비교 괴물" 보스 → 챔피언 정신 엔딩
  ↓
[엔딩 후 화면]
  ├─ 다른 루트 시작
  ├─ 같은 루트 다시 (보상 X — 한 번만)
  └─ 추천 운동 가기 (선택, 외부 navigate — 강요 X)
```

플레이타임:
- 1 챕터 = 7~12분
- 1 루트 (6 챕터) = 60~75분
- 3 루트 전체 = 3~4시간

---

## 3. 게임 클리어 조건

### 챕터 클리어:
1. 모든 씬 (대화/이동/선택지/전투) 완료
2. 보스(또는 미니 적) HP 0 만들기
3. 다음 장 예고 화면에서 "다음 챕터" 클릭

### 루트 클리어:
1. 6번째 챕터 = 최종 보스 격파
2. 엔딩 씬 끝까지 시청
3. 엔딩 배지 자동 획득

### 게임 100% 클리어:
1. 3개 루트 모두 엔딩 도달
2. (선택) 모든 스토리 카드 수집
3. (선택) 숨겨진 엔딩 분기 조건 만족

**중요: 실제 운동 무관.** 회원이 게임만으로 모든 콘텐츠 진행 가능.

---

## 4. 전투 시스템

### 플레이어 명령 (5종)

| 명령 | 효과 | 비용 |
|---|---|---|
| **잽** | 빠른 기본 공격 (낮은 데미지, 100% 적중) | 집중 -1 |
| **가드** | 다음 턴 받는 피해 50% 감소 | 없음 |
| **풋워크** | 다음 턴 적 공격 회피율 +50% | 집중 -1 |
| **카운터** | 적이 공격 시 강한 반격 (높은 데미지). 적이 방어/풋워크 시 실패 | 집중 -2 |
| **오삼이 조언** | 힌트 또는 집중 +3 회복 (회당 1회) | 없음 |

### 적 패턴 예시 (8 obstacle)

각 적은 고유 패턴:
- **게으름 슬라임**: 매 턴 50% 확률 sleep (자기 차례 스킵), 50% 약한 공격
- **가드 브레이커**: 3턴 차지 후 가드 무시 강공격
- **숨참기 유령**: 회피율 높음 — 풋워크 안 통함, 카운터 강함
- **손목꺾임 괴물**: 잽 받으면 반격 (잽 사용 위험)
- **포기 악마**: 매 턴 플레이어 집중 -1 도용
- **핑계 도깨비**: 가끔 "다음 턴 쉬자" 유혹 — 거절 선택지
- **긴장 늑대**: 첫 턴 강력, 후반 약화
- **비교 괴물**: 플레이어 능력치 복사 후 사용
- **과훈련 골렘**: HP 매우 높음 (지구전), 데미지 낮음
- **침묵의 코너**: 공격 안 함, 매 턴 X 동안 버텨야 클리어 (시간 도전)

### 능력치 (게임 시작 시 기본값)

| 능력치 | 기본 | 상한 | 영향 |
|---|---|---|---|
| 체력 (HP) | 100 | 200 | 0 되면 패배 (재시작) |
| 집중 (MP) | 10 | 30 | 일부 명령에 소비 |
| 기술 | 10 | 50 | 잽/카운터 데미지 |
| 가드 | 10 | 50 | 가드 명령 효과 |
| 투지 | 10 | 50 | 회피/카운터 트리거 확률 |
| 리스펙트 | 0 | 100 | NPC 호감도, 일부 분기 잠금 해제 |

씬 / 선택지 / 보스 클리어 시 능력치 ± 변화. 예:
- 강 관장 옆에서 묵묵히 줄넘기 → 가드 +2, 리스펙트 +5
- 박 선배 인사 후 정중히 받기 → 리스펙트 +3
- 민지에게 도움 주기 → 리스펙트 +5

### 보스전 (각 루트 6번째 챕터)

| 루트 | 최종 보스 | 특징 |
|---|---|---|
| 마스터의 길 | **마스터의 문** | 거대한 황금 문. 회원이 가르친 동작이 다시 자기에게 옴 (mirror attack). 리스펙트 80+ 필요. |
| 프로의 길 | **루틴 파괴자** | 매 턴 플레이어 능력치 1개 무작위 - 효과 발동. 가드/풋워크로 버티며 잽 누적. |
| 챔피언 로드 | **처음의 나 / 비교 괴물** | 2 페이즈. 1페이즈는 처음 시작 때의 자기 모습 (약함), 2페이즈는 비교 괴물 진화형 (강함). 카운터 활용 핵심. |

---

## 5. 게임 전용 재화 / 보상

### 게임 내 재화 (실제 파이트 머니와 분리)

| 재화 | 용도 | 획득 |
|---|---|---|
| **스토리 XP** | 능력치 분배 포인트 | 챕터 클리어 / 보스 격파 |
| **링 코인** | 게임 내 상점 (회복 아이템, 임시 버프) | 전투 승리 / 선택지 |
| **스토리 카드** | 수집 + 인벤토리 (전투에서 1회 사용 가능한 강화 카드) | 챕터 보상 / 숨겨진 씬 |
| **루트 칭호** | 프로필에 표시되는 게임 전용 칭호 | 루트 엔딩 클리어 |
| **엔딩 배지** | 명예의 전당과 별개의 게임 배지 | 루트 엔딩 도달 |

### 실제 파이트 머니 (운영 wallet)

**제한적으로만 지급:**
- 루트 **최초** 엔딩 클리어 시 **1회성 소량** (예: 200~500 GEMS)
- 같은 루트 재플레이 시 0
- 다른 루트 클리어 시 또 1회 가능
- **3 루트 합산 최대 1,500 GEMS** — 무한 획득 차단

### 공식 XP / member_progress

**일절 미지급. 미수정.**

---

## 6. 기존 시스템 보호 방식

### 절대 수정 금지 (이전 단계와 동일)
- levels / missions / mission_videos / mission_submissions / member_progress
- approve_mission_submission / record_attendance
- ChatAssistant / supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- allLevelsData / whiteLevel1Data / sharedConstants 공식 훈련 데이터

### 분리 전략

1. **DB 분리** — 모든 게임 저장은 boxing_story_game_* 새 테이블. member_progress / wallet 미수정.
2. **재화 분리** — 스토리 XP, 링 코인은 게임 전용 컬럼. user_wallets.gems 직접 update X.
3. **운영 wallet 통합 한 군데만** — 루트 최초 엔딩 시 grant_gems RPC 1회 호출.
4. **읽기 전용 통합** — 회원 캐릭터 (avatar/character_preset) 와 공식 리그/레벨 read-only 표시.

---

## 7. DB / RPC 변경안

### 신규 테이블 (boxing_story_game_*)

```sql
-- 게임 전체 저장 (회원당 1행)
boxing_story_game_saves (
  user_id uuid PK,
  active_route_code text,
  prologue_completed boolean DEFAULT false,
  story_xp integer DEFAULT 0,
  ring_coins integer DEFAULT 0,
  stat_hp integer DEFAULT 100,
  stat_focus integer DEFAULT 10,
  stat_skill integer DEFAULT 10,
  stat_guard integer DEFAULT 10,
  stat_grit integer DEFAULT 10,
  stat_respect integer DEFAULT 0,
  inventory jsonb DEFAULT '{}'::jsonb,  -- card_code → count
  collected_cards jsonb DEFAULT '[]'::jsonb,
  earned_titles jsonb DEFAULT '[]'::jsonb,
  earned_endings jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at, updated_at
)

-- 루트별 진행 (회원 × 루트)
boxing_story_game_route_progress (
  id uuid PK,
  user_id uuid,
  route_id uuid,
  current_chapter_number integer DEFAULT 1,
  current_scene_index integer DEFAULT 0,
  completed_chapters jsonb DEFAULT '[]'::jsonb,  -- chapter_number 들
  ending_reached boolean DEFAULT false,
  ending_code text,  -- "master_candidate" / "pro_routine" / "champion_spirit"
  first_clear_at timestamptz,
  last_played_at timestamptz,
  play_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (user_id, route_id)
)

-- 씬 정의 (각 챕터의 시퀀스)
boxing_story_game_scenes (
  id uuid PK,
  chapter_id uuid REFERENCES boxing_story_chapters(id),
  scene_index integer,  -- 0, 1, 2, ...
  scene_type text,  -- "dialogue" | "choice" | "battle" | "node_move" | "ending"
  payload jsonb,    -- type 별 다른 구조 (dialogue 는 speaker+body, battle 은 enemy_code+stats)
  next_scene_index integer,  -- choice 의 경우 분기는 payload.choices 안에
  active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (chapter_id, scene_index)
)

-- 적 정의 (전투 마스터 데이터)
boxing_story_game_enemies (
  code text PK,  -- "lazy_slime", "guard_breaker" 등
  name text,
  description text,
  hp integer,
  attack integer,
  defense integer,
  pattern_code text,  -- "random_sleep_50", "charge_3turn_breakguard" 등
  weakness jsonb,     -- {"jab": false, "counter": true, ...}
  reward_story_xp integer,
  reward_ring_coins integer,
  reward_card_code text,
  is_boss boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
)

-- 전투 로그 (디버그/QA 용, 영구 저장 X — 7일 후 정리)
boxing_story_game_battle_log (
  id uuid PK,
  user_id uuid,
  enemy_code text,
  chapter_id uuid,
  turn_number integer,
  player_command text,
  enemy_action text,
  player_hp_after integer,
  enemy_hp_after integer,
  result text,  -- "ongoing" | "victory" | "defeat"
  created_at timestamptz
)

-- 엔딩 클리어 이력 (idempotency)
boxing_story_game_ending_claims (
  id uuid PK,
  user_id uuid,
  route_id uuid,
  ending_code text,
  story_xp_granted integer,
  ring_coins_granted integer,
  real_gems_granted integer,  -- 최초 1회 소량
  reward_title text,
  reward_card_code text,
  claimed_at timestamptz,
  UNIQUE (user_id, route_id, ending_code)
)
```

### 신규 RPC

| RPC | 입력 | 출력 | 동작 |
|---|---|---|---|
| `start_story_game()` | — | 신규 game_save 생성 | 처음 게임 시작 시 |
| `get_my_story_game_state()` | — | save + route_progress + 현재 씬 | UI 진입 시 호출 |
| `choose_story_game_route(route_code)` | route_code | active_route_code 갱신 + 챕터 1 시작 | 루트 선택 |
| `progress_story_scene(scene_id, choice_index)` | scene_id, optional choice | 다음 씬 + 능력치/인벤토리 변동 | 씬 진행 |
| `resolve_story_battle_turn(enemy_code, command, target_data)` | enemy_code, "잽"/"가드"/etc, 게임 상태 | turn 결과 (HP 변동, status, victory/ongoing/defeat) | 전투 1턴 |
| `claim_story_game_reward(route_id, ending_code)` | route_id, ending_code | story_xp + ring_coins + (최초만) real_gems via grant_gems | 엔딩 보상 |
| `save_story_game_state(state)` | jsonb | OK | 자동 저장 |
| `reset_story_route(route_id)` | route_id | 해당 루트 진행 초기화 (보상 이력 보존) | 다시 플레이 |

### 기존 RPC 처리

| 기존 RPC | 처리 |
|---|---|
| `get_my_story_rpg_state()` | **유지** — 라우트/챕터/노드/대사 메타데이터 반환 (게임 데이터는 새 RPC 사용) |
| `choose_story_route(p_route_code)` | **deprecated** — 새 `choose_story_game_route` 사용 권장 |
| `change_story_route(p_route_code)` | **deprecated** — 새 `choose_story_game_route` 사용 |
| `sync_story_chapter_progress(p_route_code)` | **삭제 권장** — 운동 데이터 의존성 사라짐 |
| `claim_story_chapter_reward(p_chapter_id)` | **삭제 권장** — 새 `claim_story_game_reward` 사용 |
| `_story_chapter_progress(...)` 헬퍼 | **삭제** — 운동 데이터 미사용 |

---

## 8. 필요한 UI 컴포넌트

### 신규
1. **StoryGamePrologueScene** — 게임 첫 시작 씬 (153복싱짐 입구, 오삼이 등장)
2. **StoryGameRouteIntroScene** — 루트 선택 후 인트로 컷씬
3. **StorySceneRenderer** — 씬 type 별 렌더 (dialogue / choice / battle / node_move / ending)
4. **StoryChoiceMenu** — 선택지 메뉴 (능력치/리스펙트 변동 미리보기)
5. **StoryTurnBattleScreen** (기존 StoryBattleScreen 대체) — 진짜 턴제 전투
   - 5 명령 버튼 (잽 / 가드 / 풋워크 / 카운터 / 오삼이 조언)
   - 적 패턴 시각화
   - 데미지 숫자 floating
   - 능력치 표시 (HP / 집중)
6. **StoryStatusPanel** — 현재 능력치 + 인벤토리
7. **StoryInventoryPanel** — 스토리 카드 / 아이템
8. **StoryEndingScene** — 루트 엔딩 풀스크린 컷씬
9. **StoryGameSaveIndicator** — 자동 저장 표시 (모서리 아이콘)
10. **StoryGameMenu** — 일시정지 / 저장 / 종료 / 환경설정

### 수정
- **StoryRpgPage** — 게임 모드 entry, 새 컴포넌트들로 교체
- **StoryWorldMapVisual** — 노드 이동 시 캐릭터 walk 애니메이션
- **StoryDialogBox** — 게임 씬 안에서 사용 (그대로 활용)
- **StoryRpgEntryCard** (홈) — "153 스토리 RPG 게임 시작" 으로 카피 변경

### 삭제 또는 deprecated
- StoryQuestActions (외부 페이지 navigate 용도) — 삭제
- StoryChapterProgress (운동 카운터) — 삭제
- StoryChapterCard (운동 조건 표시) — 삭제 또는 게임 챕터 카드로 재작성

---

## 9. 구현 순서 (Stage 별 분리)

### Stage 44 — 설계 문서 + 게임 시나리오 작성 (코드 X)
**산출물:** `docs/153-story-rpg-game-scenario.md`
- 18 챕터 × 평균 8 씬 = ~150 씬 시나리오 (대화/선택지/전투/이동)
- 각 선택지의 능력치 변동 정의
- 8 적 + 3 보스의 정확한 stats / 패턴
- 3 엔딩의 풀스크린 컷씬 시나리오
- 시간: ~3-4시간 (스토리 작가 작업)

### Stage 45 — DB 재설계 + 새 마이그레이션
**산출물:** 새 supabase migration
- 7 신규 테이블 생성 (boxing_story_game_*)
- 기존 sync/claim RPC deprecated/삭제
- 8 신규 RPC
- 시드: scenes (~150) + enemies (10) + 능력치 변동표
- 시간: ~3-4시간

### Stage 46 — UI: Scene 렌더러 + 턴제 전투
**산출물:**
- StoryGamePrologueScene + RouteIntroScene
- StorySceneRenderer (5 type 분기)
- StoryTurnBattleScreen (5 명령)
- StoryChoiceMenu
- StoryStatusPanel + InventoryPanel
- StoryEndingScene
- StoryRpgPage 새 흐름 통합
- 시간: ~5-6시간

### Stage 47 — 게임 밸런싱 + QA
**산출물:**
- 1 루트 풀 플레이 테스트 (60-75분)
- 적 stats 조정 (너무 어려움/쉬움)
- 능력치 변동 균형 (overflow/underflow 방지)
- 엔딩 컷씬 임팩트 검증
- 시간: ~2-3시간

### Stage 48 — 시각 강화 (선택)
- 8-bit 폰트 / 픽셀 스타일
- 사운드 효과 (Web Audio chiptune)
- 화면 흔들림 / 데미지 임팩트
- 시간: ~3-4시간

총 예상: **16-21시간** (Stage 44~47, 48 포함 시 +3-4시간)

---

## 10. 진행 결정

위 설계대로 진행하시려면 **"진행"** 이라고 답해주시면 Stage 44 (게임 시나리오 작성) prompt 부터 만들겠습니다.

**다른 옵션:**
- **"43A 결과 먼저 확인"** — 진행하던 43A (감동 대사 추가) 끝내고 그 다음 재설계
- **"일부 수정"** — 위 설계 중 어떤 부분 바꿀지 알려주시면 반영
- **"간소화"** — 능력치/인벤토리/적 패턴 등 간단하게 (시간 단축)

---

## 우려 사항 (체크해주세요)

1. **43A 작업 (이미 진행 중)** — DB seed 100~130 dialogue 추가는 새 게임 모드에서도 그대로 활용 가능. 버려지지 않음. 단, 일부 dialogue (예: 전투 buff/debuff 안내) 는 게임 흐름에 맞게 추가 보강 필요.

2. **기존 boxing_story_chapters.completion_condition** — 운동 조건이 들어있는데, 새 모드에선 게임 조건으로 의미 변경. 기존 데이터는 그대로 두고 신규 컬럼 추가 또는 metadata.game_completion_condition 으로 분리 권장.

3. **Cloudflare Pages 빌드 시간** — 새 컴포넌트가 많아서 빌드 시간 + 번들 크기 증가 가능. lazy loading 권장 (이미 React Router lazy 적용 중).

4. **게임 저장 성능** — 매 씬마다 DB save 하면 부하. localStorage 우선 + 챕터 끝날 때만 DB save 하는 패턴 권장.

5. **턴제 전투 RPC 응답 속도** — 매 턴마다 RPC 왕복하면 답답. 클라이언트 시뮬레이션 + 결과만 서버 검증 패턴 권장 (단, 상태 조작 우려 — 보상 RPC 에서 최종 검증 필요).

---

답변 주시면 바로 다음 단계 진행합니다.
