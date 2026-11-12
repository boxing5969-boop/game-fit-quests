# CLAUDE.md

마이복서153 (153복싱짐) 스포츠 RPG 앱. Lovable 로 초기 생성됐고 이제 GitHub + Claude Code 중심으로 관리한다.

브랜드:
- 앱 이름: **마이복서153**
- 영문 로고: **MY BOXER 153**
- 시스템명: **153 QUEST**
- 공식 훈련 과정명: **마스터 로드** (코드 식별자는 `master_track` 유지 — DB 마이그레이션 회피)
- 시즌/이벤트명: **더 다이어터** (챌린지 페이지)
- 체력 평가: **153 PB** (Personal Best · 내 최고 기록) — 처음 이름 '153 TEST', 2026-10-18 바꿈. 코드 식별자는 `test153` 유지. 이름은 `TEST153_NAME`(src/lib/test153.ts)
  - 시범 영상 (2026-10-29 대표님 오스모 촬영 8편): `public/test153/pb1~8.mp4`(1080×1080 정사각 · 무음 · 위 = 동작 화면 + 큰 횟수 카운터 `n / 오픈 개수`, 아래 = 큰 글씨 안내 띠 — 종목 번호·이름 · 오픈/스타터 개수 · 인정 기준 · 오픈 개수를 끝까지 채울 때까지 반복 · 버피는 거울·등쪽 살 보이는 부분 어둡게 가림) + `.webp` 포스터. 원·투·쓰리 스텝은 앞·옆·뒤·옆 방향 1번씩을 각 1세트로 셌다. `TEST153_STATIONS[].video` → 153 PB 탭 '종목 8개' 카드(포스터만, 보일 때 받기)를 누르거나 코스 지도의 원을 누르면 아래 창에서 그 종목 영상 하나만 받아 바로 재생. 종목 이름 · 기준을 바꾸면 영상 자막도 다시 만든다(원본: 구글 드라이브 DJI Device/OsmoPocket4P-95D7/20261029).
  - 메시지: "상대는 지난번의 나" · "복싱은 상대를 이기기 위해, 먼저 나와의 싸움에서 이겨야 하는 운동" · 마라토너처럼 1초를 당긴다
  - 탭 화면 (2026-10-30 대표님 "글만 보이는데 직관적으로 153 PB가 어떤 건지 — 하이록스 · 크로스핏 · 당근 · 토스처럼" → 「153 PB 탭 디자인 보고서」, "니가 추천하는 대로"): 위에서부터 ① 코스 지도 `Test153CourseMap`(8라운드 뱀 모양 · 점선 = 셀트런 · 원 = 종목 `mapName` 5글자 이하 · '상대는 지난번의 나'는 지도 아래 한 줄) ② 종목 카드 `Test153MoveRail`(셀트런 + 8장 가로 넘기기 · 누르면 영상 창 · 이전/다음) ③ 내 기록(큰 숫자 하나 · 구간 막대 16개 · 지난 기록은 접기) ④ 순위(오픈/스타터 · 우리 지점/전체 · 남녀·나이는 '거르기') ⑤ 안내(왜 · 규칙과 평가 · 1초 당기는 법). **기록이 있는 회원은 ③이 맨 위**. DB · 점수 · 순위 계산은 그대로.
  - 순위 · 레코드 (2026-11-05 대표님 "코치님들은 최초 레코드에 포함하지 말고 랭킹에만 넣어줘" · [20261105180052_test153_rank_staff.sql](supabase/migrations/20261105180052_test153_rank_staff.sql)): 순위(`test153_rankable` → `get_test153_ranking` · 내 순위 `get_test153_summary`) = 체험용 계정만 빼고 모두 — 코치님 · 운영진도 오른다. 화면은 `get_test153_ranking_v2` 의 `r_staff_label`(직함 '코치' · '지점장' 또는 '운영진')을 이름 옆에 · 그런 줄이 있으면 목록 아래 '코치님 · 운영진 기록은 순위에만' 한 줄. 153 레코드(최초 153 PB 완주 · 최초 153 PB 1위 — '오픈 남자/여자 회원 1위')와 한 달 창(`test153_top_window`)은 그대로 회원만(elig). 코치님 · 대표님 첫 기록 2개(11-05)는 총 시간만 DB 에 넣었다(구간 없음 → '구간 기록' 칸 안 보임 · 저장 함수의 25분 상한 밖 완주 1개 포함).
- 이름 읽기: **153 = '일오삼'** — 정식 명칭은 **'일오삼 복싱짐'** ('백오십삼'·'백오삼' 아님, 2026-10-19 대표님 "꼭 기억해"). 화면 글은 '153' 그대로 쓰고, 소리로 내보내는 글(휴대폰 음성 TTS · 녹음/내레이션 대본)은 `toSpokenKo()`([src/lib/spokenKo.ts](src/lib/spokenKo.ts))를 거치거나 처음부터 '일오삼'으로 쓴다. 휴대폰 음성은 그냥 두면 '백오십삼'이라 읽는다.

---

## 별도 시스템 (마이복서153 앱과 무관)

레포 안에 다음 경로의 파일들은 **네이버 톡톡 자동 상담 봇** — 마이복서153 앱과 별도 시스템이다. 앱 작업 시 절대 같이 commit/push 하지 않는다.

- `external/naver-talktalk/*.js` — 스탠드얼론 스크립트
- `supabase/functions/talktalk-chilgeum/` — 칠금점 봇 Edge Function
- `supabase/functions/talktalk-webhook/` — 톡톡 웹훅 Edge Function
- `supabase/functions/talktalk-ai/` — 톡톡 웹훅·카카오 스킬 앞단(2026-10-27): 지점 봇 서버(Deno Deploy `zippy-monkey-7321`)에 그대로 넘기고, 손님 말에 첫 인사 메뉴만 돌아올 때만 Claude Haiku 5.5 가 153OS `get_bot_config` 안내 자료 안에서 답한다(`ai_usage_log.feature='talktalk_ai'`, 끄기 시크릿 `TALKTALK_AI=off`). 봇을 쓰는 모든 업체(10/27) — 153복싱짐 지점(선릉·잠실·칠금, 첫 인사에 '153복싱')은 오삼코치 · 대표님 규칙, 헬스장 등 다른 업체(153gym 문화동 · 153GYM 용산 · 브이디짐&뮤직스피닝 봉방 · 신연수)는 일반 규칙('담당자', 복싱 문구 없이 · '연결' 단어가 없으면 그 업체 전화). 톡톡·카카오 5초 제한 — supabase-js 없이 REST(콜드 스타트 줄이기) · 단어에 안 걸릴 글이면 봇 답을 기다리는 동안 AI 먼저 시작. 주소: 카카오 칠금 스킬 `…/functions/v1/talktalk-ai/k/chilgeum`(10/27 바꿈) · 톡톡 웹훅 `…/talktalk-ai/n/<지점>`(파트너센터에서 대표님)
- **Deno Deploy 이사 — 2027년 3월** (2026-10-27 대표님 "3월에 예약 걸어놓고, 그때까지 쓰고 그 후에 옮기는 걸로"): Deno Deploy 가 2027년 4월 무렵 끝난다(2026-10-09 발표 "6개월 안"). 상담봇 서버 `zippy-monkey-7321` · PT 상담앱 `quiet-vulture-8998`(`external/pt-consult-app/`) · 사진 서버 `tidy-robin-56` 을 Supabase 로 옮기는 일은 클로드·은미 계정 예약 작업 「상담봇·PT앱 Deno Deploy 이사 (2027-03-02)」(10:00 KST)가 하고, 2027-01-12 에 종료 날짜를 먼저 확인한다(작업판 `ops:schedule:talktalk-deno-migration`). 다른 계정은 같은 이사를 따로 시작하지 않는다. 상담봇 서버 소스는 Deno 에만 있다(저장소에 없음). 네이버 톡톡 7곳 주소 바꾸기도 그때 함께 한다(대표님 10/27 "3월에 전부 이사하자") — 그 전에는 대표님께 톡톡 주소를 바꾸라고 하지 않는다(그때까지 톡톡은 단어 답만, AI 는 카카오 칠금만).

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
  - **2026-11-08 확인 — 지금 미리보기는 옛 DB 를 본다**: Cloudflare Pages 「미리보기(Preview)」 환경 변수가 이사 전 Supabase `raoqefkwdpovwlgbibis` 그대로라(운영 = `whnczhxyjmyywhlfbgsd`) 모든 `preview-*.game-fit-quests.pages.dev` 가 옛 DB 로 붙는다 — 미리보기에서는 실데이터 · 새 DB 함수가 안 보인다(404). 고치기 전까지는 화면은 `?demo=1` 같은 예시로 보고, 실데이터는 로컬에서 운영 키(`.env.local`, 커밋 금지)로 확인한다. 고치려면 Cloudflare › game-fit-quests › 설정 › 환경 변수(미리보기)의 `VITE_SUPABASE_URL` · `VITE_SUPABASE_PUBLISHABLE_KEY` · `VITE_SUPABASE_PROJECT_ID` 를 운영 값으로(대표님 확인 뒤).
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

### 전략 회의 (코치진 전용 — 지점 회의실 '전략 회의' 탭, 2026-10-16 · 2026-10-29 메시지 탭에서 옮김)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261016030000_strategy_room.sql](supabase/migrations/20261016030000_strategy_room.sql) | `strategy_items`(지시·전략·칭찬·운영 원칙·오늘 프로그램·수업 기록) · `strategy_acks` · `strategy_comments` · `strategy_videos` + 비공개 버킷 `strategy-videos`(50MB) · RPC `strategy_*` · 09:00 KST 미확인 재알림 |
| [src/services/strategyService.ts](src/services/strategyService.ts) | 훅·뮤테이션·영상 업로드·`polishDirective` |
| [src/components/strategy/](src/components/strategy/) | `StrategyRoom`(4구역) · `StrategyItemCard` · `StrategyComposers` · `StrategyVideos` |

보는 사람: `_dm_kind` 가 coach/hq 인 사람(코치님은 앱 권한이 '회원'이어도). 지시·원칙 쓰기: 본사 · 지점장(`_strategy_can_direct`).
입구 (2026-10-29 대표님 "둘다 비슷한 기능이라 지점회의실에 전략 회의실 기능을 넣어주고 전략회의실은 메뉴에서 빼줘"): 지점 회의실 `/office?tab=strategy` 하나 — 탭 「사무실 · 전략 회의」(OfficePage, StrategyRoom 은 그대로 넣음). 전체 메뉴 '전략 회의실' 칸 · 메시지 '전략' 탭은 뺐다. 예전 주소 `/messages?tab=strategy`(서버 알림 링크 — strategy_save · strategy_comment_add · strategy_star · strategy_remind_unacked · office_wrap_up 이 아직 이 주소를 쓴다)는 MessagesPage 가 `/office?tab=strategy` 로 넘긴다 — 서버 링크는 바꾸지 않아도 된다. 지점 회의실 칸은 코치님·지점장·운영진 모두(`requires: "staff"`) — 사무실이 안 켜진 지점(office_me 에 없음, 지금 선릉역점만 켜짐)의 코치님은 전략 회의만 보인다. 칸 빨간 숫자 = 확인 안 한 지시(strategy_badge), 없으면 회의 중 빨간 점.
'오삼코치 정리'는 chat-assistant `action:"polish-directive"` (Haiku, 하루 30회, `ai_usage_log.feature='directive_polish'`, 입력 저장 안 함).

**153 수업 템플릿** (2026-11-11 대표님 「선택할 수 있는 수업 템플릿 중 하나로 지정하자」): 내용은 [src/lib/classTemplates.ts](src/lib/classTemplates.ts) 한 곳(DB 없음 · 테스트 classTemplates.test.ts) — 오늘 프로그램 시트 맨 위 칩(고르면 이름 · 블록 · 코치님께 한마디가 채워짐) · 오늘 프로그램 칸의 템플릿 카드([ClassTemplates.tsx](src/components/strategy/ClassTemplates.tsx) — 코치님은 펼쳐 보기, 대표님 · 지점장님은 「이 템플릿으로 오늘 프로그램 만들기」) · 수업 기록 '진행한 프로그램' 선택지(`tpl:<id>` — 저장은 이름만, program_id 없음). 첫 템플릿 「미트 두 콤보 + 샌드백 구령」: 거울 앞 스텝 · 자세(설명은 여기서) → ① 잽 → 앉았다 일어나며 카운터(코치 미트 2~3라운드 — 인원 많으면 3, 적고 기본기 좋으면 2) → ② 잽(안면) → 더킹 → 왼손 훅 → 오른손 카운터(2~3라운드 · **레벨 10 또는 다른 곳에서 배운 경험이 있는 회원만**, 그 밖의 회원은 ①) → 샌드백 구령 1R ① · 2R ② · 마지막 30초 대시 → 자율 운동(2인1조 타이틀 미션 기술 · 어깨치기 · 샌드백 · 코치 1:1 미트). 원칙: 회원 감정이 먼저 · 미트 칠 때 티칭은 짧게 · 흐름이 끊기지 않게. 분(10 · 10 · 10 · 8 · 12 = 50)은 어림 — 라운드 수가 기준. 템플릿을 더하려면 목록에 한 칸.
- **템플릿 화면은 늘 토스 · 배민처럼 큰 글씨** (2026-11-12 대표님 「수업 탬플릿에 항상 글크기나 디자인은 늘 토스나 배달민족처럼 … 잘 보일 수 있게」): 글씨 6단계 이름만(제목 `text-title` · 순서 이름 `text-heading` · 설명 `text-body` · 이름표 `text-label`) · 순서는 번호 줄(타임라인) · 동작 흐름 글은 `FlowText`(→ 민트 · ① ② 동그라미 숫자) · 접힌 카드 = 이름 + 칩(분 · 단계 · 영상 수) + '순서 · 영상 자세히 보기 ›'. 새 템플릿도 이 카드 그대로.
- **순서마다 참고 영상** (같은 날 「각 순서마다 참고할 수 있는 영상을 첨부해서」 · [20261112020054_class_template_videos.sql](supabase/migrations/20261112020054_class_template_videos.sql)): `class_template_videos`(템플릿 id · step — 0 = 수업 요약(그 템플릿으로 한 실제 수업) · 1~ = 블록 순서 · 파일 = 비공개 `strategy-videos` 버킷 · 뺀 것은 `removed_at`) · `class_template_videos_list`(코치진 모두 — 모든 지점 공통) · `class_template_video_set` / `_clear`(대표님만 · 파일은 대표님 폴더 · 버킷에 파일이 있어야). 화면 [classTemplateVideoService](src/services/classTemplateVideoService.ts) → 카드 맨 위 「수업 요약 영상」 · 순서마다 「참고 영상」(서명 주소 1시간 → `VideoOverlay`) · 대표님은 「영상 넣기 · 바꾸기 · 빼기」. 함수가 없는 DB(미리보기 옛 DB)면 영상 없이. 코드에서 블록 순서를 바꾸면 DB step 도 같이 옮긴다. 회원 얼굴이 나오는 수업 영상이라 공개 저장소 · `public/` 에 넣지 않는다.
  - 영상 넣기 칸은 자리마다 `label` + `input[type=file]`(sr-only · aria-label '3번 순서 참고 영상 넣기' 등) — 크롬 자동화는 그 input 에 파일을 바로 넣는다(누르면 파일 창이 떠서 못 다룸, 한 번에 10MB 아래). 제목 = 올린 파일 이름(카메라 이름이면 비움 — `videoTitleFromFileName`).
  - 적용 (2026-11-12 대표님 「적용하고 올려」): DB = MCP `apply_migration`(새 표 1 · 함수 3) → 되돌림 시험(대표님 = 목록 · 파일 없는 경로 · 남의 폴더 막힘 · 빈 빼기 0 / 코치 = 보기만 · 넣기 · 빼기 막힘 / 회원 = 막힘 / anon 실행 · 표 직접 읽기 막힘) → main. 첫 영상 = 11/11 낮 1시 수업(수업 요약 · ② 미트 ① · ③ 미트 ②) — 원본 · 앱용(10MB 아래) 파일은 구글 드라이브 `153 마케팅 보관/코치 교육 영상`.

### 153 기준 — 코치 기준 다섯 가지 · 4주 성장 · 수업 관찰 (전략 회의 「153 기준」, 2026-11-05 대표님 「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)

대표님 말씀 「회원님들 짧은 시간 안에 행복을 드리자」를 코치님이 매 수업 할 수 있는 행동 다섯 가지로 바꾼 것 — ① 이름을 불러요 ② 시작과 끝은 인사로 ③ 칭찬은 구체적으로 ④ 처음 온 회원을 먼저 ⑤ 다음 목표를 알려줘요. 새 페이지가 아니라 153운영본부 › 전략 회의의 하위 칸(`/office?tab=strategy&s=std` — 알림 링크).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261105005333_coach_std_growth.sql](supabase/migrations/20261105005333_coach_std_growth.sql) | 새 표 3 · 새 함수만(기존 함수 그대로): `coach_std_items`(브랜드 공통 기준 · 처음 판 5개 — 대표님만 `coach_std_save`) · `coach_growth_plans`(코치님마다 진행 중 과정 하나 · 4주 기본 · 돌아보기 decision keep/extend(+2주)/talk) · `coach_observations`(수업 관찰 — 점검표 marks · 잘한 것 good1 · good2 · 바꿀 것 fix1 · fix_no · seen_at) · `coach_growth_me`(한 번에 — 기준 · 나 · 지시권자면 지점 코치님 board) · `coach_growth_start` · `coach_observe_save` · `coach_observe_seen` · `coach_observe_delete` · `coach_growth_review` |
| [src/lib/coachGrowth.ts](src/lib/coachGrowth.ts) | 4주 주제(1주 이름과 인사 · 2주 칭찬과 첫 방문 · 3주 다음 목표 · 4주 다섯 가지 모두 · 5주부터 가장 약한 한 가지) · 점수(했어요 1 · 조금 0.5 · 못 했어요 0 — 서버와 같은 식) · 가장 약한 기준 · 첫 관찰 → 마지막 관찰 (테스트 coachGrowth.test.ts) |
| [src/services/coachGrowthService.ts](src/services/coachGrowthService.ts) · [src/components/coach153/](src/components/coach153/) | `CoachStdSection`(코치님: 나의 4주 · 받은 피드백 · 나의 다섯 가지 · 기준 / 대표님 · 지점장님: 코치님들 · 나) · `CoachStdCards` · `CoachStdSheets`(수업 관찰 · 4주 시작 · 돌아보기 · 기준 고치기 · 점검표 `StdMarksEditor`) |
| [src/components/strategy/StrategyComposers.tsx](src/components/strategy/StrategyComposers.tsx) `ClassLogComposer` | 코치님 자기 점검 = 수업 기록 창의 「153 기준 점검(선택)」 → `strategy_items.data.std`({"1":"y"…}) — 새 표 없이 수업 기록에. '오늘 수업 점검' 단추가 이 창을 연다 |
| [supabase/functions/_shared/coachFeedback.ts](supabase/functions/_shared/coachFeedback.ts) · chat-assistant `action:"coach-observe-polish"` | 오삼코치로 다듬기 — 대표님 메모 + 점검표 → 잘한 것 2 · 바꿀 것 1(따옴표 말 한 줄). 채팅 모델(Sonnet) · 사람마다 하루 20번 · `ai_usage_log.feature='coach_feedback'` · 메모 저장 안 함 · 지시문 = 기준(+ 예시 말 `say`) · 규칙 8 · 예시 한 벌(`FEEDBACK_EXAMPLE` — 이 예시도 검사를 통과해야 한다) · 결과 검사(탓하는 말 · 지어낸 숫자(메모 · 기준 글 · 153 은 허용) · 전화번호 · 길이, 걸리면 무엇이 걸렸는지 붙여 한 번 다시 `retryNote`) — 테스트 src/lib/coachFeedback.test.ts |

- 보이는 범위: 코치님 = 본인 과정 · 본인이 받은 피드백만. 대표님 · 지점장님(`_strategy_can_direct`) = 그 지점 코치님들(대표님 계정 · 본인은 빠짐) · 돌아보기 결정과 메모는 지시권자만. 시작 · 관찰 · 돌아보기는 서버가 지점을 다시 본다(`_coach_target_branch`).
- 알림(`notifications` → 휴대폰): 4주 시작 · 피드백 · 2주 더 · 4주 완료. '따로 이야기해요'는 알림 없음.
- **오삼코치 다듬기 스위치**: `internal_sync_config` key `coach_feedback_ai` = 'on' 일 때만 관찰 창에 메모 칸 · 단추가 보인다(`coach_growth_me.ai_polish`). chat-assistant 를 배포한 뒤(배포 전 지금 배포본과 비교) 대표님 허락으로 켠다. 끄기 = 값을 'off'. 켬 (2026-11-05 대표님 「같이 켜 줘」): chat-assistant v27(999baee — 배포 전 v26 = a1c7397 같음 확인) → 지시문 손보기 v28(a45d0fc, 보낸 파일 = 저장소 sha256 같음) · `coach_feedback_ai` = 'on' → 대표님 · 지점장 계정 `ai_polish` true 확인.
- 미리보기 `preview/coach153` 로 먼저 만들었고, 2026-11-05 15:4x 대표님 「올려」로 코치 성향 카드와 함께 main 에 합침(6bf42d4 — `preview/coach-mind` 가 이 화면 위에 얹혀 있었다). DB 는 대표님 「적용해」로 MCP 적용(2026-11-05 — 되돌림 시험: 코치 = 본인만 · 지점장 = 그 지점 코치님 · 다른 지점 · 겹친 시작 · 잘못된 점검표 막힘 · 돌아보기 결정은 지시권자만 · 알림 3건). **미리보기 단계에서 DB 를 적용하면 마이그레이션 파일은 main 에 먼저 올린다**(908eff2) — 안 올리면 「DB 어긋남 점검」이 '저장소에 정의가 없는 DB 함수'(이번엔 14개)로 다음 날 아침 빨개진다.

#### 코치 성향 카드 · 맞춤 피드백 (2026-11-05 대표님 「코치님들의 mbti와 심리 상세한 정보를 먼저 획득한 뒤에 … 이런 식으로 남기면 코치님들이 알아들을 수 있도록 피드백해 주는 기능」)

