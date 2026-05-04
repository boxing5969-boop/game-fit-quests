# 153 스토리 RPG — Stage 41 프롬프트 (옵션 A: 모바일 캐주얼 게임화)

> Claude Code 에 그대로 복붙해서 실행하세요.

---

## 사용법

1. Claude Code 열기
2. 아래 코드 블록 전체 복사 (`너는 지금부터...` 부터 마지막 줄까지)
3. 붙여넣기 → 실행
4. 완료되면 빌드 + push (문서 끝부분 명령 참고)

---

## Stage 41 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"를 진짜 모바일 캐주얼 RPG 게임처럼 시각화하는 시니어 게임 UI 개발자다.

이번 작업은 41단계다.
목표는 33~40단계에서 만든 "복서의 길" 페이지를 텍스트 + 카드 위주에서 → 비주얼 RPG 게임 (월드맵 캐릭터 이동, 적과의 전투, 타이프라이터 대화, 승리 연출) 으로 업그레이드하는 것이다.

이번 단계는 시각 + 인터랙션 강화 작업이다.
DB 스키마 변경 X, 새 RPC 추가 X, 공식 시스템 무관.

가장 중요한 보호 원칙 (이전 단계와 동일):
1. levels / missions / mission_videos / mission_submissions / member_progress 미수정.
2. approve_mission_submission / record_attendance 호출 금지.
3. 공식 XP 미지급. member_progress 일절 미수정.
4. 파이트 머니는 grant_gems 경유.
5. 기존 ChatAssistant 외 새 AI 챗봇 만들지 않음.
6. 환세취호전 / 실존 복서 / 영화 / 만화 / 실제 명언 사용 금지.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- approve_mission_submission
- record_attendance
- useManualLevelUp
- usePassBossBattle
- MissionsPage
- RankUpPage
- ChatAssistant
- supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정
- 새 supabase migration 추가 금지 (이번 단계는 UI만)

