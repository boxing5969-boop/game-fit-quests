# 153 스토리 RPG 구현 계획

> **단계 33** — 기능 구현 전 설계 / 충돌 분석 문서. 이번 단계에서는 코드/마이그레이션/컴포넌트를 만들지 않는다.

---

## 1. 기능 정의

**153 스토리 RPG**는 마이복서153 앱 안에 새로 추가되는 **별도 게임 모드**다.

- 메뉴명: **153 스토리 RPG**
- 화면 제목: **복서의 길**
- 라우트 후보: `/story-rpg`

회원은 체육관에 처음 온 신입으로 시작하고, 이후 다음 3가지 "복서의 길" 중 하나를 선택해 자신의 복싱 인생을 RPG처럼 풀어간다.

1. **마스터의 길** — 회원에서 복싱 지도자 후보로 성장하는 서사
2. **프로의 길** — 회원에서 프로복서 루틴 후보로 성장하는 서사
3. **챔피언 로드** — 회원에서 챔피언의 정신을 완성하는 서사

핵심 정의:
> 153 스토리 RPG는 기존 시스템을 바꾸는 기능이 아니라, **기존 캐릭터와 QUEST 활동을 읽어서** 회원의 복서 인생을 RPG 처럼 보여주는 보조 게임 모드다.

---

## 2. 기존 시스템과 분리되는 구조

마이복서153 앱은 다음 3개 축으로 구성된다. 153 스토리 RPG는 **세 번째 축**으로 추가되며, 1·2축의 데이터를 **읽기만** 한다.

```
마이복서153
├─ ① 마스터로드        → 공식 1~40레벨 성장 (수정 금지)
├─ ② 153 QUEST        → 퀴즈/챌린지/일기/응원/시즌/카드 (수정 금지)
└─ ③ 153 스토리 RPG   → 복서의 길 (이번에 추가)
       ├─ 마스터의 길
       ├─ 프로의 길
       └─ 챔피언 로드
```

**분리 원칙:**
- 공식 XP ↔ QUEST XP ↔ 스토리 RPG 진행도는 서로 다른 영역으로 유지
- 스토리 RPG는 ①·②의 성공 이벤트를 **소비(read-only)**만 한다
- 스토리 보상은 공식 XP가 아니다 (QUEST XP / 파이트 머니 / 칭호 / 카드 / 진행도)

---

## 3. 공식 1~40레벨 보호 원칙

1. 공식 1~40레벨 훈련 리스트는 수정하지 않는다.
2. `levels`, `missions`, `mission_videos`, `mission_submissions`, `member_progress` 테이블은 수정하지 않는다.
3. 공식 XP와 QUEST XP는 계속 분리한다.
4. 스토리 RPG는 공식 레벨업, 승급, 보스전 조건에 직접 영향을 주면 안 된다.
5. 스토리 RPG는 공식 미션을 자동 완료하지 않는다.
6. 스토리 RPG는 공식 보스전을 자동 통과시키지 않는다.
7. `member_progress.total_xp`를 update 하지 않는다.
8. 파이트 머니는 직접 update 하지 않고 기존 `grant_gems` 또는 서버 검증 RPC를 통해서만 지급한다.
9. 기존 `ChatAssistant` 외에 새 AI 챗봇을 만들지 않는다.
10. 오삼이 대화는 **정적 스토리 대사 / 데이터 카드**로만 구현한다 (LLM 호출 없음).
11. 기존 `/challenges` 21일 챌린지와 충돌하지 않는다.
12. 실존 복서, 영화, 만화, 실제 명언, 경기 영상은 seed 데이터에 넣지 않는다.

