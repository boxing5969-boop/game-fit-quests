

# 153랭크업 앱 전체 코딩 현황 + 오류 진단 PDF 생성 계획

## 생성할 문서
현재 앱의 **전체 기능 목록**, **코딩 구조**, **발견된 오류/경고**, **각 페이지별 상태**를 정리한 PDF 문서

## PDF 구성

### 1. 프로젝트 개요
- 기술 스택: React 18, Vite 5, Tailwind CSS, TypeScript, Supabase (Lovable Cloud)
- 라우트 수: 30개+, 컴포넌트 수: 50개+, 훅 수: 15개+

### 2. 전체 라우트 및 페이지 목록 (30개)
- 각 페이지별 경로, 역할(회원/관장/관리자), 주요 기능 정리
- 보호 라우트 구조 (ProtectedRoute, ManagerRoute)

### 3. 핵심 기능별 현황
- **인증 시스템**: 로그인/회원가입/비밀번호 찾기/승인 대기
- **레벨 시스템**: 4리그(White→Black) × 10레벨 = 40레벨
- **미션 시스템**: 영상 미션 + 제출/승인 플로우
- **QR 체크인**: 출석 + XP + SelfChallenge 자동 시작
- **캐릭터 시스템**: 12 프리셋 + 스튜디오 + 명예의 전당
- **아바타/아이템**: 링젬 상점 + 장착 시스템
- **관장님 대시보드**: 회원관리/승인/레벨관리/미션관리
- **랭킹/명예의전당**: Hall of Fame + Character Rail

### 4. 발견된 오류 및 경고 목록
| # | 위치 | 유형 | 설명 |
|---|------|------|------|
| 1 | `CharacterStudioPage.tsx` EffectsTab | React Warning | `Function components cannot be given refs` — EffectsTab에 ref 전달 시도 |
| 2 | `characterPartsData.ts` | 데이터 불일치 | DB `character_parts` 테이블이 비어있음 — 81개 파츠 정의는 코드에만 존재 |
| 3 | `LayeredCharacterRenderer.tsx` | 스타일 불일치 | SVG 렌더러가 PNG 프리셋과 시각적으로 다름 — 현재 숨김 처리됨 |
| 4 | `/avatar`와 `/character-studio` | UX 중복 | 두 페이지가 캐릭터 관련 기능 중복 |
| 5 | `BottomNav.tsx` | 성능 | 모든 탭 활성화 시 CharacterSprite 렌더링 — 불필요한 리렌더 가능 |
| 6 | `LevelMapPage.tsx`와 `RankUpPage.tsx` | 코드 중복 | SECRET_MISSIONS, DAN_CHALLENGES, FINAL_REWARDS 상수 완전 중복 |
| 7 | `RewardsPage.tsx`와 `MyPage.tsx` | UI 중복 | 배지/XP 로그 섹션이 거의 동일하게 반복 |
| 8 | `useLocalProgress.ts` | 하이브리드 상태 | localStorage + Supabase 혼합 — 동기화 이슈 가능성 |
| 9 | `characterUnlockData.ts` | 기능 미구현 | 81개 파츠 키 정의됐지만 실제 렌더링 불가 (꾸미기 "준비 중") |
| 10 | `AuthContext.tsx` signUp | 파라미터 불일치 | 함수 시그니처에 `birthDate`가 `realEmail`로 표시됨 |

### 5. DB 테이블 및 스키마 현황
- 주요 테이블 목록 + RLS 정책 요약

### 6. Edge Functions 현황
- chat-assistant, delete-user, qr-checkin, qr-token-refresh, verify-identity-reset

### 7. 개선 권장사항
- 중복 코드 통합, SVG/PNG 스타일 통일, DB 파츠 데이터 동기화 등

## 구현 방법
- Python `reportlab`로 PDF 생성
- 한국어 폰트(Noto Sans KR) 사용
- `/mnt/documents/153_app_status_report.pdf`에 저장
- 생성 후 각 페이지 시각 QA

