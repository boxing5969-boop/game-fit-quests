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
  halo?: string;
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
  { key: "daisy",        label: "데이지",     price: 300,   league: "white", rarity: "common",   description: "하얀 데이지꽃이 피어나는 효과" },
  { key: "sunflower",    label: "해바라기",   price: 400,   league: "white", rarity: "common",   description: "해바라기가 반짝이는 효과" },
  // ── Blue (500–2000) ────────────────────────────────────────
  { key: "lightning",    label: "번개",       price: 800,   league: "blue",  rarity: "uncommon", description: "번개 스파크 이펙트" },
  { key: "snow",         label: "눈송이",     price: 800,   league: "blue",  rarity: "uncommon", description: "눈이 내리는 효과" },
  { key: "cherry",       label: "벚꽃",       price: 1000,  league: "blue",  rarity: "uncommon", description: "벚꽃잎이 흩날리는 효과" },
  { key: "tulip",        label: "튤립",       price: 1000,  league: "blue",  rarity: "uncommon", description: "알록달록 튤립이 흩날리는 효과" },
  { key: "hibiscus",     label: "히비스커스", price: 1200,  league: "blue",  rarity: "uncommon", description: "빨간 히비스커스가 피어나는 효과" },
  { key: "music",        label: "음표",       price: 1000,  league: "blue",  rarity: "uncommon", description: "음표가 떠다니는 효과" },
  { key: "firework",     label: "폭죽",       price: 1200,  league: "blue",  rarity: "uncommon", description: "축하 폭죽 이펙트" },
  // ── Red (2000–5000) ────────────────────────────────────────
  { key: "tornado",      label: "회오리",     price: 3000,  league: "red",   rarity: "rare",     description: "강력한 회오리 이펙트" },
  { key: "comet",        label: "혜성",       price: 3000,  league: "red",   rarity: "rare",     description: "혜성이 스쳐 지나가는 효과" },
  { key: "rainbow",      label: "무지개",     price: 3500,  league: "red",   rarity: "rare",     description: "무지개 빛 파티클" },
  { key: "rose",         label: "장미",       price: 3000,  league: "red",   rarity: "rare",     description: "빨간 장미가 흩뿌려지는 효과" },
  { key: "bouquet",      label: "꽃다발",     price: 4000,  league: "red",   rarity: "rare",     description: "화려한 꽃다발이 피어나는 효과" },
  { key: "explosion",    label: "폭발",       price: 3500,  league: "red",   rarity: "rare",     description: "펀치 폭발 이펙트" },
  { key: "ghost",        label: "유령",       price: 4000,  league: "red",   rarity: "rare",     description: "유령이 떠다니는 효과" },
  { key: "star_shoot",   label: "별똥별",     price: 4000,  league: "red",   rarity: "rare",     description: "별똥별이 쏟아지는 효과" },
  // ── Black (5000–15000) ─────────────────────────────────────
  { key: "crown_effect", label: "왕관빛",     price: 5000,  league: "black", rarity: "epic",     description: "왕관에서 빛이 뿜어나오는 효과", blackOnly: true },
  { key: "dragon",       label: "드래곤",     price: 8000,  league: "black", rarity: "epic",     description: "드래곤 브레스 이펙트", blackOnly: true },
  { key: "phoenix",      label: "피닉스",     price: 10000, league: "black", rarity: "epic",     description: "불사조 날갯짓 이펙트", blackOnly: true },
  { key: "skull",        label: "해골",       price: 12000, league: "black", rarity: "epic",     description: "해골 불꽃 이펙트", blackOnly: true },
  { key: "diamond_rain", label: "다이아 비",  price: 15000, league: "black", rarity: "epic",     description: "다이아몬드가 쏟아지는 효과", blackOnly: true },
  { key: "inferno_dual", label: "쌍염화",     price: 18000, league: "black", rarity: "epic",     description: "빨강+파랑 쌍불꽃이 교차하는 이펙트", blackOnly: true },
  { key: "thunder_god",  label: "뇌신",       price: 20000, league: "black", rarity: "epic",     description: "천둥번개가 연속으로 치는 이펙트", blackOnly: true },
  { key: "cosmic_dust",  label: "우주먼지",   price: 22000, league: "black", rarity: "epic",     description: "별가루가 반짝이며 흩날리는 이펙트", blackOnly: true },
  { key: "sword_aura",   label: "검기",       price: 25000, league: "black", rarity: "epic",     description: "검 기운이 감도는 이펙트", blackOnly: true },
  { key: "dark_flame",   label: "흑염",       price: 30000, league: "black", rarity: "epic",     description: "검은 불꽃이 타오르는 이펙트", blackOnly: true },
  { key: "lotus",        label: "연꽃",       price: 10000, league: "black", rarity: "epic",     description: "신비로운 연꽃이 피어나는 이펙트", blackOnly: true },
  { key: "sakura_storm", label: "벚꽃폭풍",   price: 15000, league: "black", rarity: "epic",     description: "벚꽃잎이 폭풍처럼 휘몰아치는 이펙트", blackOnly: true },
  { key: "rose_gold",    label: "로즈골드",   price: 20000, league: "black", rarity: "epic",     description: "황금빛 장미가 화려하게 피어나는 이펙트", blackOnly: true },
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
  { key: "rookie",            label: "루키",               price: 0,      league: "white", rarity: "common",    description: "첫걸음을 뗀 복서" },
  { key: "rookie_challenger", label: "신입 챌린저",         price: 0,      league: "white", rarity: "common",    description: "입단식을 마친 신입 챌린저 — 튜토리얼 완료 보상" },
  { key: "beginner",          label: "초보",               price: 0,      league: "white", rarity: "common",    description: "성장하는 초보 복서" },
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
  // ── Legend (명예의 전당 전용, 120000~180000) ──────────────────────
  { key: "eternal_153",     label: "ETERNAL 153",        price: 120000, league: "legend", rarity: "legendary", description: "153의 영원한 전설", requirement: "hall_of_fame" },
  { key: "king_of_ring",    label: "킹 오브 더 링",     price: 150000, league: "legend", rarity: "legendary", description: "링의 절대 지배자", requirement: "hall_of_fame" },
  { key: "god_fist",        label: "갓피스트",           price: 180000, league: "legend", rarity: "legendary", description: "신의 주먹", requirement: "hall_of_fame" },
];

