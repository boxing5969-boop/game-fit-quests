# 153 다이어트 프로그램 — 운영자 가이드

> **대상:** 관장·코치·운영 관리자
> **범위:** 기능 개요, 멤버·코치 플로우, 롤아웃 절차, 데이터/알림 구조, 주의사항, 확장 포인트
> **관련 문서:** [`153-diet-implementation-plan.md`](./153-diet-implementation-plan.md) (기술 설계)

---

## 0. 한 줄 요약

> "살을 빼는 21일"이 아니라 **"살이 덜 찌는 몸습관을 만드는 21일"** 프로그램. 체중 숫자 대신 습관 수행률·출석·코치 피드백으로 운영한다.

---

## 1. 기능 개요

| 영역 | 설명 |
|---|---|
| **트랙 3종** | `adult_standard` (성인 기본) · `youth_habit` (청소년) · `adult_advanced_hidden` (코치 승인형, 기본 비노출) |
| **21일 구조** | Reset(1~7) · Burning(8~14) · Lifestyle(15~21). 단계마다 미션 세트 자동 계산 |
| **일일 체크인** | 5 습관 체크 + 물/걸음/수면 수치 + 식단 사진 4 슬롯 + 한 줄 회고 + 기분 |
| **코치 승인** | 승인 / 반려 / 수정 요청 3-state. 템플릿 6종으로 한마디 전송 |
| **리워드** | 승인당 +3젬 · 21일 완주 +50젬 · 배지 7종 자동 지급 |
| **랭킹** | 지점 내 승인 일수·최고 스트릭 기반. 체중 미사용. 옵트아웃 지원 |
| **리마인더** | 아침·점심·저녁 + drop-off 복귀 배너 (인앱 한정) |

### 1.1 절대 금지 사항

- 체중 감소량 공개 / 체중 랭킹 / 체중 컬럼 조회 금지 (DB 스키마에도 해당 필드 없음)
- 청소년(`youth_habit`) 트랙에 단식·식사 거르기·극단 제한 UI 노출 금지 (자체 테스트로 검증)
- 의료 진단·치료 문구 금지. 운영 플래그는 "주의 필요" 수준만
- `adult_advanced_hidden` 활성화는 반드시 **코치 승인 + 성인 + 위험요인 없음** 3조건 모두 성립해야 함

---

## 2. 멤버(회원) 플로우

```
1. /diet 진입 (feature flag ON 인 경우에만 노출)
   └─ enrollment 없음 → [3분 온보딩 시작] CTA

2. /diet/onboarding (5-step wizard)
   ├─ Step 1: 소개 (1 목표 · 5 습관 · 3 단계 요약)
   ├─ Step 2: 프로그램 안내 (Reset/Burning/Lifestyle 설명, 랭킹 철학)
   ├─ Step 3: 사전 체크 (연령 자동 · 목표 · 운동일 · 수면 · 빈도 3 · 건강 4체크)
   ├─ Step 4: 동의 + 경고 (임신·당뇨·섭식장애 등 위험요인에 맞춤 안전 모드 안내)
   └─ Step 5: 시작일 선택 → enrollment 생성 (track 자동 결정)

3. /diet (홈) — 오늘의 요약
   ├─ 리마인더 배너 (drop-off > rejected > 시간대 순)
   ├─ Hero: Day N/21 + Stage + Track 뱃지
   ├─ 체크인 CTA (상태별 카피 변화)
   ├─ 오늘 습관 점수 + 완주율 + 스트릭
   ├─ 오늘의 미션 카드 5개
   ├─ 배지 진행 bar (7/14/21)
   ├─ 코치 한마디
   └─ 네비게이션: 진행현황 · 음식가이드 · 습관랭킹

4. /diet/tracker — 일일 체크인
   ├─ 5 습관 체크 (탭 1회 on/off)
   ├─ 물 ml · 걸음 · 수면 시간 (선택)
   ├─ 기분 4픽 + 200자 메모
   ├─ [임시저장] 또는 [오늘 체크인 저장]
   └─ 저장 후 식단 사진 4슬롯 활성 (카메라 자동 호출)

5. 코치 승인 대기 → 승인 시 +3젬 + 배지 자동 갱신
6. 21일 완주 → 축하 모달 + 유지 플랜 선택 유도
```

### 2.1 자동 출석 연동

기존 `attendance_logs` 에 오늘 QR 체크인 row 가 있으면 Tracker 마운트 시 `gym_attended=true` 로 자동 반영. 사용자가 수동 off 한 뒤엔 덮어쓰지 않음 (1회 초기값 동기화).

### 2.2 청소년 예외 처리

