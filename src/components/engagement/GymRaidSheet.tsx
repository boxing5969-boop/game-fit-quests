/**
 * 153 QUEST v2 21단계 — 짐 레이드 상세 시트.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 기존 /challenges 21일 챌린지 무수정 — 자체 도메인
 *   · 보상은 RPC 반환값만 사용
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 */

import { motion, AnimatePresence } from "framer-motion";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useActiveGymRaids,
  useClaimGymRaidReward,
} from "@/hooks/useGymRaid";
import { GYM_RAID_DISCLAIMER } from "@/data/gymRaidMessages";

import GymRaidContributionList from "./GymRaidContributionList";

interface Props {
  open: boolean;
  onClose: () => void;
}

const GymRaidSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);
  const { data, isLoading } = useActiveGymRaids(open);
  const claimMut = useClaimGymRaidReward();

  const raids = data?.raids ?? [];
  const branch = data?.branch ?? "";

  const handleClaim = async (raidId: string) => {
    try {
      const result = await claimMut.mutateAsync(raidId);
      toast.success(result.message, {
        description: `+${result.quest_xp_granted} XP · +${result.gems_granted} GEM${result.respect_granted > 0 ? ` · +${result.respect_granted} RP` : ""} (기여 ${result.contribution_count}회)`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "보상 처리 실패");
    }
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
            aria-label="짐 레이드"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <Flag className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    짐 레이드
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    {branch ? `${branch} 함께 깨는 목표` : "지점이 함께 깨는 목표"}
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    내 한 라운드가 우리 지점 누적에 더해집니다.
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

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {isLoading ? (
                <p className="text-[12px] text-muted-foreground">
                  레이드 정보를 불러오는 중…
                </p>
              ) : raids.length === 0 ? (
                <div className="rounded-card border border-border bg-background/40 p-3.5">
                  <p className="text-[12.5px] leading-relaxed text-foreground">
                    현재 진행 중인 짐 레이드가 없습니다.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    새 레이드가 시작되면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                raids.map((raid) => (
                  <GymRaidContributionList
                    key={raid.id}
                    raid={raid}
                    onClaim={handleClaim}
                    claimPending={claimMut.isPending}
                  />
                ))
              )}

              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                ※ {GYM_RAID_DISCLAIMER}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GymRaidSheet;
