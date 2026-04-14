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
} from "@/data/characterCustomizationData";
import PresetOverlayRenderer from "@/components/PresetOverlayRenderer";
import { usePresetVariants } from "@/hooks/usePresetVariants";
import type { PresetVariant } from "@/hooks/usePresetVariants";

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
  /** DB-driven preset variants for overlay rendering */
  presetVariants?: PresetVariant[];
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
  presetVariants,
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
  const showAura = isBlack;
  const effectiveAuraMode = auraMode ?? (size === "xs" || size === "sm" ? "compact" : "detail");

  const showOverlays = size === "md" || size === "lg";
  const showEffectSmall = size === "sm";

  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  // Build selection map for PresetOverlayRenderer from customization
  const overlaySelections = useMemo(() => {
    if (!customization) return {};
    const sel: Record<string, string> = {};
    if (customization.gloveStyle) sel.gloves = customization.gloveStyle;
    if (customization.accessory) sel.accessory = customization.accessory;
    return sel;
  }, [customization?.gloveStyle, customization?.accessory]);

  const hasDBOverlays = presetVariants && presetVariants.length > 0 && Object.keys(overlaySelections).length > 0;

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

      {/* Frame glow — outside animation container */}
      {customization?.frame && showOverlays && (
        <div className={`absolute inset-0 rounded-full z-[5] ${frameClass}`} />
      )}

      {/* === UNIFIED ANIMATION CONTAINER === */}
      <div className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
           style={{ willChange: animate ? "transform" : undefined }}>

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

        {/* === DB-DRIVEN PRESET OVERLAYS (gloves, accessories) === */}
        {hasDBOverlays && showOverlays && (
          <PresetOverlayRenderer
            variants={presetVariants!}
            selections={overlaySelections}
            containerSize={SIZE_PX[size]}
          />
        )}

        {/* ===== EFFECT PARTICLES ===== */}
        {customization?.effect && (showOverlays || showEffectSmall) && (
          <EffectOverlay effect={customization.effect} size={size} />
        )}
      </div>

      {/* Title label — outside animation container, below character */}
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