대표님 · 지점장님이 생각나는 대로 남긴 지도 원칙(예: 스트레이트 전에 훅 · 어퍼 금지 · 실력별 최소 2그룹 · 시범 → 단계 → 한 명 30초)을 오삼코치가 **공통 기준**으로 정리하고, 코치님마다 스스로 답한 **성향 카드**에 맞춰 말하는 순서 · 길이 · 말투 · 예시 · 맺음만 바꿔 보낸다. **기준은 모두에게 같다** — 코치님 화면에 '모든 코치님께 같은 원래 기준'이 늘 같이 보인다. 153 기준 칸 안에 넣었다(새 페이지 없음).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261105124544_coach_mind.sql](supabase/migrations/20261105124544_coach_mind.sql) | 새 표 4 · 새 함수만: `coach_mind_profiles`(답 · MBTI · 한 줄 둘 · 전달 설명서 `summary` · 동의 `consent_at`) · `coach_mind_asks`(카드 부탁 20시간에 한 번) · `coach_notes`(공통 기준 `core`) · `coach_note_deliveries`(코치님마다 `body` — 카드가 없으면 null = 기준 그대로 · 읽음 · 확인 · 한마디) · `coach_mind_state`(한 번에) · `coach_mind_save` · `coach_mind_clear`(본인 또는 대표님 — 내용만 비움) · `coach_mind_ask` · `coach_note_send` · `coach_note_seen` · `coach_note_ack`(한마디면 보낸 분께 알림) · `coach_note_remove` · 문항 값 `_coach_mind_allowed()` |
| [supabase/functions/_shared/coachMind.ts](supabase/functions/_shared/coachMind.ts) | **문항 한 곳**(MBTI 네 축을 수업 상황으로 · 피드백 순서 · 말투 · 이해가 빠른 모양 · 때 · 힘이 나는 것 · 힘 빠지는 말 · 힘들 때 · 자신 있는 것 · 키울 것 · 경력) + 지시문 셋(전달 설명서 · 공통 기준 · 코치님마다) + 답 검사(빠진 기준은 모델이 적은 `covers` 가 아니라 글로 — 기준 이름 낱말 · 숫자(‘두 그룹’ · ‘삼십 초’도 셈) · 지어낸 숫자(카드의 경력 숫자도 안 됨, 코치님 이름 숫자는 됨) · MBTI/성향 꼬리표(소문자 · 엔프피 같은 줄임말 · ‘F라서’) · 카드 답을 말로 옮기기(‘~를 좋아하신다고’) · 탓하는 말 · 카드 글 그대로 옮기기 · 길이 — 공통 기준에 이미 있는 낱말은 걸지 않음, 걸리면 걸린 곳을 붙인 `retryNote` 로 한 번 다시). 화면도 이 검사를 써서 손으로 고친 맞춤 글에 '확인해 주세요'를 띄운다 — 그래서 뒤를 보는 정규식(`(?<!…)`)은 쓰지 않는다(옛 사파리에서 앱이 안 뜸) — 테스트 src/lib/coachMind.test.ts(DB `_coach_mind_allowed()` 와 문항이 같은지도 본다) |
| [supabase/functions/coach-mind/](supabase/functions/coach-mind/index.ts) | 오삼코치 — `summary`(코치님 본인 · 서버 키로 내 카드만 읽고 summary 칸만 씀) · `core`(메모 → 공통 기준, 메모 저장 안 함) · `tailor`(공통 기준 + 코치님 → 맞춘 글, 카드는 서버 키로만 읽음. 대표님 = 카드 전부 · **지점장님 = '전하는 법' 답만**(`DELIVERY_IDS` — MBTI · 나는 이런 사람 · 힘들 때 · 직접 쓴 한 줄 · 전달 설명서는 지시문에도 넣지 않음: 맞춘 글을 보낸 분이 읽으니 모델이 모르는 것은 새지 않는다) · 모델 error 글은 돌려주지 않고 정해 둔 말만). 권한 = 부른 분 토큰으로 `coach_growth_me`(can_direct · board · 스위치 `coach_feedback_ai`). 모델 `CLAUDE_COACH_MIND_MODEL`(기본 claude-opus-5-5 · effort `CLAUDE_COACH_MIND_EFFORT` 기본 medium, API 오류면 채팅 모델) · 하루 6 · 20 · 80번 · `ai_usage_log.feature` coach_mind_summary · coach_mind_core · coach_mind_tailor · 점검 `action:"check"`(x-auto-key 만 — 지어낸 메모 · 카드로 `step` core / tailor 를 돌려 글 + 첫 시도에 걸린 까닭 `fails` 만, DB 에 안 씀, feature coach_mind_check 하루 40번 · verify_jwt 라 Authorization 에 anon 키도) |
| [src/lib/coachMind.ts](src/lib/coachMind.ts) · [src/services/coachMindService.ts](src/services/coachMindService.ts) · [src/components/coach153/CoachMind*.tsx](src/components/coach153/) | 코치님: 카드 부탁 → `MindFormSheet`(안내 · 동의 · 16문항 · MBTI 선택) → 내 성향 카드(전달 설명서) · 받은 피드백 `NotesList`(맞춘 글 · 오늘 해 볼 것 · 스스로 물어볼 것 · 원래 기준 · 확인했어요 · 한마디). 대표님 · 지점장님: 「코치님들」 맨 위 `MindTeamCard`(카드 n/m · 카드 부탁하기 · 피드백 쓰기 · 보낸 피드백 확인 n/m) → `NoteComposeSheet` 3단계(메모 → 공통 기준 고치기 → 코치님마다 확인 · 다시 만들기 · 고치기 · 기준 그대로) · 코치님 줄 `MindChip`(대표님은 눌러 `MindViewSheet`) |

- 보이는 범위: 카드 내용 = 본인 · 대표님(`_strategy_hq` = super_admin · admin 역할 — 11/05 에는 super_admin 계정 둘뿐. admin 역할을 새로 주면 그분도 카드를 보니 코치님 안내 '나 · 대표님'과 맞는지 먼저 본다). 지점장님 = 있음/없음만. 맞춘 글 · 한마디 = 받은 코치님 · 보낸 분 · 대표님(같은 지점의 다른 지시권자는 읽음/확인 숫자만). 카드는 **평가 · 급여 · 근무에 쓰지 않는다**(코치님 안내 · 대표님 카드 보기 아래에 같은 약속) — 이 약속을 바꾸려면 코치님께 다시 동의를 받는다.
- 보내기 · 부탁의 겹침 막기: `coach_note_send` 는 보낸 분마다 한 줄로(advisory lock) — 2분 안에 같은 기준을 다시 보내면(두 번 누름 · 받는 분 더하기) 같은 피드백에 이어 붙이고 이미 받은 분께는 다시 안 감. 맞춘 글(body)은 동의한 카드가 있는 코치님 몫만 남긴다(없으면 null = 기준 그대로). `coach_mind_ask` 는 부탁 기록을 먼저 잡은 분께만 알림(동시에 눌러도 한 번). 화면은 닫았다 열거나 기준을 고쳐 다시 맞추면 지난 답을 버린다(늘 올라가는 번호).
- 알림: 카드 부탁 '🧭 코치 성향 카드를 부탁드려요'(`&mind=1` → 카드 창이 열림) · 피드백 '💬 피드백이 왔어요 · 이름 직함' · 한마디 '💬 ○○님이 피드백에 답했어요'. 받은 피드백은 화면에 보이면 읽음, 확인은 단추.
- 개인정보 처리방침: 선택 항목 · 위탁(Anthropic) · 국외 이전에 '코치 성향 카드 · 피드백 정리' 추가(2026-11-05).
- 적용 (2026-11-05 15시 대표님 「적용해」): DB = MCP `apply_migration`(새 표 4 · 새 함수 13) → 되돌림 시험 ALL_OK(코치 저장 · 지점장 있음/없음만 · 대표님 카드 · 부탁 두 번째 0 · 카드 없는 분 body null · 2분 안 다시 보내기 = 같은 피드백 · 확인 + 한마디 알림 · 다른 지시권자 숫자만 · 다른 지점 안 보임 · 지우기) → 서버 파일 3개를 main 에 먼저(d6a700d · 0aa8a02, DB 어긋남 0) → Edge Function `coach-mind` v1 배포(main 0aa8a02 의 index.ts · _shared/claude.ts · _shared/coachMind.ts, verify_jwt true). 화면은 `preview/coach-mind` 로 먼저 → 대표님 「올려」(15:41)로 main 에 합침(6bf42d4 — 서버 파일 3개는 main 쪽 그대로 두고 rebase · 빌드 · 시험 968개). 오삼코치 비용(Opus 5.5 · effort medium, 11/05 점검 값): 공통 기준 정리 한 번 약 $0.04 · 코치님 한 분 맞춤 약 $0.04~0.05(5분 캐시가 맞으면 뒤 분들은 조금 싸다) — 앱 키(마이복서153 워크스페이스 · 월 $30 한도 · Max 크레딧 $200 에서)로 나간다.
- 점검 부르기(DB 에서): `net.http_post(…/functions/v1/coach-mind, headers: Authorization = Bearer <anon 키> · x-auto-key = internal_sync_config.auto_sync_key, body {action:'check', step:'core', text} 또는 {action:'check', step:'tailor', core, coach, profile, scope})` → `net._http_response` 에서 답(지어낸 카드만 — 실제 코치님 카드는 넣지 않는다).

### 지점 회의실(2026-10-29 부터 이름 153운영본부) — 지도진 가상 사무실 · 회의 채팅 (2026-10-27 1단계 · 「마이복서153 지점 회의실 상세 보고서」 추천안)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027140013_branch_office_room.sql](supabase/migrations/20261027140013_branch_office_room.sql) | `office_branches`(켠 지점 · 채널 `office:<지점 코드>`, 지금 선릉역점만) · `office_seats`(mgr · c1~c8 · x1~x4 자동 배정) · `office_status`(on · class · away, 3시간 지나면 on) · `office_meetings`(지점당 열린 회의 하나) · `office_meeting_attendees` · `office_messages`(chat · decision · system) · RPC `office_*` · realtime.messages 정책 2개(비공개 채널) |
| [src/services/officeService.ts](src/services/officeService.ts) | 훅 · 뮤테이션 (`["office", …]` 캐시) |
| [src/components/office/OfficePresenceBridge.tsx](src/components/office/OfficePresenceBridge.tsx) | App 전체 — 앱을 열면 Presence 로 접속(자리에 앉음), 화면을 끄면 30초 뒤 거둠. 바뀜 신호(broadcast `changed`, payload `{t}`)로 캐시 새로 읽기 · 쓰는 중 신호(broadcast `typing` `{u, off?}`, 내용 없음) 주고받기 |
| [src/lib/officePresence.ts](src/lib/officePresence.ts) · [src/lib/officeLayout.ts](src/lib/officeLayout.ts) | 접속 목록 · 쓰는 중(`useOfficeTyping` · `sendOfficeTyping`) 보관함 · 그림 위 자리 좌표(%) · 보이는 영역(`OFFICE_VIEW_ALL` · `OFFICE_VIEW_MEETING`) — 그림 `public/assets/office/office-153.webp` 를 바꾸면 좌표도 다시 |
| [src/pages/OfficePage.tsx](src/pages/OfficePage.tsx) · [src/components/office/](src/components/office/) | `/office` — 사무실 그림(OfficeScene) · 내 말풍선 · 회의 요약 카드(MeetingSummaryCard → 회의실 들어가기) · 회의 열기(OpenMeetingSheet) · 회의록(MinutesSheet) · 홈 「회의실 참석」 카드(OfficeEntryCard — 회의 중이면 바로 회의 화면) · 전체 메뉴 '지점 회의실'(`requires: "staff"` — 탭 「사무실 · 전략 회의」, 사무실이 없는 지점은 전략 회의만, 2026-10-29) |
| [src/pages/OfficeRoomPage.tsx](src/pages/OfficeRoomPage.tsx) · [src/lib/officeTalkLayout.ts](src/lib/officeTalkLayout.ts) | `/office/room` 회의 화면 (2026-10-27 대표님 "회의실 화면을 보면서 채팅 → 말풍선, 한 화면에") — 위 회의실 그림(크게 ↔ '사무실 전체') · 안건/정한 것 띠 · 채팅 · 입력창. 들어오면 참석, '나가기' = 내 자리로, '끝내기'(대표님 · 지점장). 채팅이 그 사람 머리 위 말풍선(4~9초) — 옆사람과 겹치면 최근 말이 머리 위, 먼저 한 말은 비키거나 위로 한 줄 + 이름표, 자리가 없으면 숨김(채팅엔 다 있음). 쓰는 사람 머리 옆 '…'. 키보드가 덮으면 visualViewport 높이로 줄여 그림 · 입력창이 같이 보이게(그때 안건 띠는 접음) |

- 들어오는 사람: 그 지점 지도진(`_strategy_branch_staff`) + 대표님(`_strategy_hq`). 회의 열기 · 끝내기 · 정한 것 = `_strategy_can_direct`(대표님 · 지점장). 회원 · 다른 지점은 서버(`_office_role`)와 채널 정책(`_office_can_topic`)이 막는다.
- 회의를 열면 지점 지도진 + 대표님에게 알림(`notifications` → 휴대폰 푸시, 링크 `/office/room` — 누르면 바로 회의 화면, 20261027185918). 회의 화면은 이 기기에 고른 지점에 회의가 없으면 회의가 열린 지점으로 연다. 신호에는 내용이 없고 화면이 함수로 다시 읽는다.
- 다른 지점을 켜려면 `office_branches` 에 한 줄(채널 이름 = `'office:' || branches.code`).
- 줌 · 구글 미트 링크 (2026-10-27 대표님 "그렇게하자" — 지도진끼리는 앱 음성 회의, 바깥 분이 함께하는 회의는 기존 줌 · 미트 링크): `office_meetings.video_url` · `office_set_meeting_link`(대표님 · 지점장, 넣거나 빼면 채팅에 안내 한 줄) · `_office_video_url`(초대 글을 통째로 붙여 넣어도 첫 링크만, zoom.us · zoom.com · meet.google.com 만 — 화면 [src/lib/meetingLink.ts](src/lib/meetingLink.ts) 와 같은 규칙) · `office_state` 의 `meeting.video_url` · `last_video_url`(대표님 · 지점장에게만, 회의 열기 칸 '지난번 링크 쓰기') — 20261027204015. 회의 화면 그림 아래 '줌 회의 들어가기'(`MeetingLinkBar`, 아이폰 앱은 앱 안 사파리 창) · 넣기/바꾸기는 '바꾸기' 또는 안건 띠를 펼쳐서.

#### 2단계 — 음성 · 카메라 회의 (2026-10-27 대표님 "다음 단계 작업하자" · Cloudflare RealtimeKit)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027191924_office_call.sql](supabase/migrations/20261027191924_office_call.sql) | `office_meetings.rtk_meeting_id`(회의마다 RealtimeKit 회의 하나) · `office_call_participants`(회의 · 사람마다 참가자 하나, 서버 키만) · `office_call_ticket`(권한 + 보일 이름 · 역할) · `office_call_end_check`(대표님 · 지점장) · `office_call_ready`(설정 끝났나) |
| [supabase/functions/office-call/index.ts](supabase/functions/office-call/index.ts) | 입장권 — 부른 사람 토큰으로 `office_call_ticket` → RealtimeKit 회의 · 참가자(다시 들어오면 입장권만 새로) → `{token, host}`. `{action:'end'}` = 모두 내보내고 닫기. 녹음 · 녹화 없음 |
| [src/lib/officeCall.ts](src/lib/officeCall.ts) | 음성 회의 보관함 — SDK(`@cloudflare/realtimekit`, 따로 내려받는 조각)는 '음성 참여'를 누를 때만. 다른 사람 소리는 `<audio>` 하나(누른 순간 켜 둬야 아이폰이 튼다 — `joinOfficeCall` 은 누를 때 바로) · 말하는 사람은 소리 크기(Web Audio) · 내 음성 회의 · 마이크 · 카메라는 Presence 표시에 싣는다(`setOfficeSelfMeta` → `calls`) |
| [src/components/office/OfficeCallBar.tsx](src/components/office/OfficeCallBar.tsx) | 회의실 그림 아래 막대(음성 참여 · 말하기 · 카메라 · 모두 마이크 끄기(대표님 · 지점장) · 나가기 · 소리 켜기) + 카메라 작은 화면(그림 왼쪽 아래, 누르면 크게, 내 화면은 거울) |

- 들어가면 마이크 · 카메라는 꺼진 채(체육관 음악 · 소음) — 본인이 '말하기' · 카메라를 눌러야 켜진다. 대표님 · 지점장은 다른 사람을 끌 수만 있다(`disableAllAudio(true)`, 켜는 건 본인).
- 사무실 그림: 음성 회의 중인 사람은 회의실 발밑 이름표 안에 헤드폰(듣는 중) · 마이크(켬), 말하는 동안 이름표가 민트색 + 캐릭터가 들썩(말하는 중은 음성방에 들어간 사람만 안다). 책상 자리는 어깨에 작은 표시.
- 회의 화면을 떠나거나 '나가기' · 회의가 끝나면 음성 회의에서도 나간다. '끝내기'는 음성방도 닫는다(kick-all → INACTIVE). 음성 회의 중이면 화면을 꺼도 자리를 지킨다.
- 비용 지킴이 (2026-10-27 대표님 "음성 회의 마무리"): 화면이 꺼진 채 10분 · 음성방에 혼자 10분이면 저절로 나온다(`OFFICE_CALL_IDLE_MS`, `officeCallIdleReason`, 20초마다 확인 — 숨은 탭은 1분쯤으로 느려져 10~11분). 화면에 돌아오면 다시 세고(돌아온 사람은 안 내보냄), 안내는 돌아왔을 때 10초 보인다. 화면이 꺼진 채 나왔으면 30초 뒤 사무실 자리에서도 일어난다(OfficePresenceBridge).
- 설정: API 토큰 = Edge Function 시크릿 `CF_REALTIME_TOKEN`(Cloudflare 계정 API 토큰 · Realtime Admin, 키 값은 채팅 · 코드 · 커밋 금지) · 계정 · 앱 번호(비밀 아님) = `internal_sync_config` `office_call` `{"account_id","app_id"}`(또는 시크릿 `CF_ACCOUNT_ID` · `CF_RTK_APP_ID`). 이 줄이 생겨야 `office_call_ready` 가 참 → 회의 화면에 음성 막대가 보인다. 프리셋은 대시보드에서 앱을 만들면 생기는 `group_call_host`(대표님 · 지점장) · `group_call_participant`(코치) — 이름이 다르면 함수가 앱 프리셋 목록에서 찾는다.
- 켬 (2026-10-27 21시): 토큰은 대표님이 Cloudflare 에서 만들어 Supabase 시크릿에 직접 넣음 · Cloudflare 대시보드 › RealtimeKit 앱 `myboxer153-office`(기본 프리셋 그대로, `group_call_participant` 는 대기실 없이 바로 입장) · `internal_sync_config.office_call` 넣음 → 대표님 계정으로 선릉역점 회의에 듣기만 들어가 확인(마이크 권한 창 안 뜸 · 나가면 헤드폰 표시 사라짐).
- 비용: 영상 프리셋이라 카메라를 안 켜도 참가자 1분 $0.002 (보고서 추정 월 $4 안팎). 개인정보 처리방침 위탁 표 Cloudflare 줄에 회의 음성 · 영상 연결 추가(녹음 · 녹화 안 함).

#### 3단계 — 회의록 → 전략 회의실 지시 · 못 오신 분 요약 (2026-10-27 대표님 "다음단계진행할까?")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027213757_office_minutes_strategy.sql](supabase/migrations/20261027213757_office_minutes_strategy.sql) | `office_meetings.summary · summary_by · summary_at · directive_id · recap_at · recap_to` · `office_recap`(요약 · 정한 것 수 · 지시 확인 n/n · `to_ack` · 못 온 분) · `office_save_summary`(대표님 · 지점장, 3줄까지) · `office_wrap_up`(끝난 회의, 회의마다 한 번 — 정한 것 → `strategy_items` 지시 한 건 + 못 온 분께 알림) · `_office_absent` |
| [supabase/functions/office-summary/](supabase/functions/office-summary/index.ts) | 오삼코치 3줄 요약 — 부른 사람 토큰으로 `office_recap`(host) · `office_messages` → Haiku 5.5(JSON 3줄, [summary.ts](supabase/functions/office-summary/summary.ts) 검사) → `office_save_summary(…, 'ai')`. 사람마다 하루 20번 · `ai_usage_log.feature='meeting_summary'` · body `{preview:true}` 는 저장 없이 줄만 |
| [src/components/office/OfficeMeeting.tsx](src/components/office/OfficeMeeting.tsx) | `EndMeetingSheet` — 끝내면서 함께 할 것(스위치 3개: 오삼코치 요약 · 정한 것 → 지시 · 못 오신 분 알림) → 요약(20초 넘으면 건너뜀) → 끝내기 → `office_wrap_up` · `MinutesSheet` — 요약(다시 정리) · 지시 '확인 n/n'(받는 사람은 '확인하러 가기') · 알림 현황, 끝낼 때 못 한 것은 여기서 보낸다 |

- 지시 모양(`strategy_items` kind directive): 제목 '회의에서 정한 것 · <회의>' · 상황 = 날짜 · 참석 · 시간 + 요약 줄 · 요청 = 정한 것 번호 목록 · 대상 = '<지점> 지도진 모두' · `data.meeting_id` → 지시 카드 '회의록 보기'(`/office?minutes=<회의>`). 확인 · 다음 날 09:00 재알림은 전략 회의실 그대로.
- 알림 하나씩: 못 온 분(지점 지도진 + 대표님 중 한 번도 안 들어온 분)은 '못 오신 회의 요약 · <회의>'(→ 회의록)만, 나머지 지점 지도진은 '📌 새 지시'만. 회의 화면 신호 `recap`.
- 개인정보 처리방침: 선택 항목 · Anthropic 위탁 줄 · 국외 이전에 '지점 회의실 회의 요약' 추가 (요약을 고를 때만 채팅이 간다, 앱에는 세 줄만).

#### 정기 회의 예약 (2026-10-27 대표님 "다음 작업 진행하자")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027225255_office_schedules.sql](supabase/migrations/20261027225255_office_schedules.sql) | `office_schedules`(매주 요일 `weekdays` 0=일 또는 하루 `once_on` · `at_time` · `remind_min` 0/5/10/30/60 · `video_url` · `next_at` · `skip_at` · 취소 `canceled_at`) · `office_meetings.schedule_id` · `office_schedule_list`(지점 지도진 + 대표님) · `_save` · `_skip`(다음 한 번 쉬기) · `_cancel` · `_open_now`(대표님 · 지점장) · 매분 cron `office-schedule-tick` → `office_schedule_tick()` · `office_me` 의 `offices[].next` · `office_state` 의 `meeting.scheduled` · `office_meetings_list` 의 `scheduled` |
| [src/components/office/OfficeSchedule.tsx](src/components/office/OfficeSchedule.tsx) · [src/lib/officeSchedule.ts](src/lib/officeSchedule.ts) | 사무실 '정기 회의' 칸(`ScheduleSection` — 1시간 안이면 '지금 열기') · 예약 시트(`ScheduleSheet` — 고칠 때 쉬기 · 취소) · 화면 글 · 날짜 계산(서버 `_office_next_at` · `_office_schedule_when` 과 같은 규칙, 한국 시간 고정) |

- 매분(`office_schedule_tick`): ① 시작 N분 전 지점 지도진 + 대표님께 'N분 뒤 지점 회의가 있어요'(→ `/office`) ② 시작 시각에 회의를 연다(opened_by = 예약한 사람, 아무도 참석 처리 안 함, '지금 지점 회의가 열렸어요' → `/office/room`, 줌 · 미트 링크 그대로) — 열린 회의가 있으면 건너뛰고, 6시간 넘게 열려 있던 회의(끝내기를 잊은 회의)는 닫고 연다 · 30분 넘게 늦은 차례(cron 멈춤)는 열지 않음 ③ 정기 회의로 열렸는데 1시간 동안 아무도 안 들어온 회의는 닫는다. 쉬는 차례는 알림 · 열기 모두 건너뛴다. 한 번만 하는 회의는 열린 뒤 `active=false`.
- '지도진에게 알리기'(새 예약은 켜짐 · 고치기는 꺼짐): 잡혔어요 · 바뀌었어요 · 쉬어요 · 다시 해요 · 취소됐어요 한 번씩(보낸 사람 빼고). 곧 시작하는 회의를 알리기로 잡으면 그 알림이 미리 알림을 대신한다. 지점마다 예약 10개까지. 화면 신호 `schedule`.
- 2026-10-27 MCP 로 적용할 때 SQL 에 `delete` 가 든 쿼리는 승인 창이 떠서 '취소'됐다(대표님 자리 비움) → 예약 취소는 지우지 않고 남기는 방식(`office_schedule_cancel`)으로 만들고 조각으로 나눠 적용. 시험은 되돌리는 트랜잭션(한 문장 안에서는 STABLE 함수가 앞 스냅숏을 본다 — 확인은 문장을 나눠서).

### 153운영본부 — 「근무」 탭 1단계 (2026-10-29 대표님 "지점 회의실이란 이름 153운영본부라고 이름 바꾸고 … 근무 시간 · 시급 자동계산" · Claude Docs 보고서 https://claude.ai/artifact/6drDZXLGs7L7VMaG6S4yDS)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261029101624_ops_hq_work.sql](supabase/migrations/20261029101624_ops_hq_work.sql) | `ops_branches`(켠 지점 — 선릉역점 · 칠금점) · `ops_staff`(근무자 카드: 형태 · 시급/월급 · 앱 계정 · 출근 확인 · 기간) · `ops_shift_rules`(요일 · 시작 · 끝 · 언제부터) · `ops_day_entries`(adjust · off · overtime · cover) · `ops_managers`(지점장 · 회계매니저, 대표님이 지정) · RPC `ops_me` · `ops_month` · `ops_candidates` · `ops_staff_save` · `ops_schedule_save` · `ops_entry_save` · `ops_entry_decide` · `ops_entry_cancel` · `ops_manager_set/list` |
| [src/lib/opsWork.ts](src/lib/opsWork.ts) | 인정 시간 계산 한 곳(서버는 자료만) — `computeDay` · `computeStaffMonth` · `scheduleSummary` · `laborNotices`(주 15시간 · 월 60시간) · 최저시급 |
| [src/services/opsService.ts](src/services/opsService.ts) · [src/components/ops/](src/components/ops/) | `OpsWorkTab`(관리: 합계 · 확인할 것 · 근무자 / 코치님: 내 근무 · 내 시간표 · 날짜별 · 내 요청) · `OpsStaffSheet`(이번 달 · 시간표 · 정보) · `OpsDaySheet`(인정 시간 · 쉰 날 · 수업 대타 · 연장 근무) · `OpsParts` |

