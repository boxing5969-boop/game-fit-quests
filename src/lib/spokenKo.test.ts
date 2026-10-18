import { describe, expect, it } from "vitest";
import { toSpokenKo } from "./spokenKo";

describe("toSpokenKo — 153은 '일오삼'으로 읽는다", () => {
  it("브랜드 이름은 일오삼", () => {
    expect(toSpokenKo("153복싱짐 문 앞에 서 있는 나를 떠올립니다.")).toBe("일오삼복싱짐 문 앞에 서 있는 나를 떠올립니다.");
    expect(toSpokenKo("153 PB 리허설입니다. 상대는 단 한 명, 지난번의 나.")).toBe("일오삼 PB 리허설입니다. 상대는 단 한 명, 지난번의 나.");
    expect(toSpokenKo("마이복서153")).toBe("마이복서일오삼");
    expect(toSpokenKo("153마인드셋, 153 PB")).toBe("일오삼마인드셋, 일오삼 PB");
    expect(toSpokenKo("153")).toBe("일오삼");
  });

  it("다른 숫자 · 기록 시간은 그대로", () => {
    expect(toSpokenKo("1530")).toBe("1530");
    expect(toSpokenKo("2153")).toBe("2153");
    expect(toSpokenKo("지난번의 나는 18분 42초")).toBe("지난번의 나는 18분 42초");
    expect(toSpokenKo("15분 3초")).toBe("15분 3초");
    expect(toSpokenKo("이용희님 환영합니다!")).toBe("이용희님 환영합니다!");
  });
});
