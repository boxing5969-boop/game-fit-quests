import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import ComebackMissionDialog from "./ComebackMissionDialog";

interface ComebackButtonProps {
  className?: string;
}

/**
 * "망쳤어요" 버튼 — 실패 복귀 시스템의 진입점.
 *
 * 배치: DietHubPage ActiveHome 의 오늘의 미션 CTA 바로 아래.
 * 톤: 벌이 아니라 회복. 낮은 시각 프라이머리(mint 계열), 항상 열림.
 * 클릭 시 ComebackMissionDialog 오픈 — 체크리스트로 1개만 해도 복구 성공.
 */
export const ComebackButton = ({ className }: ComebackButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full items-center justify-between rounded-xl border border-dashed px-3.5 py-2.5 text-left",
          "border-emerald-400/35 bg-transparent hover:bg-emerald-400/5",
          "transition-all active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
          className,
        )}
        aria-label="오늘 조금 무너졌다면 복귀 루틴 열기"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-500">
            <Heart className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[12.5px] font-bold text-foreground">
              오늘 조금 무너졌어요
            </p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
              괜찮아요 · 1개만 해도 오늘은 복구 성공
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10.5px] font-bold text-emerald-500 group-hover:translate-x-0.5 transition-transform">
          복귀 루틴 →
        </span>
      </button>

      <ComebackMissionDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ComebackButton;
