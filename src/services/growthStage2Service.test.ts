import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { fetchGrowthCheck, fetchMyGrowth, resetGrowthStage2ServiceForTest } from "./growthStage2Service";

const ON = { on: true, days: 9, next: 10, unseen: null, check_from: "2026-11-18", read: ["2026-11-17"] };

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: ON, error: null });
  resetGrowthStage2ServiceForTest();
});

describe("오늘의 1분 성장 2단계 — 내 읽은 날 읽기", () => {
  it("범위를 주면 그 사이 읽은 날까지 · 로그인 전이면 부르지 않는다", async () => {
    const g = await fetchMyGrowth("u1", "2026-11-16", "2026-11-22");
    expect(rpc).toHaveBeenCalledWith("get_my_growth", { p_from: "2026-11-16", p_to: "2026-11-22" });
    expect([g.on, g.days, g.next, g.checkFrom, [...g.read]]).toEqual([true, 9, 10, "2026-11-18", ["2026-11-17"]]);
    await fetchMyGrowth("u1");
    expect(rpc).toHaveBeenLastCalledWith("get_my_growth", { p_from: null, p_to: null });
    expect((await fetchMyGrowth(null)).on).toBe(false);
    expect((await fetchMyGrowth(undefined)).on).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("함수가 없는 서버(적용 전 · 옛 DB 미리보기)면 이번 접속 동안 다시 부르지 않는다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.get_my_growth" } });
    expect((await fetchMyGrowth("u1")).on).toBe(false);
    expect((await fetchMyGrowth("u1", "2026-11-16", "2026-11-22")).on).toBe(false);
    expect((await fetchMyGrowth("u2")).on).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("켠 지점 회원이 아닌 계정은 한 번만 묻는다 — 운동 달력이 범위마다 다시 묻지 않게 (다른 계정은 따로)", async () => {
    rpc.mockResolvedValueOnce({ data: { on: false }, error: null });
    expect((await fetchMyGrowth("staff")).on).toBe(false);
    expect((await fetchMyGrowth("staff", "2026-11-01", "2026-11-30")).on).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((await fetchMyGrowth("u1")).on).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("다른 오류 · 끊김이면 꺼진 값 — 다음에 다시 묻는다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    expect((await fetchMyGrowth("u1")).on).toBe(false);
    rpc.mockRejectedValueOnce(new Error("network"));
    expect((await fetchMyGrowth("u1")).on).toBe(false);
    expect((await fetchMyGrowth("u1")).on).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("운동 달력에 붙일 조각 — 드는 계정만 (첫날이 없거나 꺼진 계정은 null)", async () => {
    const c = await fetchGrowthCheck("u1", "2026-11-16", "2026-11-22");
    expect(c?.from).toBe("2026-11-18");
    expect([...(c?.days ?? [])]).toEqual(["2026-11-17"]);
    rpc.mockResolvedValueOnce({ data: { ...ON, check_from: null }, error: null });
    expect(await fetchGrowthCheck("u1", "2026-11-16", "2026-11-22")).toBeNull();
    rpc.mockResolvedValueOnce({ data: { on: false }, error: null });
    expect(await fetchGrowthCheck("u3", "2026-11-16", "2026-11-22")).toBeNull();
  });
});
