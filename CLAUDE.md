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
  **저장소(storage.objects) 정책에는 authenticated 가 실행할 수 있는 함수만** 쓴다 — `has_role` · `_strategy_staff` 는 되고 `_strategy_hq` 같은 안쪽 함수는 안 된다. 정책 하나가 실행 권한 없는 함수를 부르면 저장소가 달라도 모든 올리기가 'permission denied for function …' 로 막힌다(넣기 정책은 저장소마다 나뉘지 않고 모두 검사된다 · 2026-11-13 카드 영상 저장소). 새 저장소 정책을 만들면 되돌림 시험에 **다른 저장소 올리기**를 꼭 넣는다.
  마이그레이션 파일 번호는 **지금 시각(KST, 초까지)** 으로 짓는다 — `…200000` 같은 둥근 번호 금지. 만들기 전 `ls supabase/migrations | grep <번호>` 로 겹침 확인.
- **Edge Function**: 최신 main 을 받은 뒤의 파일로만 배포하고, 배포한 코드는 바로 커밋한다. **배포 전에 지금 배포본(Supabase MCP `get_edge_function`)과 저장소 파일을 비교** — 배포본에만 있는 수정이 있으면 먼저 저장소 파일에 살린 뒤 배포한다(그냥 배포하면 그 수정이 사라진다).
  - 2026-10-20 점검(배포 시각 vs 마지막 커밋): 배포가 마지막 커밋보다 늦음(배포본에만 있는 수정이 있을 수 있음) — `coach-build` · 보호 영역 `payssam-inspect` · `qr-token-refresh` / 저장소에 폴더 없음 — `admin-migrate-legacy-assets` · `boxing-library` · `face-kiosk` · `gagyebu-ai`. 이 함수들은 고치기 전에 배포본부터 받는다.
  - 같은 날 맞춤: `auto-sync-members` · `bulk-import-members` 는 배포본을 저장소에 그대로 옮김(배포본 = 저장소, PC 에 남아 있던 사본과도 코드가 같음 확인) · `push-send` 는 10-19 아이폰(APNs) 판을 배포(웹 푸시 부분은 그대로).
- **GitHub 자동 검사** (`.github/workflows/ci.yml` 「앱 자동 검사」): 어느 브랜치든 올리면 마이그레이션 번호 겹침 → 타입 검사 → 테스트 → 빌드. 빨간불이면 GitHub 이 메일로 알린다(배포는 막지 않음). 다음 작업 전에 먼저 고친다 — 다른 계정 커밋이 원인이어도 되돌리지 말고 고쳐서 올린다.
- **DB 어긋남 점검** (`node scripts/check-db-drift.mjs` · GitHub 「DB 어긋남 점검」 매일 07:40 KST + 마이그레이션이 main 에 올라올 때): 운영 DB 함수 본문 지문(`public.repo_drift_fingerprints()`)과 저장소 정의를 비교한다. 기준선(`scripts/db-drift-baseline.json`)에 없는 **새** 어긋남이면 빨간불 — DB 함수를 고친 세션은 푸시 전에 한 번 돌린다. 어긋남을 고쳤으면 `--write-baseline` 으로 기준선을 다시 저장해 같은 커밋에 넣는다. (DO 블록 replace 덧대기는 '덧대기'로 알리기만 한다 — 그런 함수는 저장소 전체 본문이 옛것이니 고칠 때 DB 지금 정의 위에.)
- **큰 기능은 미리보기 먼저**: `preview/<이름>` 브랜치로 올리면 Cloudflare 가 `https://preview-<이름>.game-fit-quests.pages.dev` 를 만든다(자동 검사도 돈다) → 대표님 확인 → main 에 합친다. 미리보기도 **운영 DB · Edge Function 을 같이 쓴다** — 미리보기 단계의 DB 변경은 새 함수·새 칸 추가만(기존 함수 동작 바꾸기 금지) · 실회원 데이터로 쓰기 시험 금지 · 카카오 로그인은 미리보기 주소에서 안 될 수 있다(아이디 로그인으로 확인). 작은 수정·급한 고침은 지금처럼 main 으로.
  - **2026-11-08 확인 — 지금 미리보기는 옛 DB 를 본다**: Cloudflare Pages 「미리보기(Preview)」 환경 변수가 이사 전 Supabase `raoqefkwdpovwlgbibis` 그대로라(운영 = `whnczhxyjmyywhlfbgsd`) 모든 `preview-*.game-fit-quests.pages.dev` 가 옛 DB 로 붙는다 — 미리보기에서는 실데이터 · 새 DB 함수가 안 보인다(404). 고치기 전까지는 화면은 `?demo=1` 같은 예시로 보고, 실데이터는 로컬에서 운영 키(`.env.local`, 커밋 금지)로 확인한다. 고치려면 Cloudflare › game-fit-quests › 설정 › 환경 변수(미리보기)의 `VITE_SUPABASE_URL` · `VITE_SUPABASE_PUBLISHABLE_KEY` · `VITE_SUPABASE_PROJECT_ID` 를 운영 값으로(대표님 확인 뒤).
  - **2026-11-12 확인 — 미리보기 주소는 영상 범위 요청에 206 을 안 준다**: `*.pages.dev`(미리보기 · 기본 주소 모두)는 `Range` 요청에 200(파일 통째)으로 답하고, 운영 주소 `myboxer153.com` 은 206(캐시에 없을 때도)으로 답한다. 아이폰 사파리 · 아이폰 앱은 범위 요청이 안 되면 `<video>` 를 못 튼다 → 영상이 든 화면의 미리보기는 아이폰에서 영상이 안 나올 수 있다(안드로이드 · PC 크롬은 나온다). 운영에서는 나온다 — 미리보기에서 안 나온다고 영상 파일을 고치지 않는다. 확인법: `curl -s -o /dev/null -D - -H "Range: bytes=0-1023" <영상 주소>`.
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
- **두 번째 템플릿 「위빙 수업」** (`weave-hook-call`, 2026-11-13 대표님 「추천대로 진행」 · 설계 문서 https://claude.ai/artifact/QRkpNriftYizMqQdaqnZVj): 11/12 DJI 촬영 순서 그대로 — 스탠스 유지 · 십자 스텝(8) → ① 앞으로 가며 스텝 위빙(5) → ② 원 · 투 · 훅 → 위빙 위빙(5) → ③ 위빙 → 양훅(5) → 미트(8) → 2인 1조 공격 · 위빙(6) → 샌드백 구령 「어이」 = 위빙 위빙 양훅 · 「대시」 = 한쪽만 하나 둘 빵빵(6) → 자율 운동(7). 블록 노트 = 영상 속 코치님 말을 줄인 것. 지금 템플릿의 구령은 그대로(0545 구령은 이 템플릿에만).
  - 순서 영상 = 영상 템플릿 v2(코치용 1280×720 · 큰 제목 2.6초 → 소제목 · 진행 칸 · 다듬은 자막 · 포인트/주의 카드 · 칸 색 · 진행 막대 · 10MB 아래 — 규칙은 설계 문서 「영상 템플릿」 칸). 원본 · 앱용 파일 = 구글 드라이브 `DJI Device/OsmoPocket4P-95D7/20261112/153_편집본`(코치용 · 회원용 · 검토용). 순서 영상 넣음(2026-11-13 대표님 크롬 로그인 뒤 — 위빙 수업 0 ~ 8번 9개 + 「미트 두 콤보」 비어 있던 1번 워밍업(아령 · 밴드 · 래더) 1개, 제목 = 파일 이름). 두 코치님 회원용 공개 동의는 2026-11-13 대표님이 받음 — **코치님 이름은 영상 · 앱 · 문서에 넣지 않는다**(같은 날 대표님 「코치님들 이름은 올리지마」).
- **두 그룹 · 처음 온 회원 · 단계별 티칭** (2026-11-13 대표님 「새 동작은 단계별로 … 티칭은 핵심만 10초 안, 미트를 치면서」 → 매뉴얼 2권 결정 「추천대로 진행하자」): 모든 템플릿 `who` 끝에 「처음 온 회원은 매뉴얼 1권 첫 수업(스텝 · 잽 4라운드)으로 시작해요」(그날 템플릿과 상관없이) · 원칙 줄에 `STEP_TEACHING_POINT`(하나 · 둘 · 셋 부분 동작(시범) → 힘 빼고 이어서 천천히 → 연속 · 설명은 1분 안 · 미트를 칠 때 티칭은 핵심만 10초) · 「위빙 수업」은 두 그룹 — 기본 그룹(스트레이트를 다지는 회원)은 ②의 훅 · ③의 양훅 자리를 원 · 투로, 숙련 그룹은 그날 동작 전부. '충분히 설명' 같은 말은 뺐다 — 시험 classTemplates.test.ts 가 지킨다. 매뉴얼 2권(아래 「매뉴얼」 탭)과 같은 기준이라 하나를 고치면 둘 다.

**153 콘텐츠 카드 — 전략 회의 세 칸 · 회원 훈련 탭 세 칸** (2026-11-13 대표님 「추천대로 진행」 · 설계 문서 https://claude.ai/artifact/QRkpNriftYizMqQdaqnZVj 결정 2~8 추천안 — 미리보기 `preview/training-cards` → 같은 날 대표님 「올리고적용해」로 운영 DB · main): 훈련 라이브러리(training_exercises) 한 줄 = 카드 한 장을 네 곳이 같이 쓴다. 새 표 없음 · 새 페이지 없음.

| 파일 | 역할 |
|---|---|
| [src/lib/trainingCards.ts](src/lib/trainingCards.ts) · [trainingCardsSample.ts](src/lib/trainingCardsSample.ts) | 분류 → 칸(워밍업 · 기본기 · 스텝 · 기술 · 방어 · 드릴 · 체력 · 쿨다운 + 준비 · 코치 — 11/13 8칸 · 옛 칸 id `mitt` 는 `normalizeShelf` 가 `drill` 로) · 블록 종류(샌드백 = 마무리운동) · 칸 색(영상 템플릿과 같은 색) · 회원 순서(내 레벨까지 먼저, 위 레벨은 「레벨 n부터」 — 잠그지 않음) · 다음 동작(같은 칸) · 설명 듣기 문장(`toSpokenKo`) · 영상 자리(회원용 → 예전 video_url / 코치용 → 없으면 회원용) · 검색(이름이 맞는 카드 먼저) · 저장소 경로 · 카드 → 블록 · 수업 기록 칩 / 예시 카드(운영 글 그대로 + 새 카드 4장 · 다듬은 위빙 — 마이그레이션과 같은 id · 글). 시험 trainingCards.test.ts |
| [src/services/trainingCardService.ts](src/services/trainingCardService.ts) | `useTrainingCards`(select * — 영상 칸이 없는 DB 에서도 읽힘 · 표가 없으면 빈 목록) · 서명 주소 1시간(기기 안에 기억) · 첫 장면 그림 한 번에 · `uploadCardVideo` / `clearCardVideo`(대표님 · 운영진). 예시 모드 `?demo=1`(이 창을 닫을 때까지 · 서버를 안 부름) |
| [src/components/TrainingDrillSheet.tsx](src/components/TrainingDrillSheet.tsx) | 카드 시트 — 회원용 영상(정사각 · 소리 없음 · 반복 · 「천천히」) → 칸 · 레벨 · 난이도 → 🔊 설명 듣기(휴대폰 목소리 · 문장마다 · 다시 누르면 멈춤 · mindAudio `speak`) → 이렇게 해요 → 이런 실수 조심 → 준비물 · 시간 → 「다음 동작 →」. 코치진은 「코치용 영상」 단추. 회원 글에 benefits(효과 말)는 안 보인다. 레벨 자세히 › 필수 훈련 · 훈련 라이브러리 · 전략 회의가 같이 쓴다 |
| [src/components/training/TrainingShelf.tsx](src/components/training/TrainingShelf.tsx) | 「영상으로 배우기」 — 회원: 붕대 감기 한 줄 + 칸 칩(튜토리얼 표시 `missions-tab-control`) + 카드 2열(6장 → 더 보기) · 워밍업 칸 맨 앞에 레벨 미션 워밍업 영상 · `/missions?learn=1`(&shelf=) 이면 이 칸으로 / 코치진(`audience="staff"`): 코치 칸 · 검색 · 분 표시 · 카드 시트 맨 아래 단추 |
| [src/components/strategy/CardDrawer.tsx](src/components/strategy/CardDrawer.tsx) | 카드 서랍 — 검색 · 칩(칸 + 레벨 미션 + 우리 지점) · 고르면 `DrawerPick` 하나. 153플레이는 안 넣는다(결정 4번). 쓰는 쪽 시트의 형제로 그린다(시트 안은 transform 기준이라 화면 밖으로 밀림) |

- 훈련 탭(`/missions`): 토글(올리그 / 레벨 미션 영상)을 없애고 한 화면 세 칸(WhiteLeagueTab) — **오늘 할 것**(오삼 코치 오늘의 코스 + 오늘 수업, 그대로) · **내 레벨**(레벨업까지 · 레벨 n 훈련 자세히 보기 · 「레벨 미션 영상 전체 ›」 · 전체 레벨 지도) · **영상으로 배우기**. 예전 '레벨 미션 영상' 보기(완료 n/m · 워밍업 영상 · 리그별 · 관리자 추가/고치기 · 튜토리얼 `first-mission-card` · `missions-league-header-white`)는 지우지 않고 `?v=videos`(머리글 ← = 뒤로). 제목 '훈련 미션' → '훈련'. 튜토리얼 2일차 2단계 글 「훈련은 세 칸이에요 — 오늘 할 것 · 내 레벨 · 영상으로 배우기」 · unlockRules 3단계 글도 같게.
- 메뉴 '훈련 도구 › 훈련 라이브러리'는 코치진만(`requires: "staff"`) — 회원이 `/training-library` 를 열면(내 바로가기 · 옛 링크) `/missions?learn=1` 로 넘긴다(App `TrainingLibraryRoute`). 코치진은 그 화면에서 카드 보기, **고치기 · 추가 · 삭제 · 영상 넣기는 대표님 · 운영진(admin · super_admin)만**(결정 6번 — 마이그레이션이 서버 쓰기 정책도 좁힌다). 영상 넣기 칸은 `input[type=file]` aria-label 「회원용 영상 넣기」 · 「코치용 영상 넣기」 · 「첫 장면 그림 넣기」(크롬 자동화가 바로 넣는다 · 10MB 아래) — 영상 칸이 있는 DB 에서만 보인다. 기능 검색 '영상으로 배우기 · 동작 카드'(→ ③) · 코치진 '훈련 라이브러리 · 카드 고치기' · 오삼 FAQ `tr-library` 도 ③으로.
- 전략 회의: 오늘 프로그램 블록마다 「카드 고르기」(예전 '영상 붙이기' 고르기 칸 자리) → `ProgramBlock.card_id` · `mission_id` · `video_id` 셋 중 하나 + 이름 · 분 · 블록 종류가 채워짐 · 받은 프로그램 블록의 ▶ = 코치용 영상(없으면 회원용 · 영상이 없으면 카드 시트) · 레벨 미션 ▶ = 미션 영상 · 수업 기록 = 진행한 프로그램의 카드 칩(모두 켜짐 → 안 한 것만 끄기) + 「카드 고르기」 → `data.cards`(카드 id, 40개까지) · 영상 칸 = 맨 위 「153 콘텐츠 카드」(검색 · 카드 시트 · 대표님 · 지점장님 「이 카드로 오늘 프로그램 만들기」 → 기본 틀의 같은 종류 빈 블록) + 「우리 지점 영상」 그대로. `strategy_save` 가 data 를 그대로 저장해서 DB 변경 없음.
- DB [20261113015215_training_cards.sql](supabase/migrations/20261113015215_training_cards.sql): training_exercises 칸 5(video_path member/… · coach_video_path coach/… · poster_path · minutes 1~120 · equipment 60자, 경로 모양 검사) · 비공개 저장소 `training-videos`(mp4 · webp/jpg/png · 50MB — member/ 읽기 = 로그인한 사람 · coach/ 읽기 = `_strategy_staff` · 넣기 = super_admin · admin(`has_role`) · **바꾸기 · 지우기 정책은 없다** — 앱은 늘 새 이름(`member/<카드 id>-<무작위>.mp4`, 덮어쓰기 없음)으로 넣고 카드 칸만 바꾼다 · 「빼기」도 칸만 비움 · 예전 파일은 저장소에 남는다) · `tex_write` 를 super_admin · admin 으로 좁힘(읽기 그대로) · 새 카드 4장(십자 스텝 · 뛰는 스텝 · 워킹 런지 「테니스공 하나 — 닿지 않게」 · 샌드백 구령 「어이」 · 「대시」, 고정 id `1530c4d0-000n-…`, 이름이 같은 카드가 있으면 안 넣음) · 「위빙」 글 다듬기(예전 글 그대로일 때만). 영상 칸이 없는 DB(미리보기 옛 DB)에서는 화면이 영상 칸 없이 예전처럼(카드 글 · 그림) 보인다.
- **적용 (2026-11-13 대표님 「올리고적용해」)**: 운영 DB = MCP `apply_migration`(기록 `20261113021011_training_cards`) → 되돌림 시험에서 **저장소 넣기 정책이 부른 `_strategy_hq`(안쪽 함수 — authenticated 실행 권한 없음) 때문에 모든 저장소 올리기(커뮤니티 사진 등)가 'permission denied for function _strategy_hq' 로 막히는 것**을 찾아 `has_role` 로 고침(기록 `20261113021153_training_cards_storage_insert_fix` — 막혀 있던 때는 11:10:11 ~ 11:11:53 KST 약 2분 · 그사이 저장소 요청은 0건(API 로그 확인)). 마이그레이션 파일은 고친 모양(= DB). 되돌림 시험(DO 블록 예외) ALL_OK — 회원 = 카드 102장 읽기 · 고치기 0 · 카드 영상 올리기 막힘 · 커뮤니티 사진 올리기 됨 · member/ 파일만 보임 / 코치 · 지점장 = 고치기 0 · 올리기 막힘 · member/ · coach/ 보임 / 대표님 = 고치기 · member/ · coach/ 올리기 · 카드 칸 넣기 됨 · 잘못된 경로 · 다른 폴더 막힘 / anon = 0 · 남은 줄 0. 로컬 시험 뼈대는 처음에 함수 실행 권한을 모두 열어 둬서 이 일을 못 잡았다 → 운영처럼 `_strategy_hq` 실행 권한을 빼고 '다른 저장소 올리기 됨' 경우를 더함(30개 ALL_OK).
- **카드 영상 넣음** (2026-11-13 대표님 「로그인완료 회원동의 완료」 — 두 코치님 회원용 공개 동의 · 크롬 훈련 라이브러리 수정 창의 영상 넣기 칸): 카드 ↔ 영상 짝은 DJI 보고서의 「이름까지 같은 동작」 표대로 — 회원용 11장(밴드 쉐도우 · 아령 쉐도우 · 아령 샌드백 터치 · 전진·후진 스텝 · 사이드 스텝(이 둘은 같은 「스탠스 유지 스텝 4방향」) · 위빙(스텝 위빙) · 위빙-훅 연결(위빙 → 양훅) · 위빙 연결 콤비(원 · 투 · 훅 → 위빙) · 십자 스텝 · 뛰는 스텝 · 샌드백 구령) + 첫 장면 11장(영상 첫 프레임 · 540px webp) · 코치용 11장(템플릿 순서 영상을 카드 동작 구간만 자른 것 — 아령 섀도우 · 밴드 · 래더(사다리 두 장) · 스탠스 유지 스텝(전진·후진 · 사이드) · 십자 스텝 · 위빙 · 위빙 연결 콤비 · 위빙-훅 연결 · 샌드백 구령). 아직 없는 것: 워킹 런지(영상 없음 — 다음 촬영) · 사다리 두 장 회원용(멀리서 찍어 다시 촬영) · 아령 샌드백 터치 · 뛰는 스텝 코치용(코치진에게도 회원용이 대신 나온다). 코치님 이름 줄은 넣지 않는다(같은 날 대표님 「코치님들 이름은 올리지마」).
- 같은 날 고친 것: ① 회원 타일 ▶ 는 회원이 볼 수 있는 영상만(`hasMemberVideo`) — 코치용만 붙은 카드(사다리 두 장)는 코치진 타일 · 카드 서랍에만 ▶ ② `/missions?learn=1` 내려가기 — 주소에서 `learn` 을 지우는 순간 내려가기 예약까지 취소돼 안 내려가던 것을, 카드를 읽은 뒤 0.2 · 0.9 · 1.7초에 맞추게 ③ `/training-library` 를 바로 열면(바로가기 · 새로고침) 역할을 읽을 때까지 기다린다 — AuthContext 는 역할을 읽기 전에 `loading` 을 끝내서 코치진 · 대표님도 회원 화면으로 넘어갔다. **`ManagerRoute` · `AdminOnlyRoute` 도 같은 모양**이라 그 주소를 바로 열면 `/home` 으로 갈 수 있다(아직 그대로 — 고칠 때 같은 기다림을 넣는다).
- **8칸으로 다시** (2026-11-13 대표님 「워밍업 컨텐츠는 워밍업대로 · 거울 앞 자세 연습은 복싱 기본기로 · 드릴은 드릴대로 … 코치님들은 조합을 통해 수업 구성」 → 「8칸으로 다시 (추천)」 · DB 변경 없음): 회원 칸 = 워밍업 · **기본기**(거울 앞 자세 · 기본 동작 — 분류 '기본기' · 금색 #A87400) · 스텝 · 기술(콤비네이션 · 카운터) · 방어 · **드릴**(분류 미트 · 샌드백 · 스파링 준비 — 옛 '미트·샌드백' 칸 · 같은 코랄) · 체력 · 쿨다운 / 코치진은 + 코치. 칸이 바뀌어도 블록 종류는 그대로(미트 → 미트 블록 · 샌드백 → 마무리운동). 주소 `?shelf=mitt` · 기기에 기억한 옛 칸은 `normalizeShelf` 가 드릴로 · 검색은 칸 이름 밖의 말(`ShelfInfo.words` — '미트·샌드백' · '거울 앞 자세' 등)도 본다. 오삼 FAQ `tr-library` 칸 이름도 같이. 칸을 바꾸면 `CATEGORY_SHELF` · `MEMBER_SHELVES` · 시험 trainingCards.test.ts 를 함께.

**코치님 「내 수업 짜기」 — 수업안** (2026-11-13 대표님 「코치님 내 수업 짜기 (추천)」 · [src/lib/classPlan.ts](src/lib/classPlan.ts) · 시험 classPlan.test.ts · **DB 변경 없음**): 코치님이 153 콘텐츠 카드를 블록마다 골라 자기 수업을 짜고 → 저장 → 대표님 · 지점장님이 보고 피드백 한마디 → 수업이 끝나면 같은 글이 수업 기록이 된다. 지시처럼 알림이 퍼지지 않는다.
- 저장 = 수업 기록 한 줄(`strategy_items` kind `class_log` · `data.stage = 'plan'` · `data.slot` · `blocks` · `total_min`) — `strategy_save` 가 class_log 는 코치진 누구나 받고 알림을 안 보낸다 · 보이는 사람 = 수업 기록과 같다(그 지점 코치진 · 대표님). 화면은 `ProgramComposer mode="plan"`(같은 블록 · 카드 고르기 · 템플릿 칩, 받는 사람 고르기 · '템플릿으로' 없음 · 이름 비우면 'M/D 내 수업').
- 오늘 프로그램 칸: 코치님 = 큰 단추 「내 수업 짜기」 · 대표님 · 지점장님 = 「오늘 프로그램 만들기」 + 「내 수업 짜기」. 그 아래 「수업안 n」 — 내 것(지난 날짜인데 기록 전이면 「기록 전」) 먼저 · 다른 코치님 것은 오늘 · 앞으로만(`plansForBoard`). 내 수업안 = 「수업 끝 — 기록 쓰기」 · 「고치기」. 템플릿 카드 「이 템플릿으로 내 수업 짜기」 · 카드 시트 「이 카드로 내 수업 짜기」도 같은 창. 수업 기록 칸에는 수업안이 안 보인다(`onlyClassLogs`).
- 피드백 = 그 글의 댓글(`strategy_comment_add` → 글쓴이 알림 '💬 수업안에 피드백 · 이름 직함' — 수업 기록은 예전처럼 '💬 수업 기록에 피드백' · [20261113212835_strategy_comment_plan_label.sql](supabase/migrations/20261113212835_strategy_comment_plan_label.sql), 같은 날 대표님 「적용해」 → MCP 기록 `20261113122953` · 본문 md5 = 로컬 기준본 · 되돌림 시험(수업안 · 수업 기록 제목 · 내 글에 단 댓글은 알림 없음 · 남은 줄 0)). 대표님 · 지점장님 화면은 오늘 다른 코치님 수업안 중 피드백이 없는 것이 있으면 오늘 프로그램 칸에 점 · 「피드백 기다림 n」(`plansAwaitingFeedback`). 수업안 저장 때 지시권자 알림은 없다.
- 「기록 쓰기」 = 수업 기록 창(`ClassLogComposer fromPlan`)이 날짜 · 시(`planHour`) · 진행한 프로그램(`plan:<id>`) · 카드 칩을 채워 **같은 글(id)** 로 저장 — stage 가 빠지고 짠 블록은 `data.plan`(`planSnapshot`)에 남는다 · 피드백도 이어진다. 그냥 「수업 기록 남기기」의 진행한 프로그램에도 '내 수업안' 묶음.
- 서버 셈(153 기준 점검 `_coach_rates_self` · 4주 성장 `_coach_growth_person`)은 `data.std` 가 있는 수업 기록만 세서 수업안은 섞이지 않는다.

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
- **적용 (2026-11-11 대표님 「올려」 → 「적용해」)**: 미리보기 `preview/pt-record` 뒤 main 에 합침 · 운영 DB 는 MCP `apply_migration`(새 표 4 · 새 함수 12 · 예약 3). 로컬 기준본(저장소 파일을 그대로 올린 Postgres)과 함수 본문 · 표 · 색인 · 제약 · 권한 · 예약 지문이 같음을 확인하고, 되돌림 시험(DO 블록 예외)으로 대표님 · PT 코치 · 회원 세 계정을 확인 — 꺼진 지점은 저장 막힘 · 켜기는 대표님만 · 코치는 PT 회원 · 본인 차감만(금액 없음) · 같은 날 겹침 막힘 · 출석 없는 수업은 사유 · 늦은 기록 · 이름표 · 회원은 읽기 · 지우기 막힘 · 알림 함수 3개 정상. 켤 때 시작일은 **켜는 날**로(앞 날짜로 잡으면 그사이 차감이 모두 「사유 없는 차감」으로 뜬다).
- **선릉역점 켬 (2026-11-12 01:17 대표님 「켜」)**: `ops_pt_settings` record_on · notify_on · 시작일 11/12 · PT 이름표 5명(앱 이름이 별명인 회원 — 실명은 DB 에만) · 2주 시범 11/12~11/25(기준: 당일 기록률 90% 이상 · 주말마다 확인 필요 0건 → 2단계).
- **「이틀 넘은 확인 필요」 알림 고침 (2026-11-12 첫날 밤 점검 → 대표님 「추천대로 진행할게」)**: 켠 날 10:00 에, 그날 새벽에 잡힌 차감 2회가 「이틀 넘은 확인 필요 · 사유 없는 차감 2회」로 나갔다 — `_ops_pt_overdue` 의 '사유 없는 차감' 셈만 차감이 언제 잡혔는지 보지 않았다(기록 없는 입장 · 차감 대기는 날짜를 봤다). [supabase/migrations/20261113000026_ops_pt_overdue_age.sql](supabase/migrations/20261113000026_ops_pt_overdue_age.sql): 사흘 전까지 잡힌 차감(이틀이 꽉 지난 것)만 세고, 사흘 전까지의 기록(`c_pre + c_old`)과 견준다 — 더 새 기록은 옛 차감을 설명하지 못한다(화면 짝짓기와 같은 결). **근무 1단계(20261112225136)의 `_ops_pt_overdue` 위에 얹었다** — 그 정의(자동 기록을 켠 지점은 입장 확인을 하루 더)에서 이 셈 한 곳만 다르다. 자동 기록을 켠 지점도 같다: 입장이 없어 자동 기록이 안 생긴 차감은 이틀이 꽉 지난 뒤에만 지점장 · 대표님께 가고, 그 전에는 밤 10시 요약이 코치에게 알린다(`_ops_pt_nightly` 는 그날 바로 알리는 것이 맞아 그대로 · `_ops_pt_balance` · 예약 · 권한 그대로). 시험: 로컬 Postgres 86개(새 13개 — 오늘 잡힌 차감은 안 셈 · 사흘 전 차감은 셈 · 더 새 기록으로 안 가려짐 · 그날까지의 기록이 있으면 0 · 켠 첫날 모양은 알림 없음 · 자동 기록 켠 지점의 '입장 확인 하루 더' 그대로; 고치기 전 함수로는 10d 에서 멈춘다 — 자정 뒤 3분 동안은 8번 시험이 날짜 경계에 걸려 멈추니 그 뒤에 돌린다).
  - **적용 (2026-11-13 00:05)**: 적용 직전 운영 본문 = 저장소 20261112225136 정의(md5 같음 — 승인을 기다리는 사이 근무 1단계가 적용돼 같은 함수가 바뀌어 있었다. 처음 준비한 파일은 옛 정의 기준이라 버리고 지금 정의 위에 다시 썼다) → MCP `apply_migration`(기록 `20261112150511_ops_pt_overdue_age`) → 본문 md5 = 이 파일 · 권한(anon · authenticated 실행 막힘) · 예약 `ops-pt-overdue` 그대로 · `_ops_pt_nightly` · `_ops_pt_balance` 본문 그대로 → 되돌림 시험(DO 블록 예외): 그날 자료로 고친 함수 = 알림 0(옛 셈이었다면 전날 23:45 에 잡힌 입장 없는 차감 1회가 10:00 에 '이틀 넘은'으로 나갔다) → DB 어긋남 0.
- 첫날 함께 본 것(2026-11-12): ① PT 알림 6건(입장 2 · 밤 요약 1 · 이틀 넘은 건 3)이 휴대폰으로는 0건 — 받는 계정들의 휴대폰 알림 구독(`push_subscriptions.active`)이 꺼져 있었다(알림함에는 모두 들어감 · `notifications.pushed_at` 이 비어 있으면 휴대폰으로 안 간 것). 시범 지점을 켤 때 **PT 코치 · 지점장의 휴대폰 알림이 켜져 있는지** 먼저 본다. ② 브로제이 출석은 5분 간격으로 들어온다(선릉 3일 142건: 중앙값 3분 · 최대 6분 · 1분 안 9%) → 입장 알림은 입장 3~6분 뒤다('1분 안'이 아니다).

#### PT 기록 「오류 신고」 · 첫날 점검 (2026-11-12 대표님 "근무탭에 잘못 기재된 부분이 있어서 … 어제 수업인데 오늘 수업으로 되어 있고 · 어제 수업을 했는데 기록에 없음 … 일단 점검 해주고 만약 pt 선생님이 볼때 오류가 있으면 오류신고 할수있도록 기능 만들어줘")

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261112192419_ops_pt_reports.sql](supabase/migrations/20261112192419_ops_pt_reports.sql) | 새 표 `ops_pt_reports`(코치 · 보낸 분 · 기록 `session_id` / 차감 `event_id` / 회원 · 보이던 날 `about_date` · 종류 wrong_date 날짜가 달라요 · missing 수업했는데 기록이 없어요 · not_held 수업 안 했는데 잡혔어요 · wrong_count 횟수 · wrong_member 회원 · other 그 밖 · 실제 수업 날 `right_date` · 메모 · open 확인 중 / fixed 고쳤어요 / kept 그대로 둬요 · 답 `reply`) · RPC `ops_pt_reports`(관리자 = 지점 전체 · 코치 = 본인이 보낸 것 + 본인 담당, 열린 것 + 처리 30일) · `ops_pt_report_send`(같은 것 두 번 누름 = 새로 안 만듦 · 하루 30건 · 대표님 · 지점 관리자 알림 → `/office?tab=work&ptcoach=<근무자 카드>`) · `ops_pt_report_resolve`(관리자만 · 보낸 분 알림 → `/office?tab=work&pt=today`) · 안쪽 `_ops_pt_report_kind_label` |
| [src/lib/opsPtReport.ts](src/lib/opsPtReport.ts) · [src/services/opsPtReportService.ts](src/services/opsPtReportService.ts) · [src/components/ops/OpsPtReport.tsx](src/components/ops/OpsPtReport.tsx) | 글 · 검사(서버와 같은 말) · 관리자 고치기 판단 `ptReportFix`(edit 그 기록 날짜를 신고한 날로 · new 그날 수업 기록 넣기 · void 그 기록 지우기 · done 이미 그대로 · null 직접 확인) / 신고 시트(무엇이 틀렸나요 · 실제 수업 날짜 = 최근 열흘 입장한 날 칩 · 메모) · 목록(코치 「보낸 오류 신고」 · 관리자 「오류 신고 n」 → [○/○로 고치기] [그대로 둬요] · 처리 시트) |
| [src/components/ops/OpsPtRecord.tsx](src/components/ops/OpsPtRecord.tsx) · [OpsWorkTab.tsx](src/components/ops/OpsWorkTab.tsx) · [src/lib/opsPtRecord.ts](src/lib/opsPtRecord.ts) | 코치 = 기록 시트 「기록이 이상해요 — 오류 신고」 · 사유 없는 차감 · 차감 대기 카드 「오류 신고」 · 「오늘 PT」 아래 단추 / 관리자 = 근무자 카드 'PT' 탭 맨 위 받은 신고(신고대로 고치기 = 이 기록 시트 → 저장하면 '고쳤어요' + 코치 알림) · 「근무」 탭 '확인할 것' 맨 위 코치별 'PT 기록 오류 신고 n건' · `?ptcoach=` 로 그 코치 'PT' 탭 열기 / 짝짓기 `PtExtra.guess` · `ptGuessClassDay` · `ptNearEntry` |

- 첫날 점검(11/12 운영 DB): 두 건 모두 **차감 날짜 = 앱이 알아챈 날**이 원인 — 낮 · 저녁 수업의 차감이 다음 날 새벽 · 오후에 잡혀 `work_date` 가 다음 날이 된다(11월 선릉 차감의 절반 넘게 입장 다음 날로 잡힘 · 수당 기준이라 그대로 둔다). ① 「사유 없는 차감 → 기록하기」 날짜 칸이 차감 날로 채워져 있어 그대로 저장(+ 출석 없음 사유 '문 열림')된 기록 1건 → 입장한 날로 고침 ② 다음 날 잡힌 차감만 있고 기록이 없던 수업 1건 → 입장한 날 수업 기록 넣음(둘 다 대표님 확인 · 메모에 남김). 출석 기록이 앱 · 153OS 어디에도 없는 회원(앱 계정 11/09 생김)의 같은 모양 기록 1건은 대표님이 「11/11 맞아 어제 했어」로 확인해 11/11로 고침 — 이 회원은 브로제이 입장 기록이 없어 수업마다 출석 없음 사유가 필요하다(입장 방법 확인 필요).
- 같은 일이 다시 안 생기게: 사유 없는 차감에 **출석으로 어림한 실제 수업 날**(`guess` — 차감이 잡힌 날에서 이틀 앞까지 · 앱이 알아채기 **전**의 입장 · 그날 기록 없는 가장 늦은 날 · 한 입장은 한 차감에만)을 붙여 카드가 "11/11(수) 20:02 입장한 날 수업이었나요? [11/11 수업이에요] [다른 날 · 기록]"로 묻고, [기록하기]도 그날로 채운다. 어림한 날의 입장은 「기록 없는 입장」으로 또 묻지 않는다. 기록 시트는 고른 날 입장이 없는데 앞 이틀 안에 입장이 있으면 "그날로 바꾸기"를 먼저 띄운다(`ptNearEntry`).
- 서버는 신고만 저장한다 — 기록 · 차감을 고치는 길은 기존 `ops_pt_session_save` · `ops_pt_session_void` 하나(검사 · 늦은 기록 규칙 한 곳). 차감(브로제이) 자체가 틀린 신고는 앱에서 못 고친다 → 관리자가 브로제이를 고치고 [고쳤어요].
- 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 단추 · 목록이 안 보인다(`available=false`). 예시 화면 `?demo=1` 에도 예시 신고 2건(지어낸 회원).
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + PT 기록 1단계 + 이 마이그레이션 두 번) 56개(anon · 회원 · PT 아닌 코치 막힘 · 표 · 안쪽 함수 막힘 · 코치 날짜 신고 → 대표님 · 지점장 알림 2통(본인 · 다른 지점 없음) · 두 번 누름 = 같은 신고 · 메모가 다르면 새 신고 · 남의 기록 · 차감 막힘 · 검사 말 8가지 · 코치는 늘 본인 · 꺼진 지점 · 목록 범위 · 처리는 관리자만 · 처리 알림 · 같은 처리 다시 = 알림 없음 · 하루 30건) / vitest opsPtReport.test.ts 19개(이 날 있던 두 모양을 지어낸 이름으로).
- **적용 (2026-11-12 대표님 「올려 + 적용해」)**: 운영 DB = MCP `apply_migration`(새 표 1 · 새 함수 4 · schema_migrations 20261112105910 = 저장소 20261112192419) → 되돌림 시험(DO 블록 예외)으로 선릉 PT 코치 · 대표님 · PT 회원 세 계정 확인 — 코치 신고 → 관리자 알림 3통(본문 · `ptcoach` 링크) · 두 번 누름 = 같은 신고 · 코치 처리 막힘 · 대표님 처리 → 코치 알림 1통 · 회원 막힘 · 남은 줄 0. DB 어긋남 점검에서 이 일의 함수 4개는 어긋남 0(그날 남은 새 어긋남 10개는 「운동 약속」 창의 `_promise_*` · `ops_meet_today` 등 — 그 창이 마이그레이션 파일을 올리면 꺼짐).

#### 근무 1단계 — 출근 확정 · PT 자동 기록 (2026-11-12 대표님 "코치님들이 근무 시간 정직하고 실수하지않게 … 일을 2번 하지않으면서" → 보고서 → 「추천대로하자」 · Claude Docs 「코치 근무·PT 정직 체크 방법 보고서」 https://claude.ai/artifact/THLBCi9iNUkyaonYXc3z2U)

원칙: 코치는 한 번만 한다(출근 = 입구 얼굴 인식 · PT = 브로제이 차감) · 코치가 바꿀 수 없는 기록이 기준 · 어긋난 것만 사람이 본다.

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261112225136_ops_work_stage1.sql](supabase/migrations/20261112225136_ops_work_stage1.sql) | ① 출근 확정 — 새 표 `ops_duty_settings`(지점마다 출근 알림 `nudge_on` 기본 꺼짐 · 코치 알림 분 15 · 지점장 알림 분 60 · 켠 날 `started_on`) · `ops_duty_reports`(코치 신고 here 와 있었어요 · early 일찍 퇴근 · off 쉬는 날 / 시각 · 인정 분 · 메모 200자 · open → approved · rejected · canceled · 승인하면 `entry_id`) · `ops_duty_notices`(사람 · 날짜마다 알림 한 번) · RPC `ops_duty_reports` · `ops_duty_report_send` · `ops_duty_report_decide` · `ops_duty_report_cancel` · `ops_duty_setting_set`(대표님만) · 예약 `ops-duty-tick`(5분) / ② PT 자동 기록 — 새 칸 `ops_pt_settings.auto_record`(기본 꺼짐) · `ops_pt_sessions.source`(coach · auto) · 새 표 `ops_pt_auto_log`(차감마다 한 번) · `_ops_pt_auto_record`(예약 `ops-pt-auto-record` 매시 50분 — sync-pt-members 45분 뒤) · `ops_pt_auto_set`(대표님만 · 켜면 바로 한 번) · 켠 지점만 달라지는 기존 함수 4개 `ops_pt_record`(auto · 기록 source) · `_ops_pt_entry_tick` · `_ops_pt_nightly` · `_ops_pt_overdue` |
| [src/lib/opsDuty.ts](src/lib/opsDuty.ts) · [src/services/opsDutyService.ts](src/services/opsDutyService.ts) · [src/components/ops/OpsDuty.tsx](src/components/ops/OpsDuty.tsx) | 글 · 검사(서버와 같은 말 `dutyDraftError`) · 인정 시간 제안 `dutyProposedMinutes` · 예시 `buildDutySample` · `applyDutyDemo` (시험 opsDuty.test.ts) / 코치 = 「근무」 탭 맨 위 '오늘 출근 기록이 아직 없어요'([오늘 쉬는 날] [와 있어요 · 알리기]) · '출근 기록이 없는 날 n일' · '내 출근 신고' / 관리자 = '확인할 것' 맨 위 출근 신고 [반려] [신고대로 승인 · 시간 정해 승인] · 대표님 '출근 알림' 켜기 · 끄기 |
| [OpsDaySheet.tsx](src/components/ops/OpsDaySheet.tsx) · [OpsWorkTab.tsx](src/components/ops/OpsWorkTab.tsx) | 하루 시트 「출근 신고」 칩(코치 · 출근 확인 카드 · 14일 안 — 누락 날 · 오늘 출근 전이면 이 칩으로 열림) · 관리자는 그날 열린 신고를 시트 맨 위에서 처리 · 알림 링크 `/office?tab=work&duty=YYYY-MM-DD`(그날 시트가 「와 있었어요」로 열림) · 신고가 있는 날은 '확인할 것'의 출근 누락에서 뺀다 |
| [OpsPtRecord.tsx](src/components/ops/OpsPtRecord.tsx) · [src/lib/opsPtRecord.ts](src/lib/opsPtRecord.ts) · [opsPtRecordService.ts](src/services/opsPtRecordService.ts) | 자동 기록 줄 「자동」(시트 안내 '앱이 넣은 기록 — 다르면 고치거나 지워') · 켠 지점의 「오늘 PT」 = '수업이면 브로제이 차감만' + [개인 운동]만 · 이틀 안의 기록 없는 입장은 묻지 않음(`PtUnrecorded.waiting` · `ptCounts` 와 같은 기준) · 관리자 PT 탭 아래 대표님 「자동 기록 켜기 · 끄기」 |