**절대 수정 금지 파일/심볼:**
- DB: `levels`, `missions`, `mission_videos`, `mission_submissions`, `member_progress`
- RPC: `approve_mission_submission`, `record_attendance`
- Hook: `useManualLevelUp`, `usePassBossBattle`, `useWallet`
- Page: [src/pages/MissionsPage.tsx](src/pages/MissionsPage.tsx), [src/pages/RankUpPage.tsx](src/pages/RankUpPage.tsx)
- Component: [src/components/ChatAssistant.tsx](src/components/ChatAssistant.tsx)
- Edge: [supabase/functions/chat-assistant/](supabase/functions/chat-assistant/)
- Service: [src/services/challengeService.ts](src/services/challengeService.ts)
- Data: `allLevelsData`, `whiteLevel1Data`, `sharedConstants`의 공식 훈련 데이터
- 기존 [src/pages/ChallengesPage.tsx](src/pages/ChallengesPage.tsx) 21일 챌린지

---

## 4. 3가지 서사 구조

### A. 마스터의 길 (master_path)

> 회원에서 복싱 지도자 후보로 성장. 키워드: 기본기, 책임감, 후배, 지도자의 눈.

| # | 코드 | 제목 |
|---|---|---|
| 1 | `master_01_first_glove` | 첫 글러브 |
| 2 | `master_02_basic_wall` | 기본기의 벽 |
| 3 | `master_03_repeat_room` | 반복의 방 |
| 4 | `master_04_new_member` | 후배의 등장 |
| 5 | `master_05_trainer_eye` | 지도자의 눈 |
| 6 | `master_06_master_test` | 마스터 테스트 |

### B. 프로의 길 (pro_path)

> 회원에서 프로복서 루틴 후보로 성장. 키워드: 루틴, 체력, 실전 감각, 자기관리.

| # | 코드 | 제목 |
|---|---|---|
| 1 | `pro_01_hobby_start` | 취미반의 시작 |
| 2 | `pro_02_routine_birth` | 루틴의 탄생 |
| 3 | `pro_03_first_spar_tension` | 첫 스파링의 긴장 |
| 4 | `pro_04_stamina_wall` | 체력의 벽 |
| 5 | `pro_05_my_style` | 나의 스타일 |
| 6 | `pro_06_pro_routine_test` | 프로 루틴 테스트 |

### C. 챔피언 로드 (champion_road)

> 회원에서 챔피언의 정신으로 성장. 키워드: 도전, 그림자 복서, 라이벌, 시즌 완주.

| # | 코드 | 제목 |
|---|---|---|
| 1 | `champ_01_contender_gate` | 도전자의 문 |
| 2 | `champ_02_shadow_boxer` | 그림자 복서 |
| 3 | `champ_03_rival_match` | 라이벌 매칭 |
| 4 | `champ_04_fight_camp` | 파이트 캠프 |
| 5 | `champ_05_last_round` | 마지막 라운드 |
| 6 | `champ_06_champion_night` | 챔피언 나이트 |

**총 챕터 수: 18개 (3루트 × 6챕터)**

---

## 5. 월드맵 노드 구조

레트로 RPG식 월드맵 — 체육관 안의 위치를 노드로 표현한다.

| 코드 | 제목 | node_type | 주로 등장하는 루트 |
|---|---|---|---|
| `gym_entrance` | 체육관 입구 | gym | 모든 루트 1챕터 |
| `mirror_zone` | 거울 앞 | mirror | 마스터/프로 초반 |
| `rope_zone` | 줄넘기 존 | rope | 프로 체력 챕터 |
| `sandbag_zone` | 샌드백 존 | sandbag | 프로/챔피언 |
| `ring` | 링 | ring | 프로/챔피언 후반 |
| `corner` | 코너 | corner | 마스터의 길 (후배) |
| `boxing_hall` | 복싱 전당 | hall | 챔피언 로드 마지막 |
| `master_room` | 마스터룸 | master_room | 마스터의 길 마지막 |
| `fight_camp` | 파이트 캠프 | camp | 챔피언 로드 |
| `rival_arena` | 라이벌 아레나 | rival_arena | 챔피언 로드 |

**총 10개 노드.**

---

## 6. RPG 대화창 구조

