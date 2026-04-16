import React, { useMemo, lazy, Suspense } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import type { PartsSelection } from "@/data/characterPartsData";
const LayeredCharacterRenderer = lazy(() => import("@/components/LayeredCharacterRenderer"));
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import { FRAME_STYLES, TITLE_LABELS } from "@/data/characterCustomizationData";

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

  const showOverlays = size === "md" || size === "lg";
  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >
      {customization?.frame && showOverlays && (
        <div className={`absolute inset-0 rounded-full z-[5] ${frameClass}`} />
      )}

      <div
        className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
        style={{ willChange: animate ? "transform" : undefined }}
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
      </div>

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

export default React.memo(CharacterSprite);
