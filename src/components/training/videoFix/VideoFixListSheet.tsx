/**
 * 🎬 「영상 고치기」 목록 창 — 대표님 · 운영진 (2026-11-17 · 영상으로 배우기 머리 🎬 단추)
 *   새 영상 확인(클로드가 다시 만든 영상) → 고쳐 달라고 한 것(보냈어요 · 고치는 중) → 다 고친 것(답)
 *   줄을 누르면 그 카드 시트 — 거기서 보고 붙이거나 또 고쳐 달라고 한다.
 */
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { FIX_STATE_LABEL, fixLine, type VideoFixData } from "@/lib/videoFix";

const Row = ({ title, sub, tag, onClick }: { title: string; sub: string; tag?: string; onClick: () => void }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-foreground">{title}</span>
        <span className="block truncate text-label text-muted-foreground">{sub}</span>
      </span>
      {tag && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">{tag}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  </li>
);

export default function VideoFixListSheet({
  open,
  data,
  onClose,
  onOpenCard,
}: {
  open: boolean;
  data: VideoFixData | null;
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  useModalDismiss(open, onClose, { back: true }); // 휴대폰 뒤로가기 = 닫기 (2026-11-17)
  if (!open || typeof document === "undefined") return null;
  const review = (data?.candidates ?? []).filter((c) => c.state === "review");
  const openFixes = (data?.fixes ?? []).filter((f) => f.state === "requested" || f.state === "doing");
  const done = (data?.fixes ?? []).filter((f) => f.state === "done" || f.state === "skip").slice(0, 20);
  const empty = !review.length && !openFixes.length && !done.length;
  const go = (cardId: string) => {
    onClose();
    onOpenCard(cardId);
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="영상 고치기"
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pb-8 pt-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="pr-10 text-title font-black text-foreground">영상 고치기</h3>
        <p className="mt-1 text-label text-muted-foreground">카드 영상을 보다가 「이 장면 고쳐 달라기」 — 클로드가 다시 만들어 올려요</p>

        {empty && (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">아직 고쳐 달라고 한 영상이 없어요</p>
        )}

        {review.length > 0 && (
          <>
            <p className="mt-5 text-body font-black text-primary">새 영상 확인 {review.length}</p>
            <ul className="mt-2 space-y-2">
              {review.map((c) => (
                <Row key={c.id} title={c.cardName} sub={c.note || "다시 만든 영상이에요 — 보고 붙여 주세요"} onClick={() => go(c.cardId)} />
              ))}
            </ul>
          </>
        )}

        {openFixes.length > 0 && (
          <>
            <p className="mt-5 text-body font-black text-foreground">고쳐 달라고 한 것 {openFixes.length}</p>
            <ul className="mt-2 space-y-2">
              {openFixes.map((f) => (
                <Row
                  key={f.id}
                  title={`${f.cardName}${f.held ? " · 회원에게 숨김" : ""}`}
                  sub={fixLine(f)}
                  tag={FIX_STATE_LABEL[f.state]}
                  onClick={() => go(f.cardId)}
                />
              ))}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <>
            <p className="mt-5 text-body font-black text-foreground">다 고친 것</p>
            <ul className="mt-2 space-y-2">
              {done.map((f) => (
                <Row key={f.id} title={f.cardName} sub={f.reply || fixLine(f)} tag={FIX_STATE_LABEL[f.state]} onClick={() => go(f.cardId)} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
