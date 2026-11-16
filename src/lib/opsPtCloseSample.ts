/**
 * 153운영본부 · PT 월 마감 — 예시 자료 (`/office?tab=work&demo=1`)
 *   서버를 부르지 않는다 — 이 기기 안에서만 확정 · 승인 · 취소가 바뀐다. 예시는 「이번 달이 끝난 다음 날」인 것처럼 보여 줘서
 *   [확정] · [승인] 단추를 바로 눌러 볼 수 있다(실제 화면은 달이 끝나야 눌린다). 금액은 지어낸 예시 수당표(PT_SAMPLE_RATES).
 */
import { withholding33 } from "./opsPt";
import type { PtClose, PtCloseConfirm, PtCloseData, PtCloseHold, PtCloseLine } from "./opsPtClose";
import { PT_SAMPLE_COACH } from "./opsPtRecordSample";

const nextMonthSecond = (today: string) => {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return m === 12 ? `${y + 1}-01-02` : `${y}-${String(m + 1).padStart(2, "0")}-02`;
};

export const buildPtCloseSample = (today: string): PtCloseData => ({
  branch: "예시 지점",
  on: true,
  available: true,
  first_month: `${today.slice(0, 7)}-01`,
  // 이번 달이 끝난 다음 날인 것처럼
  today: nextMonthSecond(today),
  manage: true,
  pay: true,
  can_approve: true,
  can_reopen: true,
  me_staff: PT_SAMPLE_COACH,
  coaches: [{ id: PT_SAMPLE_COACH, start: `${today.slice(0, 7)}-01` }],
  closes: [],
  sample: true,
});

export type PtCloseDemoAction =
  | { type: "confirm"; coachId: string; month: string; summary: PtCloseConfirm }
  | { type: "approve"; coachId: string; month: string; snapshot: { lines: PtCloseLine[]; holds: PtCloseHold[]; hold: number } }
  | { type: "reopen"; id: string; reason: string };

const blank = (coachId: string, month: string): PtClose => ({
  id: `demo-${coachId}-${month}`,
  coach_staff_id: coachId,
  month,
  status: "open",
  confirmed_at: null,
  approved_at: null,
  uses: null,
  settle_uses: null,
  hold: null,
  gross: null,
  tax_income: null,
  tax_local: null,
  net: null,
  lines: null,
  holds: null,
  confirm: null,
  reopened_at: null,
  reopen_reason: null,
});

/** 예시 화면에서 누른 것 — 서버(20261116155618_ops_pt_close.sql)와 같은 결로 줄을 바꾼다 */
export const applyPtCloseDemo = (cur: PtCloseData, a: PtCloseDemoAction, when?: string): PtCloseData => {
  // 예시의 「오늘」(달이 끝난 다음 날)에 누른 것으로 적는다
  const now = when ?? (cur.today ? `${cur.today}T10:00:00+09:00` : new Date().toISOString());
  const closes = [...(cur.closes ?? [])];
  const at = a.type === "reopen" ? closes.findIndex((c) => c.id === a.id) : closes.findIndex((c) => c.coach_staff_id === a.coachId && c.month === a.month);
  const row = at >= 0 ? closes[at] : a.type === "reopen" ? null : blank(a.coachId, a.month);
  if (!row) return cur;
  let next: PtClose = row;
  if (a.type === "confirm") {
    next = { ...row, status: "confirmed", confirmed_at: now, confirm: a.summary };
  } else if (a.type === "approve") {
    const pays = a.snapshot.lines.filter((l) => l.t !== "settle");
    const settles = a.snapshot.lines.filter((l) => l.t === "settle");
    const gross = pays.reduce((n, l) => n + (l.rate ?? 0), 0) - settles.reduce((n, l) => n + (l.rate ?? 0), 0);
    const w = withholding33(gross);
    next = {
      ...row,
      status: "approved",
      approved_at: now,
      uses: pays.length,
      settle_uses: settles.length,
      hold: a.snapshot.hold,
      gross,
      tax_income: w.income,
      tax_local: w.local,
      net: w.net,
      lines: a.snapshot.lines,
      holds: a.snapshot.holds,
    };
  } else {
    next = {
      ...row,
      status: row.confirmed_at ? "confirmed" : "open",
      approved_at: null,
      uses: null,
      settle_uses: null,
      hold: null,
      gross: null,
      tax_income: null,
      tax_local: null,
      net: null,
      lines: null,
      holds: null,
      reopened_at: now,
      reopen_reason: a.reason,
    };
  }
  if (at >= 0) closes[at] = next;
  else closes.push(next);
  return { ...cur, closes };
};
