// 지도자 홈 신규 재등록률 — 153OS registration_report 의 줄(rows)로 계산한다 (2026-11-26 대표님 「추천대로 가자」).
//   · 신규 = 그 지점 · 그 이름의 첫 수강권 결제(153OS 가 앞선 결제가 없으면 'new' 로 준다 — 같은 이름 대조 추정).
//   · 첫 수강권이 끝나는 날 = 첫 결제일 + 개월 × 30일(상품 이름에서 '3개월+1개월' = 4개월).
//   · 재등록 = 첫 결제 뒤 다른 날 같은 이름의 수강권 결제. 끝난 뒤 30일 안이면 renewed30.
//   · 이름은 계산과 앱 회원 맞추기에만 쓰고 저장하지 않는다(leader_kpi 에는 숫자만).
//   · 재등록률(전체 회원 · 관장님 홈) = computeAllRenew — 아래 「재등록률(전체)」 (2026-11-26 · docs/features/69).
//   Edge Function leader-kpi 가 쓰고, 시험은 src/lib/leaderKpi.test.ts.

export interface RegRow {
  day: string;
  branch: string;
  member: string | null;
  product: string | null;
  amount: number | string | null;
  kind: string;
}

export interface KpiMonth {
  month: string;
  n: number;
  renewed30: number;
  renewed: number;
  open: number;
  expiredOpen: number;
}

export interface KpiMember {
  name: string;
  firstPaid: string;
  lastPaid: string;
  paidCount: number;
  firstTerm: boolean;
}

export interface LeaderKpi {
  branch: string;
  today: string;
  recent: { months: number; n: number; renewed30: number; rate: number | null };
  current: KpiMonth;
  next: KpiMonth;
  months: KpiMonth[];
  newPerMonth: number | null;
  avgRenewAmount: number | null;
  graceDays: number;
}

const DAY_MS = 86_400_000;
const GRACE_DAYS = 30;
const RECENT_MONTHS = 6;

/** 띄어쓰기를 지운 이름 (153OS registration_report 와 같은 기준) */
export const normName = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, "");

/** 상품 이름 → 개월 수. '일일' = 0 · 알 수 없으면 null */
export function productMonths(product: string | null | undefined): number | null {
  const p = product ?? "";
  if (/일일/.test(p)) return 0;
  const plus = p.match(/(\d+)\s*개월\s*\+\s*(\d+)\s*개월/);
  if (plus) return Number(plus[1]) + Number(plus[2]);
  const one = p.match(/(\d+)\s*개월/);
  if (one) return Number(one[1]);
  return null;
}

/** PT · 락커 · 운동복은 수강권 재등록으로 보지 않는다 */
export const isPassProduct = (product: string | null | undefined): boolean =>
  !/(PT|퍼스널|트레이닝|락커|락카|운동복)/i.test(product ?? "");

const toMs = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const toDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string => toDay(toMs(d) + n * DAY_MS);

/** 'YYYY-MM' 에 n달 더하기 */
export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

const amountOf = (a: RegRow["amount"]): number => {
  const v = typeof a === "number" ? a : Number(a ?? 0);
  return Number.isFinite(v) ? v : 0;
};

interface Cohort {
  name: string;
  first: string;
  end: string | null;
  renewDay: string | null;
}

/** 재등록률에 세는 결제 — 그 지점 · 수강권(PT · 락커 · 운동복 · 일일권 빼고) · 금액 > 0 · 이름 있음 */
const isCountedPass = (r: RegRow, branch: string): boolean =>
  r.branch === branch &&
  (r.kind === "new" || r.kind === "renew") &&
  amountOf(r.amount) > 0 &&
  isPassProduct(r.product) &&
  productMonths(r.product) !== 0 &&
  normName(r.member) !== "";

