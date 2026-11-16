/**
 * 153운영본부 · PT 수당 2단계 2-2 — 월 마감 (2026-11-16 대표님 「추천대로 진행하고 2-2진행하자」
 *   · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「월 마감과 명세서」 · DB 20261116155618_ops_pt_close.sql)
 *
 *   달이 끝나면 코치가 그 달 줄을 보고 「확정」(3일) → 대표님 · 회계매니저가 「승인」(4일)하면 그 달이 잠긴다.
 *   잠긴 달은 다시 셈하지 않는다 — 승인한 줄(서버 ops_pt_closes.lines)이 그 달 수당이다.
 *   닫은 뒤 달라진 것은 닫은 달을 고치지 않고, 다음에 닫는 달에 줄로 얹는다:
 *     · 「보정」(adj) — 닫은 달의 수업이 뒤늦게 지급 대상이 됨(차감이 늦게 잡힘 · 늦은 기록 확인 · 사유 넣음)
 *     · 「정산」(settle) — 지급한 수업이 없던 일이 됨(기록을 지움 · 차감을 뺌). 코치가 그 줄을 본 채로 확정(동의)해야 뺀다.
 *   줄마다 열쇠 = 수업 기록 id:몇 번째 회(opsPtPay.ts PtPayLine.id). 승인한 달들의 줄을 모으면 「이 수업에 나갔나」가 나온다
 *   — 같은 수업은 두 번 넣지 않는다(서버도 다시 본다).
 *   짝짓기 · 줄 만들기는 opsPtPay.ts — 이 파일은 닫은 달의 줄과 견줘 한 달의 「명세」를 만든다. 서버는 잠그고 지킨다.
 */
import { withholding33, type OpsPtEvent, type OpsPtRate } from "./opsPt";
import { ptPayFirstRecordMonth, ptPayHoldText, ptPayLinesAll, ptPayMonth, ptPayMonthCovered, type PtPayLine, type PtPayMonth } from "./opsPtPay";
import { addDays, type PtExtra, type PtMatchResult, type PtRecordData } from "./opsPtRecord";

/** line 그 달 수업 · carry 지난달 수업(전환 달 경계) · adj 보정(+) · settle 정산(−) */
export type PtCloseLineType = "line" | "carry" | "adj" | "settle";

export interface PtCloseLine {
  /** 수업 기록 id:몇 번째 회 */
  k: string;
  sid: string;
  i: number;
  t: PtCloseLineType;
  /** 1회 수당 — 금액을 못 보는 화면(지점장)은 null */
  rate: number | null;
  date: string;
  name: string;
  kind: string;
  ticket?: string | null;
  /** 짝지은 차감이 잡힌 날 */
  deduct?: string | null;
  /** 보정 · 정산: 그 수업이 든 달(YYYY-MM) */
  from?: string | null;
}

/** 승인할 때 남아 있던 보류 줄(참고) */
export interface PtCloseHold {
  k?: string;
  date: string;
  name: string;
  state: string;
  n?: number;
}

/** 코치가 확정할 때 본 것 */
export interface PtCloseConfirm {
  uses: number;
  hold: number;
  gross?: number | null;
  keys: string[];
  /** 본 정산 줄 = 빼는 데 동의한 줄 */
  settle: string[];
}

/** open 승인을 취소했고 코치 확정이 없음 · confirmed 코치 확정 · approved 승인(잠금) */
export type PtCloseStatus = "open" | "confirmed" | "approved";

export interface PtClose {
  id: string;
  coach_staff_id: string;
  /** YYYY-MM-01 */
  month: string;
  status: PtCloseStatus;
  confirmed_at: string | null;
  approved_at: string | null;
  uses: number | null;
  settle_uses: number | null;
  hold: number | null;
  gross: number | null;
  tax_income: number | null;
  tax_local: number | null;
  net: number | null;
  lines: PtCloseLine[] | null;
  holds: PtCloseHold[] | null;
  confirm: PtCloseConfirm | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}

