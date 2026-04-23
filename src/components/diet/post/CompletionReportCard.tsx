import { Award, Calendar, HeartPulse, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIET_HABIT_LABEL_KO,
  type DietPostProgramSummary,
} from "@/lib/diet/postProgramTypes";

interface CompletionReportCardProps {
  summary: DietPostProgramSummary;
  weightChangeKg?: number | null;
  waistChangeCm?: number | null;
  className?: string;
}

/**
 * 21일 종료 리포트 카드.
 *
 * 톤: 성공/실패 이분법 금지. 사실 요약 + 축하.
 * 체중/허리 변화는 공개 랭킹과 분리 — 본인에게만 선택적으로 보여준다.
 */
export const CompletionReportCard = ({
  summary,
  weightChangeKg,
  waistChangeCm,
  className,
}: CompletionReportCardProps) => {
  const best = summary.best_habit ? DIET_HABIT_LABEL_KO[summary.best_habit] : null;
  const weak = summary.weakest_habit
    ? DIET_HABIT_LABEL_KO[summary.weakest_habit]
    : null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-reward/30 bg-gradient-to-b from-reward/10 to-card",
        "p-5 shadow-[0_0_24px_-8px_rgba(246,196,83,0.35)]",
        className,
      )}
      aria-labelledby="diet-completion-report-title"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-reward/20 p-1.5 text-reward-foreground">
          <Award className="h-4 w-4 text-[#F6C453]" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F6C453]">
          21-DAY REPORT
        </p>
      </div>
      <h2
        id="diet-completion-report-title"
        className="mt-2 text-display-sm font-extrabold leading-tight text-foreground"
      >
        21일의 기록
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        체중보다 먼저 바뀐 건 리듬입니다. 아래는 지난 21일 자기 점검 결과입니다.
      </p>

      {/* 핵심 지표 4-그리드 */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatTile
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="기간"
          value={`${summary.start_date.slice(5)} → ${summary.end_date.slice(5)}`}
          valueClass="text-[13px]"
        />
        <StatTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="승인 일수"
          value={`${summary.approved_days} / 21`}
        />
        <StatTile
          icon={<HeartPulse className="h-3.5 w-3.5" />}
          label="출석률"
          value={`${Math.round(summary.attendance_rate)}%`}
        />
        <StatTile
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="습관 점수"
          value={`${Math.round(summary.habit_score)}`}
        />
      </div>

      {/* 습관 best / weakest */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {best && (
          <HabitRow tone="good" label="가장 잘 지킨 습관" habit={best} />
        )}
        {weak && (
          <HabitRow tone="focus" label="다음에 집중할 습관" habit={weak} />
        )}
      </div>

      {/* 선택적 체중/허리 변화 — 본인 자기보고. 공개 랭킹과 분리. */}
      {(weightChangeKg != null || waistChangeCm != null) && (
        <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2.5 text-[12px]">
          <p className="font-bold text-foreground">신체 변화 (비공개)</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {weightChangeKg != null && (
              <>
                체중 {weightChangeKg > 0 ? "+" : ""}
                <span className="number-font font-bold text-foreground">
                  {weightChangeKg.toFixed(1)}
                </span>{" "}
                kg
              </>
            )}
            {weightChangeKg != null && waistChangeCm != null && " · "}
            {waistChangeCm != null && (
              <>
                허리 {waistChangeCm > 0 ? "+" : ""}
                <span className="number-font font-bold text-foreground">
                  {waistChangeCm.toFixed(1)}
                </span>{" "}
                cm
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
};

const StatTile = ({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
    <p className={cn("mt-1 number-font font-extrabold text-foreground text-[15px]", valueClass)}>
      {value}
    </p>
  </div>
);

const HabitRow = ({
  tone,
  label,
  habit,
}: {
  tone: "good" | "focus";
  label: string;
  habit: string;
}) => (
  <div
    className={cn(
      "rounded-xl border px-3 py-2 text-[12px] leading-relaxed",
      tone === "good"
        ? "border-emerald-400/30 bg-emerald-400/10 text-foreground"
        : "border-primary/30 bg-primary/5 text-foreground",
    )}
  >
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 font-bold">{habit}</p>
  </div>
);

export default CompletionReportCard;
