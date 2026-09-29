// 🗂 전체 메뉴 그리드 — 홈 첫 화면(2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게)과
// 하단 '전체' 탭 시트가 같이 쓴다. 목록은 lib/appMenu.ts 한 곳.
//
// 토스·카카오식: 연한 파스텔 칸 + 이모지 + 두 줄까지 라벨.
// 360px 폰에서 4칸 × 4줄이 스크롤 없이 첫 화면에 들어간다.
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { buildAppMenu } from "@/lib/appMenu";
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

interface Props {
  /** card: 홈 첫 화면 카드(제목 포함) · sheet: 하단 '전체' 시트 안(그리드만) */
  variant?: "card" | "sheet";
  /** 메뉴를 누른 뒤 할 일 (시트 닫기 등) */
  onNavigate?: () => void;
}

const HomeMenuGrid = ({ variant = "card", onNavigate }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const diet = !!profile?.diet_program_enabled;
  const items = useMemo(() => buildAppMenu({ diet }), [diet]);

  const grid = (
    <div className="grid grid-cols-4 gap-x-1 gap-y-3.5">
      {items.map((it) => {
        const active = pathname === it.path;
        return (
          <button
            key={it.path}
            type="button"
            onClick={() => {
              navigate(it.path);
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-0.5 py-1 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span
              className={cn(
                "flex h-[52px] w-[52px] items-center justify-center rounded-[18px] text-[26px] leading-none transition-transform duration-150 group-hover:-translate-y-0.5",
                it.tint,
                "dark:bg-white/[0.07]",
                active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            >
              <span aria-hidden>{it.emoji}</span>
            </span>
            <span className="line-clamp-2 w-full break-keep text-center text-[12px] font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
              {labelWithBreak(it.label)}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (variant === "sheet") return grid;

  return (
    <section
      aria-label="전체 메뉴"
      data-tour="home-full-menu"
      className="rounded-3xl bg-card px-3 pb-4 pt-4 shadow-elev-1"
    >
      <div className="mb-3.5 flex items-baseline justify-between px-2">
        <h2 className="text-[17px] font-black text-foreground">전체 메뉴</h2>
        <span className="text-[12px] font-medium text-muted-foreground">눌러서 바로 가요</span>
      </div>
      {grid}
    </section>
  );
};

export default HomeMenuGrid;
