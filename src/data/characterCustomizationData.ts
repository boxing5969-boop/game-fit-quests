/**
 * PNG-based overlay customization system for approved presets.
 *
 * ARCHITECTURE (2026-04, v3 — image-based overlays):
 * All overlays use actual transparent PNG assets positioned per-preset.
 * Emoji/CSS-only overlays are removed for core categories.
 *
 * CATEGORIES:
 *   accessory  — PNG overlay on head/face (crown, sunglasses, headband)
 *   gloveStyle — PNG overlay badge near hands (decorative indicator)
 *   effect     — CSS particle emojis (position-independent, always works)
 *   frame      — CSS ring around character (position-independent)
 *   title      — text label below character (position-independent)
 */

// ===== Overlay PNG imports =====
import accCrown from "@/assets/overlays/acc_crown_only.png";
import accSunglasses from "@/assets/overlays/acc_sunglasses_only.png";
import accHeadbandRed from "@/assets/overlays/acc_headband_red_only.png";
import accHeadbandBlack from "@/assets/overlays/acc_headband_black_only.png";
import gloveRed from "@/assets/overlays/glove_red.png";
import gloveBlue from "@/assets/overlays/glove_blue.png";
import gloveGold from "@/assets/overlays/glove_gold.png";
import gloveBlack from "@/assets/overlays/glove_black.png";

// ===== Types =====

export interface CharacterCustomization {
  gloveStyle?: string;
  effect?: string;
  accessory?: string;
  frame?: string;
  title?: string;
  // legacy compat
  gloveColor?: string;
}

export interface CustomizationOption {
  key: string;
  label: string;
  /** Thumbnail image for the selection grid */
  thumb?: string;
  /** Overlay image rendered on the character */
  overlayImage?: string;
}

export interface CustomizationCategory {
  code: string;
  label: string;
  icon: string;
  options: CustomizationOption[];
}

// ===== Anchor system for per-preset overlay positioning =====

export interface OverlayAnchor {
  /** % from top of character container */
  top: number;
  /** % from left of character container */
  left: number;
  /** overlay width as % of character width */
  width: number;
  /** overlay height as % of character height */
  height: number;
  /** optional rotation in degrees */
  rotation?: number;
}

export interface PresetAnchors {
  head_top: OverlayAnchor;
  eye_line: OverlayAnchor;
  forehead: OverlayAnchor;
  hands: OverlayAnchor;
}

/** Default anchor set — works for most chibi presets */
const DEFAULT_ANCHORS: PresetAnchors = {
  head_top: { top: -8, left: 20, width: 60, height: 28 },
  eye_line: { top: 18, left: 15, width: 70, height: 20 },
  forehead: { top: 6, left: 12, width: 76, height: 18 },
  hands: { top: 58, left: 5, width: 90, height: 35 },
};

/**
 * Per-preset anchor overrides.
 * Only specify presets that deviate from DEFAULT_ANCHORS.
 */
const PRESET_ANCHOR_OVERRIDES: Record<string, Partial<PresetAnchors>> = {
  female_01: {
    eye_line: { top: 20, left: 18, width: 64, height: 18 },
    head_top: { top: -6, left: 22, width: 56, height: 26 },
  },
  female_02: {
    eye_line: { top: 19, left: 16, width: 68, height: 19 },
  },
  female_03: {
    eye_line: { top: 20, left: 17, width: 66, height: 18 },
    head_top: { top: -7, left: 21, width: 58, height: 27 },
  },
  female_04: {
    eye_line: { top: 19, left: 15, width: 70, height: 19 },
  },
  female_05: {
    eye_line: { top: 20, left: 18, width: 64, height: 18 },
  },
  female_06: {
    eye_line: { top: 19, left: 16, width: 68, height: 19 },
  },
  male_02: {
    hands: { top: 56, left: 5, width: 90, height: 36 },
  },
  male_04: {
    eye_line: { top: 19, left: 14, width: 72, height: 20 },
  },
};

export function getPresetAnchors(presetStyle: string): PresetAnchors {
  const overrides = PRESET_ANCHOR_OVERRIDES[presetStyle] || {};
  return {
    head_top: overrides.head_top || DEFAULT_ANCHORS.head_top,
    eye_line: overrides.eye_line || DEFAULT_ANCHORS.eye_line,
    forehead: overrides.forehead || DEFAULT_ANCHORS.forehead,
    hands: overrides.hands || DEFAULT_ANCHORS.hands,
  };
}

