# 153복싱짐 PT 상담앱 — 소스 백업

**라이브**: https://quiet-vulture-8998.boxing5969-boop.deno.net
**편집·배포**: Deno Deploy 플레이그라운드 `quiet-vulture-8998`
(console.deno.com → boxing5969-boop → quiet-vulture-8998 → Playground)

## 이 폴더는 무엇인가
`main.ts` 는 위 플레이그라운드의 **전문 백업**이다. 플레이그라운드가 유일본이라
소실되면 앱이 통째로 사라지므로, 큰 변경 후에는 여기에 다시 덮어써 둔다.

## 구성 (단일 파일)
- 고객 상담 신청 폼 `/`, `/pt`
- 코치·관장 관리 화면 `/admin`
- 코치 텔레그램 알림 연결 `/join?k=<코드>`
- PWA: `/manifest.webmanifest`, `/sw.js`, `/icon.png`
- API: `/api/*` (인증 3단계 — guarded < adminOnly < ownerOnly)

## 데이터
Supabase 프로젝트 `tbxdrfowanyksgdicryl` (153OS CRM 과 **같은 DB**).
테이블 `pt_members / pt_consults / pt_coaches / pt_logs / pt_tg_recipients / pt_admin_secret`
접근은 전부 `SECURITY DEFINER` RPC(`pt_*`) 경유. 테이블 RLS 는 deny-all.
경영리포트 공용 테이블(`members`·`memberships`·`sales_entries`·`attendance_logs`)은 **읽기 전용**.

## 시크릿 위치
- `pt_admin_secret` 테이블(DB 안) — 앱이 RPC 호출에 사용
- Deno Env — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_*`
- 코치 초대 링크 코드 = `sha256("join-v1|" + pt_admin_secret)` 앞 8바이트 hex
  → **PT 시크릿을 바꾸면 초대 링크도 같이 무효화된다**

## 배포 시 주의 (실제로 사고 난 것들)
1. 플레이그라운드 에디터는 편집 후 수 초 내 **배포본으로 되돌린다**.
   편집 → 검증 → Deploy 를 **한 번에** 끝낼 것.
2. `ADMIN_HTML` / `FORM_HTML` 은 **쌍따옴표 문자열**이다.
   그 안의 클라이언트 코드에 **실제 개행을 넣으면 앱 전체가 죽는다**.
   개행은 `String.fromCharCode(10)`, 따옴표는 `\"` 로.
3. 배포 후 반드시 인라인 `<script>` 를 `new Function()` 으로 파싱 검증할 것.
4. DB 함수에 파라미터를 추가할 때는 `CREATE OR REPLACE` 만 하면 **오버로드가 남아**
   호출이 42725 로 실패한다. `DROP FUNCTION <구 시그니처>` 를 같은 마이그레이션에 넣을 것.

## 되돌리기
Deno 플레이그라운드의 Deploy 이력 외 수단 없음.
Supabase 는 free 플랜이라 **PITR(시점 복구) 불가** — 파기·삭제 오조작은 복구되지 않는다.

## 시크릿은 이제 소스에 없다 (2026-08-08)
`ADMIN_SECRET` / `SECRET` 을 Deno 환경변수로 옮겼다. 이 백업은 **마스킹 없는 원본 그대로**이며
시크릿 값은 포함돼 있지 않다.

| 소스 상수 | 환경변수 이름 | 실제 값 위치 |
|---|---|---|
| `ADMIN_SECRET` | `PT_ADMIN_SECRET` | Supabase `pt_admin_secret` 테이블 (id=1) |
| `SECRET` | `BOT_ADMIN_SECRET` | Deno Env 에만 존재 |
| `TG_TOKEN` | `TELEGRAM_BOT_TOKEN` | Deno Env |
| `TG_CHATS` | `TELEGRAM_CHAT_ID` | Deno Env (콤마 구분 다중 가능) |

복원 순서: ① Deno 앱에 위 4개 환경변수를 먼저 등록 → ② `main.ts` 붙여넣고 Deploy.
환경변수 없이 배포하면 관리 화면·알림이 전부 인증 실패한다.
Supabase anon 키(`eyJ...`)는 공개용이라 소스에 그대로 둔다.

## 개인정보 파기 범위 (2026-08-08 대표님 결정)
파기 버튼은 **PT 앱의 기록만** 지운다 — `pt_consults` / `pt_members` / `pt_logs`.
**경영리포트(`members`·`memberships`·`sales_entries`)의 원장은 그대로 둔다**(회원 계약 기반 보유).
PT 앱은 애초에 이 공용 테이블에 쓰기 권한이 없어 구조적으로도 지울 수 없다.
파기 확인창에도 "※ 경영리포트(회원 원장)의 기록은 지워지지 않습니다." 를 표시한다.

