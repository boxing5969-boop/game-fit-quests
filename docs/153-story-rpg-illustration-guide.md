# 153 스토리 RPG — 픽셀 아트 일러스트 자산 가이드

> ChatGPT Pro (GPT-image / DALL-E 3) 로 16-bit Korean RPG 픽셀 아트 자산 100+장을 일관된 스타일로 생성하는 워크플로.

---

## 0. 결정 사항

| 항목 | 값 |
|---|---|
| AI 도구 | ChatGPT Pro (GPT-image-1 또는 DALL-E 3) |
| 비주얼 톤 | 16-bit Korean RPG 픽셀 아트 (환세취호권 / 창세기전 시대) |
| 자산 범위 | 100+장 (전체 챕터 + 모든 캐릭터/적/배경/엔딩 컷씬) |
| 첫 단계 | 챕터 1 풀세트 (16장) — 챔피언 로드 챕터 1 기준 |

---

## 1. 글로벌 스타일 가이드 (모든 prompt 에 공통 적용)

### 1.1 핵심 키워드 (긍정)
- `16-bit pixel art`
- `1990s Korean PC RPG style` (또는 `JRPG SNES era pixel art`)
- `pixel-perfect, no anti-aliasing`
- `limited color palette`
- `clean dithering`
- `sprite art`

### 1.2 절대 금지 키워드 (부정)
- `anime`, `manga` (특정 일본 스타일 회피)
- `realistic`, `photorealistic`, `3D render`
- `modern art`, `digital painting`
- `blurry`, `soft shadows`, `gradient mesh`

### 1.3 컬러 팔레트 (마이복서153 브랜드 + 90년대 RPG)
prompt 마지막에 명시:
```
Color palette: deep navy #0b0e2e, amber gold #fdb85c, blood red #a40e1a,
fog gray #8a92a3, lantern glow #fef3c7, master purple #5a4a7a.
Limited 16-color palette inspired by Korean retro PC RPG.
```

### 1.4 사이즈 / 캔버스
- **캐릭터 portrait**: 128x128 pixels (square)
- **적 sprite (idle)**: 96x96 pixels
- **적 sprite (보스 1.5x)**: 144x144 pixels
- **배경 (씬)**: 320x240 pixels (4:3)
- **배경 (월드맵)**: 480x320 pixels (3:2)
- **엔딩 컷씬**: 480x320 pixels

### 1.5 일관성 유지 전략 (ChatGPT Pro 특화)
ChatGPT Pro 는 같은 대화 안에서 컨텍스트 유지함. 활용 방법:

1. **새 대화 시작 시 reference 첨부**: 첫 번째 자산 (오삼이) 받으면 그 이미지를 다음 prompt 에 첨부 + "이 스타일 그대로 유지" 명시
2. **한 캐릭터 = 한 대화**: 오삼이의 3 감정을 한 대화 안에서 연속 생성 (default → happy → concerned)
3. **character sheet 사용**: 한 prompt 로 한 캐릭터의 여러 표정 / 포즈를 한 이미지에 그리도록 요청 (4-grid 또는 6-grid)
4. **모든 prompt 에 동일 스타일 prefix**: 위 1.1-1.4 키워드 매번 반복

---

## 2. 폴더 구조 + 파일명 규칙

