/**
 * 153 QUEST v1.5 16단계 — 복싱 IQ 리그 카드.
 *
 * 등급 / 정답수 / 정답률 / 연속 정답 / 이번 주 정답 표시.
 *
 * 보호 원칙:
 *   · 공식 레벨/리그와 분리 — 본 카드의 등급은 보조 표시
 *   · 데이터는 RPC 만 — 공식 missions / member_progress 미참조
 */

import { Brain } from "lucide-react";

import { useBoxingIqLeague } from "@/hooks/useBoxingIqLeague";
import { getIqGradeDisplay } from "@/data/hiddenMissionCatalog";

const BoxingIqLeagueCard = () => {
  const { data, isLoading } = useBoxingIqLeague();
  const grade = data?.grade ?? "복싱 입문생";
  const gd = getIqGradeDisplay(grade);

  return (
    <section
      data-tour="boxing-iq-card"
      className="surface-card border border-border bg-card"
      aria-label="복싱 IQ 리그"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Brain className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            복싱 IQ 리그
          </p>
          <h3 className="mt-0.5 text-[15px] font-bold text-foreground">
            {gd.emoji} {grade}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {gd.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            정답 수
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {isLoading ? "…" : data?.quiz_correct_count.toLocaleString() ?? 0}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            시도 {data?.quiz_attempt_count ?? 0}회 ·{" "}
            {data?.accuracy_rate?.toFixed(1) ?? "0.0"}%
          </p>
        </div>
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            연속 정답
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {isLoading ? "…" : data?.current_quiz_streak ?? 0}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            최고 {data?.best_quiz_streak ?? 0}연승
          </p>
        </div>
        <div className="col-span-2 rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            이번 주 정답
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {isLoading ? "…" : data?.week_correct_count ?? 0}회
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            ※ 본 등급은 공식 레벨·리그와 분리된 보조 표시입니다.
          </p>
        </div>
      </div>
    </section>
  );
};

export default BoxingIqLeagueCard;
