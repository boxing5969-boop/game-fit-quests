/**
 * 153운영본부 · PT 수당 2단계 — 「기록 + 차감」 기준 (2026-11-16 대표님 「다음진행하자」
 *   · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「2단계 제작 계획」 2-1)
 *
 *   지금까지 PT 수당 = 그 달에 잡힌 브로제이 차감(opsPt.ts computePtMonth). 차감은 하루~이틀 늦게 잡히고
 *   수업 · 노쇼 · 보정을 가를 수 없어 10월 정산이 틀어졌다 → 12월 수업분부터 「기록 + 차감이 둘 다 있는 수업만」
 *   (2026-11-11 대표님 결정 3 · 11-12 결정 「수당 달 = 수업한 날」 · 「확인 안 된 차감은 보류」).
 *
 *   이 파일은 PT 기록 짝짓기(opsPtRecord.ts matchPtRecord) 결과에 수당표를 얹어 한 달을 셈한다 — 서버는 자료만.
 *     · 수업 1회(연속 2회 수업은 두 줄) = 한 줄. 수업한 날의 달에 든다(차감이 다음 달에 잡혀도).
 *     · 지급 대상 = 기록 + 짝지은 차감이 있고, 늦은 기록이면 확인됐고, 출석 체크 없는 수업이면 사유가 있는 것.
 *     · 보류 = 차감이 아직 안 잡힘 · 수업권이 끝나 지점장 확인을 기다리는 차감 · 늦은 기록 확인 전 · 출석 체크 없는데 사유 없음
 *       · 기록 없는 차감(사유 없는 차감).
 *     · 전환 달 경계: 차감 기준이던 달(11월)의 수업인데 차감이 기록 기준 달(12월)에 잡힌 것은 그 차감이 잡힌 달에
 *       「지난달 수업」 줄로 지급한다 — 그대로 두면 어느 달에도 잡히지 않는다(10/31 수업이 11/1 로 잡힌 것과 같은 모양).
 *   월 마감(잠금) · 「보정」 · 「정산」 줄은 2-2 — 여기는 지금 자료로 셈한 미리 보기다(닫은 달이 없다).
 */
import { countsForPay, perUseRate, withholding33, type OpsPtEvent, type OpsPtRate } from "./opsPt";
import {
  addDays,
  isUseKind,
  PT_LAG_DAYS,
  PT_NO_ENTRY_MONTH_LIMIT,
  type PtExtra,
  type PtKind,
  type PtMatchResult,
  type PtRecordData,
  type PtRow,
} from "./opsPtRecord";

/** 이 달 수업분부터 「기록 + 차감」으로 수당을 셈한다 (YYYY-MM) */
export const PT_PAY_BY_RECORD_FROM = "2026-12";

const nextYm = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/**
 * 이 지점이 「기록 + 차감」으로 넘어가는 첫 달 — PT 기록을 켠 달은 앞부분 기록이 없어 그다음 달부터
 *   (1일에 켰으면 그 달부터). 전사 전환 달(PT_PAY_BY_RECORD_FROM)보다 이르지 않다.
 */
export const ptPayFirstRecordMonth = (startedOn: string): string => {
  const ym = startedOn.slice(0, 7);
  const first = startedOn.slice(8, 10) === "01" ? ym : nextYm(ym);
  return first > PT_PAY_BY_RECORD_FROM ? first : PT_PAY_BY_RECORD_FROM;
};

/** 그 달의 공식 수당 기준 — record 기록 + 차감 · deduct 차감 기록(예전) */
export type PtPayBasis = "record" | "deduct";
export const ptPayBasis = (month: string, startedOn: string | null | undefined): PtPayBasis =>
  startedOn && month.slice(0, 7) >= ptPayFirstRecordMonth(startedOn) ? "record" : "deduct";

/**
 * 그 달의 기록이 받은 자료에 다 있는가 — 서버(ops_pt_record)는 최근 넉 달만 보낸다. 창이 잘렸고(켠 날 14일 앞보다 늦게 시작)
 *   그 달이 창보다 앞에서 시작하면 기록이 일부만 있어 셈하지 않는다 — 0회 · 0원으로 보이면 안 된다.
 *   닫은 달은 2-2 월 마감 기록에서 읽는다(그 전까지 넉 달이 지난 달은 다시 셈하지 않는다).
 */
export const ptPayMonthCovered = (month: string, data: Pick<PtRecordData, "from" | "started_on">): boolean => {
  if (!data.from || !data.started_on) return true;
  if (data.from <= addDays(data.started_on, -14)) return true;
  return `${month.slice(0, 7)}-01` >= data.from;
};

