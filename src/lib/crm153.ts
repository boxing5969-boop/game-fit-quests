/**
 * 📇 153OS CRM — 153운영본부 「CRM」 탭 계산 · 글 (2026-11-27 대표님 「다음가자」 · 관장님 앱 ② · docs/features/69)
 *
 *   서버: Edge Function os-crm → 153OS crm_members · crm_member_card · crm_customers (읽기만 · 쓰기는 ④)
 *   할 일 표시는 153OS 가 붙여 준다(사본 docs/os153/20261127002838_owner_crm.sql) — 여기서는 묶고 · 줄 세우고 · 글로 바꾸기만.
 *     기간 임박 = 14일 안 끝나는 유효 회원(홀딩 빼고) — 지도자 홈 ① · 관장님 홈 「기간 임박」과 같은 숫자
 *     7일 안 옴 = 일일경영 리포트 no_visit_7d(관장님 홈 「7일 넘게 안 온 회원」) · 한 달 넘게 안 옴 = idle_30d
 *   화면 없는 계산만 — 시험 crm153.test.ts
 */

export type CrmStatus = "active" | "soon" | "hold" | "ended" | "unknown";
export type CrmTodoTag = "exp3" | "exp14" | "ended7" | "ended14" | "ended30" | "novisit7" | "idle30" | "starter";
export type CrmTodoGroup = "expiring" | "novisit7" | "starter" | "ended" | "idle30";
export type CrmMemberFilter = "valid" | "soon" | "hold" | "ended";
export type CrmView = "todo" | "members" | "customers";

export interface CrmScope {
  role: "admin" | "manager";
  branch: string;
  branches: string[];
}

export interface CrmMemberRow {
  id: string;
  name: string;
  last4: string | null;
  product: string | null;
  start: string | null;
  end: string | null;
  daysLeft: number | null;
  status: CrmStatus;
  joined: string | null;
  lastVisit: string | null;
  v7: number;
  v30: number;
  coach: string | null;
  todo: CrmTodoTag[];
}

export interface CrmCounts {
  valid: number;
  active: number;
  soon: number;
  hold: number;
  ended: number;
  ended30: number;
  expiring: number;
  novisit7: number;
  idle30: number;
  starter: number;
  unknown: number;
  shown: number;
}

export interface CrmMembers {
  day: string;
  query: string | null;
  snapAt: string | null;
  counts: CrmCounts;
  rows: CrmMemberRow[];
}

export interface CrmPayment {
  day: string;
  product: string | null;
  category: string | null;
  amount: number;
}

export interface CrmFollowup {
  at: string;
  status: string | null;
  met: boolean;
  called: boolean;
  texted: boolean;
  memo: string | null;
}

export interface CrmCard {
  id: string;
  name: string;
  phone: string | null;
  last4: string | null;
  product: string | null;
  membershipType: string | null;
  start: string | null;
  end: string | null;
  daysLeft: number | null;
  active: boolean;
  statusText: string | null;
  hold: { status: string | null; start: string | null; end: string | null };
  sessions: { total: number | null; used: number | null; remaining: number | null };
  pt: { active: boolean; ticket: string | null; remaining: number | null; end: string | null };
  coach: string | null;
  joined: string | null;
  lastBought: string | null;
  route: string | null;
  purpose: string | null;
  lastVisit: string | null;
  visits: string[];
  payments: CrmPayment[];
  sameName: number;
  followups: CrmFollowup[];
  updatedAt: string | null;
}

export interface CrmTalkLead {
  at: string;
  lastAt: string | null;
  msgs: number;
  first: string;
  last4: string | null;
  member: boolean;
}

export interface CrmInquiry {
  at: string;
  source: string;
  name: string | null;
  last4: string | null;
  status: string | null;
  interest: string | null;
  trialAt: string | null;
  nextAt: string | null;
}

export interface CrmCustomers {
  day: string;
  funnel: { month: string; talkNew: number; talkLeads: number; inquiries: number; firstBuy: number; rebuy: number };
  talk: CrmTalkLead[];
  inquiries: CrmInquiry[];
}

