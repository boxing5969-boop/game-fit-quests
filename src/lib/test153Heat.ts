/**
 * ⏱ 153 PB 히트(최대 4명) — 코치 측정 화면의 상태 계산 (2026-11-08 대표님 「2단계넘어가자」 · 보고서 「153 PB 라이브보드 설계」 2단계)
 *   한 번에 1~4명을 같이 시작하고(공동 시작 시각), 사람마다 구간이 끝날 때 '다음 구간'을 누른다.
 *   완주(16번째)하면 4초 뒤 공식 기록(save_test153_record · 구간 16개)으로 저절로 저장 — 그 4초 안에는 되돌릴 수 있다.
 *   타임캡 25:00 이 되면 달리는 사람은 모두 멈추고, 하던 구간에서 남은 개수를 넣어 저장한다(1단계와 같은 셈).
 *   화면: src/components/test153/Test153MeasurePanel.tsx · 서버 동기화: test153_heat_save (supabase/migrations/20261108192625_test153_heats.sql)
 *   여기는 계산만 — 시계(now)는 늘 밖에서 받는다(시험하기 쉽게).
 */
import { buildSegments, TEST153_CAP_MS, type Test153Division, type Test153Segment } from "@/lib/test153";

export const HEAT_MAX = 4;
export const HEAT_SEGMENTS = 16;
/** 같은 사람 버튼을 이 안에 다시 누르면 두 번 누름으로 보고 무시 (셀트런 100m 도 20초는 걸린다) */
export const HEAT_TAP_GUARD_MS = 1500;
/** 완주 뒤 저장까지 — 잘못 눌렀으면 이 안에 되돌린다 */
export const HEAT_AUTOSAVE_MS = 4000;

export interface HeatMember {
  id: string;
  name: string;
  branch: string | null;
  gender: string | null;
}

export interface HeatSaved {
  id: string;
  score_ms: number;
  is_pb: boolean;
  prev_pb_ms: number | null;
}

export interface HeatGhost {
  ms: number;
  finished: boolean;
  remaining: number;
  /** 구간을 끝낸 누적 시각 16개 — 총 시간만 넣은 기록이면 null */
  cum: number[] | null;
}

export interface HeatLane {
  /** 1~4 — TV 번호 · 색 */
  lane: number;
  member: HeatMember;
  division: Test153Division;
  gender: "남" | "여" | null;
  /** 구간을 끝낸 시각 (epoch ms · 이 기기 시계) — 길이 = 끝낸 구간 수 */
  marks: number[];
  /** 멈춘 시각 (25:00 캡 또는 '멈춤') */
  stoppedAt?: number;
  /** 16번째를 누른 시각 — 저장 대기 */
  doneAt?: number;
  /** 캡 · 멈춤: 하던 구간에서 남은 개수 (입력 칸 글) */
  left?: string;
  note?: string;
  saved?: HeatSaved;
  /** 기록 없이 뺌 */
  dropped?: boolean;
  /** 서버가 준 지난번의 나 — undefined = 아직 모름 · null = 없음 */
  ghost?: HeatGhost | null;
  /** 이 부문 첫 도전 */
  first?: boolean;
}

export interface HeatState {
  v: 2;
  /** uuid — 이 기기에서 만들고 서버(test153_heats.id) · TV 신호에 같이 쓴다 */
  id: string;
  /** 측정하는 지점 이름 (TV 채널 · 서버) */
  branch: string;
  startAt: number;
  lanes: HeatLane[];
}

export type LanePhase = "running" | "finished" | "stopped" | "capped" | "saved" | "dropped";

export const lanePhase = (l: HeatLane, startAt: number): LanePhase => {
  if (l.dropped) return "dropped";
  if (l.saved) return "saved";
  if (l.marks.length >= HEAT_SEGMENTS) return "finished";
  if (l.stoppedAt != null) return l.stoppedAt - startAt >= TEST153_CAP_MS ? "capped" : "stopped";
  return "running";
};

/** 지금까지 걸린 시간 — 완주면 완주 시각 · 멈췄으면 멈춘 시각 · 25:00 에서 멈춤 */
export const laneElapsed = (l: HeatLane, startAt: number, now: number): number => {
  if (l.marks.length >= HEAT_SEGMENTS) return l.marks[HEAT_SEGMENTS - 1] - startAt;
  if (l.stoppedAt != null) return Math.min(l.stoppedAt - startAt, TEST153_CAP_MS);
  return Math.max(0, Math.min(now - startAt, TEST153_CAP_MS));
};

