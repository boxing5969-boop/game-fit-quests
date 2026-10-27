# CLAUDE.md

마이복서153 (153복싱짐) 스포츠 RPG 앱. Lovable 로 초기 생성됐고 이제 GitHub + Claude Code 중심으로 관리한다.

브랜드:
- 앱 이름: **마이복서153**
- 영문 로고: **MY BOXER 153**
- 시스템명: **153 QUEST**
- 공식 훈련 과정명: **마스터 로드** (코드 식별자는 `master_track` 유지 — DB 마이그레이션 회피)
- 시즌/이벤트명: **더 다이어터** (챌린지 페이지)
- 체력 평가: **153 PB** (Personal Best · 내 최고 기록) — 처음 이름 '153 TEST', 2026-10-18 바꿈. 코드 식별자는 `test153` 유지. 이름은 `TEST153_NAME`(src/lib/test153.ts)
  - 메시지: "상대는 지난번의 나" · "복싱은 상대를 이기기 위해, 먼저 나와의 싸움에서 이겨야 하는 운동" · 마라토너처럼 1초를 당긴다
- 이름 읽기: **153 = '일오삼'** — 정식 명칭은 **'일오삼 복싱짐'** ('백오십삼'·'백오삼' 아님, 2026-10-19 대표님 "꼭 기억해"). 화면 글은 '153' 그대로 쓰고, 소리로 내보내는 글(휴대폰 음성 TTS · 녹음/내레이션 대본)은 `toSpokenKo()`([src/lib/spokenKo.ts](src/lib/spokenKo.ts))를 거치거나 처음부터 '일오삼'으로 쓴다. 휴대폰 음성은 그냥 두면 '백오십삼'이라 읽는다.

---

## 별도 시스템 (마이복서153 앱과 무관)

레포 안에 다음 경로의 파일들은 **네이버 톡톡 자동 상담 봇** — 마이복서153 앱과 별도 시스템이다. 앱 작업 시 절대 같이 commit/push 하지 않는다.

- `external/naver-talktalk/*.js` — 스탠드얼론 스크립트
- `supabase/functions/talktalk-chilgeum/` — 칠금점 봇 Edge Function
- `supabase/functions/talktalk-webhook/` — 톡톡 웹훅 Edge Function
- `supabase/functions/talktalk-ai/` — 톡톡 웹훅·카카오 스킬 앞단(2026-10-27): 지점 봇 서버(Deno Deploy `zippy-monkey-7321`)에 그대로 넘기고, 손님 말에 첫 인사 메뉴만 돌아올 때만 Claude Haiku 5.5 가 153OS `get_bot_config` 안내 자료 안에서 답한다(`ai_usage_log.feature='talktalk_ai'`, 끄기 시크릿 `TALKTALK_AI=off`)

talktalk 변경은 별도 commit 으로 처리하고 prefix 는 `chore(talktalk):` 또는 `feat(talktalk):`.

---

## 절대 규칙 (Always-On)

1. **기존 UI/레이아웃은 유지.** 새 페이지·새 채팅 박스·새 실험용 컴포넌트를 추가하지 않는다. 무언가 바꿔야 한다면 기존 컴포넌트를 개선한다.
2. **테스트용 AI 박스 추가 금지.** 앱에는 기존 AI 코치봇 (`src/components/ChatAssistant.tsx` → `supabase/functions/chat-assistant`) 하나만 존재한다. 실험 챗, 데모 챗, 다이어트 전용 챗 박스 등을 새로 만들지 않는다.
3. **AI 코치봇 개선은 기존 경로만 손댄다.** messages 조립·시스템 프롬프트·지식 주입 모두 `supabase/functions/chat-assistant/index.ts` + `supabase/functions/_shared/` 에서 처리한다.
4. **최소 수정 우선.** 의도하지 않은 영역 리팩터링 금지. 파일 전체 재작성보다 Edit 로 필요한 라인만 교체.
5. **작업 전 관련 파일 먼저 찾기.** Grep/Glob 으로 기존 패턴·호출부·타입을 확인하고 들어간다. 경로 추측으로 쓰지 않는다.
6. **작업 후 반드시 `bun run build` 로 빌드 확인.** 타입 에러·import 경로 오류가 있으면 여기서 터진다. 푸시 전에 필수.
7. **변경 전후 파일 목록을 짧게 요약한다.** 커밋/설명 시 "무엇이 / 왜 / 어떤 파일" 3줄 이내.
8. **Supabase 운영 프로젝트 권한을 항상 염두에 둔다.** 프로젝트 owner 는 Lovable. `npx supabase login` 계정이 이 프로젝트에 권한이 없을 수 있다 — 403 이 나오면 놀라지 말고 Lovable 채팅 경로로 위임하거나 Supabase Dashboard SQL Editor 수동 실행을 안내한다.

---

## 두 계정 동시 작업 (2026-10-20 대표님: "두 군데에서 작업 중인데 중복 작업이 일어나지 않고 안정적으로")

클로드 계정 두 개가 같은 저장소(main) · 같은 Supabase · 같은 Edge Function 을 함께 고친다. 서로의 대화·기억은 못 보고, 함께 보는 것은 **이 저장소**와 **작업판**(153OS DB `mkt_work` = 앱 「클로드 작업판」)뿐이다. 10/19 에 두 계정이 같은 마이그레이션 번호(20261019200000)를 만든 일이 있었다. 공용 스킬 `153-two-account-work` 7번과 같은 약속이다.

- **내 계정 이름**: 공용 스킬 0번과 같다 — boxing5969 계정은 `클로드·boxing5969`, 다른 한 계정은 작업판에 있는 나머지 이름(`select account from mkt_claude_accounts;`).
- **시작할 때 (매번)**
  1. `git pull --rebase origin main`
  2. 작업판 보기 — Supabase MCP `execute_sql`, project `tbxdrfowanyksgdicryl`(153OS): `select mkt_work_board(24);` (PC 가 연결돼 있으면 `mktwork.sh board` 도 같다). `myboxer:` 로 시작하는 일과 메모를 읽는다.
  3. **같은 일이 이미 있었나 찾기** (2026-10-20 — 같은 요청이 두 창에 가서 설문·리그 배지가 두 번 시작될 뻔했다): 작업판의 최근 끝난 일 + `git log origin/main --since="21 days ago" -i --oneline --grep="<요청 낱말>"` + 관련 파일 grep. 이미 있으면 새로 만들지 않고 대표님께 "○○ 계정이 <커밋> 으로 해 두었어요 — 다른 점은 ○○" 라고 알린 뒤 다른 점만 제안한다.
  4. 일을 잡는다: `select mkt_work_claim('<내 계정>', 'myboxer:<영역>', 'upgrade', '<무엇을>', '어디까지: 시작 · 다음: …');`
     - 결과가 `ok:false, held:true` 면 **다른 계정이 하는 중** — 그 영역은 손대지 않고, 대표님께 알리거나 다른 영역을 고른다.
     - 90분 넘게 소식이 없는 일은 잡으면 이어받는다(`took_over`) — 앞 계정 메모부터 읽고 이어서 한다(처음부터 다시 만들지 않는다).
