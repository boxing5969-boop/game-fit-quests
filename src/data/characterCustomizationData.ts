/**
 * Customization system — effect, frame, title, aura.
 * Each option has price / league / rarity for shop integration.
 */

// ===== Types =====

export interface CharacterCustomization {
  effect?: string;
  frame?: string;
  title?: string;
  aura?: string;
  nameplate?: string;
}

export type ItemLeague = "white" | "blue" | "red" | "black" | "legend";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface CustomizationOption {
  key: string;
  label: string;
  price: number;
  league: ItemLeague;
  rarity: ItemRarity;
  description?: string;
  requirement?: "hall_of_fame";
  /** @deprecated — use league field instead */
  blackOnly?: boolean;
}

export interface CustomizationCategory {
  code: string;
  label: string;
  icon: string;
  options: CustomizationOption[];
}

// ===== EFFECTS =====
const EFFECT_OPTIONS: CustomizationOption[] = [
  // ── White (free–500) ───────────────────────────────────────
  { key: "sparkle",      label: "반짝이",     price: 0,     league: "white", rarity: "common",   description: "캐릭터 주변에 반짝이는 파티클" },
  { key: "stars",        label: "별",         price: 0,     league: "white", rarity: "common",   description: "별이 떠다니는 효과" },
  { key: "flame",        label: "불꽃",       price: 300,   league: "white", rarity: "common",   description: "타오르는 불꽃 이펙트" },
  { key: "hearts",       label: "하트",       price: 300,   league: "white", rarity: "common",   description: "하트가 둥둥 떠오르는 효과" },
  { key: "wind",         label: "바람",       price: 200,   league: "white", rarity: "common",   description: "바람이 부는 효과" },
  { key: "clover",       label: "클로버",     price: 400,   league: "white", rarity: "common",   description: "행운의 클로버 파티클" },
  // ── Blue (500–2000) ────────────────────────────────────────
  { key: "lightning",    label: "번개",       price: 800,   league: "blue",  rarity: "uncommon", description: "번개 스파크 이펙트" },
  { key: "snow",         label: "눈송이",     price: 800,   league: "blue",  rarity: "uncommon", description: "눈이 내리는 효과" },
  { key: "cherry",       label: "벚꽃",       price: 1000,  league: "blue",  rarity: "uncommon", description: "벚꽃잎이 흩날리는 효과" },
  { key: "music",        label: "음표",       price: 1000,  league: "blue",  rarity: "uncommon", description: "음표가 떠다니는 효과" },
  { key: "firework",     label: "폭죽",       price: 1200,  league: "blue",  rarity: "uncommon", description: "축하 폭죽 이펙트" },
  // ── Red (2000–5000) ────────────────────────────────────────
  { key: "tornado",      label: "회오리",     price: 3000,  league: "red",   rarity: "rare",     description: "강력한 회오리 이펙트" },
  { key: "comet",        label: "혜성",       price: 3000,  league: "red",   rarity: "rare",     description: "혜성이 스쳐 지나가는 효과" },
  { key: "rainbow",      label: "무지개",     price: 3500,  league: "red",   rarity: "rare",     description: "무지개 빛 파티클" },
  { key: "explosion",    label: "폭발",       price: 3500,  league: "red",   rarity: "rare",     description: "펀치 폭발 이펙트" },
  { key: "ghost",        label: "유령",       price: 4000,  league: "red",   rarity: "rare",     description: "유령이 떠다니는 효과" },
  { key: "star_shoot",   label: "별똥별",     price: 4000,  league: "red",   rarity: "rare",     description: "별똥별이 쏟아지는 효과" },
  // ── Black (5000–15000) ─────────────────────────────────────
  { key: "crown_effect", label: "왕관빛",     price: 5000,  league: "black", rarity: "epic",     description: "왕관에서 빛이 뿜어나오는 효과", blackOnly: true },
  { key: "dragon",       label: "드래곤",     price: 8000,  league: "black", rarity: "epic",     description: "드래곤 브레스 이펙트", blackOnly: true },
  { key: "phoenix",      label: "피닉스",     price: 10000, league: "black", rarity: "epic",     description: "불사조 날갯짓 이펙트", blackOnly: true },
  { key: "skull",        label: "해골",       price: 12000, league: "black", rarity: "epic",     description: "해골 불꽃 이펙트", blackOnly: true },
  { key: "diamond_rain", label: "다이아 비",  price: 15000, league: "black", rarity: "epic",     description: "다이아몬드가 쏟아지는 효과", blackOnly: true },
];

