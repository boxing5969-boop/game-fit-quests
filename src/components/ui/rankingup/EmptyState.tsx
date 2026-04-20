import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PrimaryCTAButton } from "./PrimaryCTAButton";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  /** Secondary (ghost) action, rendered under the primary CTA. */
  secondaryText?: string;
  onSecondaryClick?: () => void;
  className?: string;
}

/**
 * Encourages action instead of just saying "no data". Pairs an
 * illustrative icon with a motivational headline and a next-step CTA.
 */
export const EmptyState = ({
  icon,
  title,
  description,
  ctaText,
  onCtaClick,
  secondaryText,
  onSecondaryClick,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card/40 px-6 py-10 text-center",
      className,
    )}
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-primary/10 text-3xl">
      {icon}
    </div>
    <div className="space-y-1">
      <h3 className="text-display-sm text-foreground">{title}</h3>
      {description && (
        <p className="text-body-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {(ctaText || secondaryText) && (
      <div className="mt-2 flex w-full flex-col gap-2">
        {ctaText && onCtaClick && (
          <PrimaryCTAButton onClick={onCtaClick}>{ctaText}</PrimaryCTAButton>
        )}
        {secondaryText && onSecondaryClick && (
          <button
            type="button"
            onClick={onSecondaryClick}
            className="text-caption font-medium text-muted-foreground active:scale-[0.98]"
          >
            {secondaryText}
          </button>
        )}
      </div>
    )}
  </div>
);

export default EmptyState;
