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
  // 진짜 훅처럼 — 첫 장면(poster_path)이 있으면 그것, 없으면 동작 그림(image_url)
  useCardPosters: () => (c: { poster_path: string | null; image_url: string | null }) =>
    c.poster_path ? `https://x/${c.poster_path}` : c.image_url,
}));
vi.mock("@/services/shelfLayoutService", () => ({ logCardEvent: vi.fn() }));
vi.mock("@/services/cardReactService", () => ({ useCardSocial: () => ({ data: undefined }) }));
vi.mock("@/services/videoFixService", () => ({ useVideoFixes: () => ({ data: undefined }) }));
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

// 2026-11-18 대표님 「최상단에 영상이 먼저 나오고 설명글 바로 위에 이미지 — 모든 동작은 영상 밑에 이미지 소개글」
describe("카드 시트 — 영상 → 동작 그림 → 글 순서", () => {
  const ILLUST = "https://img/straight-2cut.png";
  const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("영상 카드 — 맨 위 영상, 그 아래 동작 그림, 그 아래 이름(글)", () => {
    videoUrl.current = "https://x/member/d.mp4";
    render(
      <TrainingDrillSheet
        exercise={card({ video_path: "member/d.mp4", poster_path: "member/d.webp", image_url: ILLUST })}
        onClose={vi.fn()}
      />,
    );
    const pic = screen.getByAltText("잽 동작 그림");
    expect(pic).toHaveAttribute("src", ILLUST);
    expect(before(video(), pic)).toBe(true);
    expect(before(pic, screen.getByRole("heading", { name: "잽" }))).toBe(true);
    // 영상 표지는 첫 장면 — 그림이 두 번 보이지 않게
    expect(video().getAttribute("poster")).toBe("https://x/member/d.webp");
    expect(screen.getAllByAltText("잽 동작 그림")).toHaveLength(1);
  });

  it("영상 주소를 받는 중 — 맨 위 첫 장면 · 그림은 이미 아래 자리에", () => {
    videoUrl.current = null;
    render(
      <TrainingDrillSheet
        exercise={card({ video_path: "member/e.mp4", poster_path: "member/e.webp", image_url: ILLUST })}
        onClose={vi.fn()}
      />,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs[0]).toHaveAttribute("src", "https://x/member/e.webp");
    expect(imgs[1]).toHaveAttribute("src", ILLUST);
  });

  it("영상이 없는 카드 — 동작 그림이 맨 위(예전 그대로) · 한 번만", () => {
    render(<TrainingDrillSheet exercise={card({ image_url: ILLUST })} onClose={vi.fn()} />);
    const pics = screen.getAllByAltText("잽 동작 그림");
    expect(pics).toHaveLength(1);
    expect(pics[0]).toHaveAttribute("src", ILLUST);
    expect(before(pics[0], screen.getByRole("heading", { name: "잽" }))).toBe(true);
    expect(document.querySelector("video")).toBeNull();
  });

  it("그림이 없는 영상 카드 — 그림 칸 없이 영상 → 글", () => {
    videoUrl.current = "https://x/member/f.mp4";
    render(<TrainingDrillSheet exercise={card({ video_path: "member/f.mp4", poster_path: "member/f.webp" })} onClose={vi.fn()} />);
    expect(screen.queryByAltText("잽 동작 그림")).toBeNull();
    expect(video().getAttribute("poster")).toBe("https://x/member/f.webp");
  });
});

describe("카드 시트 — 효과 · 가치 · 언제 · 얼마나 · 영상 작업중 (2026-11-23)", () => {
  const ILLUST = "https://img/jab-2cut.png";

  it("안내가 있는 카드 — 「이 동작, 왜 · 언제 · 얼마나」 네 줄이 「이렇게 해요」 위에", () => {
    render(<TrainingDrillSheet exercise={card({ image_url: ILLUST })} onClose={vi.fn()} />);
    const box = screen.getByRole("region", { name: "이 동작, 왜 · 언제 · 얼마나" });
    for (const label of ["효과", "가치", "언제", "얼마나"]) expect(box).toHaveTextContent(label);
    const how = screen.getByText("👣 이렇게 해요");
    expect(!!(box.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("안내가 없는 카드 — 칸을 그리지 않는다", () => {
    render(<TrainingDrillSheet exercise={card({ id: "00000000-0000-4000-8000-000000000001" })} onClose={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "이 동작, 왜 · 언제 · 얼마나" })).toBeNull();
  });

  it("그림만 있는 카드 — 맨 위 그림에 「영상 작업중」 · 영상 카드는 없음", () => {
    const { unmount } = render(<TrainingDrillSheet exercise={card({ image_url: ILLUST })} onClose={vi.fn()} />);
    expect(screen.getByText("영상 작업중")).toBeInTheDocument();
    unmount();
    videoUrl.current = "https://x/member/g.mp4";
    render(<TrainingDrillSheet exercise={card({ video_path: "member/g.mp4", image_url: ILLUST })} onClose={vi.fn()} />);
    expect(screen.queryByText("영상 작업중")).toBeNull();
  });

  it("준비 칸(붕대 감기)은 영상 작업중이 아니다", () => {
    render(<TrainingDrillSheet exercise={card({ category: "준비", name: "복싱 붕대 감기" })} onClose={vi.fn()} />);
    expect(screen.queryByText("영상 작업중")).toBeNull();
  });
});