// ===== FRAMES =====
const FRAME_OPTIONS: CustomizationOption[] = [
  // ── White (free–500) ───────────────────────────────────────
  { key: "none",         label: "없음",           price: 0,     league: "white", rarity: "common",   description: "프레임 없음" },
  { key: "basic_white",  label: "기본 화이트",    price: 0,     league: "white", rarity: "common",   description: "깔끔한 화이트 링" },
  { key: "fire",         label: "불꽃 프레임",    price: 300,   league: "white", rarity: "common",   description: "불타는 프레임" },
  { key: "ice",          label: "얼음 프레임",    price: 300,   league: "white", rarity: "common",   description: "차가운 얼음 프레임" },
  { key: "moon",         label: "달빛 프레임",    price: 500,   league: "white", rarity: "common",   description: "은은한 달빛 프레임" },
  // ── Blue (500–2000) ────────────────────────────────────────
  { key: "lightning",    label: "번개 프레임",    price: 800,   league: "blue",  rarity: "uncommon", description: "번개치는 프레임" },
  { key: "cherry",       label: "벚꽃 프레임",    price: 800,   league: "blue",  rarity: "uncommon", description: "벚꽃잎 프레임" },
  { key: "electric",     label: "전기 프레임",    price: 1000,  league: "blue",  rarity: "uncommon", description: "전류가 흐르는 프레임" },
  { key: "ocean",        label: "오션 프레임",    price: 1000,  league: "blue",  rarity: "uncommon", description: "바다를 담은 프레임" },
  { key: "emerald",      label: "에메랄드 프레임", price: 1200, league: "blue",  rarity: "uncommon", description: "에메랄드빛 프레임" },
  { key: "sakura",       label: "사쿠라 프레임",  price: 1500,  league: "blue",  rarity: "uncommon", description: "사쿠라 핑크 프레임" },
  { key: "diamond",      label: "다이아 프레임",  price: 1800,  league: "blue",  rarity: "uncommon", description: "다이아 반짝임 프레임" },
  // ── Red (2000–5000) ────────────────────────────────────────
  { key: "gold",         label: "골드 프레임",    price: 2500,  league: "red",   rarity: "rare",     description: "황금빛 프레임" },
  { key: "rainbow",      label: "무지개 프레임",  price: 2500,  league: "red",   rarity: "rare",     description: "무지개 프레임" },
  { key: "blood",        label: "블러드 링",      price: 3000,  league: "red",   rarity: "rare",     description: "핏빛 링 프레임" },
  { key: "dark_red",     label: "블러드 레드",    price: 3000,  league: "red",   rarity: "rare",     description: "진한 블러드 프레임" },
  { key: "purple",       label: "퍼플 미스트",    price: 3000,  league: "red",   rarity: "rare",     description: "보라색 안개 프레임" },
  { key: "neon",         label: "네온 프레임",    price: 3500,  league: "red",   rarity: "rare",     description: "네온빛 프레임" },
  { key: "crystal",      label: "크리스탈",       price: 3500,  league: "red",   rarity: "rare",     description: "크리스탈 프레임" },
  { key: "storm",        label: "폭풍 프레임",    price: 4000,  league: "red",   rarity: "rare",     description: "폭풍이 감싸는 프레임" },
  { key: "neon_green",   label: "네온 그린",      price: 4500,  league: "red",   rarity: "rare",     description: "네온 그린 프레임" },
  // ── Black (5000–15000) ─────────────────────────────────────
  { key: "shadow",       label: "섀도우 프레임",  price: 5000,  league: "black", rarity: "epic",     description: "어둠의 그림자 프레임", blackOnly: true },
  { key: "galaxy",       label: "갤럭시 링",      price: 6000,  league: "black", rarity: "epic",     description: "우주를 담은 프레임", blackOnly: true },
  { key: "rainbow_frame",label: "레인보우 사이클", price: 7000, league: "black", rarity: "epic",     description: "무지개가 회전하는 프레임", blackOnly: true },
  { key: "holy",         label: "홀리 링",        price: 7000,  league: "black", rarity: "epic",     description: "신성한 빛 프레임", blackOnly: true },
  { key: "inferno",      label: "인페르노",       price: 8000,  league: "black", rarity: "epic",     description: "지옥불 프레임", blackOnly: true },
  { key: "void",         label: "보이드",         price: 10000, league: "black", rarity: "epic",     description: "공허의 어둠 프레임", blackOnly: true },
  { key: "eternal",      label: "이터널",         price: 15000, league: "black", rarity: "epic",     description: "영원의 빛 프레임", blackOnly: true },
];