// ─── 읽기 — 서버 답을 믿지 않고 하나씩 ──────────────────────
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => {
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const STATUSES: readonly CrmStatus[] = ["active", "soon", "hold", "ended", "unknown"];
const TAGS: readonly CrmTodoTag[] = ["exp3", "exp14", "ended7", "ended14", "ended30", "novisit7", "idle30", "starter"];

export function normalizeMembers(raw: unknown): CrmMembers {
  const o = obj(raw);
  const c = obj(o.counts);
  const rows: CrmMemberRow[] = [];
  for (const it of arr(o.rows)) {
    const r = obj(it);
    const id = str(r.id);
    if (!id) continue;
    const st = str(r.status) as CrmStatus | null;
    rows.push({
      id,
      name: str(r.name) ?? "이름 없음",
      last4: str(r.last4),
      product: str(r.product),
      start: day(r.start),
      end: day(r.end),
      daysLeft: numOrNull(r.days_left),
      status: st && STATUSES.includes(st) ? st : "unknown",
      joined: day(r.joined),
      lastVisit: day(r.last_visit),
      v7: num(r.v7),
      v30: num(r.v30),
      coach: str(r.coach),
      todo: arr(r.todo).filter((t): t is CrmTodoTag => typeof t === "string" && TAGS.includes(t as CrmTodoTag)),
    });
  }
  return {
    day: day(o.day) ?? "",
    query: str(o.query),
    snapAt: str(o.snap_at),
    counts: {
      valid: num(c.valid),
      active: num(c.active),
      soon: num(c.soon),
      hold: num(c.hold),
      ended: num(c.ended),
      ended30: num(c.ended30),
      expiring: num(c.expiring),
      novisit7: num(c.novisit7),
      idle30: num(c.idle30),
      starter: num(c.starter),
      unknown: num(c.unknown),
      shown: num(c.shown, rows.length),
    },
    rows,
  };
}

export function normalizeCard(raw: unknown): CrmCard | null {
  const o = obj(raw);
  const id = str(o.id);
  if (!id) return null;
  const hold = obj(o.hold);
  const s = obj(o.sessions);
  const pt = obj(o.pt);
  return {
    id,
    name: str(o.name) ?? "이름 없음",
    phone: str(o.phone),
    last4: str(o.last4) ?? (str(o.phone) ? String(o.phone).replace(/\D/g, "").slice(-4) : null),
    product: str(o.product),
    membershipType: str(o.membership_type),
    start: day(o.start),
    end: day(o.end),
    daysLeft: numOrNull(o.days_left),
    active: o.active === true,
    statusText: str(o.status_text),
    hold: { status: str(hold.status), start: day(hold.start), end: day(hold.end) },
    sessions: { total: numOrNull(s.total), used: numOrNull(s.used), remaining: numOrNull(s.remaining) },
    pt: { active: pt.active === true, ticket: str(pt.ticket), remaining: numOrNull(pt.remaining), end: day(pt.end) },
    coach: str(o.coach),
    joined: day(o.joined),
    lastBought: day(o.last_bought),
    route: str(o.route),
    purpose: str(o.purpose),
    lastVisit: day(o.last_visit),
    visits: arr(o.visits).map(day).filter((d): d is string => !!d).sort(),
    payments: arr(o.payments)
      .map((x) => {
        const p = obj(x);
        const d = day(p.day);
        return d ? { day: d, product: str(p.product), category: str(p.category), amount: num(p.amount) } : null;
      })
      .filter((p): p is CrmPayment => !!p),
    sameName: Math.max(1, num(o.same_name, 1)),
    followups: arr(o.followups)
      .map((x) => {
        const f = obj(x);
        const at = str(f.at);
        return at
          ? { at, status: str(f.status), met: f.met === true, called: f.called === true, texted: f.texted === true, memo: str(f.memo) }
          : null;
      })
      .filter((f): f is CrmFollowup => !!f),
    updatedAt: str(o.updated_at),
  };
}

export function normalizeCustomers(raw: unknown): CrmCustomers {
  const o = obj(raw);
  const f = obj(o.funnel);
  return {
    day: day(o.day) ?? "",
    funnel: {
      month: str(f.month) ?? "",
      talkNew: num(f.talk_new),
      talkLeads: num(f.talk_leads),
      inquiries: num(f.inquiries),
      firstBuy: num(f.first_buy),
      rebuy: num(f.rebuy),
    },
    talk: arr(o.talk)
      .map((x) => {
        const t = obj(x);
        const at = str(t.at);
        return at
          ? { at, lastAt: str(t.last_at), msgs: num(t.msgs), first: str(t.first) ?? "", last4: str(t.last4), member: t.member === true }
          : null;
      })
      .filter((t): t is CrmTalkLead => !!t),
    inquiries: arr(o.inquiries)
      .map((x) => {
        const q = obj(x);
        const at = str(q.at);
        return at
          ? {
              at,
              source: str(q.source) ?? "inquiry",
              name: str(q.name),
              last4: str(q.last4),
              status: str(q.status),
              interest: str(q.interest),
              trialAt: str(q.trial_at),
              nextAt: str(q.next_at),
            }
          : null;
      })
      .filter((q): q is CrmInquiry => !!q),
  };
}

// ─── 날짜 ────────────────────────────────────────────────
const dayNum = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
/** b − a (일) */
export const daysBetween = (a: string, b: string): number => dayNum(b) - dayNum(a);
export const addDays = (d: string, n: number): string => new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);
/** 11/27 */
export const md = (d: string | null): string => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
/** 2026-11-27T…Z → 11/27 09:05 (한국 시각) */
export function kstStampOf(at: string | null): string | null {
  if (!at) return null;
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  const k = new Date(t + 9 * 3_600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

// ─── 할 일 묶음 ───────────────────────────────────────────
export interface CrmTodoGroupMeta {
  key: CrmTodoGroup;
  label: string;
  sub: string;
  tags: CrmTodoTag[];
  count: (c: CrmCounts) => number;
}

/** 순서 = 챙기는 순서: 재등록 직전 → 이탈 막기 → 새 회원 정착 → 끝난 회원 다시 → 오래 쉬는 회원 */
export const CRM_TODO_GROUPS: readonly CrmTodoGroupMeta[] = [
  { key: "expiring", label: "기간 임박", sub: "14일 안에 끝나요 · 재등록 이야기", tags: ["exp3", "exp14"], count: (c) => c.expiring },
  // 「안 옴」은 붙여 둔다(\u00a0) — 칸이 좁을 때 '옴'만 다음 줄로 떨어지지 않게
  { key: "novisit7", label: "7일 안\u00a0옴", sub: "7~29일 안 왔어요 · 안부 연락", tags: ["novisit7"], count: (c) => c.novisit7 },
  { key: "starter", label: "첫 4주", sub: "가입 4주 안 · 주 2번보다 덜 왔어요", tags: ["starter"], count: (c) => c.starter },
  { key: "ended", label: "끝난 회원", sub: "끝난 지 30일 안 · 다시 등록 권하기", tags: ["ended7", "ended14", "ended30"], count: (c) => c.ended30 },
  { key: "idle30", label: "한 달 넘게 안\u00a0옴", sub: "수강권은 있는데 30일 넘게 안 왔어요", tags: ["idle30"], count: (c) => c.idle30 },
];

export const isTodoGroup = (v: unknown): v is CrmTodoGroup => CRM_TODO_GROUPS.some((g) => g.key === v);

const byStr = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "");

/** 그 묶음의 회원 — 챙길 순서로 */
export function todoRows(rows: CrmMemberRow[], group: CrmTodoGroup): CrmMemberRow[] {
  const meta = CRM_TODO_GROUPS.find((g) => g.key === group);
  if (!meta) return [];
  const list = rows.filter((r) => r.todo.some((t) => meta.tags.includes(t)));
  const sorted = [...list];
  if (group === "expiring") sorted.sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99) || byStr(a.name, b.name));
  // 오래 안 온 사람부터(7일 안 옴) · 최근에 쉬기 시작한 사람부터(한 달 넘게 — 돌아올 가능성이 큰 쪽)
  else if (group === "novisit7") sorted.sort((a, b) => byStr(a.lastVisit, b.lastVisit) || byStr(a.name, b.name));
  else if (group === "idle30") sorted.sort((a, b) => byStr(b.lastVisit, a.lastVisit) || byStr(a.name, b.name));
  else if (group === "starter") sorted.sort((a, b) => byStr(a.joined, b.joined) || byStr(a.name, b.name));
  else sorted.sort((a, b) => byStr(b.end, a.end) || byStr(a.name, b.name));
  return sorted;
}

