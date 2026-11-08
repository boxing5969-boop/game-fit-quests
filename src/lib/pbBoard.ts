/**
 * 📺 153 PB 라이브보드 — 숫자 · 실시간 신호 · 자동 전환 판단 (2026-11-08 대표님 「다음진행 추천대로」,
 *   보고서 「153 PB 라이브보드 설계」 1단계 — 화이트 · 최대 4명 · 측정이 시작되면 TV 자동 전환)
 *
 *   화면: TV1 /tv/:지점/pb1 「코스 보드」 · TV2 /tv/:지점/pb2 「기록 보드」 → src/pages/LiveBoardPb153Page.tsx
 *   숫자(종목 · 개수 · 캡)는 전부 src/lib/test153.ts 에서 가져온다. 여기서 새로 정하지 않는다.
 *
 *   실시간 신호: 코치 측정 화면(Test153MeasurePanel)이 채널 `test153-live:<지점 이름>` 으로 측정 상태를 보낸다
 *   (시작 시각 · 끝낸 구간 시각 · 부문 · 저장 결과). 이름 · user_id 는 싣지 않는다 — 라이브보드 board-ping 과 같은 원칙
 *   (공개 채널이라 누구나 들을 수 있다).
 *   2단계(2026-11-08 「2단계넘어가자」): 히트(최대 4명) — 신호 id = `<히트 id>:<레인>`. 닉네임 · 지난번의 나(고스트)는
 *   TV 가 board_test153_live(지점, TV 열쇠)로 따로 읽는다(supabase/migrations/20261108192625_test153_heats.sql).
 */
import {
  TEST153_CAP_MS,
  TEST153_STATIONS,
  buildSegments,
  fmtScore,
  stationReps,
  type Test153Division,
} from "@/lib/test153";
import { RED_TITLE_PB_LIMIT_MIN } from "@/lib/titleMissionGuide";

export const PB_SEGMENT_COUNT = TEST153_STATIONS.length * 2; // 16 — 셀트런1, 종목1, … 셀트런8, 종목8
export const PB_TITLE_MS = RED_TITLE_PB_LIMIT_MIN * 60_000; // 레드 타이틀 기준 (오픈 완주 22분 안)
export const PB_RUN_TOTAL_M = TEST153_STATIONS.length * 100; // 셀트런 100m × 8 = 800m
export const PB_MAX_RUNS = 4; // TV 에 한꺼번에 보이는 측정 (대표님 11/08 — 히트 최대 4명)

/** 오픈 410개 · 스타터 205개 — 회 · 세트 · 걸음을 1개로 세는 앱 기준(타임캡 남은 개수와 같은 셈) */
export const pbTotalReps = (d: Test153Division): number =>
  TEST153_STATIONS.reduce((a, s) => a + stationReps(s, d), 0);

/* ─────────────────────────── TV1 화면 칸 (1920×1080 고정) ───────────────────────────
 * 8분할 시범은 영상 1개(public/test153/pb-grid.mp4)다 — TV 브라우저는 영상 여러 개를 함께 틀면 버벅인다
 * (10/26 라이브보드 렉). 영상 안의 8칸 자리와 화면 카드 자리가 같아야 해서 숫자를 여기 한 곳에 둔다.
 * 영상을 다시 만들 때: scripts/make-pb-grid.sh (같은 숫자를 쓴다).
 */
export const PB_GRID = {
  x: 32,
  y: 322,
  w: 1856,
  h: 734,
  gap: 16,
  cellW: 452,
  cellH: 359,
  border: 2,
  videoH: 231,
} as const;

/** 칸 i(0~7)의 왼쪽 위 (그리드 기준) */
export const pbCellPos = (i: number) => ({
  left: (i % 4) * (PB_GRID.cellW + PB_GRID.gap),
  top: Math.floor(i / 4) * (PB_GRID.cellH + PB_GRID.gap),
});

/* ─────────────────────────── 실시간 신호 ─────────────────────────── */

export const pbLiveChannel = (branchName: string) => `test153-live:${branchName}`;

/** 측정 화면 → TV. 이름 · user_id 없음 */
export interface PbLiveMsg {
  v: 1;
  /** 측정 한 번의 id — 시작 시각 */
  id: string;
  division: Test153Division;
  /** 보낸 기기 시계 기준 */
  startAt: number;
  marks: number[];
  stoppedAt: number | null;
  /** 보낸 순간 (보낸 기기 시계) — 받는 쪽이 시계 차이를 맞춘다 */
  sentAt: number;
  /** 공식 기록으로 저장한 뒤에만 */
  pb?: { isPb: boolean; prevMs: number | null; scoreMs: number } | null;
  /** 2단계 히트 — 히트 id · 레인(1~4). 레인 = TV 번호 · 색 */
  heat?: string | null;
  lane?: number | null;
}

