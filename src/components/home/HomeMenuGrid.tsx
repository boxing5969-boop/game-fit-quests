// 🗂 전체 메뉴 그리드 — 홈 첫 화면(2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게)과
// 하단 '전체' 탭 시트가 같이 쓴다. 목록은 lib/appMenu.ts 한 곳.
//
// 버튼 = 153 글리프 타일(연속 곡률 칸 + 직접 그린 아이콘) + 두 줄까지 라벨.
// 누르면 타일만 살짝 눌리고(0.92) 라벨은 제자리 — 손가락 아래에서만 반응하는 애플식 감각.
// 2026-10-18 대표님: "연관성 있는 메뉴는 하나에 붙여줘" → 묶음 칸(GlyphFolderTile). 누르면 그 줄 바로 아래에
//   안의 메뉴가 펼쳐진다(한 번에 하나). 지금 보고 있는 화면이 묶음 안에 있으면 묶음 칸 이름이 초록색.
import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDmSummary } from "@/hooks/useDm";
import { useStrategyBadge } from "@/services/strategyService";
import { buildAppMenu, isMenuFolder, type AppMenuEntry, type AppMenuItem } from "@/lib/appMenu";
import GlyphTile, { GlyphFolderTile } from "@/components/icons/GlyphTile";
import { cn } from "@/lib/utils";

// "153마인드셋"처럼 띄어쓰기 없는 긴 이름은 좁은 칸에서 "153마인드 / 셋"으로 끊긴다 —
// 앞의 "153" 뒤에 줄바꿈 자리(<wbr>)를 둬서 필요할 때만 "153 / 마인드셋"으로 끊기게.
const labelWithBreak = (label: string) =>
  /^153\S/.test(label) ? (
    <>
      153
      <wbr />
      {label.slice(3)}
    </>
  ) : (
    label
  );

const COLS = 4;

const Badge = ({ n }: { n: number }) =>
  n > 0 ? (
    <span
      className="absolute -right-1.5 -top-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-white ring-2 ring-card"
      aria-label={`새 메시지 ${n}개`}
    >
      {n > 99 ? "99+" : n}
    </span>
  ) : null;

interface Props {
  /** card: 홈 첫 화면 카드(제목 포함) · sheet: 하단 '전체' 시트 안(그리드만) */
  variant?: "card" | "sheet";
  /** 메뉴를 누른 뒤 할 일 (시트 닫기 등) */
  onNavigate?: () => void;
}

