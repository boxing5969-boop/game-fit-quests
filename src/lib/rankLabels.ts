/** Shared rank label/icon utilities used across all components */
export const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

export const RANK_ICONS: Record<string, string> = {
  white: "⚪",
  blue: "🔵",
  red: "🔴",
  black: "⚫",
};

export const RANK_ORDER = ["white", "blue", "red", "black"] as const;

/** Format rank display: "화이트 리그 · 레벨 3" */
export const formatRank = (rank: string, level: number) =>
  `${RANK_LABELS[rank] || rank} 리그 · 레벨 ${level}`;

/** Short format for badges/cards: "화이트 L3" */
export const formatRankShort = (rank: string, level: number) =>
  `${RANK_LABELS[rank] || rank} L${level}`;

/** Role labels for UI */
export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: "전체 관리자", color: "bg-destructive/15 text-destructive" },
  branch_manager: { label: "관장님", color: "bg-accent/15 text-accent-foreground" },
  member: { label: "회원", color: "bg-muted text-muted-foreground" },
  admin: { label: "관리자", color: "bg-destructive/15 text-destructive" },
  coach: { label: "코치", color: "bg-accent/15 text-accent-foreground" },
};

export const isManagerRole = (role: string | null) =>
  role === "branch_manager" || role === "super_admin" || role === "admin" || role === "coach";

// ═══ MASTER 40 기준 통일 상수 ═══
export const MASTER_RANK = "black" as const;
export const MASTER_LEVEL = 10;
export const MASTER_BOSSES_REQUIRED = 4;

export const isMaster40 = (rank: string, level: number, bossesCleard: number) =>
  rank === MASTER_RANK && level >= MASTER_LEVEL && bossesCleard >= MASTER_BOSSES_REQUIRED;

export const isHallOfFameMember = (rank: string, level: number) =>
  rank === MASTER_RANK && level >= MASTER_LEVEL;

/** 통일 문구 */
export const MASTER_TITLE = "MASTER 40";
export const MASTER_DESCRIPTION = "블랙 리그 레벨 10 달성 + 모든 타이틀매치 클리어";
export const HALL_OF_FAME_DESCRIPTION = "블랙 리그 레벨 10 달성 · 최종 마스터 미션 완료자";

/** 승인대기 템플릿 코멘트 */
export const TEMPLATE_COMMENTS = [
  { label: "👍 훌륭합니다", text: "훌륭합니다! 잘 하고 있어요." },
  { label: "✅ 기본기 좋음", text: "기본기가 잘 잡혀있습니다. 다음 레벨로 넘어가세요!" },
  { label: "📹 영상 확인", text: "영상 확인 완료. 동작이 정확합니다." },
  { label: "✏️ 자세 보완", text: "자세가 조금 부족합니다. 가드를 더 올리고 턱을 당기세요." },
  { label: "🔄 재촬영 필요", text: "영상이 불명확합니다. 다시 촬영해서 제출해주세요." },
  { label: "❌ 기본기 미달", text: "기본기가 부족합니다. 코치에게 1:1 교정 후 재제출하세요." },
];