export interface PbLiveRun extends PbLiveMsg {
  /** TV 시계 − 보낸 기기 시계 (가장 작은 값 = 지연이 가장 적었던 신호) */
  offset: number;
  /** TV 시계 */
  lastSeen: number;
  /** TV 에 보이는 번호 1~4 */
  slot: number;
}

/** 이만큼 신호가 없으면 TV 에서 내린다 (측정 화면은 5초마다 다시 보낸다) */
export const PB_LOST_MS = 60_000;
/** 끝난 측정을 TV 에 남겨 두는 시간 (코치가 '다음 회원'을 누르면 바로 내려간다) */
export const PB_DONE_KEEP_MS = 3 * 60_000;
/** 자동 전환으로 들어온 PB 화면이 원래 화면으로 돌아가는 시간 (마지막 측정이 끝난 뒤) */
export const PB_AUTO_RETURN_MS = 3 * 60_000;

export const isPbLiveMsg = (p: unknown): p is PbLiveMsg => {
  const m = p as PbLiveMsg | null;
  return (
    !!m &&
    m.v === 1 &&
    typeof m.id === "string" &&
    (m.division === "open" || m.division === "starter") &&
    typeof m.startAt === "number" &&
    Array.isArray(m.marks) &&
    typeof m.sentAt === "number"
  );
};

export type PbRunPhase = "running" | "finished" | "capped" | "stopped";

export const pbRunPhase = (r: Pick<PbLiveMsg, "marks" | "stoppedAt" | "startAt">): PbRunPhase => {
  if (r.marks.length >= PB_SEGMENT_COUNT) return "finished";
  if (r.stoppedAt != null) return r.stoppedAt - r.startAt >= TEST153_CAP_MS ? "capped" : "stopped";
  return "running";
};

/** 신호 하나를 받아 TV 의 측정 목록을 고친다 (같은 id 면 덮어쓰기 · 번호는 비어 있는 가장 작은 수) */
export const applyPbLive = (runs: PbLiveRun[], msg: PbLiveMsg, now: number): PbLiveRun[] => {
  const offsetNow = now - msg.sentAt;
  const prev = runs.find((r) => r.id === msg.id);
  if (prev) {
    return runs.map((r) =>
      r.id === msg.id ? { ...msg, offset: Math.min(prev.offset, offsetNow), lastSeen: now, slot: prev.slot } : r,
    );
  }
  let list = runs;
  if (list.length >= PB_MAX_RUNS) {
    // 가장 오래 소식 없는 것부터 내린다
    const oldest = [...list].sort((a, b) => a.lastSeen - b.lastSeen)[0];
    list = list.filter((r) => r.id !== oldest.id);
  }
  const used = new Set(list.map((r) => r.slot));
  // 히트면 레인 번호 그대로(측정 화면 · TV 레일 색이 같게) — 다른 측정이 그 번호를 쓰고 있으면 빈 번호
  let slot = typeof msg.lane === "number" && msg.lane >= 1 && msg.lane <= PB_MAX_RUNS && !used.has(msg.lane) ? msg.lane : 1;
  while (used.has(slot)) slot++;
  return [...list, { ...msg, offset: offsetNow, lastSeen: now, slot }];
};

export const removePbLive = (runs: PbLiveRun[], id: string): PbLiveRun[] => runs.filter((r) => r.id !== id);

/** 오래 소식 없는 측정 · 끝난(멈춘) 지 3분 지난 측정을 내린다 — 측정 화면이 계속 신호를 보내도 끝난 시각 기준 */
export const prunePbLive = (runs: PbLiveRun[], now: number): PbLiveRun[] =>
  runs.filter((r) => {
    if (now - r.lastSeen > PB_LOST_MS) return false;
    const phase = pbRunPhase(r);
    if (phase === "running") return true;
    const end = (phase === "finished" ? r.marks[PB_SEGMENT_COUNT - 1] : (r.stoppedAt ?? r.startAt)) + r.offset;
    return now - end <= PB_DONE_KEEP_MS;
  });

