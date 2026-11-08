import { describe, expect, it } from "vitest";
import {
  PB_DEMO_BOARD,
  PB_GRID,
  PB_MAX_RUNS,
  PB_RUN_TOTAL_M,
  PB_SEGMENT_COUNT,
  PB_TITLE_MS,
  applyPbLive,
  isPbLiveMsg,
  pbClock,
  pbDelta,
  pbEtaMs,
  pbPrimaryRun,
  pbRankPages,
  pbRunElapsed,
  pbRunPhase,
  pbRunSeg,
  pbScore,
  pbScreenFor,
  pbSearchWith,
  pbSegLabel,
  pbShouldAutoSwitch,
  pbStationOfSeg,
  pbTotalReps,
  prunePbLive,
  removePbLive,
  type PbLiveMsg,
} from "./pbBoard";
import { TEST153_CAP_MS } from "./test153";

const msg = (over: Partial<PbLiveMsg> = {}): PbLiveMsg => ({
  v: 1,
  id: "1000",
  division: "open",
  startAt: 1000,
  marks: [],
  stoppedAt: null,
  sentAt: 2000,
  ...over,
});

describe("153 PB 라이브보드 숫자", () => {
  it("총 개수 = 오픈 410 · 스타터 205, 셀트런 800m, 16구간, 레드 타이틀 22분", () => {
    expect(pbTotalReps("open")).toBe(410);
    expect(pbTotalReps("starter")).toBe(205);
    expect(PB_RUN_TOTAL_M).toBe(800);
    expect(PB_SEGMENT_COUNT).toBe(16);
    expect(PB_TITLE_MS).toBe(22 * 60_000);
  });

  it("TV1 8분할 칸 자리가 1920×1080 안에 딱 맞는다 (영상 pb-grid.mp4 와 같은 숫자)", () => {
    expect(PB_GRID.cellW * 4 + PB_GRID.gap * 3).toBe(PB_GRID.w);
    expect(PB_GRID.cellH * 2 + PB_GRID.gap).toBe(PB_GRID.h);
    expect(PB_GRID.x * 2 + PB_GRID.w).toBe(1920);
    expect(PB_GRID.y + PB_GRID.h + 24).toBe(1080);
  });

  it("구간 이름 · 종목 칸", () => {
    expect(pbSegLabel(0, "open")).toBe("R1 셀트런");
    expect(pbSegLabel(7, "open")).toBe("R4 푸시업");
    expect(pbSegLabel(6, "starter")).toBe("R4 셀트런");
    expect(pbSegLabel(16, "open")).toBe("완주");
    expect(pbStationOfSeg(6)).toBe(3);
    expect(pbStationOfSeg(7)).toBe(3);
    expect(pbStationOfSeg(15)).toBe(7);
  });

  it("표시 — 큰 타이머 · 줄인 시간 · 캡 점수", () => {
    expect(pbClock(522_000)).toBe("08:42");
    expect(pbClock(1_294_000)).toBe("21:34");
    expect(pbDelta(24_000)).toBe("−0:24");
    expect(pbDelta(102_000)).toBe("−1:42");
    expect(pbScore({ finished: true, score_ms: 1_278_000 })).toBe("21:18");
    expect(pbScore({ finished: false, score_ms: 1_512_000, remaining: 12 })).toBe("캡 + 12개");
  });
});

