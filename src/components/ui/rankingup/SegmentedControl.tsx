import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Segment<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  segments: Segment<T>[];
  className?: string;
  /** "lg" pads more (tab-style), "sm" is compact (inline). Default "md". */
  size?: "sm" | "md" | "lg";
  /** Make the container fill its parent width. */
  fullWidth?: boolean;
}

const SIZE_MAP: Record<NonNullable<SegmentedControlProps<string>["size"]>, {
  track: string;
  item: string;
  text: string;
}> = {
  sm: {
    track: "p-0.5",
    item: "px-3 py-1.5",
    text: "text-caption",
  },
  md: {
    track: "p-1",
    item: "px-4 py-2",
    text: "text-body-sm",
  },
  lg: {
    track: "p-1",
    item: "px-4 py-2.5",
    text: "text-body-lg",
  },
};

/**
 * Fixed N-way segmented control (think tabs). Active segment uses a
 * raised card surface — Primary is reserved for CTAs so this component
 * intentionally does NOT color the active tile with the brand red.
 */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  segments,
  className,
  size = "md",
  fullWidth = false,
}: SegmentedControlProps<T>) => {
  const sz = SIZE_MAP[size];
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 rounded-pill border border-border bg-muted/40",
        sz.track,
        fullWidth && "w-full",
        className,
      )}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onChange(s.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-pill font-bold transition-all active:scale-[0.98]",
              sz.item,
              sz.text,
              active
                ? "bg-card text-foreground shadow-elev-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
