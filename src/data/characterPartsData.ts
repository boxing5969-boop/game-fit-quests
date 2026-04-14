/**
 * Character Parts Data — 81 total parts across 12 categories
 * Each part defines SVG rendering config used by LayeredCharacterRenderer
 */

export interface CharacterPart {
  key: string;
  category: string;
  label: string;
  gender: "male" | "female" | "neutral";
  config: Record<string, any>;
  sortOrder: number;
}

// ========== SKIN TONES (5) ==========
export const SKIN_PARTS: CharacterPart[] = [
  { key: "skin_light", category: "skin", label: "밝은 피부", gender: "neutral", sortOrder: 0, config: { fill: "#FFE0BD", shadow: "#E8C9A4" } },
  { key: "skin_fair", category: "skin", label: "밝은 살구", gender: "neutral", sortOrder: 1, config: { fill: "#F5D0A9", shadow: "#D4B08C" } },
  { key: "skin_medium", category: "skin", label: "중간 피부", gender: "neutral", sortOrder: 2, config: { fill: "#D4A574", shadow: "#B8895C" } },
  { key: "skin_tan", category: "skin", label: "탄 피부", gender: "neutral", sortOrder: 3, config: { fill: "#C68642", shadow: "#A66E30" } },
  { key: "skin_dark", category: "skin", label: "어두운 피부", gender: "neutral", sortOrder: 4, config: { fill: "#8D5524", shadow: "#6E3F1A" } },
];

// ========== HAIR BACK (8) ==========
export const HAIR_BACK_PARTS: CharacterPart[] = [
  { key: "hb_short_black", category: "hair_back", label: "숏컷 블랙", gender: "neutral", sortOrder: 0, config: { style: "short", fill: "#1A1A2E", highlight: "#2D2D44" } },
  { key: "hb_short_brown", category: "hair_back", label: "숏컷 브라운", gender: "neutral", sortOrder: 1, config: { style: "short", fill: "#5C3317", highlight: "#7A4B2A" } },
  { key: "hb_medium_black", category: "hair_back", label: "미디엄 블랙", gender: "neutral", sortOrder: 2, config: { style: "medium", fill: "#1A1A2E", highlight: "#2D2D44" } },
  { key: "hb_medium_blonde", category: "hair_back", label: "미디엄 금발", gender: "neutral", sortOrder: 3, config: { style: "medium", fill: "#D4A017", highlight: "#E8B830" } },
  { key: "hb_long_pink", category: "hair_back", label: "롱 핑크", gender: "female", sortOrder: 4, config: { style: "long", fill: "#FF69B4", highlight: "#FF85C8" } },
  { key: "hb_long_silver", category: "hair_back", label: "롱 실버", gender: "neutral", sortOrder: 5, config: { style: "long", fill: "#C0C0C0", highlight: "#E0E0E0" } },
  { key: "hb_spiky_blue", category: "hair_back", label: "스파이키 블루", gender: "male", sortOrder: 6, config: { style: "spiky", fill: "#2E5BFF", highlight: "#5B82FF" } },
  { key: "hb_spiky_orange", category: "hair_back", label: "스파이키 오렌지", gender: "male", sortOrder: 7, config: { style: "spiky", fill: "#FF6B35", highlight: "#FF8B5E" } },
];

// ========== HAIR FRONT (8) ==========
export const HAIR_FRONT_PARTS: CharacterPart[] = [
  { key: "hf_bangs_black", category: "hair_front", label: "앞머리 블랙", gender: "neutral", sortOrder: 0, config: { style: "bangs", fill: "#1A1A2E", highlight: "#2D2D44" } },
  { key: "hf_bangs_brown", category: "hair_front", label: "앞머리 브라운", gender: "neutral", sortOrder: 1, config: { style: "bangs", fill: "#5C3317", highlight: "#7A4B2A" } },
  { key: "hf_side_blonde", category: "hair_front", label: "사이드 금발", gender: "neutral", sortOrder: 2, config: { style: "side", fill: "#D4A017", highlight: "#E8B830" } },
  { key: "hf_side_pink", category: "hair_front", label: "사이드 핑크", gender: "female", sortOrder: 3, config: { style: "side", fill: "#FF69B4", highlight: "#FF85C8" } },
  { key: "hf_swept_silver", category: "hair_front", label: "스웹트 실버", gender: "neutral", sortOrder: 4, config: { style: "swept", fill: "#C0C0C0", highlight: "#E0E0E0" } },
  { key: "hf_swept_blue", category: "hair_front", label: "스웹트 블루", gender: "male", sortOrder: 5, config: { style: "swept", fill: "#2E5BFF", highlight: "#5B82FF" } },
  { key: "hf_curly_orange", category: "hair_front", label: "컬리 오렌지", gender: "neutral", sortOrder: 6, config: { style: "curly", fill: "#FF6B35", highlight: "#FF8B5E" } },
  { key: "hf_curly_purple", category: "hair_front", label: "컬리 퍼플", gender: "neutral", sortOrder: 7, config: { style: "curly", fill: "#9B59B6", highlight: "#B07ACC" } },
];

