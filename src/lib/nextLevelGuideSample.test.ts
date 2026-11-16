import { describe, expect, it } from "vitest";
import { NEXT_LEVEL_DEMOS, nextLevelDemo, nextLevelDemoLink } from "./nextLevelGuideSample";
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
  });

  it("칩 순서 · 주소", () => {
    expect(NEXT_LEVEL_DEMOS.map((d) => d.key)).toEqual(["1", "4", "10", "wait"]);
    expect(NEXT_LEVEL_DEMOS.map((d) => nextLevelDemoLink(d.key))).toEqual([
      "/home?lvdemo=1",
      "/home?lvdemo=4",
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
