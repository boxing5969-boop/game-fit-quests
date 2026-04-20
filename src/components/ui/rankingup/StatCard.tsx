import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  /** Small helper / delta / caption under the value. */
  helper?: string;
  icon?: ReactNode;
  /** Visual accent for the icon tile and helper text. */
  accent?: "primary" | "accent" | "reward" | "muted";
  className?: string;
}

const ACCENT_TILE: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/15 text-primary",
  accent: "bg-accent/15 text-accent",
  reward: "bg-reward/15 text-reward",
  muted: "bg-muted text-muted-foreground",
};

const ACCENT_HELPER: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "text-primary",
  accent: "text-accent",
  reward: "text-reward",
  muted: "text-muted-foreground",
};

/**
 * Vertical, mobile-first. Icon top-centered, label/value stacked
 * below. Optimized for 3-column grids on ~360px viewports where
 * a horizontal layout would `truncate` CJK text down to a single
 * character. Value wraps over two lines via leading-tight if
 * needed — no truncation.
 */
export const StatCard = ({
  label,
  value,
  helper,
  icon,
  accent = "muted",
  className,
}: StatCardProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-2 rounded-card border border-border bg-card p-3 text-center shadow-elev-1",
      className,
    )}
  >
    {icon && (
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          ACCENT_TILE[accent],
        )}
      >
        {icon}
      </div>
    )}
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="number-font mt-0.5 text-[15px] font-bold leading-tight text-foreground break-keep">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {helper && (
        <p className={cn("text-[10px] mt-0.5 leading-tight", ACCENT_HELPER[accent])}>
          {helper}
        </p>
      )}
    </div>
  </div>
);

export default StatCard;
