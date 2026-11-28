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
- 레벨업 표현: **「트레이닝 1일차 · 2일차」** — 회원 글(화면 · 앱 업데이트 · 오삼코치 · 마케팅)에 '도장' · '출석하면 레벨업' · 레벨 진행 뜻의 '경험치'(XP 랭킹 점수와 겹침)를 쓰지 않는다 (2026-11-27 대표님 「도장이랑 표현도 너무 유아틱해」 · [문서 70](docs/features/70-레벨업-안내.md)). 운영 화면 · 기술 기록의 '출석'은 그대로.
- 이름 읽기: **153 = '일오삼'** — 정식 명칭은 **'일오삼 복싱짐'** ('백오십삼'·'백오삼' 아님, 2026-10-19 대표님 "꼭 기억해"). 화면 글은 '153' 그대로 쓰고, 소리로 내보내는 글(휴대폰 음성 TTS · 녹음/내레이션 대본)은 `toSpokenKo()`([src/lib/spokenKo.ts](src/lib/spokenKo.ts))를 거치거나 처음부터 '일오삼'으로 쓴다. 휴대폰 음성은 그냥 두면 '백오십삼'이라 읽는다.

---

## 문서 규칙 — CLAUDE.md 는 짧게 (2026-11-23 대표님 「이거 모든 작업에 적용하자」 · 앱 규칙 r_7ae26675e2 · 공용 스킬 boris-masterclass)

- CLAUDE.md 는 세션마다 처음에 통째로 읽힌다 → **절대 규칙 · 두 계정 협업 · 명령 · 주의 · 기능 목록 한 줄**만 둔다. **3만 자를 넘기지 않는다**(클로드 코드 권장 4만 자 미만).
- 기능 설명(화면 · DB · 함수 · 결정 · 날짜 기록)은 `docs/features/<번호>-<이름>.md` 에 쓴다. 있는 기능이면 그 파일에 덧붙이고, 새 기능이면 새 파일을 만들고 아래 「기능 문서 목록」에 한 줄(`- [번호 이름](docs/features/…) — 핵심 파일`)만 더한다.
- 일하기 전에 「기능 문서 목록」에서 관련 문서를 찾아 **그 파일만** 읽는다.
- 2026-11-23 이전 「핵심 경로」 칸들은 글자 그대로 `docs/features/` 로 옮겼다(지운 것 없음 · 상대 링크만 `../../` 붙임). 옛 긴 판은 git 기록에 있다(`git log -- CLAUDE.md`).
- rebase 중 CLAUDE.md 가 충돌하면: 내 쪽에서 「핵심 경로」에 새로 쓴 칸은 `docs/features/` 새 파일로 옮기고 목록에 한 줄 — 옛 긴 판으로 되돌리지 않는다. 같은 정리는 `python3 scripts/split-claudemd.py --mode gfq --repo .` 로 다시 돌릴 수 있다.

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
  - **회원 화면에 보이는 기능을 main 에 올리면 `src/data/appUpdates.ts` 맨 위에 한 칸**(공지사항 「앱 업데이트」 — 아래 「앱 업데이트 내역」 · 2026-11-15 회원 제안). 코치진만 보이는 기능은 `audience: "staff"` · 시범 지점만이면 `branches`.
- **git**: 작게 커밋하고 끝나면 바로 푸시. 푸시 직전 `git fetch && git rebase origin/main` → **`bun run build` 한 번 더**(다른 계정 변경과 합친 상태가 빌드되는지 + 마이그레이션 번호 겹침 검사 `scripts/check-migrations.mjs` — 클로드 세션에서는 겹치면 빌드가 멈춘다) → push. force push 금지 · 다른 계정 커밋 되돌리기 금지 · 충돌은 두 쪽을 다 살려서 푼다(판단이 안 서면 대표님께).
- **DB**: `create or replace function` 전에 저장소 파일이 아니라 **DB 의 지금 정의**(`select pg_get_functiondef('public.<함수>'::regproc)`)를 읽고 그 위에 고친다 — 그사이 다른 계정이 바꾼 것을 덮지 않게.
  **저장소(storage.objects) 정책에는 authenticated 가 실행할 수 있는 함수만** 쓴다 — `has_role` · `_strategy_staff` 는 되고 `_strategy_hq` 같은 안쪽 함수는 안 된다. 정책 하나가 실행 권한 없는 함수를 부르면 저장소가 달라도 모든 올리기가 'permission denied for function …' 로 막힌다(넣기 정책은 저장소마다 나뉘지 않고 모두 검사된다 · 2026-11-13 카드 영상 저장소). 새 저장소 정책을 만들면 되돌림 시험에 **다른 저장소 올리기**를 꼭 넣는다.
  마이그레이션 파일 번호는 **지금 시각(KST, 초까지)** 으로 짓는다 — `…200000` 같은 둥근 번호 금지. 만들기 전 `ls supabase/migrations | grep <번호>` 로 겹침 확인.
