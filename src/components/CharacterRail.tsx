import React from "react";
import CharacterSprite from "./CharacterSprite";

interface RailMember {
  userId: string;
  nickname: string;
  characterStyle?: string;
  rank?: string;
  level?: number;
}

interface CharacterRailProps {
  members: RailMember[];
  onMemberTap?: (userId: string) => void;
  maxVisible?: number;
}

const CharacterRail: React.FC<CharacterRailProps> = ({
  members,
  onMemberTap,
  maxVisible = 30,
}) => {
  const visible = members.slice(0, maxVisible);

  if (visible.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-end gap-0.5 px-2 py-1" style={{ minWidth: "max-content" }}>
        {visible.map((m) => (
          <div
            key={m.userId}
            className="flex flex-col items-center gap-0"
            style={{ width: "clamp(36px, 4vw, 48px)" }}
          >
            <CharacterSprite
              style={m.characterStyle}
              userId={m.userId}
              size="xs"
              animate
              onClick={() => onMemberTap?.(m.userId)}
            />
            <span
              className="mt-0.5 truncate text-center text-[8px] font-bold leading-tight text-foreground/70"
              style={{ maxWidth: "clamp(32px, 3.5vw, 44px)" }}
            >
              {m.nickname}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CharacterRail);
