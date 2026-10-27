/**
 * 153 QUEST v2 19단계 — 코너맨 active pair 상태 패널.
 *
 * 본인/파트너 오늘 활동 상태 + 보너스 claim 버튼 + 종료 버튼.
 *
 * 보호 원칙:
 *   · 보상은 RPC 반환값만 표시 — 클라이언트 amount 계산 0
 *   · grant_gems / wallet 직접 update 0
 */

import { CheckCircle2, Circle, LogOut } from "lucide-react";

import { CORNERMAN_COPY, RANK_KOREAN_LABEL } from "@/data/cornermanMessages";
import type { CornermanStatus } from "@/services/boxingEngagementService";
import { toGlobalLevel } from "@/lib/rankLabels";

export interface CornermanStatusPanelProps {
  status: CornermanStatus;
  onClaimBonus: () => void;
  onEnd: () => void;
  claimPending: boolean;
  endPending: boolean;
}

const CornermanStatusPanel = ({
  status,
  onClaimBonus,
  onEnd,
  claimPending,
  endPending,
}: CornermanStatusPanelProps) => {
  if (!status.has_active || !status.today) return null;

  const me = status.today.my_completed;
  const partner = status.today.partner_completed;
  const both = status.today.both_completed;
  const claimed = status.today.bonus_claimed;
  const canClaim = both && !claimed;

  let statusHint: string;
  if (claimed) {
    statusHint = CORNERMAN_COPY.bonusClaimedHint;
  } else if (both) {
    statusHint = CORNERMAN_COPY.bothCompletedHint;
  } else if (me || partner) {
    statusHint = CORNERMAN_COPY.oneCompletedHint;
  } else {
    statusHint = CORNERMAN_COPY.noneCompletedHint;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-primary/20 bg-primary/5 p-3.5">
        <p className="text-label font-bold text-primary">
          {CORNERMAN_COPY.activeHeadline}
        </p>
        <p className="mt-1 text-label font-bold text-foreground">
          🥊 {status.partner_name}
        </p>
        <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
          {RANK_KOREAN_LABEL[status.partner_rank ?? "white"]} 리그 · Lv.
          {toGlobalLevel(status.partner_rank ?? "white", status.partner_level ?? 1)}
        </p>
      </div>

      <div className="rounded-card border border-border bg-card p-3.5">
        <p className="text-label font-bold text-muted-foreground">
          오늘 운동
        </p>
        <ul className="mt-2 space-y-1.5">
          <li className="flex items-center gap-2 text-label">
            {me ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={
                me ? "font-bold text-foreground" : "text-muted-foreground"
              }
            >
              나 — {me ? "오늘 운동 완료" : "아직"}
            </span>
          </li>
          <li className="flex items-center gap-2 text-label">
            {partner ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={
                partner ? "font-bold text-foreground" : "text-muted-foreground"
              }
            >
              {status.partner_name} — {partner ? "오늘 운동 완료" : "아직"}
            </span>
          </li>
        </ul>
        <p className="mt-2 text-label leading-relaxed text-muted-foreground">
          {statusHint}
        </p>
      </div>

      <button
        type="button"
        onClick={onClaimBonus}
        disabled={!canClaim || claimPending}
        className={`w-full rounded-card py-3 text-label font-bold transition-all ${
          canClaim && !claimPending
            ? "bg-primary text-primary-foreground active:scale-[0.98]"
            : "cursor-not-allowed bg-primary/40 text-primary-foreground opacity-60"
        }`}
      >
        {claimPending
          ? "보너스 처리 중…"
          : claimed
            ? "오늘 보너스 받음"
            : both
              ? "짝꿍 보너스 받기 (챔피언 머니 +100)"
              : "둘 다 오늘 운동하면 열려요"}
      </button>

      <button
        type="button"
        onClick={onEnd}
        disabled={endPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-card border border-border bg-card py-2.5 text-label font-medium text-muted-foreground transition-all active:scale-[0.99] hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
      >
        <LogOut className="h-3.5 w-3.5" />
        {endPending ? "종료 중…" : "짝꿍 그만하기"}
      </button>
    </div>
  );
};

export default CornermanStatusPanel;
