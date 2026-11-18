import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoPlayer from "@/components/VideoPlayer";

// 레벨 미션 · 153 PB 영상 플레이어의 2컷 동작 그림 (2026-11-18 대표님 「모든 동작은 영상 밑에 이미지 소개글」)
//   영상 → (버전 칸 · 재생 단추) → 동작 그림 → 설명 → 핵심 포인트
const ILLUST = "/assets/learn-illust/2d305d98-107b-4a6a-a1cd-43c7f7fd7598.webp";
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const open = (extra: Partial<Parameters<typeof VideoPlayer>[0]> = {}) =>
  render(
    <VideoPlayer
      videoUrl="/test153/pb3.mp4"
      title="제자리 스텝"
      keyPoints={["발 간격은 어깨보다 조금 넓게", "", "다리 밸런스가 깨지지 않게"]}
      description="거울 앞에서 대각선으로 서서 위아래로 가볍게 뛰어요."
      onClose={vi.fn()}
      {...extra}
    />,
  );

describe("영상 플레이어 — 영상 → 동작 그림 → 설명", () => {
  it("그림이 있으면 영상 아래 · 설명 위에 한 장", () => {
    open({ illustration: ILLUST });
    const pic = screen.getByAltText("제자리 스텝 동작 그림");
    expect(pic).toHaveAttribute("src", ILLUST);
    const video = document.querySelector("video")!;
    expect(before(video, pic)).toBe(true);
    // 재생 · 속도 단추 줄보다도 아래
    expect(before(screen.getByText("1x"), pic)).toBe(true);
    expect(before(pic, screen.getByText(/거울 앞에서 대각선으로/))).toBe(true);
    expect(before(pic, screen.getByText("💡 핵심 포인트"))).toBe(true);
    expect(screen.getAllByAltText("제자리 스텝 동작 그림")).toHaveLength(1);
  });

  it("유튜브 영상(퍼가기)도 같은 자리", () => {
    open({ videoUrl: "https://youtu.be/SbtjOrbVQTs", illustration: ILLUST, description: undefined });
    const pic = screen.getByAltText("제자리 스텝 동작 그림");
    expect(before(document.querySelector("iframe")!, pic)).toBe(true);
    expect(before(pic, screen.getByText("💡 핵심 포인트"))).toBe(true);
  });

  it("그림이 없으면 그림 자리 없이 예전 그대로", () => {
    open();
    expect(screen.queryByAltText(/동작 그림/)).toBeNull();
    expect(screen.getByText(/거울 앞에서 대각선으로/)).toBeInTheDocument();
  });

  it("그림을 못 불러오면 자리째 감춤", () => {
    open({ illustration: "/assets/learn-illust/none.webp" });
    fireEvent.error(screen.getByAltText("제자리 스텝 동작 그림"));
    expect(screen.queryByAltText("제자리 스텝 동작 그림")).toBeNull();
  });
});