/** 구간별 걸린 시간 (저장용) — 멈췄으면 하던 구간의 멈출 때까지 시간을 마지막에 붙인다 */
export const laneSplits = (l: HeatLane, startAt: number): number[] => {
  const pts = [startAt, ...l.marks];
  const out = pts.slice(1).map((t, i) => t - pts[i]);
  if (l.stoppedAt != null && l.marks.length < HEAT_SEGMENTS) out.push(l.stoppedAt - pts[pts.length - 1]);
  return out;
};

/** 캡 · 멈춤의 남은 동작 수 = 하던 구간에서 남은 개수 + 그 뒤 구간 개수 전부 (셀트런 1구간 = 10개) */
export const laneRemaining = (l: HeatLane, segments: Test153Segment[] = buildSegments(l.division)): number => {
  const cur = Math.min(l.marks.length, segments.length - 1);
  const later = segments.slice(cur + 1).reduce((a, s) => a + s.reps, 0);
  const left = Math.max(0, Math.min(segments[cur]?.reps ?? 0, parseInt(l.left || "0", 10) || 0));
  return left + later;
};

/** 그 구간 뒤 개수 (화면 안내 '+ 뒤 구간 N개') */
export const laneLaterReps = (l: HeatLane, segments: Test153Segment[] = buildSegments(l.division)): number =>
  segments.slice(Math.min(l.marks.length, segments.length - 1) + 1).reduce((a, s) => a + s.reps, 0);

const withLane = (h: HeatState, lane: number, patch: Partial<HeatLane>): HeatState => ({
  ...h,
  lanes: h.lanes.map((l) => (l.lane === lane ? { ...l, ...patch } : l)),
});

/** '다음 구간' — 달리는 사람만 · 두 번 누름 막기. 바뀌지 않으면 null */
export const tapLane = (h: HeatState, lane: number, now: number): HeatState | null => {
  const l = h.lanes.find((x) => x.lane === lane);
  if (!l || lanePhase(l, h.startAt) !== "running") return null;
  if (now - h.startAt >= TEST153_CAP_MS) return null;
  const last = l.marks.length ? l.marks[l.marks.length - 1] : h.startAt;
  if (now - last < HEAT_TAP_GUARD_MS) return null;
  const marks = [...l.marks, now];
  return withLane(h, lane, { marks, doneAt: marks.length >= HEAT_SEGMENTS ? now : undefined });
};

/** 되돌리기 — 달리는 중이면 마지막 구간 하나 · 완주 저장 대기면 완주 취소. 저장한 뒤 · 캡 뒤에는 못 함 */
export const undoLane = (h: HeatState, lane: number): HeatState | null => {
  const l = h.lanes.find((x) => x.lane === lane);
  if (!l) return null;
  const ph = lanePhase(l, h.startAt);
  if ((ph !== "running" && ph !== "finished") || l.marks.length === 0) return null;
  return withLane(h, lane, { marks: l.marks.slice(0, -1), doneAt: undefined, stoppedAt: undefined });
};

/** 멈춤 — 남은 개수를 넣어 캡 기록으로 저장하거나, 이어서 하거나, 기록 없이 뺀다 */
export const stopLane = (h: HeatState, lane: number, now: number): HeatState | null => {
  const l = h.lanes.find((x) => x.lane === lane);
  if (!l || lanePhase(l, h.startAt) !== "running") return null;
  return withLane(h, lane, { stoppedAt: Math.min(now, h.startAt + TEST153_CAP_MS) });
};

/** 잘못 눌러 멈춘 사람만 이어서 (25:00 캡은 못 이어감) */
export const resumeLane = (h: HeatState, lane: number, now: number): HeatState | null => {
  const l = h.lanes.find((x) => x.lane === lane);
  if (!l || lanePhase(l, h.startAt) !== "stopped" || now - h.startAt >= TEST153_CAP_MS) return null;
  return withLane(h, lane, { stoppedAt: undefined });
};