- 대표님 결정 8가지 (11/12 「추천대로하자」 — 보고서 「대표님이 정해 주실 것」 추천안 그대로): ① 일찍 퇴근 = 앱 신고 먼저(단말 퇴근 스캔은 되면 나중에) ② PT 수당 = 12월 수업분부터 기록 연동 ③ 수당 달 = 수업(입장)한 날 ④ 확인 안 된 차감은 보류 → 다음 마감에 정산 ⑤ 근무 시간 중 PT = 그대로 지급 · 겹친 시간은 월 마감에 표시 ⑥ 회원 차감 알림 + '아니에요' 단추 ⑦ 알림 = 코치 15분 · 지점장 60분 ⑧ 월 마감 = 3일 코치 · 지점장 → 4일 대표님 → 5일 세무사 → 10일 지급(11/11 PT 기록 결정과 같게). **1단계에는 ① · ⑦ 만** — ② ~ ⑥ · ⑧ 은 2단계(월 마감 · 명세서 · 회원 차감 알림).
- 출근 확정 흐름: 얼굴 출근이 안 찍힌 근무일 → 첫 근무 시작 15분 뒤 코치 '⏰ 출근 기록이 아직 없어요'(→ 그날 시트 「출근 신고」) · 60분 뒤 대표님 · 지점장 '📍 출근 기록 없음 · 이름' → 코치 신고(와 있었어요 + 온 시각 · 일찍 퇴근 + 나간 시각 · 쉬는 날) → 대표님 · 지점 관리자에게 '📍 출근 신고 · 이름' → 승인하면 그날 `ops_day_entries` 에 승인된 adjust(인정 분) 또는 off 한 줄(그날 앞서 승인된 adjust · off 는 취소, 사유 '코치 신고 · …') — 계산은 지금처럼 `computeDay` 한 곳 · 승인 · 반려 모두 코치 알림.
  - 알림 대상: 근무자 카드 형태 parttime · employee · intern + 출근 확인(`checkin_required`) + 그 지점 출근 알림 켜짐. 얼굴 출근 · 승인된 고침/쉰 날 · 열린/승인된 신고가 있으면 안 보낸다 · 코치 알림은 시작 6시간 안 · 관리자 알림은 8시간 안에만(늦게 켜도 지난 것을 몰아 보내지 않게) · 시간표 시작은 분으로 견줘 자정을 넘기지 않는다. 시간표 계산 `_ops_duty_segments` = `computeDay` · `public_staff_on_duty` 와 같은 기준(근무 기간 · 쉰 날 · 대타 넘김/받음) · 출근부 짝 = `ops_month` 와 같은 식(앱 계정, 없으면 이름).
  - 신고 규칙(서버 = 화면): 오늘부터 14일 앞까지(그 앞은 '지점장님께 말씀해 주세요') · 미래 날짜 · 5분 넘게 앞선 시각 막힘 · 얼굴 출근이 찍힌 날은 '와 있었어요' 막힘 · 같은 날 같은 종류의 열린 신고는 고쳐 쓰기(알림 다시 안 감) · 하루 10건. 인정 시간 제안: 와 있었어요 = 온 시각부터(첫 시작 10분 안이면 시간표대로 — 지각 표시와 같은 10분) · 일찍 퇴근 = 시작부터 나간 시각까지 · 쉬는 날 0 · 최종 분은 승인하는 분이 정한다. 내가 보낸 신고는 대표님만 처리.
- PT 자동 기록: 켠 지점은 매시 50분, 최근 30일 차감 중 짝지을 기록이 없는 것(화면 `matchPtRecord` 와 같은 순서)에 출석으로 어림한 날(`ptGuessClassDay` 와 같은 규칙 — 차감이 잡힌 날에서 이틀 앞까지 · 앱이 알아채기 전 입장 · 그날 기록이 없는 가장 늦은 날 · 한 입장은 한 차감에만)이 있으면 그날 '수업' 기록(source auto · 담당 = 차감의 코치 · 메모 '자동 기록 — 브로제이 차감 + 그날 입장')을 넣는다. 담당 코치가 없는 차감 · 30일 넘은 차감은 사람 몫. 한 차감은 한 번만(`ops_pt_auto_log`) — 코치 · 지점장이 지운 자동 기록은 되살리지 않는다. 노쇼 · 당일취소 · 일정 변경 · 코치 사정은 입장이 없어 지금처럼 직접 적는다.
  - 켠 지점에서 달라지는 것: 입장 알림 'PT 수업이면 끝나고 브로제이에서 차감만 해 주세요 — 앱이 알아서 기록해요' · 「오늘 PT」 [수업 완료] 대신 안내 한 줄 · 이틀 안의 기록 없는 입장은 묻지 않음(화면 · 밤 요약 '차감이 안 잡힌 입장 n건' · 10시 이틀 넘은 건 모두 같은 기준). **수당 기준은 그대로(차감 기록)** — 기록 연동은 2단계 12월 수업분부터.