- **영역 이름(key)** — 같은 일이면 두 계정이 같은 이름을 쓴다:
  `myboxer:tv`(라이브보드·사이니지) · `myboxer:ios`(아이폰 앱·App Store) · `myboxer:android`(플레이스토어) · `myboxer:membership`(수강권·결제·PT·락카) · `myboxer:records`(153 레코드·랭킹·명예의 전당) · `myboxer:community` · `myboxer:ai-coach`(오삼코치·chat-assistant) · `myboxer:home`(홈·메뉴·내 카드) · `myboxer:admin`(관리자·지점장 화면) · `myboxer:training`(훈련·153 PB·마인드셋) · `myboxer:sync`(브로제이·153OS 동기화) · 그 밖은 `myboxer:<페이지·폴더 이름>`
  - 여러 영역이 같이 쓰는 DB 함수는 따로 잡는다: `myboxer:db:<함수 이름>` (예: `myboxer:db:guard_profile_privileged_columns`) · Edge Function 배포는 `myboxer:edge:<함수>`.
- **하는 동안**: 단계마다(30분 안쪽) `select mkt_work_set('<내 계정>', '<key>', 'doing', '어디까지: … · 다음: …');` — 사용량이 찰 것 같으면 `'handoff'` 로 어디까지 · 다음 할 일 · 손댄 파일을 남긴다(다른 계정이 이어받는다).
- **끝낼 때**: 커밋 · 푸시 · 라이브 확인 뒤 `select mkt_work_set('<내 계정>', '<key>', 'done', '<커밋 해시 · 결과>');`
- **git**: 작게 커밋하고 끝나면 바로 푸시. 푸시 직전 `git fetch && git rebase origin/main` → **`bun run build` 한 번 더**(다른 계정 변경과 합친 상태가 빌드되는지 + 마이그레이션 번호 겹침 검사 `scripts/check-migrations.mjs` — 클로드 세션에서는 겹치면 빌드가 멈춘다) → push. force push 금지 · 다른 계정 커밋 되돌리기 금지 · 충돌은 두 쪽을 다 살려서 푼다(판단이 안 서면 대표님께).
- **DB**: `create or replace function` 전에 저장소 파일이 아니라 **DB 의 지금 정의**(`select pg_get_functiondef('public.<함수>'::regproc)`)를 읽고 그 위에 고친다 — 그사이 다른 계정이 바꾼 것을 덮지 않게.
  마이그레이션 파일 번호는 **지금 시각(KST, 초까지)** 으로 짓는다 — `…200000` 같은 둥근 번호 금지. 만들기 전 `ls supabase/migrations | grep <번호>` 로 겹침 확인.
- **Edge Function**: 최신 main 을 받은 뒤의 파일로만 배포하고, 배포한 코드는 바로 커밋한다. **배포 전에 지금 배포본(Supabase MCP `get_edge_function`)과 저장소 파일을 비교** — 배포본에만 있는 수정이 있으면 먼저 저장소 파일에 살린 뒤 배포한다(그냥 배포하면 그 수정이 사라진다).
  - 2026-10-20 점검(배포 시각 vs 마지막 커밋): 배포가 마지막 커밋보다 늦음(배포본에만 있는 수정이 있을 수 있음) — `coach-build` · 보호 영역 `payssam-inspect` · `qr-token-refresh` / 저장소에 폴더 없음 — `admin-migrate-legacy-assets` · `boxing-library` · `face-kiosk` · `gagyebu-ai`. 이 함수들은 고치기 전에 배포본부터 받는다.
  - 같은 날 맞춤: `auto-sync-members` · `bulk-import-members` 는 배포본을 저장소에 그대로 옮김(배포본 = 저장소, PC 에 남아 있던 사본과도 코드가 같음 확인) · `push-send` 는 10-19 아이폰(APNs) 판을 배포(웹 푸시 부분은 그대로).
- **GitHub 자동 검사** (`.github/workflows/ci.yml` 「앱 자동 검사」): 어느 브랜치든 올리면 마이그레이션 번호 겹침 → 타입 검사 → 테스트 → 빌드. 빨간불이면 GitHub 이 메일로 알린다(배포는 막지 않음). 다음 작업 전에 먼저 고친다 — 다른 계정 커밋이 원인이어도 되돌리지 말고 고쳐서 올린다.
- **DB 어긋남 점검** (`node scripts/check-db-drift.mjs` · GitHub 「DB 어긋남 점검」 매일 07:40 KST + 마이그레이션이 main 에 올라올 때): 운영 DB 함수 본문 지문(`public.repo_drift_fingerprints()`)과 저장소 정의를 비교한다. 기준선(`scripts/db-drift-baseline.json`)에 없는 **새** 어긋남이면 빨간불 — DB 함수를 고친 세션은 푸시 전에 한 번 돌린다. 어긋남을 고쳤으면 `--write-baseline` 으로 기준선을 다시 저장해 같은 커밋에 넣는다. (DO 블록 replace 덧대기는 '덧대기'로 알리기만 한다 — 그런 함수는 저장소 전체 본문이 옛것이니 고칠 때 DB 지금 정의 위에.)
- **큰 기능은 미리보기 먼저**: `preview/<이름>` 브랜치로 올리면 Cloudflare 가 `https://preview-<이름>.game-fit-quests.pages.dev` 를 만든다(자동 검사도 돈다) → 대표님 확인 → main 에 합친다. 미리보기도 **운영 DB · Edge Function 을 같이 쓴다** — 미리보기 단계의 DB 변경은 새 함수·새 칸 추가만(기존 함수 동작 바꾸기 금지) · 실회원 데이터로 쓰기 시험 금지 · 카카오 로그인은 미리보기 주소에서 안 될 수 있다(아이디 로그인으로 확인). 작은 수정·급한 고침은 지금처럼 main 으로.
- **PC 폴더**(`C:\Users\82104\game-fit-quests`)는 bat 으로 푸시하는 통로다. 거기서 파일을 고쳤으면 그날 커밋·푸시까지 끝내고, 커밋 안 된 수정을 남겨 두지 않는다(10/14 수정 10개가 남아 GitHub 과 엇갈렸다 → 2026-10-20 `_backup/pc-wip-20261014/pc-wip.patch` + `git stash`(pc-wip-20261014) 로 보관하고 main 을 최신으로 맞춤).
- 같은 요청을 두 창에 함께 하면 먼저 잡은 계정만 한다. 다른 계정은 "이미 하는 중"이라고 알리고 나눌 수 있는 다른 부분을 제안한다.

---

## Stack

- React 18 + Vite + TypeScript + Tailwind + shadcn/ui + lucide-react
- React Query (서버 상태 캐시), React Router v6 (lazy)
- Supabase: Postgres + RLS + RPC(SECURITY DEFINER) + Storage + Edge Functions (Deno)
- 배포 경로: GitHub `main` push → Lovable 동기화 → Cloudflare Pages (프런트) + Supabase (DB / Edge Functions)
  - 프런트 반영 시간: 커밋 후 2~4분
  - 마이그레이션/Edge Function 자동 반영은 **보장 안 됨** — 수동 실행 필요할 수 있음

---

## 핵심 경로

### AI 코치봇 (유일 경로 — 새로 만들지 말 것)

| 파일 | 역할 |
|---|---|
| [src/components/ChatAssistant.tsx](src/components/ChatAssistant.tsx) | 🥊 플로팅 버튼 UI + 스트리밍 렌더 |
| `{SUPABASE_URL}/functions/v1/chat-assistant` | 요청 엔드포인트 |
| [supabase/functions/chat-assistant/index.ts](supabase/functions/chat-assistant/index.ts) | Deno Edge Function. 0순위 Claude Sonnet 5.5 (`ANTHROPIC_API_KEY`, `_shared/claude.ts`), 실패 시 Groq 예비 스트리밍. `action:"meal-vision"` 으로 식단 사진 칼로리 분기 |
| [supabase/functions/_shared/systemPrompt153.ts](supabase/functions/_shared/systemPrompt153.ts) | 153 시스템 프롬프트 |
| [supabase/functions/_shared/knowledge153.ts](supabase/functions/_shared/knowledge153.ts) | 153 공식 지식 문서 |

