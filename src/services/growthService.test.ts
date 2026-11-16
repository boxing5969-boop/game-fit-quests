import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { growthHearts, markGrowth, resetGrowthServiceForTest } from "./growthService";

const LESSON = { id: "ox-ring-square", from: "2026-11-17" };
const answer = (hearts: number | null = null, ok = true) => ({ data: { ok, hearts }, error: null });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(answer());
  resetGrowthServiceForTest();
});

describe("오늘의 1분 성장 — 서버 읽음 기록 (보이지 않게)", () => {
  it("글 이름 · 글의 날 · 종류를 보낸다", async () => {
    await markGrowth(LESSON, "open");
    expect(rpc).toHaveBeenCalledWith("growth_mark", {
      p_lesson: "ox-ring-square",
      p_date: "2026-11-17",
      p_kind: "open",
      p_pick: null,
      p_right: null,
    });
    await markGrowth(LESSON, "quiz", { pick: "X", right: true });
    expect(rpc).toHaveBeenLastCalledWith("growth_mark", expect.objectContaining({ p_kind: "quiz", p_pick: "X", p_right: true }));
  });

  it("열기 · O/X · 약속은 글마다 이번 접속에 한 번, 좋아요는 누를 때마다", async () => {
    await markGrowth(LESSON, "open");
    await markGrowth(LESSON, "open");
    await markGrowth(LESSON, "act");
    await markGrowth(LESSON, "act");
    expect(rpc).toHaveBeenCalledTimes(2);
    // 다른 글은 따로
    await markGrowth({ id: "jab-return", from: "2026-11-18" }, "open");
    expect(rpc).toHaveBeenCalledTimes(3);
    await markGrowth(LESSON, "heart_on");
    await markGrowth(LESSON, "heart_off");
    await markGrowth(LESSON, "heart_on");
    expect(rpc).toHaveBeenCalledTimes(6);
  });

  it("함수가 없는 서버면 이번 접속 동안 다시 부르지 않는다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.growth_mark" } });
    expect(await markGrowth(LESSON, "open")).toBeNull();
    await markGrowth(LESSON, "heart_on");
    await markGrowth({ id: "jab-return", from: "2026-11-18" }, "open");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("못 남겼으면(다른 오류 · 끊김) 다음에 다시 보낸다 — 화면에는 아무 일도 없다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    await expect(markGrowth(LESSON, "open")).resolves.toBeNull();
    await markGrowth(LESSON, "open");
    expect(rpc).toHaveBeenCalledTimes(2);

    rpc.mockRejectedValueOnce(new Error("network"));
    await expect(markGrowth(LESSON, "act")).resolves.toBeNull();
    await markGrowth(LESSON, "act");
    expect(rpc).toHaveBeenCalledTimes(4);
  });
});

describe("오늘의 1분 성장 — (2단계) 읽은 날 · 누적 도장 알림", () => {
  const hooks = () => ({ onReadDay: vi.fn(), onStamp: vi.fn() });

  it("오늘이 읽은 날로 남으면 그날 한 번만 알린다 — 다른 글 · 다른 종류로 또 남겨도", async () => {
    const h = hooks();
    await markGrowth(LESSON, "open", undefined, h);
    await markGrowth(LESSON, "act", undefined, h);
    await markGrowth({ id: "jab-return", from: "2026-11-18" }, "open", undefined, h);
    await markGrowth(LESSON, "heart_on", undefined, h);
    expect(h.onReadDay).toHaveBeenCalledTimes(1);
    expect(h.onStamp).not.toHaveBeenCalled();
  });

  it("좋아요 취소 · 못 남긴 것 · 서버가 받지 않은 답은 읽은 날이 아니다", async () => {
    const h = hooks();
    await markGrowth(LESSON, "heart_off", undefined, h);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    await markGrowth(LESSON, "open", undefined, h);
    rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await markGrowth(LESSON, "open", undefined, h);
    expect(h.onReadDay).not.toHaveBeenCalled();
    // 그다음에 남으면 그때 알린다
    await markGrowth(LESSON, "act", undefined, h);
    expect(h.onReadDay).toHaveBeenCalledTimes(1);
  });

  it("서버가 도장(stamp)을 보내면 그 숫자를 알린다 — 숫자가 아니면 알리지 않는다", async () => {
    const h = hooks();
    rpc.mockResolvedValueOnce({ data: { ok: true, hearts: null, stamp: 10 }, error: null });
    await markGrowth(LESSON, "open", undefined, h);
    expect(h.onStamp).toHaveBeenCalledWith(10);
    rpc.mockResolvedValueOnce({ data: { ok: true, hearts: null, stamp: "30" }, error: null });
    await markGrowth(LESSON, "act", undefined, h);
    rpc.mockResolvedValueOnce({ data: { ok: true, hearts: null, stamp: null }, error: null });
    await markGrowth(LESSON, "heart_on", undefined, h);
    expect(h.onStamp).toHaveBeenCalledTimes(1);
  });

  it("알림 받는 곳이 없어도(1단계 그대로) 아무 일 없다", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, hearts: null, stamp: 10 }, error: null });
    await expect(markGrowth(LESSON, "open")).resolves.toBeNull();
  });
});

describe("오늘의 1분 성장 — 좋아요 수 (5명이 넘을 때만)", () => {
  it("서버가 숫자를 보내면 돌려주고, 이번 접속 동안 기억한다", async () => {
    rpc.mockResolvedValueOnce(answer(12));
    expect(await markGrowth(LESSON, "open")).toBe(12);
    expect(growthHearts("ox-ring-square")).toBe(12);
    // 이미 보낸 열기는 다시 부르지 않고 아는 숫자를 돌려준다
    expect(await markGrowth(LESSON, "open")).toBe(12);
    expect(rpc).toHaveBeenCalledTimes(1);
    // 좋아요를 누르면 새 숫자로
    rpc.mockResolvedValueOnce(answer(13));
    expect(await markGrowth(LESSON, "heart_on")).toBe(13);
    // 다른 글은 따로
    expect(growthHearts("jab-return")).toBeNull();
  });

  it("5명이 넘지 않으면 숫자가 없다 — 서버가 실수로 보내도 화면은 안 쓴다", async () => {
    expect(await markGrowth(LESSON, "open")).toBeNull();
    rpc.mockResolvedValueOnce(answer(5));
    expect(await markGrowth(LESSON, "heart_on")).toBeNull();
    rpc.mockResolvedValueOnce(answer(6));
    expect(await markGrowth(LESSON, "heart_on")).toBe(6);
    // 다시 5명 아래로 내려가면 숫자를 지운다
    rpc.mockResolvedValueOnce(answer(null));
    expect(await markGrowth(LESSON, "heart_off")).toBeNull();
  });

  it("서버가 받지 않은 답(ok false)은 아는 숫자를 바꾸지 않는다", async () => {
    rpc.mockResolvedValueOnce(answer(8));
    await markGrowth(LESSON, "open");
    rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    expect(await markGrowth(LESSON, "heart_on")).toBe(8);
  });
});
