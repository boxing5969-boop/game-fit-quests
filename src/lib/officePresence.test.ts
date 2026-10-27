import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  getOfficeSelfMeta,
  officeCallsFromPresence,
  setOfficeSelfMeta,
  setOfficeTracker,
} from "./officePresence";
import { officeCallNames } from "./officeCall";

describe("officeCallsFromPresence — 음성 회의 중인 사람", () => {
  it("call 표시가 있는 사람만, 마이크 · 카메라는 기기 중 하나라도 켜져 있으면 켜짐", () => {
    const calls = officeCallsFromPresence({
      a: [{ at: 1 }],
      b: [{ at: 1, call: true }],
      c: [
        { at: 1, call: true, mic: false, cam: false },
        { at: 2, call: true, mic: true, cam: false },
      ],
      d: [
        { at: 1, call: false, mic: true },
        { at: 2, call: true, cam: true },
      ],
    });
    expect([...calls.keys()].sort()).toEqual(["b", "c", "d"]);
    expect(calls.get("b")).toEqual({ mic: false, cam: false });
    expect(calls.get("c")).toEqual({ mic: true, cam: false });
    // 음성 회의가 아닌 기기의 마이크는 세지 않는다
    expect(calls.get("d")).toEqual({ mic: false, cam: true });
  });

  it("'true' 글자 같은 다른 값은 켜짐이 아니다", () => {
    const calls = officeCallsFromPresence({ a: [{ call: "true", mic: "true" }], b: [{ call: true, mic: 1 }] });
    expect(calls.has("a")).toBe(false);
    expect(calls.get("b")).toEqual({ mic: false, cam: false });
  });

  it("빈 상태", () => {
    expect(officeCallsFromPresence({}).size).toBe(0);
  });
});

describe("setOfficeSelfMeta — 내 표시를 Presence 에 다시 싣는다", () => {
  it("걸어 둔 채널에 바로 보내고, 다음 track 에도 같이 실린다", () => {
    const sent = vi.fn();
    setOfficeTracker("office:test", sent);
    setOfficeSelfMeta("office:test", { call: true, mic: false, cam: false });
    expect(sent).toHaveBeenCalledWith({ call: true, mic: false, cam: false });
    expect(getOfficeSelfMeta("office:test")).toEqual({ call: true, mic: false, cam: false });

    setOfficeSelfMeta("office:test", {});
    expect(sent).toHaveBeenLastCalledWith({});
    expect(getOfficeSelfMeta("office:test")).toEqual({});
    setOfficeTracker("office:test", null);
  });

  it("채널이 없으면 기억만 한다 (채널이 생기면 track 에 실린다)", () => {
    setOfficeSelfMeta("office:none", { call: true, mic: true });
    expect(getOfficeSelfMeta("office:none")).toEqual({ call: true, mic: true });
    setOfficeSelfMeta(null, { call: true });
    expect(getOfficeSelfMeta("office:other")).toEqual({});
  });
});

describe("officeCallNames", () => {
  it("둘까지는 다, 셋부터 '외 N명'", () => {
    expect(officeCallNames([])).toBe("");
    expect(officeCallNames(["이재우"])).toBe("이재우");
    expect(officeCallNames(["이재우", "김민수"])).toBe("이재우 · 김민수");
    expect(officeCallNames(["이재우", "김민수", "박지훈", "최유진"])).toBe("이재우 · 김민수 외 2명");
  });
});
