/**
 * 153 스토리 RPG — 전투 무대 (Stage 47B).
 *
 * 0층: SceneBackground (47A 재사용) — gym_ring 기본
 * 1층: 적 (상단 중앙) + 플레이어 (하단 좌측)
 * 2층: AttackAnimation overlay
 * 3층: damage popups / hit effects
 * 4층: FlashOverlay (47A 재사용)
 * 전체: CameraShake (47A 재사용)
 */

import { lazy, Suspense, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import CameraShake from "../effects/CameraShake";
import FlashOverlay from "../effects/FlashOverlay";
import DamagePopup, { type DamagePopupVariant } from "./DamagePopup";
import HitEffect, { type HitKind } from "./HitEffect";
import PlayerBoxer, {
  type PlayerPose,
  type PlayerRouteColor,
} from "./PlayerBoxer";
import EnemySvg, { type EnemyPose } from "./EnemySvg";
import type { EnemyVariant } from "./enemyVariants";
import type { SceneBackgroundTheme, SceneMood } from "../backgrounds/SceneBackground";

const SceneBackground = lazy(() => import("../backgrounds/SceneBackground"));

export interface DamagePopupItem {
  id: string | number;
  x: number;
  y: number;
  value: number | string;
  variant?: DamagePopupVariant;
}

export interface HitEffectItem {
  id: string | number;
  x: number;
  y: number;
  kind?: HitKind;
}

export interface BattleArenaProps {
  enemyVariant: EnemyVariant;
  enemyName: string;
  isBoss?: boolean;
  enemyPose: EnemyPose;
  playerPose: PlayerPose;
  routeColor?: PlayerRouteColor;
  backgroundTheme?: SceneBackgroundTheme;
  mood?: SceneMood;
  shakeKey: number;
  shakeIntensity?: "soft" | "medium" | "hard";
  flashKey: number;
  flashColor?: "white" | "red" | "amber";
  damagePopups: DamagePopupItem[];
  hitEffects: HitEffectItem[];
  /** AttackAnimation 등을 children 으로 주입. */
  overlayChildren?: ReactNode;
}

// 좌표 (arena box 기준 px) — 이 컴포넌트가 노출하는 정적 위치.
// AttackAnimation 의 playerXY / enemyXY 와 동일 값 사용 권장.
export const ARENA_LAYOUT = {
  width: 360,
  height: 280,
  enemy: { x: 180, y: 90 },
  player: { x: 100, y: 220 },
};

const BattleArena = ({
  enemyVariant,
  enemyName,
  isBoss,
  enemyPose,
  playerPose,
  routeColor = "master",
  backgroundTheme = "gym_ring",
  mood = "tense",
  shakeKey,
  shakeIntensity = "medium",
  flashKey,
  flashColor = "white",
  damagePopups,
  hitEffects,
  overlayChildren,
}: BattleArenaProps) => {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 shadow-lg"
      style={{ width: "100%", maxWidth: ARENA_LAYOUT.width, height: ARENA_LAYOUT.height }}
    >
      <CameraShake trigger={shakeKey} intensity={shakeIntensity}>
        <div className="relative h-full w-full">
          {/* 0층: 배경 */}
          <Suspense fallback={null}>
            <SceneBackground theme={backgroundTheme} mood={mood} />
          </Suspense>

          {/* 1층: 적 + 플레이어 */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: ARENA_LAYOUT.enemy.x, top: ARENA_LAYOUT.enemy.y }}
          >
            <EnemySvg
              variant={enemyVariant}
              pose={enemyPose}
              isBoss={isBoss}
              size="md"
            />
          </div>
          {/* 적 이름 라벨 */}
          <p
            className="absolute -translate-x-1/2 whitespace-nowrap text-center text-[10px] font-black uppercase tracking-widest text-rose-200"
            style={{ left: ARENA_LAYOUT.enemy.x, top: 6 }}
          >
            {enemyName}
            {isBoss && (
              <span className="ml-1.5 rounded-full bg-rose-500/30 px-1.5 py-0.5 text-[8px] font-bold text-rose-100">
                BOSS
              </span>
            )}
          </p>

          <div
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: ARENA_LAYOUT.player.x, top: ARENA_LAYOUT.player.y }}
          >
            <PlayerBoxer pose={playerPose} routeColor={routeColor} size="md" />
          </div>

          {/* 2층: 외부 overlay (AttackAnimation 등) */}
          {overlayChildren}

          {/* 3층: damage popups + hit effects */}
          <AnimatePresence>
            {damagePopups.map((p) => (
              <DamagePopup key={p.id} {...p} />
            ))}
          </AnimatePresence>
          {hitEffects.map((h) => (
            <HitEffect key={h.id} {...h} />
          ))}

          {/* 4층: flash */}
          <FlashOverlay trigger={flashKey} color={flashColor} duration={180} />
        </div>
      </CameraShake>
    </div>
  );
};

export default BattleArena;
