/**
 * 65-O: 다크/라이트 모드 토글.
 *
 * 두 가지 표시 모드 — variant prop 으로 선택:
 *   · "segment"  (기본) — 설정 페이지용. 라이트/다크 2-segment 큰 버튼.
 *   · "icon"     — 전체메뉴 오버레이 등 컴팩트 자리. Sun/Moon 아이콘 1개.
 *
 * next-themes 가 <html class="dark"> 토글 + localStorage 영속화 담당.
 * SSR 안전 — mounted 가드로 hydration mismatch 회피.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "segment" | "icon";
  className?: string;
}

export const ThemeToggle = ({
  variant = "segment",
  className,
}: ThemeToggleProps) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // SSR/hydration 안전 — mount 후에만 테마 표시
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // 깜빡임 방지 — 동일 크기 placeholder
    return variant === "icon" ? (
      <span
        aria-hidden
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-pill bg-secondary/40",
          className,
        )}
      />
    ) : (
      <div
        aria-hidden
        className={cn(
          "h-11 w-full rounded-pill border border-border bg-card",
          className,
        )}
      />
    );
  }

  const current = (theme === "system" ? resolvedTheme : theme) ?? "dark";

  if (variant === "icon") {
    const next = current === "dark" ? "light" : "dark";
    const Icon = current === "dark" ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`${next === "dark" ? "다크" : "라이트"} 모드로 전환`}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-pill",
          "bg-secondary text-secondary-foreground transition-all active:scale-95",
          "hover:bg-secondary/80",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  // segment — 라이트/다크 2-segment
  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={cn(
        "inline-flex w-full items-stretch gap-1 rounded-pill border border-border bg-secondary/40 p-1",
        className,
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={current === "light"}
        onClick={() => setTheme("light")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-bold transition-all active:scale-[0.98]",
          current === "light"
            ? "bg-card text-foreground shadow-elev-1"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="h-3.5 w-3.5" />
        라이트
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={current === "dark"}
        onClick={() => setTheme("dark")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-bold transition-all active:scale-[0.98]",
          current === "dark"
            ? "bg-card text-foreground shadow-elev-1"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        다크
      </button>
    </div>
  );
};

export default ThemeToggle;