/**
 * paid 지급 대상 / pending 차감 확인 중(이틀 안) · wait 차감 대기 · check 수업권이 끝나 지점장 확인을 기다리는 차감(「확인할 것」)
 *   · review 늦은 기록 확인 전 · reason 출석 체크 없는데 사유 없음
 *   · member 회원이 「아니에요」라고 한 차감 — 지점장 · 대표님이 답하기 전(2026-11-16 2-4 회원 확인)
 */
export type PtPayLineState = "paid" | "pending" | "wait" | "check" | "review" | "reason" | "member";

export const PT_PAY_STATE_LABEL: Record<PtPayLineState, string> = {
  paid: "지급 대상",
  pending: "차감 확인 중",
  wait: "차감 대기",
  check: "수업권 끝남 · 확인 중",
  review: "늦은 기록 · 확인 전",
  reason: "출석 체크 없음 · 사유 필요",
  member: "회원 확인 중",
};

export interface PtPayLine {
  /** 기록 id + 몇 번째 회(연속 수업) */
  id: string;
  sessionId: string;
  /** 수업한 날 */
  date: string;
  key: string;
  name: string;
  kind: PtKind;
  ticket: string | null;
  /** 짝지은 차감이 잡힌 날 — 아직 없으면 null */
  deductDate: string | null;
  /** 이틀을 넘겨 잡힌 차감 */
  lateDeduct: boolean;
  /** 앱이 넣은 기록(차감 + 그날 입장) */
  auto: boolean;
  /** 출석 체크 없는 수업 */
  noEntry: boolean;
  state: PtPayLineState;
  /** 1회 수당 — 수당표를 못 받았거나 표에 없는 수업권이면 null */
  rate: number | null;
  /** 차감 기준이던 달의 수업 — 차감이 기록 기준 달에 잡혀 그 달에 지급한다(전환 달 경계) */
  carry: boolean;
  /** 이 줄이 드는 달(YYYY-MM) — 수업한 달, carry 는 차감이 잡힌 달 */
  payYm: string;
}

export interface PtPayMemberRow {
  key: string;
  name: string;
  uses: number;
  pay: number | null;
}

export interface PtPayMonth {
  ym: string;
  /** 이 달의 공식 기준 */
  basis: PtPayBasis;
  /** 이 달 명세에 드는 줄(지급 대상 + 보류) — 수업한 날 순 */
  lines: PtPayLine[];
  /** 지급 대상(회) — carry 포함 */
  paidUses: number;
  /** 지급 대상 가운데 지난달 수업(전환 달 경계) */
  carryUses: number;
  /** 수당 합계(3.3% 전) — 수당표가 없으면 null */
  gross: number | null;
  /** 3.3% 뗀 금액 */
  net: number | null;
  /** 수당표에 없는 수업권(회) */
  unpriced: number;
  hold: { pending: number; wait: number; check: number; review: number; reason: number; member: number; extra: number; total: number };
  /** 이 달에 잡힌 기록 없는 차감 */
  extras: PtExtra[];
  /** 차감 기준으로 셈한 같은 달(예전 방식) */
  byDeduct: { uses: number; gross: number | null };
  /** 두 기준이 다른 까닭(회) */
  diff: {
    /** 이 달에 잡힌 차감인데 수업은 지난달 */
    prevLesson: number;
    /** 이 달 수업인데 차감은 다음 달에 잡힘 */
    nextMonth: number;
    /** 그중 다음 달에 「지난달 수업」으로 지급하는 것(전환 달 경계 — 이 달이 차감 기준일 때) */
    carryOut: number;
    /** 기록 없는 차감 */
    extra: number;
    /** 차감은 맞았지만 확인 · 사유를 기다리는 기록 */
    held: number;
    /** PT 기록을 켜기 전에 잡힌 차감 — 기록이 없어 견줄 수 없다(켠 달에만) */
    preStart: number;
  };
  /** 출석 체크 없는 수업(건) */
  noEntry: number;
  noEntryOver: boolean;
  /** 회원별 지급 대상 */
  members: PtPayMemberRow[];
}

const ymOf = (d: string) => d.slice(0, 7);

const stateOf = (r: PtRow, matched: boolean): PtPayLineState => {
  if (r.needReason) return "reason";
  if (r.needReview) return "review";
  if (!matched) return r.heldByCheck ? "check" : r.state === "pending" ? "pending" : "wait";
  return "paid";
};

