// os-app-content 부르기 — 오류를 화면 말로 바꾸기 (2026-11-03 153OS 38단계 검수: 예전엔 모든 오류가 '인터넷 연결')
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const { callOs, OsContentError } = await import("./osContentService");

const httpError = (status: number, body?: unknown) =>
  new FunctionsHttpError(new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

async function codeOf(p: Promise<unknown>): Promise<[string, string]> {
  try { await p; return ["OK", ""]; } catch (e) {
    expect(e).toBeInstanceOf(OsContentError);
    const o = e as InstanceType<typeof OsContentError>;
    return [o.code, o.message];
  }
}

describe("callOs — 오류 말", () => {
  beforeEach(() => invoke.mockReset());

  it("잘 받으면 data · message", async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: [1], message: "됐어요" }, error: null });
    await expect(callOs("notices")).resolves.toEqual({ data: [1], message: "됐어요" });
  });

  it("함수가 ok:false 로 답하면 그 말 그대로", async () => {
    invoke.mockResolvedValue({ data: { ok: false, code: "NOT_REGISTERED", message: "먼저 회원가입이 필요합니다" }, error: null });
    expect(await codeOf(callOs("inquiries"))).toEqual(["NOT_REGISTERED", "먼저 회원가입이 필요합니다"]);
  });

  it("연결이 안 되면(오프라인) 인터넷 연결", async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error("offline")) });
    expect((await codeOf(callOs("notices")))[0]).toBe("NETWORK");
  });

  it("로그인 만료(게이트웨이 401) → 다시 로그인", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(401, { msg: "Invalid JWT" }) });
    expect(await codeOf(callOs("notices"))).toEqual(["NOT_AUTHENTICATED", "다시 로그인해 주세요"]);
  });

  it("2xx 가 아니어도 ok:false 모양이면 그 말", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "잘못된 요청이에요" }) });
    expect(await codeOf(callOs("notices"))).toEqual(["METHOD_NOT_ALLOWED", "잘못된 요청이에요"]);
  });

  it("함수 5xx · 중계 오류 → 잠시 뒤 다시(인터넷 연결 아님)", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(500) });
    expect(await codeOf(callOs("notices"))).toEqual(["OS_UNAVAILABLE", "잠시 뒤 다시 시도해 주세요"]);
    invoke.mockResolvedValue({ data: null, error: new FunctionsRelayError(new Response("", { status: 502 })) });
    expect((await codeOf(callOs("notices")))[0]).toBe("OS_UNAVAILABLE");
  });
});
