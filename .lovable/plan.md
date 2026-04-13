

# 라이브보드 중앙 SD풍 복서 캐릭터 추가

## 현재 구조
- 중앙 영역(line 454-515): 팝업 시 회원 정보 카드, 대기 시 "153 랭크업 시스템" 텍스트 + 이모지
- 오른쪽 패널(line 517-593): 현재 활동 중 / 오늘 방문 — 변경 없음

## 구현 방식
**CSS keyframe animation + SVG 기반 2D SD 캐릭터** — 외부 라이브러리 없이 가볍게 구현. Lottie/sprite sheet 불필요. CSS animation은 GPU 가속되어 저사양 TV/태블릿에서도 부드럽게 동작.

## 수정 파일

### 1. `src/components/SDBoxerCharacter.tsx` (신규)
- SVG로 SD풍 복서 캐릭터 렌더링 (큰 머리, 작은 몸, 복싱 글러브)
- Props: `league`, `nickname`, `level`, `state` (idle/enter/exit)
- 리그별 색상 변경: 글러브/하이라이트 색상을 league prop에 따라 변경
  - white: 회색/은색
  - blue: 파랑
  - red: 빨강
  - black: 검정+골드
- 애니메이션 상태:
  - **입장**: scale-in + 잽 모션 (CSS keyframe ~1초)
  - **대기(idle)**: 좌우 스텝 + 가드 자세 루프 (3초 주기)
  - **퇴장**: fade-out
- 캐릭터 아래 이름표: 닉네임(가장 크게) → 리그·레벨 → "복싱 레벨업 중"
- 바닥 그림자(ellipse shadow) 포함

### 2. `src/pages/LiveBoardPage.tsx` 수정
중앙 영역(line 456-491)만 변경:

**팝업 시 (회원 입장):**
- 기존 카드 레이아웃 대신 SDBoxerCharacter 컴포넌트 표시
- `state="enter"` → 1초 후 `state="idle"`로 전환
- latestPopup의 닉네임/리그/레벨을 캐릭터에 전달

**대기 시 (회원 없음):**
- 기본 SDBoxerCharacter를 `league="white"`, `state="idle"`로 표시
- 이름표: "오늘도 복싱 레벨업 중" + 지점명

**현재 활동 중 회원이 있고 팝업이 꺼졌을 때:**
- activeMembers 중 가장 최근 입장한 회원 1명의 캐릭터를 idle 상태로 표시

## 성능 고려
- CSS `will-change: transform`으로 GPU 가속
- `@media (prefers-reduced-motion)` 존중
- setTimeout/setInterval cleanup으로 메모리 누수 방지
- SVG는 인라인으로 번들에 포함 — 네트워크 요청 없음

## 변경하지 않는 것
- 오른쪽 패널 (활동 중/오늘 방문/명예의 전당)
- HomePage, QRScannerModal, SelfChallengeFlow
- 입장/퇴장 로직, activity_sessions 쿼리
- edge function