// ─── 회원 목록 거르기 ─────────────────────────────────────
export const CRM_FILTERS: readonly { key: CrmMemberFilter; label: string; count: (c: CrmCounts) => number }[] = [
  { key: "valid", label: "유효", count: (c) => c.valid },
  { key: "soon", label: "14일 안 끝남", count: (c) => c.soon },
  { key: "hold", label: "홀딩", count: (c) => c.hold },
  { key: "ended", label: "끝남", count: (c) => c.ended },
];

export function filterRows(rows: CrmMemberRow[], f: CrmMemberFilter): CrmMemberRow[] {
  if (f === "valid") return rows.filter((r) => r.status === "active" || r.status === "soon" || r.status === "hold");
  return rows.filter((r) => r.status === f);
}

// ─── 한 줄 글 ────────────────────────────────────────────
export type CrmTone = "red" | "amber" | "green" | "gray" | "blue";

/** 상태 알약 — 14일 안 끝남은 남은 날 · 끝난 회원은 지난 날 */
export function statusPill(r: { status: CrmStatus; daysLeft: number | null }): { text: string; tone: CrmTone } {
  if (r.status === "soon") {
    const d = r.daysLeft ?? 0;
    return { text: d <= 0 ? "오늘 끝" : `${d}일 남음`, tone: d <= 3 ? "red" : "amber" };
  }
  if (r.status === "active") return { text: "유효", tone: "green" };
  if (r.status === "hold") return { text: "홀딩", tone: "blue" };
  if (r.status === "ended") {
    const d = r.daysLeft == null ? null : -r.daysLeft;
    return { text: d && d > 0 ? `끝난 지 ${d}일` : "끝남", tone: "gray" };
  }
  return { text: "확인 필요", tone: "gray" };
}

