import { describe, expect, it } from "vitest";
import { lastDayLabel, parsePbTopWindow, pbTopEmptyText, pbTopValueLabel } from "./record153PbTop";

// 첫 공식 기록 2026-10-20 (한국) → 창 10/20 00:00 KST ~ 11/20 00:00 KST
const WIN = { starts_at: "2026-10-19T15:00:00+00:00", ends_at: "2026-11-19T15:00:00+00:00" };

describe("최초 153 PB 1위 — 안내 문구", () => {
  it("서버 값 읽기", () => {
    expect(parsePbTopWindow(null)).toBeNull();
    expect(parsePbTopWindow({ starts_at: "x", ends_at: "y" })).toBeNull();
    expect(parsePbTopWindow(WIN)).toEqual(WIN);
  });

  it("마지막 날 = 마감 0시(한국)의 하루 전", () => {
    expect(lastDayLabel(WIN.ends_at)).toBe("11월 19일");
    // 1월 31일 시작 → 2월 28일 0시 마감 → 2월 27일까지
    expect(lastDayLabel("2027-02-27T15:00:00+00:00")).toBe("2월 27일");
  });

  it("시작 전 · 진행 중 · 끝난 뒤", () => {
    expect(pbTopEmptyText("남자", null)).toBe("첫 공식 기록일부터 한 달 — 그때 오픈 남자 1위가 주인이 돼요");
    expect(pbTopEmptyText("여자", WIN, new Date("2026-11-19T14:59:59Z"))).toBe("11월 19일까지 잰 기록 중 오픈 여자 1위가 주인이 돼요");
    expect(pbTopEmptyText("남자", WIN, new Date("2026-11-19T15:00:00Z"))).toBe("한 달이 끝났어요 — 오픈 남자 1위 기록이 곧 새겨져요");
  });

  it("1위 기록 표시 — 완주 시간 · 타임캡", () => {
    expect(pbTopValueLabel(1250000)).toBe("20:50.0");
    expect(pbTopValueLabel(1500000 + 12000)).toBe("캡 + 12개");
    expect(pbTopValueLabel(null)).toBeNull();
    expect(pbTopValueLabel(0)).toBeNull();
  });
});
