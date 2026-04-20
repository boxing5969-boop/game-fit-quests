import type { ReactNode } from "react";
import { Info, CheckCircle2, AlertTriangle, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "success" | "warning" | "reward";

interface NotificationBannerProps {
  variant?: BannerVariant;
  message: ReactNode;
  /** Small title / label above the message. */
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** When set, shows a dismiss × button. */
  onDismiss?: () => void;
  icon?: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<BannerVariant, string> = {
  info: "border-accent/30 bg-accent/10 text-accent",
  success: "border-status-complete/30 bg-status-complete/10 text-status-complete",
  warning: "border-[hsl(38_92%_50%)]/30 bg-[hsl(38_92%_50%)]/10 text-[hsl(38_92%_50%)]",
  reward: "border-reward/40 bg-reward/10 text-reward shadow-glow-reward",
};

const DEFAULT_ICON: Record<BannerVariant, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  reward: <Trophy className="h-4 w-4" />,
};

export const NotificationBanner = ({
  variant = "info",
  message,
  title,
  action,
  onDismiss,
  icon,
  className,
}: NotificationBannerProps) => (
  <div
    role={variant === "warning" ? "alert" : "status"}
    className={cn(
      "flex items-start gap-3 rounded-card border p-3",
      VARIANT_CLASS[variant],
      className,
    )}
  >
    <span className="mt-0.5 flex shrink-0 items-center">
      {icon ?? DEFAULT_ICON[variant]}
    </span>
    <div className="flex-1 min-w-0">
      {title && (
        <p className="text-caption font-bold leading-tight">{title}</p>
      )}
      <div
        className={cn(
          "text-body-sm text-foreground",
          title ? "mt-0.5" : undefined,
        )}
      >
        {message}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            "mt-2 rounded-pill border border-current/30 bg-current/10 px-3 py-1 text-caption font-bold transition-all active:scale-[0.97]",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
    {onDismiss && (
      <button
        type="button"
        aria-label="닫기"
        onClick={onDismiss}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-muted-foreground active:scale-95"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export default NotificationBanner;
