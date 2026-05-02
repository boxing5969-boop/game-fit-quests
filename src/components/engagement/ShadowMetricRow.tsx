/**
 * 153 QUEST v2 20단계 — 그림자 복서 지표 비교 행.
 *
 * 한 지표 (예: 퀴즈 정답) 의 shadow vs current 비교 표시.
 */

import { ArrowUp, Minus } from "lucide-react";

import { getShadowMetricEmoji } from "@/data/shadowBoxerMessages";
import type { ShadowBoxerMetric } from "@/services/boxingEngagementService";

export interface ShadowMetricRowProps {
  metric: ShadowBoxerMetric;
}

const ShadowMetricRow = ({ metric }: ShadowMetricRowProps) => {
  const diff = metric.current - metric.shadow;
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5">
      <span className="text-[16px]">{getShadowMetricEmoji(metric.key)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-foreground">{metric.label}</p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
          그림자 {metric.shadow} → 지금 {metric.current}
        </p>
      </div>
      <div
        className={`shrink-0 flex items-center gap-1 rounded-pill px-2 py-1 text-[10.5px] font-bold ${
          metric.improved
            ? "bg-emerald-400/15 text-emerald-700"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {metric.improved ? (
          <>
            <ArrowUp className="h-3 w-3" />+{diff}
          </>
        ) : (
          <>
            <Minus className="h-3 w-3" />
            {diff === 0 ? "0" : diff}
          </>
        )}
      </div>
    </div>
  );
};

export default ShadowMetricRow;