// ===== TITLES =====
const TITLE_OPTIONS: CustomizationOption[] = [
  // ── White (free–500) ───────────────────────────────────────
  { key: "rookie",          label: "루키",               price: 0,      league: "white", rarity: "common",    description: "첫걸음을 뗀 복서" },
  { key: "beginner",        label: "초보",               price: 0,      league: "white", rarity: "common",    description: "성장하는 초보 복서" },
  { key: "trainee",         label: "수련생",             price: 300,    league: "white", rarity: "common",    description: "땀흘리는 수련생" },
  { key: "goal_getter",     label: "목표달성러",         price: 400,    league: "white", rarity: "common",    description: "목표를 향해 달려가는 자" },
  { key: "attendance_king", label: "출석왕",             price: 500,    league: "white", rarity: "common",    description: "꾸준히 출석하는 왕" },
  // ── Blue (500–2000) ────────────────────────────────────────
  { key: "fighter",         label: "파이터",             price: 800,    league: "blue",  rarity: "uncommon",  description: "불꽃처럼 싸우는 전사" },
  { key: "warrior",         label: "전사",               price: 1000,   league: "blue",  rarity: "uncommon",  description: "강철 의지의 전사" },
  { key: "speedster",       label: "스피드스터",         price: 1200,   league: "blue",  rarity: "uncommon",  description: "빛보다 빠른 권투선수" },
  { key: "iron_fist",       label: "아이언 피스트",      price: 1500,   league: "blue",  rarity: "uncommon",  description: "강철 주먹의 소유자" },
  { key: "fire_fighter",    label: "불꽃 파이터",        price: 1800,   league: "blue",  rarity: "uncommon",  description: "불꽃을 두른 파이터" },
  { key: "night_hunter",    label: "나이트 헌터",        price: 2000,   league: "blue",  rarity: "uncommon",  description: "밤을 지배하는 사냥꾼" },
  // ── Red (2000–5000) ────────────────────────────────────────
  { key: "champion",        label: "챔피언",             price: 2500,   league: "red",   rarity: "rare",      description: "링의 챔피언" },
  { key: "destroyer",       label: "디스트로이어",       price: 3000,   league: "red",   rarity: "rare",      description: "모든 것을 파괴하는 자" },
  { key: "thunder",         label: "썬더",               price: 3500,   league: "red",   rarity: "rare",      description: "천둥의 주먹" },
  { key: "thunder_king",    label: "썬더킹",             price: 3500,   league: "red",   rarity: "rare",      description: "천둥을 지배하는 왕" },
  { key: "phoenix_title",   label: "피닉스",             price: 4000,   league: "red",   rarity: "rare",      description: "불사조처럼 부활하는 자" },
  { key: "beast",           label: "맹수",               price: 4500,   league: "red",   rarity: "rare",      description: "야생의 맹수" },
  { key: "diamond_fighter", label: "다이아 파이터",      price: 4500,   league: "red",   rarity: "rare",      description: "다이아몬드 급 파이터" },
  { key: "153_star",        label: "153 스타",           price: 5000,   league: "red",   rarity: "rare",      description: "153의 스타 복서" },
  // ── Black (5000–15000) ─────────────────────────────────────
  { key: "legend",          label: "레전드",             price: 5000,   league: "black", rarity: "epic",      description: "전설이 된 복서", blackOnly: true },
  { key: "dragon",          label: "드래곤",             price: 8000,   league: "black", rarity: "epic",      description: "용의 힘을 가진 자", blackOnly: true },
  { key: "shadow_king",     label: "그림자왕",           price: 10000,  league: "black", rarity: "epic",      description: "그림자를 지배하는 왕", blackOnly: true },
  { key: "god_of_war",      label: "전쟁의 신",         price: 12000,  league: "black", rarity: "epic",      description: "링 위의 전쟁 신", blackOnly: true },
  { key: "immortal",        label: "불멸",               price: 15000,  league: "black", rarity: "epic",      description: "절대 쓰러지지 않는 자", blackOnly: true },
  // ── Legend (명예의 전당 전용, 100000) ──────────────────────
  { key: "eternal_153",     label: "ETERNAL 153",        price: 100000, league: "legend", rarity: "legendary", description: "153의 영원한 전설", requirement: "hall_of_fame" },
  { key: "king_of_ring",    label: "킹 오브 더 링",     price: 100000, league: "legend", rarity: "legendary", description: "링의 절대 지배자", requirement: "hall_of_fame" },
  { key: "god_fist",        label: "갓피스트",           price: 100000, league: "legend", rarity: "legendary", description: "신의 주먹", requirement: "hall_of_fame" },
];

