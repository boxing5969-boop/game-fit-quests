/**
 * 153운영본부 · 근무 — 계약서 (2026-11-03 대표님 "코치님들 계약서 작성해야하는데 계약서 작성 기능 만들어줘")
 *
 *   고른 방식: 앱에서 서명(대표님이 근무자 카드에서 만들어 서명해 보냄 → 코치님이 앱에서 읽고 손가락 서명 · 둘 다 PDF)
 *   양식: 고용노동부 표준근로계약서 — 기간의 정함이 없는 경우 · 있는 경우 · 단시간근로자(1주 40시간 미만) + PT 업무위탁 계약서
 *   근무자 카드(형태 · 시급/월급 · 기간) · 시간표(ops_shift_rules) · PT 수당표(ops_pt_rates)로 채우고 '특약' 칸을 둔다.
 *
 *   여기는 값 채우기 · 글 만들기 · 점검만 — 서버(ops_contract_send)는 보낸 글(doc)을 그대로 얼려 지문(sha256)을 남기고,
 *   서명 · 권한을 맡는다. 글은 보낼 때의 이 파일 결과이므로, 나중에 이 파일을 고쳐도 이미 보낸 계약서는 바뀌지 않는다.
 *   근로기준법 17조(근로조건 명시) 필수 항목: 임금(구성 · 계산 · 지급방법) · 소정근로시간 · 휴일 · 연차유급휴가 · 근무 장소 · 업무,
 *   단시간이면 근로일과 근로일별 근로시간(기간제법 17조), 기간제면 계약 기간.
 */
import { OPS_WEEKDAY, fmtDuration, fmtWon, hmToMin, minWageOn, type OpsKind, type OpsRule, type OpsStaff } from "./opsWork";
import type { OpsPtRate } from "./opsPt";

export type ContractKind = "labor" | "freelance";
export type ContractStatus = "sent" | "signed" | "void";

export interface ContractSeg {
  start: string; // "HH:MM"
  end: string;
}

/** 근로일 하루 — 이어지는 구간 여러 개(사이는 휴게) + 구간 안 휴게(분) */
export interface ContractDay {
  weekday: number; // 0 = 일요일
  segs: ContractSeg[];
  breakMin: number;
}

export interface LaborTerms {
  kind: "labor";
  v: 1;
  workerName: string;
  start: string; // 근로개시일 YYYY-MM-DD
  end: string | null; // 기간제면 끝나는 날
  probationMonths: number; // 0~3 (수습 기간에도 임금 감액 없음)
  place: string;
  duties: string;
  days: ContractDay[];
  weeklyHoliday: number | null; // 주휴일 요일
  payType: "hourly" | "monthly";
  wage: number;
  bonus: number | null; // 상여금 (null = 없음)
  extras: string; // 기타급여(제수당) 내역 — 빈칸이면 없음
  overtimeRate: number; // 단시간 초과근로 가산임금률 %
  payDay: number; // 매월 N일 (31 = 말일)
  payMethod: "account" | "direct";
  insurance: { employment: boolean; accident: boolean; pension: boolean; health: boolean };
  special: string; // 특약
}

export interface FreelanceRate {
  team: number; // 1 = 1:1, 4 = 4인 팀
  sessions: number; // 수업권 횟수 (10 · 20)
  rate: number; // 1회 금액 (팀은 팀 1회)
}

export interface FreelanceTerms {
  kind: "freelance";
  v: 1;
  workerName: string;
  start: string;
  end: string | null;
  place: string;
  duties: string;
  feeType: "per_session" | "monthly";
  rates: FreelanceRate[];
  monthlyFee: number | null;
  payDay: number;
  special: string;
}

export type ContractTerms = LaborTerms | FreelanceTerms;

export interface ContractEmployer {
  biz_name: string;
  owner_name: string;
  biz_number: string;
  address: string;
  phone: string;
  sign: string | null;
  updated_at?: string;
}

export interface ContractDocItem {
  head: string;
  lines: string[];
  table?: { head: string[]; rows: string[][] };
}

/** 보내는 글 그대로 (서버가 얼려 지문을 남긴다) */
export interface ContractDoc {
  v: 1;
  kind: ContractKind;
  title: string;
  basis: string;
  intro: string;
  items: ContractDocItem[];
  date: string; // 계약일 YYYY-MM-DD
  employer: { label: string; rows: Array<[string, string]>; owner: string };
  worker: { label: string; name: string };
}

// ───────────────────────── 글 조각 ─────────────────────────

/** "2026-11-10" → "2026년 11월 10일" */
export const krDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

