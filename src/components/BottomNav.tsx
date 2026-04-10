import { Home, Target, TrendingUp, BookOpen, User, Map, Gift, Trophy, Award } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/missions", icon: Target, label: "훈련" },
  { path: "/rank-up", icon: TrendingUp, label: "랭크업" },
  { path: "/levelmap", icon: Map, label: "레벨맵" },
  { path: "/rewards", icon: Gift, label: "보상" },
  { path: "/halloffame", icon: Trophy, label: "명예의전당" },
  { path: "/cert-benefits", icon: Award, label: "단증혜택" },
  { path: "/guide", icon: BookOpen, label: "가이드" },
  { path: "/mypage", icon: User, label: "내정보" },
];

const hiddenPaths = ["/", "/onboarding", "/safety-check", "/settings", "/manager", "/coach", "/member"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (hiddenPaths.includes(location.pathname) || location.pathname.startsWith("/manager/") || location.pathname.startsWith("/guide/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center overflow-x-auto scrollbar-hide py-1.5 px-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex shrink-0 flex-col items-center gap-0.5 px-2.5 py-1 transition-all active:scale-95 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${active ? "drop-shadow-[0_0_6px_hsl(14,90%,55%,0.4)]" : ""}`} strokeWidth={active ? 2.5 : 2} size={18} />
              <span className="text-[9px] font-medium whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
