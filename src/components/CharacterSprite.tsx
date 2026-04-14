import React, { useMemo } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";

interface CharacterSpriteProps {
  /** Style key from preset's parts_json.style */
  style?: string;
  /** Fallback: deterministic char from userId */
  userId?: string;
  /** Display size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Show idle bounce animation */
  animate?: boolean;
  /** Additional className */
  className?: string;
  /** onClick handler */
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: "w-8 h-8",    // 32px - dense rail (20-30 chars)
  sm: "w-12 h-12",  // 48px - list items
  md: "w-20 h-20",  // 80px - cards
  lg: "w-32 h-32",  // 128px - preview
};

const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  style,
  userId,
  size = "sm",
  animate = false,
  className = "",
  onClick,
}) => {
  const imgSrc = useMemo(() => {
    if (style) return getCharacterImage(style);
    if (userId) return getCharacterByHash(userId).image;
    return getCharacterImage();
  }, [style, userId]);

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >
      <img
        src={imgSrc}
        alt="캐릭터"
        className={`h-full w-full object-contain drop-shadow-sm ${animate ? "animate-emote-idle" : ""}`}
        style={{ imageRendering: "auto", willChange: animate ? "transform" : undefined }}
        draggable={false}
        loading="lazy"
      />
    </div>
  );
};

export default React.memo(CharacterSprite);
