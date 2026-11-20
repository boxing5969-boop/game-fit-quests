import { describe, expect, it } from "vitest";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { payBillError } from "./payBillError";

const http = (status: number, body?: unknown) =>
  new FunctionsHttpError(new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("결제 링크 오류 → 화면 말 (2026-11-20)", () => {
  it("서버가 쓴 말과 까닭을 그대로", async () => {
    expect(await payBillError(http(400, { error: "시작일은 11월 20일부터 12월 20일까지 고를 수 있어요.", code: "START_DATE" }))).toEqual({
      message: "시작일은 11월 20일부터 12월 20일까지 고를 수 있어요.",
      code: "START_DATE",
    });
    expect(await payBillError(http(400, { error: "이번 결제에는 마일리지를 최대 54,000점까지 쓸 수 있어요." }))).toEqual({
      message: "이번 결제에는 마일리지를 최대 54,000점까지 쓸 수 있어요.",
      code: null,
    });
  });
  it("본문이 없으면 — 로그인 만료 · 그 밖은 잠시 뒤", async () => {
    expect((await payBillError(http(401))).message).toBe("다시 로그인해 주세요.");
    expect((await payBillError(http(502, "html"))).message).toBe("결제 링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    expect((await payBillError(new FunctionsRelayError({}))).message).toBe("결제 링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  });
  it("함수까지 못 감 — 인터넷 연결", async () => {
    expect((await payBillError(new FunctionsFetchError({}))).message).toBe("인터넷 연결을 확인하고 다시 시도해 주세요.");
  });
});
