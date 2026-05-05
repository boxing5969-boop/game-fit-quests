# 153 스토리 RPG — Stage 42 (Stage 41 디자인/레이아웃 fix)

> Stage 41 결과가 데스크탑에서 심각하게 깨지고 적 SVG 도 부실. 전반 정비.

---

## Stage 42 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" Stage 41 결과물의 레이아웃 + 디자인 문제를 fix 하는 시니어 게임 UI 개발자다.

이번 작업은 42단계다.
목표는 Stage 41 의 StoryBattleScreen / StoryWorldMapVisual / StoryObstacleCreature / StoryRpgPage 가 데스크탑/모바일 모두에서 깔끔하게 보이도록 정비하는 것.

발견된 문제 (사용자 데스크탑 스크린샷 기준):
1. 컨테이너 max-width 미설정 → 콘텐츠가 좌우로 너무 넓게 펼쳐짐
2. HP 바 레이아웃 깨짐 → "100/100 가드 브레이커 25/100" 한 줄로 합쳐짐
3. 적 SVG 부실 → "가드 브레이커" 가 빨간 사각형 + Z 표시만 있음
4. 액션 버튼 4개가 한 줄로 늘어남 → 좌우 잘림, 일부만 보임
5. 챕터 제목 잘림 → "ROUND 2 / 의 벽" 좌측 끝에 잘려서 표시
6. 링 배경이 가로선만 길게 늘어짐 → 실제 ring 느낌 X
7. 8개 obstacle 중 다른 것들도 디자인 부족 가능

해결 원칙:
- 모바일 우선 (max-w-md ~ max-w-lg)
- 전투 화면 풀스크린이지만 콘텐츠는 가운데 max-w-md 이내로 묶기
- 데스크탑에서 mx-auto 로 중앙 정렬
- 적 SVG 8개 모두 캐릭터답게 다시 디자인
- HP 바: 좌측 player, 우측 enemy 분리 — 가로로 합치지 말 것
- 액션 버튼: grid-cols-2 (2x2 그리드)
- 챕터 제목: 헤더 영역 안에 안전하게 배치
- 링 배경: 실제 사각 boxing ring (4 코너 포스트 + 로프 라인)

절대 수정 금지 (이전 단계와 동일):
- levels / missions / mission_videos / mission_submissions / member_progress
- approve_mission_submission / record_attendance
- ChatAssistant
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- allLevelsData / whiteLevel1Data / sharedConstants 공식 훈련 데이터
- 새 supabase migration 추가 X
- DB 스키마 변경 X
- 새 RPC 추가 X

수정 가능한 파일 (story-rpg 네임스페이스만):
- src/components/story-rpg/StoryBattleScreen.tsx
- src/components/story-rpg/StoryObstacleCreature.tsx
- src/components/story-rpg/StoryHpBar.tsx
- src/components/story-rpg/StoryWorldMapVisual.tsx
- src/components/story-rpg/StoryDialogBox.tsx
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg 안의 다른 story-rpg 파일들

═══════════════════════════════════════════════════════════════════
1. StoryBattleScreen.tsx — 전체 레이아웃 재작성
═══════════════════════════════════════════════════════════════════

레이아웃:

<div className="fixed inset-0 z-[80] bg-gray-950/95 backdrop-blur-sm overflow-y-auto">
  <div className="mx-auto max-w-md min-h-full flex flex-col">
    {/* 헤더 — 닫기 + ROUND + 챕터 */}
    {/* 링 배경 + 캐릭터 + 적 */}
    {/* 챕터 제목 + 부제 */}
    {/* HP 바 — 좌우 분리 */}
    {/* 액션 라벨 */}
    {/* 액션 버튼 grid 2x2 */}
    {/* 안내 문구 */}
  </div>
</div>

상세 구조:

[Header] (sticky top, h-14)
- 좌: ⚔ ROUND N (yellow text-base)
- 중: 챕터 제목 (text-base font-black, truncate)
- 우: ✕ 닫기 버튼 (h-9 w-9 rounded-full)

[Battle Stage] (relative, h-72, ring 배경)
- SVG ring 배경:
  - 사각 ring rope (4면)
  - 4 코너 포스트 (빨/파/빨/파 색상)
  - 바닥 그라디언트 (ring canvas 느낌)
- 좌측 (40% width):
  - 플레이어 (OsamMascot 또는 사용자 photo, h-32 w-32)
  - 통통 튐 애니
- 우측 (40% width):
  - StoryObstacleCreature (h-32 w-32)
- 가운데 (20%):
  - 펀치 임팩트 애니메이션 영역 (이벤트 시 💥 emoji + scale 0.5→1.5→0)