messages 조립 순서 (Groq 예비): boxing SYSTEM_PROMPT + 개인컨텍스트 → SYSTEM_PROMPT_153 → KNOWLEDGE_153 → dietContext(있으면) → 클라이언트 messages.
Claude(0순위)는 프롬프트 캐시 때문에 바뀌지 않는 글을 앞에: SYSTEM_PROMPT[캐시] → [앱 기능 지도][캐시] → 지식 문서(다이어트·복싱, 마지막에 캐시) → 개인컨텍스트 → [앱 안내] → 범위 밖 안내 → dietContext → 클라이언트 messages. 5분 캐시, 적중은 `ai_usage_log.cache_read_tokens`.

### 오삼코치 먼저 말 걸기 (채팅 박스 아님 — 알림함·푸시로 나가는 메시지, 2026-10-15)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261015090000_coach_messages.sql](supabase/migrations/20261015090000_coach_messages.sql) | `coach_config`(켜기·대상·검수) · `coach_pilot` · `coach_messages` · `coach_targets()`(사실 계산, 내 카드와 같은 식) · `coach_dispatch()`(5분마다 알림함으로) · 출석 알림에 칭찬 합치기 · 예약 작업 3개 |
| [supabase/functions/coach-build/index.ts](supabase/functions/coach-build/index.ts) | 02:00 KST 초안 만들기 + Haiku 5.5 배치 요청 (키 없으면 기본 문구) |
| [supabase/functions/coach-collect/index.ts](supabase/functions/coach-collect/index.ts) | 배치 결과 검사 → 통과한 AI 문구로 교체, 비용 ai_usage_log |
| [supabase/functions/_shared/coach.ts](supabase/functions/_shared/coach.ts) | 지시문 · JSON 출력 모양 · 검사(숫자·길이·금지어) · 기본 문구 |

검수(review_required)가 켜져 있으면 승인된 메시지만 나간다. 대상 확대는 `coach_config.audience` 와 `pilot_branch_names()` 로.
미리보기(DB 에 안 씀): coach-build 에 body `{preview: 1~6}` → 문구·검사 결과·사용량을 바로 돌려준다.
보낸 기록: 메시지 탭 '오삼코치' ([src/components/dm/CoachSentList.tsx](src/components/dm/CoachSentList.tsx) → `coach_sent_list()`, 지점장=자기 지점 · 본사=전체, 보기 전용).

### 전략 회의실 (코치진 전용 — 메시지 탭 '전략', 2026-10-16)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261016030000_strategy_room.sql](supabase/migrations/20261016030000_strategy_room.sql) | `strategy_items`(지시·전략·칭찬·운영 원칙·오늘 프로그램·수업 기록) · `strategy_acks` · `strategy_comments` · `strategy_videos` + 비공개 버킷 `strategy-videos`(50MB) · RPC `strategy_*` · 09:00 KST 미확인 재알림 |
| [src/services/strategyService.ts](src/services/strategyService.ts) | 훅·뮤테이션·영상 업로드·`polishDirective` |
| [src/components/strategy/](src/components/strategy/) | `StrategyRoom`(4구역) · `StrategyItemCard` · `StrategyComposers` · `StrategyVideos` |

보는 사람: `_dm_kind` 가 coach/hq 인 사람(코치님은 앱 권한이 '회원'이어도). 지시·원칙 쓰기: 본사 · 지점장(`_strategy_can_direct`).
입구: 메시지 탭 '전략' + 전체 메뉴 2번째 칸 '전략 회의실'(코치님·지점장·운영진만, 회원에게는 칸 없음 — `appMenu.ts` `requires: "staff"`, 확인 안 한 지시 수 배지, 2026-10-19).
'오삼코치 정리'는 chat-assistant `action:"polish-directive"` (Haiku, 하루 30회, `ai_usage_log.feature='directive_polish'`, 입력 저장 안 함).

### 지점 회의실 — 지도진 가상 사무실 · 회의 채팅 (2026-10-27 1단계 · 「마이복서153 지점 회의실 상세 보고서」 추천안)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027140013_branch_office_room.sql](supabase/migrations/20261027140013_branch_office_room.sql) | `office_branches`(켠 지점 · 채널 `office:<지점 코드>`, 지금 선릉역점만) · `office_seats`(mgr · c1~c8 · x1~x4 자동 배정) · `office_status`(on · class · away, 3시간 지나면 on) · `office_meetings`(지점당 열린 회의 하나) · `office_meeting_attendees` · `office_messages`(chat · decision · system) · RPC `office_*` · realtime.messages 정책 2개(비공개 채널) |
| [src/services/officeService.ts](src/services/officeService.ts) | 훅 · 뮤테이션 (`["office", …]` 캐시) |
| [src/components/office/OfficePresenceBridge.tsx](src/components/office/OfficePresenceBridge.tsx) | App 전체 — 앱을 열면 Presence 로 접속(자리에 앉음), 화면을 끄면 30초 뒤 거둠. 바뀜 신호(broadcast `changed`, payload `{t}`)로 캐시 새로 읽기 · 쓰는 중 신호(broadcast `typing` `{u, off?}`, 내용 없음) 주고받기 |
| [src/lib/officePresence.ts](src/lib/officePresence.ts) · [src/lib/officeLayout.ts](src/lib/officeLayout.ts) | 접속 목록 · 쓰는 중(`useOfficeTyping` · `sendOfficeTyping`) 보관함 · 그림 위 자리 좌표(%) · 보이는 영역(`OFFICE_VIEW_ALL` · `OFFICE_VIEW_MEETING`) — 그림 `public/assets/office/office-153.webp` 를 바꾸면 좌표도 다시 |
| [src/pages/OfficePage.tsx](src/pages/OfficePage.tsx) · [src/components/office/](src/components/office/) | `/office` — 사무실 그림(OfficeScene) · 내 말풍선 · 회의 요약 카드(MeetingSummaryCard → 회의실 들어가기) · 회의 열기(OpenMeetingSheet) · 회의록(MinutesSheet) · 홈 「회의실 참석」 카드(OfficeEntryCard — 회의 중이면 바로 회의 화면) · 전체 메뉴 '지점 회의실'(`requires: "office"`) |
| [src/pages/OfficeRoomPage.tsx](src/pages/OfficeRoomPage.tsx) · [src/lib/officeTalkLayout.ts](src/lib/officeTalkLayout.ts) | `/office/room` 회의 화면 (2026-10-27 대표님 "회의실 화면을 보면서 채팅 → 말풍선, 한 화면에") — 위 회의실 그림(크게 ↔ '사무실 전체') · 안건/정한 것 띠 · 채팅 · 입력창. 들어오면 참석, '나가기' = 내 자리로, '끝내기'(대표님 · 지점장). 채팅이 그 사람 머리 위 말풍선(4~9초) — 옆사람과 겹치면 최근 말이 머리 위, 먼저 한 말은 비키거나 위로 한 줄 + 이름표, 자리가 없으면 숨김(채팅엔 다 있음). 쓰는 사람 머리 옆 '…'. 키보드가 덮으면 visualViewport 높이로 줄여 그림 · 입력창이 같이 보이게(그때 안건 띠는 접음) |

