/**
 * 153 QUEST v1.5 15단계 — 리턴 라운드 시트.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 보상 amount 는 RPC 반환값(quest_xp_granted/gems_granted)만 사용
 *   · grant_gems 직접 호출 0건 — claim_return_round_reward 내부에서만
 *   · record_attendance 호출 0
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss 적용
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useClaimReturnRoundReward,
  useReturnRoundStatus,
} from "@/hooks/useReturnRound";
import { getReturnRoundCopy } from "@/data/returnRoundMessages";
import type { ClaimReturnRoundResult } from "@/services/boxingEngagementService";

import ReturnRoundMissionCard from "./ReturnRoundMissionCard";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ReturnRoundSheet = ({ open, onClose }: Props) => {
  const { data: status, isLoading } = useReturnRoundStatus();
  const claim = useClaimReturnRoundReward();
  useModalDismiss(open, onClose);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ClaimReturnRoundResult | null>(null);

  const copy = useMemo(
    () => getReturnRoundCopy(status?.return_type ?? null),
    [status?.return_type],
  );

  useEffect(() => {
    if (open) {
      setSelectedCode(null);
      setPending(false);
      setResult(null);
    }
  }, [open]);

  const claimed = status?.already_claimed_today === true;
  const cooldown = status?.on_cooldown === true;
  const blocked = claimed || cooldown;
  const canSubmit = !!selectedCode && !pending && !blocked && status?.active;

  const handleClaim = async () => {
    if (!canSubmit || !selectedCode) return;
    setPending(true);
    try {
      const data = await claim.mutateAsync(selectedCode);
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "복귀 보상을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
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
            리턴 라운드
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            {copy?.sheetTitle ?? "복귀 라운드"}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {status?.inactive_days != null
              ? `${status.inactive_days}일 만의 복귀입니다.`
              : "돌아온 것 자체가 오늘의 승리입니다."}
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

  const renderResult = () => {
    if (!result) return null;
    return (
      <div className="space-y-3">
        <div className="rounded-card border border-emerald-400/40 bg-emerald-400/10 p-3.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-[13.5px] font-bold text-foreground">
              복귀 완료. {result.message}
            </p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {copy?.closingMessage}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              QUEST XP
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              +{result.quest_xp_granted}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-reward">
              파이트 머니
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-reward">
              +{result.gems_granted.toLocaleString()}
            </p>
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ 리턴 라운드는 보조 시스템입니다. 공식 1~40 레벨업 / 공식 XP /
          승급과 무관합니다.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    );
  };

  const renderBlocked = () => (
    <div className="space-y-3">
      <div className="rounded-card border border-amber-400/40 bg-amber-400/10 p-3.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-[13.5px] font-bold text-foreground">
            {claimed
              ? "오늘은 이미 복귀 보상을 받았습니다."
              : "이번 주기의 복귀 보상은 이미 받았습니다."}
          </p>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          기록은 계속 쌓이지만, 보상은 다음 주기에 다시 열립니다. 오늘은 다른
          보조 퀘스트로 천천히 돌아오세요.
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

  const renderForm = () => (
    <div className="space-y-3">
      {copy && (
        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오삼 코치
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">
            {copy.sheetIntro}
          </p>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          오늘 할 한 가지를 골라주세요
        </p>
        <div className="space-y-2">
          {(status?.missions ?? []).map((m) => (
            <ReturnRoundMissionCard
              key={m.code}
              mission={m}
              selected={selectedCode === m.code}
              onSelect={() => setSelectedCode(m.code)}
            />
          ))}
        </div>
      </div>

      {copy && (
        <div className="rounded-card border border-border bg-card p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-reward">
            오늘의 보상
          </p>
          <p className="mt-0.5 text-[13px] font-bold text-reward">
            {copy.rewardLine}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 보상은 QUEST XP / 파이트 머니로만 지급됩니다. 공식 XP는
            지급되지 않습니다.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleClaim}
        disabled={!canSubmit}
        className={`w-full rounded-card py-3 text-[14px] font-bold transition-all ${
          canSubmit
            ? "bg-primary text-primary-foreground active:scale-[0.98]"
            : "cursor-not-allowed bg-primary/50 text-primary-foreground opacity-60"
        }`}
      >
        {pending
          ? "처리 중…"
          : !selectedCode
            ? "복귀 미션을 선택해주세요"
            : "복귀 보상 받기"}
      </button>

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 리턴 라운드는 공식 출석 / 공식 미션과 무관한 보조 시스템입니다.
      </p>
    </div>
  );

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
            aria-label="리턴 라운드"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {isLoading ? (
                <p className="text-[12px] text-muted-foreground">
                  복귀 라운드 정보를 불러오는 중…
                </p>
              ) : result ? (
                renderResult()
              ) : blocked ? (
                renderBlocked()
              ) : !status?.active ? (
                <p className="text-[12px] text-muted-foreground">
                  꾸준히 오고 계시네요. 리턴 라운드는 3일 이상 비활동 시
                  열립니다.
                </p>
              ) : (
                renderForm()
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReturnRoundSheet;