- `profiles.birth_date` 파싱 결과 18세 미만 → `youth_habit` 트랙 강제 (서버 `enroll_diet_program` + 클라 `sanitizeTrackSelection` 이중 검증)
- 트리거 `diet_enforce_track_rules` 가 `youth_habit + advanced_feature_enabled=true` 조합을 DB 수준에서 거부
- 음식 가이드에서 "술" 카드 자동 숨김 (`youthSafe=false` 필터)
- 미션 템플릿에 "단식/거르기/굶기" 키워드 배제 (vitest 41 케이스에서 테스트)

---

## 3. 코치 플로우

```
1. /coach/diet — 식습관 승인 인박스
   ├─ 지점 내 pending 체크인 목록 (RLS 자동 필터)
   ├─ 정렬: 오래된 순(SLA) / 최신 순
   ├─ 필터: 전체 / 사진 있음 / 사진 없음
   └─ 각 카드: 닉네임 · Day/Stage · 점수 · 5체크 · 수치 3 · 사진 count · 회원 회고

2. 카드 액션
   ├─ [템플릿 선택] — 6종 (다시시작 독려 / 당음료 집중 / 수면 챙기기 / 한주 축하 / 휴식 권장 / 주간리뷰)
   ├─ 피드백 300자 수동 편집
   ├─ [반려] → status=rejected + 회원에게 in-app 알림
   ├─ [수정] → revision_requested + 알림
   └─ [승인] → approved + 3젬 + milestone 자동 배지 + 알림

3. 카드 헤더 탭 → /coach/diet/member/:memberId
   ├─ 회원 프로필 + 위험 플래그 칩
   ├─ 21일 타임라인 + 주간 승인 카운트
   ├─ 피드백 내역 (member_visible/private)
   ├─ 새 노트 작성 (템플릿 + 내부메모 or 회원 전송)
   └─ Day 18+ 회원에게 유지 플랜 4종 추천 카드
```

### 3.1 운영 힌트 (질병 진단 대체 가이드)

- 연속 미기록 + 수면 짧음 → "수면 챙기기" 템플릿 권장
- 반려 빈도 높음 → "다시 시작 독려" 템플릿
- 강한 훈련 + 피로 메모 → "휴식 권장" 템플릿
- Day 7/14 도달 → "한 주 잘했어요" 또는 "주간 리뷰 안내"

코치 노트는 건강 상태 진단 문구를 피하고 **행동 제안 1가지**를 담는 톤을 유지한다.

---

## 4. 롤아웃 절차 (관리자)

### 4.1 신규 지점 오픈 시

```sql
-- 특정 지점 회원 전체에 feature flag ON
UPDATE profiles
SET diet_program_enabled = true
WHERE branch_name = '지점명'
  AND is_approved = true;
```

### 4.2 테스트 계정만 ON

```sql
UPDATE profiles SET diet_program_enabled = true WHERE user_id = '<uuid>';
```

### 4.3 전사 OFF (긴급)

```sql
UPDATE profiles SET diet_program_enabled = false;
```

이미 enrollment 중인 회원은 데이터는 보존되며, UI 진입점만 차단된다. 재개 시 `true` 복원으로 계속 진행 가능.

### 4.4 지점 변경 시

- enrollment 의 `branch_name` 은 **enrollment 시점 스냅샷**으로 고정 (이력 보존)
- 랭킹은 `profiles.branch_name` 기준이라 새 지점에 즉시 반영
- 데이터 초기화는 발생하지 않음

---

## 5. 데이터 구조 (요약)

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `diet_program_enrollments` | 회원 1명당 여러 회차 이력 | track, status, current_day, current_stage, warning_flags |
| `diet_daily_logs` | 일별 습관·수치·상태 | status, water_ml, step_count, sleep_hours, 5 habits, memo, coach_feedback |
| `diet_daily_log_photos` | 식단 사진 (1:N) | storage_path, meal_slot |
| `diet_weekly_reviews` | 주간 회고 (선택) | waist_cm (개인용), reflection, adherence_summary |
| `diet_coach_notes` | 코치 노트 | note_text, template_type, visibility (private/member_visible) |
| `diet_progress_snapshots` | 1:1 per enrollment | approved_days_total, current_streak, best_streak, milestone_*_reached |
| `diet_safety_screenings` | 동의 + 위험 플래그 이력 | age_group, is_youth, pregnancy, diabetes, eating_disorder, other |
| `diet_analytics_events` | 이벤트 로그 (append-only) | event_type, event_data |
| `diet_preferences` | 1:1 per user 설정 | settings jsonb (reminders, notifications, privacy, maintenance_variant) |

### 5.1 배지 (7종)

