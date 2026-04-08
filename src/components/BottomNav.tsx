import { Home, Target, Map, Trophy, Gift, ScrollText } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/missions", icon: Target, label: "미션" },
  { path: "/levelmap", icon: Map, label: "계급도" },
  { path: "/halloffame", icon: Trophy, label: "랭킹" },
  { path: "/rewards", icon: Gift, label: "보상" },
];

const hiddenPaths = ["/", "/mypage", "/coach", "/settings"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (hiddenPaths.includes(location.pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 transition-all active:scale-95 ${
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