- 들어오는 사람: 그 지점 지도진(`_strategy_branch_staff`) + 대표님(`_strategy_hq`). 회의 열기 · 끝내기 · 정한 것 = `_strategy_can_direct`(대표님 · 지점장). 회원 · 다른 지점은 서버(`_office_role`)와 채널 정책(`_office_can_topic`)이 막는다.
- 회의를 열면 지점 지도진 + 대표님에게 알림(`notifications` → 휴대폰 푸시, 링크 `/office/room` — 누르면 바로 회의 화면, 20261027185918). 회의 화면은 이 기기에 고른 지점에 회의가 없으면 회의가 열린 지점으로 연다. 신호에는 내용이 없고 화면이 함수로 다시 읽는다.
- 다른 지점을 켜려면 `office_branches` 에 한 줄(채널 이름 = `'office:' || branches.code`). 2단계 음성 · 카메라(Cloudflare RealtimeKit) · 3단계 회의록 → 전략 회의실 지시는 아직.

### 이모지 → 153 입체 아이콘 (2026-10-16 대표님: "이모지는 모두 빼고 … 퀄리티있는 디자인")

앱 화면에 시스템 이모지가 나오지 않는다. 글자 속 이모지는 그릴 때 자동으로 153 입체 아이콘(img.emo3d, 글자 크기 1.2em)이 된다 — 코드의 이모지 문자열을 고칠 필요가 없다.

| 파일 | 역할 |
|---|---|
| [src/lib/emoji3d/map.ts](src/lib/emoji3d/map.ts) | 이모지 → 아이콘 이름 표 (`null` = 지움, 국기는 자동으로 지움). 표에 없는 이모지는 그대로 둔다(회원이 쓴 글) |
| [src/lib/emoji3d/core.ts](src/lib/emoji3d/core.ts) | 바꾸기·지우기 규칙. 아이콘+글자는 `span.emo3d-run` 하나로 감싼다(부모 flex 에서도 한 덩어리) |
| [src/lib/emoji3d/jsx-runtime.ts](src/lib/emoji3d/jsx-runtime.ts) | vite.config.ts `react({ jsxImportSource: "@/lib/emoji3d" })` — 모든 JSX 글자가 여기를 거친다 |
| [src/lib/emoji3d/sonner.ts](src/lib/emoji3d/sonner.ts) | vite alias 로 `import { toast } from "sonner"` 가 이 파일로 온다 (진짜 sonner 는 `sonner-original`) |
| `public/assets/icons3d/*.webp` | Higgsfield(GPT Image 2.5)로 그린 160개 (192px, 투명). 기존 19개는 `public/assets/minigame/3d` |

- 그림을 못 넣는 곳은 이모지를 지운다: `<option>`·`<textarea>`·SVG 글자, title·aria-label·alt·placeholder 속성, alert/confirm/prompt(main.tsx), 휴대폰 알림(public/sw.js).
- 새 이모지를 쓰려면: 같은 스타일 아이콘을 `public/assets/icons3d/` 에 넣고 map.ts 에 한 줄. 그림을 바꾸면 `ICON3D_VERSION` 을 올린다.
- AI 답변(ChatAssistant)은 표에 없는 이모지를 지운다(`dropUnknownEmoji`).

### 동료에게 응원 보내기 (2026-10-16 업그레이드 — TV 에는 띄우지 않는다)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261016110000_cheer_upgrade.sql](supabase/migrations/20261016110000_cheer_upgrade.sql) | `send_boxing_cheer`(스티커·한마디 하루 10번·같은 동료 1번, 하루 첫 응원 챔피언 머니 +30, 받은 사람 알림 — 휴대폰은 하루 3번째까지, 같은 지점만, 금지어) · `get_cheer_candidates` · `get_my_received_cheers` · `thank_cheer` · `get_member_cheer_summary` · `set_cheer_notify` |
| [src/components/engagement/SecondCheerSheet.tsx](src/components/engagement/SecondCheerSheet.tsx) | 보내기 시트 — 지금 운동 중 → 오늘 다녀간 동료 → 최근 출석, `initialTarget`(라이센스에서) · `stacked` |
| [src/lib/cheerStickers.ts](src/lib/cheerStickers.ts) | 스티커 글자 ↔ 그림(`public/assets/cheer/*.webp`), 상황 추천(생일·승급·복귀) |
| [src/components/engagement/ReceivedCheersSheet.tsx](src/components/engagement/ReceivedCheersSheet.tsx) | 받은 응원함 + 고마워요 153 — 내정보 '받은 응원' · 알림 링크 `/mypage?cheers=1` |

### 커뮤니티 글 공개 범위 · 운영진 보기 권한 (2026-10-18)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261018110000_community_visibility_private.sql](supabase/migrations/20261018110000_community_visibility_private.sql) | `visibility` branch(전체 공개 — 같은 지점) · partners(친구만 — 운동 짝꿍·서로 응원) · private(나만 보기) · `submit_champion_journal_entry_v2`(글+공개 범위 한 번에) · `set_journal_entry_visibility`(내 글) · `community_view_grants` + `list/set_community_view_grant`(본사만) · 피드 · `community_can_view_entry` · RLS |
| [src/components/engagement/ChampionJournalSheet.tsx](src/components/engagement/ChampionJournalSheet.tsx) | 글쓰기 "누가 볼 수 있나요?" — 지난번 고른 것 기억(이 기기) |
| [src/components/engagement/CommunityFeed.tsx](src/components/engagement/CommunityFeed.tsx) | 공개 범위 표시(내 글은 늘) · ⋯ 에서 바꾸기 · 권한 받은 운영진 안내 |
| [src/components/engagement/CommunityViewGrants.tsx](src/components/engagement/CommunityViewGrants.tsx) | 본사 보기 칸의 '지점장·코치 보기 권한' 켜고 끄기 (켜면 받은 사람에게 알림) |

- 다 보는 사람: 쓴 사람 · 본사(`_dm_kind`='hq') · 권한 받은 지점장·코치(`_dm_kind`='coach', 자기 지점만) — 친구만·나만 보기·숨긴 글 포함.
- 권한을 끄면 지우지 않고 `revoked_at` 을 남긴다. 회원 안내 문구는 `VISIBILITY_STAFF_NOTE`(communityFeedService.ts).
- 지점장·코치 권한 패널(CommunityViewGrants): `list_staff_permissions` · `set_staff_permission`(community_view · branch_goal) — 20261018130000.
- 우리 지점 목표(짐 레이드) 만들기·끝내기: `get_branch_gym_raids` · `create_gym_raid` · `end_gym_raid` (본사 · branch_goal 권한) — GymRaidSheet.
- 회원 카드 어디서든: `openMemberCard(userId)` (lib/appEvents) → App 의 GlobalMemberCard(MemberLicenseSheet — 하트·메시지·응원·짝꿍 신청).
  - 코치·지점장·운영진 카드도 열린다(`get_member_license` 의 `staff_role` 표시, 하트·짝꿍 없음 = like_reason `target_staff`, 체험용 계정만 막음) — 20261018170000.
  - 코치·지점장은 **같은 지점** 회원에게 하트를 보낸다(본사 하트처럼 센다, 받는 사람 규칙도 본사와 같음 — `_is_heart_coach` · `toggle_nickname_like` · `_counted_nickname_likes` · `get_member_license` · `get_branch_nicknames`) — 20261027123732 (2026-10-27 대표님 "코치님들도 하트 줄수있게"). 처음 받은 아이디·비밀번호 그대로면 회원처럼 바꾼 뒤에.