### 2.1 자산 위치
```
public/
└── assets/
    └── story-rpg/
        ├── portraits/                # 캐릭터 portraits
        │   ├── osam_default.png
        │   ├── osam_happy.png
        │   ├── osam_concerned.png
        │   ├── gwan_default.png
        │   ├── gwan_serious.png
        │   ├── gwan_warm.png
        │   ├── park_senior_default.png
        │   ├── park_senior_happy.png
        │   ├── park_senior_focused.png
        │   ├── minji_default.png
        │   ├── minji_happy.png
        │   ├── minji_concerned.png
        │   ├── dohun_default.png
        │   ├── dohun_smug.png
        │   ├── dohun_serious.png
        │   ├── kim_coach_default.png
        │   ├── kim_coach_warm.png
        │   ├── kim_coach_serious.png
        │   ├── han_champion_default.png
        │   ├── han_champion_serious.png
        │   ├── han_champion_angry.png
        │   ├── player_master_default.png      # master 루트 톤
        │   ├── player_master_focused.png
        │   ├── player_master_hurt.png
        │   ├── player_pro_default.png         # pro 루트
        │   ├── player_pro_focused.png
        │   ├── player_pro_hurt.png
        │   ├── player_champion_default.png    # champion 루트
        │   ├── player_champion_focused.png
        │   └── player_champion_hurt.png
        │
        ├── enemies/                  # 적 sprites
        │   ├── lazy_slime_idle.png
        │   ├── lazy_slime_hurt.png
        │   ├── lazy_slime_defeated.png
        │   ├── excuse_goblin_idle.png
        │   ├── ... (11종 × 3 포즈 = 33장)
        │   └── self_compare_evolved_defeated.png
        │
        ├── backgrounds/              # 씬 배경
        │   ├── gym_entrance.png
        │   ├── gym_mirror.png
        │   ├── gym_ring.png
        │   ├── gym_sandbag.png
        │   ├── gym_rope.png
        │   ├── gym_corner.png
        │   ├── gym_hall.png
        │   ├── master_room.png
        │   ├── rival_arena.png
        │   └── champion_camp.png
        │
        ├── world_maps/               # 월드맵
        │   ├── master_path.png
        │   ├── pro_path.png
        │   └── champion_road.png
        │
        ├── endings/                  # 엔딩 컷씬 (3 엔딩 × 3 블록)
        │   ├── master_ending_01.png
        │   ├── master_ending_02.png
        │   ├── master_ending_03.png
        │   ├── pro_ending_01.png
        │   ├── pro_ending_02.png
        │   ├── pro_ending_03.png
        │   ├── champion_ending_01.png
        │   ├── champion_ending_02.png
        │   └── champion_ending_03.png
        │
        └── titles/                   # 챕터 시작 타이틀 카드 (선택)
            ├── champ_01_contender_gate.png
            ├── master_01_first_glove.png
            └── ...
```

### 2.2 파일명 규칙
- 모두 **소문자 + 언더스코어**
- 캐릭터: `{name}_{emotion}.png`
- 적: `{enemy_code}_{pose}.png` (DB code 와 정확히 일치)
- 배경: `{theme}.png` (47A 의 SceneBackgroundTheme 와 일치)
- 월드맵: `{route_code}.png`
- 엔딩: `{route}_ending_{block_index}.png`

---

## 3. 챕터 1 풀세트 자산 목록 (16장 — 첫 테스트)

챔피언 로드 챕터 1 (`champ_01_contender_gate`, "도전자의 문") 기준.

| # | 카테고리 | 파일명 | 사이즈 |
|---|---|---|---|
| 1 | Portrait | osam_default.png | 128x128 |
| 2 | Portrait | osam_happy.png | 128x128 |
| 3 | Portrait | osam_concerned.png | 128x128 |
| 4 | Portrait | han_champion_default.png | 128x128 |
| 5 | Portrait | han_champion_serious.png | 128x128 |
| 6 | Portrait | han_champion_angry.png | 128x128 |
| 7 | Portrait | player_champion_default.png | 128x128 |
| 8 | Portrait | player_champion_focused.png | 128x128 |
| 9 | Portrait | player_champion_hurt.png | 128x128 |
| 10 | Enemy | tense_wolf_idle.png | 96x96 |
| 11 | Enemy | tense_wolf_hurt.png | 96x96 |
| 12 | Enemy | tense_wolf_defeated.png | 96x96 |
| 13 | Background | gym_entrance.png | 320x240 |
| 14 | Background | rival_arena.png | 320x240 |
| 15 | World Map | champion_road.png | 480x320 |
| 16 | Title | champ_01_contender_gate.png | 480x320 |

---

## 4. ChatGPT Pro 사용 워크플로

### 4.1 첫 대화 — 오삼이 3 감정 (한 번에)

새 대화 시작. 다음 prompt 그대로 붙여넣기:

````
한 이미지에 4-grid 로 16-bit Korean RPG 픽셀 아트 portrait 4개 그려줘:

캐릭터: 오삼이 (마이복서153 짐의 마스코트)
- 둥근 빨간 복싱 글러브 모양 머리 (얼굴이 글러브 표면에 있음)
- 머리 위에 작은 끈 (글러브 끈)
- 작은 몸통, 노란 스카프
- 친근한 마스코트 분위기

