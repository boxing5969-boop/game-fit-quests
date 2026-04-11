

# 153 RankUp 전체 코드베이스 & 기능 레퍼런스 문서 생성

GPT에 업로드할 수 있는 종합 레퍼런스 파일을 생성합니다. 기존 기능의 중복 생성이나 충돌을 방지하기 위한 목적입니다.

## 생성할 파일

하나의 Markdown 파일 (`/mnt/documents/153_RankUp_Reference.md`)에 다음 내용을 포함:

1. **프로젝트 개요** — 기술 스택, 디자인 톤, 한국어 UI 규칙
2. **파일 구조** — 전체 `src/` 디렉터리 트리 + 각 파일의 역할 설명
3. **라우팅 & 네비게이션** — `App.tsx` 라우트 매핑, `BottomNav` 탭 구성, ProtectedRoute/ManagerRoute 로직
4. **인증 & 권한** — `AuthContext` 전체 구조, 역할(member/coach/admin/branch_manager/super_admin), 가입/로그인 흐름, 승인 대기 로직
5. **DB 스키마** — Supabase types.ts 기반 전체 테이블 목록 + 컬럼 정의
6. **마이그레이션 목록** — 32개 마이그레이션 파일 참조
7. **Edge Functions** — chat-assistant, delete-user, verify-identity-reset
8. **데이터 파일** — `whiteLevel1Data.ts`, `whiteLevelData.ts`, `valueMapData.ts` 등 9개 data 파일의 전체 구조/인터페이스/상수
9. **Hooks** — 8개 커스텀 훅의 역할과 반환값
10. **컴포넌트** — 20개 컴포넌트 각각의 props, 기능, 사용처
11. **페이지** — 22개 페이지 각각의 기능, 상태관리, 의존성
12. **White Lv.1 승급 시스템** — 세션 인정 규칙, XP 규칙, 승급 조건, 체크리스트, 보완 규칙, 로컬 프로그레스 로직
13. **UI 제약사항** — 리그 용어 규칙, 복싱 테마 제약, 금지 표현
14. **주요 유틸리티** — `rankLabels.ts`, `celebrations.ts`, `mockData.ts`

## 기술 상세

- Python 스크립트로 Markdown 파일 생성
- 핵심 소스 코드는 코드블록으로 직접 포함 (GPT가 정확히 참조 가능)
- 파일 크기 약 80-120KB 예상 (GPT 업로드 적합)
- 한국어 + 영어 혼합 (코드 코멘트 기준)

