import { describe, expect, it } from "vitest";
import { LINK_TICKET_TTL_MS, signLinkTicket, verifyLinkTicket } from "../../supabase/functions/_shared/linkTicket";

const SECRET = "test-secret";
const UID = "1530c4d0-0001-4a00-8000-000000001122";

describe("기존 회원 이어받기 표", () => {
  it("만든 표는 같은 비밀값으로 풀린다", async () => {
    const t = await signLinkTicket(SECRET, "01012345678", UID, 1_000);
    const v = await verifyLinkTicket(SECRET, t, 2_000);
    expect(v).toEqual({ p: "01012345678", u: UID, e: 1_000 + LINK_TICKET_TTL_MS });
  });
  it("10분이 지나면 못 쓴다", async () => {
    const t = await signLinkTicket(SECRET, "01012345678", UID, 0);
    expect(await verifyLinkTicket(SECRET, t, LINK_TICKET_TTL_MS + 1)).toBeNull();
  });
  it("다른 비밀값 · 바꾼 내용 · 이상한 모양은 거른다", async () => {
    const t = await signLinkTicket(SECRET, "01012345678", UID, 0);
    expect(await verifyLinkTicket("other", t, 1)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ p: "01099998888", u: UID, e: 9e15 })).replace(/=+$/, "");
    expect(await verifyLinkTicket(SECRET, `${forged}.${sig}`, 1)).toBeNull();
    expect(await verifyLinkTicket(SECRET, body, 1)).toBeNull();
    expect(await verifyLinkTicket(SECRET, 123, 1)).toBeNull();
    expect(await verifyLinkTicket(SECRET, "a.b.c", 1)).toBeNull();
  });
  it("로그인한 사람에게 준 표는 그 계정(c)을 담고, 모양이 틀린 c 는 거른다", async () => {
    const CALLER = "1530c4d0-0002-4a00-8000-000000003344";
    const t = await signLinkTicket(SECRET, "01012345678", UID, 1_000, CALLER);
    expect(await verifyLinkTicket(SECRET, t, 2_000)).toEqual({ p: "01012345678", u: UID, e: 1_000 + LINK_TICKET_TTL_MS, c: CALLER });
    const plain = await signLinkTicket(SECRET, "01012345678", UID, 1_000, null);
    expect(await verifyLinkTicket(SECRET, plain, 2_000)).toEqual({ p: "01012345678", u: UID, e: 1_000 + LINK_TICKET_TTL_MS });
    expect(await verifyLinkTicket(SECRET, await signLinkTicket(SECRET, "01012345678", UID, 0, "not-a-uuid"), 1)).toBeNull();
  });
  it("번호 · 계정 모양이 틀리면 서명이 맞아도 거른다", async () => {
    expect(await verifyLinkTicket(SECRET, await signLinkTicket(SECRET, "12345", UID, 0), 1)).toBeNull();
    expect(await verifyLinkTicket(SECRET, await signLinkTicket(SECRET, "01012345678", "x", 0), 1)).toBeNull();
  });
});
