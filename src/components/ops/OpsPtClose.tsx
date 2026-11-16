/**
 * 153운영본부 · PT 수당 2단계 2-2 — 월 마감 화면 조각
 *   (2026-11-16 대표님 「추천대로 진행하고 2-2진행하자」 · 셈 src/lib/opsPtClose.ts · DB 20261116155618_ops_pt_close.sql)
 *
 *   달이 끝나면 코치가 그 달 줄을 보고 「확정」 → 대표님 · 회계매니저가 「승인」하면 그 달 수당이 잠긴다.
 *   닫은 뒤 달라진 것은 다음에 닫는 달에 「보정」(+) · 「정산」(−) 줄로 들어간다 — 정산은 코치가 본 채로 확정(동의)한 줄만 뺀다.
 *
 *   usePtCloseBook  한 지점의 마감 장부(기록 넉 달 + 마감 줄 + 수당표) — 서버에 마감 함수가 없으면 null(2-1 화면 그대로)
 *   PtCloseCard     근무자 카드 'PT' 탭 · 코치 화면 'PT' 카드의 한 달 명세(OpsPtPay 가 「기록 + 차감」 지급 달에 그린다)
 *   PtCloseSheet    한 코치 · 한 달의 명세 시트 — 코치 [확정] · 대표님/회계매니저 [승인하고 마감] · 대표님 [승인 취소]
 *   PtCloseDueCard  코치 화면 맨 위 — 확정할 달이 있을 때 · 막 나온 명세서(지급일까지)
 *   2-3 PT 명세서(2026-11-16): 승인한 달의 시트는 명세서 종이(OpsPtStatementDoc) + [PDF 저장 · 보내기] · 돈을 보는 분은 [세무 자료 복사].
 *     줄 목록은 「날짜순 · 회원별」로 바꿔 볼 수 있다(코치가 회원별 날짜 · 합계를 보고 확정).
 *   금액은 수당표를 받은 화면만(대표님 · 회계매니저 · 그 코치 본인) — 지점장은 횟수와 상태만.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtWon } from "@/lib/opsWork";
import type { OpsPtRate } from "@/lib/opsPt";
import {
  ptCloseBook,
  ptCloseConfirmSummary,
  ptCloseSnapshot,
  ptPayDate,
  ptStatementChip,
  ptStatementGroups,
  ptStatementStatusText,
  ptStatementTaxText,
  ptTicketText,
  type PtCloseBook,
  type PtCloseData,
  type PtCloseHold,
  type PtCloseLine,
  type PtSettleLine,
  type PtStatement,
} from "@/lib/opsPtClose";
import { PT_PAY_STATE_LABEL, ptPayDiffNotes, type PtPayLine, type PtPayLineState } from "@/lib/opsPtPay";
import { PT_KIND_LABEL, PT_NO_ENTRY_MONTH_LIMIT, matchPtRecord, mdOf, type PtKind } from "@/lib/opsPtRecord";
import { useOpsPtCloseActions, useOpsPtCloses, useOpsPtStatementHead } from "@/services/opsPtCloseService";
import { useOpsPtRecord } from "@/services/opsPtRecordService";
import { OpsButton, OpsChip, OpsSheet, opsInput } from "./OpsParts";
import OpsPtStatementDoc, { PtStatementPdfButton } from "./OpsPtStatementDoc";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** "11/11(수)" */
const mdw = (date: string) => `${mdOf(date)}(${WD[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;
const nextMonthYm = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const kindLabel = (k: string) => PT_KIND_LABEL[k as PtKind] ?? k;
const sumRate = (list: Array<{ rate: number | null }>) => list.reduce((n, l) => n + (l.rate ?? 0), 0);
const holdLabel = (state: string, n?: number) =>
  state === "extra" ? `기록 없는 차감${n && n > 1 ? ` ${n}회` : ""}` : (PT_PAY_STATE_LABEL[state as PtPayLineState] ?? "보류");

// ───────────────────────── 장부 ─────────────────────────
export interface PtCloseCtx {
  cd: PtCloseData;
  book: PtCloseBook;
  /** 근무자 카드 → 코치 이름(명세서의 「받는 분」) */
  names: Record<string, string>;
}

/**
 * 한 지점의 마감 장부 — PT 기록을 켠 지점이고 서버에 마감 함수가 있을 때만(없으면 null · 2-1 화면 그대로).
 *   rates: 수당표 — 금액을 못 보는 화면은 null(횟수만).
 */
export const usePtCloseBook = (
  branch: string | null,
  rates: OpsPtRate[] | null,
  { enabled = true, demo = false, manage = false }: { enabled?: boolean; demo?: boolean; manage?: boolean } = {},
): PtCloseCtx | null => {
  const recQ = useOpsPtRecord(branch, { enabled, demo, demoManage: manage });
  const closeQ = useOpsPtCloses(branch, { enabled: enabled && !!recQ.data?.on, demo });
  const data = recQ.data;
  const cd = closeQ.data;
  return useMemo(() => {
    if (!data?.on || !cd?.available || !cd.on) return null;
    return {
      cd,
      names: Object.fromEntries((data.coaches ?? []).map((c) => [c.id, c.name])),
      book: ptCloseBook(data, matchPtRecord(data), cd, rates, {
        // 예시는 이번 달부터 지급 기준인 것처럼
        firstYm: cd.sample ? cd.first_month?.slice(0, 7) : undefined,
        // 코치 본인 화면(예시의 관리자 화면은 아님) — 정산 줄을 확정하면 뺄 것으로 셈한다
        viewerCoach: manage && cd.sample ? null : cd.me_staff,
      }),
    };
  }, [data, cd, rates, manage]);
};

// ───────────────────────── 줄 ─────────────────────────
const CloseRow = ({
  l,
  money,
  locked = false,
  mine = false,
  ended = true,
}: {
  l: PtCloseLine | PtSettleLine;
  money: boolean;
  locked?: boolean;
  /** 보는 사람이 그 코치 본인 */
  mine?: boolean;
  /** 달이 끝났다 — 진행 중인 달은 이 달 수당이 아직 다 안 찼으니 「다음 달로」라고 하지 않는다 */
  ended?: boolean;
}) => {
  const settle = l.t === "settle";
  // 열린 달의 정산 줄만 — 까닭 · 동의 상태(잠긴 달은 승인본 그대로)
  const s = settle && !locked && "why" in l ? l : null;
  const sub = [
    kindLabel(l.kind),
    l.t === "carry" ? "지난달 수업" : "",
    l.t === "adj" && l.from ? `${monthLabel(l.from)} 수업` : "",
    settle && l.from ? `${monthLabel(l.from)} 지급` : "",
    !settle && l.deduct ? `차감 ${mdOf(l.deduct)}` : "",
    s ? (s.why === "gone" ? "기록이 지워짐" : "지급 대상에서 빠짐") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-foreground">
          {mdw(l.date)} · {l.name}
        </p>
        <p className="text-label text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        {money ? (
          <p className={cn("text-body font-black tabular-nums", settle ? "text-destructive" : "text-foreground")}>
            {l.rate == null ? "금액 없음" : `${settle ? "−" : ""}${fmtWon(l.rate)}`}
          </p>
        ) : (
          <p className={cn("text-label font-bold", settle ? "text-destructive" : "text-primary")}>{settle ? "정산" : l.t === "adj" ? "보정" : "지급 대상"}</p>
        )}
        {s && (
          <p className="text-micro font-bold text-amber-700">
            {s.included
              ? s.agreed
                ? "이 달에서 빼요"
                : "확정하면 빼요"
              : !ended
                ? mine
                  ? "확정하면 빼요"
                  : "코치 동의 전"
                : s.agreed || mine
                  ? "다음 달로 넘겨요"
                  : "코치 동의 전"}
          </p>
        )}
      </div>
    </li>
  );
};

const HoldRow = ({ l }: { l: PtPayLine }) => (
  <li className="flex items-center gap-3 px-4 py-2.5">
    <div className="min-w-0 flex-1">
      <p className="truncate text-body font-bold text-foreground">
        {mdw(l.date)} · {l.name}
      </p>
      <p className="text-label text-muted-foreground">
        {[kindLabel(l.kind), l.auto ? "자동 기록" : "", l.noEntry ? "출석 없음" : "", l.deductDate ? `차감 ${mdOf(l.deductDate)}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
    <p className="shrink-0 text-label font-bold text-amber-700">{PT_PAY_STATE_LABEL[l.state]}</p>
  </li>
);

