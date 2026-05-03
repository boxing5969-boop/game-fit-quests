/**
 * 153 QUEST — 나만의 복싱 전당: 작은 통계 타일.
 */

import type { LucideIcon } from "lucide-react";

export interface BoxingHallStatTileProps {
  icon?: React.ReactNode | LucideIcon;
  label: string;
  value: string | number;
  tone?: "primary" | "reward" | "muted";
  hint?: string;
  loading?: boolean;
}

const TONE: Record<NonNullable<BoxingHallStatTileProps["tone"]>, string> = {
  primary: "text-primary",
  reward: "text-reward",
  muted: "text-foreground",
};

const BoxingHallStatTile = ({
  icon,
  label,
  value,
  tone = "muted",
  hint,
  loading = false,
}: BoxingHallStatTileProps) => {
  const display =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div className="rounded-card border border-border bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className={`text-[12px] ${TONE[tone]}`}>
            {icon as React.ReactNode}
          </span>
        )}
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      {loading ? (
        <div
          className="mt-1 h-[16px] w-12 animate-pulse rounded bg-muted/60"
          aria-hidden="true"
        />
      ) : (
        <p
          className={`number-font mt-0.5 text-[15px] font-black ${TONE[tone]}`}
        >
          {display}
        </p>
      )}
      {hint && !loading && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};

export default BoxingHallStatTile;
