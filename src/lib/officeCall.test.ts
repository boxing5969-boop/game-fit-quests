import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { OFFICE_CALL_IDLE_MS, OFFICE_CALL_IDLE_NOTICE, officeCallIdleReason } from "./officeCall";

describe("음성 회의 비용 지킴이", () => {
  const now = Date.UTC(2026, 9, 27, 13, 0, 0);
  const min = 60_000;

  it("화면이 꺼진 지 10분이 넘으면 나온다", () => {
    expect(officeCallIdleReason({ now, hiddenSince: now - 10 * min, aloneSince: 0 })).toBe("hidden");
    expect(officeCallIdleReason({ now, hiddenSince: now - 9 * min, aloneSince: 0 })).toBeNull();
  });

  it("음성방에 혼자 10분이 넘으면 나온다", () => {
    expect(officeCallIdleReason({ now, hiddenSince: 0, aloneSince: now - 11 * min })).toBe("alone");
    expect(officeCallIdleReason({ now, hiddenSince: 0, aloneSince: now - 30_000 })).toBeNull();
  });

  it("화면이 보이고 다른 사람이 있으면(0) 나오지 않는다", () => {
    expect(officeCallIdleReason({ now, hiddenSince: 0, aloneSince: 0 })).toBeNull();
  });

  it("둘 다면 화면 꺼짐을 먼저 알린다", () => {
    expect(officeCallIdleReason({ now, hiddenSince: now - 12 * min, aloneSince: now - 12 * min })).toBe("hidden");
  });

  it("기준은 10분이고 안내 문구가 있다", () => {
    expect(OFFICE_CALL_IDLE_MS).toBe(600_000);
    expect(OFFICE_CALL_IDLE_NOTICE.hidden).toContain("10분");
    expect(OFFICE_CALL_IDLE_NOTICE.alone).toContain("혼자");
  });
});