// ===== AURA =====
const AURA_OPTIONS: CustomizationOption[] = [
  // ── White (free–500) ───────────────────────────────────────
  { key: "none",           label: "없음",             price: 0,      league: "white", rarity: "common",    description: "오라 없음" },
  { key: "soft_glow",      label: "은은한 빛",        price: 300,    league: "white", rarity: "common",    description: "부드러운 빛 오라" },
  // ── Existing White/Blue tier ───────────────────────────────
  { key: "aura_fire",      label: "불꽃 오라",        price: 800,    league: "blue",  rarity: "uncommon",  description: "불꽃이 타오르는 오라" },
  { key: "aura_ice",       label: "얼음 오라",        price: 800,    league: "blue",  rarity: "uncommon",  description: "차가운 얼음 오라" },
  { key: "blue_flame",     label: "푸른 불꽃",        price: 1000,   league: "blue",  rarity: "uncommon",  description: "푸른 불꽃 오라" },
  { key: "green_energy",   label: "그린 에너지",      price: 1200,   league: "blue",  rarity: "uncommon",  description: "생명의 에너지 오라" },
  { key: "aura_lightning", label: "번개 오라",        price: 1500,   league: "blue",  rarity: "uncommon",  description: "번개가 치는 오라" },
  { key: "aura_sakura",    label: "벚꽃 오라",        price: 1800,   league: "blue",  rarity: "uncommon",  description: "벚꽃잎이 흩날리는 오라" },
  // ── Red (2000–5000) ────────────────────────────────────────
  { key: "red_rage",       label: "레드 레이지",      price: 3000,   league: "red",   rarity: "rare",      description: "분노의 붉은 오라" },
  { key: "aura_gold",      label: "골든 오라",        price: 3500,   league: "red",   rarity: "rare",      description: "황금빛 오라" },
  { key: "golden_aura",    label: "순금 오라",        price: 3500,   league: "red",   rarity: "rare",      description: "찬란한 순금 오라" },
  { key: "aura_rainbow",   label: "레인보우 오라",    price: 4000,   league: "red",   rarity: "rare",      description: "무지개빛 오라" },
  { key: "purple_haze",    label: "퍼플 헤이즈",      price: 4000,   league: "red",   rarity: "rare",      description: "보라색 안개 오라" },
  { key: "aura_blood",     label: "블러드 오라",      price: 4500,   league: "red",   rarity: "rare",      description: "핏빛 오라" },
  { key: "aura_neon",      label: "네온 오라",        price: 5000,   league: "red",   rarity: "rare",      description: "네온빛 오라" },
  // ── Black (5000–15000) ─────────────────────────────────────
  { key: "aura_dark",      label: "다크 오라",        price: 5000,   league: "black", rarity: "epic",      description: "어둠의 오라", blackOnly: true },
  { key: "aura_shadow",    label: "섀도우 오라",      price: 6000,   league: "black", rarity: "epic",      description: "그림자 오라", blackOnly: true },
  { key: "aura_holy",      label: "홀리 오라",        price: 7000,   league: "black", rarity: "epic",      description: "신성한 오라", blackOnly: true },
  { key: "dark_matter",    label: "다크 매터",        price: 8000,   league: "black", rarity: "epic",      description: "다크 매터 오라", blackOnly: true },
  { key: "aura_galaxy",    label: "갤럭시 오라",      price: 8000,   league: "black", rarity: "epic",      description: "은하 오라", blackOnly: true },
  { key: "infernal",       label: "인퍼널",           price: 10000,  league: "black", rarity: "epic",      description: "지옥불 오라", blackOnly: true },
  { key: "cosmic",         label: "코즈믹",           price: 12000,  league: "black", rarity: "epic",      description: "우주의 오라", blackOnly: true },
  // ── Black Master ───────────────────────────────────────────
  { key: "halo_rainbow_master", label: "레인보우 마스터", price: 15000, league: "black", rarity: "epic",   description: "무지개 마스터 오라", blackOnly: true },
  { key: "halo_black_gold",     label: "블랙 골드",       price: 15000, league: "black", rarity: "epic",   description: "블랙 골드 마스터 오라", blackOnly: true },
  { key: "halo_conqueror",      label: "정복자 오라",     price: 15000, league: "black", rarity: "epic",   description: "정복자의 오라", blackOnly: true },
  { key: "halo_galaxy_master",  label: "갤럭시 마스터",   price: 15000, league: "black", rarity: "epic",   description: "갤럭시 마스터 오라", blackOnly: true },
  // ── Legend (명예의 전당 전용) ──────────────────────────────
  { key: "divine",         label: "디바인",           price: 100000, league: "legend", rarity: "legendary", description: "신성한 빛의 오라", requirement: "hall_of_fame" },
  { key: "void_emperor",   label: "보이드 엠퍼러",    price: 100000, league: "legend", rarity: "legendary", description: "공허의 황제 오라", requirement: "hall_of_fame" },
];

// ===== Categories =====
export const CUSTOMIZATION_CATEGORIES: CustomizationCategory[] = [
  { code: "effect", label: "이펙트", icon: "✨",  options: EFFECT_OPTIONS },
  { code: "frame",  label: "프레임", icon: "🖼️", options: FRAME_OPTIONS },
  { code: "title",  label: "칭호",   icon: "🏷️", options: TITLE_OPTIONS },
  { code: "aura",   label: "오라",   icon: "🌀",  options: AURA_OPTIONS },
];

// ===== Visual rendering helpers =====

export const EFFECT_EMOJIS: Record<string, string> = {
  sparkle:      "✨",
  flame:        "🔥",
  hearts:       "💖",
  stars:        "⭐",
  wind:         "💨",
  clover:       "🍀",
  lightning:    "⚡",
  snow:         "❄️",
  cherry:       "🌸",
  music:        "🎵",
  firework:     "🎆",
  tornado:      "🌪️",
  comet:        "☄️",
  rainbow:      "🌈",
  explosion:    "💥",
  ghost:        "👻",
  star_shoot:   "🌟",
  crown_effect: "👑",
  dragon:       "🐉",
  phoenix:      "🔥",
  skull:        "💀",
  diamond_rain: "💎",
};

