/**
 * 👔 관장님 숫자 — 지도자 홈 맨 위 네 칸 (2026-11-26 대표님 「추천대로」 · 선릉역점만 · docs/features/69)
 *   재등록률(전체) · 출석률 · 유효 회원 · 이번 달 매출 + 오늘 할 일 세 줄. 관장 · 지점장 · 본사만(매출은 본사 · 관장만).
 *   서버 leader_owner_home(DB 20261126234059_owner_home.sql) JSON 읽기 · 칸 글 · 화살표 · 「계산 방법」 글.
 *   숫자는 서버(153OS owner_home_kpi · leader-kpi computeAllRenew) 그대로, 글만 여기서. 시험 ownerKpi.test.ts.
 */

export interface OwnerRenewMonth {
  month: string;
  n: number;
  renewed30: number;
  renewed: number;
  open: number;
  waiting: number;
  lost: number;
  rate: number | null;
  complete: boolean;
  settleOn: string | null;
}

export interface OwnerNumbers {
  members: { active: number; activeAll: number; holding: number; newMonth: number; endedMonth: number };
  attendance: {
    from: string | null;
    to: string | null;
    n: number;
    base: number;
    rate: number | null;
    prevN: number;
    prevRate: number | null;
    weekAvg: number | null;
  };
  sales: {
    month: string;
    mtd: number;
    refunds: number;
    through: string | null;
    prevMonth: string;
    prevSameTo: string | null;
    prevSame: number;
    prevFull: number;
  } | null;
  todo: { expiring14: number; noVisit7: number; leadsOverdue: number; leadsMonth: number };
  sync: { snapAt: string | null; membersAt: string | null; attendanceAt: string | null; salesAt: string | null };
}

export interface OwnerHomeData {
  on: boolean;
  role: "manager" | "admin" | "none";
  branch: string | null;
  today: string | null;
  salesVisible: boolean;
  attendanceTarget: number;
  owner: OwnerNumbers | null;
  ownerAt: string | null;
  ownerStale: boolean;
  renew: { prev: OwnerRenewMonth; prev2: OwnerRenewMonth | null; current: OwnerRenewMonth | null } | null;
  renewAt: string | null;
  renewStale: boolean;
  monthAgo: { day: string; active: number | null; attRate: number | null } | null;
}

export const OWNER_OFF: OwnerHomeData = {
  on: false,
  role: "none",
  branch: null,
  today: null,
  salesVisible: false,
  attendanceTarget: 80,
  owner: null,
  ownerAt: null,
  ownerStale: false,
  renew: null,
  renewAt: null,
  renewStale: false,
  monthAgo: null,
};

// ─── 읽기 ───────────────────────────────────────────────
type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function readMonth(v: unknown): OwnerRenewMonth | null {
  const o = obj(v);
  const month = str(o.month);
  if (!month) return null;
  return {
    month,
    n: num(o.n),
    renewed30: num(o.renewed30),
    renewed: num(o.renewed),
    open: num(o.open),
    waiting: num(o.waiting),
    lost: num(o.lost),
    rate: numOrNull(o.rate),
    complete: o.complete === true,
    settleOn: str(o.settleOn),
  };
}

function readNumbers(v: unknown): OwnerNumbers | null {
  const o = obj(v);
  if (!o.members && !o.attendance) return null;
  const m = obj(o.members);
  const a = obj(o.attendance);
  const s = o.sales && typeof o.sales === "object" ? obj(o.sales) : null;
  const t = obj(o.todo);
  const y = obj(o.sync);
  return {
    members: {
      active: num(m.active),
      activeAll: num(m.active_all),
      holding: num(m.holding),
      newMonth: num(m.new_month),
      endedMonth: num(m.ended_month),
    },
    attendance: {
      from: str(a.from),
      to: str(a.to),
      n: num(a.n),
      base: num(a.base),
      rate: numOrNull(a.rate),
      prevN: num(a.prev_n),
      prevRate: numOrNull(a.prev_rate),
      weekAvg: numOrNull(a.week_avg),
    },
    sales: s
      ? {
          month: str(s.month) ?? "",
          mtd: num(s.mtd),
          refunds: num(s.refunds_mtd),
          through: str(s.through),
          prevMonth: str(s.prev_month) ?? "",
          prevSameTo: str(s.prev_same_to),
          prevSame: num(s.prev_same),
          prevFull: num(s.prev_full),
        }
      : null,
    todo: {
      expiring14: num(t.expiring_14d),
      noVisit7: num(t.no_visit_7d),
      leadsOverdue: num(t.leads_overdue),
      leadsMonth: num(t.leads_month),
    },
    sync: { snapAt: str(y.snap_at), membersAt: str(y.members_at), attendanceAt: str(y.attendance_at), salesAt: str(y.sales_at) },
  };
}

