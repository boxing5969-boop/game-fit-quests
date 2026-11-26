/**
 * 📊 코치 매일 리포트 · 오늘 미션 — 글 · 계산 (DB 20261126224743_coach_daily.sql · 2026-11-26 대표님 「추천대로 진행하자」)
 *   매일 06:40 크론이 오늘 근무하는 코치님마다 「어제 숫자 + 오늘 미션 최대 3개」를 만들고 12/1부터 알림 1통.
 *   내 시간 = 근무 시간표(시작 30분 전 ~ 끝) · 출근 기록이 있는 날만. 미션 완료 = 오늘 그 회원에게 남긴 기록 · 매뉴얼 서명.
 *   돈은 다루지 않는다(건수만). 화면 = components/leader/CoachDailyCard.tsx · 데이터 = services/coachDailyService.ts
 */
import { needMore, type ContactKind, type LeaderRole, type LeaderTopic } from "@/lib/leaderHome";

export type MissionKind = "expiring" | "starter" | "first" | "manual" | "winback";

export interface MissionInfo {
  daysLeft: number | null;
  daysSince: number | null;
  firstTerm: boolean;
  day: number | null;
  count: number | null;
  goal: number | null;
  gap: number | null;
  bookNo: string | null;
  no: string | null;
  title: string | null;
  minutes: number | null;
}

export interface CoachMission {
  id: string;
  rank: number;
  kind: MissionKind;
  reasons: string[];
  member: string | null;
  name: string | null;
  realName: string | null;
  avatarUrl: string | null;
  photoPath: string | null;
  book: string | null;
  chapter: string | null;
  done: boolean;
  info: MissionInfo;
}

export interface DailyBranch {
  day: string | null;
  visitors: number;
  active: number;
  rate: number | null;
  firstTimers: number;
}

export interface DailyMonth {
  month: string | null;
  n: number;
  renewed: number;
  open: number;
  targetRate: number;
  recentRate: number | null;
}

export interface DailyMine {
  scheduled: boolean;
  worked: boolean;
  label: string | null;
  visitors: number;
  firstTimers: number;
  contacts: number;
  home: number;
  missionsDone: number;
  missionsTotal: number;
}

export interface DailyTeamRow {
  coach: string;
  name: string;
  today: string | null;
  mine: DailyMine | null;
  sent: boolean;
  missions: CoachMission[];
  done: number;
  total: number;
}

export interface CoachDailyData {
  on: boolean;
  role: LeaderRole | "none";
  branch: string | null;
  day: string | null;
  preview: boolean;
  startDate: string | null;
  hasMine: boolean;
  stats: DailyBranch | null;
  month: DailyMonth | null;
  mine: DailyMine | null;
  todayLabel: string | null;
  missions: CoachMission[];
  team: DailyTeamRow[] | null;
  lastRun: { ranAt: string | null; error: boolean } | null;
}

export const DAILY_OFF: CoachDailyData = {
  on: false,
  role: "none",
  branch: null,
  day: null,
  preview: false,
  startDate: null,
  hasMine: false,
  stats: null,
  month: null,
  mine: null,
  todayLabel: null,
  missions: [],
  team: null,
  lastRun: null,
};

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const num = (v: unknown, d = 0): number => numOrNull(v) ?? d;
const bool = (v: unknown): boolean => v === true;

const KINDS: readonly MissionKind[] = ["expiring", "starter", "first", "manual", "winback"];
const ROLES: readonly LeaderRole[] = ["coach", "manager", "admin"];

function readMission(v: unknown): CoachMission | null {
  const o = obj(v);
  const id = str(o.id);
  const kind = KINDS.find((k) => k === o.kind);
  if (!id || !kind) return null;
  const i = obj(o.info);
  return {
    id,
    rank: num(o.rank, 1),
    kind,
    reasons: arr(o.reasons).filter((x): x is string => typeof x === "string"),
    member: str(o.member),
    name: str(o.name),
    realName: str(o.real_name),
    avatarUrl: str(o.avatar_url),
    photoPath: str(o.photo_path),
    book: str(o.book) ?? str(i.book),
    chapter: str(o.chapter) ?? str(i.chapter),
    done: bool(o.done),
    info: {
      daysLeft: numOrNull(i.days_left),
      daysSince: numOrNull(i.days_since),
      firstTerm: bool(i.first_term),
      day: numOrNull(i.day),
      count: numOrNull(i.count),
      goal: numOrNull(i.goal),
      gap: numOrNull(i.gap),
      bookNo: str(i.book_no),
      no: str(i.no),
      title: str(i.title),
      minutes: numOrNull(i.minutes),
    },
  };
}

