/**
 * 153 스토리 RPG — PNG 픽셀 아트 자산 매핑 (Stage 47B+).
 *
 * public/assets/story-rpg/ 아래 들어온 자산만 매핑. 매핑 안 되거나 404 면
 * 컴포넌트가 SVG fallback. 향후 자산 추가 시 이 파일만 갱신.
 *
 * 현재 자산: 챔피언 로드 챕터 1 풀세트 (17장)
 *   portraits 9 + enemies 3 + backgrounds 3 + world_maps 1 + titles 1
 */

import type { CSSProperties } from "react";
import type { PortraitKey, PortraitEmotion } from "./portraits/portraitData";
import type { EnemyVariant } from "./battle/enemyVariants";
import type { SceneBackgroundTheme } from "./backgrounds/SceneBackground";

// ── Portraits — 챔피언 로드 챕터 1 (3 캐릭터 × 3 감정 = 9) ──
const PORTRAIT_PNG: Record<string, Partial<Record<PortraitEmotion, true>>> = {
  osam: { default: true, happy: true, concerned: true },
  han_champion: { default: true, serious: true, angry: true },
  player_champion: { default: true, focused: true, hurt: true },
};

export function resolvePortraitAsset(
  portraitKey: PortraitKey,
  emotion: PortraitEmotion,
): string | null {
  // player → player_champion (현재 자산은 챔피언 루트만).
  // 향후 master/pro 자산 추가 시 routeColor prop 으로 분기 확장.
  const fileKey: string = portraitKey === "player" ? "player_champion" : portraitKey;
  if (PORTRAIT_PNG[fileKey]?.[emotion]) {
    return `/assets/story-rpg/portraits/${fileKey}_${emotion}.png`;
  }
  // 같은 캐릭터의 default 자산이 있으면 그걸로 폴백
  if (PORTRAIT_PNG[fileKey]?.default) {
    return `/assets/story-rpg/portraits/${fileKey}_default.png`;
  }
  return null;
}

// ── Enemies — tense_wolf (idle / hurt / defeated) ─────────────
// ⚠️ DB seed 의 boxing_story_enemies.code 는 'tense_wolf'.
//    enemyVariants.ts 의 EnemyVariant 키는 'tension_wolf' — 매핑 시 변환.
type EnemyPose = "idle" | "attack" | "hurt" | "defeated";
type EnemyPng = Partial<Record<EnemyPose, true>>;

const ENEMY_PNG: Partial<Record<EnemyVariant, EnemyPng>> = {
  tension_wolf: { idle: true, hurt: true, defeated: true },
};

const ENEMY_VARIANT_TO_FILE_CODE: Partial<Record<EnemyVariant, string>> = {
  tension_wolf: "tense_wolf",
};

export function resolveEnemyAsset(
  variant: EnemyVariant,
  pose: EnemyPose,
): string | null {
  const slot = ENEMY_PNG[variant];
  if (!slot) return null;
  // attack 자산이 없으면 idle 로 폴백
  const usePose: EnemyPose = slot[pose] ? pose : slot.idle ? "idle" : ("idle" as EnemyPose);
  const fileCode = ENEMY_VARIANT_TO_FILE_CODE[variant] ?? variant;
  return `/assets/story-rpg/enemies/${fileCode}_${usePose}.png`;
}

// ── Backgrounds — 3 테마 ──────────────────────────────────────
const BACKGROUND_PNG: Partial<Record<SceneBackgroundTheme, true>> = {
  gym_entrance: true,
  gym_ring: true,
  rival_arena: true,
};

export function resolveBackgroundAsset(
  theme: SceneBackgroundTheme,
): string | null {
  if (BACKGROUND_PNG[theme]) {
    return `/assets/story-rpg/backgrounds/${theme}.png`;
  }
  return null;
}

// ── World maps — champion_road ────────────────────────────────
const WORLD_MAP_PNG: Record<string, true> = {
  champion_road: true,
};

export function resolveWorldMapAsset(
  routeCode: string | null | undefined,
): string | null {
  if (!routeCode) return null;
  if (WORLD_MAP_PNG[routeCode]) {
    return `/assets/story-rpg/world_maps/${routeCode}.png`;
  }
  return null;
}

// ── Chapter title cards — champ_01_contender_gate ─────────────
const CHAPTER_TITLE_PNG: Record<string, true> = {
  champ_01_contender_gate: true,
};

export function resolveChapterTitleAsset(
  chapterCode: string | null | undefined,
): string | null {
  if (!chapterCode) return null;
  if (CHAPTER_TITLE_PNG[chapterCode]) {
    return `/assets/story-rpg/titles/${chapterCode}.png`;
  }
  return null;
}

// ── 픽셀 아트 공용 CSS — 16-bit 톤 유지 ───────────────────────
export const PIXELATED_CSS: CSSProperties = {
  imageRendering: "pixelated",
};
