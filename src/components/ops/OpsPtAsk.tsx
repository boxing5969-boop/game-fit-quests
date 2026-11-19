/**
 * 153운영본부 · PT 기록 「코치에게 물어보기」 화면 조각 (2026-11-19 대표님 「앱안에서 재우코치님에게 바로 이야기하는 기능」)
 *
 *   PtAskNote    — 관리자: 확인 필요 카드 안 — [코치에게 물어보기] · 「물어봤어요 — 답을 기다려요」 · 코치 답 한 줄
 *   PtAskSheet   — 관리자: 묻는 것 한 줄 + 한마디(선택) → 보내기(그 코치 알림)
 *   PtAskInbox   — 코치: 「오늘 PT」 맨 위 「대표님 · 지점장님이 물어봤어요」 → [답하기](자주 쓰는 답 칩 + 한 줄)
 *   글 · 짝 찾기는 src/lib/opsPtAsk.ts, 서버는 src/services/opsPtAskService.ts. 기록 · 차감을 고치는 일은 기존 기록 시트가 한다.
 */
import { useEffect, useState } from "react";
import { MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  PT_ASK_ANSWER_MAX,
  PT_ASK_ANSWER_PRESETS,
  PT_ASK_NOTE_MAX,
  ptAskAnswerError,
  ptAskLine,
  ptAskNoteError,
  ptAskPayload,
  ptAskQuestion,
  type PtAsk,
  type PtAskTarget,
} from "@/lib/opsPtAsk";
import type { useOpsPtAskActions } from "@/services/opsPtAskService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

type AskActions = ReturnType<typeof useOpsPtAskActions>;

export interface PtAskInit {
  target: PtAskTarget;
  coachId: string;
  coachName?: string | null;
}

// ───────────────────────── 관리자 — 카드 안 한 줄 ─────────────────────────
export const PtAskNote = ({ ask, onAsk }: { ask: PtAsk | null; onAsk: () => void }) => {
  if (!ask) {
    return (
      <button type="button" onClick={onAsk} className="mt-2 flex items-center gap-1 text-label font-bold text-foreground underline underline-offset-2">
        <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden /> 코치에게 물어보기
      </button>
    );
  }
  const line = ptAskLine(ask);
  return (
    <div className="mt-2 rounded-lg bg-background/70 px-2.5 py-2">
      <p className={cn("text-label font-bold", line.tone === "ok" ? "text-primary" : "text-amber-800")}>{line.text}</p>
      {ask.status === "answered" && (
        <button type="button" onClick={onAsk} className="mt-1 text-label font-bold text-muted-foreground underline underline-offset-2">
          다시 물어보기
        </button>
      )}
    </div>
  );
};