- 새 식구 환영 인사: `community_welcomes` · `send_community_welcome` · `get_community_welcomes` (NewbieWelcome) · 회원 화면으로 보기: `get_community_feed_member_view` (전체관리자) — 20261018140000.
- 운동 짝꿍 이름 찾기: `search_cornerman_candidates` (20261018120000). 장비 나눔 금액: `create_gear_post_v2` · `boxing_gear_posts.price` (20261018121000).
- 화면 글에 '본사'를 쓰지 않는다(2026-10-18 대표님) — 전체관리자 화면은 '전 지점 보기', 회원 안내는 '운영진'. 서버가 내보내는 글(알림·오류)도 같다.
- 승인 전 계정 막기: `_is_active_member(uid)`(승인된 회원 또는 운영진) — 사람 찾기·피드·라이센스·초대·지점 목표·장비 나눔·짝꿍 요청 함수 맨 앞에서 확인 (20261019170000). 새 회원용 함수도 같은 줄을 넣는다.
- 짝꿍 요청은 앱에 들어온 적 있는 승인된 일반 회원에게만 (코치·운영진·체험용·앱에 없는 회원 X) — 20261019181000.
- 앱 초대 보상(챔피언 머니 1,000): 초대 링크 `https://myboxer153.com/?inv=<내 코드>`(`get_my_invite_code`, src/lib/appInvite.ts) — 링크로 들어온 순간 코드를 기기에 남기고(main.tsx `captureInviteCodeFromUrl`), 처음 로그인하면 `claim_invite_reward_v2(코드)` 가 그 코드 주인이 미리 초대해 둔(send_member_invite) 경우에만 보상. 링크 없이 들어오면 보상 없이 초대 기록만 닫는다 — 20261019192000.
- 코치·운영진 카드: `get_member_license` 의 `staff_title` 을 칭호로 보여 준다.
- 남은 일(대시보드에서만 가능): Storage `community` 버킷의 'Community photos are public' 정책을 본인 폴더만 보게 바꾸기 — MCP 계정은 storage.objects 주인이 아니라 못 바꿈.

### 153마인드셋 — 시각화 훈련 (2026-10-19 전면 개편, 라우트 /myboxer/visualization)

| 파일 | 역할 |
|---|---|
| [src/pages/MyBoxerVisualizationPage.tsx](src/pages/MyBoxerVisualizationPage.tsx) | 첫 화면 — 이번 주 3번 고리 · 오늘의 추천 · 세션 8개 · 내 목표/나의 한마디 |
| [src/features/myboxer-visualization/MyBoxerVisualizationSession.tsx](src/features/myboxer-visualization/MyBoxerVisualizationSession.tsx) | 시작 화면(길이·소리) → 기분 → 몰입 재생기(숨 쉬는 원·자막·화면 어둡게) → 또렷함·조절감·기분 체크 → 마무리 |
| [src/features/myboxer-visualization/visualizationContent.ts](src/features/myboxer-visualization/visualizationContent.ts) | 대본(Cue 목록) — 말하기·고요·호흡(box/calm)·공·딱딱이·실시간 구령. {goal} {cue} {pb} {pbGoal} |
| [src/features/myboxer-visualization/useMindPlayer.ts](src/features/myboxer-visualization/useMindPlayer.ts) | 대본 재생기 (일시정지 = 하던 줄 처음부터) |
| [src/features/myboxer-visualization/mindAudio.ts](src/features/myboxer-visualization/mindAudio.ts) | 기기 한국어 음성(speechSynthesis, 없으면 자막) · Web Audio 공·배경 소리 · 화면 꺼짐 막기 · 진동 · 녹음 파일 자리(playClip) |
| [src/services/mindsetService.ts](src/services/mindsetService.ts) | 기록·통계·목표 RPC (실패하면 이 기기 localStorage — 예전 키 myboxer.visualization.records 도 계속 씀) |
| supabase/migrations/20261019010000_mindset_sessions.sql · 20261019011000_mindset_cue_word.sql · 20261019160000_mindset_review_fixes.sql | `mindset_sessions` · `mindset_profiles` · `log_mindset_session_v2`(기기 기록 번호 client_id 로 한 번만) · `get_my_mindset_stats` · `set_mindset_profile` (본인만) |

- 사람 목소리 녹음(예: 대표님 목소리 클론, Higgsfield 크레딧 필요)이 생기면 대본 say 줄에 `clip` 을 붙이면 기기 음성 대신 재생된다.
- 튜토리얼 Day 4 표식(mindset-session-picker · intro · session-list · session-card · start-button · player · reflection)은 유지.
- 세는 기록 = 대본 60% 이상 갔거나 3분 넘게 한 것 (서버·기기·홈 카드 같은 기준). 홈 '오늘의 한 가지'의 횟수도 `useMindsetStats()` 숫자.
- 기기 기록·목표·한마디는 계정별(`uid` · `myboxer.mindset.goal:<uid>`) — 인터넷 없이 남긴 기록은 그 계정으로 로그인했을 때만 올린다. 주인을 알 수 없는 개편 전 기록은 올리지 않는다 (가족이 폰을 같이 쓰는 경우).

### 라이브보드(TV) 회원 정보 잠그기 (2026-10-19 대표님 "2번 진행")

- TV 는 로그인하지 않는다. 회원 정보는 **board_* 함수로만** 읽는다 — `board_checkins_today`(오늘 출석, `age_sec` = 들어온 지 몇 초) · `board_active_sessions` · `board_people`(오늘 그 지점에 왔거나 운동 중인 사람만: 이름·사진·코치 여부·지금 레벨·캐릭터·카드에 보일 것) — 20261019190000 · 20261019190500.
- 공개 표(public_profiles · attendance_logs · activity_sessions · member_character_assignments · member_card_display)를 TV 에서 직접 읽지 않는다. 로그인 안 한 사람의 직접 읽기는 막혀 있다(20261019191000).
- 실시간: DB 트리거 `_board_ping` 이 이름 없는 신호만 보낸다(`realtime.send` → 채널 `board-ping:<지점 이름>`, 이벤트 `changed`, payload `{t: 표 이름}`). TV 는 신호를 받으면 0.7초 모아 다시 읽는다. 환영 화면은 `age_sec ≤ 150` 인 새 출석에만(얼굴 출석은 찍은 뒤 평균 3분 늦게 들어온다), 첫 읽기는 조용히.
- 153 레코드(2026-10-19 대표님 가·나·라): `board_record_holders`(TV 열쇠 길, 오늘 온 '최초' 기록 보유자만 · 대회 메달은 이미 이름 옆에 있어 제외) → 가: 들어오면 금색 '153 RECORD' 환영 10초(`RECORD_POPUP_MS`, 생일이면 생일 화면에 기록 한 줄) · 나: 카드 맨 위 금색 띠(`BoxerLicenseCard` `record`) · 라: 랭킹 띠 위 '오늘 온 최초 기록 보유자' 금색 띠(넘치면 흐름). 새 출석이 들어올 때 환영 화면보다 먼저 다시 읽는다. 테스트 판 '🏆 153 레코드 회원 입장'.
- TV 열쇠: `_board_branch_ok` — 지점에 `internal_sync_config.board_key:<지점>` 이 있으면 열쇠가 맞는 TV 와 로그인한 그 지점 운영진만. 열쇠는 TV 를 `/tv/<지점>/<번호>?k=<열쇠>` 로 한 번 열면 그 기기에 남는다(`src/lib/boardKey.ts`). 대기 열쇠(`board_key_pending:`)로 처음 연 순간 잠긴다. 관리자 앱 › 라이브보드(`LiveBoardPickerPage`)가 그 지점 운영진에게만 열쇠 주소를 보여 준다(`get_board_tv_key`).

