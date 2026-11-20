import { describe, expect, it } from "vitest";
import { NEXT_LEVEL_DEMOS, homeLevelDemo, nextLevelDemo, nextLevelDemoLink } from "./nextLevelGuideSample";
import { titleFlowHero } from "./nextLevelGuide";
import { attemptsLeft, memberPhase } from "./titleMatchChallenge";

describe("홈 「다음 레벨까지」 예시 (?lvdemo=)", () => {
  it("값이 없거나 0 이면 원래 화면", () => {
    for (const v of [null, undefined, "", " ", "0", "off", "OFF"]) expect(nextLevelDemo(v)).toBeNull();
  });

  it("값마다 예시 — 모르는 값은 레벨 4 예시", () => {
    expect(nextLevelDemo("1")?.data).toMatchObject({ league: "white", level: 1, titleFlow: false });
    expect(nextLevelDemo("4")?.data).toMatchObject({ league: "white", level: 4, titleFlow: false });
    expect(nextLevelDemo("10")?.data).toMatchObject({ league: "white", level: 10, titleFlow: true });
    expect(nextLevelDemo("WAIT")?.key).toBe("wait");
    expect(nextLevelDemo("true")?.key).toBe("4");
    // 레벨 퀘스트 (2026-11-18) — 오늘 온 날 · 레벨업한 날
    expect(nextLevelDemo("today")?.data).toMatchObject({ league: "white", level: 4, attendedToday: true });
    expect(nextLevelDemo("today")?.data.cycle).toMatchObject({ progressFloor: 2, progress: 2.25 });
    expect(nextLevelDemo("up")?.data).toMatchObject({ league: "white", level: 5, attendedToday: true, leveledUpToday: true });
    expect(nextLevelDemo("up")?.data.cycle.progressFloor).toBe(0);
  });

  it("칩 순서 · 주소", () => {
    expect(NEXT_LEVEL_DEMOS.map((d) => d.key)).toEqual(["1", "4", "today", "up", "10", "wait"]);
    expect(NEXT_LEVEL_DEMOS.map((d) => nextLevelDemoLink(d.key))).toEqual([
      "/home?lvdemo=1",
      "/home?lvdemo=4",
      "/home?lvdemo=today",
      "/home?lvdemo=up",
      "/home?lvdemo=10",
      "/home?lvdemo=wait",
    ]);
    for (const d of NEXT_LEVEL_DEMOS) expect(nextLevelDemo(d.key)).toBe(d);
  });

  it("지어낸 출석은 화이트 규칙(3회)과 맞는다 — 아직 채우기 전", () => {
    for (const d of NEXT_LEVEL_DEMOS) {
      const c = d.data.cycle;
      expect(c.reqSessions).toBe(3);
      expect(c.progressFloor).toBeLessThan(c.reqSessions);
      expect(c.meets).toBe(false);
      expect(c.rank).toBe(d.data.league);
    }
    expect(nextLevelDemo("4")?.data.cycle.progressFloor).toBe(1);
    expect(nextLevelDemo("1")?.data.cycle.progressFloor).toBe(0);
  });

  it("레벨 10 예시의 단계 — 신청 전은 신청 단추, 신청한 뒤는 기다림", () => {
    const ready = nextLevelDemo("10")!.data.titleState;
    const wait = nextLevelDemo("wait")!.data.titleState;
    expect(memberPhase(ready)).toBe("ready");
    expect(memberPhase(wait)).toBe("requested");
    const opts = (s: typeof ready) => ({ attemptsLeft: attemptsLeft(s), retryAt: s?.retryAt ?? null, reviewer: "지점장님" });
    expect(titleFlowHero(memberPhase(ready), opts(ready)).canRequest).toBe(true);
    expect(titleFlowHero(memberPhase(wait), opts(wait)).hero).toBe("심사를 기다려요");
  });
});

// 2026-11-20 대표님 「회원으로 보기해도 안보이는데..」 — '회원으로 보기'는 역할만 바꾸고 레벨은 그대로라
// 레벨 40 을 마친 계정(마스터) · 지도진 계정은 회원으로 봐도 카드가 없었다 → 그때는 회원 예시로
describe("홈에 그릴 예시 (homeLevelDemo)", () => {
  it("주소의 ?lvdemo= 가 먼저", () => {
    expect(homeLevelDemo("today", { viewAsMember: false, ownCard: true })?.key).toBe("today");
    expect(homeLevelDemo("10", { viewAsMember: true, ownCard: false })?.key).toBe("10");
    expect(homeLevelDemo("wait", { viewAsMember: true, ownCard: true })?.key).toBe("wait");
  });

  it("회원으로 보기 중 · 이 계정에 카드가 없으면 레벨 4 예시", () => {
    const d = homeLevelDemo(null, { viewAsMember: true, ownCard: false });
    expect(d?.key).toBe("4");
    expect(d?.data).toMatchObject({ league: "white", level: 4 });
  });

  it("카드가 있는 계정은 회원으로 봐도 자기 진행 그대로 (예시 없음)", () => {
    expect(homeLevelDemo(null, { viewAsMember: true, ownCard: true })).toBeNull();
    expect(homeLevelDemo("", { viewAsMember: true, ownCard: true })).toBeNull();
  });

  it("회원으로 보기가 아니면 지도진 · 마스터 계정은 예전처럼 카드 없음", () => {
    expect(homeLevelDemo(null, { viewAsMember: false, ownCard: false })).toBeNull();
    expect(homeLevelDemo(undefined, { viewAsMember: false, ownCard: true })).toBeNull();
  });
});
