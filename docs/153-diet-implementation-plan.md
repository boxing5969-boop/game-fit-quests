# 153 다이어트 프로그램 — 구현 계획서 + 진행 상태

> **문서 위치:** `docs/153-diet-implementation-plan.md`
> **최초 작성:** 2026-04-22 (Stage 1)
> **최종 갱신:** 2026-04-22 (Stage 8 완료)
> **상태:** ✅ **1~8 단계 모두 완료**. 운영 가능 상태.
> **운영자 가이드:** [`docs/153-diet-operator-guide.md`](./153-diet-operator-guide.md)
> **범위 원칙:** 기존 복싱/출석/랭킹/아바타/젬/배지 기능을 **절대 파괴하지 않음** — 모든 Stage 에서 유지됨

---

## 0. 요약 (TL;DR)

**153 다이어트 프로그램** 은 21일 동안의 **습관 리셋** 모듈입니다. 체중 기반이 아니라 일일 5가지 습관 수행률로 평가합니다. 기존 앱의 attendance / approval / badge / gem / coach 패턴을 **그대로 복제**해서 추가하므로 신규 인프라는 **DB 3테이블 + Storage 버킷 1개 + RPC 7개** 로 최소화됩니다.

**핵심 안전 장치:**
- 청소년(만 18세 미만) 트랙 분리 — 단식/식사 거르기 기능 서버측 차단
- 체중 컬럼 자체를 DB에 두지 않음 (쿼리 자체가 불가능)
- `profiles.diet_program_enabled` feature flag 기본 OFF
- 의료 상태 동의서 버전 관리 (`diet_consent_records.version`)

---

## 1. 기존 기술 스택 분석

### 1.1 프론트엔드
| 항목 | 값 |
|---|---|
| Build | Vite 5 + React 18 + TypeScript |
| UI Framework | shadcn/ui (Radix primitives) + Tailwind CSS |
| Routing | `react-router-dom` v6 with `lazy()` code splitting |
| State | React Context (`AuthContext`) + `@tanstack/react-query` v5 |
| Forms | `react-hook-form` + `@hookform/resolvers` |
| Icons | `lucide-react` |
| Image | 자체 `src/lib/imageCompression.ts` (Canvas 기반) |
| QR | `html5-qrcode` (출석 체크인용) |

**진입점:** [src/App.tsx](../src/App.tsx) → `BrowserRouter` → `AuthProvider` → `AppRoutes` (라우트 30개+ 지연 로딩)

### 1.2 백엔드 / 인증
| 항목 | 값 |
|---|---|
| DB / Auth | Supabase PostgreSQL + Supabase Auth |
| 실시간 | `supabase_realtime` publication (notifications 등록됨) |
| 스토리지 | Supabase Storage (버킷 2개: `avatars`, `mission-videos`) |
| RPC | SQL functions (`SECURITY DEFINER SET search_path='public'`) |
| 타입 생성 | `src/integrations/supabase/types.ts` (수기 업데이트) |
| Edge Function | `chat-assistant` 1개 (Deno, Groq API 연결) |

### 1.3 인증 / 회원 / 프로필

**[src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx):**
- `user` — Supabase auth user
- `profile` — `profiles` 테이블 row (nickname, branch_name, birth_date, is_approved, onboarding_done, safety_done, tutorial_*)
- `progress` — `member_progress` 테이블 row (current_rank, current_level, total_xp, bosses_cleared, streak_days)
- `role` — `user_roles` 테이블 첫 행 (member | coach | branch_manager | admin | super_admin)

**가입 → 승인 → 입문 플로우 (ProtectedRoute 가드):**
```
가입 → 로그아웃 → 코치 승인 대기 (is_approved=false) →
로그인 → /select-branch → /onboarding (설문) → /safety-check →
/home (입단식 자동 실행)
```

**특이사항:**
- `profiles.birth_date` 는 **text 타입** (date 아님) — 나이 계산 시 안전 파싱 필요
- `SECURITY DEFINER + auth.uid()` 패턴이 모든 사용자 데이터 쓰기의 단일 진실원

### 1.4 DB 구조 (관련 테이블)