### 수강권 화면 — PT 남은 횟수 · 락카 번호 (2026-10-19 대표님)

- 멤버십 카드(`MembershipCard`, 수강권·내정보 공용)에 PT 회원은 수업권 이름·남은 횟수·기한, 락카가 있으면 락카 번호. 표시 규칙은 `src/lib/gymTicketInfo.ts`.
- PT 원본은 브로제이 PT 수업권 → 153OS 워커(매시 :40 UTC, 한 지점 18명씩 — 회원마다 24~48시간에 한 번 확인) → `sync-pt-members`(매시 40분)가 `profiles.pt_ticket · pt_remaining · pt_end_date · pt_checked_at` 에 옮긴다. 늦을 수 있어 카드에 "PT 횟수는 ○○ 기준"을 같이 적는다. `pt_until` 은 배지 유효일(확인일+7일)이라 기한으로 쓰지 않는다.
- 락카는 153OS 도 브로제이에서 읽지 않는다(6월 엑셀 한 번뿐). 지금은 지도진이 회원 상세(`MemberDetailPage` '락카' 줄)에서 넣는다 → `set_member_locker`(관리자 = 전체, 지점장·코치 = 같은 지점). `profiles.locker_label` 은 회원이 직접 못 바꾼다(guard). 본인·지도진만 본다 — 20261019200000.

### 앱 결제 장바구니 · 락카/운동복 남은 기간 (2026-10-27 대표님 보고서 「앱 결제 장바구니」 · "나머진 니추천대로")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027041609_cart_rentals.sql](supabase/migrations/20261027041609_cart_rentals.sql) | `payment_order_items`(수강권·운동복·락카 한 줄씩) · `payment_orders.cart_key` · `profiles.locker_end · sportswear_end`(guard) · `apply/revert_payment_order`(콜백이 서버 키로) · `set_member_rental_ends`(지도진) · 결제 알림 항목별 · `remind_pass_ends`(끝나기 7일·1일 전, 매일 10:05 KST) |
| [payssam-create-bill](supabase/functions/payssam-create-bill/index.ts) | `body.cart {membership_product_id, sportswear_months, locker_months}` → 결제선생 링크 1개(50원) · 같은 장바구니 24시간 안이면 아까 링크 · 칠금점은 서버에서도 막음 · `body.product_id` 는 예전 그대로 |
| [payssam-callback](supabase/functions/payssam-callback/index.ts) | 항목 있는 주문은 `apply/revert_payment_order` · 153OS(sync-paid/refunded)에는 수강권 항목만 |
| [src/lib/cartPricing.ts](src/lib/cartPricing.ts) · [RentalAddOns](src/components/membership/RentalAddOns.tsx) | 화면 금액·날짜(서버와 같은 식) · 운동복·락카 담기(수강권 확인 창 `addon` · 렌탈 탭 `standalone`) |
| [MembershipCard](src/components/MembershipCard.tsx) | 락카(번호·끝나는 날)·운동복 줄 'N일 남음' — 7일 이하 주황, 끝나면 '끝남 · 연장하기'(`/membership?cat=rental`, `?buy=1` 은 결제 칸으로) |
| [MemberPassPanel](src/components/admin/MemberPassPanel.tsx) | 회원 상세 '수강' 탭(전체관리자만, `?tab=pass`) — 지금 이용 중 · 락카/운동복 고치기 · 앱 결제(항목) · 브로제이/다짐 매출(`member-pass-history` → 153OS `member_sales_history`, 브로제이는 같은 지점·같은 이름) · 출석 |

- 가격 = 렌탈 상품 한 달 가격(지금 10,000원) × 개월, 무료 없음. 수강권과 같이 담으면 수강권 개월까지(같은 개월이면 수강권 일수 그대로 → 끝나는 날 같게, 1년 = 365일, 그 밖 개월×30일). 남은 기간 뒤로 이어 붙인다.
- 마일리지 10% 기준 = 수강권 금액(렌탈만이면 합계). 누적 결제액·환불 예상에는 수강권 금액만. 락카 번호는 결제 후 지점장님 배정. 락카·운동복 환불은 남은 기간 일할.
- 지금 쓰는 분들 끝나는 날(2026-10-27 한 번): 브로제이 지점은 매출(물품 '개인락커 · 운동복', 10,000원 = 1개월, 환불은 빼고, 오픈형 락카 · 동명이인 제외)로 추정, 칠금은 다짐 이용권 기간 그대로.
- 칠금은 매일 밤 다짐 → 앱: 153OS `app_rental_ends()`(다짐 rentalLocker · rentalSportsWear 끝나는 날 + '락커정보' 번호) → Edge Function [sync-rental-ends](supabase/functions/sync-rental-ends/index.ts)(23:40 KST, x-auto-key, `{dry_run:true}`) → 앱 `apply_rental_ends`(다짐 값이 있는 칸만, 다짐이 정본 — 락카 번호 포함) · 기록 `member_sync_runs`(mode `rental-sync`) — 20261027063559.
- 남은 일: 브로제이 지점 데스크 판매(락카·운동복)는 앱에 저절로 안 들어온다(앱 결제만 자동) — 대표님 '수강' 탭에서 고치기 · 153OS 워커에 렌탈 따로 보내기.
- **결제 취소**: 결제선생 관리자에서 승인 취소를 해도 콜백(apprState=C)이 오지 않는다(9/18 · 10/27 시험 모두 승인 F 만). → Edge Function [payssam-sync-cancels](supabase/functions/payssam-sync-cancels/index.ts)(x-auto-key, `{dry_run}` · `{bill_ids}` · `{days}`)가 paid 주문을 `/bill/read` 로 다시 조회해 apprState=C 면 주문 canceled → `revert_payment_order`(예전 주문은 수강권 일수 빼기) → 마일리지 트리거가 돌려줌 → 153OS `app_refund_paid_membership`(153OS DB 함수, 승인 때 만든 이용권·출입권한·payment_requests 를 거꾸로 — 153OS 워커 sync-refunded 는 404). 앱에서 이미 canceled 인데 153OS 에 남은 것도 맞춤(`raw._os_refund` 로 한 번만). 예약: 30분마다 7일 · 매일 05:20 KST 400일 — 20261027073702. 기록 `member_sync_runs`(mode `payssam-cancel`).
- 2026-10-27: Supabase MCP 의 SQL 쓰기(apply_migration · execute_sql DDL) 승인 창이 대표님 화면에 안 떠 계속 '취소'됨 → 대표님 허락("Db 항상 승인할게")으로 크롬 Supabase SQL 편집기에서 실행(파일을 GitHub raw 로 받아 sha256 확인 후 Monaco 에 넣고 Run). Edge Function 배포(MCP)는 됨. 크롬 번역이 켜져 있으면 실행 뒤 대시보드가 하얗게 멈출 수 있다 — 실행은 됐으니 DB 를 읽어 확인.

### 칠금점 회원 = 다짐매니저에서 매일 (2026-10-26 대표님 "다짐 매니저 크롬에 로그인 완료해놓았어")