// ===== AURA OPTIONS (상점용) =====
const AURA_OPTIONS: CustomizationOption[] = [
  // ⬜ White
  { key: "none",           label: "없음",         price: 0,      league: "white",  rarity: "common",    description: "오라 없음" },
  { key: "soft_glow",      label: "은은한 빛",    price: 300,    league: "white",  rarity: "common",    description: "부드러운 빛 오라" },
  { key: "aura_mint",      label: "민트 오라",    price: 400,    league: "white",  rarity: "common",    description: "상쾌한 민트 빛" },
  // 🔵 Blue
  { key: "aura_fire",      label: "불꽃 오라",    price: 800,    league: "blue",  rarity: "uncommon",  description: "불꽃이 타오르는 오라" },
  { key: "aura_ice",       label: "얼음 오라",    price: 800,    league: "blue",  rarity: "uncommon",  description: "차가운 얼음 오라" },
  { key: "aura_sakura",    label: "벚꽃 오라",    price: 1000,   league: "blue",  rarity: "uncommon",  description: "벚꽃잎이 흩날리는 오라" },
  { key: "aura_ocean",     label: "오션 오라",    price: 1200,   league: "blue",  rarity: "uncommon",  description: "깊은 바다의 오라" },
  { key: "aura_lightning", label: "번개 오라",    price: 1500,   league: "blue",  rarity: "uncommon",  description: "번개가 치는 오라" },
  { key: "aura_emerald",   label: "에메랄드 오라", price: 1500,  league: "blue",  rarity: "uncommon",  description: "에메랄드빛 오라" },
  // 🔴 Red
  { key: "aura_blood",     label: "블러드 오라",  price: 3000,   league: "red",   rarity: "rare",      description: "핏빛 오라" },
  { key: "aura_sunset",    label: "석양 오라",    price: 3500,   league: "red",   rarity: "rare",      description: "노을빛 그라데이션 오라" },
  { key: "aura_rainbow",   label: "무지개 오라",  price: 4000,   league: "red",   rarity: "rare",      description: "무지개빛 오라" },
  { key: "aura_neon",      label: "네온 오라",    price: 5000,   league: "red",   rarity: "rare",      description: "네온 사인 오라" },
  { key: "aura_galaxy",    label: "은하 오라",    price: 8000,   league: "red",   rarity: "rare",      description: "은하계 오라" },
  // ⚫ Black
  { key: "aura_dark",        label: "어둠 오라",     price: 10000, league: "black", rarity: "epic",      description: "어둠의 오라", blackOnly: true },
  { key: "aura_infernal",    label: "인퍼널 오라",   price: 12000, league: "black", rarity: "epic",      description: "지옥불 오라", blackOnly: true },
  { key: "aura_phantom",     label: "팬텀 오라",     price: 12000, league: "black", rarity: "epic",      description: "유령빛 오라", blackOnly: true },
  { key: "halo_black_gold",  label: "황금 헤일로",   price: 15000, league: "black", rarity: "epic",      description: "블랙 골드 헤일로", blackOnly: true },
  { key: "aura_void",        label: "보이드 오라",   price: 18000, league: "black", rarity: "epic",      description: "공허의 오라", blackOnly: true },
  // 👑 Legend
  { key: "halo_rainbow_master", label: "마스터 헤일로",  price: 240000, league: "legend", rarity: "legendary", description: "무지개 마스터 오라", requirement: "hall_of_fame" },
  { key: "divine",              label: "신성 오라",      price: 280000, league: "legend", rarity: "legendary", description: "신성한 빛의 오라", requirement: "hall_of_fame" },
  { key: "aura_celestial",      label: "천체 오라",      price: 320000, league: "legend", rarity: "legendary", description: "별과 우주의 오라", requirement: "hall_of_fame" },
];