/** 받침에 맞는 조사 — 한글이 아니면 둘 다 "과(와)" */
export const josa = (word: string, withFinal: string, withoutFinal: string): string => {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (!ch || code < 0 || code > 11171) return `${withFinal}(${withoutFinal})`;
  return code % 28 === 0 ? withoutFinal : withFinal;
};

/** 월요일부터 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const weekSort = (a: number, b: number) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b);

export const segMin = (s: ContractSeg) => Math.max(0, hmToMin(s.end) - hmToMin(s.start));
/** 그날 근로시간(분) = 구간 합 − 구간 안 휴게 */
export const dayWorkMin = (d: ContractDay) => Math.max(0, d.segs.reduce((s, x) => s + segMin(x), 0) - Math.max(0, d.breakMin));
export const weeklyWorkMin = (days: ContractDay[]) => days.reduce((s, d) => s + dayWorkMin(d), 0);
/** 단시간근로자 — 1주 소정근로시간이 통상근로자(40시간)보다 짧다 */
export const isShortTime = (days: ContractDay[]) => weeklyWorkMin(days) < 40 * 60;
/** 주휴 시간(분) — 주 15시간 이상이면 (주 시간 ÷ 40) × 8시간, 8시간까지 */
export const weeklyHolidayMin = (weeklyMin: number) =>
  weeklyMin < 15 * 60 ? 0 : Math.min(8 * 60, Math.round((weeklyMin / (40 * 60)) * 8 * 60));
/** 월 소정근로시간(유급 주휴 포함) = (주 시간 + 주휴) × 365 ÷ 7 ÷ 12 — 주 40시간이면 209시간 */
export const monthlyPaidHours = (weeklyMin: number) => (((weeklyMin + weeklyHolidayMin(weeklyMin)) / 60) * 365) / 7 / 12;
/** 시급으로 바꾼 임금 (월급 ÷ 월 소정근로시간) */
export const hourlyEquivalent = (t: Pick<LaborTerms, "payType" | "wage" | "days">) => {
  if (t.payType === "hourly") return t.wage;
  const h = monthlyPaidHours(weeklyWorkMin(t.days));
  return h > 0 ? t.wage / h : 0;
};
/** 법이 정한 휴게(분) — 이어서 4시간이면 30분, 8시간이면 1시간 (근로기준법 54조) */
export const requiredBreakMin = (d: ContractDay) => {
  const longest = Math.max(0, ...d.segs.map(segMin));
  return longest >= 480 ? 60 : longest >= 240 ? 30 : 0;
};
/** 한 달 근로시간(대략) — 4대보험 기준 월 60시간 */
export const monthlyWorkHours = (weeklyMin: number) => (weeklyMin / 60) * 4.345;

const dayOrder = (days: ContractDay[]) => [...days].filter((d) => d.segs.length > 0).sort((a, b) => weekSort(a.weekday, b.weekday));

/** 시간표(ops_shift_rules) → 근로일 — 그날 쓰는 시간표, 없으면 앞으로 시작할 시간표 */
export const daysFromRules = (staffId: string, rules: OpsRule[], date: string): ContractDay[] => {
  const mine = rules.filter((r) => r.staff_id === staffId);
  let use = mine.filter((r) => r.valid_from <= date && (!r.valid_to || r.valid_to >= date));
  if (use.length === 0) {
    const next = mine.filter((r) => r.valid_from > date && !r.valid_to).map((r) => r.valid_from).sort()[0];
    use = next ? mine.filter((r) => r.valid_from === next) : [];
  }
  const byDay = new Map<number, ContractSeg[]>();
  for (const r of use) byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), { start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }]);
  return [...byDay.entries()]
    .map(([weekday, segs]) => {
      const sorted = segs.sort((a, b) => a.start.localeCompare(b.start));
      const day: ContractDay = { weekday, segs: sorted, breakMin: 0 };
      day.breakMin = requiredBreakMin(day);
      return day;
    })
    .sort((a, b) => weekSort(a.weekday, b.weekday));
};

/** 주휴일 기본 — 일하지 않는 날 중 일요일 먼저 */
export const defaultWeeklyHoliday = (days: ContractDay[]): number | null => {
  const work = new Set(days.filter((d) => d.segs.length > 0).map((d) => d.weekday));
  return [0, 6, 5, 4, 3, 2, 1].find((w) => !work.has(w)) ?? null;
};

export const defaultInsurance = (days: ContractDay[]) => {
  const all = monthlyWorkHours(weeklyWorkMin(days)) >= 60;
  return { employment: all, accident: true, pension: all, health: all };
};

