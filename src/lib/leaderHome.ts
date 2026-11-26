/**
 * 🧭 지도자 홈 — 코치 · 관장 · 관리자 홈 맨 위 (2026-11-26 대표님 「추천대로 가자」 · 선릉역점만 · 앱 규칙 r_ad42f1de95)
 *   목표 = 신규 회원 재등록률 70% 이상 · 1순위 기간 임박 · 2순위 재미를 느끼기 어려운 신규.
 *   서버 leader_home(DB 20261126122904_leader_home.sql) JSON 읽기 · 줄 순서 · 칩 · 할 말 · 처방 · 재등록률 글.
 *   숫자는 서버 그대로, 글만 여기서. 시험 leaderHome.test.ts.
 */

export type LeaderRole = "coach" | "manager" | "admin";
export type LeaderTopic = "expiring" | "winback" | "starter";
export type ContactKind = "talk" | "notice" | "rx";
export type RxKey = "name" | "jab" | "promise" | "note" | "partner" | "level" | "other";
export type StarterReason = "first" | "behind" | "gap" | "slow";

export interface LeaderContact {
  id: string;
  kind: ContactKind;
  topic: LeaderTopic;
  rx: RxKey | null;
  at: string;
  by: string;
  mine: boolean;
}

export interface LeaderRow {
  userId: string;
  name: string;
  realName: string | null;
  avatarUrl: string | null;
  photoPath: string | null;
  firstTerm: boolean | null;
  firstDay: string | null;
  lastDay: string | null;
  total: number;
  v14: number;
  cameAt: string | null;
  here: boolean;
  end: string | null;
  contact: LeaderContact | null;
}

export interface ExpiringRow extends LeaderRow {
  daysLeft: number;
}
export interface WinbackRow extends LeaderRow {
  daysSince: number;
}
export interface StarterRow extends LeaderRow {
  day: number;
  count: number;
  expected: number;
  goal: number;
  gap: number;
  done8: boolean;
  reasons: StarterReason[];
}

export interface KpiMonth {
  month: string;
  n: number;
  renewed30: number;
  renewed: number;
  open: number;
  expiredOpen: number;
}

export interface LeaderKpi {
  rate: number | null;
  n: number;
  renewed30: number;
  current: KpiMonth | null;
  next: KpiMonth | null;
  newPerMonth: number | null;
  avgRenewAmount: number | null;
  computedAt: string | null;
  stale: boolean;
}

export interface LeaderCounts {
  expiring: number;
  expiringFirst: number;
  winback: number;
  starters: number;
  startersBehind: number;
  risk: number;
  here: number;
  active: number;
  photos: number;
  avatars: number;
  untouchedD3: number;
  todayContacts: number;
}

export interface LeaderTeamRow {
  staffUserId: string;
  name: string;
  talk: number;
  notice: number;
  rx: number;
  total: number;
}

export interface LeaderHomeData {
  on: boolean;
  role: LeaderRole | "none";
  branch: string | null;
  today: string | null;
  targetRate: number;
  conf: { expiringDays: number; winbackDays: number; starterDays: number; starterGoal: number; gapDays: number };
  expiring: ExpiringRow[];
  winback: WinbackRow[];
  starters: StarterRow[];
  counts: LeaderCounts;
  kpi: LeaderKpi | null;
  team: LeaderTeamRow[] | null;
  admin: { branches: { name: string; on: boolean }[]; syncAt: string | null } | null;
}

const ZERO_COUNTS: LeaderCounts = {
  expiring: 0,
  expiringFirst: 0,
  winback: 0,
  starters: 0,
  startersBehind: 0,
  risk: 0,
  here: 0,
  active: 0,
  photos: 0,
  avatars: 0,
  untouchedD3: 0,
  todayContacts: 0,
};

export const LEADER_OFF: LeaderHomeData = {
  on: false,
  role: "none",
  branch: null,
  today: null,
  targetRate: 70,
  conf: { expiringDays: 14, winbackDays: 30, starterDays: 28, starterGoal: 8, gapDays: 7 },
  expiring: [],
  winback: [],
  starters: [],
  counts: ZERO_COUNTS,
  kpi: null,
  team: null,
  admin: null,
};

