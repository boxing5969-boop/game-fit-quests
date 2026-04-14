import React, { useMemo, lazy, Suspense } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import BlackLeagueAura from "@/components/BlackLeagueAura";
import type { PartsSelection } from "@/data/characterPartsData";

// Lazy-load SVG renderer — only used as dev fallback, not in main production path
const LayeredCharacterRenderer = lazy(() => import("@/components/LayeredCharacterRenderer"));
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import {
  GLOVE_COLORS,
  EFFECT_EMOJIS,
  ACCESSORY_EMOJIS,
  FRAME_STYLES,
  TITLE_LABELS,
} from "@/data/characterCustomizationData";

interface CharacterSpriteProps {
  style?: string;
  userId?: string;
  partsJson?: { parts?: PartsSelection; style?: string; customization?: CharacterCustomization };
  size?: "xs" | "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
  onClick?: () => void;
  league?: "white" | "blue" | "red" | "black";
  level?: number;
  auraMode?: "compact" | "detail";
  /** CSS overlay customization */
  customization?: CharacterCustomization;
}

const SIZE_MAP = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-32 h-32",
};

const SIZE_PX = { xs: 32, sm: 48, md: 80, lg: 128 };

const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  style,
  userId,
  partsJson,
  size = "sm",
  animate = false,
  className = "",
  onClick,
  league,
  level,
  auraMode,
  customization: customizationProp,
}) => {
  const isLayered = !!(partsJson?.parts && Object.keys(partsJson.parts).length > 0);
  const presetStyle = partsJson?.style || style;

  // Merge customization from prop or partsJson
  const customization = customizationProp || partsJson?.customization;

  const imgSrc = useMemo(() => {
    if (isLayered) return null;
    if (presetStyle) return getCharacterImage(presetStyle);
    if (userId) return getCharacterByHash(userId).image;
    return getCharacterImage();
  }, [presetStyle, userId, isLayered]);

  const isBlack = league === "black";
  const isMaster = isBlack && (level ?? 0) >= 10;
  const showAura = isBlack;
  const effectiveAuraMode = auraMode ?? (size === "xs" || size === "sm" ? "compact" : "detail");

  // Only show overlays on md/lg sizes
  const showOverlays = size === "md" || size === "lg";
  const showEffectSmall = size === "sm"; // minimal effect on sm

  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >
      {/* Black League aura behind character */}
      {showAura && (
        <BlackLeagueAura
          mode={effectiveAuraMode}
          level={isMaster ? "master" : "halo"}
        />
      )}

      {/* Frame glow */}
      {customization?.frame && (
        <div className={`absolute inset-0 rounded-full z-[5] ${frameClass}`} />
      )}

      {isLayered ? (
        <Suspense fallback={<div className="relative z-10 h-full w-full animate-pulse rounded-full bg-muted" />}>
          <LayeredCharacterRenderer
            parts={partsJson!.parts!}
            size={SIZE_PX[size]}
            className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
          />
        </Suspense>
      ) : (
        <img
          src={imgSrc!}
          alt="캐릭터"
          className={`relative z-10 h-full w-full object-contain drop-shadow-sm ${animate ? "animate-emote-idle" : ""}`}
          style={{ imageRendering: "auto", willChange: animate ? "transform" : undefined }}
          draggable={false}
          loading="lazy"
        />
      )}

      {/* Effect particles */}
      {customization?.effect && (showOverlays || showEffectSmall) && (
        <EffectOverlay effect={customization.effect} size={size} />
      )}

      {/* Accessory emoji overlay — md/lg only */}
      {customization?.accessory && showOverlays && (
        <AccessoryOverlay accessory={customization.accessory} size={size} />
      )}

      {/* Glove color badge — md/lg only */}
      {customization?.gloveColor && showOverlays && (
        <div
          className="absolute -bottom-1 -right-1 z-20 rounded-full border-2 border-card"
          style={{
            width: size === "lg" ? 20 : 14,
            height: size === "lg" ? 20 : 14,
            backgroundColor: GLOVE_COLORS[customization.gloveColor] || GLOVE_COLORS.red,
          }}
        />
      )}

      {/* Title label — lg only */}
      {customization?.title && size === "lg" && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
          <span className={`text-[10px] font-bold ${TITLE_LABELS[customization.title]?.color || "text-foreground"}`}>
            {TITLE_LABELS[customization.title]?.text || customization.title}
          </span>
        </div>
      )}
    </div>
  );
};

// ===== Effect Particles =====
const EffectOverlay: React.FC<{ effect: string; size: string }> = ({ effect, size }) => {
  const emoji = EFFECT_EMOJIS[effect] || "✨";
  const isSmall = size === "sm" || size === "xs";

  if (isSmall) {
    return (
      <span className="absolute -top-1 -right-1 z-20 text-[10px] animate-pulse">
        {emoji}
      </span>
    );
  }

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      <span className="absolute top-0 left-0 text-xs animate-bounce" style={{ animationDelay: "0s" }}>{emoji}</span>
      <span className="absolute top-0 right-0 text-xs animate-bounce" style={{ animationDelay: "0.3s" }}>{emoji}</span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs animate-bounce" style={{ animationDelay: "0.6s" }}>{emoji}</span>
    </div>
  );
};

// ===== Accessory Emoji =====
const AccessoryOverlay: React.FC<{ accessory: string; size: string }> = ({ accessory }) => {
  const config = ACCESSORY_EMOJIS[accessory];
  if (!config) return null;

  return (
    <span className={`absolute z-20 text-base pointer-events-none ${config.position}`}>
      {config.emoji}
    </span>
  );
};

export default React.memo(CharacterSprite);
