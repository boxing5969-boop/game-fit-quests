import React, { useMemo } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import BlackLeagueAura from "@/components/BlackLeagueAura";
import LayeredCharacterRenderer from "@/components/LayeredCharacterRenderer";
import type { PartsSelection } from "@/data/characterPartsData";

interface CharacterSpriteProps {
  /** Style key from preset's parts_json.style */
  style?: string;
  /** Fallback: deterministic char from userId */
  userId?: string;
  /** Custom parts selection for layered SVG rendering */
  partsJson?: { parts?: PartsSelection; style?: string };
  /** Display size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Show idle bounce animation */
  animate?: boolean;
  /** Additional className */
  className?: string;
  /** onClick handler */
  onClick?: () => void;
  /** Member's league for auto-aura */
  league?: "white" | "blue" | "red" | "black";
  /** Member's level within league (1-10) */
  level?: number;
  /** Aura rendering mode */
  auraMode?: "compact" | "detail";
}

const SIZE_MAP = {
  xs: "w-8 h-8",    // 32px - dense rail (20-30 chars)
  sm: "w-12 h-12",  // 48px - list items
  md: "w-20 h-20",  // 80px - cards
  lg: "w-32 h-32",  // 128px - preview
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
}) => {
  // Determine rendering mode: layered SVG vs PNG preset
  const isLayered = !!(partsJson?.parts && Object.keys(partsJson.parts).length > 0);
  const presetStyle = partsJson?.style || style;

  const imgSrc = useMemo(() => {
    if (isLayered) return null; // SVG mode
    if (presetStyle) return getCharacterImage(presetStyle);
    if (userId) return getCharacterByHash(userId).image;
    return getCharacterImage();
  }, [presetStyle, userId, isLayered]);

  // Auto-determine aura for Black League
  const isBlack = league === "black";
  const isMaster = isBlack && (level ?? 0) >= 10;
  const showAura = isBlack;
  const effectiveAuraMode = auraMode ?? (size === "xs" ? "compact" : size === "sm" ? "compact" : "detail");

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
      {isLayered ? (
        <LayeredCharacterRenderer
          parts={partsJson!.parts!}
          size={SIZE_PX[size]}
          className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
        />
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
    </div>
  );
};

export default React.memo(CharacterSprite);
