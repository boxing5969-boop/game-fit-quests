# 153 스토리 RPG — Stage 47A 프롬프트 (월드맵 + 씬 분위기 비주얼 오버홀)

> Claude Code 에 그대로 복붙. **DB 변경 0**, **컴포넌트 비주얼만** 손댄다. 90년대 한국 레트로 RPG 분위기를 web SVG/CSS/framer-motion 으로 재해석.

---

## 사용법

1. Claude Code 새 세션 열기
2. 아래 코드 블록 (` ``` ` 안) 전체 복사 → 실행
3. 작업 시간: ~5-7시간 (SVG 자산 다수 + 애니메이션)
4. `bun run build` ✓ 확인
5. 손스모크: 월드맵 진입 → 챕터 1 진입 → 프롤로그 + 챕터 1 첫 5씬 → 분위기 평가
6. 통과 시 git commit + push

---

## 디자인 톤 (참고용 — 출력에 직접 인용 금지)

- 90년대 한국 PC RPG 의 일반적 비주얼 톤: **딥 블루/네이비 배경** + **앰버/골드 강조** + **블러드 레드 임팩트** + **새벽 안개 / 등불 / 먼지 입자**
- 모티프: 조선/근대 한국 + 레트로 복싱 짐 (글러브 / 링 / 줄넘기 / 거울 / 샌드백) — 마이복서153 고유 IP 만 사용
- 텍스트 폰트: 기존 `PFStardust`/`NeoDunggeunmo` retro 픽셀 톤 유지
- 색 토큰: 기존 `--story-amber` / `--story-deep-blue` / `--story-respect-violet` 그대로 + 신규 토큰 1~2개만 추가

저작권 보호 절대 원칙:
- ❌ 환세취호권 / 창세기전 / 일본 / 외부 게임의 캐릭터·UI·아트·사운드를 직접 참조하거나 흉내내지 않는다
- ✅ 마이복서153 자체 IP (오삼이 / 강 관장 / 박 선배 / 민지 / 도훈 / 김 코치 / 한 챔피언) 만 사용
- ✅ "한국 90년대 PC RPG 의 일반 시각 언어 (레터박스, 캐릭터 포트레이트, 텍스트 박스 프레임)" 라는 추상 패턴은 사용 가능

---

## Stage 47A 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 의 비주얼/모션 오버홀을 담당하는 시니어 React 게임 UI 아티스트 + 애니메이터다.

이번 작업은 47A 단계다 (스토리 RPG 47단계의 첫 번째 부분).
목표:
1. 월드맵을 단순 색칠 카드 → 일러스트레이션 배경 + 패럴랙스 + 파티클 + 챕터 노드 SVG 아이콘으로 교체
2. 씬 플레이 단계의 분위기 강화: 배경 일러스트 (10 테마) + 캐릭터 포트레이트 (7명 × 3감정) + 타이프라이터 + 입모양 동기화 + 레터박스
3. DB 변경 0건 (Stage 45 의 단일 migration 그대로). 새 RPC 0건. 새 마이그레이션 0건.
4. ChatAssistant 호출 0건. wallet 직접 update 0건. member_progress 미수정.
5. 새 npm 패키지 추가 금지 (framer-motion / lucide-react / 기존 토큰 / Tailwind 만 사용)

가장 중요한 보호 원칙:
1. 새 supabase/migrations/*.sql 만들지 말 것
2. src/integrations/supabase/types.ts 직접 수정 금지
3. ChatAssistant / chat-assistant Edge Function / boxing SYSTEM_PROMPT 미수정
4. 기존 /challenges 21일 챌린지 / challengeService / useWallet / MissionsPage / RankUpPage / LiveBoardPage 미수정
5. localStorage / sessionStorage 사용 금지

절대 수정 금지:
- src/components/ChatAssistant.tsx
- supabase/functions/** (전체)
- supabase/migrations/** (전체)
- src/integrations/supabase/types.ts
- src/data/allLevelsData.ts / whiteLevel1Data / sharedConstants
- external/naver-talktalk/**

═══════════════════════════════════════════════════════════════════
0. 먼저 할 일 (Read 도구로 실제 파일 확인)
═══════════════════════════════════════════════════════════════════

1. src/components/story-rpg/StoryWorldOverview.tsx + StoryWorldMap.tsx + StoryWorldMapVisual.tsx + StoryWorldNode.tsx (현재 월드맵 구조)
2. src/components/story-rpg/StoryScenePlayer.tsx + StorySceneShell.tsx (현재 씬 렌더 구조)
3. src/data/storyRpgVisuals.ts (기존 색 토큰 / 비주얼 상수)
4. src/components/character/CharacterSprite.tsx (이미 있는 캐릭터 SVG 패턴 학습)
5. src/components/Osam.tsx 또는 OsamMascot 비슷한 파일 (오삼이 마스코트 SVG)
6. tailwind.config.ts (커스텀 토큰 확인)
7. docs/153-story-rpg-game-scenario.md 의 §6 NPC 설정 표 (강 관장 / 박 선배 / 민지 / 도훈 / 김 코치 / 한 챔피언 외형 묘사)

═══════════════════════════════════════════════════════════════════
1. 신규 비주얼 자산 디렉터리 구조
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/
  ├─ backgrounds/
  │   ├─ WorldMapBackdrop.tsx          // 3 루트 × 일러스트 배경
  │   ├─ SceneBackground.tsx           // 10 테마 (gym_entrance / mirror / ring / sandbag / corner / hall / master_room / camp / rival_arena / hidden_track)
  │   └─ BackgroundParallax.tsx        // 3 layer 패럴랙스 helper
  ├─ icons/
  │   ├─ ChapterNodeIcon.tsx           // 12 챕터 아이콘 (master 6 + pro 4 + champion 2 — Stage 44 시나리오 기준)
  │   └─ chapterIconMap.ts             // chapter.code → icon variant 매핑
  ├─ portraits/
  │   ├─ CharacterPortrait.tsx         // 8명 (오삼이 / 강 관장 / 박 선배 / 민지 / 도훈 / 김 코치 / 한 챔피언 / 플레이어)
  │   ├─ portraitData.ts               // 캐릭터별 SVG 정의 + 3 감정 (default/happy/serious/concerned/angry 중 3개)
  │   └─ MouthSync.tsx                 // 타이프라이터 진행 중 입 모양 토글
  ├─ effects/
  │   ├─ ParticleField.tsx             // dust / firefly / lantern / rain 4 종
  │   ├─ Letterbox.tsx                 // 상하 검은 바 페이드 인/아웃
  │   ├─ CameraShake.tsx               // 자식 요소를 흔들기 (impact 시)
  │   └─ FlashOverlay.tsx              // 화면 전체 플래시 (white/red/amber)
  └─ player/
      └─ PlayerWalker.tsx              // 월드맵 위 작은 복서 캐릭터 (3프레임 idle bob)

═══════════════════════════════════════════════════════════════════
2. WorldMapBackdrop — 3 루트 일러스트 배경
═══════════════════════════════════════════════════════════════════

props: { routeCode: 'master_path' | 'pro_path' | 'champion_road' | null }

각 루트별 SVG 일러스트 (가로 800 × 세로 600 기준, viewBox 로 반응형):

A. master_path (마스터의 길)
   - 새벽 도시 실루엣 + 등불 라인 + 안개 layer
   - 색감: deep navy → midnight purple gradient + amber lantern
   - 모티프: 체육관 / 거울 / 마스터의 문
   - SVG layers (back to front):
     · layer 1: 그라디언트 배경 (linear-gradient #0b0e2e → #1a1f4d)
     · layer 2: 산 실루엣 (path SVG, 어두운 navy)
     · layer 3: 도시 빌딩 실루엣 (사각형 + 창문 dot 들이 amber 로 깜박임)
     · layer 4: 안개 (semi-transparent ellipse 들, 천천히 흐름)
     · layer 5: 별 / 반딧불 (작은 circle 들, ParticleField 와 결합)

B. pro_path (프로의 길)
   - 새벽 링 + 줄넘기 그림자 + 떠오르는 태양
   - 색감: deep blue → dawn orange → gold gradient
   - 모티프: 링 / 샌드백 / 줄넘기 라인
   - SVG layers:
     · layer 1: 새벽 그라디언트 배경
     · layer 2: 떠오르는 태양 (반원 SVG, gold + amber radial gradient)
     · layer 3: 링 코너 기둥 silhouette 4 개
     · layer 4: 줄넘기 곡선 (애니메이션, 위아래로 흔들림)
     · layer 5: 먼지 입자

C. champion_road (챔피언 로드)
   - 폭풍 직전 하늘 + 거대한 그림자 (라이벌) + 레드 광선
   - 색감: deep blue + crimson red 임팩트
   - 모티프: 거대한 라이벌 실루엣 / 번개 / 군중
   - SVG layers:
     · layer 1: 어두운 하늘 그라디언트 (#000814 → #1a0a0a)
     · layer 2: 번개 (occasional flash, 5초 간격)
     · layer 3: 거대한 라이벌 silhouette (애매한 검은 형체)
     · layer 4: 군중 실루엣 (작은 사람 점들, 가로로 늘어진 line)
     · layer 5: 붉은 입자 (피 안개 느낌)

각 layer 는 framer-motion 의 motion.div / motion.path 로 천천히 흐르는 (-2px ~ +2px) 패럴랙스. mouse 위치를 받아 layer 마다 다른 강도 (-0.02x, -0.05x, -0.1x) 로 따라가게 한다. 선택: useMousePosition 커스텀 훅 src/hooks/useMousePosition.ts 추가 (raf 기반).

═══════════════════════════════════════════════════════════════════
3. ChapterNodeIcon — 12 챕터 아이콘
═══════════════════════════════════════════════════════════════════

props: { chapterCode: string; status: 'locked' | 'available' | 'cleared'; size?: 'sm'|'md'|'lg' }

Stage 44 시나리오 기준 12 챕터 (master_01~06 / pro_01~04 / champion_01~02):

| chapter_code | 아이콘 컨셉 |
|---|---|
| master_01_first_glove | 양 갈래 문 + 빛 새는 틈 (체육관 입구) |
| master_02_first_partner | 두 글러브 마주 (조심스러운 jab) |
| master_03_mirror_self | 직립 거울 + 흐릿한 자기 reflection |
| master_04_routine | 줄넘기 + 태양 (반복) |
| master_05_first_doubt | 어두운 모래시계 + 갈라진 글러브 |
| master_06_master_door | 거대한 문 (잠긴 자물쇠) |
| pro_01_routine_machine | 메트로놈 + 샌드백 |
| pro_02_compare_storm | 두 그림자 마주 (비교) |
| pro_03_help_others | 손잡이 (도움) |
| pro_04_routine_breaker | 깨진 시계 + 균열 |
| champion_01_inner_gym | 마음의 링 (안개) |
| champion_02_self_mirror | 거울 속 거울 (무한) |

각 아이콘 = 64×64 SVG, status 별 스타일:
- locked: 회색조 + 자물쇠 overlay
- available: amber glow + 살짝 펄스 (1.5s, scale 1 → 1.05 → 1)
- cleared: 골든 빛 + 체크 마크 우상단

framer-motion 으로 hover 시 scale 1.1 + glow 강화.

═══════════════════════════════════════════════════════════════════
4. CharacterPortrait — 7 NPC + 1 플레이어 = 8 SVG
═══════════════════════════════════════════════════════════════════

props: { speaker: string; emotion?: 'default'|'happy'|'serious'|'concerned'|'angry'; talking?: boolean; size?: 'sm'|'md'|'lg' }

각 캐릭터 SVG 사양 (200×240 viewBox 기준, 어깨 위 portrait):

A. 오삼이 (osam) — 153복싱짐 마스코트
   - 둥근 빨간 박스 글러브 머리 + 큰 눈 + 작은 미소
   - 기본 색: 153 brand red (#e63946 류)
   - 감정 3종: default (살짝 미소) / happy (눈 ^^ + 입 큰 미소) / concerned (눈 깜빡 + 입 작은 동그라미)

B. 강 관장 (gwan) — 153복싱짐 관장
   - 짧은 회색 머리 + 굳은 표정 + 마스터 글러브
   - 감정 3종: default / serious / warm

C. 박 선배 (park_senior) — 윗 기수 회원
   - 길게 묶은 머리 + 헤드밴드 + 친근한 미소
   - 감정 3종: default / happy / focused

D. 민지 (minji) — 같은 기수 회원
   - 단발 + 밝은 표정 + 양갈래 글러브
   - 감정 3종: default / happy / concerned

E. 도훈 (dohun) — 라이벌 회원
   - 짧은 머리 + 자신감 있는 표정 + 한쪽 눈썹 올림
   - 감정 3종: default / smug / serious

F. 김 코치 (kim_coach) — 153복싱짐 코치
   - 중년 안경 + 차분한 미소
   - 감정 3종: default / warm / serious

G. 한 챔피언 (han_champion) — 챔피언 로드 보스 NPC
   - 긴 머리 + 압도적 분위기 + 챔피언 벨트
   - 감정 3종: default / serious / angry

H. 플레이어 (player) — 회원 본인 (모든 루트 공통, 능력치 변화에 따라 표정 결정)
   - 중립 헤드 + 글러브 (route 별 색: master = amber / pro = orange / champion = red)
   - 감정 3종: default / focused / hurt

각 portrait 는 SVG 안 `<g class="mouth">` 와 `<g class="eyes">` 로 분리되어 있어야 함:
- talking=true 이면 mouth toggle (open/closed) 200ms 간격
- 5초마다 eyes blink (scaleY 1 → 0.1 → 1, 150ms)
- emotion 변경 시 mouth shape 와 eyebrow 위치가 즉시 전환 (transition 200ms)

═══════════════════════════════════════════════════════════════════
5. MouthSync — 타이프라이터와 입 모양 동기화
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/portraits/MouthSync.tsx

props: { isTyping: boolean }
- StoryScenePlayer 의 타이프라이터 진행 상태를 받아 talking 토글
- isTyping=true: 200ms 간격으로 mouth 클래스 토글 (CSS .mouth-open / .mouth-closed)
- isTyping=false: 항상 mouth-closed
- CharacterPortrait 안에서 사용 — 부모 (ScenePlayer) 가 isTyping 을 prop 으로 내려줌

StoryScenePlayer.tsx 수정:
- typewriter 진행 중 isTyping=true 를 portrait 에 전달
- typewriter 완료 시 isTyping=false

═══════════════════════════════════════════════════════════════════
6. ParticleField — 4 종 파티클
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/effects/ParticleField.tsx

props: { kind: 'dust' | 'firefly' | 'lantern' | 'rain'; density?: 'low'|'medium'|'high'; speed?: 'slow'|'normal'|'fast' }

구현:
- requestAnimationFrame 기반 (5초 간격으로 새 파티클 spawn)
- 각 파티클 = 작은 SVG circle / rect, css transition 으로 위치+opacity 이동
- dust: 회색 작은 점, 위로 천천히 (3-5초 라이프)
- firefly: amber 점, 좌우 흔들리며 위로 (5-7초)
- lantern: 큰 amber blob (radius 8-12), 천천히 이동 (10초)
- rain: 가로 line, 위에서 아래로 빠르게 (1초)
- density: low=10 / medium=20 / high=40 동시 파티클 수

WorldMapBackdrop 안에서 ParticleField 1~2 개 합성:
- master_path: firefly (medium) + lantern (low)
- pro_path: dust (medium)
- champion_road: rain (high) + 빨간 dust (low)

씬 배경에서도 사용 — gym_entrance: dust low / mirror: firefly low / ring: dust + 가끔 rain

═══════════════════════════════════════════════════════════════════
7. SceneBackground — 10 테마 일러스트
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/backgrounds/SceneBackground.tsx

props: { theme: SceneBackgroundTheme; mood?: 'calm'|'tense'|'sad'|'triumphant' }

테마 (Stage 45 의 node_code 와 매핑):
1. gym_entrance — 체육관 입구. 양문 + 신발장 silhouette + 벽시계
2. gym_mirror — 거울 앞. 큰 거울 + 약한 reflection + 도구 (줄넘기/덤벨)
3. gym_ring — 링. 4 코너 기둥 + 줄 + 캔버스 + 투광등
4. gym_sandbag — 샌드백 코너. 매달린 샌드백 3개 + 그림자
5. gym_rope — 줄넘기 코너. 천장에 줄넘기 걸이 + 매트
6. gym_corner — 코너. 의자 + 수건 + 물병
7. gym_hall — 회원 라운지/복도. 벤치 + 게시판 + 짐백
8. master_room — 마스터의 방. 어두운 방 + 한 줄기 빛 + 책상 + 마스터 글러브 (장식)
9. rival_arena — 라이벌 아레나. 큰 링 + 군중 silhouette + 플래시
10. champion_camp — 파이트 캠프. 야외 + 텐트 + 모닥불 + 산

각 SVG 1280×720 viewBox, 3 layer:
- 가장 뒤: 벽 / 하늘 (그라디언트)
- 중간: 가구 / 도구 (실루엣)
- 가장 앞: 디테일 (조명 / 광선)

mood 에 따라 컬러 보정:
- calm: 따뜻한 amber tint
- tense: 푸른 톤 + 가장자리 어두움
- sad: 회색 데사추레이션
- triumphant: 골드 광선 추가

ParticleField 도 mood/theme 따라 자동 결정 (gym_entrance + calm = dust low, ring + tense = dust + occasional rain).

StorySceneShell 수정: backgroundTheme prop 받아 SceneBackground 마운트.

═══════════════════════════════════════════════════════════════════
8. Letterbox + CameraShake + FlashOverlay
═══════════════════════════════════════════════════════════════════

A. Letterbox.tsx
   props: { active: boolean }
   - active=true: 위/아래 검은 바 (높이 12vh) 페이드 인 (300ms)
   - active=false: 페이드 아웃
   - 사용처: ending 씬, 보스 등장, 결정적 dialogue
   - StoryScenePlayer 에서 scene.metadata.cinematic === true 이면 활성화

B. CameraShake.tsx
   props: { trigger: number; intensity?: 'soft'|'medium'|'hard'; children: ReactNode }
   - trigger 값이 변하면 0.4초 동안 children 흔들기 (x/y -intensity ~ +intensity 랜덤, 30ms tick)
   - intensity: soft=2px / medium=5px / hard=10px
   - 사용처: 전투 피격 (Stage 47B 에서 활용 예정), choice 결과 강한 stat 변화, 보스 등장

C. FlashOverlay.tsx
   props: { trigger: number; color?: 'white'|'red'|'amber'; duration?: number }
   - trigger 변경 시 전체 화면 fixed div 페이드 in/out
   - duration 기본 200ms
   - 사용처: 카운터 적중 (47B), choice 결과 stat boost +10 이상

═══════════════════════════════════════════════════════════════════
9. PlayerWalker — 월드맵 위 작은 복서
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/player/PlayerWalker.tsx

props: { x: number; y: number; facing?: 'left'|'right'; state?: 'idle'|'walking' }

- 32×40 SVG (작은 복서: 헤드 + 몸통 + 글러브)
- idle: 위아래 1px bob (1s 사이클)
- walking: 왼발/오른발 토글 + 글러브 swing (300ms)
- 색상: 현재 active route 의 톤 (master amber / pro orange / champion red)

StoryWorldOverview 에서 활용:
- 마지막으로 클리어한 챕터의 노드 좌표에서 시작
- 월드맵 카메라가 약간 player 추적 (overflow scroll 또는 transform)
- 진입 가능한 다음 챕터 노드를 클릭하면 PlayerWalker 가 그 노드까지 0.8초 이동 (motion.div translate)

═══════════════════════════════════════════════════════════════════
10. StoryWorldOverview 리팩터
═══════════════════════════════════════════════════════════════════

기존 StoryWorldOverview 의 단순 그리드 노드 배치 → 진짜 월드맵으로:

레이아웃:
- 전체 박스: relative w-full max-w-2xl mx-auto, aspect-ratio 16:10
- 0층: WorldMapBackdrop (absolute inset-0, routeCode prop)
- 1층: SVG path (챕터 노드들을 잇는 곡선, 여행 경로)
  · 각 path 는 클리어된 구간만 amber 색, 나머지는 회색 점선
  · 각 path 위에 작은 발자국 dot 5~6개 (cleared 면 amber, locked 면 회색)
- 2층: 챕터 노드 (ChapterNodeIcon) absolute 좌표
  · 좌표는 chapter.metadata.world_position 에 의존하지 않고, chapterIconMap.ts 에 하드코딩 ({master_01: {x: '15%', y: '20%'}, ...})
  · status 는 useMyPlayerStats + scene_progress 로 결정 (cleared/available/locked)
- 3층: PlayerWalker (현재 위치)
- 4층: 챕터 hover 카드 (작은 floating tooltip — 챕터 제목 + 부제 + 진행 %)

진입 가능한 챕터 노드 클릭 시:
1. PlayerWalker 가 0.8초 이동
2. 도착 후 progressToScene(routeId, chapter.id, 0) 호출 → 첫 씬으로 모드 전환

루트가 정해지지 않은 상태 (active_route_code === null) 면 StoryWorldOverview 대신 StoryRouteSelect 그대로 표시.

═══════════════════════════════════════════════════════════════════
11. StorySceneShell + StoryScenePlayer 리팩터
═══════════════════════════════════════════════════════════════════

A. StorySceneShell 확장:
   props 에 backgroundTheme + mood + cinematic? 추가
   - SceneBackground 마운트 (absolute inset-0, z-0)
   - children 은 z-10 으로 위에 띄움
   - cinematic === true 면 Letterbox active

B. StoryScenePlayer 리팩터:
   - dialogue 씬 렌더 시:
     · 좌측 1/3: CharacterPortrait (speaker 매핑 — payload.speaker → portraitData 키)
     · 우측 2/3: 텍스트 박스 (기존 박스 디자인 + retro 프레임 SVG border 추가)
   - 텍스트 박스 안 타이프라이터 진행 중 portrait 에 talking=true / 끝나면 false
   - 씬 진입 시 0.3초 페이드 + Letterbox 활성 (cinematic 인 경우)
   - choice 씬: 기존 StoryChoicePanel 위에 작은 portrait (prompt speaker)
   - battle 씬: 같은 layout 이지만 즉시 StoryBattleEngine 으로 전환 (이번 단계는 background+letterbox 추가만)
   - ending 씬: StoryEndingCutscene 안에서 자체 layout

scene.metadata 에 background_theme / portrait_emotion / cinematic 키가 있으면 활용:
- background_theme: 'gym_entrance' / 'gym_mirror' / etc.
- portrait_emotion: 'default' | 'happy' | 'serious' | 'concerned' | 'angry'
- cinematic: boolean (letterbox 활성)

DB 변경 없이 클라이언트 측에서 fallback 매핑:
- payload.bgm_hint='warm' → background_theme=gym_entrance, mood='calm'
- payload.bgm_hint='tense' → mood='tense'
- speaker 별 기본 emotion: 강 관장='serious' / 오삼이='happy' / 박 선배='happy' / 민지='happy' / 도훈='smug' / 김 코치='warm' / 한 챔피언='serious' / 플레이어='default'

src/components/story-rpg/visuals/portraits/portraitData.ts 안에 speaker → portrait 매핑 키:
{ '오삼이': 'osam', '강 관장': 'gwan', '박 선배': 'park_senior', '민지': 'minji', '도훈': 'dohun', '김 코치': 'kim_coach', '한 챔피언': 'han_champion', '나': 'player' }

═══════════════════════════════════════════════════════════════════
12. 색 토큰 추가
═══════════════════════════════════════════════════════════════════

tailwind.config.ts (기존 토큰에 추가만):
- 'story-amber-deep': '#b87900'
- 'story-blood-red': '#a40e1a'
- 'story-fog-gray': '#8a92a3'
- 'story-lantern-glow': '#fdb85c'

CSS 변수도 동기화 (이미 storyRpgVisuals.ts 가 있다면 거기에 append).

═══════════════════════════════════════════════════════════════════
13. 빌드/검증 체크리스트
═══════════════════════════════════════════════════════════════════

작업 끝나고:

1. npx tsc --noEmit  → 0 error
2. bun run build       → "✓ built in …"
3. grep 자기검열:
   · grep -R "ChatAssistant\|chat-assistant" src/components/story-rpg/visuals
     → 0 hit
   · grep -R "approve_mission_submission\|record_attendance\|member_progress" src/components/story-rpg/visuals
     → 0 hit
   · grep -R "wallet" src/components/story-rpg/visuals
     → 0 hit
   · grep -R "localStorage\|sessionStorage" src/components/story-rpg
     → 0 hit
4. 새 마이그레이션 0개:
   · ls supabase/migrations/*47* → 0 (Stage 47A 는 마이그레이션 없음)
5. 새 npm 패키지 0개:
   · git diff package.json → 변경 없음
6. 손스모크:
   · /story-rpg 진입 → 라우트 선택 → 월드맵 일러스트 보임 (검은 박스 X)
   · 챕터 1 클릭 → PlayerWalker 이동 → 씬 진입
   · 첫 dialogue 씬에서 강 관장 portrait 좌측에 보임 + 입 모양 토글 + 깜빡임
   · 텍스트 끝나면 입 멈춤
   · 다음 씬 페이드 전환

═══════════════════════════════════════════════════════════════════
14. 작업 순서 (의존도 정렬)
═══════════════════════════════════════════════════════════════════

1) 디렉터리 신설 (src/components/story-rpg/visuals/...)
2) 색 토큰 추가 (tailwind.config + storyRpgVisuals)
3) 가장 leaf 한 효과 컴포넌트 (Letterbox / CameraShake / FlashOverlay / ParticleField)
4) 8 CharacterPortrait SVG + portraitData + MouthSync
5) 12 ChapterNodeIcon + chapterIconMap
6) 3 WorldMapBackdrop + BackgroundParallax + useMousePosition 훅
7) 10 SceneBackground
8) PlayerWalker
9) StorySceneShell 확장 (backgroundTheme + cinematic)
10) StoryScenePlayer 리팩터 (portrait + talking 동기화)
11) StoryWorldOverview 리팩터 (월드맵 합성)
12) tsc / build / grep 자기검열
13) 손스모크

═══════════════════════════════════════════════════════════════════
15. 커밋 메시지 (작업 완료 후)
═══════════════════════════════════════════════════════════════════

feat(story-rpg): 월드맵 + 씬 분위기 비주얼 오버홀 (47A 단계)

변경 파일 (예상):
신규:
- src/components/story-rpg/visuals/backgrounds/WorldMapBackdrop.tsx (3 루트 일러스트)
- src/components/story-rpg/visuals/backgrounds/SceneBackground.tsx (10 테마)
- src/components/story-rpg/visuals/backgrounds/BackgroundParallax.tsx
- src/components/story-rpg/visuals/icons/ChapterNodeIcon.tsx (12 아이콘)
- src/components/story-rpg/visuals/icons/chapterIconMap.ts
- src/components/story-rpg/visuals/portraits/CharacterPortrait.tsx (8 캐릭터)
- src/components/story-rpg/visuals/portraits/portraitData.ts
- src/components/story-rpg/visuals/portraits/MouthSync.tsx
- src/components/story-rpg/visuals/effects/ParticleField.tsx
- src/components/story-rpg/visuals/effects/Letterbox.tsx
- src/components/story-rpg/visuals/effects/CameraShake.tsx
- src/components/story-rpg/visuals/effects/FlashOverlay.tsx
- src/components/story-rpg/visuals/player/PlayerWalker.tsx
- src/hooks/useMousePosition.ts
수정:
- src/components/story-rpg/StoryWorldOverview.tsx — 월드맵 일러스트 합성
- src/components/story-rpg/StorySceneShell.tsx — backgroundTheme + cinematic 지원
- src/components/story-rpg/StoryScenePlayer.tsx — portrait + talking 동기화
- tailwind.config.ts — 신규 색 토큰 4개
- src/data/storyRpgVisuals.ts — 토큰 동기화

이유: 데이터/로직은 Stage 45/46 에서 완성. 비주얼이 따라오지 못했음.
한국 90년대 PC RPG 일반 시각 언어 (일러스트 배경 / 캐릭터 포트레이트 / 패럴랙스 / 파티클) 를
web SVG/CSS/framer-motion 으로 재해석. 마이복서153 자체 IP 만 사용.

확인:
- npx tsc --noEmit ✓
- bun run build ✓
- 새 migration 0 / 새 npm 패키지 0
- 손스모크: 월드맵 → 챕터 진입 → portrait + 입모양 동기화 정상

═══════════════════════════════════════════════════════════════════
주의 (절대 하지 말 것)
═══════════════════════════════════════════════════════════════════

1. 환세취호권 / 창세기전 / 일본 게임 / 외부 IP 캐릭터·UI·아트·사운드 직접 참조 금지.
   "한국 90년대 PC RPG 일반 시각 언어" 라는 추상 패턴만 사용.
2. 캐릭터 일러스트는 마이복서153 자체 IP (오삼이 + 6 NPC + 플레이어) 만.
3. 외부 이미지 fetch 금지. SVG 는 모두 inline JSX 로 작성.
4. 새 npm 패키지 추가 금지. Tailwind / framer-motion / lucide-react 만.
5. localStorage / sessionStorage 사용 금지.
6. 비주얼 자산이 무거우면 lazy import (React.lazy) 로 코드 분할.
7. 모바일 (375×667) 에서 깨지지 않게 viewBox 기반 SVG.
8. 다크 / 라이트 모드 토글 무시 (스토리 RPG 는 항상 다크).
9. 새 마이그레이션 / 새 RPC / 새 RLS / 새 service 함수 추가 금지.
10. console.log 흩어두지 말 것 (DEV 가드 안에서만).

지금부터 위 순서대로 작업해. 작업 완료 후 변경 파일 목록 + tsc/build 결과 + grep 결과 + 손스모크 가능 여부 보고.
```

---

## Stage 47A 후속

| 단계 | 내용 |
|---|---|
| 47B | 전투 비주얼 오버홀 (플레이어 복서 + 11 적 SVG + 5 공격 애니메이션 + 피격 흔들기 + 카드 사용 연출) |
| 47C | 스토리 깊이 + 사운드 (DB 마이그레이션으로 환경 대사 30~50개 추가, bgm_hint/se_hint 활용, royalty-free 칩튠) |

47A 통과하면 47B 프롬프트 만들어 줄게.

---

## 빠른 손스모크 가이드 (47A 완료 후)

1. https://my-boxer-153.app `/story-rpg` 진입
2. 라우트 선택 (이미 선택됐으면 월드맵 직행)
3. 월드맵 — 검은 빈 박스 ❌ → 일러스트 배경 + 별/등불 파티클 ✓
4. 챕터 노드 — 색칠된 사각형 ❌ → 12 고유 SVG 아이콘 ✓
5. 챕터 1 클릭 — 즉시 점프 ❌ → PlayerWalker 가 노드로 이동 ✓
6. 첫 dialogue 씬 — 글자만 ❌ → 좌측 캐릭터 portrait + 우측 텍스트박스, portrait 입모양 타이프라이터와 동기화 ✓
7. 강 관장 등장 씬 — portrait 강 관장 (회색 머리, 굳은 표정) ✓
8. 씬 전환 — 즉시 ❌ → 페이드 + (cinematic 일 경우) 레터박스 ✓

캡처 보내주면 디버깅하거나 다음 단계 (47B) 들어갈게.