- 이름: 전체 메뉴 · 머리글 「지점 회의실」 → **「153운영본부」**. 탭 사무실 · 전략 회의 · **근무**(`/office?tab=work`, 알림 링크도 여기) · **일정**(`/office?tab=plan`, 2026-11-02 — 아래 「일정」 탭) · **매출**(`/office?tab=sales`, 2026-11-03 — 아래 「매출」 탭, 돈을 보는 분만) · **매뉴얼**(`/office?tab=manual`, 2026-11-11 — 아래 「매뉴얼」 탭, 코치진 모두). 근무 탭은 `ops_me` 가 정한다 — 관리하는 지점(manage)이 있거나 내 근무자 카드(mine)가 있는 분. DB 가 없거나 둘 다 비면 탭이 안 보인다.
- 대표님 규칙(10-29): 출근 = 입구 얼굴 인식(`staff_duty_logs` — 앱 계정 또는 이름으로 맞춤), 안 찍은 날 0시간(누락) · 퇴근 = 시간표 끝 시각 자동 · 일찍 감 · 늦게 옴 = 지점장 · 대표님이 그날 인정 시간을 고침(지각은 표시만, 10분) · 연장 = 코치 신청 → 대표님만 승인 · 수업 대타 = 코치 요청 → 지점장 · 대표님 승인(PT 대타 없음) · 얼굴 출근 단말이 없는 지점은 근무자 카드 '시간표대로 자동'(`checkin_required=false`).
- 보이는 범위 (2026-10-29 대표님 "코치님들이 다른 코치님들 일하는 시간이랑 버는 돈 못 보게, 본인 자료만" → 「지점장은 돈만 숨기기」 · 「본인 금액도 보여주기」, 20261029171500):
  - 일반 코치님: `ops_month` 가 **본인 카드만** 보낸다(다른 사람 근무 · 시간 · 돈 없음, 대타 고르기용 동료 이름만). 본인 시급 · 월급은 보낸다 → 코치 화면 '이번 달 예상(주휴 · 공제 전)' · PT 위탁 코치는 본인 PT 수당(`ops_pt_month` 가 본인에게만 수당표).
  - 지점장(`ops_managers` title 지점장): 지점 전체 근무 관리(시간 고치기 · 대타 승인 · 시간표 · 근무자 추가)는 그대로, **남의 시급 · 월급 · 기본급 · PT 수당은 못 본다**(본인 것만). 근무자 카드를 저장해도 급여 칸은 서버가 그대로 둔다(`ops_staff_save`), 지점장이 새로 넣은 근무자는 급여가 비어 있다 → 대표님이 넣는다.
  - 돈 = 대표님(`_strategy_hq`) + 대표님이 지정한 회계매니저(`ops_managers` title 회계매니저)만 — `_ops_can_see_pay`, 응답 `pay`.
  - 메모는 관리자에게만. 관리 = 대표님 또는 `ops_managers` — 앱 권한 'branch_manager' 만으로는 안 된다(선릉은 코치님 몇 분에게도 앱 관리 권한이 있다). 근무자 실명 · 시급 등 실자료는 저장소에 넣지 않는다(DB 에서만).
- 적용 (2026-10-29 대표님 「승인할게」 — MCP 승인 창이 휴대폰에 안 떠 크롬 SQL 편집기로, GitHub 파일 sha256 확인 뒤): 표 5 · 함수 15. 첫 자료는 DB 에서만 넣음(저장소 밖) — 선릉 근무자 8 · 칠금 1 · 시간표(10/1부터) · 지점장 2(선릉 · 칠금). 시간표를 모르는 분은 비워 둠(지점장이 앱에서). 공휴일은 아직 자동이 아니다 — '쉰 날'로 고치거나 다음 단계 '지점 쉬는 날'.
- 2단계(남은 일): 월 마감(1일~말일 확정) · 주휴수당 · 공제 · 임금명세서(코치님은 앱에서) · 세무 주임님께 매달 5일 문자(LMS 내려받기 링크) · 주민번호 · 계좌 암호화 저장 · 회계매니저 지정 화면. (근로계약서는 2026-11-03 아래 「계약서」)

#### PT 관리 (2026-10-29 대표님 "PT도 관리하자 브로제이랑 연동해서 … PT를 소진하면 어떤 사람 PT를 했고 몇 회 남았는지 · 월급 정산할 때 같이")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261029130027_ops_pt.sql](supabase/migrations/20261029130027_ops_pt.sql) | `ops_pt_rates`(지점 · 팀 정원 · 수업권 횟수 → 1회 수당, 금액은 DB 에만) · `ops_pt_events`(차감 기록) · profiles 트리거 `ops_pt_capture`(pt_remaining 이 같은 수업권에서 줄면 used, 수업권이 남은 채 사라지면 ended → 확인) · `ops_pt_month` · `ops_pt_event_set` · `ops_pt_event_add` |
| [src/lib/opsPt.ts](src/lib/opsPt.ts) | 수업권 이름 → 1:1 · n인 팀 · 횟수 · 1회 수당(팀은 차감된 팀원 1명당 = 팀 1회 ÷ 정원) · 3.3%(소득세 3% · 지방세 = 소득세의 10%, 10원 미만 버림) |
| [src/components/ops/OpsPtPanel.tsx](src/components/ops/OpsPtPanel.tsx) | 근무자 카드 'PT' 탭(관리자: 확인 · 빼기, 수당은 `showPay` = 대표님 · 회계매니저) · 코치 화면 'PT'(보기 + 내 PT 수당) |

