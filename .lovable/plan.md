

# QR 재입장 버그 진단 보고서

## 결론 요약

**edge function(`qr-checkin`)과 LiveBoardPage의 로직은 정상이다.** 문제의 핵심은 `HomePage.tsx`의 클라이언트 코드에 있다.

---

## 1. QR 체크인 성공 처리

- **파일**: `src/pages/HomePage.tsx` → `handleQrCheckinSuccess` (line 153)
- **파일**: `src/components/QRScannerModal.tsx` → `handleScan` (line 96)

QRScannerModal이 edge function 호출 후 결과를 `onSuccess(data)`로 전달 → HomePage의 `handleQrCheckinSuccess`가 실행됨.

## 2. "오늘은 이미 출석했어요" 문구

- **코드베이스 전체 검색 결과: 해당 문구 없음.** `"이미 출석"` 검색에서 0건.
- **CheckinSuccessModal** (line 42-55): duplicate일 때 "다시 입장! 🥊"과 "출석 XP는 이미 지급되었어요"를 표시. 차단형 팝업은 아님.
- **추정**: 사용자가 보는 "오늘은 이미 출석했어요"는 실제로 **CheckinSuccessModal의 duplicate 분기** (line 54: "출석 XP는 이미 지급되었어요")이거나, 혹은 **이전 배포 캐시**일 수 있음.

## 3. 핵심 버그: duplicate일 때 CheckinSuccessModal이 안 뜸

`HomePage.tsx` line 164-167:
```typescript
if (!result.is_duplicate) {
  setCheckinResult(result);
  setShowCheckinSuccess(true);
}
```

**`is_duplicate === true`일 때 `setShowCheckinSuccess(true)`가 호출되지 않는다.** 즉, 재입장 시 CheckinSuccessModal 자체가 열리지 않음. 토스트만 뜸 (line 169의 `handleCheckinFeedback`).

## 4. 핵심 버그: "현재 활동 중"에 안 들어가는 이유

edge function은 정상 동작한다 — active session을 생성하거나 refresh한다 (line 136-179).

문제는 **클라이언트의 `useActivitySession` hook이 anon key가 아닌 authenticated user 기준으로 쿼리**하기 때문이다.

`useActivitySession.ts` line 37-45:
```typescript
const { data } = await supabase
  .from("activity_sessions")
  .select("*")
  .eq("user_id", userId)
  .eq("branch_name", branchName)
  .eq("status", "active")
  .is("ended_at", null)
  .order("started_at", { ascending: false })
  .limit(1);
```

edge function은 **service role key**로 session을 update/insert한다. 클라이언트는 **anon/authenticated key**로 읽는다. RLS policy "Users view own sessions"은 `auth.uid() = user_id`를 요구한다. 

**그런데 이건 정상 동작해야 한다** — 같은 유저의 세션이니까.

**진짜 문제**: edge function이 session의 `started_at`을 현재 시간으로 갱신(line 143: `started_at: nowIso`)하지만, `ensureActiveSession` (HomePage line 133-143)이 `refreshSession()`을 호출하면 데이터가 즉시 반영되지 않을 수 있다 (Supabase replication lag). 그러나 250ms/500ms retry로 보완되어 있다.

**실제 근본 원인**: `handleQrCheckinSuccess`에서 `setShowChallenge(true)` (line 161)과 `ensureActiveSession()` (line 162)이 실행되지만, `ensureActiveSession`이 실패하더라도 `showChallenge`는 이미 true. 문제는 **SelfChallengeFlow 컴포넌트가 `activitySession.isActive`에 의존하는지 여부**다.

그리고 **라이브보드(LiveBoardPage)의 "현재 활동 중"은 별도 페이지**이므로, HomePage에서의 상태와는 무관하다. LiveBoardPage는 realtime subscription (line 308-311)으로 `activity_sessions` 테이블 변경을 감지하고 `loadActivitySessions()`를 호출한다.

## 5. 라이브보드 "현재 활동 중" 데이터 소스

- **파일**: `src/pages/LiveBoardPage.tsx` → `loadActivitySessions` (line 141)
- **데이터 소스**: `activity_sessions` 테이블, 조건: `status='active' AND ended_at IS NULL`
- ghost profile 필터: profile이 없거나 nickname/name 둘 다 없으면 skip (line 195)
- **실시간 갱신**: `activity_sessions` 테이블에 대한 postgres_changes subscription (line 308-311)

## 6. 라이브보드 중앙 팝업은 왜 뜨는가

- **파일**: `src/pages/LiveBoardPage.tsx` → line 291
- `attendance_logs` INSERT 이벤트를 구독 → `triggerPopup(event)` 호출 (line 305)
- 팝업은 attendance_logs 기준, "현재 활동 중"은 activity_sessions 기준 — **서로 다른 데이터 소스**

## 7. 재입장이 막히는 정확한 조건

edge function 로직상 재입장이 막히는 조건은 없다. 그러나:

**조건 1**: edge function에서 기존 active session이 있으면 refresh (started_at 갱신), 없으면 새로 생성. `completed` 상태 session은 `status != 'active'`이므로 새 session이 생성됨. → **이 부분은 정상.**

**조건 2 (추정)**: edge function이 service_role_key로 session을 INSERT하면, RLS INSERT policy "Users create own sessions" (`auth.uid() = user_id`)와 무관하게 성공한다. 하지만 **클라이언트의 `startChallenge`** (useActivitySession line 85-93)이 **중복으로 다시 insert를 시도**하면 두 번째 active session이 만들어질 수 있다. 이건 직접적 실패 원인은 아니지만 데이터 오염 가능성이 있다.

## 8. 가장 최소 수정 포인트

1. **`src/pages/HomePage.tsx` line 164-167**: duplicate일 때도 CheckinSuccessModal을 보여줘야 한다면, `if (!result.is_duplicate)` 조건을 제거하거나, duplicate용 별도 결과를 setCheckinResult에 넣어야 함.

2. **실제 "현재 활동 중" 미반영 문제**: edge function은 이미 session을 정상 생성/갱신하고, LiveBoardPage는 realtime으로 감지한다. **만약 라이브보드에 실제로 안 뜬다면**, edge function 로그를 확인하여 session 생성 시 에러가 발생하는지 검증이 필요하다. 현재 edge function 로그가 비어 있어 실제 서버 측 에러 확인이 불가능하다.

3. **테스트 추천**: 실제 QR 재스캔 후 edge function 로그와 `activity_sessions` 테이블 데이터를 직접 조회하여, 세션이 실제로 생성/갱신되는지 확인해야 한다.

---

## 요약

| 항목 | 상태 |
|---|---|
| edge function `qr-checkin` | 정상 — duplicate여도 session 생성/갱신 후 return |
| "오늘은 이미 출석했어요" 문구 | 코드에 없음 — 캐시 문제이거나 "출석 XP는 이미 지급되었어요" 오인 가능 |
| CheckinSuccessModal duplicate 분기 | `is_duplicate`일 때 modal 자체가 열리지 않음 (line 164) |
| LiveBoardPage "현재 활동 중" | `activity_sessions` status='active' 기준 — 로직 정상 |
| 중앙 팝업 | `attendance_logs` INSERT 기준 — 항상 뜸 |
| 재입장 막힘 근본 원인 | edge function 로그 없어 서버 에러 확인 불가. 코드상 차단 로직은 없음 |