// ========== EYEBROWS (6) ==========
export const EYEBROW_PARTS: CharacterPart[] = [
  { key: "eb_normal", category: "eyebrows", label: "기본", gender: "neutral", sortOrder: 0, config: { style: "normal", fill: "#333" } },
  { key: "eb_thick", category: "eyebrows", label: "굵은 눈썹", gender: "neutral", sortOrder: 1, config: { style: "thick", fill: "#222" } },
  { key: "eb_thin", category: "eyebrows", label: "얇은 눈썹", gender: "neutral", sortOrder: 2, config: { style: "thin", fill: "#444" } },
  { key: "eb_angry", category: "eyebrows", label: "화난 눈썹", gender: "neutral", sortOrder: 3, config: { style: "angry", fill: "#333" } },
  { key: "eb_arched", category: "eyebrows", label: "아치형", gender: "neutral", sortOrder: 4, config: { style: "arched", fill: "#333" } },
  { key: "eb_straight", category: "eyebrows", label: "일자 눈썹", gender: "neutral", sortOrder: 5, config: { style: "straight", fill: "#333" } },
];

// ========== EYES (8) ==========
export const EYE_PARTS: CharacterPart[] = [
  { key: "eye_normal", category: "eyes", label: "기본 눈", gender: "neutral", sortOrder: 0, config: { style: "normal", iris: "#4A3728", pupil: "#1A1A1A" } },
  { key: "eye_big", category: "eyes", label: "큰 눈", gender: "neutral", sortOrder: 1, config: { style: "big", iris: "#4A3728", pupil: "#1A1A1A" } },
  { key: "eye_sharp", category: "eyes", label: "날카로운 눈", gender: "neutral", sortOrder: 2, config: { style: "sharp", iris: "#2C3E50", pupil: "#0D1117" } },
  { key: "eye_cute", category: "eyes", label: "귀여운 눈", gender: "neutral", sortOrder: 3, config: { style: "cute", iris: "#6B4C3B", pupil: "#2A1F1A" } },
  { key: "eye_determined", category: "eyes", label: "결연한 눈", gender: "neutral", sortOrder: 4, config: { style: "determined", iris: "#1B4332", pupil: "#0B1F18" } },
  { key: "eye_blue", category: "eyes", label: "파란 눈", gender: "neutral", sortOrder: 5, config: { style: "normal", iris: "#3498DB", pupil: "#1A5276" } },
  { key: "eye_green", category: "eyes", label: "초록 눈", gender: "neutral", sortOrder: 6, config: { style: "normal", iris: "#27AE60", pupil: "#145A32" } },
  { key: "eye_red", category: "eyes", label: "붉은 눈", gender: "neutral", sortOrder: 7, config: { style: "sharp", iris: "#E74C3C", pupil: "#7B241C" } },
];

// ========== MOUTH (6) ==========
export const MOUTH_PARTS: CharacterPart[] = [
  { key: "mouth_smile", category: "mouth", label: "미소", gender: "neutral", sortOrder: 0, config: { style: "smile", fill: "#E74C3C" } },
  { key: "mouth_grin", category: "mouth", label: "활짝 웃음", gender: "neutral", sortOrder: 1, config: { style: "grin", fill: "#C0392B" } },
  { key: "mouth_serious", category: "mouth", label: "진지한 입", gender: "neutral", sortOrder: 2, config: { style: "serious", fill: "#C0392B" } },
  { key: "mouth_shout", category: "mouth", label: "외치는 입", gender: "neutral", sortOrder: 3, config: { style: "shout", fill: "#C0392B" } },
  { key: "mouth_smirk", category: "mouth", label: "씩 웃음", gender: "neutral", sortOrder: 4, config: { style: "smirk", fill: "#E74C3C" } },
  { key: "mouth_pout", category: "mouth", label: "삐쭉 입", gender: "neutral", sortOrder: 5, config: { style: "pout", fill: "#E74C3C" } },
];