- **화자(speaker)**: 기본 `오삼이`. (다른 NPC 추가 시 별도 코드 부여)
- **dialogue_type**: `intro` / `progress` / `complete` / `locked` / `reward` / `boss`
- **대사는 정적 텍스트** — Edge Function · LLM 호출 없음
- **선택지(choices)**: jsonb 배열. 각 선택지는 callback 또는 라우트 이동 의미.
  - 예: "오늘의 퀘스트 보기" → `/missions`
  - 예: "복싱 IQ 풀기" → `BoxingAcademyQuizModal` 오픈
  - 예: "챌린지 아레나" → `FunChallengeArenaSheet` 오픈
  - 예: "보상 확인" → 챕터 보상 패널

**저작권 회피:**
- 환세취호전 캐릭터/명칭/이미지/대사 절대 사용 금지
- 실존 복서/영화/만화/명언 금지
- 모든 대사는 마이복서153 자체 카피로 직접 작성

**예시 대사 (자체 카피):**
- "오늘도 링이 열렸습니다."
- "처음 글러브를 낀 날, 모든 동작은 어색합니다. 하지만 복싱은 완벽한 시작이 아니라 반복으로 만들어집니다."
- "오늘의 상대는 남이 아닙니다. 어제의 나입니다."
- "이번 상대는 사람이 아닙니다. 나를 멈추게 하는 습관입니다."
- "지도자의 눈은 남을 평가하는 눈이 아니라, 안전하게 성장하도록 돕는 눈입니다."

---

## 7. 기존 QUEST 활동과 연결 방식

### 챕터 완료 조건 — 기존 활동 데이터를 **읽기만** 한다

| 활동 | 소스 테이블/훅 (확인 필요) | 연결 챕터 예시 |
|---|---|---|
| 복싱 IQ 퀴즈 | `boxing_quiz_attempts` / `useBoxingIqLeague` | 마스터 02·05, 챔피언 01 |
| 재미 챌린지 | `boxing_fun_challenge_attempts` / `useBoxingFunChallenges` | 모든 루트 |
| 챔피언 일기 | `champion_journal_entries` / `useChampionJournal` | 마스터 01·03·05, 챔피언 05 |
| 세컨드 응원 | `boxing_cheers` / `useSecondCheer` | 마스터 04·05, 챔피언 03 |
| 컨디션 게이지 | `boxing_condition_logs` / `useBoxingCondition` | 프로 02 |
| 리턴 라운드 | `useReturnRound` | 보조 fallback |
| 숨겨진 미션 | `useHiddenMissions` | 마스터 06, 챔피언 05 |
| 그림자 복서 | `useShadowBoxer` | 챔피언 02 |
| 코너맨 | `useCornerman` | 마스터 04 보조 |
| 짐 레이드 | `useGymRaid` | 챔피언 04 보조 |
| 스타일 진단 | `useBoxerStyleDiagnosis` | 프로 05 |
| 카드 수집 | `boxing_user_collectible_cards` (있으면) | 마스터 06, 챔피언 06 |
| 라이벌 시즌 | (있으면) | 챔피언 03 |
| 시즌 파이트 캠프 | (있으면) | 챔피언 04 |
| 오삼이 라디오 | (있으면) | 보조 fallback |
| 블랙 트레이너 | (있으면) | 보조 fallback |

**Graceful fallback:** 존재하지 않는 테이블은 RPC가 silent skip 하고 **QUEST XP / 챌린지 횟수 / 일기 개수** 같은 보편 지표로 대체한다.

### 적/장애물 — 사람이 아니라 **습관**으로 표현

폭력적 사람 공격 구조 회피.