const HomeMenuGrid = ({ variant = "card", onNavigate }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, role } = useAuth();
  const diet = !!profile?.diet_program_enabled;
  // 메시지 칸 오른쪽 위 — 안 읽은 대화 + 새 요청 (+ 본사: 처리 안 한 신고) (2026-09-30).
  // 메시지를 쓸 수 없는 계정(지점 회원 확인 전)에는 메시지를 빼 둔다 — 머리글 종이비행기와 같은 기준
  const { data: dm } = useDmSummary();
  const dmBadge = dm?.badge ?? 0;
  const dmOff = dm?.enabled === false;
  // 전략 회의실 칸 — 코치님(앱 권한이 '회원'이어도 서버가 코치로 본 사람) · 지점장 · 운영진만. 메시지 화면 '전략' 칸과 같은 기준 (2026-10-19)
  const staff =
    dm?.kind === "coach" || dm?.kind === "hq" || role === "branch_manager" || role === "super_admin" || role === "admin";
  const { data: strategyBadge = 0 } = useStrategyBadge(staff);
  const entries = useMemo(
    () => buildAppMenu({ diet, staff, hide: (path) => dmOff && path === "/messages" }),
    [diet, staff, dmOff],
  );
  const [open, setOpen] = useState<string | null>(null);

  const go = (path: string) => {
    navigate(path);
    setOpen(null);
    onNavigate?.();
  };
  // 칸 오른쪽 위 숫자 — 메시지: 안 읽은 대화 · 전략 회의실: 아직 확인 안 한 지시·전략
  const badgeOf = (m: AppMenuItem) =>
    m.path === "/messages" ? dmBadge : m.path.startsWith("/messages?tab=strategy") ? strategyBadge : 0;

  const tile = (e: AppMenuEntry) => {
    if (!isMenuFolder(e)) {
      const active = pathname === e.path;
      return (
        <button
          key={e.path}
          type="button"
          onClick={() => go(e.path)}
          aria-current={active ? "page" : undefined}
          className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-0.5 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span className="relative transition-transform duration-200 ease-out group-active:scale-[0.92]">
            <GlyphTile name={e.glyph} />
            <Badge n={badgeOf(e)} />
          </span>
          <span
            className={cn(
              "line-clamp-2 w-full text-center text-[12.5px] leading-[1.25] tracking-[-0.02em]",
              active ? "font-bold text-primary" : "font-semibold text-foreground",
            )}
          >
            {labelWithBreak(e.label)}
          </span>
        </button>
      );
    }
    const isOpen = open === e.folder;
    const inside = e.items.some((m) => m.path === pathname);
    const badge = e.items.reduce((n, m) => n + badgeOf(m), 0);
    return (
      <button
        key={`folder:${e.folder}`}
        type="button"
        onClick={() => setOpen(isOpen ? null : e.folder)}
        aria-expanded={isOpen}
        aria-controls={`menu-folder-${e.folder}`}
        aria-label={`${e.label} — ${e.items.map((m) => m.label).join(", ")}`}
        className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-0.5 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <span
          className={cn(
            "relative rounded-[16px] transition-transform duration-200 ease-out group-active:scale-[0.92]",
            isOpen && "ring-2 ring-primary/70 ring-offset-2 ring-offset-card",
          )}
        >
          <GlyphFolderTile names={e.items.map((m) => m.glyph)} />
          <Badge n={badge} />
        </span>
        <span
          className={cn(
            "line-clamp-2 w-full text-center text-[12.5px] leading-[1.25] tracking-[-0.02em]",
            inside || isOpen ? "font-bold text-primary" : "font-semibold text-foreground",
          )}
        >
          {labelWithBreak(e.label)}
        </span>
      </button>
    );
  };

  // 4칸씩 줄을 나누고, 펼친 묶음이 있는 줄 바로 아래에 안의 메뉴를 그린다
  const rows: AppMenuEntry[][] = [];
  for (let i = 0; i < entries.length; i += COLS) rows.push(entries.slice(i, i + COLS));

  const grid = (
    <div className="grid grid-cols-4 gap-x-1 gap-y-4">
      {rows.map((row, ri) => {
        const folder = row.find((e) => isMenuFolder(e) && e.folder === open);
        return (
          <Fragment key={`row-${ri}`}>
            {row.map(tile)}
            <AnimatePresence initial={false}>
              {folder && isMenuFolder(folder) && (
                <motion.div
                  key={`panel-${folder.folder}`}
                  id={`menu-folder-${folder.folder}`}
                  role="group"
                  aria-label={folder.label}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="col-span-4 rounded-2xl bg-secondary/70 px-2 pb-3 pt-2.5 ring-1 ring-border/60"
                >
                  <p className="mb-2.5 px-1.5 text-[12px] font-bold text-muted-foreground">{folder.label}</p>
                  <div className="grid grid-cols-4 gap-x-1 gap-y-3">
                    {folder.items.map((m) => {
                      const active = pathname === m.path;
                      return (
                        <button
                          key={m.path}
                          type="button"
                          onClick={() => go(m.path)}
                          aria-current={active ? "page" : undefined}
                          className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <span className="relative transition-transform duration-200 ease-out group-active:scale-[0.92]">
                            <GlyphTile name={m.glyph} size={50} />
                            <Badge n={badgeOf(m)} />
                          </span>
                          <span
                            className={cn(
                              "line-clamp-2 w-full text-center text-[12px] leading-[1.25] tracking-[-0.02em]",
                              active ? "font-bold text-primary" : "font-semibold text-foreground",
                            )}
                          >
                            {labelWithBreak(m.label)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );

  if (variant === "sheet") return grid;

  return (
    <section
      aria-label="전체 메뉴"
      data-tour="home-full-menu"
      className="rounded-3xl bg-card px-3 pb-[18px] pt-[18px] shadow-elev-1"
    >
      <div className="mb-4 flex items-baseline justify-between px-2">
        <h2 className="text-[17px] font-extrabold text-foreground">전체 메뉴</h2>
        <span className="text-[12px] font-medium text-muted-foreground">눌러서 바로 가요</span>
      </div>
      {grid}
    </section>
  );
};

export default HomeMenuGrid;
