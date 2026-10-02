/**
 * 복싱 트레이닝 엔진 회귀 테스트 (2026-10-02 boxer 검수에서 잡은 버그들).
 * 세 엔진을 실제 훅으로 돌린다 — 가짜 타이머로 카운트다운·낙하·만료를 빨리 감는다.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/minigame/lib/audio", () => ({
  audio: new Proxy({}, { get: () => () => {} }),
  vibrate: () => {},
}));

import { useDefenseEngine } from "@/features/minigame/hooks/useDefenseEngine";
import { useMittEngine } from "@/features/minigame/hooks/useMittEngine";
import { useGameEngine } from "@/features/minigame/hooks/useGameEngine";

const FAKED = ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame"] as const;
const step = (ms = 16) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: [...FAKED] });
  localStorage.clear();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─────────────────────────── 디펜스 러시 ───────────────────────────
type Defense = ReturnType<typeof useDefenseEngine>;

/** 공격이 오면 정확한 쪽을 도착 시각에 막는다 — 실드가 생길 때까지 */
function defendUntilShield(result: { current: Defense }, maxMs = 120_000) {
  let elapsed = 0;
  while (elapsed < maxMs) {
    if (result.current.phase === "gameover") throw new Error(`died at ${elapsed}`);
    if (result.current.shields > 0) return;
    if (result.current.phase === "counter") { step(16); elapsed += 16; continue; }
    const a = result.current.attacks.find(x => !x.resolved);
    if (a) {
      const wait = a.arriveAt - performance.now();
      if (wait > 0) { step(Math.max(1, Math.floor(wait))); elapsed += wait; }
      act(() => { result.current.handleGuard(a.side); });
    }
    step(16); elapsed += 16;
  }
  throw new Error("no shield within time");
}

describe("useDefenseEngine — HEADGEAR(실드)", () => {
  it("실드를 들고 반대쪽을 막으면 실드가 대신 맞고 게임은 계속된다", () => {
    const { result } = renderHook(() => useDefenseEngine());
    act(() => { result.current.startGame(); });
    defendUntilShield(result);
    expect(result.current.shields).toBe(1);

    let a: Defense["attacks"][number] | undefined;
    for (let i = 0; i < 400 && !a; i++) {
      step(16);
      a = result.current.phase === "counter" ? undefined : result.current.attacks.find(x => !x.resolved);
    }
    expect(a).toBeTruthy();
    act(() => { result.current.handleGuard(a!.side === "L" ? "R" : "L"); });
    step(16);

    expect(result.current.phase).toBe("playing");
    expect(result.current.shields).toBe(0);
    expect(result.current.stats.shieldsSaved).toBe(1);
  });

  it("실드를 들고 공격을 놓쳐도(시간 초과) 한 번은 살아남는다", () => {
    const { result } = renderHook(() => useDefenseEngine());
    act(() => { result.current.startGame(); });
    defendUntilShield(result);
    for (let i = 0; i < 600 && result.current.phase !== "gameover" && result.current.shields === 1; i++) step(16);
    expect(result.current.phase).toBe("playing");
    expect(result.current.stats.shieldsSaved).toBe(1);
  });
});

describe("useDefenseEngine — 백그라운드 시간은 생존 기록이 아니다", () => {
  it("화면이 숨겨지면 자동 일시정지되고, 숨겨진 5분은 생존 시간에 들어가지 않는다", () => {
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });

    const { result } = renderHook(() => useDefenseEngine());
    step(1000);
    act(() => { result.current.startGame(); });
    // 5초 정상 플레이
    let elapsed = 0;
    while (elapsed < 5000) {
      const a = result.current.attacks.find(x => !x.resolved);
      if (a) {
        const w = a.arriveAt - performance.now();
        if (w > 0) { step(Math.max(1, Math.floor(w))); elapsed += w; }
        act(() => { result.current.handleGuard(a.side); });
      }
      step(16); elapsed += 16;
    }
    expect(result.current.phase).toBe("playing");

    // 앱 전환 → visibilitychange(hidden) → 자동 일시정지
    hidden = true;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current.paused).toBe(true);
    step(300_000); // 5분 뒤 복귀
    hidden = false;
    act(() => { result.current.togglePause(); });
    expect(result.current.paused).toBe(false);

    // 이제 손 놓고 죽는다 — 생존 시간은 5분이 아니라 몇 초여야 한다
    for (let i = 0; i < 600 && result.current.phase !== "gameover"; i++) step(16);
    expect(result.current.phase).toBe("gameover");
    expect(result.current.stats.survivedMs).toBeLessThan(20_000);

    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  it("일시정지 중에는 카운터 탭이 점수가 되지 않는다", () => {
    const { result } = renderHook(() => useDefenseEngine());
    act(() => { result.current.startGame(); });
    step(1200);
    act(() => { result.current.togglePause(); });
    const before = result.current.stats.score;
    act(() => { result.current.handleCounterTap(); });
    expect(result.current.stats.score).toBe(before);
  });
});

