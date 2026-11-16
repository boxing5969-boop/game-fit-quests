/**
 * 📣 앱 업데이트 내역 — 공지사항 「앱 업데이트」 칸에 보이는 글 (정본 · 계산은 lib/appUpdates.ts)
 *
 * 쓰는 법 (CLAUDE.md 「앱 업데이트 내역」 — 두 계정 같은 규칙)
 *   · 회원 화면에 보이는 기능을 main 에 올리면 **맨 위에** 한 칸. 코치진만 보이는 기능은 audience "staff".
 *   · 회원 말로 — 무엇이 좋아졌는지 · 어디서 보는지. 개발 말(함수 · 표 · 단계 번호) · 금액 · 사람 이름(공개 저장소)은 쓰지 않는다.
 *   · 회원님 제안으로 만든 것은 fromMember (화면에 「회원 제안」 — 이름은 쓰지 않는다).
 *   · 시범 지점에서만 연 기능은 branches 에 지점 이름(그 지점 회원에게만 보인다).
 *   · id 는 'YYYYMMDD-짧은-이름' — 한 번 정하면 바꾸지 않는다(본 것 · 빨간 점 기준). 고칠 땐 글만.
 *   · 검사: src/lib/appUpdates.test.ts (모양 · 길이 · 회원 화면에 쓰지 않는 낱말 · 날짜 순서)
 */
import type { AppUpdate } from "@/lib/appUpdates";

const SEOLLEUNG = ["153복싱짐 선릉역점"] as const;
const CAL = { to: "/home?cal={today}", label: "운동 달력 보기" } as const;
const MY_RECORD = { to: "/mypage/attendance", label: "내 운동 기록 보기" } as const;
const PLAN = { to: "/office?tab=plan", label: "일정 탭 열기" } as const;

