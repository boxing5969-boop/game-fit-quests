import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface XPBarProps extends HTMLAttributes<HTMLDivElement> {
  current: number;
  max: number;
  label?: string;
  variant?: "primary" | "reward" | "blue";
  /** Height variant. Default "md" (8px). */
  size?: "sm" | "md" | "lg";
  /** Show the numeric current / max below the bar. */
  showNumbers?: boolean;
}

const FILL_BY_VARIANT: Record<NonNullable<XPBarProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(8_90%_62%)_100%)]",
  reward:
    "bg-[linear-gradient(90deg,hsl(var(--reward))_0%,hsl(42_100%_74%)_100%)]",
  blue:
    "bg-[linear-gradient(90deg,hsl(var(--accent))_0%,hsl(215_100%_70%)_100%)]",
};

const GLOW_BY_VARIANT: Record<NonNullable<XPBarProps["variant"]>, string> = {
  primary: "shadow-glow-primary",
  reward: "shadow-glow-reward",
  blue: "shadow-glow-blue",
};

const SIZE_MAP: Record<NonNullable<XPBarProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export const XPBar = ({
  current,
  max,
  label,
  variant = "primary",
  size = "md",
  showNumbers = false,
  className,
  ...rest
}: XPBarProps) => {
  const safeMax = Math.max(1, max);
  const pct = Math.min(100, Math.max(0, (current / safeMax) * 100));
  const nearComplete = pct >= 85;

  return (
    <div className={cn("w-full", className)} {...rest}>
      {(label || showNumbers) && (
        <div className="mb-1 flex items-center justify-between text-caption">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showNumbers && (
            <span className="number-font font-bold text-foreground">
              {current.toLocaleString()}
              <span className="text-muted-foreground">
                {" / "}
                {max.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-pill bg-[hsl(var(--xp-bar-bg))]",
          SIZE_MAP[size],
        )}
      >
        <div
          className={cn(
            "h-full rounded-pill transition-all duration-500",
            FILL_BY_VARIANT[variant],
            nearComplete && GLOW_BY_VARIANT[variant],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default XPBar;