export const FRAME_STYLES: Record<string, string> = {
  none:          "",
  basic_white:   "ring-2 ring-white/40",
  fire:          "ring-2 ring-orange-500/80 shadow-[0_0_14px_rgba(249,115,22,0.5)] animate-[flicker_0.8s_ease-in-out_infinite]",
  ice:           "ring-2 ring-cyan-400/70 shadow-[0_0_14px_rgba(34,211,238,0.5)] animate-[breathe_2s_ease-in-out_infinite]",
  moon:          "ring-2 ring-blue-200/70 shadow-[0_0_14px_rgba(191,219,254,0.5)] animate-[breathe_4s_ease-in-out_infinite]",
  lightning:     "ring-2 ring-yellow-400/90 shadow-[0_0_18px_rgba(250,204,21,0.7)] animate-[flicker_0.35s_ease-in-out_infinite]",
  cherry:        "ring-2 ring-pink-300/70 shadow-[0_0_14px_rgba(249,168,212,0.5)] animate-[breathe_3s_ease-in-out_infinite]",
  electric:      "ring-2 ring-yellow-300/70 shadow-[0_0_15px_rgba(250,204,21,0.5)]",
  ocean:         "ring-2 ring-blue-500/60 shadow-[0_0_14px_rgba(59,130,246,0.5)]",
  emerald:       "ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.4)]",
  sakura:        "ring-2 ring-rose-300/80 shadow-[0_0_16px_rgba(253,164,175,0.6)] animate-[breathe_2s_ease-in-out_infinite]",
  diamond:       "ring-2 ring-cyan-300/80 shadow-[0_0_18px_rgba(103,232,249,0.7)] animate-[sparkle_2s_ease-in-out_infinite]",
  gold:          "ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.6)] animate-[breathe_2.5s_ease-in-out_infinite]",
  rainbow:       "ring-2 ring-pink-400/80 shadow-[0_0_20px_rgba(244,114,182,0.5)] animate-[galaxy-spin_3s_linear_infinite]",
  blood:         "ring-2 ring-red-700/90 shadow-[0_0_22px_rgba(185,28,28,0.8)] animate-[flicker_0.5s_ease-in-out_infinite]",
  dark_red:      "ring-2 ring-red-900/80 shadow-[0_0_20px_rgba(127,29,29,0.7)] animate-[flicker_0.6s_ease-in-out_infinite]",
  purple:        "ring-2 ring-purple-500/80 shadow-[0_0_18px_rgba(168,85,247,0.6)] animate-[breathe_1.8s_ease-in-out_infinite]",
  neon:          "ring-2 ring-fuchsia-400/70 shadow-[0_0_18px_rgba(232,121,249,0.6)]",
  crystal:       "ring-2 ring-white/80 shadow-[0_0_22px_rgba(255,255,255,0.8)] animate-[sparkle_1.5s_ease-in-out_infinite]",
  storm:         "ring-2 ring-violet-500/60 shadow-[0_0_16px_rgba(139,92,246,0.5)] animate-pulse",
  neon_green:    "ring-2 ring-green-400/90 shadow-[0_0_22px_rgba(74,222,128,0.7)] animate-[breathe_1.5s_ease-in-out_infinite]",
  shadow:        "ring-2 ring-gray-600/80 shadow-[0_0_20px_rgba(0,0,0,0.6)] animate-pulse",
  galaxy:        "ring-2 ring-indigo-500/80 shadow-[0_0_24px_rgba(99,102,241,0.6)] animate-[galaxy-spin_4s_linear_infinite]",
  rainbow_frame: "ring-2 ring-violet-500/80 shadow-[0_0_24px_rgba(139,92,246,0.6)] animate-[galaxy-spin_2.5s_linear_infinite]",
  holy:          "ring-2 ring-yellow-100/90 shadow-[0_0_28px_rgba(254,249,195,0.9)] animate-[sparkle_2s_ease-in-out_infinite]",
  inferno:       "ring-3 ring-orange-500/80 shadow-[0_0_24px_rgba(249,115,22,0.7)]",
  void:          "ring-3 ring-gray-900/90 shadow-[0_0_20px_rgba(0,0,0,0.8)]",
  eternal:       "ring-3 ring-amber-300/90 shadow-[0_0_30px_rgba(251,191,36,0.8)] animate-pulse",
};