// ─── 읽기 ───────────────────────────────────────────────
type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
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
const bool = (v: unknown): boolean => v === true;

const KINDS: readonly ContactKind[] = ["talk", "notice", "rx"];
const TOPICS: readonly LeaderTopic[] = ["expiring", "winback", "starter"];
const RXS: readonly RxKey[] = ["name", "jab", "promise", "note", "partner", "level", "other"];
const REASONS: readonly StarterReason[] = ["first", "behind", "gap", "slow"];

function readContact(v: unknown): LeaderContact | null {
  const o = obj(v);
  const id = str(o.id);
  const kind = str(o.kind) as ContactKind | null;
  if (!id || !kind || !KINDS.includes(kind)) return null;
  const topic = (str(o.topic) as LeaderTopic | null) ?? "expiring";
  const rx = str(o.rx) as RxKey | null;
  return {
    id,
    kind,
    topic: TOPICS.includes(topic) ? topic : "expiring",
    rx: rx && RXS.includes(rx) ? rx : null,
    at: str(o.at) ?? "",
    by: str(o.by) ?? "코치",
    mine: bool(o.mine),
  };
}

function readRow(v: unknown): LeaderRow | null {
  const o = obj(v);
  const userId = str(o.user_id);
  if (!userId) return null;
  return {
    userId,
    name: str(o.name) ?? "회원",
    realName: str(o.real_name),
    avatarUrl: str(o.avatar_url),
    photoPath: str(o.photo_path),
    firstTerm: typeof o.first_term === "boolean" ? o.first_term : null,
    firstDay: str(o.first_day),
    lastDay: str(o.last_day),
    total: num(o.total),
    v14: num(o.v14),
    cameAt: str(o.came_at),
    here: bool(o.here),
    end: str(o.end),
    contact: readContact(o.contact),
  };
}

function readKpi(v: unknown): LeaderKpi | null {
  const o = obj(v);
  const p = obj(o.payload);
  if (!o.payload) return null;
  const recent = obj(p.recent);
  const month = (m: unknown): KpiMonth | null => {
    const x = obj(m);
    const key = str(x.month);
    if (!key) return null;
    return {
      month: key,
      n: num(x.n),
      renewed30: num(x.renewed30),
      renewed: num(x.renewed),
      open: num(x.open),
      expiredOpen: num(x.expiredOpen),
    };
  };
  return {
    rate: numOrNull(recent.rate),
    n: num(recent.n),
    renewed30: num(recent.renewed30),
    current: month(p.current),
    next: month(p.next),
    newPerMonth: numOrNull(p.newPerMonth),
    avgRenewAmount: numOrNull(p.avgRenewAmount),
    computedAt: str(o.computed_at),
    stale: bool(o.stale),
  };
}

