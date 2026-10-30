/**
 * 🐷 마일리지로 아낀 금액 — "지금까지 153 마일리지로 22,000원 아꼈어요" (2026-10-30 대표님:
 *   "배달의 민족이나 플랫폼들도 구독 요금제 쓰는 회원님들에게 지금까지 총 얼마를 할인받았는지 보여 주잖아 —
 *    시각적으로 마일리지 할인을 받은 회원님들은 얼마를 할인받았는지 보여 줘")
 *   · 숫자 = 서버 get_my_mileage_savings (앱 결제 할인 − 취소로 돌려받은 것 + 데스크 결제 할인). 1점 = 1원.
 *   · 한 번도 할인받지 않았으면 그리지 않는다.
 *   · band = 마일리지 카드 맨 위 띠(홈 · 내 정보) · line = 결제 확인 창 마일리지 칸 한 줄 · tile = 결제 내역 요약 칸
 */
import { useEffect, useState } from "react";
import { ChevronRight, PiggyBank } from "lucide-react";
import { useMyMileageSavings } from "@/hooks/useMileage";
import { cn } from "@/lib/utils";
import { kstShortDate, savingsDetail } from "@/services/mileageService";

const won = (n: number) => Math.trunc(n).toLocaleString("ko-KR");

/** 0 → 금액으로 올라가는 숫자 (움직임 줄이기 설정이면 바로) */
function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

interface Props {
  variant: "band" | "line" | "tile";
  onClick?: () => void;
  className?: string;
}

const MileageSavedBanner = ({ variant, onClick, className }: Props) => {
  const { data } = useMyMileageSavings();
  const total = data?.total ?? 0;
  const shown = useCountUp(total);
  if (!data || total <= 0) return null;

  if (variant === "line") {
    return (
      <p className={cn("flex items-center gap-1.5 rounded-xl bg-amber-400/15 px-3 py-2 text-label font-bold text-amber-800 dark:text-reward", className)}>
        <PiggyBank className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          지금까지 <span className="tabular-nums">{won(total)}원</span> 아꼈어요 · 이번 결제도 아껴 보세요
        </span>
      </p>
    );
  }

  if (variant === "tile") {
    return (
      <div className={cn("rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-200/10 px-3.5 py-3", className)}>
        <p className="flex items-center gap-1.5 text-label font-bold text-amber-800 dark:text-reward">
          <PiggyBank className="h-4 w-4" aria-hidden /> 지금까지 마일리지로 아낀 금액
        </p>
        <p className="mt-0.5 text-title font-black tabular-nums text-foreground">{won(shown)}원</p>
        <p className="text-label text-muted-foreground">{savingsDetail(data)}</p>
      </div>
    );
  }

  // band — 마일리지 카드 맨 위
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden border-b border-amber-400/30 bg-gradient-to-r from-amber-400/25 via-amber-300/15 to-amber-100/5 px-3.5 py-3 text-left",
        onClick && "transition-colors active:bg-amber-400/30",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white shadow-elev-1">
        <PiggyBank className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-bold text-amber-800 dark:text-reward">지금까지 153 마일리지로</span>
        <span className="block text-title font-black tabular-nums text-foreground">
          {won(shown)}원 <span className="text-heading font-black">아꼈어요</span>
        </span>
        <span className="block truncate text-micro text-muted-foreground">
          결제 할인 {data.count}번{data.lastAt ? ` · 마지막 ${kstShortDate(data.lastAt)}` : ""}
        </span>
      </span>
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-amber-700/70" aria-hidden />}
    </Tag>
  );
};

export default MileageSavedBanner;
