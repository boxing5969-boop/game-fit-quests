/**
 * CSS-based overlay customization options for PNG preset characters.
 * These render ON TOP of the fixed PNG preset — no SVG switching.
 * All basic items are unlocked by default.
 * 
 * RULE: Every visible option must produce a clearly different visual result.
 * If it doesn't, hide it until fixed.
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
  gloveColor?: string;
  effect?: string;
  accessory?: string;
  frame?: string;
  title?: string;
}

// ===== GLOVE COLORS — each must produce an obviously different color =====
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

// ===== EFFECTS =====
const EFFECT_OPTIONS: CustomizationOption[] = [
  { key: "sparkle", label: "반짝이", type: "particle" },
  { key: "flame", label: "불꽃", type: "particle" },
  { key: "hearts", label: "하트", type: "particle" },
  { key: "stars", label: "별", type: "particle" },
];

// ===== ACCESSORIES — only options that produce clearly distinct visuals =====
// REMOVED: sweatband (💦 ambiguous), mouthguard (😤 doesn't look like one)
const ACCESSORY_OPTIONS: CustomizationOption[] = [
  { key: "headband_red", label: "빨간 머리띠", type: "emoji" },
  { key: "headband_black", label: "검은 머리띠", type: "emoji" },
  { key: "sunglasses", label: "선글라스", type: "emoji" },
  { key: "bandage", label: "반창고", type: "emoji" },
  { key: "crown", label: "왕관", type: "emoji" },
  { key: "star_mark", label: "별 마크", type: "emoji" },
];

// ===== FRAMES =====
const FRAME_OPTIONS: CustomizationOption[] = [
  { key: "fire", label: "불꽃 프레임", type: "frame" },
  { key: "ice", label: "얼음 프레임", type: "frame" },
  { key: "gold", label: "골드 프레임", type: "frame" },
  { key: "shadow", label: "섀도우 프레임", type: "frame" },
];

// ===== TITLES =====
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

// ===== ACCESSORY CONFIGS — positioned relative to character container =====
// Each accessory has explicit position, size, and a render function for distinct visuals
export interface AccessoryConfig {
  top: string;
  left: string;
  width: string;
  height: string;
  render: (isLarge: boolean) => React.ReactNode;
}

export const ACCESSORY_CONFIGS: Record<string, AccessoryConfig> = {
  headband_red: {
    top: "8%",
    left: "20%",
    width: "60%",
    height: "16%",
    render: (lg) => React.createElement("div", {
      className: "w-full h-full rounded-full",
      style: {
        background: "linear-gradient(90deg, #DC2626 0%, #EF4444 50%, #DC2626 100%)",
        boxShadow: "0 2px 6px rgba(220,38,38,0.5)",
        border: "1px solid #B91C1C",
        height: lg ? 8 : 5,
      }
    }),
  },
  headband_black: {
    top: "8%",
    left: "20%",
    width: "60%",
    height: "16%",
    render: (lg) => React.createElement("div", {
      className: "w-full h-full rounded-full",
      style: {
        background: "linear-gradient(90deg, #1F2937 0%, #374151 50%, #1F2937 100%)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        border: "1px solid #111827",
        height: lg ? 8 : 5,
      }
    }),
  },
  sunglasses: {
    top: "22%",
    left: "15%",
    width: "70%",
    height: "18%",
    render: (lg) => React.createElement("div", {
      className: "w-full flex items-center justify-center gap-[2px]",
      style: { height: "100%" },
    }, 
      // Left lens
      React.createElement("div", {
        key: "l",
        style: {
          width: lg ? 22 : 14,
          height: lg ? 14 : 9,
          backgroundColor: "#1a1a2e",
          borderRadius: "40%",
          border: `${lg ? 2 : 1.5}px solid #333`,
          boxShadow: "inset 0 1px 3px rgba(255,255,255,0.15)",
        },
      }),
      // Bridge
      React.createElement("div", {
        key: "b",
        style: {
          width: lg ? 6 : 4,
          height: lg ? 3 : 2,
          backgroundColor: "#333",
          borderRadius: "50%",
        },
      }),
      // Right lens
      React.createElement("div", {
        key: "r",
        style: {
          width: lg ? 22 : 14,
          height: lg ? 14 : 9,
          backgroundColor: "#1a1a2e",
          borderRadius: "40%",
          border: `${lg ? 2 : 1.5}px solid #333`,
          boxShadow: "inset 0 1px 3px rgba(255,255,255,0.15)",
        },
      }),
    ),
  },
  bandage: {
    top: "28%",
    left: "62%",
    width: "28%",
    height: "14%",
    render: (lg) => React.createElement("div", {
      style: {
        width: lg ? 28 : 18,
        height: lg ? 12 : 8,
        backgroundColor: "#FDE68A",
        border: `${lg ? 1.5 : 1}px solid #D97706`,
        borderRadius: 3,
        transform: "rotate(-15deg)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        position: "relative" as const,
      },
    },
      // Cross pattern dots on bandage
      React.createElement("div", {
        style: {
          position: "absolute" as const,
          top: "50%",
          left: "30%",
          transform: "translate(-50%, -50%)",
          width: lg ? 3 : 2,
          height: lg ? 3 : 2,
          borderRadius: "50%",
          backgroundColor: "#92400E",
        }
      }),
      React.createElement("div", {
        style: {
          position: "absolute" as const,
          top: "50%",
          left: "70%",
          transform: "translate(-50%, -50%)",
          width: lg ? 3 : 2,
          height: lg ? 3 : 2,
          borderRadius: "50%",
          backgroundColor: "#92400E",
        }
      }),
    ),
  },
  crown: {
    top: "-2%",
    left: "22%",
    width: "56%",
    height: "22%",
    render: (lg) => React.createElement("div", {
      className: "flex items-end justify-center",
      style: { width: "100%", height: "100%" },
    },
      React.createElement("div", {
        style: {
          fontSize: lg ? 28 : 18,
          lineHeight: 1,
          filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.5))",
          transform: "translateY(2px)",
        },
      }, "👑"),
    ),
  },
  star_mark: {
    top: "14%",
    left: "60%",
    width: "24%",
    height: "16%",
    render: (lg) => React.createElement("div", {
      style: {
        fontSize: lg ? 20 : 13,
        lineHeight: 1,
        filter: "drop-shadow(0 1px 3px rgba(234,179,8,0.6))",
      },
    }, "⭐"),
  },
};

// Legacy compat — keep old ACCESSORY_EMOJIS for any external consumers
export const ACCESSORY_EMOJIS: Record<string, { emoji: string; position: string }> = {
  headband_red: { emoji: "🎗️", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/3" },
  headband_black: { emoji: "🖤", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/3" },
  sunglasses: { emoji: "🕶️", position: "top-1/4 left-1/2 -translate-x-1/2" },
  bandage: { emoji: "🩹", position: "top-1/3 right-0 translate-x-1/4" },
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
