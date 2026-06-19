import { useMemo, useState } from "react";
import {
  Home,
  Trophy,
  Menu,
  TrendingUp,
  Award,
  BookOpen,
  Sparkles,
  Salad,
  User,
  Settings,
  Gamepad2,
  Fish,
  Compass,
  Target,
  Users,
  Star,
  X,
  Ticket,
} from "lucide-react";
import { BoxingGloveIcon } from "@/components/icons/BoxingGloveIcon";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// ── Primary tab bar (5 slots: 5 routes + menu) ─────────────────────
// 보상(/rewards)은 전체 메뉴로 이관. 5번째 슬롯은 랭크업(로드맵+가치맵 통합 페이지).
// 접근성은 전체 메뉴 오버레이에 보존.
// 모든 탭이 선형 아이콘으로 통일. 훈련은 복싱 글러브 커스텀 SVG.
// /levelmap 은 /rank-up 에 통합됨 (내용 중복) — 5번째 슬롯은 랭크업으로.
const mainTabs = [
  { path: "/home",          icon: Home,            label: "홈",     emoji: null },
  { path: "/missions",      icon: BoxingGloveIcon, label: "훈련",    emoji: null },
  { path: "/cert-benefits", icon: Award,           label: "단증혜택", emoji: null },
  { path: "/halloffame",    icon: Trophy,          label: "랭킹",    emoji: null },
  { path: "/rank-up",       icon: TrendingUp,      label: "랭크업",   emoji: null },
] as const;

// ── Full menu overlay (everything not on the primary bar) ───────────
// /diet 항목은 feature flag 에 따라 조건부로 포함 — 아래 useMemo 참조.
// /cert-benefits 는 mainTabs 로 이관됐지만 전체메뉴에도 남겨 두어 발견성 유지.
const baseMenuItems = [
  { path: "/home",              icon: Home,       label: "홈" },
  { path: "/missions",          icon: BoxingGloveIcon, label: "훈련" },
  { path: "/minigame",          icon: Gamepad2,   label: "복싱 트레이닝" },
  // 153 챌린지 — 개인 보조 퀘스트 (IQ / 챌린지 아레나) + 회원 간 랭킹 경쟁.
  // 라우트는 /myboxer/quest 유지 (DB anchor 호환). 챔피언 일기는 153 커뮤니티로 이관.
  { path: "/myboxer/quest",     icon: Target,     label: "153 챌린지" },
  // 64-AS: 153 커뮤니티 — 세컨드 응원 / 코너맨 / 짐 레이드 (회원 간 소통).
  { path: "/myboxer/community", icon: Users,      label: "153 커뮤니티" },
  // 153마인드셋 — 시각화 훈련. 일반 회원 공개 (ProtectedRoute 만 적용).
  { path: "/myboxer/visualization", icon: Compass, label: "153마인드셋" },
  { path: "/halloffame",        icon: Trophy,     label: "랭킹" },
  { path: "/rank-up",           icon: TrendingUp, label: "랭크업" },
  { path: "/cert-benefits",     icon: Award,      label: "단증혜택" },
  // 65-S: 보상(/rewards)은 전체 메뉴에서 제거 — 마이페이지 안으로 이관.
  { path: "/character-studio",  icon: Sparkles,   label: "캐릭터" },
  { path: "/guide",             icon: BookOpen,   label: "가이드" },
  { path: "/about/153",         icon: Fish,       label: "153이란?" },
  { path: "/membership",        icon: Ticket,     label: "수강권" },
  { path: "/mypage",            icon: User,       label: "내정보" },
  { path: "/settings",          icon: Settings,   label: "설정" },
] as const;

type IconComponent = React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
type MenuItem = { path: string; icon: IconComponent; label: string };

const hiddenPaths = [
  "/",
  "/onboarding",
  "/manager",
  "/coach",
  "/member",
  "/select-branch",
  "/waiting-approval",
  "/live-board",
  // 복싱 트레이닝은 100dvh 풀스크린 게임 UI 라 하단 탭바가 겹치면 안 됨.
  "/minigame",
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
              <div className="flex items-center gap-2">
                {/* 65-O: 빠른 테마 토글 — Sun/Moon 아이콘 */}
                <ThemeToggle variant="icon" />
                <button
                  aria-label="메뉴 닫기"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-pill bg-muted p-1.5 active:scale-95"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {allMenuItems.map(({ path, icon: Icon, label }) => {
                const active = location.pathname === path;
                // 훈련 — 핵심 기능. 전체 메뉴에서도 별표 배지로 표시.
                const isTraining = path === "/missions";
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "group flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all active:scale-95",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="relative">
                      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                      {isTraining && (
                        <Star
                          size={11}
                          strokeWidth={2}
                          aria-hidden
                          className="absolute -right-2 -top-1 fill-amber-400 text-amber-400 drop-shadow-sm transition-transform duration-150 group-hover:scale-125 group-hover:rotate-[18deg]"
                        />
                      )}
                    </span>
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
            // 훈련 탭 — 핵심 기능이지만 색상·크기는 다른 탭과 100% 동일.
            //   강조는 아이콘 우상단 별표 배지로만 (차분한 표시).
            //   active 시 색상은 다른 탭과 같은 규칙 (text-primary).
            const isTraining = path === "/missions";
            // 65-R: 7일 캠프 Day 7 회고 cascade 가 BottomNav 탭별 click 가능하도록
            //   data-tour 부여. 형식: bottomnav-<path 마지막 segment>.
            const navSlug = path.replace(/^\//, "").replace(/\//g, "-");
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                aria-current={active ? "page" : undefined}
                data-tour={`bottomnav-${navSlug}`}
                className={cn(
                  "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-transform duration-150 hover:scale-105 active:scale-95",
                  active ? "text-primary" : INACTIVE_TONE,
                )}
              >
                {emoji ? (
                  <span
                    aria-hidden
                    className={cn(
                      "text-[22px] leading-none transition-transform duration-150 group-hover:-translate-y-0.5",
                      active
                        ? "drop-shadow-[0_0_8px_hsl(8_75%_48%_/_0.55)]"
                        : "opacity-70",
                    )}
                  >
                    {emoji}
                  </span>
                ) : Icon ? (
                  <span className="relative">
                    <Icon
                      size={24}
                      strokeWidth={active ? 2.5 : 2}
                      className="transition-transform duration-150 group-hover:-translate-y-0.5"
                    />
                    {/* 훈련 탭 — 핵심 표시 별표 배지 (색·크기는 다른 탭과 동일,
                        별표만 추가). hover 시 살짝 커지고 회전. */}
                    {isTraining && (
                      <Star
                        size={11}
                        strokeWidth={2}
                        aria-hidden
                        className="absolute -right-2 -top-1 fill-amber-400 text-amber-400 drop-shadow-sm transition-transform duration-150 group-hover:scale-125 group-hover:rotate-[18deg]"
                      />
                    )}
                  </span>
                ) : null}
                <span className="relative text-[11px] font-semibold leading-none">
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
