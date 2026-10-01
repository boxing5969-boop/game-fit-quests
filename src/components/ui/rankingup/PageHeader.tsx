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
      // 반투명 유리 머리글 — 스크롤되는 내용이 흐리게 비친다 + 머리카락 두께 밑줄
      "w-full backdrop-blur-xl backdrop-saturate-[1.8]",
      variant === "light" ? "light-surface" : undefined,
      "bg-background/[0.86] border-b-[0.5px] border-black/[0.1] dark:border-white/[0.08]",
      // 붙는 머리글은 아이폰 시계(상태바) 바로 아래에 붙는다 — top-0 이면 스크롤할 때 뒤로가기가 시계 밑에 깔린다 (2026-10-01)
      sticky && "sticky top-[env(safe-area-inset-top)] z-30",
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