4-grid:
1번 (좌상): default 표정 — 살짝 미소, 눈 둥글게
2번 (우상): happy 표정 — 활짝 웃음 ^_^ 눈, 입 큰 미소
3번 (좌하): concerned 표정 — 눈 살짝 처짐, 입 작은 동그라미
4번 (우하): default 와 같지만 옆모습 (3/4 view)

스타일 강제:
- 16-bit pixel art, NES/SNES era
- 1990s Korean PC RPG aesthetic (환세취호권 / 창세기전 시대)
- pixel-perfect, NO anti-aliasing, NO smooth gradients
- clean dithering for shading
- limited 16-color palette
- Color palette: deep navy #0b0e2e (background), red #e63946 (head), yellow #fdb85c (scarf), white, black outline
- Each portrait 128x128 pixels, total image 256x256 (4-grid)
- character bust shot, head and shoulders visible

NEGATIVE (절대 금지):
- anime style
- manga style
- realistic
- photorealistic
- 3D render
- digital painting with soft shadows
- modern illustration
- blurry
- gradient mesh
````

→ 받은 4-grid 이미지를 4개 PNG 로 자르거나, 또는 4-grid 그대로 유지하고 CSS background-position 으로 자르기 가능. 더 쉬운 건 자르기.

### 4.2 같은 대화에서 계속 — 한 챔피언 3 감정

오삼이 결과 받은 직후, **같은 대화 안에서** 다음 prompt:

````
같은 16-bit Korean RPG 픽셀 아트 스타일 그대로 유지.
이번엔 다른 캐릭터: 한 챔피언