| 코드 | 이름 | 의미 |
|---|---|---|
| `lazy_slime` | 게으름 슬라임 | 시작을 미루는 마음 |
| `guard_breaker` | 가드 브레이커 | 자세 무너지는 습관 |
| `breath_holder` | 숨참기 유령 | 호흡 무시 |
| `wrist_break` | 손목꺾임 괴물 | 잘못된 펀치 자세 |
| `quit_demon` | 포기 악마 | 라운드 중간 포기 |
| `excuse_goblin` | 핑계 도깨비 | 안 가는 핑계 |
| `tense_wolf` | 긴장 늑대 | 스파링 공포 |
| `compare_monster` | 비교 괴물 | 남과 비교하는 마음 |
| `overtrain_golem` | 과훈련 골렘 | 부상 위험 |

---

## 8. 보상 구조

### 보상 종류 (공식 XP 아님)

| 종류 | 지급 방식 | 비고 |
|---|---|---|
| **QUEST XP** | `boxing_engagement_events` insert + `boxing_engagement_profiles` 업데이트 | 챕터당 +50~200 |
| **파이트 머니** | 기존 `grant_gems` RPC 경유 (직접 update 금지) | 챕터당 +100~500 |
| **스토리 카드** | `boxing_story_reward_claims.reward_card_code` | 일부 챕터만 |
| **칭호** | `boxing_story_reward_claims.reward_title` | 일부 챕터만 |
| **프로필 프레임** | metadata jsonb | 후속 단계 (보류 가능) |
| **RPG 챕터 진행도** | `boxing_user_story_progress` | 핵심 |
| **복싱 전당 전시** | 기존 `BoxingHallSummaryCard` 연동 | 기존 데이터 표시만 |

### 중복 방지

- `boxing_story_reward_claims`에 `unique(user_id, chapter_id)` 제약
- `boxing_engagement_events.idempotency_key` 병행

---

## 9. DB / RPC 후보

> 이번 33단계에서는 만들지 않는다. **34단계에서 생성.**

### 후보 테이블 (7개)

1. `boxing_story_routes` — 3루트 정의
2. `boxing_story_chapters` — 18챕터 정의
3. `boxing_story_nodes` — 10노드 정의
4. `boxing_story_dialogues` — 챕터별 오삼이 대사
5. `boxing_user_story_progress` — 회원별 루트 진행도 (루트당 1행)
6. `boxing_user_story_route_state` — 회원이 현재 active로 선택한 루트
7. `boxing_story_reward_claims` — 챕터 보상 수령 기록 (중복 방지)

### 후보 RPC (5개)

1. `get_my_story_rpg_state()` → routes / activeRoute / progress / chapters / nodes / dialogues / rewards
2. `choose_story_route(p_route_code text)` → 최초 루트 선택
3. `change_story_route(p_route_code text)` → 루트 변경 (기존 진행도 보존)
4. `sync_story_chapter_progress(p_route_code text)` → QUEST 활동 읽어 진행도 갱신
5. `claim_story_chapter_reward(p_chapter_id uuid)` → 보상 지급 (grant_gems 경유)

### RLS 원칙

- `boxing_story_routes/chapters/nodes/dialogues` (active=true) — 로그인 회원 SELECT 가능
- `boxing_user_story_progress/route_state/reward_claims` — 본인만 SELECT
- INSERT/UPDATE는 모두 RPC 경유 (SECURITY DEFINER)
- 직접 보상 insert는 차단

---

## 10. UI 삽입 위치

### 라우트 추가

- 새 라우트: `/story-rpg` → `StoryRpgPage`
- [src/App.tsx](src/App.tsx) 의 `lazy(...)` 블록과 `<Routes>` 안에 한 줄 추가

### 메뉴 진입점 (안전 모드)

| 위치 | 컴포넌트 | 비고 |
|---|---|---|
| **HomePage 내부 "더 보기" 영역** | `StoryRpgEntryCard` | 첫 화면 피로감 회피, 펼침 카드 |
| **MyPage** | optional 진행도 카드 | 후속 단계 |
| **BottomNav** | **추가 보류 권장** | 기존 메뉴 5~6개 + 코치 메뉴 → 7번째 슬롯은 정보 과부하. 36단계에서 안전성 검토 후 결정 |