// ───────────────────────── 관리자 — 물어보기 ─────────────────────────
export const PtAskSheet = ({
  init,
  onClose,
  branch,
  actions,
}: {
  init: PtAskInit | null;
  onClose: () => void;
  branch: string;
  actions: AskActions;
}) => {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (init) setNote("");
  }, [init]);
  const send = () => {
    if (!init) return;
    const err = ptAskNoteError(init.target.item, note);
    if (err) {
      toast.error(err);
      return;
    }
    actions.send.mutate(ptAskPayload(branch, init.coachId, init.target, note), {
      onSuccess: (r) => {
        toast.success(r.dup ? "이미 물어본 건이에요 — 답을 기다리고 있어요" : "코치님께 보냈어요 — 답이 오면 알림이 와요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };
  return (
    <OpsSheet
      open={!!init}
      onClose={onClose}
      stacked
      title="코치에게 물어보기"
      sub={init?.coachName ? `${init.coachName} 코치님께 알림으로 가요` : "담당 코치님께 알림으로 가요"}
      footer={
        <OpsButton onClick={send} disabled={actions.send.isPending}>
          <Send className="h-4 w-4" /> 보내기
        </OpsButton>
      }
    >
      {init && (
        <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
          <p className="text-label font-bold text-muted-foreground">물어보는 것</p>
          <p className="mt-0.5 text-body font-bold text-foreground">{ptAskQuestion(init.target)}</p>
        </div>
      )}
      <OpsLabel>한마디 (선택)</OpsLabel>
      <textarea
        className={cn(opsInput, "min-h-[88px] resize-none")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={PT_ASK_NOTE_MAX}
        placeholder="예: 차감을 했는지도 같이 알려 주세요"
        aria-label="코치님께 한마디"
      />
      <p className="mt-2 text-label text-muted-foreground">코치님이 「오늘 PT」 맨 위에서 답하면 이 카드에 답이 달려요.</p>
    </OpsSheet>
  );
};

// ───────────────────────── 코치 — 받은 질문 ─────────────────────────
const AnswerSheet = ({ ask, onClose, actions }: { ask: PtAsk | null; onClose: () => void; actions: AskActions }) => {
  const [answer, setAnswer] = useState("");
  useEffect(() => {
    if (ask) setAnswer("");
  }, [ask]);
  const save = () => {
    if (!ask) return;
    const err = ptAskAnswerError(answer);
    if (err) {
      toast.error(err);
      return;
    }
    actions.answer.mutate(
      { id: ask.id, answer },
      {
        onSuccess: () => {
          toast.success("답을 보냈어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  return (
    <OpsSheet
      open={!!ask}
      onClose={onClose}
      stacked
      title="답하기"
      sub={ask ? `${ask.asker_name ?? "운영진"}님이 물어봤어요` : undefined}
      footer={
        <OpsButton onClick={save} disabled={actions.answer.isPending}>
          <Send className="h-4 w-4" /> 답 보내기
        </OpsButton>
      }
    >
      {ask && (
        <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
          <p className="text-body font-bold text-foreground">{ptAskQuestion(ask)}</p>
          {ask.note && <p className="mt-0.5 text-body text-foreground">“{ask.note}”</p>}
        </div>
      )}
      <OpsLabel>자주 쓰는 답</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {(ask ? PT_ASK_ANSWER_PRESETS[ask.item] : []).map((p) => (
          <OpsChip key={p} on={answer === p} onClick={() => setAnswer(p)}>
            {p}
          </OpsChip>
        ))}
      </div>
      <OpsLabel>답</OpsLabel>
      <textarea
        className={cn(opsInput, "min-h-[88px] resize-none")}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        maxLength={PT_ASK_ANSWER_MAX}
        placeholder="예: PT 수업이었어요 — 브로제이 차감할게요"
        aria-label="답"
      />
      <p className="mt-2 text-label text-muted-foreground">답만 보내요 — 기록 · 브로제이 차감은 아래 「오늘 PT」에서 따로 해 주세요.</p>
    </OpsSheet>
  );
};

/** 코치 화면 「오늘 PT」 맨 위 — 아직 답하지 않은 질문. focusId = 알림(`&ask=<id>`)으로 온 질문은 답하기 창이 바로 열린다 */
export const PtAskInbox = ({ asks, actions, focusId }: { asks: PtAsk[]; actions: AskActions; focusId?: string | null }) => {
  const [open, setOpen] = useState<PtAsk | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (focused || !focusId) return;
    const hit = asks.find((a) => a.id === focusId);
    if (hit) {
      setFocused(true);
      setOpen(hit);
    }
  }, [asks, focusId, focused]);
  if (asks.length === 0) return <AnswerSheet ask={open} onClose={() => setOpen(null)} actions={actions} />;
  return (
    <>
      <OpsLabel>물어본 것 {asks.length}</OpsLabel>
      <ul className="mb-3 space-y-2">
        {asks.map((a) => (
          <li key={a.id} className="rounded-xl bg-primary/10 p-3">
            <p className="text-label font-bold text-primary">{a.asker_name ?? "운영진"}님이 물어봤어요</p>
            <p className="mt-0.5 text-body font-bold text-foreground">{ptAskQuestion(a)}</p>
            {a.note && <p className="text-body text-foreground">“{a.note}”</p>}
            <button
              type="button"
              onClick={() => setOpen(a)}
              className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-label font-black text-background active:scale-[0.98]"
            >
              답하기
            </button>
          </li>
        ))}
      </ul>
      <AnswerSheet ask={open} onClose={() => setOpen(null)} actions={actions} />
    </>
  );
};
