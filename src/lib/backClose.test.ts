import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __backCloseLiveCount,
  __resetBackClose,
  backCloseClaims,
  closeBackLayer,
  openBackLayer,
} from "@/lib/backClose";

// jsdom 의 뒤로가기는 한 박자 뒤에 popstate 를 쏜다 — 몇 번 기다린다(빈 칸 건너뛰기는 뒤로가기가 두 번)
const settle = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 15));
};

let idx = 100;
/** 라우터가 화면을 하나 연 것처럼 — state 에 idx(라우터와 같은 모양) */
const routerPush = (path: string) => {
  idx += 1;
  window.history.pushState({ usr: null, key: `k${idx}`, idx }, "", path);
};
const marker = () => (window.history.state as Record<string, unknown> | null)?.__bc ?? null;
const at = () => ({ path: window.location.pathname, idx: (window.history.state as { idx?: number } | null)?.idx, m: marker() });

beforeEach(async () => {
  await settle(2);
  __resetBackClose();
  routerPush("/missions");
  __resetBackClose(); // 지금 칸을 위치로 기억
});

afterEach(async () => {
  await settle(2);
});

describe("뒤로가기 = 창 닫기 (lib/backClose)", () => {
  it("창을 열면 같은 주소로 칸을 얹고, 뒤로가기는 창만 닫는다", async () => {
    const base = at();
    const close = vi.fn();
    const id = openBackLayer(close);
    expect(id).toBeGreaterThan(0);
    expect(at()).toEqual({ path: "/missions", idx: base.idx, m: id });

    window.history.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(__backCloseLiveCount()).toBe(0);
    expect(at()).toEqual(base); // 화면은 그대로(훈련 탭)

    closeBackLayer(id); // 창이 사라질 때 — 이미 닫혔으니 아무것도 안 한다
    await settle();
    expect(at()).toEqual(base);
  });

  it("단추로 닫으면 얹었던 칸을 걷는다(한 박자 뒤)", async () => {
    const base = at();
    const close = vi.fn();
    const id = openBackLayer(close);
    closeBackLayer(id);
    expect(marker()).toBe(id); // 아직 — 같은 순간 화면 이동이 있을 수 있어 기다린다
    await settle();
    expect(at()).toEqual(base);
    expect(close).not.toHaveBeenCalled();
  });

  it("닫으면서 다른 화면으로 이동했으면 걷지 않는다 — 나중 뒤로가기가 빈 칸을 건너뛴다", async () => {
    const base = at();
    const id = openBackLayer(vi.fn());
    closeBackLayer(id);
    routerPush("/level"); // 같은 순간 navigate
    await settle();
    expect(at().path).toBe("/level"); // 이동이 그대로 남았다

    window.history.back(); // /level → (빈 칸) → /missions
    await settle();
    expect(at()).toEqual(base);
  });

  it("닫자마자 다른 창을 열면 칸을 이어받는다 — 칸이 쌓이지 않는다", async () => {
    const base = at();
    const a = openBackLayer(vi.fn());
    const len = window.history.length;
    closeBackLayer(a);
    const closeB = vi.fn();
    const b = openBackLayer(closeB);
    expect(window.history.length).toBe(len);
    expect(marker()).toBe(b);
    await settle();
    expect(marker()).toBe(b); // 걷기는 취소됐다

    window.history.back();
    await settle();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(at()).toEqual(base);
  });

  it("겹친 창은 맨 위부터 하나씩 닫힌다", async () => {
    const base = at();
    const closeA = vi.fn();
    const closeB = vi.fn();
    openBackLayer(closeA);
    const b = openBackLayer(closeB);
    expect(marker()).toBe(b);

    window.history.back();
    await settle();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();

    window.history.back();
    await settle();
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(at()).toEqual(base);
  });

  it("아래 창과 위 창이 함께 사라지면(부모 시트가 닫힘) 두 칸 다 걷힌다", async () => {
    const base = at();
    const a = openBackLayer(vi.fn());
    const b = openBackLayer(vi.fn());
    closeBackLayer(a); // React 는 부모 정리를 먼저 부른다
    closeBackLayer(b);
    await settle(8);
    expect(at()).toEqual(base);
    expect(__backCloseLiveCount()).toBe(0);
  });

  it("위 창 정리가 먼저 불려도 같다", async () => {
    const base = at();
    const a = openBackLayer(vi.fn());
    const b = openBackLayer(vi.fn());
    closeBackLayer(b);
    closeBackLayer(a);
    await settle(8);
    expect(at()).toEqual(base);
  });

  it("앞으로가기로 들어온 빈 칸은 건너뛰지 않는다", async () => {
    const id = openBackLayer(vi.fn());
    closeBackLayer(id);
    routerPush("/level"); // 빈 칸이 /level 밑에 남는다
    await settle();
    window.history.back(); // 빈 칸을 건너뛰어 /missions 바닥까지
    await settle();
    const base = at();
    expect(base.m).toBeNull();

    window.history.forward(); // 바닥 → 빈 칸(앞으로) — 그대로 둔다
    await settle();
    expect(at().m).toBe(id);
    expect(at().path).toBe("/missions");
    window.history.forward(); // 한 번 더 앞으로 → /level
    await settle();
    expect(at().path).toBe("/level");
  });

  it("창이 그대로 열려 있는 동안 다른 칸이 얹혀도(주소 바꾸기) 뒤로가기 한 번에 그 칸만 빠진다", async () => {
    const close = vi.fn();
    const id = openBackLayer(close);
    routerPush("/missions?shelf=step"); // 창 안에서 주소만 바뀜 — 창은 그대로
    window.history.back();
    await settle();
    expect(marker()).toBe(id);
    expect(close).not.toHaveBeenCalled();
    window.history.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("backCloseClaims — 창을 닫는 popstate 인지 (종료 확인이 묻기 전에)", async () => {
    const seen: boolean[] = [];
    const early = (e: Event) => seen.push(backCloseClaims(e));
    window.addEventListener("popstate", early);
    try {
      openBackLayer(vi.fn());
      window.history.back(); // 창을 닫는 뒤로가기
      await settle();
      routerPush("/home");
      window.history.back(); // 창 없는 평범한 뒤로가기
      await settle();
    } finally {
      window.removeEventListener("popstate", early);
    }
    expect(seen).toEqual([true, false]);
  });
});
