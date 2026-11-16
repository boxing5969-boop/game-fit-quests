/**
 * 🥊 홈 「PT 수업」 카드의 「PT 차감 안내」 띠 — PT 수당 2단계 2-4 회원 확인 (2026-11-16 대표님 「2-3적용하고 다음작업가자」)
 *   브로제이에서 PT 가 차감됐는데 PT 기록이 없으면 서버가 묻는다(알림 「PT 차감 안내」 → /home?ptcheck=1).
 *     · [아니에요] → 한 줄 메모(선택) → 지점장 · 대표님께 간다 → 「지점에서 확인하고 있어요」 → 답이 오면 사흘 동안 그 답
 *     · [네, 맞아요] → 코치님께 전하고 띠가 사라진다
 *   글 · 상태는 src/lib/opsPtCheck.ts. 회원 화면에는 '노쇼'를 쓰지 않는다 — '미참석'.
 */
import { useState } from "react";
import { toast } from "sonner";

import {
  PT_ASK_HINT,
  PT_ASK_NOTE_MAX,
  PT_ASK_RULE,
  ptAskDay,
  ptAskLine,
  ptAskNoteError,
  type PtCheckAnswer,
  type PtDeductAsk,
} from "@/lib/opsPtCheck";
import { usePtDeductAnswer } from "@/services/opsPtCheckService";
import { cn } from "@/lib/utils";

const PtDeductAskBand = ({
  asks,
  className,
}: {
  asks: PtDeductAsk[];
  className?: string;
}) => {
  const answer = usePtDeductAnswer();
  const [noFor, setNoFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (asks.length === 0) return null;

  const send = (a: PtDeductAsk, v: PtCheckAnswer) => {
    if (answer.isPending) return;
    const err = v === "no" ? ptAskNoteError(note) : null;
    if (err) {
      toast.error(err);
      return;
    }
    answer.mutate(
      { id: a.id, answer: v, note: v === "no" ? note : null },
      {
        onSuccess: () => {
          toast.success(
            v === "yes"
              ? "알려 주셔서 고마워요 — 코치님께 전했어요"
              : "지점에 전했어요 — 확인하고 알려 드릴게요",
          );
          setNoFor(null);
          setNote("");
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "답을 보내지 못했어요"),
      },
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {asks.map((a) =>
        a.state === "ask" ? (
          <div
            key={a.id}
            className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-400/30 dark:bg-amber-400/10"
          >
            <p className="text-label font-bold text-amber-800 dark:text-amber-200">
              PT 차감 안내
            </p>
            <p className="mt-0.5 text-body font-bold text-foreground">
              {ptAskLine(a)}
            </p>
            <p className="mt-1 text-label text-muted-foreground">
              {PT_ASK_HINT}
            </p>
            {noFor === a.id ? (
              <div className="mt-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={PT_ASK_NOTE_MAX}
                  rows={2}
                  placeholder="어떤 점이 다른지 한 줄 남겨 주시면 더 빨리 확인해요 (선택)"
                  aria-label="PT 차감 — 다른 점 한 줄"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNoFor(null);
                      setNote("");
                    }}
                    disabled={answer.isPending}
                    className="h-12 rounded-xl border border-border bg-background text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => send(a, "no")}
                    disabled={answer.isPending}
                    className="h-12 rounded-xl bg-foreground text-body font-black text-background active:scale-[0.98] disabled:opacity-60"
                  >
                    {answer.isPending ? "보내는 중…" : "지점에 알리기"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNoFor(a.id);
                    setNote("");
                  }}
                  disabled={answer.isPending}
                  className="h-12 rounded-xl border border-border bg-background text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
                >
                  아니에요
                </button>
                <button
                  type="button"
                  onClick={() => send(a, "yes")}
                  disabled={answer.isPending}
                  className="h-12 rounded-xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-60"
                >
                  네, 맞아요
                </button>
              </div>
            )}
            <p className="mt-2 text-micro text-muted-foreground">
              {PT_ASK_RULE}
            </p>
          </div>
        ) : (
          <div key={a.id} className="rounded-xl bg-secondary/60 px-4 py-3">
            <p className="text-label font-bold text-muted-foreground">
              PT 차감 확인 · {ptAskDay(a.work_date)}
              {a.state === "closed" ? " · 지점 답" : ""}
            </p>
            <p className="mt-0.5 text-body text-foreground">{ptAskLine(a)}</p>
          </div>
        ),
      )}
    </div>
  );
};

export default PtDeductAskBand;
