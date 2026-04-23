import { useLocation, useNavigate } from "react-router-dom";
import {
  Brain,
  ChefHat,
  Flag,
  HeartHandshake,
  ImageIcon,
  LineChart,
  Salad,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 다이어트 탭 전용 9-item 서브 네비게이션.
 *
 * 위치: DietHubPage 상단 (PageHeader 바로 아래, 본문 위).
 * 형태: 가로 스크롤 가능한 아이콘+라벨 칩 배열.
 * 상태: location.pathname 으로 현재 활성 탭 강조.
 *
 * 기존 하단 NavTile 그리드를 대체하여 홈 화면 길이를 줄이고,
 * 한 번에 9가지 다이어트 기능으로 즉시 이동 가능하게 함.
 */

const ITEMS = [
  { path: "/diet/value",        icon: Brain,            label: "과학·원리" },
  { path: "/diet/meal-plan",    icon: Salad,            label: "21일 식단" },
  { path: "/diet/progress",     icon: LineChart,        label: "진행 현황" },
  { path: "/diet/food",         icon: UtensilsCrossed,  label: "음식 가이드" },
  { path: "/diet/photos",       icon: ImageIcon,        label: "내 사진" },
  { path: "/diet/ranking",      icon: Trophy,           label: "습관 랭킹" },
  { path: "/diet/auto-meals",   icon: ChefHat,          label: "자동 식단" },
  { path: "/diet/after-21",     icon: Flag,             label: "21일 이후" },
  { path: "/diet/post-program", icon: HeartHandshake,   label: "유지·연장" },
] as const;

export const DietSubNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      aria-label="다이어트 하위 메뉴"
      className={cn(
        "-mx-4 overflow-x-auto scrollbar-none",
        "border-b border-border bg-card",
      )}
    >
      <ul className="flex min-w-max items-stretch gap-1 px-3 py-2">
        {ITEMS.map(({ path, icon: Icon, label }) => {
          const active =
            location.pathname === path ||
            (path === "/diet/post-program" && location.pathname.startsWith("/diet/post"));
          return (
            <li key={path}>
              <button
                type="button"
                onClick={() => navigate(path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5",
                  "text-[10.5px] font-bold transition-all active:scale-95",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.5 : 2}
                  className={
                    active ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : undefined
                  }
                />
                <span className="whitespace-nowrap leading-tight">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DietSubNav;