export function normalizeLeaderHome(raw: unknown): LeaderHomeData {
  const o = obj(raw);
  if (!bool(o.on)) {
    const role = str(o.role);
    return { ...LEADER_OFF, role: role === "coach" || role === "manager" || role === "admin" ? role : "none", branch: str(o.branch) };
  }
  const role = str(o.role);
  const conf = obj(o.conf);
  const c = obj(o.counts);
  const expiring = arr(o.expiring)
    .map((x) => {
      const r = readRow(x);
      return r ? { ...r, daysLeft: num(obj(x).days_left) } : null;
    })
    .filter((x): x is ExpiringRow => !!x);
  const winback = arr(o.winback)
    .map((x) => {
      const r = readRow(x);
      return r ? { ...r, daysSince: num(obj(x).days_since) } : null;
    })
    .filter((x): x is WinbackRow => !!x);
  const starters = arr(o.starters)
    .map((x) => {
      const r = readRow(x);
      if (!r) return null;
      const s = obj(x);
      return {
        ...r,
        day: num(s.day, 1),
        count: num(s.count),
        expected: num(s.expected),
        goal: num(s.goal, 8),
        gap: num(s.gap),
        done8: bool(s.done8),
        reasons: arr(s.reasons).filter((k): k is StarterReason => typeof k === "string" && REASONS.includes(k as StarterReason)),
      };
    })
    .filter((x): x is StarterRow => !!x);
  const team = Array.isArray(o.team)
    ? (o.team as unknown[]).map((t) => {
        const x = obj(t);
        return {
          staffUserId: str(x.staff_user_id) ?? "",
          name: str(x.name) ?? "코치",
          talk: num(x.talk),
          notice: num(x.notice),
          rx: num(x.rx),
          total: num(x.total),
        };
      })
    : null;
  const admin = o.admin && typeof o.admin === "object"
    ? {
        branches: arr(obj(o.admin).branches)
          .map((b) => ({ name: str(obj(b).name) ?? "", on: bool(obj(b).on) }))
          .filter((b) => b.name),
        syncAt: str(obj(o.admin).sync_at),
      }
    : null;
  return {
    on: true,
    role: role === "manager" || role === "admin" ? role : "coach",
    branch: str(o.branch),
    today: str(o.today),
    targetRate: Math.min(100, Math.max(1, num(conf.target_rate, 70))),
    conf: {
      expiringDays: num(conf.expiring_days, 14),
      winbackDays: num(conf.winback_days, 30),
      starterDays: num(conf.starter_days, 28),
      starterGoal: num(conf.starter_goal, 8),
      gapDays: num(conf.gap_days, 7),
    },
    expiring,
    winback,
    starters,
    counts: {
      expiring: num(c.expiring),
      expiringFirst: num(c.expiring_first),
      winback: num(c.winback),
      starters: num(c.starters),
      startersBehind: num(c.starters_behind),
      risk: num(c.risk),
      here: num(c.here),
      active: num(c.active),
      photos: num(c.photos),
      avatars: num(c.avatars),
      untouchedD3: num(c.untouched_d3),
      todayContacts: num(c.today_contacts),
    },
    kpi: readKpi(o.kpi),
    team,
    admin,
  };
}

// ─── 순서 ───────────────────────────────────────────────
/** 지금 체육관에 있는 회원 먼저 → 첫 수강권 → 끝나는 날이 가까운 순 */
export function sortExpiring<T extends ExpiringRow>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.here) - Number(a.here) ||
      Number(b.firstTerm === true) - Number(a.firstTerm === true) ||
      a.daysLeft - b.daysLeft ||
      a.name.localeCompare(b.name, "ko"),
  );
}

/** 지금 체육관 → 끝난 지 얼마 안 된 순(되돌리기 쉬운 순) */
export function sortWinback<T extends WinbackRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.here) - Number(a.here) || a.daysSince - b.daysSince || a.name.localeCompare(b.name, "ko"));
}

const starterWeight = (r: StarterRow): number =>
  (r.reasons.includes("first") ? 1000 : 0) + Math.max(0, r.expected - r.count) * 10 + (r.reasons.includes("gap") ? r.gap : 0);

/** 지금 체육관 → 오늘 첫 출석 → 많이 늦은 순 · 오래 안 온 순 */
export function sortStarters<T extends StarterRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.here) - Number(a.here) || starterWeight(b) - starterWeight(a) || a.name.localeCompare(b.name, "ko"));
}

// ─── 글 ─────────────────────────────────────────────────
export const ROLE_LABEL: Record<LeaderRole, string> = { coach: "코치", manager: "관장", admin: "관리자" };

const md = (ymd: string | null): string => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : "");
const monthLabel = (ym: string): string => `${Number(ym.slice(5, 7))}월`;

/** 목표까지 몇 명 더 — 목표 = ceil(n × 목표율) */
export function needMore(n: number, renewed: number, targetRate: number): number {
  return Math.max(0, Math.ceil((n * targetRate) / 100) - renewed);
}

export interface KpiView {
  rateText: string;
  rate: number | null;
  lines: string[];
  note: string;
}