// ===== HALO OPTIONS (마스터 전용 후광) =====
export const HALO_OPTIONS: CustomizationOption[] = [
  { key: "none",           label: "없음",         price: 0,      league: "black", rarity: "epic",      description: "후광 없음", blackOnly: true },
  { key: "halo_rainbow",   label: "무지개 후광",  price: 0,      league: "black", rarity: "epic",      description: "무지개빛이 회전하는 후광", blackOnly: true },
  { key: "halo_saiyan",    label: "초사이어인",   price: 30000,  league: "black", rarity: "epic",      description: "폭발하는 황금빛 기운", blackOnly: true },
  { key: "halo_eclipse",   label: "이클립스",     price: 35000,  league: "black", rarity: "epic",      description: "일식처럼 타오르는 코로나", blackOnly: true },
  { key: "halo_emperor",   label: "황제의 위엄",  price: 50000,  league: "black", rarity: "epic",      description: "보라+금빛 황제의 후광", blackOnly: true },
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
  inferno_dual: "🔥",
  thunder_god:  "⛈️",
  cosmic_dust:  "🌌",
  sword_aura:   "⚔️",
  dark_flame:   "🖤",
  daisy:        "🌼",
  sunflower:    "🌻",
  tulip:        "🌷",
  hibiscus:     "🌺",
  rose:         "🌹",
  bouquet:      "💐",
  lotus:        "🪷",
  sakura_storm: "🌸",
  rose_gold:    "🌹",
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

// ══════════════════════════════════════════════════
// ══ AURA SYSTEM v2 ═══════════════════════════════
// ══════════════════════════════════════════════════

// ── 타입 정의 ──

export interface AuraTier {
  layers: AuraLayer[];
  sparkles?: boolean;
  holo?: boolean;
}

export interface AuraLayer {
  background: string;
  animation: string;
  opacity: number;
  insetOffset: number;
  zIndex: number;
  mask?: string;
}

// ── 크기별 기본 inset ──

export const AURA_INSET: Record<string, number> = {
  sm: -3,
  md: -5,
  lg: -7,
};

// ── 오라 정의 (리그/등급별 차등 화려함) ──

export const AURA_CONFIG: Record<string, AuraTier> = {

  // ─── ⬜ WHITE 리그 — 1레이어 ───
  none: { layers: [] },

  soft_glow: {
    layers: [{
      background: "radial-gradient(circle, rgba(255,255,255,0.4), rgba(255,255,255,0.15), transparent 60%)",
      animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
      opacity: 0.7,
      insetOffset: 0,
      zIndex: 2,
    }],
  },

  aura_mint: {
    layers: [{
      background: "radial-gradient(circle, rgba(110,231,183,0.45), rgba(52,211,153,0.2), transparent 60%)",
      animation: "animate-[aura-pulse-slow_3.5s_ease-in-out_infinite]",
      opacity: 0.7,
      insetOffset: 0,
      zIndex: 2,
    }],
  },

  // ─── 🔵 BLUE 리그 — 2레이어 ───
  aura_fire: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(239,68,68,0.7), rgba(249,115,22,0.35), transparent 62%)",
        animation: "animate-[aura-pulse-fast_2s_ease-in-out_infinite]",
        opacity: 0.8,
        insetOffset: 0,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(249,115,22,0.3), rgba(239,68,68,0.1), transparent 55%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 3,
        zIndex: 1,
      },
    ],
  },

  aura_ice: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(34,211,238,0.65), rgba(59,130,246,0.3), transparent 62%)",
        animation: "animate-[aura-pulse-slow_2.5s_ease-in-out_infinite]",
        opacity: 0.8,
        insetOffset: 0,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(147,197,253,0.25), rgba(59,130,246,0.1), transparent 55%)",
        animation: "animate-[aura-pulse-fast_3.5s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 3,
        zIndex: 1,
      },
    ],
  },

  aura_sakura: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(244,114,182,0.6), rgba(251,207,232,0.3), transparent 62%)",
        animation: "animate-[aura-pulse-slow_2.8s_ease-in-out_infinite]",
        opacity: 0.8,
        insetOffset: 0,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(253,164,175,0.25), rgba(244,114,182,0.1), transparent 55%)",
        animation: "animate-[aura-pulse-fast_3.2s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 3,
        zIndex: 1,
      },
    ],
  },

  aura_ocean: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(14,165,233,0.65), rgba(56,189,248,0.3), transparent 62%)",
        animation: "animate-[aura-pulse-fast_2.2s_ease-in-out_infinite]",
        opacity: 0.8,
        insetOffset: 0,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(125,211,252,0.3), rgba(14,165,233,0.1), transparent 55%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.45,
        insetOffset: 3,
        zIndex: 1,
      },
    ],
  },

  aura_lightning: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(250,204,21,0.95), rgba(253,224,71,0.5), transparent 58%)",
        animation: "animate-[aura-flicker_0.3s_ease-in-out_infinite]",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(254,240,138,0.4), rgba(250,204,21,0.15), transparent 52%)",
        animation: "animate-[aura-pulse-fast_1s_ease-in-out_infinite]",
        opacity: 0.6,
        insetOffset: 4,
        zIndex: 2,
      },
    ],
  },

  aura_emerald: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(16,185,129,0.65), rgba(52,211,153,0.3), transparent 62%)",
        animation: "animate-[aura-pulse-fast_2.5s_ease-in-out_infinite]",
        opacity: 0.8,
        insetOffset: 0,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(110,231,183,0.3), rgba(16,185,129,0.1), transparent 55%)",
        animation: "animate-[aura-pulse-slow_3.5s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 3,
        zIndex: 1,
      },
    ],
  },

  // ─── 🔴 RED 리그 — 3레이어 ───
  aura_blood: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(153,27,27,0.8), rgba(220,38,38,0.4), transparent 62%)",
        animation: "animate-[aura-pulse-fast_1.8s_ease-in-out_infinite]",
        opacity: 0.85,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(239,68,68,0.4), rgba(153,27,27,0.15), transparent 55%)",
        animation: "animate-[aura-pulse-slow_2.5s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 3,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(185,28,28,0.2), transparent 45%)",
        animation: "animate-[aura-dark-wave_3s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 0,
        zIndex: 1,
      },
    ],
  },

  aura_sunset: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(251,146,60,0.7), rgba(244,63,94,0.4), transparent 62%)",
        animation: "animate-[aura-pulse-fast_2s_ease-in-out_infinite]",
        opacity: 0.85,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(253,186,116,0.35), rgba(251,113,133,0.2), transparent 55%)",
        animation: "animate-[aura-spin-slow_8s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.45,
        insetOffset: 4,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(254,215,170,0.2), transparent 45%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 0,
        zIndex: 1,
      },
    ],
  },

  aura_rainbow: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(255,107,107,0.5), rgba(254,202,87,0.4), rgba(72,219,251,0.3), transparent 62%)",
        animation: "animate-[aura-spin-slow_3s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.85,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(255,159,243,0.35), rgba(84,160,255,0.2), transparent 55%)",
        animation: "animate-[aura-spin-reverse_5s_linear_infinite]",
        opacity: 0.4,
        insetOffset: 4,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.2), transparent 45%)",
        animation: "animate-[aura-pulse-slow_2s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 0,
        zIndex: 1,
      },
    ],
  },

  aura_neon: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(0,255,136,0.7), rgba(0,204,255,0.4), transparent 62%)",
        animation: "animate-[aura-flicker_0.5s_ease-in-out_infinite]",
        opacity: 0.85,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(0,204,255,0.35), rgba(168,85,247,0.2), transparent 55%)",
        animation: "animate-[aura-pulse-fast_1.5s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 4,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(0,255,136,0.15), transparent 45%)",
        animation: "animate-[aura-pulse-slow_2.5s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 0,
        zIndex: 1,
      },
    ],
  },

  aura_galaxy: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(79,70,229,0.75), rgba(124,58,237,0.4), transparent 62%)",
        animation: "animate-[aura-spin-slow_4s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.9,
        insetOffset: 0,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(30,27,75,0.6), rgba(79,70,229,0.2), transparent 55%)",
        animation: "animate-[aura-spin-reverse_7s_linear_infinite]",
        opacity: 0.5,
        insetOffset: 4,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent 48%)",
        animation: "animate-[aura-pulse-fast_2.5s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 7,
        zIndex: 1,
      },
    ],
  },

  // ─── ⚫ BLACK 리그 — 4레이어 + 반짝임 ───
  aura_infernal: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(220,38,38,0.85), rgba(234,88,12,0.5), transparent 62%)",
        animation: "animate-[aura-dark-wave_1.8s_ease-in-out_infinite]",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(249,115,22,0.5), rgba(220,38,38,0.25), transparent 55%)",
        animation: "animate-[aura-pulse-fast_1.2s_ease-in-out_infinite]",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(251,146,60,0.3), rgba(234,88,12,0.15), transparent 50%)",
        animation: "animate-[aura-spin-slow_5s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.5,
        insetOffset: 6,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(253,186,116,0.15), transparent 42%)",
        animation: "animate-[aura-flicker_0.4s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 9,
        zIndex: 1,
      },
    ],
    sparkles: true,
  },

  aura_phantom: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(148,163,184,0.8), rgba(71,85,105,0.5), transparent 62%)",
        animation: "animate-[aura-dark-wave_2.5s_ease-in-out_infinite]",
        opacity: 0.9,
        insetOffset: 0,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(203,213,225,0.45), rgba(100,116,139,0.2), transparent 55%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.6,
        insetOffset: 3,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(226,232,240,0.3), rgba(148,163,184,0.15), transparent 50%)",
        animation: "animate-[aura-spin-reverse_8s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.45,
        insetOffset: 6,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent 42%)",
        animation: "animate-[aura-pulse-fast_2s_ease-in-out_infinite]",
        opacity: 0.3,
        insetOffset: 9,
        zIndex: 1,
      },
    ],
    sparkles: true,
  },

  aura_dark: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(88,28,135,0.85), rgba(17,24,39,0.7), transparent 62%)",
        animation: "animate-[aura-dark-wave_2s_ease-in-out_infinite]",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(124,58,237,0.5), rgba(88,28,135,0.25), transparent 55%)",
        animation: "animate-[aura-spin-slow_6s_linear_infinite]",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(139,92,246,0.3), rgba(17,24,39,0.2), transparent 50%)",
        animation: "animate-[aura-spin-reverse_9s_linear_infinite]",
        opacity: 0.5,
        insetOffset: 6,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(167,139,250,0.15), transparent 42%)",
        animation: "animate-[aura-pulse-fast_1.5s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 9,
        zIndex: 1,
      },
    ],
    sparkles: true,
  },

  halo_black_gold: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(251,191,36,0.9), rgba(120,53,15,0.6), transparent 62%)",
        animation: "animate-[aura-spin-slow_4s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(28,25,23,0.7), rgba(251,191,36,0.3), transparent 55%)",
        animation: "animate-[aura-spin-reverse_6s_linear_infinite]",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(251,191,36,0.35), rgba(120,53,15,0.15), transparent 50%)",
        animation: "animate-[aura-dark-wave_2.5s_ease-in-out_infinite]",
        opacity: 0.6,
        insetOffset: 6,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(254,215,170,0.2), transparent 42%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.4,
        insetOffset: 10,
        zIndex: 1,
      },
    ],
    sparkles: true,
  },

  aura_void: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(17,0,51,0.9), rgba(49,10,101,0.6), transparent 62%)",
        animation: "animate-[aura-dark-wave_2s_ease-in-out_infinite]",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(88,28,135,0.55), rgba(17,0,51,0.3), transparent 55%)",
        animation: "animate-[aura-spin-slow_7s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(124,58,237,0.3), rgba(49,10,101,0.15), transparent 50%)",
        animation: "animate-[aura-spin-reverse_10s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 0.5,
        insetOffset: 6,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(139,92,246,0.15), transparent 42%)",
        animation: "animate-[aura-pulse-fast_1.5s_ease-in-out_infinite]",
        opacity: 0.35,
        insetOffset: 9,
        zIndex: 1,
      },
    ],
    sparkles: true,
  },

  // ─── 👑 LEGEND — 5레이어 + 홀로그램 + 반짝임 ───
  halo_rainbow_master: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(255,107,107,0.7), rgba(254,202,87,0.5), rgba(72,219,251,0.4), transparent 60%)",
        animation: "animate-[aura-spin-slow_3s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 5,
      },
      {
        background: "radial-gradient(circle, rgba(255,159,243,0.5), rgba(84,160,255,0.3), transparent 52%)",
        animation: "animate-[aura-spin-reverse_4s_linear_infinite]",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(255,107,107,0.3), rgba(72,219,251,0.2), transparent 46%)",
        animation: "animate-[aura-spin-slow_6s_linear_infinite]",
        opacity: 0.5,
        insetOffset: 6,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.25), transparent 40%)",
        animation: "animate-[aura-pulse-fast_1.5s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 9,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 35%)",
        animation: "animate-[aura-pulse-slow_4s_ease-in-out_infinite]",
        opacity: 0.3,
        insetOffset: 13,
        zIndex: 1,
      },
    ],
    sparkles: true,
    holo: true,
  },

  divine: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(254,249,195,0.9), rgba(251,191,36,0.6), transparent 60%)",
        animation: "animate-[aura-spin-slow_2.5s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 5,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.6), rgba(253,230,138,0.35), transparent 52%)",
        animation: "animate-[aura-spin-reverse_3.5s_linear_infinite]",
        opacity: 0.8,
        insetOffset: 4,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(251,191,36,0.35), rgba(254,243,199,0.2), transparent 46%)",
        animation: "animate-[aura-spin-slow_5s_linear_infinite]",
        opacity: 0.6,
        insetOffset: 7,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.2), transparent 40%)",
        animation: "animate-[aura-dark-wave_2s_ease-in-out_infinite]",
        opacity: 0.5,
        insetOffset: 10,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(254,249,195,0.15), transparent 35%)",
        animation: "animate-[aura-pulse-fast_1.8s_ease-in-out_infinite]",
        opacity: 0.3,
        insetOffset: 14,
        zIndex: 1,
      },
    ],
    sparkles: true,
    holo: true,
  },

  aura_celestial: {
    layers: [
      {
        background: "radial-gradient(circle, rgba(99,102,241,0.7), rgba(168,85,247,0.5), rgba(14,165,233,0.3), transparent 60%)",
        animation: "animate-[aura-spin-slow_3.5s_linear_infinite]",
        mask: "radial-gradient(circle, black 45%, transparent 68%)",
        opacity: 1.0,
        insetOffset: 0,
        zIndex: 5,
      },
      {
        background: "radial-gradient(circle, rgba(56,189,248,0.5), rgba(139,92,246,0.3), transparent 52%)",
        animation: "animate-[aura-spin-reverse_5s_linear_infinite]",
        opacity: 0.7,
        insetOffset: 3,
        zIndex: 4,
      },
      {
        background: "radial-gradient(circle, rgba(192,132,252,0.35), rgba(99,102,241,0.2), transparent 46%)",
        animation: "animate-[aura-spin-slow_7s_linear_infinite]",
        opacity: 0.5,
        insetOffset: 6,
        zIndex: 3,
      },
      {
        background: "radial-gradient(circle, rgba(255,255,255,0.25), transparent 40%)",
        animation: "animate-[aura-pulse-fast_1.5s_ease-in-out_infinite]",
        opacity: 0.45,
        insetOffset: 9,
        zIndex: 2,
      },
      {
        background: "radial-gradient(circle, rgba(196,181,253,0.15), transparent 35%)",
        animation: "animate-[aura-pulse-slow_3s_ease-in-out_infinite]",
        opacity: 0.3,
        insetOffset: 13,
        zIndex: 1,
      },
    ],
    sparkles: true,
    holo: true,
  },
};