/** 이 근무자에게 필요한 계약서 — 무급 도우미는 없음 · 프리랜서는 위탁 · PT 따로 하는 코치는 근로 + PT 위탁 */
export const contractNeeds = (s: Pick<OpsStaff, "kind" | "pt_freelancer">): ContractKind[] =>
  s.kind === "volunteer" ? [] : s.kind === "freelancer" ? ["freelance"] : s.pt_freelancer ? ["labor", "freelance"] : ["labor"];

export const DEFAULT_DUTIES = "복싱 수업 지도 · 회원 관리 · 체육관 운영 보조";
export const DEFAULT_PT_DUTIES = "PT(1:1 · 소그룹) 수업 진행";

const placeOf = (branch: string, emp: ContractEmployer | null) => {
  const name = emp?.biz_name?.trim() || branch;
  return emp?.address?.trim() ? `${name} (${emp.address.trim()})` : name;
};

/** 같은 팀 크기 · 횟수 중 가장 최근 수당 */
export const latestRates = (rates: OpsPtRate[], date: string): FreelanceRate[] => {
  const pick = new Map<string, OpsPtRate>();
  for (const r of rates) {
    if (r.valid_from > date) continue;
    const k = `${r.team_size}:${r.sessions}`;
    const cur = pick.get(k);
    if (!cur || cur.valid_from < r.valid_from) pick.set(k, r);
  }
  return [...pick.values()]
    .sort((a, b) => a.team_size - b.team_size || a.sessions - b.sessions)
    .map((r) => ({ team: r.team_size, sessions: r.sessions, rate: r.session_rate }));
};

// ───────────────────────── 미리 채우기 ─────────────────────────

export interface ContractPrefill {
  branch: string;
  staff: OpsStaff;
  rules: OpsRule[];
  employer: ContractEmployer | null;
  today: string;
  lastLabor?: Partial<LaborTerms> | null;
  lastFreelance?: Partial<FreelanceTerms> | null;
  ptRates?: OpsPtRate[];
}

const startOf = (staff: OpsStaff, today: string) => staff.start_date || today;
const endOf = (staff: OpsStaff, start: string) => (staff.end_date && staff.end_date >= start ? staff.end_date : null);
const okDay = (n: unknown, fallback: number) => (typeof n === "number" && n >= 1 && n <= 31 ? Math.round(n) : fallback);
const text = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

export const defaultLaborTerms = (p: ContractPrefill): LaborTerms => {
  const { staff } = p;
  const start = startOf(staff, p.today);
  const days = daysFromRules(staff.id, p.rules, start > p.today ? start : p.today);
  const monthly = staff.pay_type === "monthly";
  return {
    kind: "labor",
    v: 1,
    workerName: staff.name,
    start,
    end: endOf(staff, start),
    probationMonths: (staff.kind as OpsKind) === "intern" ? 3 : 0,
    place: placeOf(p.branch, p.employer),
    duties: text(p.lastLabor?.duties, DEFAULT_DUTIES),
    days,
    weeklyHoliday: defaultWeeklyHoliday(days),
    payType: monthly ? "monthly" : "hourly",
    wage: (monthly ? staff.monthly_salary : staff.hourly_wage) ?? 0,
    bonus: null,
    extras: "",
    overtimeRate: 50,
    payDay: okDay(p.lastLabor?.payDay, 10),
    payMethod: p.lastLabor?.payMethod === "direct" ? "direct" : "account",
    insurance: defaultInsurance(days),
    special: "",
  };
};

export const defaultFreelanceTerms = (p: ContractPrefill): FreelanceTerms => {
  const { staff } = p;
  const start = startOf(staff, p.today);
  const rates = latestRates(p.ptRates ?? [], start > p.today ? start : p.today);
  const monthly = staff.kind === "freelancer" && staff.pay_type === "monthly";
  return {
    kind: "freelance",
    v: 1,
    workerName: staff.name,
    start,
    end: endOf(staff, start),
    place: placeOf(p.branch, p.employer),
    duties: text(p.lastFreelance?.duties, staff.pt_freelancer || rates.length > 0 ? DEFAULT_PT_DUTIES : ""),
    feeType: monthly || rates.length === 0 ? "monthly" : "per_session",
    rates,
    monthlyFee: monthly ? staff.monthly_salary : null,
    payDay: okDay(p.lastFreelance?.payDay, 10),
    special: "",
  };
};

// ───────────────────────── 글 만들기 ─────────────────────────

