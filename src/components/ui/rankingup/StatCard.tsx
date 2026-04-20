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

export const StatCard = ({
  label,
  value,
  helper,
  icon,
  accent = "muted",
  className,
}: StatCardProps) => (
  <div className={cn("surface-card flex items-center gap-3 p-4", className)}>
    {icon && (
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          ACCENT_TILE[accent],
        )}
      >
        {icon}
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-caption truncate text-muted-foreground">{label}</p>
      <p className="number-font text-number-sm truncate text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {helper && (
        <p className={cn("text-caption mt-0.5 truncate", ACCENT_HELPER[accent])}>
          {helper}
        </p>
      )}
    </div>
  </div>
);

export default StatCard;
