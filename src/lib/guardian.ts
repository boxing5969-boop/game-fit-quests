/**
 * 보호자(어머님 · 아버님) 연결 · 아이 운동 알림 · 「운동을 끝낼까요?」 — 화면 없는 계산 · 글 한 곳 (2026-11-23 대표님 「추천대로」).
 *
 * 규칙(누가 연결 · 누가 끊기 · 알림)은 서버(supabase/migrations/20261123224234_guardian_links.sql)에 있다.
 * 여기는 서버 값을 믿지 않고 다듬기 · 화면 글 · 팝업을 띄울 때인지 계산만 한다.
 * 회원 화면 글은 잘한 것과 다음 한 걸음만: 못한 것 · 쉰 날은 말하지 않는다(시험이 낱말을 막는다).
 */
import { RANK_LABELS, toGlobalLevel } from "@/lib/rankLabels";

export type GuardianRelation = "mom" | "dad" | "guardian";
export const GUARDIAN_RELATIONS: GuardianRelation[] = ["mom", "dad", "guardian"];
export const RELATION_LABEL: Record<GuardianRelation, string> = { mom: "엄마", dad: "아빠", guardian: "보호자" };

const asRelation = (v: unknown): GuardianRelation => (v === "mom" || v === "dad" ? v : "guardian");
const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ── 회원 쪽 상태 (my_guardian_state) ─────────────────────────────────────────
export interface GuardianLinkRow {
  id: string;
  relation: GuardianRelation;
  status: "pending" | "active";
  via: "child_invite" | "desk_qr";
  name: string;
  since: string | null;
}

export interface GuardianState {
  on: boolean;
  isMember: boolean;
  guardianAccount: boolean;
  kids: number;
  minor: boolean | null;
  links: GuardianLinkRow[];
  hasGuardian: boolean;
  canUnlink: boolean;
  prompt: boolean;
  promptMin: number;
  promptMaxMin: number;
  snoozeMin: number;
}

export const EMPTY_GUARDIAN_STATE: GuardianState = {
  on: false,
  isMember: false,
  guardianAccount: false,
  kids: 0,
  minor: null,
  links: [],
  hasGuardian: false,
  canUnlink: false,
  prompt: false,
  promptMin: 50,
  promptMaxMin: 180,
  snoozeMin: 20,
};

const clamp = (v: number | null, lo: number, hi: number, d: number) => (v == null ? d : Math.min(hi, Math.max(lo, Math.round(v))));

export function normalizeGuardianState(raw: unknown): GuardianState {
  const r = obj(raw);
  const links: GuardianLinkRow[] = (Array.isArray(r.links) ? r.links : [])
    .map((x) => obj(x))
    .filter((x) => typeof x.id === "string" && (x.status === "pending" || x.status === "active"))
    .map((x) => ({
      id: x.id as string,
      relation: asRelation(x.relation),
      status: x.status as "pending" | "active",
      via: x.via === "desk_qr" ? "desk_qr" : "child_invite",
      name: asStr(x.name) ?? "보호자",
      since: asStr(x.since),
    }));
  return {
    on: r.on === true,
    isMember: r.is_member === true,
    guardianAccount: r.guardian_account === true,
    kids: Math.max(0, asNum(r.kids) ?? 0),
    minor: r.minor === true ? true : r.minor === false ? false : null,
    links,
    hasGuardian: r.has_guardian === true,
    canUnlink: r.can_unlink === true,
    prompt: r.prompt === true,
    promptMin: clamp(asNum(r.prompt_min), 10, 170, 50),
    promptMaxMin: clamp(asNum(r.prompt_max_min), 60, 240, 180),
    snoozeMin: clamp(asNum(r.snooze_min), 5, 120, 20),
  };
}

/** 보호자만 쓰는 계정 — 승인된 회원이 아니고 서버가 account_kind='guardian' 으로 표시한 계정. 앱이 /guardian 하나만 보인다 */
export function isGuardianOnlyProfile(p: unknown): boolean {
  const r = obj(p);
  return r.account_kind === "guardian" && r.is_approved !== true;
}

// ── 「운동을 끝낼까요?」 — 출석 뒤 promptMin 분 ~ promptMaxMin 분, 끝 기록이 없을 때 ───────────
export interface WorkoutTodayLike {
  checked_in: boolean;
  started_at: string | null;
  finished: boolean;
}