export function normalizeOwnerHome(raw: unknown): OwnerHomeData {
  const o = obj(raw);
  const role = str(o.role);
  if (o.on !== true) return { ...OWNER_OFF, role: role === "manager" || role === "admin" ? role : "none", branch: str(o.branch) };
  const conf = obj(o.conf);
  const r = obj(o.renew);
  const prev = readMonth(r.prev);
  const ago = o.month_ago && typeof o.month_ago === "object" ? obj(o.month_ago) : null;
  const salesVisible = o.sales_visible === true;
  const owner = readNumbers(o.owner);
  return {
    on: true,
    role: role === "admin" ? "admin" : "manager",
    branch: str(o.branch),
    today: str(o.today),
    salesVisible,
    attendanceTarget: Math.min(100, Math.max(1, num(conf.attendance_target, 80))),
    owner: owner ? { ...owner, sales: salesVisible ? owner.sales : null } : null,
    ownerAt: str(o.owner_at),
    ownerStale: o.owner_stale === true,
    renew: prev ? { prev, prev2: readMonth(r.prev2), current: readMonth(r.current) } : null,
    renewAt: str(o.renew_at),
    renewStale: o.renew_stale === true,
    monthAgo: ago && str(ago.day) ? { day: str(ago.day) as string, active: numOrNull(ago.active), attRate: numOrNull(ago.att_rate) } : null,
  };
}

// ─── 글 도우미 ───────────────────────────────────────────
/** 'YYYY-MM' → '10월' */
export const monthName = (ym: string | null | undefined): string => (ym && ym.length >= 7 ? `${Number(ym.slice(5, 7))}월` : "");
/** 'YYYY-MM-DD' → '11/25' */
export const mdOf = (ymd: string | null | undefined): string =>
  ymd && ymd.length >= 10 ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : "";

/** 시각(ISO) → KST '11/26 23:20' */
export function kstStamp(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const k = new Date(t + 9 * 3600_000).toISOString();
  return `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))} ${k.slice(11, 16)}`;
}

/** 금액 줄여 쓰기 — 19,672,440 → '1,967만' · 9,000 → '9,000' */
export function wonShort(won: number): string {
  const a = Math.abs(won);
  const sign = won < 0 ? "−" : "";
  if (a < 10_000) return `${sign}${Math.round(a).toLocaleString("ko-KR")}`;
  return `${sign}${Math.round(a / 10_000).toLocaleString("ko-KR")}만`;
}

/** 금액 다 쓰기 — 19672440 → '19,672,440' */
export const wonFull = (won: number): string => `${won < 0 ? "−" : ""}${Math.abs(Math.round(won)).toLocaleString("ko-KR")}`;

export type DeltaTone = "up" | "down" | "flat";
export interface OwnerDelta {
  text: string;
  tone: DeltaTone;
}

const toneOf = (d: number): DeltaTone => (d > 0 ? "up" : d < 0 ? "down" : "flat");
const signed = (d: number, unit: string): string => (d > 0 ? `+${d}${unit}` : d < 0 ? `−${Math.abs(d)}${unit}` : `그대로`);

// ─── 네 칸 ───────────────────────────────────────────────
export type OwnerTileKey = "renew" | "attendance" | "active" | "sales";

export interface OwnerTile {
  key: OwnerTileKey;
  label: string;
  value: string;
  sub: string;
  delta: OwnerDelta | null;
  note: string | null;
}