const ins = (on: boolean) => (on ? "적용" : "적용 안 함");
const payDayText = (n: number) => (n >= 31 ? "말일" : `${n}일`);
const cleanLines = (s: string, max = 20) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);

/** 하루 표 한 줄 — 요일 · 시업 · 종업 · 휴게 · 근로시간 */
export const dayRow = (d: ContractDay): string[] => {
  const segs = [...d.segs].sort((a, b) => a.start.localeCompare(b.start));
  const gaps: string[] = [];
  for (let i = 1; i < segs.length; i++) if (hmToMin(segs[i].start) > hmToMin(segs[i - 1].end)) gaps.push(`${segs[i - 1].end}~${segs[i].start}`);
  const rest = [...gaps, ...(d.breakMin > 0 ? [`근무 중 ${fmtDuration(d.breakMin)}`] : [])];
  return [
    `${OPS_WEEKDAY[d.weekday]}요일`,
    segs[0]?.start ?? "",
    segs[segs.length - 1]?.end ?? "",
    rest.length ? rest.join(" · ") : "없음",
    fmtDuration(dayWorkMin(d)),
  ];
};

export const laborTitle = (t: LaborTerms) => (isShortTime(t.days) ? "단시간근로자 표준근로계약서" : "표준근로계약서");
export const contractTitle = (t: ContractTerms) => (t.kind === "labor" ? laborTitle(t) : "업무위탁 계약서");
/** 목록 · 알림에 쓰는 짧은 이름 */
export const contractShortName = (kind: ContractKind) => (kind === "labor" ? "근로계약서" : "업무위탁 계약서");

const employerBlock = (emp: ContractEmployer, label: string): ContractDoc["employer"] => ({
  label,
  rows: (
    [
      ["사업체명", emp.biz_name.trim()],
      ["전화", emp.phone.trim()],
      ["사업자등록번호", emp.biz_number.trim()],
      ["주소", emp.address.trim()],
    ] as Array<[string, string]>
  ).filter(([k, v]) => k === "사업체명" || v),
  owner: emp.owner_name.trim(),
});