/**
 * 한 코치(coachId) 또는 지점 전체(null)의 모든 수업 줄 — 달을 가리지 않는다. 줄마다 드는 달(payYm)과 지금 상태가 붙는다.
 *   월 마감(opsPtClose.ts)이 닫은 달의 줄과 견줄 때도 이 줄을 쓴다(줄 id = 기록 id:몇 번째 회).
 */
export const ptPayLinesAll = (res: PtMatchResult, events: OpsPtEvent[], rates: OpsPtRate[] | null, coachId: string | null, firstYm?: string): PtPayLine[] => {
  const first = firstYm ?? ptPayFirstRecordMonth(res.startedOn);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const rows = coachId ? res.rows.filter((r) => r.s.coach_staff_id === coachId) : res.rows;
  const lines: PtPayLine[] = [];
  for (const r of rows) {
    if (!isUseKind(r.s.kind)) continue;
    const s = ymOf(r.s.session_date);
    const uses = Math.max(1, r.s.uses || 1);
    for (let i = 0; i < uses; i += 1) {
      const d = r.deducts[i] ?? null;
      const dYm = d ? ymOf(d.workDate) : null;
      // 켠 날 앞 수업인데 차감이 없다 — 맞춰 보지 않는다(차감은 켜기 전에 잡혔다)
      if (!d && r.state === "prestart") continue;
      // 전환 달 경계 — 차감 기준이던 달의 수업인데 차감이 기록 기준 달에 잡혔다 → 그 차감이 잡힌 달에 든다
      const carry = s < first && dYm != null && dYm >= first;
      const ticket = (d && eventById.get(d.eventId)?.ticket_name) || r.s.ticket_name;
      // 회원이 「아니에요」라고 한 차감과 짝지은 수업 — 지점장 · 대표님이 답할 때까지 보류(2-4)
      const st = stateOf(r, !!d);
      lines.push({
        id: `${r.s.id}:${i}`,
        sessionId: r.s.id,
        date: r.s.session_date,
        key: r.key,
        name: r.name,
        kind: r.s.kind,
        ticket: ticket ?? null,
        deductDate: d?.workDate ?? null,
        lateDeduct: !!d && d.days > PT_LAG_DAYS,
        auto: r.s.source === "auto",
        noEntry: r.noEntry,
        state: st === "paid" && d?.disputed ? "member" : st,
        rate: rates ? perUseRate(rates, ticket ?? null, r.s.session_date) : null,
        carry,
        payYm: carry && dYm ? dYm : s,
      });
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};

/**
 * 한 코치(coachId) 또는 지점 전체(null)의 한 달 — 「기록 + 차감」 기준.
 *   res · events = PT 기록 자료(ops_pt_record)로 짝지은 결과와 그 차감 목록. monthEvents = 그 달 차감 전체(ops_pt_month —
 *   켠 날 앞 차감도 있다)를 주면 차감 기준 견줌에 쓴다. rates = 수당표(못 보는 화면은 null).
 */
export const ptPayMonth = (
  res: PtMatchResult,
  events: OpsPtEvent[],
  rates: OpsPtRate[] | null,
  month: string,
  coachId: string | null,
  monthEvents?: OpsPtEvent[],
  /** 예시 화면 — 「기록 + 차감」 첫 달을 억지로(YYYY-MM) */
  firstYm?: string,
): PtPayMonth => {
  const ym = ymOf(month);
  const first = firstYm ?? ptPayFirstRecordMonth(res.startedOn);
  const basis: PtPayBasis = ym >= first ? "record" : "deduct";
  const all = ptPayLinesAll(res, events, rates, coachId, first);
  const lines = all.filter((l) => l.payYm === ym);
  // 차감 기준과 다른 까닭(회)
  const prevLesson = all.filter((l) => l.deductDate != null && ymOf(l.deductDate) === ym && ymOf(l.date) < ym).length;
  const nextMonth = all.filter((l) => ymOf(l.date) === ym && l.deductDate != null && ymOf(l.deductDate) > ym).length;
  const carryOut = all.filter((l) => ymOf(l.date) === ym && l.payYm > ym).length;
  const held = lines.filter((l) => l.deductDate != null && (l.state === "review" || l.state === "reason" || l.state === "member")).length;

  const paid = lines.filter((l) => l.state === "paid");
  const unpriced = rates ? paid.filter((l) => l.rate == null).length : 0;
  const gross = rates ? paid.reduce((n, l) => n + (l.rate ?? 0), 0) : null;
  const extras = (coachId ? res.extras.filter((x) => x.coachId === coachId) : res.extras).filter((x) => ymOf(x.workDate) === ym);
  const extra = extras.reduce((n, x) => n + x.count, 0);
  const count = (st: PtPayLineState) => lines.filter((l) => l.state === st).length;
  const hold = {
    pending: count("pending"),
    wait: count("wait"),
    check: count("check"),
    review: count("review"),
    reason: count("reason"),
    member: count("member"),
    extra,
    total: 0,
  };
  hold.total = hold.pending + hold.wait + hold.check + hold.review + hold.reason + hold.member + hold.extra;

  // 차감 기준(예전 방식) — 그 달에 잡힌 차감
  const dEvents = (monthEvents ?? events).filter(
    (e) => countsForPay(e) && e.used > 0 && ymOf(e.work_date) === ym && (!coachId || e.coach_staff_id === coachId),
  );
  const dUses = dEvents.reduce((n, e) => n + e.used, 0);
  const preStart = dEvents.filter((e) => e.work_date < res.startedOn).reduce((n, e) => n + e.used, 0);
  const dGross = rates
    ? dEvents.reduce((n, e) => {
        const per = perUseRate(rates, e.ticket_name, e.work_date);
        return n + (per ?? 0) * e.used;
      }, 0)
    : null;

  const byMember = new Map<string, PtPayMemberRow>();
  for (const l of paid) {
    const m = byMember.get(l.key) ?? { key: l.key, name: l.name, uses: 0, pay: rates ? 0 : null };
    m.uses += 1;
    if (rates) m.pay = (m.pay ?? 0) + (l.rate ?? 0);
    byMember.set(l.key, m);
  }
  const noEntry = new Set(lines.filter((l) => l.noEntry && !l.carry).map((l) => l.sessionId)).size;

  return {
    ym,
    basis,
    lines,
    paidUses: paid.length,
    carryUses: paid.filter((l) => l.carry).length,
    gross,
    net: gross == null ? null : withholding33(gross).net,
    unpriced,
    hold,
    extras,
    byDeduct: { uses: dUses, gross: dGross },
    diff: { prevLesson, nextMonth, carryOut, extra, held, preStart },
    noEntry,
    noEntryOver: noEntry > PT_NO_ENTRY_MONTH_LIMIT,
    members: [...byMember.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name)),
  };
};

/** 두 기준이 다른 까닭을 글로 — 없는 것은 빼고 */
export const ptPayDiffNotes = (p: PtPayMonth): string[] => {
  const out: string[] = [];
  if (p.diff.prevLesson > 0) {
    // 전환 달 경계로 이 달에 얹은 줄 — 확인 · 사유를 기다리는 것도 풀리면 이 달에 지급한다
    const carried = p.lines.filter((l) => l.carry).length;
    const rest = p.diff.prevLesson - carried;
    if (carried > 0) out.push(`지난달 수업인데 차감이 이 달에 잡힌 ${carried}회 — 이 달에 「지난달 수업」으로 지급해요`);
    if (rest > 0) out.push(`지난달 수업의 차감 ${rest}회 — 수업한 달 몫이에요`);
  }
  const stay = p.diff.nextMonth - p.diff.carryOut;
  if (stay > 0) out.push(`이 달 수업인데 차감이 다음 달에 잡힌 ${stay}회 — 수업한 이 달에 넣어요`);
  if (p.diff.carryOut > 0) out.push(`이 달 수업인데 차감이 다음 달에 잡힌 ${p.diff.carryOut}회 — 다음 달에 「지난달 수업」으로 지급해요`);
  if (p.diff.extra > 0) out.push(`기록 없는 차감 ${p.diff.extra}회 — 수업 기록이 생길 때까지 보류해요`);
  if (p.diff.held > 0) out.push(`차감은 맞았지만 확인 · 사유를 기다리는 기록 ${p.diff.held}회 — 풀리면 지급 대상이 돼요`);
  if (p.diff.preStart > 0) out.push(`PT 기록을 켜기 전에 잡힌 차감 ${p.diff.preStart}회 — 기록이 없어 차감 기준으로만 셈해요`);
  return out;
};

/** 보류 한 줄 — "차감 대기 1 · 기록 없는 차감 1" */
export const ptPayHoldText = (h: PtPayMonth["hold"]): string =>
  [
    h.wait > 0 ? `차감 대기 ${h.wait}` : "",
    h.pending > 0 ? `차감 확인 중 ${h.pending}` : "",
    h.check > 0 ? `수업권 끝남 확인 중 ${h.check}` : "",
    h.review > 0 ? `늦은 기록 확인 전 ${h.review}` : "",
    h.reason > 0 ? `사유 필요 ${h.reason}` : "",
    h.member > 0 ? `회원 확인 중 ${h.member}` : "",
    h.extra > 0 ? `기록 없는 차감 ${h.extra}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
