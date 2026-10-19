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

### 아이폰 앱 (App Store, 2026-10-19 대표님 "애플스토어에도 등록하자")

- 아이폰 앱은 `ios-app/` (Capacitor 8 iOS, 번들 `kr.boxing153.myboxer`, 아이폰 전용, iOS 16+). **myboxer153.com 을 그대로 담는다** — 웹을 고치면 앱도 바로 바뀐다(재심사 없음). 안드로이드는 TWA(구글 플레이)라 별개, 루트 `capacitor.config.ts` 는 얼굴 출석 키오스크 APK.
- 앱 판별: `isIosApp()`([src/lib/iosApp.ts](src/lib/iosApp.ts)) — UA 끝 `MyBoxer153App` + Capacitor. 앱 기능은 [src/lib/iosAppNative.ts](src/lib/iosAppNative.ts)(따로 내려받는 조각). **Capacitor 면 얼굴 키오스크로 보내는 main.tsx 분기에서 아이폰 앱은 빠져야 한다.**
- 로그인: 구글·카카오는 앱 안 웹 화면에서 막히므로 `signInWithOAuthInApp` → 안전한 로그인 창 → `/app-auth-return/` → `myboxer153://auth` → '/?code|#token'. 애플 로그인(`signInWithAppleInApp`, 심사 4.8)은 아이폰 앱에서만 보인다 — Supabase Apple 공급자 Client IDs 에 번들 ID 필요.
- 결제선생 결제는 앱 안 사파리 창(`openInAppBrowser`) — 실물 수업권이라 앱 안 구입(IAP) 대상 아님(3.1.3(e)). **디지털 상품(머니·캐릭터)을 돈으로 팔면 안 된다.**
- 휴대폰 알림: `push_subscriptions.kind='apns'`, 주소 `apns:<토큰>`, `push_subscribe_native` (20261019200500). 발송 push-send/apns.ts, 키 `internal_sync_config.apns_key` {keyId, teamId, p8, bundleId}.
- 심사 대응: AI 로 보내기 전 동의 `ensureAiConsent`([src/lib/aiConsent.ts](src/lib/aiConsent.ts), 5.1.2(i), 아이폰 앱에서만) · 앱 안 계정 삭제(설정 › 계정 삭제 → Edge Function `account-delete-request`: 기록 → 알림 끄기 → 전체관리자 알림 → 로그인 잠금, 7일 안에 회원 화면 '계정 삭제'로 마무리, 5.1.1(v)) · 고객지원 `/support/`.
- 빌드: `.github/workflows/ios.yml` — ios-app/ 이 바뀌면 GitHub 맥 서버에서 빌드. 비밀값 `ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_PRIVATE_KEY` 가 있으면 서명 → TestFlight 업로드(빌드 번호 = 실행 번호). 공개 저장소라 로그에 비밀값을 찍지 않는다.
- 스토어 글·심사 메모·개인정보 항목: [ios-app/store/listing-ko.md](ios-app/store/listing-ko.md).

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

1. **파일 탐색** — Grep 으로 기존 호출부/타입 확인. 새 파일을 만들기 전에 비슷한 게 이미 있는지 훑는다.
2. **최소 편집** — Edit 도구로 필요한 영역만. 전체 재작성은 `Read` 먼저.
3. **타입체크** — `npx tsc --noEmit` (없으면 빌드에서 터짐).
4. **빌드 확인** — `bun run build`. "✓ built in …" 나오면 OK.
5. **커밋/푸시** — 메시지에 "변경 이유 + 영향 파일" 요약. 민감 파일 (.env, .dev.vars, .wrangler/) 스테이징 금지.
6. **배포 확인** — Cloudflare Pages 빌드 완료 기다림. 마이그레이션·Edge Function 변경은 Lovable 또는 SQL Editor 수동 실행 필요.

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