/** 마지막 방문 — 오늘 · 어제 · n일 전 */
export function visitText(lastVisit: string | null, today: string): string {
  if (!lastVisit) return "방문 기록 없음";
  const d = daysBetween(lastVisit, today);
  if (d <= 0) return "오늘 왔어요";
  if (d === 1) return "어제 왔어요";
  return `${d}일 전에 왔어요`;
}

export const TODO_LABEL: Record<CrmTodoTag, string> = {
  exp3: "3일 안 끝남",
  exp14: "14일 안 끝남",
  ended7: "끝난 지 7일 안",
  ended14: "끝난 지 2주 안",
  ended30: "끝난 지 한 달 안",
  novisit7: "7일 안 옴",
  idle30: "한 달 넘게 안 옴",
  starter: "첫 4주 · 덜 옴",
};

/** 010-1234-5678 */
export function phoneText(p: string | null): string {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p ?? "";
}

export const wonText = (n: number): string => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 브로제이 기준 시각 — 6시간 넘게 그대로면 알림 */
export const CRM_SYNC_WARN_HOURS = 6;
export function crmStamp(snapAt: string | null, now: number = Date.now()): { text: string | null; warn: string | null } {
  const text = kstStampOf(snapAt);
  if (!snapAt || !text) return { text: null, warn: null };
  const old = now - Date.parse(snapAt) > CRM_SYNC_WARN_HOURS * 3_600_000;
  return {
    text: `${text} 브로제이 기준`,
    warn: old ? `브로제이 회원 명부가 ${CRM_SYNC_WARN_HOURS}시간 넘게 그대로예요 · 동기화를 확인해 주세요` : null,
  };
}

// ─── 회원 카드 — 최근 13주 방문 칸 ─────────────────────────
export interface VisitWeek {
  /** 그 주 월요일 */
  monday: string;
  /** 월 → 일, 앞으로 올 날은 null */
  days: (boolean | null)[];
}