export const buildLaborDoc = (t: LaborTerms, emp: ContractEmployer, date: string): ContractDoc => {
  const days = dayOrder(t.days);
  const weekly = weeklyWorkMin(days);
  const short = weekly < 40 * 60;
  const under15 = weekly < 15 * 60;
  const biz = emp.biz_name.trim();
  const name = t.workerName.trim();
  const items: ContractDocItem[] = [];

  items.push({
    head: t.end ? "근로계약기간" : "근로개시일",
    lines: [
      t.end ? `${krDate(t.start)}부터 ${krDate(t.end)}까지` : `${krDate(t.start)}부터`,
      ...(t.probationMonths > 0 ? [`수습기간: 근로개시일부터 ${t.probationMonths}개월 (수습기간에도 임금은 아래와 같음)`] : []),
    ],
  });
  items.push({ head: "근무장소", lines: [t.place.trim()] });
  items.push({ head: "업무의 내용", lines: [t.duties.trim()] });
  items.push({
    head: short ? "근로일 및 근로일별 근로시간" : "소정근로시간 · 근무일",
    lines: [
      `1주 소정근로시간: ${fmtDuration(weekly)}${short ? "" : ` (매주 ${days.length}일 근무)`}`,
      under15
        ? "주휴일: 없음 (1주 소정근로시간 15시간 미만)"
        : `주휴일: 매주 ${t.weeklyHoliday == null ? "" : `${OPS_WEEKDAY[t.weeklyHoliday]}요일`}`,
    ],
    table: { head: ["근로일", "시업", "종업", "휴게시간", "근로시간"], rows: days.map(dayRow) },
  });

  const wageLines = [
    t.payType === "hourly" ? `시간급: ${fmtWon(t.wage)}` : `월급: ${fmtWon(t.wage)}`,
    t.payType === "hourly"
      ? `계산: 매월 1일부터 말일까지 근로한 시간 × 시간급${under15 ? "" : " + 주휴수당(1주 소정근로일을 개근한 주)"}`
      : `계산: 월 단위${under15 ? "" : " (주휴수당 포함)"} — 월 중간에 시작하거나 끝나면 날짜 수로 나눠 계산`,
    t.bonus && t.bonus > 0 ? `상여금: 있음 (${fmtWon(t.bonus)})` : "상여금: 없음",
    t.extras.trim() ? `기타급여(제수당 등): 있음 — ${t.extras.trim()}` : "기타급여(제수당 등): 없음",
    ...(short ? [`초과근로에 대한 가산임금률: ${t.overtimeRate}%`] : []),
    "연장 · 야간 · 휴일 근로: 근로기준법에서 정하는 바에 따라 지급",
    `임금지급일: 매월 ${payDayText(t.payDay)} (휴일이면 전날 지급)`,
    `지급방법: ${t.payMethod === "account" ? "근로자 명의 예금통장에 입금" : "근로자에게 직접 지급"}`,
  ];
  items.push({ head: "임금", lines: wageLines });
  items.push({
    head: "연차유급휴가",
    lines: [
      under15
        ? "1주 소정근로시간이 15시간 미만이어서 연차유급휴가는 적용하지 않음 (근로기준법 제18조 제3항)"
        : short
          ? "통상근로자의 근로시간에 비례하여 연차유급휴가 부여"
          : "연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함",
    ],
  });
  items.push({
    head: "사회보험 적용여부",
    lines: [
      `고용보험 ${ins(t.insurance.employment)} · 산재보험 ${ins(t.insurance.accident)} · 국민연금 ${ins(t.insurance.pension)} · 건강보험 ${ins(t.insurance.health)}`,
    ],
  });
  items.push({
    head: "근로계약서 교부",
    lines: [
      "사업주는 근로계약을 체결함과 동시에 본 계약서 사본을 근로자의 교부 요구와 관계없이 근로자에게 교부함 (근로기준법 제17조 이행)",
      "이 계약서는 전자문서로 작성 · 서명하며, 근로자는 마이복서153 앱에서 언제든지 보고 내려받을 수 있음",
    ],
  });
  items.push({
    head: "근로계약, 취업규칙 등의 성실한 이행의무",
    lines: ["사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함"],
  });
  const special = cleanLines(t.special);
  if (special.length) items.push({ head: "특약", lines: special });
  items.push({ head: "기타", lines: ["이 계약에 정함이 없는 사항은 근로기준법령에 의함"] });

  return {
    v: 1,
    kind: "labor",
    title: laborTitle({ ...t, days }),
    basis: short
      ? "고용노동부 표준근로계약서(단시간근로자) 양식"
      : t.end
        ? "고용노동부 표준근로계약서(기간의 정함이 있는 경우) 양식"
        : "고용노동부 표준근로계약서(기간의 정함이 없는 경우) 양식",
    intro: `${biz}(이하 "사업주"라 함)${josa(biz, "과", "와")} ${name}(이하 "근로자"라 함)${josa(name, "은", "는")} 다음과 같이 근로계약을 체결한다.`,
    items,
    date,
    employer: employerBlock(emp, "사업주"),
    worker: { label: "근로자", name },
  };
};

