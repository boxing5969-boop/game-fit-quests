import { afterEach, describe, expect, it } from "vitest";
import { __scrollLockCount, lockBodyScroll } from "./scrollLock";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("lockBodyScroll — 창이 겹쳐도 마지막 창이 닫힐 때만 푼다", () => {
  it("창 하나: 열면 잠기고 닫으면 풀린다", () => {
    const unlock = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    unlock();
    expect(document.body.style.overflow).toBe("");
    expect(__scrollLockCount()).toBe(0);
  });

  it("지금 운동 중 전체화면 → 회원 카드: 카드를 닫아도 잠금 유지, 전체화면까지 닫으면 풀린다", () => {
    const full = lockBodyScroll();
    const card = lockBodyScroll();
    card();
    expect(document.body.style.overflow).toBe("hidden");
    full();
    expect(document.body.style.overflow).toBe("");
  });

  it("다시 그려질 때처럼 풀고 다시 잠그기를 섞어도 다 닫으면 풀린다", () => {
    let full = lockBodyScroll();
    let card = lockBodyScroll();
    // 같은 순간에 둘 다 다시 걸림 (예전 방식에서 'hidden' 을 원래 값으로 잘못 기억하던 순서)
    full();
    card();
    full = lockBodyScroll();
    card = lockBodyScroll();
    card();
    full();
    expect(document.body.style.overflow).toBe("");
    expect(__scrollLockCount()).toBe(0);
  });

  it("같은 풀기를 두 번 불러도 한 번만 센다", () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    a();
    expect(document.body.style.overflow).toBe("hidden");
    b();
    expect(document.body.style.overflow).toBe("");
  });

  it("예전 방식이 남긴 hidden 은 다 닫을 때 풀린다", () => {
    document.body.style.overflow = "hidden";
    const unlock = lockBodyScroll();
    unlock();
    expect(document.body.style.overflow).toBe("");
  });
});