## 텔레그램 알림 수신자 규칙
- `coach_id` 가 **연결된** 수신자 → 그 코치가 삭제·승인취소되면 **자동으로 알림 off**
- `coach_id` 가 **비어 있는** 수신자 → 관장 본인 채널 등. 자동으로 꺼지지 않음
- 현재 등록: `대표님 (관리자 알림)` 1건, 코치 미연결(의도)


---

## 2026-08-08 — 4차 전수 검수 후 일괄 수정

에이전트 7명(발견 5 + 적대적 재검증 2)이 서버 원문·DB 함수 전문·라이브를 대조해 찾은 결함을 수정했다.
**DB 마이그레이션 6건과 `main.ts` 배포는 반드시 함께 간다.** 하나만 되돌리면 화면이 빈다.

### 계정 보안
- `dashboard_users.pt_access` 신설. **PT 상담앱은 `pt_access=true` 계정만 로그인**한다.
  (공개된 anon 키로 `dashboard_signup` → `dashboard_approve` 를 직접 호출해 스스로 승인한 계정이
   PT 앱 관리 화면에 들어오던 경로를 끊는다. 기존 2개 계정에는 true 부여.)
- `dashboard_login` 에 5회 실패 → 10분 잠금. 잠금 만료 시 카운터 리셋.
- **미해결(다음 작업)**: `dashboard_approve` / `dashboard_users_list` 는 여전히 인증 없이 anon 실행 가능.
  톡톡 리포트 대시보드가 이 함수들을 쓰고 있어 함께 고쳐야 한다. PT 앱 쪽 피해는 `pt_access` 로 차단됨.

### 권한(IDOR)
- 새 입구 `pt_member_card` / `pt_attend_card` + `_pt_member_in_scope`.
  코치는 **자기 담당 회원만** 카드·출석을 볼 수 있다. 안쪽 `pt_member_profile` / `pt_member_attendance` 는 anon EXECUTE 회수.
- `pt_member_upsert` / `pt_log_add` / `pt_update` 에 `p_actor_coach_id` 추가(구 시그니처 DROP). 서버가 토큰의 `cid` 를 강제 주입.
- 요청 IP 를 `x-forwarded-for` 대신 `info.remoteAddr` 에서 읽는다(헤더 위조로 레이트리밋을 우회하던 문제).

### 데이터 보호
- `pt_members.purge_key` — 파기 시 전화번호를 서버 시크릿 pepper 로 HMAC 해서 남긴다.
  **파기한 사람이 다음 날 새벽 임포트로 실명·실번호와 함께 되살아나던 문제**를 막는다(수기 등록 회원 경로).
- `pt_member_purge` 는 연결 상담 파기가 실패하면 전체를 롤백한다. 성공 후에만 `consult_id` 를 끊는다.
- `pt_members.manual_edited` — 사람이 고친 이름·전화·상품명을 새벽 임포트가 덮지 않는다.

### 새벽 자동 임포트
- `pt_auto_import_all` 이 **지점별로 예외를 격리**한다. 한 지점이 깨져도 나머지는 커밋된다(예전엔 전부 롤백).
- 경영리포트에 매핑되지 않는 지점 문자열은 루프에서 제외. `pt_coach_signup` 도 지점 검증.
  → anon 이 가짜 지점 코치를 하나 만들어 매일 새벽 동기화를 영구 중단시키던 경로 차단.
- 실제로 바뀐 게 있을 때만 `updated_at` 을 갱신한다(회원 목록 정렬이 매일 초기화되던 문제).
- ⚠️ 이제 예외를 던지지 않으므로 `cron.job_run_details` 는 항상 성공으로 찍힌다. 반환 JSON 의 `failed` 를 봐야 한다.

### 회차 회계
- 총 회차가 0 인 회원은 일지 저장이 막힌다(무한 차감 방지). 안내 문구로 총 회차 입력을 요구.
- 같은 회원·같은 날짜 60초 내 중복 저장은 기존 건을 돌려준다(더블탭 이중 차감 방지).
- `pt_member_upsert` 가 회차 음수·초과를 클램프. 홈/데이터센터/목록의 "남은 회차" 판정 통일.

### 화면
- `pt_list` 반환이 배열 → `{ok, total, rows}`. `notified` / `member_linked` / `purged` 플래그 추가.
  상담 카드에 **파기됨 · 알림 미발송 · 회원 미등록** 배지가 뜬다.
- 통신 실패와 "0건"을 구분한다(홈·상담·회원·일지·코치). 예전엔 둘 다 "없습니다"로 보여 데이터 유실로 오인했다.
- 회원 상태 필터가 선택값으로 돌아오지 않던 문제, 파기된 건에 파기 버튼이 다시 붙던 문제,
  빈 `tel:` 링크, 가져오기 30초 잠금, 회원·코치 저장 더블탭, 승인 실패 무반응 수정.
- 시크릿이 어긋나면 빈 화면 대신 오류를 낸다. 환경변수 누락 시 `/api/*` 는 503.
- 없는 주소는 한국어 404 안내 화면.
