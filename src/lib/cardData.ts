/**
 * 📊 영상으로 배우기 데이터 — 대표님 데이터 화면 · 다음 촬영 목록 · 카드 숫자 · 「많이 담은 동작」 (2026-11-15 대표님 「다음 4단계진행」)
 *
 *   서버(supabase/migrations/20261115110446_training_card_data.sql)는 사람 수만 보낸다 — 이 파일은 읽기 · 비율 · 줄 세우기 · 촬영 목록 계산.
 *   · 비율(끝까지 · 어려워요)은 3명 이상일 때만 (작은 숫자로 판단하지 않게 — 3단계 hardPercent 와 같은 3명)
 *   · 다음 촬영 목록 = 회원용 영상이 없는 카드(영상 요청 · 본 회원 · 어려워요 · 의견 · 담기) + 찾았는데 없는 검색어
 *     (지금 카드 이름과 맞으면 그 카드로 합치고, 영상이 이미 있는 카드면 뺀다) → 점수 순 · 맨 위 5개 「추천」
 *   · 「많이 담은 동작」은 담은 회원이 5명을 넘을 때만(결정 5번) — 서버 training_card_popular 가 고른다
 *   시험: cardData.test.ts (서버 마이그레이션 글과 기준이 같은지도)
 */
import { RANK_LABELS, RANK_ORDER } from "@/lib/rankLabels";

export type LeagueId = (typeof RANK_ORDER)[number];

/** 리그별 — s 담은 회원 · e 쉬워요 · o 딱 좋아요 · h 어려워요 */
export interface LeagueSplit {
  s: number;
  e: number;
  o: number;
  h: number;
}

export interface ItemStat {
  /** 'c:<카드>' · 'm:<레벨 미션 영상>' */
  item: string;
  /** 카드 시트를 열거나 영상이 돈 회원 */
  viewers: number;
  /** 연 횟수 */
  opens: number;
  /** 영상 본 회원 · 끝까지 본 회원 · 다시 본 회원 */
  players: number;
  completers: number;
  replayers: number;
  savers: number;
  hearts: number;
  easy: number;
  ok: number;
  hard: number;
  opinions: number;
  /** 답 기다리는 의견 */
  waiting: number;
  /** 영상 찍어 주세요 */
  film: number;
  leagues: Partial<Record<LeagueId, LeagueSplit>>;
}

export interface Wish {
  key: string;
  query: string;
  /** 찾았는데 없는 회원 · 영상 요청 회원 · 둘 중 하나라도 남긴 회원 */
  miss: number;
  film: number;
  users: number;
  lastAt: string;
}

export interface StatsTotals {
  shelfMembers: number;
  members: number;
  players: number;
  completers: number;
  savers: number;
  reactors: number;
  opinions: number;
  waiting: number;
  askers: number;
  leagues: Partial<Record<LeagueId, number>>;
}

export interface CardStats {
  days: number;
  since: string;
  branch: string | null;
  branches: string[];
  totals: StatsTotals;
  /** 본 회원 많은 순(서버 순서) */
  list: ItemStat[];
  items: Map<string, ItemStat>;
  wishes: Wish[];
  demo: boolean;
}

export const DATA_PERIODS = [
  { days: 7, label: "지난 7일" },
  { days: 28, label: "지난 4주" },
  { days: 365, label: "1년" },
] as const;
export const DEFAULT_DATA_DAYS = 28;
/** 비율은 이만큼 모였을 때만 */
export const RATE_MIN = 3;
/** 「많이 담은 동작」 — 담은 회원이 이 숫자를 넘을 때 (서버 having count(*) > 5) */
export const POPULAR_OVER = 5;
/** 다음 촬영 목록 맨 위 「추천」 */
export const FILM_PICK = 5;
/** 월요일 요약 알림 → 데이터 창 */
export const DATA_LINK = "/missions?learn=1&data=1";

