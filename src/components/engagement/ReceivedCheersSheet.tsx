/**
 * 받은 응원함 — 누가 · 어떤 스티커 · 한마디, 응원마다 '고마워요 153' (2026-10-16 응원 업그레이드)
 *   내정보 '받은 응원' 줄 · 응원 알림(/mypage?cheers=1)에서 열린다.
 *   '고마워요 153'을 누르면 보낸 동료에게 알림이 간다 (thank_cheer).
 * 보낸 응원 칸 (2026-10-28 회원 제안 "응원보내기를 누구한테했는지도 볼수있었으면") — 내가 누구에게 · 언제 · 어떤 스티커와 한마디를
 *   보냈는지, 받은 동료가 고마워요 153을 눌렀는지 (get_my_sent_cheers). 응원 보내기 창 '보낸 응원 보기'에서는 이 칸으로 열린다.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useMyReceivedCheers, useMySentCheers, useThankCheer } from "@/hooks/useSecondCheer";
import { cn } from "@/lib/utils";
import { CHEER_BUMP_ICON, cheerStickerImage } from "@/lib/cheerStickers";

type CheerTab = "received" | "sent";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 처음 보일 칸 — 응원 보내기 창에서 열면 'sent' */
  initialTab?: CheerTab;
  /** 다른 시트(응원 보내기 z-[120]) 위로 띄운다 */
  stacked?: boolean;
}

const StickerThumb = ({ sticker }: { sticker: string }) => {
  const img = cheerStickerImage(sticker);
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center">
      {img ? (
        <img src={img} alt="" className="h-12 w-12 object-contain" loading="lazy" />
      ) : (
        <img src={CHEER_BUMP_ICON} alt="" className="h-10 w-10 object-contain opacity-80" loading="lazy" />
      )}
    </span>
  );
};

const when = (iso: string) => {
  const d = new Date(iso);
  const kst = (x: Date) => x.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  if (kst(d) === kst(new Date())) return `오늘 ${time}`;
  if (kst(d) === kst(new Date(Date.now() - 86_400_000))) return `어제 ${time}`;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
};

const ReceivedCheersSheet = ({ open, onClose, initialTab = "received", stacked = false }: Props) => {
  useModalDismiss(open, onClose);
  const { data, isLoading } = useMyReceivedCheers(open);
  const { data: sent, isLoading: sentLoading } = useMySentCheers(open);
  const thank = useThankCheer();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<CheerTab>(initialTab);

  // 열 때마다 처음 칸으로 (내정보 = 받은 응원 · 응원 보내기 창 = 보낸 응원)
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

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
  const sentItems = sent?.items ?? [];
  const isSent = tab === "sent";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn(
            "fixed inset-0 flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4",
            stacked ? "z-[130]" : "z-[100]",
          )}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isSent ? "보낸 응원" : "받은 응원"}
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              {/* 제목만 — 몇 개인지는 아래 칸 이름에 한 번 (2026-10-28 리디자인) */}
              <div className="flex min-w-0 items-center gap-2.5">
                <img src={CHEER_BUMP_ICON} alt="" className="h-10 w-10 shrink-0 object-contain" />
                <h2 className="text-heading text-foreground">응원함</h2>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 받은 응원 · 보낸 응원 (2026-10-28) */}
            <div role="tablist" aria-label="응원함" className="flex gap-1.5 border-b border-border px-5 pb-3">
              {(
                [
                  ["received", "받은 응원", data?.total ?? 0],
                  ["sent", "보낸 응원", sent?.total ?? 0],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-pill text-body font-bold transition-colors active:scale-[0.98]",
                    tab === key ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  {label}
                  <span className="number-font">{count}</span>
                </button>
              ))}
            </div>

            {isSent ? (
              <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
                {sentLoading && !sent ? (
                  <p className="py-6 text-center text-label text-muted-foreground">불러오는 중…</p>
                ) : sentItems.length === 0 ? (
                  <div className="rounded-card border border-border bg-muted/20 px-4 py-8 text-center">
                    <p className="text-body font-bold text-foreground">아직 보낸 응원이 없어요</p>
                  </div>
                ) : (
                  sentItems.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-card border border-border bg-card px-3 py-3">
                      <StickerThumb sticker={c.sticker} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-label text-muted-foreground">
                          <span className="min-w-0 truncate">
                            <span className="font-bold text-foreground">{c.receiver}</span>님께
                          </span>
                          {c.receiver_staff && (
                            <span className="shrink-0 rounded-pill bg-primary/10 px-1.5 text-micro font-bold text-primary">코치</span>
                          )}
                          <span className="shrink-0">· {when(c.at)}</span>
                        </p>
                        <p className="mt-0.5 text-body font-bold text-foreground">“{c.sticker}”</p>
                        {c.note && <p className="mt-0.5 break-words text-label text-muted-foreground">{c.note}</p>}
                      </div>
                      {c.thanked && (
                        <span className="mt-1 shrink-0 rounded-pill bg-primary/10 px-2.5 py-1.5 text-label font-bold text-primary">
                          고마워요 받음
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {isLoading && !data ? (
                <p className="py-6 text-center text-label text-muted-foreground">불러오는 중…</p>
              ) : items.length === 0 ? (
                <div className="rounded-card border border-border bg-muted/20 px-4 py-8 text-center">
                  <p className="text-body font-bold text-foreground">아직 받은 응원이 없어요</p>
                  <p className="mt-1 text-label text-muted-foreground">먼저 응원을 보내 보세요 · 응원은 돌아와요</p>
                </div>
              ) : (
                items.map((c) => {
                  return (
                    <div key={c.id} className="flex items-start gap-3 rounded-card border border-border bg-card px-3 py-3">
                      <StickerThumb sticker={c.sticker} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-label text-muted-foreground">
                          <span className="truncate font-bold text-foreground">{c.sender}</span>
                          {c.sender_staff && (
                            <span className="shrink-0 rounded-pill bg-primary/10 px-1.5 text-micro font-bold text-primary">코치</span>
                          )}
                          <span className="shrink-0">· {when(c.at)}</span>
                        </p>
                        <p className="mt-0.5 text-body font-bold text-foreground">“{c.sticker}”</p>
                        {c.note && <p className="mt-0.5 break-words text-label text-muted-foreground">{c.note}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={c.thanked || busy === c.id}
                        onClick={() => onThank(c.id, c.sender)}
                        className={cn(
                          "mt-1 min-h-[40px] shrink-0 rounded-pill px-3 text-label font-bold active:scale-95",
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
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReceivedCheersSheet;
