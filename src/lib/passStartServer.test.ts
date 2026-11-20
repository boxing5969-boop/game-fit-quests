import { describe, expect, it } from "vitest";
import { checkStart, continueFrom as serverContinue, kstToday, startWindow } from "../../supabase/functions/payssam-create-bill/start.ts";
import { addDays, continueFrom, requestedStart, startBounds } from "./cartPricing";

// 결제 링크를 만드는 서버(payssam-create-bill/start.ts)와 화면(cartPricing)이 시작일을 같은 식으로 보는지 (2026-11-20)
describe("수강권 시작일 — 서버 검사 = 화면 식", () => {
  const today = "2026-11-20";
  const ends: Array<string | null> = [null, "2026-11-01", "2026-11-19", today, "2026-11-21", "2026-12-10", "2027-01-31", "엉뚱한 값"];

  it("기본 시작일 · 고를 수 있는 날이 같다", () => {
    for (const end of ends) {
      expect(serverContinue(end, today)).toBe(continueFrom(end, today));
      const w = startWindow(end, today);
      const b = startBounds(end, today);
      expect([w.min, w.max]).toEqual([b.min, b.max]);
    }
  });

  it("범위 안 날짜마다 저장할 시작일이 화면 requestedStart 와 같다 · 범위 밖은 막힌다", () => {
    for (const end of ends) {
      const b = startBounds(end, today);
      for (let i = -3; i <= 34; i++) {
        const d = addDays(b.min, i);
        const r = checkStart(d, end, today, true);
        if (i < 0 || i > 30) {
          expect(r.ok).toBe(false);
        } else {
          expect(r).toEqual({ ok: true, start: requestedStart(d, b) });
        }
      }
    }
  });

  it("시작일이 없으면 기본 · 수강권 없이 고르면 막힌다 · 없는 날은 다시 고르기", () => {
    expect(checkStart(undefined, null, today, true)).toEqual({ ok: true, start: null });
    expect(checkStart("", null, today, false)).toEqual({ ok: true, start: null });
    expect(checkStart("2026-11-27", null, today, false)).toEqual({ ok: false, error: "시작일은 수강권을 살 때만 고를 수 있어요." });
    expect(checkStart("2026-02-30", null, today, true)).toEqual({ ok: false, error: "시작일을 다시 골라 주세요." });
    expect(checkStart(20261127, null, today, true)).toEqual({ ok: false, error: "시작일을 다시 골라 주세요." });
    expect(checkStart("2026-12-21", null, today, true)).toEqual({ ok: false, error: "시작일은 11월 20일부터 12월 20일까지 고를 수 있어요." });
  });

  it("한국 날짜 — 밤 11시 59분(UTC 14:59)까지 같은 날, 자정이 지나면 다음 날", () => {
    expect(kstToday(Date.parse("2026-11-20T14:59:59Z"))).toBe("2026-11-20");
    expect(kstToday(Date.parse("2026-11-20T15:00:00Z"))).toBe("2026-11-21");
    expect(kstToday(Date.parse("2026-11-19T15:00:00Z"))).toBe("2026-11-20");
  });
});