export interface PtCloseData {
  branch: string;
  on: boolean;
  /** 서버에 마감 함수가 있는가 — 없으면(DB 적용 전 · 옛 DB 미리보기) 마감 화면을 그리지 않는다 */
  available: boolean;
  first_month?: string;
  today?: string;
  manage: boolean;
  /** 금액을 보는가(대표님 · 회계매니저) */
  pay: boolean;
  can_approve?: boolean;
  /** 승인 취소(대표님만) */
  can_reopen?: boolean;
  me_staff: string | null;
  /** 코치마다 마감을 시작하는 달(YYYY-MM-01) */
  coaches?: Array<{ id: string; start: string }>;
  closes?: PtClose[];
  /** 예시 자료 */
  sample?: boolean;
}

export interface PtSettleLine extends PtCloseLine {
  /** 코치가 이 줄을 본 채로 확정했다 */
  agreed: boolean;
  /** 이 달에서 뺀다(동의했고 이 달 수당 안에 든다) — 코치 본인 화면은 확정하면 뺄 줄도 */
  included: boolean;
  /** gone 기록이 지워짐(또는 다른 코치로) · unpaid 기록은 있지만 지급 대상이 아니게 됨(차감이 빠짐 등) */
  why: "gone" | "unpaid";
}

export interface PtStatement {
  ym: string;
  /** none = 아직 아무도 누르지 않음 */
  status: PtCloseStatus | "none";
  close: PtClose | null;
  /** 승인됨 — 아래 숫자는 승인본 */
  locked: boolean;
  monthEnded: boolean;
  /** 이 달을 마감할 차례(그 코치의 시작 달부터 앞 달이 모두 승인됨) */
  turn: boolean;
  /** 먼저 승인해야 하는 앞 달(YYYY-MM) */
  prevOpenYm: string | null;
  /** 이 달 수업 · 지난달 수업(전환 달 경계) */
  pay: PtCloseLine[];
  /** 보정(+) */
  adj: PtCloseLine[];
  /** 정산(−) */
  settle: PtSettleLine[];
  /** 이미 지급한 수업이라 이 달에 넣지 않은 줄 */
  already: number;
  /** 이 달 보류 줄 — 잠긴 달은 빈 배열(close.holds 를 본다) */
  holdLines: PtPayLine[];
  /** 보류(회) — 기록 없는 차감 포함 */
  hold: number;
  holdText: string;
  extras: PtExtra[];
  /** 지급 줄 수(pay + adj) */
  uses: number;
  unpriced: number;
  /** 3.3% 전 = 지급 − 정산(이 달에 빼는 것만). 금액을 못 보면 null */
  gross: number | null;
  net: number | null;
  tax: { income: number; local: number } | null;
  /** 잠긴 뒤 달라진 것 — 다음에 닫는 달의 보정 · 정산으로 간다 */
  after: { adj: number; settle: number } | null;
  /** 코치가 확정한 뒤 줄이 달라졌다 */
  changedSinceConfirm: boolean;
  /** 못 누르는 까닭(없으면 null) */
  confirmBlock: string | null;
  approveBlock: string | null;
  /** 2-1 한 달 셈(차감 기준 견줌 · 보류 낱수) */
  base: PtPayMonth;
}

export interface PtStatementInput {
  res: PtMatchResult;
  events: OpsPtEvent[];
  rates: OpsPtRate[] | null;
  /** 보는 달 (YYYY-MM-01) */
  month: string;
  coachId: string;
  monthEvents?: OpsPtEvent[];
  /** 그 지점의 마감 줄(다른 코치 것이 섞여도 된다) */
  closes: PtClose[];
  /** 그 코치가 마감을 시작하는 달(YYYY-MM-01 — 서버 coaches[].start) */
  start?: string | null;
  /** 받은 기록 창의 시작(ops_pt_record.from) — 창이 잘렸으면 창 맨 앞 수업은 정산을 따지지 않는다 */
  from?: string | null;
  today: string;
  /** 예시 화면 — 「기록 + 차감」 첫 달을 억지로(YYYY-MM) */
  firstYm?: string;
  /**
   * 보는 사람이 그 코치 본인 — 정산 줄을 「확정하면 뺄 것」으로 셈한다(확정 = 그 줄에 동의).
   *   코치가 확정하며 보는 합계가 승인될 합계와 같아야 한다. 대표님 · 회계매니저 화면은 실제로 동의한 줄만 뺀다.
   */
  assumeAgree?: boolean;
}

