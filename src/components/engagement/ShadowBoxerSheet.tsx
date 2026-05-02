/**
 * 153 QUEST v2 20단계 — 그림자 복서 상세 시트.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 보상은 RPC 반환값만 사용
 *   · grant_gems / wallet 직접 update 0
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 */

import { motion, AnimatePresence } from "framer-motion";
import { Hourglass, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useClaimShadowBoxerReward,
  useShadowBoxerSnapshot,
} from "@/hooks/useShadowBoxer";
import {
  SHADOW_BOXER_DISCLAIMER,
  pickShadowBoxerOsamiLine,
} from "@/data/shadowBoxerMessages";

import ShadowMetricRow from "./ShadowMetricRow";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ShadowBoxerSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);
  const { data: snapshot, isLoading } = useShadowBoxerSnapshot(30, open);
  const claim = useClaimShadowBoxerReward();

  const ready = snapshot?.ready === true;
  const improved = snapshot?.improved === true;
  const osamiSeed = snapshot?.shadow_score?.toString() ?? "shadow";
  const osamiState: "improved" | "not_improved" | "not_ready" = !ready
    ? "not_ready"
    : improved
      ? "improved"
      : "not_improved";

  const handleClaim = async () => {
    try {
      const result = await claim.mutateAsync(30);
      toast.success(result.message, {
        description: `+${result.quest_xp_granted} XP · +${result.gems_granted} GEM${result.respect_granted > 0 ? ` · +${result.respect_granted} RP` : ""}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "보상 처리 실패");
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            그림자 복서
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            오늘의 상대는 30일 전의 나
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            남과 비교 부담 없이 어제의 나와 라운드 합니다.
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const renderNotReady = () => (
    <div className="space-y-3">
      <div className="rounded-card border border-amber-400/30 bg-amber-400/5 p-3.5">
        <div className="flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-amber-500" />
          <p className="text-[13.5px] font-bold text-foreground">
            분석 준비 중입니다
          </p>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {snapshot?.reason ?? "30일이 지나면 과거의 당신과 마주합니다."}
        </p>
      </div>
      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
          오삼 코치
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-foreground">
          {pickShadowBoxerOsamiLine("not_ready", osamiSeed)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
      >
        닫기
      </button>
    </div>
  );

  const renderResult = () => {
    if (!snapshot) return null;
    return (
      <div className="space-y-3">
        {/* 점수 비교 헤드라인 */}
        <div
          className={`rounded-card border p-3.5 ${
            improved
              ? "border-emerald-400/40 bg-emerald-400/10"
              : "border-amber-400/30 bg-amber-400/5"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            {snapshot.shadow_period} → {snapshot.current_period}
          </p>
          <p className="mt-1 text-[14px] font-bold text-foreground">
            {snapshot.message}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-card border border-border bg-card p-2.5">
              <p className="text-[9.5px] uppercase text-muted-foreground">
                그림자 점수
              </p>
              <p className="number-font mt-0.5 text-[18px] font-black text-muted-foreground">
                {snapshot.shadow_score}
              </p>
            </div>
            <div className="rounded-card border border-primary/30 bg-primary/5 p-2.5">
              <p className="text-[9.5px] uppercase text-primary">현재 점수</p>
              <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
                {snapshot.current_score}
              </p>
            </div>
          </div>
          {improved && snapshot.growth_rate !== undefined && (
            <p className="mt-2 text-[12px] font-bold text-emerald-700">
              성장률 +{snapshot.growth_rate}%
            </p>
          )}
        </div>

        {/* 지표별 비교 */}
        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            지표별 비교
          </p>
          <div className="space-y-1.5">
            {(snapshot.metrics ?? []).map((m) => (
              <ShadowMetricRow key={m.key} metric={m} />
            ))}
          </div>
        </div>

        {/* 오삼 코멘트 */}
        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오삼 코치
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-foreground">
            {pickShadowBoxerOsamiLine(osamiState, osamiSeed)}
          </p>
        </div>

        {/* 보상 버튼 */}
        {improved && (
          <button
            type="button"
            onClick={handleClaim}
            disabled={claim.isPending}
            className="w-full rounded-card bg-primary py-3 text-[14px] font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {claim.isPending
              ? "보상 처리 중…"
              : `이번 달 보상 받기 (+150 XP · +300 GEM${(snapshot.growth_rate ?? 0) >= 30 ? " · +20 RP" : ""})`}
          </button>
        )}

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ {SHADOW_BOXER_DISCLAIMER}
        </p>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="그림자 복서"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {isLoading ? (
                <p className="text-[12px] text-muted-foreground">
                  과거의 라운드를 불러오는 중…
                </p>
              ) : ready ? (
                renderResult()
              ) : (
                renderNotReady()
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShadowBoxerSheet;