export const buildFreelanceDoc = (t: FreelanceTerms, emp: ContractEmployer, date: string): ContractDoc => {
  const biz = emp.biz_name.trim();
  const name = t.workerName.trim();
  const items: ContractDocItem[] = [];
  items.push({
    head: "목적",
    lines: ["위탁자는 아래 업무를 수탁자에게 맡기고, 수탁자는 독립된 사업자로서 자기 책임과 판단으로 업무를 수행한다"],
  });
  items.push({ head: "위탁 업무", lines: [t.duties.trim(), `장소: ${t.place.trim()}`] });
  items.push({
    head: "계약 기간",
    lines: [
      t.end
        ? `${krDate(t.start)}부터 ${krDate(t.end)}까지`
        : `${krDate(t.start)}부터 (기간을 정하지 않음 — 어느 한쪽이 30일 전에 알리면 끝낼 수 있음)`,
    ],
  });
  const rates = t.rates.filter((r) => r.rate > 0);
  items.push(
    t.feeType === "per_session"
      ? {
          head: "수수료",
          lines: [
            "수업 1회당 아래 금액 (팀 수업은 팀 1회 금액을 정원으로 나눠, 수업권이 차감된 팀원 1명마다 지급)",
            `지급: 매월 1일부터 말일까지 진행한 수업을 모아 다음 달 ${payDayText(t.payDay)}에 지급`,
            "지급할 때 사업소득세(3%)와 지방소득세(0.3%)를 원천징수함",
          ],
          table: {
            head: ["수업권", "1회 금액", "1명 차감당"],
            rows: rates.map((r) => [
              `${r.team === 1 ? "1:1" : `${r.team}인 팀`} · ${r.sessions}회권`,
              fmtWon(r.rate),
              fmtWon(Math.round(r.rate / Math.max(1, r.team))),
            ]),
          },
        }
      : {
          head: "수수료",
          lines: [
            `월 위탁 수수료: ${fmtWon(t.monthlyFee ?? 0)}`,
            `지급: 매월 ${payDayText(t.payDay)}에 지난달 몫을 지급`,
            "지급할 때 사업소득세(3%)와 지방소득세(0.3%)를 원천징수함",
          ],
        },
  );
  items.push({
    head: "업무 수행",
    lines: [
      "수탁자는 회원과 협의하여 수업 일정과 방법을 스스로 정한다",
      "위탁자는 시설과 장비를 제공하고, 회원 안전과 시설 이용 규칙을 안내할 수 있다",
    ],
  });
  items.push({
    head: "비밀 유지 · 개인정보",
    lines: ["수탁자는 업무 중 알게 된 회원의 개인정보와 위탁자의 영업 정보를 업무 외에 쓰거나 다른 사람에게 알리지 않는다. 계약이 끝난 뒤에도 같다"],
  });
  items.push({
    head: "계약 해지",
    lines: ["어느 한쪽이 이 계약을 지키지 않으면 상대방은 고칠 것을 요구할 수 있고, 14일 안에 고쳐지지 않으면 계약을 해지할 수 있다"],
  });
  const special = cleanLines(t.special);
  if (special.length) items.push({ head: "특약", lines: special });
  items.push({
    head: "기타",
    lines: [
      "이 계약에 정하지 않은 사항은 관련 법령과 일반 관례에 따른다",
      "이 계약서는 전자문서로 작성 · 서명하며, 두 당사자는 마이복서153 앱에서 언제든지 보고 내려받을 수 있다",
    ],
  });
  return {
    v: 1,
    kind: "freelance",
    title: "업무위탁 계약서",
    basis: "업무위탁(프리랜서) 계약 · 사업소득 3.3% 원천징수",
    intro: `${biz}(이하 "위탁자"라 함)${josa(biz, "과", "와")} ${name}(이하 "수탁자"라 함)${josa(name, "은", "는")} 다음과 같이 업무위탁 계약을 체결한다.`,
    items,
    date,
    employer: employerBlock(emp, "위탁자"),
    worker: { label: "수탁자", name },
  };
};

export const buildContractDoc = (t: ContractTerms, emp: ContractEmployer, date: string): ContractDoc =>
  t.kind === "labor" ? buildLaborDoc(t, emp, date) : buildFreelanceDoc(t, emp, date);

// ───────────────────────── 점검 ─────────────────────────

export interface ContractCheck {
  /** 고쳐야 보낼 수 있다 */
  errors: string[];
  /** 알아 두기 (보낼 수는 있다) */
  warns: string[];
}

const PENALTY_RE = /위약금|벌금|배상|변상|손해/;
const DEDUCT_RE = /공제|차감|떼고|빼고/;
/** 법으로 떼는 것(4대보험료 · 세금)은 괜찮다 */
const LEGAL_DEDUCT_RE = /4대\s*보험|보험료|소득세|세금|원천징수/;
const SEVERANCE_RE = /퇴직금/;

export const employerReady = (emp: ContractEmployer | null | undefined): emp is ContractEmployer =>
  !!emp && !!emp.biz_name.trim() && !!emp.owner_name.trim() && !!emp.sign;

