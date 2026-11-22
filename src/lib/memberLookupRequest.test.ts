import { describe, expect, it } from "vitest";
import { isValidBirth, memberViewOf, parseCreate, FOUND_VALID_DAYS } from "../../supabase/functions/member-lookup-request/logic";
import { lookupStatusLabel, normalizeLookupCandidates, normalizeLookupRequests } from "./memberLookupRequests";
import { clearLookupRequest, peekLookupRequest, requestStatusOf, saveLookupRequest } from "./memberEntry";

describe("확인 요청 받기 검사(서버)", () => {
  it("다듬어서 받는다", () => {
    const r = parseCreate({ name: "  홍  길동 ", phone: "010-1234-5678", birthDate: "1999-03-15", branch: "153복싱짐 선릉역점", memo: "  예전   번호 " });
    expect(r).toEqual({ ok: true, v: { name: "홍 길동", phone: "01012345678", birth: "19990315", branch: "153복싱짐 선릉역점", memo: "예전 번호" } });
  });
  it("생년월일 · 남길 말은 비워도 된다", () => {
    const r = parseCreate({ name: "홍길동", phone: "01012345678", branch: "153복싱짐 칠금점" });
    expect(r.ok && r.v.birth === null && r.v.memo === null).toBe(true);
  });
  it("틀린 값은 말로 막는다", () => {
    expect(parseCreate({ name: "", phone: "01012345678", branch: "x" })).toMatchObject({ ok: false });
    expect(parseCreate({ name: "a", phone: "1234", branch: "x" })).toMatchObject({ ok: false });
    expect(parseCreate({ name: "a", phone: "01012345678", birthDate: "19990230", branch: "x" })).toMatchObject({ ok: false });
    expect(parseCreate({ name: "a", phone: "01012345678", branch: "" })).toMatchObject({ ok: false });
    expect(parseCreate({ name: "a", phone: "01012345678", branch: "x", memo: "가".repeat(201) })).toMatchObject({ ok: false });
  });
  it("있는 날짜만", () => {
    expect(isValidBirth("20000229")).toBe(true);
    expect(isValidBirth("19990229")).toBe(false);
    expect(isValidBirth("18991231")).toBe(false);
  });
});

describe("회원 기기에 보일 상태", () => {
  const now = Date.UTC(2026, 10, 22);
  it("연결 · 7일 · 이미 이어받음", () => {
    expect(memberViewOf("pending", null, null, now)).toBe("pending");
    expect(memberViewOf("found", now - 86_400_000, true, now)).toBe("found");
    expect(memberViewOf("found", now - (FOUND_VALID_DAYS + 1) * 86_400_000, true, now)).toBe("expired");
    expect(memberViewOf("found", now, false, now)).toBe("done");
    expect(memberViewOf("not_member", now, null, now)).toBe("not_member");
    expect(memberViewOf("closed", now, null, now)).toBe("closed");
  });
});

describe("이 기기의 확인 요청", () => {
  it("두고 · 읽고 · 30일 뒤 잊는다", () => {
    localStorage.clear();
    saveLookupRequest({ key: "abc", name: "홍길동", branch: "b" }, 1000);
    expect(peekLookupRequest(2000)?.key).toBe("abc");
    expect(peekLookupRequest(1000 + 31 * 86_400_000)).toBeNull();
    saveLookupRequest({ key: "abc", name: "홍길동", branch: "b" });
    clearLookupRequest();
    expect(peekLookupRequest()).toBeNull();
  });
  it("모르는 상태는 error", () => {
    expect(requestStatusOf({ status: "found" })).toBe("found");
    expect(requestStatusOf({ status: "weird" })).toBe("error");
    expect(requestStatusOf(null)).toBe("error");
  });
});

describe("운영진 화면 값 다듬기", () => {
  it("모양이 틀린 줄은 버리고 후보는 점수 순", () => {
    const rows = normalizeLookupRequests([
      { id: "1", created_at: "2026-11-22T00:00:00Z", status: "pending", name: "홍길동", phone: "01012345678" },
      { id: "2", status: "pending" },
      { id: "3", created_at: "2026-11-22T00:00:00Z", status: "weird" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["1"]);
    const c = normalizeLookupCandidates([{ user_id: "a", score: 2 }, { user_id: "b", score: 6 }, { score: 9 }]);
    expect(c.map((x) => x.userId)).toEqual(["b", "a"]);
    expect(lookupStatusLabel({ status: "found", targetName: "홍길동" })).toBe("홍길동님으로 연결");
  });
});
