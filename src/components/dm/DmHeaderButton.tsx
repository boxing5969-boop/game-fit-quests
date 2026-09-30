/**
 * 머리글 종이비행기 버튼 — 인스타그램처럼 오른쪽 위에서 메시지로 간다 (2026-09-30).
 * 배지 = 안 읽은 대화 + 새 메시지 요청 (+ 본사: 처리 안 한 신고). 메시지를 쓸 수 없는 계정이면 숨긴다.
 */
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { useDmSummary } from "@/hooks/useDm";
import { cn } from "@/lib/utils";

const DmHeaderButton = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const { data } = useDmSummary();
  if (data && !data.enabled) return null;
  const badge = data?.badge ?? 0;
  return (
    <button
      type="button"
      onClick={() => navigate("/messages")}
      aria-label={badge > 0 ? `메시지 · 새 소식 ${badge}개` : "메시지"}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95",
        className,
      )}
    >
      <Send className="h-[17px] w-[17px] -translate-x-[1px] translate-y-[1px] text-secondary-foreground" strokeWidth={2.1} />
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
};

export default DmHeaderButton;
