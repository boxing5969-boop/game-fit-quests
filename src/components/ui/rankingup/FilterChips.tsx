import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Chip<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional icon/emoji shown before label. */
  icon?: ReactNode;
  /** Optional count badge. */
  count?: number;
}

interface FilterChipsProps<T extends string> {
  value: T | T[];
  onChange: (next: T | T[]) => void;
  chips: Chip<T>[];
  multi?: boolean;
  className?: string;
}

/**
 * Horizontally scrollable chip row used for ranking / mission filters.
 * Single- or multi-select. Active chips get an accent (blue) border —
 * Primary stays reserved for action CTAs.
 */
export const FilterChips = <T extends string>({
  value,
  onChange,
  chips,
  multi = false,
  className,
}: FilterChipsProps<T>) => {
  const isActive = (v: T) => (multi ? (value as T[]).includes(v) : value === v);

  const handleClick = (v: T) => {
    if (multi) {
      const current = value as T[];
      onChange(
        current.includes(v) ? current.filter((x) => x !== v) : [...current, v],
      );
    } else {
      onChange(v);
    }
  };

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-hide pb-1",
        className,
      )}
    >
      {chips.map((c) => {
        const active = isActive(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => handleClick(c.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-caption font-bold transition-all active:scale-[0.97]",
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.icon}
            <span>{c.label}</span>
            {typeof c.count === "number" && (
              <span
                className={cn(
                  "number-font rounded-pill px-1.5 py-0.5 text-[10px]",
                  active ? "bg-accent/20" : "bg-muted",
                )}
              >
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FilterChips;