export const TITLE_LABELS: Record<string, { text: string; color: string }> = {
  rookie:          { text: "🥊 루키",              color: "text-green-600" },
  beginner:        { text: "🌱 초보",              color: "text-lime-500" },
  trainee:         { text: "💪 수련생",            color: "text-gray-500" },
  goal_getter:     { text: "🎯 목표달성러",        color: "text-green-500" },
  attendance_king: { text: "👑 출석왕",            color: "text-yellow-500" },
  fighter:         { text: "🔥 파이터",            color: "text-orange-500" },
  warrior:         { text: "⚔️ 전사",             color: "text-blue-600" },
  speedster:       { text: "💨 스피드스터",        color: "text-cyan-500" },
  iron_fist:       { text: "🦾 아이언 피스트",     color: "text-slate-600" },
  fire_fighter:    { text: "🔥 불꽃 파이터",       color: "text-orange-500" },
  night_hunter:    { text: "🌙 나이트 헌터",       color: "text-indigo-500" },
  champion:        { text: "🏆 챔피언",            color: "text-amber-500" },
  destroyer:       { text: "💥 디스트로이어",      color: "text-red-600" },
  thunder:         { text: "⚡ 썬더",              color: "text-yellow-500" },
  thunder_king:    { text: "⚡ 썬더킹",            color: "text-yellow-400" },
  phoenix_title:   { text: "🔥 피닉스",            color: "text-orange-600" },
  beast:           { text: "🐅 맹수",              color: "text-orange-700" },
  diamond_fighter: { text: "💎 다이아 파이터",     color: "text-cyan-500" },
  "153_star":      { text: "⭐ 153 스타",          color: "text-amber-400" },
  legend:          { text: "👑 레전드",            color: "text-purple-500" },
  dragon:          { text: "🐉 드래곤",            color: "text-red-700" },
  shadow_king:     { text: "🌑 그림자왕",          color: "text-gray-800" },
  god_of_war:      { text: "⚔️ 전쟁의 신",        color: "text-red-800" },
  immortal:        { text: "♾️ 불멸",              color: "text-indigo-600" },
  eternal_153:     { text: "💎 ETERNAL 153",       color: "text-amber-400" },
  king_of_ring:    { text: "👑 킹 오브 더 링",    color: "text-yellow-400" },
  god_fist:        { text: "🥊 갓피스트",          color: "text-rose-400" },
};

/** CSS classes for aura glow behind character */
export const AURA_STYLES: Record<string, string> = {
  none:                "",
  soft_glow:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(255,255,255,0.25)_0%,transparent_70%)]",
  aura_fire:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(234,88,12,0.5)_0%,rgba(239,68,68,0.3)_40%,transparent_70%)]",
  aura_ice:            "animate-pulse [background:radial-gradient(circle_at_center,rgba(34,211,238,0.45)_0%,rgba(191,219,254,0.25)_40%,transparent_70%)]",
  blue_flame:          "animate-pulse [background:radial-gradient(circle_at_center,rgba(59,130,246,0.4)_0%,rgba(96,165,250,0.2)_40%,transparent_70%)]",
  green_energy:        "animate-pulse [background:radial-gradient(circle_at_center,rgba(52,211,153,0.4)_0%,rgba(110,231,183,0.2)_40%,transparent_70%)]",
  aura_lightning:      "animate-ping [background:radial-gradient(circle_at_center,rgba(250,204,21,0.5)_0%,rgba(253,224,71,0.25)_40%,transparent_70%)]",
  aura_sakura:         "animate-pulse [background:radial-gradient(circle_at_center,rgba(244,114,182,0.45)_0%,rgba(251,207,232,0.25)_40%,transparent_70%)]",
  red_rage:            "animate-pulse [background:radial-gradient(circle_at_center,rgba(220,38,38,0.45)_0%,rgba(239,68,68,0.2)_40%,transparent_70%)]",
  aura_gold:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(202,138,4,0.5)_0%,rgba(251,191,36,0.25)_40%,transparent_70%)]",
  golden_aura:         "animate-pulse [background:radial-gradient(circle_at_center,rgba(251,191,36,0.45)_0%,rgba(252,211,77,0.2)_40%,transparent_70%)]",
  aura_rainbow:        "animate-spin [background:conic-gradient(rgba(239,68,68,0.5),rgba(250,204,21,0.5),rgba(74,222,128,0.5),rgba(96,165,250,0.5),rgba(168,85,247,0.5),rgba(239,68,68,0.5))]",
  purple_haze:         "animate-pulse [background:radial-gradient(circle_at_center,rgba(168,85,247,0.45)_0%,rgba(192,132,252,0.2)_40%,transparent_70%)]",
  aura_blood:          "animate-pulse [background:radial-gradient(circle_at_center,rgba(127,29,29,0.55)_0%,rgba(185,28,28,0.3)_40%,transparent_70%)]",
  aura_neon:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(168,85,247,0.5)_0%,rgba(232,121,249,0.3)_40%,transparent_70%)]",
  aura_dark:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(17,24,39,0.6)_0%,rgba(88,28,135,0.3)_40%,transparent_70%)]",
  aura_shadow:         "animate-pulse [background:radial-gradient(circle_at_center,rgba(17,24,39,0.55)_0%,rgba(55,65,81,0.3)_40%,transparent_70%)]",
  aura_holy:           "animate-pulse [background:radial-gradient(circle_at_center,rgba(254,249,195,0.6)_0%,rgba(255,255,255,0.3)_40%,transparent_70%)]",
  dark_matter:         "animate-pulse [background:radial-gradient(circle_at_center,rgba(17,24,39,0.55)_0%,rgba(31,41,55,0.3)_40%,transparent_70%)]",
  aura_galaxy:         "animate-spin [background:conic-gradient(rgba(49,46,129,0.5),rgba(88,28,135,0.5),rgba(30,64,175,0.5),rgba(49,46,129,0.5))]",
  infernal:            "animate-pulse [background:radial-gradient(circle_at_center,rgba(234,88,12,0.55)_0%,rgba(220,38,38,0.3)_40%,transparent_70%)]",
  cosmic:              "animate-pulse [background:radial-gradient(circle_at_center,rgba(49,46,129,0.55)_0%,rgba(168,85,247,0.3)_40%,transparent_70%)]",
  halo_rainbow_master: "animate-spin [background:conic-gradient(rgba(236,72,153,0.55),rgba(250,204,21,0.55),rgba(168,85,247,0.55),rgba(236,72,153,0.55))]",
  halo_black_gold:     "animate-pulse [background:radial-gradient(circle_at_center,rgba(251,191,36,0.55)_0%,rgba(28,25,23,0.4)_50%,transparent_70%)]",
  halo_conqueror:      "animate-pulse [background:radial-gradient(circle_at_center,rgba(239,68,68,0.55)_0%,rgba(249,115,22,0.35)_40%,transparent_70%)]",
  halo_galaxy_master:  "animate-spin [background:conic-gradient(rgba(30,27,75,0.55),rgba(79,70,229,0.55),rgba(124,58,237,0.55),rgba(30,27,75,0.55))]",
  divine:              "animate-pulse [background:radial-gradient(circle_at_center,rgba(252,211,77,0.6)_0%,rgba(253,230,138,0.3)_40%,transparent_70%)]",
  void_emperor:        "animate-pulse [background:radial-gradient(circle_at_center,rgba(0,0,0,0.7)_0%,rgba(88,28,135,0.4)_40%,transparent_70%)]",
};