/** 지금까지 걸린 시간 (TV 시계로 계산 · 캡에서 멈춤) */
export const pbRunElapsed = (r: PbLiveRun, now: number): number => {
  const phase = pbRunPhase(r);
  if (phase === "finished") return r.marks[PB_SEGMENT_COUNT - 1] - r.startAt;
  if (r.stoppedAt != null) return Math.min(r.stoppedAt - r.startAt, TEST153_CAP_MS);
  return Math.max(0, Math.min(now - r.offset - r.startAt, TEST153_CAP_MS));
};

/** 지금 하는 구간 0~15 (끝났으면 16) */
export const pbRunSeg = (r: Pick<PbLiveMsg, "marks">): number => Math.min(r.marks.length, PB_SEGMENT_COUNT);

/** 구간 번호 → 종목 칸 번호(0~7). 셀트런 구간이면 그 뒤 종목 */
export const pbStationOfSeg = (seg: number): number => Math.min(TEST153_STATIONS.length - 1, Math.floor(seg / 2));

/** 'R4 푸시업' · 'R4 셀트런' · '완주' */
export const pbSegLabel = (seg: number, d: Test153Division): string => {
  if (seg >= PB_SEGMENT_COUNT) return "완주";
  const s = buildSegments(d)[seg];
  return `R${s.round} ${s.kind === "run" ? "셀트런" : s.short}`;
};

/** 예상 완주 — 끝낸 구간이 4개 이상일 때만 (지금 속도 그대로 가면) */
export const pbEtaMs = (r: PbLiveRun, now: number): number | null => {
  if (pbRunPhase(r) !== "running" || r.marks.length < 4) return null;
  const el = pbRunElapsed(r, now);
  return Math.round((el / r.marks.length) * PB_SEGMENT_COUNT);
};

/** TV1 큰 타이머에 쓸 측정 — 달리는 중인 것 중 가장 먼저 시작한 것, 없으면 가장 최근에 끝난 것 */
export const pbPrimaryRun = (runs: PbLiveRun[]): PbLiveRun | null => {
  const running = runs.filter((r) => pbRunPhase(r) === "running").sort((a, b) => a.startAt - b.startAt);
  if (running.length) return running[0];
  return [...runs].sort((a, b) => b.lastSeen - a.lastSeen)[0] ?? null;
};

/* ─────────────────────────── 히트 참가자 · 지난번의 나 (2단계) ─────────────────────────── */

/** 레인 1~4 색 — 측정 화면 버튼 · TV 레일 동그라미 · 기록 보드 줄이 같은 색 (빨강은 22:00 통과선 · 경고에 남겨 둔다) */
export const PB_LANE_COLORS = ["#0E9F70", "#2F6FB8", "#B7700C", "#2B3438"] as const;
export const pbLaneColor = (lane: number): string => PB_LANE_COLORS[(lane - 1) % PB_LANE_COLORS.length] ?? PB_LANE_COLORS[0];

export const pbRunKey = (heat: string, lane: number) => `${heat}:${lane}`;

export interface PbGhost {
  /** 지난번 최고 기록 점수 (완주 = 시간 · 캡 = 25:00 + 남은 개수 초) */
  ms: number;
  finished: boolean;
  remaining: number;
  /** 구간을 끝낸 누적 시각 16개 — 총 시간만 넣은 기록이면 null */
  cum: number[] | null;
}

/** TV 가 board_test153_live 로 받은 참가자 — 닉네임만 */
export interface PbLanePerson {
  name: string;
  league: string | null;
  level: number | null;
  staff: string | null;
  division: Test153Division;
  ghost: PbGhost | null;
  /** 이 부문 첫 도전 */
  first: boolean;
}
/** key = 신호 id `<히트 id>:<레인>` */
export type PbPeople = Record<string, PbLanePerson>;

const numOr = (v: unknown, d: number | null = null) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export const normalizePbGhost = (g: unknown): PbGhost | null => {
  const o = g as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const ms = numOr(o.ms);
  if (ms == null) return null;
  const cum = Array.isArray(o.cum) && o.cum.length === PB_SEGMENT_COUNT && o.cum.every((c) => typeof c === "number")
    ? (o.cum as number[])
    : null;
  return { ms, finished: o.finished === true, remaining: numOr(o.remaining, 0) ?? 0, cum };
};

