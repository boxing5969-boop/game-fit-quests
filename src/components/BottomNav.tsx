import { useMemo, useState } from "react";
import {
  Home,
  Trophy,
  Gift,
  Menu,
  TrendingUp,
  Award,
  BookOpen,
  Map,
  Sparkles,
  Salad,
  User,
  Settings,
  Target,
  Gamepad2,
  Info,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Primary tab bar (5 slots: 5 routes + menu) ─────────────────────
// 보상(/rewards)은 전체 메뉴로 이관. 5번째 슬롯은 로드맵으로 교체.
// 접근성은 전체 메뉴 오버레이에 보존.
// 모든 탭이 lucide 선형 아이콘으로 통일. 훈련은 Target — mission/quest 의미와 시각 일치.
const mainTabs = [
  { path: "/home",          icon: Home,    label: "홈",     emoji: null },
  { path: "/missions",      icon: Target,  label: "훈련",    emoji: null },
  { path: "/cert-benefits", icon: Award,   label: "단증혜택", emoji: null },
  { path: "/halloffame",    icon: Trophy,  label: "랭킹",    emoji: null },
  { path: "/levelmap",      icon: Map,     label: "로드맵",   emoji: null },
] as const;

// ── Full menu overlay (everything not on the primary bar) ───────────
// /diet 항목은 feature flag 에 따라 조건부로 포함 — 아래 useMemo 참조.
// /cert-benefits 는 mainTabs 로 이관됐지만 전체메뉴에도 남겨 두어 발견성 유지.
const baseMenuItems = [
  { path: "/home",              icon: Home,       label: "홈" },
  { path: "/missions",          icon: Target,     label: "훈련" },
  { path: "/minigame",          icon: Gamepad2,   label: "복싱 트레이닝 게임" },
  { path: "/halloffame",        icon: Trophy,     label: "랭킹" },
  { path: "/rank-up",           icon: TrendingUp, label: "랭크업" },
  { path: "/cert-benefits",     icon: Award,      label: "단증혜택" },
  { path: "/levelmap",          icon: Map,        label: "로드맵" },
  { path: "/rewards",           icon: Gift,       label: "보상" },
  { path: "/character-studio",  icon: Sparkles,   label: "캐릭터" },
  { path: "/guide",             icon: BookOpen,   label: "가이드" },
  { path: "/about/153",         icon: Info,       label: "153이란?" },
  { path: "/mypage",            icon: User,       label: "내정보" },
  { path: "/settings",          icon: Settings,   label: "설정" },
] as const;

type MenuItem = { path: string; icon: typeof Home; label: string };

const hiddenPaths = [
  "/",
  "/onboarding",
  "/safety-check",
  "/manager",
  "/coach",
  "/member",
  "/select-branch",
  "/waiting-approval",
  "/live-board",
];

// Inactive tone — spec #8C95A3. Kept as an arbitrary Tailwind value
// rather than a token because this shade is specific to the tab bar.
const INACTIVE_TONE = "text-[#8C95A3]";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // /diet 은 feature flag(`profiles.diet_program_enabled`) ON 일 때만 노출.
  // 캐릭터(index 8) 뒤, 가이드(index 9) 앞에 삽입해 "활동 → 꾸미기 → 다이어트 → 가이드" 순 유지.
  const allMenuItems = useMemo<readonly MenuItem[]>(() => {
    if (!profile?.diet_program_enabled) return baseMenuItems;
    const dietItem: MenuItem = { path: "/diet", icon: Salad, label: "153다이어트" };
    const insertAt = baseMenuItems.findIndex((i) => i.path === "/guide");
    const idx = insertAt === -1 ? baseMenuItems.length : insertAt;
    return [
      ...baseMenuItems.slice(0, idx),
      dietItem,
      ...baseMenuItems.slice(idx),
    ];
  }, [profile?.diet_program_enabled]);

  if (
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith("/manager/") ||
    location.pathname.startsWith("/guide/") ||
    location.pathname.startsWith("/live-board/")
  ) {
    return null;
  }

  return (
    <>
      {/* Full menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col">
          <div
            className="flex-1 bg-background/80 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-[61] rounded-t-hero border-t border-border bg-card px-5 pb-8 pt-4 shadow-elev-3 safe-area-bottom animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-body-sm font-bold text-foreground">
                전체 메뉴
              </span>
              <button
                aria-label="메뉴 닫기"
                onClick={() => setMenuOpen(false)}
                className="rounded-pill bg-muted p-1.5 active:scale-95"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {allMenuItems.map(({ path, icon: Icon, label }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all active:scale-95",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[11px] font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        aria-label="주요 메뉴"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-area-bottom"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {mainTabs.map(({ path, icon: Icon, label, emoji }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
                  active ? "text-primary" : INACTIVE_TONE,
                )}
              >
                {emoji ? (
                  <span
                    aria-hidden
                    className={cn(
                      "text-[22px] leading-none",
                      active
                        ? "drop-shadow-[0_0_8px_hsl(8_75%_48%_/_0.55)]"
                        : "opacity-70",
                    )}
                  >
                    {emoji}
                  </span>
                ) : Icon ? (
                  <Icon
                    size={24}
                    strokeWidth={active ? 2.5 : 2}
                    className={
                      active
                        ? "drop-shadow-[0_0_8px_hsl(8_75%_48%_/_0.5)]"
                        : undefined
                    }
                  />
                ) : null}
                <span className="text-[11px] font-semibold leading-none">
                  {label}
                </span>
              </button>
            );
          })}

          {/* Menu button — opens overlay */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label="전체 메뉴 열기"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95",
              menuOpen ? "text-primary" : INACTIVE_TONE,
            )}
          >
            <Menu size={24} strokeWidth={menuOpen ? 2.5 : 2} />
            <span className="text-[11px] font-semibold leading-none">전체</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