| code | 조건 | 지급 시점 |
|---|---|---|
| `diet_starter` | 첫 승인 | review_diet_log approved (최초) |
| `diet_week_7` | 누적 승인 7일 | approved_days_total >= 7 |
| `diet_week_14` | 누적 승인 14일 | approved_days_total >= 14 |
| `diet_21_complete` | 21일 완주 | approved_days_total >= 21 |
| `diet_streak_7` | 7일 연속 승인 | current_streak >= 7 |
| `diet_perfect_week` | 한 주 7/7 승인 | 해당 주 count >= 7 |
| `diet_coach_favorite` | 코치 수동 추천 | 별도 RPC 호출 예정 (Stage 8+) |

### 5.2 보상 (파이트 머니)

| 경로 | 금액 | `wallet_transactions.reason` |
|---|---|---|
| 일일 체크인 승인 | +3 | `diet_checkin_approved` |
| 21일 완주 | +50 | `diet_21_complete` |

---

## 6. 알림 구조

### 6.1 in-app 알림 (`notifications` 테이블)

서버 RPC 가 다음 시점에 자동 생성:
- `review_diet_log` (approved/rejected/revision_requested) — 회원에게 상태 알림
- `create_diet_coach_note` (visibility=member_visible) — 회원에게 피드백 도착 알림

### 6.2 in-app 배너 (`DietReminderBanner`)

클라이언트에서 매 홈 방문 시 계산:
1. `last_log_date >= 3일 전` → "N일 쉬었어도 괜찮아요" (최우선)
2. 오늘 status=rejected → "다시 시작" 복귀 카피
3. 기록 없음 + 시간대 매칭 → morning/midday/evening 카피

시간대는 `resolveReminderSlot()` 기준 07~10 / 11~14 / 17~21 시.
각 시간대는 사용자 설정(`diet_preferences.reminders.*`)으로 독립 on/off.

### 6.3 푸시 알림

**현재 구현 없음.** Stage 8+ 에서 Edge function + pg_cron 으로 확장 가능.

---

## 7. 주의 플래그 설명

`diet_safety_screenings` 의 4종 boolean:

| 플래그 | 의미 | 처리 |
|---|---|---|
| `pregnancy_breastfeeding` | 임신·수유 중 | 안전 모드 자동, advanced 활성 차단 |
| `diabetes_medication` | 당뇨/혈당 관리 중 | 동일 |
| `eating_disorder_risk` | 섭식장애 이력 | 동일, 전문 상담 권고 문구 |
| `other_conditions` (text) | 기타 주의사항 | 공백 아니면 위험으로 간주 |

**금지:** 플래그를 기반으로 의학적 진단·처방 문구를 쓰지 말 것. "주의 필요", "안전 모드", "전문가 상담 권장" 수준까지만.

회원 상세 페이지(`/coach/diet/member/:id`)에 칩으로 요약 노출됨.

---

## 8. 분석 이벤트 목록

`diet_analytics_events` 에 기록되는 9종:

| event_type | 기록 지점 |
|---|---|
| `enrollment_started` | 온보딩 제출 성공 |
| `onboarding_completed` | 동일 (enrollment 직후) |
| `daily_checkin_completed` | Tracker `submit` 성공 |
| `meal_photo_uploaded` | `add_diet_log_photo` 성공 (슬롯별) |
| `habit_score_updated` | 코치 승인 직후 |
| `badge_earned` | milestones_newly_reached 중 하나라도 true |
| `program_completed` | milestone_21 신규 달성 |
| `coach_note_sent` | 노트 작성 성공 |
| `drop_off_marked` | 홈에서 3일 공백 감지 (세션당 1회) |

### 8.1 이벤트 조회 예시 (운영자)

```sql
SELECT event_type, count(*) as occurrences
FROM diet_analytics_events
WHERE created_at > now() - interval '7 days'
GROUP BY event_type
ORDER BY occurrences DESC;
```

드롭오프율:
```sql
SELECT
  COUNT(*) FILTER (WHERE event_type='enrollment_started') AS started,
  COUNT(*) FILTER (WHERE event_type='program_completed')  AS completed
FROM diet_analytics_events
WHERE created_at > now() - interval '30 days';
```

---

## 9. 설정 옵션 (회원)

`/settings` → "153 다이어트" 섹션. `diet_preferences.settings` jsonb 로 저장.

| 그룹 | 키 | 기본값 |
|---|---|---|
| reminders | morning / midday / evening | true |
| notifications | coach_feedback / badge_reward | true |
| privacy | ranking_visible | true |
| (Day 18+ 조건부) | maintenance_variant | null |

