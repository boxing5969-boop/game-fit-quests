import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PrimaryCTAButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Icon rendered on the leading edge of the label. */
  icon?: ReactNode;
  /** Secondary line of copy (e.g. "+50 XP 보상"). */
  rewardText?: string;
  fullWidth?: boolean;
  variant?: "primary" | "secondary" | "reward";
}

const VARIANT_CLASS: Record<
  NonNullable<PrimaryCTAButtonProps["variant"]>,
  string
> = {
  primary: "primary-button",
  secondary: "secondary-button",
  reward: "reward-button",
};

/**
 * 56px mobile-first CTA. Composes .primary-button / .secondary-button /
 * .reward-button utilities from index.css so variant colors and glow
 * follow the global tokens. Renders an optional inline icon and a
 * secondary reward line.
 */
export const PrimaryCTAButton = forwardRef<
  HTMLButtonElement,
  PrimaryCTAButtonProps
>(
  (
    {
      children,
      icon,
      rewardText,
      fullWidth = true,
      variant = "primary",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        VARIANT_CLASS[variant],
        !fullWidth && "w-auto",
        rewardText && "flex-col gap-0.5 py-2",
        className,
      )}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        {children}
      </span>
      {rewardText && (
        <span
          className={cn(
            "text-caption font-medium",
            variant === "reward"
              ? "text-reward-foreground/80"
              : "text-primary-foreground/80",
          )}
        >
          {rewardText}
        </span>
      )}
    </button>
  ),
);
PrimaryCTAButton.displayName = "PrimaryCTAButton";

export default PrimaryCTAButton;
