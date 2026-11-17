import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseVideoFixList } from "@/lib/videoFix";

// 카드 시트 안 「영상 고치기」 칸 (2026-11-17) — 서버는 흉내
const actions = { add: vi.fn(), restore: vi.fn(), cancel: vi.fn(), decide: vi.fn() };
vi.mock("@/services/videoFixService", () => ({ useVideoFixActions: () => actions }));
vi.mock("@/services/trainingCardService", () => ({ trainingVideoUrl: (p: string) => Promise.resolve(`https://signed/${p}`) }));
vi.mock("@/components/common/VideoOverlay", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import VideoFixPanel from "./VideoFixPanel";

const DATA = parseVideoFixList({
  can_edit: true,
  fixes: [
    {
      id: "f1",
      card_id: "c1",
      card_name: "어퍼컷",
      at_sec: 4,
      motion: "훅",
      cat: "motion",
      body: "이 영상은 훅이에요",
      held: true,
      held_video_path: "member/a.mp4",
      held_poster_path: null,
      state: "doing",
      reply: "",
      by_name: "대표님",
      created_at: "2026-11-17T02:00:00Z",
    },
    { id: "f2", card_id: "c1", at_sec: 9, motion: "", cat: "sound", body: "음악 작게", held: false, state: "requested", created_at: "2026-11-17T02:01:00Z" },
  ],
  candidates: [{ id: "v1", card_id: "c1", video_path: "member/new.mp4", poster_path: null, note: "원본에서 어퍼컷 구간으로", fix_ids: ["f1"], state: "review" }],
});

const renderPanel = (hasVideo = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VideoFixPanel cardId="c1" cardName="어퍼컷" hasVideo={hasVideo} data={DATA} getTime={() => 12.7} pauseVideo={vi.fn()} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  for (const f of Object.values(actions)) f.mockReset().mockResolvedValue({ held: false });
});

describe("영상 고치기 칸", () => {
  it("새 영상 · 숨긴 영상 · 보낸 요청이 보이고, 이대로 붙이기", async () => {
    renderPanel();
    expect(screen.getByText("새 영상이 왔어요")).toBeTruthy();
    expect(screen.getByText("원본에서 어퍼컷 구간으로")).toBeTruthy();
    expect(screen.getByText("회원에게 숨긴 영상 · 고치는 중")).toBeTruthy();
    expect(screen.getByText("0:04 · 실제 동작 훅 · 이 영상은 훅이에요")).toBeTruthy();
    expect(screen.getByText("0:09 · 소리 · 음악 작게")).toBeTruthy();
    // 보낸 요청(보냈어요)만 그만두기
    expect(screen.getAllByText("그만두기")).toHaveLength(1);
    fireEvent.click(screen.getByText("이대로 붙이기"));
    await waitFor(() => expect(actions.decide).toHaveBeenCalledWith("v1", true, ""));
  });

  it("다시 고쳐 주세요는 한 줄이 있어야 보낸다", async () => {
    renderPanel();
    fireEvent.click(screen.getByText("다시 고쳐 주세요"));
    const send = screen.getAllByText("다시 고쳐 주세요").at(-1)!;
    fireEvent.click(send);
    expect(actions.decide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/처음 2초는 빼 주세요/), { target: { value: "처음 2초는 빼 주세요" } });
    fireEvent.click(screen.getAllByText("다시 고쳐 주세요").at(-1)!);
    await waitFor(() => expect(actions.decide).toHaveBeenCalledWith("v1", false, "처음 2초는 빼 주세요"));
  });

  it("다시 보이기는 카드에 영상이 없을 때만 · 이 장면 고쳐 달라기 → 멈춘 시각으로 창 → 보내기", async () => {
    renderPanel();
    fireEvent.click(screen.getByText("다시 보이기"));
    await waitFor(() => expect(actions.restore).toHaveBeenCalledWith("f1"));

    fireEvent.click(screen.getByText("이 장면 고쳐 달라기"));
    expect(screen.getByText("‘어퍼컷’ · 0:12에서 멈췄어요")).toBeTruthy();
    // 동작이 달라요 — 칩 하나 고르고 보내기
    fireEvent.click(screen.getByRole("button", { name: "훅" }));
    fireEvent.click(screen.getByText("편집팀에 보내기"));
    await waitFor(() =>
      expect(actions.add).toHaveBeenCalledWith(expect.objectContaining({ cardId: "c1", atSec: 12.7, motion: "훅", cat: "motion", hold: false })),
    );
  });

  it("카드에 영상이 있으면 숨기기가 기본으로 켜져 같이 간다 · 빈 글은 막힌다", async () => {
    renderPanel(true);
    expect(screen.queryByText("다시 보이기")).toBeNull();
    fireEvent.click(screen.getByText("이 장면 고쳐 달라기"));
    fireEvent.click(screen.getByText("편집팀에 보내기"));
    expect(screen.getByText("무엇을 고칠지 한 줄 써 주세요")).toBeTruthy();
    expect(actions.add).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/이 영상은 훅이에요/), { target: { value: "이건 훅이에요" } });
    fireEvent.click(screen.getByText("편집팀에 보내기"));
    await waitFor(() => expect(actions.add).toHaveBeenCalledWith(expect.objectContaining({ body: "이건 훅이에요", hold: true })));
  });
});