describe("실시간 신호", () => {
  it("이름 없는 신호만 받는다", () => {
    expect(isPbLiveMsg(msg())).toBe(true);
    expect(isPbLiveMsg({ ...msg(), division: "pro" })).toBe(false);
    expect(isPbLiveMsg(null)).toBe(false);
  });

  it("번호는 비어 있는 가장 작은 수 · 같은 측정은 번호 그대로 · 시계 차이는 가장 작은 값", () => {
    let runs = applyPbLive([], msg({ id: "a", sentAt: 2000 }), 2500); // offset 500
    runs = applyPbLive(runs, msg({ id: "b", sentAt: 2000 }), 2100);
    expect(runs.map((r) => r.slot)).toEqual([1, 2]);
    runs = applyPbLive(runs, msg({ id: "a", sentAt: 7000, marks: [5000] }), 7200); // offset 200
    const a = runs.find((r) => r.id === "a")!;
    expect(a.slot).toBe(1);
    expect(a.offset).toBe(200);
    expect(a.marks).toEqual([5000]);
    runs = removePbLive(runs, "a");
    runs = applyPbLive(runs, msg({ id: "c" }), 3000);
    expect(runs.find((r) => r.id === "c")!.slot).toBe(1);
  });

  it(`한꺼번에 ${PB_MAX_RUNS}명까지 — 넘으면 가장 오래 소식 없는 측정을 내린다`, () => {
    let runs = applyPbLive([], msg({ id: "1" }), 1000);
    runs = applyPbLive(runs, msg({ id: "2" }), 2000);
    runs = applyPbLive(runs, msg({ id: "3" }), 3000);
    runs = applyPbLive(runs, msg({ id: "4" }), 4000);
    runs = applyPbLive(runs, msg({ id: "5" }), 5000);
    expect(runs).toHaveLength(PB_MAX_RUNS);
    expect(runs.map((r) => r.id)).not.toContain("1");
    expect(runs.find((r) => r.id === "5")!.slot).toBe(1);
  });

  it("상태 · 경과 시간 (TV 시계 · 캡에서 멈춤)", () => {
    const base = applyPbLive([], msg({ startAt: 0, sentAt: 0 }), 300)[0]; // TV 가 300ms 빠름
    expect(pbRunPhase(base)).toBe("running");
    expect(pbRunElapsed(base, 60_300)).toBe(60_000);
    expect(pbRunElapsed(base, 99_999_999)).toBe(TEST153_CAP_MS);
    const marks = Array.from({ length: 16 }, (_, i) => (i + 1) * 80_000);
    expect(pbRunPhase({ ...base, marks })).toBe("finished");
    expect(pbRunElapsed({ ...base, marks }, 9e9)).toBe(1_280_000);
    expect(pbRunPhase({ ...base, stoppedAt: TEST153_CAP_MS })).toBe("capped");
    expect(pbRunPhase({ ...base, stoppedAt: 30_000 })).toBe("stopped");
    expect(pbRunSeg({ marks: [1, 2, 3] })).toBe(3);
  });

  it("예상 완주는 4구간 뒤부터", () => {
    const r = applyPbLive([], msg({ startAt: 0, sentAt: 0, marks: [60_000, 120_000, 180_000] }), 0)[0];
    expect(pbEtaMs(r, 200_000)).toBeNull();
    const r4 = { ...r, marks: [60_000, 120_000, 180_000, 240_000] };
    expect(pbEtaMs(r4, 240_000)).toBe(960_000);
  });

  it("큰 타이머는 달리는 측정 중 가장 먼저 시작한 것", () => {
    let runs = applyPbLive([], msg({ id: "late", startAt: 5000 }), 6000);
    runs = applyPbLive(runs, msg({ id: "early", startAt: 1000 }), 6000);
    expect(pbPrimaryRun(runs)!.id).toBe("early");
    expect(pbPrimaryRun([])).toBeNull();
  });

  it("소식 없는 측정은 1분 뒤 · 끝난 측정은 끝난 지 3분 뒤 내린다 (신호가 계속 와도)", () => {
    const runs = applyPbLive([], msg(), 1000);
    expect(prunePbLive(runs, 30_000)).toHaveLength(1);
    expect(prunePbLive(runs, 62_000)).toHaveLength(0);
    const marks = Array.from({ length: 16 }, (_, i) => 1000 + (i + 1) * 1000); // 17000 에 완주
    const done = applyPbLive([], msg({ marks, sentAt: 100_000 }), 100_000); // offset 0 · 완주 83초 뒤
    expect(prunePbLive(done, 100_000)).toHaveLength(1);
    const later = 17_000 + 3 * 60_000 + 1;
    const still = applyPbLive(done, msg({ marks, sentAt: later - 1000 }), later - 1000); // 신호는 계속 온다
    expect(prunePbLive(still, later)).toHaveLength(0);
  });
});

describe("자동 전환", () => {
  it("달리는 측정이면 넘어가고, 끝난 측정 · 엉뚱한 신호면 그대로", () => {
    expect(pbShouldAutoSwitch(msg())).toBe(true);
    expect(pbShouldAutoSwitch(msg({ marks: Array.from({ length: 16 }, (_, i) => i) }))).toBe(false);
    expect(pbShouldAutoSwitch({ hello: 1 })).toBe(false);
  });

  it("1 → pb1 · 2 → pb2 · 그 밖은 없음", () => {
    expect(pbScreenFor("1")).toBe("pb1");
    expect(pbScreenFor("2")).toBe("pb2");
    expect(pbScreenFor("3")).toBeNull();
    expect(pbScreenFor(undefined)).toBeNull();
  });

  it("열쇠 · embed 는 그대로 두고 auto 만 넣고 뺀다", () => {
    expect(pbSearchWith("?k=abc&embed=1", true)).toBe("?k=abc&embed=1&auto=1");
    expect(pbSearchWith("?k=abc&auto=1", false)).toBe("?k=abc");
    expect(pbSearchWith("?auto=1", false)).toBe("");
  });
});

describe("기록 보드", () => {
  it("순위 장은 기록이 있는 부문만 · 없으면 오픈 남자 한 장", () => {
    expect(pbRankPages(null).map((p) => p.key)).toEqual(["open_m"]);
    expect(pbRankPages(PB_DEMO_BOARD).map((p) => p.key)).toEqual(["open_m", "open_f", "starter_m"]);
  });
});