- **Edge Function**: 최신 main 을 받은 뒤의 파일로만 배포하고, 배포한 코드는 바로 커밋한다. **배포 전에 지금 배포본(Supabase MCP `get_edge_function`)과 저장소 파일을 비교** — 배포본에만 있는 수정이 있으면 먼저 저장소 파일에 살린 뒤 배포한다(그냥 배포하면 그 수정이 사라진다).
  - 2026-10-20 점검(배포 시각 vs 마지막 커밋): 배포가 마지막 커밋보다 늦음(배포본에만 있는 수정이 있을 수 있음) — `coach-build` · 보호 영역 `payssam-inspect` · `qr-token-refresh` / 저장소에 폴더 없음 — `admin-migrate-legacy-assets` · `boxing-library` · `face-kiosk` · `gagyebu-ai`. 이 함수들은 고치기 전에 배포본부터 받는다. (`face-kiosk` 는 2026-11-25 저장소로 옮김 — 배포본 v5 + 153OS 지점 키 인정 = v6 → 출석 · 퇴장 버튼판 v7 → 출석 뒤 자동 승급 검사 v8 · 63번 문서)
  - 같은 날 맞춤: `auto-sync-members` · `bulk-import-members` 는 배포본을 저장소에 그대로 옮김(배포본 = 저장소, PC 에 남아 있던 사본과도 코드가 같음 확인) · `push-send` 는 10-19 아이폰(APNs) 판을 배포(웹 푸시 부분은 그대로).
  - 2026-11-20 배포(한글 AI 티 지우기 `koStyle.ts`): `chat-assistant` v30 · `coach-mind` v3 · `office-summary` v3 · `coach-build` v8 = main 9a368dd. 배포 전에 받은 배포본은 저장소와 같았다(`coach-build` 는 `_shared/claude.ts` 옛 판만 · `office-summary` summary.ts 는 정규식 글자 표기만 다름) — `coach-build` 는 이제 배포본 = 저장소. PC CLI 는 `node_modules\supabase\bin\supabase.exe` 를 바로 부른다 — `npx supabase` 는 `.bin\supabase.exe`(bun 껍데기 → 없는 `dist/supabase.js`)로 가서 멈춘다. `functions download` 는 `_shared` 를 함께 덮어쓰니 함수마다 다른 `--workdir` 로 받는다.
  - 2026-11-27 `chat-assistant` v33 = main fd40de8d **커밋 고정 배포** — 배포본 index.ts 는 한 줄로 `https://raw.githubusercontent.com/boxing5969-boop/game-fit-quests/<커밋>/supabase/functions/chat-assistant/index.ts` 를 가져온다(배포 때 묶임 · 배포본 = 그 커밋). 배포본 비교 = 그 커밋이 main 에 있는지 + `git diff <커밋> origin/main -- supabase/functions/chat-assistant supabase/functions/_shared`. 저장소가 공개라 MCP 로 이 한 줄만 올려도 된다(파일 15만 자를 다시 보내지 않음 · main 에 푸시한 커밋으로만). PC CLI · MCP 전체 파일 배포도 그대로 된다.
