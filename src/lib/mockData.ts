export type RankName = "white" | "blue" | "red" | "black";
export type QuestStatus = "locked" | "active" | "pending" | "complete";

export interface UserProfile {
  name: string;
  rank: RankName;
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  xpReward: number;
  isBoss?: boolean;
  requiredLevel?: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  description: string;
}

export interface LevelNode {
  level: number;
  rank: RankName;
  unlocked: boolean;
  current: boolean;
  isBoss: boolean;
}

export const RANK_LABELS: Record<RankName, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

export const RANK_ICONS: Record<RankName, string> = {
  white: "⚪",
  blue: "🔵",
  red: "🔴",
  black: "⚫",
};

export const currentUser: UserProfile = {
  name: "김도현",
  rank: "blue",
  level: 4,
  xp: 320,
  xpToNext: 500,
  title: "파이팅 루키",
};

export const todayQuests: Quest[] = [
  { id: "q1", title: "기본 콤비네이션 3라운드", description: "잽·스트레이트·훅 콤비네이션", status: "active", xpReward: 30 },
  { id: "q2", title: "줄넘기 3분 3세트", description: "풋워크 향상 줄넘기", status: "complete", xpReward: 15 },
  { id: "q3", title: "코치 미트 피드백", description: "미트 타격 후 코치에게 확인", status: "pending", xpReward: 20 },
];

export const allQuests: Quest[] = [
  ...todayQuests,
  { id: "q4", title: "3분 쉐도우복싱", description: "쉐도우복싱 3라운드 완주", status: "locked", xpReward: 40, requiredLevel: 5 },
  { id: "q5", title: "샌드백 5라운드", description: "샌드백 연속 5라운드 완료", status: "locked", xpReward: 50, requiredLevel: 5 },
  { id: "q6", title: "블루 타이틀매치: 스파링 테스트", description: "블루 10레벨 보스 퀘스트", status: "locked", xpReward: 100, isBoss: true, requiredLevel: 10 },
];

export const levelMap: LevelNode[] = Array.from({ length: 10 }, (_, i) => ({
  level: i + 1,
  rank: "blue" as RankName,
  unlocked: i + 1 <= 4,
  current: i + 1 === 4,
  isBoss: i + 1 === 10,
}));

export const badges: Badge[] = [
  { id: "b1", name: "첫 라운드", icon: "🥊", earned: true, description: "첫 퀘스트 완료" },
  { id: "b2", name: "3일 연속", icon: "🔥", earned: true, description: "3일 연속 퀘스트 수행" },
  { id: "b3", name: "블루 승급", icon: "🔵", earned: true, description: "블루 계급 달성" },
  { id: "b4", name: "아이언피스트", icon: "👊", earned: false, description: "체력 테스트 만점" },
  { id: "b5", name: "꾸준한 파이터", icon: "🏆", earned: false, description: "30일 연속 출석" },
  { id: "b6", name: "챔피언", icon: "🏅", earned: false, description: "타이틀매치 클리어" },
];