/** 한 지점의 줄로 재등록률 · 회원별 결제 요약 */
export function computeLeaderKpi(rows: readonly RegRow[], branch: string, today: string): { kpi: LeaderKpi; members: KpiMember[] } {
  const mine = rows.filter((r) => isCountedPass(r, branch));

  const byName = new Map<string, RegRow[]>();
  for (const r of mine) {
    const k = normName(r.member);
    const list = byName.get(k);
    if (list) list.push(r);
    else byName.set(k, [r]);
  }

  const cohorts: Cohort[] = [];
  const members: KpiMember[] = [];
  for (const [name, list] of byName) {
    list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const first = list[0];
    const later = list.find((r) => r.day > first.day) ?? null;
    members.push({
      name,
      firstPaid: first.day,
      lastPaid: list[list.length - 1].day,
      paidCount: list.length,
      firstTerm: first.kind === "new" && later === null,
    });
    if (first.kind !== "new") continue; // 이 기간 앞에 이미 결제한 회원 — 신규가 아니다
    const months = productMonths(first.product);
    cohorts.push({
      name,
      first: first.day,
      end: months && months > 0 ? addDays(first.day, months * 30) : null,
      renewDay: later?.day ?? null,
    });
  }

  const monthOf = (c: Cohort) => (c.end ? c.end.slice(0, 7) : null);
  const agg = (month: string): KpiMonth => {
    const list = cohorts.filter((c) => monthOf(c) === month);
    return {
      month,
      n: list.length,
      renewed30: list.filter((c) => c.end && c.renewDay && c.renewDay <= addDays(c.end, GRACE_DAYS)).length,
      renewed: list.filter((c) => c.renewDay).length,
      open: list.filter((c) => !c.renewDay && c.end && c.end >= today).length,
      expiredOpen: list.filter((c) => !c.renewDay && c.end && c.end < today).length,
    };
  };

  const thisMonth = today.slice(0, 7);
  const months: KpiMonth[] = [];
  for (let i = -RECENT_MONTHS; i <= 1; i++) months.push(agg(addMonths(thisMonth, i)));

  // 최근 6개월 — 끝나고 30일이 지나 결과가 정해진 신규만
  const recentFrom = addDays(today, -(GRACE_DAYS + 183));
  const complete = cohorts.filter((c) => c.end && addDays(c.end, GRACE_DAYS) <= today && c.end >= recentFrom);
  const renewed30 = complete.filter((c) => c.renewDay && c.end && c.renewDay <= addDays(c.end, GRACE_DAYS)).length;

  const halfYearAgo = addDays(today, -182);
  const newRecent = cohorts.filter((c) => c.first >= halfYearAgo).length;

  const yearAgo = addDays(today, -365);
  const renewAmounts = mine.filter((r) => r.kind === "renew" && r.day >= yearAgo).map((r) => amountOf(r.amount));

  return {
    kpi: {
      branch,
      today,
      recent: {
        months: RECENT_MONTHS,
        n: complete.length,
        renewed30,
        rate: complete.length > 0 ? Math.round((renewed30 / complete.length) * 1000) / 10 : null,
      },
      current: agg(thisMonth),
      next: agg(addMonths(thisMonth, 1)),
      months,
      newPerMonth: Math.round((newRecent / 6) * 10) / 10,
      avgRenewAmount: renewAmounts.length > 0 ? Math.round(renewAmounts.reduce((a, b) => a + b, 0) / renewAmounts.length) : null,
      graceDays: GRACE_DAYS,
    },
    members,
  };
}

// ─── 재등록률(전체) — 관장님 홈 숫자 (2026-11-26 대표님 「추천대로」 · docs/features/69) ───────────
//   · 같은 회원 · 같은 날 결제는 하나로 합친다(개월 합).
//   · 끝나는 날 = 시작 + 개월 × 30일. 앞 수강권이 아직 안 끝났을 때 산 것은 그 끝 다음부터 이어 붙인다(브로제이 연장과 같게).
//   · 재등록 = 그 결제 다음 결제가 끝나는 날 + 30일 안(끝나기 전에 미리 산 것 포함).
//   · 한 회원이 같은 달에 두 번 끝나면 그 달 마지막 것 하나만 센다.
//   · 그 달 마지막 날 + 31일부터 확정(complete). 이름 대조라 추정 — 신규 재등록률과 같은 기준.

export interface RenewMonth {
  /** 수강권이 끝나는 달 'YYYY-MM' */
  month: string;
  /** 그 달에 끝나는 회원 */
  n: number;
  /** 끝나고 30일 안(전 포함) 다시 결제 */
  renewed30: number;
  /** 언제든 다시 결제 */
  renewed: number;
  /** 아직 안 끝남 · 다음 결제 없음 */
  open: number;
  /** 끝났고 30일이 아직 안 지남 · 다음 결제 없음 */
  waiting: number;
  /** 30일 안에 다시 결제하지 않음(늦은 재등록 포함) */
  lost: number;
  /** renewed30 ÷ n (%) */
  rate: number | null;
  /** 결과가 정해진 달인가 */
  complete: boolean;
  /** 확정되는 날 */
  settleOn: string;
}

