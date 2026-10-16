/**
 * 받은 응원함 — 누가 · 어떤 스티커 · 한마디, 응원마다 '고마워요 153' (2026-10-16 응원 업그레이드)
 *   내정보 '받은 응원' 줄 · 응원 알림(/mypage?cheers=1)에서 열린다.
 *   '고마워요 153'을 누르면 보낸 동료에게 알림이 간다 (thank_cheer).
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useMyReceivedCheers, useThankCheer } from "@/hooks/useSecondCheer";
import { cn } from "@/lib/utils";
import { CHEER_BUMP_ICON, cheerStickerImage } from "@/lib/cheerStickers";

interface Props {
  open: boolean;
  onClose: () => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const kst = (x: Date) => x.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  if (kst(d) === kst(new Date())) return `오늘 ${time}`;
  if (kst(d) === kst(new Date(Date.now() - 86_400_000))) return `어제 ${time}`;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
};

const ReceivedCheersSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);
  const { data, isLoading } = useMyReceivedCheers(open);
  const thank = useThankCheer();
  const [busy, setBusy] = useState<string | null>(null);

  const onThank = async (id: string, sender: string) => {
    setBusy(id);
    try {
      await thank.mutateAsync(id);
      toast.success(`${sender}님께 고마워요 153을 보냈어요`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "보내지 못했어요");
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items ?? [];

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
            aria-label="받은 응원"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pb-3 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <img src={CHEER_BUMP_ICON} alt="" className="h-12 w-12 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">받은 응원</p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    동료들이 보낸 응원 <span className="number-font text-primary">{data?.total ?? 0}</span>개
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">고마워요 153을 누르면 보낸 동료에게 알림이 가요</p>
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

            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {isLoading && !data ? (
                <p className="py-6 text-center text-[12px] text-muted-foreground">불러오는 중…</p>
              ) : items.length === 0 ? (
                <div className="rounded-card border border-border bg-muted/20 px-4 py-8 text-center">
                  <p className="text-[13px] font-bold text-foreground">아직 받은 응원이 없어요</p>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    먼저 동료에게 응원을 보내 보세요. 응원은 돌아와요.
                  </p>
                </div>
              ) : (
                items.map((c) => {
                  const img = cheerStickerImage(c.sticker);
                  return (
                    <div key={c.id} className="flex items-start gap-3 rounded-card border border-border bg-card px-3 py-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                        {img ? (
                          <img src={img} alt="" className="h-12 w-12 object-contain" loading="lazy" />
                        ) : (
                          <img src={CHEER_BUMP_ICON} alt="" className="h-10 w-10 object-contain opacity-80" loading="lazy" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <span className="truncate font-bold text-foreground">{c.sender}</span>
                          {c.sender_staff && (
                            <span className="shrink-0 rounded-pill bg-primary/10 px-1.5 text-[10px] font-bold text-primary">코치</span>
                          )}
                          <span className="shrink-0">· {when(c.at)}</span>
                        </p>
                        <p className="mt-0.5 text-[14px] font-black text-foreground">“{c.sticker}”</p>
                        {c.note && <p className="mt-0.5 break-words text-[12.5px] text-muted-foreground">{c.note}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={c.thanked || busy === c.id}
                        onClick={() => onThank(c.id, c.sender)}
                        className={cn(
                          "mt-1 shrink-0 rounded-pill px-2.5 py-1.5 text-[11px] font-bold active:scale-95",
                          c.thanked ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground",
                        )}
                      >
                        {c.thanked ? "답장함" : "고마워요 153"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReceivedCheersSheet;
