# 랭킹업 디자인 시스템

> 이 문서는 **랭킹업(Rankingup)** 앱의 브랜드·UI·컴포넌트 디자인 표준입니다.
> 새로운 화면을 만들거나 기존 화면을 수정할 때 이 문서에 정의된 토큰·원칙을 기준으로 합니다.

---

## 1. 브랜드 방향

랭킹업은 복싱 훈련을 **단순 출석 관리가 아니라 리그 승급, 캐릭터 성장, 보상 획득으로 이어지는 프리미엄 스포츠 성장 경험**으로 바꾸는 앱이다.

사용자가 앱을 열었을 때 "체육관 관리앱"이 아니라 **"내가 소속된 복싱 리그 앱"** 처럼 느껴져야 한다.

### 핵심 키워드

- **Ascend** — 상승감, 승급의 서사
- **League** — 소속감, 랭킹 시스템
- **Power** — 복싱 고유의 에너지
- **Reward** — 성취와 보상
- **Premium Sport** — 프리미엄 스포츠 감각

### 최종 디자인 방향

- **Dark-first** — 기본은 다크 테마
- **Premium sports** — 스포츠 브랜드의 고급스러운 인상
- **Game-like progression** — 게임의 성장 루프
- **Boxing energy without old black/red cliché** — 복싱 고유 에너지, 단 올드한 흑/적 클리셰 배제
- **Gender-balanced** — 성별 편향 없음
- **Not childish** — 유치하지 않음
- **Not gym management app-like** — 체육관 관리 앱 느낌 없음

---