export function ownerTiles(d: OwnerHomeData): OwnerTile[] {
  const out: OwnerTile[] = [];
  const p = d.renew?.prev ?? null;
  const p2 = d.renew?.prev2 ?? null;
  if (p) {
    const diff = p.rate !== null && p2 && p2.rate !== null ? Math.round(p.rate - p2.rate) : null;
    out.push({
      key: "renew",
      label: "재등록률",
      value: p.rate === null ? "—" : `${Math.round(p.rate)}%`,
      sub: p.n > 0 ? `${monthName(p.month)} ${p.n}명 중 ${p.renewed30}명` : `${monthName(p.month)} 끝난 회원 없음`,
      delta: diff === null || !p2 ? null : { text: `${monthName(p2.month)}보다 ${signed(diff, "%p")}`, tone: toneOf(diff) },
      note: p.complete ? "추정 · 매출 이름 대조" : `추정 · ${mdOf(p.settleOn)} 확정`,
    });
  } else {
    out.push({ key: "renew", label: "재등록률", value: "—", sub: "계산하는 중이에요", delta: null, note: null });
  }

  const o = d.owner;
  if (!o) {
    out.push({ key: "attendance", label: "출석률", value: "—", sub: "계산하는 중이에요", delta: null, note: null });
    out.push({ key: "active", label: "유효 회원", value: "—", sub: "계산하는 중이에요", delta: null, note: null });
    return out;
  }

  const a = o.attendance;
  const useMonth = d.monthAgo?.attRate !== null && d.monthAgo?.attRate !== undefined;
  const attBase = useMonth ? (d.monthAgo?.attRate as number) : a.prevRate;
  const attDiff = a.rate !== null && attBase !== null ? Math.round(a.rate - attBase) : null;
  out.push({
    key: "attendance",
    label: "출석률",
    value: a.rate === null ? "—" : `${Math.round(a.rate)}%`,
    sub: `최근 7일 ${a.n}/${a.base}명 · 목표 ${d.attendanceTarget}%`,
    delta: attDiff === null ? null : { text: `${useMonth ? "지난달" : "지난주"}보다 ${signed(attDiff, "%p")}`, tone: toneOf(attDiff) },
    note: a.weekAvg === null ? null : `주 평균 ${a.weekAvg}회`,
  });

  const m = o.members;
  const actDiff = d.monthAgo?.active !== null && d.monthAgo?.active !== undefined ? m.active - d.monthAgo.active : null;
  out.push({
    key: "active",
    label: "유효 회원",
    value: `${m.active}명`,
    sub: m.holding > 0 ? `홀딩 ${m.holding}명 따로` : "홀딩 없음",
    delta: actDiff === null ? null : { text: `지난달보다 ${signed(actDiff, "명")}`, tone: toneOf(actDiff) },
    note: `새로 ${m.newMonth} · 끝남 ${m.endedMonth}`,
  });

  if (d.salesVisible && o.sales) {
    const s = o.sales;
    const sd = s.mtd - s.prevSame;
    out.push({
      key: "sales",
      label: "이번 달 매출",
      value: wonShort(s.mtd),
      sub: `${mdOf(s.through)}까지 · 환불 뺌`,
      delta: { text: `${monthName(s.prevMonth)} 같은 날보다 ${sd === 0 ? "그대로" : (sd > 0 ? "+" : "") + wonShort(sd)}`, tone: toneOf(sd) },
      note: `${monthName(s.prevMonth)} 한 달 ${wonShort(s.prevFull)}`,
    });
  }
  return out;
}

// ─── 오늘 할 일 세 줄 ────────────────────────────────────
export type OwnerTodoKey = "expiring" | "noVisit" | "leads";

export interface OwnerTodo {
  key: OwnerTodoKey;
  text: string;
  sub: string;
  count: number;
  /** 아래 ① 기간 임박 명단으로 내려가기 */
  jump: boolean;
}