const SavedHoldRow = ({ h }: { h: PtCloseHold }) => (
  <li className="flex items-center gap-3 px-4 py-2.5">
    <p className="min-w-0 flex-1 truncate text-body text-foreground">
      {mdw(h.date)} · {h.name}
    </p>
    <p className="shrink-0 text-label font-bold text-amber-700">{holdLabel(h.state, h.n)}</p>
  </li>
);

const listBox = "mt-1.5 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border";
const head = "mt-4 text-label font-bold text-muted-foreground first:mt-0";

/** 한 달 명세의 줄 — 이 달 수업 · 보정 · 정산 · 보류 */
const PtCloseLines = ({ st, money, mine = false }: { st: PtStatement; money: boolean; mine?: boolean }) => {
  // 이 달 수업을 회원별로 묶어 보기 — 코치가 회원마다 날짜 · 합계를 보고 확정한다(명세서와 같은 묶음)
  const [byMember, setByMember] = useState(false);
  const groups = useMemo(() => (byMember ? ptStatementGroups(st.pay) : []), [byMember, st.pay]);
  const savedHolds = st.locked ? (st.close?.holds ?? []) : [];
  const none = st.pay.length + st.adj.length + st.settle.length + st.holdLines.length + st.extras.length + savedHolds.length === 0;
  if (none) return <p className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">이 달 수업 기록이 없어요</p>;
  return (
    <div>
      {st.pay.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-label font-bold text-muted-foreground">이 달 수업 {st.pay.length}회</p>
            {st.pay.length > 1 && (
              <div className="flex gap-1.5">
                <OpsChip on={!byMember} onClick={() => setByMember(false)}>
                  날짜순
                </OpsChip>
                <OpsChip on={byMember} onClick={() => setByMember(true)}>
                  회원별
                </OpsChip>
              </div>
            )}
          </div>
          {byMember ? (
            <ul className={listBox}>
              {groups.map((g) => (
                <li key={g.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-bold text-foreground">
                      {g.name}
                      {g.ticket ? <span className="ml-1.5 text-label font-normal text-muted-foreground">{ptTicketText(g.ticket)}</span> : null}
                    </p>
                    <p className="text-label text-muted-foreground">
                      {g.items.map((i) => `${mdOf(i.date)}${i.kind === "lesson" ? "" : `(${kindLabel(i.kind)})`}`).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-body font-black tabular-nums text-foreground">{money && g.amount != null ? fmtWon(g.amount) : `${g.uses}회`}</p>
                    {money && g.amount != null && <p className="text-micro tabular-nums text-muted-foreground">{g.uses}회</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={listBox}>
              {st.pay.map((l) => (
                <CloseRow key={l.k} l={l} money={money} />
              ))}
            </ul>
          )}
        </>
      )}
      {st.adj.length > 0 && (
        <>
          <p className={head}>보정 +{st.adj.length}회 · 닫은 달에서 뒤늦게 지급 대상이 된 수업</p>
          <ul className={listBox}>
            {st.adj.map((l) => (
              <CloseRow key={l.k} l={l} money={money} />
            ))}
          </ul>
        </>
      )}
      {st.settle.length > 0 && (
        <>
          <p className={head}>정산 −{st.settle.length}회 · 지급한 뒤 없던 일이 된 수업</p>
          <ul className={listBox}>
            {st.settle.map((l) => (
              <CloseRow key={l.k} l={l} money={money} locked={st.locked} mine={mine} ended={st.monthEnded} />
            ))}
          </ul>
        </>
      )}
      {(st.holdLines.length > 0 || st.extras.length > 0) && (
        <>
          <p className={head}>보류 {st.hold}회 · 이 달에 넣지 않아요</p>
          {st.holdLines.length > 0 && (
            <ul className={listBox}>
              {st.holdLines.map((l) => (
                <HoldRow key={l.id} l={l} />
              ))}
            </ul>
          )}
          {st.extras.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
              {st.extras.map((x) => (
                <li key={x.eventId} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-label text-amber-800">
                    {mdw(x.workDate)} 차감 · {x.name} · {x.count}회
                  </span>
                  <span className="shrink-0 text-label font-bold text-amber-800">기록 없음</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {savedHolds.length > 0 && (
        <>
          <p className={head}>승인할 때 보류 {st.hold}회 · 풀린 것은 다음 달 「보정」으로</p>
          <ul className={listBox}>
            {savedHolds.map((h, i) => (
              <SavedHoldRow key={h.k ?? `${h.date}-${h.name}-${i}`} h={h} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const noteBox = "mt-2 rounded-xl px-3 py-2 text-label";
const Note = ({ children, warn = false }: { children: ReactNode; warn?: boolean }) => (
  <p className={cn(noteBox, warn ? "bg-amber-50 font-bold text-amber-800" : "bg-secondary/60 text-muted-foreground")}>{children}</p>
);

const MoneyRow = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className={cn("text-label", strong ? "font-black text-foreground" : "text-muted-foreground")}>{label}</span>
    <span className={cn("tabular-nums text-foreground", strong ? "text-heading font-black" : "text-body font-bold")}>{value}</span>
  </div>
);

/** 누가 무엇을 누를 수 있나 — 관리자 화면(manage)과 코치 화면이 다르다 */
const rolesOf = (cd: PtCloseData, coachId: string, manage: boolean) => ({
  // 예시의 관리자 화면에는 코치 단추를 그리지 않는다
  canConfirm: cd.me_staff === coachId && !(manage && cd.sample),
  canApprove: manage && !!cd.can_approve,
  canReopen: manage && !!cd.can_reopen,
});

/** 코치가 확정해야 하는가 — 달이 끝났고, 아직 확정 전이거나 확정한 뒤 줄이 달라졌다 */
const needsConfirm = (st: PtStatement) => !st.locked && !st.confirmBlock && (st.status !== "confirmed" || st.changedSinceConfirm);

// ───────────────────────── 시트 ─────────────────────────
interface SheetProps {
  open: boolean;
  onClose: () => void;
  branch: string;
  coachId: string;
  /** 관리자 화면 — 코치 이름 */
  coachName?: string;
  st: PtStatement | null;
  cd: PtCloseData;
  manage?: boolean;
  demo?: boolean;
}

export const PtCloseSheet = ({ open, onClose, branch, coachId, coachName, st, cd, manage = false, demo = false }: SheetProps) => {
  const act = useOpsPtCloseActions(branch, { demo });
  // 2-3 — 승인한 달은 명세서 종이로 보여 준다(금액을 보는 화면만). 「지급하는 곳」은 서버에서(없으면 지점 이름만)
  const paper = !!st?.locked && st.gross != null;
  const headQ = useOpsPtStatementHead(branch, { enabled: open && paper, demo });
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!open) {
      setReopening(false);
      setReason("");
    }
  }, [open]);

  const shown = open && !!st;
  const title = st ? (manage ? `${coachName ?? "코치"} · ${monthLabel(st.ym)} PT 수당` : `${monthLabel(st.ym)} 내 PT 수당`) : "PT 수당";
  if (!st) {
    return (
      <OpsSheet open={false} onClose={onClose} title={title} stacked>
        {null}
      </OpsSheet>
    );
  }

  const { canConfirm, canApprove, canReopen } = rolesOf(cd, coachId, manage);
  const money = st.gross != null;
  const month = `${st.ym}-01`;
  const confirmed = st.status === "confirmed";
  const included = st.settle.filter((s) => s.included);
  const notAgreed = st.settle.filter((s) => !s.agreed).length;
  const carried = st.settle.filter((s) => s.agreed && !s.included).length;
  const laterApproved = (cd.closes ?? []).some((c) => c.coach_staff_id === coachId && c.status === "approved" && c.month.slice(0, 7) > st.ym);
  const busy = act.confirm.isPending || act.approve.isPending || act.reopen.isPending;
  const fail = (e: unknown) => toast.error((e as Error).message);

  const doConfirm = () =>
    act.confirm.mutate(
      { coachId, month, summary: ptCloseConfirmSummary(st) },
      {
        onSuccess: () => {
          toast.success(`${monthLabel(st.ym)} 수당을 확정했어요 — 승인되면 알려 드려요`);
          onClose();
        },
        onError: fail,
      },
    );
  const doApprove = () =>
    act.approve.mutate(
      { coachId, month, snapshot: ptCloseSnapshot(st) },
      {
        onSuccess: () => {
          toast.success(`${monthLabel(st.ym)} 수당을 승인했어요 — 이 달은 잠겼어요`);
          onClose();
        },
        onError: fail,
      },
    );
  const doReopen = () => {
    if (!st.close) return;
    if (reason.trim().length < 2) {
      toast.error("취소하는 이유를 적어 주세요");
      return;
    }
    act.reopen.mutate(
      { id: st.close.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("승인을 취소했어요 — 다시 승인할 수 있어요");
          onClose();
        },
        onError: fail,
      },
    );
  };

  const employer = headQ.data?.employer ?? null;
  const copyTax = async () => {
    const text = ptStatementTaxText({ branch, coachName, st });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("세무 자료를 복사했어요 — 카톡 · 문자에 붙여 넣어 보내세요");
    } catch {
      toast.error("복사하지 못했어요");
    }
  };

  const showConfirm = canConfirm && needsConfirm(st);
  const showApprove = canApprove && !st.locked && st.monthEnded;
  const footer =
    reopening && st.locked ? (
      <div className="space-y-2">
        <OpsButton tone="danger" onClick={doReopen} disabled={busy}>
          승인 취소하기
        </OpsButton>
        <OpsButton tone="plain" onClick={() => setReopening(false)} disabled={busy}>
          그만두기
        </OpsButton>
      </div>
    ) : paper ? (
      <div className="space-y-2">
        <PtStatementPdfButton branch={branch} coachName={coachName} st={st} employer={employer} />
        {canApprove && (
          <OpsButton tone="plain" onClick={() => void copyTax()}>
            세무 자료 복사
          </OpsButton>
        )}
      </div>
    ) : showConfirm || showApprove ? (
      <div className="space-y-2">
        {showApprove && st.approveBlock && <p className="text-center text-label font-bold text-amber-700">{st.approveBlock}</p>}
        {showConfirm && (
          <OpsButton onClick={doConfirm} disabled={busy}>
            {confirmed ? "바뀐 줄로 다시 확정하기" : `${monthLabel(st.ym)} 수당 확정하기`}
          </OpsButton>
        )}
        {showApprove && (
          <OpsButton tone="dark" onClick={doApprove} disabled={busy || !!st.approveBlock}>
            승인하고 마감
          </OpsButton>
        )}
      </div>
    ) : undefined;

  return (
    <OpsSheet open={shown} onClose={onClose} title={title} sub={ptStatementStatusText(st)} stacked footer={footer}>
      {cd.sample && <Note>예시 — 달이 끝난 다음 날인 것처럼 보여 줘요. 눌러도 이 기기 안에서만 바뀌어요.</Note>}

      {paper ? (
        <>
          {/* 승인한 달 — 명세서 한 장(승인본 그대로) */}
          <Note>
            {monthLabel(st.ym)} 수당은 잠겼어요 — 아래가 명세서예요. 지급 예정일은 {Number(ptPayDate(st.ym).slice(5, 7))}월{" "}
            {Number(ptPayDate(st.ym).slice(8, 10))}일이에요.
          </Note>
          {st.after && st.after.adj + st.after.settle > 0 && (
            <Note warn>
              마감 뒤 달라진 것 —{st.after.adj > 0 ? ` 보정 +${st.after.adj}회` : ""}
              {st.after.adj > 0 && st.after.settle > 0 ? " ·" : ""}
              {st.after.settle > 0 ? ` 정산 −${st.after.settle}회` : ""}. 다음에 닫는 달 명세서에 들어가요.
            </Note>
          )}
          <div className="mt-3">
            <OpsPtStatementDoc branch={branch} coachName={coachName} st={st} employer={employer} />
          </div>
        </>
      ) : (
        <>
          {/* 금액 */}
          <div className="rounded-2xl border border-border p-4">
            {money ? (
              <>
                <MoneyRow label={`이 달 수업 ${st.pay.length}회`} value={fmtWon(sumRate(st.pay))} />
                {st.adj.length > 0 && <MoneyRow label={`보정 ${st.adj.length}회`} value={`+${fmtWon(sumRate(st.adj))}`} />}
                {included.length > 0 && <MoneyRow label={`정산 ${included.length}회`} value={`−${fmtWon(sumRate(included))}`} />}
                <div className="my-2 border-t border-border/70" />
                <MoneyRow label="합계 (3.3% 전)" value={fmtWon(st.gross ?? 0)} />
                {st.tax && (
                  <>
                    <MoneyRow label="소득세 3%" value={`−${fmtWon(st.tax.income)}`} />
                    <MoneyRow label="지방소득세 0.3%" value={`−${fmtWon(st.tax.local)}`} />
                  </>
                )}
                <div className="my-2 border-t border-border/70" />
                <MoneyRow label="3.3% 뗀 금액" value={fmtWon(st.net ?? 0)} strong />
              </>
            ) : (
              <>
                <p className="text-title font-black tabular-nums text-foreground">{st.uses}회</p>
                <p className="text-label text-muted-foreground">
                  이 달 수업 {st.pay.length}회{st.adj.length > 0 ? ` · 보정 +${st.adj.length}회` : ""}
                  {included.length > 0 ? ` · 정산 −${included.length}회` : ""}
                </p>
              </>
            )}
          </div>

          {/* 상태 · 알아 둘 것 */}
          {st.locked ? (
            <Note>이 달 수당은 잠겼어요 — 승인한 줄 그대로예요. 뒤에 달라지는 것은 다음에 닫는 달에 「보정」 · 「정산」 줄로 들어가요.</Note>
          ) : !st.monthEnded ? (
            <Note>달이 끝나면 코치 확정(3일까지) → 대표님 승인(4일) 순서로 마감해요. 지금 숫자는 그때까지 바뀔 수 있어요.</Note>
          ) : confirmed ? (
            <Note>{canConfirm ? "확정했어요 — 승인을 기다려요." : "코치가 확정했어요 — 줄을 살펴보고 승인해 주세요."}</Note>
          ) : canConfirm ? (
            <Note>줄을 살펴보고 맞으면 확정해 주세요. 확정하면 대표님이 승인하고, 그 달 수당이 잠겨요.</Note>
          ) : (
            <Note>코치 확정 전이에요{canApprove ? " — 기다리거나, 급하면 바로 승인할 수 있어요(지금 줄로 잠겨요)." : "."}</Note>
          )}
          {st.close?.reopen_reason && !st.locked && <Note warn>승인이 취소된 달이에요 — {st.close.reopen_reason}</Note>}
          {confirmed && st.changedSinceConfirm && (
            <Note warn>
              {canConfirm ? "확정한 뒤 줄이 달라졌어요 — 살펴보고 다시 확정해 주세요." : "코치가 확정한 뒤 줄이 달라졌어요 — 승인하면 지금 줄로 잠겨요."}
            </Note>
          )}
          {st.after && st.after.adj + st.after.settle > 0 && (
            <Note warn>
              마감 뒤 달라진 것 —{st.after.adj > 0 ? ` 보정 +${st.after.adj}회` : ""}
              {st.after.adj > 0 && st.after.settle > 0 ? " ·" : ""}
              {st.after.settle > 0 ? ` 정산 −${st.after.settle}회` : ""}. 다음에 닫는 달에 들어가요.
            </Note>
          )}
          {!st.locked && st.settle.length > 0 && (
            <Note warn>
              {canConfirm
                ? `정산 ${st.settle.length}회 — 지급받은 뒤 없던 일이 된 수업이에요. 확정하면 이 줄을 빼는 데 동의하는 거예요. 다르면 확정하지 말고 지점장님께 말씀해 주세요.`
                : `정산 ${st.settle.length}회 — 코치가 줄을 본 채로 확정(동의)한 것만 빼요.${notAgreed > 0 ? ` ${notAgreed}회는 동의 전이라 이번에 빼지 않아요.` : ""}${carried > 0 ? ` ${carried}회는 이 달 수당보다 커서 다음 달로 넘겨요.` : ""}`}
            </Note>
          )}
          {!st.locked && st.hold > 0 && (
            <Note warn>
              보류 {st.hold}회 — {st.holdText}. 이 달에 넣지 않아요
              {st.monthEnded ? " — 승인 뒤에 풀리면 다음 달 「보정」으로 들어가요" : " — 풀리면 지급 대상이 돼요"}.
            </Note>
          )}
          {!st.locked && st.already > 0 && <Note>이미 지급한 수업 {st.already}회는 이 달에 넣지 않았어요.</Note>}
          {!st.locked && money && st.unpriced > 0 && (
            <Note warn>
              수당표에 없는 수업권 {st.unpriced}회 — {manage ? "금액을 먼저 정해 주세요" : "대표님이 금액을 정하면 더해져요"}
            </Note>
          )}

          <div className="mt-4">
            <PtCloseLines st={st} money={money} mine={canConfirm} />
          </div>
        </>
      )}

      {/* 승인 취소 — 대표님만 · 뒤 달이 승인되기 전에만 */}
      {st.locked && canReopen && !laterApproved && (
        <div className="mt-5 border-t border-border/70 pt-4">
          {reopening ? (
            <>
              <p className="mb-1.5 text-label font-bold text-muted-foreground">취소하는 이유 (코치님께 그대로 알려요)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="예) 12/28 수업 한 줄이 잘못 들어갔어요"
                className={opsInput}
              />
              <p className="mt-1.5 text-label text-muted-foreground">취소하면 이 달이 다시 열려요 — 고친 뒤 다시 승인해 주세요.</p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setReopening(true)}
              className="text-label font-bold text-destructive underline underline-offset-2 active:opacity-70"
            >
              승인 취소
            </button>
          )}
        </div>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 한 달 명세 카드 ─────────────────────────
interface CardProps {
  branch: string;
  coachId: string;
  coachName?: string;
  /** 보는 달 (YYYY-MM-01) */
  month: string;
  st: PtStatement;
  ctx: PtCloseCtx;
  manage?: boolean;
  demo?: boolean;
}

const chipTone = { ok: "bg-primary/10 text-primary", warn: "bg-amber-100 text-amber-800", muted: "bg-secondary text-muted-foreground" } as const;

export const PtCloseCard = ({ branch, coachId, coachName, month, st, ctx, manage = false, demo = false }: CardProps) => {
  const { cd, book } = ctx;
  const [open, setOpen] = useState(false);
  // 닫히는 동안에도 그 달 명세를 쥐고 있는다(시트가 빈 채로 내려가지 않게)
  const [sheet, setSheet] = useState<{ month: string; open: boolean } | null>(null);
  const sheetMonth = sheet?.month ?? null;
  const openSheet = (m: string) => setSheet({ month: m, open: true });
  // 맨 위 한 줄 — 마감할 차례인 달(보는 달이 아니면), 없으면 지난달 승인본
  const other = useMemo(() => {
    if (st.monthEnded) return null;
    const due = book.due(coachId);
    const target = due && due !== month ? due : null;
    const prev = (() => {
      const y = Number(month.slice(0, 4));
      const m = Number(month.slice(5, 7));
      return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    })();
    const pick = target ?? (prev.slice(0, 7) >= book.startYm(coachId) ? prev : null);
    if (!pick) return null;
    const s = book.statement(coachId, pick);
    return s && (s.locked || s.monthEnded) ? { month: pick, st: s } : null;
  }, [book, coachId, month, st.monthEnded]);
  const sheetSt = useMemo(
    () => (sheetMonth ? (sheetMonth === month ? st : book.statement(coachId, sheetMonth)) : null),
    [book, coachId, month, sheetMonth, st],
  );

  const { canConfirm, canApprove } = rolesOf(cd, coachId, manage);
  const money = st.gross != null;
  const chip = ptStatementChip(st);
  const included = st.settle.filter((s) => s.included).length;
  const carryN = st.pay.filter((l) => l.t === "carry").length;
  const lineCount = st.pay.length + st.adj.length + st.settle.length + st.holdLines.length;
  const savedHolds = st.locked ? (st.close?.holds?.length ?? 0) : 0;
  const empty = lineCount + st.extras.length + savedHolds === 0;
  const notes = st.locked ? [] : ptPayDiffNotes(st.base);
  const showDeduct = !st.locked && (st.base.byDeduct.uses > 0 || notes.length > 0);
  const action = st.locked
    ? { text: money ? "명세서 보기" : "마감 내용 보기", tone: "plain" as const }
    : !st.monthEnded
      ? null
      : canConfirm && needsConfirm(st)
        ? { text: st.status === "confirmed" ? "바뀐 줄 보고 다시 확정하기" : `${monthLabel(st.ym)} 수당 확정하기`, tone: "primary" as const }
        : canApprove
          ? { text: "살펴보고 승인하기", tone: "dark" as const }
          : { text: "마감 내용 보기", tone: "plain" as const };

  return (
    <div className="mb-4 rounded-2xl border border-border p-4">
      {other && (
        <button
          type="button"
          onClick={() => openSheet(other.month)}
          className={cn(
            "mb-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left active:scale-[0.99]",
            other.st.locked ? "bg-secondary/60" : "bg-amber-50",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate text-label font-bold", other.st.locked ? "text-foreground" : "text-amber-800")}>
            {monthLabel(other.st.ym)} 수당 · {ptStatementStatusText(other.st)}
            {other.st.gross != null ? ` · ${fmtWon(other.st.gross)}` : ` · ${other.st.uses}회`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <p className="text-label text-muted-foreground">
          {monthLabel(st.ym)} {manage ? "PT 수당" : "내 PT 수당"} · 기록 + 차감
        </p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", chipTone[chip.tone])}>{chip.text}</span>
      </div>
      <p className="mt-1 text-title font-black tabular-nums text-foreground">{money ? fmtWon(st.gross ?? 0) : `${st.uses}회`}</p>
      <p className="text-label text-muted-foreground">
        {money
          ? `${st.locked ? "지급" : "지급 대상"} ${st.uses}회 · 3.3% 떼면 ${fmtWon(st.net ?? 0)}`
          : st.locked
            ? "승인한 수업"
            : "지급 대상 — 기록과 차감이 맞은 수업"}
      </p>
      {(st.adj.length > 0 || included > 0) && (
        <p className="text-label text-muted-foreground">
          이 달 수업 {st.pay.length}회{st.adj.length > 0 ? ` · 보정 +${st.adj.length}회` : ""}
          {included > 0 ? ` · 정산 −${included}회` : ""}
        </p>
      )}

      {cd.sample && <Note>예시 — 달이 끝난 다음 날인 것처럼 보여 줘요. 확정 · 승인을 눌러 볼 수 있어요.</Note>}
      {st.locked ? (
        <Note>{ptStatementStatusText(st)} — 이 달 수당은 잠겼어요. 뒤에 달라지는 것은 다음에 닫는 달에 들어가요.</Note>
      ) : !st.monthEnded ? (
        <Note>달이 끝나면 코치 확정(3일까지) → 대표님 승인(4일) 순서로 마감해요.</Note>
      ) : st.status === "confirmed" ? (
        <Note>
          {ptStatementStatusText(st)}
          {canApprove ? " — 살펴보고 승인해 주세요." : ""}
        </Note>
      ) : (
        <Note warn>{canConfirm ? "달이 끝났어요 — 줄을 살펴보고 확정해 주세요." : "코치 확정 전이에요."}</Note>
      )}
      {st.status === "confirmed" && st.changedSinceConfirm && <Note warn>확정한 뒤 줄이 달라졌어요{canConfirm ? " — 다시 확정해 주세요" : ""}</Note>}
      {st.after && st.after.adj + st.after.settle > 0 && (
        <Note warn>
          마감 뒤 달라진 것 —{st.after.adj > 0 ? ` 보정 +${st.after.adj}회` : ""}
          {st.after.adj > 0 && st.after.settle > 0 ? " ·" : ""}
          {st.after.settle > 0 ? ` 정산 −${st.after.settle}회` : ""}. 다음에 닫는 달에 들어가요.
        </Note>
      )}
      {!st.locked && carryN > 0 && <Note>지난달 수업 {carryN}회가 들어 있어요 — 차감이 이 달에 잡혀 이 달에 지급해요</Note>}
      {!st.locked && st.already > 0 && <Note>이미 지급한 수업 {st.already}회는 이 달에 넣지 않았어요</Note>}
      {!st.locked && money && st.unpriced > 0 && (
        <Note warn>
          수당표에 없는 수업권 {st.unpriced}회 — {manage ? "금액을 정해 주세요" : "대표님이 금액을 정하면 더해져요"}
        </Note>
      )}
      {!st.locked && st.settle.length > 0 && <Note warn>정산 {st.settle.length}회 — 지급한 뒤 없던 일이 된 수업이에요. 코치가 확정(동의)한 것만 빼요</Note>}
      {!st.locked && st.hold > 0 && (
        <Note warn>
          보류 {st.hold}회 — {st.holdText}. {st.monthEnded ? "승인 뒤에 풀리면 다음 달 「보정」으로 들어가요" : "풀리면 지급 대상이 돼요"}
        </Note>
      )}
      {!st.locked && st.base.noEntryOver && (
        <Note warn>
          출석 체크 없는 수업 {st.base.noEntry}회 — 한 달 {PT_NO_ENTRY_MONTH_LIMIT}회를 넘었어요
        </Note>
      )}

      {showDeduct && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="text-label font-bold text-foreground">
            차감 기준으로 셈하면 {st.base.byDeduct.uses}회{money && st.base.byDeduct.gross != null ? ` · ${fmtWon(st.base.byDeduct.gross)}` : ""}
          </p>
          {notes.length === 0 ? (
            <p className="mt-0.5 text-label text-muted-foreground">
              {st.base.byDeduct.uses === st.base.paidUses ? "두 기준이 같아요" : "남은 차이는 위 보류 때문이에요"}
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {notes.map((n) => (
                <li key={n} className="text-label text-muted-foreground">
                  · {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {action && (
        <div className="mt-3">
          <OpsButton tone={action.tone} onClick={() => openSheet(month)}>
            {action.text}
          </OpsButton>
        </div>
      )}

      {empty ? (
        <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">이 달 수업 기록이 아직 없어요</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-label font-black text-foreground active:scale-[0.98]"
          >
            {open ? "수업 줄 접기" : `수업 ${lineCount + savedHolds}줄 보기`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-3">
              <PtCloseLines st={st} money={money} mine={canConfirm} />
              <p className="mt-2 text-label text-muted-foreground">
                {st.locked
                  ? "승인한 줄 그대로예요 — 닫은 달은 다시 셈하지 않아요."
                  : "수업한 날의 달에 들어요 — 차감이 다음 달에 잡혀도 수업한 달 몫이에요. 보류는 위 「확인 필요」에서 풀 수 있어요."}
                {!st.locked && st.base.hold.check > 0
                  ? manage
                    ? " 「수업권 끝남」은 아래 「확인할 것」에서 확인해 주세요."
                    : " 「수업권 끝남」은 지점장 확인을 기다려요."
                  : ""}
              </p>
            </div>
          )}
        </>
      )}

      <PtCloseSheet
        open={!!sheet?.open}
        onClose={() => setSheet((v) => (v ? { ...v, open: false } : v))}
        branch={branch}
        coachId={coachId}
        coachName={coachName ?? ctx.names[coachId]}
        st={sheetSt}
        cd={cd}
        manage={manage}
        demo={demo}
      />
    </div>
  );
};

// ───────────────────────── 코치 화면 맨 위 — 확정할 달 · 막 나온 명세서 ─────────────────────────
export const PtCloseDueCard = ({ branch, coachId, ctx, demo = false }: { branch: string; coachId: string; ctx: PtCloseCtx; demo?: boolean }) => {
  const { cd, book } = ctx;
  // 닫히는 동안에도 그 달 명세를 쥐고 있는다
  const [sheet, setSheet] = useState<{ month: string; open: boolean } | null>(null);
  const due = book.due(coachId);
  const dueSt = useMemo(() => (due ? book.statement(coachId, due) : null), [book, coachId, due]);
  // 바로 지난달이 승인됐고 지급일(10일) 전 — 명세서가 나왔다고 알려 준다(2-3)
  const fresh = book.fresh(coachId);
  const freshSt = useMemo(() => (fresh ? book.statement(coachId, fresh) : null), [book, coachId, fresh]);
  const sheetSt = useMemo(() => (sheet ? book.statement(coachId, sheet.month) : null), [book, coachId, sheet]);
  if (cd.me_staff !== coachId) return null;
  const need = !!dueSt && needsConfirm(dueSt) && dueSt.uses + dueSt.hold + dueSt.settle.length > 0;
  // 바로 지난달이고 아직 3일 전이면 기한을 붙인다(코치 확정 3일 → 승인 4일)
  const soon = !!dueSt && book.today.slice(0, 7) === nextMonthYm(dueSt.ym) && Number(book.today.slice(8, 10)) <= 3;
  const pay = freshSt?.locked ? ptPayDate(freshSt.ym) : null;
  if (!need && !pay && !sheet) return null;
  return (
    <>
      {need && dueSt && due && (
        <button
          type="button"
          onClick={() => setSheet({ month: due, open: true })}
          className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-primary-foreground shadow-elev-1 active:scale-[0.99]"
        >
          <ReceiptText className="h-7 w-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-black">
              {monthLabel(dueSt.ym)} PT 수당{dueSt.status === "confirmed" ? " — 다시 확정해 주세요" : "을 확정해 주세요"}
            </p>
            <p className="truncate text-label opacity-90">
              {dueSt.status === "confirmed"
                ? "확정한 뒤 줄이 달라졌어요"
                : `지급 대상 ${dueSt.uses}회${dueSt.gross != null ? ` · ${fmtWon(dueSt.gross)}` : ""}${soon ? " · 3일까지" : ""}`}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
      )}
      {!need && pay && freshSt && fresh && (
        <button
          type="button"
          onClick={() => setSheet({ month: fresh, open: true })}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left active:scale-[0.99]"
        >
          <ReceiptText className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-black text-foreground">{monthLabel(freshSt.ym)} PT 수당 명세서가 나왔어요</p>
            <p className="truncate text-label text-muted-foreground">
              {freshSt.net != null ? `실지급 ${fmtWon(freshSt.net)} · ` : ""}
              {Number(pay.slice(5, 7))}/{Number(pay.slice(8, 10))} 지급 예정
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}
      <PtCloseSheet
        open={!!sheet?.open}
        onClose={() => setSheet((v) => (v ? { ...v, open: false } : v))}
        branch={branch}
        coachId={coachId}
        coachName={ctx.names[coachId]}
        st={sheetSt}
        cd={cd}
        demo={demo}
      />
    </>
  );
};