- 원본: 브로제이 PT 수업권 → 153OS 워커(회원마다 하루~이틀에 한 번) → sync-pt-members(매시 40분) → `profiles.pt_remaining`. 차감 날짜 = 앱이 알아챈 날이라 하루 이틀 늦을 수 있다(관리자가 날짜를 고칠 수 있음). 적용 전 차감은 남아 있지 않다(그날부터 쌓임).
- 담당 코치 = 그 지점 PT 위탁 코치(`ops_staff.pt_freelancer`)가 한 명이면 자동, 아니면 비워 둔다. PT 는 근로가 아니라 위탁(3.3%) — 계약서 개정판 양식 C(Claude Docs https://claude.ai/artifact/8PMewu4bGcPcQzsh8vTVph).

#### PT 기록 1단계 — 코치가 수업 1건마다 기록 · 출석 · 차감과 맞춰 보기 (2026-11-11 대표님 "이런 일이 발생하는 일이 없도록 마이복서153에 PT 기록을 하게" → 「추천대로 진행하자」 · Claude Docs 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261111184433_ops_pt_record.sql](supabase/migrations/20261111184433_ops_pt_record.sql) | 새 표 4 — `ops_pt_settings`(지점마다 켜기 · 알림 · 시작일) · `ops_pt_sessions`(수업 기록: lesson 수업 · noshow 노쇼 · late_cancel 당일취소(이 셋은 차감 1회) · moved 일정 변경 · coach_cancel 코치 사정 · self 개인 운동 / `uses` 연속 수업 차감 수 / `late` 자정 넘긴 기록 → 지점장 확인 / 지우기 = `void` + 사유) · `ops_pt_member_labels`(PT 이름표) · `ops_pt_notices`(알림 한 번만) · RPC `ops_pt_record`(기록 · 차감 · 출석 · 회원 — 금액 없음) · `ops_pt_session_save` · `ops_pt_session_void` · `ops_pt_session_review` · `ops_pt_member_label_set` · `ops_pt_setting_set`(대표님만) · 예약 `ops-pt-entry-tick`(1분 — PT 회원 입장 → 코치 알림) · `ops-pt-nightly`(22:00 KST 밤 요약) · `ops-pt-overdue`(10:00 KST 이틀 넘은 건 → 대표님 · 지점장) |
| [src/lib/opsPtRecord.ts](src/lib/opsPtRecord.ts) · [opsPtRecordSample.ts](src/lib/opsPtRecordSample.ts) | 짝짓기 · 판정 한 곳(서버는 자료만) — `matchPtRecord` · `ptCounts` · `ptTodayList` · `ptMonthCompare` · `ptDraftError`(서버와 같은 말) / 예시 자료(지어낸 회원) · 예시 화면에서 눌러 보기 `applyPtDemo`. 시험 opsPtRecord.test.ts(10월 사례 모의 포함) |
| [src/services/opsPtRecordService.ts](src/services/opsPtRecordService.ts) · [src/components/ops/OpsPtRecord.tsx](src/components/ops/OpsPtRecord.tsx) | 코치 화면 맨 위 「오늘 PT」(입장한 PT 회원마다 [개인 운동] [수업 완료] · [안 온 회원 기록] · 확인 필요 · 최근 기록) · 근무자 카드 'PT' 탭 위쪽(차감 기준 / 기록 기준 횟수 · 확인 필요 · 달별 수업 기록 · 대표님 켜기 · 끄기) · 「근무」 탭 '확인할 것'에 코치별 'PT 기록 확인 필요 n건' |

- 왜: 10월 정산에서 수업 뒤 차감 누락 · 뒤늦은 보정 · 사유 없는 차감 · 출석 체크 없는 수업 · 옮긴 수업을 두 번 셈이 한꺼번에 나왔다. 브로제이에는 '남은 횟수'만 남아 수업 · 노쇼 · 당일취소를 가를 수 없다 → **수업 사실(누가 · 언제 · 무엇)의 정본은 앱, 남은 횟수의 정본은 브로제이**. 차감은 지금처럼 코치가 브로제이에서 한다 — 앱은 빠진 것을 알려 준다.
- **1단계는 기록 · 알림 · 대조까지 — 수당 기준은 그대로(차감 기록 `ops_pt_events`)**. `ops_pt_month` · `_ops_pt_capture` · `ops_pt_event_set/add` 는 건드리지 않았다. 2단계(12월 수업분부터 「기록 + 차감이 둘 다 있는 수업만」 수당 · 회원 차감 알림 · 월 마감 · 명세서) · 3단계(PT 일정 · 단체 PT 수업 기록 · 기록 직후 수업권 다시 읽기 · 칠금점)는 보고서 「제작 순서」.
- 대표님 결정(11/11 — 보고서 「대표님이 정해 주실 것」 1~7 모두 추천안): 전날까지 변경은 무료 · 당일취소 · 노쇼 = 차감 1회 · 수당 1회 / 기록 마감 = 수업 당일 자정(넘긴 기록 `late` 는 지점장 확인 뒤 인정 — 관리자가 적으면 확인된 것으로) / 출석 체크 없는 수업 = 사유(문 열림 · 체크 못 함 · 그 밖)를 고르면 인정, 한 달 3회 넘으면 표시(`PT_NO_ENTRY_MONTH_LIMIT`) / 회원 알림은 앱 알림 먼저(2단계) / 단체 PT = 수업 1회당 고정(3단계) / 월 마감 3일 코치 확정 · 4일 승인 · 5일 세무 · 10일 지급(2단계).
- 짝짓기(화면 `matchPtRecord`): 회원마다 차감(앱이 알아챈 날 `work_date`, 수당에 세는 것만)을 이른 것부터 ① 그날에서 이틀 앞까지의 기록 중 가장 이른 것 ② 없으면 더 오래된 기록 = 늦은 차감(보정 — 원래 수업한 달 기록으로 센다) ③ 그래도 없으면 「사유 없는 차감」(과차감 의심). 기록보다 앞선 차감은 그 기록과 짝짓지 않는다. 기록은 이틀까지 '차감 확인 중', 넘으면 「차감 대기」. 시작일(`started_on`) 앞 차감은 안 보고, 시작 14일 앞까지의 기록은 적을 수 있다(시작 뒤에 잡힌 차감을 설명하려고 — 짝이 없어도 묻지 않는다). 수업권이 끝나 지점장 확인을 기다리는 차감(`ended` · `check`)이 있으면 코치의 차감 대기로 세지 않는다. 서버 알림(밤 요약 · 이틀 넘은 건)은 개수만 견주는 어림(`_ops_pt_balance`) — 화면 숫자가 정본이다.
- 확인 필요: 출석 체크 없음(사유 없음) · 사유 없는 차감 → [기록하기](날짜를 꼭 고른다) · 기록 없는 입장(PT 회원이 들어왔는데 그날 기록이 없음) → [개인 운동] [수업] · 차감 대기 · 옮긴 날 기록 없음 · 늦은 기록(관리자 [확인]). 코치 숫자에는 본인이 할 것만, 관리자 숫자에는 늦은 기록 확인까지.
- 출석 표(`attendance_logs`)에는 트리거를 달지 않았다(출입 · 출석 보상은 보호 영역) — 입장 알림은 1분 예약이 최근 20분 출석을 훑고 `ops_pt_notices` 로 회원 · 날짜마다 한 번만 보낸다. 알림 링크 `/office?tab=work&pt=today`(코치 화면이 「오늘 PT」로 내려온다).
- PT 이름표: 앱 이름이 별명인 회원이 많아 코치가 알아보기 어렵다 → 기록 시트의 연필로 붙인다(코치 · 지점장 · 대표님). 이 화면과 입장 알림에서만 쓰고 회원에게는 안 보인다. 실명은 DB 에만(저장소 · 시험은 지어낸 이름).
- 보이는 범위: 코치 = 본인 기록 · 본인 담당 차감 · 지점 PT 회원(이름 · 수업권 · 남은 횟수 · 전화 끝 4자리 — `ops_pt_month` 와 같은 범위) / 지점장 · 대표님 = 지점 전체 / 금액은 이 화면에 없다. 표는 anon · authenticated 모두 막고 함수로만.
- 켜기: 지점마다 `ops_pt_settings` — 대표님이 근무자 카드 'PT' 탭의 「이 지점에서 켜기」(= `ops_pt_setting_set`, 시작일 = 그날). 꺼진 지점은 화면 · 알림 모두 조용하다. 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 꺼진 것으로 본다.
- 예시 화면: `/office?tab=work&demo=1` — 지어낸 회원으로 코치 · 관리자 화면을 눌러 볼 수 있다(서버를 부르지 않고 이 기기 안에서만 바뀜). 「근무」 탭 맨 위에 '코치 화면 / 관리자 화면' 예시가 뜨고(어느 계정으로 들어와도), 관리자는 '확인할 것' · 근무자 카드 PT 탭에서도 예시가 보인다. 근무 탭이 없는 코치진(옛 DB 를 보는 미리보기)에게는 예시만 따로 보인다(OfficePage `ptDemoOnly`).
- 단체 PT · 앱에 이어지지 않은 회원은 이름만으로 기록할 수 있다(차감 대조는 지점장이 `ops_pt_event_add` 로 직접 넣은 같은 이름의 차감과).
- 시험: 로컬 Postgres 16 에 운영 정의를 본뜬 뼈대 + 이 마이그레이션(두 번 적용) → 73개(꺼짐 · 켜기는 대표님만 · 회원/anon/비PT 근무자 막힘 · 코치는 본인 것만 · 같은 날 차감 기록 하나 · 개인 운동 ↔ 수업 · 늦은 기록 · 미래 날짜 · 옮긴 날짜 · 출석 없는 수업 사유 · 연속 2회 · 이름표 · 입장 알림 중복 없음 · 밤 요약 · 이틀 넘은 건) / vitest 28개 — 10월 사례 모의: 10월 말 「차감 대기 3 · 출석 체크 없음 3」, 보정 뒤 「사유 없는 차감 5」(기록이 있었다면 늦은 차감 3 + 사유 없는 차감 2).
- **적용 (2026-11-11 대표님 「올려」 → 「적용해」)**: 미리보기 `preview/pt-record` 뒤 main 에 합침 · 운영 DB 는 MCP `apply_migration`(새 표 4 · 새 함수 12 · 예약 3). 로컬 기준본(저장소 파일을 그대로 올린 Postgres)과 함수 본문 · 표 · 색인 · 제약 · 권한 · 예약 지문이 같음을 확인하고, 되돌림 시험(DO 블록 예외)으로 대표님 · PT 코치 · 회원 세 계정을 확인 — 꺼진 지점은 저장 막힘 · 켜기는 대표님만 · 코치는 PT 회원 · 본인 차감만(금액 없음) · 같은 날 겹침 막힘 · 출석 없는 수업은 사유 · 늦은 기록 · 이름표 · 회원은 읽기 · 지우기 막힘 · 알림 함수 3개 정상. **아직 어느 지점도 켜지 않았다**(화면 · 알림 모두 조용) — 선릉역점 켜기 · PT 이름표 · 코치 안내는 대표님 결정 뒤. 켤 때 시작일은 **켜는 날**로(앞 날짜로 잡으면 그사이 차감이 모두 「사유 없는 차감」으로 뜬다).

#### 「일정」 탭 — 팀원이 스스로 넣는 일정 · 대표님 팀 일정판 (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리 … 내가 팀원들의 스케줄을 한눈에")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261102135002_ops_team_plans.sql](supabase/migrations/20261102135002_ops_team_plans.sql) | `ops_plans`(종류 class · pt · work(화면 '업무') · out · off · personal · 한 번(여러 날 두 달까지) 또는 매주 `repeat_weekdays` · `until_on` · '이 날만 빼기' `skip_dates` · 하루 종일/시각 · `private` · 지우기 = `deleted_at`) · `_ops_plan_team`(지도진 + 앱 계정이 이어진 근무자 카드) · `_ops_plan_can_view_all`(대표님 · 그 지점 `ops_managers`) · `_ops_plan_branches` · RPC `ops_plans_week`(한 주: members · plans · 「근무」 시간표 shifts · 승인된 쉰 날 offs · 관리자에게 7일 recent) · `ops_plan_save`(`only_date` = 반복의 그날 하나만 바꾸기) · `ops_plan_skip` · `ops_plan_remove` |
| [src/lib/opsPlans.ts](src/lib/opsPlans.ts) | 반복 펼치기(`occursOn`) · 하루 정리(`dayItems` — 시간표 + 일정, 승인된 쉰 날이면 그 지점 시간표 대신 '쉰 날') · 팀 한 줄(`daySummary`) · 넣기 검사(`draftError`, 서버와 같은 말) · 화면 글 |
| [src/services/opsPlanService.ts](src/services/opsPlanService.ts) · [src/components/ops/OpsPlanTab.tsx](src/components/ops/OpsPlanTab.tsx) · [OpsPlanSheet.tsx](src/components/ops/OpsPlanSheet.tsx) | `/office?tab=plan` — 관리자: 「팀 일정」(사람 × 월~일 색 막대 일정판 · 고른 날 누가 무엇을 · 최근 바뀐 일정) / 「내 일정」 · 코치님: 내 일정만(날마다 + · 매주 반복 목록) · 넣기 · 고치기 시트(반복은 '이 날만 / 매주 전체') |

- 보이는 범위: 코치님은 **본인 일정만**(서버가 본인 것만 보낸다 — 10/29 근무 시간 비공개와 같은 결). 팀 전체 = 대표님 + 그 지점에 지정된 관리자(`ops_managers` 지점장 · 회계매니저 — 앱 권한 branch_manager 만으로는 아님). 관리자에게는 앱 계정이 없는 근무자 카드도 'staff:<id>' 줄로(시간표만).
- '개인' 일정만 '대표님 · 지점장님께는 시간만 보이기'(`private`) — 관리자에게 제목 · 메모가 안 가고 '개인 일정'으로만. 다른 종류는 서버가 `private=false` 로 저장한다.
- 일정은 근무 시간 · 급여와 따로다(휴무 일정을 넣어도 시간표 · 인정 시간은 그대로) — 쉰 날 인정 · 대타 · 연장은 「근무」 탭. 일정은 본인만 고치고 지운다(관리자도 남의 일정은 못 고침). 알림은 없다(관리자는 '최근 바뀐 일정'으로 본다).
- 탭은 코치진(전략 회의와 같은 기준) 또는 근무자 카드가 있는 분에게 보인다 — 탭이 넷이면 글씨 `text-label`. 앱 검색 '팀 일정 · 내 일정'(staffOnly · 일정 · 스케줄).
- 적용(2026-11-02 MCP `apply_migration` — 새 표 1 · 새 함수 7): 되돌림 시험(DO 블록 예외)으로 코치 · 칠금 코치 · 선릉 지점장 · 대표님 네 계정을 확인 — 코치는 본인 1명 · 다른 지점 일정 0 · 남의 일정 고치기/지우기 막힘 · 지점장은 팀 10명(앱 계정 없는 근무자 1 포함) · 개인 일정 가림.

#### 계약서 — 근로계약서 · PT 업무위탁 계약서 앱 서명 (2026-11-03 대표님 "코치님들 계약서 작성해야하는데 계약서 작성 기능 만들어줘" → 「앱에서 서명」 · 「표준 양식으로」)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261103191354_ops_contracts.sql](supabase/migrations/20261103191354_ops_contracts.sql) | `ops_employers`(지점마다 사업체명 · 대표자 · 사업자번호 · 주소 · 전화 · 대표님 서명 그림 — 대표님만 `ops_employer_save`) · `ops_contracts`(보낸 글 `doc` 을 얼리고 지문 `doc_hash` = sha256(doc::text) · sent → signed / void · 서명하면 봉인 `sealed_hash`) · RPC `ops_contract_list`(근무자 카드 탭 — 사업주 · 계약서 · 지점의 마지막 계약 값 · PT 수당표) · `ops_contract_branch`(근무자 목록 표시) · `ops_contract_mine` · `ops_contract_get`(코치님이 처음 열면 viewed_at) · `ops_contract_send` · `ops_contract_sign`(본인 계정 또는 `p_in_person` 대면) · `ops_contract_void` · `ops_contract_delivered` |
| [src/lib/opsContract.ts](src/lib/opsContract.ts) | 미리 채우기(근무자 카드 · 시간표 → 근로일 표 · 휴게는 하루 근로 4시간이면 30분 · 8시간이면 1시간을 구간 사이 시간까지 쳐서 모자랄 때만 구간 안에 — `autoBreakMin`, 2026-11-04 예전엔 가장 긴 구간 하나로 따져 사이에 쉬어도 30분을 또 뺐다 · 시간을 바꾸면 기본 휴게가 따라가고 직접 고른 휴게는 그대로 `daySetSegs`) · 글 만들기(고용노동부 표준근로계약서 기간 없음 / 기간 있음 / 단시간(주 40시간 미만) · 업무위탁) · 점검(17조 필수 항목 · 그해 최저시급 · 월급 환산 · 주휴일 · 휴게 · 특약의 위약금 · 임의 공제 · 퇴직금 · 위탁의 근로자성) · 근무자별 상태 |
| [src/lib/imagePdf.ts](src/lib/imagePdf.ts) · [src/lib/contractPdf.ts](src/lib/contractPdf.ts) | PDF — 화면 밖에 A4 폭(794px)으로 그려 html2canvas(누를 때만 내려받는 조각)로 뜬 뒤 조항 경계에서 쪽 나누기 → JPEG → 직접 만든 PDF(라이브러리 없음). 휴대폰은 공유(카톡 · 파일), 컴퓨터는 내려받기 |
| [src/components/ops/](src/components/ops/) | `OpsContractPanel`(근무자 카드 '계약서' 탭 — 돈을 보는 분만) · `OpsContractEditor`(채우기 → 미리 보기 → 서명해서 보내기) · `OpsContractSheet`(보기 · 코치님 서명 · 대면 서명 · 사본 준 것 · 무효 · PDF) · `OpsContractDoc`(화면 / PDF 두 모양, 늘 흰 종이) · `OpsSignaturePad`(손가락 서명 → 잘라낸 투명 PNG) · `OpsEmployerSheet`(사업주 정보 · 서명 그리기 · 도장 사진) |

- 흐름: 대표님(또는 회계매니저) — 근무자 카드 › 계약서 › 쓰기 → 미리 보기 → '서명해서 보내기'(대표님 서명이 들어간 채로) → 코치님 알림 '📝 근로계약서가 도착했어요'(`/office?tab=work&contract=<id>`) → 코치님은 「근무」 탭 맨 위 카드 → 읽고 동의 · 이름 · (주소 · 연락처 선택) · 손가락 서명 → 대표님께 '✍️ ○○님이 계약서에 서명했어요'. 앱 계정이 없는 분은 '지금 여기서 서명 받기'(관리자 휴대폰에서 직접) → '코치님께 사본을 주세요'(PDF · 종이 → `ops_contract_delivered`, 근로기준법 17조 교부).
- 보이는 범위: 계약서에 시급이 있어 **돈을 보는 분(`_ops_can_see_pay` — 대표님 · 회계매니저)과 받은 본인만**. 지점장은 계약서 탭 · 표시가 없다. 사업주 정보 · 서명은 대표님(`_strategy_hq`)만 바꾼다(회계매니저는 그 서명으로 보내기만).
- 보낸 계약서는 고칠 수 없다 — 다시 보내면 같은 사람 · 같은 종류의 서명 전 계약서는 저절로 무효('새 계약서로 바꿈', 목록에서 숨김). 서명한 계약서를 무효로 할 때는 사유가 있어야 하고 받은 분께 알림. 지우는 함수는 없다(근로관계 서류 3년 보관, 42조 — 앱 계정을 지워도 남음).
- 「근무」 탭(돈을 보는 분): 근무자 줄 '계약서 없음 · 서명 대기' + '확인할 것'에 계약서 없음 · 서명 기다림 · 사본 아직 → 누르면 근무자 카드가 계약서 탭으로. 필요한 계약서 = 근로(아르바이트 · 수습 · 4대보험) · 위탁(프리랜서) · 둘 다(PT 따로 하는 코치) · 없음(무급 도우미). 끝난 날이 지난 계약서는 없는 것으로 친다.
- 양식에 '수습 감액'은 넣지 않는다(1년 이상 계약 + 단순노무 아님일 때만 가능 — 수습기간에도 임금 같음). 위탁 계약서는 '매달 정한 금액' · 시간표대로 일하는 프리랜서면 근로자성 안내(대법원 2004다29736) — 꾸미는 법은 안내하지 않는다.
- 개인정보 처리방침(2026-11-03): 목적 · 선택 항목(근로계약서 — 계약 내용 · 손글씨 서명 · 적은 경우 주소 · 연락처) · 보유 기간(근로관계 끝난 뒤 3년) 추가.

#### 「매출」 탭 — 일반 수강권 · PT 나눠 보기 (2026-11-03 대표님 "153운영본부에 매출 자세히 알 수 있도록 · 일단 일반 수강권 매출과 PT 매출을 분리해서")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261103223654_ops_sales_scope.sql](supabase/migrations/20261103223654_ops_sales_scope.sql) | `ops_sales_scope()` — 매출을 볼 수 있는 지점(켠 `ops_branches` 중 `_ops_can_see_pay` = 대표님 · 회계매니저). 비면 탭이 없다 |
| [supabase/functions/ops-sales/](supabase/functions/ops-sales/index.ts) | 부른 사람 토큰으로 `ops_sales_scope` 다시 확인 → 153OS(`OS_SERVICE_KEY`) 브로제이 `sales_entries` · 다짐 `dagym_sales` + 들어온 시각(`broj_sync_runs` · `dagym_batches`) + 앱 `payment_orders`(paid · 항목) → 고른 달 합계 · 줄(2,000건까지) · 최근 n달(기본 6). 나누기 규칙은 [logic.ts](supabase/functions/ops-sales/logic.ts) 한 곳(테스트 src/lib/opsSales.test.ts). 답은 늘 200 `{ok, …}` / `{ok:false, code}` · 점검은 x-auto-key 로 합계만(이름 · 줄 없음) · 읽기 전용 |
| [src/components/ops/OpsSalesTab.tsx](src/components/ops/OpsSalesTab.tsx) · [src/lib/opsSales.ts](src/lib/opsSales.ts) · [src/services/opsSalesService.ts](src/services/opsSalesService.ts) | `/office?tab=sales` — 지점 · 달 → 이 달 매출(환불 뺀 금액) · 일반 수강권 / PT 두 칸(금액 · 건수 · 몫 · 환불) · 그 밖 한 줄(일일권 · 락카/운동복 · 용품 · 기타) · 최근 6개월 막대(누르면 그 달) · 매출 내역(전체 · 일반 수강권 · PT · 그 밖 · 환불 거르기, 날짜별, 40건씩) |

- 나누기: 브로제이 '수강권' 중 이름에 PT 낱말 · 퍼스널 · 피티 = PT, 일일 · 원데이 = 일일권, 나머지 = 일반 수강권 · '물품' 중 락커 · 운동복 = 락카/운동복, 나머지 = 용품 · '기타' = 기타. 다짐 general 도 같은 이름 규칙(rentalLocker · rentalSportsWear = 락카/운동복, etc = 용품, 양도 = 뺌, 나눠 낸 결제는 sale_id 로 한 건). 환불(음수 · refunded)은 그 묶음 금액에서 뺀다.
- 앱 결제: 브로제이에 같은 사람(띄어쓰기 무시) · 같은 금액이 앱 결제 하루 전 ~ 사흘 뒤에 있으면 빼고, 없을 때만 더한다 — 줄에 '앱 결제' 표시 · 카드 '앱 결제 N건은 브로제이에 없어 더했어요'.
- 늦음: 브로제이 매출은 153OS 가 매일 00:05 KST 에 전날까지 · 칠금 다짐 매출은 예약 작업 「칠금점 다짐 회원 동기화」가 돌 때 — 카드에 '브로제이/다짐 ○월 ○일 ○○:○○ 기준'.
- 다짐(칠금): 153OS `dagym_sales` · `dagym_batches` 는 서버 키(service_role)로도 직접 못 읽게 막혀 있다(표 권한 그대로 둔다) → 153OS 함수 `ops_sales_dagym(p_branch_id, p_from, p_to)`(SECURITY DEFINER · anon/authenticated 막음 · rows + synced_at)로만 읽는다 — 2026-11-04 153OS 에 만듦(대표님 '만들어'). 함수가 없거나 막히면 다짐 지점만 DAGYM_NOT_READY('다짐(칠금점) 매출 연결을 준비하고 있어요'), 브로제이 지점은 그대로. 다짐 자료는 예약 작업이 돈 시각까지 — 10/30 오후 ~ 11/3 은 예약이 크롬에 닿지 못해 비었다가 11/4 06:02 따라잡기로 채웠다(아래 「칠금점 회원」).
- **순이익 (2026-11-04 대표님 "153가계부랑 연동해서 선릉역점 통장내역 올리면 순이익도 계산하자" → 「가계부에 올리기」 · 「매출 − 사업 비용」)** — [20261104004636_ops_branch_costs.sql](supabase/migrations/20261104004636_ops_branch_costs.sql) `ops_branch_costs`(지점 · 달 · 항목 키 · 이름 · 금액 · 건수) · `ops_branch_cost_months`(올린 정보 — 매장 · 매장 없음 · 뺀 항목 · 합계 · 누가 · 언제) · `ops_costs_save(p_branch, p_months, p_meta)`(보낸 달은 통째로 바꿈) · `ops_costs(p_branch, p_from, p_to)` · `ops_costs_clear` — 모두 `_ops_can_see_pay`(대표님 · 회계매니저). 화면 [OpsProfitCard](src/components/ops/OpsProfitCard.tsx)(매출 카드 바로 아래 '○월 순이익' = 매출 − 비용 · 매출의 % · 항목 막대 6개 + 그 밖 · '다시 올리기', 비용이 없는 달은 '가계부 CSV 올리기') · [OpsCostImportSheet](src/components/ops/OpsCostImportSheet.tsx) · 최근 6개월 막대 아래 '순이익 ○만 원'. 규칙은 [src/lib/opsCosts.ts](src/lib/opsCosts.ts)(테스트 opsCosts.test.ts).
  - 153가계부(153-gagyebu.pages.dev)는 **10/29 판부터 기록을 그 기기 안에만** 둔다(CSP connect-src 'self', '어디에도 보내지 않아요') → 서버가 가계부를 읽을 수 없다. 그래서 가계부 › 설정 › '엑셀용 CSV'(exportCsv: 날짜 · 구분 · 카테고리 · … · 귀속 월 · 고정비 · 장부 · 매장 · 통장 …) 파일을 매출 탭에 올리면 **브라우저가** 사업 장부 · 고른 매장(지점 낱말 '선릉' · '칠금'이 든 매장을 먼저 고름 · 매장을 하나도 안 적은 장부면 매장 없는 지출)의 '지출' − '돌려받음'을 달(귀속 월 우선) · 항목(가계부 카테고리 키 bpay · brent · bsupply · butil · bfee · card · epay · tax …)별로 더해 **합계만** 저장한다. 이동 · 수입 · 헌금 · 개인 장부 · 다른 매장은 빼고, 저축 · 투자는 늘, 대출·금융은 처음엔 뺀다(원금은 비용 아님 — 칩으로 넣을 수 있음). 처음 고르는 달 = 지난달까지 최근 12개월(이번 달은 덜 차서 고르면 넣음). 파일 · 거래는 서버로 안 간다. UTF-8(가계부) · 엑셀에서 다시 저장한 EUC-KR 둘 다 읽는다.
  - PC 폴더 `앱 자료\153-gagyebu` 는 **10/16 판**(site 버전 20261016175954)이고 라이브는 **10/29 판**(sw.js VERSION 20261029162451 · 사업 카테고리 b* · 서버 연결 없음) — 그 폴더의 bat 으로 배포하면 예전 판으로 되돌아간다. 가계부에 '153운영본부로 보내기' 단추를 붙이려면 10/29 판 원본부터 찾는다(라이브 파일은 내려받을 수 있음).
  - 적용 (2026-11-04 대표님 「올려」 — MCP `apply_migration`, main f0001fe): 되돌림 시험(DO 블록 예외)으로 대표님 계정 저장 · 읽기 · 같은 달 다시 올리기(통째로 바뀜) · 한 달 지우기 · 잘못된 달 · 항목 키 · 글자 금액 막힘, 선릉 지점장 · 로그인 안 함 = 42501. 비용 줄은 대표님이 처음 CSV 를 올릴 때 생긴다.
  - **통장 내역서** (2026-11-04 대표님 "이게 선릉점 지금까지 거래내역서야" → 「진행」) — [20261104154931_ops_costs_bank_statement.sql](supabase/migrations/20261104154931_ops_costs_bank_statement.sql): `source` 에 `bank_statement` · `ops_costs_save` 가 `p_meta.source` 와 달마다 뺀 것 `p_months[].excluded` 를 받고 `ops_costs` 가 source 를 돌려줌 → 카드 아래 줄 '통장 내역 ○월 ○일 정리 · ○○ 뺌'(`costSourceLine`). 선릉역점 통장 내역서(PDF)는 클로드가 나눠 **달 · 항목 합계만** 대표님 계정으로 저장(2024-12 ~ 2026-10, 이번 달은 덜 차서 뺌) — 거래 · 파일 · 나누는 규칙(사람 이름이 들어 있음)은 저장소에 두지 않는다. 대표님이 정한 것: 카드 대금 · 관계사 송금 · 페이 충전 · 법무 = 사업과 상관없음(뺌) · 회원 아닌 분께 보낸 돈 = 오픈 때 인건비 · 시설(넣음, '인건비·시설(개인 송금)') · 다른 계좌로 옮긴 돈은 뺌. 클로드가 정한 것: 회원에게 통장으로 돌려준 돈은 브로제이 매출에 환불로 안 잡혀 '회원 환불(통장)'으로 넣음 · 개업 공사 · 종합소득세는 뺌(아래 줄에 표시) · 결제선생(페이민트) = 세무·수수료. 카드사 수수료는 통장에 안 찍혀 빠져 있다. 다음 달부터는 가계부 CSV 를 올리거나 새 통장 내역서를 클로드에게 — 같은 달을 다시 저장하면 통째로 바뀐다.
- 점검: 앱 DB 에서 `net.http_post(…/functions/v1/ops-sales, headers: Authorization(anon) + x-auto-key = internal_sync_config.auto_sync_key)` → 합계 · 흐름 + `probe`(broj · dagym · dagym_error · app · app_added). 결과 숫자는 대화 · 작업판에만 남긴다.
- **저장소는 공개(GitHub public)** — 실제 매출 · 비용 · 순이익 숫자는 문서 · 시험 파일 · 커밋 메시지에 쓰지 않는다(시험은 지어낸 숫자로, 점검 값은 DB 에서 바로). 근무자 실명 · 시급도 같다(10-29 규칙). 2026-11-03~04 에 지점 매출 합계를 이 문서 · 순이익 시험 · 커밋 메시지 하나에 적었다가 11-04 에 파일에서 지웠다(지난 커밋 기록에는 남아 있음).
- 보는 사람: 돈을 보는 분만(대표님 · 회계매니저 — 10-29 규칙). 지점장 · 코치님에게는 탭이 없다(서버 `ops_sales_scope` · Edge Function 둘 다 막음). 탭이 다섯 이상이면(사무실 · 전략 · 근무 · 일정 · 매출 · 매뉴얼 — 여섯이면 한 줄 6칸) '전략 회의'는 '전략'으로.
- **회계관리 엑셀** (2026-11-11 대표님 「마이복서 153 · 153가게부 · 일일 경영 리포트 모두 이렇게 정리해서 엑셀로 다운받을수있는 기능 만들어줘」 — 대표님 「점프윙스 칠금점 회계관리」 표 모양): 달 고르기 옆 「엑셀」 → 그해 1월 ~ 고른 달, 달마다 시트 + '설정'(예비비 · 운영비 · 기부금 비율 기본 5% · 25% · 1% · 정산 나누기). 한 장 = 월 누적 신규 · 재등록 회원(상품 기간별 — `registration-report` 라 전체관리자만, 다른 분은 빈칸) · 누적매출(이 탭과 같은 ops-sales 묶음 · 환불 뺀 금액) · 기타수입(빈 줄 — 엑셀에서 적기) · 결제 수단(참고) · 고정 / 유동 지출(ops_costs — 항목 키 `FIXED_COST_KEYS` 로 나눔, 합계는 순이익 카드와 같은 달 합계) · 총수입 · 총지출 · 순수익 · 배분 · 총 정산 · 1~12월 표 · 연도 표(지난 두 해) · 예비비 사용(빈 줄). 합계 · 배분은 엑셀 수식(캐시 값도 같이 넣어 휴대폰 미리보기에서도 맞게).
  - 양식 [src/lib/acctXlsx.ts](src/lib/acctXlsx.ts) — 라이브러리 없이 OOXML + ZIP(저장 방식). **일일 경영 리포트(153-branch-report `src/lib/acctXlsx.ts`) · 153가계부(`site/xlsx153.js` = 이 파일을 esbuild IIFE 로 옮긴 것)와 같은 파일 — 고치면 세 곳을 같이.** 이 앱 숫자 넣기 [src/lib/acctExport.ts](src/lib/acctExport.ts)(순수 함수 · 시험 acctExport.test.ts · acctXlsx.test.ts — 지어낸 숫자만) · 모으기 [src/services/opsAcctService.ts](src/services/opsAcctService.ts)(달마다 ops-sales 3개씩 · ops_costs 한 번 · 지난 두 해 흐름 · registration-report). 엑셀 코드는 누를 때만 받는다(dynamic import).
  - 휴대폰은 만든 뒤 '저장'을 한 번 더 누른다 — 공유 창(navigator.share)은 누른 그 순간에만 열린다. 컴퓨터는 바로 내려받기. 파일은 기기에서 만들고 서버로 안 간다.

#### 「매뉴얼」 탭 — 153 매뉴얼 1권 읽기 · 확인 문제 · 서명 (2026-11-11 대표님 「넘어가자」 · 보고서 「153 매뉴얼 책 · 운영본부 「153 매뉴얼」 탭 보고서」 https://claude.ai/artifact/NohTXPmYbxKD4j5vSkx4Hj)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261111131159_coach_manual.sql](supabase/migrations/20261111131159_coach_manual.sql) | 새 표 3 · 새 함수만: `coach_manual_books`(책 JSON — **비공개 장은 이 표에만**) · `coach_manual_reads`(장 · 판마다 서명 한 줄, 확인 문제를 몇 번 만에 맞혔는지 `quiz_tries`) · `coach_manual_nudges` · `coach_manual_book`(코치진만 · 책 줄이 없으면 null) · `coach_manual_me` · `coach_manual_sign`(책에 있는 장 · 지금 판 이하만, 같은 판 다시 눌러도 처음 시각) · `coach_manual_board`(대표님 · 지점장님 — 그 지점 코치진, 대표님 계정 빠짐) · `coach_manual_nudge`(사람마다 20시간에 한 번 '📘 153 매뉴얼을 읽어 주세요' → `/office?tab=manual`) |
| [src/lib/coachManual/](src/lib/coachManual/) | `progress`(장 상태 signed · resign · open · locked — 필독 장은 앞 필독 장을 어느 판이든 서명해야 열림 · 부록은 늘 열림 · 대표님 · 지점장님은 검토용으로 모두 열림 · 진도 · 읽기 쪽 순서) · `normalize`(DB JSON → 화면 책, 모르는 블록 · 틀린 이름 · 정답 자리가 보기 밖인 문제는 버림) · `book1Sample`(앱 안 예시 — 프롤로그~9장만) — 테스트 progress.test.ts · normalize.test.ts |
| [src/services/coachManualService.ts](src/services/coachManualService.ts) · [src/components/manual/](src/components/manual/) | `ManualTab`(서재 · 내 서명 n/필독 · 이어 읽기 · 이 책을 읽는 법 · 목차, 대표님 · 지점장님은 「책 읽기 · 읽음 현황」 · `?ch=<장>` 바로 열기) · `ManualReader`(한 장 전체 화면 — 넘기기 · ←/→ · 글씨 크게 · 표지 → 카드 → 오늘 한 가지 → 확인 문제(다 맞힐 때까지) → 「읽고 이해했어요 — 서명」) · `ManualBlocks`(글 · 인용 · 목록 · 표(줄마다 상자) · 그림 · 미션 영상 VideoOverlay) · `ManualBoard`(코치님마다 점 줄 · 장별 서명 날짜 · 읽어 주세요) |

- 비공개 장은 **DB 에만** (2026-11-11 대표님 「DB에만 두기」): 저장소가 공개라 앞글 2편(「이 책을 쓴 사람」 — 대표님 이야기 · 지점 회원 숫자, 「153이 설계하는 행복한 복싱짐」)과 부록은 코드 · 문서 · 커밋에 넣지 않는다. 일반 지도법 장(프롤로그~9장)은 앱 코드 `book1Sample.ts` 한 곳 — DB 책에는 `{"id":"ch1","from":"app","version":1}` 처럼 번호 · 판만 두고 화면이 앱 글로 채운다(`normalizeBook(data, BOOK1_SAMPLE)`). 서버 함수가 없거나(옛 DB 미리보기) 책 줄이 비면 이 예시만 안내 한 줄과 함께 보인다. 원고 = Claude Docs 「153 매뉴얼 1권: 첫 수업과 서비스 마인드 (원고)」 https://claude.ai/artifact/54TyMyWDtkt9c1jBUa6Mex · 책 넣기 SQL · 책 전체 JSON 은 저장소 밖(대표님 PC 내려받기 `153매뉴얼_앱데이터`).
- 글 고치기: 비공개 장 · 책 정보 = SQL(클로드) `coach_manual_books.data` · 일반 장 = `book1Sample.ts` 를 고쳐 배포하거나, DB 에 그 장 전체를 넣는다(DB 글이 앞섬 — 다시 배포 없이). 어느 쪽이든 고친 장은 DB 의 그 장 `version` 을 올린다(그 장만 '새 판 · 다시 서명', 앞 판 서명이 남아 뒤 장은 잠기지 않음 · 서명은 DB 책에 있는 장 · 지금 판 이하만 받음). 장 id(소문자 · 숫자 · _ 24자)는 서명 기록 이름이라 바꾸지 않는다. 그림 = `public/assets/manual/<이름>.webp`(목차용 `_s`) · 영상 블록 = 미션 id(`missions`). 앱은 10분마다 다시 받는다.
- 보이는 범위: 탭 = 코치진(전략 회의와 같은 기준). 읽기 · 서명 = `_strategy_staff` · 현황 · 알림 = `_strategy_can_direct`(대표님은 지점 고르기 · 지점장님은 내 지점). 확인 문제 채점은 앱이 한다(서버는 몇 번 만에 맞혔는지만).
- 미리보기(옛 DB · 함수 없음): 책 = 예시 · 서명 = 이 휴대폰에만(localStorage `153manual:<책>:reads`) · 현황 = '예시 코치 A/B/C' · 알림 안 감.
- 적용 (2026-11-11 대표님 「적용하고올려」): DB = MCP `apply_migration`(새 표 3 · 새 함수 6, 기존 그대로) → 1권 넣기(비공개 장 3 + 일반 장 10 번호 · 판, `md5(data::text)` 를 넣는 문장 안에서 확인 — 지금 값 `8440aa5c…`) → 되돌림 시험 ALL_OK(회원 = 책 · 서명 막힘 · `{staff:false}` · 코치 = 책 13장 · 서명(같은 판 다시 = 처음 그대로) · 없는 장 · 앞선 판 막힘 · 현황 · 알림 막힘 · 지점장 = 다른 지점을 골라도 자기 지점만 · 알림 sent → too_soon · 다른 지점 · 본인 · 대표님 막힘 · 대표님 = 지점 고르기 · 표 직접 읽기 · 안쪽 함수 · anon 막힘, 남은 줄 0) → main 빠른 합치기.

### 회원 화면 리디자인 — 글씨 6단계 · 화면 규칙 7가지 (2026-10-28 대표님 "위보고한 기준대로 전면 리 디자인하자 · 많이 바뀌어도 되니까 가장 이상적인 방향으로")

근거: Claude Docs 보고서 「마이복서153 글 줄이기 · 글씨 키우기 UX 보고서」(https://claude.ai/artifact/9ixgXrsgaAuPvgcPKbdzV9) — 회원 화면 글씨의 46%가 12px 이하 · 크기 36가지 · 회색 작은 글씨 1,225곳 · 같은 숫자 반복.

| 이름 | 크기 | 쓰는 곳 |
|---|---|---|
| `text-display` | 40 | 화면 주인공 숫자 (한 화면에 하나) |
| `text-title` | 24 | 화면 제목 · 카드 큰 숫자 |
| `text-heading` | 19 | 카드 제목 · 중요한 한 줄 |
| `text-body` | 16 | 읽는 글 · 목록 · 단추 |
| `text-label` | 14 | 이름표 · 날짜 · 단위 · 짧은 회색 설명 |
| `text-micro` | 13 | 배지 · 그래프 눈금 (가장 작은 크기) |

- 회원 화면(.tsx)은 이 6개 이름만 쓴다 — 크기 숫자(`text-[11.5px]`)·옛 이름(`text-xs` · `text-sm` · `text-caption` …)은 `scripts/check-font-sizes.mjs` 가 막는다(`bun run build` · GitHub 「앱 자동 검사」 · 클로드 세션에서는 빌드가 멈춤). 정말 필요한 줄만 같은 줄 주석에 `글씨예외`.
- 옛 크기를 한꺼번에 옮기기: `node scripts/apply-type-scale.mjs` (가장 가까운 단계, 같으면 큰 쪽 · 몇 번을 돌려도 결과가 같다 — 다른 계정 수정과 합친 뒤 다시 돌려도 된다). 규칙 · 제외 화면 목록은 `scripts/type-scale.mjs` 한 곳.
- 아직 옮기지 않은 화면(3단계): 관리자 · 지점장 · 코치 화면, TV · 키오스크, 게임(`features/minigame`) — `EXCLUDE`.
- 회색 글씨 `--muted-foreground` = #626C7A (흰 카드 5.32:1 · 회색 바탕 4.83:1). 회색 바탕 위에 회색 글씨를 쓸 때도 4.5:1 넘게.
- 화면 규칙 7가지: ① 카드마다 주인공 하나(큰 숫자나 사진 하나 + 이름표 한 단어) ② 같은 숫자는 한 화면에 한 번 ③ 빈 것은 그리지 않기(0회 · 기록 없는 달 · 0원 줄 숨김, 그래프는 기록이 쌓이면) ④ 설명은 접기(? 단추 · '계산 방법' · 처음 한 번만) ⑤ 글씨 6단계만, 13px 아래 없음 ⑥ 회색 설명 줄은 카드 하나에 한 줄까지 ⑦ 카드 안 문장은 한 줄, 넘으면 '더 보기' · 단추 글 2~5자.
- 카드 기본 모양: `rounded-2xl border bg-card p-5` · 카드 제목 `text-heading` · 맨 아래 '○○ 자세히 보기 ›' 한 줄(`h-14 border-t text-body font-bold`) · 머리글(`PageHeader`)에 꾸밈 부제 넣지 않기(정보가 있는 부제 — 지점 이름 등 — 만).
- 다시 짠 화면: 내 운동 기록(요약 하나 · 이번 주 7칸 · 다음 축하 · 그래프는 쌓이면 · ? 안에 세는 규칙) · 홈(내 운동 카드 하나 — '153과 함께하며'는 내 운동 기록으로 · 순위 없으면 한 줄 · '내 정보' 단추 하나) · 내정보(지금까지 이룬 것은 내 운동 기록으로 · 라이센스 카드 표시는 계정 · 정보로 · 빈 메달 칸 숨김) · 커뮤니티(머리글 이름만 · 피드 글씨 14~16).
- 2단계에 다시 짠 화면: 훈련 탭(단계 설명은 지금 할 단계에만 · 레벨업 카드 '레벨 8까지 / 1번 더 오면 돼요' + ? · 레벨 미션 영상은 '레벨 N' 머리글 + 이름 한 줄) · 랭킹 탭(내 순위 숫자 하나 · 4위부터 카드 하나에 줄로 · 지금 운동 중 0명이면 숨김 · 153 레코드 보상은 한 번) · 알림함(종 그림 · '바로 가기' 줄 빼고 새 알림 점 · 내용 2줄 · ›) · 수강권(상품 카드 주인공 = 결제 금액) · 자주 여는 창(응원 보내기 · 오늘 운동 한 줄 · 받은 153 · 응원함 · 회원 카드 · 내 신체 정보 · 결제 내역 = 제목 한 줄 + ✕, 입력칸 16px).
- 머리글 오른쪽 '내 정보' 단추는 두지 않는다 — 아래 탭에 '내정보'가 있다. 아래 탭이 아닌 화면은 왼쪽 '뒤로'(history idx 가 0 이면 /home).
- 레벨업 진행도는 `LevelUpRequestCard` 하나(훈련 탭 첫 화면 · 레벨 자세히 보기 '심사' 탭 · 랭크업) — 서버 `get_level_cycle_progress` 그대로('다른 날'은 출석과 같은 숫자라 안 씀). 예전 이 기기 기록(`useLocalProgress` — XP 0/300 · 인정 세션)은 서버 숫자와 달라 운영진(admin)에게만, '판매급 심사 기준'은 코치 이상에게만. 레벨 지도에서 고른 레벨은 바로 자세히(지난 레벨 '심사' 탭 = '통과한 레벨이에요'). 자세히 보기 캐릭터 아래 한 줄 = 이 레벨을 넘는 법(`get_levelup_rules` — 예전 '50분 · +100 XP'는 실제 규칙과 달라 뺌, 튜토리얼 2일차 7 · 19번 글도 맞춤). 수업 루틴 화면에는 레벨업 띠를 다시 두지 않는다.
- 작은 회색 글씨 정리: `node scripts/apply-readability.mjs` — 회색 설명 · 문단의 text-micro → text-label, 'uppercase + tracking' 머리말 → 자간 빼고 label 굵게. 배지 · 칩 · 사람이 고친 화면(HAND_TUNED)은 그대로, 몇 번을 돌려도 같다(다른 계정 수정과 합친 뒤 다시 돌려도 된다).
- 글씨 크기 설정(작게 · 보통 · 크게, 기기마다): [src/lib/textScale.ts](src/lib/textScale.ts) — html 글씨 크기 93.75 · 100 · 112.5% (회원 화면이 모두 rem 이라 앱 전체가 같은 비율로), main.tsx 에서 첫 화면 전에 반영, TV · 키오스크(isSignageRoute)는 늘 보통. 칸은 `TextScaleToggle` — 내정보 계정 · 정보 · 설정 화면 모드 아래. 새 화면은 '크게'(390px 에서 18px 바탕)에서도 줄이 이상하게 꺾이지 않는지 본다.
- 새 화면 · 큰 수정은 휴대폰 폭(390px)에서 찍어 보고 올린다 — 13px 칸이 좁아 줄이 꺾이는지(예: 월 이름 '10월'), 숫자가 칸을 넘치는지('1.4만…').

### 랭킹 설명 단추 · 내 순위 (2026-10-29 대표님 "니 추천대로 할게" · 「랭킹 설명 버튼 보고서」 https://claude.ai/artifact/8EJsSWmWQPaGEG2XaYye2e)

- 랭킹 탭 칩 줄 끝 '?' → 지금 칩의 기준 · 올리려면 · 내려가는 때 · 다시 시작까지(이번 주 · 상승만) 펼침(`RankingHelpPanel`, HallOfFamePage). 글은 [src/lib/rankingHelp.ts](src/lib/rankingHelp.ts) 한 곳 — 바꾸면 오삼코치 안내(osamiFaq `rk-types` · `rk-how`)도 같이. '전체' 올리는 법은 `get_levelup_rules` 로 만든다.
- 칩 이름: '출석' → **'출석일'**(member_progress.streak_days 는 앱 홈을 그날 처음 연 '출석 체크' 날 수의 누적 — 연속이 아니다, 0 으로 돌리는 곳이 DB 어디에도 없다) · '보상' → **'타이틀매치'**(통과 수). 회원 카드 · 홈 · 코치 화면 · 회원 상세의 'N일 연속'도 '출석 N일'로 바꿨다. 진짜 연속으로 바꾸는 건 대표님이 하지 않기로(A안).
- '전체' 줄 점수 칸 = 레벨(Lv.N), XP 는 아래 작은 줄 — 순서가 레벨 → 타이틀매치 → XP 라서(예전엔 XP 가 보여 'XP 더 많은데 왜 아래?').
- '내 순위' 카드 = 지금 보는 칩 기준 + 바로 앞 사람까지 한 줄 · 50위 밖이어도(`get_my_ranking_positions` — 코치님 · 운영진 · 테스트 계정은 eligible:false). 전체관리자가 다른 지점을 보면 안 그린다.
- '상승' = `get_monthly_risers_v2`(코치님 · 테스트 계정 빼기 · 한국 1일 0시부터). 예전 `get_monthly_risers` 는 남아 있다(쓰는 화면 없음) — 20261029232024.
- 2단계(남은 일): 어제보다 오르내린 표시 ▲▼ — 매일 밤 순위를 저장하는 표부터.
- chat-assistant 개인 정보 줄 '연속 출석' → '출석 체크한 날(누적 · 연속 아님)' — Edge Function 배포함(v26, 2026-10-29 main 합칠 때 · 배포본과 비교 뒤).

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
| [src/components/engagement/ReceivedCheersSheet.tsx](src/components/engagement/ReceivedCheersSheet.tsx) | 응원함 — '받은 응원'(고마워요 153) · '보낸 응원'(누구에게 · 언제 · 스티커/한마디 · 고마워요 받음, `get_my_sent_cheers` — 20261028002152, 2026-10-28 회원 제안) 두 칸. 내정보 '받은 · 보낸 응원' · 알림 링크 `/mypage?cheers=1` · 응원 보내기 창 '보낸 응원 보기'(`initialTab="sent"` · `stacked`) |

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
- 설정 › 마이복서153 공유하기 (2026-11-12 대표님 「마이복서 153앱 공유기능 만들어줘 설정에」): 설정 맨 위 카드 [AppShareCard](src/components/share/AppShareCard.tsx) — 공유하기(휴대폰 공유 창, 없으면 소개 글 + 링크 복사) · 링크 복사 · QR 보기([AppShareQrSheet](src/components/share/AppShareQrSheet.tsx) — qrcode.react 는 'qr' 묶음(350KB 남짓)이라 설정 화면이 미리 받지 않게 처음 누를 때 따로 받는다). 링크 = 위 초대 링크(내 코드, `useMyInviteCode` 같은 캐시 · 코드가 없으면 코드 없이). 보상 규칙은 그대로(미리 초대한 회원만)라 카드 · 소개 글에 보상 말을 쓰지 않는다. 소개 글 `appShareText()`(lib/appInvite — 153 브랜드 서명 · 긴 줄표 없음, 시험 appInvite.test.ts) · 앱 검색 '공유 · 친구 초대 · 앱 링크' → /settings. DB 변경 없음.
- 코치·운영진 카드: `get_member_license` 의 `staff_title` 을 칭호로 보여 준다.
- 남은 일(대시보드에서만 가능): Storage `community` 버킷의 'Community photos are public' 정책을 본인 폴더만 보게 바꾸기 — MCP 계정은 storage.objects 주인이 아니라 못 바꿈.

### 커뮤니티 1단계 — 홈 띠 · 153/댓글 알림 · 받은 153 · 길게 눌러 응원 (2026-10-27 대표님 "니가 추천해주는대로 진행" · 「마이복서153 커뮤니티 탭 업그레이드 보고서」)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261027231653_community_phase1.sql](supabase/migrations/20261027231653_community_phase1.sql) | `community_reactions.notified_at` · `community_notify_log` · `community_dispatch_153()`(10분마다 — 첫 153 은 30분 모아 한 번, 그 뒤 21시 요약 하나) · 댓글 알림 트리거 `_community_comment_notify` · `get_my_received_153`(보낸 사람별 + 돌려줄 카드) · `get_community_home_strip` · `community_weekly_metrics`(운영진) · `community_weekly_report()`(월 08:30 KST 전체관리자) · 예약 작업 `community-153-dispatch` · `community-weekly-report` |
| [src/components/home/CommunityTodayStrip.tsx](src/components/home/CommunityTodayStrip.tsx) | 홈 내 카드 바로 아래 '오늘 우리 체육관' 띠 — 지금 운동 중 · 오늘 온 동료 · 새 소식(커뮤니티를 마지막으로 연 뒤, `markCommunityVisited`) · 오늘 받은 153. 숨긴 지점이면 안 보임 |
| [src/components/engagement/Received153Sheet.tsx](src/components/engagement/Received153Sheet.tsx) | 받은 153 + '153 돌려주기'(그 동료의 가장 최근 카드) · 돌려줄 카드 없으면 '응원 보내기' — 커뮤니티 머리 '받은 153' · 알림 링크 `?received=1` |
| [src/components/engagement/CommunityFeed.tsx](src/components/engagement/CommunityFeed.tsx) | 153 길게 누르기(0.45초) → 응원 시트 · 누르면 '+1' · 글씨 15px · 단추 40px+ · `?entry=<글>` 댓글 창 · 전 지점 보기 '커뮤니티 숫자'(지난주 · 이번 주) |

- 스위치: `internal_sync_config` key `community_notify_since` = 켠 시각(ISO). 없거나 'off' 면 153 · 댓글 · 월요일 알림이 하나도 안 나간다(화면 기능은 그대로). 켠 뒤에 눌린 153 만 알림 대상.
- 알림: 평일 08~22시만(쉬는 때 받은 153 은 다음 평일 아침 첫 알림으로 묶임) · 커뮤니티 휴대폰 알림은 하루 3번까지(넘으면 `pushed_at = now()` 로 알림함에만) · 회원 설정 `profiles.cheer_notify`('응원 · 153 · 댓글 알림 받기')를 같이 쓴다.
- 핵심 숫자: 커뮤니티 활동 회원 비율 = 그 주 커뮤니티에서 누르거나 쓴 회원(글 · 153 · 댓글 · 응원 · 환영 · 하트) ÷ 그 주 출석 회원 — 선릉역점, 코치 · 운영진 · 체험 계정 제외. 목표 4주 15% · 8주 25% (시작점: 2026-10-19~25 주 4% — 출석 94명 중 4명).
- 켬 (2026-10-27 자정 무렵 대표님 "올려" — 미리보기 `preview/community` 확인 뒤 main 에 합침 · [20261027235213_community_phase1_on.sql](supabase/migrations/20261027235213_community_phase1_on.sql)): 스위치 켬 + 출석 알림(`attendance_base_xp_trg` 의 오삼코치 칭찬이 없는 갈래)을 누르면 커뮤니티(`/myboxer/community` · '오늘 같이 운동한 동료에게 153을 보내 보세요'). 앱에서 숨겨 둔 지점(`branches.is_visible` false)은 예전 그대로(링크 없음 · 홈 안내). 끄기 = `community_notify_since` 를 'off'.
- **댓글 답글** (2026-11-05 대표님 "내가 댓글 남기면 답글 못 남겨?" → 「진행하자」 · [20261105094341_community_comment_replies.sql](supabase/migrations/20261105094341_community_comment_replies.sql)): `champion_journal_comments.parent_id`(맨 위 댓글 · 한 단계만) · `reply_to_user_id`(받은 사람) · `add_journal_reply(댓글, 내용)` — 답글에 단 답글도 같은 맨 위 댓글 밑 · `list_journal_comments_v2`(예전 `list_journal_comments` · `add_journal_comment` 는 그대로) · `_community_comment_notify` 답글 갈래 — 받은 사람에게 「○○님이 답글을 남겼어요」, 글쓴이는 예전처럼 「댓글」(답글을 이미 받았으면 한 번만, 로그 kind 는 'comment'). 답글이 달린 댓글을 지우면 답글도 함께(on delete cascade — 화면이 먼저 묻는다). 화면: [PartnerJournalCommentSheet](src/components/engagement/PartnerJournalCommentSheet.tsx) 댓글 · 답글마다 '답글 달기' → 입력칸 위 '○○님에게 답글 ✕' · 들여쓰기 · 받은 사람이 맨 위 댓글 주인과 다르면 @이름.

### 운동 모집 '오늘 같이 해요' 1 · 2단계 (2026-10-28 대표님 "추천대로가자" · "올려" · 보고서 「마이복서153 운동 모집 업그레이드 보고서」 https://claude.ai/artifact/PFthjPygKqpEoX9GH4EcWt)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261028165026_partner_call_phase1.sql](supabase/migrations/20261028165026_partner_call_phase1.sql) | `get_partner_calls`(올린 사람 userId · 이름 = 닉네임 없으면 이름 · 사진 · 레벨 · 코치 여부 + `joiners` + `usualHour`(최근 60일 가장 많이 온 시각) · `canSpar` · `needsNickname`, 승인 전 계정은 빈 목록) · `create_partner_call`(스파링 = 코치님 · 운영진만 · 닉네임 없는 회원은 먼저 정하기) · `join_partner_call`(올린 사람 알림 '🙋 ○○님이 저요! 했어요' → `/myboxer/community?together=1`, 같은 모집 · 같은 사람은 한 번만 = `boxing_partner_call_notes`, 22~07시는 알림함에만, 커뮤니티 스위치 · `cheer_notify` 따름) · `get_community_home_strip.calls` · `community_weekly_metrics`(calls · calls_joined · call_pairs(둘 다 그날 출석) · member_calls) · 월요일 알림 한 줄 |
| [src/components/engagement/PartnerCallSheet.tsx](src/components/engagement/PartnerCallSheet.tsx) | 시트 — 카드(사진 · 이름 · Lv · 코치 → 회원 카드) · 저요한 사람(내 모집이면 한 사람씩 '메시지' → `/messages/to/<id>`) · 올리기 칸은 접어 두고 종류 미트 · 같이 운동(+스파링은 `canSpar`) · 시간 칩 · 닉네임 먼저(NicknameEditSheet 뒤 그대로 올림) |
| [src/components/engagement/PartnerCallCard.tsx](src/components/engagement/PartnerCallCard.tsx) | 커뮤니티 피드 맨 위 카드 — 오늘 모집이 있을 때만 · 첫 모집에 바로 '저요' |
| [src/lib/partnerCallTime.ts](src/lib/partnerCallTime.ts) | 시간 칩(평소 시간 앞뒤 1시간 세 칸 · 지난 시간 빼기 · 5~23시) · `formatHour`(서버 알림 글과 같은 말) · `kstHour` |
| [supabase/migrations/20261028171328_partner_call_phase2.sql](supabase/migrations/20261028171328_partner_call_phase2.sql) | 2단계 — `boxing_partner_calls.expires_at · capacity` · `boxing_partner_call_done` · `get_partner_calls_v2`(+ isNow · expiresAt · capacity · full · started · joinable · myDone · pairs · `atGym`(3시간 안 출석) · `canCapacity` · `pairsToday`) · `create_partner_call_v2(…, p_now, p_capacity)` · `join_partner_call_v2`(줄 잠금 — 지난 시간 · 끝난 '지금' · 정원 막음) · `partner_call_done` · `_partner_mutual_153` · `_partner_reward` · `partner_call_tick` |
| [supabase/migrations/20261028174825_partner_call_phase2_on.sql](supabase/migrations/20261028174825_partner_call_phase2_on.sql) | 켬 — 예약 작업 `partner-call-tick`(5분마다) · 홈 띠 calls 에서 30분 지난 '지금' 모집(저요 없음) 빼기 · `get_partner_calls_v2.branchPosts` |
| [src/lib/partnerCallExamples.ts](src/lib/partnerCallExamples.ts) | '이렇게 올려 보세요' 예시 7개 · `showPartnerExamples`(모집 5개까지) · `examplesFor`(지금 올릴 수 있는 것 먼저 · 체육관에 없으면 '지금' 예시 빼기 · 날마다 순서 바꿈) |

- 홈 '오늘 우리 체육관' 띠 맨 앞 민트 글씨 '같이 해요 N'(남의 모집) · 커뮤니티 `?together=1` 이면 시트가 열린다.
- 줄넘기 칸은 뺐다(예전 모집은 이름 그대로 보임). 스파링은 회원 화면에 칸이 없고 서버도 막는다.
- 2단계 (2026-10-28 18시 대표님 "올려" — 미리보기 `preview/partner-call` 확인 뒤 main): 화면은 `_v2` 함수만 부른다(1단계 함수는 그대로 남아 있음).
  - '지금' 모집: 체육관에 온 지 3시간 안이면(`atGym`) '지금' 칩 → 30분(`expires_at`). 지난 시각 · 끝난 '지금' 모집에는 저요가 없다.
  - 정원(2~30명): 코치님 · 운영진 모집만(`canCapacity`), 차면 '마감'. 코치님 모집(선릉역점 평일 저녁 하루 1건)은 코치님이 직접 올리는 약속 — 앱이 저절로 올리지 않는다.
  - '같이 했어요': 운동 시간이 된 뒤 올린 사람 · 저요한 사람이 누른다(어제 모집까지). 둘 다 누른 짝마다 서로 153(그날 첫 출석 카드에) + 회원은 챔피언 머니 +30(하루 1번, '같이 운동 보상' — 코치님 · 운영진은 없음) + 먼저 누른 사람에게 알림. 맨 위 카드 '오늘 같이 운동한 짝 N쌍'.
  - `partner-call-tick`(5분마다): ① 저요가 있는 모집 시작 60~5분 전 '⏰ 곧 같이 운동해요' ② 시작 1시간 뒤('지금' 모집은 끝나고 30분 뒤) 아직 안 누른 사람에게 '🤝 오늘 같이 운동했나요?' — 사람마다 한 번(`boxing_partner_call_notes` kind remind · ask), 07~21시만 휴대폰, 커뮤니티 스위치 · `cheer_notify` 따름. 끄기 `select cron.unschedule('partner-call-tick');`
- 예시 (2026-10-28 대표님 "게시물5개 올라올때까지는 다양한 예시 넣어놓자"): 우리 지점에 지금까지 올라온 모집(`branchPosts`)이 5개가 될 때까지 시트에 '이렇게 올려 보세요'(모집이 없으면 4개 · 있으면 목록 아래 3개), 커뮤니티 맨 위는 오늘 모집이 없을 때 예시 하나. 점선 · '예시' 표시 · 사람 이름 없음 · 저요 없음 — 누르면 그 내용이 채워진 올리기 칸(올리는 것은 회원이 '모집 올리기'). 내 모집이 있으면 시트에는 안 보인다.
- 남은 일: TV 한 줄(이름 · 시간 · 종류 + QR)은 리디자인 3단계(TV 글씨 단계) 합친 뒤. 3단계: 같은 시간대 동료 알림 · 다시 부르기 · 다른 지점.

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
- 153 레코드(2026-10-19 대표님 가·나·라): `board_record_holders`(TV 열쇠 길, 오늘 온 '최초' 기록 보유자 + 2026-10-29부터 최초 대회(get_153_records 'tournament' 와 같은 대회) 우승·준우승자 — '최초 대회 우승/준우승' 이 맨 앞, 코치님은 여전히 제외 · 20261029193000) → 가: 들어오면 금색 '153 RECORD' 환영 10초(`RECORD_POPUP_MS`, 생일이면 생일 화면에 기록 한 줄) · 나: 카드 맨 위 금색 띠(`BoxerLicenseCard` `record`) · 라: 랭킹 띠 위 '오늘 온 최초 기록 보유자' 금색 띠(넘치면 흐름). 새 출석이 들어올 때 환영 화면보다 먼저 다시 읽는다. 테스트 판 '🏆 153 레코드 회원 입장'.
- 153 레코드 최초 기록은 새겨질 때 마일리지(`app_settings.mileage_rules.record`, 10,000) + 알림(`records_153_reward_trg`, 금액 0 이면 둘 다 없음). 10/24 관리자 화면 저장이 record 를 지운 일이 있어 2026-10-28 고침 — 설정 화면에 '153 레코드' 칸 · `set_app_setting` 은 보내지 않은 칸을 앞 값 그대로(20261028004553). '최초 커뮤니티 사진'(`first_journal_photo`, 전체 공개 사진 글) 추가 — 20261028004226.
- TV 열쇠: `_board_branch_ok` — 지점에 `internal_sync_config.board_key:<지점>` 이 있으면 열쇠가 맞는 TV 와 로그인한 그 지점 운영진만. 열쇠는 TV 를 `/tv/<지점>/<번호>?k=<열쇠>` 로 한 번 열면 그 기기에 남는다(`src/lib/boardKey.ts`). 대기 열쇠(`board_key_pending:`)로 처음 연 순간 잠긴다. 관리자 앱 › 라이브보드(`LiveBoardPickerPage`)가 그 지점 운영진에게만 열쇠 주소를 보여 준다(`get_board_tv_key`).
- QR 출석 점검 (2026-10-29 칠금 "QR 찍으면 오류 · 프로필 카드 안 뜸 · 코치 칸에 이름 안 뜸") — 20261029161500:
  - 코치 칸(`public_staff_on_duty`)은 출근부 `staff_duty_logs` 만 본다. 출근부는 브로제이 얼굴 출근만 적어 칠금은 0줄이었다 → 이제 **직원이 QR 을 찍으면** 그 지점 · 그날 출근부가 없을 때만 한 줄(`_qr_staff_duty`, source_ref `qr:<md5>`) — TV 코치 칸 · 153운영본부 근무 출근 시각에 같이 쓰인다. 10/21 부터 직원 QR 출석은 한 번 옮겼다.
  - 회원 실패는 전부 '지난 QR'(bad_token)이었다(10/28 2명 7번, 같은 시간 TV 는 30초마다 새 토큰을 받고 있었음). 이제 시도마다 `qr_checkin_attempts`(RLS · 권한 없음, SQL 로만)에 결과 · **몇 분 전 QR 인지**(`token_age_min`, 7일 안)가 남고, 폰에도 "이 QR은 ○분 전 화면이에요"로 보인다. 다음에 같은 말이 나오면 먼저 이 표를 본다 — 수십 분이면 TV 가 멈춤(태블릿 잠자기), 하루 이상이면 사진 · 캡처 QR.
  - 폰 카메라로 들어온 `/qr-checkin?b=&t=` 는 한 번 보낸 뒤 주소에서 지운다(새로고침 때 지난 QR 재전송 방지). 토큰 비교는 소문자로.
  - 칠금 TV(태블릿)는 지점장 계정으로 로그인해 보드를 띄운다 — 낮에 몇 시간씩 요청이 끊기는 때가 있다(10/29 13:30~16:00). 그동안 화면의 QR 은 지난 QR 이다.

### 153 PB 라이브보드 — TV pb1 「코스 보드」 · pb2 「기록 보드」 (2026-11-08 대표님 「다음진행 추천대로」 · 보고서 「153 PB 라이브보드 설계」 1단계 — 화이트 · 최대 4명 · 자동 전환)

- 주소: `/tv/<지점>/pb1` · `/tv/<지점>/pb2` ([LiveBoardPb153Page](src/pages/LiveBoardPb153Page.tsx) · [PbCourseBoard](src/components/liveBoard/pb/PbCourseBoard.tsx) · [PbRecordBoard](src/components/liveBoard/pb/PbRecordBoard.tsx)). 쿼리 `?demo=1` 예시 화면 · `?lite=1` 시범 영상 대신 정지 그림 · `?k=` TV 열쇠. 화이트(1920×1080 px 고정 · [pbTvStyles](src/components/liveBoard/pb/pbTvStyles.ts)) · 글자 28px 이상 · 페이드만 · 무한 애니메이션 없음.
- 숫자는 전부 [test153.ts](src/lib/test153.ts) · [pbBoard.ts](src/lib/pbBoard.ts)(총 개수 오픈 410 · 스타터 205 · 셀트런 800m · 22:00 레드 타이틀 = `RED_TITLE_PB_LIMIT_MIN`). TV 카드 한 줄 기준(`TV_STD`)은 PbCourseBoard 안 — 종목을 바꾸면 같이.
- 8분할 시범 = 영상 1개 `public/test153/pb-grid.mp4`(1856×734 · 6초 · 813KB, 시범 8편의 위쪽 동작 화면만) — TV 는 영상 여러 개를 같이 틀면 버벅인다. 칸 자리는 `PB_GRID` 와 같아야 한다 → 다시 만들기 `python3 scripts/make-pb-grid.py`.
- 실시간 = 채널 `test153-live:<지점 이름>`(broadcast · **이름 · user_id 없음** — board-ping 과 같은 원칙). 코치 측정 화면이 [useTest153LiveSender](src/hooks/useTest153LiveSender.ts)로 바뀔 때마다 + 5초마다 보낸다(시작 · 구간 시각 · 부문 · 저장 결과 is_pb/prev_pb). 지점 = 측정하는 회원의 지점. TV 는 [usePb153Live](src/hooks/usePb153Live.ts) — 번호(1~4)로 보이고 끝난 측정은 끝난 지 3분 뒤 내린다.
- 자동 전환: `/tv/<지점>/1 · 2`([usePb153AutoSwitch](src/hooks/usePb153AutoSwitch.ts))가 달리는 측정 신호를 받으면 `pb1 · pb2?auto=1` 로 넘어가고(열쇠 등 쿼리 유지), 달리는 측정이 없어지고 3분 뒤 돌아온다. 끄기 `?pb=0`. TV1 리모컨: 신호가 없을 때 OK/Enter = 단체 타이머 시작·멈춤, ←/Backspace = 멈춘 타이머 지우기.
- 기록 보드 데이터 = `board_test153(p_branch, p_key)`(TV 열쇠 `_board_branch_ok` · 닉네임만 · 부문별 TOP 10 전 지점 · 이번 달 PB 단축 3명 · 153 레코드 PB 3종 · 이 지점 오늘 기록 4개 · 전체 수) — [20261108140609_board_test153.sql](supabase/migrations/20261108140609_board_test153.sql). 60초마다 + 저장 신호 1.5초 뒤 다시 읽는다. 22:00 통과선은 오픈 순위에만, 코치님 · 운영진 줄은 '순위에만' 한 줄.
- **2단계 — 히트(최대 4명) · 닉네임 · 지난번의 나 · 공식 기록 자동 저장** (2026-11-08 대표님 「2단계넘어가자」):
  - 코치 측정 화면([Test153MeasurePanel](src/components/test153/Test153MeasurePanel.tsx) · 칸 [Test153MeasurePanelLane](src/components/test153/Test153MeasurePanelLane.tsx) · 결과 한 장 + 악력 [Test153MeasurePanelResult](src/components/test153/Test153MeasurePanelResult.tsx)): 참가자 1~4명(사람마다 부문 · 성별) → 같이 시작 → 사람마다 큰 '다음 구간'(1.5초 안 두 번 누름은 무시 · 칸 색 = 레인 색 `PB_LANE_COLORS` = TV 레일 동그라미) · 되돌리기 · 멈춤(남은 개수 → 캡 기록 · 이어서 · 기록 없이 빼기). 16번째를 누르면 **4초 뒤 공식 기록(구간 16개) 저절로 저장**(그 사이 되돌리기 · 실패하면 '다시 저장'), 25:00 이면 달리는 사람 모두 캡. 1명이면 저장하자마자 결과 한 장. 계산은 전부 [test153Heat.ts](src/lib/test153Heat.ts)(시험 test153Heat.test.ts). 이 기기 저장 `test153-heat-v2`(1단계 `test153-run-v1` 이 남아 있으면 1명 히트로 이어받음).
  - TV 신호: 레인마다 하나 — id `<히트 uuid>:<레인>` · heat · lane (이름 없음 그대로). TV 는 레인 번호를 TV 번호로.
  - 닉네임 · 고스트: 측정 화면이 바뀔 때마다 `test153_heat_save(p_heat)`(서버 동기화 · 답 = 레인마다 지난번의 나) → TV 는 처음 보는 히트 참가자가 생기면 `board_test153_live(p_branch, p_key)`(TV 열쇠 · 닉네임만 · 리그 · 직함 · 고스트 · 첫 도전)로 읽는다([usePb153Live](src/hooks/usePb153Live.ts) people). 서버 동기화가 안 돼도 측정 · 저장은 그대로(TV 만 '측정 N번'). 표 `test153_heats` · `test153_heat_lanes`(RLS · 함수로만) · `_test153_ghost`(그 히트 시작 전 같은 부문 공식 최고 — 구간 16개 완주만 cum) — [20261108192625_test153_heats.sql](supabase/migrations/20261108192625_test153_heats.sql).
  - TV2 레인: 닉네임 · 레인 번호(색) · 리그 점(직함 줄은 없음) · 줄 순서 = 오픈 먼저 · 스타터 다음, 같은 부문은 많이 간 사람(`pbRaceOrder`) · '지난번보다 0:24 빨라요' / 뒤지면 '지난번의 나까지 0:05'(늦다는 말 쓰지 않음 — `pbGhostText`) · 미니 막대 금 테두리 = 지금 시각의 지난번의 나(`pbGhostSeg`) · 첫 도전 · 구간 없는 PB 는 '지난 최고 21:30'. TV1: 레일 동그라미 = 닉네임 첫 글자 + 레인 색 · 칸 '지금 · 민준 · 서연' · 축하 화면에 닉네임.
  - 남은 일(3단계 후보): 종목 1위(구간 기록이 쌓이면) · 나이대 · 4주 안 재측정률 집계(`test153_heats` 로).

### 라이브보드 TV 화면 바꾸기 (2026-11-08 대표님 「라이브보드 탭에서 내가 버튼을 누르면 라이브보드 변경 가능하게해줘 모든 모드 별로」)

- 관리자 앱 › 라이브보드([LiveBoardPickerPage](src/pages/LiveBoardPickerPage.tsx) 맨 위 [TvRemotePanel](src/components/liveBoard/TvRemotePanel.tsx)): TV 번호마다 화면 6개 버튼 — 지금 운동 중 · 런칭 이벤트 · 회원 안내 · 전체 한 화면 · 153 PB 코스 · 153 PB 기록. 누르면 그 TV 가 몇 초 안에 넘어가고 **다시 바꿀 때까지 그대로**(TV 를 껐다 켜도). 줄마다 켜짐 · 지금 화면 · 바꾸는 중(TV 가 1분마다 · 화면이 바뀔 때 알림, 5초마다 다시 읽음). 1 · 2번은 늘, 3 · 4번은 켠 적이 있거나 골라 둔 것만(나머지 '더 보기'). 미리보기에도 153 PB 코스 · 기록(P1 · P2 — [liveBoards.ts](src/lib/liveBoards.ts) `LIVE_BOARD_IDS`).
- TV 번호(slot) = TV 를 켜는 주소 끝 번호 1 · 2 · 3, 번호 없는 /tv/<지점> = 4. 번호와 다른 화면을 보여 주는 동안은 주소에 `?tv=<번호>`(20분 새로고침에도 자기 번호를 안다) · 열쇠 `?k=` 등은 그대로. 그 번호의 원래 화면 = 'home'(기본) — **153 PB 자동 전환은 1 · 2번 TV 가 기본일 때만**(`?tv=` 가 있으면 자동 전환 끔). 자동 전환으로 들어온 PB 화면(`?auto=1`)은 들어온 뒤 새로 고른 화면만 따르고, 자동 복귀는 그 번호에 골라 둔 화면으로.
- TV 쪽 [useTvRemote](src/hooks/useTvRemote.ts) — LiveBoardPage(1 · 2 · 4) · SignageBoardPage(3) · LiveBoardPb153Page(pb1 · pb2)가 쓴다: `board_tv_mode(지점, 열쇠, 번호, 지금 화면)`(TV 열쇠 `_board_branch_ok` · 지금 화면을 `tv_board_seen` 에 남기고 고른 화면을 받음) · 채널 `tv-mode:<지점 이름>`(event `mode`, payload `{slot, t}` — 이름 없음)을 들으면 바로 다시 읽음 · **앱 안 미리보기(iframe)에서는 아무것도 안 함** — 단 TvFitFrame 이 띄운 `embed=1` iframe(창이 1920×1080 이 아닌 TV — 부모 주소가 /tv/…) 안은 TV 그 자체라 그대로 한다(넘어가는 것도 그 iframe 안에서). **한 번도 화면을 고르지 않은 번호(set_at 없음)는 TV 시작 주소 그대로 둔다**(시작 페이지를 /tv/<지점>/pb1 로 직접 넣은 TV 등) — 앱에서 한 번 고른 뒤부터 따른다. PB 화면도 20분마다 새로고침(달리는 측정이 없을 때). 규칙 · 글은 [tvRemote.ts](src/lib/tvRemote.ts)(시험 tvRemote.test.ts) — 앱 줄 글: 켜짐 · ○○ / 측정 중 자동 / 바꾸는 중… / 꺼져 있어요.
- 서버 [20261108192720_tv_board_modes.sql](supabase/migrations/20261108192720_tv_board_modes.sql): `tv_board_modes`(지점 · 번호 · mode · 누가 · 언제) · `tv_board_seen` · `set_tv_board_mode` · `get_tv_board_modes`(그 지점 운영진 — `get_board_tv_key` 와 같은 기준 `_tv_board_staff_branch`; 그 번호의 원래 화면을 고르면 'home' 으로 저장) · `board_tv_mode`(anon). 같은 화면 부품을 쓰는 주소(/1 ↔ /2 ↔ /tv/<지점>)끼리는 다시 그려지지 않으므로 화면이 바뀌면 바로 알린다.

### 수강권 화면 — PT 남은 횟수 · 락카 번호 (2026-10-19 대표님)

- 멤버십 카드(`MembershipCard`, 수강권·내정보 공용)에 PT 회원은 수업권 이름·남은 횟수·기한, 락카가 있으면 락카 번호. 표시 규칙은 `src/lib/gymTicketInfo.ts`.
- PT 원본은 브로제이 PT 수업권 → 153OS 워커(매시 :40 UTC, 한 지점 18명씩 — 회원마다 24~48시간에 한 번 확인) → `sync-pt-members`(매시 40분)가 `profiles.pt_ticket · pt_remaining · pt_end_date · pt_checked_at` 에 옮긴다. 늦을 수 있어 카드에 "PT 횟수는 ○○ 기준"을 같이 적는다. `pt_until` 은 배지 유효일(확인일+7일)이라 기한으로 쓰지 않는다.
- 락카는 153OS 도 브로제이에서 읽지 않는다(6월 엑셀 한 번뿐). 지금은 지도진이 회원 상세(`MemberDetailPage` '락카' 줄)에서 넣는다 → `set_member_locker`(관리자 = 전체, 지점장·코치 = 같은 지점). `profiles.locker_label` 은 회원이 직접 못 바꾼다(guard). 본인·지도진만 본다 — 20261019200000.

### 153 마일리지 지급 — 전체관리자 (2026-11-09 대표님 「챔피언 머니처럼 회원님들 마일리지 드리는거 내 계정으로 할수있게 만들자」)

- 회원 상세 › 「153 마일리지」 칸 › '마일리지 지급' 줄(전체관리자만 보임 — 지점장은 지금처럼 '데스크 결제 할인'만): 줄 점수 · 사유(회원 마일리지 내역에 그대로 보임 · 60자 · 비우면 '153 보너스 마일리지') · '회원에게 알림 보내기'(기본 켬) → 확인 창 → `admin_grant_mileage`.
- 서버 [20261109213315_admin_grant_mileage.sql](supabase/migrations/20261109213315_admin_grant_mileage.sql): 전체관리자만 · 한 번에 1 ~ 100,000점 · 코치님 · 운영진(is_staff · 운영진 역할)과 합쳐진 옛 계정에는 안 줌 → 기존 `grant_mileage`(kind `adjust`, idem_key `admin-grant:<준 사람>:<요청 id>` — 두 번 눌려도 한 번) → 알림이면 `notifications`(link `/mypage`, 푸시 트리거) 한 통. 아낀 금액(`get_my_mileage_savings`)에는 섞이지 않는다. 화면 값(최대 · 사유 길이 · 기본 사유 · 확인 글)은 [src/lib/mileageGrant.ts](src/lib/mileageGrant.ts) 한 곳.
- 챔피언 머니 지급(`admin_grant_gems` · 지점장도)과 달리 마일리지는 1점 = 1원 결제 할인이라 전체관리자만 — 지점장에게 열려면 대표님 확인 뒤 서버 권한 검사와 `canGrantMileage` 를 같이 바꾼다.

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
- 마일리지로 아낀 금액 (2026-10-30 대표님 "배민처럼 지금까지 총 얼마를 할인받았는지 시각적으로"): `get_my_mileage_savings`(본인 · 원장 'order-use:'(취소 'order-refund:' 된 주문 빼기) + 'desk:') — [MileageSavedBanner](src/components/membership/MileageSavedBanner.tsx) band(마일리지 카드 맨 위 · 홈/내 정보 · 누르면 결제 내역) · line(결제 확인 창 마일리지 칸) · tile(내역 마일리지 탭). 결제 내역 '마일리지로 아낌'도 데스크 할인 포함. 할인받은 적이 없으면 안 그린다 — 20261030121816.
- 지금 쓰는 분들 끝나는 날(2026-10-27 한 번): 브로제이 지점은 매출(물품 '개인락커 · 운동복', 10,000원 = 1개월, 환불은 빼고, 오픈형 락카 · 동명이인 제외)로 추정, 칠금은 다짐 이용권 기간 그대로.
- 칠금은 매일 밤 다짐 → 앱: 153OS `app_rental_ends()`(다짐 rentalLocker · rentalSportsWear 끝나는 날 + '락커정보' 번호) → Edge Function [sync-rental-ends](supabase/functions/sync-rental-ends/index.ts)(23:40 KST, x-auto-key, `{dry_run:true}`) → 앱 `apply_rental_ends`(다짐 값이 있는 칸만, 다짐이 정본 — 락카 번호 포함) · 기록 `member_sync_runs`(mode `rental-sync`) — 20261027063559.
- 남은 일: 브로제이 지점 데스크 판매(락카·운동복)는 앱에 저절로 안 들어온다(앱 결제만 자동) — 대표님 '수강' 탭에서 고치기 · 153OS 워커에 렌탈 따로 보내기.
- **결제 취소**: 결제선생 관리자에서 승인 취소를 해도 콜백(apprState=C)이 오지 않는다(9/18 · 10/27 시험 모두 승인 F 만). → Edge Function [payssam-sync-cancels](supabase/functions/payssam-sync-cancels/index.ts)(x-auto-key, `{dry_run}` · `{bill_ids}` · `{days}`)가 paid 주문을 `/bill/read` 로 다시 조회해 apprState=C 면 주문 canceled → `revert_payment_order`(예전 주문은 수강권 일수 빼기) → 마일리지 트리거가 돌려줌 → 153OS `app_refund_paid_membership`(153OS DB 함수, 승인 때 만든 이용권·출입권한·payment_requests 를 거꾸로 — 153OS 워커 sync-refunded 는 404). 앱에서 이미 canceled 인데 153OS 에 남은 것도 맞춤(`raw._os_refund` 로 한 번만). 예약: 30분마다 7일 · 매일 05:20 KST 400일 — 20261027073702. 기록 `member_sync_runs`(mode `payssam-cancel`).
- 2026-10-27: Supabase MCP 의 SQL 쓰기(apply_migration · execute_sql DDL) 승인 창이 대표님 화면에 안 떠 계속 '취소'됨 → 대표님 허락("Db 항상 승인할게")으로 크롬 Supabase SQL 편집기에서 실행(파일을 GitHub raw 로 받아 sha256 확인 후 Monaco 에 넣고 Run). Edge Function 배포(MCP)는 됨. 크롬 번역이 켜져 있으면 실행 뒤 대시보드가 하얗게 멈출 수 있다 — 실행은 됐으니 DB 를 읽어 확인.

### 칠금점 회원 = 다짐매니저에서 매일 (2026-10-26 대표님 "다짐 매니저 크롬에 로그인 완료해놓았어")

- 칠금점은 브로제이가 아니라 **다짐매니저**(dagym-manager.com)를 쓴다. 대표님 노트북 크롬에 로그인해 둔 다짐매니저 회원 목록(파일 다운로드 없이 화면 데이터)을 예약 작업 「칠금점 다짐 회원·매출 동기화 (월~토 23:19)」(클로드·은미 계정 `trig_01CnMJjQ…` · 노트북 153boxing-yonghee 에 묶임 · 스크립트는 153OS `mkt_settings` 'dagym_sync_kit', 작업판 `ops:schedule:chilgeum-dagym-sync`)가 153OS 로 옮긴다. 지점장님 엑셀 올리기(BulkMemberImport)는 칠금점은 이제 안 해도 된다.
  - 예약은 **노트북 크롬의 클로드에 로그인한 계정**에서만 돈다 — 10/30 에 예약을 boxing5969 계정(23:59)으로 옮겼는데 크롬은 은미 계정이라 10/31 · 11/3 · 11/4 는 묶음만 열고 0명(2026-11-04 대표님 "다른계정 통해했었는데 이계정으로 컴퓨터 로그인을 했더니 안되고있는거같아" → 은미 예약을 다시 켬). 크롬 계정을 바꾸면 예약도 그 계정으로 옮기고 다른 쪽은 끈다. 23:19 는 boxing5969 의 23:59 보다 먼저라, 그쪽이 남아 있어도 already_done 으로 끝난다. 순서는 크롬 연결 확인 → 묶음 열기(크롬이 안 될 때 묶음이 30분 열린 채 남지 않게).
- 153OS(`tbxdrfowanyksgdicryl`, 저장소 밖 — 고칠 때는 DB 의 지금 정의 위에): `dagym_members`(다짐 회원 1줄 · 153OS 회원 연결) · `dagym_open_batch` → 페이지 스크립트가 `dagym_inbox_put`(anon, 30분 열린 묶음만) → `dagym_apply_batch` → `dagym_import`(새 회원 · 이용 중/만료 · `member_snapshots` 만료일 — 수업 이용권만, 락커·운동복·용품 제외) · `dagym_flush_app_sync`(cron 1분 25명, 요청 번호로 앱 응답 확인 · 429 는 다시) · `dagym_sync_report()`(숫자만).
- 앱으로는 기존 길 그대로: 153OS `members` 트리거 → `sync-members-to-app` → 앱 `profiles.membership_end`. 만료 90일 넘은 옛 회원은 새로 만들지 않는다. 다짐에 같은 전화번호로 두 사람이 있으면 앱 계정은 하나(알려진 1건).
- 다짐에서 번호·이름을 고치면 153OS 회원도 따라간다(153OS 값이 지난번 다짐 값과 같을 때만). 앱 가입 번호가 CRM 번호와 다른 회원(보호자 번호로 등록된 아이 · 번호를 바꾼 회원)은 153OS `members.app_phone` 에 앱 번호를 넣는다 — `v_members_for_app_sync.phone` = coalesce(app_phone, phone) 로 앱 계정을 찾고, 만료일은 CRM 번호(phone)로 읽는다(모든 지점 공통, 비어 있으면 예전과 같음). 2026-10-26 칠금 4명을 이렇게 잇고, 8/03 에 CRM 번호로 자동으로 만들어진 안 쓰는 계정 4개는 승인만 껐다(지우지 않음).

### 전체관리자 '등록' 칸 — 전 지점 수강권 등록 (2026-10-26 대표님 "일단 나만 볼 수 있게")

- 전체관리자 대시보드(`/admin`) 탭 '등록' — `role === "super_admin"` 에게만 보인다([src/components/RegistrationReportPanel.tsx](src/components/RegistrationReportPanel.tsx)). 오늘·어제·이번 주·이번 달·지난달·최근 3개월 · 지점별 · 날짜별 목록(신규·재등록·일일권·환불).
- Edge Function [registration-report](supabase/functions/registration-report/index.ts)(super_admin 만, verify_jwt) → 153OS `registration_report(p_from, p_to)`(anon·authenticated 막음): 브로제이 지점은 `sales_entries` '수강권'(신규/재등록은 같은 지점·같은 이름의 앞선 결제로 추정, 하루 한 지점씩 돌아가며 들어옴) · 칠금점은 다짐 매출 `dagym_sales`(다짐 '재등록 여부', 분할 결제는 한 건, 환불은 따로).
- 칠금 다짐 매출은 매일 예약 작업이 회원 목록과 함께 `/sales/list` 를 읽어 `dagym_sales_put` → `dagym_apply_batch`(kind sales → `dagym_import_sales`)로 넣는다. 2025-01 ~ 2026-10 은 처음에 한 번에 받았다(1,755줄).

### 153OS 앱 통로 — 공지사항 · 우리 지점(소개 · 코치 · 후기) · 1:1 문의 · 153OS 알림 (2026-11-02 대표님 「둘 다 차례로」)

일일경영리포트(153OS) 33단계에서 직원이 쓰는 화면(공지사항 · 푸시메시지 · 지점 소개 정보 · 코치 소개 · 후기관리 · 문의함)을 만들고, 회원 쪽은 153OS 워커 `/api/external/me/*` · `/push/outbox` 통로로 열어 두었다(153-boxing-os `docs/partner-api-app-content.md`). 이 앱이 그 통로를 붙인다. 글 · 사진 · 후기 · 문의는 153OS 에만 있고 앱 DB 에는 없다.

| 파일 | 역할 |
|---|---|
| [supabase/functions/os-app-content/index.ts](supabase/functions/os-app-content/index.ts) | 회원 화면 → 153OS. verify_jwt · 부른 사람 토큰의 계정 id 를 `X-Ranking-User-Id` 로, 키는 시크릿 `OS_PARTNER_KEY`(payssam-callback 과 같은 키) · op 로 정한 길만(notices · notice · branch · coaches · reviews · review_save · review_delete · inquiries · inquiry · inquiry_new · inquiry_reply) · 답은 늘 200 `{ok, data, message}` / `{ok:false, code, message}` |
| [supabase/functions/os-push-pull/](supabase/functions/os-push-pull/index.ts) | 153OS 앱 알림 → 알림함 · 휴대폰. 크론 매분 · x-auto-key · outbox 200줄씩 최대 3번 → `os_push_receive` → ack. 링크 바꾸기는 [logic.ts](supabase/functions/os-push-pull/logic.ts) `mapOsLink`(home · notices · notice:<id> · branch · coaches · reviews · inquiries → 앱 경로, classes 등 앱에 없는 화면은 링크 없음) — 테스트 src/lib/osPushPull.test.ts. 시험 body `{dry_run:true}`(받기만, ack 안 함) · `{probe_user:"<계정 id>"}`(그 계정으로 /me/branch 상태 코드만) |
| [supabase/migrations/20261102004148_os_push_inbox.sql](supabase/migrations/20261102004148_os_push_inbox.sql) | `os_push_inbox`(153OS 받는 사람 줄마다 한 번만 · 서버 키만) · `os_push_receive(p_rows)` — 처음 보는 줄만 `notifications` 에 문장 하나로 넣는다 → 기존 트리거가 push-send 한 번(휴대폰 알림 켠 회원 몫). 앱에 없는 계정 줄은 받기만 |
| [supabase/migrations/20261102004149_os_push_pull_cron.sql](supabase/migrations/20261102004149_os_push_pull_cron.sql) | 크론 `os-push-pull`(매분) — 앱 화면이 main 에 올라간 뒤 켠다. 끄기 `select cron.unschedule('os-push-pull');` |
| [src/services/osContentService.ts](src/services/osContentService.ts) · [src/lib/osContent.ts](src/lib/osContent.ts) | 훅(`["os", 계정, …]` 캐시) · 타입 · 운영시간 줄 · 문의 상태 · 후기 확인(별점 1~5 · 5~2000자, 153OS 와 같은 규칙) |
| [src/pages/NoticesPage.tsx](src/pages/NoticesPage.tsx) | `/notices` 목록(고정 먼저 · 우리 지점 + 전 지점) · `/notices/:id` 한 글 — 알림함 머리글 오른쪽 '공지사항' 단추 |
| [src/pages/BranchInfoPage.tsx](src/pages/BranchInfoPage.tsx) | `/branch` 소개(주소 · 전화 · 운영시간 + 153OS '앱에 보이기' 켠 소개 글 · 사진 · 링크) · `?tab=coaches` 코치 · `?tab=reviews` 후기(이름 첫 글자 + ○○ · 내 후기 쓰기/고치기/지우기 · `&write=1` 이면 쓰기 칸부터) |
| [src/pages/InquiriesPage.tsx](src/pages/InquiriesPage.tsx) | `/inquiries` 내 문의 · `?new=1` 새 문의(분류 6 · 하루 5건, 153OS 가 막음) · `/inquiries/:id` 대화(탭바 숨김 · 30초마다 다시 읽기 · 끝난 문의도 이어 쓰면 다시 열림) |

- 입구: 전체 메뉴 '153 안내' 묶음에 공지사항 · 우리 지점, '의견·신고' 묶음에 1:1 문의 · 검색 notices · branch · coaches · reviews · inquiries(검색 '공지'는 이제 공지사항이 먼저).
- 153OS 회원과 안 이어진 계정(153OS `members.ranking_app_user_id` 없음 — 코치 · 운영진 계정 포함)은 `NOT_REGISTERED` → 화면에 '지점 회원 정보와 아직 이어지지 않았어요' 안내만.
- 153OS 화면의 '앱 연결 전' 안내는 153OS `app_link_heartbeats` 가 사라지게 한다 — partner_api(회원이 화면을 열 때) · push_outbox(크론).
- 회원 1:1 메시지(`/messages`, 회원 · 코치님끼리)와 다르다 — 1:1 문의는 지점 운영진 창구(153OS 문의함에서 답장).
- **검수 고침 (2026-11-03 · 153OS 38단계 — 대표님 「다음작업과 최고성능 검수하자」)**: ① `os_push_receive` 링크 검사식 `{0,298}` 이 PostgreSQL 정규식 반복 한도(255)를 넘어 **줄마다 오류** → 153OS 알림이 한 줄도 못 들어오던 것을 고침([20261103123928](supabase/migrations/20261103123928_os_push_receive_link_fix.sql) — 모양은 `*`, 길이 2~300 은 char_length). 그날까지 보낸 알림 0건이라 잃은 것 없음. DB 정규식에 `{n,m}` 을 쓸 때 255 를 넘기지 않는다. ② os-app-content: 로그인 확인 실패도 200 `{ok:false, code:NOT_AUTHENTICATED}` · 153OS 오류 글은 회원에게 보여도 되는 코드(NOT_REGISTERED · NOT_FOUND · TOO_MANY · INVALID_REQUEST · MEMBER_WITHDRAWN)만 그대로 · 화면(`callOs`)은 FunctionsHttpError/FetchError 를 나눠 '인터넷 연결' · '다시 로그인' · '잠시 뒤'로 ③ os-push-pull 은 빈 쪽이 나올 때까지(최대 3번) ④ 1:1 문의 화면(목록 · 새 문의 쓰기 · 대화)에서 오삼코치 손잡이 · 튜토리얼 오삼이 숨김 · 153OS 회원과 안 이어진 계정엔 '새 문의 남기기' 없음 ⑤ 후기 고칠 때 코치는 153OS 가 보낸 `mine.coach_staff_id` 로(이름으로 찾다 지워지던 것) ⑥ 키오스크: 153OS 가 `fallback:true`(자기 DB 못 읽음)를 보내면 지난 설정 그대로 · 마지막으로 맞춘 서버 소리 값을 기기에 기억(`153_kiosk_sound_server`) · 글 정리 규칙을 153OS 와 같게(제어 · 서식 · 한글 채움 문자 빼고 이모지 잇기 U+200D 는 둠).
- **얼굴 출석 키오스크 설정**(153OS 35단계 '설정 › 출석 프로그램 설정' · 2026-11-02): [src/pages/FaceKioskPage.tsx](src/pages/FaceKioskPage.tsx) 가 켤 때와 1분마다 153OS `POST /api/face/settings`(x-kiosk-key = 지점)를 읽는다 → 얼굴 출석 쉬기(인식 멈춤 · 쉬는 화면) · 기다리는 화면 안내 줄 · QR 안내 · 인사 문구 · 호명 음성 `{이름}` · 소리(153OS 에 저장한 값이 바뀔 때만 기기 값을 맞춤) · 다시 인식 간격(분). 받기 · 기본값은 [src/lib/kioskSettings.ts](src/lib/kioskSettings.ts)(153OS `workers/api/src/lib/kioskSettings.ts` 와 같은 글 · 규칙), 화면은 [src/components/kiosk/FaceKioskOverlays.tsx](src/components/kiosk/FaceKioskOverlays.tsx). 못 읽으면(옛 워커 404 · 네트워크) 지금 키오스크 그대로. 출입 판단(verify)은 이 설정과 상관없다.

### 아이폰 앱 (App Store, 2026-10-19 대표님 "애플스토어에도 등록하자")

- 아이폰 앱은 `ios-app/` (Capacitor 8 iOS, 번들 `kr.boxing153.myboxer`, 아이폰 전용, iOS 16+). **myboxer153.com 을 그대로 담는다** — 웹을 고치면 앱도 바로 바뀐다(재심사 없음). 안드로이드는 TWA(구글 플레이)라 별개, 루트 `capacitor.config.ts` 는 얼굴 출석 키오스크 APK.
- 앱 판별: `isIosApp()`([src/lib/iosApp.ts](src/lib/iosApp.ts)) — UA 끝 `MyBoxer153App` + Capacitor. 앱 기능은 [src/lib/iosAppNative.ts](src/lib/iosAppNative.ts)(따로 내려받는 조각). **Capacitor 면 얼굴 키오스크로 보내는 main.tsx 분기에서 아이폰 앱은 빠져야 한다.**
- 로그인: 구글·카카오는 앱 안 웹 화면에서 막히므로 `signInWithOAuthInApp` → 안전한 로그인 창 → `/app-auth-return/` → `myboxer153://auth` → '/?code|#token'. 애플 로그인(`signInWithAppleInApp`, 심사 4.8)은 아이폰 앱에서만 보인다 — Supabase Apple 공급자 Client IDs 에 번들 ID 필요.
- 결제선생 결제는 앱 안 사파리 창(`openInAppBrowser`) — 실물 수업권이라 앱 안 구입(IAP) 대상 아님(3.1.3(e)). **디지털 상품(머니·캐릭터)을 돈으로 팔면 안 된다.**
- 휴대폰 알림: `push_subscriptions.kind='apns'`, 주소 `apns:<토큰>`, `push_subscribe_native` (20261019200500). 발송 push-send/apns.ts, 키 `internal_sync_config.apns_key` {keyId, teamId, p8, bundleId}.
- 심사 대응: AI 로 보내기 전 동의 `ensureAiConsent`([src/lib/aiConsent.ts](src/lib/aiConsent.ts), 5.1.2(i), 아이폰 앱에서만) · 앱 안 계정 삭제(설정 › 계정 삭제 → Edge Function `account-delete-request`: 기록 → 알림 끄기 → 전체관리자 알림 → 로그인 잠금, 7일 안에 회원 화면 '계정 삭제'로 마무리, 5.1.1(v)) · 고객지원 `/support/`.
- 빌드: `.github/workflows/ios.yml` — ios-app/ 이 바뀌면 GitHub 맥 서버에서 빌드. 비밀값 `ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_PRIVATE_KEY` 가 있으면 서명 → TestFlight 업로드(빌드 번호 = 실행 번호). 공개 저장소라 로그에 비밀값을 찍지 않는다.
- 스토어 글·심사 메모·개인정보 항목: [ios-app/store/listing-ko.md](ios-app/store/listing-ko.md).
- 권한 안내 문구(Info.plist, 2026-10-27): 카메라 = QR · 사진/영상 올리기 + 지점 회의실 영상 회의, 마이크 = 운동 영상 녹음 + 지점 회의실 음성 회의 '말하기'(녹음 안 함). 심사 메모에 코치 전용 지점 회의실 설명을 넣었다 — 새 기능이 마이크 · 카메라를 쓰면 문구도 같이 고친다.

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
  - 2026-11-12 체지방률 · 악력 백분위는 화면에서 계산해 '내 운동 기록' 「같은 나이와 비교」에 보여 준다(아래 절) — 서버 키는 그대로 null, 체력 나이는 아직.

### 같은 나이와 비교 — 체지방률 · 악력 상위 % (2026-11-12 대표님 "마이복서 153 운동기록에 비교할 수 있는 대상 — 내 나이 평균 신체와 내 신체 정보, 나는 이만큼 좋아졌고 나는 평균에서 어느 정도, 상위 몇 %")

| 파일 | 역할 |
|---|---|
| [src/data/nfaNorms.ts](src/data/nfaNorms.ts) | 기준표 — 국민체력100 2017~2019 측정 559,430명 나이(19~24 · 5살씩 · 85+) · 성별 5~95 백분위 · 평균 · 표준편차. Park 외(2022) 운동과학 31(4):511-526 doi 10.15857/ksep.2022.00332 표 2(체지방률 · 인바디 720) · 표 3(악력 kg · 좌우 2번씩 중 최고) |
| [src/lib/peerCompare153.ts](src/lib/peerCompare153.ts) | 나이대 · 백분위(5~95 사이 직선, 끝은 늘여 0.5~99.5) · 「상위 N%」 · 평균까지 · 처음보다 오른 계단 · 문구 한 곳 |
| [src/components/attendance/PeerCompareCard.tsx](src/components/attendance/PeerCompareCard.tsx) | '내 운동 기록' 153과 함께하며 다음 카드. 화면만 `PeerCompareBody`(시험 · 화면 확인용) + 데이터 `PeerCompareCard` |

- 내 값 = 이미 읽는 함수 그대로(DB 변경 없음): 성별 · 출생 연도 · 체지방률 처음/마지막 `get_my_fitness_extra` · 악력 처음/마지막 `get_my_fitness_profile`(코치 측정 포함). 나이 = 그해 − 출생 연도(만 나이와 1살 다를 수 있음), 만 19세 아래는 카드 없음(기준표가 성인부터).
- 화면: 주인공 = 가장 앞선 지표 하나 — 평균(그 나이 측정 평균)보다 좋거나 같으면 「상위 N%」(5% 안이면 '상위 5% 안', 10% 안 금색), 못하면 순위 대신 「평균까지 N」(다음 목표) · 막대(왼쪽 뒤 → 오른쪽 앞, 눈금 = 평균, 평균 숫자는 눈금 아래에만) · 나머지 지표는 한 줄씩 · 안 넣은 지표는 한 줄 권유 · 성별/나이/값이 없으면 같은 나이 평균 + '지금 넣기'(내 신체 정보). 출처 · 세는 법은 '계산 방법' 안.
- 처음보다: 처음 잰 날의 나이로 그때 순위를 다시 세서 비교 — 값이 좋아지고(체지방률 −0.1 · 악력 +0.1 넘게) 순위도 1계단 이상 올랐을 때만 「처음보다 N계단 올라왔어요 · 처음엔 상위 M%」.
- 체지방률 남 7% · 여 16% 이하(국민체력100 체성분 권장 범위 아래 끝)는 순위를 말하지 않고 '아주 낮은 편' · 주인공에서 뒤로.
- 기준표 숫자를 고치면 `src/lib/peerCompare153.test.ts` 가 줄마다 백분위 순서 · 평균 ≈ 50번째 · 표준편차 ≈ (95번째−5번째)/3.29 를 검사한다. 오삼코치 안내 = osamiFaq `att-peer`(문구를 바꾸면 같이).
- 국민체력100 인증 등급(1등급 = 70번째 · 2등급 = 50번째 · 3등급 = 30번째 이상, nfa.kspo.or.kr 등급표)은 상대악력(몸무게 대비) 등 다른 종목 · 다른 연도 기준이라 이 카드 숫자와 다를 수 있다 — 이 카드는 등급이 아니라 백분위(절대 악력 kg)를 쓴다.
- 누가 신체 정보를 넣었나 (2026-10-28 대표님): 회원관리(`BranchManagerHome`) 필터 '신체 정보 넣음 (N)' · 회원 줄 '신체 정보 M/D' — `get_body_info_entered`(rows = 키 · 몸무게를 넣은 회원과 마지막 날짜만, 값은 회원 상세 '내정보'에서 · missing = 앱에 들어온 적 있는데 안 넣은 회원 → 필터 '신체 정보 안 넣음 (N)', 20261028010734 · 전체관리자/관리자 = 전 지점, 지점장 = 자기 지점 · `body_info_staff_since` 전에 '나만 볼 수 있어요'를 보고 넣은 값은 세지 않음) — 20261028003432.
- 신체 정보 공개 · 비공개 (2026-10-28 대표님 "비공개 버튼 누르면 본인 외에는 아무도 못보는걸로"): '내 신체 정보' 맨 위 '누가 볼 수 있나요?'(누르면 바로 저장 · `set_my_body_info_private` → `member_body_privacy`, 기본 공개). 비공개면 `get_member_body_info` = {private:true}(값 없음, 회원 상세에 '회원이 비공개로 했어요') · `get_body_info_entered` 넣음/안 넣음 어디에도 없음 · `get_my_fitness_profile` 지도진 보기와 `member_fitness_measures` 읽기 권한에서 회원이 넣은 값(source 'me') · 몸무게 빠짐 — 코치님이 잰 153 PB · 측정(source 'coach')은 그대로. `_body_info_private(uid)` — 20261028011318.

### 붕대 감기 12단계 설명서 — 그림 애니메이션 (2026-10-30 대표님: 코팅 설명서 사진 "이사진이랑 동일하게 … 고화질 애니메이션으로")

- /handwrap 맨 위 = 12단계 + 완성(코팅 설명서와 같은 순서 · 글 `sheet`). 한눈에 12칸 + 완성 → 누르면 상세 `?step=N`(1~13, 13 = 완성, 뒤로 가기로 닫힘): 그림 손에 붕대가 차례로 감기는 애니메이션이 반복된다(누르면 멈춤). [HandWrapStepViewer](src/components/handwrap/HandWrapStepViewer.tsx).
- 시작(초록) · 끝(주황) 점 · 바퀴 수 · 손바닥 쪽 길(남색 점선) · '손가락 사이로 넣어요' · '손바닥 쪽'(뒤집어 본 모습) 표시는 **그림 안에** 들어 있다 — 앱이 위에 그리지 않는다(예전 HandWrapGuideDraw 좌표 방식은 지움). 그래서 상세 그림 위 앱 표시(몇 단계 · 멈춤)는 아래쪽에만.
- 손마다 따로 만든 그림: 오른손(기본) `stepNN.mp4 · .webp · _s.webp` · 왼손 `stepNN_l…` (거울로 뒤집지 않아 글자가 바르다). 손등에서 붕대는 처음부터 끝까지 엄지 쪽 → 새끼 쪽. 글 속 ↗ ↘ 는 오른손 기준(왼손이면 `mirrorArrows`).
- 글 · 그림 주소는 [handWrapGuide.ts](src/data/handWrapGuide.ts) `HANDWRAP_STEPS` 한 곳. 그림을 다시 만들면 `STEP_MEDIA_VERSION` 을 올린다. 작은 그림 `_s.webp` = 끝 장면(위 글 띠 없이)을 손 쪽 정사각형으로.
- 대표님 10-20 영상 칸('영상으로 보기' · 내 눈으로 / 옆에서 / 앞에서)과 9단계(실제 영상 장면)는 화면에서 내렸다. `public/handwrap/front · side` 파일은 되살리기 쉽게 남겨 둠. 훈련 라이브러리에 코치가 영상 주소를 넣으면 '코치 영상 보기' 단추만 붙는다.
- 훈련 라이브러리 '복싱 붕대 감기' 글(DB)은 아직 '9단계 설명서'라고 적혀 있다 — 대표님 승인 뒤 고친다.

### 만족도 조사 답변 (2026-10-30 대표님 "만족도 조사 설문조사에도 답변을 달 수 있도록" · 누가 보나요? "쓴 사람이 확인할 수 있게")
- 응답은 예전처럼 153OS 에 익명 저장(본사 받은 설문함도 계속 익명). `submit_survey_response` 가 돌려주는 `response_id` 를 앱이 `record_my_survey_receipt` 로 남긴다(`survey_receipts` = 응답 번호 + 보낸 회원 · 답한 내용은 안 남김).
- 본사(전체관리자 · 관리자): 받은 설문함(`/survey?inbox=1`) 만족도 조사 카드마다 '답변 달기 · 고치기 · 지우기(빈 칸)' → `reply_survey_response`(`survey_replies`). 앱에서 낸 설문이면 보낸 회원에게만 알림(`/survey?mine=1`) · '회원이 읽었어요' 표시. QR · 예전 설문은 보낸 사람을 몰라 저장만.
- 회원: 설문 첫 화면 맨 아래 '내가 보낸 의견'(2026-11-03 부터 `get_my_voice_receipts` · 최근 30개 · 만족도 조사 + 고객의 소리 한 목록) — 답변 · '새 답변' · 보면 읽음(`mark_my_survey_replies_read`). 두 표는 직접 읽기·쓰기 막음, 함수로만 — [20261030100752_survey_replies.sql](supabase/migrations/20261030100752_survey_replies.sql). 옛 `get_my_survey_receipts` 는 옛 화면용으로 남겨 둠.
- **고객의 소리 답변 · 한 목록 (2026-11-03 대표님 "고객의 소리에도 답변 달수있게해줘 · 두가지 모두 한탭으로 합쳐줘 … 고객 여정에 더 도움이 되게 니가 추천해줘")** — [20261103175430_voice_replies.sql](supabase/migrations/20261103175430_voice_replies.sql)
  - 입구 두 개(만족도 조사 = 한 달에 한 번 정해진 질문 · 고객의 소리 = 언제든)는 그대로 — 설문 안에 넣지 않았다(설문을 이미 한 달 · 설문이 닫힌 때 고객의 소리를 못 찾게 되므로). 보낸 뒤 답을 보는 곳만 '내가 보낸 의견' 하나로(고객의 소리는 내가 쓴 글도 같이 — 원문은 153OS 에만, Edge Function `member-voice-receipt` op `mine` 으로 내 영수증 번호만 읽는다).
  - `survey_receipts.kind` = 'satisfaction' | 'feedback'(153OS member_feedback.id). 153OS 공개 경로 `/api/feedback/submit` 은 글 번호를 돌려주지 않아서, 회원 화면이 보낸 직후 Edge Function [member-voice-receipt](supabase/functions/member-voice-receipt/index.ts) op `claim` → 153OS 에서 그 의견함 · 같은 분류 · 같은 글 · 같은 별점 · 10분 안 · 영수증 없는 줄이 **하나뿐일 때만** 서버 키로 영수증(겹치면 안 남김 — 다른 회원에게 답이 가지 않게). 판정은 [logic.ts](supabase/functions/member-voice-receipt/logic.ts)(테스트 src/lib/memberVoiceReceipt.test.ts). 153OS 워커가 나중에 글 번호를 돌려주게 되면 그 번호로 좁히면 된다.
  - `reply_survey_response`: 알림 문구 종류별('💬 고객의 소리에 답변이 왔어요') · 대표님이 쓰거나 고친 답변은 `auto=false`(자동 답변을 고쳐 쓰면 대표님 답변).
  - 본사 받은 설문함(`MemberVoiceInbox`): 탭 두 개 → **한 목록**(최근 것부터, 만족도 조사 · 고객의 소리 섞어서) · 거르기 전체 / 답변 대기(앱에서 보낸 것 중 답 없는 것 — 카드 테두리 · '답변 대기 · 회원에게만 가요') / 만족도 조사 / 고객의 소리(`&tab=voice`). 고객의 소리 카드에도 '답변 달기'. 153OS 처리 상태는 '새 의견'이 아닐 때만 아래 줄에.
  - 대표님 알림: `survey-auto-reply` 크론이 고객의 소리(서키트 빼고 · 14일)도 읽어 답이 없고 아직 안 알린 것을 **알림 하나로 묶어**(1건 = 지점 · 분류 · 글 앞부분, 여러 건 = 'N건이 답변을 기다려요') 8~22시에 → `/survey?inbox=1&tab=voice`. 고객의 소리는 자동 답변 없음(대표님이 직접). 기록 `survey_auto_watch.kind='voice'`.
  - 그 전에 앱에서 낸 고객의 소리 8건(10/15~11/03)은 참여 보상 지급 시각(`survey_rewards` kind 'feedback')이 글 들어온 시각 3초 안에 하나씩 짝지어 있어 그 회원으로 영수증을 채웠다(데이터 작업).
- 자동 답변 · 의견 알림 (2026-10-30 대표님 "의견 없고 긍정적인 답변만 하신 분들에게는 하루 지나고 내가 남긴 것처럼 … 의견이나 개선은 나한테 알림"): Edge Function `survey-auto-reply`(크론 15분 · x-auto-key · verify_jwt false) — 판정·문장은 [logic.ts](supabase/functions/survey-auto-reply/logic.ts)(테스트 src/lib/surveyAutoReply.test.ts).
  - 긍정만 = 별점 모두 4점 이상 · 보기 '특별히 없습니다'(만료 회원 '개인 사정'도) · 적은 글 없음 · '아니오' 없음 → 낸 지 24시간 지나도 답이 없으면 한국 시각 9~21시에 대표님 계정(마지막으로 직접 단 답변의 주인)으로 답변(`survey_replies.auto` true · 회원에겐 구분 안 보임). 감사 + (추천·코치 5점·다시 이용 한마디) + 건강·행복 + 노력하는 체육관 — 응답 번호로 정해져 같은 응답은 같은 문장, 최근 10개와 겹치면 바꾼다.
  - 그 밖(개선 보기 · 3점 이하 · 적은 글 — 칭찬 글도 대표님이 직접) → 답이 없으면 대표님께 알림 한 번(8~22시, '📋 만족도 조사에 의견이 왔어요' → /survey?inbox=1). 처리 기록 `survey_auto_watch`. 대표님이 먼저 답하면 손대지 않고, 대표님 답변은 덮어쓰지 않는다.
  - QR · 예전 응답의 보기 답은 글 없이 번호(answer_score)만 있다 → `member-voice-inbox` · `survey-auto-reply` 둘 다 보기 글로 채운다(받은 설문함에 '답 없음'으로 보이던 것, 2026-10-30).
  - 시험: body `{dry_run: true}` → 할 일만 돌려준다. 끄기 = `select cron.unschedule('survey-auto-reply')`. 마이그레이션 20261030114131 · 20261030114756.

### 타이틀미션 「왜 미트를 잡아 줄까」 탭 · 레벨 10 3일 이야기 (2026-11-05 대표님 "레벨 10에 왜 미트를 대 주고 지도를 해 봐야 하는지 설득하는 탭 만들고, 레벨 10이 되면 이 글 3일간 발송되게 하자")

| 파일 | 역할 |
|---|---|
| [src/lib/titleTeachLessons.ts](src/lib/titleTeachLessons.ts) | 「설계 노트」 3편 정본(11:24 대표님 다시 씀 — 설득 대신 '3번 공격 · 3번 미트로 만든 이유' 설명 · 긍정어) — ①가르치기(가르쳐 본 사람이 가장 오래 기억 · 연구 3 + 하버드 동료 교수법 · 파인만 · 수능 만점자 · 3-2-1) ②함께 자라기(짝 연습 · 지켜보기 연구 3 + 유도 자타공영 · 올블랙스 · 가완디) ③반복(3번 연속 확률 · 연구 3 · 153의 성장 순서 도전 → 몰입 → 다시 도전 → 성장 · 「반복은 천재를 만든다」) · 편마다 머리말 → 큰 제목 → 설명 → 연구(실험 자세히) → 이야기 → 153 체육관에서는 → 오늘 해 볼 것 하나 → 출처 · 알림 글 `notice` · 탭 이름 `TEACH_TAB_LABEL` · 카드 제목 `TEACH_SERIES_TITLE` (테스트 titleTeachLessons.test.ts — 부정어 · 근거 없는 말 검사) |
| [src/components/titlematch/TitleTeachTab.tsx](src/components/titlematch/TitleTeachTab.tsx) | 타이틀미션 카드(TitleMatchChallengeCard) 위 탭 「도전 방법 · 왜 미트를 잡아 줄까」의 두 번째 탭 — 세 편 칸 · 9동작 외우는 말 덩어리 · 1편 행동 = 오늘 같이 해요(`/myboxer/community?together=1`) · 3편 행동 = 아래 심사 신청 버튼 |
| [supabase/migrations/20261105011632_title_teach_drip.sql](supabase/migrations/20261105011632_title_teach_drip.sql) | `title_teach_drip`(회원 · 리그 · 편 · due_at · sent_at · skipped) · member_progress 트리거 `title_teach_on_progress`(화이트 레벨 10 이 되는 순간 · 신청 흐름이 열린 시범 지점만 · 통과 전) → `title_teach_start` 가 3편을 잡는다 · `title_teach_dispatch()` 10분마다(cron `title-teach-dispatch`) → `notifications`(링크 `/title-match?lv=10&why=1~3`) |

- 보내는 때: 1편 = 레벨 10 + 1시간 · 2 · 3편 = 다음 평일들 같은 시각 · 평일 08:00~21:00(잡는 시각은 20:30 까지)만 · 주말은 건너뜀 · 앞 편 뒤 18시간 안엔 다음 편 없음 · 통과했거나 리그가 바뀌면 남은 편은 `skipped`. 한 회원 · 한 리그에 한 번.
- 알림 글(제목 · 한 줄)은 DB 함수와 `titleTeachLessons.ts` `notice` 두 곳 — 바꾸면 둘 다. 화면 글(본문)은 lib 한 곳.
- 스위치 `internal_sync_config` `title_teach_drip` = 'on' | 'off'(보내기도 멈춤) · 끄기는 `select cron.unschedule('title-teach-dispatch');` 도.
- 켬 (2026-11-05 08:2x 대표님 「켜기 + 기존 레벨 10에도」 — MCP `apply_migration`): 이미 레벨 10 이던 회원 중 최근 14일에 출석한 47명(모두 일반 회원)에게도 `title_teach_start(user_id, 'white', now())` — 1편 11/5(목) 09:24 · 2편 11/6(금) · 3편 11/9(월) 같은 시각. 오래 안 온 회원은 넣지 않았다.
- 휴대폰 알림을 켠 회원은 적다(11/05 레벨 10 회원 96명 중 5명) — 대부분 알림함으로 본다. 탭은 알림과 상관없이 화이트 리그 시범 지점 회원 모두에게 보인다.
- 운영진 미리 보기 (2026-11-05 대표님 "먼저 어떻게 나가는지 내가 확인할수있게"): 전체관리자가 `/title-match?lv=10&why=1~3` 을 열고 회원 카드 조건이 아니면(대표님 계정은 블루) TitleMatchPage 가 '운영진 미리 보기' 칸에 같은 TitleTeachTab 을 보여 준다. 대표님 계정에 회원과 같은 알림 3개를 한 번 보냄(11/05 11:17).
- 글 근거(2026-11-05 원문 요약을 하나씩 확인): 연구로 보면 = 확인한 연구만 · 체육관에서는 = 153 의 적용(미트 잡기 자체를 다룬 연구는 없다). '가르치면 90% 기억'(학습 피라미드 — 근거 없음) · 잠 하룻밤 20%(반론 있음) · '3번 · 7일이 최적'은 쓰지 않는다. '절반만 쳐도 같다'는 비에룸 2014(내시경 시뮬레이션) — 셰이 1999 는 '번갈아 하며 지켜본 쪽이 앞질렀다'. 그라나도스 · 울프 2007 은 대화 효과가 없었다(지켜보기만).
- 11:24 다시 씀 — 화면(토스식: 큰 제목 한 문장 · 상자 줄이고 여백 · 연구는 번호 줄 + '실험 자세히'로 펼침) · 알림 글 [20261105113800_title_teach_notice_v2.sql](supabase/migrations/20261105113800_title_teach_notice_v2.sql)(title_teach_dispatch 글만 — 11-05 15:23 대표님 「올려」 뒤 MCP 로 적용, DB 본문 = 이 파일). 사람 이야기는 기사 · 책에서 확인한 것만 — 수능 만점자 인터뷰에는 '친구를 가르쳤다'가 없어 '문제를 만들어 친구와 함께 풀었다'만(이름 없이), 서울대는 확인된 자료가 없어 뺐다.
- 12:19 「잘 읽히는 페이지 · 이미지와 글 · 출처와 영상」 — 편마다 맨 위 실제 수업 사진 `public/assets/title-teach/hero-1~3.webp`(홈페이지 사진, 지점 이름은 확인 못 해 '153복싱짐'만) · 이야기 · 단계마다 153 입체 아이콘(`icon3dSrc`) · 연구 · 이야기 출처 이름을 누르면 원문(아이폰 앱은 앱 안 사파리) · 편마다 '실험 자세히' · 3편 숫자 칸 막대 + 계산 한 줄 · 영상: 1편 = 그 리그 레벨 10 미션 영상 3개(`useTitleMatchVideos`), 2편 = TED 가완디 + 153 쇼츠(`short-XOhXvrtik6U.webp` 표지), 3편 = TED 칙센트미하이. **TED 는 표지가 강연자 얼굴 사진이라 그림 없이 글 카드**로 · 한국어 자막은 TED 페이지 링크(유튜브 한국어 자막은 확인 못 함 — 자막만 켜 둠) · 영상 창 '핵심 포인트'는 TED 한국어 자막에서 확인한 말만. 읽는 시간 = 빈칸 빼고 400자/분 올림.
- MCP 적용 팁: 맨 위에 `drop trigger` · `cron.unschedule` 가 든 판은 확인 창이 0.8초 만에 저절로 취소됐다 → `create or replace trigger` · 같은 이름 `cron.schedule`(pg_cron 이 바꿈) · 설정 줄은 `on conflict do nothing` 으로 바꾸니 바로 들어갔다.

### 영상 올리기 — 50MB 넘으면 휴대폰에서 자동으로 줄이기 (2026-11-12 대표님 「영상올릴때 자동으로 압축해서 50mb이하로줄여줘」)

| 파일 | 역할 |
|---|---|
| [src/lib/videoCompress.ts](src/lib/videoCompress.ts) (+test) | `compressVideoToLimit(file, { maxBytes, signal, onProgress })` — WebCodecs(휴대폰 하드웨어 인코더) + `mediabunny`(1.62.1 고정 · MPL-2.0 · **dynamic import** — 줄일 때만 받는 따로 묶음, 약 190KB gzip). 계산 `planVideoCompression`(순수 함수): 목표 = 한도 × 0.85 · 길이로 비트레이트 → 크기 720p(1.4Mbps↑) · 540p(0.8↑) · 480p(0.45↑) · 360p, 원본보다 키우지 않음 · 30fps 넘으면 30 · 최대 2.5Mbps · 0.2Mbps 밑이면 '너무 길어요(○분 안으로)'. 소리는 AAC · MP3 복사, 그 밖은 AAC 로 다시(못 하면 뺌). 결과가 넘치면 비트레이트를 낮춰 다시 · 인코더 오류면 한 단계 작게(16의 배수) — 모두 3번까지. 출력 H.264 mp4(faststart) |
| [src/components/titlematch/TitleMatchJudgePanel.tsx](src/components/titlematch/TitleMatchJudgePanel.tsx) | 지점장 심사 칸 — 찍어 둔 영상(또는 앱 촬영본)이 50MB 넘으면 버튼 자리에 '영상 줄이는 중 ○%' 막대 · 멈추기 → 끝나면 미리보기 '○MB (원래 ○MB)' + 알림. 50MB 이하는 손대지 않고 그대로 올린다 |

- 실패 문구는 `videoCompressErrorMessage` 한 곳 — 함께 「'앱으로 촬영'을 쓰면 처음부터 작게 저장돼요」.
- 못 줄이는 경우: WebCodecs 가 없는 기기(iOS 16.4 전 · 아주 옛 안드로이드) · 휴대폰이 못 푸는 형식(HEVC 를 못 푸는 기기 등). 다른 앱으로 가거나 화면이 꺼지면 휴대폰이 인코더를 거둘 수 있어 줄이는 동안 화면 켜 두기(Wake Lock)를 잡는다.
- 2026-11-12 클라우드 크롬 시험(소프트웨어 인코더): 68.8MB 1080p60 45초 → 14.7MB 720p30(37초) · 세로 회전 MOV 72MB → 13.3MB 720×1280 · VP9+Opus WebM 68MB → 18.8MB(이 크롬은 AAC 인코더가 없어 소리 뺌) · 한도 8MB → 7.0MB 540p · HEVC → '형식' 문구 · 멈추기 · 50MB 아래 그대로.
- 다른 50MB 올리기(전략 회의 영상 `StrategyVideos` · `strategyService`)는 아직 예전처럼 막기만 한다 — 같은 함수를 붙이면 된다.

### 타이틀매치 심사 영상 2개 — 치는 영상 · 받는 영상 (2026-11-12 대표님 「영상도 2개 올려야해 치는거 받는거」)

- 심사함(`TitleMatchJudgePanel`) 도전마다 칸 2개: ① 치는 영상(완벽한 자세로 3번 연속) ② 받는 영상(파트너에게 미트로 3번 받아주기). 칸마다 앱으로 촬영 · 찍어 둔 영상 · 50MB 넘으면 자동 줄이기(한 번에 한 칸씩). **합격은 두 영상 모두, 불합격은 치는 영상만으로도**(3번 연속이 안 되면 받기까지 못 간다) — 화면 `attemptUploadBlocker`([src/lib/titleMatchChallenge.ts](src/lib/titleMatchChallenge.ts)) = 서버 규칙. 칸 이름 · 안내 · 촬영 창 안내 한 줄은 `TITLE_CLIPS` 한 곳.
- 올리기(`useRecordTitleAttempt`): 치는 영상 → 받는 영상 차례로 저장소(`…-hit.mp4` · `…-recv.mp4`) → `record_title_match_attempt_v2(_member_id, _hit_video_path, _receive_video_path, _passed, _note)`.
- DB [20261112161952_title_match_two_videos.sql](supabase/migrations/20261112161952_title_match_two_videos.sql): `title_match_attempts.receive_video_path`(새 칸) · v2 새 함수(v1 본문 그대로 + 받는 영상 검사: 이 회원 폴더 · 실제 파일 · 치는 영상과 다른 파일 · 합격이면 꼭) · `get_title_match_state` 도전 기록에 `receiveVideoPath`. **v1(영상 1개)은 옛 화면 호환용으로 남겨 둔다 — 새로 고치지 않는다.**
- 도전 기록(`TitleAttemptList`, 회원 화면 · 심사함): 받는 영상이 있으면 단추 '치기' · '받기', 영상이 하나면(예전 기록 · 치는 영상만 올린 불합격) '영상'. 회원 안내(`titleMissionRules`)도 '치는 영상 · 받는 영상을 찍어 앱에 올려요'.

### 로드맵 칸 (2026-10-30 대표님 "로드맵 메뉴가 안 보여" · "검색해도 안 나오고")
- 랭크업(`/rank-up` — 40단계 길 · 리그별 레벨업 기준 · 타이틀매치 · 단증 도전)은 10-10 하단 '랭크업' 탭을 뺀 뒤 MY복서 라이센스 카드 승급 막대로만 들어갈 수 있었다.
- 전체 메뉴(`src/lib/appMenu.ts`) 단독 칸 **「로드맵」**(글리프 `roadmap` = 접힌 지도 + 민트 점선 길 + 금 깃발) — 회원은 MY복서 다음 2번째, 코치진은 153운영본부 다음. 검색 `f:rankup` 이름 「로드맵 · 레벨업 기준」 · 관련어 로드맵 · 랭크업 로드맵 · 40단계 · 단증 도전 (테스트 appSearch.test.ts · officeLayout.test.ts).

### 창(모달·시트) 뒤 페이지 스크롤 잠금 (2026-10-19)

- `useModalDismiss(open, onClose)` 또는 `lockBodyScroll()`([src/lib/scrollLock.ts](src/lib/scrollLock.ts))만 쓴다 — 잠금 개수를 세서 마지막 창이 닫힐 때만 푼다.
- `document.body.style.overflow` 를 창마다 직접 기억·복원하지 않는다. 창이 겹치면(지금 운동 중 전체화면 → 회원 카드) 닫은 뒤에도 hidden 이 남아 페이지가 안 내려간다(대표님: "지금운동중 회원카드 클릭후 밑으로 스크롤이 안됨").

### 아이폰(사파리 · 웹킷)에서만 어긋나는 그림 (2026-11-09 대표님 "아이폰은 ui가 싱크가 잘안맞아")

- `svg` · `img` 를 `position:absolute` + `inset`(양쪽 0 아닌 값)만으로 크기 잡지 않는다 — 크롬(안드로이드 · PC)은 칸 안으로 늘려 멀쩡해 보이지만, 웹킷(아이폰 앱 · 사파리)은 제 크기(width/height 없는 svg 는 칸의 100%)로 그린 뒤 left/top 만큼 밀어 **오른쪽 아래로 칸 밖에 넘친다**. left · top · width · height 를 직접 주거나, 크기 가진 span 안에 `h-full w-full` 로 넣는다. 같은 일: 10/18 붕대 그림 img(2562114) · 11/09 전체 메뉴 글리프 svg(`GlyphTile` — `SVG_GLYPH_BOX`). 크롬 390px 화면 확인만으로는 안 보인다.

### 홈 당겨서 새로고침 (2026-11-06 대표님 "마이복서 153홈에서 위로 한번더 올리면 새로고침되게 해줘")

- 브라우저 기본 당겨서 새로고침은 `index.css`(html, body `overscroll-behavior: none`)로 꺼 둔 그대로 — 홈(`/home` · `/myboxer`)에만 [src/components/home/HomePullToRefresh.tsx](src/components/home/HomePullToRefresh.tsx)를 둔다. 맨 위에서 72px(저항 뒤) 넘게 끌고 놓으면 알약 표시 '놓으면 새로고침' → 도는 표시 → '새로고침 완료'.
- 놓으면 `queryClient.refetchQueries({ type: "active" })` + `refreshProfile()`(내 정보 · 역할 · 진행도) — 페이지를 통째로 다시 열지 않는다(흰 화면 · 앱 접속 출석 · 보상 자동 받기가 다시 돌지 않게). 창이 열려 있음(body 스크롤 잠금 · `aria-modal`) · 가로 밀기 · 안쪽 스크롤 칸이 맨 위가 아님 · 홈의 전체 화면 · 시트가 열림이면 받지 않는다. 시험 `HomePullToRefresh.test.tsx`.

### 운동 달력 1단계 — 홈 첫 화면 · 내 운동 기록 (2026-11-12 선릉역점 봄 회원 제안 → 대표님 「추천대로 진행하자」 · 보고서 https://claude.ai/artifact/4s6m5nxaghb8Hpqxpx79Rn)

| 파일 | 역할 |
|---|---|
| [src/lib/attendanceCalendar.ts](src/lib/attendanceCalendar.ts) | 날짜 계산 한 곳 — 월요일 시작 주 · 달력 4~6줄 · 넘겨 볼 달(첫 기록 달 ~ 이번 달) · 날짜 → 그날 출석. KST 'YYYY-MM-DD' 글자 그대로 (시험 attendanceCalendar.test.ts) |
| [src/components/attendance/WorkoutCalendar.tsx](src/components/attendance/WorkoutCalendar.tsx) | 카드 하나 — 접힘 = 이번 주 7칸 · '달력 펼치기' = 한 달(‹ › 첫 기록 달까지) · 출석한 날 = 민트 도장(누르면 들어온 시각 · 운동 시간 한 줄) · 오늘 = 테두리 · 칩 = n주 연속(2주부터, 아니면 접혔을 때 'n번 왔어요') · 펼침은 기기마다 `153cal:<화면>:open` |
| [src/components/home/HomeWorkoutCalendar.tsx](src/components/home/HomeWorkoutCalendar.tsx) | 홈 첫 화면(view menu) '내 운동' 바로 아래 — 출석이 한 번도 없으면 안 그림 · `homeWidgets.workoutCalendar`(기본 켬) |
| AttendanceHistoryPanel `WeekCard` | 내 운동 기록 '이번 주'도 같은 조각 — 제목 '이번 주' → 펼치면 '운동 달력' · 응원 한 줄은 접혔을 때만 |

- 숫자는 `get_attendance_history` 그대로(홈 '내 운동' · 내 운동 기록과 같은 캐시) — DB 변경 없음. 출석 '횟수'를 주인공 숫자로 두지 않는다(10-22 대표님 「몇 번 말고 몇 시간」) · 빠진 날 표시 없음.
- 끄기 = 홈 커스터마이즈(MY복서 화면) 맨 위 '첫 화면' 칸 — `HomeWidgetMeta.firstScreen`(켜고 끄기만 · 순서 단추 없음 · MY복서 슬롯에는 그리지 않음, renderers 는 null).
- 다음 단계(보고서 순서): 2단계 운동 약속(`myboxer:ops-schedule` 설계 — 약속한 날 = 민트 테두리 → 출석하면 채워짐 · 빠지면 회색 점) · 3단계 오늘의 체크(다 채운 날 금색 별) · 4단계 153OS 공지 '일정 날짜' · 한 줄 템플릿 칩. 모두 이 카드의 날짜 칸에 얹는다.

### 153플레이 「음악」 탭 — 체육관 자동재생 (2026-11-11 대표님 「153플레이에 복싱 음악 따로 모아놓자 · 복싱짐에서 틀 수 있는 인기 음악 100곡 · 카테고리 · 체육관에 자동재생 — 광고도 없고 멈추지도 않게」 · 「100곡 더 찾아줘 최신곡으로」)

| 파일 | 역할 |
|---|---|
| [src/data/gymMusic.ts](src/data/gymMusic.ts) | 곡 목록 정본 200곡 — 7 카테고리(최신 100 · 레전드 16 · K-POP 28 · 힙합 10 · EDM 16 · 록 16 · 팝 14). 「최신」 = 2025~2026 발매 · 2026-11-11 유튜브 한국 인기곡 Top100 + 레이블 · 가수 공식 채널 최근 뮤직비디오. 공식 채널 영상만(가수 · 레이블 · VEVO · 공식 OST · 방송사), 퍼가기 허용 확인(2026-11-11 oEmbed 200/200), 욕설 · 선정성 센 곡 · 어두운 분위기 곡은 뺐다(키즈 · 여성부). **DB 에 넣지 않는다** — boxing_programs 에 넣으면 라이브러리 · AI 수업 · 옛 153library.pages.dev 에 훈련 영상처럼 섞인다 |
| [src/components/library/GymMusicSection.tsx](src/components/library/GymMusicSection.tsx) | 153플레이 NAV 「음악」(BoxingLibraryPage `music`) — 카테고리 여러 개 고르기 · 곡 누르면 그 곡부터 · 자동재생 · 빼 둔 곡 다시 넣기 · ? 안내 |
| [src/components/library/GymMusicPlayer.tsx](src/components/library/GymMusicPlayer.tsx) | 전체 화면 플레이어 — 섞어서 끝없이 · 멈춤 감시 2초 · 못 트는 곡 건너뛰기 · 연달아 실패하면 15→30→60초 기다렸다 다시(인터넷 끊김) · `online` 이면 바로 · Wake Lock · 영상 누르기 막음(실수로 멈춤 방지, 조작은 아래 단추) · 키보드(스페이스 · ← →) |
| [src/lib/gymMusicQueue.ts](src/lib/gymMusicQueue.ts) (+test) | 섞기(같은 가수 연달아 X · 방금 들은 곡이 다음 바퀴 첫 곡 X) · 멈춤 감시 규칙 `watchdogAction` · 기다림 `retryDelayMs` |
| [src/lib/youtubeIframeApi.ts](src/lib/youtubeIframeApi.ts) | 유튜브 IFrame API 한 번만 받기(실패하면 다음에 다시) |

- 주소: `/library?tab=music`(탭) · `&play=1`(바로 플레이어 — 체육관 기기 즐겨찾기) · `&cats=kpop,edm`. 기기마다 기억(localStorage): `153play_music_cats` · `153play_music_hidden`(이 곡 빼기) · `153play_music_vol`.
- **광고는 앱이 못 끈다** — 체육관 기기 브라우저에 유튜브 프리미엄 로그인 + 유튜브 쿠키 차단 끄기. 그래서 이 플레이어만 `youtube-nocookie` 가 아니라 `www.youtube.com` 을 쓴다(로그인 쿠키가 있어야 프리미엄이 적용).
- 브라우저는 소리 나는 자동재생을 처음 한 번 눌러야 허락한다 — 한 곡도 못 틀었고 사람이 재생 화면을 누른 적이 없으면 '화면을 한 번 눌러' 덮개(`needTap`), 누른 뒤부터는 보통 규칙(건너뛰기).
- 광고가 나오는 동안에도 상태가 '재생 중'일 수 있어서 '재생 중인데 시간이 안 감'은 150초까지 기다린다 — 줄이면 프리미엄이 아닌 기기에서 광고마다 곡이 넘어간다.
- 곡을 바꾸려면 `gymMusic.ts` 만 고친다 — 공식 채널만 · `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>` 가 200(401 = 퍼가기 막힘) · 시험이 200곡(최신 100) · id 형식 · 중복을 본다(곡 수를 바꾸면 시험 숫자도). 「최신」은 철마다 바꿔 준다 — 새 곡 id 는 유튜브 인기곡 재생목록(`/playlist?list=PL4fGSI1pDJn6jXS_Tv_N9B8Z0HTRVJE0m` 한국 인기곡 Top100)과 공식 채널 안 검색(`/@채널/search?query=`)에서 찾는다. 유튜브 전체 검색 페이지(`/results`) · `/youtubei/` 는 robots.txt 가 막는 경로라 쓰지 않는다.
- 클라우드 작업공간(데이터센터 IP)에서는 유튜브가 영상 재생을 막는다('Video unavailable') — 실제 재생 확인은 체육관 · 사무실 기기에서.

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
