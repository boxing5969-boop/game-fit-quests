import { RANK_ICONS, RANK_LABELS, formatRank } from "@/lib/rankLabels";

interface RankMiniCardProps {
  nickname: string;
  rank: string;
  level: number;
  position: number;
  avatarUrl?: string | null;
  xp?: number;
  isMe?: boolean;
  isRival?: boolean;
  isHallOfFame?: boolean;
  onSetRival?: () => void;
  extra?: string;
}

const RankMiniCard = ({ nickname, rank, level, position, avatarUrl, xp, isMe, isRival, isHallOfFame, onSetRival, extra }: RankMiniCardProps) => {
  const positionLabel = position <= 3
    ? ["🥇", "🥈", "🥉"][position - 1]
    : `${position}위`;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${
      isHallOfFame
        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 shadow-elev-1"
        : isMe ? "border-primary bg-primary/5 shadow-elev-1"
        : isRival ? "border-reward/50 bg-reward/5"
        : "border-border bg-card"
    }`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
        <span className={`text-sm font-bold ${position <= 3 ? "text-lg" : "text-muted-foreground"}`}>
          {positionLabel}
        </span>
      </div>

      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${
        isHallOfFame ? "bg-amber-500/20 ring-2 ring-amber-500/30" : isMe ? "bg-primary/15" : "bg-secondary"
      }`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span>{isHallOfFame ? "👑" : RANK_ICONS[rank] || "⚪"}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm font-bold ${
            isHallOfFame ? "text-amber-600 dark:text-amber-400" : isMe ? "text-primary" : "text-foreground"
          }`}>
            {nickname}
            {isMe && <span className="ml-1 text-xs text-primary">(나)</span>}
          </span>
          {isHallOfFame && (
            <span className="flex-shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              153명예코치
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{RANK_ICONS[rank]}</span>
          <span>{formatRank(rank, level)}</span>
          {extra && extra !== "153명예코치" && <span>· {extra}</span>}
          {xp !== undefined && <span>· {xp.toLocaleString()} XP</span>}
        </div>
      </div>

      {onSetRival && !isMe && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetRival(); }}
          className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
            isRival
              ? "bg-reward/20 text-reward-foreground"
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
