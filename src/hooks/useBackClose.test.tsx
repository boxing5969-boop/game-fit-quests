import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBackClose } from "@/hooks/useBackClose";

const settle = async (n = 4) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
};

const marker = () => (window.history.state as Record<string, unknown> | null)?.__bc ?? null;

/** 영상 창 — 열기 · 닫기 단추 */
function VideoScreen() {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>영상 열기</button>
      {open && (
        <div role="dialog">
          영상
          <button type="button" onClick={() => setOpen(false)}>닫기</button>
        </div>
      )}
    </div>
  );
}

/** 닫기를 불러도 바로 안 닫히는 창 — 내 수업 재생(1분 넘으면 끝 화면) */
function PlayerScreen() {
  const [phase, setPhase] = useState<"off" | "run" | "done">("off");
  useBackClose(phase !== "off", () => setPhase((p) => (p === "run" ? "done" : "off")));
  return (
    <div>
      <button type="button" onClick={() => setPhase("run")}>재생</button>
      {phase !== "off" && <div role="dialog">{phase === "run" ? "재생 중" : "끝 화면"}</div>}
    </div>
  );
}

describe("useBackClose", () => {
  it("뒤로가기는 창을 닫고 화면은 그대로 · 닫기 단추는 칸을 걷는다", async () => {
    window.history.replaceState({ usr: null, key: "a", idx: 3 }, "", "/missions");
    render(<VideoScreen />);

    fireEvent.click(screen.getByText("영상 열기"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(marker()).not.toBeNull();

    await act(async () => {
      window.history.back();
    });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.pathname).toBe("/missions");
    expect(marker()).toBeNull();

    // 다시 열고 단추로 닫기 → 얹었던 칸이 걷혀 바닥 칸으로
    fireEvent.click(screen.getByText("영상 열기"));
    const len = window.history.length;
    expect(marker()).not.toBeNull();
    fireEvent.click(screen.getByText("닫기"));
    await settle();
    expect(marker()).toBeNull();
    expect((window.history.state as { idx?: number }).idx).toBe(3);
    expect(window.history.length).toBe(len); // 앞 칸은 남아도(브라우저 기록) 지금 칸은 바닥
  });

  it("닫기를 불러도 창이 그대로면 칸을 다시 얹는다 — 다음 뒤로가기도 창을 닫는다", async () => {
    window.history.replaceState({ usr: null, key: "b", idx: 7 }, "", "/missions");
    render(<PlayerScreen />);
    fireEvent.click(screen.getByText("재생"));
    expect(screen.getByText("재생 중")).toBeInTheDocument();

    await act(async () => {
      window.history.back();
    });
    await settle();
    expect(screen.getByText("끝 화면")).toBeInTheDocument();
    expect(marker()).not.toBeNull(); // 다시 얹었다

    await act(async () => {
      window.history.back();
    });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(marker()).toBeNull();
    expect(window.location.pathname).toBe("/missions");
  });
});