/** expiring = 지도자 홈 ① 기간 임박 숫자(아래 명단과 같은 숫자) */
export function ownerTodos(d: OwnerHomeData, expiring: { count: number; days: number }): OwnerTodo[] {
  const t = d.owner?.todo;
  return [
    { key: "expiring", text: `기간 임박 ${expiring.count}명`, sub: `D-${expiring.days} 안 · 아래 ① 명단`, count: expiring.count, jump: expiring.count > 0 },
    {
      key: "noVisit",
      text: `7일 넘게 안 온 회원 ${t?.noVisit7 ?? 0}명`,
      sub: "기간 임박은 빼고 · 명단은 다음 단계 CRM에서",
      count: t?.noVisit7 ?? 0,
      jump: false,
    },
    {
      key: "leads",
      text: `답 못 한 문의 ${t?.leadsOverdue ?? 0}건`,
      sub: `24시간 넘게 연락 전 · 이번 달 문의 ${t?.leadsMonth ?? 0}건`,
      count: t?.leadsOverdue ?? 0,
      jump: false,
    },
  ];
}

// ─── 기준 시각 ───────────────────────────────────────────
export const OWNER_SYNC_WARN_HOURS = 6;

export function ownerStamp(d: OwnerHomeData, now: number = Date.now()): { text: string | null; warn: string | null } {
  const at = d.owner?.sync.snapAt ?? null;
  const text = kstStamp(at);
  if (!at) return { text: null, warn: null };
  const t = Date.parse(at);
  const old = Number.isFinite(t) && now - t > OWNER_SYNC_WARN_HOURS * 3600_000;
  return {
    text: text ? `${text} 브로제이 기준` : null,
    warn: old ? `브로제이 숫자가 ${OWNER_SYNC_WARN_HOURS}시간 넘게 그대로예요 · 동기화를 확인해 주세요` : null,
  };
}

// ─── 칸을 누르면 — 계산 방법 ─────────────────────────────
export interface OwnerTileHelp {
  title: string;
  lines: string[];
  foot: string;
}

export function ownerTileHelp(key: OwnerTileKey, d: OwnerHomeData): OwnerTileHelp {
  const o = d.owner;
  if (key === "renew") {
    const p = d.renew?.prev;
    const c = d.renew?.current;
    const lines = ["수강권이 끝난 회원 중 끝나고 30일 안에 다시 결제한 회원 ÷ 끝난 회원", "끝나기 전에 미리 결제한 회원도 재등록으로 셉니다"];
    if (p) {
      lines.push(
        `${monthName(p.month)}: 끝난 ${p.n}명 · 30일 안 재등록 ${p.renewed30}명 · 놓침 ${p.lost}명${p.waiting > 0 ? ` · 기다리는 중 ${p.waiting}명` : ""}`,
      );
      lines.push(p.complete ? "결과가 정해진 달이에요" : `${mdOf(p.settleOn)}에 확정돼요 · 끝나고 30일이 다 지나야 해서요`);
    }
    if (c) {
      lines.push(`이번 달(${monthName(c.month)}): 끝나는 ${c.n}명 중 재등록 ${c.renewed30} · 아직 안 끝남 ${c.open} · 끝나고 기다리는 중 ${c.waiting}`);
    }
    return {
      title: "재등록률 · 계산 방법",
      lines,
      foot: "153OS 매출 기록의 이름으로 맞춘 추정이에요. 결제마다 이름이 다르게 적히면 재등록을 놓쳐 조금 낮게 나올 수 있어요.",
    };
  }
  if (key === "attendance") {
    const a = o?.attendance;
    const lines = ["유효 회원 중 최근 7일(오늘 포함)에 한 번 이상 온 회원 ÷ 유효 회원"];
    if (a) {
      lines.push(`${mdOf(a.from)}~${mdOf(a.to)}: ${a.n}명 ÷ ${a.base}명 = ${a.rate ?? "—"}%`);
      lines.push(`지난주(그 앞 7일): ${a.prevN}명 · ${a.prevRate ?? "—"}%`);
      if (a.weekAvg !== null) lines.push(`주 평균 출석 ${a.weekAvg}회 = 최근 30일 방문한 날 ÷ 유효 회원 ÷ 30 × 7`);
    }
    lines.push(`목표 ${d.attendanceTarget}%`);
    return {
      title: "출석률 · 계산 방법",
      lines,
      foot: "브로제이 출입 기록으로 셉니다. 브로제이 회원 목록의 「7일 방문」은 하루 더(8일) 세서 조금 높게 보여요.",
    };
  }
  if (key === "active") {
    const m = o?.members;
    const lines = ["오늘 수강권이 살아 있는 회원이에요. 홀딩 중인 회원은 따로 셉니다"];
    if (m) {
      lines.push(`살아 있는 수강권 ${m.activeAll}명 − 홀딩 ${m.holding}명 = ${m.active}명`);
      lines.push(`이번 달 새로 등록 ${m.newMonth}명(처음 결제) · 이번 달 끝나고 아직 안 돌아온 회원 ${m.endedMonth}명`);
    }
    if (d.monthAgo?.active !== null && d.monthAgo?.active !== undefined) lines.push(`${mdOf(d.monthAgo.day)} 유효 회원 ${d.monthAgo.active}명`);
    return {
      title: "유효 회원 · 계산 방법",
      lines,
      foot: "153OS 회원 거울(브로제이에서 읽어 옴) 기준이에요. 일일경영 리포트의 「유효 회원」은 홀딩을 넣은 숫자예요.",
    };
  }
  const s = o?.sales;
  const lines = ["이번 달 1일부터 들어온 매출 합이에요. 환불은 빼고 셉니다"];
  if (s) {
    lines.push(`${monthName(s.month)} 1일~${mdOf(s.through)}: ${wonFull(s.mtd)}원 (환불 ${wonFull(s.refunds)}원 뺌)`);
    const sd = s.mtd - s.prevSame;
    lines.push(`${monthName(s.prevMonth)} 1일~${mdOf(s.prevSameTo)}: ${wonFull(s.prevSame)}원 · 차이 ${sd > 0 ? "+" : ""}${wonFull(sd)}원`);
    lines.push(`${monthName(s.prevMonth)} 한 달: ${wonFull(s.prevFull)}원`);
  }
  return {
    title: "이번 달 매출 · 계산 방법",
    lines,
    foot: "153OS 매출(브로제이 매출 동기화) 기준이에요. 오늘 매출은 밤 동기화 뒤에 들어와요. 매출은 본사 · 관장님만 봅니다.",
  };
}

