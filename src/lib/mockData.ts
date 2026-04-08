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
  title: "도전하는 전사",
};

export const todayQuests: Quest[] = [
  { id: "q1", title: "기본기 3세트 완료", description: "스쿼트·푸시업·플랭크", status: "active", xpReward: 30 },
  { id: "q2", title: "스트레칭 루틴", description: "10분 풀바디 스트레칭", status: "complete", xpReward: 15 },
  { id: "q3", title: "코치 피드백 받기", description: "오늘 수업 후 코치에게 확인", status: "pending", xpReward: 20 },
];

export const allQuests: Quest[] = [
  ...todayQuests,
  { id: "q4", title: "1분 플랭크 도전", description: "1분 유지 성공", status: "locked", xpReward: 40, requiredLevel: 5 },
  { id: "q5", title: "5km 러닝 완주", description: "러닝 5km 달성", status: "locked", xpReward: 50, requiredLevel: 5 },
  { id: "q6", title: "블루 보스전: 체력 테스트", description: "블루 10레벨 보스 퀘스트", status: "locked", xpReward: 100, isBoss: true, requiredLevel: 10 },
];

export const levelMap: LevelNode[] = Array.from({ length: 10 }, (_, i) => ({
  level: i + 1,
  rank: "blue" as RankName,
  unlocked: i + 1 <= 4,
  current: i + 1 === 4,
  isBoss: i + 1 === 10,
}));

export const badges: Badge[] = [
  { id: "b1", name: "첫 발걸음", icon: "👟", earned: true, description: "첫 퀘스트 완료" },
  { id: "b2", name: "3일 연속", icon: "🔥", earned: true, description: "3일 연속 퀘스트 수행" },
  { id: "b3", name: "블루 승급", icon: "🔵", earned: true, description: "블루 계급 달성" },
  { id: "b4", name: "체력왕", icon: "💪", earned: false, description: "체력 테스트 만점" },
  { id: "b5", name: "꾸준함의 달인", icon: "🏆", earned: false, description: "30일 연속 출석" },
  { id: "b6", name: "보스 슬레이어", icon: "⚔️", earned: false, description: "보스전 클리어" },
];
