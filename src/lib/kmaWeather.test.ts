import { describe, expect, it } from "vitest";
import {
  addDays,
  asosDays,
  fcstBase,
  fcstDays,
  kst,
  kstIso,
  latLonToGrid,
  ncstBase,
  ncstHour,
  num,
  parseKma,
  rainMm,
  readSites,
} from "../../supabase/functions/kma-weather/logic.ts";

// 한국 시간 → Date (UTC = KST - 9)
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+09:00`);

describe("kma-weather 시각", () => {
  it("한국 시간 날짜 · 시", () => {
    expect(kst(new Date("2026-11-14T15:30:00Z"))).toEqual({ ymd: "20261115", day: "2026-11-15", hh: 0, mm: 30 });
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(kstIso("20261114", "1400")).toBe("2026-11-14T05:00:00.000Z");
  });

  it("초단기실황 — 45분 전이면 한 시간 앞 정시", () => {
    expect(ncstBase(at("2026-11-14", "14:50"))).toEqual({ base_date: "20261114", base_time: "1400" });
    expect(ncstBase(at("2026-11-14", "14:44"))).toEqual({ base_date: "20261114", base_time: "1300" });
    expect(ncstBase(at("2026-11-15", "00:30"))).toEqual({ base_date: "20261114", base_time: "2300" });
  });

  it("단기예보 — 02 · 05 · … · 23시 발표 · 15분 여유 · 새벽엔 전날 23시", () => {
    expect(fcstBase(at("2026-11-14", "14:15"))).toEqual({ base_date: "20261114", base_time: "1400" });
    expect(fcstBase(at("2026-11-14", "14:14"))).toEqual({ base_date: "20261114", base_time: "1100" });
    expect(fcstBase(at("2026-11-14", "02:20"))).toEqual({ base_date: "20261114", base_time: "0200" });
    expect(fcstBase(at("2026-11-14", "02:10"))).toEqual({ base_date: "20261113", base_time: "2300" });
    expect(fcstBase(at("2026-11-14", "23:59"))).toEqual({ base_date: "20261114", base_time: "2300" });
  });
});

describe("kma-weather 응답 읽기", () => {
  it("정상 · 한 줄(item 이 배열이 아님) · 자료 없음 · 포털 XML 오류", () => {
    const ok = parseKma(
      JSON.stringify({
        response: {
          header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
          body: { items: { item: [{ category: "T1H", obsrValue: "12.3" }] }, totalCount: 8 },
        },
      }),
    );
    expect(ok).toMatchObject({ ok: true, code: "00", total: 8 });
    expect(ok.items).toHaveLength(1);
    const one = parseKma(JSON.stringify({ response: { header: { resultCode: "00", resultMsg: "OK" }, body: { items: { item: { tm: "2026-11-13" } } } } }));
    expect(one.items).toEqual([{ tm: "2026-11-13" }]);
    expect(parseKma(JSON.stringify({ response: { header: { resultCode: "03", resultMsg: "NO_DATA" } } }))).toMatchObject({ ok: false, code: "03", items: [] });
    const xml =
      "<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>";
    expect(parseKma(xml)).toMatchObject({ ok: false, code: "30", msg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" });
    expect(parseKma("Unauthorized")).toMatchObject({ ok: false, code: "BAD_RESPONSE", msg: "Unauthorized" });
  });

  it("숫자 · 결측 · 강수량 글", () => {
    expect(num("")).toBeNull();
    expect(num("-999")).toBeNull();
    expect(num("900")).toBeNull();
    expect(num("-12.7")).toBe(-12.7);
    expect(rainMm("강수없음")).toBe(0);
    expect(rainMm("1mm 미만")).toBe(0.5);
    expect(rainMm("1.5")).toBe(1.5);
    expect(rainMm("30.0~50.0mm")).toBe(30);
    expect(rainMm("50.0mm 이상")).toBe(50);
    expect(rainMm("모름")).toBeNull();
  });
});

describe("kma-weather 바꾸기", () => {
  it("초단기실황 → 시간 한 줄 (발표 정시 = 관측 시각)", () => {
    const base = { base_date: "20261114", base_time: "1400" };
    const items = [
      { category: "T1H", obsrValue: "12.3" },
      { category: "RN1", obsrValue: "1.5" },
      { category: "PTY", obsrValue: "1" },
      { category: "REH", obsrValue: "88" },
      { category: "WSD", obsrValue: "2.1" },
      { category: "UUU", obsrValue: "-1.2" },
    ];
    expect(ncstHour(items, base)).toEqual({ obs_at: "2026-11-14T05:00:00.000Z", t1h: 12.3, rn1: 1.5, pty: 1, reh: 88, wsd: 2.1 });
    expect(ncstHour([{ category: "UUU", obsrValue: "1" }], base)).toBeNull();
  });

  it("단기예보 → 날마다 — TMN · TMX 먼저 · 강수 형태는 눈 > 비/눈 > 비 > 소나기 · 하늘은 낮에 가장 많은 것", () => {
    const f = (date: string, time: string, category: string, fcstValue: string) => ({ fcstDate: date, fcstTime: time, category, fcstValue });
    const items = [
      f("20261114", "1500", "TMP", "11"),
      f("20261114", "1600", "TMP", "12"),
      f("20261114", "1500", "POP", "30"),
      f("20261114", "1600", "POP", "60"),
      f("20261114", "1500", "PTY", "4"),
      f("20261114", "1600", "PTY", "1"),
      f("20261114", "1500", "SKY", "4"),
      f("20261114", "1600", "SKY", "4"),
      f("20261115", "0600", "TMN", "-1.0"),
      f("20261115", "1500", "TMX", "8.0"),
      f("20261115", "0600", "TMP", "-0.5"),
      f("20261115", "1500", "TMP", "7"),
      f("20261115", "0600", "PTY", "3"),
      f("20261115", "1500", "PTY", "1"),
      f("20261115", "0600", "SNO", "1.0cm"),
      f("20261115", "0600", "SKY", "4"),
      f("20261115", "1000", "SKY", "1"),
      f("20261115", "1100", "SKY", "1"),
      f("20261115", "1200", "SKY", "3"),
      f("20261116", "1200", "SNO", "적설없음"),
      f("20261116", "1200", "TMP", "5"),
      f("20261116", "1200", "PTY", "0"),
      f("20261116", "1200", "SKY", "3"),
    ];
    expect(fcstDays(items)).toEqual([
      { day: "2026-11-14", tmin: 11, tmax: 12, pop: 60, pty: 1, sky: 4, snow: false, hours: 2 },
      { day: "2026-11-15", tmin: -1, tmax: 8, pop: null, pty: 3, sky: 1, snow: true, hours: 2 },
      { day: "2026-11-16", tmin: 5, tmax: 5, pop: null, pty: 0, sky: 3, snow: false, hours: 1 },
    ]);
  });

  it("ASOS 일자료 → 날마다 — 일강수량 빈 칸 = 0 · 신적설 · 일기현상 눈", () => {
    const items = [
      { tm: "2026-11-12", minTa: "3.1", maxTa: "12.4", sumRn: "", ddMefs: "", iscs: "{박무}0300-0800." },
      { tm: "2026-11-13", minTa: "-1.2", maxTa: "6.0", sumRn: "12.5", ddMefs: "", iscs: "{비}0310-1920." },
      { tm: "2026-11-14", minTa: "-4.0", maxTa: "1.0", sumRn: "0.3", ddMefs: "", iscs: "{진눈깨비}0610-0720.{눈}0720-0900." },
      { tm: "2026-11-15", minTa: "-13.0", maxTa: "-2.0", sumRn: "", ddMefs: "2.5", iscs: "" },
      { tm: "bad", minTa: "1" },
    ];
    expect(asosDays(items)).toEqual([
      { day: "2026-11-12", tmin: 3.1, tmax: 12.4, rain: 0, snow: null, snowDay: false },
      { day: "2026-11-13", tmin: -1.2, tmax: 6, rain: 12.5, snow: null, snowDay: false },
      { day: "2026-11-14", tmin: -4, tmax: 1, rain: 0.3, snow: null, snowDay: true },
      { day: "2026-11-15", tmin: -13, tmax: -2, rain: 0, snow: 2.5, snowDay: true },
    ]);
  });

  it("격자 변환 — 기상청 격자표와 같은 칸", () => {
    expect(latLonToGrid(37.5714, 126.9658)).toEqual({ nx: 60, ny: 127 }); // 서울 종로
    expect(latLonToGrid(37.4954, 127.0333)).toEqual({ nx: 61, ny: 125 }); // 강남 역삼1동
    expect(latLonToGrid(37.5045, 127.049)).toEqual({ nx: 61, ny: 125 }); // 선릉역
    expect(latLonToGrid(37.5133, 127.1001)).toEqual({ nx: 62, ny: 126 }); // 잠실역
    expect(latLonToGrid(36.9805, 127.915)).toEqual({ nx: 76, ny: 114 }); // 충주 칠금동
  });

  it("설정 다듬기 — 빈 이름 · 격자 밖 · 같은 지점 두 번은 버림", () => {
    expect(
      readSites({
        sites: [
          { branch: " 153복싱짐 선릉역점 ", nx: 61, ny: 125, stn: 108 },
          { branch: "153복싱짐 선릉역점", nx: 61, ny: 125, stn: 108 },
          { branch: "", nx: 61, ny: 125, stn: 108 },
          { branch: "밖", nx: 0, ny: 125, stn: 108 },
          { branch: "153복싱짐 칠금점", nx: 76, ny: 114, stn: 127 },
        ],
      }),
    ).toEqual([
      { branch: "153복싱짐 선릉역점", nx: 61, ny: 125, stn: 108 },
      { branch: "153복싱짐 칠금점", nx: 76, ny: 114, stn: 127 },
    ]);
    expect(readSites(null)).toEqual([]);
  });
});