export const periodLabel = (days: number) => DATA_PERIODS.find((p) => p.days === days)?.label ?? `지난 ${days}일`;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const isLeague = (k: string): k is LeagueId => (RANK_ORDER as readonly string[]).includes(k);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function parseItem(raw: unknown): ItemStat | null {
  const r = obj(raw);
  const item = typeof r.item === "string" ? r.item : "";
  if (!/^[cm]:[0-9a-f-]{36}$/.test(item)) return null;
  const leagues: Partial<Record<LeagueId, LeagueSplit>> = {};
  for (const [k, v] of Object.entries(obj(r.leagues))) {
    if (!isLeague(k)) continue;
    const l = obj(v);
    const split = { s: num(l.s), e: num(l.e), o: num(l.o), h: num(l.h) };
    if (split.s + split.e + split.o + split.h > 0) leagues[k] = split;
  }
  return {
    item,
    viewers: num(r.viewers),
    opens: num(r.opens),
    players: num(r.players),
    completers: num(r.completers),
    replayers: num(r.replayers),
    savers: num(r.savers),
    hearts: num(r.hearts),
    easy: num(r.easy),
    ok: num(r.ok),
    hard: num(r.hard),
    opinions: num(r.opinions),
    waiting: num(r.waiting),
    film: num(r.film),
    leagues,
  };
}

/** 서버 값을 믿지 않고 다듬기 — 모르는 칸 · 음수 · 틀린 열쇠는 버린다 */
export function parseStats(raw: unknown, demo = false): CardStats {
  const r = obj(raw);
  const t = obj(r.totals);
  const leagues: Partial<Record<LeagueId, number>> = {};
  for (const [k, v] of Object.entries(obj(t.leagues))) if (isLeague(k) && num(v) > 0) leagues[k] = num(v);
  const list: ItemStat[] = [];
  const items = new Map<string, ItemStat>();
  for (const x of Array.isArray(r.items) ? r.items : []) {
    const s = parseItem(x);
    if (s && !items.has(s.item)) {
      items.set(s.item, s);
      list.push(s);
    }
  }
  const wishes: Wish[] = [];
  for (const x of Array.isArray(r.wishes) ? r.wishes : []) {
    const w = obj(x);
    const key = typeof w.key === "string" ? w.key : "";
    if (!key.startsWith("q:")) continue;
    const query = (typeof w.query === "string" && w.query.trim() ? w.query : key.slice(2)).trim().slice(0, 40);
    wishes.push({ key, query, miss: num(w.miss), film: num(w.film), users: num(w.users), lastAt: typeof w.last_at === "string" ? w.last_at : "" });
  }
  return {
    days: num(r.days) || DEFAULT_DATA_DAYS,
    since: typeof r.since === "string" ? r.since : "",
    branch: typeof r.branch === "string" && r.branch.trim() ? r.branch : null,
    branches: (Array.isArray(r.branches) ? r.branches : []).filter((b): b is string => typeof b === "string" && !!b.trim()),
    totals: {
      shelfMembers: num(t.shelf_members),
      members: num(t.members),
      players: num(t.players),
      completers: num(t.completers),
      savers: num(t.savers),
      reactors: num(t.reactors),
      opinions: num(t.opinions),
      waiting: num(t.waiting),
      askers: num(t.askers),
      leagues,
    },
    list,
    items,
    wishes,
    demo,
  };
}

/* ───────── 비율 · 숫자 ───────── */

export const feelTotal = (s: Pick<ItemStat, "easy" | "ok" | "hard">) => s.easy + s.ok + s.hard;
/** 끝까지 본 비율 — 영상 본 회원 3명 이상일 때만 */
export const completeRate = (s: ItemStat): number | null =>
  s.players >= RATE_MIN ? Math.round((Math.min(s.completers, s.players) / s.players) * 100) : null;
/** 어려워요 비율 — 쉬워요 · 딱 좋아요 · 어려워요를 고른 회원 3명 이상일 때만 */
export const hardRate = (s: Pick<ItemStat, "easy" | "ok" | "hard">): number | null => {
  const total = feelTotal(s);
  return total >= RATE_MIN ? Math.round((s.hard / total) * 100) : null;
};