// ========== GLOVES (8) ==========
export const GLOVE_PARTS: CharacterPart[] = [
  { key: "glove_red", category: "gloves", label: "레드 글러브", gender: "neutral", sortOrder: 0, config: { fill: "#E8553A", shadow: "#C4432E", lace: "#FFF" } },
  { key: "glove_blue", category: "gloves", label: "블루 글러브", gender: "neutral", sortOrder: 1, config: { fill: "#2E5BFF", shadow: "#1A3FB3", lace: "#FFF" } },
  { key: "glove_black", category: "gloves", label: "블랙 글러브", gender: "neutral", sortOrder: 2, config: { fill: "#1A1A2E", shadow: "#0D0D1A", lace: "#FFD700" } },
  { key: "glove_gold", category: "gloves", label: "골드 글러브", gender: "neutral", sortOrder: 3, config: { fill: "#FFD700", shadow: "#DAA520", lace: "#FFF" } },
  { key: "glove_white", category: "gloves", label: "화이트 글러브", gender: "neutral", sortOrder: 4, config: { fill: "#F5F5F5", shadow: "#D4D4D4", lace: "#E8553A" } },
  { key: "glove_green", category: "gloves", label: "그린 글러브", gender: "neutral", sortOrder: 5, config: { fill: "#27AE60", shadow: "#1E8449", lace: "#FFF" } },
  { key: "glove_purple", category: "gloves", label: "퍼플 글러브", gender: "neutral", sortOrder: 6, config: { fill: "#9B59B6", shadow: "#7D3C98", lace: "#FFF" } },
  { key: "glove_pink", category: "gloves", label: "핑크 글러브", gender: "neutral", sortOrder: 7, config: { fill: "#FF69B4", shadow: "#DB4C9A", lace: "#FFF" } },
];

// ========== TOPS (8) ==========
export const TOP_PARTS: CharacterPart[] = [
  { key: "top_tank_red", category: "top", label: "탱크탑 레드", gender: "neutral", sortOrder: 0, config: { style: "tank", fill: "#E8553A", accent: "#FFF", shadow: "#C4432E" } },
  { key: "top_tank_blue", category: "top", label: "탱크탑 블루", gender: "neutral", sortOrder: 1, config: { style: "tank", fill: "#2E5BFF", accent: "#FFF", shadow: "#1A3FB3" } },
  { key: "top_tank_black", category: "top", label: "탱크탑 블랙", gender: "neutral", sortOrder: 2, config: { style: "tank", fill: "#1A1A2E", accent: "#FFD700", shadow: "#0D0D1A" } },
  { key: "top_hoodie_gray", category: "top", label: "후디 그레이", gender: "neutral", sortOrder: 3, config: { style: "hoodie", fill: "#888", accent: "#FFF", shadow: "#666" } },
  { key: "top_hoodie_white", category: "top", label: "후디 화이트", gender: "neutral", sortOrder: 4, config: { style: "hoodie", fill: "#F5F5F5", accent: "#E8553A", shadow: "#D4D4D4" } },
  { key: "top_robe_gold", category: "top", label: "로브 골드", gender: "neutral", sortOrder: 5, config: { style: "robe", fill: "#FFD700", accent: "#1A1A2E", shadow: "#DAA520" } },
  { key: "top_robe_red", category: "top", label: "로브 레드", gender: "neutral", sortOrder: 6, config: { style: "robe", fill: "#E8553A", accent: "#FFD700", shadow: "#C4432E" } },
  { key: "top_tank_green", category: "top", label: "탱크탑 그린", gender: "neutral", sortOrder: 7, config: { style: "tank", fill: "#27AE60", accent: "#FFF", shadow: "#1E8449" } },
];