export const dropLane = (h: HeatState, lane: number, dropped = true): HeatState => withLane(h, lane, { dropped, doneAt: undefined });

export const setLaneLeft = (h: HeatState, lane: number, left: string): HeatState =>
  withLane(h, lane, { left: left.replace(/\D/g, "").slice(0, 3) });

export const setLaneNote = (h: HeatState, lane: number, note: string): HeatState => withLane(h, lane, { note: note.slice(0, 200) });

export const markLaneSaved = (h: HeatState, lane: number, saved: HeatSaved): HeatState =>
  withLane(h, lane, { saved, doneAt: undefined });

/** 25:00 이 지났는데 달리는 사람이 있나 */
export const heatCapDue = (h: HeatState, now: number): boolean =>
  now - h.startAt >= TEST153_CAP_MS && h.lanes.some((l) => lanePhase(l, h.startAt) === "running");

/** 25:00 — 달리는 사람은 모두 캡에서 멈춘다 */
export const capHeat = (h: HeatState): HeatState => ({
  ...h,
  lanes: h.lanes.map((l) => (lanePhase(l, h.startAt) === "running" ? { ...l, stoppedAt: h.startAt + TEST153_CAP_MS } : l)),
});

/** 저장할 때가 된 완주 (16번째 뒤 4초) */
export const lanesDueForSave = (h: HeatState, now: number): number[] =>
  h.lanes
    .filter((l) => lanePhase(l, h.startAt) === "finished" && l.doneAt != null && now - l.doneAt >= HEAT_AUTOSAVE_MS)
    .map((l) => l.lane);

export const heatAnyRunning = (h: HeatState | null): boolean => !!h && h.lanes.some((l) => lanePhase(l, h.startAt) === "running");

/** 모두 저장했거나 뺐다 → '다음 측정' */
export const heatAllResolved = (h: HeatState): boolean =>
  h.lanes.every((l) => {
    const ph = lanePhase(l, h.startAt);
    return ph === "saved" || ph === "dropped";
  });

/** 저장 대기 중인 완주가 있나 (화면 시계를 계속 돌려야 하는지) */
export const heatAnyPendingSave = (h: HeatState | null): boolean =>
  !!h && h.lanes.some((l) => lanePhase(l, h.startAt) === "finished" && l.doneAt != null);

/** 레인 번호 1~4 중 비어 있는 가장 작은 수 */
export const nextLaneNo = (taken: number[]): number => {
  let n = 1;
  while (taken.includes(n)) n++;
  return n;
};

/** 히트 지점 — 참가자 지점 중 가장 많은 곳(같으면 먼저 고른 사람) · 없으면 코치 지점 */
export const heatBranch = (members: Pick<HeatMember, "branch">[], fallback: string): string => {
  const count = new Map<string, number>();
  for (const m of members) if (m.branch) count.set(m.branch, (count.get(m.branch) ?? 0) + 1);
  let best = "";
  let n = 0;
  for (const m of members) {
    const c = m.branch ? count.get(m.branch) ?? 0 : 0;
    if (m.branch && c > n) {
      best = m.branch;
      n = c;
    }
  }
  return best || fallback;
};

/** uuid — crypto.randomUUID 가 없는 옛 태블릿 브라우저도 */
export const newHeatId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export interface HeatSetupLane {
  member: HeatMember;
  division: Test153Division;
  gender: "남" | "여" | null;
}

export const startHeat = (setup: HeatSetupLane[], coachBranch: string, now: number, id: string = newHeatId()): HeatState => ({
  v: 2,
  id,
  branch: heatBranch(setup.map((s) => s.member), coachBranch),
  startAt: now,
  lanes: setup.slice(0, HEAT_MAX).map((s, i) => ({
    lane: i + 1,
    member: s.member,
    division: s.division,
    gender: s.gender,
    marks: [],
  })),
});

/* ─────────── 이 기기에 적어 두기 (화면이 꺼지거나 다른 화면에 다녀와도 이어서) ─────────── */

export const HEAT_STORE_KEY = "test153-heat-v2";
/** 1단계(한 명씩) 측정 — 새 화면이 들어오는 날 하던 측정이 있으면 1명 히트로 이어받는다 */
export const RUN_V1_STORE_KEY = "test153-run-v1";

