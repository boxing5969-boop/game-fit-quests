import { Home, Target, Map, Gift } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/quests", icon: Target, label: "퀘스트" },
  { path: "/levelmap", icon: Map, label: "레벨맵" },
  { path: "/rewards", icon: Gift, label: "보상" },
];

const hiddenPaths = ["/", "/mypage", "/coach"];

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
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all active:scale-95 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? "drop-shadow-[0_0_6px_hsl(14,90%,55%,0.4)]" : ""}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