/** Custom animation durations for spin-based auras */
export const AURA_SPIN_DURATIONS: Record<string, string> = {
  aura_rainbow:        "3s",
  aura_galaxy:         "4s",
  cosmic:              "5s",
  void_emperor:        "6s",
  halo_rainbow_master: "3s",
  halo_galaxy_master:  "4s",
};

/** Keys for multi-layer master auras rendered via MasterAuraOverlay */
export const MASTER_AURA_KEYS: readonly string[] = [
  "halo_rainbow_master",
  "halo_black_gold",
  "halo_conqueror",
  "halo_galaxy_master",
];

/** Gradient colors for the option-grid preview thumbnail */
export const AURA_PREVIEW_GRADIENTS: Record<string, string> = {
  none:                "bg-gradient-to-t from-gray-200 to-gray-100",
  soft_glow:           "bg-gradient-to-t from-white/50 to-gray-100",
  aura_fire:           "bg-gradient-to-t from-orange-600 to-yellow-400",
  aura_ice:            "bg-gradient-to-t from-cyan-300 to-blue-200",
  blue_flame:          "bg-gradient-to-t from-blue-500 to-blue-200",
  green_energy:        "bg-gradient-to-t from-emerald-500 to-emerald-200",
  aura_lightning:      "bg-gradient-to-t from-yellow-300 to-white",
  aura_sakura:         "bg-gradient-to-t from-pink-400 to-pink-100",
  red_rage:            "bg-gradient-to-t from-red-600 to-red-300",
  aura_gold:           "bg-gradient-to-t from-yellow-600 to-yellow-200",
  golden_aura:         "bg-gradient-to-t from-amber-400 to-amber-200",
  aura_rainbow:        "bg-gradient-to-r from-red-500 via-green-400 to-purple-500",
  purple_haze:         "bg-gradient-to-t from-purple-500 to-purple-200",
  aura_blood:          "bg-gradient-to-t from-red-900 to-red-500",
  aura_neon:           "bg-gradient-to-t from-purple-600 to-pink-300",
  aura_dark:           "bg-gradient-to-t from-gray-900 to-purple-900",
  aura_shadow:         "bg-gradient-to-t from-gray-900 to-gray-500",
  aura_holy:           "bg-gradient-to-t from-yellow-100 to-white",
  dark_matter:         "bg-gradient-to-t from-gray-900 to-gray-700",
  aura_galaxy:         "bg-gradient-to-r from-purple-900 to-indigo-600",
  infernal:            "bg-gradient-to-t from-orange-600 to-red-500",
  cosmic:              "bg-gradient-to-t from-indigo-900 to-purple-500",
  halo_rainbow_master: "bg-gradient-to-r from-pink-500 via-yellow-400 to-purple-600",
  halo_black_gold:     "bg-gradient-to-r from-amber-600 via-yellow-300 to-stone-900",
  halo_conqueror:      "bg-gradient-to-r from-red-600 via-orange-500 to-red-900",
  halo_galaxy_master:  "bg-gradient-to-r from-indigo-900 via-purple-600 to-blue-800",
  divine:              "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400",
  void_emperor:        "bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900",
};

