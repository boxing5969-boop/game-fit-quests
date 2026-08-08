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

## ⚠️ 이 백업은 시크릿이 마스킹돼 있다
`ADMIN_SECRET` 등 소스에 **평문으로 박혀 있던 상수**는 `<<REDACTED_IN_BACKUP>>` 로 치환했다.
복원할 때는 플레이그라운드의 실제 값으로 되돌리거나, 아래처럼 환경변수로 옮길 것(권장).

```ts
const ADMIN_SECRET = Deno.env.get("PT_ADMIN_SECRET")!;
```
실제 값은 Supabase `pt_admin_secret` 테이블(id=1)에 있다.
Supabase anon 키(`eyJ...`)는 **공개용 키**라 마스킹하지 않았다.