/** board_test153_live 답 → 신호 id 별 참가자 */
export const normalizePbLive = (data: unknown): PbPeople => {
  const out: PbPeople = {};
  const heats = (data as { heats?: unknown } | null)?.heats;
  if (!Array.isArray(heats)) return out;
  for (const h of heats) {
    const id = (h as { id?: unknown })?.id;
    const lanes = (h as { lanes?: unknown })?.lanes;
    if (typeof id !== "string" || !Array.isArray(lanes)) continue;
    for (const l of lanes as Record<string, unknown>[]) {
      const lane = numOr(l?.lane);
      if (lane == null) continue;
      out[pbRunKey(id, lane)] = {
        name: typeof l.name === "string" && l.name.trim() ? l.name.trim() : "153 복서",
        league: typeof l.league === "string" ? l.league : null,
        level: numOr(l.level),
        staff: typeof l.staff === "string" && l.staff ? l.staff : null,
        division: l.division === "starter" ? "starter" : "open",
        ghost: normalizePbGhost(l.ghost),
        first: l.first === true,
      };
    }
  }
  return out;
};

/** TV 에 보일 이름 — 히트 참가자면 닉네임, 아니면 '측정 N번' */
export const pbRunName = (r: Pick<PbLiveRun, "id" | "slot">, people: PbPeople): string => people[r.id]?.name ?? `측정 ${r.slot}번`;
/** 레일 동그라미 안 글자 — 닉네임 첫 글자 (없으면 번호) */
export const pbRunMark = (r: Pick<PbLiveRun, "id" | "slot">, people: PbPeople): string => {
  const n = people[r.id]?.name;
  return n ? Array.from(n)[0] : String(r.slot);
};

/** 지난번의 나와 비교 — 같은 구간을 끝낸 시각 차이(ms · 음수 = 빨라요). 구간 기록이 없거나 아직 0구간이면 null */
export const pbGhostDelta = (r: Pick<PbLiveMsg, "marks" | "startAt">, ghost: PbGhost | null | undefined): number | null => {
  const cum = ghost?.cum;
  if (!cum || cum.length !== PB_SEGMENT_COUNT || r.marks.length === 0) return null;
  const k = Math.min(r.marks.length, PB_SEGMENT_COUNT);
  return r.marks[k - 1] - r.startAt - cum[k - 1];
};

/** 지금 경과 시간에 지난번의 나는 몇 번째 구간을 하고 있었나 (0~15 · 끝났으면 16) */
export const pbGhostSeg = (elapsed: number, ghost: PbGhost | null | undefined): number | null => {
  const cum = ghost?.cum;
  if (!cum || cum.length !== PB_SEGMENT_COUNT) return null;
  const i = cum.findIndex((c) => c > elapsed);
  return i === -1 ? PB_SEGMENT_COUNT : i;
};

/** '0:24' — 분:초 (반올림) */
const mss = (ms: number) => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * 지난번의 나 한 줄 — 앞서면 '지난번보다 0:24 빨라요', 뒤지면 '지난번의 나까지 0:05'(따라잡을 거리 — 늦다는 말 대신).
 * TV 에 회원 이름과 같이 나가는 글이라 줄어든 것을 탓하는 말은 쓰지 않는다.
 */
export const pbGhostText = (delta: number): { text: string; ahead: boolean } => {
  if (Math.round(Math.abs(delta) / 1000) === 0) return { text: "지난번의 나와 나란히", ahead: true };
  return delta < 0 ? { text: `지난번보다 ${mss(delta)} 빨라요`, ahead: true } : { text: `지난번의 나까지 ${mss(delta)}`, ahead: false };
};

/**
 * 레이스 순서 — 오픈 먼저 · 스타터 다음(개수가 절반이라 같이 줄 세우지 않는다),
 * 같은 부문 안에서는 끝낸 구간이 많은 사람 → 같으면 그 구간을 먼저 끝낸 사람 (TV 시계)
 */
export const pbRaceOrder = (runs: PbLiveRun[]): PbLiveRun[] => {
  const last = (r: PbLiveRun) => (r.marks.length ? r.marks[r.marks.length - 1] : r.startAt) + r.offset;
  const div = (r: PbLiveRun) => (r.division === "open" ? 0 : 1);
  return [...runs].sort((a, b) => div(a) - div(b) || pbRunSeg(b) - pbRunSeg(a) || last(a) - last(b) || a.slot - b.slot);
};

/** 자동 전환할 신호인가 — 달리는 중인 측정 */
export const pbShouldAutoSwitch = (p: unknown): boolean => isPbLiveMsg(p) && pbRunPhase(p) === "running";

