import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepRewardChipProps {
  amount: number;
  /** 카운트업 지속 시간 ms. */
  durationMs?: number;
  className?: string;
}

/**
 * +N 파이트 머니 카운트업 칩 — 단계 완료 직후 즉시 보상 도파민 연출.
 * GPU 친화적인 transform/opacity 만 사용.
 */
export const StepRewardChip = ({
  amount,
  durationMs = 800,
  className,
}: StepRewardChipProps) => {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (amount <= 0) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(Math.round(amount * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount, durationMs]);

  if (amount <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-reward/15 px-2.5 py-1 text-[11px] font-bold text-reward",
        "shadow-[0_0_14px_rgba(246,196,83,0.35)] animate-bounce-in",
        className,
      )}
      aria-live="polite"
    >
      <Banknote className="h-3 w-3" />
      <span className="number-font">+{shown.toLocaleString()}</span>
    </span>
  );
};

export default StepRewardChip;