### 페이지 구조 (StoryRpgPage)

```
┌─ 헤더: "복서의 길"
├─ 부제: 회원에서 지도자/프로복서/챔피언까지 이어지는 나만의 복싱 RPG
├─ StoryCharacterPanel (내 캐릭터 + 공식 리그/레벨 read-only)
├─ StoryRouteSelect (3카드 — 마스터/프로/챔피언)
│   └─ 선택 후 활성화: StoryRouteChangeDialog (변경 가능)
├─ StoryWorldMap (10노드 grid/카드)
│   └─ 현재 챕터 노드 강조
├─ StoryDialogBox (오삼이 대사 + 선택지)
├─ StoryChapterProgress (현재 루트 6챕터)
│   └─ 각 챕터: 조건/상태/보상/이동 버튼
├─ StoryRewardPanel (claim 가능 보상)
└─ StoryRpgProtectionNotice
   "공식 훈련은 마스터로드에서 그대로 진행됩니다.
    153 스토리 RPG는 QUEST 보조 게임 모드입니다."
```

---

## 11. 기존 파일과 충돌 가능성

### 잠재적 충돌 영역 ↔ 회피 전략

| 영역 | 충돌 가능성 | 회피 전략 |
|---|---|---|
| **공식 1~40 훈련** | 스토리 진행이 공식 미션을 트리거할 위험 | RPC 안에서 `missions` / `member_progress` write 절대 금지. 진행도 계산은 read-only |
| **공식 XP** | 보상이 `member_progress.total_xp`로 흘러갈 위험 | grant_gems 외에는 다른 RPC 호출 금지. 보상은 `boxing_engagement_*`만 사용 |
| **`/challenges` 21일** | 동일 챌린지가 두 시스템에서 카운트되면 혼란 | 스토리는 challenge 데이터를 **읽기만** 하고 별도 진행도로 계산. challengeService 수정 금지 |
| **`ChatAssistant`** | 새 챗봇 추가 유혹 | 오삼이 대화는 정적 dialogue 테이블 + UI. LLM 호출 없음. ChatAssistant 미수정 |
| **`useWallet`** | 파이트 머니 직접 update 유혹 | grant_gems RPC 경유. wallet table 직접 update 금지 |
| **BottomNav** | 메뉴 슬롯 부족 시 기존 메뉴 위치 변경 위험 | 36단계에서 BottomNav 직접 추가 보류. HomePage 카드 진입만 우선 |
| **`types.ts` 자동 생성** | Lovable이 generate 안 해주면 타입 오류 | 신규 테이블/RPC는 `as unknown as ...` / `from(... as never)` 우회를 service 파일 안에 좁게 한정 |
| **z-index 충돌** | StoryDialogBox modal이 BottomNav/ChatAssistant 위로 올라가야 함 | z-[70] 이상 사용 (기존 스플래시 z-[80] 회피) |
| **query key 충돌** | 기존 `["challenges"]`, `["wallet"]`, `["diet"]` 와 충돌 | 모두 `["story-rpg", ...]` prefix 사용 |
| **저작권** | 환세취호전 / 실존 선수 명칭 seed | 모든 카피를 자체 작성. seed에 외부 IP 금지. 40단계 grep 검증 |
| **마이그레이션 권한** | Lovable owner 권한 + 로컬 CLI 403 | Lovable 채팅 위임 또는 Supabase Dashboard SQL Editor 수동 실행 안내 |
| **빌드 청크 분리** | (memory: feedback_chunk_splitting) Radix/router를 React 본체와 분리하면 forwardRef undefined | 신규 컴포넌트는 기존 vite config 그대로 따라감. manualChunks 수정 금지 |

---

## 12. 충돌 방지 전략 (요약)