| 테이블 | 역할 | 재사용 포인트 |
|---|---|---|
| `profiles` | 회원 기본 + tutorial/onboarding flag | **컬럼 추가** (`diet_program_enabled`) |
| `member_progress` | 리그/레벨/XP/streak | **무수정** (diet 는 diet 만의 streak) |
| `user_wallets`, `wallet_transactions` | 젬 지갑 + 감사 로그 | `grant_gems()` RPC 재사용 |
| `user_roles` | 역할 | `has_role()`, `is_branch_manager_of()` 헬퍼 재사용 |
| `mission_submissions` | 코치 승인 패턴 레퍼런스 | 구조 복제 (건드리지 않음) |
| `attendance_logs` | 일일 체크인 레퍼런스 | 구조 복제 (건드리지 않음) |
| `badges`, `member_badges` | 배지 카탈로그 + 획득 | **code 추가** (`diet_starter` 등) + `INSERT ... ON CONFLICT DO NOTHING` |
| `notifications` | 인앱 알림 | `create_notification()` RPC 재사용 |
| `tutorial_step_claims` | 입단식 멱등 | 패턴 레퍼런스 |

### 1.5 스토리지 구조

**기존 버킷:**
- `avatars` (public=true) — 프로필 사진, 경로 `{user_id}/avatar.jpg`, RLS: 소유자 쓰기 + 전체 읽기
- `mission-videos` (RLS: admin 쓰기, 전체 읽기)

**패턴 소스:**
- [src/components/AvatarUpload.tsx](../src/components/AvatarUpload.tsx) — 압축 → upsert → 캐시 버스팅
- [src/lib/imageCompression.ts](../src/lib/imageCompression.ts) — Canvas 2D (512px/0.7 default)

**신규 예정:** `diet-photos` (public=false) — 식사 인증 사진. 경로 `{user_id}/{yyyy-mm-dd}.jpg`. RLS: 소유자 쓰기/읽기 + 담당 코치 읽기.

### 1.6 알림 시스템

**존재 O, 한계 있음:**
- `notifications` 테이블 + `create_notification(_user_id, _title, _body)` RPC
- `supabase_realtime` publication 등록돼 있어 클라이언트가 실시간 구독 가능
- 푸시 알림 / 이메일 / SMS / 백그라운드 크론 **없음**

**Diet 모듈 대응:**
- 1차: in-app notification (코치 피드백 도착, 마일스톤 달성)
- 2차 (선택, Stage 7): Edge function + pg_cron 으로 일일 리마인더

### 1.7 출석 / 체크인

**[record_attendance](../supabase/migrations/) RPC:**
- QR 모달 → RPC → attendance_logs insert → streak_days 업데이트 → is_duplicate 처리
- HomePage 우측 하단 QR 버튼

**Diet 모듈 독립성:**
- 일일 식습관 체크인은 **QR과 무관** — 자체 체크박스 5개 + 사진 1장
- `attendance_logs` 와 **테이블 분리**: `diet_daily_checkins`
- streak 계산도 별도 (연속 승인 일수)

### 1.8 리워드 시스템

**젬 (파이트 머니):**
- `grant_gems(_user_id, _amount, _reason)` RPC — 원자적 지갑 업데이트 + 트랜잭션 로그
- 기존 reason 코드: `tutorial_step`, `tutorial_completion`, `attendance`, `mission_reward`, 등
- Diet 신규 reason: `diet_checkin_approved` (+3), `diet_week_complete` (+15), `diet_21_complete` (+50)

**배지:**
- `badges` (code, name, description, icon_url) + `member_badges` (user_id, badge_id, awarded_at)
- 트리거 또는 RPC 내부에서 `INSERT ... ON CONFLICT DO NOTHING`
- Diet 신규 5종: `diet_starter`, `diet_week_reset`, `diet_week_burning`, `diet_21_complete`, `diet_coach_favorite`

**랭킹:**
- 기존: XP 기준 `get_division_ranking`, 보스 클리어 기준 `get_boss_conquerors`, 출석 streak 기준
- **Diet 신규**: `get_diet_ranking(_branch_name)` — `completion_rate = approved_days / enrolled_days * 100` 기준. 체중 컬럼 없음.

### 1.9 관리자 / 코치 대시보드