// ─────────────────────────── 미트 드릴 ───────────────────────────
describe("useMittEngine", () => {
  const COUNTDOWN_MS = 800 * 4 + 10;

  function hitFirstGlove(result: { current: ReturnType<typeof useMittEngine> }) {
    step(2000);
    const glove = result.current.gloves[0];
    expect(glove).toBeTruthy();
    step(Math.max(0, glove.duration - (performance.now() - glove.spawnedAt)));
    act(() => { result.current.handlePunch(glove.punch); });
  }

  it("다시 하기 뒤 1라운드 점수는 0에서 시작한다 (직전 게임 점수를 빼지 않는다)", () => {
    const { result } = renderHook(() => useMittEngine());
    act(() => { result.current.startGame("tester"); });
    step(COUNTDOWN_MS);
    hitFirstGlove(result);
    expect(result.current.score).toBeGreaterThan(0);
    for (let i = 0; i < 70; i++) step(1000);
    act(() => { result.current.endSession(); });
    expect(result.current.phase).toBe("results");

    act(() => { result.current.restartGame(); });
    step(COUNTDOWN_MS);
    expect(result.current.phase).toBe("playing");
    for (let i = 0; i < 70; i++) step(1000);
    expect(result.current.roundOutcome!.score).toBe(0);
  });

  it("정타는 다른 상태 변경과 같은 프레임에 들어와도 헛스윙(에너지 감소)으로 처리되지 않는다", () => {
    const { result } = renderHook(() => useMittEngine());
    act(() => { result.current.startGame("t"); });
    step(COUNTDOWN_MS);
    step(2000);
    const glove = result.current.gloves[0];
    expect(glove).toBeTruthy();
    step(Math.max(0, glove.duration - (performance.now() - glove.spawnedAt)));
    act(() => {
      vi.advanceTimersByTime(1); // 틱(rAF)·스폰 등 다른 업데이트가 같은 배치에 섞이는 상황
      result.current.handlePunch(glove.punch);
    });
    expect(result.current.lastResult?.rating).toBe("perfect");
    expect(result.current.combo).toBe(1);
    expect(result.current.energy).toBe(100);
  });

  it("라운드 시간이 끝난 뒤 멈추면 일시정지 중에 라운드가 끝나지 않는다", () => {
    const { result } = renderHook(() => useMittEngine());
    act(() => { result.current.startGame("t"); });
    step(COUNTDOWN_MS);
    // 글러브를 계속 맞히면서 라운드 시간(18초)을 소진 → drain 대기 창에서 일시정지
    let guard = 0;
    while (result.current.stageTime > 0 && guard++ < 3000) {
      const g = result.current.gloves.find(x => !x.hit && !x.missed);
      if (g) {
        const w = g.duration - (performance.now() - g.spawnedAt);
        if (w > 0) step(Math.min(w, 1000));
        if (g.duration - (performance.now() - g.spawnedAt) <= 0) act(() => { result.current.handlePunch(g.punch); });
      } else {
        step(100);
      }
    }
    expect(result.current.stageTime).toBe(0);
    expect(result.current.phase).toBe("playing");
    act(() => { result.current.pauseGame(); });
    step(10_000);
    expect(result.current.phase).toBe("playing");
    expect(result.current.paused).toBe(true);
    act(() => { result.current.resumeGame(); });
    step(10_000);
    expect(["clear", "fail"]).toContain(result.current.phase);
  });
});

// ─────────────────────────── 반응속도 ───────────────────────────
describe("useGameEngine", () => {
  const COUNTDOWN_MS = 700 * 4 + 10;

  it("시간 초과로 끝나도 결과에 플레이어 이름이 남는다", () => {
    localStorage.setItem("reactionTraining_totalGames", "3");
    localStorage.setItem("mitt_intro_seen", "1");
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.startGame("홍길동닉"); });
    step(COUNTDOWN_MS);
    expect(result.current.phase).toBe("playing");
    for (let i = 0; i < 100 && result.current.phase === "playing"; i++) step(250);
    expect(result.current.phase).toBe("results");
    expect(result.current.sessionResult!.playerName).toBe("홍길동닉");
  });

  it("일시정지 중에 홈으로 나가면 다음 판이 멈춘 채 시작되지 않는다", () => {
    localStorage.setItem("reactionTraining_totalGames", "3");
    localStorage.setItem("mitt_intro_seen", "1");
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.startGame("t"); });
    step(COUNTDOWN_MS);
    act(() => { result.current.pauseGame(); });
    expect(result.current.paused).toBe(true);
    act(() => { result.current.goHome(); });
    expect(result.current.phase).toBe("home");
    expect(result.current.paused).toBe(false);
    act(() => { result.current.startGame("t"); });
    step(COUNTDOWN_MS);
    expect(result.current.phase).toBe("playing");
    expect(result.current.paused).toBe(false);
    for (let i = 0; i < 40 && !result.current.currentPunch; i++) step(50);
    expect(result.current.currentPunch).toBeTruthy(); // 큐가 실제로 나온다 (paused 잔존이면 안 나온다)
  });
});
