/**
 * 153 QUEST — 챌린지 아레나 바텀시트.
 *
 * 보호 원칙:
 *   · 공식 1~40 missions / member_progress / user_wallets 미수정
 *   · 기존 /challenges 21일 챌린지 / challengeService / submitChallengeCheckin / syncQuestCheckin 미사용
 *   · 보상 amount 는 RPC 반환값만 사용
 *   · grant_gems 직접 호출 0건
 *   · ChatAssistant 미참조
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X } from "lucide-react";

import { useBoxingFunChallenges } from "@/hooks/useBoxingFunChallenges";
import type { BoxingFunChallenge } from "@/services/boxingEngagementService";

import FunChallengeCard from "./FunChallengeCard";
import FunChallengeSubmitForm from "./FunChallengeSubmitForm";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FunChallengeArenaSheet = ({ open, onClose }: Props) => {
  // open=false 일 때는 RPC 가 발사되지 않도록 enabled gate.
  const { data: challenges, isLoading } = useBoxingFunChallenges(open);
  const [selected, setSelected] = useState<BoxingFunChallenge | null>(null);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Swords className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘의 라운드
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            챌린지 아레나
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            공식 훈련은 그대로, 오늘은 재미 챌린지로 한 라운드 더.
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

  const renderList = () => {
    if (isLoading) {
      return (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          챌린지 목록을 불러오고 있어요…
        </div>
      );
    }
    const list = challenges ?? [];
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <p className="text-3xl">🥊</p>
          <p className="mt-2 text-sm font-bold text-foreground">
            지금 도전 가능한 챌린지가 없습니다
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            준비되는 대로 새 라운드를 올려두겠습니다.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-card border border-primary/15 bg-primary/5 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-foreground">
            기록을 깨는 상대는 남이 아니라 어제의 나입니다.
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 본 챌린지는 재미와 습관을 위한 보조 챌린지입니다. 공식 1~40
            레벨업·승급 조건과는 무관합니다.
          </p>
        </div>
        {list.map((c) => (
          <FunChallengeCard key={c.id} challenge={c} onChallenge={setSelected} />
        ))}
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
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}

            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {selected ? (
                <FunChallengeSubmitForm
                  challenge={selected}
                  onBack={() => setSelected(null)}
                  onClose={onClose}
                />
              ) : (
                renderList()
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FunChallengeArenaSheet;
