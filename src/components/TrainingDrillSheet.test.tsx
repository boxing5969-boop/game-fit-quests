import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingCard } from "@/lib/trainingCards";

// 카드 시트의 소리 (2026-11-16 대표님 「자연스러운 더빙 기본값 · 설명 듣기 자동 · 버튼처럼」) — 서버 · 휴대폰 소리는 흉내
const videoUrl = { current: null as string | null };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ role: "member", profile: null, progress: { current_rank: "white", current_level: 3 }, user: { id: "u1" } }),
}));
vi.mock("@/services/trainingCardService", () => ({
  useTrainingCards: () => ({ data: undefined }),
  useCardVideo: (_c: unknown, who: string) => ({ data: who === "member" ? videoUrl.current : null, isLoading: false }),
  useCardPosters: () => () => null,
}));
vi.mock("@/services/shelfLayoutService", () => ({ logCardEvent: vi.fn() }));
vi.mock("@/services/cardReactService", () => ({ useCardSocial: () => ({ data: undefined }) }));
vi.mock("@/components/common/VideoOverlay", () => ({ default: () => null }));
vi.mock("@/components/training/react/CardReact", () => ({ CardHeartButton: () => null, CardReactSection: () => null }));
vi.mock("@/features/myboxer-visualization/mindAudio", () => ({
  pickKoreanVoice: () => Promise.resolve(null),
  speak: () => ({ done: new Promise(() => undefined), cancel: () => undefined }),
  stopSpeech: () => undefined,
}));
const clip = vi.fn();
vi.mock("@/lib/cardVoice", () => ({ cardVoiceUrl: () => "/voice/cards/test.mp3" }));
vi.mock("@/lib/learnAudio", async (orig) => {
  const real = await orig<typeof import("@/lib/learnAudio")>();
  return {
    ...real,
    primeLearnAudio: () => undefined,
    stopVoiceClip: () => undefined,
    playVoiceClip: (url: string) => {
      clip(url);
      return { done: new Promise(() => undefined), cancel: () => undefined };
    },
  };
});

import TrainingDrillSheet from "./TrainingDrillSheet";

const card = (extra: Partial<TrainingCard> = {}): TrainingCard => ({
  id: "9fec2574-5132-4d6d-bdc7-09c6c635e5fe",
  category: "기본기",
  name: "잽",
  summary: "앞손을 곧게",
  description: "",
  benefits: "",
  target: "",
  difficulty: "초급",
  cues: ["턱은 당겨요"],
  mistakes: [],
  level_min: 1,
  sort_order: 1,
  image_url: null,
  video_url: null,
  is_active: true,
  video_path: null,
  coach_video_path: null,
  poster_path: null,
  minutes: null,
  equipment: null,
  ...extra,
});

let play: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  clip.mockClear();
  window.sessionStorage.clear();
  videoUrl.current = null;
  play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
});

const video = () => document.querySelector("video") as HTMLVideoElement;
/** 영상 정보가 왔다 — 목소리 트랙 수 · 크기 */
const meta = (tracks: number, w = 1920, h = 1080) => {
  const v = video();
  Object.defineProperty(v, "readyState", { configurable: true, value: 1 });
  Object.defineProperty(v, "audioTracks", { configurable: true, value: { length: tracks } });
  Object.defineProperty(v, "videoWidth", { configurable: true, value: w });
  Object.defineProperty(v, "videoHeight", { configurable: true, value: h });
  act(() => {
    fireEvent.loadedMetadata(v);
  });
};

describe("카드 시트 — 소리 켠 영상 · 설명 듣기 자동 · 버튼", () => {
  it("설명 듣기는 진짜 단추처럼 — 두 줄(설명 듣기 · 눌러서 들어요)", () => {
    window.sessionStorage.setItem("153learn:sound", "off");
    render(<TrainingDrillSheet exercise={card()} onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "설명 듣기" });
    expect(btn).toHaveTextContent("설명 듣기");
    expect(btn).toHaveTextContent("눌러서 들어요");
    fireEvent.click(btn);
    expect(clip).toHaveBeenCalledWith("/voice/cards/test.mp3");
    expect(screen.getByRole("button", { name: "설명 멈추기" })).toHaveTextContent("설명 듣는 중");
  });

  it("영상이 없는 카드 — 열면 설명 듣기가 저절로", () => {
    render(<TrainingDrillSheet exercise={card()} onClose={vi.fn()} />);
    expect(clip).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(clip).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "설명 멈추기" })).toBeInTheDocument();
  });

  it("소리를 꺼 둔 회원님 — 저절로 틀지 않는다", () => {
    window.sessionStorage.setItem("153learn:sound", "off");
    render(<TrainingDrillSheet exercise={card()} onClose={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(clip).not.toHaveBeenCalled();
  });

  it("목소리 없는 영상(정사각) — 설명 듣기가 저절로, 그동안 영상 소리는 끔", () => {
    videoUrl.current = "https://x/member/a.mp4";
    render(<TrainingDrillSheet exercise={card({ video_path: "member/a.mp4" })} onClose={vi.fn()} />);
    expect(play).toHaveBeenCalled();
    meta(0, 1080, 1080);
    expect(clip).toHaveBeenCalledTimes(1);
    expect(video().muted).toBe(true);
    expect(video().parentElement?.style.aspectRatio).toBe("1");
  });

  it("목소리(더빙) 있는 가로 영상 — 소리 켠 채로 · 설명은 저절로 안 틂 · 가로 그대로 · 반복 안 함", () => {
    videoUrl.current = "https://x/member/b.mp4";
    render(<TrainingDrillSheet exercise={card({ video_path: "member/b.mp4" })} onClose={vi.fn()} />);
    meta(1);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(clip).not.toHaveBeenCalled();
    expect(video().muted).toBe(false);
    expect(video().loop).toBe(false);
    expect(Number(video().parentElement?.style.aspectRatio)).toBeCloseTo(16 / 9, 3);
    // 끝나면 다시 보기
    act(() => {
      fireEvent.ended(video());
    });
    expect(screen.getByRole("button", { name: /다시 보기/ })).toBeInTheDocument();
    // 소리 끄기 → 이 창에서 계속 끔
    fireEvent.click(screen.getByRole("button", { name: "소리 끄기" }));
    expect(video().muted).toBe(true);
    expect(window.sessionStorage.getItem("153learn:sound")).toBe("off");
  });

  it("휴대폰이 소리 자동 재생을 막으면 — 소리 없이 틀고 큰 「소리 켜기」, 누르면 바로 소리", async () => {
    videoUrl.current = "https://x/member/c.mp4";
    play.mockRejectedValueOnce(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    render(<TrainingDrillSheet exercise={card({ video_path: "member/c.mp4" })} onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    const hint = screen.getByRole("button", { name: /소리 켜기/ });
    expect(video().muted).toBe(true);
    fireEvent.click(hint);
    expect(video().muted).toBe(false);
    expect(play.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