- 보이는 범위: 코치 = 본인 근무자 카드 신고만 · 관리자(대표님 · `ops_managers`) = 지점 전체 · 설정은 대표님. 새 표는 anon · authenticated 모두 막고 함수로만. 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 출근 신고 칸이 안 보이고 PT 는 꺼진 것처럼(예전 화면).
- 미리보기 `preview/opswork1` · 예시 `/office?tab=work&demo=1` — 출근 확정 예시(코치 · 관리자 · 지금 시각 18:20 으로) + PT 예시는 자동 기록을 켠 지점 모습(관리자 예시에서 켜기 · 끄기).
- **적용 (2026-11-12 23:5x 대표님 「올려 + 적용해」)**: 적용 전 기존 함수 4개의 운영 본문 = 저장소 20261111184433 정의(md5 같음) 확인 → 운영 DB = MCP `apply_migration`(기록 `20261112145229_ops_work_stage1` — 파일 번호와 다르고 본문은 맨 아래 '끄기' 주석 한 줄만 뺐다) → 함수 16개 본문이 저장소 파일을 올린 로컬 기준본과 md5 같음 · 예약 2개 켜짐 · 새 표는 anon · authenticated 모두 막힘 · 안쪽 함수 실행 막힘 → 되돌림 시험(DO 블록 예외) ALL_OK: 회원 = 목록 · 신고 · 설정 · 자동 기록 · PT 자료 막힘 / 코치 = 본인 목록 · 남의 카드 · 미래 · 15일 전 · 시각 없음 막힘 · 신고 → 대표님 · 관리자 알림 3통 · 같은 신고 다시 = 고쳐 쓰기(알림 없음) · 처리 · 설정 · 자동 기록 막힘 · 취소 / 대표님 = 승인 → 그날 adjust 한 줄 + 코치 알림 · 다시 처리 막힘 · 지점장 분 ≤ 코치 분 막힘 · PT 꺼진 지점 자동 기록 막힘 · 자동 기록 한 번만 — 남은 줄 0 → DB 어긋남 점검 새 어긋남 0.
- **선릉역점 켬 (같은 날 23:5x — 대표님 「올려 + 적용해」의 '선릉역점에서 켜기'까지)**: 출근 알림 `ops_duty_settings` nudge_on(코치 15분 · 지점장 60분 · 시작 11/12 — 대상 근무자 7명, 모두 앱 계정 있음) · PT 자동 기록 `auto_record` — 켜는 순간 1건(그날 입장 + 그날 잡힌 차감, 담당 코치 있음). 둘 다 대표님 계정으로 `ops_duty_setting_set` · `ops_pt_auto_set` 을 불렀다. 끄기 = 근무자 카드 PT 탭 「자동 기록 끄기」 · 근무 탭 '출근 알림 끄기'(또는 같은 함수에 false).
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + PT 기록 1단계 + 이 마이그레이션 두 번) 85개(권한 · 코치는 본인 것만 · 검사 말 · 같은 신고 고쳐 쓰기 · 하루 10건 · 승인 = adjust/off 한 줄 · 반려 · 취소 · 내가 보낸 신고는 대표님 · 출근 알림 15/60분 한 번씩 · 얼굴 출근(앱 계정 · 이름 짝) · 쉰 날 · 대타 넘김/받음 · 위탁 · 다른 지점 없음 · 자동 기록 짝짓기 · 어림 · 한 번만 · 지운 기록 안 살림 · 꺼진 지점 그대로 · 켠 지점 알림 글 · 밤 요약 · 이틀 넘은 건) / vitest opsDuty 17 · opsPtRecord 31(자동 기록 3).

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
- **달력 보기** (2026-11-12 대표님 「운동 달력처럼 운영탭에 스케줄관리도 달력처럼 스케줄 한눈에 보고 관리할수있도록」 · DB 변경 없음): 맨 위 오른쪽 「주간 · 달력」(기본 달력 · 기기마다 기억 `153plan:period`). 달력 = 회원 '운동 달력'과 같은 모양(월요일 시작 · 오늘 민트 테두리 · 고른 날 검은 동그라미 · 앞뒤 달 흐리게 · 달 넘기기는 큰 카드 제목 아래 가운데 — 주간도 같은 자리) · 칸마다 색 점 = 그날 일정 종류(휴무(승인된 쉰 날 포함) → 외부 → 수업 → PT → 업무 → 개인 → 근무 시간, 4개까지 · 넘으면 3개 + 회색 점) · **팀 달력은 근무 시간을 뺀다**(평일마다 있어 점이 다 같아진다 — 그날 근무 n명은 아래 카드) · 내 달력은 근무 시간도 · 색 이름표는 그 달에 쓰인 것만. 날짜를 누르면 아래 「고른 날」 카드(팀 = 누가 무엇을 · 내 일정 = 그날 일정)가 그날로, 넣기 · 고치기는 같은 시트. 고른 날 카드에 「+ 내 일정」(대표님 · 지점장도 그날 바로 넣기 — 주간도 같음). 자료는 서버 함수 그대로 — `useOpsPlansMonth` 가 달력에 보이는 주(4~6주)를 `ops_plans_week` 로 주마다 받아 `mergeWeeks` 로 합친다(주간과 같은 캐시 · 달을 넘기는 동안 앞 달을 흐리게). 표시 계산 `dayMarks` · `presentMarks` · `monthMondays`(src/lib/opsPlans.ts · 시험 opsPlans.test.ts) · 달력 조각 [OpsPlanMonth.tsx](src/components/ops/OpsPlanMonth.tsx). 넘겨 볼 수 있는 달 = 이번 달 −6 ~ +12. 「할 일」 보기(`myboxer:ops-schedule` 11/08 설계 — DB 만 적용, 화면 대기)는 이 탭에 얹을 예정이라 보기 고르기 줄과 겹치지 않게 넣는다.
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
- **2권 「153 수업 진행」** (2026-11-13 대표님 「추천대로 진행하자」 — 1권과 따로 열고 아홉 장 모두 필독(확인 문제 · 서명), 부록은 필요할 때 · 원고 Claude Docs https://claude.ai/artifact/6ekX7Myn4b2bp2EM4eMb2d): **글 전부 DB `coach_manual_books` 의 book2 줄에만** — 앱 안 예시 없음(`useManualBook` 은 1권만 예시 · 2권 책 줄이 없거나 서버 함수가 없으면 서재에 1권만). 장 id `b2_prep · b2_flow · b2_warmup · b2_skill · b2_mitt · b2_pair · b2_bag · b2_finish · b2_log · b2_appendix`(서명 기록 이름 — 바꾸지 않는다). 책 JSON 은 원고 Docs 를 마크다운으로 내보내 변환한다(변환 스크립트 · JSON 은 저장소 밖 — 카드 id 짝 · 순서 영상 자리 표가 변환기 안). 글을 고치면 그 장 `version` 을 올린다(1권과 같다).
  - 서재: 「매뉴얼」 탭 맨 위 두 칸(표지 · 권 · 제목 · 서명 n/필독) — 누르면 그 책(`?book=book2`, `?ch=b2_…` 만 있어도 2권). 서명 · 읽음 현황 · 「읽어 주세요」는 책마다 따로(`book.id`). 머리글 부제는 책과 상관없이 '153 매뉴얼 · 읽기 · 확인 문제 · 서명'.
  - 새 블록 두 개([types.ts](src/lib/coachManual/types.ts) · [normalize.ts](src/lib/coachManual/normalize.ts) · [ManualBlocks.tsx](src/components/manual/ManualBlocks.tsx)): `card`(153 콘텐츠 카드 id — 타일 = 첫 장면 · 칸 색 · ▶(회원용 또는 코치용 영상) → 누르면 읽기 화면 위 카드 시트 `TrainingDrillSheet zClass="z-[118]"` — 코치용 영상 창 z-120 은 그 위. 카드 영상을 바꾸면 매뉴얼도 같이 바뀐다 · 지운 카드는 건너뜀) · `tplvideo`(수업 템플릿 순서 영상 — template · step 0~20 · title → `class_template_videos` 서명 주소 → VideoOverlay, 그 자리에 영상이 없으면 '준비 중'). 읽기 화면은 그 장에 나오는 카드 · 템플릿 영상만 받는다.
  - 표지 `public/assets/manual/cover-b2.webp`(+ `_s`) — 1권 선화 색(민트 #6CCFAD · 먹 #1A2229)으로 직접 그린 그림(시계 테두리 = 50분 수업 8블록 · 미트 · 글러브 · 샌드백 — 그림 크레딧(Higgsfield · ElevenLabs)이 바닥난 날). 장 그림은 없다(`image: null` → 표지 쪽 회색 칸에 '1장'). 크레딧이 생기면 1권 그림처럼 다시 그려 같은 이름으로 바꾼다.
  - 「읽어 주세요」 알림 [20261113150316_coach_manual_nudge_book.sql](supabase/migrations/20261113150316_coach_manual_nudge_book.sql): 1권은 그대로 · 2권부터 제목 '📘 153 매뉴얼 2권을 읽어 주세요'(책 줄 `data.no`) · 링크 `/office?tab=manual&book=book2`.
  - **적용 (2026-11-13 대표님 「적용하고 올리자」)**: 알림 함수 = MCP `apply_migration`(기록 `20261113081636_coach_manual_nudge_book` — 파일 번호와 다르고 본문 같음 · 함수 지문 = 로컬 기준본) → 2권 책 줄은 임시 이름 `b2stage` 로 두 장씩 넣으며 장마다 md5 를 로컬 기준본(저장소 밖 JSON 을 넣은 Postgres 16)과 맞추고, 전체 `md5(data::text)` 가 같을 때 `book2` 로 이름만 바꿨다(넣는 동안 반쪽 책이 코치님 화면에 안 보이게 — 글을 고칠 때도 같은 길) → 되돌림 시험(DO 블록 예외) ALL_OK: 코치 = 2권 10장 · 1권 그대로 · 서명 · 앞선 판 · 없는 장 · 알림 막힘 / 회원 = 책 막힘 · `{staff:false}` / 지점장 = 2권 알림 제목 · 링크 · 다시 = too_soon · 1권 알림은 예전 그대로 · 2권 현황 / 대표님 = 책 읽기 → 남은 줄 0 → DB 어긋남 점검: 이 일의 함수 0(그날 남은 새 어긋남 22개는 캘린더 3-2 창의 `ops_plan_*` · `_ops_recur_*` · `_ops_rrule_*` — 그 창이 마이그레이션 파일을 올리면 꺼짐).
  - **부록 표 칸 이름 — 8칸 (같은 날 대표님 「적용해」)**: 부록 「카드 · 칸 · 장」 표의 「샌드백 구령」 칸 '미트·샌드백' → '드릴' · `b2_appendix` 판 1 → 2(부록은 필독이 아니고 그날 2권 서명 0 — '새 판'이 뜨는 분 없음). 한 문장 갱신(`jsonb_set` 두 번 · 조건 = 지금 md5 · 장 id · 그 칸 글이 그대로일 때만)이라 반쪽 책이 보일 틈이 없다 — 바뀐 뒤 md5 = 로컬 기준본에서 같은 갱신을 한 값. 원고 Docs 표도 같이 고침.

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

### 회원 감정 설계 기준 (2026-11-12 대표님 「목표는 회원님들이 153복싱짐 선릉역점에 가치를 느끼고 만족을 느끼게 하는 것 · 달력 기능 스케줄러 기능도 목표는 회원님들의 감정을 설계하는 거야」)

회원 화면 · 코치 도구를 넣거나 뺄 때의 기준 — 문서 「153 회원 감정 설계 — 선릉역점에 넣을 기능 · 뺄 기능」(https://claude.ai/artifact/LK88UcbCHRvQNx6T8kaxu2 · 맨 아래 제작 프롬프트). 기능은 수단이고 감정이 결과물이다.

- 여섯 순간과 감정: 오기 전 = 기대 · 들어올 때 = 환영 · 운동할 때 = 유능감 · 끝났을 때 = 뿌듯함 · 안 오는 날 = 그리움(죄책감 금지) · 한 달 · 재등록 = 확신.
- 넣기 전 다섯 질문: ① 그 화면의 감정을 한 단어로 말할 수 있나 ② 체육관에 오게 하거나 온 날을 더 좋게 하나(앱 안에서만 끝나면 접기) ③ 못한 것(빠진 날 · 줄어든 숫자 · 뒤처진 순위)을 보여 주지 않나 ④ 코치님 · 동료의 이름과 말이 닿나(자동 문구보다 사람의 한 줄이 먼저) ⑤ 칭찬과 다음 한 걸음 하나로 끝나나. ① ~ ③ 을 통과 못 하면 만들지 않는다.
- 규칙: 하나 넣으면 하나 접기(화면을 늘리지 않는다 · 지우지 않고 접는다) · 숫자는 횟수보다 시간 · 지난 4주 쓴 회원이 5명 아래면 접기 후보(접는 것은 대표님 결정 뒤).
- 선릉역점 실측(11/12 · 지난 4주): 출석 130명 · 그중 앱 알림을 읽은 회원 33명 · 휴대폰 알림을 켠 회원 13명 → 감정은 메뉴가 아니라 오는 순간 · 첫 화면 한 장 · 코치님 한마디에서 만든다. 성과 숫자 = 주 2회 회원 비율 · 신규 첫 4주 8번 · 4주 끊김(동기부여 보고서 https://claude.ai/artifact/6sAvidMfhyLhFERCK5jXFw).
- 스케줄러(153운영본부 「일정」)도 같은 기준 — 코치님이 회원을 맞이하는 도구다. 다음 차례 「오늘 만날 회원」(약속한 회원 · 첫 4주 회원 · 오랜만에 온 회원 · 수강권이 곧 끝나는 회원)은 일정 탭 오늘 카드에 얹는다(새 탭 금지).
- 10/21 「출석 기록을 기분 좋게」(lib/attendanceCheer.ts — 잘한 것만 센다)를 모든 화면으로 넓힌 것. 접기 후보 · 넣을 순서 · 대표님 결정 항목은 문서에 있다(결정 전에는 접지 않는다).
- **11/12 저녁 대표님 결정 (「추천하는대로 진행할게」 — 문서 다섯 칸 모두)**:
  1. 운영본부 「일정」 달력 보기 · 회원 운동 달력 감정 설계판 → 올림.
  2. **접기** — 스토리 RPG · 복싱 퀴즈(지난 4주 0명) · 153마인드셋 · 153다이어트(각 1명 → 「프로그램」 묶음, 코치가 권할 때 여는 길만) + 동기부여 보고서 「빼거나 줄일 것」 표(21일 챌린지 · 마스터 트랙 보스 → 레벨 화면 안 · 루틴 빌더 → 코치 도구 · 실험 퀘스트는 숨은 미션만). **지우지 않고 첫 화면 · 전체 메뉴에서만 뺀다.** 미니게임(5명)은 그대로. 메뉴를 고치는 창(`myboxer:menu-edit` 메뉴 편집 패치)이 그 판을 올린 뒤 같은 창이 하거나 그 창과 맞춰서 — 두 창이 appMenu 를 따로 고치지 않는다.
  3. **미루기** — 「153 건강 교과서」 8과 · 퀴즈(11/08 계획 3단계 안)는 만들지 않는다.
  4. **스케줄러(153운영본부 「일정」)는 「오늘 만날 회원」 중심** — 11/08 계획의 코치 「중요한 일 3개」 · 작성률 집계는 미룬다(DB 표 `ops_daily_focus` 는 운영에 그대로 두고 화면만 안 만든다). 고정 업무 체크(오픈 · 마감 청소)는 계획대로.
  5. **운동 약속 제작 시작** — 회원 운동 달력에 약속한 날 · 그날 알림 · 복귀 보너스, 코치 「오늘 약속한 회원」. 새 표 · 새 함수는 대표님 「적용해」 뒤에 운영 DB 에(작업판 `myboxer:promise`). → 같은 날 저녁 적용 · 올림(아래 「153 운동 약속 1단계」).

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
- 코치 칸 「출근을 찍었는데 안 떠요」 (2026-11-12 대표님 — 선릉 코치님 두 분이 "출첵을 했음에도 안뜨는데 … 상습적으로 그러던데" → 「시간표대로 표시」) — [20261112205909_staff_on_duty_shift_hours.sql](supabase/migrations/20261112205909_staff_on_duty_shift_hours.sql):
  - 출근 기록은 정상이었다. 원인은 `public_staff_on_duty` 의 「출근 후 4시간」 규칙 — 브로제이는 직원 출근을 하루 한 번만 적고(선릉 최근 30일 156일분 중 155일분이 1건) 퇴근 · 다시 들어온 기록이 없다. 그래서 한 번 찍고 4시간 넘게 지나 일하는 코치가 근무 중에도 빠졌다: 낮 · 저녁으로 나눠 일하는 코치의 저녁 근무(날마다 3시간) · 낮에 PT 하고 저녁 수업 하는 코치 · 4시간 넘는 저녁 근무의 끝.
  - 고침: 예전 규칙 둘(지점장 · 관장 · 대표 = 오늘 출근했으면 종일 / 그 밖 = 출근 후 4시간)은 그대로 + **오늘 출근을 찍었고 지금이 153운영본부 「근무」 시간표의 근무 시간이면 보인다** — `computeDay`(src/lib/opsWork.ts)와 같은 기준(카드 켜짐 · 근무 기간 안 · 승인된 쉰 날이면 안 봄 · 대타로 넘긴 수업은 빼고 · 대타로 받은 수업 시간은 더함), 근무자 카드 ↔ 출근부 짝은 `ops_month` 와 같은 식(앱 계정, 없으면 이름). **뷰만** 바꿨다 — 새 함수 없음(로그인 없이 부를 함수를 늘리지 않게) · 열 · 권한 그대로 · 화면 코드 그대로(TV 가 1분마다 다시 읽는다). 시간표를 바꾸면 코치 칸도 따라간다.
  - 시간표가 없는 지도진을 종일 보이게 하려면 직함을 지점장 · 관장 · 대표로 — 153OS 직원 명단 동기화(`sync-staff-to-app`)는 빈 직함만 채워서 덮지 않고, 권한 함수(`_strategy_can_direct` · `_office_assign_seats`)는 '지점장' · '관장'만 봐서 '대표' 직함은 표시만 바뀐다(같은 날 선릉 계정 하나를 '대표'로 — 대표님 결정).
  - 다음에 같은 말이 나오면 순서대로: ① `staff_duty_logs` 에 오늘 줄이 있나(찍고 1~6분 뒤 들어온다 — 없으면 브로제이 · `sync-broj-checkins`) ② 직함 ③ 출근 시각 + 4시간 ④ 근무자 카드(`ops_staff` 켜짐 · 앱 계정 또는 이름이 출근부와 같은지) · 시간표(`ops_shift_rules` 요일 · 기간) · 그날 쉰 날 · 대타(`ops_day_entries`).
  - 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + 예전 뷰 + 이 마이그레이션 두 번) 27경우(쉰 날 · 대타 넘김/받음 · 승인 전 · 끝난/시작 전 시간표 · 다른 요일 · 꺼진 카드 · 근무 기간 밖 · 앱 계정 없는 코치 · 이름 짝 · 다른 지점 · 출근 안 찍음 · 어제만 찍음 · 두 번 찍힘) · 예전에 보이던 사람은 그대로 · anon 은 뷰만 읽고 표는 막힘 · 열 그대로. 운영 = MCP `apply_migration`(기록 `20261112121318_staff_on_duty_shift_hours` — 파일 번호와 다르고 본문은 머리말 한 줄만 다르다) → 로그인 없는 읽기(REST)로 선릉 5명 확인.

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
- 앱으로는 기존 길 그대로: 153OS `members` 트리거 → `sync-members-to-app` → 앱 `profiles.membership_end`(2026-11-13 부터 성별도 — 앱 성별이 빈 칸일 때만 '남' · '여', 아래 「체력 나이」). 만료 90일 넘은 옛 회원은 새로 만들지 않는다. 다짐에 같은 전화번호로 두 사람이 있으면 앱 계정은 하나(알려진 1건).
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

#### 체력 나이 · 심폐 체력(추정) — 같은 카드 넓힘 (2026-11-13 대표님 「심폐지구력 근력 건강나이등등도 모두 같은나이 평균과 비교해서 우리목적은 회원님들의 동기부여와 153복싱짐의 가치전달이야 그걸 통해 회원님들이 153복싱짐은 가치있다를 느껴야해」)

| 파일 | 역할 |
|---|---|
| [src/lib/fitnessAge153.ts](src/lib/fitnessAge153.ts) | 권장 운동량(지난 4주) · 심폐 체력 추정 · 체력 나이 · 처음보다 · 다음 목표 · 카드 한 장 모으기 `buildBodyCompare`(잰 값은 peerCompare153 그대로) · 문구 — 시험 fitnessAge153.test.ts |
| [src/data/nfaNorms.ts](src/data/nfaNorms.ts) `NFA_VO2MAX` | 국민체력100 표 7 — 20m 왕복오래달리기로 추정한 최대산소섭취량 19~64세 백분위(평균 칸은 표 6 과 같은 숫자라 안 씀 → 평균 = 50번째) |
| [src/data/knhanesActivity.ts](src/data/knhanesActivity.ts) | 국민건강영양조사 2025(잠정) 유산소 신체활동 실천율 — 성 · 나이대(19~29 · 10살씩 · 70+) |
| [PeerCompareCard.tsx](src/components/attendance/PeerCompareCard.tsx) | 주인공 체력 나이(또는 잰 값 · 다음 목표) · 심폐 체력 줄 · 성별만 없으면 카드에서 바로 고르기 — 시험 PeerCompareCard.test.tsx |

- 운동 검사 없이 어림: 같은 나이 · 성별 국민체력100 가운데 값(표 7 50번째)에서 시작 → 그 나이 '보통 사람'과 다른 만큼 더하고 뺀다. 크기 = 이인환 · 한권석 · 송문구 · 강현식(2022) 대한스포츠의학회지 40(1):39-48 — 한국 대학생 1,162명 러닝머신 최대 검사(가스 분석) 체지방률 식: 권장 운동량을 채움 +3.513 · 체지방률 1%p −0.411 · 안정시 심박 1회 −0.048 · 나이 1살 −0.308. '보통 사람' = 권장 운동량을 채우는 비율 국민건강영양조사 2025 성 · 나이대(예: 30대 여성 45.6%) → 채움 +3.513 × (1 − 비율) · 못 채움 −3.513 × 비율 · 체지방률은 국민체력100 같은 나이 50번째(남 7% · 여 16% 아래는 그 값) · 안정시 심박 70(국민건강영양조사 2015~2018 가운데 68~71). 넣지 않은 값은 보통 사람과 같다고 본다.
- 권장 운동량을 채움 = 지난 4주(이번 주 포함) 중 3주 이상 주 500 MET·분(앱 권장 운동량 · 기본 수업 2번)을 153 출석으로. 연구 기준(주 600 MET·분 · 3개월) · 국민건강영양조사(중강도 주 150분)와 같은 지침이라 앱의 권장 운동량 하나로 맞췄다. 153 밖 운동은 모른다(적게 잡는 쪽).
- 체력 나이 = 나이 − (추정 − 가운데) ÷ 0.308, 젊은 만큼은 내림 · 20세 아래로는 말하지 않음. 이름표 '153 운동 −N살 · 체지방률 −N살 · 안정시 심박 −N살' = 젊게 만든 몫만(1살 아래 빼고). 실제보다 많으면 숫자를 말하지 않고 주인공 = 다음 목표 「주 2번씩, 4주 중 3주 → 채우면 실제보다 N살 젊은 체력」 + 지난 4주 동그라미(잰 값이 있으면 그 지표가 주인공).
- 심폐 체력 상위 %는 추정이라 5% 단위로 올림 · 19~64세만(표 7) · 가운데 아래면 오른쪽 '다음 목표' + 한 걸음(못 채움 → 주 2번 · 채웠는데 체지방률 → '체지방률을 N%p 내리면'). '또래 100명 중 N명만 권장 운동량을 채워요'는 채운 회원에게 · 비율 60% 아래일 때만.
- 처음보다(체력 나이): 첫 출석 뒤 8주가 지나면, 첫 4주 출석 · 첫 체지방률 · 그때 나이로 다시 센 체력 나이와 지금의 차이(보이는 두 숫자 그대로) — 1살 이상 젊어졌을 때만 금색 띠.
- 성별만 없고 출생 연도가 있으면(64세까지) '지금 넣기' 대신 남성 · 여성 단추 — `save_my_fitness_extra(성별, null, null)`(서버가 coalesce 로 출생 연도 · 체지방률을 그대로 둠). 2026-11-13 선릉 실측(지난 4주 활동 회원 129명): 성별 없음 108 · 출생 연도 없음 56 · 체력 나이가 바로 보일 회원 13(성별 · 나이 있고 권장 운동량 채움) · 다음 목표 6 · 성별 한 번만 누르면 보일 회원 50 · 성별 · 출생 연도 둘 다 넣어야 하는 회원 56 — 숫자를 늘리는 열쇠는 성별 한 번 누르기.
- **성별은 153OS 회원 명단에서도 온다** (2026-11-13 대표님 「추천대로 진행」 → 「배포해」): 153OS 에는 성별(male/female)이 있는데 앱 `profiles.gender` 는 거의 비어 있었다(새 계정 user_metadata 에만 넣었고 handle_new_user 는 성별을 안 옮김 — 앱 성별 있는 계정 15). `sync-members-to-app` v12 가 앱 성별이 빈 칸일 때만 '남' · '여'로 채운다 — 회원 · 지점장이 고른 값은 그대로, 내 신체 정보에서 고른 값(`member_fitness_profile`)은 `get_my_fitness_extra` 가 먼저 쓴다(동기화 값은 gender_source 'gym'). 지도진 계정도 빈 칸이면 성별만(수강권 · 결제는 예전처럼 안 씀). 배포본 v11 = 저장소 확인 뒤 배포 → 크론과 같은 전체 새로고침(auto-sync-members {force:true})을 두 번 바로 돌려 전 회원을 한 바퀴: 앱 성별 있는 계정 15 → 2,274(남 1,608 · 여 666 = 153OS 성별 있는 회원 수와 같음 · 다른 값 0 · 실패는 예전부터 있던 전화번호 데이터 오류 2건뿐). 선릉 지난 4주 활동 129명: 성별 21 → 72 · 체력 나이 화면 대상(성별 · 출생 연도 · 19~64세) 67 — 체력 나이 숫자 약 40 · 다음 목표(또는 잰 값) 약 27(추정 — 출석 시간으로 어림) · 아직 성별이 없는 57명 중 55명은 153OS 에도 성별 · 출생 연도가 둘 다 없어 카드는 '지금 넣기'. 함께 달라지는 것: 몸무게를 안 넣은 회원의 운동량 칼로리가 성별 평균 몸무게 기준(`weightBasis`) · 153 PB 측정 화면 성별이 미리 골라짐(`Test153MeasurePanel`).
- '건강 나이'라는 말은 쓰지 않는다 — 건강검진(혈압 · 혈당 등)으로 매기는 말이라, 앱이 가진 자료로 만든 것은 '체력 나이(심폐 체력 기준)'. 국민체력100 공식 체력 나이(윤동현 외 2024 BMC — 윗몸일으키기 · 앉아윗몸앞으로굽히기 필요)는 앱에 없는 종목이라 쓰지 않았다.
- 오삼코치 안내 osamiFaq `att-peer`(체력 나이 · 심폐 체력 포함) — 문구를 바꾸면 같이.

### 붕대 감기 — 실제 영상 + 12단계 설명서 (2026-10-30 그림 애니메이션 · 2026-11-12 대표님 "내가 찍어 논 영상도 나오게 · 현재 있는 메뉴얼도 있게 · 글과 영상 이미지 활용해서 최대한 쉽게")

- /handwrap 는 배우는 순서대로다 ([HandWrapGuidePage](src/pages/HandWrapGuidePage.tsx)): ① **영상으로 먼저 보기**([HandWrapFullVideo](src/components/handwrap/HandWrapFullVideo.tsx) — 전체 44초 · 화면 안에서 재생 · '내 눈으로' ↔ '옆에서' · 천천히 · 아래 '순서는 3 · 3 · 3' 네 칸(손목 3바퀴 → 정권 3바퀴 → 손가락 사이 3번 → 손목에서 마무리): 영상이 지나가는 칸에 불 + 왜 하는지 한 줄, 칸을 누르면 그 부분부터 · '○단계 … 이 단계만 ›' = 그 단계 상세) → ② **12단계 설명서**([HandWrapStepViewer](src/components/handwrap/HandWrapStepViewer.tsx) — 한눈에 12칸 + 완성, 그림 그대로) → ③ **다 감았으면 확인**([HandWrapDoneCheck](src/components/handwrap/HandWrapDoneCheck.tsx) — 실제 사진 2장 + 다섯 가지 체크, 저장 안 함) → ④ 집에서 혼자 감아 보기 → 이것만 조심해요(실수마다 '○단계 보기' = 바르게 하는 단계 영상).
- 단계 상세 `?step=N`(1~13, 13 = 완성, 뒤로 가기로 닫힘) = [HandWrapStepDetail](src/components/handwrap/HandWrapStepDetail.tsx): 맨 위 **'실제 영상 | 그림'** — 같은 단계를 대표님이 직접 감는 반복 영상과 그림 애니메이션으로 바꿔 본다(처음은 실제 영상 · 절반 속도, 그림은 보통 속도 — 속도는 따로 기억). 시작 → 끝 옆 작은 그림 = 지금 안 보는 쪽(누르면 바뀜). 상세 열고 닫기는 화면이 쥔다([useHandWrapStepNav](src/hooks/useHandWrapStepNav.ts)) — 전체 영상 · 한눈에 · 실수 칸이 같은 상세를 연다.
- 실제 영상 = 대표님 10-20 촬영 원본(1080p · 구글 드라이브 DJI Device/OsmoPocket4P-95D7/20261020 — `…0408_D` 앞에서 · `…0407_D` 옆에서)을 손 쪽으로 잘라 다시 만든 것: `public/handwrap/real/` — `full.mp4`(앞에서 찍은 영상을 180도 = 내 손을 내려다보는 방향) · `side.mp4` · `stepNN.mp4`(12단계 + 완성 · 끝 모습에서 0.9초 멈춤) · `stepNN.webp`(끝 장면) · `stage1~4.webp` · `done_back/fist.webp`. 960×720 · 소리 없음. 만드는 법 `python3 scripts/make-handwrap-real.py <앞에서 원본> <옆에서 원본> <나올 폴더>`(자르는 초 · 화질이 그 안에) — 다시 만들면 `REAL_MEDIA_VERSION` 을 올리고, 자르는 초를 바꾸면 [handWrapGuide.ts](src/data/handWrapGuide.ts) `STEP_AT`(단계 시작 초) · `HANDWRAP_FULL.*.stageAt`(큰 흐름 시작 초 — 옆에서 영상은 따로)도 같이.
- **영상에는 왼손이 찍혀 있다** — 오른손(기본)을 고르면 영상 · 사진을 좌우로 뒤집는다(`handWrapRealFlip`, 영상 안에 글자가 없다). 그림은 손마다 따로 만든 것이라 뒤집지 않는다. 감는 손 · 보는 방법 · 속도는 [useHandWrapPrefs](src/hooks/useHandWrapPrefs.ts) 한 곳(이 기기 localStorage `mb153.handwrap.*`) — 한 칸에서 바꾸면 화면 전체가 같이 바뀐다.
- 영상을 0.1초씩 넘겨 확인한 것(2026-11-12): 손목 3번 · 정권 3번 · 손가락 사이 3칸(칸마다 대각선으로 내려와 손목 한 바퀴) · 손등에서는 엄지 → 새끼 쪽 — 12단계 설명서와 같은 순서 · 같은 방향. 그래서 '3 · 3 · 3'은 영상 · 설명서 둘 다에 맞는 말이다(단계 글을 고치면 `HANDWRAP_STAGES` 도 본다).
- 그림(12단계 애니메이션): 시작(초록) · 끝(주황) 점 · 바퀴 수 · 손바닥 쪽 길(남색 점선) · '손가락 사이로 넣어요' · '손바닥 쪽'(뒤집어 본 모습) 표시는 **그림 안에** 들어 있다 — 앱이 위에 그리지 않는다. 그래서 상세 그림 위 앱 표시(몇 단계 · 멈춤)는 아래쪽에만. 손마다 따로 만든 그림: 오른손(기본) `public/handwrap/steps/stepNN.mp4 · .webp · _s.webp` · 왼손 `stepNN_l…`. 글 속 ↗ ↘ 는 오른손 기준(왼손이면 `mirrorArrows`). 그림을 다시 만들면 `STEP_MEDIA_VERSION`.
- 글 · 그림 · 영상 주소는 [handWrapGuide.ts](src/data/handWrapGuide.ts) 한 곳(`HANDWRAP_STEPS` · `HANDWRAP_STAGES` · `HANDWRAP_FULL` · `HANDWRAP_DONE_CHECKS` · `HANDWRAP_MISTAKES`). 화면 글을 바꾸면 오삼코치 안내(osamiFaq `tr-handwrap`) · 검색(appSearch `handwrap`)도 같이.
- 전체 영상은 누를 때 받는다(`preload="none"` — 표지 그림만) · 단계 상세가 열리거나 화면 밖으로 밀려나면 멈춘다. 단계 영상은 다음 단계 것을 `<link rel="prefetch">` 로 알려 둔다(아이폰 사파리는 무시 — `fetch` 로 직접 받으면 재생기가 그 사본을 못 써 두 번 받는다).
- 예전 `public/handwrap/front · side`(720p 전체 화면)는 지웠다. 훈련 라이브러리에 코치가 영상 주소를 넣으면 '코치 영상 보기' 단추가 붙는 것은 그대로.
- 훈련 라이브러리 '복싱 붕대 감기' 글(DB `training_exercises` 한 줄 — 요약 · 방법 · 코치 포인트 · 흔한 실수)도 12단계 · 엄지 → 새끼 · 3 · 3 · 3 으로 맞췄다 (2026-11-12 대표님 「적용해」 · [20261112195119_handwrap_library_12steps.sql](supabase/migrations/20261112195119_handwrap_library_12steps.sql) MCP 적용 — 예전 9단계 · '새끼 → 엄지' · '패드' 말 뺌, 코치가 그사이 고친 글이면 안 바꾸는 조건). 화면 단계 글을 바꾸면 이 글도 같이 — 다음 판도 지금 글이 그대로일 때만 바꾸게 조건을 건다.
- `preview/handwrap-photo`(10-30 사진 설명서 시안 · main 에 안 들어감)는 대표님 새 사진을 기다리던 가지 — 이제 단계마다 실제 영상 · 끝 장면이 있으니 이어 갈 때는 이 화면 위에서 한다.
- 올림 (2026-11-12 대표님 「올려」): 미리보기 `preview/handwrap-learn` 뒤 대표님께 1분 둘러보기 영상 · 화면 6장으로 확인받고 main 에 합침 — DB 변경 없음. 미리보기 주소는 아이폰에서 영상이 안 나오므로(아래 「큰 기능은 미리보기 먼저」) 영상이 든 화면은 둘러보기 영상으로 확인받는다.

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
- **50MB 아래도 720p 로** (2026-11-12 대표님 「2번까지 하고 보관기관은 한달로」): 심사함은 모든 영상을 `keepIfSmall: true` 로 넘긴다 — 이미 가벼운 영상(`isAlreadySmall`: 짧은 변 720 이하 · 평균 3Mbps 이하 · 한도 안 = 앱 촬영본)과 원본이 목표 비트레이트보다 가벼운 영상(아이폰 HEVC 등)은 다시 만들지 않고 원본 그대로(`skipped`), 다시 만든 쪽이 더 커도 원본. 50MB 아래는 줄이다 '그대로 쓰기'(멈추기 자리)를 누르거나 실패하면 원본으로 올린다(예전처럼), WebCodecs 없는 기기도 원본. 50MB 넘는 영상만 꼭 줄여야 한다. 시험(클라우드 크롬): 1080p 20초 22.6MB → 6.3MB · 360p 2Mbps 앱 촬영급 · 1080p 저비트레이트 2.9MB → 그대로(바로).

### 타이틀매치 영상 보관 한 달 (2026-11-12 대표님 「보관기관은 한달로」)

- 도전이 끝난(합격 · 마감 · 취소) 지 **30일** 지나면 그 도전의 영상 파일(치는 · 받는)을 저장소에서 지운다 — 합격 · 불합격 기록은 남고 `title_match_attempts.video_deleted_at` 에 지운 시각. 기록에 붙지 않은 파일(올리다 끊김)은 하루 뒤. 열린 도전(신청 중)의 영상은 끝날 때까지 둔다.
- 흐름: 크론 `title-video-cleanup`(매일 04:23 KST = `23 19 * * *` UTC) → Edge Function [supabase/functions/title-video-cleanup](supabase/functions/title-video-cleanup/index.ts)(x-auto-key · verify_jwt=false · `{ dry_run: true }` 면 고르기만 · `days` 1~365) → DB `title_match_video_cleanup_targets(_days, _limit)`(한 기록의 두 파일은 함께) → 저장소 `remove` → `title_match_mark_videos_deleted(_paths)`(한 기록의 파일이 모두 지워졌을 때만 표시). 두 DB 함수는 service_role 만. `storage.objects` 는 SQL 로 못 지운다(`protect_objects_delete`) — 꼭 저장소 API 로.
- 날수를 바꾸면 세 곳: Edge `KEEP_DAYS` · DB `_days` 기본값 · 화면 `TITLE_VIDEO_KEEP_DAYS`(회원 안내 '영상은 도전이 끝나고 30일 동안 볼 수 있어요' · 심사함 아래 한 줄). 지운 영상은 기록 목록에서 단추 대신 '영상 보관 끝'.
- 마이그레이션 [20261112173151_title_match_video_retention.sql](supabase/migrations/20261112173151_title_match_video_retention.sql) (새 칸 · 함수 둘 · `get_title_match_state` 에 `videoDeletedAt` · 크론).

### 타이틀매치 심사 영상 2개 — 치는 영상 · 받는 영상 (2026-11-12 대표님 「영상도 2개 올려야해 치는거 받는거」)

- 심사함(`TitleMatchJudgePanel`) 도전마다 칸 2개: ① 치는 영상(완벽한 자세로 3번 연속) ② 받는 영상(파트너에게 미트로 3번 받아주기). 칸마다 앱으로 촬영 · 찍어 둔 영상 · 50MB 넘으면 자동 줄이기(한 번에 한 칸씩). **합격은 두 영상 모두, 불합격은 치는 영상만으로도**(3번 연속이 안 되면 받기까지 못 간다) — 화면 `attemptUploadBlocker`([src/lib/titleMatchChallenge.ts](src/lib/titleMatchChallenge.ts)) = 서버 규칙. 칸 이름 · 안내 · 촬영 창 안내 한 줄은 `TITLE_CLIPS` 한 곳.
- 올리기(`useRecordTitleAttempt`): 치는 영상 → 받는 영상 차례로 저장소(`…-hit.mp4` · `…-recv.mp4`) → `record_title_match_attempt_v2(_member_id, _hit_video_path, _receive_video_path, _passed, _note)`.
- DB [20261112161952_title_match_two_videos.sql](supabase/migrations/20261112161952_title_match_two_videos.sql): `title_match_attempts.receive_video_path`(새 칸) · v2 새 함수(v1 본문 그대로 + 받는 영상 검사: 이 회원 폴더 · 실제 파일 · 치는 영상과 다른 파일 · 합격이면 꼭) · `get_title_match_state` 도전 기록에 `receiveVideoPath`. **v1(영상 1개)은 옛 화면 호환용으로 남겨 둔다 — 새로 고치지 않는다.**
- 도전 기록(`TitleAttemptList`, 회원 화면 · 심사함): 받는 영상이 있으면 단추 '치기' · '받기', 영상이 하나면(예전 기록 · 치는 영상만 올린 불합격) '영상'. 회원 안내(`titleMissionRules`)도 '치는 영상 · 받는 영상을 찍어 앱에 올려요'.

### 로드맵 칸 (2026-10-30 대표님 "로드맵 메뉴가 안 보여" · "검색해도 안 나오고")
- 랭크업(`/rank-up` — 40단계 길 · 리그별 레벨업 기준 · 타이틀매치 · 단증 도전)은 10-10 하단 '랭크업' 탭을 뺀 뒤 MY복서 라이센스 카드 승급 막대로만 들어갈 수 있었다.
- 전체 메뉴(`src/lib/appMenu.ts`) 단독 칸 **「로드맵」**(글리프 `roadmap` = 접힌 지도 + 민트 점선 길 + 금 깃발) — 회원은 MY복서 다음 2번째, 코치진은 153운영본부 다음. 검색 `f:rankup` 이름 「로드맵 · 레벨업 기준」 · 관련어 로드맵 · 랭크업 로드맵 · 40단계 · 단증 도전 (테스트 appSearch.test.ts · officeLayout.test.ts).

### 전체 메뉴 편집 · 내 바로가기 (2026-11-08 대표님 「바로가기 기능 만들어줘 … 라이브보드까지 가는 여정이 너무 길어 … 현재 있는 바로가기 메뉴들도 옮기고 빼고 수정할수있게해줘 회원님들도 나도 가능하게 아이폰이나 안드로이드 처럼」)

전체 메뉴(홈 카드 · 아래 '전체' 시트 — 같은 `HomeMenuGrid`)를 사람마다 아이폰 홈 화면처럼 고친다. 새 페이지 없음. 고친 적이 없는 사람은 예전과 똑같이 보인다(시험이 지킨다).

| 파일 | 역할 |
|---|---|
| [src/lib/menuLayout.ts](src/lib/menuLayout.ts) | 화면 없는 계산 — 바로가기 목록 `menuCatalog()`(기본 메뉴 → `SHORTCUT_EXTRAS` → 기능 검색 `FEATURES` 의 화면 이동 항목, 같은 곳은 하나) · 배치 `MenuLayout`(entries · known · updatedAt) · `resolveEntries`(저장 뒤 새로 생긴 기본 칸은 끝 · 그 묶음 끝에 저절로, 본인이 뺀 칸은 다시 안 생김) · `buildMenuView`(권한 · 편집 중 모양) · 고치기(`moveEntry` · `applyOrder` — 안 보이는 칸은 제자리 · `mergeEntries` · `removeEntry` · `dissolveFolder` · `renameEntry` · `addEntry`) · `parseLayout`(기기 · DB 값을 믿지 않고 다듬음 — 이름 12자 · 첫 화면 48칸 · 폴더 24칸) — 시험 menuLayout.test.ts |
| [src/hooks/useMenuLayout.ts](src/hooks/useMenuLayout.ts) | 저장 — 이 기기 `localStorage['153menu:layout:<user id>']`에 바로 + DB `save_my_menu_layout` 에 0.7초 모아서(앱을 닫을 때 바로). 열 때 DB `get_my_menu_layout` 과 비교해 새것(updatedAt). DB 함수가 없으면(PGRST202) 이번 접속 동안 이 기기에만. React Query `["153menu","layout",uid]` — 홈 카드와 시트가 같이 바뀐다 |
| [src/components/home/menuEdit/useMenuDrag.ts](src/components/home/menuEdit/useMenuDrag.ts) | 끌기 — 보통 화면 0.45초 길게 누름 = 편집 모드 + 그대로 끌기 · 편집 중 그림 칸(touch-action none)은 바로, 이름 쪽은 0.16초 눌러야(그 전에 움직이면 스크롤) · **손가락이 멈춘 자리에서만** 자리 바꾸기(0.11초) · 칸 한가운데 0.38초 = 합칠 칸(민트 테두리) → 놓으면 폴더에 넣기 / 메뉴끼리 새 폴더 · 폴더 칸을 폴더 상자 밖에 놓으면 첫 화면으로 · 위아래 끝 자동 스크롤 · 끄는 동안 body[data-menu-dragging] · Esc · pointercancel = 취소 |
| [src/components/home/menuEdit/MenuEditSheets.tsx](src/components/home/menuEdit/MenuEditSheets.tsx) | 창 3개(document.body 로 띄움 z-120) — 메뉴 고치기(이름 · 넣을 곳 · 앞으로/뒤로 · 메뉴에서 빼기) · 폴더 고치기(이름 · 폴더 풀기 · 폴더째 빼기) · 바로가기 추가(검색 = 기능 검색과 같은 `scoreEntry` · '다시 넣기 · 뺀 메뉴' / '운영진' / '모든 화면' · 넣을 곳 칩 · 이미 있으면 '옮기기') |
| [src/components/home/HomeMenuGrid.tsx](src/components/home/HomeMenuGrid.tsx) | 머리 '편집/완료' · 편집 중 칸 흔들림(`animate-menu-jiggle`, 움직임 줄이기 설정이면 멈춤) · '−' 빼기(토스트 '되돌리기') · 칸 누르면 고치기 창 · 첫 화면 끝 '+ 바로가기' 칸 · 편집 도구(새 폴더 · 처음대로)는 칸들 **아래**(길게 눌러 편집 모드가 켜질 때 칸이 손가락 아래에서 밀리지 않게) · '내 정보' 묶음은 보통 화면에도 '+ 추가' 칸 — 시험 HomeMenuGrid.test.tsx |
| [supabase/migrations/20261108232425_user_menu_layout.sql](supabase/migrations/20261108232425_user_menu_layout.sql) | 새 표 `user_menu_layouts`(user_id · layout jsonb · updated_at, RLS 켬 · 직접 읽기쓰기 없음) · 새 함수 `get_my_menu_layout()` · `save_my_menu_layout(jsonb)`(본인 줄만 · 객체 · 32KB) — 기존 함수 · 표는 그대로 |

- 칸 하나 = 가는 곳 하나(경로 + ?탭 — 예 `/manager/live-board` · `/office?tab=plan`). 보이는 조건 `MenuRequire`: diet · staff(코치진 — 홈 메뉴와 같은 기준) · office · dm(메시지를 쓸 수 있는 계정 — 예전 '메시지 숨기기'와 같음) · manager(앱 권한 코치 · 지점장 · 관리자 = `ManagerRoute` 를 지나는 분 — 관리자 화면 /manager … 은 이것) · admin(관리자 · 전체관리자). 배치에 있어도 권한이 없으면 안 보이고, 권한이 생기면 그 자리에 나타난다.
- 운영진 바로가기(`SHORTCUT_EXTRAS`): 라이브보드 · 회원 관리 · 153 PB 측정 · 가입 승인 · 레벨 심사 · 오늘 운영 · 위험 회원(= `/manager?tab=…`, `MAIN_TABS` 이름과 같아야 한다) · 코치 화면 · 루틴 만들기 · 전략 회의 · 근무 · 팀 일정 · 매출(admin) · 전체 관리(admin). 회원도 하단 탭 화면(훈련 · 랭킹 · 알림)과 기능 검색의 화면(153 PB · 내 출석 기록 · 코치 소개 …)을 넣을 수 있다.
- **새 메뉴를 만들 때**: 기본 메뉴(`APP_MENU`)에 넣으면 고친 사람에게도 끝에 저절로 붙는다(known). 운영진 화면 · 탭을 바로가기로 넣게 하려면 `SHORTCUT_EXTRAS` 에 한 줄(경로 = App.tsx 라우트, 권한 맞게). 기능 검색(`FEATURES`)의 화면 이동 항목은 따로 하지 않아도 바로가기 목록에 들어간다(이름은 ' · ' 앞까지).
- DB 적용 전에도 앱은 이 기기에만 저장하며 그대로 돈다(순서 상관없음). 적용하면 다음에 열 때 이 기기 값이 DB 로 올라간다.
- **적용 · 다시 얹기 (2026-11-12 · 클로드·boxing5969.menued2)**: 11-08 커밋 c19d720 은 푸시되지 않은 채 남아, 대표님이 붙여 준 패치로 최신 main 위에 다시 얹었다. 패치가 중간에 잘려 `menuLayout.ts` 227줄부터 · 위 SQL · tailwind `menu-jiggle`(±1.6° · 0.28초 — 값은 이때 정함)은 이 설명과 원래 시험(menuLayout.test.ts · HomeMenuGrid.test.tsx)대로 다시 썼고, 끝 경우 시험 [src/lib/menuLayoutEdge.test.ts](src/lib/menuLayoutEdge.test.ts) 23개를 더했다. 운영 DB 는 MCP 로 적용(기록 `20261112095756_user_menu_layout` — 파일 번호와 다르고 본문은 같다) · 되돌리는 시험 25/25(본인 줄만 · 객체만 · 32KB · 남의 줄 안 보임 · 로그인 없음 · anon 막힘 · 표 직접 읽기쓰기 막힘) · DB 함수 지문 = 이 파일.

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
- **감정 설계판** (2026-11-12 대표님 「달력 기능도 목표는 회원님들의 감정을 설계하는 거야」 · DB 변경 없음): 기념일 = 금색 도장(첫 도장 · 출석 축하를 채운 날 — 서버 `milestones.reachedOn`) · 고른 날 아래 '그날의 의미' 한 줄(다시 시작한 날 = 14일 넘게 쉬고 온 날, 쉰 기간은 말하지 않는다 · 그 달 가장 길게 운동한 날 = 운동 시간을 실제로 잰 날 하나가 뚜렷이 길 때 · 3번 이상 온 달) · 지난 달을 넘겨 보면 '10월 · 8시간 36분 운동했어요'(앞 달보다 늘었을 때만 '9월보다 +N' 칩) · 새 달 첫 7일엔 '지난달 … 운동했어요 · 11월도 이어 가요'(홈만 — `recap`, 이번 달 숫자는 '내 운동'이 주인공이라 다시 쓰지 않는다) · **'이번 주 n번 왔어요' 칩은 뺐다**(도장 줄이 이미 말한다). 계산 [calendarMoments.ts](src/lib/calendarMoments.ts)(시험 — 글에 빠진 · 쉰 · 줄어든 · 밖에가 없는지도 본다). '153에서의 첫날'이라고 쓰지 않는다(기록은 2026-02 부터라 오래 다닌 회원에게는 사실이 아니다 → '첫 도장을 찍은 날').
- 다음 단계(보고서 순서): 2단계 운동 약속(`myboxer:ops-schedule` 설계 — 약속한 날 = 민트 테두리 → 출석하면 채워짐 · 빠지면 회색 점) · 3단계 오늘의 체크(다 채운 날 금색 별) · 4단계 153OS 공지 '일정 날짜' · 한 줄 템플릿 칩. 모두 이 카드의 날짜 칸에 얹는다.
  - → 운동 약속은 11/12 저녁 따로 올림(아래 「153 운동 약속 1단계」) · 오늘의 체크는 아래 2-1단계.

#### 2-1단계 — 오늘의 체크 · 나만의 체크 · 한 줄 · 기분 스티커 · 금색 별 (2026-11-12 대표님 「추천대로」 · 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b)

봄 회원님 11/11 제안의 남은 것 — 앱 활동을 하면 저절로 체크(퀘스트 깨는 기분) · 내가 고르는 체크리스트(잽 연습 몇 번) · 오늘 운동 간단히 기록. 보고서의 네이버 캘린더 대응: 다이어리 → 한 줄 · 스티커 → 기분 스티커 · 할 일/습관 → 나만의 체크 · 듀얼 보기 → 그날 카드 · 습관 독려 알림은 2-2(알림 설정과 같이)로 옮김.

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261112211833_calendar_checks_stage21.sql](supabase/migrations/20261112211833_calendar_checks_stage21.sql) | 새 표 2 — `member_check_items`(나만의 체크 · 3개까지 · 이름 20자 · 목표 1~9,999 + 단위 번/분/라운드/세트/km/개 · weekdays null = 매일 · 빼기 = `archived_at`) · `member_check_days`(회원 · 날짜마다 한 줄: 한 체크 `done` uuid[] · 기분 스티커 strong/fire/proud/mitt/sweat/tired/hurt/rest). 함수 `get_my_calendar(p_from, p_to)`(63일까지 — 항목(그 범위에 있던 것, 뺀 것 포함) + 날마다 응원(boxing_cheers 보낸 것) · 153(community_reactions) · 한 줄(champion_journal_entries kind journal, 그날 마지막 글) · done · 스티커) · `set_my_check_item` · `remove_my_check_item` · `set_my_check_done`(오늘부터 6일 전까지 · 그날 있던 항목 · 그 요일만) · `set_my_day_sticker`(같은 창) · 안쪽 `_my_check_items`. 쓰는 사람 = `_is_active_member`(승인 전 계정은 {on:false}) |
| [src/lib/calendarChecks.ts](src/lib/calendarChecks.ts) | 서버 값 읽기 · 그날의 체크(`dayChecks` — 저절로 3개 체육관 · 응원(응원 또는 153) · 한 줄 + 그날의 나만의 체크) · 금색 별(`isStarDay` = 다 채운 날) · 한 줄(`checkProgress` — 채운 것과 다음 한 걸음만, 지난 날 0개는 말 없음) · 스티커 표 · 만들기 검사(서버와 같은 말) · 캐시 고치기 — 시험 calendarChecks.test.ts |
| [src/services/calendarCheckService.ts](src/services/calendarCheckService.ts) | `["153cal2", 회원, from, to]` — 보이는 날짜(이번 주 또는 한 달 4~6주)만 · 했어요 · 스티커는 누르는 순간 바뀌고 실패하면 되돌림 · 함수 없음(적용 전 · 옛 DB 미리보기) · 승인 전 = 꺼짐(달력은 예전 그대로) |
| [CalendarChecks.tsx](src/components/attendance/CalendarChecks.tsx) · [CheckItemsSheet.tsx](src/components/attendance/CheckItemsSheet.tsx) | 그날 카드 `DayChecksPanel` — 아무 날도 안 고르면 '오늘의 체크' 한 줄(칩 + 한 줄 + 오른쪽 위 '나만의 체크 ›'), 날짜를 누르면 들어온 시각 · 운동 시간 · 그날의 의미 + 체크 + 쓴 한 줄(공개 범위 · 사진) + 기분 스티커 8개(오늘부터 6일 전까지). 저절로 체크는 누를 수 없고 오늘 아직이면 그 일을 하는 창(한 줄 쓰기 = 기존 '오늘 운동 한 줄' · 응원 보내기 = 기존 응원 창). 나만의 체크 시트 = 지금 항목(고치기 · 두 번 눌러 빼기) + 예시 4개 + 이름 · 숫자 · 단위 · 요일 |
| [WorkoutCalendar.tsx](src/components/attendance/WorkoutCalendar.tsx) `withChecks` | 홈 · 내 운동 기록(내 기록일 때만) — 칸 오른쪽 위 금색 별(흰 동그라미) · 오른쪽 아래 기분 스티커 · 오늘까지는 출석 안 한 날도 눌러 그날 카드 · 체크를 켜면 한 달 줄 간격을 넓힘(별 · 스티커가 겹치지 않게) · 한 줄 · 응원 · 나만의 체크 창은 누를 때 받는 조각(lazy) · 창을 닫으면 체크를 다시 읽음 |

- 한 줄 기록은 새 표 없이 기존 `champion_journal_entries`('오늘 운동 한 줄' — 기분 · 사진 · 공개 범위 · 첫 글 퀘스트 보상 그대로). 달력에서 열면 처음 공개 범위 = **나만 보기**(대표님 결정 · `ChampionJournalSheet defaultVisibility="private" rememberKey="cal"` — 커뮤니티 글쓰기의 기억과 따로). 지난 날 한 줄은 쓸 수 없다(그날의 글만).
- 금색 별 = 보상 없음 · 별만(대표님 결정). 체육관에 온 날만 다 채울 수 있다(체육관도 체크 하나).
- 오삼코치 브리핑은 읽은 기록이 어디에도 남지 않아 저절로 체크에 넣지 않았다. 넣으려면 읽음 기록부터.
- '홈의 오늘 운동 한 줄 입구를 달력으로 옮기기(접기)'는 할 것이 없었다 — 그 입구는 이미 홈이 아니라 퀘스트 메뉴(`/myboxer/quest` HomeEngagementSection)에 있고, 튜토리얼이 그 카드(`data-tour="champion-journal-card"`)를 짚는다. 홈 카드 수는 그대로(달력 카드 안에 한 줄).
- 시험: 로컬 Postgres 16 뼈대(`_is_active_member` 는 운영 본문 그대로) + 마이그레이션 두 번 → 14묶음(로그인 없음 · 승인 전 · 코치 · 지난 활동 읽기(자정 경계 · 남의 글 · 다른 종류 빼기) · 만들기 · 잘못된 값 6가지 · 했어요/취소/두 번 · 고칠 수 있는 날 · 요일 · 스티커 · 빼기(지난 기록 그대로 · 다시 3개) · 범위 · 다른 회원 · 권한) ALL_OK / vitest calendarChecks 10 · CalendarChecks 2.
- **적용 (2026-11-12 22시 대표님 「적용하고 올려」)**: 운영 DB = MCP `apply_migration`(기록 `20261112133801_calendar_checks_stage21` — 파일 번호와 다르고 본문은 같다 · 새 표 2 · 새 함수 6) → DB 어긋남 점검에서 이 함수들은 어긋남 없음(그때 뜬 `goods_*` 9개는 다른 창 작업) → 되돌림 시험(DO 블록 예외) ALL_OK: 로그인 없음 · 승인 전 계정 꺼짐 · 선릉 회원 = 만들기(이름 정리 · 3개까지 · 숫자 없으면 단위 없음 · 20자) · 했어요(두 번 = 하나) · 내일 · 오늘 만든 항목의 어제 막힘 · 스티커(체크 그대로 · 잘못된 값 막힘) · 읽기 · 취소 · 빼기(지우지 않음) / 다른 회원 = 남의 항목 막힘 · 안 보임 / anon · 안쪽 함수 · 표 직접 읽기 막힘 — 남은 줄 0.

#### 2-2단계 — 153 일정 · 약속 알림 시각 · 휴대폰 캘린더 · 저녁 체크 알림 · 저요 한 모집 (2026-11-13 대표님 「다음」 · 153 일정은 「앱 운영본부에서」)

보고서 2-2 다섯 가지 — 봄 회원님 제안의 마지막 하나(복싱장 공지가 달력에 저절로)는 153OS 공지 대신 **153운영본부 「일정」 탭에서 올리는 길**로(대표님 선택 — 153OS 공지에 일정 날짜를 붙이는 것은 그 공지를 쓰게 되면 클로드·은미.os153 에 넘긴다).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261113001417_calendar_stage22.sql](supabase/migrations/20261113001417_calendar_stage22.sql) | 새 설정 `app_settings.calendar_notice`(event_morning 08:30 · event_eve 19:00 · promise_eve 20:00 · nudge_at 20:00 · quiet_after 21:00 · 알림 받는 회원 = 수강권이 끝난 지 7일 안이거나 최근 30일 안에 온 그 지점 승인된 회원) · 새 표 `branch_calendar_events`(지점 · 종류 closed 휴관 · short 단축 운영 · event 이벤트 · match 대회 · class 특강 · etc 그 밖 · 한 줄 40자 · 31일까지 · 알림 그날 아침 / 하루 전 저녁 · 보낸 시각 · 보낸 수 · 빼기 = `removed_at`) · `member_calendar_prefs`(저녁 체크 알림) · 새 칸 `member_promises.remind`(eve · 07:00 · 08:30 · 12:00 · 17:00) · 새 함수 `ops_cal_events` · `ops_cal_event_save` · `ops_cal_event_remove` · `set_my_calendar_prefs` · `set_my_promise_v2` · `calendar_tick`(예약 `calendar-tick` 10분마다) · 안쪽 `_cal_*` / 고친 함수(이름 · 인자 · 권한 그대로) `get_my_calendar`(+ events · calls · nudge) · `promise_tick`(고른 시각 · 휴관일) · `_promise_json` · `get_my_promise`(+ remind · eve_at) |
| [src/lib/calendarEvents.ts](src/lib/calendarEvents.ts) | 153 일정 · 저요 한 모집 읽기 · 그날 일정 · 휴관일 · 칸 점 · 글(날짜 · 모집 한 줄 · 알림 한 줄) · 올리기 검사(서버와 같은 말) · '지금 올리면 10분 안에' — 시험 calendarEvents.test.ts |
| [src/components/ops/OpsCalEvents.tsx](src/components/ops/OpsCalEvents.tsx) · [src/services/calendarEventService.ts](src/services/calendarEventService.ts) | 「일정」 탭 맨 아래 「회원 달력」 카드(다가오는 153 일정 · 알림 상태 '그날 아침 보냄 · 150명') + 올리기 · 고치기 시트(종류 · 한 줄 · 하루/여러 날 · 알림 두 가지 · 회원님 달력 미리 보기 · 두 번 눌러 빼기) |
| [supabase/functions/calendar-ics/](supabase/functions/calendar-ics/index.ts) · [src/lib/promiseIcs.ts](src/lib/promiseIcs.ts) | 「휴대폰 캘린더에 추가」 — 주소 인자(요일 · 첫 날 · 시간대 · 알림 시각 · 지점 짧은 이름)로 매주 반복 일정 하나(.ics · 한국 시간 · 알림 · 75바이트 접기)를 만든다. DB 없음 · 로그인 없음(verify_jwt=false) · 지어낸 글이 들어가지 않게 제목 · 장소 · 설명은 함수가 정한 글만. 글 · 검사 [ics.ts](supabase/functions/calendar-ics/ics.ts)(시험 src/lib/calendarIcs.test.ts) |
| 회원 화면 | [WorkoutCalendar](src/components/attendance/WorkoutCalendar.tsx) 칸 아래 점(주황 153 일정 · 회색 휴관 · 하늘색 저요 한 모집 — 있을 때만 이름표) · 그런 앞날도 눌러 보기 / [CalendarChecks](src/components/attendance/CalendarChecks.tsx) 그날 카드 위 한 줄씩(Agenda — 모집을 누르면 커뮤니티 '오늘 같이 해요') · 앞날은 일정만 / [PromiseSheet](src/components/attendance/PromiseSheet.tsx) 알림 시각 칩 · 「휴대폰 캘린더에 추가」(저장한 약속 그대로 — 고친 뒤에는 저장 알림의 '휴대폰 캘린더에' 단추) / [CheckItemsSheet](src/components/attendance/CheckItemsSheet.tsx) 맨 아래 「저녁 8시 체크 알림」 |

- 올리기 = 대표님 · 그 지점 관리자(`ops_managers` — 「일정」 탭 팀 일정과 같은 `_ops_plan_can_view_all`, 앱 권한 branch_manager 만으로는 안 됨) · 보기 = 그 지점 「일정」 탭 팀(코치님은 보기만 — 올라간 일정이 없으면 카드도 없음). 회원 달력에는 내 지점(`profiles.branch_name`) 일정만.
- 알림(`calendar_tick` · 일정마다 한 번 · 한 문장으로 넣어 휴대폰 알림이 한 번에): 그날 아침 = 시작하는 날 08:30부터 · 하루 전 저녁 = 전날 19:00부터, 둘 다 21:00 전까지(그 시각이 지난 뒤 올리면 10분 안에 · 시간이 다 지났으면 안 감). 여러 날이면 첫날 한 번 · 날짜를 고치면 보낸 표시를 비워 새 날짜로 다시 · 제목만 고치면 다시 안 감 · 빼면 아직 안 간 알림도 안 감(이미 간 알림을 거두는 알림은 없음). 글 = '오늘은 휴관이에요' · '내일은 단축 운영해요' · '오늘 153 이벤트가 있어요' · '오늘 대회가 있어요' · '오늘 특강이 있어요' · '오늘 153 일정이 있어요' / 내용 = 한 줄 (+ ' · 11/16(월)까지') → `/home`.
- 휴관일 = 약속 알림을 보내지 않고(그날 · 전날 저녁 모두) · 복귀 보너스에서 놓친 약속으로 세지 않고 · 달력 약속 점선을 그리지 않고 · 약속 한 줄이 '오늘이 약속한 날'이라 하지 않고 · 그날 체크에서 체육관을 빼고 센다(안 왔을 때 — 쉬는 날도 금색 별). 단축 운영은 문을 여는 날이라 그대로.
- 약속 알림 시각: 그날 07:00 · 08:30(기본) · 12:00 · 17:00 = 그 시각부터 · 이미 왔으면 안 감 / 전날 저녁 = 20:00 '내일은 운동 약속한 날이에요'(알림 기록의 날 = 약속한 날이라 다음 날 아침에 또 가지 않음). 화면은 `set_my_promise_v2`(검사 · 저장은 `set_my_promise` 그대로 → remind) — v2 가 없는 DB 면 예전 함수로(알림 시각 없이).
- 저녁 체크 알림(켠 회원만 · 하루 한 번 살펴봄): 20:00 에 그날 체크를 세어(`_cal_check_count` — 화면 dayChecks 와 같은 식) 채운 것이 있고 아직 남았을 때만 '오늘 2개 채웠어요' / '하나 더 채우면 금색 별이에요'. 하나도 안 채운 날 · 다 채운 날은 안 보냄(못한 것은 말하지 않는다 · 보고서 '아직 안 했어요 알림 → 알림을 끄게 만듦').
- 저요 한 모집 = 내가 올렸거나 저요 한 운동 모집(`status='open'` — 내린 것 빼고) · '같이 했어요'를 눌렀으면 그날 카드에 표시.
- 휴대폰 캘린더: 아이폰 앱 = 앱 안 사파리 창(`openInAppBrowser`) · 그 밖 = 그 주소로 이동(아이폰 사파리 = '캘린더에 추가' 화면 · 안드로이드 · 컴퓨터 = .ics 파일). 시간대가 없으면 하루 종일 일정, 있으면 새벽 6 · 아침 7 · 점심 12 · 오후 15 · 저녁 19 · 밤 21시부터 1시간 · 알림은 고른 시각(시각 있는 일정보다 늦으면 1시간 전). 153 휴관일은 휴대폰 캘린더에 반영되지 않는다(매주 반복 하나라서).
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + 약속 1단계 · 2-1단계 + 이 마이그레이션 두 번) 17묶음 ALL_OK — anon · 안쪽 함수 · 표 막힘 · 회원 · 코치 · 다른 지점 지점장 못 올림 · 검사 9가지 · 대표님 모든 지점 · 남의 일정 고치기/빼기 막힘 · 회원 달력 일정(다른 지점 빼고) · 모집(내린 것 빼고 · 같이 했어요) · 승인 전 꺼짐 · 알림 받는 회원(오래된 · 체험 · 승인 전 · 합쳐진 · 코치 · 지점장 빼고) · v2 알림 시각 · 휴관일 약속 알림 없음 · 07:00/08:30 은 지금 시각대로 · 전날 저녁 · 휴관일은 복귀 보너스 아님 · 그날 아침 · 하루 전 저녁 · 여러 날 글 · 두 번째 바퀴 없음 · 제목만 고치면 다시 안 감 · 날짜 고치면 다시 · 빼면 휴관 풀림 → 약속 알림 · 저녁 체크 알림(2/3 · 1/4 · 휴관일 1/2 = 보냄, 0 · 다 채움 · 승인 전 · 꺼 둠 = 안 보냄) · 지점마다 다가오는 일정 60개 · 예약 · 권한 그대로. 약속 1단계 시험 묶음을 그날 요일로 고쳐 돌리면 옛 함수와 새 함수가 같은 결과 / vitest calendarEvents 10 · calendarIcs 11 · calendarChecks · promise153 더함.
- **적용 (2026-11-13 01시 대표님 「적용하고 올려」)**: 운영 DB = MCP `apply_migration`(기록 `20261112155421_calendar_stage22` — 파일 번호와 다르고 본문은 같다 · 새 설정 1 · 새 표 2 · 새 칸 1 · 새 함수 14 · 고친 함수 4 · 예약 `calendar-tick`) → 함수 18개 본문 지문(md5) = 저장소 파일을 올린 로컬 기준본 → 되돌림 시험(DO 블록 예외) ALL_OK: anon 막힘 · 선릉 회원 = 목록 꺼짐 · 올리기 · tick · 안쪽 함수 · 표 직접 읽기 막힘 · 달력 처음(일정 0 · 저녁 알림 꺼짐) · 저녁 알림 켜기 · v2 알림 시각(eve) · 잘못된 시각 / 선릉 코치 = 보기만 · 올리기 · 빼기 막힘 / 선릉 지점장 = 지난 날짜 · 칠금 막힘 · 휴관(내일~모레) · 특강(오늘) 올림 · 알림 받는 회원 150명 / 선릉 회원 달력 2개 · 칠금 회원 0개 / 내일 휴관 → 전날 저녁 약속 알림 없음 → 휴관 빼면 감(기록의 날 = 내일) / 특강 그날 아침 150통 한 번 · 두 번째 바퀴 없음 / 저녁 알림(그 시각 0/3 → 안 보냄 · 살펴본 날 표시) — 남은 줄 0 · 설정 그대로. Edge Function `calendar-ics` v1 배포(verify_jwt false · 배포본 = 저장소 파일 2개) → 라이브 200 `text/calendar` · `attachment; filename="153-promise.ics"` · 잘못된 요일 400.

