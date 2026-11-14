/**
 * 💬 「회원님 의견」 창 — 코치진 (영상으로 배우기 3단계 · 2026-11-15)
 *   전략 회의 「153 콘텐츠 카드」 맨 위 한 줄 · 알림 링크 ?opinion=<id> 로 연다.
 *   지난 60일 그 지점 회원님 의견 — 답 기다리는 것 먼저 · 카드 이름을 누르면 그 카드 시트 · 그 자리에서 답 남기기
 */
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type { OpinionList } from "@/lib/cardReact";
import { StaffOpinionCard } from "./CardReact";

export default function OpinionsSheet({
  open,
  list,
  demo,
  focusId,
  onClose,
  onOpenCard,
}: {
  open: boolean;
  list: OpinionList | null;
  demo: boolean;
  focusId: string | null;
  onClose: () => void;
  onOpenCard: (item: string) => void;
}) {
  useModalDismiss(open, onClose);
  if (!open || typeof document === "undefined") return null;
  const opinions = list?.opinions ?? [];
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="회원님 의견"
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
        <h3 className="pr-10 text-title font-black text-foreground">회원님 의견</h3>
        <p className="mt-1 text-label text-muted-foreground">
          지난 60일{list?.branch ? ` · ${list.branch}` : ""}
          {demo ? " · 예시" : ""}
        </p>
        {list && list.waiting > 0 && <p className="mt-2 text-body font-bold text-primary">답 기다려요 {list.waiting}</p>}
        {opinions.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">아직 회원님 의견이 없어요</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {opinions.map((o) => (
              <StaffOpinionCard key={o.id} o={o} onOpenCard={onOpenCard} focus={o.id === focusId} />
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