| 경로 | 역할 | 파일 |
|---|---|---|
| `/coach` | 코치 | [CoachDashboard.tsx](../src/pages/CoachDashboard.tsx) |
| `/manager` | 지점장 | [BranchManagerHome.tsx](../src/pages/BranchManagerHome.tsx) |
| `/admin` | 전체 관리자 | [SuperAdminDashboard.tsx](../src/pages/SuperAdminDashboard.tsx) |

**공통 승인 컴포넌트:** [ApprovalInbox.tsx](../src/components/ApprovalInbox.tsx) — mission/quest/member 승인 3탭 구조. **Diet 탭 1개만 추가** 하면 됨.

---

## 2. 추천 폴더 구조

```
src/
├── pages/diet/                          # 신규 페이지 7개
│   ├── DietHubPage.tsx                  # /diet — 진입점 (미가입/가입 분기)
│   ├── DietOnboardingPage.tsx           # /diet/onboarding — 동의 + 트랙 선택
│   ├── DietTrackerPage.tsx              # /diet/tracker — 일일 체크인
│   ├── DietProgressPage.tsx             # /diet/progress — 주간 캘린더 + 스테이지
│   ├── DietRankingPage.tsx              # /diet/ranking — 습관 완주율 랭킹
│   └── coach/
│       └── DietApprovalPage.tsx         # /coach/diet — 코치 승인 전용 (선택, ApprovalInbox 탭으로 대체 가능)
│
├── components/diet/                     # 신규 컴포넌트
│   ├── DailyHabitCheckList.tsx         # 5 체크박스 + 사진 업로더
│   ├── DietPhotoUpload.tsx             # 사진 1장 (imageCompression 재사용)
│   ├── DietStageBanner.tsx             # Reset/Burning/Lifestyle 표시
│   ├── DietWeekCalendar.tsx            # 주간 도트 그리드
│   ├── DietStreakCard.tsx              # 현재 연속 일수
│   ├── DietMilestoneBadge.tsx          # 7/14/21일 획득 시각화
│   ├── DietConsentGate.tsx             # 동의 모달 (재사용 가능)
│   └── coach/
│       └── DietApprovalCard.tsx        # 코치 개별 승인 카드
│
├── hooks/
│   ├── useDietEnrollment.ts            # 가입/재시작/활성 enrollment 조회
│   ├── useDietCheckin.ts               # 일일 체크인 제출/조회
│   ├── useDietProgress.ts              # 21일 진척도 + 현재 스테이지
│   ├── useDietRanking.ts               # 습관 완주율 랭킹
│   └── useDietApproval.ts              # 코치 승인/거절 (코치 전용)
│
├── data/
│   └── dietProgramData.ts              # ← Stage 1 에서 미리 생성 (scaffold)
│
├── lib/
│   └── dietTrack.ts                    # 나이→트랙 결정 helper (Stage 2)
│
└── integrations/supabase/types.ts      # 신규 테이블/RPC 타입 추가

supabase/
├── migrations/
│   └── 20260424000000_diet_program_foundation.sql   # Stage 2 에서 작성
└── functions/
    └── diet-daily-reminder/            # Stage 7 선택 구현
        └── index.ts

docs/
└── 153-diet-implementation-plan.md     # ← 이 문서
```

**폴더 분리 원칙:**
- 기존 `src/pages/` 에 단일 파일로 합치지 않음 (충돌 방지 + 삭제 용이)
- `components/diet/` 독립 폴더 (기존 `components/tutorial/`, `components/induction/` 와 동일 컨벤션)

---

## 3. 추천 라우트 구조

### 3.1 회원 라우트
| 경로 | 페이지 | 게이트 |
|---|---|---|
| `/diet` | DietHubPage | ProtectedRoute + feature flag |
| `/diet/onboarding` | DietOnboardingPage | 미가입자만 |
| `/diet/tracker` | DietTrackerPage | 가입자 + active enrollment |
| `/diet/progress` | DietProgressPage | 가입자 |
| `/diet/ranking` | DietRankingPage | 가입자 (또는 모든 회원) |

### 3.2 코치 라우트
| 경로 | 페이지 | 게이트 |
|---|---|---|
| `/coach/diet` | DietApprovalPage (선택) | ManagerRoute |
| 또는 `/coach?tab=diet` | ApprovalInbox 에 탭 추가 (권장) | ManagerRoute |