#### 2-3단계 — 그날 한 일 · 153 D-day · 153 기념일 · 코치 한마디 도장 · 좌우 밀기 · 길게 눌러 넣기 (2026-11-13 대표님 「다음」)

보고서 2-3 여섯 가지. 감정 설계: 끝났을 때 = 뿌듯함("코치님이 나를 봤다") · 들어올 때 = 환영 · 한 달 = 확신. 모두 운동 달력 카드 안 — 새 페이지 · 새 탭 없음, 카드 줄도 늘리지 않았다(D-day 는 머리 칩 · 아이콘은 칸 모서리).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261113012729_calendar_stage23.sql](supabase/migrations/20261113012729_calendar_stage23.sql) | 새 표 `member_goal_days`(내가 정한 목표일 — 내일부터 2년 안 · 3개까지 · 이름 20자 · 빼기 = `removed_at`) · `coach_day_notes`(회원 · 날 · 코치마다 한 줄 80자 · 고치면 덮어씀 · 빼기 = `removed_at` · 알림은 처음 한 번 `notified_at`) · 새 칸 `branch_calendar_events.is_exam`(153 일정 '승급 심사' — kind 검사를 바꾸지 않으려고 저장은 kind event + is_exam, 함수 · 화면에는 kind exam) · 설정 `calendar_notice` 에 `note_quiet_from` 22:00 · `note_quiet_until` 08:00 · `reg_bulk_min` 30(있던 값은 그대로) · 새 함수 `set_my_goal_day` · `remove_my_goal_day` · `coach_day_note_save` · `coach_day_note_remove` · 안쪽 `_cal_reg_day` · `_cal_first_day` · `_cal_anchor(_of)` · `_cal_anniv_years` · `_cal_staff_who/_title` · `_cal_title_level` · `_cal_note_branch` · `_cal_day_notes` · `_cal_ddays` / 고친 함수(이름 · 인자 · 권한 그대로) `get_my_calendar`(+ acts · notes · anniv · ddays · 일정 exam) · `ops_meet_today`(+ anniv_years/basis · milestone · notes · others · can_note) · `ops_cal_events` · `ops_cal_event_save`(kind exam) · `calendar_tick`(승급 심사 알림 = 타이틀 레벨 회원만) · `_cal_event_notice_title`('승급 심사가 있어요') |
| [src/lib/calendarMarks.ts](src/lib/calendarMarks.ts) | 서버 값 읽기 · 글 · 검사 한 곳 — 그날 한 일(`actText` · `topActOn` · `actIsGold`) · 코치 한마디(`noteWho` · `noteError`) · 기념일(`annivText` · `withAnnivMoments`) · D-day(`sortDdays` · `ddayChip` · `ddayText` · `ddayCount`) · 목표일(`goalDraftError` = 서버와 같은 말) · 밀기(`swipeMonthDelta`) · 길게 누르기(`quickModeOf`) · 알림 링크(`focusDayOf`) — 시험 calendarMarks.test.ts |
| [WorkoutCalendar](src/components/attendance/WorkoutCalendar.tsx) · [CalendarMarkIcons](src/components/attendance/CalendarMarkIcons.tsx) | 칸 왼쪽 위 = 그날 한 일 아이콘 하나(타이틀매치 트로피 > 레벨업 > 153 PB 타이머 > PT 덤벨 — 금색 = 통과 · 첫 기록 · 최고 기록) · 왼쪽 아래 = 코치 한마디 말풍선 · 보라 점 = D-day(이름표 'D-day') · 출석한 기념일 = 금색 도장 · 머리 칩 = 가장 가까운 D-day(누르면 DdaySheet) · 한 달 보기 좌우로 밀기(56px · 세로의 1.5배 · 0.8초 안 — `touch-pan-y` 라 세로 스크롤 그대로) · 길게 누르기 0.45초(오늘 · 6일 전까지 = QuickDaySheet, 앞날 = 목표일) · 앞날도 누를 수 있다 · `focusDay`(알림 링크 '/home?cal=날짜' → 그날을 펼쳐 고르고 카드가 보이게, HomeWorkoutCalendar 가 주소에서 지운다) |
| [CalendarChecks](src/components/attendance/CalendarChecks.tsx) · [DdaySheet](src/components/attendance/DdaySheet.tsx) · [QuickDaySheet](src/components/attendance/QuickDaySheet.tsx) | 그날 카드 = 코치 한마디(오늘의 체크 한 줄에도) · 그날 한 일 · 그날의 D-day · 기념일 · 앞날 '이 날을 목표일로' · 승급 심사 일정 줄 오른쪽 D-n / D-day 시트(다가오는 D-day 목록 · 목표일 빼기 두 번 눌러 · 목표일 정하기 — 날짜 · 예시 4개) / 바로 넣기 시트(오늘 운동 한 줄 · 나만의 체크 · 기분 스티커) — 두 시트 모두 누를 때 받는 조각 |
| [OpsMeetToday](src/components/ops/OpsMeetToday.tsx) · [OpsDayNoteSheet](src/components/ops/OpsDayNoteSheet.tsx) | 「오늘 만날 회원」 칩 '오늘 n주년'(등록) · '첫 도장 n주년' · '출석 n번째'(그날 채운 출석 축하) + 할 말 · 줄마다 「한마디」(내가 남겼으면 '고치기') · 남긴 한마디는 줄 아래(다른 코치님 것도) · 맨 아래 '오늘 온 다른 회원 n명'(접힘 — 누구에게나) / 한마디 시트(예시 4개 — 153 기준 ③ 구체적 칭찬 · ⑤ 다음 목표 · 80자 · 빼기 두 번) |
| [OpsCalEvents](src/components/ops/OpsCalEvents.tsx) · [calendarEvents](src/lib/calendarEvents.ts) | 153 일정 종류 '승급 심사'(남색 칩 · 하루 전 저녁 알림 기본 켬) — 알림 · D-day 는 타이틀매치 차례(레벨 10) 회원에게만이라는 한 줄 |

