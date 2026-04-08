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

/** Format rank display: "화이트 레벨 3" */
export const formatRank = (rank: string, level: number) =>
  `${RANK_LABELS[rank] || rank} 레벨 ${level}`;

/** Role labels for UI */
export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: "전체 관리자", color: "bg-destructive/15 text-destructive" },
  branch_manager: { label: "관장님", color: "bg-accent/15 text-accent-foreground" },
  member: { label: "회원", color: "bg-muted text-muted-foreground" },
  // Legacy compat
  admin: { label: "관리자", color: "bg-destructive/15 text-destructive" },
  coach: { label: "코치", color: "bg-accent/15 text-accent-foreground" },
};

export const isManagerRole = (role: string | null) =>
  role === "branch_manager" || role === "super_admin" || role === "admin" || role === "coach";