// ========== SHORTS (8) ==========
export const SHORTS_PARTS: CharacterPart[] = [
  { key: "shorts_basic_red", category: "shorts", label: "반바지 레드", gender: "neutral", sortOrder: 0, config: { style: "basic", fill: "#E8553A", stripe: "#FFF", shadow: "#C4432E" } },
  { key: "shorts_basic_blue", category: "shorts", label: "반바지 블루", gender: "neutral", sortOrder: 1, config: { style: "basic", fill: "#2E5BFF", stripe: "#FFF", shadow: "#1A3FB3" } },
  { key: "shorts_basic_black", category: "shorts", label: "반바지 블랙", gender: "neutral", sortOrder: 2, config: { style: "basic", fill: "#1A1A2E", stripe: "#FFD700", shadow: "#0D0D1A" } },
  { key: "shorts_basic_white", category: "shorts", label: "반바지 화이트", gender: "neutral", sortOrder: 3, config: { style: "basic", fill: "#F5F5F5", stripe: "#E8553A", shadow: "#D4D4D4" } },
  { key: "shorts_stripe_gold", category: "shorts", label: "스트라이프 골드", gender: "neutral", sortOrder: 4, config: { style: "stripe", fill: "#FFD700", stripe: "#1A1A2E", shadow: "#DAA520" } },
  { key: "shorts_stripe_green", category: "shorts", label: "스트라이프 그린", gender: "neutral", sortOrder: 5, config: { style: "stripe", fill: "#27AE60", stripe: "#FFF", shadow: "#1E8449" } },
  { key: "shorts_stripe_purple", category: "shorts", label: "스트라이프 퍼플", gender: "neutral", sortOrder: 6, config: { style: "stripe", fill: "#9B59B6", stripe: "#FFF", shadow: "#7D3C98" } },
  { key: "shorts_basic_orange", category: "shorts", label: "반바지 오렌지", gender: "neutral", sortOrder: 7, config: { style: "basic", fill: "#FF6B35", stripe: "#FFF", shadow: "#CC5528" } },
];

// ========== SHOES (6) ==========
export const SHOE_PARTS: CharacterPart[] = [
  { key: "shoe_boots_red", category: "shoes", label: "부츠 레드", gender: "neutral", sortOrder: 0, config: { style: "boots", fill: "#E8553A", sole: "#333", lace: "#FFF" } },
  { key: "shoe_boots_black", category: "shoes", label: "부츠 블랙", gender: "neutral", sortOrder: 1, config: { style: "boots", fill: "#1A1A2E", sole: "#111", lace: "#FFD700" } },
  { key: "shoe_boots_white", category: "shoes", label: "부츠 화이트", gender: "neutral", sortOrder: 2, config: { style: "boots", fill: "#F5F5F5", sole: "#333", lace: "#E8553A" } },
  { key: "shoe_sneaker_blue", category: "shoes", label: "스니커즈 블루", gender: "neutral", sortOrder: 3, config: { style: "sneaker", fill: "#2E5BFF", sole: "#FFF", lace: "#FFF" } },
  { key: "shoe_sneaker_green", category: "shoes", label: "스니커즈 그린", gender: "neutral", sortOrder: 4, config: { style: "sneaker", fill: "#27AE60", sole: "#FFF", lace: "#FFF" } },
  { key: "shoe_sneaker_gold", category: "shoes", label: "스니커즈 골드", gender: "neutral", sortOrder: 5, config: { style: "sneaker", fill: "#FFD700", sole: "#333", lace: "#FFF" } },
];

// ========== ACCESSORIES (6) ==========
export const ACCESSORY_PARTS: CharacterPart[] = [
  { key: "acc_headband_red", category: "accessory", label: "헤드밴드 레드", gender: "neutral", sortOrder: 0, config: { style: "headband", fill: "#E8553A" } },
  { key: "acc_headband_gold", category: "accessory", label: "헤드밴드 골드", gender: "neutral", sortOrder: 1, config: { style: "headband", fill: "#FFD700" } },
  { key: "acc_ribbon_pink", category: "accessory", label: "리본 핑크", gender: "female", sortOrder: 2, config: { style: "ribbon", fill: "#FF69B4" } },
  { key: "acc_scar", category: "accessory", label: "상처 자국", gender: "neutral", sortOrder: 3, config: { style: "scar", fill: "#C0392B" } },
  { key: "acc_star_sticker", category: "accessory", label: "별 스티커", gender: "neutral", sortOrder: 4, config: { style: "star", fill: "#FFD700" } },
  { key: "acc_bandage", category: "accessory", label: "반창고", gender: "neutral", sortOrder: 5, config: { style: "bandage", fill: "#F5D0A9" } },
];