const ymOf = (d: string) => d.slice(0, 7);
const nextYm = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const monthNo = (ym: string) => Number(ym.slice(5, 7));
const sum = (list: Array<{ rate: number | null }>) => list.reduce((n, l) => n + (l.rate ?? 0), 0);

const toCloseLine = (l: PtPayLine, t: PtCloseLineType, from?: string): PtCloseLine => ({
  k: l.id,
  sid: l.sessionId,
  i: Number(l.id.slice(l.id.lastIndexOf(":") + 1)),
  t,
  rate: l.rate,
  date: l.date,
  name: l.name,
  kind: l.kind,
  ticket: l.ticket,
  deduct: l.deductDate,
  ...(from ? { from } : {}),
});

/** 그 코치가 마감을 시작하는 달(YYYY-MM) — 지점의 「기록 + 차감」 첫 달과 코치 카드가 생긴 달 가운데 늦은 쪽 */
export const ptCloseStartYm = (firstYm: string, start?: string | null) => (start && ymOf(start) > firstYm ? ymOf(start) : firstYm);

/** 마감할 차례인 달(YYYY-MM) — 시작 달부터, 끝난 달 가운데 아직 승인되지 않은 가장 이른 달. 없으면 null */
export const ptCloseDueYm = (closes: PtClose[], coachId: string, startYm: string, today: string): string | null => {
  const approved = new Set(closes.filter((c) => c.coach_staff_id === coachId && c.status === "approved").map((c) => ymOf(c.month)));
  for (let m = startYm; m < ymOf(today); m = nextYm(m)) if (!approved.has(m)) return m;
  return null;
};

/** 승인한 달들의 줄을 모은다 — 줄마다 지급한 횟수(정산은 뺀다) · 금액 · 마지막으로 지급한 달 */
export const ptCloseLedger = (closes: PtClose[], coachId: string) => {
  const out = new Map<string, { n: number; amount: number; ym: string; line: PtCloseLine }>();
  const approved = closes.filter((c) => c.coach_staff_id === coachId && c.status === "approved").sort((a, b) => a.month.localeCompare(b.month));
  for (const c of approved) {
    for (const l of c.lines ?? []) {
      const cur = out.get(l.k) ?? { n: 0, amount: 0, ym: ymOf(c.month), line: l };
      if (l.t === "settle") {
        cur.n -= 1;
        cur.amount -= l.rate ?? 0;
      } else {
        cur.n += 1;
        cur.amount += l.rate ?? 0;
        cur.ym = ymOf(c.month);
        cur.line = l;
      }
      out.set(l.k, cur);
    }
  }
  return out;
};

