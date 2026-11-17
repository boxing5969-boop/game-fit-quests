/**
 * 🎬 「이 장면 고쳐 달라기」 창 — 대표님 · 운영진 (2026-11-17 · 복덩이네 가족 앱 편집 요청과 같은 모양)
 *   카드 시트의 영상을 멈춘 시각이 같이 간다 → 무엇을 고칠까요(동작이 달라요 · 이 구간만 · 자막 · 소리 · 그 밖)
 *   → 동작이 달라요면 실제 동작 칩 · 이 구간만이면 여기부터/여기까지 → 한 줄 → 「고칠 때까지 회원에게 숨기기」(동작이 달라요면 켜짐)
 *   보낸 것은 클로드(편집팀)가 읽고 원본에서 다시 만들어 이 카드에 「새 영상」으로 올린다.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { FIX_CATS, FIX_MOTIONS, fixDraftError, fmtSec, parseSecInput, type VideoFixCat } from "@/lib/videoFix";
import { useVideoFixActions } from "@/services/videoFixService";

export default function VideoFixSheet({
  open,
  cardId,
  cardName,
  atSec,
  hasVideo,
  onClose,
}: {
  open: boolean;
  cardId: string;
  cardName: string;
  /** 영상을 멈춘 시각(초) */
  atSec: number;
  /** 카드에 지금 회원용 영상이 있나 — 없으면 숨기기 칸을 그리지 않는다 */
  hasVideo: boolean;
  onClose: () => void;
}) {
  useModalDismiss(open, onClose, { back: true }); // 휴대폰 뒤로가기 = 닫기 (2026-11-17)
  const actions = useVideoFixActions();
  const [cat, setCat] = useState<VideoFixCat>("motion");
  const [motion, setMotion] = useState("");
  const [body, setBody] = useState("");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [hold, setHold] = useState(true);
  const [holdTouched, setHoldTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCat("motion");
    setMotion("");
    setBody("");
    setFromStr(fmtSec(atSec));
    setToStr("");
    setHold(true);
    setHoldTouched(false);
    setBusy(false);
    setErr(null);
  }, [open, atSec]);

  if (!open || typeof document === "undefined") return null;

  const pickCat = (c: VideoFixCat) => {
    setCat(c);
    setErr(null);
    if (!holdTouched) setHold(c === "motion");
  };
  const placeholder = FIX_CATS.find((c) => c.id === cat)?.placeholder ?? "";

  const send = async () => {
    const fromSec = cat === "cut" ? parseSecInput(fromStr) : null;
    const toSec = cat === "cut" ? parseSecInput(toStr) : null;
    const draft = { cat, motion: cat === "motion" ? motion : "", body, atSec, fromSec, toSec };
    const problem = fixDraftError(draft);
    if (problem) {
      setErr(problem);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await actions.add({
        cardId,
        atSec,
        fromSec,
        toSec,
        motion: draft.motion,
        cat,
        body,
        hold: hasVideo && hold,
      });
      toast.success(r.held ? "보냈어요 — 고칠 때까지 회원님께는 숨겨 둘게요" : "보냈어요 — 다시 만들면 이 카드에서 확인해요");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "보내지 못했어요");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="이 장면 고쳐 달라기"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pb-8 pt-5 animate-slide-up"
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
        <h3 className="pr-10 text-title font-black text-foreground">이 장면 고쳐 달라기</h3>
        <p className="mt-1 text-label text-muted-foreground">
          ‘{cardName}’ · {fmtSec(atSec)}에서 멈췄어요
        </p>

        <p className="mt-5 text-body font-bold text-foreground">무엇을 고칠까요</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FIX_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCat(c.id)}
              aria-pressed={cat === c.id}
              className={cn(
                "rounded-full px-3.5 py-2 text-label font-bold active:scale-95",
                cat === c.id ? "bg-foreground text-background" : "border border-border bg-card text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {cat === "motion" && (
          <>
            <p className="mt-5 text-body font-bold text-foreground">실제로는 어떤 동작인가요?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FIX_MOTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotion((cur) => (cur === m ? "" : m))}
                  aria-pressed={motion === m}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-label font-bold active:scale-95",
                    motion === m ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}

        {cat === "cut" && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-label font-bold text-muted-foreground">여기부터</span>
              <input
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                inputMode="numeric"
                placeholder="0:05"
                className="mt-1 h-12 w-full rounded-xl border border-border bg-card px-3 text-body text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-label font-bold text-muted-foreground">여기까지 (비우면 끝까지)</span>
              <input
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                inputMode="numeric"
                placeholder="0:12"
                className="mt-1 h-12 w-full rounded-xl border border-border bg-card px-3 text-body text-foreground"
              />
            </label>
          </div>
        )}

        <label className="mt-5 block">
          <span className="text-body font-bold text-foreground">한 줄로 알려 주세요</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={placeholder}
            className="mt-2 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-body text-foreground"
          />
        </label>

        {hasVideo && (
          <button
            type="button"
            role="switch"
            aria-checked={hold}
            onClick={() => {
              setHold((h) => !h);
              setHoldTouched(true);
            }}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-foreground">고칠 때까지 회원에게 숨기기</span>
              <span className="block text-label text-muted-foreground">회원님은 글과 설명 듣기만 봐요 · 언제든 다시 보이기</span>
            </span>
            <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", hold ? "bg-primary" : "bg-secondary")}>
              <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", hold ? "left-6" : "left-1")} />
            </span>
          </button>
        )}

        {err && <p className="mt-3 text-body font-bold text-destructive">{err}</p>}

        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "보내는 중…" : "편집팀에 보내기"}
        </button>
        <p className="mt-2 text-center text-label text-muted-foreground">클로드가 원본에서 다시 만들어 이 카드에 올려요</p>
      </div>
    </div>,
    document.body,
  );
}
