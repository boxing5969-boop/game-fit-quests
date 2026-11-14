import { describe, expect, it } from "vitest";
import { fcLook, forecastLine, normalizeWeather, stampCount, stampLine, weatherOn, weatherStamp, WEATHER_META } from "./calendarWeather";

const raw = [
  { day: "2026-11-05", kind: "rain", rain: 12.5, tmin: 3, tmax: 9, fc: null },
  { day: "2026-11-06", kind: "snow", rain: 0.3, tmin: -4, tmax: 1, fc: null },
  { day: "2026-11-07", kind: "cold", rain: 0, tmin: -13.4, tmax: -5, fc: null },
  { day: "2026-11-08", kind: "heat", rain: 0, tmin: 26, tmax: 34.2, fc: null },
  { day: "2026-11-09", kind: null, rain: 0, tmin: 2, tmax: 12, fc: null },
  { day: "2026-11-14", kind: null, rain: 0.4, tmin: 9.5, tmax: 13.5, fc: { tmin: 9.5, tmax: 14, pop: 60, pty: 1, sky: 4, snow: false } },
  { day: "2026-11-15", kind: null, rain: null, tmin: null, tmax: null, fc: { tmin: 10, tmax: 19, pop: 20, pty: 0, sky: 1, snow: false } },
  { day: "2026-11-16", kind: "fog", fc: { tmin: -2, tmax: 3, pop: 70, pty: 3, sky: 4, snow: true } },
  { day: "bad", kind: "rain" },
  null,
];

describe("날씨 도장", () => {
  const map = normalizeWeather(raw);

  it("서버 weather 읽기 — 모르는 갈래 · 날짜는 버림", () => {
    expect(map.size).toBe(8);
    expect(weatherOn(map, "2026-11-16")?.kind).toBeNull();
    expect(weatherOn(map, "2026-11-16")?.fc?.snow).toBe(true);
    expect(weatherOn(map, "2026-12-01")).toBeNull();
    expect(normalizeWeather("x").size).toBe(0);
  });

  it("도장은 출석한 날에만", () => {
    expect(weatherStamp(weatherOn(map, "2026-11-05"), true)).toBe("rain");
    expect(weatherStamp(weatherOn(map, "2026-11-05"), false)).toBeNull();
    expect(weatherStamp(weatherOn(map, "2026-11-09"), true)).toBeNull();
    expect(weatherStamp(null, true)).toBeNull();
    const came = new Set(["2026-11-05", "2026-11-06", "2026-11-09"]);
    expect(stampCount(map, ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-09"], (d) => came.has(d))).toBe(2);
  });

  it("칭찬 한 줄 — 비는 mm · 폭염은 최고 · 한파는 최저", () => {
    expect(stampLine(weatherOn(map, "2026-11-05")!)).toBe("비 오는 날도 왔어요 · 12.5mm");
    expect(stampLine(weatherOn(map, "2026-11-06")!)).toBe("눈 오는 날도 왔어요");
    expect(stampLine(weatherOn(map, "2026-11-07")!)).toBe("한파에도 왔어요 · 최저 -13°");
    expect(stampLine(weatherOn(map, "2026-11-08")!)).toBe("폭염에도 왔어요 · 최고 34°");
    expect(stampLine(weatherOn(map, "2026-11-09")!)).toBeNull();
  });

  it("예보 한 줄 · 그림 갈래", () => {
    expect(forecastLine(weatherOn(map, "2026-11-14")!.fc!)).toBe("비 · 강수확률 60% · 10° ~ 14°");
    expect(forecastLine(weatherOn(map, "2026-11-15")!.fc!)).toBe("맑음 · 10° ~ 19°");
    expect(forecastLine(weatherOn(map, "2026-11-16")!.fc!)).toBe("눈 · 강수확률 70% · -2° ~ 3°");
    expect(forecastLine({ tmin: null, tmax: 7, pop: null, pty: 0, sky: 3, snow: false })).toBe("구름 많음 · 최고 7°");
    expect(fcLook(weatherOn(map, "2026-11-14")!.fc!)).toBe("rain");
    expect(fcLook(weatherOn(map, "2026-11-15")!.fc!)).toBe("sun");
    expect(fcLook(weatherOn(map, "2026-11-16")!.fc!)).toBe("snow");
    expect(fcLook({ tmin: 1, tmax: 2, pop: 0, pty: 0, sky: 4, snow: false })).toBe("cloud");
  });

  it("회원 화면에 쓰지 않는 낱말이 없다", () => {
    const words = [...Object.values(WEATHER_META).map((m) => m.label)];
    for (const w of words) expect(w).not.toMatch(/못|빠진|밀린|실패/);
  });
});