/** 지금까지 흐른 분 — 캐시된 elapsed_minutes(5분마다 갱신)가 아니라 들어온 시각으로 바로 센다 */
export function minutesSince(startedAt: string | null, now: number = Date.now()): number | null {
  if (!startedAt) return null;
  const t = Date.parse(startedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60_000));
}

export function finishPromptDue(
  state: Pick<GuardianState, "prompt" | "promptMin" | "promptMaxMin">,
  today: WorkoutTodayLike | null | undefined,
  now: number,
  snoozeUntil: number | null,
  force = false,
): boolean {
  if (!state.prompt || !today || !today.checked_in || today.finished) return false;
  const m = minutesSince(today.started_at, now);
  if (m == null || m < state.promptMin || m >= state.promptMaxMin) return false;
  if (force) return true;
  return snoozeUntil == null || now >= snoozeUntil;
}

/** 다음에 다시 볼 때까지 — 오늘 그 출석 한 건에만 (다음 날 · 다음 출석은 새로) */
export const finishSnoozeKey = (uid: string, startedAt: string | null) => `153finish:snooze:${uid}:${(startedAt ?? "").slice(0, 16)}`;

export function readSnooze(key: string): number | null {
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeSnooze(key: string, until: number): void {
  try {
    window.localStorage.setItem(key, String(until));
  } catch {
    /* 저장이 막혀도 이번 화면에서는 닫힌다 */
  }
}

// ── 링크 ─────────────────────────────────────────────────────────────────────
export const GUARDIAN_JOIN_PATH = "/guardian/join";
export const isGuardianToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32}$/.test(t);
export const guardianInviteUrl = (token: string, origin = "https://myboxer153.com") => `${origin}${GUARDIAN_JOIN_PATH}?t=${token}`;

/** 아이가 엄마 · 아빠에게 보내는 글 — 링크와 같이 */
export const guardianShareText = (childName: string): string =>
  `${childName}의 153복싱짐 운동 기록을 마이복서153에서 같이 보실 수 있어요.\n` +
  `링크를 열고 카카오로 시작하면 연결돼요. 체육관에 온 시각과 운동이 끝난 시각을 알림으로 받아요.\n` +
  `153 건강과 행복. 153복싱짐`;

// 로그인하러 다녀오는 동안 링크를 잊지 않게 — 이 기기에 하루
const TOKEN_KEY = "153guardian:token";
const TOKEN_TTL_MS = 24 * 3_600_000;

export function rememberGuardianToken(token: string): void {
  if (!isGuardianToken(token)) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: token, at: Date.now() }));
  } catch {
    /* noop */
  }
}

export function readGuardianToken(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { t?: unknown; at?: unknown };
    if (!isGuardianToken(v.t) || typeof v.at !== "number" || now - v.at > TOKEN_TTL_MS) {
      window.localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return v.t;
  } catch {
    return null;
  }
}

export function clearGuardianToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

// ── 보호자 화면 (guardian_home) ──────────────────────────────────────────────
export interface GuardianVisit {
  day: string;
  in: string;
  out: string | null;
  min: number | null;
}

export interface GuardianKid {
  linkId: string;
  memberId: string;
  relation: GuardianRelation;
  name: string;
  branch: string | null;
  today: { in: string | null; inAt: string | null; out: string | null; min: number | null };
  month: { days: number; minutes: number; dates: string[] };
  total: { days: number; minutes: number; first: string | null };
  recent: GuardianVisit[];
  level: { rank: string; level: number; need: number | null } | null;
  notes: { day: string; body: string; who: string }[];
  pb: { bestMs: number | null; count: number } | null;
}

export interface GuardianHome {
  kids: GuardianKid[];
  guardianAccount: boolean;
}

