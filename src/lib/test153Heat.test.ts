import { describe, expect, it } from "vitest";
import { TEST153_CAP_MS, buildSegments } from "./test153";
import {
  HEAT_AUTOSAVE_MS,
  HEAT_TAP_GUARD_MS,
  applyHeatGhosts,
  capHeat,
  dropLane,
  heatAllResolved,
  heatBranch,
  heatCapDue,
  heatFromRunV1,
  heatLiveItems,
  heatPayload,
  laneElapsed,
  lanePhase,
  laneRemaining,
  laneSplits,
  lanesDueForSave,
  markLaneSaved,
  newHeatId,
  parseHeat,
  resumeLane,
  setLaneLeft,
  startHeat,
  stopLane,
  tapLane,
  undoLane,
  type HeatState,
} from "./test153Heat";

const T0 = 1_000_000;
const m = (id: string, branch: string | null = "153복싱짐 선릉역점") => ({ id, name: `회원${id}`, branch, gender: "남" });
const heat2 = (): HeatState =>
  startHeat(
    [
      { member: m("a"), division: "open", gender: "남" },
      { member: m("b"), division: "starter", gender: "여" },
    ],
    "153본사",
    T0,
    "heat-1",
  );

/** 레인 하나를 n 구간 끝낸 상태로 (구간마다 60초) */
const run = (h: HeatState, lane: number, n: number, every = 60_000): HeatState => {
  let cur = h;
  for (let i = 1; i <= n; i++) cur = tapLane(cur, lane, T0 + i * every) ?? cur;
  return cur;
};

describe("153 PB 히트 — 시작 · 버튼", () => {
  it("1~4명이 같은 시각에 시작 · 레인 1부터 · 히트 지점 = 참가자 지점", () => {
    const h = heat2();
    expect(h.lanes.map((l) => l.lane)).toEqual([1, 2]);
    expect(h.startAt).toBe(T0);
    expect(h.branch).toBe("153복싱짐 선릉역점");
    expect(h.lanes.every((l) => lanePhase(l, T0) === "running")).toBe(true);
  });

  it("다음 구간 — 1.5초 안 두 번 누름은 무시 · 사람마다 따로", () => {
    let h = heat2();
    expect(tapLane(h, 1, T0 + HEAT_TAP_GUARD_MS - 1)).toBeNull(); // 시작 직후
    h = tapLane(h, 1, T0 + 30_000)!;
    expect(tapLane(h, 1, T0 + 30_500)).toBeNull(); // 두 번 누름
    h = tapLane(h, 2, T0 + 30_500)!; // 다른 사람은 바로
    expect(h.lanes[0].marks).toEqual([T0 + 30_000]);
    expect(h.lanes[1].marks).toEqual([T0 + 30_500]);
  });

  it("16번째 = 완주 → 4초 뒤 저장 대상 · 그 안에 되돌리면 다시 달림", () => {
    let h = run(heat2(), 1, 16);
    const done = T0 + 16 * 60_000;
    expect(lanePhase(h.lanes[0], T0)).toBe("finished");
    expect(h.lanes[0].doneAt).toBe(done);
    expect(lanesDueForSave(h, done + HEAT_AUTOSAVE_MS - 1)).toEqual([]);
    expect(lanesDueForSave(h, done + HEAT_AUTOSAVE_MS)).toEqual([1]);
    h = undoLane(h, 1)!;
    expect(lanePhase(h.lanes[0], T0)).toBe("running");
    expect(h.lanes[0].marks).toHaveLength(15);
    expect(h.lanes[0].doneAt).toBeUndefined();
  });

  it("저장하면 되돌리기 · 버튼 없음 · 모두 저장/뺌이면 끝", () => {
    let h = run(heat2(), 1, 16);
    h = markLaneSaved(h, 1, { id: "r1", score_ms: 960_000, is_pb: true, prev_pb_ms: null });
    expect(lanePhase(h.lanes[0], T0)).toBe("saved");
    expect(undoLane(h, 1)).toBeNull();
    expect(tapLane(h, 1, T0 + 2_000_000)).toBeNull();
    expect(heatAllResolved(h)).toBe(false);
    h = dropLane(h, 2);
    expect(heatAllResolved(h)).toBe(true);
    // 잘못 뺐으면 되살리기
    expect(lanePhase(dropLane(h, 2, false).lanes[1], T0)).toBe("running");
  });

  it("구간별 걸린 시간 · 경과 시간", () => {
    const h = run(heat2(), 1, 16);
    const splits = laneSplits(h.lanes[0], T0);
    expect(splits).toHaveLength(16);
    expect(splits.every((s) => s === 60_000)).toBe(true);
    expect(laneElapsed(h.lanes[0], T0, T0 + 99_999_999)).toBe(16 * 60_000);
    expect(laneElapsed(h.lanes[1], T0, T0 + 90_000)).toBe(90_000);
  });
});

