/**
 * 153운영본부 · PT 수당 2단계 2-4 — 회원 확인 화면 조각 (2026-11-16 대표님 「2-3적용하고 다음작업가자」)
 *   차감이 잡혔는데 PT 기록이 없으면 서버가 회원에게 묻는다(「네, 맞아요」 · 「아니에요」). 여기는 코치 · 관리자 쪽 조각만:
 *     · PtCheckNote — 확인 필요 카드 안의 회원 답 한 줄(+ 지점장 · 대표님에게 [회원님께 답하기])
 *     · PtCheckReplySheet — 「아니에요」에 답하고 닫기(답은 회원 알림으로 · 닫기 전까지 그 수업은 수당 보류)
 *     · PtCheckToggle — 대표님 켜기 · 끄기(켠 뒤에 잡힌 차감만 묻는다)
 *   글 · 상태는 src/lib/opsPtCheck.ts · 읽고 쓰기는 src/services/opsPtCheckService.ts. 회원 화면 띠는 components/pt/PtDeductAskBand.tsx.
 */
import { useEffect, useState } from "react";
import { MessageSquareReply } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  PT_CHECK_REPLY_MAX,
  PT_CHECK_REPLY_PRESETS,
  isOpenDispute,
  ptCheckLine,
  ptReplyError,
  type PtMemberCheck,
} from "@/lib/opsPtCheck";
import type { useOpsPtCheckActions } from "@/services/opsPtCheckService";
import {
  OpsButton,
  OpsChip,
  OpsLabel,
  OpsSheet,
  fmtDay,
  opsInput,
} from "./OpsParts";

type CheckActions = ReturnType<typeof useOpsPtCheckActions>;

const TONE = {
  ok: "text-primary",
  warn: "text-amber-800",
  muted: "text-muted-foreground",
} as const;

/**
 * 확인 필요 카드 안의 회원 답 한 줄 — 열린 「아니에요」는 지점장 · 대표님에게 [회원님께 답하기]
 *   held = 그 차감이 기록과 맞아 수당 줄이 있다(답할 때까지 보류) — 코치에게 그 말을 붙인다
 */
export const PtCheckNote = ({
  c,
  canClose,
  onReply,
  held = false,
}: {
  c: PtMemberCheck;
  canClose: boolean;
  onReply: (c: PtMemberCheck) => void;
  held?: boolean;
}) => {
  const line = ptCheckLine(c);
  const open = isOpenDispute(c);
  return (
    <div className="mt-2 rounded-lg bg-background/70 px-2.5 py-2">
      <p className={cn("text-label font-bold", TONE[line.tone])}>{line.text}</p>
      {open &&
        (canClose ? (
          <button
            type="button"
            onClick={() => onReply(c)}
            className="mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-label font-black text-background active:scale-[0.98]"
          >
            <MessageSquareReply className="h-4 w-4" aria-hidden />
            회원님께 답하기
          </button>
        ) : (
          <p className="mt-0.5 text-label text-muted-foreground">
            {held
              ? "지점장님 · 대표님이 확인하고 답해요 — 그때까지 이 수업 수당은 보류예요"
              : "지점장님 · 대표님이 확인하고 회원님께 답해요"}
          </p>
        ))}
    </div>
  );
};

/** 「아니에요」에 답하고 닫기 — 지점장 · 대표님 */
export const PtCheckReplySheet = ({
  check,
  memberName,
  onClose,
  actions,
}: {
  check: PtMemberCheck | null;
  memberName: string;
  onClose: () => void;
  actions: CheckActions;
}) => {
  const [reply, setReply] = useState("");
  useEffect(() => {
    if (check) setReply("");
  }, [check]);
  const save = () => {
    if (!check) return;
    const err = ptReplyError(reply);
    if (err) {
      toast.error(err);
      return;
    }
    actions.close.mutate(
      { id: check.id, reply },
      {
        onSuccess: () => {
          toast.success("회원님께 답을 보냈어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  return (
    <OpsSheet
      open={!!check}
      onClose={onClose}
      stacked
      title="회원님께 답하기"
      sub="PT 차감 「아니에요」 — 답을 보내면 닫혀요"
      footer={
        <OpsButton onClick={save} disabled={actions.close.isPending}>
          답 보내고 닫기
        </OpsButton>
      }
    >
      {check && (
        <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
          <p className="text-label font-bold text-muted-foreground">
            {fmtDay(check.work_date)} 차감 · {check.used}회
          </p>
          <p className="mt-0.5 text-body font-bold text-foreground">
            {memberName} — 「아니에요」
          </p>
          {check.note && (
            <p className="mt-0.5 text-body text-foreground">“{check.note}”</p>
          )}
        </div>
      )}
      <OpsLabel>자주 쓰는 답</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {PT_CHECK_REPLY_PRESETS.map((p) => (
          <OpsChip key={p} on={reply === p} onClick={() => setReply(p)}>
            {p}
          </OpsChip>
        ))}
      </div>
      <OpsLabel>회원님께 보낼 답</OpsLabel>
      <textarea
        className={cn(opsInput, "min-h-[88px] resize-none")}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={PT_CHECK_REPLY_MAX}
        placeholder="예: 그날 수업이 맞아요 — 수업 기록을 고쳐 두었어요"
        aria-label="회원님께 보낼 답"
      />
      <p className="mt-2 text-label text-muted-foreground">
        기록 · 차감을 고치는 일은 기록 시트 · 브로제이에서 — 여기는 회원님께
        결과만 알려요. 답을 보내면 이 수업의 수당 보류가 풀려요.
      </p>
    </OpsSheet>
  );
};

/** 대표님 켜기 · 끄기 — 켠 뒤에 잡힌 차감만 묻는다(다시 켜도 그때부터) */
export const PtCheckToggle = ({
  on,
  actions,
}: {
  on: boolean;
  actions: CheckActions;
}) => {
  const toggle = () =>
    actions.setOn.mutate(!on, {
      onSuccess: () =>
        toast.success(
          !on
            ? "회원 확인을 켰어요 — 이제부터 잡힌 차감을 물어요"
            : "회원 확인을 껐어요 — 받은 답은 남아 있어요",
        ),
      onError: (e) => toast.error((e as Error).message),
    });
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-black text-foreground">
          회원 확인 {on ? "켜짐" : "꺼짐"}
        </p>
        <p className="mt-0.5 text-label text-muted-foreground">
          {on
            ? "기록 없는 차감은 여섯 시간 뒤 회원님께 「받으신 수업이 맞나요?」를 물어요(10:55 ~ 20:55)"
            : "켜면 기록 없는 차감을 회원님께 물어요 — 「아니에요」는 지점장님 · 대표님께 가요"}
        </p>
      </div>
      <button
        type="button"
        disabled={actions.setOn.isPending}
        onClick={toggle}
        className={cn(
          "h-10 shrink-0 rounded-xl px-3 text-label font-black active:scale-[0.98] disabled:opacity-50",
          on
            ? "border border-border bg-background text-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {on ? "끄기" : "켜기"}
      </button>
    </div>
  );
};
