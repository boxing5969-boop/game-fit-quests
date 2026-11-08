import { describe, expect, it } from "vitest";
import {
  PB_DEMO_BOARD,
  PB_GRID,
  PB_MAX_RUNS,
  PB_RUN_TOTAL_M,
  PB_SEGMENT_COUNT,
  PB_TITLE_MS,
  PB_DEMO_PEOPLE,
  applyPbLive,
  isPbLiveMsg,
  normalizePbLive,
  pbDemoRuns,
  pbGhostDelta,
  pbGhostSeg,
  pbGhostText,
  pbRaceOrder,
  pbRunKey,
  pbRunMark,
  pbRunName,
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

describe("2단계 히트 — 레인 · 닉네임 · 지난번의 나", () => {
  const cum = Array.from({ length: 16 }, (_, i) => (i + 1) * 60_000); // 지난번: 구간마다 1분 → 16:00
  const ghost = { ms: 960_000, finished: true, remaining: 0, cum };

  it("히트 신호는 레인 번호를 TV 번호로 (비어 있으면)", () => {
    let runs = applyPbLive([], msg({ id: "h:3", heat: "h", lane: 3 }), 1000);
    runs = applyPbLive(runs, msg({ id: "h:1", heat: "h", lane: 1 }), 1000);
    expect(runs.map((r) => r.slot)).toEqual([3, 1]);
    // 다른 측정이 이미 3번이면 빈 번호
    const other = applyPbLive([], msg({ id: "x" }), 1000); // slot 1
    expect(applyPbLive(other, msg({ id: "h:1", heat: "h", lane: 1 }), 1000)[1].slot).toBe(2);
  });

  it("board_test153_live 답 → 신호 id 별 참가자 (닉네임 없으면 '153 복서' · 구간 16개가 아니면 cum 없음)", () => {
    const people = normalizePbLive({
      heats: [
        {
          id: "h",
          lanes: [
            { lane: 1, name: "민준", league: "red", level: 22, staff: null, division: "open", ghost, first: false },
            { lane: 2, name: "  ", division: "starter", ghost: { ms: 1290000, finished: true, remaining: 0, cum: [1290000] }, first: false },
            { lane: 3, name: "지호", division: "open", ghost: null, first: true },
          ],
        },
      ],
    });
    expect(people[pbRunKey("h", 1)]).toMatchObject({ name: "민준", league: "red", first: false });
    expect(people[pbRunKey("h", 1)].ghost?.cum).toHaveLength(16);
    expect(people[pbRunKey("h", 2)].name).toBe("153 복서");
    expect(people[pbRunKey("h", 2)].ghost).toMatchObject({ ms: 1290000, cum: null });
    expect(people[pbRunKey("h", 3)]).toMatchObject({ ghost: null, first: true });
    expect(normalizePbLive(null)).toEqual({});
  });

  it("이름 · 레일 글자 — 모르면 '측정 N번' · 번호", () => {
    const r = { id: "demo:1", slot: 1 };
    expect(pbRunName(r, PB_DEMO_PEOPLE)).toBe("민준");
    expect(pbRunMark(r, PB_DEMO_PEOPLE)).toBe("민");
    expect(pbRunName({ id: "z", slot: 4 }, {})).toBe("측정 4번");
    expect(pbRunMark({ id: "z", slot: 4 }, {})).toBe("4");
  });

  it("같은 구간을 끝낸 시각 비교 — 음수 = 빨라요 · 구간 기록 없으면 null", () => {
    const r = { startAt: 0, marks: [55_000, 115_000, 170_000] }; // 3구간 2:50 (지난번 3:00)
    expect(pbGhostDelta(r, ghost)).toBe(-10_000);
    expect(pbGhostDelta({ startAt: 0, marks: [70_000] }, ghost)).toBe(10_000);
    expect(pbGhostDelta({ startAt: 0, marks: [] }, ghost)).toBeNull();
    expect(pbGhostDelta(r, { ...ghost, cum: null })).toBeNull();
    expect(pbGhostDelta(r, null)).toBeNull();
  });

  it("지금 경과 시간에 지난번의 나 위치 · 끝났으면 16", () => {
    expect(pbGhostSeg(0, ghost)).toBe(0);
    expect(pbGhostSeg(150_000, ghost)).toBe(2);
    expect(pbGhostSeg(999_999, ghost)).toBe(16);
    expect(pbGhostSeg(150_000, null)).toBeNull();
  });

  it("TV 글 — 앞서면 '빨라요', 뒤지면 따라잡을 거리 (늦다는 말 없음)", () => {
    expect(pbGhostText(-24_000)).toEqual({ text: "지난번보다 0:24 빨라요", ahead: true });
    expect(pbGhostText(65_000)).toEqual({ text: "지난번의 나까지 1:05", ahead: false });
    expect(pbGhostText(300).ahead).toBe(true);
    expect(pbGhostText(65_000).text).not.toMatch(/늦/);
  });

  it("레이스 순서 — 끝낸 구간 많은 사람 → 같으면 먼저 끝낸 사람", () => {
    const base = applyPbLive([], msg({ id: "h:1", heat: "h", lane: 1, startAt: 0, marks: [50_000, 100_000] }), 0);
    const b = applyPbLive(base, msg({ id: "h:2", heat: "h", lane: 2, startAt: 0, marks: [40_000, 90_000] }), 0);
    const c = applyPbLive(b, msg({ id: "h:3", heat: "h", lane: 3, startAt: 0, marks: [30_000, 60_000, 95_000] }), 0);
    expect(pbRaceOrder(c).map((r) => r.lane)).toEqual([3, 2, 1]);
    // 스타터는 더 많이 갔어도 오픈 뒤 (개수가 절반)
    const d = applyPbLive(c, msg({ id: "h:4", heat: "h", lane: 4, division: "starter", startAt: 0, marks: [20_000, 40_000, 60_000, 80_000] }), 0);
    expect(pbRaceOrder(d).map((r) => r.lane)).toEqual([3, 2, 1, 4]);
  });

  it("예시 화면 — 3명 히트 · 1번은 지난번보다 빠름 · 2번은 따라가는 중 · 3번 첫 도전", () => {
    const now = 1_000_000_000;
    const runs = pbDemoRuns(now, now);
    expect(runs.map((r) => r.id)).toEqual(["demo:1", "demo:2", "demo:3"]);
    const d1 = pbGhostDelta(runs[0], PB_DEMO_PEOPLE["demo:1"].ghost)!;
    const d2 = pbGhostDelta(runs[1], PB_DEMO_PEOPLE["demo:2"].ghost)!;
    expect(d1).toBeLessThan(0);
    expect(d2).toBeGreaterThan(0);
    expect(PB_DEMO_PEOPLE["demo:3"].first).toBe(true);
    expect(PB_DEMO_PEOPLE["demo:1"].ghost?.ms).toBe(PB_DEMO_PEOPLE["demo:1"].ghost?.cum?.[15]);
  });
});

describe("기록 보드", () => {
  it("순위 장은 기록이 있는 부문만 · 없으면 오픈 남자 한 장", () => {
    expect(pbRankPages(null).map((p) => p.key)).toEqual(["open_m"]);
    expect(pbRankPages(PB_DEMO_BOARD).map((p) => p.key)).toEqual(["open_m", "open_f", "starter_m"]);
  });
});