// ========== EFFECTS (4) ==========
export const EFFECT_PARTS: CharacterPart[] = [
  { key: "fx_sparkle", category: "effect", label: "반짝이", gender: "neutral", sortOrder: 0, config: { style: "sparkle", color: "#FFD700" } },
  { key: "fx_sweat", category: "effect", label: "땀방울", gender: "neutral", sortOrder: 1, config: { style: "sweat", color: "#87CEEB" } },
  { key: "fx_hearts", category: "effect", label: "하트", gender: "neutral", sortOrder: 2, config: { style: "hearts", color: "#FF69B4" } },
  { key: "fx_fire", category: "effect", label: "불꽃", gender: "neutral", sortOrder: 3, config: { style: "fire", color: "#FF6B35" } },
];

// ========== ALL PARTS MAP ==========
export const ALL_PARTS: CharacterPart[] = [
  ...SKIN_PARTS,
  ...HAIR_BACK_PARTS,
  ...HAIR_FRONT_PARTS,
  ...EYEBROW_PARTS,
  ...EYE_PARTS,
  ...MOUTH_PARTS,
  ...GLOVE_PARTS,
  ...TOP_PARTS,
  ...SHORTS_PARTS,
  ...SHOE_PARTS,
  ...ACCESSORY_PARTS,
  ...EFFECT_PARTS,
];

export const PARTS_BY_CATEGORY: Record<string, CharacterPart[]> = {
  skin: SKIN_PARTS,
  hair_back: HAIR_BACK_PARTS,
  hair_front: HAIR_FRONT_PARTS,
  eyebrows: EYEBROW_PARTS,
  eyes: EYE_PARTS,
  mouth: MOUTH_PARTS,
  gloves: GLOVE_PARTS,
  top: TOP_PARTS,
  shorts: SHORTS_PARTS,
  shoes: SHOE_PARTS,
  accessory: ACCESSORY_PARTS,
  effect: EFFECT_PARTS,
};

export const CATEGORY_LABELS: Record<string, string> = {
  skin: "피부톤",
  hair_back: "뒷머리",
  hair_front: "앞머리",
  eyebrows: "눈썹",
  eyes: "눈",
  mouth: "표정",
  gloves: "글러브",
  top: "상의",
  shorts: "하의",
  shoes: "신발",
  accessory: "액세서리",
  effect: "이펙트",
};

export const CATEGORY_ORDER = [
  "skin", "hair_back", "hair_front", "eyebrows", "eyes", "mouth",
  "gloves", "top", "shorts", "shoes", "accessory", "effect",
];

/** Selection state: category -> part key */
export type PartsSelection = Record<string, string>;

/** Default starting selection */
export const DEFAULT_SELECTION: PartsSelection = {
  skin: "skin_light",
  hair_back: "hb_short_black",
  hair_front: "hf_bangs_black",
  eyebrows: "eb_normal",
  eyes: "eye_normal",
  mouth: "mouth_smile",
  gloves: "glove_red",
  top: "top_tank_red",
  shorts: "shorts_basic_red",
  shoes: "shoe_boots_red",
};

export function getPartByKey(key: string): CharacterPart | undefined {
  return ALL_PARTS.find(p => p.key === key);
}

export function getRandomSelection(): PartsSelection {
  const sel: PartsSelection = {};
  for (const cat of CATEGORY_ORDER) {
    const parts = PARTS_BY_CATEGORY[cat];
    if (parts.length > 0 && cat !== "accessory" && cat !== "effect") {
      sel[cat] = parts[Math.floor(Math.random() * parts.length)].key;
    }
  }
  // 30% chance accessory
  if (Math.random() < 0.3) {
    const acc = ACCESSORY_PARTS;
    sel.accessory = acc[Math.floor(Math.random() * acc.length)].key;
  }
  return sel;
}