/** 13주(오늘이 든 주까지) · 월요일부터 — 방문한 날 true */
export function visitWeeks(visits: string[], today: string, weeks = 13): VisitWeek[] {
  const set = new Set(visits);
  const dow = (dayNum(today) + 3) % 7; // 1970-01-01 = 목요일 → 월요일 0
  const thisMonday = addDays(today, -dow);
  const out: VisitWeek[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addDays(thisMonday, -7 * w);
    const days: (boolean | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      days.push(d > today ? null : set.has(d));
    }
    out.push({ monday, days });
  }
  return out;
}

// ─── 고객 — 이번 달 손님 흐름 ──────────────────────────────
export interface CrmFunnelStep {
  key: "talkNew" | "talkLeads" | "firstBuy" | "rebuy";
  label: string;
  value: number;
  sub: string;
}

export function customerSteps(c: CrmCustomers): CrmFunnelStep[] {
  const m = c.funnel.month ? `${Number(c.funnel.month.slice(5, 7))}월` : "이번 달";
  return [
    { key: "talkNew", label: "톡톡 첫 인사", value: c.funnel.talkNew, sub: `${m} 네이버 톡톡 · 카카오로 처음 말 건 손님` },
    { key: "talkLeads", label: "번호 남김", value: c.funnel.talkLeads + c.funnel.inquiries, sub: "톡톡에 번호를 남기거나 문의로 적힌 손님" },
    { key: "firstBuy", label: "첫 결제", value: c.funnel.firstBuy, sub: `${m} 처음 수강권을 산 회원` },
    { key: "rebuy", label: "재등록", value: c.funnel.rebuy, sub: `${m} 다시 수강권을 산 회원` },
  ];
}

// ─── 안내 ────────────────────────────────────────────────
export const CRM_ERROR: Record<string, string> = {
  NOT_AUTHENTICATED: "다시 로그인해 주세요",
  FORBIDDEN: "관장님 · 지점장님 · 본사만 볼 수 있어요",
  SCOPE_FAILED: "권한을 확인하지 못했어요 · 잠시 후 다시 시도해 주세요",
  OS_NOT_CONFIGURED: "153OS 연결이 아직 설정되지 않았어요",
  OS_FAILED: "153OS 에서 읽지 못했어요 · 잠시 후 다시 시도해 주세요",
  BRANCH_NOT_IN_OS: "153OS 에 이 지점이 없어요",
  NOT_FOUND: "회원을 찾지 못했어요 · 브로제이 명부에서 빠졌을 수 있어요",
  INVALID_REQUEST: "요청이 올바르지 않아요",
};

export const CRM_HELP: readonly string[] = [
  "숫자와 명단은 브로제이 회원 명부 · 출입 기록을 153OS 가 모은 것이에요. 이 화면은 읽기만 해요(고치기는 브로제이).",
  "기간 임박은 14일 안에 끝나는 유효 회원이에요(홀딩 빼고). 홈 「기간 임박」, 지도자 홈 ① 명단과 같은 숫자예요. 일일경영 리포트는 30일 넘게 안 온 회원을 빼고 세서 조금 적게 나와요.",
  "7일 안 옴은 7~29일 동안 안 온 유효 회원이에요(기간 임박 빼고, 홀딩 포함). 일일경영 리포트와 홈 「7일 넘게 안 온 회원」이 같은 숫자예요.",
  "첫 4주는 가입한 지 28일이 안 됐는데 주 2번(4주 8번) 속도보다 덜 온 회원이에요(153OS 출입 기록).",
  "한 달 넘게 안 옴은 수강권이 남아 있는데 30일 넘게 안 온 회원이에요. 기간 임박과 겹치는 회원도 있어요.",
  "목록에는 전화 뒷 4자리만 보여요. 회원 카드를 열면 전화 전체 · 결제 · 방문 날짜가 보이고, 연 기록이 남아요.",
];

// ─── 예시(?demo=1) — 지어낸 회원 · 서버를 부르지 않는다 ─────────
const DEMO_TODAY = "2026-11-27";
const demoRow = (p: Partial<CrmMemberRow> & Pick<CrmMemberRow, "id" | "name" | "status">): CrmMemberRow => ({
  last4: "0000",
  product: "복싱 3개월",
  start: null,
  end: null,
  daysLeft: null,
  joined: null,
  lastVisit: null,
  v7: 0,
  v30: 0,
  coach: null,
  todo: [],
  ...p,
});

