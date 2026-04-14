import React, { useMemo, lazy, Suspense } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import BlackLeagueAura from "@/components/BlackLeagueAura";
import type { PartsSelection } from "@/data/characterPartsData";

const LayeredCharacterRenderer = lazy(() => import("@/components/LayeredCharacterRenderer"));
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import {
  GLOVE_COLORS,
  EFFECT_EMOJIS,
  ACCESSORY_CONFIGS,
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
  const px = SIZE_PX[size];

  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  // Glove color overlay style — visible tinted circles on both fists
  const gloveColor = customization?.gloveColor ? GLOVE_COLORS[customization.gloveColor] : null;
  const gloveSize = size === "lg" ? 22 : size === "md" ? 14 : 8;

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

      {/* === UNIFIED ANIMATION CONTAINER === 
           All overlays are INSIDE this container so they move with the boxer */}
      <div className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
           style={{ willChange: animate ? "transform" : undefined }}>
        
        {isLayered ? (
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-muted" />}>
            <LayeredCharacterRenderer
              parts={partsJson!.parts!}
              size={px}
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

        {/* ===== GLOVE COLOR — dual colored circles on both fists ===== */}
        {gloveColor && showOverlays && (
          <>
            {/* Left glove */}
            <div
              className="absolute z-20 rounded-full shadow-lg"
              style={{
                width: gloveSize,
                height: gloveSize,
                backgroundColor: gloveColor,
                bottom: size === "lg" ? "18%" : "16%",
                left: size === "lg" ? "12%" : "10%",
                border: `2px solid ${gloveColor}`,
                boxShadow: `0 0 ${size === "lg" ? 10 : 6}px ${gloveColor}80, inset 0 -2px 4px rgba(0,0,0,0.3)`,
              }}
            />
            {/* Right glove */}
            <div
              className="absolute z-20 rounded-full shadow-lg"
              style={{
                width: gloveSize,
                height: gloveSize,
                backgroundColor: gloveColor,
                bottom: size === "lg" ? "18%" : "16%",
                right: size === "lg" ? "12%" : "10%",
                border: `2px solid ${gloveColor}`,
                boxShadow: `0 0 ${size === "lg" ? 10 : 6}px ${gloveColor}80, inset 0 -2px 4px rgba(0,0,0,0.3)`,
              }}
            />
            {/* Color band across bottom for extra visibility */}
            <div
              className="absolute z-[15] rounded-b-full"
              style={{
                height: size === "lg" ? 6 : 4,
                left: "20%",
                right: "20%",
                bottom: size === "lg" ? "12%" : "10%",
                backgroundColor: gloveColor,
                opacity: 0.5,
                filter: "blur(2px)",
              }}
            />
          </>
        )}

        {/* ===== ACCESSORY — properly sized & anchored ===== */}
        {customization?.accessory && showOverlays && (
          <AccessoryOverlay accessory={customization.accessory} sizePx={px} />
        )}

        {/* ===== EFFECT PARTICLES ===== */}
        {customization?.effect && (showOverlays || showEffectSmall) && (
          <EffectOverlay effect={customization.effect} size={size} sizePx={px} />
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

// ===== Effect Particles — larger, more visible =====
const EffectOverlay: React.FC<{ effect: string; size: string; sizePx: number }> = ({ effect, size, sizePx }) => {
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

// ===== Accessory — styled HTML elements, not just emoji =====
const AccessoryOverlay: React.FC<{ accessory: string; sizePx: number }> = ({ accessory, sizePx }) => {
  const config = ACCESSORY_CONFIGS[accessory];
  if (!config) return null;

  const isLarge = sizePx >= 128;
  const scale = isLarge ? 1 : 0.65;

  return (
    <div
      className="absolute z-20 pointer-events-none flex items-center justify-center"
      style={{
        top: config.top,
        left: config.left,
        width: config.width,
        height: config.height,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {config.render(isLarge)}
    </div>
  );
};

export default React.memo(CharacterSprite);