1. **스토리 RPG는 read-only 소비자.** 공식 시스템 데이터는 SELECT만, write는 자기 영역만.
2. **보상은 grant_gems 경유.** wallet 직접 update 금지.
3. **오삼이 대화는 정적.** LLM 호출 없음. ChatAssistant는 단일 경로 유지.
4. **query key prefix 분리.** `["story-rpg", ...]` 만 사용.
5. **모든 UI 컴포넌트는 `src/components/story-rpg/` 하위에 격리.**
6. **DB 테이블은 `boxing_story_*` prefix.** 기존 `boxing_engagement_*` 와 분리.
7. **BottomNav 변경 보류.** HomePage 카드 진입만 36단계에서 시작.
8. **저작권 회피 grep 검증.** 40단계에서 환세취호전/실존 선수 명칭 자동 검사.
9. **40단계 grep 가드:** `member_progress.update`, `wallets.update`, `approve_mission_submission`, `record_attendance` 신규 호출 0건 확인.

---

## 13. 단계별 구현 순서

| 단계 | 작업 | 수정 영역 |
|---|---|---|
| **33** | 본 설계 문서 작성 | `docs/153-story-rpg-plan.md` |
| **34** | DB/RPC 기반 (테이블 7 + RPC 5 + seed) | `supabase/migrations/YYYYMMDDHHMMSS_boxing_story_rpg_foundation.sql` |
| **35** | 서비스/훅/타입/정적 데이터 | `src/services/storyRpgService.ts` · `src/hooks/useStoryRpg.ts` · `src/data/storyRpgCopy.ts` · `src/data/storyRpgVisuals.ts` · `src/types/storyRpg.ts` |
| **36** | 메뉴/라우트/기본 페이지 | `src/App.tsx` · `src/pages/StoryRpgPage.tsx` · `src/components/story-rpg/StoryRpgEntryCard.tsx` · HomePage 최소 수정 |
| **37** | 3루트 선택 + 챕터 진행도 | `src/components/story-rpg/StoryRouteSelect.tsx` · `StoryRouteCard.tsx` · `StoryChapterProgress.tsx` · `StoryChapterCard.tsx` · `StoryRouteChangeDialog.tsx` |
| **38** | 월드맵 + 오삼이 대화창 + 캐릭터 패널 | `StoryWorldMap.tsx` · `StoryWorldNode.tsx` · `StoryDialogBox.tsx` · `StoryCharacterPanel.tsx` · `StoryObstacleBadge.tsx` · `StoryQuestActions.tsx` |
| **39** | QUEST 연결 + 보상 claim | `StoryRewardPanel.tsx` · sync 로직 · 필요 시 보정 migration |
| **40** | QA + 회귀 테스트 + 빌드 검증 | `docs/153-story-rpg-qa-regression-report.md` |

---

## 14. QA 체크리스트 (40단계 사용)

### A. 공식 1~40 훈련 시스템
- [ ] `/missions` 진입 정상
- [ ] 공식 미션 row / 영상 모달 / 제출 흐름 변경 없음
- [ ] 코치 승인 흐름 변경 없음
- [ ] 공식 훈련 리스트 데이터 변경 없음

### B. 공식 랭크업
- [ ] `/rank-up` 정상
- [ ] 보스전/타이틀매치 흐름 변경 없음

### C. 기존 QUEST
- [ ] 오삼이 브리핑 / 복싱 IQ / 재미 챌린지 / 챔피언 일기 / 세컨드 응원 / 복싱 전당 정상
- [ ] 컨디션 게이지 / 리턴 라운드 / 숨겨진 미션 / 스타일 진단 / 성장 리포트 정상
- [ ] 코너맨 / 그림자 복서 / 짐 레이드 / 시즌 / 카드 (있으면) 정상

### D. 153 스토리 RPG 신규
- [ ] `/story-rpg` 진입 가능
- [ ] HomePage 카드에서 진입 가능
- [ ] 캐릭터 패널 / 공식 리그·레벨 read-only 표시
- [ ] 3루트 선택 가능 / 변경 가능 / 기존 진행도 삭제 안 됨
- [ ] 6챕터 표시 / 상태 표시 / 월드맵 노드 / 오삼이 대화창
- [ ] 장애물이 습관/상태로 표현
- [ ] QUEST 활동 연결 / 보상 claim / 중복 보상 차단
- [ ] 공식 XP 지급 없음 / 미션 자동 완료 없음 / 보스전 자동 통과 없음

