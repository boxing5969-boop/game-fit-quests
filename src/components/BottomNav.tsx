import { useState } from "react";
import { Home, Target, TrendingUp, Trophy, Award, Menu, BookOpen, User, Settings, Map, Gift, X, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";


const mainTabs = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/missions", icon: Target, label: "훈련" },
  { path: "/rank-up", icon: TrendingUp, label: "랭크업" },
  { path: "/halloffame", icon: Trophy, label: "명예의전당" },
  { path: "/cert-benefits", icon: Award, label: "단증혜택" },
];

const allMenuItems = [
  { path: "/home", icon: Home, label: "홈" },
  { path: "/missions", icon: Target, label: "훈련" },
  { path: "/rank-up", icon: TrendingUp, label: "랭크업" },
  { path: "/halloffame", icon: Trophy, label: "명예의전당" },
  { path: "/cert-benefits", icon: Award, label: "단증혜택" },
  { path: "/guide", icon: BookOpen, label: "가이드" },
  { path: "/mypage", icon: User, label: "내정보" },
  { path: "/settings", icon: Settings, label: "설정" },
  { path: "/levelmap", icon: Map, label: "리그맵" },
  { path: "/rewards", icon: Gift, label: "보상" },
  { path: "/character-studio", icon: Sparkles, label: "캐릭터" },
];

const hiddenPaths = ["/", "/onboarding", "/safety-check", "/manager", "/coach", "/member", "/select-branch", "/waiting-approval", "/live-board"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (hiddenPaths.includes(location.pathname) || location.pathname.startsWith("/manager/") || location.pathname.startsWith("/guide/") || location.pathname.startsWith("/live-board/")) return null;

  return (
    <>
      {/* Full menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col">
          <div className="flex-1 bg-background/80 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="relative z-[61] rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-4 shadow-2xl safe-area-bottom animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">전체 메뉴</span>
              <button onClick={() => setMenuOpen(false)} className="rounded-full bg-muted p-1.5 active:scale-95">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {allMenuItems.map(({ path, icon: Icon, label }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => { navigate(path); setMenuOpen(false); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all active:scale-95 ${
                      active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
        <div className="mx-auto flex max-w-lg items-center justify-around py-1.5 px-1">
          {mainTabs.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 transition-all active:scale-95 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-0.5">
                  <Icon className={active ? "drop-shadow-[0_0_6px_hsl(14,90%,55%,0.4)]" : ""} strokeWidth={active ? 2.5 : 2} size={20} />
                </div>
                <span className="text-[9px] font-medium whitespace-nowrap truncate">{label}</span>
              </button>
            );
          })}
          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 transition-all active:scale-95 ${
              menuOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu size={20} strokeWidth={2} />
            <span className="text-[9px] font-medium">전체</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;