- 그날 한 일 = DB 에 이미 있는 기록만: PT 수업 = `ops_pt_sessions` kind lesson · status open(지운 것 · 노쇼 · 당일취소 빼고 · 코치 = 근무자 카드의 앱 이름, 없으면 카드 이름) · 153 PB = `test153_records` official(그 부문 첫 기록 · 그때까지 최고 기록 표시) · 타이틀매치 = `title_match_attempts`(통과 = '통과', 그 밖 = '도전했어요' — 못한 말 없이) · 레벨업 = `level_status_history` new_status approved(같은 날 여러 번이면 가장 높은 레벨 · 9/02 · 9/17 일괄 정리는 이 표에 없어 안 보인다). 보는 사람 = 본인만.
- 153 D-day: 목표일 · 153 PB 다시 재는 날(마지막 공식 기록 + 42일 — 지났으면 '지금 · 다시 잴 때예요', 늦었다는 말 없음) · 153 기념일(30일 안) · 승급 심사(타이틀 레벨 회원 · 60일 안의 내 지점 '승급 심사' 일정) · 타이틀매치 다시 도전할 수 있는 날(`title_match_retry_at_for`). 가까운 날 순(지난 153 PB 는 오늘로).
- 153 기념일: 기준 = 153 등록일(`profiles.gym_reg_date` — 같은 날로 30명 넘게 옮겨 담긴 날(2026-08-03 · 09-01 같은 날)은 믿지 않음) → 'n주년', 모르면 첫 출석 날 → '첫 도장 n주년'(오래 다닌 회원에게 틀린 말을 하지 않게). 확인(11/13): 믿을 수 있는 등록일은 모두 첫 출석보다 앞이거나 같다(= 첫 등록일). 출석한 기념일 = 금색 도장 '153과 함께한 지 1년이 된 날이에요' · 오늘 아직 안 왔으면 '오늘은 153과 함께한 지 1년이에요' · 지난 날 안 온 기념일은 말하지 않는다. 2/29 기준은 평년 2/28. 100번째 출석은 출석 축하 금색 도장이 이미 있다.
- 코치 한마디 도장: 남기는 분 = 그 지점 지도진(`_strategy_branch_staff`) · 대표님(`_strategy_hq`) / 받는 회원 = 「오늘 만날 회원」이 켜진 지점(promise_pilot.branches)의 승인된 회원(코치님 · 운영진 · 체험 · 합쳐진 계정 · 본인 빼고) · 오늘 칸만 · 80자 · 의무 아님 · 하루 상한 없음(대표님 결정). 알림 '💬 ○○ 코치님의 오늘 한마디'(내용 = 한 줄 · 링크 `/home?cal=오늘`) 처음 한 번 — 고치거나 뺐다 다시 남겨도 다시 안 감 · 밤 10시 ~ 아침 8시는 알림함에만(`pushed_at`). 빼도 이미 간 알림은 그대로. 회원 화면 이름 = 직함 그대로('○○ 코치님' · '○○ 지점장님' · 직함 없는 대표님 계정 = '대표님').
- 코치님 안내는 전략 회의 지시로(대표님 결정 — 「코치 한마디 도장은 코치님 의무 아님 · 하루 상한 없음, 안내는 전략 회의 지시로」). 지시는 대표님 계정으로만 쓸 수 있어(클로드가 대표님 이름으로 쓰지 않는다) 글은 대표님께 드린다.
- 서버 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 화면은 2-2 그대로 — 새 칸 · 단추가 안 보인다(`acts` 등이 비고 `can_note` false).
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + 약속 1단계 · 2-1 · 2-2 + 이 마이그레이션 두 번) 8묶음 ALL_OK — 권한(anon · 안쪽 함수 11 · 표 2) · 목표일(검사 5가지 · 3개 · 고치기 · 남의 것 · 승인 전 · 빼기) · 기념일 기준(옮겨 담은 등록일 = 첫 도장 · 윤일) · 승급 심사(저장 = event + is_exam · 바꾸기 · 타이틀 레벨에게만 D-day · 다시 도전) · 153 PB 다시 재는 날(지난 날 그대로) · 그날 한 일(PT 3 · PB 3 첫/최고 · 타이틀 2 · 레벨업 3 · 지운/노쇼/심사 신청 안 셈 · 남의 기록 안 보임) · 코치 한마디(막힘 5 · 검사 2 · 고치기 · 빼기 · 다시 = 알림 처음 둘만 · 조용한 시간 = 알림함에만 · 대표님 · 다른 지점 · 회원 막힘) · 「오늘 만날 회원」(1주년 등록 · 첫 도장 · 출석 100번째 · 오늘 온 다른 회원 · 한마디 mine) · 승급 심사 알림 = 타이틀 레벨 회원만 · 이벤트 = 모두 · 예약 · 설정 그대로. 2-2 시험 17묶음도 이 마이그레이션 뒤 그대로 ALL_OK, 「오늘 만날 회원」은 같은 자료로 옛/새 함수 줄 · 순서가 같다(새 칸만 더해짐) / vitest calendarMarks 12 · CalendarChecks 6 · promise153 15.
- **적용 (2026-11-13 02시 대표님 「적용하고 올려」)**: 적용 직전 고칠 함수 6개(`get_my_calendar` · `ops_meet_today` · `ops_cal_events` · `ops_cal_event_save` · `calendar_tick` · `_cal_event_notice_title`)의 운영 본문 = 2-2 로컬 기준본(md5 같음 — 그사이 바뀐 것 없음) → 운영 DB = MCP `apply_migration`(기록 `20261112170939_calendar_stage23` — 파일 번호와 다르고 본문은 같다) → 함수 21개 본문 지문(md5) · 색인 5 · 제약 8 = 저장소 파일을 올린 로컬 기준본 · 새 표 anon · authenticated 막힘 · 안쪽 함수 실행 = service_role 만 · 설정 `calendar_notice` 2-2 값 그대로 + 4칸 → 되돌림 시험(DO 블록 예외 · 대표님 계정 안 씀) ALL_OK: anon 6개 막힘 · 승인 전 계정 = 목표일 막힘 · 달력 꺼짐 / 선릉 회원 = 안쪽 함수 13 · 표 2 막힘 · 목표일(이름 정리 · 검사 5가지 · 3개 · 가까운 날 순 · 고치기 · 남의 것 막힘 · 빼기 · 다시 3개) · 달력 키 11개(2-2 키 그대로) · 63일 막힘 · 한마디 · 오늘 만날 회원 막힘 / PT · 레벨업 기록이 있는 회원 = 그날 한 일 pt · level · 타이틀 레벨 회원 D-day = 기념일 / 선릉 코치 = 한마디(공백 정리 · mine · 직함) · 검사 2 · 다른 지점 · 본인 · 코치님 · 지점장 막힘 · 알림 1통(새벽이라 알림함에만 · 링크 `/home?cal=오늘`) · 고치기 · 빼기 · 다시 남기기 = 알림 없음 · 코치 둘 = 알림 2통 · 회원 달력에 2줄 · 「오늘 만날 회원」 새 키 · 승급 심사 올리기 막힘 / 선릉 지점장 = 승급 심사 올림(저장 = event + is_exam · 화면 = exam) → 레벨 5 회원 D-day 없음 · 타이틀 레벨 회원 D-day = 그날 · 일정 알림 받는 회원 151명 중 승급 심사 알림은 57명 · 이벤트로 바꾸면 is_exam false — 남은 줄 0 → DB 어긋남 점검 새 어긋남 0.

#### 2-4단계 — 일요일 주간 돌아보기 · 운동 짝꿍과 같이 약속(쌍도장) · 이번 달 운동 카드 · 나의 153 앨범 · 153과 함께한 시간 (2026-11-13 대표님 「시작하자」)

보고서 2-4 다섯 가지. 감정 설계: 한 달 · 재등록 = 확신 · 끝났을 때 = 뿌듯함 · 안 오는 날 = 그리움(죄책감 금지). 모두 운동 달력 카드 안 — 새 페이지 · 새 탭 없음 · **하나 넣으면 하나 접기**: 주간 돌아보기가 보이는 일요일엔 약속 한 줄을 접고(다음 주 약속 한 줄이 돌아보기 안에 있다) · 153과 함께한 시간이 보이면 카드 머리의 첫 4주 칸을 접고 · 앨범 · 카드 단추는 지난달 한 줄과 같은 줄에 둔다.

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261113111423_calendar_stage24.sql](supabase/migrations/20261113111423_calendar_stage24.sql) | 새 칸 2 `member_calendar_prefs.weekly_recap`(기본 켬 · 끈 회원만 false) · `last_recap_on`(마지막으로 보낸 일요일) · 설정 `calendar_notice.recap_at` 19:30(있던 값 그대로 · 빈 칸만) · 새 함수 `set_my_weekly_recap(p_on)`(승인된 회원 · 답 {on, at, sends}) · 안쪽 `_cal_minutes_between`(날마다 첫 출석 하나 · `workout_minutes` — `get_attendance_history` 와 같은 식) · `_cal_duration_label`('3시간 46분' — 화면 durationLabel 과 같은 말) · `_cal_days_label`('월 · 수 · 일' · '평일' · '매일') · `_cal_partner_of`(지금 이어진 운동 짝꿍 한 명) · `_cal_partner_json` · `_cal_week_recap` / 고친 함수(이름 · 인자 · 권한 그대로) `get_my_calendar`(+ recap · partner) · `calendar_tick`(+ ④ 주간 돌아보기 · 답에 recap 수) |
| [src/lib/calendarTogether.ts](src/lib/calendarTogether.ts) | 서버 값 읽기 · 짝꿍 줄(`partnerPromiseLine` · `partnerHint` · `sharedDays`) · 쌍도장(`isTogetherDay` · `togetherText`) · 주간 돌아보기(`weekRecap` · `recapBody` · `recapNext` — 서버 알림과 같은 글) · 운동 카드 모델(`monthCardModel` · `branchShortOf` · `CARD_SIGN`) · 앨범(`albumOf`) · 함께한 시간(`renewalLine` · `RENEWAL_BEFORE_DAYS` · `RENEWAL_AFTER_DAYS` 14) — 시험 calendarTogether.test.ts |
| [src/lib/monthCardImage.ts](src/lib/monthCardImage.ts) | 1080×1920 PNG(인스타 스토리 · 캔버스 — 기기에서 만들고 서버로 안 감): 위 띠(153 흰 로고 · 지점 짧은 이름 · 'YYYY.MM 운동 카드') · '에이님의 11월' · 그 달 운동 시간(큰 숫자) · 지난달보다 늘었을 때만 칩 · 도장 달력(민트 · 기념일 금색 · 짝꿍과 같이 = 하늘색 쌍도장 · 쓰인 것만 이름표 · 빠진 날 표시 없음) · 그 달 마지막 코치 한마디(두 줄 · 누가 · 날) · 153 서명. `shareOrSaveImage` = 휴대폰 공유 창(사진 · 인스타), 안 되면 내려받기 |
| [CalendarTogether.tsx](src/components/attendance/CalendarTogether.tsx) · [MonthCardSheet.tsx](src/components/attendance/MonthCardSheet.tsx) · [AlbumSheet.tsx](src/components/attendance/AlbumSheet.tsx) | `WeekRecapPanel`(잘한 것만 칩 + 다음 주 약속 한 줄 + 고치기/약속 걸기) · `RenewalBlock` · `MonthTools`(달 아래 한 줄 — 지난달 돌아보기 · '앨범 n' · '카드') / 운동 카드 시트(그 달 자료를 따로 읽어 그림 → '저장 · 공유하기' · 아이폰 앱에서 공유가 안 되면 '이미지를 길게 누르면 사진에 저장돼요') / 앨범 시트(그 달 사진 3열 → 크게 · 목록 · 그날 보기) — 두 시트는 누를 때 받는 조각 |
| [WorkoutCalendar](src/components/attendance/WorkoutCalendar.tsx) · [CalendarChecks](src/components/attendance/CalendarChecks.tsx) · [PromiseSheet](src/components/attendance/PromiseSheet.tsx) · [CheckItemsSheet](src/components/attendance/CheckItemsSheet.tsx) · [HomeWorkoutCalendar](src/components/home/HomeWorkoutCalendar.tsx) | 칸 뒤 하늘색 동그라미 = 쌍도장(이름표 '짝꿍과 같이' · 그날 카드 '짝꿍 ○○님과 같이 운동한 날이에요') · 약속 한 줄 = 짝꿍과 같은 요일이 있으면 '짝꿍 ○○님과 수 · 일 같이 약속했어요' · 약속 시트 = 짝꿍 약속 한 줄 + '같은 요일로' · 나만의 체크 시트 맨 아래 '일요일 주간 돌아보기' 스위치(받는 지점 회원만 — `recap.sends`) · 홈만 `renewalEnd` · 알림 링크 '/home?cal=오늘'이면 그날을 고르지 않는다(돌아보기 카드가 그대로 보이게 — `focusDay === today` → 고르지 않음) |

