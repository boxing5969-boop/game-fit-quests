import { describe, expect, it, vi } from "vitest";
import { initBackExit } from "@/lib/androidBackExit";
import { closeBackLayer, openBackLayer } from "@/lib/backClose";

const settle = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 15));
};

describe("홈의 종료 확인 × 뒤로가기 = 창 닫기", () => {
  it("홈에서 열린 창을 닫는 뒤로가기에는 '종료할까요?'를 묻지 않고, 창이 없을 때만 묻는다", async () => {
    window.history.replaceState({ usr: null, key: "k0", idx: 0 }, "", "/");
    const ask = vi.fn();
    initBackExit(ask, ["/"]); // 홈 칸 위에 표시 칸을 얹는다(종료 확인 손잡이가 먼저 등록된다)

    // 다른 화면에 갔다가 라우터로 홈에 다시 온 경우 — 이 홈 칸에는 종료 확인 표시가 없다
    window.history.pushState({ usr: null, key: "k1", idx: 1 }, "", "/missions");
    window.history.pushState({ usr: null, key: "k2", idx: 2 }, "", "/");

    const close = vi.fn();
    openBackLayer(close); // 홈 '다음 레벨까지' 영상 같은 창
    window.history.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(ask).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");

    // 창을 단추로 닫아 칸을 걷을 때도 묻지 않는다
    const id = openBackLayer(vi.fn());
    closeBackLayer(id);
    await settle();
    expect(ask).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");

    // 창이 없을 때의 평범한 뒤로가기는 예전 그대로 — 홈이 아닌 화면으로 가면 묻지 않는다
    window.history.back();
    await settle();
    expect(window.location.pathname).toBe("/missions");
    expect(ask).not.toHaveBeenCalled();
  });
});
