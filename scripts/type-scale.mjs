// 153 글씨 6단계 — 회원 화면 글씨 크기 규칙 한 곳 (2026-10-28 대표님 "위보고한 기준대로 전면 리디자인하자")
//   UX 보고서 「마이복서153 글 줄이기 · 글씨 키우기」: 본문 16 · 가장 작은 13 · 크기는 이름으로만.
//   · apply-type-scale.mjs — 옛 크기(text-[11.5px] · text-xs …)를 6단계 이름으로 옮긴다 (몇 번을 돌려도 결과가 같다)
//   · check-font-sizes.mjs — 회원 화면에 크기 숫자 · 옛 이름이 다시 들어오면 알린다 (bun run build · GitHub 자동 검사)
//   tailwind.config.ts 의 fontSize micro · label · body · heading · title · display 와 같은 값이어야 한다.

export const SCALE = [
  { name: "micro", px: 13 },
  { name: "label", px: 14 },
  { name: "body", px: 16 },
  { name: "heading", px: 19 },
  { name: "title", px: 24 },
  { name: "display", px: 40 },
];

/** 옛 이름 → 그 이름이 뜻하던 px (tailwind 기본값 + 이 앱의 옛 토큰) */
export const LEGACY = {
  xs: 13, sm: 15, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128,
  caption: 12, badge: 12, "body-sm": 14, "body-lg": 16, button: 16,
  "display-sm": 20, "display-md": 24, "display-lg": 28, "number-sm": 16, "number-md": 24, "number-lg": 32,
};

/** 옛 토큰이 굵기도 정하고 있던 것 — 옮길 때 같은 칸에 굵기가 없으면 붙여 준다 */
export const LEGACY_WEIGHT = { badge: "font-bold", button: "font-bold", "number-sm": "font-bold", caption: "font-medium", "body-sm": "font-medium", "body-lg": "font-medium" };

/**
 * 옛 크기 → 6단계 (2026-10-28):
 *   · 11.5px 이하(배지 · 그래프 눈금 같은 아주 작은 표시) → micro 13
 *   · 12 ~ 13.5px(설명 · 날짜 · 이름표 — 앱에서 가장 많이 쓰던 '작은 회색 글씨') → label 14
 *   · 그 위는 가장 가까운 단계, 거리가 같으면 큰 쪽 (15 → 16 · 17 → 16 · 18 → 19 · 22 → 24 · 32 → 40)
 */
export function stepFor(px) {
  if (px <= 11.5) return "micro";
  if (px < 14) return "label";
  return nearestStep(px);
}

/** 옛 이름 중 따로 정하는 것 — 배지(12px 굵게)는 작은 칩이라 micro 로 둔다 */
export const LEGACY_STEP = { badge: "micro" };

/** 가장 가까운 단계, 거리가 같으면 큰 쪽 (15 → 16 · 17 → 16 · 32 → 40) */
export function nearestStep(px) {
  let best = SCALE[0];
  let bestD = Infinity;
  for (const s of SCALE) {
    const d = Math.abs(px - s.px);
    if (d < bestD || (d === bestD && s.px > best.px)) {
      best = s;
      bestD = d;
    }
  }
  return best.name;
}

/**
 * 아직 6단계로 옮기지 않는 화면 (src/ 기준 경로 앞부분) — 관리자 · 지점장 · 코치 화면, TV · 키오스크, 게임.
 *   회원이 보는 휴대폰 화면만 먼저 바꾼다(1 · 2단계). 이 화면들은 3단계에서 따로 기준을 정한다.
 */
export const EXCLUDE = [
  "components/admin/", "components/liveBoard/", "components/strategy/", "components/office/", "components/manager/",
  "components/dm/DmAdmin", "pages/Admin", "pages/SuperAdmin", "pages/BranchManagerHome", "pages/MemberDetail", "pages/MemberPreview",
  "pages/LiveBoard", "pages/Office", "pages/CoachDashboard", "pages/diet/coach", "pages/RoutineBuilderPage", "pages/StoryRpgPage",
  "pages/TvBranchPicker", "pages/SignageBoardPage", "pages/FaceKioskPage", "pages/CheckinBoardPage", "pages/MinigamePage",
  "features/minigame/", "components/story-rpg/",
  "components/test153/Test153MeasurePanel", "components/BranchCompareReport", "components/RegistrationReportPanel",
  "components/AtRiskMembersPanel", "components/TransferApproval", "components/BroadcastNotification", "components/ApprovalInbox",
  "components/CoachLevelReviewInbox", "components/DailyOperationsBoard", "components/DailyReportCard",
  "components/MembershipRequestsInbox", "components/CoachDraftsInbox", "components/CoachSparringInbox", "components/MissionManager",
  "components/PayssamInspectPanel", "components/SessionTemplateEditor",
];

export const isMemberFile = (rel) => rel.endsWith(".tsx") && !rel.endsWith(".test.tsx") && !EXCLUDE.some((p) => rel.startsWith(p));

const LEGACY_NAMES = Object.keys(LEGACY).sort((a, b) => b.length - a.length).map((n) => n.replace(/[-]/g, "\\-")).join("|");
/** 크기 숫자 (text-[11.5px]) — 앞의 변형(sm: · hover: · !)은 그대로 둔다 */
export const ARBITRARY_RE = /(?<![\w-])(!?)text-\[(\d+(?:\.\d+)?)px\](?![\w-])/g;
/** 옛 이름 (text-xs · text-caption …) */
export const LEGACY_RE = new RegExp(`(?<![\\w\\-\\[])(!?)text-(${LEGACY_NAMES})(?![\\w\\-])`, "g");
/** 줄 끝 예외 표시 — 정말 필요한 곳만 (예: 게임 같은 큰 숫자 연출) */
export const EXEMPT_MARK = "글씨예외";
