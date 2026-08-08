# pt-consult-app 스키마 백업 (재난 복구용)

**생성일** 2026-08-08 (오늘 마이그레이션 5건 적용 후 **전면 재덤프**)
**소스** Supabase project ref `tbxdrfowanyksgdicryl` / schema `public`
**범위** `pt_*` 테이블 8개 + `dashboard_users` + 함수 44개 (`_pt_*` 6, `dashboard*` 4, `pt_*` 34)

이 앱은 그동안 백업이 `main.ts` **한 파일뿐**이었다. DB 쪽(테이블·인덱스·함수·RLS·크론)이
레포에 전혀 없었고, 이 폴더가 그 구멍을 메운다.

> **데이터는 들어있지 않다.** 전부 스키마(DDL) 전용이다. 회원 이름·전화번호 등
> 개인정보와 `pt_admin_secret.secret` 값은 일절 포함하지 않았다.

---

## 파일

| 파일 | 내용 |
|---|---|
| `01_tables.sql` | `pt_*` 8개 + `dashboard_users` CREATE TABLE (컬럼·타입·기본값·PK·UNIQUE·FK·CHECK) |
| `02_indexes.sql` | 인덱스 전체 (`pg_indexes.indexdef`) |
| `03_functions.sql` | 함수 44개 `pg_get_functiondef` 원문 — **자동 덤프, 손으로 고치지 말 것** |
| `04_grants_rls.sql` | RLS 상태, 정책, 테이블 GRANT, 함수 EXECUTE GRANT |
| `05_cron.sql` | pg_cron 잡 (`pt-daily-import`) |

---

## 복원 순서

Supabase Dashboard → SQL Editor 에 **순서대로** 붙여넣고 실행한다.

```
1) 01_tables.sql
2) 02_indexes.sql
3) 03_functions.sql
4) 04_grants_rls.sql
5) 05_cron.sql
6) 환경변수 설정        (Deno Deploy / 워커 시크릿)
7) main.ts 배포
8) pt_admin_secret INSERT  ← 이걸 안 하면 모든 관리자 RPC 가 forbidden
```

순서를 지켜야 하는 이유
- `02` 는 테이블이 있어야 인덱스를 건다.
- `03` 안에서도 `_pt_*` 헬퍼가 맨 앞에 온다. 파일 위에서 아래로 그대로 실행하면 된다.
- `04` 는 테이블과 함수가 둘 다 있어야 GRANT 가 걸린다.
- `05` 는 `pt_auto_import_all()` 이 있어야 스케줄된다.
- `08` 시크릿 주입은 **맨 마지막**. 앱이 뜨기 전에 넣어봐야 소용없고,
  넣기 전에는 어떤 관리자 RPC 도 통과하지 못한다.

### 6) 환경변수

`main.ts` 가 기대하는 값들 — **이름만** 적는다. 값은 절대 레포에 넣지 않는다.

- Supabase URL / anon key (RPC 호출용)
- PT 관리자 시크릿 (`pt_admin_secret` 에 넣은 것과 **같은 값**)
- 텔레그램 봇 토큰 (신규 상담 알림용)

### 8) 시크릿 주입

```sql
INSERT INTO public.pt_admin_secret (id, secret) VALUES (1, '<운영 시크릿>');
```

⚠️ 이 값을 바꾸면 `pt_members.purge_key`(HMAC tombstone)가 **전부 무효**가 된다.
파기했던 회원이 다음 새벽 임포트에서 되살아난다. 시크릿 로테이션은 그 대가를 알고 할 것.

### 그 밖에 복원 후 확인할 것

1. **외부 의존 테이블** — `pt_passes` / `pt_sessions` 는
   `branches`, `profiles`, `members`, `memberships`, `staff` 를 FK 로 참조한다.
   그 테이블들이 없는 빈 DB 라면 해당 FK 줄을 주석 처리하고 나중에 ALTER 로 붙인다.
   또 `pt_datacenter` / `pt_member_profile` / `pt_import_from_os` 는
   153OS 의 `members`, `memberships`, `sales_entries`, `attendance_logs`, `branches`
   를 읽는다. 이 테이블들이 없으면 함수 생성은 되지만 호출 시 죽는다.
2. **RLS 확인** — `04` 를 건너뛰면 `pt_consults`(이름·전화번호·건강정보)가
   anon 키로 통째로 읽힌다. 절대 빠뜨리지 말 것.
3. **크론 시각** — `05` 의 `0 16 * * *` 은 **UTC**다 (= KST 새벽 1시).

---

## 2026-08-08 변경

오늘 마이그레이션 5건이 반영됐다. `main.ts` 와 짝을 이루는 변경이 섞여 있으므로
**DB 만 되돌리거나 앱만 되돌리면 깨진다.**

