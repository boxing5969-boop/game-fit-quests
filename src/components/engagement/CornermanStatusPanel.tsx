/**
 * 153 QUEST v2 19단계 — 복싱파트너(예전 코너맨 · 운동 짝꿍) 상태 패널.
 *
 * 2026-11-21 대표님 「짝꿍은 한명만 하는것이 아니라 여러명 할수있게 하자 … 복싱파트너로 이름 변경하자」:
 *   파트너 여러 명(10명까지) — 사람마다 오늘 운동 · 그만하기. 보너스는 사람마다 하루 한 번(서버).
 *
 * 보호 원칙:
 *   · 보상은 RPC 반환값만 표시 — 클라이언트 amount 계산 0
 *   · grant_gems / wallet 직접 update 0
 */

import { CheckCircle2, Circle, LogOut } from "lucide-react";

import { CORNERMAN_COPY, RANK_KOREAN_LABEL } from "@/data/cornermanMessages";
import type { CornermanPartner, CornermanStatus } from "@/services/boxingEngagementService";
import { toGlobalLevel } from "@/lib/rankLabels";
import { openMemberCard } from "@/lib/appEvents";

export interface CornermanStatusPanelProps {
  status: CornermanStatus;
  onClaimBonus: () => void;
  onEnd: (partner: CornermanPartner) => void;
  claimPending: boolean;
  /** 그만하는 중인 파트너 pair_id */
  endingPairId: string | null;
}

/** 서버가 partners 를 안 보낸 옛 응답이면 한 명 칸으로 만든다 */
export function partnersOf(status: CornermanStatus | undefined | null): CornermanPartner[] {
  if (!status?.has_active) return [];
  if (status.partners && status.partners.length > 0) return status.partners;
  if (!status.pair_id || !status.partner_user_id) return [];
  return [
    {
      pair_id: status.pair_id,
      partner_user_id: status.partner_user_id,
      partner_name: status.partner_name ?? "회원",
      partner_rank: status.partner_rank ?? "white",
      partner_level: status.partner_level ?? 1,
      accepted_at: status.accepted_at ?? null,
      today_completed: !!status.today?.partner_completed,
    },
  ];
}

const CornermanStatusPanel = ({
  status,
  onClaimBonus,
  onEnd,
  claimPending,
  endingPairId,
}: CornermanStatusPanelProps) => {
  const partners = partnersOf(status);
  if (partners.length === 0 || !status.today) return null;

  const me = status.today.my_completed;
  const anyPartner = status.today.partner_completed;
  const both = status.today.both_completed;
  const claimed = status.today.bonus_claimed;
  const canClaim = both && !claimed;
  const limit = status.partner_limit ?? 10;

  let statusHint: string;
  if (claimed) {
    statusHint = CORNERMAN_COPY.bonusClaimedHint;
  } else if (both) {
    statusHint = CORNERMAN_COPY.bothCompletedHint;
  } else if (me || anyPartner) {
    statusHint = CORNERMAN_COPY.oneCompletedHint;
  } else {
    statusHint = CORNERMAN_COPY.noneCompletedHint;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label font-bold text-primary">
            {CORNERMAN_COPY.activeHeadline}
          </p>
          <span className="shrink-0 text-label font-bold text-muted-foreground">
            {partners.length}/{limit}명
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-label">
          {me ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={me ? "font-bold text-foreground" : "text-muted-foreground"}>
            나 — {me ? "오늘 운동 완료" : "아직"}
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {partners.map((p) => {
          const ending = endingPairId === p.pair_id;
          return (
            <li
              key={p.pair_id}
              className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
            >
              {p.today_completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="오늘 운동 완료" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="아직" />
              )}
              <button
                type="button"
                onClick={() => openMemberCard(p.partner_user_id)}
                className="min-w-0 flex-1 text-left active:opacity-70"
              >
                <span className="block truncate text-label font-bold text-foreground">
                  {p.partner_name}
                </span>
                <span className="block text-label text-muted-foreground">
                  {RANK_KOREAN_LABEL[p.partner_rank] ?? p.partner_rank} 리그 · Lv.
                  {toGlobalLevel(p.partner_rank, p.partner_level)}
                  {p.today_completed ? " · 오늘 운동 완료" : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onEnd(p)}
                disabled={ending}
                aria-label={`${p.partner_name}님과 복싱파트너 그만하기`}
                className="flex shrink-0 items-center gap-1 rounded-card border border-border px-2.5 py-1.5 text-micro font-bold text-muted-foreground transition-all active:scale-[0.98] hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
              >
                <LogOut className="h-3 w-3" />
                {ending ? "…" : "그만하기"}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-label leading-relaxed text-muted-foreground">{statusHint}</p>

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
              ? "파트너 보너스 받기 (챔피언 머니 +100)"
              : "나와 파트너가 오늘 운동하면 열려요"}
      </button>
    </div>
  );
};

export default CornermanStatusPanel;
