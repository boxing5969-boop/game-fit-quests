import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** 제목 왼쪽에 붙는 아주 작은 표식(등급 배지 등). 잘림 없이 항상 보인다. */
  titlePrefix?: ReactNode;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  /** light variant swaps the surface to light-surface tokens for info pages. */
  variant?: "dark" | "light";
  className?: string;
  /** Make header stick to top of viewport. */
  sticky?: boolean;
}

export const PageHeader = ({
  title,
  titlePrefix,
  subtitle,
  leftAction,
  rightAction,
  variant = "dark",
  className,
  sticky = false,
}: PageHeaderProps) => (
  <header
    className={cn(
      "w-full backdrop-blur-xl",
      variant === "light" ? "light-surface" : undefined,
      "bg-background/80 border-b border-border",
      sticky && "sticky top-0 z-30",
      className,
    )}
  >
    <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
      {leftAction && <div className="flex shrink-0 items-center">{leftAction}</div>}
      <div className="flex-1 min-w-0">
        <h1 className="text-display-sm flex min-w-0 items-center gap-1.5">
          {titlePrefix}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-caption truncate text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {rightAction && <div className="flex shrink-0 items-center gap-2">{rightAction}</div>}
    </div>
  </header>
);

export default PageHeader;
