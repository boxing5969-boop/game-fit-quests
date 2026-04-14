/**
 * CSS-based overlay customization options for PNG preset characters.
 * These render ON TOP of the fixed PNG preset — no SVG switching.
 *
 * ARCHITECTURE RULE (2026-04):
 * Only categories that produce clearly visible and correctly positioned results
 * are exposed. Categories that require per-preset anatomical alignment
 * (gloves, sunglasses, headbands on face) are HIDDEN until preset-aware
 * variant assets are created.
 *
 * Currently VISIBLE:  effect, frame, title, accessory (crown + star_mark only)
 * Currently HIDDEN:   gloveColor (needs real glove variant PNGs),
 *                     face-anchored accessories (sunglasses, headband, bandage)
 */

import React from "react";

export interface CustomizationOption {
  key: string;
  label: string;
  type: "badge" | "particle" | "emoji" | "frame" | "title";
}

export interface CustomizationCategory {
  code: string;
  label: string;
  icon: string;
  options: CustomizationOption[];
}

export interface CharacterCustomization {
  gloveColor?: string;   // kept in type for save-compat; hidden from UI
  effect?: string;
  accessory?: string;
  frame?: string;
  title?: string;
}

// ===== EFFECTS — clearly visible particle overlays =====
const EFFECT_OPTIONS: CustomizationOption[] = [
  { key: "sparkle", label: "반짝이", type: "particle" },
  { key: "flame", label: "불꽃", type: "particle" },
  { key: "hearts", label: "하트", type: "particle" },
  { key: "stars", label: "별", type: "particle" },
];

// ===== ACCESSORIES — only options that render above/beside the character =====
// HIDDEN: sunglasses (can't fit face), headband_red/black (can't fit head),
//         bandage (can't fit cheek)
// KEPT: crown (floats above head), star_mark (floats beside head)
const ACCESSORY_OPTIONS: CustomizationOption[] = [
  { key: "crown", label: "왕관", type: "emoji" },
  { key: "star_mark", label: "별 마크", type: "emoji" },
];

// ===== FRAMES — ring effect around character, always works =====
const FRAME_OPTIONS: CustomizationOption[] = [
  { key: "fire", label: "불꽃 프레임", type: "frame" },
  { key: "ice", label: "얼음 프레임", type: "frame" },
  { key: "gold", label: "골드 프레임", type: "frame" },
  { key: "shadow", label: "섀도우 프레임", type: "frame" },
];

// ===== TITLES — text labels below character, always works =====
const TITLE_OPTIONS: CustomizationOption[] = [
  { key: "rookie", label: "루키", type: "title" },
  { key: "fighter", label: "파이터", type: "title" },
  { key: "champion", label: "챔피언", type: "title" },
  { key: "legend", label: "레전드", type: "title" },
];

/**
 * Only categories with genuinely working visual results are listed here.
 * gloveColor is intentionally excluded — it requires preset-specific
 * variant images that don't exist yet.
 */
export const CUSTOMIZATION_CATEGORIES: CustomizationCategory[] = [
  { code: "effect", label: "이펙트", icon: "✨", options: EFFECT_OPTIONS },
  { code: "accessory", label: "액세서리", icon: "👑", options: ACCESSORY_OPTIONS },
  { code: "frame", label: "프레임", icon: "🖼️", options: FRAME_OPTIONS },
  { code: "title", label: "칭호", icon: "🏷️", options: TITLE_OPTIONS },
];

// ===== Visual rendering helpers =====

// Kept for save-compat but not exposed in UI
export const GLOVE_COLORS: Record<string, string> = {
  red: "#EF4444",
  blue: "#3B82F6",
  gold: "#F59E0B",
  black: "#1F2937",
  white: "#E5E7EB",
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

// ===== ACCESSORY CONFIGS — only items that truly render correctly =====
export interface AccessoryConfig {
  top: string;
  left: string;
  width: string;
  height: string;
  render: (isLarge: boolean) => React.ReactNode;
}

export const ACCESSORY_CONFIGS: Record<string, AccessoryConfig> = {
  crown: {
    top: "-8%",
    left: "22%",
    width: "56%",
    height: "26%",
    render: (lg) => React.createElement("div", {
      className: "flex items-end justify-center",
      style: { width: "100%", height: "100%" },
    },
      React.createElement("div", {
        style: {
          fontSize: lg ? 32 : 20,
          lineHeight: 1,
          filter: "drop-shadow(0 2px 6px rgba(245,158,11,0.6))",
          transform: "translateY(2px)",
        },
      }, "👑"),
    ),
  },
  star_mark: {
    top: "8%",
    left: "68%",
    width: "28%",
    height: "20%",
    render: (lg) => React.createElement("div", {
      style: {
        fontSize: lg ? 24 : 16,
        lineHeight: 1,
        filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.6))",
      },
    }, "⭐"),
  },
};

// Legacy compat — keep for any external consumers
export const ACCESSORY_EMOJIS: Record<string, { emoji: string; position: string }> = {
  crown: { emoji: "👑", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  star_mark: { emoji: "⭐", position: "top-1/4 right-0" },
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
