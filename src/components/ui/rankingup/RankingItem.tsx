import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingItemProps {
  rank: number;
  name: string;
  /** Image URL, ReactNode (e.g. CharacterSprite), or emoji string. */
  avatar?: ReactNode | string;
  score: string | number;
  /** Positional delta: +2 = moved up 2, -1 = moved down, 0 = same. */
  delta?: number;
  /** Highlight as the current user. */
  isMe?: boolean;
  /** Scoreboard secondary line e.g. "블랙 리그 Lv.8". */
  meta?: string;
  onClick?: () => void;
  className?: string;
}

const rankAccent = (rank: number) =>
  rank === 1
    ? "bg-reward/20 text-reward"
    : rank === 2
      ? "bg-[hsl(220_14%_71%)]/20 text-[hsl(220_14%_85%)]"
      : rank === 3
        ? "bg-[hsl(25_70%_55%)]/25 text-[hsl(25_80%_70%)]"
        : "bg-muted text-muted-foreground";

export const RankingItem = ({
  rank,
  name,
  avatar,
  score,
  delta,
  isMe = false,
  meta,
  onClick,
  className,
}: RankingItemProps) => {
  const Root = onClick ? "button" : "div";

  return (
    <Root
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border p-3 text-left transition-all",
        isMe
          ? "border-primary/50 bg-primary/5 shadow-glow-soft"
          : "border-border bg-card",
        onClick && "active:scale-[0.99]",
        className,
      )}
    >
      {/* Rank pill */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-pill",
          rankAccent(rank),
        )}
      >
        <span className="number-font text-body-lg font-bold">{rank}</span>
      </div>

      {/* Avatar */}
      {avatar && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-background/40">
          {typeof avatar === "string" && /^https?:\/\//.test(avatar) ? (
            <img
              src={avatar}
              alt={name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : typeof avatar === "string" ? (
            <span className="text-lg">{avatar}</span>
          ) : (
            avatar
          )}
        </div>
      )}

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-body-sm font-bold text-foreground">
            {name}
          </p>
          {isMe && (
            <span className="badge-pill bg-primary/20 text-primary">나</span>
          )}
        </div>
        {meta && (
          <p className="text-caption truncate text-muted-foreground">{meta}</p>
        )}
      </div>

      {/* Score + delta */}
      <div className="flex flex-col items-end">
        <span className="number-font text-body-lg font-bold text-foreground">
          {typeof score === "number" ? score.toLocaleString() : score}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold",
              // Spec: 상승 #22C55E / 하락 #EF4444 / 유지 #697386
              delta > 0
                ? "text-[#22C55E]"
                : delta < 0
                  ? "text-[#EF4444]"
                  : "text-[#697386]",
            )}
          >
            {delta > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {delta !== 0 && Math.abs(delta)}
          </span>
        )}
      </div>
    </Root>
  );
};

export default RankingItem;
