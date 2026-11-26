import { describe, expect, it } from "vitest";
import {
  CRM_DEMO_MEMBERS,
  crmStamp,
  customerSteps,
  filterRows,
  normalizeCard,
  normalizeCustomers,
  normalizeMembers,
  phoneText,
  statusPill,
  todoRows,
  visitText,
  visitWeeks,
} from "./crm153";
import { cleanQuery, last4, tokenSub } from "../../supabase/functions/os-crm/logic.ts";

describe("153OS CRM — 서버 답 읽기", () => {
  it("회원 목록 — 모르는 상태 · 할 일 표시는 버리고, 숫자가 없으면 0", () => {
    const m = normalizeMembers({
      day: "2026-11-27",
      snap_at: "2026-11-26T15:23:18Z",
      counts: { valid: 142, expiring: 24, novisit7: "26" },
      rows: [
        { id: "a", name: "가", status: "soon", days_left: 2, todo: ["exp3", "zzz"], last_visit: "2026-11-26", v7: 2, v30: "9" },
        { id: "b", status: "weird", todo: "x" },
        { name: "id 없음" },
      ],
    });
    expect(m.counts.valid).toBe(142);
    expect(m.counts.novisit7).toBe(26);
    expect(m.counts.idle30).toBe(0);
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0]).toMatchObject({ id: "a", status: "soon", daysLeft: 2, todo: ["exp3"], v30: 9 });
    expect(m.rows[1]).toMatchObject({ id: "b", name: "이름 없음", status: "unknown", todo: [] });
  });

  it("회원 카드 — 전화가 없으면 뒷자리 칸으로 · 같은 이름은 적어도 1", () => {
    const c = normalizeCard({ id: "x", name: "가", phone: null, last4: "1234", same_name: 0, visits: ["2026-11-03", "bad", "2026-11-01"] });
    expect(c?.last4).toBe("1234");
    expect(c?.sameName).toBe(1);
    expect(c?.visits).toEqual(["2026-11-01", "2026-11-03"]);
    const d = normalizeCard({ id: "y", phone: "010-9876-5432" });
    expect(d?.last4).toBe("5432");
    expect(normalizeCard({ error: "member_not_found" })).toBeNull();
  });

  it("고객 — 번호 남김 = 톡톡 번호 + 문의 기록", () => {
    const c = normalizeCustomers({ funnel: { month: "2026-11", talk_new: 101, talk_leads: 2, inquiries: 1, first_buy: 26, rebuy: 24 } });
    const s = customerSteps(c);
    expect(s.map((x) => x.value)).toEqual([101, 3, 26, 24]);
    expect(s[0].sub).toContain("11월");
  });
});

describe("153OS CRM — 할 일 · 거르기", () => {
  const rows = CRM_DEMO_MEMBERS.rows;
  it("기간 임박은 남은 날이 적은 회원부터", () => {
    expect(todoRows(rows, "expiring").map((r) => r.daysLeft)).toEqual([2, 11]);
  });
  it("끝난 회원은 최근에 끝난 회원부터", () => {
    expect(todoRows(rows, "ended").map((r) => r.end)).toEqual(["2026-11-23", "2026-11-05"]);
  });
  it("유효 = 유효 + 14일 안 끝남 + 홀딩", () => {
    expect(filterRows(rows, "valid")).toHaveLength(6);
    expect(filterRows(rows, "ended")).toHaveLength(2);
    expect(filterRows(rows, "hold").map((r) => r.status)).toEqual(["hold"]);
  });
  it("데모 숫자가 데모 명단과 맞다", () => {
    const c = CRM_DEMO_MEMBERS.counts;
    expect(todoRows(rows, "expiring")).toHaveLength(c.expiring);
    expect(todoRows(rows, "novisit7")).toHaveLength(c.novisit7);
    expect(todoRows(rows, "starter")).toHaveLength(c.starter);
    expect(todoRows(rows, "idle30")).toHaveLength(c.idle30);
    expect(filterRows(rows, "valid")).toHaveLength(c.valid);
  });
});

describe("153OS CRM — 글", () => {
  it("상태 알약", () => {
    expect(statusPill({ status: "soon", daysLeft: 0 })).toEqual({ text: "오늘 끝", tone: "red" });
    expect(statusPill({ status: "soon", daysLeft: 9 })).toEqual({ text: "9일 남음", tone: "amber" });
    expect(statusPill({ status: "ended", daysLeft: -4 }).text).toBe("끝난 지 4일");
    expect(statusPill({ status: "hold", daysLeft: 30 }).text).toBe("홀딩");
  });
  it("마지막 방문", () => {
    expect(visitText(null, "2026-11-27")).toBe("방문 기록 없음");
    expect(visitText("2026-11-27", "2026-11-27")).toBe("오늘 왔어요");
    expect(visitText("2026-11-26", "2026-11-27")).toBe("어제 왔어요");
    expect(visitText("2026-11-17", "2026-11-27")).toBe("10일 전에 왔어요");
  });
  it("전화", () => {
    expect(phoneText("01012345678")).toBe("010-1234-5678");
    expect(phoneText("0212345678")).toBe("021-234-5678");
    expect(phoneText(null)).toBe("");
  });
  it("브로제이 기준 시각 — 6시간 넘으면 알림", () => {
    const at = "2026-11-26T15:23:00Z";
    expect(crmStamp(at, Date.parse("2026-11-26T16:00:00Z"))).toEqual({ text: "11/27 00:23 브로제이 기준", warn: null });
    expect(crmStamp(at, Date.parse("2026-11-26T22:00:00Z")).warn).toContain("6시간");
    expect(crmStamp(null)).toEqual({ text: null, warn: null });
  });
  it("방문 칸 — 13주 · 월요일부터 · 앞날은 빈칸", () => {
    const w = visitWeeks(["2026-11-27", "2026-11-24", "2026-08-31"], "2026-11-27");
    expect(w).toHaveLength(13);
    expect(w[12].monday).toBe("2026-11-23");
    expect(w[12].days).toEqual([false, true, false, false, true, null, null]);
    expect(w[0].monday).toBe("2026-08-31");
    expect(w[0].days[0]).toBe(true);
  });
});

describe("os-crm 계산", () => {
  it("찾을 말 — 숫자 · 빼기면 숫자만, 한 글자 숫자는 버린다", () => {
    expect(cleanQuery("010-1234")).toBe("0101234");
    expect(cleanQuery(" 5678 ")).toBe("5678");
    expect(cleanQuery("1")).toBeNull();
    expect(cleanQuery("  김복서 ")).toBe("김복서");
    expect(cleanQuery("")).toBeNull();
    expect(cleanQuery("가".repeat(40))?.length).toBe(30);
  });
  it("토큰 sub 읽기 · 전화 뒷자리", () => {
    const payload = btoa(JSON.stringify({ sub: "11111111-2222-3333-4444-555555555555", role: "authenticated" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(tokenSub(`x.${payload}.y`)).toBe("11111111-2222-3333-4444-555555555555");
    expect(tokenSub("garbage")).toBeNull();
    expect(tokenSub(`x.${btoa(JSON.stringify({ role: "anon" }))}.y`)).toBeNull();
    expect(last4("010-1234-5678")).toBe("5678");
    expect(last4(null)).toBeNull();
  });
});