캐릭터 설정:
- 30대 후반 한국 남성 복서, 챔피언 벨트 보유
- 긴 검은 머리, 헤어밴드 (붉은 색)
- 굳은 표정, 강렬한 눈빛
- 챔피언 벨트 (어깨 위로 살짝 보임)
- 빨간 (#a40e1a) 가운/로브
- 압도적 분위기

4-grid:
1번 (좌상): default — 무표정, 정면
2번 (우상): serious — 눈썹 찌푸림, 결연한 입
3번 (좌하): angry — 분노, 송곳니 살짝 보임
4번 (우하): default 의 옆모습 (3/4)

스타일은 이전 오삼이 그림과 정확히 일치 (같은 픽셀 사이즈, 같은 디더링, 같은 컬러 톤).
128x128 each, 256x256 total.
````

### 4.3 플레이어 (챔피언 루트) 3 감정

````
같은 스타일 유지. 이번엔 플레이어 캐릭터 (챔피언 루트 버전):

캐릭터 설정:
- 20대 한국 남성 신인 복서
- 짧은 검은 머리
- 빨간 (#a40e1a) 트렁크 + 검은 운동복 상의
- 양손에 작은 빨간 글러브
- 가슴에 "153" 작은 표기

4-grid:
1번 (좌상): default — 결의에 찬 표정, 정면
2번 (우상): focused — 집중, 눈 굳음
3번 (좌하): hurt — 눈 찡그림, 땀 한 방울
4번 (우하): default 옆모습

스타일 정확히 동일. 128x128 each.
````

### 4.4 적 — 긴장 늑대 3 포즈

````
같은 16-bit Korean RPG 픽셀 아트 스타일.
이번엔 적 몬스터 sprite (chibi 사이즈).

적 설정: 긴장 늑대 (Tension Wolf)
- 회색-검정 늑대
- 빨간 눈 (글로우)
- 송곳니 4개
- 어깨 털이 곤두서 있음
- 약간 통통한 chibi 스타일

3-grid (가로):
1번 (좌): idle — 으르렁, 입 살짝 벌림, 정면
2번 (가운데): hurt — 흔들림, 빨간 임팩트, 눈 X 자
3번 (우): defeated — 누워있음, opacity 살짝 감소, 회색조

스타일:
- 96x96 each, 288x96 total
- 같은 픽셀 톤, 같은 컬러 팔레트 (회색 #4a4a4a, 빨간 #a40e1a, 검정)
- 전투 sprite 스타일

NEGATIVE: anime, realistic, cute moe style
````

### 4.5 배경 — 체육관 입구

````
같은 픽셀 아트 스타일. 이번엔 배경 일러스트.

장면: 한국 복싱 체육관 (153 복싱짐) 입구
- 양 갈래 문 (옅은 amber 광선이 새어나옴)
- 좌측: 신발장 (4x4 격자)
- 우측: 벽시계 (오래된 디자인)
- 천장: 형광등 1개
- 바닥: 매트
- 분위기: 새벽, 차분함, 약간 어두움

스타일:
- 16-bit Korean RPG 배경 (환세취호권 마을 배경 톤)
- 320x240 pixels (4:3)
- pixel-perfect, dithering for shading
- Color: deep navy 천장 + amber 광선 + warm wood floor
- 1990s SNES JRPG town interior aesthetic

NEGATIVE: modern, photorealistic, 3D, anime style
````

### 4.6 배경 — 라이벌 아레나 (전투 장소)

````
같은 스타일.

장면: 라이벌 아레나 (큰 복싱 링)
- 중앙에 큰 boxing ring (4 코너 amber 기둥)
- 링 위 캔버스
- 좌우에 군중 silhouette (검은 점들)
- 천장에서 떨어지는 spotlight 2개 (amber)
- 분위기: 긴장감, 클라이맥스 직전

스타일:
- 320x240 pixels (4:3)
- 같은 픽셀 톤
- 어두운 배경 + amber 강조
````

### 4.7 월드맵 — 챔피언 로드

````
같은 픽셀 아트 스타일. 월드맵 배경.

장면: 챔피언 로드 (chapter map background)
- 폭풍 직전의 어두운 하늘
- 거대한 라이벌 silhouette (배경에 흐릿하게, 아래쪽에서 위로)
- 빨간 눈 (작게)
- 비 내림 (대각선 줄)
- 군중 silhouette (하단 가로로)
- 분위기: 압도적, 도전, 결의

스타일:
- 480x320 pixels (3:2 가로)
- 16-bit RPG 월드맵 톤 (창세기전 1편 월드맵 스타일)
- Layered: 하늘 / 라이벌 silhouette / 비 / 군중 / 전경
````

### 4.8 챕터 타이틀 카드 (선택)

````
챕터 시작 타이틀 카드.

장면: champion road chapter 1 title screen
- 중앙 큰 텍스트: "도전자의 문" (Korean) + 하단 작게 "Chapter 1"
- 좌측에 거대한 닫힌 문 (amber 빛 새어나옴)
- 우측에 플레이어 silhouette (작게, 문을 향해)
- 배경: 어두운 새벽 하늘 + 별 몇 개

스타일:
- 480x320 pixels (3:2)
- 16-bit RPG title screen 톤
- 영화적 컴포지션
- Korean 타이포그래피 (픽셀 폰트, "도전자의 문")
````

---

## 5. 받은 PNG 처리 — 사용자 작업

### 5.1 자르기 (4-grid → 개별 PNG)

ChatGPT 가 4-grid 이미지를 주면 4개로 자르기:

**옵션 A**: 무료 온라인 도구 (https://www.iloveimg.com/crop-image)
**옵션 B**: Photoshop / GIMP 의 슬라이스 기능
**옵션 C**: PowerShell 스크립트 (간단):
```powershell
# ImageMagick 설치 필요: choco install imagemagick
magick convert osam_4grid.png -crop 128x128 +repage osam_%d.png
```

### 5.2 폴더에 저장

자른 PNG 를 다음 위치에 저장:
```
C:\Users\82104\game-fit-quests\public\assets\story-rpg\portraits\osam_default.png
C:\Users\82104\game-fit-quests\public\assets\story-rpg\portraits\osam_happy.png
... (전체 16장)
```

### 5.3 Claude Code 에 다음 단계 위임

자산 16장 모두 폴더에 들어가면, Claude Code 새 세션에:
```
public/assets/story-rpg/ 안에 챕터 1 풀세트 픽셀 아트 자산 16장 들어왔어.
다음 작업:
1. CharacterPortrait 컴포넌트 (visuals/portraits/CharacterPortrait.tsx) 를 SVG inline 에서 PNG image 기반으로 교체.
   parent 가 portraitKey 와 emotion 받으면 /assets/story-rpg/portraits/{key}_{emotion}.png 로드.
   기존 talking 입모양 동기화는 CSS animation 으로 lip-sync 효과 (작은 입 영역 토글) 또는 frame swap 으로 유지.
2. EnemySvg 도 PNG 기반으로 교체. /assets/story-rpg/enemies/{enemy_code}_{pose}.png.
3. SceneBackground 도 일부 (gym_entrance, rival_arena) PNG 기반으로 (미리 import 한 자산만, 없는 건 SVG fallback).
4. WorldMapBackdrop 의 champion_road 케이스도 PNG 로드 (master_path / pro_path 는 SVG 유지).
5. lazy load + 로딩 fallback (작은 spinner) 처리.
6. tsc / build / push.
```

→ Claude Code 가 import 코드 작성 + 컴포넌트 교체.

---

## 6. 점진적 확장 (챕터 1 → 100+ 자산)

챕터 1 풀세트 (16장) 만족하면 다음 순서로 확장:

| 단계 | 자산 | 시간 |
|---|---|---|
| **Phase 2** | 마스터 루트 챕터 1 (master_01_first_glove) — 강 관장 / 게으름 슬라임 / gym_mirror = 약 10장 | 2-3일 |
| **Phase 3** | 프로 루트 챕터 1 (pro_01_hobby_start) — 박 선배 / 핑계 도깨비 / gym_rope = 약 10장 | 2-3일 |
| **Phase 4** | 모든 적 (11종 × 3 포즈 = 33장 — 이미 만든 긴장 늑대 / 게으름 슬라임 빼면 약 25장) | 4-5일 |
| **Phase 5** | 모든 NPC 감정 추가 (민지 / 도훈 / 김 코치 = 약 12장) | 2-3일 |
| **Phase 6** | 나머지 배경 (8 테마 × 1 = 8장) | 2일 |
| **Phase 7** | 엔딩 컷씬 (3 엔딩 × 3 블록 = 9장) | 2-3일 |
| **Phase 8** | 보스 등장 cinematic + 챕터 타이틀 카드 (선택, 약 12장) | 2-3일 |

총 약 4-5주, 100+장.

---

## 7. 일관성 유지 팁 (중요!)

1. **같은 대화 안에서 가능한 한 많이 생성** — ChatGPT 가 컨텍스트 유지
2. **첫 자산 받으면 다른 prompt 시 reference 로 첨부** — "이 픽셀 아트와 동일 스타일" 명시
3. **컬러 팔레트 매번 동일** — deep navy / amber / blood red / fog gray (위 1.3 절)
4. **Negative 키워드 반복** — anime / realistic / 3D / blurry 등 매번 명시
5. **사이즈 명시** — 128x128 / 96x96 등 정확히
6. **나쁜 결과 ❌, 좋은 결과 ✅ 표시 후 다시 시도** — "1번 이미지는 나쁨, 2번 같은 스타일로"
7. **스타일이 바뀌기 시작하면 새 대화 시작** — 단, 첫 자산을 reference 로 첨부

---

## 8. 비용 / 시간 예상

| 항목 | ChatGPT Pro 기준 |
|---|---|
| 월 사용료 | $200 |
| 이미지 생성 | 무제한 (Pro 의 가장 큰 장점) |
| 챕터 1 (16장) | 4-grid 5번 + 단일 5번 = 약 1-2시간 |
| 전체 100+장 | 약 30-40시간 (생성 + 자르기 + 저장) |
| 코드 통합 | 6-8시간 (Claude Code) |

---

## 9. 첫 액션 — 지금 바로

1. ChatGPT Pro 새 대화 시작
2. 위 §4.1 의 prompt (오삼이 4-grid) 그대로 붙여넣기
3. 받은 이미지 평가:
   - 픽셀 톤 OK?
   - 컬러 팔레트 OK?
   - 분위기 OK?
4. 만족하면 §4.2 (한 챔피언) 진행
5. 만족 안 하면 prompt 조정 (구체적 피드백 — "픽셀이 너무 부드러워 / 색깔이 너무 화려해 / 만화 같음" 등)

---

## 부록 — 픽셀 아트 reference 게임 (스타일 참조용, 직접 카피 금지)

마이복서153 의 자체 IP 만 사용하지만, ChatGPT 에게 분위기 가이드 시 참조 키워드로 사용 가능:
- "1990s Korean PC RPG era pixel art" (환세취호권 / 창세기전 시대)
- "SNES JRPG character portrait style" (Final Fantasy 6 / Chrono Trigger 톤)
- "16-bit Genesis era sprite art" (Streets of Rage 톤)
- "Octopath Traveler retro pixel art" (현대 픽셀 아트 톤)

직접 캐릭터 / 의상 / 배경 카피 금지 — 톤만 참조.
