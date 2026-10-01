/**
 * 🔍 검색 칸 모양의 버튼 — 누르면 기능 검색 화면(/search)으로 (2026-10-01 대표님: 기능 검색).
 * 홈 첫 화면 전체 메뉴 위, 하단 '전체' 시트 위에 같은 버튼을 둔다.
 */
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** card: 홈(회색 바닥 위 흰 칸) · sheet: 전체 시트 안(흰 바닥 위 회색 칸) */
  variant?: "card" | "sheet";
  /** 누른 뒤 할 일 (시트 닫기 등) */
  onNavigate?: () => void;
  className?: string;
}

const AppSearchButton = ({ variant = "card", onNavigate, className }: Props) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        navigate("/search");
        onNavigate?.();
      }}
      aria-label="기능·영상 검색"
      className={cn(
        "flex h-12 w-full items-center gap-2.5 rounded-2xl px-4 text-left transition-transform active:scale-[0.99]",
        variant === "card" ? "bg-card shadow-elev-1 ring-1 ring-border/60" : "bg-secondary",
        className,
      )}
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2.4} />
      <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
        기능·영상 찾기 <span className="text-muted-foreground/70">· 예) 타이틀매치</span>
      </span>
    </button>
  );
};

export default AppSearchButton;