export const CRM_DEMO_MEMBERS: CrmMembers = {
  day: DEMO_TODAY,
  query: null,
  snapAt: "2026-11-27T00:20:00Z",
  counts: { valid: 6, active: 3, soon: 2, hold: 1, ended: 2, ended30: 2, expiring: 2, novisit7: 1, idle30: 1, starter: 1, unknown: 0, shown: 8 },
  rows: [
    demoRow({ id: "d1", name: "김복서", last4: "1530", status: "soon", end: "2026-11-29", daysLeft: 2, lastVisit: "2026-11-26", v7: 2, v30: 9, coach: "오삼 코치", todo: ["exp3"] }),
    demoRow({ id: "d2", name: "이펀치", last4: "2481", status: "soon", end: "2026-12-08", daysLeft: 11, lastVisit: "2026-11-24", v7: 1, v30: 6, todo: ["exp14"] }),
    demoRow({ id: "d3", name: "박잽", last4: "7719", status: "active", end: "2027-01-20", daysLeft: 54, lastVisit: "2026-11-15", v7: 0, v30: 3, todo: ["novisit7"] }),
    demoRow({ id: "d4", name: "최훅", last4: "3302", status: "active", end: "2027-02-11", daysLeft: 76, joined: "2026-11-12", lastVisit: "2026-11-20", v7: 0, v30: 2, todo: ["starter"] }),
    demoRow({ id: "d5", name: "정어퍼", last4: "9045", status: "active", end: "2027-03-02", daysLeft: 95, lastVisit: "2026-10-18", v7: 0, v30: 0, todo: ["idle30"] }),
    demoRow({ id: "d6", name: "한스텝", last4: "6127", status: "hold", end: "2027-01-05", daysLeft: 39, lastVisit: "2026-11-02" }),
    demoRow({ id: "d7", name: "윤가드", last4: "4410", status: "ended", end: "2026-11-23", daysLeft: -4, lastVisit: "2026-11-21", todo: ["ended7"] }),
    demoRow({ id: "d8", name: "서위빙", last4: "8853", status: "ended", end: "2026-11-05", daysLeft: -22, lastVisit: "2026-11-01", todo: ["ended30"] }),
  ],
};

export const CRM_DEMO_CARD: CrmCard = {
  id: "d1",
  name: "김복서",
  phone: "01000001530",
  last4: "1530",
  product: "복싱 3개월",
  membershipType: "기간제",
  start: "2026-08-30",
  end: "2026-11-29",
  daysLeft: 2,
  active: true,
  statusText: "유효",
  hold: { status: null, start: null, end: null },
  sessions: { total: null, used: null, remaining: null },
  pt: { active: false, ticket: null, remaining: null, end: null },
  coach: "오삼 코치",
  joined: "2026-08-30",
  lastBought: "2026-08-30",
  route: "네이버 지도",
  purpose: "다이어트",
  lastVisit: "2026-11-26",
  visits: ["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19", "2026-11-24", "2026-11-26"],
  payments: [{ day: "2026-08-30", product: "복싱 3개월", category: "수강권", amount: 450000 }],
  sameName: 1,
  followups: [],
  updatedAt: "2026-11-27T00:20:00Z",
};

export const CRM_DEMO_CUSTOMERS: CrmCustomers = {
  day: DEMO_TODAY,
  funnel: { month: "2026-11", talkNew: 101, talkLeads: 2, inquiries: 0, firstBuy: 26, rebuy: 24 },
  talk: [
    { at: "2026-11-25T03:10:00Z", lastAt: "2026-11-25T03:30:00Z", msgs: 6, first: "체험 수업 가능한가요? 퇴근하고 7시쯤이요", last4: "5521", member: false },
    { at: "2026-11-12T11:02:00Z", lastAt: "2026-11-12T11:40:00Z", msgs: 9, first: "3개월 가격이랑 주차 되는지 궁금해요", last4: "3107", member: true },
  ],
  inquiries: [],
};