export type Metric = "viewers" | "complete" | "savers" | "hearts" | "hard" | "opinions" | "film";
export const METRICS: readonly { id: Metric; label: string }[] = [
  { id: "viewers", label: "본 회원" },
  { id: "complete", label: "끝까지" },
  { id: "savers", label: "담기" },
  { id: "hearts", label: "♥" },
  { id: "hard", label: "어려워요" },
  { id: "opinions", label: "의견" },
  { id: "film", label: "영상 요청" },
];

export function metricValue(s: ItemStat, m: Metric): number | null {
  switch (m) {
    case "viewers":
      return s.viewers;
    case "complete":
      return completeRate(s);
    case "savers":
      return s.savers;
    case "hearts":
      return s.hearts;
    case "hard":
      return hardRate(s);
    case "opinions":
      return s.opinions;
    case "film":
      return s.film;
  }
}

export function metricText(s: ItemStat, m: Metric): string {
  const v = metricValue(s, m);
  if (v == null) return "—";
  if (m === "complete" || m === "hard") return `${v}%`;
  if (m === "opinions") return `${v}개`;
  return `${v}명`;
}

/** 줄 세우기 — 값이 있는 카드만, 큰 순 (같으면 본 회원 · 열쇠 순) */
export function rankBy(list: readonly ItemStat[], m: Metric, limit = 15): ItemStat[] {
  const tie = (s: ItemStat) => (m === "hard" ? s.hard : m === "complete" ? s.completers : s.viewers);
  return list
    .map((s) => ({ s, v: metricValue(s, m) }))
    .filter((x): x is { s: ItemStat; v: number } => x.v != null && x.v > 0)
    .sort((a, b) => b.v - a.v || tie(b.s) - tie(a.s) || b.s.viewers - a.s.viewers || a.s.item.localeCompare(b.s.item))
    .slice(0, limit)
    .map((x) => x.s);
}

/** 카드 타일 아래 숫자 한 줄 — 0 · 모자란 비율은 빼고 4개까지 */
export function statParts(s: ItemStat | undefined | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.viewers) out.push(`본 ${s.viewers}`);
  if (s.savers) out.push(`담기 ${s.savers}`);
  if (s.hearts) out.push(`♥ ${s.hearts}`);
  const hr = hardRate(s);
  if (hr != null && s.hard > 0) out.push(`어려워요 ${hr}%`);
  else if (s.opinions) out.push(`의견 ${s.opinions}`);
  return out.slice(0, 4);
}

/** 카드 창 — 숫자가 있는 줄만 */
export function detailRows(s: ItemStat | undefined | null): { label: string; value: string }[] {
  if (!s) return [];
  const rows: { label: string; value: string }[] = [];
  if (s.viewers) rows.push({ label: "본 회원", value: `${s.viewers}명${s.opens > s.viewers ? ` · ${s.opens}번 열기` : ""}` });
  if (s.players) {
    const cr = completeRate(s);
    rows.push({ label: "끝까지 본 회원", value: `${s.completers}명 / 영상 본 ${s.players}명${cr != null ? ` · ${cr}%` : ""}` });
  }
  if (s.replayers) rows.push({ label: "다시 본 회원", value: `${s.replayers}명` });
  if (s.savers) rows.push({ label: "담은 회원", value: `${s.savers}명` });
  if (s.hearts) rows.push({ label: "♥", value: `${s.hearts}명` });
  if (feelTotal(s)) {
    const hr = hardRate(s);
    rows.push({ label: "쉬워요 · 딱 좋아요 · 어려워요", value: `${s.easy} · ${s.ok} · ${s.hard}${hr != null ? ` (어려워요 ${hr}%)` : ""}` });
  }
  if (s.opinions) rows.push({ label: "의견", value: `${s.opinions}개${s.waiting ? ` · 답 기다려요 ${s.waiting}` : ""}` });
  if (s.film) rows.push({ label: "영상 찍어 주세요", value: `${s.film}명` });
  return rows;
}