- 칠금점은 브로제이가 아니라 **다짐매니저**(dagym-manager.com)를 쓴다. 대표님 노트북 크롬에 로그인해 둔 다짐매니저 회원 목록(파일 다운로드 없이 화면 데이터)을 예약 작업 「칠금점 다짐 회원 동기화」(클로드·은미 계정, 월~토 22:49 KST, 작업판 `ops:schedule:dagym-chilgeum-sync`)가 153OS 로 옮긴다. 지점장님 엑셀 올리기(BulkMemberImport)는 칠금점은 이제 안 해도 된다.
- 153OS(`tbxdrfowanyksgdicryl`, 저장소 밖 — 고칠 때는 DB 의 지금 정의 위에): `dagym_members`(다짐 회원 1줄 · 153OS 회원 연결) · `dagym_open_batch` → 페이지 스크립트가 `dagym_inbox_put`(anon, 30분 열린 묶음만) → `dagym_apply_batch` → `dagym_import`(새 회원 · 이용 중/만료 · `member_snapshots` 만료일 — 수업 이용권만, 락커·운동복·용품 제외) · `dagym_flush_app_sync`(cron 1분 25명, 요청 번호로 앱 응답 확인 · 429 는 다시) · `dagym_sync_report()`(숫자만).
- 앱으로는 기존 길 그대로: 153OS `members` 트리거 → `sync-members-to-app` → 앱 `profiles.membership_end`. 만료 90일 넘은 옛 회원은 새로 만들지 않는다. 다짐에 같은 전화번호로 두 사람이 있으면 앱 계정은 하나(알려진 1건).
- 다짐에서 번호·이름을 고치면 153OS 회원도 따라간다(153OS 값이 지난번 다짐 값과 같을 때만). 앱 가입 번호가 CRM 번호와 다른 회원(보호자 번호로 등록된 아이 · 번호를 바꾼 회원)은 153OS `members.app_phone` 에 앱 번호를 넣는다 — `v_members_for_app_sync.phone` = coalesce(app_phone, phone) 로 앱 계정을 찾고, 만료일은 CRM 번호(phone)로 읽는다(모든 지점 공통, 비어 있으면 예전과 같음). 2026-10-26 칠금 4명을 이렇게 잇고, 8/03 에 CRM 번호로 자동으로 만들어진 안 쓰는 계정 4개는 승인만 껐다(지우지 않음).

### 전체관리자 '등록' 칸 — 전 지점 수강권 등록 (2026-10-26 대표님 "일단 나만 볼 수 있게")

- 전체관리자 대시보드(`/admin`) 탭 '등록' — `role === "super_admin"` 에게만 보인다([src/components/RegistrationReportPanel.tsx](src/components/RegistrationReportPanel.tsx)). 오늘·어제·이번 주·이번 달·지난달·최근 3개월 · 지점별 · 날짜별 목록(신규·재등록·일일권·환불).
- Edge Function [registration-report](supabase/functions/registration-report/index.ts)(super_admin 만, verify_jwt) → 153OS `registration_report(p_from, p_to)`(anon·authenticated 막음): 브로제이 지점은 `sales_entries` '수강권'(신규/재등록은 같은 지점·같은 이름의 앞선 결제로 추정, 하루 한 지점씩 돌아가며 들어옴) · 칠금점은 다짐 매출 `dagym_sales`(다짐 '재등록 여부', 분할 결제는 한 건, 환불은 따로).
- 칠금 다짐 매출은 매일 예약 작업이 회원 목록과 함께 `/sales/list` 를 읽어 `dagym_sales_put` → `dagym_apply_batch`(kind sales → `dagym_import_sales`)로 넣는다. 2025-01 ~ 2026-10 은 처음에 한 번에 받았다(1,755줄).

### 아이폰 앱 (App Store, 2026-10-19 대표님 "애플스토어에도 등록하자")

- 아이폰 앱은 `ios-app/` (Capacitor 8 iOS, 번들 `kr.boxing153.myboxer`, 아이폰 전용, iOS 16+). **myboxer153.com 을 그대로 담는다** — 웹을 고치면 앱도 바로 바뀐다(재심사 없음). 안드로이드는 TWA(구글 플레이)라 별개, 루트 `capacitor.config.ts` 는 얼굴 출석 키오스크 APK.
- 앱 판별: `isIosApp()`([src/lib/iosApp.ts](src/lib/iosApp.ts)) — UA 끝 `MyBoxer153App` + Capacitor. 앱 기능은 [src/lib/iosAppNative.ts](src/lib/iosAppNative.ts)(따로 내려받는 조각). **Capacitor 면 얼굴 키오스크로 보내는 main.tsx 분기에서 아이폰 앱은 빠져야 한다.**
- 로그인: 구글·카카오는 앱 안 웹 화면에서 막히므로 `signInWithOAuthInApp` → 안전한 로그인 창 → `/app-auth-return/` → `myboxer153://auth` → '/?code|#token'. 애플 로그인(`signInWithAppleInApp`, 심사 4.8)은 아이폰 앱에서만 보인다 — Supabase Apple 공급자 Client IDs 에 번들 ID 필요.
- 결제선생 결제는 앱 안 사파리 창(`openInAppBrowser`) — 실물 수업권이라 앱 안 구입(IAP) 대상 아님(3.1.3(e)). **디지털 상품(머니·캐릭터)을 돈으로 팔면 안 된다.**
- 휴대폰 알림: `push_subscriptions.kind='apns'`, 주소 `apns:<토큰>`, `push_subscribe_native` (20261019200500). 발송 push-send/apns.ts, 키 `internal_sync_config.apns_key` {keyId, teamId, p8, bundleId}.
- 심사 대응: AI 로 보내기 전 동의 `ensureAiConsent`([src/lib/aiConsent.ts](src/lib/aiConsent.ts), 5.1.2(i), 아이폰 앱에서만) · 앱 안 계정 삭제(설정 › 계정 삭제 → Edge Function `account-delete-request`: 기록 → 알림 끄기 → 전체관리자 알림 → 로그인 잠금, 7일 안에 회원 화면 '계정 삭제'로 마무리, 5.1.1(v)) · 고객지원 `/support/`.
- 빌드: `.github/workflows/ios.yml` — ios-app/ 이 바뀌면 GitHub 맥 서버에서 빌드. 비밀값 `ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_PRIVATE_KEY` 가 있으면 서명 → TestFlight 업로드(빌드 번호 = 실행 번호). 공개 저장소라 로그에 비밀값을 찍지 않는다.
- 스토어 글·심사 메모·개인정보 항목: [ios-app/store/listing-ko.md](ios-app/store/listing-ko.md).

### 153 체력 프로필 — 1단계 '내 체력 보기' (2026-10-25 대표님 · 「153 PB 체력 프로필 · 몰입 기능 설계 보고서」)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261025130557_fitness_profile_153.sql](supabase/migrations/20261025130557_fitness_profile_153.sql) | `member_fitness_measures`(악력 · 허리둘레 · 안정시 심박, source coach/me — 본인 · 같은 지점 지도진만 읽기) · `test153_areas`(16구간 → 영역 5개) · `save_fitness_measure` · `get_my_fitness_profile`(본인 또는 `can_measure_test153`) |
| [src/lib/test153Profile.ts](src/lib/test153Profile.ts) | 서버 JSON 정규화 · 영역 비교(좋아진 % — 시간은 줄수록, 개수는 늘수록) · 화면 문구. 숫자는 서버 값 그대로 |
| [src/components/profile/BodyInfoSheet.tsx](src/components/profile/BodyInfoSheet.tsx) | 맨 위 '153 체력 프로필' 카드(읽기 전용, 실측) + 선택 칸 허리둘레 · 안정시 심박 |
| [src/components/test153/Test153MeasurePanel.tsx](src/components/test153/Test153MeasurePanel.tsx) | 공식 기록 저장 직후 '이번 결과 한 장'(이번 vs 지난번 · 가장 좋아진 영역) + 악력 칸 |