[Title Block] (px-4 py-3)
- 챕터 부제 (text-yellow-300 text-xs uppercase tracking-wider)
- 챕터 제목 (text-2xl font-black text-white)

[HP Bars] (grid grid-cols-2 gap-3 px-4)
- 좌측 카드: 나
  - 라벨 "나" + HP 100/100
  - 초록 HP 막대
- 우측 카드: 적
  - 라벨 obstacle 이름 + HP 25/100
  - 빨강 HP 막대

[액션 라벨] (px-4 py-2)
- "액션 선택 — 어떻게 싸울까" (text-yellow-300 text-sm font-black uppercase tracking-wider, text-center)

[액션 버튼 grid 2x2] (grid grid-cols-2 gap-2 px-4 pb-4)
- 각 버튼:
  - h-20 (충분한 터치 영역)
  - 카테고리 색 (공격: red / 방어: blue / 도구: emerald / 응원: pink)
  - 아이콘 (lucide) + 라벨 + 진행도
  - 진행도: "챌린지 2/5" 같은 형식
  - hover/active scale + 색 강조

1. ⚔ 공격 (red 톤)
   라벨: 공격
   부제: 챌린지 N/M
   onClick: navigate("/home") + onClose()

2. 🛡 방어 (blue 톤)
   라벨: 방어
   부제: 일기 N/M
   onClick: navigate("/missions") + onClose()

3. 🧠 도구 (emerald 톤)
   라벨: 도구
   부제: 퀴즈 N/M
   onClick: navigate("/home") + onClose()

4. 👏 응원 (pink 톤)
   라벨: 응원
   부제: 세컨드 N/M
   onClick: navigate("/home") + onClose()

[안내 문구] (px-4 pb-4 text-center text-[11px] text-gray-500)
- "액션을 누르면 해당 활동 페이지로 이동합니다. 활동 후 돌아오면 자동으로 진행도가 갱신됩니다."

═══════════════════════════════════════════════════════════════════
2. StoryHpBar.tsx — 컴팩트하게 재작성
═══════════════════════════════════════════════════════════════════

Props:
- label: string (예: "나" / "가드 브레이커")
- current: number
- max: number
- variant: "player" | "enemy"

레이아웃:
- 카드 (rounded-xl border border-white/10 bg-gray-900/60 p-2.5)
- 상단: label (text-xs font-black) + N/M (text-[10px] tabular-nums, 우측 정렬)
- 하단: HP 막대 (h-2 rounded-full bg-gray-800/80)
  - player: bg-gradient-to-r from-emerald-400 to-emerald-500
  - enemy: bg-gradient-to-r from-red-500 to-orange-500
- HP < 30%: 노란/빨강 깜빡임

═══════════════════════════════════════════════════════════════════
3. StoryObstacleCreature.tsx — 8개 SVG 다시 그리기
═══════════════════════════════════════════════════════════════════

각 creature 는 viewBox="0 0 200 200" 정사각 SVG. 캐릭터답게 디자인.

1. lazy_slime (게으름 슬라임)
   - 녹색 둥근 블롭 (ellipse 큰 거)
   - 졸린 눈 (- - 형태)
   - 입은 작은 ㅅ
   - 아래 흘러내리는 침 (작은 길쭉한 ellipse)
   - hurt: red 깜빡 + shake

