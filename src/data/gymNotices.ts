/**
 * 📢 라이브보드 TV 2번 「체육관 공지사항」 탭 — 공지 글 정본 (2026-11-26 대표님 「우리 런칭이벤트 했던 사이니지 모니터에 체육관 공지사항
 *    탭하나 만들자 · 샤워실 최신형 린나이 대용량보일러 업그레이드를 통해 온수 끊김 문제 해결 · 회원님들이 사용하면 좋을 마이복서 153 기능
 *    공지사항은 총 3개정도만 돌아가게 만들자」 — 시간표 · 고르기는 lib/gymNotices.ts · 그리기는 components/liveBoard/GymNoticeBoard.tsx)
 *
 * 쓰는 법
 *   · 적은 차례대로 돈다(4장이면 15초씩) · 한 지점에 4장까지. 지점은 정식 이름(branches) · 기간은 from / until('YYYY-MM-DD', 둘 다 그날 포함).
 *   · 내리려면 그 칸을 지우거나 until 을 어제로. 고칠 땐 글만(id 는 그대로).
 *   · 회원 말 · 해요체 · 2~4m 거리에서 읽히게 짧게 — 글자 칸 수(TV 폭) · 153 금칙 · 긴 줄표는 시험(gymNotices.test.ts)이 본다.
 *   · 앱 기능 공지의 내용은 그 기능의 앱 업데이트 글(data/appUpdates.ts)과 같은 사실만 — 숫자는 코드 값(성향 검사 36문항 · 챔피언 머니 3,000 ·
 *     타이머 틀 · 마일리지 10%)과 시험이 맞춰 본다. 마일리지는 '원'으로 말하지 않는다. 예시 막대에는 그림에 「예시」가 붙는다.
 *   · 한글 AI 티 지우기(공용 스킬 im-not-ai) 거친 글 — 줄표 · 연결어미 쉼표 · 같은 끝맺음 반복 없이.
 */
import type { GymNotice } from "@/lib/gymNotices";

const SEOLLEUNG = ["153복싱짐 선릉역점"] as const;

export const GYM_NOTICES: readonly GymNotice[] = [
  // ① 체육관 소식 — 샤워실 보일러 (대표님 말: 최신형 · 린나이 · 대용량 · 온수 끊김 해결 — 그 밖의 사양은 쓰지 않는다)
  {
    id: "20261126-shower-boiler",
    branches: SEOLLEUNG,
    tag: "샤워실",
    kicker: "운동 끝나고 샤워할 때",
    hook: ["샤워실 온수,", "이제 끊기지 않아요"],
    answer: "새 보일러로 바꿨어요",
    proofs: ["최신형 린나이 보일러예요", "대용량이라 온수가 넉넉해요", "따뜻한 물로 개운하게 씻고 가세요"],
    ease: "기다려 주셔서 감사해요",
    visual: { kind: "shower", status: "보일러 교체 완료" },
  },
  // ② 나의 153 성향 검사 (2026-11-25 · 내 운동 기록 카드 MemberStyleCard — QR 은 ?style=1 로 카드까지 내려와 검사 창을 연다)
  {
    id: "20261126-app-style",
    branches: SEOLLEUNG,
    tag: "성향 검사",
    kicker: "같은 동작도 사람마다 배우는 법이 달라요",
    hook: ["나에게 맞는 지도법,", "코치님이 알까요?"],
    answer: "「나의 153 성향」 검사로 알려 드려요",
    proofs: ["36문항 · 5분이면 끝나요", "결과는 지도 카드로 코치님께 가요", "처음 하면 챔피언 머니 3,000"],
    ease: "고른 답은 나만 봐요",
    visual: {
      kind: "style",
      title: "나의 153 성향",
      // 이름은 검사의 다섯 가지 성격 이름(supabase/functions/_shared/memberStyle.ts BIG5_NAMES) 그대로 · 값은 예시
      bars: [
        { label: "꾸준함", value: 82 },
        { label: "에너지 · 사교", value: 64 },
        { label: "배려", value: 74 },
      ],
      foot: "16가지 운동 성향 중 하나",
    },
    qr: { path: "/mypage/attendance?style=1", caption: ["성향 검사", "시작하기"] },
  },
  // ③ 복싱 타이머 (2026-11-22 · 훈련 탭 「오늘 할 것」 BoxingTimerEntry · ?timer=1 로 바로 열린다)
  {
    id: "20261126-app-timer",
    branches: SEOLLEUNG,
    tag: "복싱 타이머",
    kicker: "수업 전후로 혼자 운동할 때",
    hook: ["라운드 시간,", "누가 재 줄까요?"],
    answer: "앱 복싱 타이머가 대신 재요",
    proofs: ["라운드 · 쉬는 시간을 큰 공 소리로", "10초 전 「딱딱」으로 미리 알려 줘요", "시간 · 라운드 수도 직접 정해요"],
    ease: "훈련 탭 「오늘 할 것」에서 열어요",
    // 앱의 첫 틀 「자율 운동」(lib/boxingTimer.ts TIMER_PRESETS free) 그대로
    visual: { kind: "timer", preset: "자율 운동", clock: "3:00", round: "1라운드", rounds: 6, sub: "3분 · 쉬기 30초 · 6라운드" },
    qr: { path: "/missions?timer=1", caption: ["복싱 타이머", "열기"] },
  },
  // ④ 수강권 앱 결제 — 시작일 고르기(2026-11-21 · 선릉역점) · 마일리지 10%(lib/cartPricing.ts)
  {
    id: "20261126-app-pass",
    branches: SEOLLEUNG,
    tag: "수강권 결제",
    kicker: "수강권 끝나는 날이 다가오면",
    hook: ["미리 결제하면", "기간이 줄어들까요?"],
    answer: "끝난 다음 날부터 이어져요",
    proofs: ["앱 결제 때 시작일을 직접 정해요", "다음 주부터 다녀도 그날을 고르면 돼요", "마일리지로 수강료 10%까지 할인받아요"],
    ease: "결제 전에 이용 기간을 먼저 보여 줘요",
    visual: { kind: "pass", nowLabel: "지금 수강권", nowSub: "끝나는 날까지", nextLabel: "새 수강권", nextSub: "다음 날부터 이어서" },
    qr: { path: "/membership", caption: ["다음 수강권", "보기"] },
  },
];