### 1. PT앱 로그인 권한 분리 + 대입 잠금
- `dashboard_users.pt_access` (boolean, 기본 `false`) 추가.
  대시보드 계정이라고 해서 PT 상담앱까지 열리지 않는다. 별도로 켜줘야 한다.
- `dashboard_login` 이 성공 응답에 `pt_access` 를 실어 보낸다. `main.ts` 가 이 값으로
  PT앱 진입을 막는다. **워커/앱을 같이 배포해야 의미가 있다.**
- `dashboard_users.fail_count` / `locked_until` 추가 →
  `dashboard_login` 비밀번호 **5회 실패 시 10분 잠금** (`pt_coach_login` 과 동일 정책).
- 알려진 차이: `pt_coach_login` 에는 "잠금 만료 시 카운터 리셋" 분기가 있는데
  `dashboard_login` 에는 없다. 잠금이 풀린 뒤 한 번만 틀려도 곧바로 다시 잠긴다.

### 2. 스코프 검증 입구 신설
- `pt_member_card(p_secret, p_member_id, p_role, p_branch, p_actor_coach_id)`
- `pt_attend_card(p_secret, p_member_id, p_limit, p_branch, p_actor_coach_id)`
- 둘 다 새 헬퍼 `_pt_member_in_scope(member_id, branch, actor_coach_id)` 로
  "이 회원이 내 지점·내 담당인가"를 먼저 확인한 뒤,
  기존 `pt_member_profile` / `pt_member_attendance` 로 넘긴다.
- ⚠️ **속 함수 두 개는 여전히 anon 에 그대로 열려 있다.** `pt_member_profile` /
  `pt_member_attendance` 를 직접 부르면 스코프 검사를 우회한다.
  프런트/워커는 반드시 `*_card` 쪽만 부를 것. (다음 정리 후보)

### 3. 행위자(코치) ID 전달 — **구 시그니처 DROP 됨**
아래 3개에 `p_actor_coach_id bigint DEFAULT NULL` 이 **맨 뒤에** 추가됐고,
옛 시그니처는 명시적으로 DROP 했다 (오버로드 잔존 0건 확인).

| 함수 | 새 인자 수 |
|---|---|
| `pt_member_upsert` | 14 (기존 13 + `p_actor_coach_id`) |
| `pt_log_add` | 12 (기존 11 + `p_actor_coach_id`) |
| `pt_update` | 7 (기존 6 + `p_actor_coach_id`) |

동작: `p_actor_coach_id` 가 들어오면 **코치 본인 범위로 강제**된다.
- `pt_member_upsert` — 남의 회원 수정 차단, 담당 코치를 자기 자신으로 고정
- `pt_log_add` — 자기 담당 회원에게만 일지 작성
- `pt_update` — 자기 담당이거나 미배정 상담만 수정, 배정도 자기 자신에게만

⚠️ 구버전 `main.ts` 는 인자 수가 안 맞아 `PGRST202`(함수 없음)로 죽는다. **같이 배포할 것.**

### 4. `pt_members.purge_key` (HMAC tombstone) + `manual_edited`
- `purge_key text` — `pt_member_purge` 가 파기 시 전화번호를
  `_pt_phone_key()` = `hmac(phone, pt_admin_secret.secret, 'sha256')` 로 바꿔 남긴다.
  평문 번호는 `ERASED-<id>` 로 지워지지만 이 단방향 키가 남아 있어야
  매일 새벽 임포트가 파기된 사람을 되살리지 않는다.
  `pt_import_from_os` 는 이제 **3중 대조**(OS membership id · purge_key · 평문번호)로 거른다.
- `manual_edited boolean NOT NULL DEFAULT false` — `pt_member_upsert` 로 사람이 수정하면 `true`.
  `true` 인 행은 새벽 임포트가 `name`/`phone`/`product` 를 덮어쓰지 않는다.
- 덤으로 `pt_import_from_os` 의 UPDATE 에 "실제로 바뀌는 게 있을 때만" 조건이 붙었다.
  매일 새벽 `updated_at` 이 전원 갱신되어 목록 정렬이 초기화되던 문제가 없어졌다.

### 5. `pt_auto_import_all` 지점별 예외 격리
- 지점마다 `begin/exception` 으로 감싼다. 한 지점이 터져도 나머지 지점의 반영은 살아남는다.
  (이전에는 `raise exception` 으로 트랜잭션 전체가 롤백됐다.)
- `_pt_branch_id(branch)` 가 `null` 인 **미매핑 지점은 루프에서 제외**한다.
- 반환값 `{ok, branches, succeeded, failed, results[]}`.
  ⚠️ 잡이 예외를 던지지 않으므로 `cron.job_run_details` 에는 항상 "성공"으로 남는다.
  실패 감시는 `return_message` 의 `failed` 값을 봐야 한다.