- **GitHub 자동 검사** (`.github/workflows/ci.yml` 「앱 자동 검사」): 어느 브랜치든 올리면 마이그레이션 번호 겹침 → 타입 검사 → 테스트 → 빌드. 빨간불이면 GitHub 이 메일로 알린다(배포는 막지 않음). 다음 작업 전에 먼저 고친다 — 다른 계정 커밋이 원인이어도 되돌리지 말고 고쳐서 올린다.
- **DB 어긋남 점검** (`node scripts/check-db-drift.mjs` · GitHub 「DB 어긋남 점검」 매일 07:40 KST + 마이그레이션이 main 에 올라올 때): 운영 DB 함수 본문 지문(`public.repo_drift_fingerprints()`)과 저장소 정의를 비교한다. 기준선(`scripts/db-drift-baseline.json`)에 없는 **새** 어긋남이면 빨간불 — DB 함수를 고친 세션은 푸시 전에 한 번 돌린다. 어긋남을 고쳤으면 `--write-baseline` 으로 기준선을 다시 저장해 같은 커밋에 넣는다. (DO 블록 replace 덧대기는 '덧대기'로 알리기만 한다 — 그런 함수는 저장소 전체 본문이 옛것이니 고칠 때 DB 지금 정의 위에.) 공개 앱 키는 운영 사이트 첫 묶음부터 조각을 따라가며 찾는다(2026-11-21 — TV 가볍게로 첫 묶음이 키 없는 껍데기가 돼 「공개 앱 키를 못 찾음」 빨간불이 났던 것 고침) · 클라우드 작업 공간에서 돌릴 땐 `NODE_USE_ENV_PROXY=1 node scripts/check-db-drift.mjs`(Node fetch 가 프록시를 안 읽는다).
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
| [supabase/functions/_shared/koStyle.ts](supabase/functions/_shared/koStyle.ts) | 한글 AI 티 지우기(im-not-ai 우리 판 · 2026-11-20 대표님 「이거적용하자 … 마이복서 153에도」) — `KO_STYLE` 지시문 덩어리(번역투 · AI 관용구 · 대구 · 연결어미 쉼표 · 줄표 · 같은 끝맺음 — 형식 규칙이 먼저)를 AI 가 글을 쓰는 지시문 모두에 붙였다(채팅 SYSTEM_PROMPT · 지시 다듬기 · 관찰 다듬기 · 코치 성향 카드 셋 · 먼저 말 걸기 COACH_SYSTEM · 회의 요약). `cleanKo()` = 보이지 않는 문자(제로폭 · BOM · 방향 제어 · 태그) 청소 — claude.ts 가 스트림 · `messageText` 에 쓴다(U+200D · U+FE0F 는 둠). **새 AI 경로 · 새 지시문을 만들면 `KO_STYLE` 을 붙인다.** 기준은 153 공용 스킬 im-not-ai(153OS `mkt_skills`)와 같다. 시험 src/lib/koStyle.test.ts |

messages 조립 순서 (Groq 예비): boxing SYSTEM_PROMPT + 개인컨텍스트 → SYSTEM_PROMPT_153 → KNOWLEDGE_153 → dietContext(있으면) → 클라이언트 messages.
Claude(0순위)는 프롬프트 캐시 때문에 바뀌지 않는 글을 앞에: SYSTEM_PROMPT[캐시] → [앱 기능 지도][캐시] → 지식 문서(다이어트·복싱, 마지막에 캐시) → 개인컨텍스트 → [앱 안내] → 범위 밖 안내 → dietContext → 클라이언트 messages. 5분 캐시, 적중은 `ai_usage_log.cache_read_tokens`.

### 기능 문서 목록 (docs/features/ — 일하기 전에 관련 문서 하나만 열기)

