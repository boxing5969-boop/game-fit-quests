import type { Enums } from "@/integrations/supabase/types";

const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

interface RankMiniCardProps {
  nickname: string;
  rank: string;
  level: number;
  position: number;
  avatarUrl?: string | null;
  xp?: number;
  isMe?: boolean;
  isRival?: boolean;
  onSetRival?: () => void;
  extra?: string;
}

const RankMiniCard = ({ nickname, rank, level, position, avatarUrl, xp, isMe, isRival, onSetRival, extra }: RankMiniCardProps) => {
  const positionLabel = position <= 3
    ? ["🥇", "🥈", "🥉"][position - 1]
    : `${position}위`;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${
      isMe ? "border-primary bg-primary/5 shadow-sm" : isRival ? "border-accent/50 bg-accent/5" : "border-border bg-card"
    }`}>
      {/* Position */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
        <span className={`text-sm font-bold ${position <= 3 ? "text-lg" : "text-muted-foreground"}`}>
          {positionLabel}
        </span>
      </div>

      {/* Avatar */}
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${
        isMe ? "bg-primary/15" : "bg-secondary"
      }`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span>{RANK_ICONS[rank] || "⚪"}</span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm font-bold ${isMe ? "text-primary" : "text-foreground"}`}>
            {nickname}
            {isMe && <span className="ml-1 text-xs text-primary">(나)</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{RANK_ICONS[rank]}</span>
          <span>{RANK_LABELS[rank]} Lv.{level}</span>
          {extra && <span>· {extra}</span>}
          {xp !== undefined && <span>· {xp.toLocaleString()} XP</span>}
        </div>
      </div>

      {/* Rival button */}
      {onSetRival && !isMe && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetRival(); }}
          className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
            isRival
              ? "bg-accent/20 text-accent-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {isRival ? "🎯 목표" : "따라잡기"}
        </button>
      )}
    </div>
  );
};

export default RankMiniCard;