2. guard_breaker (가드 브레이커)
   - 빨간 사각형 + 둥근 코너
   - 가운데 큰 균열 (지그재그 path)
   - 분노 눈 (\\ // 형태 흰색 + 검은 동공)
   - 입 ▽ (성난 입)
   - 화난 눈썹

3. breath_holder (숨참기 유령)
   - 흰 반투명 유령 (둥근 윗부분 + 물결치는 아래)
   - 큰 검은 눈 두 개
   - 입에 X 표시 (숨 막힘)
   - 머리 위 작은 공기방울 (회색)

4. excuse_goblin (핑계 도깨비)
   - 초록 도깨비 얼굴
   - 큰 코 + 송곳니 (한 개만 삐져나옴)
   - 손가락 가리키는 포즈 (옆으로 손)
   - 한쪽 눈 가늘게

5. compare_monster (비교 괴물)
   - 보라 얼굴 + 무지개 톤
   - 눈 4~5개 (여러 위치에 흩어져)
   - 작은 입 (질투의 ㅁ)
   - 머리에 작은 뿔

6. tense_wolf (긴장 늑대)
   - 회색 늑대 얼굴 (귀 두 개 뾰족)
   - 송곳니 4개 (위 2 + 아래 2)
   - 식은땀 (이마 옆)
   - 빨간 눈

7. quit_demon (포기 악마)
   - 검은 둥근 얼굴
   - 빨간 뿔 두 개
   - "ㅠ" 입 (눈물 흘리는)
   - 노란 눈 2개

8. overtrain_golem (과훈련 골렘)
   - 회색 돌 거인 얼굴
   - 큰 균열 (얼굴 가로지름)
   - 피곤한 눈 (- - 형태)
   - 작은 입 (네모)

각 creature 모두 state="idle" / "hurt" / "defeated" 지원.
- idle: scale [1, 1.02, 1] 2.4s 호흡
- hurt: filter saturate(2) brightness(1.2), x [-5, 5, -5, 0] 0.4s
- defeated: rotate 90deg, opacity 0, scale 0.6 (1s ease-out)

═══════════════════════════════════════════════════════════════════
4. StoryWorldMapVisual.tsx — max-width + 중앙 정렬
═══════════════════════════════════════════════════════════════════

기존 구조 유지하되:
- 최상단 div 에 className="mx-auto max-w-md w-full" 추가
- 노드 카드 사이 SVG path 가 정확히 노드 중심을 잇도록 좌표 보정
- 캐릭터 위치 (현재 노드) 가 노드 위에 정확히 떠있도록 -translate-y 사용
- 모바일 / 데스크탑 모두 동일 크기로 보이게

═══════════════════════════════════════════════════════════════════
5. StoryRpgPage.tsx — 컨테이너 max-width
═══════════════════════════════════════════════════════════════════

전체를 mx-auto max-w-md (또는 lg) 로 묶기.
AppPage 가 이미 max-w 처리하면 그대로 두고, 안 하면 추가.

═══════════════════════════════════════════════════════════════════
6. StoryDialogBox.tsx — sticky bottom + max-width
═══════════════════════════════════════════════════════════════════

대화창도 max-w-md mx-auto 로 가운데 정렬.
sticky bottom 일 때 좌우 padding px-4 유지.

═══════════════════════════════════════════════════════════════════
검증
═══════════════════════════════════════════════════════════════════

1. 데스크탑 (1920x1080) 에서 /story-rpg 진입 — 콘텐츠 가운데 max-w-md 이내, 양옆 어두운 여백
2. 모바일 (375x667) 에서 동일 — 화면 꽉 차지만 안 잘림
3. 전투 화면 — 캐릭터 좌, 적 우, 가운데 펀치 영역
4. HP 바 좌우 카드로 분리 — 합쳐지지 않음
5. 액션 버튼 2x2 그리드 — 잘리지 않음
6. 8개 obstacle 모두 캐릭터답게 표시 (테스트: 챕터별로 obstacle_code 다르게 나옴)
7. 챕터 제목 헤더 안에 안전 배치, truncate 로 잘림 처리
8. 링 배경 — 실제 사각 ring + 4 포스트
9. 공식 시스템 무관 (member_progress 등 변동 0)
10. bun run build 통과

작업 완료 후 출력:
1. 수정한 파일 목록
2. 8개 obstacle SVG 캐릭터 디자인 요약
3. 데스크탑 / 모바일 레이아웃 처리 방식
4. HP 바 좌우 분리 방식
5. 액션 버튼 grid 2x2 처리
6. bun run build 결과
7. git diff --stat 결과
```

---

## Stage 42 완료 후 push

```powershell
cd C:\Users\82104\game-fit-quests
```

```powershell
bun run build
```

빌드 통과 후:

```powershell
git add src/components/story-rpg src/pages/StoryRpgPage.tsx
```

```powershell
git status
```

```powershell
git commit -m "fix(story-rpg): Stage 41 레이아웃/디자인 정비 (42) — max-width + HP 분리 + 8 obstacle SVG 강화 + 액션 grid 2x2"
```

```powershell
git push origin main
```

---

## 푸시 후 확인

Cloudflare Pages 빌드 (~2-4분) 완료 후:

**데스크탑** (예: 1920x1080):
- ✅ 콘텐츠 가운데 max-w-md 이내, 양옆 어두운 여백
- ✅ 깨진 가로 줄 사라짐
- ✅ HP 바 좌우 깔끔하게 분리

**모바일** (예: 375x667):
- ✅ 화면에 꽉 차지만 안 잘림
- ✅ 액션 버튼 2x2 그리드
- ✅ 적 캐릭터 (가드 브레이커 등) 가 캐릭터답게 보임

**적 캐릭터 8종**:
- 챕터마다 obstacle_code 가 달라서 다양한 적 등장
- 게으름 슬라임 / 가드 브레이커 / 숨참기 유령 등 모두 캐릭터다움