- 영역 5개: 심폐(셀트런 8번 평균 · 끝까지 속도 유지율) · 하체(스쿼트 + 런지, 1분당) · 상체 · 코어(푸시업 + 복서 싯업) · 복싱(버피 + 원투쓰리 스텝 + 스텝 콤비 시간 합) · 리듬(줄넘기). 끝내지 못한 구간이 든 영역은 null.
- `save_test153_record` 는 그대로 — 악력은 저장 직후 `save_fitness_measure` 로. 다음 측정 = 마지막 측정 + 42일(6주 시즌).
- 악력은 회원도 내 신체 정보 선택 칸에서 넣는다(2026-10-25 대표님 — 체육관 코멧 악력계, 좌우 각 2번 중 가장 높은 값 · source 'me') — 칸 옆 '몸무게의 N%' = `relGripPct`(서버 rel_pct 와 같은 식). 같은 날 코치 값이 있으면 카드는 코치 값.
- 백분위 · 체력 나이는 2단계(`get_my_fitness_profile` 키만 있고 null). TV(board_*)에는 체력 정보를 내보내지 않는다. 줄어든 것은 숫자로 말하지 않는다(잘한 것만).

### 붕대 감기 9단계 설명서 (2026-10-27 대표님 "한눈에 9장 · 누르면 상세페이지처럼 · 사진에 시작 → 끝 방향 · 움직이는 사진으로")

- /handwrap — 한눈에 9칸(작은 사진 + 방향 + 짧은 글) → 누르면 상세 `?step=N`(1~9, 뒤로 가기로 닫힘): 끝 장면에 방향이 그려짐 → 그 단계를 실제로 감는 움직이는 사진 → 반복. [HandWrapStepViewer](src/components/handwrap/HandWrapStepViewer.tsx) · 방향 그림 [HandWrapGuideDraw](src/components/handwrap/HandWrapGuideDraw.tsx)(시작 초록 → 노란 길 · 흰 점선 = 손바닥 쪽 → 끝 주황, 오른손은 거울).
- 글 · 영상 · 방향 좌표는 [handWrapGuide.ts](src/data/handWrapGuide.ts) `HANDWRAP_STEPS` 한 곳. `guide` 좌표는 각 단계 영상의 **마지막 장면**(= `stepNN.webp`) 위 % — 영상을 다시 자르면 좌표도 끝 장면을 보고 다시 맞추고, 주소 끝 판 표시(`STEP_MEDIA_VERSION`)를 올린다. 파일 `public/handwrap/steps/stepNN.mp4 · .webp · _s.webp`(작은 사진).

### 창(모달·시트) 뒤 페이지 스크롤 잠금 (2026-10-19)

- `useModalDismiss(open, onClose)` 또는 `lockBodyScroll()`([src/lib/scrollLock.ts](src/lib/scrollLock.ts))만 쓴다 — 잠금 개수를 세서 마지막 창이 닫힐 때만 푼다.
- `document.body.style.overflow` 를 창마다 직접 기억·복원하지 않는다. 창이 겹치면(지금 운동 중 전체화면 → 회원 카드) 닫은 뒤에도 hidden 이 남아 페이지가 안 내려간다(대표님: "지금운동중 회원카드 클릭후 밑으로 스크롤이 안됨").

### Claude API 크레딧 (2026-10-15 연결)

- Console 조직 **153복싱짐** — Max 플랜 월 $200 크레딧 (매달 16일 지급). 조직 월 한도 $500, 워크스페이스 한도는 매달 1일(UTC) 초기화.
- 워크스페이스·월 한도: **마이복서153 $30** (앱 — 채팅 Sonnet 5.5 + 오삼코치 Haiku 5.5) · **마케팅 $50** · **실험·비축 Lab $120**.
- Supabase 시크릿 `ANTHROPIC_API_KEY` = 마이복서153 워크스페이스 키 `mybox153-prod` (만료 없음). 키 값은 채팅·코드·커밋에 절대 넣지 않는다.
- 한도에 걸리거나 키가 없으면: 채팅은 Groq 예비, 오삼코치는 기본 문구 — 앱은 멈추지 않는다.
- 비용 기록: `ai_usage_log` (feature: `chat` · `coach_batch` · `coach_preview`, `cost_usd`).

### Supabase 연결

| 파일 | 역할 |
|---|---|
| [.env](.env) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) | `createClient<Database>` 싱글톤 |
| [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) | 자동 생성 DB 타입 |
| [supabase/config.toml](supabase/config.toml) | `project_id = whnczhxyjmyywhlfbgsd` (2026-06 raoqefkwdpovwlgbibis→이전 완료, 본인 소유) |
| [supabase/migrations/](supabase/migrations/) | 모든 DB 스키마 변경 — `YYYYMMDDhhmmss_*.sql` 규칙 |
| [supabase/functions/_shared/](supabase/functions/_shared/) | Edge Function 공용 모듈 — Deno `import` 가능한 유일한 공유 위치 |

---

## 작업 워크플로

0. **시작** — `git pull --rebase origin main` → 작업판 보기 → 같은 일이 이미 있었나 찾기 → `myboxer:<영역>` 잡기 (위 「두 계정 동시 작업」 — 다른 계정이 잡은 영역이면 손대지 않는다).
1. **파일 탐색** — Grep 으로 기존 호출부/타입 확인. 새 파일을 만들기 전에 비슷한 게 이미 있는지 훑는다.
2. **최소 편집** — Edit 도구로 필요한 영역만. 전체 재작성은 `Read` 먼저.
3. **타입체크** — `npx tsc --noEmit` (없으면 빌드에서 터짐).
4. **빌드 확인** — `bun run build`. "✓ built in …" 나오면 OK.
5. **커밋/푸시** — 메시지에 "변경 이유 + 영향 파일" 요약. 민감 파일 (.env, .dev.vars, .wrangler/) 스테이징 금지. 푸시 직전 `git fetch && git rebase origin/main` → `bun run build` 한 번 더.
6. **배포 확인** — Cloudflare Pages 빌드 완료 기다림. 마이그레이션·Edge Function 변경은 Lovable 또는 SQL Editor 수동 실행 필요. DB 함수를 고쳤으면 `node scripts/check-db-drift.mjs`. 끝나면 작업판에 `done`(커밋 해시).

---

## Supabase 권한 주의 (Gotcha)

- 프로젝트 owner = Lovable. 로컬 CLI 로그인으로 `functions deploy` 시 **"does not have the necessary privileges"** 403 가능.
- 해결 방법 우선순위:
  1. **Lovable 채팅에 위임** — "아래 마이그레이션/Edge Function 을 프로덕션에 반영해줘"
  2. **Supabase Dashboard SQL Editor** — 마이그레이션 SQL 수동 붙여넣기 → Run
  3. **Personal Access Token** — owner 계정으로 토큰 발급 후 `SUPABASE_ACCESS_TOKEN` 환경변수
- `auth.uid()` 는 SQL Editor 에서 NULL. 테스트 쿼리는 명시적 `user_id = '...'` 사용.

---

## 자주 쓰는 명령

```bash
bun run dev           # 개발 서버
bun run build         # 프로덕션 빌드 (타입체크 포함) — 푸시 전 필수
npx tsc --noEmit      # 타입만 빠르게 확인
npx eslint <path>     # 린트 단일 파일
git log --oneline -5  # 최근 커밋 확인
```

---

## 변경 요약 포맷 (커밋/응답용)

```
[영역] 한 줄 요약

변경 파일:
- path/a.ts — 무엇을 바꿨는지
- path/b.tsx — 무엇을 바꿨는지

이유: 왜 이렇게 했는지 1~2줄
확인: bun run build ✓ / 추가 수동 단계 (있다면)
```