const readMissions = (v: unknown): CoachMission[] =>
  arr(v)
    .map(readMission)
    .filter((m): m is CoachMission => !!m)
    .sort((a, b) => a.rank - b.rank);

function readMine(v: unknown): DailyMine | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  return {
    scheduled: bool(o.scheduled),
    worked: bool(o.worked),
    label: str(o.label),
    visitors: num(o.visitors),
    firstTimers: num(o.first_timers),
    contacts: num(o.contacts),
    home: num(o.home),
    missionsDone: num(o.missions_done),
    missionsTotal: num(o.missions_total),
  };
}

function readBranch(v: unknown): DailyBranch | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  return { day: str(o.day), visitors: num(o.visitors), active: num(o.active), rate: numOrNull(o.rate), firstTimers: num(o.first_timers) };
}

function readMonth(v: unknown): DailyMonth | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  return {
    month: str(o.month),
    n: num(o.n),
    renewed: num(o.renewed),
    open: num(o.open),
    targetRate: Math.max(1, Math.min(100, num(o.target_rate, 70))),
    recentRate: numOrNull(o.recent_rate),
  };
}

export function normalizeCoachDaily(raw: unknown): CoachDailyData {
  const o = obj(raw);
  if (!bool(o.on)) return { ...DAILY_OFF, preview: bool(o.preview), startDate: str(o.start_date) };
  const report = obj(o.report);
  const run = o.last_run && typeof o.last_run === "object" ? obj(o.last_run) : null;
  return {
    on: true,
    role: ROLES.find((r) => r === o.role) ?? "coach",
    branch: str(o.branch),
    day: str(o.day),
    preview: bool(o.preview),
    startDate: str(o.start_date),
    hasMine: bool(o.has_mine),
    stats: readBranch(report.branch),
    month: readMonth(report.month),
    mine: readMine(report.mine),
    todayLabel: str(obj(report.today).label),
    missions: readMissions(o.missions),
    team: Array.isArray(o.team)
      ? o.team
          .map((t): DailyTeamRow | null => {
            const r = obj(t);
            const coach = str(r.coach);
            if (!coach) return null;
            return {
              coach,
              name: str(r.name) ?? "코치",
              today: str(r.today),
              mine: readMine(r.mine),
              sent: bool(r.sent),
              missions: readMissions(r.missions),
              done: num(r.done),
              total: num(r.total),
            };
          })
          .filter((t): t is DailyTeamRow => !!t)
      : null,
    lastRun: run ? { ranAt: str(run.ran_at), error: bool(run.error) } : null,
  };
}

// ── 글 ─────────────────────────────────────────────────────────────

export const shortBranchName = (b: string | null): string =>
  (b ?? "").replace(/^153복싱짐\s*/, "").replace(/(역점|점)$/, "");

const md = (ymd: string | null): string => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : "");
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/** '2026-12-01' → '12/1(화)' */
export const mdDow = (ymd: string | null): string => {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? md(ymd) : `${md(ymd)}(${WEEK[d.getUTCDay()]})`;
};

/** ISO 시각 → 한국 시각 '11/27 06:40' */
export function kstMdHm(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const k = new Date(t + 9 * 3600_000).toISOString();
  return `${md(k.slice(0, 10))} ${k.slice(11, 16)}`;
}

/** 회원 이름 — 별명이 이름과 다르면 '이름(별명)' */
export function missionName(m: CoachMission): string {
  const nick = m.name ?? "";
  const real = m.realName ?? "";
  if (real && nick && real !== nick) return `${real}(${nick})`;
  return real || nick || "회원";
}