`ranking_visible=false` 시 `get_diet_ranking` RPC 에서 본인 제외 (다른 유저 뷰에도 숨김).

---

## 10. 운영 체크리스트

### 10.1 최초 배포 시

- [ ] 마이그레이션 8종 적용 순서 확인:
  1. `20260424000000_diet_program_foundation.sql`
  2. `20260425000000_diet_streak_perfect_badges.sql`
  3. `20260426000000_diet_integrations.sql`
- [ ] Storage 버킷 `diet-photos` (public=false) 생성 확인
- [ ] `badges` 테이블에 `diet_*` 7행 seed 확인
- [ ] super_admin 계정에서 본인 `diet_program_enabled=true` 토글
- [ ] 온보딩 → 체크인 → 코치 승인 → 배지 지급 end-to-end 검증

### 10.2 주간 점검

- [ ] `diet_daily_logs.status='pending'` count 와 SLA (oldest submitted_at) 확인
- [ ] `diet_analytics_events` drop-off / program_completed 지표 확인
- [ ] 각 지점 활성 enrollment 수 확인:
  ```sql
  SELECT branch_name, COUNT(*) 
  FROM diet_program_enrollments
  WHERE status='active'
  GROUP BY branch_name;
  ```

### 10.3 문제 발생 시

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| 회원이 `/diet` 진입 불가 | feature flag off | `profiles.diet_program_enabled=true` |
| 트랙이 결정되지 않음 | `birth_date` 누락/포맷 | 마이페이지 → 프로필 수정 유도 |
| 청소년에게 advanced 표시됨 (이론상 불가) | 트리거 누락 | 마이그레이션 1 재적용 |
| 배지 지급 안 됨 | RPC 버전 구형 | 마이그레이션 2 재적용 |
| 랭킹 본인 row 안 보임 | `ranking_visible=false` | 설정 확인 |
| 사진 업로드 실패 | Storage RLS 또는 용량 초과 | 슬롯별 재시도 · 로그 확인 |

---

## 11. 향후 확장 포인트

우선순위 순:

1. **드롭오프 자동 케어**
   - pg_cron + Edge function 으로 3일 미기록 회원에게 아침 리마인더 푸시
   - 코치 인박스에 "누락 회원" 전용 필터 추가

2. **`adult_advanced_hidden` 활성화 경로 구현**
   - 코치 대시보드에서 회원별 advanced unlock 버튼 (위험 플래그 재확인)
   - `enroll_diet_program` RPC 에 `_coach_approved_advanced` 파라미터 추가

3. **주간 리뷰(`diet_weekly_reviews`) UI 완성**
   - 회원 측 Day 7/14/21 진입 시점에 "주간 리뷰 작성" 모달
   - 코치 피드백 루프에 주간 리뷰 포함

4. **식단 사진 썸네일 캐시**
   - 현재 서명 URL 60초 — 리스트에서 반복 호출 시 비용
   - `createSignedUrls` 배치 처리 + 5분 캐시

5. **랭킹 보드 다양화**
   - "이번 주" / "이번 달" 랭킹 별도 뷰
   - `diet_daily_logs` 집계 뷰 또는 materialized view 도입

6. **관리자 롤아웃 UI**
   - `/admin/diet-rollout` 페이지 — 브랜치 단위 토글
   - 현재는 SQL 수동 토글

7. **i18n**
   - 현재 한국어 인라인. 라이브러리 도입 시 `src/data/diet/*` 문구 추출 대상

8. **유지 플랜 개인화 팁 피드**
   - 선택한 variant 기반 홈 카드 (Stage 8 설정만 저장됨, UI 연결 아직)

9. **커뮤니티 기능**
   - 지점 내 인증 공유·응원 버튼 (별도 설계 필요)

10. **Apple Health / Google Fit 연동**
    - 걸음·수면 자동 반영 (수동 입력 부담 제거)

---

## 12. 참조 파일

| 분류 | 경로 |
|---|---|
| 기술 설계 | `docs/153-diet-implementation-plan.md` |
| 미션 카탈로그 | `src/data/diet/missionTemplates.ts` |
| 음식 가이드 | `src/data/diet/foodGuidance.ts` |
| 유지 플랜 | `src/data/diet/maintenanceVariants.ts` |
| 코치 템플릿 | `src/data/diet/coachTemplates.ts` |
| 규칙 엔진 | `src/lib/diet/ruleEngine.ts` + `scoreEngine.ts` |
| 서비스 레이어 | `src/services/dietService.ts` |
| 마이그레이션 | `supabase/migrations/2026042[4-6]*.sql` |

---

**버전:** 1.0 (Stage 8 최종)
**작성일:** 2026-04-22