- 주간 돌아보기: 일요일 19:30 ~ 21:00(`quiet_after`) 사이 `calendar_tick` 이 일요일마다 한 번(`last_recap_on`) — 약속 시범 지점(promise_pilot.branches)의 승인된 회원(`_promise_member` — 코치님 · 운영진 · 체험 · 합쳐진 계정 빼고) 중 **이번 주(월 ~ 그 일요일) 한 번이라도 온 회원** · 끈 회원 빼고. 이번 주 한 번도 안 온 회원에게는 보내지 않는다(못한 것은 말하지 않는다). 일요일 저녁에 처음 온 회원은 다음 바퀴(10분)에. 제목 '이번 주 3시간 46분 운동했어요' · 내용 '약속 3번 지켰어요 · 금색 별 1개. 다음 주도 월 · 수 · 일 저녁에 만나요'(지킨 약속 = 약속한 요일에 온 날 · 약속 시작한 날부터 · 0 이면 말 없음 / 금색 별 = 다 채운 날(`_cal_check_count`) · 0 이면 말 없음 / 다음 = 약속 요일 · 시간대, 매일이면 '다음 주도 매일 만나요', 약속이 없으면 '다음 주도 체육관에서 만나요') → `/home?cal=그 일요일`. 앱 카드는 일요일에만(이번 주를 보고 있고 날을 안 골랐을 때) · 앱 카드에는 '짝꿍과 같이 n번' 칩이 더 있다(알림에는 없음). 기본 켬 · 끄기 = 회원마다 스위치 / 모두 = 약속 시범 지점에서 빼기(약속도 같이 꺼짐).
- 운동 짝꿍과 같이 약속: 짝꿍 = 지금 이어진 운동 짝꿍(`boxing_cornerman_pairs` active · 한 명 · 짝꿍이 승인된 회원일 때만). 짝꿍의 약속 요일 · 시간대가 내 달력 자료 `partner` 에 — 같은 요일로 약속하면 서로 보인다(짝꿍이 약속이 없으면 '짝꿍 ○○님도 약속을 걸면 같은 요일이 서로 보여요'). 쌍도장 = 보이는 날짜 중 둘 다 출석한 날(`together`). 짝꿍에게 가는 알림은 없다(알림을 늘리지 않는다).
- 이번 달 운동 카드: DB 없음. 153 로고 · 지점 짧은 이름을 넣었다(보고서 '대표님 결정 — 추천'을 「시작하자」로). 펼친 달 = 그 달 카드 · 새 달 첫 7일의 접힌 한 줄 = 지난달 카드. 파일 이름 `153-운동카드-YYYY-MM.png`.
- 나의 153 앨범: 새 표 없음 — 그 달 '오늘 운동 한 줄'(`champion_journal_entries`, `get_my_calendar` 의 그날 글) 사진만. 사진이 없으면 단추도 없다(빈 것은 그리지 않기).
- 153과 함께한 시간: 홈 운동 달력만 · 일반 회원만(`role === "member"` · `isStaffProfile` 아님 — `RenewalStoryCard` 와 같은 기준) · 수강권 끝나는 날(`profiles.membership_end`) 14일 전 ~ 14일 뒤 카드 맨 위(첫 4주 칸 자리)에 '153과 함께한 시간 · n시간 m분 · YYYY년 M월 D일 첫 도장부터'(시간 = `get_attendance_history` totalMinutes). 권유 문구 · 남은 날 · 가격은 쓰지 않는다(대표님 「권유 문구 없이」).
- 서버 함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 recap · partner 가 비어 스위치 · 쌍도장 · 짝꿍 줄이 안 보이고 화면은 2-3 그대로 — 운동 카드 · 앨범 · 함께한 시간은 DB 없이도 보인다.
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + 약속 1단계 · 2-1 · 2-2 · 2-3 + 이 마이그레이션 두 번) 6묶음 ALL_OK — 안쪽 함수(시간 · 요일 글 · 운동 시간 = 날마다 첫 출석 · 중복 출석 안 셈 · 짝꿍 · 끝난 짝꿍 없음) · 돌아보기 글(약속 · 별 · 매일 · 약속 없음 · 이번 주 안 온 회원 = null · 그 주 중간 날 = 그날까지) · 권한(anon · 안쪽 함수 6 · 설정 표 · 승인 전 막힘) · 달력 recap · partner(서로 보임 · 같이 온 날 · 범위 밖 없음 · 2-3 키 그대로 · 칠금 sends false · 끄기 · 켜기 · 짝꿍이 승인 전이면 안 보임) · tick(일요일 19:20 · 토요일 · 21:05 = 0 · 19:40 = 4명(안 온 · 끔 · 칠금 · 코치 · 승인 전 빼고) · 두 번째 바퀴 0 · 늦게 온 회원 다음 바퀴 · 다음 주 다시 · 저녁 체크 알림 그대로 꺼짐) · 설정 그대로. 2-2 · 2-3 시험도 이 마이그레이션 뒤 그대로 ALL_OK / vitest calendarTogether 18 · CalendarChecks 7 · 전체 1,486 · 화면 확인 11장(일요일 돌아보기 · 짝꿍 약속 시트 · 한 달 도구 · 쌍도장 · 앨범 · 사진 · 카드 시트 · 카드 이미지 · 돌아보기 스위치 · 금요일 짝꿍 줄 · 12월 지난달 카드).
- 선릉 실측(11/13 운영 DB): 이번 주(11/09 ~) 온 약속 시범 지점 승인 회원 99명(그중 휴대폰 알림 켬 11명 — 나머지는 알림함) · 지금 이어진 운동 짝꿍 2쌍.
- **적용 (2026-11-13 12시 대표님 「적용하고 올려」)**: 적용 직전 고칠 함수 2개(`get_my_calendar` · `calendar_tick`)의 운영 본문 = 2-3 로컬 기준본(md5 같음 — 그사이 바뀐 것 없음) → 운영 DB = MCP `apply_migration`(기록 `20261113030546_calendar_stage24` — 파일 번호와 다르고 본문은 같다) → 함수 9개 본문 지문(md5) = 저장소 파일을 올린 로컬 기준본 · 새 칸 2(`weekly_recap` 기본 true · `last_recap_on`) · 설정 `calendar_notice` 2-3 값 그대로 + `recap_at` 19:30 · 안쪽 함수 6개 · `calendar_tick` 실행 = service_role 만 · `set_my_weekly_recap` · `get_my_calendar` = authenticated → 되돌림 시험(DO 블록 예외 · 대표님 계정 안 씀) ALL_OK: anon 3개 막힘 / 선릉 회원 = 안쪽 함수 3 · tick · 설정 표 막힘 · recap {켬 · 19:30 · 받음} · 짝꿍(약속 없음 = 요일 []) · 2-3 키 그대로 · 끄기(달력 꺼짐 · 저녁 알림 그대로) · 켜기 · 약속 걸기 / 그 짝꿍 = 상대 약속(월 · 수 저녁)이 보임 · 63일 같이 온 날 = 독립 계산과 같음 · 64일 막힘 / 선릉 코치 · 칠금 회원 = 받지 않음(sends false) / 없는 계정 = 끄기 막힘 · 달력 꺼짐 / 일요일 19:40 가짜 시계(본문 그대로 · now() 만 바꾼 임시 함수)로 tick = 받는 회원 99명(독립 계산 99) · 모두 선릉 · 코치님 · 운영진 없음 · 글 모양 '이번 주 … 운동했어요' · '… 만나요' · 두 번째 바퀴 0 · 저녁 체크 알림 켜진 수 그대로 — 남은 줄 0 → DB 어긋남 점검 새 어긋남 0 → 다음 예약 `calendar-tick`(12:10) 성공. 첫 주간 돌아보기 = 11/15(일) 19:30 바퀴.

### 캘린더 3단계 — 네이버 · 구글 캘린더 기능을 운영본부 일정 · 회원 운동 달력에 (2026-11-13 대표님 「네이버 캘린더 구글 캘린더 벤치마크해서 … 모든 기능을 사용할수있게」 → 「추천대로 3-1부터」)

보고서 「캘린더 3단계 보고서」 https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK — 기능 62가지 · 6단계(3-1 구독 주소 → 3-2 운영본부 기본기 → 3-3 함께 쓰기 → 3-4 할 일 · 습관 → 3-5 회원 달력 넓히기 → 3-6 PT 예약 · AI) · 대표님 결정 9가지(모두 추천안) · 단계마다 제작 프롬프트(공통 머리말 + 단계 칸). 단계마다 대표님 「적용하고 올려」 뒤에 올린다. 3-4 는 `myboxer:ops-schedule`(handoff — ② 「할 일」 보기)를 이어받는다.

#### 3-1단계 — 구독 주소: 휴대폰 · 구글 캘린더에서 153 일정이 저절로 · .ics 가져오기 · 지점 공개 달력 (작업판 `myboxer:calendar3`)

주소 하나를 아이폰 · 구글 캘린더에 한 번 넣으면 그 앱이 다시 읽어 153 일정이 늘 보인다 — 알림 · 위젯 · 워치는 그 앱 것(네이버 · 구글 기능을 그 앱 안에서 쓰는 셈). **한 방향**(거기서 고쳐도 153 에는 안 온다). 새 페이지 · 새 탭 없음 — 운영본부 「일정」 탭 맨 끝 카드 하나 · 회원은 시트 안에서만(카드에 더한 것 없음).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261113125736_calendar_feed.sql](supabase/migrations/20261113125736_calendar_feed.sql) | 새 표 `calendar_feed_tokens`(사람 · 종류 staff/member 마다 살아 있는 토큰 하나 · 64자 무작위 · 읽은 때 `last_fetched_at` · 횟수 · 하루 횟수 `fetch_day` · `fetch_day_count` · 끊음 `revoked_at` — RLS · anon/authenticated 막음) · 화면 함수 `my_calendar_feed(종류)`(지금 상태만 · 만들지 않음) · `my_calendar_feed_on(종류, 새로)`(있으면 그대로 · 새로 = 옛 주소 끊고 새 주소 · 하루 10번 · 승인된 회원 / 「일정」 탭을 쓰는 코치진만 — 42501 '이 계정은 아직 주소를 만들 수 없어요') · `my_calendar_feed_off` · Edge Function 만(service_role) `calendar_feed_data(토큰)`(읽은 기록 → 권한 다시 확인 → 자료 · 하루 1,440번 넘으면 `{limited:true}`) · `calendar_feed_branch(지점 코드)`(앱에 보이는 지점만) · 안쪽 `_calendar_feed_can` · `_calendar_feed_short` · `_calendar_feed_branch_events` · `_calendar_feed_staff` · `_calendar_feed_member`. 기존 함수 · 표 그대로 |
| [supabase/functions/calendar-feed/](supabase/functions/calendar-feed/index.ts) | `GET …/calendar-feed/<토큰>.ics` · `…/calendar-feed/branch/<코드>.ics`(`?download=1` = 파일로) → text/calendar. verify_jwt false(config.toml — 캘린더 앱은 로그인하지 않는다, 토큰이 열쇠) · DB 는 서버 키로 위 두 함수만(fetch REST, supabase-js 없음). **끊긴 · 없는 · 권한이 없어진 주소 = 빈 달력(200)** — 404 면 구글 · 아이폰이 지난번 일정을 계속 보여 준다(보고서 끝 기준 '404'를 바꿈). DB 오류 503 · 상한 429(캘린더는 지난 일정 그대로) · 틀린 주소 · 숨긴 지점 404 · GET/HEAD 만. `.ics` 만들기 · 주소 읽기 = [feed.ts](supabase/functions/calendar-feed/feed.ts)(2-2 `calendar-ics/ics.ts` 를 같이 쓴다 — 배포할 때 `functions/calendar-ics/ics.ts` 도 같이 올린다) |
| [src/lib/calendarFeed.ts](src/lib/calendarFeed.ts) · [src/services/calendarFeedService.ts](src/services/calendarFeedService.ts) · [CalendarFeedSheet](src/components/calendar/CalendarFeedSheet.tsx) | 주소(https · webcal · 구글 `render?cid=webcal://…` · 파일 · 지점) · 기기(아이폰 · 아이패드 · 맥 = webcal 로 바로 '구독' / 안드로이드 · 그 밖 = 구글 캘린더) · '캘린더가 n분 전에 읽어 갔어요'(시트가 열린 동안 15초마다 — 넣고 나면 연결을 확인) · 시트(만들기 전 = 세 줄 + '연결 주소 만들기' / 뒤 = 기기 단추 · 주소 복사 · 파일로 받기 · 연결 확인 · 접힌 '다른 캘린더 · 주소 관리'(컴퓨터 구글 'URL로 추가' · 삼성 · 네이버 PC '가져오기' · 구글은 늦게 읽음 · 새 주소 · 연결 끊기 — 두 번 눌러서)) · 함수가 없으면 `available:false` — 입구를 숨긴다 |
| [OpsPhoneCalendar](src/components/ops/OpsPhoneCalendar.tsx) · [OpsIcsImportSheet](src/components/ops/OpsIcsImportSheet.tsx) · [src/lib/icsImport.ts](src/lib/icsImport.ts) | 「일정」 탭 맨 끝 「휴대폰 캘린더」 카드 — ① 휴대폰 캘린더에서 보기(kind staff) ② 휴대폰 캘린더 가져오기(.ics → 브라우저 안에서 읽어 미리 보기 → 고른 종류(개인 · 업무 · 외부 · 휴무, 개인은 '시간만' 기본 켬)로 내 일정 — 기존 `ops_plan_save` · `ops_plan_skip` 셋씩 · 끝나면 한 번 다시 읽기). 파일은 서버로 안 간다 · 메모 · 장소는 옮기지 않는다 · 한국 시간으로(UTC · 다른 나라 시간대(서머타임 포함) 바꿈 · 시간대 없는 시각 = 한국) · 매주 · 매일 반복 = 「일정」 반복 그대로(요일 · 언제까지 · 이 날만 빼기 · COUNT) · 매월 · 격주는 첫 번만 · 자정 넘는 일정 23:59 · 하루 넘는 시각 일정 = 하루 종일 · 지난 · 취소 · 바뀐 하루 · 1년 넘게 먼 일정 빼기 · 같은 일정 한 번 · 이 기기에서 전에 넣은 일정(`153plan:ics-done:<계정>`) · 받아 둔 내 일정과 같은 것 빼기 · 200개까지 |
| [OpsCalEvents](src/components/ops/OpsCalEvents.tsx) · [PromiseSheet](src/components/attendance/PromiseSheet.tsx) · [CheckItemsSheet](src/components/attendance/CheckItemsSheet.tsx) · [WorkoutCalendar](src/components/attendance/WorkoutCalendar.tsx) | 회원 달력 카드(올릴 수 있는 분) '공개 달력 주소 복사'(`branches.code` · 승급 심사 빼고 — 블로그 · 홈페이지 · 손님 캘린더) / 약속 시트 '휴대폰 캘린더에 추가' → '휴대폰 캘린더에서 늘 보기'(구독) + '한 번 받기'(2-2 그대로) / 나만의 체크 시트 맨 아래 '휴대폰 캘린더에서 늘 보기' / 운동 달력(내 기록) 시트 key `feed` — 약속 시트를 닫고 연다. 기능이 없으면 두 입구 모두 예전 그대로 |

- 코치진 주소(kind staff): ① 내 일정 — 매주 = RRULE WEEKLY(첫 날은 그 요일로 · `until_on` = UNTIL 23:59:59 한국) · 이 날만 빼기 = EXDATE(반복만 — 한 번 일정의 `skip_dates` 는 안 씀, 앱 `occursOn` 과 같은 뜻) · 여러 날 시각 일정 = 날마다 같은 시각(DAILY COUNT ≤ 62) · 하루 종일 = DATE · **PT = 'PT 수업'(제목 없이) · 개인 = '개인 일정'(제목 없이) · 메모는 어디에도 없음** · 바쁨 = 시각 있고 휴무 아님 ② 근무 시간표 — 지난 7일 ~ 앞 60일 `_ops_duty_segments`(쉰 날 · 대타 넘김/받음 반영 · 24:00 = 다음 날 00:00) ③ 「일정」 탭 지점들의 153 일정(승급 심사 포함 · 여러 지점이면 ' · 선릉역점') ④ 사무실 정기 회의(`_office_role` 이 있는 지점 · 1시간 · 23시 넘으면 23:59 까지 · 다음 한 번 쉬기 = EXDATE · 줌 · 미트 링크 = URL · 설명). 남의 일정 · 팀 일정은 없다(결정 4 — 코치는 본인 것).
- 회원 주소(kind member): 운동 약속(2-2 '한 번 받기'와 같은 시각 · 제목 · 알림 — 약속 알림을 끈 회원은 VALARM 없음 · 약속 요일의 휴관일 = EXDATE · UID = `promise-` + md5 16자 — 계정 번호를 넣지 않는다) · 내 지점 153 일정(승급 심사는 타이틀 레벨 회원만) · D-day(목표일 · 153 PB 다시 재는 날 · 153 기념일 · 타이틀매치 다시 도전 — 지난 날은 안 넣음, 못한 것을 보이지 않게). 링크 = `/home?cal=그날`.
- 지점 공개 주소: 그 지점 153 일정(승급 심사 빼고) · 사람 정보 없음 · `branches.is_visible` 지점만(지금 선릉 `sunreung` · 칠금 `chilgeum`). 보고서 표 '공개 링크 · 퍼가기'.
- 새로 고치는 간격은 그 캘린더 앱이 정한다(REFRESH-INTERVAL · X-PUBLISHED-TTL PT1H 은 힌트) — 구글은 하루에 몇 번(공식 수치 없음, 12 ~ 24시간이라는 글이 많다) · 화면이 '구글은 늦게 보일 수 있어요'라고 접힌 칸에서 말한다. 아이폰 앱(Capacitor)은 webcal 이동을 시스템(캘린더 앱 '구독')으로 넘긴다(`WebViewDelegationHandler` — 앱 주소가 아닌 최상위 이동 = `UIApplication.open`) · 안드로이드 TWA 는 webcal 을 못 열어 구글 단추만.
- 네이버 캘린더: 구독(저절로 새로)은 확인하지 못했다 — PC '가져오기'(파일 · 주소)는 한 번 넣기다(2022 안내 글 · 그 글에서 아이클라우드 주소 가져오기는 오류). 그래서 화면은 '파일로 받기 → PC 네이버 캘린더 가져오기(한 번만)'만 안내. 삼성 캘린더 = 구글 계정에 넣으면 같이 보인다.
- 끄기: 사람마다 시트 '연결 끊기' · 모두 = `update public.calendar_feed_tokens set revoked_at = now() where revoked_at is null;`(그 캘린더들은 다음에 읽을 때 빈 달력).
- 시험: 로컬 Postgres 16(운영 정의를 본뜬 뼈대 + `_ops_plan_branches` · `_ops_duty_segments` · `_office_role` · `_strategy_can_direct` 운영 정의 + 약속 1단계 · 2-1 ~ 2-4 + 이 마이그레이션 두 번 · 운영처럼 `_strategy_hq` 실행 권한 뺌) 10묶음 ALL_OK — 권한(anon · 회원의 Edge Function 함수 · 안쪽 함수 · 표 직접 읽기쓰기 막힘 · service_role 실행) · 만들기 · 그대로 · 새 주소(옛 주소 끊김 · 살아 있는 것 하나) · 끊기 · 로그인 안 함 · 승인 전(42501) · 하루 10번(막혀도 지금 주소 그대로) · 회원 자료(약속 · 휴관 화요일 빼기 · 계정 번호 없음 · 지난 153 PB · 승급 심사 · 지운 · 지난 · 다른 지점 없음 · 읽은 기록) · 타이틀 레벨(승급 심사 · 153 PB · 알림 끈 하루 종일 약속) · 코치 자료(이름 · 메모 없음 · 다섯 일정 제목 · 반복 · 빼는 날 · 바쁨 · 지운 · 끝난 반복 · 다른 지점 없음 · 근무 칸 수 = 독립 계산 · 쉰 날 · 153 일정 · 회의(쉬는 한 번 · 23:30 → 23:59 · 취소 · 다른 지점 없음)) · 대표님(지점 이름 붙음 · 근무 · 일정 없음) · 공개 주소(승급 심사 빼고 · 숨긴 · 없는 · 틀린 코드) · 끊긴 · 없는 · 권한 없어진 주소 · 상한(1,441번째 limited · 다음 날 1) · 그만둔 코치 · 표 모양. 2-4 시험도 이 마이그레이션 뒤 그대로 ALL_OK / vitest calendarFeed 19(2-2 '한 번 받기'와 약속 줄이 같은지 · CRLF · 75바이트 · UNTIL · EXDATE · DAILY · 24:00 · 회의 링크 · 이스케이프 · 기기 · 읽은 때) · icsImport 16 · 전체 1,540 / Python icalendar + recurring_ical_events 로 펼쳐 날짜 · 빼는 날 · 알림 시각 확인 / Edge Function 을 Deno 로 띄워(로컬 DB 앞에 PostgREST 흉내) 200 · 첨부 · 빈 달력 · 공개 · 404 · 405 · HEAD · 429 · 503 확인 / 화면 12장(만들기 전 · 안드로이드 만든 뒤 · 아이폰 · 연결됨 + 주소 관리 · 운영본부 두 카드 · 가져오기 고르기 · 미리 보기 · 넣음 · 약속 시트 두 단추 · 나만의 체크 줄 · 글씨 크게 두 장).
- **적용 (2026-11-13 13:5x 대표님 「적용하고 올려」)**: 운영 DB = MCP `apply_migration`(기록 `20261113044811_calendar_feed` — 파일 번호와 다르고 본문은 같다) → 새 함수 10개 본문 지문(md5) = 저장소 파일을 올린 로컬 기준본 · 표 칸 · 색인 4 · RLS · anon/authenticated 표 막힘 · 실행 권한(anon 0 · authenticated = `my_calendar_feed*` 셋만 · service_role 모두) → 되돌림 시험(DO 블록 예외 · 대표님 계정 안 씀) ALL_OK — 막힘 9(anon 4 · 회원의 코치 주소 · Edge Function 함수 · 안쪽 함수 · 표 · 없는 계정 만들기) / 선릉 회원(이 트랜잭션 안에서만 약속) = 만들기 · 그대로 · 새 주소 · 약속(저녁 · 07:00 · md5 UID) · 계정 번호 없음 · 153 일정 수 = 독립 계산 · 옛 주소 · 끊은 주소 null · 읽은 기록 / 선릉 코치(근무자 카드) = 근무 칸 수 = 독립 계산(0 아님) · 153 일정(승급 심사 포함) 수 같음 / 칠금 회원 = 선릉 일정 없음 / 공개 주소 = 승급 심사 빼고 수 같음 · 숨긴 · 없는 코드 null — 남은 줄 0 → Edge Function `calendar-feed` v1 배포(files `functions/calendar-feed/index.ts` · `feed.ts` + `functions/calendar-ics/ics.ts` = 배포된 calendar-ics 와 같은 파일 · entrypoint `functions/calendar-feed/index.ts` · verify_jwt false) → 실제 주소 확인: 체험용 계정(`is_test_account`) 주소로 200 · text/calendar · `?download=1` 첨부 · HEAD · 공개 주소(선릉 · 칠금) · 없는 토큰 = 빈 달력 · 숨긴 지점 · 틀린 주소 404 · POST 405 · http → https 301(구글이 http 로 읽어도 따라온다) · 그 계정에 약속(화 · 목 저녁 · 07:00) · 목표일을 잠깐 넣어 받은 파일을 Python icalendar 로 펼침 = 11/17부터 화 · 목 19:00 · 알림 그날 07:00 · 목표일 하루 종일 → 약속 멈춤(`stopped_at`) · 목표일 빼기(`removed_at`) · 주소 끊기 → 같은 주소 = 빈 달력(체험용 계정의 끊긴 토큰 한 줄 · 멈춘 약속 · 뺀 목표일은 남김 — 지우지 않음) → DB 어긋남 점검 새 어긋남 0. 적용 때 운영 153 일정(`branch_calendar_events`)은 아직 0건이라 공개 주소는 일정 없는 달력으로 시작한다.

#### 3-2단계 — 운영본부 일정 기본기: 구글처럼 보고 · 옮기고 · 알림 받기 (작업판 `myboxer:calendar3-2` · 2026-11-13 대표님 「3-2 시작」)

