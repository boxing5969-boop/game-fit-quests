// 🗂 전체 메뉴 그리드 — 홈 첫 화면(2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게)과
// 하단 '전체' 탭 시트가 같이 쓴다. 목록은 lib/appMenu.ts 한 곳.
//
// 버튼 = 153 글리프 타일(연속 곡률 칸 + 직접 그린 아이콘) + 두 줄까지 라벨.
// 누르면 타일만 살짝 눌리고(0.92) 라벨은 제자리 — 손가락 아래에서만 반응하는 애플식 감각.
// 360px 폰에서 4칸 × 4줄이 스크롤 없이 첫 화면에 들어간다.
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { buildAppMenu } from "@/lib/appMenu";
import GlyphTile from "@/components/icons/GlyphTile";
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
    <div className="grid grid-cols-4 gap-x-1 gap-y-4">
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
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-0.5 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="transition-transform duration-200 ease-out group-active:scale-[0.92]">
              <GlyphTile name={it.glyph} />
            </span>
            <span
              className={cn(
                "line-clamp-2 w-full text-center text-[12.5px] leading-[1.25] tracking-[-0.02em]",
                active ? "font-bold text-primary" : "font-semibold text-foreground",
              )}
            >
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