## 2. Color Tokens
> **[2026-06 브랜드 업데이트] Primary: Ember 레드 → 민트**
> 현재 정본은 코드(`src/index.css`). Primary가 Ember 레드(#D93620)에서 **민트 #29C39C**로 이전됨.
> 빨강은 이제 153 로고와 에러(destructive #EF4444)에만 사용. Primary 글로우·버튼 press·사이드바도 민트로 정리됨.
> 리그 색상(§3)은 정체성 토큰이라 그대로 유지.
> [확인 필요] Accent: 코드 `--accent` 토큰은 민트로 별칭됐으나, 랭킹/성장/정보용 블루(#2F8CFF)·리그-블루는 유지 — 문서와 갈리니 확정 필요.


### 브랜드 / 표면

| Token              | Hex       | 용도                                   |
| ------------------ | --------- | -------------------------------------- |
| Primary            | `#29C39C` | 핵심 CTA, 주요 강조                    |
| Primary Light      | `#5AE2C0` | Primary의 밝은 변형 (그라데이션/hover) |
| Primary Dark       | `#20B691` | Primary의 어두운 변형 (press 상태)     |
| Secondary          | `#0B0F17` | 어두운 보조 배경 / 깊이 표현            |
| Accent             | `#2F8CFF` | 랭킹·성장 관련 강조                    |
| Reward             | `#F6C453` | 보상·성취 전용 (Gold)                  |

### 배경 / 서페이스

| Token              | Hex       | 용도                                  |
| ------------------ | --------- | ------------------------------------- |
| Background         | `#0B0F17` | 앱 기본 배경 (Dark)                   |
| Background Soft    | `#101622` | 섹션 구분용 살짝 밝은 배경            |
| Surface            | `#121826` | 카드/모듈 기본 표면                   |
| Surface Elevation  | `#1B2433` | 떠 있는 카드 (elevated) 표면          |
| Surface Light      | `#FFFFFF` | 라이트 모드 / 정보성 화면 표면        |

### 텍스트

| Token           | Hex       | 용도                           |
| --------------- | --------- | ------------------------------ |
| Text Primary    | `#F8FAFC` | 본문 · 제목                    |
| Text Secondary  | `#A7B0C0` | 서브 텍스트 · 설명             |
| Text Tertiary   | `#697386` | 비활성 · 캡션 · 메타 정보      |

### 경계선

| Token          | Hex       | 용도                                    |
| -------------- | --------- | --------------------------------------- |
| Border         | `#2A3344` | 다크 기본 경계선                        |
| Border Light   | `#E1E5EC` | 라이트 모드 경계선                      |
| Border Active  | `#29C39C` | 선택 · active 상태 경계선 (= Primary)   |

### 시스템 (상태)

| Token    | Hex       | 용도           |
| -------- | --------- | -------------- |
| Success  | `#22C55E` | 성공           |
| Warning  | `#F59E0B` | 경고           |
| Danger   | `#EF4444` | 위험 · 오류    |
| Info     | `#2F8CFF` | 정보 (= Accent) |

---

## 3. League Tokens

리그는 게임 정체성의 핵심 축이므로 chrome 토큰과 별도로 관리한다.

| League        | Hex       | 의미                      |
| ------------- | --------- | ------------------------- |
| League White  | `#D7DCE3` | 화이트 리그 (입문)        |
| League Blue   | `#2F8CFF` | 블루 리그                 |
| League Red    | `#EF4444` | 레드 리그                 |
| League Black  | `#20242D` | 블랙 리그 (상위)          |
| League Master | `#F6C453` | 마스터 (= Reward gold)    |
| League Legend | `#FF6A3D` | 레전드 (오렌지, 리그 전용)  |

---

## 4. Typography

### 폰트 스택

- **Font Main**: `Pretendard`
- **Font Number**: `Space Grotesk` (숫자 전용 — 랭킹, 레벨, XP)
- **Fallback**: `Apple SD Gothic Neo, Noto Sans KR, Roboto, sans-serif`

### Type Scale

| Role           | Size / Line / Weight     | Font            |
| -------------- | ------------------------ | --------------- |
| H1             | 28px / 36px / 800        | Pretendard      |
| H2             | 24px / 32px / 800        | Pretendard      |
| H3             | 20px / 28px / 700        | Pretendard      |
| Body           | 16px / 24px / 500        | Pretendard      |
| Body Small     | 14px / 21px / 500        | Pretendard      |
| Caption        | 12px / 16px / 500        | Pretendard      |
| Button         | 16px / 20px / 700        | Pretendard      |
| Badge          | 12px / 16px / 700        | Pretendard      |
| Ranking Number | 32px / 40px / 800        | Space Grotesk   |
| Level Number   | 24px / 32px / 800        | Space Grotesk   |
| XP Number      | 16px / 22px / 700        | Space Grotesk   |

> 숫자만 Space Grotesk를 사용해 순위·레벨·XP에 스포츠 숫자판 느낌을 준다.

---

## 5. Component Tokens

### Radius

| Token         | Value   | 용도                         |
| ------------- | ------- | ---------------------------- |
| Radius Small  | `8px`   | 작은 뱃지, 입력 필드         |
| Radius Medium | `12px`  | 버튼 secondary, 작은 카드    |
| Radius Large  | `16px`  | 버튼 primary                 |
| Radius Card   | `20px`  | 일반 카드                    |
| Radius Hero   | `24px`  | 히어로 카드 (캐릭터 쇼케이스 등) |
| Radius Pill   | `999px` | 알약형 칩 · 태그             |

### Stroke

| Token           | Value   | 용도                  |
| --------------- | ------- | --------------------- |
| Stroke Default  | `1px`   | 기본 경계선           |
| Stroke Active   | `1.5px` | 선택된 상태의 경계선  |

### Button Height

| Token                    | Value  | 용도                  |
| ------------------------ | ------ | --------------------- |
| Button Height Primary    | `56px` | 주요 CTA (화면당 1개) |
| Button Height Secondary  | `52px` | 보조 액션             |
| Button Height Small      | `40px` | 인라인 · 툴바 버튼    |

### Spacing

| Token                     | Value  | 용도                                 |
| ------------------------- | ------ | ------------------------------------ |
| Card Padding Small        | `16px` | 밀집 리스트 카드                     |
| Card Padding Default      | `20px` | 일반 카드                            |
| Hero Card Padding         | `24px` | 히어로 카드                          |
| Section Spacing           | `28px` | 주요 섹션 간 수직 간격               |
| Card Gap                  | `12px` | 카드 사이 간격                       |
| Screen Horizontal Padding | `20px` | 모바일 스크린 좌/우 기본 패딩        |

---

## 6. Shadow / Glow

| Token              | Value                                              | 용도                          |
| ------------------ | -------------------------------------------------- | ----------------------------- |
| Shadow Card        | `0px 8px 24px rgba(0, 0, 0, 0.24)`                 | 다크 모드 일반 카드           |
| Shadow Floating    | `0px 16px 40px rgba(0, 0, 0, 0.36)`                | 모달, 플로팅 액션             |
| Primary Glow       | `0px 0px 24px rgba(41, 195, 156, 0.28)`             | 핵심 CTA · 브랜드 발광        |
| Reward Glow        | `0px 0px 28px rgba(246, 196, 83, 0.32)`            | 보상 · 성취 팝업              |
| Blue Glow          | `0px 0px 24px rgba(47, 140, 255, 0.24)`            | 랭킹 · 성장 정보              |
| Light Card Shadow  | `0px 6px 18px rgba(17, 24, 39, 0.06)`              | 라이트 모드 카드 (정보성 화면) |

---

## 7. UI 원칙

1. **홈은 출석 관리 화면이 아니라 성장 로비처럼 구성한다.**
   캐릭터·리그·다음 목표가 먼저 보이고, 기능 바로가기는 그다음에 둔다.

2. **Primary 컬러는 핵심 행동에만 사용한다.**
   한 화면에 Primary CTA는 1개 원칙. 남발하면 강조가 사라진다.

3. **보상은 Gold, 랭킹/성장은 Blue, 액션·강조는 Mint로 역할을 분리한다.**
   - Reward (Gold `#F6C453`) → 보상 · 배지 · 성취
   - Accent (Blue `#2F8CFF`) → 랭킹 · 성장 지표
   - Primary (Mint `#29C39C`) → CTA · 시작/제출 액션

4. **캐릭터는 귀엽게만 보이지 않게 다크 스테이지와 리그 정보로 잡는다.**
   캐릭터 단독으로 두지 말고, 뒤에 다크 그라데이션·리그 뱃지·파티클 같은 프레이밍을 함께 배치.

5. **XP 바는 얇은 장식이 아니라 행동 유도 장치로 설계한다.**
   현재/목표 숫자를 Space Grotesk로 강조하고, 다음 단계 보상을 같이 노출한다.

6. **랭킹은 순위보다 상승감과 내 위치를 강조한다.**
   1~100위 풀리스트보다 "내 위치 · 내 바로 위 3명 · 추격 거리"를 우선.

7. **보상 팝업은 큰 성취 순간에만 사용해 희소성을 유지한다.**
   일상 XP 획득엔 쓰지 않는다. 레벨업·랭크업·배지 획득에 한정.

8. **하단 탭은 5개를 권장한다.**
   홈 / 훈련 / 랭크업 / 명예의 전당 / 단증혜택.

9. **정보성 화면은 라이트모드 친화적으로 설계한다.**
   가이드·안전 체크·설정 등 읽기 중심 화면은 `Surface Light` + `Light Card Shadow` 조합을 사용해 가독성을 최우선으로 둔다.

10. **기존 기능과 데이터 로직은 절대 훼손하지 않는다.**
    이 문서는 **UI 레이어 표준**이다. 라우팅·상태 관리·Supabase 스키마는 디자인 결정의 영향을 받지 않는다.

---

## 8. 사용 가이드

### 새 화면을 만들 때

1. 이 문서의 **Color / Typography / Radius / Shadow 토큰**을 직접 값으로 박지 말고, Tailwind 토큰(`shadow-glow-primary`, `bg-primary`, `rounded-2xl` 등) 또는 CSS 변수(`var(--primary)`)를 통해 참조한다.
2. 화면 목적에 맞는 **UI 원칙**(§7)을 먼저 확인한다.
3. Primary CTA는 화면당 1개, Reward 컬러는 성취 순간에만.

### 디자인 토큰을 바꿔야 할 때

1. 이 문서의 값을 먼저 수정한다.
2. `src/index.css`의 CSS 변수와 `tailwind.config.ts`의 매핑을 함께 업데이트한다.
3. 구현이 문서보다 앞서 나가지 않도록 한다 — 문서가 원천.

### 예외 처리

- **[LiveBoardPage](../src/pages/LiveBoardPage.tsx)** 는 체육관 TV용 풀스크린 전용 화면이다. 자체 아이덴티티를 가지며, 일반 화면 원칙의 적용 대상이 아니다.
- 게임 리그 색상(`League White/Blue/Red/Black`)은 **의미 토큰**이다. 장식이나 chrome으로 재사용하지 않는다.
