/**
 * 🥊 첫 4주 8번 — '운동 달력' 카드 맨 위 칸 (2026-11-12 대표님 「추천대로」 · 선릉역점만 먼저)
 *   선릉역점 신규: 첫 4주에 8번 이상 온 회원은 3개월째 77%가 남았다(1~3번은 23%) — 보고서
 *   https://claude.ai/artifact/6sAvidMfhyLhFERCK5jXFw. 첫 출석일부터 28일 동안만 보이고, 다 채우면 금색 '달성'.
 *   숫자는 서버 get_my_motivation 그대로(hooks/useMotivation) — 켠 지점 회원이 아니거나 4주가 지나면 그리지 않는다.
 *   주인공은 'n / 8번' 하나 · 칸 8개 · 한 줄. 글은 lib/motivation153 starterView.
 */
import { useMotivation } from "@/hooks/useMotivation";
import { kstToday } from "@/lib/attendanceCheer";
import { starterView, type StarterView } from "@/lib/motivation153";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 StarterProgress) */
export const StarterProgressView = ({ v, className }: { v: StarterView; className?: string }) => {
  if (!v.show) return null;
  return (
    <div
      aria-label={`첫 4주 ${v.goal}번`}
      className={cn(
        "mt-3 rounded-xl px-4 py-3",
        v.done ? "border border-amber-500/30 bg-amber-500/10" : "bg-primary/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-label font-bold", v.done ? "text-amber-800 dark:text-amber-300" : "text-primary")}>
          첫 4주 {n(v.goal)}번
        </p>
        <p className="text-label tabular-nums text-muted-foreground">{v.done ? "달성" : `${n(v.daysLeft)}일 남음`}</p>
      </div>
      <p className="mt-1 text-heading font-black tabular-nums text-foreground">
        {v.done ? (
          `${n(v.goal)}번 모두 채웠어요`
        ) : (
          <>
            {n(v.count)}
            <span className="text-body font-bold text-muted-foreground"> / {n(v.goal)}번</span>
          </>
        )}
      </p>
      <div
        className="mt-2 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${v.goal}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={v.goal}
        aria-valuenow={v.count}
        aria-label={`첫 4주 ${v.goal}번 중 ${v.count}번`}
      >
        {Array.from({ length: v.goal }, (_, i) => (
          <span
            key={i}
            className={cn("h-2 rounded-full", i < v.count ? (v.done ? "bg-amber-500" : "bg-primary") : "bg-primary/15")}
          />
        ))}
      </div>
      <p className="mt-2 text-label text-foreground">{v.hint}</p>
    </div>
  );
};

const StarterProgress = ({ className }: { className?: string }) => {
  const { data } = useMotivation();
  return <StarterProgressView v={starterView(data, kstToday())} className={className} />;
};

export default StarterProgress;