describe("153 PB 히트 — 멈춤 · 25:00 캡", () => {
  it("멈춤 → 하던 구간 시간을 붙여 저장 · 이어서는 캡 전만", () => {
    let h = run(heat2(), 2, 3); // 스타터 3구간
    h = stopLane(h, 2, T0 + 200_000)!;
    expect(lanePhase(h.lanes[1], T0)).toBe("stopped");
    expect(laneSplits(h.lanes[1], T0)).toEqual([60_000, 60_000, 60_000, 20_000]);
    expect(resumeLane(h, 2, T0 + 210_000)!.lanes[1].stoppedAt).toBeUndefined();
    expect(resumeLane(h, 2, T0 + TEST153_CAP_MS)).toBeNull();
  });

  it("25:00 이 되면 달리는 사람만 캡 · 완주한 사람은 그대로", () => {
    let h = run(heat2(), 1, 16, 50_000); // 13분 20초 완주
    h = run(h, 2, 5);
    expect(heatCapDue(h, T0 + TEST153_CAP_MS - 1)).toBe(false);
    expect(heatCapDue(h, T0 + TEST153_CAP_MS)).toBe(true);
    h = capHeat(h);
    expect(lanePhase(h.lanes[0], T0)).toBe("finished");
    expect(lanePhase(h.lanes[1], T0)).toBe("capped");
    expect(h.lanes[1].stoppedAt).toBe(T0 + TEST153_CAP_MS);
    expect(heatCapDue(h, T0 + TEST153_CAP_MS + 1)).toBe(false);
    expect(tapLane(h, 2, T0 + TEST153_CAP_MS + 5000)).toBeNull();
  });

  it("남은 개수 = 하던 구간 남은 개수 + 뒤 구간 전부 (셀트런 = 10개)", () => {
    let h = run(heat2(), 2, 5); // 스타터 · 6번째 구간(R3 스쿼트 25)에서 멈춤
    h = stopLane(h, 2, T0 + 400_000)!;
    const segs = buildSegments("starter");
    const later = segs.slice(6).reduce((a, s) => a + s.reps, 0);
    h = setLaneLeft(h, 2, "7");
    expect(laneRemaining(h.lanes[1])).toBe(7 + later);
    // 그 구간 개수보다 크게 넣어도 그 구간 개수까지
    expect(laneRemaining(setLaneLeft(h, 2, "999").lanes[1])).toBe(segs[5].reps + later);
    expect(setLaneLeft(h, 2, "1a2").lanes[1].left).toBe("12");
  });
});

describe("153 PB 히트 — 이어받기 · 서버 · TV", () => {
  it("1단계(한 명) 측정이 남아 있으면 1명 히트로 이어받는다", () => {
    const v1 = { member: m("z", null), division: "open", gender: null, startAt: T0, marks: [T0 + 50_000], stoppedAt: undefined };
    const h = heatFromRunV1(v1, "153복싱짐 칠금점", "id-v1")!;
    expect(h.lanes).toHaveLength(1);
    expect(h.lanes[0].marks).toEqual([T0 + 50_000]);
    expect(h.branch).toBe("153복싱짐 칠금점");
    expect(heatFromRunV1({ hello: 1 }, "x")).toBeNull();
    expect(parseHeat(JSON.parse(JSON.stringify(h)))).toEqual(h);
    expect(parseHeat({ v: 1 })).toBeNull();
  });

  it("서버로 보낼 것 — 시작부터 누적 ms · 상태 · 저장한 기록 id", () => {
    let h = run(heat2(), 1, 2, 45_000);
    h = markLaneSaved(dropLane(h, 2), 2, { id: "never", score_ms: 1, is_pb: false, prev_pb_ms: null });
    const p = heatPayload(h);
    expect(p.start_ms).toBe(T0);
    expect(p.lanes[0]).toMatchObject({ lane: 1, user_id: "a", marks: [45_000, 90_000], state: "running", record_id: null });
    expect(p.lanes[1].state).toBe("dropped");
    expect(heatPayload(h, "done").status).toBe("done");
  });

  it("서버 답의 지난번의 나 — 한 번만 붙이고 바뀐 게 없으면 같은 객체", () => {
    const h = heat2();
    const cum = Array.from({ length: 16 }, (_, i) => (i + 1) * 60_000);
    const data = { lanes: [{ lane: 1, ghost: { ms: 960_000, finished: true, remaining: 0, cum }, first: false }, { lane: 2, ghost: null, first: true }] };
    const g = applyHeatGhosts(h, data);
    expect(g.lanes[0].ghost?.cum).toEqual(cum);
    expect(g.lanes[1]).toMatchObject({ ghost: null, first: true });
    expect(applyHeatGhosts(g, data)).toBe(g);
    expect(applyHeatGhosts(h, null)).toBe(h);
  });

  it("TV 신호 — 레인마다 · 이름 · user_id 없음 · 뺀 사람은 안 보냄", () => {
    let h = run(heat2(), 1, 1);
    h = dropLane(h, 2);
    const items = heatLiveItems(h);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "heat-1:1", heat: "heat-1", lane: 1, startAt: T0, marks: [T0 + 60_000] });
    expect(JSON.stringify(items)).not.toMatch(/회원|"a"/);
    expect(heatLiveItems(null)).toEqual([]);
  });

  it("히트 지점 — 가장 많은 지점 · 없으면 코치 지점 / uuid 모양", () => {
    expect(heatBranch([m("1", "A"), m("2", "B"), m("3", "B")], "C")).toBe("B");
    expect(heatBranch([m("1", null)], "C")).toBe("C");
    expect(newHeatId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