「일정」 탭 「내 일정」을 구글 캘린더 기본기로 — 반복(매일 · 매주 · 매월 · 매년 · n마다 · 횟수 · 끝나는 날) · 바꿀 범위(이 일정만 · 이후 모두 · 전체) · 보기 여섯(일 · 3일 · 주 = 시간축 · 월 · 목록 · 연간) · 끌어 옮기기 · 늘리기 · 일정 알림 · 아침 브리핑 · 검색 · 휴지통 30일 · 공휴일 · 회원 생일 · D-day · 색 12 · 장소. 새 페이지 · 새 탭 없음(팀 일정 「주간 · 달력」은 그대로 · 사람 × 요일 판 = 팀 보기).

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261113145845_calendar_stage32.sql](supabase/migrations/20261113145845_calendar_stage32.sql) | `ops_plans` 새 칸 rrule(모양 검사 · 120자) · color(12 이름) · location(80자) · reminders(smallint[] ≤ 4 · 0/5/10/15/30/60/120/1440분) · series_id + 색인 3 · 새 표 `ops_plan_notices`(remind/brief · 사람 · 일정 · 그날 · 분 — 한 번만, unique nulls not distinct) · `ops_plan_prefs`(아침 브리핑 끄기) — 둘 다 함수로만 · 규칙 엔진 `_ops_rrule_parse` · `_ops_rrule_fill` · `_ops_rrule_text` · `_ops_recur_match` · `_ops_recur_first` · `_ops_recur_until` · `_ops_plan_rule` · `_ops_plan_on` · 화면 함수 `ops_plans_range(지점, 시작, 끝)`(400일까지 · prefs · 62일 안이면 생일) · `ops_plans_week`(예전 화면 — 범위 함수를 감쌈) · `ops_plan_save`(scope) · `ops_plan_skip` · `ops_plan_remove_scope` · `ops_plan_trash` · `ops_plan_restore` · `ops_plan_search` · `ops_plan_prefs_set` · 예약 함수 `ops_plan_remind_tick` · `ops_plan_brief_tick`(가짜 시계 `p_at` — service_role 만) · `_calendar_feed_staff`(3-1 구독에 rrule · 장소) |
| [src/lib/opsRecur.ts](src/lib/opsRecur.ts) · [opsRecur.cases.json](src/lib/opsRecur.cases.json) | 화면 반복 엔진 — 서버와 같은 결과(같은 40경우 = python dateutil 기대값, SQL 시험도 같은 파일 목록) · 규칙 읽기 · 정리 글 · 맞는 날 · 첫날 · 횟수 → 끝나는 날 · 다음 날 · 화면 글(「매월 셋째 화요일」 · 「2개월마다 마지막 금요일 · 6번」) · 매월 고르기 · 끌기 규칙 `shiftRule` (시험 opsRecur.test.ts) |
| [src/lib/opsTimeGrid.ts](src/lib/opsTimeGrid.ts) · [src/lib/krHolidays.ts](src/lib/krHolidays.ts) | 시간축 계산(06~24시 · 15분 · 1시간 48px · 겹치면 나란히 `layoutDay` · 옮기기 · 늘리기) / 공휴일 2026~2028(한국천문연구원 월력요항 — 2027 · 2028 은 발표 전 자료라 해마다 고친다 · 대체공휴일 · 선거일 포함) |
| [src/lib/opsPlans.ts](src/lib/opsPlans.ts) · [src/services/opsPlanService.ts](src/services/opsPlanService.ts) | 넣기 칸 `PlanDraft`(반복 · n마다 · 매월 모양 · 끝 계속/날짜/횟수 · 색 · 장소 · 알림) · 검사(서버와 같은 말) · 보낼 값 · 미리 보기 · 범위(`planRange`) · D-day · 끌기 「이후 모두」 `moveFollowing` · `moveFollowingLabel` (시험 opsPlanDraft.test.ts) / `useOpsPlansRange` 한 번에 받기(3-2 함수가 없으면 주마다 받아 합침 · 연간 숨김) · 지우기 범위 · 휴지통 · 되살리기 · 검색 · 브리핑 설정 |
| [OpsPlanTab](src/components/ops/OpsPlanTab.tsx) · [OpsPlanTimeGrid](src/components/ops/OpsPlanTimeGrid.tsx) · [OpsPlanSheet](src/components/ops/OpsPlanSheet.tsx) · [OpsPlanAgenda](src/components/ops/OpsPlanAgenda.tsx) · [OpsPlanYear](src/components/ops/OpsPlanYear.tsx) · [OpsPlanTools](src/components/ops/OpsPlanTools.tsx) | 내 일정 보기 고르기(기기마다 `153plan:view`, 처음 = 월) · 시간축(근무 = 바탕색 · 지금 = 빨간 선 · 빈 칸 누르면 그 15분부터 1시간 · 휴대폰 0.45초 길게 눌러 끌기(그 전에 움직이면 스크롤) · 아래 끝 = 늘리기 · 주 보기 칸은 제목 줄바꿈 · 끄는 동안 시각 말풍선) · 시트(범위 · 반복 · 미리 보기 '다음: …' · 알림 · 장소 · 색 · 메모) · 목록 60일(공휴일 · 생일 · 한 번 하는 일정 D-n — 여러 날이면 첫날만) · 연간(일정 있는 날 점 · 누르면 그날) · 검색 · 휴지통 · 아침 브리핑 스위치 · 반복을 끌어 놓으면 「이 일정만 / 이후 모두」(원래 → 바뀔 회차 · 「이후 모두 → 매주 화 · 금 · 19:30~20:30」 미리 보기) · 알림 링크 `?d=날짜` = 그날 일 보기 |
| [OpsPlanMonth](src/components/ops/OpsPlanMonth.tsx) · [OpsCalEvents](src/components/ops/OpsCalEvents.tsx) · [calendar-feed/feed.ts](supabase/functions/calendar-feed/feed.ts) | 달력 칸 공휴일 빨간 글씨 / 목록 · 고른 날의 「회원 달력에 휴관으로 올리기」(대표님 · 지점장님) → 회원 달력 시트가 '○○ 휴관'으로 열림 / 구독 `.ics` 에 RRULE 그대로(횟수는 UNTIL 로) — **Edge Function `calendar-feed` 다시 배포**(`functions/calendar-feed/index.ts` · `feed.ts` + `functions/calendar-ics/ics.ts`) |

- 반복 규칙(RFC 5545 · 구글과 같은 뜻): 받는 것 = FREQ DAILY · WEEKLY · MONTHLY · YEARLY · INTERVAL(매일 30 · 매주 12 · 매월 12 · 매년 5까지) · BYDAY(매주 요일들 · 매월 1~4번째 또는 마지막(-1) 요일 하나) · BYMONTHDAY(1~31 또는 -1 = 말일) · COUNT(1~200) · UNTIL — 그 밖은 '반복 규칙을 다시 골라 주세요'. 주는 월요일부터(WKST=MO) · n마다는 시작 날의 주 · 달 · 해를 기준 · 없는 날은 건너뜀(31일 · 다섯째 · 윤년 아닌 2월 29일) · 횟수는 빼는 날 전에 셈 · 시작은 규칙에 맞는 첫날로 당김 · 횟수는 서버가 끝나는 날(`until_on`)로 계산(10년 안) · 저장 글은 정리한 모양(UNTIL 없이) · 매주는 `repeat_weekdays` 도 같이 써서 예전 화면도 읽는다.
- 바꿀 범위: 이 일정만 = 반복에서 그날을 빼고 같은 묶음(series_id)으로 한 번 하는 일정 · 이후 모두 = 원래 줄은 전날까지(횟수 풀고 끝나는 날로 · 빼는 날 나눔) + 같은 묶음 새 줄(첫 회차면 전체) · 전체 = 그 줄. 지우기 전체 = 묶음째 휴지통(`deleted_at`) · 되살리기는 같은 묶음에서 5초 안에 함께 지운 것까지. 30일 지나면 휴지통에 없고 되살리기 막힘.
- 끌어 옮기기 「이후 모두」(`moveFollowing`): 앞당기면 놓은 날에서, 미루면 끈 날에서 나눈다(그날이 두 번 보이거나 그사이 회차가 빠지지 않게) · 매주 = **끈 요일만 새 요일로**(화 · 목의 목요일을 금요일로 → 화 · 금, 이미 있는 요일로 끌면 합쳐짐) · 매월 = 새 날 기준(마지막이면 마지막, 아니면 n번째 — 12/24 목은 넷째) · 매일 · 매년 = 새 시작 날. 한 시리즈는 시각이 하나라 다른 요일 시각도 같이 바뀐다(구글도 같다) — 그래서 놓기 전에 바뀔 모양을 보여 준다.
- 보이는 범위(대표님 결정 4): 코치님 = 본인 일정만 · 대표님 · 지점 관리자 = 팀(개인 '시간만'은 제목 · 메모 · 장소 가림) · 알림 분은 본인 것만 · 검색 = 내 것 + 관리자는 팀 공개 일정 · 휴지통은 본인 것만 · 남의 일정 고치기 · 지우기 · 빼기는 지점장도 막힘. 회원 생일(이름 = 닉네임 없으면 이름 · 월일만 · 승인된 지점 회원 중 수강권이 7일 안까지 있거나 30일 안에 출석한 분 · 코치진 · 체험 · 합쳐진 계정 빼고 · 2월 29일은 평년 2월 28일)은 그 지점 지도진 · 관리자에게만, 받는 범위 62일 안일 때만 — 누르면 회원 카드(「오늘 만날 회원」과 같은 결).
- 일정 알림(대표님 결정 6): 매분 `ops-plan-remind` → 시작 n분 전(기본 10분 · 4개까지) 「⏰ 제목 · 10분 전」 + 'HH:MM~HH:MM · 장소' → `/office?tab=plan&d=날짜` · 사람 · 일정 · 그날 · 분마다 한 번(먼저 기록 → 알림) · 늦게 돌면 'n분 뒤' · 10분 넘게 늦으면 안 보냄 · **밤 10시 ~ 아침 8시는 알림함에만**(`pushed_at`) · 그만둔 코치 · 빼는 날 · 지운 일정 안 감. 아침 브리핑 = 10분마다 08:00~08:59(`ops-plan-brief` · UTC 23시) 그날 수업 · PT · 업무 · 외부 + 약속한 회원(약속 시범 지점 · 그날 근무 · 휴관일 아님)이 있을 때만 「📅 오늘 일정」 한 통 · 사람마다 하루 한 번 · 끄기 = 스위치(`ops_plan_prefs`).
- 끄기: `select cron.unschedule('ops-plan-remind'); select cron.unschedule('ops-plan-brief');`(화면 · 저장은 그대로).
- 미룬 것: 첨부(보이는 범위 · 저장소 정책 위험 → 3-3) · 날씨(대표님 결정 8 — 공공데이터포털 단기예보 키를 받은 뒤 · 없으면 숨김) · 브리핑의 할 일(3-4) · `.ics` 가져오기의 매월 · 격주는 아직 첫 번만(3-1 그대로).
- 시험: 로컬 Postgres 16(운영 정의 뼈대 + 3-1 + 이 마이그레이션 두 번 · 운영처럼 `_strategy_hq` 실행 권한 뺌) — 반복 40경우 = dateutil · 12묶음 ALL_OK(권한 막힘 18 · 규칙 글 정리 · 거절 24 · 저장 검사 말 · 예전 화면 · 세 범위 · 지점장도 남의 것 막힘 · 범위 읽기 · 가림 · 생일 · 지우기 세 범위 · 휴지통 · 30일 · 검색(% 글자 그대로) · 브리핑 끄기 · 알림(가짜 시계 — 10분 전 · 두 번째 0 · 밤/아침 알림함 · 하루 전 · 늦음) · 아침 브리핑 · 구독 자료 · 표 모양 · 예약 2) · 3-1 시험도 그대로 ALL_OK / vitest opsRecur 51 · opsPlanDraft 17 · opsTimeGrid 7 · krHolidays 4 · calendarFeed 20 · 전체 1,620 / 390px 화면 21장(주 · 일 · 3일 · 월 · 목록 · 연간 · 빈 주 · 알림 링크 · 지점장 팀 · 지점장 목록 · 글씨 크게 · 새 일정 · 매월 · 고치기 · 이후 모두 · 검색 · 휴지통 · 끄는 중 · 범위 묻기 · 휴관 올리기) — 고친 것: 주 보기 제목 '저…' → 줄바꿈 · 연간 오늘 두 자리 꺾임 · 끄는 시각 말풍선 · 범위 묻기 줄 잘림 · 반복 카드 시각 잘림 · 여러 날 일정 둘째 날 D-n · 검색 날짜 두 번 · 하루 보기 생일 한 줄 · 맨 위 시각 글자 잘림 · 빈 주 안내 한 줄.
- **적용 (2026-11-13 17:2x 대표님 「적용하고 올려」)**: 적용 직전 운영 확인 — 바꾸는 기존 함수 4개(`ops_plan_save` · `ops_plans_week` · `ops_plan_skip` · `_calendar_feed_staff`)와 새 함수가 기대는 함수 14개가 로컬 기준본과 주석 · 빈칸을 뺀 지문이 같음(운영 `ops_plan_save` · `ops_plans_week` 는 11-02 적용 때 주석 없이 들어가 원문 md5 만 달랐다) → 운영 DB = MCP `apply_migration` 6조각(기록 `calendar_stage32_a_columns` · `_b_engine` · `_c_read` · `_d_write` · `_e_notices` · `_f_feed_grants_cron` — 파일 하나를 순서대로 나눔, 본문은 파일과 같고 '끄기' 주석 한 줄만 뺐다) → 함수 23개 원문 md5 = 저장소 파일을 올린 로컬 기준본 · 보안 정의자 · 실행 권한(안쪽 · 예약 함수 = service_role 만 · 화면 함수 = authenticated) · 새 칸 5 · 제약 4 · 색인 3 · 새 표 2(RLS · anon/authenticated 막힘) · 예약 2 켜짐(첫 바퀴 성공) → 되돌림 시험(DO 블록 예외 · 대표님 계정 안 씀) ALL_OK — anon · 코치의 예약 함수 막힘 / 선릉 코치 = 범위(본인 것만 · 브리핑 켬 · 생일) · 매주 화 · 목 4번(끝나는 날 계산 · 색 · 장소 · 알림) · 검사 말 5 · 이 일정만 · 이후 모두(원래 줄 전날까지 · 횟수 풀림 · 같은 묶음) · 날마다 있는 일정 수 · 구독 자료(rrule · UNTIL · 장소 · 개인 일정 제목 없음) · 일정 알림(가짜 시계 — '⏰ … · 10분 전' · 두 번째 0 · 아침 8시 전 알림함에만) · 아침 브리핑(8시 전 0 · '수업 1 · … 첫 일정 19:00' · 두 번째 0) · 검색(제목 · 장소 · % 글자 그대로) · 브리핑 끄기 · 주 보기 = 범위 · 지우기(그날만 · 묶음 3) · 휴지통 · 되살리기 3 / 선릉 지점장 = 팀 · 남의 알림 분 없음 · 개인 '시간만' 가림 · 62일 넘으면 생일 없음 · 팀 검색(시간만 빼고) · 남의 것 지우기 · 고치기 · 빼기 · 되살리기 막힘 / 칠금 코치 = 선릉을 골라도 자기 지점 · 선릉에 넣기 막힘 / 회원 = 읽기 · 설정 · 검색 · 넣기 · 지우기 막힘 — 남은 줄 0 → Edge Function `calendar-feed` v2(v1 = 3-1 저장소 파일 확인 뒤 · files `functions/calendar-feed/index.ts` · `feed.ts` + `functions/calendar-ics/ics.ts` · verify_jwt false) → 공개 주소(선릉 · 칠금) 200 · 없는 토큰 = 빈 달력 · 틀린 주소 404 · POST 405 → DB 어긋남 점검 새 어긋남 0. 적용 때 운영 일정 중 반복 규칙 · 알림이 있는 줄은 0 — 예전 화면이 넣은 일정은 알림 없이 그대로(새 화면에서 넣는 일정부터 기본 10분 전) · 아침 브리핑은 다음 날 08:00 부터.

### 153 운동 약속 1단계 · 코치 「오늘 만날 회원」 (2026-11-12 대표님 「추천하는대로 진행할게」 · 선릉역점만 · 문서 https://claude.ai/artifact/LK88UcbCHRvQNx6T8kaxu2 · 11/08 계획 3단계 중 약속 부분)

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261112192617_promise_stage1.sql](supabase/migrations/20261112192617_promise_stage1.sql) | 새 설정 `app_settings.promise_pilot`(branches · start_date = 켠 날 · return_bonus 5000 · return_window_days 30 · remind_at 08:30 · quiet_after 21:00 · meet_starter_days 28 · meet_gap_days 14 · meet_expiring_days 14) · 새 표 `member_promises`(회원마다 지금 약속 하나 — 요일 0=일~6=토 · 시간대 · 대비책 60자 · 알림 · started_on · 그만하기 = `stopped_at`) · `member_promise_notices`(remind · return 한 번만) — 함수로만 · `get_my_promise` · `set_my_promise(p_weekdays, p_time_slot, p_plan_b, p_notify)` · `stop_my_promise` · `promise_tick`(예약 `promise-tick` 10분마다) · `ops_meet_today(p_branch)` |
| [src/lib/promise153.ts](src/lib/promise153.ts) | 서버 JSON 읽기 · 약속한 날 · 다음 약속 · 이번 주 지킨 수 · 카드 한 줄(`promiseStatus` — 잘한 것과 다음 약속만) · 약속 문장 · 시트 검사(서버와 같은 말) · 코치 줄 이유와 할 말(`meetReasons`) · 순서(`sortMeetRows`) — 시험 promise153.test.ts |
| [src/services/promiseService.ts](src/services/promiseService.ts) | `["153promise", …]` 캐시 · 함수가 없거나 막히면 꺼진 것으로(화면 그대로) |
| [WorkoutCalendar](src/components/attendance/WorkoutCalendar.tsx) `withPromise` · [PromiseSheet](src/components/attendance/PromiseSheet.tsx) | 회원: 운동 달력(홈 · 내 운동 기록, 내 기록일 때만) — 약속한 날(오늘 · 앞으로, 아직 안 온 날) 점선 테두리 → 출석하면 그대로 민트 도장 · 카드 안 한 줄(없으면 「운동 약속 걸기」) · 시트 = 요일(처음엔 주 2번 권함) · 시간대(선택) · 대비책 한 줄(예시 3개) · 알림 · 약속 문장 · 「약속합니다」 · 「약속 잠시 멈추기」(두 번 눌러) |
| [OpsMeetToday](src/components/ops/OpsMeetToday.tsx) | 153운영본부 「일정」 탭 맨 위 「오늘 만날 회원」 — 오늘 약속한 회원 + 오늘 온 회원 중 첫 출석 · 첫 4주 n번째 · n일 만에(14일+) · 수강권 n일(14일 안) · 운동 모집 → 줄마다 코치님이 할 한 가지 · 누르면 회원 카드. 온 회원 먼저(늦게 온 순) · 아직 안 온 약속 회원은 시간대 순 · 6명 넘으면 더 보기 · 없으면 안 그림 |

- 감정 설계(위 「회원 감정 설계 기준」): **놓친 약속은 어디에도 표시하지 않는다**(달력 · 줄 글 · 알림 · 코치 화면 모두) · 지킴 = 약속한 날 출석(시간대 무관 · 직접 체크 없음) · 대비책 글은 회원 본인만(코치 함수에 없음).
- 알림: 약속한 날 아침 remind_at ~ quiet_after 사이 1번(이미 왔거나 알림을 끈 회원은 안 보냄) · 복귀 보너스 = 약속한 날을 놓친 뒤 다시 온 날 `grant_mileage`(kind `milestone` '출석 기념' · 사유 '다시 시작 보너스 — 운동 약속' · idem_key `promise-return:<회원>:<연-월>` = 한 달 1번) + '다시 와서 반가워요'(알림 시간 밖이면 알림함에만 — pushed_at). **켠 날(start_date) 앞에 놓친 약속으로는 주지 않는다.**
- 출석 표에는 트리거를 달지 않았다(보호 영역) — 10분 예약이 오늘 출석을 읽는다. 기존 함수 · 표 · 제약은 그대로. 코치님 · 운영진 · 체험 계정 · 합쳐진 계정은 약속 대상이 아니다(`_promise_member`).
- 「오늘 만날 회원」 보는 사람 = 그 지점 지도진(`_strategy_branch_staff`) · 전체관리자 · 관리자(지점 고르기). 켠 지점(promise_pilot.branches)이 아니면 `{on:false}`.
- 끄기 = `promise_pilot.branches` 를 빈 배열(화면 · 예약 모두 조용) + `select cron.unschedule('promise-tick');`. 다른 지점을 켜려면 branches 에 지점 이름.
- 시험: 로컬 Postgres 16 에 운영 정의를 본뜬 뼈대(grant_mileage · _strategy_branch_staff 는 운영 본문 그대로) + 이 마이그레이션(두 번 적용) → 16개(켜지 않은 지점 · 코치 · 체험 계정 꺼짐 · 요일 정리 · 잘못된 값 막힘 · 같은 요일이면 시작일 그대로 · 멈추기 · 다시 걸기 · 조용한 시간엔 아침 알림 없고 보너스는 알림함에만 · 아침 알림 한 번씩 · 이미 온 회원은 없음 · 복귀 보너스 한 번 · 켜기 전 놓친 약속은 없음 · 코치 줄과 값 · 대비책 없음 · 대표님 지점 고르기 · 코치 다른 지점 막힘 · 표 · 예약 · 안쪽 함수 · anon 막힘) / vitest promise153 11개.
- **적용 (2026-11-12 19:5x 대표님 「적용하고 올려」)**: 운영 DB = MCP `apply_migration`(기록 `20261112105512_promise_stage1` — 파일 번호와 다르고 본문은 같다 · 새 설정 1 · 새 표 2 · 새 함수 11 · 예약 1) → DB 어긋남 점검 새 어긋남 0 → 되돌림 시험(DO 블록 예외) ALL_OK: 설정 · 예약 / 선릉 회원 = 걸기(요일 정리 · 대비책 공백 정리 · 오늘부터) · 잘못된 값 4가지 막힘 · 오늘 만날 회원 막힘 · 같은 요일 고치기는 시작일 그대로 · 멈춤(지우지 않음) · 다시 걸기 / 선릉 코치 = 꺼짐 · 저장 막힘 · 오늘 만날 회원(그 시각 11줄 · 약속 회원 줄 · 대비책 칸 없음) · 다른 지점 막힘 / 예약 = 아침 알림 1통 · 두 번째 0 · 오늘 건 약속은 보너스 없음 / 칠금 회원 · 로그인 없음 · anon · 표 직접 읽기 · 안쪽 함수 막힘 — 남은 줄 0. `start_date` = 2026-11-12(이날 앞에 놓친 약속으로는 보너스 없음).
- 다음: 일요일 주간 돌아보기(약속 · 지킨 날 · 운동 시간) · 「오늘 만날 회원」에 코치 '인사했어요' 기록 · 건강 교과서는 미룸(대표님 결정).

### 동기부여 1단계 — 첫 4주 8번 · 이른 출석 축하 · 코치 「첫 4주 신규」 (2026-11-12 대표님 「추천대로」 · 선릉역점만 먼저 · 보고서 https://claude.ai/artifact/6sAvidMfhyLhFERCK5jXFw)

근거(선릉역점 운영 DB, 2026-11-12): 첫 출석부터 4주 안에 8번 이상 온 신규는 3개월째 77% · 1~3번은 23%가 남았다(3월~8월 14일 첫 출석 131명) · 4주에 8번 이상 오던 회원 42명은 다음 4주에 한 명도 안 끊겼다. 출석 축하는 50번마다라 주 2회 회원도 첫 축하가 6개월 뒤였다.

| 파일 | 역할 |
|---|---|
| [supabase/migrations/20261112160924_motivation_stage1.sql](supabase/migrations/20261112160924_motivation_stage1.sql) | 새 설정 `app_settings.motivation_pilot`(branches · start_date = 적용한 날 · starter_days 28 · starter_goal 8 · starter_mileage 3000 · early [5,10,20,30]) · 새 표 `motivation_awards`(early 5/10/20/30 · starter 8 — 함수로만) · `get_my_motivation`(켠 지점 회원이 아니면 {on:false}) · `mark_my_motivation_seen` · `motivation_tick`(예약 `motivation-tick` 5분마다) · `get_starter_watchlist`(켠 지점 지도진 · 대표님) · 안쪽 `_motivation_conf` · `_motivation_member` · `_motivation_days` |
| [src/lib/motivation153.ts](src/lib/motivation153.ts) | 서버 JSON 읽기 · 홈 칸 글(`starterView`) · 다음 축하(`nextCelebration` — 5 · 10 · 20 · 30 다음은 기존 50번마다) · 편지(`earlyLetter` · `starterLetter` · `motivationLetter`) · 코치 목록(`normalizeWatchlist` · `isBehind`) — 시험 motivation153.test.ts |
| [src/hooks/useMotivation.ts](src/hooks/useMotivation.ts) | `["153motivation", …]` 캐시 · 함수가 없거나 막히면 꺼진 것으로(화면 그대로) |
| [src/components/attendance/StarterProgress.tsx](src/components/attendance/StarterProgress.tsx) | '첫 4주 8번' 칸 — 홈 '운동 달력' 카드 맨 위(`WorkoutCalendarCard` `header`) · 내 운동 기록 '이번 주' 카드(내 기록일 때만). 첫 출석일부터 28일만 · 다 채우면 금색 '달성' |

- **기존 함수 · 트리거 · 표는 안 건드렸다**(출석 보상 · 출석 표는 보호 영역): `attendance_milestones` 는 50의 배수만 받아(check) 이른 축하는 새 표에 · 출석 표에 트리거를 달지 않고 5분마다 최근 3일 출석을 훑는다(PT 입장 알림과 같은 방식) · 마일리지는 기존 `grant_mileage`(kind `milestone` · idem_key `starter4w:<회원>`).
- 이른 축하 = 보상 없이 축하 편지(알림 '출석 N번째! 🎉' → 홈) — 그 출석일이 켠 날(start_date) 뒤인 것만(켜기 전 것을 몰아서 보내지 않기). 챔피언 머니 · 마일리지는 50번마다 그대로(출석 축하 막대 `AttendanceMilestoneCard` 도 이른 축하일 땐 '축하 편지'만).
- 첫 4주 달성 = 창(첫 출석일 ~ +27일) 안 출석 8번 · 창이 켠 날과 겹치는 회원만(적용할 때 한 번 28일로 돌려 이미 채운 회원도 받음) → `motivation_awards` + 마일리지 + 알림 '첫 4주 8번 달성! 🥊'. 하루 여러 번 = 1번(출석 축하와 같은 기준) · 코치님 · 운영진 · 체험 계정 · 합쳐진 계정 제외.
- 편지: `WelcomeLetter` 'motivation' — 승급 → 50번 축하 → **이른 축하 · 첫 4주(첫 4주가 먼저)** → 웰컴, 닫으면 `mark_my_motivation_seen`.
- 코치 화면: 회원관리 '위험' 탭 맨 위 「첫 4주 신규 n명」(`AtRiskMembersPanel` `StarterWatchList`) — 며칠째 · 마지막 출석 · n/8 · 주 2번 속도(지금쯤 floor(날 × 8 / 28)번)보다 늦으면 주황 + 위로 · 누르면 회원 상세.
- 끄기 = `motivation_pilot.branches` 를 빈 배열 → 화면 · 예약 모두 조용(`select cron.unschedule('motivation-tick');` 도). 다른 지점을 켜려면 branches 에 지점 이름(오삼코치 `pilot_branch_names()` 와는 따로 — 거기엔 칠금점도 있다). 마일리지 금액은 starter_mileage 한 칸.
- 오삼코치 안내 osamiFaq `att-starter`(문구를 바꾸면 같이).
- 시험: 로컬 Postgres 16 에 운영 정의를 본뜬 뼈대 + 이 마이그레이션(두 번 적용) → 15개(새 회원 · 켜기 전 8번 채운 회원 = 달성 + 마일리지 3,000 한 번 · 5번째가 오늘인 회원 = 이른 축하 · 켜지 않은 지점 · 코치(is_staff) 제외 · 오래된 회원 = 켜기 전 5 · 10번째는 없음 · 다시 돌려도 그대로 · 본 것으로 · 코치 목록(늦은 회원 먼저) · 회원은 목록 막힘 · 대표님 지점 고르기 · 끄기 · anon/표 직접 읽기 막힘) / vitest 17개.
- 다음(보고서 1단계 남은 것): 레벨업 축하 · 주간 「나의 153」 카톡 · 문자(수신 동의 · 템플릿 — 대표님 결정 1번) · 메뉴 정리(더보기로 접기 — 다른 창의 메뉴 편집 패치 c19d720 이 푸시 전이라 그 판과 맞춘 뒤) · 보상 이름 '레벨' · '마일리지' 둘로.

### 153플레이 「음악」 탭 — 체육관 자동재생 (2026-11-11 대표님 「153플레이에 복싱 음악 따로 모아놓자 · 복싱짐에서 틀 수 있는 인기 음악 100곡 · 카테고리 · 체육관에 자동재생 — 광고도 없고 멈추지도 않게」 · 「100곡 더 찾아줘 최신곡으로」)