/** 평소 화면 → PB 화면 (/1 → pb1 · /2 → pb2) · 그 밖은 null */
export const pbScreenFor = (screen: string | undefined): "pb1" | "pb2" | null =>
  screen === "1" ? "pb1" : screen === "2" ? "pb2" : null;

/** 주소 쿼리를 그대로 두고 auto 만 넣거나 뺀다 (?k= 열쇠 · embed · safe 유지) */
export const pbSearchWith = (search: string, auto: boolean): string => {
  const sp = new URLSearchParams(search);
  if (auto) sp.set("auto", "1");
  else sp.delete("auto");
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/* ─────────────────────────── 표시 ─────────────────────────── */

/** 큰 타이머 '08:42' (분 두 자리) */
export const pbClock = (ms: number): string => {
  const safe = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

/** 기록 '21:18' · 캡이면 '캡 + 12개' */
export const pbScore = (r: { finished: boolean; score_ms: number; remaining?: number | null }): string =>
  r.finished ? pbClock(r.score_ms) : fmtScore({ finished: false, score_ms: r.score_ms, remaining_reps: r.remaining ?? null });

/** '−0:24' (줄인 시간) */
export const pbDelta = (ms: number): string => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${ms < 0 ? "+" : "−"}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const PB_LEAGUE: Record<string, { label: string; color: string }> = {
  white: { label: "화이트", color: "#A9B3B8" },
  blue: { label: "블루", color: "#2F6FB8" },
  red: { label: "레드", color: "#C8461F" },
  black: { label: "블랙", color: "#2B3438" },
};

export type PbRankKey = "open_m" | "open_f" | "starter_m" | "starter_f";
export const PB_RANK_PAGES: { key: PbRankKey; label: string; division: Test153Division }[] = [
  { key: "open_m", label: "오픈 남자", division: "open" },
  { key: "open_f", label: "오픈 여자", division: "open" },
  { key: "starter_m", label: "스타터 남자", division: "starter" },
  { key: "starter_f", label: "스타터 여자", division: "starter" },
];

/* ─────────────────────────── 기록 보드 데이터 (board_test153) ─────────────────────────── */

export interface PbRankRow {
  pos: number;
  name: string;
  branch: string;
  score_ms: number;
  finished: boolean;
  remaining: number | null;
  league: string | null;
  level: number | null;
  staff: string | null;
  at: string;
}

export interface PbBoardData {
  branch: string;
  rank: Partial<Record<PbRankKey, PbRankRow[]>>;
  improved: { name: string; division: Test153Division; delta_ms: number; best_ms: number }[];
  records: { key: string; label: string; name: string; value: number | null; at: string }[];
  recent: {
    name: string;
    division: Test153Division;
    score_ms: number;
    finished: boolean;
    remaining: number | null;
    first: boolean;
    pb: boolean;
    at: string;
  }[];
  totals: { records: number; people: number; month: number };
}

/** 10초마다 돌아가는 순위 장 — 기록이 있는 부문만 (하나도 없으면 오픈 남자 한 장을 빈칸으로) */
export const pbRankPages = (data: PbBoardData | null) => {
  const withRows = PB_RANK_PAGES.filter((p) => (data?.rank[p.key]?.length ?? 0) > 0);
  return withRows.length ? withRows : [PB_RANK_PAGES[0]];
};

/** 153 레코드 칸 — 아직 없는 것은 '첫 주인공을 기다려요' */
export const PB_RECORD_SLOTS = [
  { key: "first_test153_top_m", label: "최초 153 PB 1위 · 남자" },
  { key: "first_test153_top_f", label: "최초 153 PB 1위 · 여자" },
  { key: "first_test153", label: "최초 153 PB 완주" },
] as const;

/* ─────────────────────────── 예시 화면 (?demo=1) ─────────────────────────── */

const DEMO_OPEN = [52, 118, 49, 96, 51, 84, 50, 95, 53, 101, 52, 108, 54, 92, 55, 120].map((s) => s * 1000);
const DEMO_OPEN_B = [50, 124, 51, 99, 50, 90, 52, 98, 52, 104, 53, 110, 52, 96, 54, 118].map((s) => s * 1000);
const DEMO_STARTER = [48, 60, 46, 50, 47, 44, 47, 48, 49, 52, 48, 55, 50, 47, 51, 62].map((s) => s * 1000);
const demoGhost = (durs: number[], scale: number): PbGhost => {
  let t = 0;
  const cum = durs.map((d) => (t += Math.round(d * scale)));
  return { ms: cum[cum.length - 1], finished: true, remaining: 0, cum };
};

/** 미리보기용 가짜 히트(3명 · 8분 42초째) — 실제 신호가 오면 그쪽이 이긴다 */
export const pbDemoRuns = (now: number, base: number = now): PbLiveRun[] => {
  const startAt = base - 522_000;
  const mk = (lane: number, segDur: number[], division: Test153Division): PbLiveRun => {
    const marks: number[] = [];
    let t = startAt;
    for (const d of segDur) {
      t += d;
      if (t < now) marks.push(t);
    }
    return {
      v: 1, id: pbRunKey("demo", lane), heat: "demo", lane, division, startAt, marks,
      stoppedAt: null, sentAt: now, offset: 0, lastSeen: now, slot: lane,
    };
  };
  return [mk(1, DEMO_OPEN, "open"), mk(2, DEMO_OPEN_B, "open"), mk(3, DEMO_STARTER, "starter")];
};

/** 예시 참가자 — 닉네임 · 지난번의 나 (1번은 지난번보다 빠름 · 2번은 따라가는 중 · 3번은 첫 도전) */
export const PB_DEMO_PEOPLE: PbPeople = {
  [pbRunKey("demo", 1)]: {
    name: "민준", league: "red", level: 22, staff: null, division: "open", first: false, ghost: demoGhost(DEMO_OPEN, 1.04),
  },
  [pbRunKey("demo", 2)]: {
    name: "서연", league: "blue", level: 18, staff: null, division: "open", first: false, ghost: demoGhost(DEMO_OPEN_B, 0.97),
  },
  [pbRunKey("demo", 3)]: { name: "지호", league: "white", level: 6, staff: null, division: "starter", first: true, ghost: null },
};

export const PB_DEMO_BOARD: PbBoardData = {
  branch: "153복싱짐 선릉역점",
  rank: {
    open_m: [
      ["민준", "선릉역점", 1132000, "black", 31],
      ["태윤", "선릉역점", 1180000, "red", 27],
      ["준서", "칠금점", 1215000, "red", 25],
      ["현우", "선릉역점", 1258000, "red", 22],
      ["시우", "선릉역점", 1300000, "blue", 18],
      ["도윤", "선릉역점", 1318000, "red", 21],
      ["건우", "칠금점", 1351000, "blue", 16],
      ["지환", "선릉역점", 1385000, "blue", 14],
    ].map(([name, branch, score, league, level], i) => ({
      pos: i + 1,
      name: name as string,
      branch: branch as string,
      score_ms: score as number,
      finished: true,
      remaining: 0,
      league: league as string,
      level: level as number,
      staff: null,
      at: "2026-11-05T10:00:00Z",
    })),
    open_f: [
      { pos: 1, name: "서연", branch: "선릉역점", score_ms: 1372000, finished: true, remaining: 0, league: "blue", level: 18, staff: null, at: "2026-11-06T10:00:00Z" },
      { pos: 2, name: "하린", branch: "칠금점", score_ms: 1440000, finished: true, remaining: 0, league: "blue", level: 12, staff: null, at: "2026-11-06T10:00:00Z" },
    ],
    starter_m: [
      { pos: 1, name: "지호", branch: "선릉역점", score_ms: 1060000, finished: true, remaining: 0, league: "white", level: 6, staff: null, at: "2026-11-07T10:00:00Z" },
    ],
  },
  improved: [
    { name: "지환", division: "open", delta_ms: 102000, best_ms: 1385000 },
    { name: "서연", division: "open", delta_ms: 65000, best_ms: 1372000 },
    { name: "건우", division: "open", delta_ms: 51000, best_ms: 1351000 },
  ],
  records: [{ key: "first_test153_top_m", label: "최초 153 PB 1위 · 남자 회원", name: "민준", value: 1132000, at: "2026-11-05T10:00:00Z" }],
  recent: [
    { name: "서윤", division: "open", score_ms: 1361000, finished: true, remaining: 0, first: false, pb: true, at: "2026-11-08T10:30:00Z" },
    { name: "예린", division: "starter", score_ms: 1018000, finished: true, remaining: 0, first: true, pb: true, at: "2026-11-08T10:05:00Z" },
  ],
  totals: { records: 14, people: 12, month: 14 },
};