const leagueOrder = (o: Partial<Record<LeagueId, unknown>>) => RANK_ORDER.filter((l) => o[l] != null);

/** 리그별 한 줄 — 담기: '화이트 3 · 블루 1' / 어려워요: '화이트 1/2 · 블루 1/1' (고른 회원 중 어려워요) */
export function leagueLine(s: ItemStat | undefined | null, kind: "savers" | "hard"): string | null {
  if (!s) return null;
  const parts = leagueOrder(s.leagues)
    .map((l) => {
      const x = s.leagues[l]!;
      if (kind === "savers") return x.s ? `${RANK_LABELS[l]} ${x.s}` : null;
      const total = x.e + x.o + x.h;
      return total ? `${RANK_LABELS[l]} ${x.h}/${total}` : null;
    })
    .filter((x): x is string => !!x);
  return parts.length ? parts.join(" · ") : null;
}

/** 본 회원 리그별 — '화이트 12 · 블루 3' */
export function totalsLeagueLine(t: StatsTotals): string | null {
  const parts = leagueOrder(t.leagues).map((l) => `${RANK_LABELS[l]} ${t.leagues[l]}`);
  return parts.length ? parts.join(" · ") : null;
}

/* ───────── 다음 촬영 목록 ───────── */

export interface FilmTarget {
  /** 'c:<카드>' */
  key: string;
  name: string;
  /** 회원용 영상이 이미 있나 */
  hasVideo: boolean;
}

export interface FilmCandidate {
  id: string;
  kind: "card" | "query";
  /** 카드면 'c:<카드>' (누르면 카드 시트) */
  key: string | null;
  name: string;
  score: number;
  reasons: string[];
  recommended: boolean;
}

/**
 * 다음 촬영 목록 — 점수 = 영상 요청 ×3 + 찾았는데 없음 ×2 + 어려워요 ×2 + 본 회원 + 의견 + 담기
 * targets: 회원에게 보이는 카드(열쇠 → 이름 · 영상 있나) · matchQuery: 검색어가 지금 카드와 맞으면 그 카드
 */
