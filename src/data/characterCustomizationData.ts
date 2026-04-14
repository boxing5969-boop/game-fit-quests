/**
 * CSS-based overlay customization options for PNG preset characters.
 * These render ON TOP of the fixed PNG preset — no SVG switching.
 * All basic items are unlocked by default.
 */

export interface CustomizationOption {
  key: string;
  label: string;
  /** How this renders visually */
  type: "badge" | "particle" | "emoji" | "frame" | "title";
}

export interface CustomizationCategory {
  code: string;
  label: string;
  icon: string;
  options: CustomizationOption[];
}

export interface CharacterCustomization {
  gloveColor?: string;
  effect?: string;
  accessory?: string;
  frame?: string;
  title?: string;
}

// ===== GLOVE COLORS =====
const GLOVE_OPTIONS: CustomizationOption[] = [
  { key: "red", label: "레드", type: "badge" },
  { key: "blue", label: "블루", type: "badge" },
  { key: "gold", label: "골드", type: "badge" },
  { key: "black", label: "블랙", type: "badge" },
  { key: "white", label: "화이트", type: "badge" },
  { key: "green", label: "그린", type: "badge" },
  { key: "pink", label: "핑크", type: "badge" },
  { key: "purple", label: "퍼플", type: "badge" },
];

// ===== EFFECTS (CSS particles around character) =====
const EFFECT_OPTIONS: CustomizationOption[] = [
  { key: "sparkle", label: "반짝이", type: "particle" },
  { key: "flame", label: "불꽃", type: "particle" },
  { key: "hearts", label: "하트", type: "particle" },
  { key: "stars", label: "별", type: "particle" },
];

// ===== ACCESSORIES (emoji overlay on character) =====
const ACCESSORY_OPTIONS: CustomizationOption[] = [
  { key: "headband_red", label: "빨간 머리띠", type: "emoji" },
  { key: "headband_black", label: "검은 머리띠", type: "emoji" },
  { key: "sunglasses", label: "선글라스", type: "emoji" },
  { key: "bandage", label: "반창고", type: "emoji" },
  { key: "sweatband", label: "땀띠", type: "emoji" },
  { key: "mouthguard", label: "마우스가드", type: "emoji" },
];

// ===== FRAMES (border/background style around character) =====
const FRAME_OPTIONS: CustomizationOption[] = [
  { key: "fire", label: "불꽃 프레임", type: "frame" },
  { key: "ice", label: "얼음 프레임", type: "frame" },
  { key: "gold", label: "골드 프레임", type: "frame" },
  { key: "shadow", label: "섀도우 프레임", type: "frame" },
];

// ===== TITLES (text label below character) =====
const TITLE_OPTIONS: CustomizationOption[] = [
  { key: "rookie", label: "루키", type: "title" },
  { key: "fighter", label: "파이터", type: "title" },
  { key: "champion", label: "챔피언", type: "title" },
  { key: "legend", label: "레전드", type: "title" },
];

export const CUSTOMIZATION_CATEGORIES: CustomizationCategory[] = [
  { code: "gloveColor", label: "글러브", icon: "🥊", options: GLOVE_OPTIONS },
  { code: "effect", label: "이펙트", icon: "✨", options: EFFECT_OPTIONS },
  { code: "accessory", label: "액세서리", icon: "🎀", options: ACCESSORY_OPTIONS },
  { code: "frame", label: "프레임", icon: "🖼️", options: FRAME_OPTIONS },
  { code: "title", label: "칭호", icon: "🏷️", options: TITLE_OPTIONS },
];

// ===== Visual rendering helpers =====

export const GLOVE_COLORS: Record<string, string> = {
  red: "#EF4444",
  blue: "#3B82F6",
  gold: "#F59E0B",
  black: "#1F2937",
  white: "#F3F4F6",
  green: "#10B981",
  pink: "#EC4899",
  purple: "#8B5CF6",
};

export const EFFECT_EMOJIS: Record<string, string> = {
  sparkle: "✨",
  flame: "🔥",
  hearts: "💖",
  stars: "⭐",
};

export const ACCESSORY_EMOJIS: Record<string, { emoji: string; position: string }> = {
  headband_red: { emoji: "🎗️", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/3" },
  headband_black: { emoji: "🖤", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/3" },
  sunglasses: { emoji: "🕶️", position: "top-1/4 left-1/2 -translate-x-1/2" },
  bandage: { emoji: "🩹", position: "top-1/3 right-0 translate-x-1/4" },
  sweatband: { emoji: "💦", position: "top-0 right-0" },
  mouthguard: { emoji: "😤", position: "bottom-1/3 left-1/2 -translate-x-1/2" },
};

export const FRAME_STYLES: Record<string, string> = {
  fire: "ring-2 ring-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.4)]",
  ice: "ring-2 ring-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.4)]",
  gold: "ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
  shadow: "ring-2 ring-gray-600/60 shadow-[0_0_16px_rgba(0,0,0,0.5)]",
};

export const TITLE_LABELS: Record<string, { text: string; color: string }> = {
  rookie: { text: "🥊 루키", color: "text-green-600" },
  fighter: { text: "🔥 파이터", color: "text-orange-500" },
  champion: { text: "🏆 챔피언", color: "text-amber-500" },
  legend: { text: "👑 레전드", color: "text-purple-500" },
};
