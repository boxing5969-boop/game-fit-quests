/**
 * 📣 앱 업데이트 내역 — 공지사항 「앱 업데이트」 칸 (2026-11-15 선릉역점 봄 회원 제안
 *   「앱 내 개선사항이나 업데이트가 있을 때 공지사항에 업데이트 내용이 오면 좋을것같아요」
 *   → 대표님 「공지사항 안 '앱 업데이트' 칸」 · 「휴대폰 알림은 안 보냄 — 빨간 점만」)
 *   · 내역 정본 = src/data/appUpdates.ts — 앱과 함께 배포(DB 없음 · 153OS 와 안 이어진 회원도 보인다)
 *   · 회원 화면에 보이는 기능을 main 에 올리면 그 파일 맨 위에 한 칸(CLAUDE.md 「앱 업데이트 내역」 — 두 계정 같은 규칙)
 *   · 빨간 점 = 이 기기에서 아직 안 본 업데이트가 있을 때(본 것은 기기 · 사람마다 — hooks/useAppUpdates)
 * 이 파일은 화면 없는 계산만 — 시험 appUpdates.test.ts
 */

export type UpdateAudience = "all" | "staff";

export interface AppUpdate {
  /** 'YYYYMMDD-짧은-이름' — 한 번 정하면 바꾸지 않는다(본 것 · 빨간 점 기준) */
  id: string;
  /** 올린 날 (한국 날짜 YYYY-MM-DD) */
  date: string;
  /** 무엇이 좋아졌는지 한 줄 — 회원 말로 */
  title: string;
  /** 펼치면 보이는 설명 1~3줄 (첫 줄은 접혔을 때도 보인다) */
  lines: readonly string[];
  /** 바로 보기 — 앱 안 경로. '{today}' 는 오늘 날짜로 바뀐다 (운동 달력 '/home?cal={today}') */
  link?: { to: string; label: string };
  /** 회원님 제안으로 만든 것 — 「회원 제안」 표시 */
  fromMember?: boolean;
  /** 보이는 사람 — 기본 모두 · staff = 코치님 · 지점장님 · 운영진만 */
  audience?: UpdateAudience;
  /** 이 지점 회원만 (비우면 모든 지점) — 시범 지점에서 먼저 연 기능 */
  branches?: readonly string[];
}

export interface UpdateViewer {
  /** 코치님 · 지점장님 · 운영진 */
  staff: boolean;
  /** 대표님 · 운영진 — 지점과 상관없이 모두 */
  hq?: boolean;
  branch: string | null | undefined;
}

export const UPDATE_ID_RE = /^20\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 기기에 기억하는 본 업데이트 수 — 넘으면 오래된 것부터 버린다 */
export const SEEN_MAX = 400;

/** 이 사람에게 보이는 업데이트 — 최신 날짜 먼저(같은 날은 파일 순서) */
export function visibleUpdates(list: readonly AppUpdate[], viewer: UpdateViewer): AppUpdate[] {
  return list
    .filter((u) => (u.audience ?? "all") === "all" || viewer.staff || viewer.hq)
    .filter((u) => !u.branches?.length || viewer.hq || (!!viewer.branch && u.branches.includes(viewer.branch)))
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (a.u.date === b.u.date ? a.i - b.i : a.u.date < b.u.date ? 1 : -1))
    .map((x) => x.u);
}

/** 기기에 남긴 본 것 — 믿지 않고 다듬는다 (글자 id 만 · 중복 없이 · SEEN_MAX 까지) */
export function parseSeen(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) {
      if (typeof x === "string" && UPDATE_ID_RE.test(x) && !out.includes(x)) out.push(x);
      if (out.length >= SEEN_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** 본 것에 더하기 — 새로 본 것을 앞에 · 중복 없이 · SEEN_MAX 까지 */
export function mergeSeen(seen: readonly string[], ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const x of [...ids, ...seen]) {
    if (!out.includes(x)) out.push(x);
    if (out.length >= SEEN_MAX) break;
  }
  return out;
}

/** 아직 안 본 업데이트 id */
export function unseenIds(list: readonly AppUpdate[], seen: readonly string[]): Set<string> {
  const s = new Set(seen);
  return new Set(list.filter((u) => !s.has(u.id)).map((u) => u.id));
}

/** 「새」 표시 — 이 기기에서 처음 열면(본 것이 하나도 없으면) 가장 최근 날짜 칸만, 그 뒤로는 안 본 것 모두
 *  (처음엔 모두 새것이라 모든 줄에 붙이면 표시가 아무 뜻이 없다) */
export function newBadgeIds(list: readonly AppUpdate[], seen: readonly string[]): Set<string> {
  if (seen.length === 0) {
    const top = list[0]?.date;
    return new Set(list.filter((u) => u.date === top).map((u) => u.id));
  }
  return unseenIds(list, seen);
}

/** 바로 보기 경로 — '{today}' 를 오늘(한국 날짜)로 */
export function resolveUpdateLink(to: string, today: string): string {
  return to.split("{today}").join(today);
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** '11월 15일 (일)' */
export function updateDayLabel(date: string): string {
  if (!YMD.test(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEK[wd]})`;
}

/** 날짜마다 묶기 — 보이는 순서 그대로 */
export function groupUpdatesByDate(list: readonly AppUpdate[]): { date: string; items: AppUpdate[] }[] {
  const out: { date: string; items: AppUpdate[] }[] = [];
  for (const u of list) {
    const last = out[out.length - 1];
    if (last && last.date === u.date) last.items.push(u);
    else out.push({ date: u.date, items: [u] });
  }
  return out;
}

/** 내역 한 칸 검사 — 시험이 모든 칸에 돌린다 (빈 배열 = 통과) */
export function updateProblems(u: AppUpdate): string[] {
  const p: string[] = [];
  if (!UPDATE_ID_RE.test(u.id)) p.push("id 모양");
  if (!YMD.test(u.date)) p.push("date 모양");
  else if (u.id.slice(0, 8) !== u.date.replace(/-/g, "")) p.push("id 앞 8자리 = date");
  if (!u.title.trim() || u.title.length > 34) p.push("title 1~34자");
  if (u.lines.length < 1 || u.lines.length > 3) p.push("lines 1~3줄");
  for (const l of u.lines) if (!l.trim() || l.length > 48) p.push(`line 1~48자: ${l}`);
  if (u.link && (!u.link.to.startsWith("/") || !u.link.label.trim() || u.link.label.length > 14)) p.push("link 모양");
  if (u.audience && u.audience !== "all" && u.audience !== "staff") p.push("audience");
  if (u.branches && u.branches.some((b) => !b.startsWith("153복싱짐 "))) p.push("branches 지점 이름");
  return p;
}