export const APP_UPDATES: readonly AppUpdate[] = [
  {
    id: "20261116-learn-popular",
    date: "2026-11-16",
    title: "영상으로 배우기 — 「많이 담은」 동작",
    lines: [
      "회원님들이 내 수업에 많이 담은 동작에 「많이 담은」이 붙어요",
      "무엇부터 해 볼지 고를 때 참고해 보세요",
    ],
    link: { to: "/missions?learn=1", label: "영상으로 배우기" },
  },
  {
    id: "20261116-learn-153-videos",
    date: "2026-11-16",
    title: "영상으로 배우기 — 153 레슨 · 153 PB 영상",
    lines: [
      "153 레슨 · 분석 영상이 칸마다 함께 나와요",
      "153 PB 8종목 시범 영상은 체력 칸에 있어요",
      "기본 스탠스 · 원투 등 영상마다 그 동작 설명을 맞췄어요",
    ],
    link: { to: "/missions?learn=1", label: "영상으로 배우기" },
  },
  {
    id: "20261116-learn-videos",
    date: "2026-11-16",
    title: "영상으로 배우기 — 레벨 미션 영상 · 더빙 소리",
    lines: [
      "레벨 1~10 미션 영상이 칸마다(스텝 · 기본기 · 기술 …) 모였어요",
      "잽 · 훅 · 어퍼컷 · 슬립 등 동작 영상이 15편 늘었어요",
      "영상은 더빙 소리와 함께 · 「설명 듣기」는 열면 바로 들려요",
    ],
    link: { to: "/missions?learn=1", label: "영상으로 배우기" },
  },
  {
    id: "20261115-card-react",
    date: "2026-11-15",
    title: "영상으로 배우기 — 동작마다 반응 · 의견",
    lines: [
      "동작 카드마다 ♥ · 쉬워요 · 딱 좋아요 · 어려워요",
      "궁금한 점은 「코치님께 의견」으로 — 코치님 답이 와요",
      "「찾기」로 동작을 찾고 · 영상이 없으면 「영상 찍어 주세요」",
    ],
    link: { to: "/missions?learn=1", label: "영상으로 배우기" },
  },
  {
    id: "20261115-card-opinions",
    date: "2026-11-15",
    title: "코치님 — 카드마다 회원 반응 · 의견",
    lines: [
      "카드 시트 아래에 회원 ♥ · 쉬워요 · 어려워요 숫자",
      "회원님 의견은 「153 콘텐츠 카드」 위 한 줄에서 답해요",
    ],
    link: { to: "/office?tab=strategy&s=video", label: "콘텐츠 카드 열기" },
    audience: "staff",
  },
  {
    id: "20261115-app-updates",
    date: "2026-11-15",
    title: "공지사항에 「앱 업데이트」 칸이 생겼어요",
    lines: [
      "앱이 좋아질 때마다 바뀐 내용을 여기에 올려요",
      "새 소식이 있으면 공지사항에 빨간 점이 떠요",
      "회원님 제안으로 만든 기능에는 「회원 제안」이 붙어요",
    ],
    fromMember: true,
  },
  {
    id: "20261114-weather-stamp",
    date: "2026-11-14",
    title: "운동 달력에 날씨 도장",
    lines: [
      "비 · 눈 · 폭염 · 한파인 날 운동하면 그날 칸에 도장",
      "그날 카드에 「비 오는 날도 왔어요」 한 줄",
      "오늘 · 앞날 카드에는 기상청 예보 한 줄",
    ],
    link: CAL,
  },
  {
    id: "20261114-pt-booking",
    date: "2026-11-14",
    title: "PT 회원님 — 앱에서 PT 예약",
    lines: [
      "담당 코치님이 열어 둔 시간에 앱으로 예약 · 취소해요",
      "PT 수업을 마칠 때마다 마일리지가 쌓여요",
      "PT 회원님 복서카드가 프리미엄 카드로 바뀌었어요",
    ],
    link: { to: "/home", label: "홈에서 보기" },
    branches: SEOLLEUNG,
  },
  {
    id: "20261114-my-class",
    date: "2026-11-14",
    title: "영상으로 배우기에 「내 수업」",
    lines: [
      "마음에 드는 동작 카드를 담아 나만의 수업을 짜요",
      "이어서 재생 · 코치님께 보여드리면 한마디가 와요",
    ],
    link: { to: "/missions?learn=1", label: "영상으로 배우기" },
  },
  {
    id: "20261114-mind-stats",
    date: "2026-11-14",
    title: "내 운동 기록에 「마음 능력치」",
    lines: [
      "자신감 · 힘(활력) · 운동 습관을 4주마다 재요",
      "세계에서 널리 쓰는 검증된 심리 검사 그대로예요",
      "답과 점수는 나만 봐요",
    ],
    link: { to: "/mypage/attendance?mind=1", label: "마음 능력치 보기" },
  },
  {
    id: "20261114-body-gains",
    date: "2026-11-14",
    title: "내 몸이 좋아진 정도 — 숫자 · % · 기준",
    lines: [
      "심폐지구력 · 근력 · 체지방률이 처음보다 얼마나 좋아졌는지",
      "직접 잰 값(실측)과 운동량으로 어림한 값(추정)을 나눠요",
      "줄을 누르면 어떤 연구 · 기준으로 셌는지 나와요",
    ],
    link: MY_RECORD,
  },
  {
    id: "20261114-calendar-mine",
    date: "2026-11-14",
    title: "운동 달력에 내 일정 · 기념일",
    lines: [
      "회식 · 여행 같은 내 일정 — 반복 · 알림 · 색 · 장소",
      "'이날은 쉬어요'를 켜면 그날 약속 알림도 쉬어요",
      "음력 기념일 · 목록 · 한 해 보기 · 찾기 · 스티커 20개",
    ],
    link: CAL,
  },
  {
    id: "20261114-habit-week",
    date: "2026-11-14",
    title: "나만의 체크 「주 n번」 · 할 일",
    lines: [
      "매일이 아니라 '주 3번'처럼 정하고 그 주에 채워요",
      "날짜를 정한 할 일은 그날 카드에서 체크해요",
    ],
    link: CAL,
  },
  {
    id: "20261114-ops-tasks",
    date: "2026-11-14",
    title: "운영본부 일정 — 할 일 · 맡기기",
    lines: ["「일정」 탭 「할 일」 — 마감 · 맡기기 · 답장", "오픈 · 마감 고정 업무 체크 · 이번 주 팀"],
    link: PLAN,
    audience: "staff",
  },
  {
    id: "20261113-calendar-more",
    date: "2026-11-13",
    title: "운동 달력 — 153 일정 · 그날 한 일",
    lines: [
      "체육관 일정 · 휴관일 · 승급 심사가 달력에 보여요",
      "PT · 153 PB · 레벨업 한 날 아이콘 · 코치님 한마디",
      "일요일 주간 돌아보기 · 나의 153 앨범 · 휴대폰 캘린더",
    ],
    link: CAL,
  },
  {
    id: "20261113-peer-compare",
    date: "2026-11-13",
    title: "같은 나이와 비교 — 체력 나이",
    lines: [
      "국민체력100 측정 기록과 견줘 같은 나이 중 어디쯤인지",
      "체지방률 · 악력 상위 % · 심폐 체력 어림 · 체력 나이",
    ],
    link: MY_RECORD,
  },
  {
    id: "20261113-training-tab",
    date: "2026-11-13",
    title: "훈련 탭이 세 칸으로 — 영상으로 배우기",
    lines: [
      "오늘 할 것 · 내 레벨 · 영상으로 배우기를 한 화면에",
      "동작마다 영상 · 설명 듣기 · 이런 실수 조심",
    ],
    link: { to: "/missions?learn=1", label: "훈련 탭 보기" },
  },
  {
    id: "20261113-back-fix",
    date: "2026-11-13",
    title: "고침 — 뒤로 가기 하면 흰 화면이 뜨던 것",
    lines: ["앱 밖 안내 페이지에서 뒤로 가면 흰 화면이 뜨던 것을 고쳤어요"],
  },
  {
    id: "20261113-ops-calendar",
    date: "2026-11-13",
    title: "운영본부 일정 — 구글 캘린더처럼",
    lines: ["일 · 3일 · 주 시간축 · 끌어서 옮기기 · 반복 · 알림", "초대 · 참석 응답 · 시간 찾기 · 휴대폰 캘린더에서 보기"],
    link: PLAN,
    audience: "staff",
  },
  {
    id: "20261113-class-plan",
    date: "2026-11-13",
    title: "전략 회의 — 콘텐츠 카드로 내 수업 짜기",
    lines: ["153 콘텐츠 카드를 골라 수업안을 짜고 피드백을 받아요", "수업 템플릿 「위빙 수업」 · 순서마다 참고 영상"],
    link: { to: "/office?tab=strategy", label: "전략 회의 열기" },
    audience: "staff",
  },
  {
    id: "20261113-manual-book2",
    date: "2026-11-13",
    title: "153 매뉴얼 2권 「153 수업 진행」",
    lines: ["매뉴얼 탭 서재에 2권 — 아홉 장 · 확인 문제 · 서명"],
    link: { to: "/office?tab=manual&book=book2", label: "매뉴얼 열기" },
    audience: "staff",
  },
  {
    id: "20261112-workout-calendar",
    date: "2026-11-12",
    title: "운동 달력이 생겼어요",
    lines: [
      "출석한 날에 도장 — 홈에서 이번 주, 펼치면 한 달",
      "오늘의 체크 · 나만의 체크(잽 100번처럼) · 한 줄 · 스티커",
      "그날 체크를 다 채우면 금색 별",
    ],
    link: CAL,
    fromMember: true,
  },
  {
    id: "20261112-promise",
    date: "2026-11-12",
    title: "운동 약속 — 요일을 정하고 지켜요",
    lines: [
      "운동하러 올 요일을 정하면 달력에 약속한 날이 보여요",
      "약속한 날 아침 알림 한 번 · 다시 오면 복귀 보너스",
    ],
    link: CAL,
    branches: SEOLLEUNG,
  },
  {
    id: "20261112-starter",
    date: "2026-11-12",
    title: "처음 4주 8번 도전 · 출석 축하가 더 일찍",
    lines: ["첫 출석부터 4주 안에 8번 오면 달성 선물", "출석 5 · 10 · 20 · 30번째에도 축하 편지"],
    branches: SEOLLEUNG,
  },
  {
    id: "20261112-handwrap",
    date: "2026-11-12",
    title: "붕대 감기 — 실제 영상으로",
    lines: [
      "실제로 감는 영상을 먼저 보고 12단계로 따라 해요",
      "단계마다 영상 · 그림을 골라 보고 다 감았으면 확인",
    ],
    link: { to: "/handwrap", label: "붕대 감기 보기" },
  },
  {
    id: "20261112-menu-edit",
    date: "2026-11-12",
    title: "전체 메뉴를 내 마음대로",
    lines: ["아이폰 홈 화면처럼 칸을 옮기고 폴더로 묶고 빼요", "자주 여는 화면을 바로가기로 더할 수 있어요"],
    link: { to: "/home", label: "홈에서 보기" },
  },
  {
    id: "20261112-share",
    date: "2026-11-12",
    title: "설정 › 마이복서153 공유하기",
    lines: ["친구에게 앱을 보내는 공유 · 링크 복사 · QR"],
    link: { to: "/settings", label: "설정 열기" },
  },
  {
    id: "20261112-duty",
    date: "2026-11-12",
    title: "근무 — 출근 신고 · PT 자동 기록",
    lines: ["출근 기록이 없으면 앱에서 「와 있었어요」 신고", "PT 수업은 브로제이 차감만 하면 앱이 기록해요"],
    link: { to: "/office?tab=work", label: "근무 탭 열기" },
    audience: "staff",
    branches: SEOLLEUNG,
  },
  {
    id: "20261112-meet-today",
    date: "2026-11-12",
    title: "「오늘 만날 회원」",
    lines: ["오늘 약속한 회원 · 첫 4주 회원 · 오랜만에 온 회원을 한눈에"],
    link: PLAN,
    audience: "staff",
    branches: SEOLLEUNG,
  },
  {
    id: "20261105-comment-reply",
    date: "2026-11-05",
    title: "커뮤니티 댓글에 답글",
    lines: ["댓글마다 「답글 달기」 — 받은 분께 알림이 가요"],
    link: { to: "/myboxer/community", label: "커뮤니티 열기" },
  },
  {
    id: "20261103-my-voice",
    date: "2026-11-03",
    title: "내가 보낸 의견 · 답변을 한곳에서",
    lines: ["만족도 조사 · 고객의 소리에 운영진이 답하면 알려 드려요", "설문 첫 화면 맨 아래 「내가 보낸 의견」"],
    link: { to: "/survey?mine=1", label: "내가 보낸 의견" },
  },
  {
    id: "20261102-branch-channel",
    date: "2026-11-02",
    title: "공지사항 · 우리 지점 · 1:1 문의",
    lines: ["지점 공지 · 코치 소개 · 후기를 앱에서 봐요", "1:1 문의로 이용권 · 수업 · PT 무엇이든 물어봐요"],
    link: { to: "/inquiries", label: "1:1 문의" },
  },
];