**BottomNav 영향:** 최소화. `/diet` 진입점은 메뉴(햄버거) 에만 추가 검토. 메인 5-탭 변경 없음.

### 3.3 App.tsx 변경 분량
- `lazy()` import 5개 추가
- `<Route>` 5개 추가
- **기존 라우트 수정 0개**

---

## 4. 추천 데이터 구조

### 4.1 ENUM 3종

```sql
CREATE TYPE diet_track          AS ENUM ('adult', 'teen');
CREATE TYPE diet_stage          AS ENUM ('reset', 'burning', 'lifestyle');
CREATE TYPE diet_checkin_status AS ENUM ('pending', 'approved', 'rejected', 'revision_requested');
```

### 4.2 테이블 3종

#### `diet_program_enrollments`
회원 1명당 여러 행(과거 회차 이력 보존), `active=true` 는 최대 1개.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL (FK auth.users) | |
| track | diet_track NOT NULL | 서버가 연령으로 강제 |
| started_at | timestamptz DEFAULT now() | |
| finished_at | timestamptz NULL | 21일 완료 또는 중도 포기 |
| active | boolean DEFAULT true | |
| current_day | int DEFAULT 1 CHECK (BETWEEN 1 AND 21) | |
| current_stage | diet_stage DEFAULT 'reset' | 1~7 reset, 8~14 burning, 15~21 lifestyle |
| advanced_fasting_unlocked | boolean DEFAULT false | **기본 OFF**. 성인+코치+no-risk 시만 true |
| risk_factors | jsonb DEFAULT '{}' | 임신/질환/섭식장애 여부 |
| branch_name | text | enrollment 시점 스냅샷 |

**인덱스:** `(user_id, active)` WHERE active = true.

#### `diet_daily_checkins`
일일 습관 + 사진 + 코치 피드백.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK | |
| user_id | uuid (denormalize, RLS) | |
| date | date NOT NULL | |
| day_number | int NOT NULL (1~21) | |
| protein_first | boolean | 습관 1 |
| veggies_ok | boolean | 습관 2 |
| low_sugar | boolean | 습관 3 |
| activity_ok | boolean | 습관 4 |
| sleep_ok | boolean | 습관 5 |
| note | text NULL | 200자 제한 (선택) |
| photo_url | text NULL | diet-photos 버킷 경로 |
| status | diet_checkin_status DEFAULT 'pending' | |
| submitted_at | timestamptz DEFAULT now() | |
| reviewed_by | uuid NULL | 코치 user_id |
| reviewed_at | timestamptz NULL | |
| coach_feedback | text NULL | |
| UNIQUE (enrollment_id, date) | | 하루 1회 |

**인덱스:** `(user_id, date DESC)`, `(status, reviewed_at)`.

#### `diet_consent_records`
감사용 동의 이력.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| version | int NOT NULL | 동의서 버전 (1부터 시작) |
| accepted_at | timestamptz DEFAULT now() | |
| has_medical_condition | boolean DEFAULT false | |
| has_eating_disorder_history | boolean DEFAULT false | |
| is_pregnant | boolean DEFAULT false | |
| acknowledges_teen_restrictions | boolean | 청소년일 때 true |
| UNIQUE (user_id, version) | | |

