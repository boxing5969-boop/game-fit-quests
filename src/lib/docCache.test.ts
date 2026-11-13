import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leaveApp, refreshDocCache, rememberDocCache, resetDocCacheForTest } from "./docCache";

type FetchArgs = [string, RequestInit | undefined];

const okFetch = () =>
  vi.fn((..._args: FetchArgs) => Promise.resolve(new Response("<!doctype html>", { status: 200 })));

describe("뒤로가기 흰 화면 막기 — HTML 사본 새로 받기 (2026-11-13)", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetDocCacheForTest();
    window.history.replaceState(null, "", "/home");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("지금 주소를 캐시를 건너뛰고(reload) 같은 출처로 받는다", async () => {
    const f = okFetch();
    globalThis.fetch = f as unknown as typeof fetch;
    window.history.replaceState(null, "", "/office?tab=plan");
    await refreshDocCache();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/office?tab=plan");
    expect(init?.cache).toBe("reload");
    expect(init?.credentials).toBe("same-origin");
  });

  it("TV · 키오스크 · 바깥 주소는 받지 않는다", async () => {
    const f = okFetch();
    globalThis.fetch = f as unknown as typeof fetch;
    await refreshDocCache("/tv/선릉역점/1?k=abc");
    await refreshDocCache("/live-board/선릉역점");
    await refreshDocCache("/face-kiosk");
    await refreshDocCache("//evil.example/home");
    await refreshDocCache("https://evil.example/home");
    expect(f).not.toHaveBeenCalled();
  });

  it("인터넷이 끊겨도 조용히 끝난다", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch;
    await expect(refreshDocCache("/home")).resolves.toBeUndefined();
  });

  it("오래 걸리면 시간 안에 끊고 끝난다", async () => {
    vi.useFakeTimers();
    let aborted = false;
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            rej(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const p = refreshDocCache("/home", 1500);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBeUndefined();
    expect(aborted).toBe(true);
  });

  it("화면을 옮길 때는 주소마다 한 번만 받는다", async () => {
    vi.useFakeTimers();
    const f = okFetch();
    globalThis.fetch = f as unknown as typeof fetch;
    rememberDocCache("/home");
    rememberDocCache("/home"); // 받는 중 — 또 안 받음
    await vi.advanceTimersByTimeAsync(3500);
    rememberDocCache("/home"); // 받았음 — 또 안 받음
    rememberDocCache("/missions");
    await vi.advanceTimersByTimeAsync(3500);
    expect(f.mock.calls.map((c) => c[0])).toEqual(["/home", "/missions"]);
  });

  it("받다가 실패한 주소는 다음 이동 때 다시 받는다", async () => {
    vi.useFakeTimers();
    const f = vi.fn((..._args: FetchArgs) => Promise.resolve(new Response("x", { status: 503 })));
    globalThis.fetch = f as unknown as typeof fetch;
    rememberDocCache("/home");
    await vi.advanceTimersByTimeAsync(3500);
    rememberDocCache("/home");
    await vi.advanceTimersByTimeAsync(3500);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("앱 밖으로 나갈 때는 지금 주소를 받은 뒤에 나간다", async () => {
    const order: string[] = [];
    globalThis.fetch = vi.fn((url: string) => {
      order.push(`fetch ${url}`);
      return Promise.resolve(new Response("<!doctype html>", { status: 200 }));
    }) as unknown as typeof fetch;
    const assign = vi.fn((u: string) => order.push(`assign ${u}`));
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/home", search: "", assign },
    });
    try {
      await leaveApp("/goods/fleece/?from=app");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
    expect(order).toEqual(["fetch /home", "assign /goods/fleece/?from=app"]);
  });

  it("받지 못해도 앱 밖으로는 나간다", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch;
    const assign = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/home", search: "", assign },
    });
    try {
      await leaveApp("/goods/fleece/?from=app");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
    expect(assign).toHaveBeenCalledWith("/goods/fleece/?from=app");
  });
});
