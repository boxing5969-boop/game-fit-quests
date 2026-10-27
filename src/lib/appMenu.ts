// 🗂 마이복서153 전체 메뉴 — 한 곳에서 정의한다 (2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게).
//
// 홈 첫 화면의 메뉴 그리드(HomeMenuGrid)와 하단 '전체' 탭 시트가 같은 목록·같은 버튼을 쓴다.
// 메뉴를 더하거나 빼면 여기만 고치면 두 곳이 같이 바뀐다.
// 2026-10-18 대표님: "연관성 있는 메뉴는 하나에 붙여줘" → 묶음(folder) 칸 6개 + 단독 칸 (21칸 → 10~11칸).
// 하단 탭에 이미 있는 홈·훈련·랭킹은 넣지 않는다 (전체메뉴 중복 제거 — 기존 규칙 유지).
// 2026-10-18 대표님: "전체 메뉴에서 수강권 결제·양도·환불·홀딩 메뉴 하나로" → '수강권' 칸 (/membership 한 화면에 다 있다).
// 2026-09-29 대표님: 로그인하면 전체 메뉴만 — 예전 홈 화면(라이센스 카드·오늘의 할 일·순위)은 1번 메뉴 'MY복서'(/myboxer) 안으로.
//
// glyph = 153 글리프 이름 (components/icons/menuGlyphs.ts) — 이모지 대신 우리 스타일로 직접 그린 아이콘.
import type { MenuGlyphName } from "@/components/icons/menuGlyphs";

export interface AppMenuItem {
  path: string;
  label: string;
  glyph: MenuGlyphName;
  /** 이 조건이 켜진 사람에게만 보인다 — diet: 다이어트 프로그램 회원 · staff: 코치님·지점장·운영진 ·
   *  office: 지점 회의실이 켜진 지점의 지도진 · 대표님 (서버 office_me) */
  requires?: "diet" | "staff" | "office";
}

/**
 * 묶음 — 연관 메뉴를 한 칸에 모은다 (2026-10-18 대표님: "전체 메뉴 정리 — 연관성 있는 메뉴는 하나에 붙여줘").
 * 누르면 그 줄 아래에 안의 메뉴가 펼쳐진다 (HomeMenuGrid). 남은 메뉴가 하나뿐이면 묶음 없이 그 메뉴로 바로 간다.
 */
export interface AppMenuFolder {
  folder: string;
  label: string;
  items: readonly AppMenuItem[];
}

export type AppMenuEntry = AppMenuItem | AppMenuFolder;

export const isMenuFolder = (e: AppMenuEntry): e is AppMenuFolder => "items" in e;