const validDate = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const checkLabor = (t: LaborTerms, ctx: { hasRules?: boolean } = {}): ContractCheck => {
  const errors: string[] = [];
  const warns: string[] = [];
  const days = dayOrder(t.days);
  const weekly = weeklyWorkMin(days);

  if (!t.workerName.trim()) errors.push("근로자 이름을 넣어 주세요");
  if (!validDate(t.start)) errors.push("근로개시일을 넣어 주세요");
  if (t.end != null && (!validDate(t.end) || t.end < t.start)) errors.push("끝나는 날이 시작일보다 앞이에요");
  if (!t.place.trim()) errors.push("근무장소를 넣어 주세요");
  if (!t.duties.trim()) errors.push("업무의 내용을 넣어 주세요");
  if (days.length === 0) errors.push("근로일과 근로시간을 넣어 주세요");
  for (const d of days) {
    const segs = [...d.segs].sort((a, b) => a.start.localeCompare(b.start));
    if (segs.some((s) => segMin(s) <= 0)) errors.push(`${OPS_WEEKDAY[d.weekday]}요일 끝나는 시각이 시작보다 늦어야 해요`);
    else if (segs.some((s, i) => i > 0 && hmToMin(s.start) < hmToMin(segs[i - 1].end))) errors.push(`${OPS_WEEKDAY[d.weekday]}요일 시간이 겹쳐요`);
    else if (dayWorkMin(d) <= 0) errors.push(`${OPS_WEEKDAY[d.weekday]}요일 휴게가 근무 시간보다 길어요`);
  }
  if (weekly >= 15 * 60) {
    if (t.weeklyHoliday == null) errors.push("주휴일(쉬는 날)을 골라 주세요");
    else if (days.some((d) => d.weekday === t.weeklyHoliday)) errors.push("주휴일은 일하지 않는 요일이어야 해요");
    if (days.length >= 7) errors.push("1주에 쉬는 날이 하루는 있어야 해요");
  }
  if (!(t.wage > 0)) errors.push(t.payType === "hourly" ? "시간급을 넣어 주세요" : "월급을 넣어 주세요");
  else if (days.length > 0) {
    const eq = hourlyEquivalent({ payType: t.payType, wage: t.wage, days });
    const min = validDate(t.start) ? minWageOn(t.start) : minWageOn("2026-01-01");
    if (eq < min)
      errors.push(
        t.payType === "hourly"
          ? `시간급이 그해 최저시급(${fmtWon(min)})보다 낮아요`
          : `월급이 최저임금보다 낮아요 — 시급으로 ${fmtWon(Math.floor(eq))} (최저 ${fmtWon(min)})`,
      );
    else {
      const next = minWageOn("2027-01-01");
      const reaches2027 = !t.end || t.end >= "2027-01-01";
      if (t.start < "2027-01-01" && reaches2027 && eq < next) warns.push(`2027년 1월부터 최저시급은 ${fmtWon(next)}이에요 — 그때 임금을 올려 주세요`);
    }
  }
  if (!(t.payDay >= 1 && t.payDay <= 31)) errors.push("임금지급일을 골라 주세요");
  if (t.probationMonths < 0 || t.probationMonths > 3) errors.push("수습기간은 3개월까지예요");
  if (t.overtimeRate < 0 || t.overtimeRate > 200) errors.push("가산임금률이 이상해요");

  for (const d of days) {
    const need = requiredBreakMin(d);
    if (need > 0 && d.breakMin < need) {
      warns.push(`${OPS_WEEKDAY[d.weekday]}요일 — 이어서 ${need === 60 ? "8" : "4"}시간 일하면 휴게 ${need}분 이상이 필요해요 (근로기준법 54조)`);
    }
    if (dayWorkMin(d) > 8 * 60) warns.push(`${OPS_WEEKDAY[d.weekday]}요일 — 하루 8시간을 넘는 부분은 연장근로예요`);
  }
  if (weekly > 40 * 60) warns.push("1주 40시간을 넘는 부분은 연장근로예요 (상시 5인 이상이면 50% 가산)");
  const special = t.special;
  if (PENALTY_RE.test(special)) warns.push("특약 — 위약금 · 손해배상 금액을 미리 정하는 약정은 무효예요 (근로기준법 20조)");
  if (DEDUCT_RE.test(special) && !LEGAL_DEDUCT_RE.test(special))
    warns.push("특약 — 임금에서 마음대로 빼는 약정은 안 돼요 (임금 전액 지급 · 근로기준법 43조)");
  if (SEVERANCE_RE.test(special)) warns.push("특약 — 퇴직금을 미리 나눠 주는 약정은 무효예요 (퇴직할 때 따로 지급)");
  if (ctx.hasRules === false && days.length > 0) warns.push("근무자 카드에 시간표가 없어요 — 계약서 시간과 같게 시간표도 넣어 주세요");
  return { errors: [...new Set(errors)], warns: [...new Set(warns)] };
};

export const checkFreelance = (t: FreelanceTerms, ctx: { staffKind?: OpsKind; hasRules?: boolean } = {}): ContractCheck => {
  const errors: string[] = [];
  const warns: string[] = [];
  if (!t.workerName.trim()) errors.push("수탁자 이름을 넣어 주세요");
  if (!validDate(t.start)) errors.push("시작일을 넣어 주세요");
  if (t.end != null && (!validDate(t.end) || t.end < t.start)) errors.push("끝나는 날이 시작일보다 앞이에요");
  if (!t.duties.trim()) errors.push("맡기는 업무를 넣어 주세요");
  if (!t.place.trim()) errors.push("장소를 넣어 주세요");
  if (t.feeType === "per_session") {
    const good = t.rates.filter((r) => r.rate > 0 && r.team >= 1 && r.sessions >= 1);
    if (good.length === 0) errors.push("수업 1회 금액을 넣어 주세요");
    if (t.rates.some((r) => !(r.rate > 0))) errors.push("금액이 비어 있는 줄이 있어요");
  } else if (!((t.monthlyFee ?? 0) > 0)) errors.push("월 위탁 수수료를 넣어 주세요");
  if (!(t.payDay >= 1 && t.payDay <= 31)) errors.push("지급일을 골라 주세요");
  // 근로자성 — 실제로 일하는 방식이 근로면 3.3% 계약서와 상관없이 근로자로 본다(대법원 2004다29736)
  if (t.feeType === "monthly")
    warns.push("매달 정한 금액을 받고 정한 시간에 일하면 근로자로 볼 수 있어요 — 그렇다면 근로계약서가 맞아요");
  if (ctx.staffKind === "freelancer" && ctx.hasRules)
    warns.push("시간표대로 출근하는 분이면 근로자로 볼 수 있어요 — 수업 시간 · 방법을 스스로 정하는 분께만 위탁 계약서를 써요");
  return { errors: [...new Set(errors)], warns: [...new Set(warns)] };
};

