import { useState } from "react";
import { isSignageRoute } from "@/lib/displayMode";
import { Star, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import HomeMenuGrid from "@/components/home/HomeMenuGrid";
import { TabIcon, type TabIconName } from "@/components/icons/tabIcons";

// ── Primary tab bar (5 slots: 5 routes + menu) ─────────────────────
// 보상(/rewards)은 전체 메뉴로 이관. 5번째 슬롯은 랭크업(로드맵+가치맵 통합 페이지).
// 3번째 슬롯: 결제형 수강권(/membership). 단증혜택은 하단탭에서 빼고 전체메뉴에만 둔다.
// 아이콘 = 153 글리프 탭 세트 (components/icons/tabIcons) — 안 고른 탭은 선, 고른 탭은 꽉 찬 모양(애플식).
const mainTabs: ReadonlyArray<{ path: string; icon: TabIconName; label: string }> = [
  { path: "/home",       icon: "home",   label: "홈" },
  { path: "/missions",   icon: "glove",  label: "훈련" },
  { path: "/membership", icon: "ticket", label: "수강권" },
  { path: "/halloffame", icon: "trophy", label: "랭킹" },
  { path: "/rank-up",    icon: "rankup", label: "랭크업" },
];

// ── Full menu overlay ───────────────────────────────────────────────
// 전체 메뉴 목록은 lib/appMenu.ts 한 곳 — 홈 첫 화면의 전체 메뉴(HomeMenuGrid)와 같은 목록·같은 버튼.
// 하단탭에 이미 있는 홈·훈련·수강권·랭킹·랭크업은 전체메뉴에서 제외(중복 제거).
// /diet(153다이어트)는 feature flag 켜진 회원만, /cert-benefits(단증혜택)는 전체메뉴에서만 접근.

const hiddenPaths = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/manager",
  "/coach",
  "/member",
  "/select-branch",
  "/waiting-approval",
  "/live-board",
  // 복싱 트레이닝은 100dvh 풀스크린 게임 UI 라 하단 탭바가 겹치면 안 됨.
  "/minigame",
  // QR 출석 — 카메라 화면이라 탭바가 겹치면 안 됨.
  "/qr-checkin",
];

// Inactive tone — spec #8C95A3. Kept as an arbitrary Tailwind value
// rather than a token because this shade is specific to the tab bar.
const INACTIVE_TONE = "text-[#8C95A3]";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith("/manager/") ||
    location.pathname.startsWith("/guide/") ||
    // 메시지 대화방 — 아래 입력창 자리. 받은함(/messages)에는 탭바가 그대로 있다
    location.pathname.startsWith("/messages/") ||
    // 전시용 화면(TV 사이니지·키오스크)은 displayMode 한 곳에서 관리한다.
    isSignageRoute(location.pathname)
  ) {
    return null;
  }

  return (
    <>
      {/* Full menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col">
          {/* 뒤 배경 — 라이트는 토스·카카오 시트처럼 반투명 검정, 다크는 기존 그대로 */}
          <div
            className="flex-1 bg-black/40 dark:bg-background/80 dark:backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-[61] max-h-[85vh] overflow-y-auto rounded-t-hero border-t border-border bg-card px-4 pb-8 pt-5 shadow-elev-3 safe-area-bottom animate-slide-up">
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="text-[17px] font-extrabold text-foreground">
                전체 메뉴
              </span>
              <div className="flex items-center gap-2">
                {/* 65-O: 빠른 테마 토글 — Sun/Moon 아이콘 */}
                <ThemeToggle variant="icon" />
                <button
                  type="button"
                  aria-label="메뉴 닫기"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary transition-transform active:scale-90"
                >
                  <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.4} />
                </button>
              </div>
            </div>
            {/* 홈 첫 화면과 같은 버튼 그리드 (components/home/HomeMenuGrid) */}
            <HomeMenuGrid variant="sheet" onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Bottom tab bar — 반투명 유리(뒤 화면이 흐리게 비침) + 머리카락 두께 윗선 */}
      <nav
        aria-label="주요 메뉴"
        className="fixed bottom-0 left-0 right-0 z-50 border-t-[0.5px] border-black/[0.12] bg-card/[0.86] backdrop-blur-xl backdrop-saturate-[1.8] safe-area-bottom dark:border-white/[0.1]"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {mainTabs.map(({ path, icon, label }) => {
            // MY복서(예전 홈 화면)는 '홈' 탭 영역으로 본다 (2026-09-29)
            const active = location.pathname === path || (path === "/home" && location.pathname === "/myboxer");
            // 훈련 탭 — 핵심 기능. 색·크기는 다른 탭과 같고 아이콘 우상단 별표로만 표시.
            const isTraining = path === "/missions";
            // 65-R: 7일 캠프 Day 7 회고 cascade 가 BottomNav 탭별 click 가능하도록
            //   data-tour 부여. 형식: bottomnav-<path 마지막 segment>.
            const navSlug = path.replace(/^\//, "").replace(/\//g, "-");
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                aria-current={active ? "page" : undefined}
                data-tour={`bottomnav-${navSlug}`}
                className={cn(
                  "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pb-[7px] pt-2 outline-none",
                  active ? "text-primary" : INACTIVE_TONE,
                )}
              >
                <span className="relative transition-transform duration-150 ease-out group-active:scale-90">
                  <TabIcon name={icon} active={active} className="h-[26px] w-[26px]" />
                  {isTraining && (
                    <Star
                      aria-hidden
                      strokeWidth={2}
                      className="absolute -right-1.5 -top-0.5 h-[11px] w-[11px] fill-amber-400 text-amber-400"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-none tracking-[-0.01em]",
                    active ? "font-bold" : "font-medium",
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}

          {/* 전체 — 홈의 전체 메뉴와 같은 버튼 시트를 연다 */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label="전체 메뉴 열기"
            className={cn(
              "group flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pb-[7px] pt-2 outline-none",
              menuOpen ? "text-primary" : INACTIVE_TONE,
            )}
          >
            <span className="transition-transform duration-150 ease-out group-active:scale-90">
              <TabIcon name="all" active={menuOpen} className="h-[26px] w-[26px]" />
            </span>
            <span
              className={cn(
                "text-[11px] leading-none tracking-[-0.01em]",
                menuOpen ? "font-bold" : "font-medium",
              )}
            >
              전체
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