// ─── 화면 확인용 예시 (미리보기 · 시험) — 11/26 선릉 숫자 모양 ─────────
export const OWNER_DEMO: OwnerHomeData = normalizeOwnerHome({
  on: true,
  role: "admin",
  branch: "153복싱짐 선릉역점",
  today: "2026-11-26",
  sales_visible: true,
  conf: { attendance_target: 80, stale_minutes: 15 },
  owner: {
    members: { active: 133, active_all: 138, holding: 5, new_month: 25, ended_month: 24 },
    attendance: { from: "2026-11-20", to: "2026-11-26", n: 94, base: 133, rate: 70.7, prev_n: 95, prev_rate: 71.4, week_avg: 1.6 },
    sales: {
      month: "2026-11",
      mtd: 19672440,
      refunds_mtd: 1028560,
      through: "2026-11-25",
      prev_month: "2026-10",
      prev_same_to: "2026-10-25",
      prev_same: 19531000,
      prev_full: 25447500,
    },
    todo: { expiring_14d: 21, no_visit_7d: 26, leads_overdue: 0, leads_month: 0 },
    sync: { snap_at: "2026-11-26T14:20:23Z", members_at: "2026-11-25T15:05:43Z", attendance_at: "2026-11-26T14:20:21Z", sales_at: "2026-11-25T15:05:44Z" },
  },
  owner_at: "2026-11-26T14:47:19Z",
  owner_stale: false,
  renew: {
    prev: { month: "2026-10", n: 46, renewed30: 15, renewed: 17, open: 0, waiting: 3, lost: 28, rate: 32.6, complete: false, settleOn: "2026-12-01" },
    prev2: { month: "2026-09", n: 50, renewed30: 19, renewed: 20, open: 0, waiting: 0, lost: 31, rate: 38, complete: true, settleOn: "2026-10-31" },
    current: { month: "2026-11", n: 34, renewed30: 5, renewed: 5, open: 7, waiting: 22, lost: 0, rate: 14.7, complete: false, settleOn: "2026-12-31" },
  },
  renew_at: "2026-11-26T14:47:15Z",
  renew_stale: false,
  month_ago: null,
});