export function normalizeGuardianHome(raw: unknown): GuardianHome {
  const r = obj(raw);
  const kids: GuardianKid[] = (Array.isArray(r.kids) ? r.kids : []).map((k) => {
    const x = obj(k);
    const t = obj(x.today);
    const m = obj(x.month);
    const tot = obj(x.total);
    const lv = x.level ? obj(x.level) : null;
    const pb = x.pb ? obj(x.pb) : null;
    return {
      linkId: String(x.link_id ?? ""),
      memberId: String(x.member_id ?? ""),
      relation: asRelation(x.relation),
      name: asStr(x.name) ?? "회원",
      branch: asStr(x.branch),
      today: { in: asStr(t.in), inAt: asStr(t.in_at), out: asStr(t.out), min: asNum(t.min) },
      month: {
        days: Math.max(0, asNum(m.days) ?? 0),
        minutes: Math.max(0, asNum(m.minutes) ?? 0),
        dates: (Array.isArray(m.dates) ? m.dates : []).filter((d): d is string => typeof d === "string"),
      },
      total: { days: Math.max(0, asNum(tot.days) ?? 0), minutes: Math.max(0, asNum(tot.minutes) ?? 0), first: asStr(tot.first) },
      recent: (Array.isArray(x.recent) ? x.recent : [])
        .map((v) => obj(v))
        .filter((v) => typeof v.day === "string" && typeof v.in === "string")
        .map((v) => ({ day: v.day as string, in: v.in as string, out: asStr(v.out), min: asNum(v.min) })),
      level: lv && typeof lv.rank === "string" ? { rank: lv.rank, level: asNum(lv.level) ?? 1, need: asNum(lv.need) } : null,
      notes: (Array.isArray(x.notes) ? x.notes : [])
        .map((v) => obj(v))
        .filter((v) => typeof v.body === "string" && typeof v.day === "string")
        .map((v) => ({ day: v.day as string, body: v.body as string, who: asStr(v.who) ?? "코치님" })),
      pb: pb ? { bestMs: asNum(pb.best_ms), count: Math.max(0, asNum(pb.count) ?? 0) } : null,
    };
  });
  return { kids: kids.filter((k) => k.linkId && k.memberId), guardianAccount: r.guardian_account === true };
}

export function minutesText(m: number | null | undefined): string {
  const v = Math.max(0, Math.round(m ?? 0));
  if (v < 60) return `${v}분`;
  const h = Math.floor(v / 60);
  const rest = v % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}

/** 오늘 한 줄 — 주인공(headline) + 회색 한 줄(sub). live = 운동 중 */
export function kidTodayLine(today: GuardianKid["today"], now: number = Date.now()): { headline: string; sub: string | null; live: boolean } {
  if (!today.in) return { headline: "오늘 기록은 아직 없어요", sub: "체육관에 오면 알림이 가요", live: false };
  if (today.out) {
    return { headline: `${today.out} 운동 끝`, sub: `${today.in}에 와서 ${minutesText(today.min)} 운동했어요`, live: false };
  }
  const m = minutesSince(today.inAt, now);
  if (m != null && m <= 240) {
    return { headline: `${today.in} 도착`, sub: `운동 중 · ${minutesText(m)}째`, live: true };
  }
  return { headline: `${today.in} 도착`, sub: "운동 끝 기록은 남지 않았어요", live: false };
}

/** 최근 한 번 — '11/20(목) 18:42 ~ 19:40 · 58분' / 끝 기록이 없으면 '11/20(목) 18:42 도착' */
export function visitLine(v: GuardianVisit): string {
  // 날짜 글자(한국 날짜) 그대로 — 그날 정오(UTC)로 요일을 센다
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${v.day}T12:00:00Z`).getUTCDay()] ?? "";
  const md = `${Number(v.day.slice(5, 7))}/${Number(v.day.slice(8, 10))}(${w})`;
  return v.out ? `${md} ${v.in} ~ ${v.out} · ${minutesText(v.min)}` : `${md} ${v.in} 도착`;
}

export function levelLine(lv: GuardianKid["level"]): { title: string; sub: string | null } | null {
  if (!lv) return null;
  const league = RANK_LABELS[lv.rank] ?? lv.rank;
  const title = `${league} 리그 · 레벨 ${toGlobalLevel(lv.rank, lv.level)}`;
  if (lv.need == null) return { title, sub: null };
  if (lv.need <= 0) return { title, sub: "다음 출석 때 레벨이 올라가요" };
  return { title, sub: `${lv.need}번 더 오면 레벨 ${toGlobalLevel(lv.rank, lv.level + 1)}` };
}

/** 153 PB 기록 — '21:40' (분:초) */
export function pbText(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