| 파일 | 역할 |
|---|---|
| [src/data/gymMusic.ts](src/data/gymMusic.ts) | 모음집 목록 정본 288편(약 429시간) — **2026-11-12 대표님 「뮤직비디오는 모두 빼 · 한 곡에 30분 넘는 모음집만 · 에너지 복싱 운동할 때 듣는 음악으로만」** 으로 11-11 뮤직비디오 200곡을 통째로 바꿨다(뮤직비디오는 앞에 소리 없는 구간이 길다). 7 카테고리(복싱 · 킥복싱 26 · 힙합 81 · EDM 78 · 베이스 28 · 논스톱 유산소 34 · 록 11 · 팝 · K-POP 30) · 한 편 30분 이상(`m` = 분) · 레이블 · 운동 음악 회사 · 채널 주인이 직접 올린 논스톱 믹스만 · 퍼가기 허용 + 사무실 크롬에서 실제 재생 확인(11-12) · 표지 그림도 봤다(노출 · 해골 · 악마 그림은 뺌) · 느린 음악은 넣지 않는다. 같은 날 2차 — 대표님이 보내 주신 유튜브 추천 화면 3장(36개) 「이 채널에 있는 음악들 모두 집어넣어」 → 30편 추가 · 랩 · 힙합은 **「힙합」 카테고리로 따로**(가사에 영어 욕설이 섞일 수 있어 키즈 · 여성부 수업 땐 그 칩을 뺀다 — ? 안내에도) · 뺀 6개(퍼가기 막힘 2 · 동요 자동 믹스 · 크리스마스 재즈 · 재즈 힙합 · 22분짜리 1)는 gymMusic.ts 머리말. 같은 날 3차 — 「캡처해 준 채널들 안에 인기 음악 모음 1위부터 5위까지 모두 집어넣자」 → 그 채널 25곳의 인기순 30분 넘는 운동 모음집 1~5위 95편 추가(못 넣는 것은 그 채널 10위 안에서 다음 순위로 채움 — 퍼가기 막힘 · 표지에 가리지 않은 욕설 글자 · 담배 · 악마/지옥 그림 · 수영복/속옷 노출 · 저승(VALHALLA) 그림 · 원래 제목 욕설 · 발라드 모음은 뺌, 자세한 것은 gymMusic.ts 머리말). 같은 날 4차 — 「방금 채널에 있는 최신이면서 인기 있는 목록 추가하자」 → 같은 채널들의 최근 2개월 · 30분 넘는 · 조회 1천 이상 모음집을 조회수 순으로 채널마다 최대 5편, 71편 추가(같은 표지 · 퍼가기 기준). **DB 에 넣지 않는다** — boxing_programs 에 넣으면 라이브러리 · AI 수업 · 옛 153library.pages.dev 에 훈련 영상처럼 섞인다 |
| [src/components/library/GymMusicSection.tsx](src/components/library/GymMusicSection.tsx) | 153플레이 NAV 「음악」(BoxingLibraryPage `music`) — 카테고리 여러 개 고르기 · 곡 누르면 그 곡부터 · 자동재생 · 빼 둔 곡 다시 넣기 · ? 안내 |
| [src/components/library/GymMusicPlayer.tsx](src/components/library/GymMusicPlayer.tsx) | 전체 화면 플레이어 — 섞어서 끝없이 · 멈춤 감시 2초 · 못 트는 곡 건너뛰기 · 연달아 실패하면 15→30→60초 기다렸다 다시(인터넷 끊김) · `online` 이면 바로 · Wake Lock · 영상 누르기 막음(실수로 멈춤 방지, 조작은 아래 단추) · 키보드(스페이스 · ← →) |
| [src/lib/gymMusicQueue.ts](src/lib/gymMusicQueue.ts) (+test) | 섞기(같은 가수 연달아 X · 방금 들은 곡이 다음 바퀴 첫 곡 X) · 멈춤 감시 규칙 `watchdogAction` · 기다림 `retryDelayMs` |
| [src/lib/youtubeIframeApi.ts](src/lib/youtubeIframeApi.ts) | 유튜브 IFrame API 한 번만 받기(실패하면 다음에 다시) |

- 주소: `/library?tab=music`(탭) · `&play=1`(바로 플레이어 — 체육관 기기 즐겨찾기) · `&cats=box,edm`(카테고리 키 box · hiphop · edm · bass · cardio · rock · pop). 기기마다 기억(localStorage): `153play_music_cats` · `153play_music_hidden`(이 모음집 빼기) · `153play_music_vol`.
- **광고는 앱이 못 끈다** — 체육관 기기 브라우저에 유튜브 프리미엄 로그인 + 유튜브 쿠키 차단 끄기. 그래서 이 플레이어만 `youtube-nocookie` 가 아니라 `www.youtube.com` 을 쓴다(로그인 쿠키가 있어야 프리미엄이 적용).
- 브라우저는 소리 나는 자동재생을 처음 한 번 눌러야 허락한다 — 한 곡도 못 틀었고 사람이 재생 화면을 누른 적이 없으면 '화면을 한 번 눌러' 덮개(`needTap`), 누른 뒤부터는 보통 규칙(건너뛰기).
- 광고가 나오는 동안에도 상태가 '재생 중'일 수 있어서 '재생 중인데 시간이 안 감'은 150초까지 기다린다 — 줄이면 프리미엄이 아닌 기기에서 광고마다 곡이 넘어간다.
- 모음집을 바꾸려면 `gymMusic.ts` 만 고친다 — 한 편 30분 이상 · 올린 곳이 레이블 · 운동 음악 회사 · 채널 주인 · `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>` 가 200(401 = 퍼가기 막힘) · 시험이 30분 이상 · id 형식 · 중복을 본다. 새 모음집은 채널 페이지(`/@채널/videos` · `/@채널/search?query=workout` — 길이 · 조회수가 같이 보인다)에서 찾는다. 유튜브 전체 검색 페이지(`/results`) · `/youtubei/` 는 robots.txt 가 막는 경로라 쓰지 않는다. 뮤직비디오는 다시 넣지 않는다(대표님 11-12). 대표님이 유튜브 화면을 보내 주시면(11-12 2차): 영상 페이지 `/watch?v=` 의 '관련 영상' 목록(허용 경로 — 대표님 화면이 바로 이 목록) · 해시태그 페이지 `/hashtag/boxingmusic` · 채널 안 검색으로 제목 · 채널 · 길이가 같은 영상을 찾고, 핸들은 oEmbed 의 `author_url` 로 얻는다. 채널 인기순 1~N위는 `/playlist?list=UULP<채널 id 의 UC 뒤 22자>`(유튜브가 만든 '인기 동영상' 목록, 쇼츠 제외 · 허용 경로), 최신순은 `UULF<같은 22자>`(동영상만 최신순 100편 · 조회수와 올린 지 얼마인지 같이 나온다) — 채널 id 는 `/@핸들` 페이지의 `externalId`. `/watch` 는 클라우드에서 자주 429(너무 많은 요청)가 나니 채널 · 재생목록 페이지와 oEmbed 를 먼저 쓴다. 표지 그림은 `https://i.ytimg.com/vi/<id>/mqdefault.jpg` 를 모아 한 장(5×5)으로 만들어 본다.
- 클라우드 작업공간(데이터센터 IP)에서는 유튜브가 영상 재생을 막는다('Video unavailable') — 실제 재생 확인은 체육관 · 사무실 기기에서.
- 실제 재생 확인하는 법(11-12): 사무실 PC 크롬에서 myboxer153.com 을 연 탭에 IFrame API 플레이어를 `youtube-nocookie` 호스트 · 음소거로 띄우고 id 를 차례로 `loadVideoById` — 재생되면 통과, `onError`(150 = 퍼가기 막힘)면 뺀다. nocookie 라 유튜브 시청 기록에 남지 않는다.

### 153 굿즈 사전예약 — 플리스 집업 (2026-11-12 대표님 「디자인 마무리 하고 모델에 입혀서 상세페이지 처럼 만들어줘 마이복서에 올려서 회원님들에게 판매신청받고 … 유효 회원님들에게 전체 문자 보내서 판매하게 상세페이지 링크 만들어줘」)

**25,000원 원가 판매 · 선착순 50벌**(2026-11-13 00시 대표님 — 처음 39,000원) · 옷은 검정 플리스 하나, 인쇄 색만 흰색 / 진회색 고르기 · 신청 뒤 다니는 지점 데스크에서 카드 · 계좌이체(같은 값) · 마감 2주(11/26 목) · 결제한 신청만 제작. 디자인 = 가슴 153 심볼 3.8cm + 등판 BOXER / 153 / BOXING GYM **가로 29cm · 목 시접 아래 9cm**(컷팅 필름 · 획 1.5mm 이상) — 인쇄 파일은 대표님 대화의 `153_print_29cm_files.zip`(등판 29cm 흰색 · 진회색 SVG · PDF 실제 크기 + 가슴 ① + 위치 사양서). 처음 확정은 가로 22cm · 목 아래 15cm(153_final_thick_print_files.zip)였고, 2026-11-13 대표님이 운동 사진(제미나이가 크고 높게 그린 등판)을 보고 「모델이 입고 있는 비율이 좀 더 우영미 같은 느낌」 · 「지금 올라간 사진 비율이 더 좋아」 → 「인쇄 파일도 키우기」로 바꿨다 — 같은 도안을 1.318배(획 · 간격도 같이 굵어짐), 위치만 6cm 위로. 상세페이지 사진(모델 4장 · 운동 2장 · 평면 2장 · og.jpg)은 모두 이 29cm 벡터로 다시 얹었다(옛 등판은 지우고 FSR 복원 + 원단 결 노이즈 — 저장소 밖 `fleece/boxing/reprint.py`). **사진에 인쇄를 보여 줄 때는 늘 실제 벡터로 얹는다** — AI 가 그린 글씨는 크기 · 자간 · 위치가 틀린다. 바뀐 그림은 주소에 `?v=2`(og 는 `?v=3`) · 업체에 새 파일을 보내는 것은 대표님.

| 파일 | 역할 |
|---|---|
| [public/goods/fleece/index.html](public/goods/fleece/index.html) | 상세페이지(정적 HTML, `/goods/fleece` — `_redirects`). 문자 · 카카오 링크 미리보기(og.jpg) · 로그인 없이 신청(이름 · 휴대폰 · 지점 · 동의). 같은 브라우저에 마이복서153 로그인이 남아 있으면(localStorage `sb-whnczhxyjmyywhlfbgsd-auth-token`, 만료 전) 그 계정으로 채우고 '내 신청' · 결제 전 취소. 앱 카드에서 열면 `?from=app` → source app. 서버에 닿지 않으면(미리보기 주소 · 적용 전) 같은 값의 기본값으로 그린다 |
| `public/goods/fleece/img/*.webp` | 모델 컷 5장(제미나이로 만든 AI 예시 — 페이지에 그렇게 적었다 · 가슴 로고는 정확한 벡터로 다시 얹음) · 앞/뒤 평면 컷(업체 사진 합성) · 인쇄 확대 · **운동 컷 4장 `gym-*.webp`**(2026-11-13 대표님 「우리가 만든 옷을입고 복싱하고있는 이미지몇장 만들어서 올리자」 — LOOK 아래 「IN THE GYM · 운동할 때도 이렇게」 칸: 샌드백 흰색 인쇄 · 미트 가슴 심볼 · 줄넘기 · 섀도복싱 진회색 인쇄. 제미나이 웹(Pro · 이미지 · 3:4)에 실제 착용 컷 · 인쇄 원본을 붙여 만들고, 화면의 765×1024 미리보기를 떠서 952×1280 으로 키움(원본 내려받기는 PC 다운로드 폴더라 못 씀) · 샌드백 컷 링 바닥의 뭉개진 글자는 지움 · 미트 컷은 미트 위로 나온 손가락을 고쳐 다시 만듦 · 'AI 예시' 한 줄 같이 · 샌드백 · 섀도복싱 등판은 위 29cm 벡터로 다시 얹음) |
| [supabase/migrations/20261112202433_goods_preorder.sql](supabase/migrations/20261112202433_goods_preorder.sql) | `goods_campaigns`(상품 한 줄 — 가격 · 색 · 사이즈 · 마감, 바꿀 땐 update) · `goods_orders` · 함수 6개(아래). 표는 anon · authenticated 모두 막음 |
| [src/lib/goodsPreorder.ts](src/lib/goodsPreorder.ts) · [services/goodsService.ts](src/services/goodsService.ts) | 상태 이름 · 다음 단계(서버 허용 변화와 같게) · 색×사이즈 집계 · 업체 발주 문구 · 마감 날짜(한국 날짜) / 서버 호출 |
| [components/admin/GoodsOrdersPanel.tsx](src/components/admin/GoodsOrdersPanel.tsx) | 운영진 신청 관리 — 전체관리자 대시보드 '굿즈' 탭 · 지점장/코치 홈 '굿즈 신청' 카드(`/manager?tab=goods`, 열린 동안 · 마감 뒤 45일). 결제 완료 · 받음 · 취소 · 되돌리기 · 옵션/메모 · 색×사이즈(결제 기준 / 신청 포함) · 업체 발주 문구 복사 · 링크 복사. `?demo=1` = 예시 |
| [components/liveBoard/LiveBoardGoodsCard.tsx](src/components/liveBoard/LiveBoardGoodsCard.tsx) | 라이브보드 **2번 화면** 오른쪽 1/3(화면 너비) — 2번 화면은 오른쪽 패널(QR 출석 · 현재 활동 중 · 짐 레이드)을 통째로 빼고 런칭 이벤트 2/3 + 플리스 1/3(QR 은 옆 사이니지 = 번호 없는 기본 화면에 있다). 흰색 · 진회색 인쇄 모델 컷 나란히 · 가격(정상가가 있으면 줄 긋고) · 153 이익 0원 · 수량(선착순) · 인쇄 색 · 사이즈 · 마감 · 결제(카드 · 계좌이체) · 샘플(샘플이 있는 지점 TV 만 — 아래 「사이즈별 샘플」) · 신청하는 곳 · D-day. 열린 동안만(선착순이 다 차도 안 그림) — 마감 뒤엔 그리지 않아 런칭 이벤트가 화면 전체를 쓴다(오른쪽 패널은 2번 화면에 다시 안 나온다). 런칭 이벤트 칸은 좁아져서 머리를 두 줄로(제목 한 줄 · 설명 + 참가 인원 아랫줄). 2026-11-12 대표님 ① 「라이브 보드2 큐알있는부분 빼자 … 3분의1정도는 플리스 안내하자」 ② 「현재 활동중도 지워주고 … 런칭이벤트를 3분의2를 사용하고 153집업을 나머지 사용해줘」 · tv_board_seen 기준 2번 화면은 선릉역점만 쓴다 |
| [components/goods/GoodsNudgeCard.tsx](src/components/goods/GoodsNudgeCard.tsx) | 홈 안내 카드(만족도 조사 카드 아래) — 열린 동안만, 결제 전이면 '○일까지 ○○점 데스크에서 결제', 결제를 마치면 사라짐 |

- 서버 함수: `goods_campaign_info`(anon) · `goods_order_apply`(anon · 회원 — 로그인이면 그 계정, 아니면 같은 휴대폰 번호의 앱 계정에 잇는다 · **답에 회원인지 싣지 않는다** · 2분 안 같은 신청 = 같은 줄 · 번호당 결제 전+결제 5건 · 회원과 안 이어지는 신청이 10분에 60건이면 잠깐 BUSY) · `goods_my_page`(회원) · `goods_order_cancel`(회원 — 결제 전 · 마감 전) · `goods_admin_orders` / `goods_admin_update`(대표님 · 관리자 = 전 지점, 지점장 · 코치 · is_staff = 자기 지점 — `_goods_staff_scope`). 상태 applied → paid → delivered, canceled ↔ applied.
- 시험: 로컬 Postgres 16 에 운영 정의를 본뜬 뼈대(역할 · auth.uid() · has_role · branches · profiles · Supabase 기본 권한) + 이 마이그레이션(두 번 적용) → 66개(표 직접 읽기 · 쓰기 막힘 · 안쪽 함수 막힘 · 검사 11가지 · 번호로 잇기 · 두 번 눌림 · 5건 · 회원 채우기 · 내 신청 · 취소 규칙 · 지점 범위 · 상태 변화 · 옵션 잠금 · 마감 · BUSY 중에도 회원은 됨) / vitest goodsPreorder 9개 / 상세페이지는 플레이라이트로 손님 · 로그인 흐름(가짜 서버 답).
- **적용 (2026-11-12 21:30 대표님 「올려 + 적용해」)**: 운영 DB = MCP `apply_migration`(기록 `20261112123016_goods_preorder` — 파일 번호와 다르고 본문은 같다 · 새 표 2 · 새 함수 9(안쪽 3 포함) · 첫 상품 1줄) → 로그인 없는 읽기(REST): 상품 정보 · 잘못된 번호 INVALID_PHONE · 표 직접 읽기 / 운영진 목록 / 내 신청 막힘 → 되돌림 시험(DO 블록 예외) ALL_OK(손님 신청 · 손님 내 신청 막힘 · 선릉 회원 채우기 · 신청 78,000원 · 내 신청 · 회원 운영진 목록 / 표 읽기 막힘 · 다른 지점 코치 = 선릉 신청 못 바꿈 · 안 보임 · 대표님 = 전 지점 목록 · 결제 완료 · 옵션 고치기 · 결제 뒤 회원 취소 막힘, 남은 줄 0) → DB 어긋남 점검 새 어긋남 0.
- **25,000원 · 원가 판매 · 선착순 50벌** (2026-11-12 23시 대표님 「2만5천원에 팔고 … 원가 3만5천원짜리 물건인데 연말 세일로 1만원 할인해서 2만5천원 … 50장 선착순」 → 11/13 00시 「25,000원 원가 판매」 · 35,000원 줄은 「빼 줘」 · 「카드 · 계좌이체 둘 다」) — [20261113000016_goods_fleece_stock.sql](supabase/migrations/20261113000016_goods_fleece_stock.sql): 새 칸 `goods_campaigns.list_price`(할인 전 가격 — 업체가 실제로 그 값에 팔던 가격일 때만 · 표시광고법, 지금 null) · `stock_limit`(선착순 벌 수, null = 제한 없음) · `goods_campaign_info` + list_price · stock_limit · stock_used · stock_left · sold_out · `goods_order_apply` 는 상품 줄을 잠그고(for update) 남은 벌 수보다 많으면 `SOLD_OUT {left}`(두 번 눌림은 그 전에 아까 것). 세는 신청 = 결제 전 + 결제 완료 + 받음(취소하면 자리가 다시 난다) · 운영진 되돌리기 · 벌 수 고치기는 넘어도 막지 않음. 화면: 상세페이지 「153이 남기는 이익은 0원이에요」(공장에서 받은 값 = 회원님 가격 · 153이 남기는 돈 0원 · 남은 물량 50벌) · 남은 벌 수 · 다 차면 신청 칸 대신 안내 · og.jpg?v=2(25,000원) / 홈 카드 '원가 판매 · 50벌 한정 · 남은 n벌'(다 차면 신청 전 회원에겐 안 보임) / TV 카드 '연말 원가 판매 · 153 이익 0원 · 수량' 줄(다 차면 그리지 않음) / 운영진 '선착순 50벌 · 남은 n벌 · 신청 n벌'. 판단 `listPriceOf` · `isSoldOut` · `isAccepting` · `stockLabel`(src/lib/goodsPreorder.ts). 시험: 로컬 Postgres 16 26개(선착순 · 동시 신청 둘 중 하나만 · 취소하면 자리 · 결제/받음도 셈 · 운영진 넘김 · 제한 없음 · 마감이 먼저 · 다시 적용해도 그 뒤 값 그대로 · 권한 그대로) + 기존 66개(옛 값으로 되돌려 그대로 통과).
  - **적용 (2026-11-13 00:50 대표님 「올려 + 적용해」 · 「25,000원 원가 판매」)**: 운영 DB = MCP `apply_migration`(기록 `20261112155015_goods_fleece_stock` — 파일 번호와 다르고 본문은 같다) → 로그인 없는 읽기: 25,000원 · 정상가 없음 · 50벌 · 남은 50 · 표 직접 읽기 401 → 되돌림 시험(DO 블록 예외): 손님 2벌 신청 = 50,000원 · 남은 48 / 50벌을 3벌로 줄여 2벌 더 = SOLD_OUT 남은 1 · 1벌 = 됨 · sold_out true → 남은 줄 0 · DB 어긋남 점검 새 어긋남 0.
  - 카드 수수료(50벌 최대 약 1.8만 원)는 153 부담 · 현금 할인 · 카드 추가 요금은 여신전문금융업법 19조 금지 · 데스크 단말기로 업체 물건 값을 받는 '대신 판매'는 다른 가맹점 명의 거래라 안 함(대표님께 11/12 안내). 이익 0원이 맞으려면 옷값은 세금계산서(부가세 포함 25,000원)나 사업자 카드로 산다.
- **사이즈별 샘플** (2026-11-13 대표님 「체육관에 사이즈별 샘플도 있어서 직접 보고 입어볼수있다고 이야기하자」): 샘플이 있는 지점 = `GOODS_SAMPLE_BRANCHES`(src/lib/goodsPreorder.ts · 지금 선릉역점만) · `hasGoodsSample`. TV 카드는 그 지점 TV 에만 '샘플 · 사이즈별로 입어 볼 수 있어요' 줄(LiveBoardPage 가 `branchName` 을 넘김) · 상세페이지는 모든 지점이 보니 '선릉역점에서 사이즈별로 입어 보기'(위 요약 줄 · 사이즈 고르기 · 신청 칸 사이즈 아래 한 줄) · 문자는 선릉 회원에게만 가니 '체육관에 사이즈별 샘플이 있어서 직접 보고 입어 볼 수 있어요'. 샘플을 둔 지점이 늘면 목록과 상세페이지 글을 같이 고친다.
- **상세페이지 가치 전달 판** (2026-11-13 대표님 「워크블록이라는 브랜드가 파는 옷 소재인데 마감이나 소재 퀄리티 모두 확인할수있게 … 가격이 너무 저렴해서 싸구려라고 생각할수있으니 … 이상한 마케팅 스킬을 통해 상세 페이지 전면 디자인」 · 보고서 https://claude.ai/artifact/6o4uSYH7V2TXnujyUVTqds): V-Score 전환 4칸으로 다시 짰다 — 훅(「싸게 만든 옷이 아니라, 153이 남기지 않는 옷이에요」 + 한눈에 보기 3줄) → 증거(WHY 25,000 「가격에서 뺀 것 · 그대로인 것」 · 새 칸 QUALITY · PRINT) → 의심 해소(새 칸 SIZE 단면 실측표 · Q&A 7문답 · 상품 정보에 소재 · 제조국 · 세탁) → 행동 하나(신청). 신청 · 결제 · 남은 벌 수 · 내 신청 칸과 스크립트는 그대로(요소 id 같음).
  - 옷 = 의류 브랜드 **워크블록**이 「플리스 집업 자켓」으로 파는 것과 같은 옷(원단 · 봉제 · 모양 — 대표님 확인). **「작업복 브랜드」라고 쓰지 않는다**(같은 날 대표님 「작업복 브랜드라 하지말고」) — 페이지 말은 '브랜드 제품과 같은 원단 · 봉제'(한눈에 보기 · QUALITY 제목 · meta) · '의류 브랜드 워크블록'(QUALITY 설명 · Q&A). 같은 폴리에스터 플리스를 파는 명품 브랜드(몽클레르 플리스 집업 카디건 겉감 폴리에스터 100% 등)는 있지만 이름은 넣지 않았다 — 같은 섬유일 뿐 같은 원단이 아니라 같은 품질로 읽힐 수 있어서(표시광고법 · 153 금칙 '프리미엄'과 같은 결). **목 상표는 다를 수 있다**(업체 사진의 목 상표는 다른 이름)고 QUALITY · Q&A · 꼭 읽어 주세요에 적었다. 대표님 결정: **다른 판매처 가격(넷피엑스 29,900원 · 워크블록 스마트스토어 정가 19,900원 · 주간 특가 15,000원)과 판매처 링크는 페이지에 넣지 않는다** — 소재 · 가치 전달만 참고.
  - 페이지에 옮긴 사실(워크블록 넷피엑스 상품 정보 · 상세 이미지에서 확인한 것만): 폴리에스터 100% · 부드럽고 촘촘한 플리스 · 하이넥(스탠드 칼라) · 양옆 + 안쪽 주머니 · 단면 실측(M~2XL 총길이 65 · 67.5 · 70 · 72.5 / 가슴 52 · 54.5 · 57 · 59.5 / 어깨 44 · 46.5 · 49 · 51.5 / 소매 60 · 62 · 64 · 66, 재는 법에 따라 1~3cm) · 제조국 중국 · 세탁(뒤집어서 · 표백제 · 강한 세제 X · 열 피해 말리기). 원단 무게 · 지퍼 브랜드는 자료에 없어 쓰지 않음.
  - 실물 마감 사진 4장 `img/real-collar · real-pocket · real-hem · real-seam.webp`(600×600) = 업체가 보낸 실물 사진(저장소 밖 `fleece/front.png` · `back.png`)에서 옛 시안 인쇄 · 목 상표가 안 들어가게 잘라 3배 키움 + 어두운 부분만 살짝 밝게. 선릉역점 샘플을 찍은 사진이 오면 이 4장을 바꾼다(보고서 추천 1번).
  - Q&A 「153은 왜 남기지도 않고 팔아요?」 답은 대표님 말로 고칠 수 있게 보고서 「정해 주실 것」에 남겼다. og.jpg · og 글 · TV · 홈 카드는 그대로.
- 문자 · 앱 메시지: 11/13 00시 「12시 발송 멈춰」로 보류 → 01:32 「오전11시에 보내자」 → 153OS `scheduled_messages` 이름표 '선릉 플리스 원가 판매 · …' **56건 pending · 11/13 11:00 KST**(153OS 워커가 매시 정각에 보냄) · 새 글(25,000원 · 원가 · 선착순 50벌 · 샘플 입어 보기 · 카드나 계좌이체 · UHC 539바이트 LMS · (광고) · 무료수신거부). 2건은 11/09 에 마케팅 수신 동의를 거두셔서 cancelled 로 남김(153OS `consent_records` 마지막 marketing 줄이 agreed=false — 보내기 직전에 늘 다시 본다). **앱 메시지는 보내지 않는다**(대표님 「앱 메시지는 빼기」 — 마이복서153 가입 때 광고 수신 동의를 받지 않아 '(광고)' 단체 메시지는 정보통신망법 50조 소지) → 예약 trig_01Mh1kLVM1nBzGYpUcevX4kD 꺼 둔 채. 앱 안 알림은 홈 카드 · TV 로.
- 남은 일(대표님 확인): 사이즈(업체 확인 전 M · L · XL · 2XL — `update goods_campaigns set sizes = …`) · 마감일 · 개인정보 보관 '사전예약이 끝나고 6개월 뒤 지움'(지우는 예약은 아직 없음 — 2027-05 전에 만든다).

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