export function kpiView(kpi: LeaderKpi | null, targetRate: number): KpiView {
  if (!kpi) return { rateText: "계산 중", rate: null, lines: [], note: "재등록률을 계산하고 있어요" };
  const lines: string[] = [];
  for (const m of [kpi.current, kpi.next]) {
    if (!m || m.n === 0) continue;
    const more = needMore(m.n, m.renewed, targetRate);
    lines.push(
      more > 0
        ? `${monthLabel(m.month)}에 첫 수강권 끝나는 신규 ${m.n}명 · 지금 ${m.renewed}명 재등록 · ${targetRate}%까지 ${more}명 더`
        : `${monthLabel(m.month)}에 첫 수강권 끝나는 신규 ${m.n}명 · ${m.renewed}명 재등록 · 목표 달성`,
    );
  }
  return {
    rateText: kpi.rate === null ? "-" : `${Math.round(kpi.rate)}%`,
    rate: kpi.rate,
    lines,
    note: `최근 6개월 신규 ${kpi.n}명 중 ${kpi.renewed30}명 · 매출 기록 같은 이름 대조(추정)`,
  };
}

/** ① 기간 임박 — 줄 아래 할 말 하나 */
export function expiringSay(r: ExpiringRow): string {
  if (r.v14 === 0) return "할 말 · '요즘 못 뵀어요' 한마디 + 다음에 올 날 하나";
  if (r.firstTerm) return "할 말 · 처음보다 좋아진 것 하나 + 다음 목표 하나";
  return "할 말 · 늘어난 것 하나 + 다음 목표 하나";
}

export function expiringSub(r: ExpiringRow): string {
  const visits = r.v14 > 0 ? `최근 2주 ${r.v14}번` : "최근 2주 출석 없음";
  const last = r.lastDay ? ` · 마지막 ${md(r.lastDay)}` : "";
  return `${visits}${last}`;
}

export function winbackSay(r: WinbackRow): string {
  return r.daysSince <= 7 ? "할 말 · '다시 보고 싶어요' 한마디 · 안내는 한 번만" : "할 말 · 안부 한마디 · 안내는 한 번만";
}

export interface StarterRx {
  key: RxKey;
  label: string;
}

/** ② 재미 위험 신규 — 처방 하나 (153 신규 지도법 · 첫 4주 8번) */
export function starterRx(r: StarterRow): StarterRx {
  if (r.reasons.includes("first")) return { key: "jab", label: "이름 부르고 4라운드 잽 '팡' 미트" };
  if (r.reasons.includes("gap")) return { key: "note", label: "한마디 도장 남기기 · 앱 알림 한 번" };
  if (r.reasons.includes("behind")) {
    return r.count <= 2
      ? { key: "name", label: "이름 부르고 오늘 잘한 것 하나 말해 주기" }
      : { key: "promise", label: "운동 약속 주 2번 같이 걸기" };
  }
  if (r.v14 < 2) return { key: "partner", label: "'오늘 같이 해요' 모집에 같이 넣어 주기" };
  return { key: "level", label: "다음 레벨 미션 하나 같이 정하기" };
}

export function starterChips(r: StarterRow): string[] {
  const out: string[] = [];
  if (r.reasons.includes("first")) out.push("오늘 첫 출석");
  else out.push(`${r.day}일째`);
  if (r.reasons.includes("gap")) out.push(`${r.gap}일 안 옴`);
  if (r.reasons.includes("behind")) out.push("주 2번보다 늦음");
  if (r.reasons.includes("slow")) out.push(`2주 ${r.v14}번`);
  return out;
}

export const RX_LABEL: Record<RxKey, string> = {
  name: "이름 · 칭찬",
  jab: "잽 미트",
  promise: "운동 약속",
  note: "한마디",
  partner: "같이 운동",
  level: "레벨 미션",
  other: "처방",
};

const KIND_LABEL: Record<ContactKind, string> = { talk: "이야기함", notice: "안내 보냄", rx: "처방함" };

/** 「누가 · 언제 · 무엇」 — 같은 회원에게 여러 코치가 같은 말을 하지 않게 */
export function contactLine(c: LeaderContact, today: string | null): string {
  const day = c.at ? new Date(Date.parse(c.at) + 9 * 3600_000).toISOString().slice(0, 10) : null;
  const when = day && today && day === today ? "오늘" : md(day);
  const who = c.mine ? "내가" : `${c.by} 코치`;
  const what = c.kind === "rx" && c.rx ? `처방함(${RX_LABEL[c.rx]})` : KIND_LABEL[c.kind];
  return `${who} · ${when} ${what}`.replace(/\s+/g, " ").trim();
}