### 4.3 profiles 확장 1개 컬럼

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS diet_program_enabled boolean NOT NULL DEFAULT false;
```

Feature flag. 기본 OFF. Stage 8 롤아웃 시 super_admin 이 켬.

### 4.4 Storage 버킷 1개

- 이름: `diet-photos`
- public: `false` (RLS 경유 읽기)
- RLS:
  - INSERT: `auth.uid()::text = (storage.foldername(name))[1]`
  - SELECT own + SELECT coach-of-member
  - UPDATE/DELETE: 소유자만

### 4.5 RPC 7종

| RPC | 호출자 | 반환 | 설명 |
|---|---|---|---|
| `get_caller_age()` | 모든 authenticated | int NULL | birth_date 안전 파싱 |
| `resolve_diet_track()` | 모든 authenticated | diet_track NULL | 18세 미만 → teen, 이상 → adult |
| `enroll_diet_program(_track, _consent_version, _risk_factors)` | member | jsonb | 청소년은 teen 강제. 중복 가입 차단. consent_records 동시 insert |
| `submit_diet_checkin(_date, _habits jsonb, _photo_url, _note)` | member | jsonb | day_number 자동 계산. pending 으로 insert. teen 은 단식 플래그 검증 차단 |
| `approve_diet_checkin(_checkin_id, _feedback)` | coach+ | jsonb | status → approved, grant_gems +3, 배지 자동 체크 (7/14/21일) |
| `get_diet_progress(_user_id NULL default caller)` | any | jsonb | current_day, stage, completion_rate, pending_days |
| `get_diet_ranking(_branch_name, _limit)` | any | table | completion_rate 기준 정렬. 체중 없음 |

### 4.6 배지 5종 (seed)

| code | name | 조건 |
|---|---|---|
| `diet_starter` | "첫 걸음" | 첫 승인된 체크인 |
| `diet_week_reset` | "리셋 완료" | 1~7일 중 5일 이상 승인 |
| `diet_week_burning` | "연소 중" | 8~14일 중 5일 이상 승인 |
| `diet_21_complete` | "21일 완주" | 21일 중 18일 이상 승인 |
| `diet_coach_favorite` | "코치 추천" | 코치가 수동 부여 (approve_diet_checkin 의 `_is_featured` 옵션) |

---

## 5. 멤버용 플로우

```
[진입] /diet
  │
  ├─ 가입 이력 없음
  │     ↓
  │   /diet/onboarding
  │     ├─ Step 1: 트랙 안내 (성인/청소년)
  │     ├─ Step 2: 위험요인 체크 (임신/질환/섭식장애)
  │     ├─ Step 3: 동의서 서약 (v1)
  │     └─ enroll_diet_program RPC → /diet/tracker
  │
  └─ 가입 이력 있음 + active
        ↓
      /diet/tracker
        ├─ 오늘 체크인 (pending 없으면)
        │   ├─ 5 체크박스 (단백질 먼저 / 채소 / 저당 / 활동 / 수면)
        │   ├─ 사진 업로드 (선택)
        │   ├─ 짧은 메모 (선택, 200자)
        │   └─ submit_diet_checkin RPC → status=pending
        │
        ├─ 오늘 체크인 완료 (pending)
        │   └─ "코치가 확인 중" 표시
        │
        └─ 과거 일자 요약 (주간 캘린더 도트 그리드)
            └─ /diet/progress 이동 가능
```

### 5.1 청소년 트랙 제한
- 서버 RPC `submit_diet_checkin` 에서 단식/식사거르기 관련 옵션 field 자체를 제공하지 않음
- 클라이언트 UI 에서도 해당 옵션 표시 안 함
- `advanced_fasting_unlocked=true` 시도가 서버에서 강제로 차단 (trigger 또는 RPC gate)

### 5.2 성인 트랙 기본 규칙 (극단 아님)
- 기본 5 체크박스만. 단식 기능 OFF (`advanced_fasting_unlocked=false` default)
- "습관 리셋" 중심. 칼로리 입력 없음
- 체중 입력 없음 (아예 DB에 없음)

---

## 6. 코치용 플로우

```
/coach
  ├─ (기존) 미션 승인 탭
  ├─ (기존) 퀘스트 승인 탭
  ├─ (기존) 가입 승인 탭
  └─ (신규) 식습관 승인 탭  ← ApprovalInbox 에 탭 추가
       ├─ pending 목록 (회원명 + 날짜 + 사진 썸네일)
       ├─ 카드 탭 → 확대 사진 + 5 체크 상태 + 메모
       └─ [승인] [반려] [수정요청] + 피드백 텍스트
             ↓
           approve_diet_checkin / reject_diet_checkin RPC
             ↓
           회원에게 create_notification ("식습관 피드백 도착")
