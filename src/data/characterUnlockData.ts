/**
 * Character unlock progression tied to league/level system
 * Defines which parts are available at each league tier
 */

export interface UnlockMilestone {
  league: "white" | "blue" | "red" | "black";
  levelRange: [number, number]; // [min, max] within league
  label: string;
  description: string;
  unlockedCategories: string[];
  unlockedPartKeys: string[];
  icon: string;
}

export const UNLOCK_MILESTONES: UnlockMilestone[] = [
  // WHITE LEAGUE (Lv 1-10)
  {
    league: "white", levelRange: [1, 3], label: "입문 복서",
    description: "기본 스킨, 헤어, 글러브 사용 가능",
    unlockedCategories: ["skin", "hair_back", "hair_front", "eyebrows", "eyes", "mouth"],
    unlockedPartKeys: ["skin_light", "skin_fair", "hb_short_black", "hb_short_brown", "hf_bangs_black", "hf_bangs_brown", "eb_normal", "eb_thick", "eye_normal", "eye_big", "mouth_smile", "mouth_grin", "glove_red", "glove_blue", "top_tank_red", "top_tank_blue", "shorts_basic_red", "shorts_basic_blue", "shoe_boots_red"],
    icon: "🥊",
  },
  {
    league: "white", levelRange: [4, 7], label: "성장하는 복서",
    description: "추가 글러브 색상과 의상 해금",
    unlockedCategories: ["gloves", "top", "shorts", "shoes"],
    unlockedPartKeys: ["glove_white", "glove_green", "top_tank_green", "shorts_basic_white", "shorts_basic_orange", "shoe_boots_white", "shoe_boots_black", "skin_medium", "hb_medium_black", "hf_side_blonde", "eb_thin", "eye_sharp", "mouth_serious"],
    icon: "💪",
  },
  {
    league: "white", levelRange: [8, 10], label: "화이트 마스터",
    description: "화이트 리그 모든 기본 파츠 해금",
    unlockedCategories: [],
    unlockedPartKeys: ["shoe_sneaker_blue", "shoe_sneaker_green", "top_hoodie_gray", "shorts_stripe_green", "eb_arched", "eb_straight", "eye_cute", "mouth_smirk"],
    icon: "⭐",
  },
  // BLUE LEAGUE (Lv 1-10)
  {
    league: "blue", levelRange: [1, 5], label: "블루 파이터",
    description: "세련된 글러브와 스타일 해금",
    unlockedCategories: [],
    unlockedPartKeys: ["glove_black", "glove_purple", "top_tank_black", "shorts_basic_black", "hb_medium_blonde", "hf_swept_silver", "hf_swept_blue", "eye_blue", "eye_green", "mouth_shout", "skin_tan"],
    icon: "🔵",
  },
  {
    league: "blue", levelRange: [6, 10], label: "블루 엘리트",
    description: "특별 헤어와 액세서리 해금",
    unlockedCategories: ["accessory"],
    unlockedPartKeys: ["hb_spiky_blue", "hf_curly_orange", "acc_headband_red", "acc_headband_gold", "acc_bandage", "top_hoodie_white", "shorts_stripe_purple", "eye_determined"],
    icon: "💎",
  },
  // RED LEAGUE (Lv 1-10)
  {
    league: "red", levelRange: [1, 5], label: "레드 챔피언",
    description: "프리미엄 스타일과 이펙트 해금",
    unlockedCategories: ["effect"],
    unlockedPartKeys: ["glove_gold", "glove_pink", "top_robe_red", "hb_long_pink", "hb_long_silver", "hf_side_pink", "hf_curly_purple", "acc_scar", "acc_star_sticker", "fx_sparkle", "fx_sweat", "skin_dark", "eye_red"],
    icon: "🔴",
  },
  {
    league: "red", levelRange: [6, 10], label: "레드 마스터",
    description: "전설급 로브와 골드 아이템 해금",
    unlockedCategories: [],
    unlockedPartKeys: ["top_robe_gold", "shorts_stripe_gold", "shoe_sneaker_gold", "hb_spiky_orange", "acc_ribbon_pink", "fx_hearts", "fx_fire", "mouth_pout"],
    icon: "🏆",
  },
  // BLACK LEAGUE (Lv 1-10)
  {
    league: "black", levelRange: [1, 5], label: "블랙 전사",
    description: "블랙 리그 전용 오라 자동 활성화",
    unlockedCategories: [],
    unlockedPartKeys: [],
    icon: "🖤",
  },
  {
    league: "black", levelRange: [6, 9], label: "블랙 엘리트",
    description: "강화된 프레스티지 이펙트",
    unlockedCategories: [],
    unlockedPartKeys: [],
    icon: "👑",
  },
  {
    league: "black", levelRange: [10, 10], label: "마스터",
    description: "무지개빛 후광 + 마스터 프레스티지",
    unlockedCategories: [],
    unlockedPartKeys: [],
    icon: "🌈",
  },
];

const LEAGUE_ORDER = { white: 0, blue: 1, red: 2, black: 3 };

/** Get all unlocked part keys for a given league + level */
export function getUnlockedPartKeys(league: string, level: number): Set<string> {
  const leagueIdx = LEAGUE_ORDER[league as keyof typeof LEAGUE_ORDER] ?? 0;
  const keys = new Set<string>();

  for (const m of UNLOCK_MILESTONES) {
    const mIdx = LEAGUE_ORDER[m.league];
    if (mIdx < leagueIdx) {
      m.unlockedPartKeys.forEach(k => keys.add(k));
    } else if (mIdx === leagueIdx && level >= m.levelRange[0]) {
      m.unlockedPartKeys.forEach(k => keys.add(k));
    }
  }
  return keys;
}

/** Get current + next milestone info */
export function getCurrentMilestone(league: string, level: number) {
  const leagueIdx = LEAGUE_ORDER[league as keyof typeof LEAGUE_ORDER] ?? 0;
  let current: UnlockMilestone | null = null;
  let next: UnlockMilestone | null = null;

  for (const m of UNLOCK_MILESTONES) {
    const mIdx = LEAGUE_ORDER[m.league];
    if (mIdx === leagueIdx && level >= m.levelRange[0] && level <= m.levelRange[1]) {
      current = m;
    }
    if (!next) {
      if (mIdx > leagueIdx || (mIdx === leagueIdx && m.levelRange[0] > level)) {
        next = m;
      }
    }
  }
  return { current, next };
}
