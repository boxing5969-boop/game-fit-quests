// 🗂 마이복서153 전체 메뉴 — 한 곳에서 정의한다 (2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게).
//
// 홈 첫 화면의 메뉴 그리드(HomeMenuGrid)와 하단 '전체' 탭 시트가 같은 목록·같은 버튼을 쓴다.
// 메뉴를 더하거나 빼면 여기만 고치면 두 곳이 같이 바뀐다.
// 하단 탭에 이미 있는 홈·훈련·수강권·랭킹·랭크업은 넣지 않는다 (전체메뉴 중복 제거 — 기존 규칙 유지).
// 2026-09-29 대표님: 로그인하면 전체 메뉴만 — 예전 홈 화면(라이센스 카드·오늘의 할 일·순위)은 1번 메뉴 'MY복서'(/myboxer) 안으로.
//
// glyph = 153 글리프 이름 (components/icons/menuGlyphs.ts) — 이모지 대신 우리 스타일로 직접 그린 아이콘.
import type { MenuGlyphName } from "@/components/icons/menuGlyphs";

export interface AppMenuItem {
  path: string;
  label: string;
  glyph: MenuGlyphName;
  /** 이 조건이 켜진 회원에게만 보인다 */
  requires?: "diet";
}

export const APP_MENU: readonly AppMenuItem[] = [
  // MY복서 — 예전 홈 화면(내 라이센스·오늘의 할 일·순위). 1번 자리 고정.
  { path: "/myboxer", label: "MY복서", glyph: "myboxer" },
  // 153플레이 — 레벨 미션 영상. 월드(외부 큐레이션) 탭은 관리자 계정에만 열린다.
  { path: "/library", label: "153플레이", glyph: "play" },
  { path: "/minigame", label: "복싱 트레이닝", glyph: "glove" },
  { path: "/training-library", label: "훈련 라이브러리", glyph: "books" },
  { path: "/routines", label: "수업 루틴", glyph: "clipboard" },
  // 153 챌린지 — 킹 보드(왕좌). 라우트는 /myboxer/quest 유지 (DB anchor 호환).
  { path: "/myboxer/quest", label: "153 챌린지", glyph: "crown" },
  { path: "/myboxer/community", label: "153 커뮤니티", glyph: "chat" },
  { path: "/myboxer/visualization", label: "153마인드셋", glyph: "mind" },
  { path: "/cert-benefits", label: "단증혜택", glyph: "medal" },
  { path: "/character-studio", label: "캐릭터", glyph: "avatar" },
  // 153다이어트 — profiles.diet_program_enabled 가 켜진 회원만. "꾸미기 → 다이어트 → 가이드" 순서 유지.
  { path: "/diet", label: "153다이어트", glyph: "bowl", requires: "diet" },
  { path: "/guide", label: "가이드", glyph: "compass" },
  { path: "/about/153", label: "153이란?", glyph: "fish" },
  { path: "/mypage", label: "내정보", glyph: "idcard" },
  { path: "/settings", label: "설정", glyph: "gear" },
];

export const buildAppMenu = (opts: { diet: boolean }): AppMenuItem[] =>
  APP_MENU.filter((m) => m.requires !== "diet" || opts.diet);
