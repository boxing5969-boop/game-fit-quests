import { describe, expect, it } from "vitest";
import {
  COMPRESS_MAX_VIDEO_BPS,
  COMPRESS_MIN_VIDEO_BPS,
  VideoCompressError,
  isAlreadySmall,
  isVideoCompressSupported,
  planVideoCompression,
  videoCompressErrorMessage,
} from "./videoCompress";

const MB50 = 50 * 1024 * 1024;

describe("planVideoCompression — 출력 크기 · fps · 비트레이트", () => {
  it("1분 세로 1080p 60fps → 720×1280 · 30fps · 최대 화질(2.5Mbps)", () => {
    const p = planVideoCompression({ durationSec: 60, width: 1080, height: 1920, fps: 59.94, audioBps: 128_000, maxBytes: MB50 });
    expect(p).toEqual({
      ok: true,
      width: 720,
      height: 1280,
      frameRate: 30,
      videoBps: COMPRESS_MAX_VIDEO_BPS,
      targetBytes: Math.floor(MB50 * 0.85),
    });
  });

  it("가로 4K 30fps 2분 → 1280×720 · fps 그대로", () => {
    const p = planVideoCompression({ durationSec: 120, width: 3840, height: 2160, fps: 30, audioBps: 192_000, maxBytes: MB50 });
    expect(p.ok && [p.width, p.height, p.frameRate]).toEqual([1280, 720, null]);
    expect(p.ok && p.videoBps).toBe(COMPRESS_MAX_VIDEO_BPS);
  });

  it("10분이면 비트레이트가 줄고 크기도 480p 로", () => {
    const p = planVideoCompression({ durationSec: 600, width: 1920, height: 1080, fps: 30, audioBps: 128_000, maxBytes: MB50 });
    if (!p.ok) throw new Error("plan failed");
    expect([p.width, p.height]).toEqual([854, 480]);
    // 예상 크기(영상 + 소리)가 목표 안
    expect(((p.videoBps + 128_000) * 600) / 8).toBeLessThanOrEqual(p.targetBytes);
    expect(p.videoBps).toBeGreaterThanOrEqual(COMPRESS_MIN_VIDEO_BPS);
  });

  it("5분이면 540p", () => {
    const p = planVideoCompression({ durationSec: 300, width: 1920, height: 1080, fps: 30, audioBps: 128_000, maxBytes: MB50 });
    expect(p.ok && [p.width, p.height]).toEqual([960, 540]);
  });

  it("너무 길면(30분) 줄이지 않고 몇 분까지 되는지 알려 준다", () => {
    const p = planVideoCompression({ durationSec: 1800, width: 1920, height: 1080, fps: 30, audioBps: 128_000, maxBytes: MB50 });
    expect(p.ok).toBe(false);
    if (p.ok !== false) return;
    expect(p.reason).toBe("too_long");
    expect(p.maxDurationSec).toBeGreaterThan(15 * 60);
    expect(p.maxDurationSec).toBeLessThan(20 * 60);
  });

  it("원본보다 키우지 않는다 (360p 원본은 360p 그대로 · 화소만큼만 비트레이트)", () => {
    const p = planVideoCompression({ durationSec: 300, width: 640, height: 360, fps: 30, audioBps: 0, maxBytes: MB50 });
    if (!p.ok) throw new Error("plan failed");
    expect([p.width, p.height]).toEqual([640, 360]);
    expect(p.videoBps).toBe(Math.round(640 * 360 * 30 * 0.1));
  });

  it("다시 줄일 때(maxVideoBps) 비트레이트가 상한까지 내려가고 크기도 거기에 맞춘다", () => {
    const base = { durationSec: 60, width: 1920, height: 1080, fps: 30, audioBps: 128_000, maxBytes: MB50 };
    const a = planVideoCompression(base);
    const b = planVideoCompression({ ...base, maxVideoBps: 1_250_000 });
    if (!a.ok || !b.ok) throw new Error("plan failed");
    expect([a.width, a.height, a.videoBps]).toEqual([1280, 720, COMPRESS_MAX_VIDEO_BPS]);
    expect([b.width, b.height, b.videoBps]).toEqual([960, 540, 1_250_000]);
  });

  it("인코더 오류 뒤에는 한 단계 작게 · 16의 배수로", () => {
    const p = planVideoCompression({ durationSec: 60, width: 1920, height: 1080, fps: 30, audioBps: 128_000, maxBytes: MB50, tierDrop: 1, align: 16 });
    expect(p.ok && [p.width, p.height]).toEqual([960, 544]);
  });

  it("fps 를 모르면 30 으로 셈하고 바꾸지 않는다", () => {
    const p = planVideoCompression({ durationSec: 60, width: 1280, height: 720, fps: null, audioBps: 0, maxBytes: MB50 });
    expect(p.ok && p.frameRate).toBeNull();
  });

  it("출력 가로·세로는 언제나 짝수", () => {
    for (const [w, h] of [[1080, 2400], [1440, 3120], [720, 1600], [1366, 768], [3840, 1644]]) {
      const p = planVideoCompression({ durationSec: 90, width: w, height: h, fps: 30, audioBps: 128_000, maxBytes: MB50 });
      if (!p.ok) throw new Error("plan failed");
      expect(p.width % 2).toBe(0);
      expect(p.height % 2).toBe(0);
    }
  });
});

describe("isAlreadySmall — 이미 가벼우면 다시 만들지 않기 (2026-11-12)", () => {
  const MB = 1024 * 1024;
  it("앱 안 촬영(720p · 2Mbps · 1분 ≈ 15MB)은 그대로", () => {
    expect(isAlreadySmall({ width: 720, height: 1280, durationSec: 60, bytes: 15 * MB, maxBytes: MB50 })).toBe(true);
  });
  it("1080p 이상은 50MB 아래여도 줄인다", () => {
    expect(isAlreadySmall({ width: 1080, height: 1920, durationSec: 20, bytes: 30 * MB, maxBytes: MB50 })).toBe(false);
  });
  it("720p 라도 비트레이트가 높으면(1분 40MB ≈ 5.6Mbps) 줄인다", () => {
    expect(isAlreadySmall({ width: 1280, height: 720, durationSec: 60, bytes: 40 * MB, maxBytes: MB50 })).toBe(false);
  });
  it("한도를 넘으면 무조건 줄인다 · 크기를 모르면 줄인다", () => {
    expect(isAlreadySmall({ width: 640, height: 360, durationSec: 600, bytes: 60 * MB, maxBytes: MB50 })).toBe(false);
    expect(isAlreadySmall({ width: 0, height: 0, durationSec: 60, bytes: 5 * MB, maxBytes: MB50 })).toBe(false);
  });
});

describe("화면 문구", () => {
  it("코드마다 한 줄", () => {
    expect(videoCompressErrorMessage(new VideoCompressError("too_long", undefined, 17 * 60 + 30))).toBe(
      "영상이 너무 길어요 — 17분 안으로 잘라서 골라 주세요",
    );
    expect(videoCompressErrorMessage(new VideoCompressError("cannot_decode"))).toContain("형식");
    expect(videoCompressErrorMessage(new Error("x"))).toContain("줄이지 못했어요");
  });

  it("jsdom 에는 WebCodecs 가 없다 → 지원 안 함", () => {
    expect(isVideoCompressSupported()).toBe(false);
  });
});