/** 한 코치의 한 달 「명세」 — 열린 달은 지금 자료로 셈하고, 잠긴 달은 승인본을 그대로 보여 준다 */
export const ptStatement = (inp: PtStatementInput): PtStatement => {
  const { res, events, rates, month, coachId, closes, today } = inp;
  const ym = ymOf(month);
  const first = inp.firstYm ?? ptPayFirstRecordMonth(res.startedOn);
  const startYm = ptCloseStartYm(first, inp.start);
  const base = ptPayMonth(res, events, rates, month, coachId, inp.monthEvents, first);
  const all = ptPayLinesAll(res, events, rates, coachId, first);
  const mine = closes.filter((c) => c.coach_staff_id === coachId);
  const approvedYm = new Set(mine.filter((c) => c.status === "approved").map((c) => ymOf(c.month)));
  const close = mine.find((c) => ymOf(c.month) === ym) ?? null;
  const locked = close?.status === "approved";
  const monthEnded = ymOf(today) > ym;
  const ledger = ptCloseLedger(closes, coachId);
  const isPaid = (k: string) => (ledger.get(k)?.n ?? 0) > 0;
  const eligible = new Set(all.filter((l) => l.state === "paid").map((l) => l.id));
  const inData = new Set(all.map((l) => l.id));
  // 서버가 창을 잘랐으면(넉 달 넘게 씀) 창 맨 앞 수업은 짝이 창 밖에 있을 수 있다 — 정산을 따지지 않는다
  const clipped = inp.from && inp.from > addDays(res.startedOn, -14) ? inp.from : null;
  const evaluable = (date: string) => !clipped || date >= addDays(clipped, 3);

  // 차례 — 그 코치의 시작 달부터 이 달 앞까지 모두 승인됐는가
  let prevOpenYm: string | null = null;
  for (let m = startYm; m < ym; m = nextYm(m)) {
    if (!approvedYm.has(m)) {
      prevOpenYm = m;
      break;
    }
  }
  const turn = ym >= startYm && prevOpenYm == null;

  let pay: PtCloseLine[] = [];
  let adj: PtCloseLine[] = [];
  let settle: PtSettleLine[] = [];
  let already = 0;
  let holdLines: PtPayLine[] = [];
  let hold = base.hold.total;
  let holdText = ptPayHoldText(base.hold);
  let gross: number | null = null;
  let tax: PtStatement["tax"] = null;
  let net: number | null = null;
  let uses = 0;
  let unpriced = 0;
  let after: PtStatement["after"] = null;

  if (locked && close) {
    const lines = close.lines ?? [];
    pay = lines.filter((l) => l.t === "line" || l.t === "carry");
    adj = lines.filter((l) => l.t === "adj");
    settle = lines.filter((l) => l.t === "settle").map((l) => ({ ...l, agreed: true, included: true, why: "gone" as const }));
    uses = close.uses ?? pay.length + adj.length;
    gross = close.gross;
    net = close.net;
    tax = close.tax_income != null && close.tax_local != null ? { income: close.tax_income, local: close.tax_local } : null;
    hold = close.hold ?? 0;
    holdText = hold > 0 ? `승인할 때 보류 ${hold}회` : "";
    // 잠긴 뒤 달라진 것 — 이 달 수업이 뒤늦게 풀렸거나, 지급한 수업이 없던 일이 됐다
    after = {
      adj: all.filter((l) => l.payYm === ym && l.state === "paid" && !isPaid(l.id)).length,
      settle: lines.filter((l) => l.t !== "settle" && isPaid(l.k) && !eligible.has(l.k) && evaluable(l.date)).length,
    };
  } else {
    const monthLines = all.filter((l) => l.payYm === ym);
    pay = monthLines.filter((l) => l.state === "paid" && !isPaid(l.id)).map((l) => toCloseLine(l, l.carry ? "carry" : "line"));
    already = monthLines.filter((l) => l.state === "paid" && isPaid(l.id)).length;
    holdLines = monthLines.filter((l) => l.state !== "paid");
    if (turn) {
      // 보정 — 닫은 달의 수업이 지금은 지급 대상인데 지급한 적이 없다
      adj = all.filter((l) => l.payYm < ym && approvedYm.has(l.payYm) && l.state === "paid" && !isPaid(l.id)).map((l) => toCloseLine(l, "adj", l.payYm));
      // 정산 — 지급한 수업이 지금은 지급 대상이 아니다
      const agreedKeys = close?.status === "confirmed" ? new Set(close.confirm?.settle ?? []) : new Set<string>();
      settle = [...ledger.entries()]
        // 금액을 보는 화면에서 나간 돈이 0원인 줄은 뺄 것이 없다(서버도 받지 않는다)
        .filter(([k, e]) => e.n > 0 && (e.line.rate == null || e.amount > 0) && !eligible.has(k) && evaluable(e.line.date))
        .map(([k, e]) => ({
          ...e.line,
          t: "settle" as const,
          rate: e.line.rate == null ? null : e.amount,
          from: e.ym,
          agreed: agreedKeys.has(k),
          included: false,
          why: inData.has(k) ? ("unpaid" as const) : ("gone" as const),
        }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.k.localeCompare(b.k));
      // 동의한 것부터(코치 본인 화면은 확정하면 동의할 줄까지), 이 달 수당 안에서만 뺀다 — 남는 것은 다음 달로
      let room = sum(pay) + sum(adj);
      for (const s of settle) {
        if (!s.agreed && !inp.assumeAgree) continue;
        if (s.rate == null) s.included = true;
        else if (s.rate <= room) {
          s.included = true;
          room -= s.rate;
        }
      }
    }
    uses = pay.length + adj.length;
    if (rates) {
      unpriced = [...pay, ...adj].filter((l) => l.rate == null).length;
      gross = sum(pay) + sum(adj) - sum(settle.filter((s) => s.included));
      const w = withholding33(gross);
      tax = { income: w.income, local: w.local };
      net = w.net;
    }
  }

  const keysNow = [...pay, ...adj].map((l) => l.k).sort();
  const settleNow = settle.map((l) => l.k);
  const confirmed = close?.status === "confirmed" ? close.confirm : null;
  const changedSinceConfirm =
    !!confirmed &&
    (confirmed.keys.length !== keysNow.length ||
      [...confirmed.keys].sort().some((k, i) => k !== keysNow[i]) ||
      settleNow.some((k) => !confirmed.settle.includes(k)));

  const confirmBlock = locked
    ? "이미 승인된 달이에요"
    : !monthEnded
      ? `${monthNo(nextYm(ym))}월 1일부터 확정할 수 있어요`
      : ym < startYm
        ? `마감은 ${monthNo(startYm)}월부터예요`
        : null;
  const approveBlock = locked
    ? "이미 승인된 달이에요"
    : !monthEnded
      ? "달이 끝난 뒤에 승인할 수 있어요"
      : ym < startYm
        ? `이 코치의 마감은 ${monthNo(startYm)}월부터예요`
        : prevOpenYm
          ? `${monthNo(prevOpenYm)}월을 먼저 승인해 주세요`
          : unpriced > 0
            ? `수당표에 없는 수업권 ${unpriced}회 — 금액을 먼저 정해 주세요`
            : null;

  return {
    ym,
    status: close?.status ?? "none",
    close,
    locked,
    monthEnded,
    turn,
    prevOpenYm,
    pay,
    adj,
    settle,
    already,
    holdLines,
    hold,
    holdText,
    extras: locked ? [] : base.extras,
    uses,
    unpriced,
    gross,
    net,
    tax,
    after,
    changedSinceConfirm,
    confirmBlock,
    approveBlock,
    base,
  };
};

/** 코치 확정 때 서버에 남기는 「본 것」 — 정산 줄을 본 채로 확정하면 그 줄을 빼는 데 동의한 것 */
export const ptCloseConfirmSummary = (st: PtStatement) => ({
  uses: st.uses,
  hold: st.hold,
  gross: st.gross,
  keys: [...st.pay, ...st.adj].map((l) => l.k),
  settle: st.settle.map((l) => l.k),
});

/** 승인 때 서버에 보내는 줄 — 서버가 다시 보고(이 코치의 수업 · 이중 지급 · 정산 동의) 합계 · 3.3%를 셈해 잠근다 */
export const ptCloseSnapshot = (st: PtStatement) => ({
  lines: [...st.pay, ...st.adj, ...st.settle.filter((s) => s.included).map(({ agreed: _a, included: _i, why: _w, ...l }) => l)],
  holds: [
    ...st.holdLines.map((l): PtCloseHold => ({ k: l.id, date: l.date, name: l.name, state: l.state })),
    ...st.extras.map((x): PtCloseHold => ({ date: x.workDate, name: x.name, state: "extra", n: x.count })),
  ],
  hold: st.hold,
});

/** 카드 오른쪽 위 한마디 */
export const ptStatementChip = (st: PtStatement): { text: string; tone: "ok" | "warn" | "muted" } => {
  if (st.locked) return { text: "마감 · 승인됨", tone: "ok" };
  if (st.status === "confirmed") return { text: "승인 대기", tone: "warn" };
  if (st.monthEnded) return { text: "확정 전", tone: "warn" };
  return { text: "이 달 지급 기준", tone: "ok" };
};

/** 시각 글(서버 +00:00) → 한국 날짜 "12/3" */
const kstMd = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return `${get("month")}/${get("day")}`;
};

