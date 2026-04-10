import { Home, Target, TrendingUp, BookOpen, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/missions", icon: Target, label: "훈련" },
  { path: "/rank-up", icon: TrendingUp, label: "랭크업" },
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
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all active:scale-95 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_hsl(14,90%,55%,0.4)]" : ""}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