수정 가능한 파일:
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg/* (기존 파일 수정 + 새 파일 추가)

이번 단계에서 새로 만들 파일:
- src/components/story-rpg/StoryBattleScreen.tsx
- src/components/story-rpg/StoryVictoryOverlay.tsx
- src/components/story-rpg/StoryObstacleCreature.tsx
- src/components/story-rpg/StoryWorldMapVisual.tsx
- src/components/story-rpg/StoryHpBar.tsx
- src/components/story-rpg/StoryBackgroundScene.tsx (선택)

이번 단계에서 업그레이드할 파일:
- src/components/story-rpg/StoryDialogBox.tsx (타이프라이터 + 다음 버튼)
- src/components/story-rpg/StoryWorldMap.tsx (StoryWorldMapVisual 래퍼)
- src/pages/StoryRpgPage.tsx (전투 모달 통합)

필요 라이브러리:
- framer-motion (기존 프로젝트에 있음)
- 새 라이브러리 추가 금지

═══════════════════════════════════════════════════════════════════
설계 — 게임 플로우
═══════════════════════════════════════════════════════════════════

[루트 미선택]
  ↓
[3개 카드 표시] (기존 StoryRouteSelect — 그대로 유지)
  ↓ 선택
[월드맵 + 캐릭터 표시] (NEW StoryWorldMapVisual)
  ↓ 현재 챕터 노드 탭
[챕터 인트로 대화] (UPGRADE StoryDialogBox — 타이프라이터)
  ↓ "도전하기" 클릭
[전투 화면] (NEW StoryBattleScreen, 풀스크린 모달 z-[80])
  ├─ 공격: 챌린지 → 챌린지 1회 클리어
  ├─ 방어: 일기 → 챔피언 일기 1개 쓰기
  ├─ 도구: 퀴즈 → 복싱 IQ 1문제
  └─ 응원: 세컨드 → 응원 1회 보내기
  ↓ 선택지 클릭 → 해당 페이지 navigate
  ↓ 사용자 활동 후 돌아옴
  ↓ sync_story_chapter_progress 호출
  ↓ 적 HP 비율 감소 (조건 달성률 기반)
[조건 모두 충족 시]
  ↓
[승리 연출] (NEW StoryVictoryOverlay)
  ↓ "보상 받기"
[claim_story_chapter_reward] → +XP, +파이트머니, 칭호, 카드
  ↓
[월드맵 복귀, 다음 챕터 노드 unlock]

═══════════════════════════════════════════════════════════════════
파일별 구현 가이드
═══════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────
1. StoryHpBar.tsx (NEW)
────────────────────────────────────────────────────────
HP 막대 — 현재값/최대값 + 색상 그라디언트.

Props:
- currentHp: number
- maxHp: number
- variant?: "player" | "enemy" (색상 구분)
- showNumbers?: boolean (기본 true)
- size?: "sm" | "md" | "lg"
- label?: string

스타일:
- 둥근 막대 (rounded-full)
- HP 0~30%: red, 30~60%: yellow, 60~100%: emerald (player) / red (enemy)
- 부드러운 채워짐 애니메이션 (framer-motion)
- 숫자 tabular-nums

────────────────────────────────────────────────────────
2. StoryObstacleCreature.tsx (NEW)
────────────────────────────────────────────────────────
8가지 장애물 SVG creature. props: code (obstacle_code), state ("idle" | "hurt" | "defeated"), size.

각 creature 디자인:
- lazy_slime (게으름 슬라임): 녹색 둥근 블롭 + 졸린 눈 + 흘러내리는 침
- guard_breaker (가드 브레이커): 빨간 화난 사각형 + 균열 + 분노 표정
- breath_holder (숨참기 유령): 반투명 흰 유령 + 가운데 공기 X 표시
- excuse_goblin (핑계 도깨비): 초록 도깨비 + 손가락 가리키는 포즈
- compare_monster (비교 괴물): 보라 + 여러 눈 (3~5개) + 질투 표정
- tense_wolf (긴장 늑대): 회색 늑대 + 송곳니 + 식은땀
- quit_demon (포기 악마): 검은 악마 + 빨간 뿔 + "ㅠ" 입
- overtrain_golem (과훈련 골렘): 회색 돌 거인 + 균열 + 피곤한 눈

각 SVG 사이즈:
- sm: 80px
- md: 140px
- lg: 200px

state 별 애니메이션 (framer-motion):
- idle: 살짝 호흡 (scale [1, 1.02, 1] 2.4s)
- hurt: 빨강 깜빡임 + shake (x: [-5, 5, -5, 0], 0.4s)
- defeated: 회전 + 페이드아웃 + 점점 작아짐

스타일은 Tailwind + inline SVG. 외부 이미지 X.

────────────────────────────────────────────────────────
3. StoryWorldMapVisual.tsx (NEW)
────────────────────────────────────────────────────────
세로형 월드맵 — 노드들이 길로 연결되어 있고 캐릭터가 현재 위치에 표시.

Props:
- nodes: StoryNode[] (active route 의 chapter 들이 사용하는 nodes)
- chapters: StoryChapter[] (현재 route)
- currentChapterNumber: number
- completedChapterCount: number
- userPhoto?: ReactNode (라이센스 photo 우선순위 결과)
- onChapterTap: (chapter) => void

레이아웃:
- 모바일 우선 — 세로 스크롤
- 노드 사이 곡선 SVG path 로 연결 (지그재그 배치)
- 노드 = 60~80px 둥근 카드 (icon + 챕터 번호)
- 현재 노드 = 노란 글로우 + 캐릭터(OsamMascot 또는 사용자 photo) 위에 떠있음
- 완료 노드 = 초록 체크
- 잠금 노드 = 회색 + 🔒
- 잠금 노드는 클릭해도 안 움직임

배경:
- 단순 다크 그라디언트 + 떠다니는 별/입자 (LiveBoardEmptyState 와 비슷한 톤)

캐릭터 애니메이션:
- 현재 노드에서 통통 튐 (y: [0, -6, 0] 2.4s)
- 챕터 클리어 시 다음 노드로 이동 애니메이션 (path animation)

────────────────────────────────────────────────────────
4. StoryDialogBox.tsx (UPGRADE)
────────────────────────────────────────────────────────
타이프라이터 효과 + "다음" 버튼.

Props:
- speaker: string (기본 "오삼이")
- body: string
- onComplete?: () => void (모든 대화 끝났을 때)
- choices?: { label: string, onClick: () => void }[]
- portraitNode?: ReactNode (왼쪽에 표시할 캐릭터)

동작:
- 마운트 시 body 를 한 글자씩 타이핑 (40ms 간격)
- 타이핑 중 탭하면 즉시 전체 표시
- 타이핑 끝나면 "▼ 다음" 깜빡임
- 선택지 있으면 타이핑 끝난 후 표시

스타일:
- 검은 base + 노란 border (기존 톤 유지)
- 화면 하단 sticky
- portrait (좌측 작은 OsamMascot 또는 photo)
- speaker 이름 (yellow uppercase)
- body (white, leading-relaxed)
- "▼" 깜빡임 (opacity [0.3, 1, 0.3] 1s)

────────────────────────────────────────────────────────
5. StoryBattleScreen.tsx (NEW) — 핵심
────────────────────────────────────────────────────────
풀스크린 모달 (z-[80]) 전투 화면.

Props:
- chapter: StoryChapter
- progressDetail: progress jsonb (sync_story_chapter_progress 결과의 chapter detail)
- userPhoto?: ReactNode
- onClose: () => void
- onClaimReward: () => void (조건 충족 후 호출)

레이아웃:
- 상단: "⚔ ROUND N" 제목 + 닫기 버튼
- 좌측: 플레이어 (OsamMascot 또는 사용자 photo + HP 바)
- 우측: 적 (StoryObstacleCreature + HP 바)
- 가운데: 펀치 효과 임시 표시 영역
- 하단: 4개 액션 버튼 그리드 (2x2)

HP 매핑:
- 적 HP = 100% 시작
- 챕터의 completion_condition 의 required_total 을 계산
- progressDetail.have_total / required_total 비율을 100 - HP 로 매핑
- 예: required_total=10, have_total=7 → 적 HP 30%

플레이어 HP:
- 단순히 streak / motivation 기반으로 표시 (member_progress.streak_days 가 있으면 활용)
- 또는 항상 100% (게임 동기 부여)

4개 액션 버튼:
1. ⚔ 공격 — 챌린지 1회 클리어 → /home (오늘의 미션) 으로 navigate
2. 🛡 방어 — 챔피언 일기 쓰기 → /missions 또는 일기 페이지로 navigate
3. 🧠 도구 — 복싱 IQ 풀기 → quiz modal/page (기존 기능 재활용)
4. 👏 응원 — 세컨드 응원 → /home 의 cheer 영역

각 버튼:
- 아이콘 + 라벨
- 부제: 현재 진행도 (예: "챌린지 2/5")
- 클릭 → 해당 페이지 navigate (StoryQuestActions 의 동작 재활용)
- 적 HP 가 이미 0% 면 비활성

전투 효과:
- 액션 클릭 시 펀치 애니메이션 (motion + emoji 💥)
- 적 HP 감소 시 hurt state + 빨강 깜빡임
- 적 HP 0% → defeated state + onClaimReward 콜백

배경:
- 어두운 boxing ring 느낌 (단순 SVG: 둥근 링 + 코너 포스트 4개)

────────────────────────────────────────────────────────
6. StoryVictoryOverlay.tsx (NEW)
────────────────────────────────────────────────────────
챕터 클리어 풀스크린 축하.

Props:
- chapter: StoryChapter
- rewardResult: { quest_xp_granted, gems_granted, reward_title, reward_card_code }
- onClose: () => void

레이아웃:
- 풀스크린 z-[90]
- 상단: 큰 "VICTORY!" 골드 그라디언트 (text-7xl)
- 가운데: 캐릭터 celebrate 애니 (OsamMascot state="celebrate")
- 보상 카드들:
  - +N QUEST XP
  - +N 파이트 머니
  - 🏆 칭호: ... (있으면)
  - 🎴 카드: ... (있으면)
- 하단: "다음 챕터로" 또는 "닫기" 버튼

효과:
- canvas-confetti 발사 (양쪽 + 가운데, 3-stage)
- 골드 글로우 펄스
- 챕터 제목 + "내 복서의 이야기가 다음 장으로 넘어갑니다."

────────────────────────────────────────────────────────
7. StoryRpgPage.tsx (UPGRADE)
────────────────────────────────────────────────────────
기존 흐름 유지 + 전투 모달 통합.

state 추가:
- battleChapter: StoryChapter | null
- victoryResult: rewardResult | null

흐름:
- 루트 선택 후 → StoryWorldMapVisual 렌더
- 노드 탭 → 챕터 정보 노출 (기존 StoryChapterCard)
- "도전하기" 클릭 → battleChapter 설정 → StoryBattleScreen 모달 표시
- 전투 중 액션 → 해당 페이지 navigate (StoryRpgPage 떠남)
- 다시 돌아왔을 때 → useStoryRpg 자동 sync → 적 HP 감소 반영
- 조건 충족 + claim 성공 → victoryResult 설정 → StoryVictoryOverlay 표시
- 닫기 → 월드맵 복귀, 다음 챕터 노드 unlock

자동 sync:
- 페이지 mount 시 syncStoryChapterProgress 한 번 호출
- battleChapter null 일 때 visibility change 또는 focus 시 자동 sync

────────────────────────────────────────────────────────
8. StoryBackgroundScene.tsx (선택, 시간 되면)
────────────────────────────────────────────────────────
node 별 SVG 배경 일러스트.
필수 아님. 시간 부족하면 단순 그라디언트로 대체.

═══════════════════════════════════════════════════════════════════
디자인 톤 가이드
═══════════════════════════════════════════════════════════════════

색감:
- 다크 base (검은/네이비 그라디언트)
- 골드/노란 액센트 (153 브랜드)
- 액션은 emerald, 적은 red

폰트:
- 기존 마이복서153 폰트 유지
- 게임감 줄 때만 큰 글씨 + uppercase + tracking-wider

애니메이션 원칙:
- 너무 화려하지 않게 (모바일 60fps 유지)
- spring transition 선호 (damping 18~22, stiffness 200~240)
- 60초 이상 떠있는 화면은 GPU 가속 사용

모바일 우선:
- 모든 요소 터치 영역 ≥ 44px
- 텍스트 최소 12px
- swipe gesture 적극 활용

═══════════════════════════════════════════════════════════════════
기존 시스템과 분리
═══════════════════════════════════════════════════════════════════

데이터:
- 모든 입력: useStoryRpg / useStoryRpgState 결과
- 보상: claimStoryChapterReward (기존 RPC)
- 진행도 sync: syncStoryChapterProgress (기존 RPC)
- 활동 데이터: 읽기만 (boxing_quiz_attempts 등)

새 RPC / 마이그레이션 X. 모든 게임 로직은 클라이언트 시각화.

═══════════════════════════════════════════════════════════════════
검증
═══════════════════════════════════════════════════════════════════

1. /story-rpg 진입 가능
2. 루트 선택 후 월드맵 + 캐릭터 표시
3. 캐릭터 통통 튐 애니메이션 정상
4. 챕터 노드 탭 → 챕터 정보 + "도전하기"
5. "도전하기" → 전투 화면 (모달)
6. 전투 화면에 적 SVG creature 표시
7. 적 HP 가 챕터 진행률 반영
8. 4개 액션 버튼 → 해당 페이지로 navigate
9. 다시 돌아오면 진행도 sync + 적 HP 감소
10. 조건 충족 + claim → VICTORY 풀스크린 + 컨페티
11. 보상 표시 (XP, 파이트머니, 칭호, 카드)
12. 다음 챕터 노드 unlock
13. 공식 시스템 무관 (member_progress 변동 0)
14. bun run build 통과

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. 게임 플로우 요약
3. 8가지 장애물 creature SVG 디자인 요약
4. 적 HP 매핑 공식
5. 전투 액션 → 페이지 매핑
6. 공식 시스템 보호 방식
7. bun run build 결과
8. git diff --stat 결과
```

---

## Stage 41 완료 후 — push 명령

```powershell
cd C:\Users\82104\game-fit-quests
```

```powershell
bun run build
```

빌드 통과 후:

```powershell
git add src/components/story-rpg
```

```powershell
git add src/pages/StoryRpgPage.tsx
```

```powershell
git status
```

(예상: 8~10 신규 파일 + 2~3 수정)

```powershell
git commit -m "feat(story-rpg): 모바일 캐주얼 RPG 게임화 (41단계) — 전투 + 월드맵 + 타이프라이터 + VICTORY 연출"
```

```powershell
git push origin main
```

---

## 푸시 후 확인 체크리스트

Cloudflare Pages 빌드 (~2-4분) 완료 후 `/story-rpg`:

1. ✅ 루트 선택 후 → 새 월드맵 (캐릭터가 노드 위에 떠있음, 통통 튐)
2. ✅ 노드 탭 → 챕터 정보 카드
3. ✅ "도전하기" → 전투 화면 풀스크린
4. ✅ 적 캐릭터 SVG (게으름 슬라임 등) 보임
5. ✅ HP 바 양쪽 표시
6. ✅ 4개 액션 버튼 (공격/방어/도구/응원)
7. ✅ 액션 클릭 → 해당 페이지 navigate
8. ✅ 활동 후 돌아오면 자동 sync, 적 HP 감소
9. ✅ 조건 충족 → "VICTORY!" + 컨페티 + 보상 표시
10. ✅ 다음 챕터 노드 unlock

만약 Stage 41 끝나도 부족하다고 느끼면 Stage 42, 43 으로 더 정교화 가능 (배경 일러스트, 사운드, 애니메이션 강화 등).
