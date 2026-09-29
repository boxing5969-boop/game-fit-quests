// 🗂 마이복서153 전체 메뉴 — 한 곳에서 정의한다 (2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게).
//
// 홈 첫 화면의 메뉴 그리드(HomeMenuGrid)와 하단 '전체' 탭 시트가 같은 목록·같은 버튼을 쓴다.
// 메뉴를 더하거나 빼면 여기만 고치면 두 곳이 같이 바뀐다.
// 하단 탭에 이미 있는 홈·훈련·수강권·랭킹·랭크업은 넣지 않는다 (전체메뉴 중복 제거 — 기존 규칙 유지).
//
// tint = 라이트 모드 아이콘 칸 바탕(연한 파스텔). 다크 모드는 HomeMenuGrid 가 흰 반투명으로 통일한다.
// 색은 Tailwind 기본 팔레트의 100 단계만 쓴다 — 새 색을 만들지 않고, 보라·파랑 조합은 쓰지 않는다.

export interface AppMenuItem {
  path: string;
  label: string;
  emoji: string;
  tint: string;
  /** 이 조건이 켜진 회원에게만 보인다 */
  requires?: "diet";
}

export const APP_MENU: readonly AppMenuItem[] = [
  // 153플레이 — 레벨 미션 영상. 월드(외부 큐레이션) 탭은 관리자 계정에만 열린다.
  { path: "/library", label: "153플레이", emoji: "🎬", tint: "bg-red-100" },
  { path: "/minigame", label: "복싱 트레이닝", emoji: "🎮", tint: "bg-teal-100" },
  { path: "/training-library", label: "훈련 라이브러리", emoji: "🏋️", tint: "bg-lime-100" },
  { path: "/routines", label: "수업 루틴", emoji: "📋", tint: "bg-slate-100" },
  // 153 챌린지 — 라우트는 /myboxer/quest 유지 (DB anchor 호환).
  { path: "/myboxer/quest", label: "153 챌린지", emoji: "🎯", tint: "bg-rose-100" },
  { path: "/myboxer/community", label: "153 커뮤니티", emoji: "💬", tint: "bg-cyan-100" },
  { path: "/myboxer/visualization", label: "153마인드셋", emoji: "🧠", tint: "bg-yellow-100" },
  { path: "/cert-benefits", label: "단증혜택", emoji: "🏅", tint: "bg-amber-100" },
  { path: "/character-studio", label: "캐릭터", emoji: "🎨", tint: "bg-pink-100" },
  // 153다이어트 — profiles.diet_program_enabled 가 켜진 회원만. "꾸미기 → 다이어트 → 가이드" 순서 유지.
  { path: "/diet", label: "153다이어트", emoji: "🥗", tint: "bg-green-100", requires: "diet" },
  { path: "/guide", label: "가이드", emoji: "📖", tint: "bg-sky-100" },
  { path: "/about/153", label: "153이란?", emoji: "🐟", tint: "bg-cyan-100" },
  { path: "/mypage", label: "내정보", emoji: "👤", tint: "bg-slate-100" },
  { path: "/settings", label: "설정", emoji: "⚙️", tint: "bg-slate-100" },
];

export const buildAppMenu = (opts: { diet: boolean }): AppMenuItem[] =>
  APP_MENU.filter((m) => m.requires !== "diet" || opts.diet);