export const checkContract = (t: ContractTerms, ctx: { staffKind?: OpsKind; hasRules?: boolean } = {}): ContractCheck =>
  t.kind === "labor" ? checkLabor(t, ctx) : checkFreelance(t, ctx);

// ───────────────────────── 목록 · 상태 ─────────────────────────

export interface ContractBrief {
  id: string;
  staff_id: string;
  branch: string;
  kind: ContractKind;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: ContractStatus;
  sent_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  in_person: boolean;
  delivered_at: string | null;
  delivered_how: "app" | "pdf" | "paper" | null;
  void_at: string | null;
  void_reason: string | null;
  has_app: boolean;
}

/** 새 계약서로 바뀌어 무효가 된 것(서명 전)은 목록에서 뺀다 */
export const visibleContracts = (list: ContractBrief[]) =>
  list.filter((c) => !(c.status === "void" && !c.signed_at && c.void_reason === "새 계약서로 바꿈"));

export interface StaffContractState {
  /** 서명한 계약서가 없는 종류 (보낸 것도 없음) */
  missing: ContractKind[];
  /** 보냈는데 아직 서명 전 */
  waiting: ContractKind[];
  /** 대면 서명을 받았는데 사본을 아직 안 줌 */
  undelivered: ContractBrief[];
}

/** 근무자 한 사람 — 필요한 계약서가 지금 유효하게 서명돼 있나 */
export const staffContractState = (
  staff: Pick<OpsStaff, "id" | "kind" | "pt_freelancer">,
  list: ContractBrief[],
  today: string,
): StaffContractState => {
  const mine = list.filter((c) => c.staff_id === staff.id && c.status !== "void");
  const missing: ContractKind[] = [];
  const waiting: ContractKind[] = [];
  for (const k of contractNeeds(staff)) {
    const ok = mine.some((c) => c.kind === k && c.status === "signed" && (!c.end_date || c.end_date >= today));
    if (ok) continue;
    if (mine.some((c) => c.kind === k && c.status === "sent")) waiting.push(k);
    else missing.push(k);
  }
  const undelivered = mine.filter((c) => c.status === "signed" && !c.delivered_at);
  return { missing, waiting, undelivered };
};

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; cls: string }> = {
  sent: { label: "서명 기다림", cls: "bg-amber-100 text-amber-800" },
  signed: { label: "서명 완료", cls: "bg-primary/10 text-primary" },
  void: { label: "무효", cls: "bg-muted text-muted-foreground" },
};

/** "2026-11-03T09:40:00Z" → "11월 3일" (한국 시각) */
export const krShortDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).formatToParts(d);
  return `${p.find((x) => x.type === "month")?.value}월 ${p.find((x) => x.type === "day")?.value}일`;
};

/** "2026-11-03T09:40:00Z" → "2026-11-03 18:40" (한국 시각) */
export const krStamp = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return s.replace(",", "");
};

/** 계약 기간 한 줄 — "2026.11.10 ~" / "2026.11.10 ~ 2027.11.09" */
export const periodText = (start: string | null, end: string | null) => {
  const f = (s: string) => s.replace(/-/g, ".");
  if (!start) return "";
  return end ? `${f(start)} ~ ${f(end)}` : `${f(start)} ~`;
};

/** PDF 파일 이름 — 근로계약서_김코치_20261103.pdf */
export const contractFileName = (kind: ContractKind, name: string, date: string) =>
  `${contractShortName(kind).replace(/\s+/g, "")}_${(name || "근무자").replace(/[\\/:*?"<>|\s]+/g, "")}_${date.replace(/-/g, "")}.pdf`;