export function filmPlan(
  stats: CardStats,
  opts: { targets: ReadonlyMap<string, FilmTarget>; matchQuery: (q: string) => FilmTarget | null },
  limit = 12,
): FilmCandidate[] {
  const cards = new Map<string, FilmCandidate>();
  const cardOf = (t: FilmTarget) => {
    let c = cards.get(t.key);
    if (!c) {
      c = { id: t.key, kind: "card", key: t.key, name: t.name, score: 0, reasons: [], recommended: false };
      cards.set(t.key, c);
    }
    return c;
  };
  for (const s of stats.list) {
    if (!s.item.startsWith("c:")) continue;
    const t = opts.targets.get(s.item);
    if (!t || t.hasVideo) continue;
    const score = s.film * 3 + s.hard * 2 + s.viewers + s.opinions + s.savers;
    if (score <= 0) continue;
    const c = cardOf(t);
    c.score += score;
    if (s.film) c.reasons.push(`영상 요청 ${s.film}명`);
    if (s.viewers) c.reasons.push(`본 회원 ${s.viewers}명`);
    const hr = hardRate(s);
    if (hr != null && s.hard) c.reasons.push(`어려워요 ${hr}%`);
    if (s.opinions) c.reasons.push(`의견 ${s.opinions}개`);
    if (s.savers) c.reasons.push(`담기 ${s.savers}명`);
  }
  const queries: FilmCandidate[] = [];
  for (const w of stats.wishes) {
    const score = w.film * 3 + w.miss * 2;
    if (score <= 0) continue;
    const t = opts.matchQuery(w.query);
    if (t?.hasVideo) continue; // 이제 영상이 있다
    if (t) {
      const c = cardOf(t);
      c.score += score;
      c.reasons.push(`찾기 ‘${w.query}’ ${w.users}명`);
      continue;
    }
    const reasons: string[] = [];
    if (w.film) reasons.push(`영상 요청 ${w.film}명`);
    if (w.miss) reasons.push(`찾았는데 없음 ${w.miss}명`);
    queries.push({ id: w.key, kind: "query", key: null, name: w.query, score, reasons, recommended: false });
  }
  const all = [...cards.values(), ...queries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ko"));
  return all.slice(0, limit).map((c, i) => ({ ...c, recommended: i < FILM_PICK }));
}

/** 촬영 목록 복사 글 — 「추천」 먼저, 번호 · 이름 · 까닭 */
export function filmListText(list: readonly FilmCandidate[], label: string, branch: string | null): string {
  if (!list.length) return "";
  const head = `153 다음 촬영 목록 · ${label}${branch ? ` · ${branch}` : ""} · 회원 기준`;
  const lines = list.map((c, i) => `${i + 1}. ${c.name}${c.kind === "query" ? " (찾은 말)" : ""}${c.recommended ? " ★" : ""} — ${c.reasons.join(" · ")}`);
  return [head, ...lines].join("\n");
}

/* ───────── 예시 (?demo=1 — 서버를 부르지 않음) ───────── */

const hash = (key: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
};

/** 예시 숫자 — 열쇠마다 늘 같은 값(화면에 「예시」로 표시) */
export function demoStats(days: number, branch: string | null, keys: readonly string[]): CardStats {
  const scale = days <= 7 ? 1 : days <= 28 ? 3 : 8;
  const items = keys
    .filter((k) => /^[cm]:/.test(k))
    .map((k) => {
      const viewers = hash(k, 7) * scale;
      const players = k.startsWith("m:") || hash(`${k}v`, 3) === 0 ? Math.max(0, viewers - hash(`${k}p`, 3)) : 0;
      const easy = hash(`${k}e`, 4);
      const hard = hash(`${k}h`, 4);
      return {
        item: k,
        viewers,
        opens: viewers + hash(`${k}o`, 5),
        players,
        completers: Math.max(0, players - hash(`${k}c`, 3)),
        replayers: hash(`${k}r`, 3),
        savers: hash(`${k}s`, 4) * (scale > 1 ? 2 : 1),
        hearts: hash(`${k}l`, 5),
        easy,
        ok: hash(`${k}k`, 4),
        hard,
        opinions: hash(`${k}q`, 6) === 0 ? 1 : 0,
        waiting: 0,
        film: players ? 0 : hash(`${k}f`, 4),
        leagues: hard + easy ? { white: { s: hash(`${k}s`, 4), e: easy, o: 0, h: hard } } : {},
      } satisfies ItemStat;
    })
    .filter((s) => s.viewers + s.savers + s.hearts + s.easy + s.hard + s.film > 0)
    .sort((a, b) => b.viewers - a.viewers || a.item.localeCompare(b.item));
  return {
    days,
    since: "",
    branch,
    branches: ["153복싱짐 선릉역점", "153복싱짐 칠금점"],
    totals: {
      shelfMembers: 14 * scale,
      members: 11 * scale,
      players: 6 * scale,
      completers: 4 * scale,
      savers: 3 * scale,
      reactors: 4 * scale,
      opinions: scale,
      waiting: 1,
      askers: 2 * scale,
      leagues: { white: 10 * scale, blue: scale },
    },
    list: items,
    items: new Map(items.map((s) => [s.item, s])),
    wishes: [
      { key: "q:어퍼컷", query: "어퍼컷", miss: 2 * scale, film: scale, users: 2 * scale, lastAt: "" },
      { key: "q:스웨이", query: "스웨이", miss: scale, film: 0, users: scale, lastAt: "" },
    ],
    demo: true,
  };
}

/** 예시 「많이 담은 동작」 — 몇 장만 */
export const demoPopular = (keys: readonly string[]): Set<string> => new Set(keys.filter((k) => k.startsWith("c:") && hash(`${k}pop`, 6) === 0));