interface RunStateV1 {
  member: HeatMember;
  division: Test153Division;
  gender: "남" | "여" | null;
  startAt: number;
  marks: number[];
  stoppedAt?: number;
}

const isLane = (l: unknown): l is HeatLane => {
  const x = l as HeatLane;
  return !!x && typeof x.lane === "number" && !!x.member && typeof x.member.id === "string" &&
    (x.division === "open" || x.division === "starter") && Array.isArray(x.marks);
};

export const parseHeat = (raw: unknown): HeatState | null => {
  const h = raw as HeatState | null;
  if (!h || h.v !== 2 || typeof h.id !== "string" || typeof h.startAt !== "number" || !Array.isArray(h.lanes)) return null;
  if (!h.lanes.length || !h.lanes.every(isLane)) return null;
  return { v: 2, id: h.id, branch: typeof h.branch === "string" ? h.branch : "", startAt: h.startAt, lanes: h.lanes };
};

export const heatFromRunV1 = (raw: unknown, coachBranch: string, id: string = newHeatId()): HeatState | null => {
  const r = raw as RunStateV1 | null;
  if (!r || !r.member || typeof r.member.id !== "string" || typeof r.startAt !== "number" || !Array.isArray(r.marks)) return null;
  if (r.division !== "open" && r.division !== "starter") return null;
  return {
    v: 2,
    id,
    branch: r.member.branch || coachBranch,
    startAt: r.startAt,
    lanes: [{ lane: 1, member: r.member, division: r.division, gender: r.gender ?? null, marks: r.marks, stoppedAt: r.stoppedAt }],
  };
};

/* ─────────── 서버 · TV 로 보낼 모양 ─────────── */

/** test153_heat_save 에 보낼 것 — 시각은 시작부터 누적 ms (기기 시계와 상관없게) */
export const heatPayload = (h: HeatState, status: "running" | "done" | "void" = "running") => ({
  id: h.id,
  branch: h.branch,
  start_ms: Math.round(h.startAt),
  status,
  lanes: h.lanes.map((l) => ({
    lane: l.lane,
    user_id: l.member.id,
    division: l.division,
    gender: l.gender,
    marks: l.marks.map((t) => Math.max(0, Math.round(t - h.startAt))),
    stopped_ms: l.stoppedAt != null ? Math.max(0, Math.round(l.stoppedAt - h.startAt)) : null,
    state: lanePhase(l, h.startAt),
    record_id: l.saved?.id ?? null,
  })),
});

/** 서버 답의 지난번의 나 · 첫 도전을 레인에 붙인다 — 바뀐 게 없으면 같은 객체 */
export const applyHeatGhosts = (h: HeatState, data: unknown): HeatState => {
  const lanes = (data as { lanes?: unknown } | null)?.lanes;
  if (!Array.isArray(lanes)) return h;
  let changed = false;
  const next = h.lanes.map((l) => {
    const g = (lanes as Record<string, unknown>[]).find((x) => x?.lane === l.lane);
    if (!g || l.ghost !== undefined) return l;
    const raw = g.ghost as Record<string, unknown> | null;
    const ghost: HeatGhost | null =
      raw && typeof raw.ms === "number"
        ? {
            ms: raw.ms,
            finished: raw.finished === true,
            remaining: typeof raw.remaining === "number" ? raw.remaining : 0,
            cum: Array.isArray(raw.cum) && raw.cum.length === HEAT_SEGMENTS ? (raw.cum as number[]) : null,
          }
        : null;
    changed = true;
    return { ...l, ghost, first: g.first === true };
  });
  return changed ? { ...h, lanes: next } : h;
};

/** TV 로 보내는 신호 (이름 · user_id 없음) */
export const heatLiveItems = (h: HeatState | null) =>
  !h
    ? []
    : h.lanes
        .filter((l) => !l.dropped)
        .map((l) => ({
          id: `${h.id}:${l.lane}`,
          heat: h.id,
          lane: l.lane,
          division: l.division,
          startAt: h.startAt,
          marks: l.marks,
          stoppedAt: l.stoppedAt ?? null,
          pb: l.saved ? { isPb: l.saved.is_pb, prevMs: l.saved.prev_pb_ms, scoreMs: l.saved.score_ms } : null,
        }));