export function missionTitle(m: CoachMission): string {
  const i = m.info;
  switch (m.kind) {
    case "expiring":
      return i.daysLeft === 0 ? "오늘 수강권 끝" : `수강권 D-${i.daysLeft ?? "?"}`;
    case "winback":
      return `끝난 지 ${i.daysSince ?? "?"}일`;
    case "starter":
      return `신규 ${i.day ?? "?"}일째`;
    case "first":
      return "어제 첫 출석";
    case "manual":
      return `매뉴얼 ${i.bookNo ?? ""} ${i.no ?? ""}`.replace(/\s+/g, " ").trim();
  }
}

/** 한 줄 칩 — 왜 오늘 이 미션인지 */
export function missionChips(m: CoachMission): string[] {
  const i = m.info;
  const out: string[] = [];
  if (m.kind === "expiring" && i.firstTerm) out.push("첫 수강권");
  if (m.kind === "starter") {
    if (i.count !== null && i.goal !== null) out.push(`첫 4주 ${i.count}/${i.goal}번`);
    if (m.reasons.includes("gap") && i.gap !== null) out.push(`${i.gap}일 안 옴`);
    if (m.reasons.includes("behind")) out.push("주 2번보다 늦음");
  }
  if (m.kind === "manual" && i.minutes) out.push(`${i.minutes}분`);
  return out;
}

/** 할 말 · 할 일 하나 (지도자 홈 「할 말 · 처방」과 같은 결) */
export function missionSay(m: CoachMission): string {
  const i = m.info;
  switch (m.kind) {
    case "expiring":
      return i.firstTerm ? "할 말 · 처음보다 좋아진 것 하나 + 다음 목표 하나" : "할 말 · 늘어난 것 하나 + 다음 목표 하나";
    case "winback":
      return (i.daysSince ?? 99) <= 7 ? "할 말 · '다시 보고 싶어요' 한마디 · 안내는 한 번만" : "할 말 · 안부 한마디 · 안내는 한 번만";
    case "starter":
      if (m.reasons.includes("gap")) return "할 일 · 안부 한마디 + 다음에 올 날 하나 정하기";
      return (i.count ?? 0) <= 2 ? "할 일 · 이름 부르고 오늘 잘한 것 하나 말해 주기" : "할 일 · 운동 약속 주 2번 같이 걸기";
    case "first":
      return "할 일 · 다음에 오면 이름 부르고 '첫날 어땠어요?' 한마디";
    case "manual":
      return i.title ? `「${i.title}」 읽고 서명하기` : "한 장 읽고 서명하기";
  }
}

export interface MissionAction {
  kind: ContactKind;
  topic: LeaderTopic;
  label: string;
  strong: boolean;
}

/** 단추 — 누르면 지도자 홈 기록(이야기함 · 안내 보냄)이 남고 미션이 완료된다 */
export function missionActions(m: CoachMission): MissionAction[] {
  if (m.kind === "manual" || !m.member) return [];
  const topic: LeaderTopic = m.kind === "expiring" ? "expiring" : m.kind === "winback" ? "winback" : "starter";
  return [
    { kind: "talk", topic, label: "이야기함", strong: true },
    { kind: "notice", topic, label: "안내 보냄", strong: false },
  ];
}

/** 매뉴얼 미션 → 그 장 바로 열기 */
export function manualLink(m: CoachMission): string | null {
  if (m.kind !== "manual" || !m.chapter) return null;
  const book = m.book && m.book !== "book1" ? `&book=${encodeURIComponent(m.book)}` : "";
  return `/office?tab=manual${book}&ch=${encodeURIComponent(m.chapter)}`;
}

export const missionProgress = (ms: readonly CoachMission[]): { done: number; total: number } => ({
  done: ms.filter((m) => m.done).length,
  total: ms.length,
});

