export type RankName = "white" | "blue" | "red" | "black";
export type QuestStatus = "locked" | "active" | "pending" | "complete";
export type QuestTab = "today" | "weekly" | "boss";

export interface UserProfile {
  id: string;
  name: string;
  rank: RankName;
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
  streak: number;
  totalXp: number;
  maxStreak: number;
  bossCleared: number;
  branch: string;
  recentBadges: string[];
  joinDate: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  xpReward: number;
  isBoss?: boolean;
  requiredLevel?: number;
  tab: QuestTab;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  description: string;
  earnedDate?: string;
}

export interface LevelNode {
  level: number;
  rank: RankName;
  unlocked: boolean;
  current: boolean;
  isBoss: boolean;
  title: string;
  rewards: string[];
  requiredXp: number;
}

export interface RewardBox {
  id: string;
  name: string;
  icon: string;
  opened: boolean;
  reward?: string;
}

export interface ClearHistory {
  id: string;
  title: string;
  date: string;
  xp: number;
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

export const RANK_ORDER: RankName[] = ["white", "blue", "red", "black"];

// ─── 3 Example Users ──────────────────────────────────────

export const dummyUsers: UserProfile[] = [
  {
    id: "u1",
    name: "김도현",
    rank: "blue",
    level: 4,
    xp: 320,
    xpToNext: 500,
    title: "파이팅 루키",
    streak: 7,
    totalXp: 1820,
    maxStreak: 12,
    bossCleared: 1,
    branch: "강남점",
    recentBadges: ["b1", "b2", "b3"],
    joinDate: "2025-01-15",
  },
  {
    id: "u2",
    name: "이서윤",
    rank: "red",
    level: 7,
    xp: 680,
    xpToNext: 800,
    title: "불꽃 펀처",
    streak: 15,
    totalXp: 5420,
    maxStreak: 21,
    bossCleared: 2,
    branch: "홍대점",
    recentBadges: ["b1", "b2", "b3", "b4", "b5"],
    joinDate: "2024-08-20",
  },
  {
    id: "u3",
    name: "박준혁",
    rank: "white",
    level: 2,
    xp: 80,
    xpToNext: 200,
    title: "신입 파이터",
    streak: 2,
    totalXp: 280,
    maxStreak: 3,
    bossCleared: 0,
    branch: "강남점",
    recentBadges: ["b1"],
    joinDate: "2026-03-01",
  },
];

export const currentUser = dummyUsers[0];

// ─── Quests ────────────────────────────────────────────────

export const todayQuests: Quest[] = [
  { id: "q1", title: "기본 콤비네이션 3라운드", description: "잽·스트레이트·훅 콤비네이션 연습", status: "active", xpReward: 30, tab: "today" },
  { id: "q2", title: "줄넘기 3분 3세트", description: "풋워크 향상 줄넘기 훈련", status: "complete", xpReward: 15, tab: "today" },
  { id: "q3", title: "코치 미트 피드백", description: "미트 타격 후 코치 확인 받기", status: "pending", xpReward: 20, tab: "today" },
];

export const weeklyQuests: Quest[] = [
  { id: "q4", title: "쉐도우복싱 5라운드", description: "쉐도우복싱 누적 5라운드 완주", status: "active", xpReward: 50, tab: "weekly" },
  { id: "q5", title: "샌드백 파워 훈련", description: "샌드백 연속 3라운드 × 3일", status: "locked", xpReward: 60, requiredLevel: 5, tab: "weekly" },
  { id: "q6", title: "스텝 드릴 마스터", description: "사이드스텝·백스텝 드릴 완주", status: "complete", xpReward: 40, tab: "weekly" },
  { id: "q7", title: "체력 측정 완료", description: "주간 체력 측정 참여", status: "pending", xpReward: 35, tab: "weekly" },
];

export const bossQuests: Quest[] = [
  { id: "q8", title: "블루 타이틀매치: 스파링 테스트", description: "블루 10레벨 보스 퀘스트 - 3라운드 스파링", status: "locked", xpReward: 150, isBoss: true, requiredLevel: 10, tab: "boss" },
  { id: "q9", title: "레드 타이틀매치: 콤비 마스터", description: "레드 10레벨 보스 퀘스트 - 10가지 콤비네이션", status: "locked", xpReward: 250, isBoss: true, requiredLevel: 20, tab: "boss" },
  { id: "q10", title: "블랙 타이틀매치: 최종 링 테스트", description: "블랙 10레벨 보스 퀘스트 - 실전 스파링 5라운드", status: "locked", xpReward: 500, isBoss: true, requiredLevel: 40, tab: "boss" },
];

export const allQuests: Quest[] = [...todayQuests, ...weeklyQuests, ...bossQuests];

// ─── 40 Level Nodes (4 ranks × 10 levels) ─────────────────

const levelTitles: Record<RankName, string[]> = {
  white: [
    "첫 발걸음", "기초 자세", "잽 연습", "스트레이트 입문",
    "풋워크 기초", "기본 콤비네이션", "방어 자세", "스텝 이동",
    "기초 종합", "화이트 타이틀매치"
  ],
  blue: [
    "잽·스트레이트 강화", "훅 입문", "어퍼컷 기초", "콤비네이션 확장",
    "쉐도우복싱", "미트 훈련", "샌드백 드릴", "디펜스 연습",
    "실전 스텝", "블루 타이틀매치"
  ],
  red: [
    "카운터 입문", "콤비네이션 마스터", "바디워크", "앵글 체인지",
    "프레셔 파이팅", "링 컨트롤", "타이밍 훈련", "고급 디펜스",
    "스파링 준비", "레드 타이틀매치"
  ],
  black: [
    "전술 복싱", "페인트 마스터", "리드 핸드 마스터", "파워 펀칭",
    "클린치 워크", "라운드 관리", "실전 스파링", "체력 극한",
    "종합 실전", "블랙 타이틀매치"
  ],
};

function generateLevelMap(): LevelNode[] {
  const nodes: LevelNode[] = [];
  const currentGlobalLevel = (RANK_ORDER.indexOf(currentUser.rank)) * 10 + currentUser.level;

  RANK_ORDER.forEach((rank, rankIdx) => {
    for (let lvl = 1; lvl <= 10; lvl++) {
      const globalLevel = rankIdx * 10 + lvl;
      nodes.push({
        level: lvl,
        rank,
        unlocked: globalLevel <= currentGlobalLevel,
        current: globalLevel === currentGlobalLevel,
        isBoss: lvl === 10,
        title: levelTitles[rank][lvl - 1],
        rewards: lvl === 10
          ? ["보스 배지", `+${(rankIdx + 1) * 150} XP`, "칭호 해금"]
          : [`+${(rankIdx + 1) * 30 + lvl * 5} XP`],
        requiredXp: (rankIdx * 10 + lvl) * 50,
      });
    }
  });

  return nodes;
}

export const levelMap: LevelNode[] = generateLevelMap();

// ─── Badges ────────────────────────────────────────────────

export const badges: Badge[] = [
  { id: "b1", name: "첫 라운드", icon: "🥊", earned: true, description: "첫 퀘스트 완료", earnedDate: "2025-01-16" },
  { id: "b2", name: "3일 연속", icon: "🔥", earned: true, description: "3일 연속 퀘스트 수행", earnedDate: "2025-01-19" },
  { id: "b3", name: "블루 승격", icon: "🔵", earned: true, description: "블루 리그 달성", earnedDate: "2025-03-10" },
  { id: "b4", name: "아이언피스트", icon: "👊", earned: false, description: "체력 테스트 만점" },
  { id: "b5", name: "꾸준한 파이터", icon: "🏆", earned: false, description: "30일 연속 출석" },
  { id: "b6", name: "챔피언", icon: "🏅", earned: false, description: "타이틀매치 클리어" },
  { id: "b7", name: "콤보 마스터", icon: "💥", earned: false, description: "10가지 콤비네이션 마스터" },
  { id: "b8", name: "스피드 킹", icon: "⚡", earned: false, description: "줄넘기 5분 논스톱" },
  { id: "b9", name: "화이트 클리어", icon: "⚪", earned: true, description: "화이트 타이틀매치 클리어", earnedDate: "2025-02-28" },
];

// ─── Reward Boxes ──────────────────────────────────────────

export const rewardBoxes: RewardBox[] = [
  { id: "rb1", name: "레벨 3 보상", icon: "📦", opened: true, reward: "칭호: 도전하는 루키" },
  { id: "rb2", name: "레벨 4 보상", icon: "🎁", opened: false },
  { id: "rb3", name: "7일 연속 출석 보상", icon: "🎊", opened: false },
];

// ─── Clear History ─────────────────────────────────────────

export const clearHistory: ClearHistory[] = [
  { id: "ch1", title: "줄넘기 3분 3세트", date: "2026-04-08", xp: 15 },
  { id: "ch2", title: "기본 콤비네이션 3라운드", date: "2026-04-07", xp: 30 },
  { id: "ch3", title: "스텝 드릴 마스터", date: "2026-04-06", xp: 40 },
  { id: "ch4", title: "화이트 타이틀매치 클리어", date: "2025-02-28", xp: 150 },
];

// ─── Helpers ──────────────────────────────────────────────

export function getWeeklyCompletionRate(): number {
  const weeklyAll = [...todayQuests, ...weeklyQuests];
  const done = weeklyAll.filter(q => q.status === "complete").length;
  return Math.round((done / weeklyAll.length) * 100);
}

export function getNextBossDDay(): number {
  // dummy: 23 days until boss fight
  return 23;
}