export const APP_MENU: readonly AppMenuEntry[] = [
  // MY복서 — 예전 홈 화면(내 라이센스·오늘의 할 일·순위). 1번 자리 고정.
  { path: "/myboxer", label: "MY복서", glyph: "myboxer" },
  // 전략 회의실 — 코치님·지점장·운영진만 (2026-10-19 대표님: "전략회의실 코치님들에게는 메뉴에 보이게 해줘 회원님들에게는 안보이고").
  //   메시지 화면의 '전략' 칸으로 바로 간다. 회원에게는 칸 자체가 없다 (서버도 strategy_* 를 코치진만 받는다).
  { path: "/messages?tab=strategy", label: "전략 회의실", glyph: "clipboard", requires: "staff" },
  // 지점 회의실 — 지도진 가상 사무실 · 회의 채팅 (2026-10-27 보고서 '입구': 전략 회의실 옆 같은 칸). 지금은 선릉역점만.
  { path: "/office", label: "지점 회의실", glyph: "chat", requires: "office" },
  // 영상 미션 — 153플레이(레벨 미션 영상, 월드 탭은 관리자만) + 타이틀매치(레벨 10·20·30·40 심사 동작 영상, 2026-10-01)
  {
    folder: "videos",
    label: "영상 미션",
    items: [
      { path: "/library", label: "153플레이", glyph: "play" },
      { path: "/title-match", label: "타이틀매치", glyph: "titlematch" },
    ],
  },
  // 훈련 도구 — 복싱 트레이닝 · 붕대 감기(영상·집 연습 미션, 칸 그림 = 붕대 감은 주먹) · 훈련 라이브러리 · 수업 루틴
  {
    folder: "training",
    label: "훈련 도구",
    items: [
      { path: "/minigame", label: "복싱 트레이닝", glyph: "glove" },
      { path: "/handwrap", label: "붕대 감기", glyph: "handwrap" },
      { path: "/training-library", label: "훈련 라이브러리", glyph: "books" },
      { path: "/routines", label: "수업 루틴", glyph: "clipboard" },
    ],
  },
  // 153 챌린지 — 킹 보드(왕좌). 라우트는 /myboxer/quest 유지 (DB anchor 호환).
  { path: "/myboxer/quest", label: "153 챌린지", glyph: "crown" },
  // 커뮤니티 — 153 커뮤니티 + 메시지(DM, 같은 지점 회원·코치님과 1:1). 안 읽은 메시지 수가 칸 오른쪽 위에 뜬다.
  {
    folder: "community",
    label: "커뮤니티",
    items: [
      { path: "/myboxer/community", label: "153 커뮤니티", glyph: "chat" },
      { path: "/messages", label: "메시지", glyph: "dm" },
    ],
  },
  { path: "/myboxer/visualization", label: "153마인드셋", glyph: "mind" },
  // 수강권 — 결제 · 양도 · 환불 · 홀딩을 한 칸에서 (2026-10-18). 하단 탭에서 빠진 뒤 내정보 안에만 있던 것을 다시 메뉴로.
  { path: "/membership", label: "수강권", glyph: "membership" },
  // 153다이어트 — profiles.diet_program_enabled 가 켜진 회원만.
  { path: "/diet", label: "153다이어트", glyph: "bowl", requires: "diet" },
  // 153 안내 — 가이드 · 153이란? · 단증혜택
  {
    folder: "about",
    label: "153 안내",
    items: [
      { path: "/guide", label: "가이드", glyph: "compass" },
      { path: "/about/153", label: "153이란?", glyph: "fish" },
      { path: "/cert-benefits", label: "단증혜택", glyph: "medal" },
    ],
  },
  // 의견·신고 — 설문·고객의 소리(경영리포트 만족도 조사·소리함, 참여 보상) + 앱 오류 신고(대표님에게 바로)
  {
    folder: "voice",
    label: "의견·신고",
    items: [
      { path: "/survey", label: "설문·소리함", glyph: "survey" },
      { path: "/feedback", label: "오류 신고", glyph: "bell" },
    ],
  },
  // 내 정보 — 내정보 · 캐릭터 · 설정
  {
    folder: "me",
    label: "내 정보",
    items: [
      { path: "/mypage", label: "내정보", glyph: "idcard" },
      { path: "/character-studio", label: "캐릭터", glyph: "avatar" },
      { path: "/settings", label: "설정", glyph: "gear" },
    ],
  },
];

/** 회원에게 보일 메뉴 — 조건에 안 맞는 메뉴를 빼고, 하나만 남은 묶음은 그 메뉴로 펼친다 */
export const buildAppMenu = (opts: {
  diet: boolean;
  staff?: boolean;
  office?: boolean;
  hide?: (path: string) => boolean;
}): AppMenuEntry[] => {
  const visible = (m: AppMenuItem) =>
    (m.requires !== "diet" || opts.diet) &&
    (m.requires !== "staff" || opts.staff === true) &&
    (m.requires !== "office" || opts.office === true) &&
    !opts.hide?.(m.path);
  const out: AppMenuEntry[] = [];
  for (const e of APP_MENU) {
    if (!isMenuFolder(e)) {
      if (visible(e)) out.push(e);
      continue;
    }
    const items = e.items.filter(visible);
    if (items.length === 1) out.push(items[0]);
    else if (items.length > 1) out.push({ ...e, items });
  }
  return out;
};

/** 펼친 목록 — 묶음 안의 메뉴까지 한 줄로 (검색·테스트용) */
export const flatAppMenu = (opts: { diet: boolean; staff?: boolean; office?: boolean }): AppMenuItem[] =>
  buildAppMenu(opts).flatMap((e) => (isMenuFolder(e) ? [...e.items] : [e]));