/** 한 줄 상태 — "승인 1/4" · "코치 확정 1/3 · 승인 대기" · "코치 확정 전" · "진행 중" */
export const ptStatementStatusText = (st: PtStatement): string => {
  if (st.locked) return `승인 ${kstMd(st.close?.approved_at)}`.trim();
  if (st.status === "confirmed") return `코치 확정 ${kstMd(st.close?.confirmed_at)} · 승인 대기`.replace("  ", " ");
  if (st.monthEnded) return "코치 확정 전";
  return "진행 중";
};

/** 관리자 「확인할 것」 한 줄 — "12월 PT 수당 승인 대기" · "12월 PT 수당 · 코치 확정 전" */
export const ptCloseTodoText = (st: PtStatement): string => `${monthNo(st.ym)}월 PT 수당 ${st.status === "confirmed" ? "승인 대기" : "· 코치 확정 전"}`;

/** 한 지점의 마감 장부 — 기록(넉 달) · 마감 줄 · 수당표를 묶어 코치 · 달마다 명세를 꺼낸다 */
export interface PtCloseBook {
  today: string;
  firstYm: string;
  startYm: (coachId: string) => string;
  /** 마감할 차례인 달(YYYY-MM-01) — 없으면 null */
  due: (coachId: string) => string | null;
  /**
   * 그 코치 · 그 달(YYYY-MM-01)의 명세. 받은 기록 창(넉 달) 밖의 달은 기록이 일부만 있다 —
   *   잠긴 달은 승인본만 보여 주고(뒤에 달라진 것은 따지지 않는다), 안 잠긴 달은 셈하지 않는다(null).
   */
  statement: (coachId: string, month: string, monthEvents?: OpsPtEvent[]) => PtStatement | null;
}