### E. 권리/안전
- [ ] 환세취호전 캐릭터/명칭/이미지/대사 0건
- [ ] 실존 선수/영화/만화/명언 seed 0건
- [ ] 폭력적 사람 공격 구조 없음 (적은 습관)
- [ ] 과훈련/통증 안전 문구 유지

### F. 보호 영역 grep
- [ ] `from("member_progress").update` 신규 0건
- [ ] `from("user_wallets|wallets").update` 신규 0건
- [ ] `rpc("approve_mission_submission")` 신규 호출 0건
- [ ] `rpc("record_attendance")` 신규 호출 0건
- [ ] `MissionsPage` / `RankUpPage` / `ChatAssistant` / `challengeService` / `useWallet` / `allLevelsData` / `whiteLevel1Data` / `sharedConstants` 변경 0건

### G. 빌드
- [ ] `bun run build` ✓
- [ ] 타입 에러 0건
- [ ] migration 적용 확인 SQL 통과 (routes 3 / chapters 18 / nodes 10 / dialogues ≥18)

---

## 15. 보류 기능과 후속 확장

### 33~40단계 안에서는 **하지 않음**

- BottomNav 직접 추가 (36단계에서 안전성 검토 후 결정)
- 프로필 프레임 시스템 (metadata jsonb로 자리만 잡고 후속)
- 라이벌 PvP 매칭 RPC (기존 라이벌 시즌이 이미 있으면 연결만)
- 캐릭터 의상 변경 / 스킨 시스템
- 코치/관리자용 스토리 통계 대시보드
- 공식 보스전 연계 시즌 이벤트
- 다국어 (한국어 단일)
- 푸시 알림 / 이메일

### 40단계 이후 후속 확장 아이디어

- 챕터별 인앱 사진/영상 업로드 (회원의 "복서의 일기" 갤러리)
- 카드 합성 / 컬렉션 메타게임
- 시즌별 한정 루트 (예: "신년 복서의 길")
- 코치가 회원 스토리를 읽고 코멘트 다는 기능
- 라이벌 매칭 자동화 (현재 active route 기반)

---

## 작업 완료 요약 (33단계 출력)

1. **생성한 문서**: [docs/153-story-rpg-plan.md](docs/153-story-rpg-plan.md)
2. **153 스토리 RPG 핵심 구조**:
   - 별도 게임 모드 (공식 시스템과 분리)
   - 3루트 × 6챕터 = 18챕터
   - 10개 월드맵 노드
   - 오삼이 정적 대화 (LLM 없음)
   - QUEST 활동 read-only 소비
3. **공식 시스템 보호 전략**:
   - 보호 영역 12개 절대 수정 금지
   - 보상은 `grant_gems` RPC 경유, wallet 직접 update 금지
   - 진행도 계산은 read-only
   - query key prefix `["story-rpg"]` 격리
   - 컴포넌트는 `src/components/story-rpg/` 격리
4. **필요한 DB/RPC 후보**: 7테이블 + 5 RPC (34단계)
5. **필요한 컴포넌트 후보**: StoryRpgPage + 12개 하위 컴포넌트 + 3 hook + 1 service + 2 data + 1 type
6. **다음 34단계 작업**:
   - `supabase/migrations/YYYYMMDDHHMMSS_boxing_story_rpg_foundation.sql` 생성
   - 7테이블 + RLS + 5 RPC + seed (3루트, 18챕터, 10노드, 18+ dialogue)
   - UI 미수정 / 공식 영역 미수정
   - Supabase SQL Editor 수동 실행 안내 포함
7. **git diff --stat**: `docs/153-story-rpg-plan.md` 1 file changed (신규)