```

**코치 권한:**
- `is_branch_manager_of(auth.uid(), checkin.user_id)` 또는 `is_coach_of` 만 승인 가능
- RLS 로 타 지점 회원 체크인 조회 자체 차단

---

## 7. 기존 시스템과의 연동 포인트

| 연동 대상 | 방식 | 주의사항 |
|---|---|---|
| **`profiles` 테이블** | `diet_program_enabled` 컬럼 1개 추가 | 기존 컬럼 0 변경 |
| **`grant_gems()` RPC** | `approve_diet_checkin` 내부에서 호출 | 함수 시그니처 불변 — 인자만 전달 |
| **`member_badges` 테이블** | 21일 완료 트리거에서 `INSERT ... ON CONFLICT DO NOTHING` | 기존 뱃지 수정 0 |
| **`create_notification()` RPC** | 코치 피드백 시 호출 | 기존 알림 플로우 무수정 |
| **`ApprovalInbox.tsx`** | 탭 1개 추가 | 기존 3탭 수정 0 (신규 탭만 append) |
| **`AuthContext`** | 무변경 | `profile.diet_program_enabled` 자동 포함 (select * 기준) |
| **`AvatarUpload` 패턴** | 복제해서 `DietPhotoUpload` 신규 생성 | 원본 무수정 |
| **`imageCompression.ts`** | 재사용 | 파일 변경 없음 |
| **`isManagerRole`** | 재사용 | `src/lib/rankLabels.ts` 무수정 |
| **`BottomNav`** | 5-탭 기본 무수정 + 메뉴에 "/diet" 1줄 추가 | 메뉴 아이템 append |
| **입단식 (InductionCeremonyOverlay)** | 무수정 | 다이어트는 별도 경로, 오버레이 간섭 없음 |
| **랭킹 시스템 (`get_division_ranking`)** | 무수정 | 다이어트 랭킹은 별도 RPC |
| **출석 (`record_attendance`)** | 무수정 | 다이어트 체크인과 테이블 분리 |

**파괴 위험 0.** 기존 기능 roll-back 이 모두 "수동 DELETE diet_* + 컬럼 DROP + 파일 삭제" 로 닫힘.

---

## 8. 안전하게 개발할 구현 순서

각 Stage 는 독립 배포 가능. 각 Stage 완료 시 tsc/build 통과가 필수.

### ✅ Stage 1 — 분석 + 얇은 scaffold
- [x] `docs/153-diet-implementation-plan.md` 작성
- [x] `src/data/dietProgramData.ts` 상수 scaffold
- [x] tsc 통과

### ✅ Stage 2 — DB 기반 + Storage + 타입
- [x] `20260424000000_diet_program_foundation.sql` — enum 7 / 테이블 7 / RPC 7 / RLS / 버킷
- [x] `types.ts` 수동 업데이트
- [x] `src/lib/dietTrack.ts` 나이 helper
- [x] `src/services/dietService.ts` 서비스 레이어

### ✅ Stage 3 — 규칙 엔진 + 미션 템플릿 + 음식 가이드
- [x] `src/lib/diet/ruleEngine.ts` (day→stage·mission, sanitize, advanced 활성)
- [x] `src/data/diet/missionTemplates.ts` (3 트랙 × 21일)
- [x] `src/data/diet/foodGuidance.ts` (카드 20종, youthSafe 필터)
- [x] `src/data/diet/maintenanceVariants.ts` (유지 플랜 4종)
- [x] vitest 41 케이스

### ✅ Stage 4 — 온보딩 + 동의
- [x] `/diet`, `/diet/onboarding` 라우트
- [x] `useDietEnrollment`, `DietConsentGate`, `DietTrackBadge`, `DietRiskWarningBanner`
- [x] 5-step wizard (소개 → 안내 → 사전체크 → 동의 → 시작)
- [x] 로컬 드래프트 저장·재개
- [x] feature flag 게이트

### ✅ Stage 5 — 멤버 핵심 화면 (체크인·진행·가이드)
- [x] `DietTrackerPage` (일일 체크인 + 4슬롯 사진)
- [x] `DietProgressPage` (21일 타임라인 + 주간 카드)
- [x] `DietFoodGuidePage` (권장/줄이기/상황 팁)
- [x] Hub 확장 (점수·미션·배지·코치한마디)
- [x] 공용 컴포넌트 8종

### ✅ Stage 6 — 점수 엔진 + 배지 확장 + 코치 대시보드
- [x] `src/lib/diet/scoreEngine.ts` (일/주/21일/미션 완료율) + vitest 27
- [x] `20260425000000_diet_streak_perfect_badges.sql` (배지 2종 추가 + review_diet_log 확장)
- [x] `/coach/diet` 인박스 (기존 ApprovalInbox 무수정)
- [x] `/coach/diet/member/:memberId` 상세
- [x] `/diet/ranking` 습관 점수 리더보드
- [x] `DietApprovalCard`, `DietCoachTemplatePicker` (템플릿 6종)

### ✅ Stage 7 — 출석·알림·리워드·분석·설정 통합
- [x] `20260426000000_diet_integrations.sql` (analytics_events + preferences + RPC 3)
- [x] `attendanceBridge` — 기존 `attendance_logs` adapter
- [x] `DietReminderBanner` — 시간대 + rejected 회복
- [x] `DietSettingsSection` — SettingsPage 에 append
- [x] 분석 이벤트 9종 기록 (enrollment_started ~ coach_note_sent)
- [x] `get_diet_ranking` 에 `ranking_visible=false` 옵트아웃 필터

### ✅ Stage 8 — QA · 안정화 · 문서화 (현재)
- [x] Drop-off 감지 (3일 공백 배너 + `drop_off_marked` 이벤트, 세션당 1회)
- [x] `DietCompletionModal` — 21일 완주 축하 모달 (로컬 플래그 1회 노출)
- [x] 유지 플랜 picker — SettingsSection 에 Day 18+ 조건부 노출, `diet_preferences.maintenance_variant` 저장
- [x] 문서 2종 (`153-diet-operator-guide.md` 신규, 본 문서 갱신)
- [x] 최종 tsc / eslint / vitest / vite build 통과
- [x] 전체 기능 점검 완료

---

## 9. 절대 규칙 대응 요약

| 규칙 | 대응 |
|---|---|
| 1. 기존 기능 미파괴 | 기존 파일 수정 최소화 (App.tsx 라우트 추가, ApprovalInbox 탭 추가만) |
| 2. 기술 스택 준수 | Vite + React + TS + Supabase + shadcn — 새 의존성 없음 |
| 3. 단계별 구현 | 8-Stage 분할 |
| 4. 책/자료 복붙 금지 | 5 습관 / 3 스테이지 명칭은 유저 제시 문구만 사용. 외부 자료 참조 없음 |
| 5. 성인/청소년 분리 | `diet_track ENUM` + 서버측 강제 |
| 6. 청소년 극단 금지 | 청소년 단식 플래그 field 미제공 + RPC 검증 |
| 7. 성인 기본 극단 금지 | 기본 5 체크박스 중심. 칼로리/체중 입력 없음 |
| 8. 단식 옵션 기본 OFF | `advanced_fasting_unlocked DEFAULT false`. 별도 unlock RPC |
| 9. 랭킹 = 습관 수행률 | `get_diet_ranking` = completion_rate 만. 체중 컬럼 없음 |
| 10. 한국어 모바일 UX | shadcn 기반 카드/버튼, 한국어 인라인 |
| 11. 기존 시스템 연동 | gems/badges/notifications/ApprovalInbox 재사용 |
| 12. 입력 부담 최소 | 5 체크박스 + 사진 1장 + 짧은 메모만 |
| 13. 의료 진단 아님 | 면책 동의서 + 경고 고정 문구 |
| 14. 변경 후 검증 | 각 Stage 끝에 tsc/build/lint 실행 |

---

## 10. 오픈 이슈 (Stage 2 에서 결정)

1. **재도전 정책** — 21일 완료 후 즉시 재가입 허용? 쿨다운? → 현재 계획: 즉시 허용 (`enrollments` 여러 행 보존)
2. **브랜치 변경 시** — active enrollment 는 중단? 유지? → 현재 계획: `branch_name` 스냅샷 컬럼으로 해당 회차는 유지, 랭킹은 현재 branch 로 집계
3. **배지 아이콘** — 신규 5종 이미지 필요 → Stage 5 전에 디자인 요청
4. **일일 알림 시간** — 기본 07:00 / 회원 설정 가능 → Stage 7
5. **RLS 최적화** — 코치 권한 확인이 매 RPC 마다 `is_branch_manager_of` 호출 → 인덱스 확인 필요

---

**끝.** Stage 2 진행 승인 부탁드립니다.