// ===== ACCESSORY — uses actual PNG overlay images =====
export const ACCESSORY_OPTIONS: CustomizationOption[] = [
  { key: "crown", label: "왕관", thumb: accCrown, overlayImage: accCrown },
  { key: "sunglasses", label: "선글라스", thumb: accSunglasses, overlayImage: accSunglasses },
  { key: "headband_red", label: "레드 머리띠", thumb: accHeadbandRed, overlayImage: accHeadbandRed },
  { key: "headband_black", label: "블랙 머리띠", thumb: accHeadbandBlack, overlayImage: accHeadbandBlack },
];

/** Maps accessory key → which anchor zone to use */
export const ACCESSORY_ANCHOR_ZONE: Record<string, keyof PresetAnchors> = {
  crown: "head_top",
  sunglasses: "eye_line",
  headband_red: "forehead",
  headband_black: "forehead",
};

// ===== GLOVE STYLE — decorative badge overlay near hands =====
export const GLOVE_OPTIONS: CustomizationOption[] = [
  { key: "red", label: "레드 글러브", thumb: gloveRed, overlayImage: gloveRed },
  { key: "blue", label: "블루 글러브", thumb: gloveBlue, overlayImage: gloveBlue },
  { key: "gold", label: "골드 글러브", thumb: gloveGold, overlayImage: gloveGold },
  { key: "black", label: "블랙 글러브", thumb: gloveBlack, overlayImage: gloveBlack },
];

// ===== EFFECTS — CSS particles (position-independent) =====
const EFFECT_OPTIONS: CustomizationOption[] = [
  { key: "sparkle", label: "반짝이" },
  { key: "flame", label: "불꽃" },
  { key: "hearts", label: "하트" },
  { key: "stars", label: "별" },
];

// ===== FRAMES — CSS ring (position-independent) =====
const FRAME_OPTIONS: CustomizationOption[] = [
  { key: "fire", label: "불꽃 프레임" },
  { key: "ice", label: "얼음 프레임" },
  { key: "gold", label: "골드 프레임" },
  { key: "shadow", label: "섀도우 프레임" },
];

// ===== TITLES =====
const TITLE_OPTIONS: CustomizationOption[] = [
  { key: "rookie", label: "루키" },
  { key: "fighter", label: "파이터" },
  { key: "champion", label: "챔피언" },
  { key: "legend", label: "레전드" },
];

// ===== MAIN CATEGORIES — only categories with real visual results =====
export const CUSTOMIZATION_CATEGORIES: CustomizationCategory[] = [
  { code: "accessory", label: "액세서리", icon: "👑", options: ACCESSORY_OPTIONS },
  { code: "gloveStyle", label: "글러브", icon: "🥊", options: GLOVE_OPTIONS },
  { code: "effect", label: "이펙트", icon: "✨", options: EFFECT_OPTIONS },
  { code: "frame", label: "프레임", icon: "🖼️", options: FRAME_OPTIONS },
  { code: "title", label: "칭호", icon: "🏷️", options: TITLE_OPTIONS },
];

// ===== Visual rendering helpers (for effect/frame/title — kept from v2) =====

export const EFFECT_EMOJIS: Record<string, string> = {
  sparkle: "✨",
  flame: "🔥",
  hearts: "💖",
  stars: "⭐",
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

// Legacy compat exports
export const GLOVE_COLORS: Record<string, string> = {
  red: "#EF4444", blue: "#3B82F6", gold: "#F59E0B",
  black: "#1F2937", white: "#E5E7EB", green: "#10B981",
  pink: "#EC4899", purple: "#8B5CF6",
};

// Helper to get overlay image for an accessory
export function getAccessoryOverlay(key: string): string | undefined {
  return ACCESSORY_OPTIONS.find(o => o.key === key)?.overlayImage;
}

// Helper to get overlay image for a glove style
export function getGloveOverlay(key: string): string | undefined {
  return GLOVE_OPTIONS.find(o => o.key === key)?.overlayImage;
}
