/**
 * 타이틀매치 축하 피드 — 시트.
 *
 * 박수는 새 테이블을 만들지 않고 기존 send_boxing_cheer 를 재사용한다
 * (일일 한도·보상·멱등이 그 RPC 안에 있어 한 곳에서 관리된다).
 */

import { AnimatePresence, motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useClapTitleMatch, useTitleMatchFeed } from "@/hooks/useCommunityHub";
import { RANK_LABELS } from "@/data/sharedConstants";

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const TitleMatchFeedSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);

  const { data, isLoading } = useTitleMatchFeed(open);
  const clap = useClapTitleMatch();
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = data?.items ?? [];

  const handleClap = async (id: string, userId: string) => {
    setBusyId(id);
    try {
      await clap.mutateAsync({ receiverUserId: userId, sourceId: id });
      toast.success("박수를 보냈습니다 👏");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "박수를 보내지 못했습니다");
    } finally {
      setBusyId(null);
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return <p className="py-6 text-center text-[12px] text-muted-foreground">불러오는 중…</p>;
    }
    if (items.length === 0) {
      return (
        <div className="rounded-card border border-border bg-muted/20 px-4 py-7 text-center">
          <p className="text-2xl">🥇</p>
          <p className="mt-2 text-[13px] font-bold text-foreground">
            아직 통과한 동료가 없습니다
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            레벨 10 · 20 · 30 · 40은 코치님이 직접 보고 승인하는 관문입니다.
            통과하면 이 자리에 올라오고, 동료들이 박수를 보낼 수 있습니다.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-reward/15 text-[13px] font-black text-reward">
              {it.globalLevel}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-foreground">
                {it.isMine ? "나" : it.nickname}
                <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                  {RANK_LABELS[it.rank] || it.rank} 타이틀매치 통과
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDay(it.at)}
                {it.claps > 0 && ` · 👏 ${it.claps}`}
              </p>
            </div>
            {it.isMine ? (
              <span className="shrink-0 text-[11px] font-bold text-reward">축하합니다</span>
            ) : it.clapped ? (
              <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                박수 보냄
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === it.id}
                onClick={() => handleClap(it.id, it.userId)}
                className="shrink-0 rounded-pill bg-primary px-3.5 py-1.5 text-[11.5px] font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
              >
                👏 박수
              </button>
            )}
          </div>
        ))}
        <p className="pt-1 text-[10.5px] leading-relaxed text-muted-foreground">
          같은 지점, 최근 30일 통과한 동료만 표시됩니다. 박수는 기존 응원과 같은
          일일 한도를 씁니다.
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
            aria-label="타이틀매치 축하"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-reward/15 text-reward">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">
                    타이틀매치 축하
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    관문을 넘은 동료들
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    레벨 10 · 20 · 30 · 40을 통과하면 자동으로 올라옵니다.
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
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {renderBody()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TitleMatchFeedSheet;