- [01 오삼코치 먼저 말 걸기](docs/features/01-오삼코치-먼저-말-걸기.md) — `src/components/dm/CoachSentList.tsx`
- [02 전략 회의](docs/features/02-전략-회의.md) — `src/services/strategyService.ts`
- [03 153 기준 — 코치 기준 다섯 가지 · 4주 성장 · 수업…](docs/features/03-153-기준.md) — `src/lib/coachGrowth.ts`
- [04 지점 회의실(2026-10-29 부터 이름 153운영본부) …](docs/features/04-지점-회의실.md) — `src/services/officeService.ts`
- [05 153운영본부 — 「근무」 탭 1단계](docs/features/05-153운영본부.md) — `src/lib/opsWork.ts`
- [06 회원 화면 리디자인 — 글씨 6단계 · 화면 규칙 7가지](docs/features/06-회원-화면-리디자인.md) — `src/lib/textScale.ts`
- [07 회원 감정 설계 기준](docs/features/07-회원-감정-설계-기준.md)
- [08 랭킹 설명 단추 · 내 순위](docs/features/08-랭킹-설명-단추-내-순위.md) — `src/lib/rankingHelp.ts`
- [09 이모지 → 153 입체 아이콘](docs/features/09-이모지-153-입체-아이콘.md) — `src/lib/emoji3d/map.ts`
- [10 동료에게 응원 보내기](docs/features/10-동료에게-응원-보내기.md) — `src/components/engagement/SecondCheerSheet.tsx`
- [11 커뮤니티 글 공개 범위 · 운영진 보기 권한](docs/features/11-커뮤니티-글-공개-범위-운영진-보기-권한.md) — `src/components/engagement/ChampionJournalSheet.tsx`
- [12 커뮤니티 1단계 — 홈 띠 · 153/댓글 알림 · 받은 1…](docs/features/12-커뮤니티-1단계.md) — `src/components/home/CommunityTodayStrip.tsx`
- [13 운동 모집 '오늘 같이 해요' 1 · 2단계](docs/features/13-운동-모집-오늘-같이-해요-1-2단계.md) — `src/components/engagement/PartnerCallSheet.tsx`
- [14 153마인드셋 — 시각화 훈련](docs/features/14-153마인드셋.md) — `src/pages/MyBoxerVisualizationPage.tsx`
- [15 라이브보드(TV) 회원 정보 잠그기](docs/features/15-라이브보드.md) — `src/lib/boardKey.ts`
- [16 153 PB 라이브보드 — TV pb1 「코스 보드」 · p…](docs/features/16-153-PB-라이브보드.md) — `src/pages/LiveBoardPb153Page.tsx`
- [17 라이브보드 TV 화면 바꾸기](docs/features/17-라이브보드-TV-화면-바꾸기.md) — `src/pages/LiveBoardPickerPage.tsx`
- [18 라이브보드 TV 2번 「수상자 축하」](docs/features/18-라이브보드-TV-2번-수상자-축하.md) — `src/lib/launchAwards.ts`
- [19 라이브보드 TV 2번 「마이복서153 가치 전달」 — 1분마…](docs/features/19-라이브보드-TV-2번-마이복서153-가치-전달.md) — `src/lib/appValueReel.ts`
- [20 리뷰 미션(네이버 · 구글 · 당근) · 프로필 카드 꾸미기…](docs/features/20-리뷰-미션.md) — `src/components/cardDeco/HomeCardDecoRow.tsx`
- [21 수강권 화면 — PT 남은 횟수 · 락카 번호](docs/features/21-수강권-화면.md) — `src/lib/gymTicketInfo.ts`
- [22 153 마일리지 지급 — 전체관리자](docs/features/22-153-마일리지-지급.md) — `src/lib/mileageGrant.ts`
- [23 앱 결제 장바구니 · 락카/운동복 남은 기간](docs/features/23-앱-결제-장바구니-락카-운동복-남은-기간.md) — `src/lib/cartPricing.ts`
- [24 칠금점 회원 = 다짐매니저에서 매일](docs/features/24-칠금점-회원-다짐매니저에서-매일.md)
- [25 전체관리자 '등록' 칸 — 전 지점 수강권 등록](docs/features/25-전체관리자-등록-칸.md) — `src/components/RegistrationReportPanel.tsx`
- [26 153OS 앱 통로 — 공지사항 · 우리 지점(소개 · 코치…](docs/features/26-153OS-앱-통로.md) — `src/lib/osPushPull.test.ts`
- [27 앱 업데이트 내역 — 공지사항 「앱 업데이트」 칸](docs/features/27-앱-업데이트-내역.md) — `src/data/appUpdates.ts`
- [28 아이폰 앱](docs/features/28-아이폰-앱.md) — `src/lib/iosApp.ts`
- [29 153 체력 프로필 — 1단계 '내 체력 보기'](docs/features/29-153-체력-프로필.md) — `src/lib/test153Profile.ts`
- [30 같은 나이와 비교 — 체지방률 · 악력 상위 %](docs/features/30-같은-나이와-비교.md) — `src/data/nfaNorms.ts`
- [31 마음 능력치 — 자신감 · 힘(활력) · 운동 습관](docs/features/31-마음-능력치.md) — `src/data/mindScales.ts`
- [32 내 몸이 좋아진 정도 — 몇 % · 숫자로 몇 · 얼마나 ·…](docs/features/32-내-몸이-좋아진-정도.md) — `src/lib/bodyGains153.ts`
- [33 붕대 감기 — 실제 영상 + 12단계 설명서](docs/features/33-붕대-감기.md) — `src/pages/HandWrapGuidePage.tsx`
- [34 만족도 조사 답변](docs/features/34-만족도-조사-답변.md) — `src/lib/memberVoiceReceipt.test.ts`
- [35 오류 신고 댓글 · 내 신고](docs/features/35-오류-신고-댓글-내-신고.md) — `supabase/migrations/20261119110848_app_feedback_comments.sql`
- [36 타이틀미션 「왜 미트를 잡아 줄까」 탭 · 레벨 10 3일 …](docs/features/36-타이틀미션-왜-미트를-잡아-줄까-탭-레벨-10-3일-이야기.md) — `src/lib/titleTeachLessons.ts`
- [37 영상 올리기 — 50MB 넘으면 휴대폰에서 자동으로 줄이기](docs/features/37-영상-올리기.md) — `src/lib/videoCompress.ts`
- [38 타이틀매치 영상 보관 한 달](docs/features/38-타이틀매치-영상-보관-한-달.md) — `supabase/functions/title-video-cleanup/index.ts`
- [39 타이틀매치 심사 영상 2개 — 치는 영상 · 받는 영상](docs/features/39-타이틀매치-심사-영상-2개.md) — `src/lib/titleMatchChallenge.ts`
- [40 패스트 트랙 직행권 · 다음 리그 시작 레벨](docs/features/40-패스트-트랙-직행권-다음-리그-시작-레벨.md) — `supabase/migrations/20260917121306_fast_track_gates.sql`
- [41 로드맵 칸](docs/features/41-로드맵-칸.md) — `src/lib/appMenu.ts`
- [42 전체 메뉴 편집 · 내 바로가기](docs/features/42-전체-메뉴-편집-내-바로가기.md) — `src/lib/menuLayout.ts`
- [43 뒤로가기 흰 화면 막기 — 앱 밖 페이지에서 돌아올 때](docs/features/43-뒤로가기-흰-화면-막기.md) — `src/lib/docCache.ts`
- [44 창(모달·시트) 뒤 페이지 스크롤 잠금](docs/features/44-창.md) — `src/lib/scrollLock.ts`
- [45 뒤로가기 = 창 닫기](docs/features/45-뒤로가기-창-닫기.md) — `src/lib/backClose.ts`
- [46 새 화면은 맨 위부터](docs/features/46-새-화면은-맨-위부터.md) — `src/components/NewScreenScrollTop.tsx`
- [47 알림을 보고 뒤로가기 = 다시 알림함](docs/features/47-알림을-보고-뒤로가기-다시-알림함.md) — `src/lib/inboxReturn.ts`
- [48 아이폰(사파리 · 웹킷)에서만 어긋나는 그림](docs/features/48-아이폰.md)
- [49 홈 「다음 레벨까지」 — 몇 번 더 오면 되는지 · 이번 레…](docs/features/49-홈-다음-레벨까지.md) — `src/components/LevelUpRequestCard.tsx`
- [50 홈 「다음 레벨까지」 → 레벨 퀘스트 — 리그 막대 · 수업…](docs/features/50-홈-다음-레벨까지-레벨-퀘스트.md) — `src/lib/levelQuest.ts`
- [51 홈 「오늘의 1분 성장」 — 날마다 새 글](docs/features/51-홈-오늘의-1분-성장.md) — `src/components/home/GrowthLessonCard.tsx`
- [52 운동 시간 고치기 — 운동 종료를 깜빡한 날](docs/features/52-운동-시간-고치기.md) — `src/lib/workoutFix.ts`
- [53 홈 당겨서 새로고침](docs/features/53-홈-당겨서-새로고침.md) — `src/components/home/HomePullToRefresh.tsx`
- [54 운동 달력 1단계 — 홈 첫 화면 · 내 운동 기록](docs/features/54-운동-달력-1단계.md) — `src/lib/attendanceCalendar.ts`
- [55 캘린더 3단계 — 네이버 · 구글 캘린더 기능을 운영본부 일…](docs/features/55-캘린더-3단계.md) — `src/lib/calendarFeed.ts`
- [56 153 운동 약속 1단계 · 코치 「오늘 만날 회원」](docs/features/56-153-운동-약속-1단계-코치-오늘-만날-회원.md) — `src/lib/promise153.ts`
- [57 동기부여 1단계 — 첫 4주 8번 · 이른 출석 축하 · 코…](docs/features/57-동기부여-1단계.md) — `src/lib/motivation153.ts`
- [58 153플레이 「음악」 탭 — 체육관 자동재생](docs/features/58-153플레이-음악-탭.md) — `src/data/gymMusic.ts`
- [59 153 굿즈 사전예약 — 플리스 집업](docs/features/59-153-굿즈-사전예약.md) — `src/lib/goodsPreorder.ts`
- [60 153 마켓 1단계 — 회원 용품 주문: 앱 주문 → 데스크…](docs/features/60-153-마켓-1단계.md) — `src/lib/market153.ts`
- [61 Claude API 크레딧](docs/features/61-Claude-API-크레딧.md)
- [62 보호자 계정 · 우리 아이 · 운동을 끝낼까요?](docs/features/62-보호자-계정.md) — `src/lib/guardian.ts`
- [63 얼굴 출석 키오스크 — 출석 · 퇴장 버튼 · 10초 자동 출석](docs/features/63-얼굴-출석-키오스크.md) — `src/pages/FaceKioskPage.tsx`
- [64 스파링 영상 — 1차 유튜브 · 2차 자체 저장 대비](docs/features/64-스파링-영상.md) — `src/components/sparring/SparringRecorderPanel.tsx`
- [65 알림을 누르면 바로 그 화면 — PT 확인 필요 · 출근 그날 · 새 회원](docs/features/65-알림-바로-그-화면.md) — `src/lib/opsLink.ts`
- [66 지도자 홈 — 코치 · 관장 · 관리자 홈 맨 위 · 신규 재등록률 · 기간 임박 · 재미 위험 신규 · 코치용 사진](docs/features/66-지도자-홈.md) — `src/components/leader/LeaderHome.tsx`
- [67 라이브보드 TV 2번 「체육관 공지사항」 탭 — 마이복서153 ↔ 공지 1분씩](docs/features/67-라이브보드-TV-2번-체육관-공지사항.md) — `src/data/gymNotices.ts`
- [68 코치 매일 리포트 · 오늘 미션 — 06:40 알림 · 내 시간 숫자 · 미션 3개 (12/1부터 · 그 전 관리자 미리보기)](docs/features/68-코치-매일-리포트.md) — `src/lib/coachDaily.ts`
- [69 관장님 앱 — 관장님 홈 숫자 네 칸(재등록률 · 출석률 · 유효 회원 · 매출) · 153OS CRM 탭(할 일 · 회원 · 고객 · 회원 카드 · Edge os-crm) · AI 관장 모드 · 결정 8가지](docs/features/69-관장님-앱.md) — `src/lib/ownerKpi.ts` · `src/lib/crm153.ts`
- [70 레벨업 안내 — 새 튜토리얼 5장 · 트레이닝 1일차 · 2일차 · 계정에 한 번 · 옛 오삼 5단계 · 7일 캠프 끔](docs/features/70-레벨업-안내.md) — `src/lib/levelGuide.ts`
- [72 닉네임(앱 카드 · 체육관 TV 이름) 바꾸기 — 내정보 이름 ✏️ · 계정 · 정보 줄 · /mypage?nick=1 · 서버 규칙(12자 · 욕설 · 운영진처럼 보이는 말)](docs/features/72-닉네임-바꾸기.md) — `src/lib/nicknameRules.ts`
- [73 사업자 가계부 — 사업자마다 통장 · 카드 내역 · 비용(지출 − 돌려받음) · 급여는 일한 달 · 자동 분류 · 통장 엑셀 올리기(같은 거래 한 번) · 순이익 연결(운영본부 비용을 가계부가 채움) · 대표님 · 회계매니저만](docs/features/73-사업자-가계부.md) — `src/lib/bizLedger.ts` · `src/components/ops/biz/`

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
