# 지점별 랭킹 + Super Admin 설정 — 실행 가이드

## 실행 순서

Supabase 대시보드의 **SQL Editor**를 열어 아래 3개를 차례대로 실행합니다.

---

### 1️⃣ RLS 정책 현황 진단 (읽기 전용, 안전)

- **파일**: [`docs/sql/01-rls-audit.sql`](./01-rls-audit.sql)
- **목적**: 현재 RLS 정책 상태를 점검. 데이터 변경 없음.
- **기대 출력**:
  - 쿼리 1: 테이블별 정책 리스트
  - 쿼리 2: `profiles / member_progress / xp_logs / branches / user_roles` 만 추출
  - 쿼리 3: RLS가 꺼진 테이블이 있는지 (`rls_enabled = false`가 있으면 보강 필요)
  - 쿼리 4: 랭킹 RPC 6개 함수 시그니처

결과 공유해주시면 정책 정합성 리뷰 후 필요한 보강 SQL 드립니다.

---

### 2️⃣ boxing5969@gmail.com → super_admin 지정

- **파일**: [`docs/sql/02-grant-super-admin.sql`](./02-grant-super-admin.sql)
- **user_id**: `7531ddd6-d939-436c-b532-970c7b88b6b8`
- **안전성**:
  - 이미 super_admin 이면 아무것도 안 함
  - 다른 role 이 있어도 덮어쓰지 않음 (다중 role 허용 테이블에서도 안전)
- **실행 후**: 해당 계정으로 재로그인 → `/halloffame` 랭킹 화면에서 지점 스위처 노출

---

### 3️⃣ 5개 랭킹 RPC에 NULL 지점 + super_admin 강제 적용

- **파일**: [`supabase/migrations/20260420120000_branch_ranking_super_admin.sql`](../../supabase/migrations/20260420120000_branch_ranking_super_admin.sql)
- **방법 A — supabase CLI** (추천):
  ```
  supabase db push
  ```
- **방법 B — SQL Editor에서 수동 실행**:
  전체 내용을 복사해서 SQL Editor에 붙여넣고 실행.

변경되는 것:
- `get_division_ranking`, `get_weekly_activity_ranking`, `get_monthly_risers`, `get_streak_ranking`, `get_boss_conquerors` 5개 RPC
- `_branch_name` 이 NULL 이어도 호출 가능 (단, **super_admin만 실질적으로 허용**)
- 일반 회원은 DevTools에서 다른 지점명을 넘겨도 **서버가 자동으로 본인 지점으로 교체**
- 기존 호출자는 무변경 (자기 지점명 그대로 넘기면 동일하게 동작)

변경되지 않는 것:
- `get_hall_of_fame` (의도적으로 전체 지점 통합)
- RLS 정책
- 다른 테이블/함수

---

## 배포 순서 권장

1. ✅ **1️⃣ RLS audit** 실행 → 결과 공유
2. ✅ **2️⃣ super_admin grant** 실행
3. ✅ **3️⃣ RPC migration** 실행 (SQL Editor 또는 `supabase db push`)
4. ✅ Frontend 변경 (**이미 코드로 반영돼 Cloudflare에 배포 중**)
5. 🧪 boxing5969 계정으로 로그인 → 지점 스위처 확인
6. 🧪 일반 회원 계정 로그인 → 자기 지점만 보이는지, 스위처 **안 보이는지** 확인
7. 🧪 (선택) DevTools에서 `supabase.rpc("get_division_ranking", { _branch_name: "다른지점" })` 호출 → 본인 지점 결과로 대체돼 나와야 정상

---

## 롤백

RPC 원복이 필요하면:
```sql
-- 20260410112928 마이그레이션을 다시 실행
```
또는 이전 migration 파일을 SQL Editor에 붙여넣기.

super_admin 권한 해제가 필요하면:
```sql
DELETE FROM public.user_roles
WHERE user_id = '7531ddd6-d939-436c-b532-970c7b88b6b8'
  AND role    = 'super_admin';
```