// ══════════════════════════════════════════════════
// ══ HALO SYSTEM (마스터 전용 후광) ═══════════════
// ══════════════════════════════════════════════════

export interface HaloConfig {
  rings: HaloRing[];
  glowColor: string;
  glowOpacity: number;
  sparkleColor?: string;
}

export interface HaloRing {
  gradient: string;
  mask: string;
  animation: string;
  inset: string;
  opacity: number;
}

export const HALO_CONFIGS: Record<string, HaloConfig> = {
  // ─── 무지개 후광 (기존 마스터 후광) ───
  halo_rainbow: {
    rings: [
      {
        gradient: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
        mask: "radial-gradient(circle, transparent 42%, black 47%, black 68%, transparent 73%)",
        animation: "animate-[aura-spin-slow_6s_linear_infinite]",
        inset: "-8px",
        opacity: 0.5,
      },
      {
        gradient: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
        mask: "radial-gradient(circle, transparent 58%, black 62%, black 72%, transparent 76%)",
        animation: "animate-[aura-spin-slow_8s_linear_infinite]",
        inset: "0px",
        opacity: 0.6,
      },
      {
        gradient: "conic-gradient(from 180deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
        mask: "radial-gradient(circle, transparent 62%, black 66%, black 74%, transparent 78%)",
        animation: "animate-[aura-spin-reverse_12s_linear_infinite]",
        inset: "3px",
        opacity: 0.35,
      },
    ],
    glowColor: "rgba(147,51,234,0.4)",
    glowOpacity: 0.3,
    sparkleColor: "white",
  },

  // ─── 초사이어인 (황금 폭발 기운) ───
  halo_saiyan: {
    rings: [
      {
        gradient: "conic-gradient(from 0deg, #fbbf24, #fef3c7, #f59e0b, #fde68a, #fbbf24)",
        mask: "radial-gradient(circle, transparent 38%, black 44%, black 70%, transparent 76%)",
        animation: "animate-[aura-spin-slow_3s_linear_infinite]",
        inset: "-10px",
        opacity: 0.7,
      },
      {
        gradient: "conic-gradient(from 120deg, #f59e0b, #fbbf24, #fef3c7, #f59e0b)",
        mask: "radial-gradient(circle, transparent 50%, black 55%, black 68%, transparent 74%)",
        animation: "animate-[aura-spin-reverse_4s_linear_infinite]",
        inset: "-4px",
        opacity: 0.55,
      },
      {
        gradient: "radial-gradient(circle, rgba(251,191,36,0.8), rgba(245,158,11,0.4), transparent 70%)",
        mask: "radial-gradient(circle, transparent 55%, black 60%, black 72%, transparent 78%)",
        animation: "animate-[aura-flicker_0.3s_ease-in-out_infinite]",
        inset: "0px",
        opacity: 0.5,
      },
    ],
    glowColor: "rgba(251,191,36,0.5)",
    glowOpacity: 0.4,
    sparkleColor: "#fef3c7",
  },

  // ─── 이클립스 (일식 코로나) ───
  halo_eclipse: {
    rings: [
      {
        gradient: "conic-gradient(from 0deg, #0f172a, #dc2626, #f97316, #fbbf24, #f97316, #dc2626, #0f172a)",
        mask: "radial-gradient(circle, transparent 40%, black 46%, black 72%, transparent 78%)",
        animation: "animate-[aura-spin-slow_8s_linear_infinite]",
        inset: "-10px",
        opacity: 0.65,
      },
      {
        gradient: "conic-gradient(from 180deg, #fbbf24, #f97316, #dc2626, #0f172a, #dc2626, #f97316, #fbbf24)",
        mask: "radial-gradient(circle, transparent 52%, black 57%, black 68%, transparent 74%)",
        animation: "animate-[aura-spin-reverse_12s_linear_infinite]",
        inset: "-2px",
        opacity: 0.45,
      },
      {
        gradient: "radial-gradient(circle, rgba(15,23,42,0.9), rgba(220,38,38,0.3), transparent 70%)",
        mask: "radial-gradient(circle, transparent 56%, black 60%, black 70%, transparent 76%)",
        animation: "animate-[aura-dark-wave_2s_ease-in-out_infinite]",
        inset: "2px",
        opacity: 0.5,
      },
    ],
    glowColor: "rgba(220,38,38,0.4)",
    glowOpacity: 0.3,
    sparkleColor: "#fbbf24",
  },

  // ─── 황제의 위엄 (보라+금빛) ───
  halo_emperor: {
    rings: [
      {
        gradient: "conic-gradient(from 0deg, #7c3aed, #fbbf24, #4f46e5, #fbbf24, #7c3aed)",
        mask: "radial-gradient(circle, transparent 40%, black 46%, black 70%, transparent 76%)",
        animation: "animate-[aura-spin-slow_5s_linear_infinite]",
        inset: "-10px",
        opacity: 0.65,
      },
      {
        gradient: "conic-gradient(from 90deg, #fbbf24, #7c3aed, #fbbf24, #4f46e5, #fbbf24)",
        mask: "radial-gradient(circle, transparent 54%, black 58%, black 68%, transparent 74%)",
        animation: "animate-[aura-spin-reverse_7s_linear_infinite]",
        inset: "-2px",
        opacity: 0.5,
      },
      {
        gradient: "conic-gradient(from 180deg, #4f46e5, #fbbf24, #7c3aed, #fbbf24, #4f46e5)",
        mask: "radial-gradient(circle, transparent 60%, black 64%, black 72%, transparent 76%)",
        animation: "animate-[aura-spin-slow_10s_linear_infinite]",
        inset: "2px",
        opacity: 0.35,
      },
    ],
    glowColor: "rgba(124,58,237,0.45)",
    glowOpacity: 0.35,
    sparkleColor: "#fbbf24",
  },
};