export interface AllRenew {
  /** 지난달 — 관장님 홈 큰 숫자 */
  prev: RenewMonth;
  /** 그 전 달 — 화살표 비교 */
  prev2: RenewMonth;
  /** 이번 달 — 진행 중 */
  current: RenewMonth;
  /** 최근 6달 + 이번 달 */
  months: RenewMonth[];
  graceDays: number;
  basis: "sales-name";
}

/** 'YYYY-MM' 의 마지막 날 */
const monthEnd = (month: string): string => addDays(`${addMonths(month, 1)}-01`, -1);

/** 한 지점의 줄로 재등록률(전체 회원) */
export function computeAllRenew(rows: readonly RegRow[], branch: string, today: string): AllRenew {
  const byName = new Map<string, RegRow[]>();
  for (const r of rows) {
    if (!isCountedPass(r, branch)) continue;
    const k = normName(r.member);
    const list = byName.get(k);
    if (list) list.push(r);
    else byName.set(k, [r]);
  }

  const ends: { end: string; renewDay: string | null }[] = [];
  for (const list of byName.values()) {
    list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const days: { day: string; months: number | null }[] = [];
    for (const r of list) {
      const m = productMonths(r.product);
      const last = days[days.length - 1];
      if (last && last.day === r.day) {
        if (m && m > 0) last.months = (last.months ?? 0) + m;
      } else {
        days.push({ day: r.day, months: m && m > 0 ? m : null });
      }
    }
    const best = new Map<string, { end: string; renewDay: string | null }>();
    let prevEnd: string | null = null;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (!d.months) continue;
      const start = prevEnd && prevEnd > d.day ? prevEnd : d.day;
      const end = addDays(start, d.months * 30);
      prevEnd = end;
      const key = end.slice(0, 7);
      const cur = best.get(key);
      if (!cur || end >= cur.end) best.set(key, { end, renewDay: i + 1 < days.length ? days[i + 1].day : null });
    }
    for (const v of best.values()) ends.push(v);
  }

  const r30 = (e: { end: string; renewDay: string | null }) => e.renewDay !== null && e.renewDay <= addDays(e.end, GRACE_DAYS);
  const agg = (month: string): RenewMonth => {
    const list = ends.filter((e) => e.end.slice(0, 7) === month);
    const n = list.length;
    const renewed30 = list.filter(r30).length;
    const settleOn = addDays(monthEnd(month), GRACE_DAYS + 1);
    return {
      month,
      n,
      renewed30,
      renewed: list.filter((e) => e.renewDay !== null).length,
      open: list.filter((e) => e.renewDay === null && e.end >= today).length,
      waiting: list.filter((e) => e.renewDay === null && e.end < today && addDays(e.end, GRACE_DAYS) >= today).length,
      lost: list.filter((e) => !r30(e) && addDays(e.end, GRACE_DAYS) < today).length,
      rate: n > 0 ? Math.round((renewed30 / n) * 1000) / 10 : null,
      complete: settleOn <= today,
      settleOn,
    };
  };

  const thisMonth = today.slice(0, 7);
  const months: RenewMonth[] = [];
  for (let i = -RECENT_MONTHS; i <= 0; i++) months.push(agg(addMonths(thisMonth, i)));
  return {
    prev: months[RECENT_MONTHS - 1],
    prev2: months[RECENT_MONTHS - 2],
    current: months[RECENT_MONTHS],
    months,
    graceDays: GRACE_DAYS,
    basis: "sales-name",
  };
}

/** 앱 회원과 맞추기 — 같은 지점에서 이름이 하나뿐인 회원만(겹치면 넣지 않는다) */
export function matchMembers(
  members: readonly KpiMember[],
  profiles: readonly { user_id: string; name: string | null }[],
): { userId: string; member: KpiMember }[] {
  const byName = new Map<string, string[]>();
  for (const p of profiles) {
    const k = normName(p.name);
    if (!k) continue;
    const list = byName.get(k);
    if (list) list.push(p.user_id);
    else byName.set(k, [p.user_id]);
  }
  const out: { userId: string; member: KpiMember }[] = [];
  for (const m of members) {
    const ids = byName.get(m.name);
    if (ids && ids.length === 1) out.push({ userId: ids[0], member: m });
  }
  return out;
}