/** League order for lock checks */
export const CUSTOMIZATION_LEAGUE_ORDER: Record<string, number> = {
  white: 0, blue: 1, red: 2, black: 3, legend: 4,
};

/** Rarity display config */
export const RARITY_CONFIG: Record<ItemRarity, { label: string; border: string; bg: string }> = {
  common:    { label: "일반", border: "border-border",      bg: "bg-muted/50" },
  uncommon:  { label: "고급", border: "border-blue-400",    bg: "bg-blue-400/10" },
  rare:      { label: "희귀", border: "border-primary",     bg: "bg-primary/10" },
  epic:      { label: "에픽", border: "border-purple-500",  bg: "bg-purple-500/10" },
  legendary: { label: "전설", border: "border-amber-400",   bg: "bg-amber-400/10" },
};

export const NAMEPLATE_STYLES: Record<string, string> = {
  default: "",
  bronze: "px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-200 border border-amber-500/40",
  silver: "px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-100 border border-slate-300/40",
  gold: "px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200 border border-yellow-300/40",
  neon: "px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-300/40 shadow-[0_0_12px_rgba(34,211,238,0.35)]",
  purple: "px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-300/40 shadow-[0_0_12px_rgba(217,70,239,0.3)]",
  blackgold: "px-2 py-0.5 rounded-full bg-black/70 text-yellow-300 border border-yellow-500/50",
};



export const AURA_RADIAL_STYLES: Record<string, string> = {
  // ── White ──
  soft_glow: "radial-gradient(circle, rgba(255,255,255,0.25), rgba(255,255,255,0.05), transparent 70%)",
  // ── Blue ──
  aura_fire: "radial-gradient(circle, rgba(239,68,68,0.45), rgba(249,115,22,0.25), transparent 70%)",
  aura_ice: "radial-gradient(circle, rgba(59,130,246,0.45), rgba(125,211,252,0.25), transparent 70%)",
  blue_flame: "radial-gradient(circle, rgba(59,130,246,0.5), rgba(96,165,250,0.25), transparent 70%)",
  green_energy: "radial-gradient(circle, rgba(16,185,129,0.45), rgba(52,211,153,0.2), transparent 70%)",
  aura_lightning: "radial-gradient(circle, rgba(250,204,21,0.45), rgba(255,255,255,0.22), transparent 70%)",
  aura_sakura: "radial-gradient(circle, rgba(244,114,182,0.4), rgba(251,207,232,0.2), transparent 70%)",
  // ── Red ──
  red_rage: "radial-gradient(circle, rgba(220,38,38,0.5), rgba(239,68,68,0.25), transparent 70%)",
  aura_gold: "radial-gradient(circle, rgba(234,179,8,0.45), rgba(250,204,21,0.2), transparent 70%)",
  golden_aura: "radial-gradient(circle, rgba(245,158,11,0.5), rgba(252,211,77,0.25), transparent 70%)",
  aura_rainbow: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
  purple_haze: "radial-gradient(circle, rgba(139,92,246,0.45), rgba(196,181,253,0.2), transparent 70%)",
  aura_blood: "radial-gradient(circle, rgba(153,27,27,0.5), rgba(220,38,38,0.25), transparent 70%)",
  aura_neon: "radial-gradient(circle, rgba(0,255,136,0.4), rgba(0,204,255,0.25), transparent 70%)",
  // ── Black ──
  aura_dark: "radial-gradient(circle, rgba(30,30,30,0.55), rgba(75,0,130,0.25), transparent 70%)",
  aura_shadow: "radial-gradient(circle, rgba(15,23,42,0.5), rgba(51,65,85,0.25), transparent 70%)",
  aura_holy: "radial-gradient(circle, rgba(255,255,224,0.5), rgba(253,230,138,0.25), transparent 70%)",
  dark_matter: "radial-gradient(circle, rgba(17,0,51,0.55), rgba(88,28,135,0.3), transparent 70%)",
  aura_galaxy: "conic-gradient(from 0deg, #4f46e5, #7c3aed, #0f172a, #1d4ed8, #7c3aed, #0f172a, #4f46e5)",
  infernal: "radial-gradient(circle, rgba(180,16,0,0.55), rgba(255,69,0,0.3), rgba(255,165,0,0.15), transparent 70%)",
  cosmic: "conic-gradient(from 0deg, #1e1b4b, #7c3aed, #06b6d4, #1e1b4b, #a855f7, #0ea5e9, #1e1b4b)",
  // ── Legend ──
  divine: "radial-gradient(circle, rgba(255,223,0,0.55), rgba(255,255,224,0.3), rgba(255,215,0,0.15), transparent 70%)",
  void_emperor: "conic-gradient(from 0deg, #0a0015, #4c1d95, #000000, #7c3aed, #0a0015, #3b0764, #0a0015)",
};
