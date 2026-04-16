import React, { useMemo, lazy, Suspense } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import BlackLeagueAura from "@/components/BlackLeagueAura";
import type { PartsSelection } from "@/data/characterPartsData";

const LayeredCharacterRenderer = lazy(() => import("@/components/LayeredCharacterRenderer"));
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import {
  EFFECT_EMOJIS,
  FRAME_STYLES,
  TITLE_LABELS,
  AURA_RADIAL_STYLES,
  AURA_SPIN_DURATIONS,
  MASTER_AURA_KEYS,
  VICTORY_QUOTE_TEXTS,
  BADGE_EMOJIS,
  VICTORY_POSE_ANIMATIONS,
  NAMEPLATE_STYLES,
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
  customization?: CharacterCustomization;
}

const SIZE_MAP = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-32 h-32",
};

const SIZE_PX = { xs: 32, sm: 48, md: 80, lg: 128 };

// Aura inset by size: small sprites get tighter glow
const AURA_INSET: Record<string, string> = {
  xs: "-4px",
  sm: "-4px",
  md: "-8px",
  lg: "-8px",
};

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
  const customization = customizationProp || partsJson?.customization;

  const imgSrc = useMemo(() => {
    if (isLayered) return null;
    if (presetStyle) return getCharacterImage(presetStyle);
    if (userId) return getCharacterByHash(userId).image;
    return getCharacterImage();
  }, [presetStyle, userId, isLayered]);

  const isBlack = league === "black";
  const isMaster = isBlack && (level ?? 0) >= 10;
  const effectiveAuraMode = auraMode ?? (size === "xs" || size === "sm" ? "compact" : "detail");

  const showOverlays = size === "md" || size === "lg";
  const showEffectSmall = size === "sm";
  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  const auraKey = customization?.aura;
  const victoryPoseClass = customization?.victoryPose ? VICTORY_POSE_ANIMATIONS[customization.victoryPose] || "" : "";
  const badgeEmoji = customization?.badge ? BADGE_EMOJIS[customization.badge] || "" : "";
  const nameplateClass = customization?.nameplate ? NAMEPLATE_STYLES[customization.nameplate] || "" : "";
  const victoryQuoteText = customization?.victoryQuote ? VICTORY_QUOTE_TEXTS[customization.victoryQuote] || "" : "";

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >
      {/* Black League aura (league reward) */}
      {isBlack && (
        <BlackLeagueAura
          mode={effectiveAuraMode}
          level={isMaster ? "master" : "halo"}
        />
      )}

      {/* Customization aura — circular radial glow from center (z-[3]) */}
      {auraKey && auraKey !== "none" && size !== "xs" && (
        MASTER_AURA_KEYS.includes(auraKey) ? (
          <MasterAuraOverlay auraKey={auraKey} size={size} />
        ) : AURA_RADIAL_STYLES[auraKey] ? (
          <div
            className={`absolute rounded-full pointer-events-none z-[3] ${
              auraKey.includes("rainbow") || auraKey.includes("galaxy") ? "animate-spin" :
              auraKey === "aura_lightning" ? "animate-ping" : "animate-pulse"
            }`}
            style={{
              inset: AURA_INSET[size],
              background: AURA_RADIAL_STYLES[auraKey],
              animationDuration: AURA_SPIN_DURATIONS[auraKey] ?? undefined,
            }}
          />
        ) : null
      )}

      {/* Frame ring */}
      {customization?.frame && showOverlays && (
        <div className={`absolute inset-0 rounded-full z-[5] ${frameClass}`} />
      )}

      {/* Badge icon (top-left) */}
      {badgeEmoji && showOverlays && (
        <div className="absolute -top-1 -left-1 z-20 text-sm drop-shadow-md">
          {badgeEmoji}
        </div>
      )}

      {/* Animation container */}
      <div
        className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""} ${victoryPoseClass}`}
        style={{ willChange: animate || victoryPoseClass ? "transform" : undefined }}
      >
        {isLayered ? (
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-muted" />}>
            <LayeredCharacterRenderer
              parts={partsJson!.parts!}
              size={SIZE_PX[size]}
              className="h-full w-full"
            />
          </Suspense>
        ) : (
          <img
            src={imgSrc!}
            alt="캐릭터"
            className="h-full w-full object-contain drop-shadow-sm"
            style={{ imageRendering: "auto" }}
            draggable={false}
            loading="lazy"
          />
        )}

        {/* Effect particles */}
        {customization?.effect && (showOverlays || showEffectSmall) && (
          <EffectOverlay effect={customization.effect} size={size} />
        )}
      </div>

      {/* Title label (with optional nameplate styling) */}
      {customization?.title && size === "lg" && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
          <span className={`text-[10px] font-bold ${
            nameplateClass || TITLE_LABELS[customization.title]?.color || "text-foreground"
          }`}>
            {TITLE_LABELS[customization.title]?.text || customization.title}
          </span>
        </div>
      )}

      {/* Victory quote (below title) */}
      {victoryQuoteText && size === "lg" && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
          <span className="text-[8px] text-muted-foreground/80 font-medium italic">
            {victoryQuoteText}
          </span>
        </div>
      )}
    </div>
  );
};

// ===== Master Aura Multi-Layer Renderer =====
type MasterAuraLayer = {
  gradient: string;
  mask?: string;
  animClass: string;
  opacity: number;
  inset: string;
  duration?: string;
};

const MASTER_AURA_CONFIG: Record<string, MasterAuraLayer[]> = {
  halo_rainbow_master: [
    {
      gradient: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.75,
      inset: "-14px",
      duration: "4s",
    },
    {
      gradient: "conic-gradient(from 180deg, #ff9ff3, #54a0ff, #48dbfb, #feca57, #ff6b6b, #5f27cd, #ff9ff3)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.5,
      inset: "-7px",
      duration: "6s",
    },
    {
      gradient: "radial-gradient(circle, rgba(147,51,234,0.5), rgba(59,130,246,0.3), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.4,
      inset: "-5px",
    },
  ],
  halo_black_gold: [
    {
      gradient: "conic-gradient(from 0deg, #fbbf24, #78350f, #fbbf24, #1c1917, #fbbf24, #78350f, #fbbf24)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.85,
      inset: "-14px",
      duration: "5s",
    },
    {
      gradient: "conic-gradient(from 90deg, #1c1917, #fbbf24, #78350f, #fbbf24, #1c1917)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.6,
      inset: "-7px",
      duration: "7s",
    },
    {
      gradient: "radial-gradient(circle, rgba(251,191,36,0.6), rgba(28,25,23,0.5), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.45,
      inset: "-5px",
    },
  ],
  halo_conqueror: [
    {
      gradient: "conic-gradient(from 0deg, #ef4444, #f97316, #7c2d12, #ef4444, #b91c1c, #f97316, #ef4444)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.85,
      inset: "-14px",
      duration: "3s",
    },
    {
      gradient: "conic-gradient(from 180deg, #7c2d12, #ef4444, #f97316, #b91c1c, #7c2d12)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.55,
      inset: "-7px",
      duration: "5s",
    },
    {
      gradient: "radial-gradient(circle, rgba(239,68,68,0.7), rgba(249,115,22,0.4), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.45,
      inset: "-5px",
    },
  ],
  halo_galaxy_master: [
    {
      gradient: "conic-gradient(from 0deg, #4f46e5, #7c3aed, #0f172a, #1d4ed8, #7c3aed, #0f172a, #4f46e5)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.75,
      inset: "-14px",
      duration: "6s",
    },
    {
      gradient: "conic-gradient(from 270deg, #1e1b4b, #4f46e5, #7c3aed, #1e40af, #1e1b4b)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.5,
      inset: "-7px",
      duration: "8s",
    },
    {
      gradient: "radial-gradient(circle, rgba(99,102,241,0.5), rgba(124,58,237,0.35), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.4,
      inset: "-5px",
    },
  ],
};

const MasterAuraOverlay: React.FC<{ auraKey: string; size: string }> = ({ auraKey, size }) => {
  const layers = MASTER_AURA_CONFIG[auraKey];
  if (!layers) return null;
  // Scale outer ring down for smaller sizes
  const outerInset = size === "sm" ? "-8px" : "-14px";
  return (
    <>
      {layers.map((layer, i) => (
        <div
          key={i}
          className={`absolute rounded-full pointer-events-none z-[3] ${layer.animClass}`}
          style={{
            inset: i === 0 ? outerInset : layer.inset,
            background: layer.gradient,
            opacity: layer.opacity,
            ...(layer.mask ? { mask: layer.mask, WebkitMask: layer.mask } : {}),
            ...(layer.duration ? { animationDuration: layer.duration } : {}),
          }}
        />
      ))}
    </>
  );
};

// ===== Effect Particles =====
const EffectOverlay: React.FC<{ effect: string; size: string }> = ({ effect, size }) => {
  const emoji = EFFECT_EMOJIS[effect] || "✨";

  if (size === "sm" || size === "xs") {
    return (
      <span className="absolute -top-1 -right-1 z-20 text-xs animate-pulse pointer-events-none">
        {emoji}
      </span>
    );
  }

  const emojiSize = size === "lg" ? "text-lg" : "text-sm";
  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-8%", left: "5%", animationDelay: "0s", animationDuration: "1.5s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-8%", right: "5%", animationDelay: "0.4s", animationDuration: "1.8s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "5%", left: "50%", transform: "translateX(-50%)", animationDelay: "0.8s", animationDuration: "2s" }}>{emoji}</span>
      {size === "lg" && (
        <>
          <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "30%", left: "-10%", animationDelay: "0.2s", animationDuration: "1.6s" }}>{emoji}</span>
          <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "30%", right: "-10%", animationDelay: "0.6s", animationDuration: "1.4s" }}>{emoji}</span>
        </>
      )}
    </div>
  );
};

export default React.memo(CharacterSprite);