### 6. `pt_list` 반환 형식 변경 (**breaking**)
- 이전: 상담 배열 그대로 (`[...]`)
- 현재: `{ ok: true, total: <전체 건수>, rows: [...] }`
- `total` 은 limit/offset 을 무시한 전체 건수라 페이지네이션이 가능해졌다.
- ⚠️ 구버전 `main.ts` 는 배열을 기대하므로 목록이 빈 화면이 된다. **같이 배포할 것.**

### 7. `pt_log_add` 안전장치
- **총 회차가 0(미설정)이면 거부**한다. 이전에는 무한히 차감되며 음수 잔여가 쌓였다.
- **60초 멱등** — 같은 회원·같은 날짜에 60초 안에 다시 들어온 저장은 새 일지를 만들지 않고
  기존 건을 `duplicate: true` 와 함께 돌려준다. (모바일 더블탭 방지)

---

## 경고

### 무료 플랜 Supabase 에는 PITR(Point-in-Time Recovery)이 없다
실수로 `DROP TABLE` / `DELETE` 를 치면 **되돌릴 방법이 없다.**
유료 플랜의 일 단위 백업조차 없거나 보존 기간이 짧다.
따라서 이 폴더가 사실상 유일한 스키마 백업이다.
DB 를 손볼 때는 **작업 전에 이 폴더를 최신화**하고, 파괴적 SQL 은
`BEGIN; ... ROLLBACK;` 으로 먼저 확인한 뒤 실행할 것.

### `CREATE OR REPLACE FUNCTION` 은 시그니처가 바뀌면 옛 버전을 지우지 않는다
인자 목록(개수·타입 기준)이 하나라도 달라지면 REPLACE 가 아니라
**새 오버로드가 추가**된다. 옛 함수는 그대로 살아남는다. 그러면

- PostgREST 가 `PGRST203 / Could not choose the best candidate function` 을 뱉거나,
- 더 나쁘게는 **옛 버전이 계속 호출되어** 고친 줄 알았던 버그가 그대로 남는다.

시그니처를 바꿀 때는 반드시 옛 시그니처를 명시적으로 지운다.

```sql
DROP FUNCTION IF EXISTS public.pt_update(text, bigint, text, text, bigint, text);  -- 옛 시그니처
CREATE OR REPLACE FUNCTION public.pt_update(text, bigint, text, text, bigint, text, bigint) ...
```

중복 여부 점검용 쿼리:
```sql
SELECT proname, count(*), array_agg(pg_get_function_identity_arguments(oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND (proname LIKE 'pt%' OR proname LIKE '_pt%' OR proname LIKE 'dashboard%')
GROUP BY proname HAVING count(*) > 1;
```
(2026-08-08 재덤프 기준 결과: **0건**. 중복 오버로드 없음.)

---

## 구조 메모

- 인증은 Supabase Auth 가 아니다. 모든 관리자 RPC 가 `p_secret` 을 받아
  `_pt_admin_ok()` 로 `pt_admin_secret` 과 대조한다. 시크릿은 서버(`main.ts`)에만
  두고 브라우저로 내려보내면 안 된다.
- 로그인 경로는 **둘**이다.
  - 코치: `pt_coaches.login_id` + bcrypt `pw_hash` → `pt_coach_login`
  - 지점장/관리자: `dashboard_users.username` + bcrypt `pw_hash` → `dashboard_login`
    (여기서 `pt_access` 가 PT앱 진입을 가른다)
  - 둘 다 5회 실패 / 10분 잠금.
- `dashboard_approve` / `dashboard_users_list` 는 **p_secret 검사가 없다.**
  anon 에게 EXECUTE 가 열려 있으므로 서버 세션 검사가 유일한 방어다. 개선 후보.
- `pt_members` 는 매일 새벽 1시(KST) `pt_auto_import_all()` → `pt_import_from_os()` 로
  153OS `memberships` 에서 자동 동기화된다. 삭제/파기 회원은 tombstone
  (`deleted_at`, `phone='ERASED-<id>'`, `purge_key`)으로 막는다.
  **`os_membership_id` 나 `purge_key` 를 지우면 삭제한 회원이 되살아난다.**
- 지점은 `branch` **텍스트 슬러그**(`sunreung`/`chilgeum`/`munhwa`/`yongsan`)로 관리하고,
  153OS 의 `branches.id` 로는 `_pt_branch_id()` 가 **이름 LIKE 매칭**으로 변환한다.
  지점 이름이 바뀌면 매칭이 깨진다. (이제 미매핑 지점은 자동 임포트에서 조용히 제외된다 —
  "왜 이 지점만 동기화가 안 되지?" 를 의심할 때 여기를 먼저 볼 것.)
- `pt_passes` / `pt_sessions` 는 이름만 `pt_` 일 뿐 이 앱이 쓰지 않는 153OS 테이블이다.
