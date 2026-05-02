/**
 * 153 QUEST v2 19단계 — 코너맨 매칭 메인 시트.
 *
 * 상태 분기:
 *   · pending received: 수락/거절 버튼
 *   · pending sent: 대기 중 표시
 *   · active: 상태 패널 + 보너스 + 종료
 *   · 없음: 후보 리스트 + 요청 보내기
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 보상은 RPC 반환값만 사용
 *   · grant_gems / wallet 직접 update 0
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Users, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useClaimCornermanDailyBonus,
  useCornermanCandidates,
  useEndCornermanPair,
  useMyCornermanStatus,
  useRequestCornermanPair,
  useRespondCornermanPair,
} from "@/hooks/useCornerman";
import {
  CORNERMAN_COPY,
  CORNERMAN_DISCLAIMER,
  RANK_KOREAN_LABEL,
} from "@/data/cornermanMessages";

import CornermanCandidateList from "./CornermanCandidateList";
import CornermanStatusPanel from "./CornermanStatusPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CornermanSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);

  const { data: status, isLoading: statusLoading } = useMyCornermanStatus();
  const { data: candidates, isLoading: candLoading } = useCornermanCandidates(
    30,
    open && !status?.has_active,
  );

  const requestMut = useRequestCornermanPair();
  const respondMut = useRespondCornermanPair();
  const endMut = useEndCornermanPair();
  const claimMut = useClaimCornermanDailyBonus();

  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingRespondId, setPendingRespondId] = useState<string | null>(null);

  const handleRequest = async (userId: string) => {
    setPendingRequestId(userId);
    try {
      const result = await requestMut.mutateAsync(userId);
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코너맨 요청 실패");
    } finally {
      setPendingRequestId(null);
    }
  };

  const handleRespond = async (
    pairId: string,
    action: "accept" | "decline",
  ) => {
    setPendingRespondId(pairId);
    try {
      const result = await respondMut.mutateAsync({ pairId, action });
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "응답 처리 실패");
    } finally {
      setPendingRespondId(null);
    }
  };

  const handleEnd = async () => {
    if (!status?.pair_id) return;
    if (!confirm("정말 코너맨 관계를 종료하시겠습니까?")) return;
    try {
      await endMut.mutateAsync(status.pair_id);
      toast.success("코너맨 관계가 종료되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "종료 처리 실패");
    }
  };

  const handleClaim = async () => {
    try {
      const result = await claimMut.mutateAsync();
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "보너스 처리 실패");
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            코너맨 매칭
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            {CORNERMAN_COPY.cardHeadline}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {CORNERMAN_COPY.cardSub}
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

  const renderPendingReceived = () => {
    if (!status || status.pending_received.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          {CORNERMAN_COPY.pendingReceivedHint}
        </p>
        <div className="space-y-2">
          {status.pending_received.map((p) => {
            const pending = pendingRespondId === p.pair_id;
            return (
              <div
                key={p.pair_id}
                className="rounded-card border border-primary/20 bg-primary/5 p-3.5"
              >
                <p className="text-[13px] font-bold text-foreground">
                  🥊 {p.requester_name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {RANK_KOREAN_LABEL[p.requester_rank] ?? p.requester_rank} 리그
                  · Lv.{p.requester_level}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRespond(p.pair_id, "accept")}
                    disabled={pending}
                    className="flex items-center justify-center gap-1 rounded-card bg-primary py-2 text-[12px] font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    수락
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(p.pair_id, "decline")}
                    disabled={pending}
                    className="flex items-center justify-center gap-1 rounded-card border border-border bg-card py-2 text-[12px] font-bold text-muted-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                    거절
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPendingSent = () => {
    if (!status || status.pending_sent.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          {CORNERMAN_COPY.pendingSentHint}
        </p>
        <div className="space-y-2">
          {status.pending_sent.map((p) => (
            <div
              key={p.pair_id}
              className="rounded-card border border-border bg-background/40 p-3"
            >
              <p className="text-[12.5px] font-medium text-foreground">
                {p.receiver_name}
                <span className="ml-2 badge-pill bg-amber-400/15 text-amber-700">
                  대기 중
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (statusLoading) {
      return (
        <p className="text-[12px] text-muted-foreground">
          코너맨 정보를 불러오는 중…
        </p>
      );
    }

    if (status?.has_active) {
      // active pair 상태 패널
      return (
        <div className="space-y-3">
          <CornermanStatusPanel
            status={status}
            onClaimBonus={handleClaim}
            onEnd={handleEnd}
            claimPending={claimMut.isPending}
            endPending={endMut.isPending}
          />
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            ※ {CORNERMAN_DISCLAIMER}
          </p>
        </div>
      );
    }

    // active 가 없으면 pending 처리 + 후보 리스트
    return (
      <div className="space-y-4">
        {renderPendingReceived()}
        {renderPendingSent()}

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            같은 지점 회원 후보
          </p>
          <p className="mb-2 text-[10.5px] leading-relaxed text-muted-foreground">
            {CORNERMAN_COPY.emptyHint}
          </p>
          <CornermanCandidateList
            candidates={candidates ?? []}
            isLoading={candLoading}
            pendingUserId={pendingRequestId}
            onRequest={handleRequest}
          />
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ {CORNERMAN_DISCLAIMER}
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
            aria-label="코너맨 매칭"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {renderBody()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CornermanSheet;