/** 어제 지점 한 줄 */
export function branchLine(s: DailyBranch | null, branch: string | null): string | null {
  if (!s) return null;
  const rate = s.rate !== null && s.active > 0 ? ` · 활동 회원 ${s.active}명 중 ${Math.round(s.rate)}%` : "";
  const first = s.firstTimers > 0 ? ` · 첫 출석 ${s.firstTimers}명` : "";
  return `어제 ${shortBranchName(branch)} ${s.visitors}명 출석${rate}${first}`;
}

/** 어제 내 시간 한 줄 */
export function mineLine(m: DailyMine | null): string | null {
  if (!m) return null;
  if (m.worked) {
    const first = m.firstTimers > 0 ? ` · 첫 출석 ${m.firstTimers}명` : "";
    return `어제 내 시간(${m.label ?? "근무"}) ${m.visitors}명${first}`;
  }
  return m.scheduled ? "어제는 출근 기록이 없어 내 시간 숫자를 비워 뒀어요" : "어제는 근무가 없었어요";
}

/** 이번 달 재등록 한 줄 */
export function monthLine(m: DailyMonth | null): string | null {
  if (!m || !m.month || m.n === 0) return null;
  const mon = `${Number(m.month.slice(5, 7))}월`;
  const more = needMore(m.n, m.renewed, m.targetRate);
  return more > 0
    ? `${mon} 재등록 ${m.renewed}/${m.n}명 · ${m.targetRate}%까지 ${more}명 더`
    : `${mon} 재등록 ${m.renewed}/${m.n}명 · 목표 달성`;
}

/** 코치님 휴대폰에 가는 알림 — DB coach_daily_send 와 같은 글 */
export function notifyPreview(
  branch: string | null,
  stats: DailyBranch | null,
  month: DailyMonth | null,
  mine: DailyMine | null,
  missionCount: number,
): { title: string; body: string } {
  const title = `📊 어제 ${shortBranchName(branch)} ${stats?.visitors ?? 0}명 출석${missionCount > 0 ? ` · 오늘 미션 ${missionCount}개` : ""}`;
  const need = month ? needMore(month.n, month.renewed, month.targetRate) : 0;
  const mon = month?.month ? String(Number(month.month.slice(5, 7))) : "";
  const goal = need > 0 && mon ? `${mon}월 재등록 목표까지 ${need}명` : null;
  const body = mine?.worked
    ? [`어제 내 시간 ${mine.visitors}명`, goal].filter(Boolean).join(" · ")
    : `${goal ? `${goal} · ` : ""}${missionCount > 0 ? "눌러서 오늘 미션 보기" : "눌러서 어제 숫자 보기"}`;
  return { title, body };
}

export const PILOT_NOTE = "4주 시범 · 보상 없이 숫자만 봐요 · 내 레벨은 시범이 끝나면 나에게만 보여요";

export const COACH_DAILY_DEMO: CoachDailyData = normalizeCoachDaily({
  on: true,
  role: "coach",
  branch: "153복싱짐 선릉역점",
  day: "2026-12-01",
  preview: false,
  start_date: "2026-12-01",
  has_mine: true,
  report: {
    branch: { day: "2026-11-30", visitors: 41, active: 140, rate: 29.3, first_timers: 2 },
    month: { month: "2026-12", n: 20, renewed: 1, open: 19, target_rate: 70, recent_rate: 23.1 },
    mine: { scheduled: true, worked: true, label: "19:00–23:00", visitors: 16, first_timers: 1, contacts: 2, home: 31 },
    today: { label: "17:00–18:30 · 19:00–23:00", name: "코치" },
  },
  missions: [
    { id: "demo-m1", rank: 1, kind: "expiring", member: "demo-1", name: "김○○", real_name: "김○○", reasons: ["first_term"], info: { days_left: 3, first_term: true }, done: false },
    { id: "demo-m2", rank: 2, kind: "starter", member: "demo-6", name: "박○○", real_name: "박○○", reasons: ["behind", "gap"], info: { day: 10, count: 1, goal: 8, gap: 9 }, done: true },
    { id: "demo-m3", rank: 3, kind: "manual", book: "book1", chapter: "author", info: { book_no: "1권", no: "앞글 ①", title: "이 책을 쓴 사람", minutes: 3 }, done: false },
  ],
  team: null,
});