export const ptCloseBook = (
  data: PtRecordData,
  res: PtMatchResult,
  cd: PtCloseData,
  rates: OpsPtRate[] | null,
  /** viewerCoach: 보는 사람이 코치 본인일 때 그 근무자 카드 — 그 코치의 명세는 정산 줄을 「확정하면 뺄 것」으로 셈한다 */
  opts: { firstYm?: string; viewerCoach?: string | null } = {},
): PtCloseBook => {
  const today = cd.today ?? data.today ?? res.today;
  const firstYm = opts.firstYm ?? ptPayFirstRecordMonth(res.startedOn);
  const closes = cd.closes ?? [];
  const startOf = (coachId: string) => cd.coaches?.find((c) => c.id === coachId)?.start ?? null;
  const startYm = (coachId: string) => ptCloseStartYm(firstYm, startOf(coachId));
  return {
    today,
    firstYm,
    startYm,
    due: (coachId) => {
      const ym = ptCloseDueYm(closes, coachId, startYm(coachId), today);
      return ym ? `${ym}-01` : null;
    },
    statement: (coachId, month, monthEvents) => {
      const st = ptStatement({
        res,
        events: data.events ?? [],
        rates,
        month,
        coachId,
        monthEvents,
        closes,
        start: startOf(coachId),
        from: data.from,
        today,
        firstYm: opts.firstYm,
        assumeAgree: !!opts.viewerCoach && opts.viewerCoach === coachId,
      });
      if (ptPayMonthCovered(month, data)) return st;
      return st.locked ? { ...st, after: null } : null;
    },
  };
};