/** 내가 남긴 기록은 24시간 안에 되돌릴 수 있다(서버와 같은 기준) */
export const canUndo = (c: LeaderContact | null, now = Date.now()): boolean =>
  !!c && c.mine && !!c.at && now - Date.parse(c.at) < 24 * 3600_000;

/** 관리자 — 활동 회원 중 얼굴을 볼 수 있는 비율(코치 사진 + 프로필 사진) */
export function photoCoverage(c: LeaderCounts): { pct: number; text: string } {
  const seen = c.photos + c.avatars;
  const pct = c.active > 0 ? Math.round((seen / c.active) * 100) : 0;
  return { pct, text: `얼굴 보이는 회원 ${pct}% · 코치 사진 ${c.photos} · 프로필 ${c.avatars} / 활동 ${c.active}명` };
}

/** 사진 동의 문구 판 — 서버 leader_photo_saved 와 같아야 한다 */
export const COACH_PHOTO_CONSENT_VERSION = "coach-photo-v1";
export const COACH_PHOTO_CONSENT_LINES = [
  "코치님들이 회원님 얼굴을 기억하고 이름을 불러 드리려고 사진을 한 장 남겨요.",
  "이 지점 코치님 화면에만 보여요. 다른 회원님 화면이나 TV에는 나오지 않아요.",
  "출입할 때 쓰는 얼굴 인식에는 쓰지 않아요.",
  "수강권이 끝나고 6개월이 지나면 저절로 지워져요. 원하시면 언제든 코치님께 말씀해 주세요. 바로 지울게요.",
] as const;

// ─── 화면 확인용 예시 (미리보기 · 시험) ─────────────────
export const LEADER_DEMO: LeaderHomeData = normalizeLeaderHome({
  on: true,
  role: "coach",
  branch: "153복싱짐 선릉역점",
  today: "2026-11-26",
  conf: { target_rate: 70, expiring_days: 14, winback_days: 30, starter_days: 28, starter_goal: 8, gap_days: 7 },
  counts: {
    expiring: 24, expiring_first: 15, winback: 9, starters: 33, starters_behind: 10, risk: 12, here: 7,
    active: 141, photos: 3, avatars: 15, untouched_d3: 2, today_contacts: 4,
  },
  kpi: {
    computed_at: "2026-11-26T03:00:00Z",
    stale: false,
    payload: {
      recent: { months: 6, n: 129, renewed30: 31, rate: 24.0 },
      current: { month: "2026-11", n: 14, renewed30: 2, renewed: 2, open: 3, expiredOpen: 9 },
      next: { month: "2026-12", n: 22, renewed30: 1, renewed: 1, open: 21, expiredOpen: 0 },
    },
  },
  expiring: [
    { user_id: "demo-1", name: "김○○", first_term: true, v14: 1, last_day: "2026-11-20", here: true, came_at: "2026-11-26T10:40:00Z", days_left: 2, end: "2026-11-28" },
    { user_id: "demo-2", name: "이○○", first_term: true, v14: 4, last_day: "2026-11-25", days_left: 5, end: "2026-12-01",
      contact: { id: "c1", kind: "talk", topic: "expiring", at: "2026-11-25T11:00:00Z", by: "박성현", mine: false } },
    { user_id: "demo-3", name: "최○○", first_term: false, v14: 0, last_day: "2026-11-02", days_left: 9, end: "2026-12-05" },
  ],
  winback: [{ user_id: "demo-4", name: "정○○", first_term: true, v14: 0, last_day: "2026-11-10", days_since: 3, end: "2026-11-23" }],
  starters: [
    { user_id: "demo-5", name: "한○○", here: true, came_at: "2026-11-26T10:55:00Z", day: 1, count: 1, expected: 0, goal: 8, gap: 0, reasons: ["first"] },
    { user_id: "demo-6", name: "박○○", day: 12, count: 2, expected: 3, goal: 8, gap: 6, last_day: "2026-11-20", reasons: ["behind"] },
    { user_id: "demo-7", name: "윤○○", day: 19, count: 4, expected: 5, goal: 8, gap: 9, last_day: "2026-11-17", reasons: ["behind", "gap"] },
  ],
  team: null,
  admin: null,
});
