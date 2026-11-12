/**
 * 영상 자동 줄이기 — 올리기 전에 휴대폰 안에서 저장소 한도(50MB) 아래로 다시 인코딩한다.
 * (2026-11-12 대표님 「영상올릴때 자동으로 압축해서 50mb이하로줄여줘」 — 타이틀매치 심사 '찍어 둔 영상')
 *
 *   · 휴대폰 하드웨어 인코더(WebCodecs) + mediabunny(MPL-2.0) — 큰 원본을 서버로 보내지 않는다.
 *   · 영상 길이로 비트레이트를 정하고(목표 = 한도의 85%), 그 비트레이트에 맞는 크기로 줄인다:
 *     720p · 540p · 480p · 360p (원본보다 키우지 않음) · 30fps 넘으면 30fps · H.264 mp4(아이폰·안드로이드 모두 재생).
 *   · 소리: AAC·MP3 는 그대로 복사, 그 밖은 AAC 로 다시 — 못 하면 소리 없이(심사는 화면이 중요).
 *   · 그래도 한도를 넘으면 비트레이트를 낮춰 다시, 인코더 오류면 한 단계 작게 다시 (모두 3번까지).
 *   · mediabunny 는 이 함수를 처음 부를 때만 받는다(dynamic import) — 앱 첫 화면 무게는 그대로.
 *   · keepIfSmall: 이미 가벼운 영상(짧은 변 720 이하 · 평균 3Mbps 이하 · 한도 안 — 앱 촬영본 등)은 다시 만들지 않고 그대로
 *     (2026-11-12 대표님 「2번까지 하고」 — 50MB 아래 영상도 720p 로 줄여 저장 공간 · 올리는 시간을 아낀다).
 * 계산(planVideoCompression · isAlreadySmall)은 순수 함수 — videoCompress.test.ts.
 */
import type { ConversionAudioOptions, InputAudioTrack } from "mediabunny";

/** 목표 크기 = 한도 × 0.85 (인코더가 조금 넘겨도 한도 안) */
export const COMPRESS_TARGET_RATIO = 0.85;
/** 720p 30fps 에서 심사 영상으로 충분한 화질 (앱 안 촬영 2Mbps 보다 조금 높게) */
export const COMPRESS_MAX_VIDEO_BPS = 2_500_000;
/** 이보다 낮으면 동작이 뭉개진다 → '너무 길어요' */
export const COMPRESS_MIN_VIDEO_BPS = 200_000;
/** 소리를 다시 인코딩할 때 */
export const COMPRESS_AUDIO_BPS = 128_000;
const MUX_OVERHEAD = 0.985;
const BITS_PER_PIXEL_CAP = 0.1;
const MAX_ATTEMPTS = 3;

/** 비트레이트가 이만큼 되면 이 크기(짧은 변)로 */
const TIERS: readonly { short: number; minBps: number }[] = [
  { short: 720, minBps: 1_400_000 },
  { short: 540, minBps: 800_000 },
  { short: 480, minBps: 450_000 },
  { short: 360, minBps: 0 },
];

export interface VideoCompressPlanInput {
  durationSec: number;
  /** 화면에 보이는 가로·세로 (회전 반영) */
  width: number;
  height: number;
  /** 원본 평균 fps (모르면 null) */
  fps: number | null;
  /** 소리가 차지할 bps (소리 없으면 0) */
  audioBps: number;
  maxBytes: number;
  /** 다시 줄일 때 영상 비트레이트 상한 — 앞 시도가 한도를 넘었을 때 */
  maxVideoBps?: number;
  /** 인코더 오류 뒤 한 단계 작은 크기로 (기본 0) */
  tierDrop?: number;
  /** 가로·세로를 이 배수로 (기본 2 — 오류 뒤에는 16) */
  align?: number;
}

export type VideoCompressPlan =
  | { ok: true; width: number; height: number; frameRate: number | null; videoBps: number; targetBytes: number }
  | { ok: false; reason: "too_long"; maxDurationSec: number };

/** 길이·원본 크기·소리로 출력 크기·fps·비트레이트를 정한다 (순수 함수) */
export function planVideoCompression(p: VideoCompressPlanInput): VideoCompressPlan {
  const duration = Math.max(1, p.durationSec);
  const audioBps = Math.max(0, p.audioBps);
  const targetBytes = Math.floor(p.maxBytes * COMPRESS_TARGET_RATIO);
  const budgetBps = ((targetBytes * 8) / duration) * MUX_OVERHEAD - audioBps;
  if (budgetBps < COMPRESS_MIN_VIDEO_BPS) {
    const maxDurationSec = Math.floor((targetBytes * 8 * MUX_OVERHEAD) / (COMPRESS_MIN_VIDEO_BPS + audioBps));
    return { ok: false, reason: "too_long", maxDurationSec };
  }
  let bps = Math.min(budgetBps, COMPRESS_MAX_VIDEO_BPS);
  if (p.maxVideoBps && p.maxVideoBps > 0) bps = Math.min(bps, p.maxVideoBps);

  const tierAt = Math.max(0, TIERS.findIndex((t) => bps >= t.minBps));
  const tier = TIERS[Math.min(TIERS.length - 1, tierAt + Math.max(0, p.tierDrop ?? 0))];

  const align = Math.max(2, p.align ?? 2);
  const snap = (x: number) => Math.max(align, Math.round(x / align) * align);
  const srcW = Math.max(2, p.width);
  const srcH = Math.max(2, p.height);
  const srcShort = Math.min(srcW, srcH);
  const srcLong = Math.max(srcW, srcH);
  const short = Math.min(tier.short, srcShort);
  const outShort = snap(short);
  const outLong = snap((srcLong * short) / srcShort);
  const [width, height] = srcW >= srcH ? [outLong, outShort] : [outShort, outLong];

  const frameRate = p.fps && p.fps > 31 ? 30 : null;
  const fpsOut = frameRate ?? (p.fps && p.fps > 0 ? p.fps : 30);
  const pixelCap = width * height * fpsOut * BITS_PER_PIXEL_CAP;
  const videoBps = Math.round(Math.max(COMPRESS_MIN_VIDEO_BPS, Math.min(bps, pixelCap)));
  return { ok: true, width, height, frameRate, videoBps, targetBytes };
}

// ── 실행 (브라우저) ───────────────────────────────────────────

export type VideoCompressErrorCode = "unsupported" | "no_video" | "cannot_decode" | "too_long" | "failed" | "canceled";

export class VideoCompressError extends Error {
  readonly code: VideoCompressErrorCode;
  readonly maxDurationSec?: number;
  constructor(code: VideoCompressErrorCode, message?: string, maxDurationSec?: number) {
    super(message || code);
    this.name = "VideoCompressError";
    this.code = code;
    this.maxDurationSec = maxDurationSec;
  }
}

/** 이 기기·브라우저가 영상을 다시 인코딩할 수 있나 (아이폰 iOS 16.4+ · 안드로이드 크롬 94+) */
export const isVideoCompressSupported = (): boolean =>
  typeof window !== "undefined" && typeof window.VideoEncoder === "function" && typeof window.VideoDecoder === "function";

export interface CompressedVideo {
  blob: Blob;
  /** 다시 만들었으면 "video/mp4" · 그대로 두었으면(skipped) 원본 형식 그대로 쓰도록 빈 문자열 */
  contentType: string;
  /** keepIfSmall 로 원본을 그대로 돌려줬다 */
  skipped: boolean;
  width: number;
  height: number;
  durationSec: number;
  originalBytes: number;
  attempts: number;
  audio: "copied" | "reencoded" | "dropped" | "none";
}

export interface CompressVideoOptions {
  maxBytes: number;
  signal?: AbortSignal;
  /** 진행 0~1 · 몇 번째 시도인지 (다시 줄이면 2, 3) */
  onProgress?: (progress: number, attempt: number) => void;
  /** 이미 가벼우면(isAlreadySmall) 다시 만들지 않고 원본을 돌려준다 */
  keepIfSmall?: boolean;
}

/** 이 정도면 이미 가볍다 — 짧은 변 720 이하 · 평균 3Mbps 이하 (앱 안 촬영 720p · 2Mbps 가 여기 든다) */
export const KEEP_MAX_SHORT_SIDE = 720;
export const KEEP_MAX_BPS = 3_000_000;

/** 다시 만들 필요가 없는 영상인가 (순수 함수) */
export function isAlreadySmall(p: { width: number; height: number; durationSec: number; bytes: number; maxBytes: number }): boolean {
  if (!(p.bytes > 0) || p.bytes > p.maxBytes) return false;
  if (!(p.width > 0) || !(p.height > 0)) return false;
  const bps = (p.bytes * 8) / Math.max(1, p.durationSec);
  return Math.min(p.width, p.height) <= KEEP_MAX_SHORT_SIDE && bps <= KEEP_MAX_BPS;
}

type Mediabunny = typeof import("mediabunny");
type WakeLockLike = { release: () => Promise<void> };

const isCanceled = (mb: Mediabunny, e: unknown, signal?: AbortSignal) =>
  !!signal?.aborted || e instanceof mb.ConversionCanceledError || (e instanceof VideoCompressError && e.code === "canceled");

async function holdScreen(): Promise<WakeLockLike | null> {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
    if (!nav.wakeLock || document.visibilityState !== "visible") return null;
    return await nav.wakeLock.request("screen");
  } catch {
    return null; // 화면 켜 두기는 덤 — 안 돼도 줄이기는 한다
  }
}

const openInput = (mb: Mediabunny, file: Blob) =>
  new mb.Input({ source: new mb.BlobSource(file), formats: [mb.MP4, mb.QTFF, mb.WEBM, mb.MATROSKA] });

async function planAudio(
  mb: Mediabunny,
  track: InputAudioTrack | null,
): Promise<{ options: ConversionAudioOptions; bps: number; kind: CompressedVideo["audio"] }> {
  if (!track) return { options: { discard: true }, bps: 0, kind: "none" };
  const codec = await track.getCodec();
  let bps = 0;
  try {
    bps = (await track.computePacketStats(3000)).averageBitrate || 0;
  } catch {
    bps = 0;
  }
  if ((codec === "aac" || codec === "mp3") && bps > 0 && bps <= 320_000) return { options: {}, bps, kind: "copied" };
  try {
    const numberOfChannels = Math.min(2, Math.max(1, await track.getNumberOfChannels()));
    const src = await track.getSampleRate();
    const sampleRate = src === 44100 || src === 48000 ? src : 48000;
    const quality = new mb.Quality({ bitrate: COMPRESS_AUDIO_BPS });
    if ((await track.canDecode()) && (await mb.canEncodeAudio("aac", { numberOfChannels, sampleRate, quality }))) {
      return {
        options: { codec: "aac", numberOfChannels, sampleRate, quality, forceTranscode: true },
        bps: COMPRESS_AUDIO_BPS,
        kind: "reencoded",
      };
    }
  } catch {
    /* 소리를 못 옮기면 아래에서 뺀다 */
  }
  return { options: { discard: true }, bps: 0, kind: "dropped" };
}

/**
 * 영상을 maxBytes 아래 mp4 로 줄인다. 실패하면 VideoCompressError(code) — 화면 문구는 videoCompressErrorMessage.
 * 이미 한도 아래인 파일도 그대로 다시 인코딩하니, 부르는 쪽에서 크기를 먼저 본다.
 */
export async function compressVideoToLimit(file: Blob, opts: CompressVideoOptions): Promise<CompressedVideo> {
  const { signal, maxBytes } = opts;
  if (!isVideoCompressSupported()) throw new VideoCompressError("unsupported");
  if (signal?.aborted) throw new VideoCompressError("canceled");

  let mb: Mediabunny;
  try {
    mb = await import("mediabunny");
  } catch {
    throw new VideoCompressError("failed", "모듈을 받지 못했어요 — 인터넷 연결을 확인해 주세요");
  }
  if (signal?.aborted) throw new VideoCompressError("canceled");

  const screen = await holdScreen();
  const probe = openInput(mb, file);
  try {
    // ── 원본 살펴보기
    let video;
    try {
      if (!(await probe.canRead())) throw new VideoCompressError("no_video");
      video = await probe.getPrimaryVideoTrack();
    } catch (e) {
      if (e instanceof VideoCompressError) throw e;
      throw new VideoCompressError("no_video", (e as Error)?.message);
    }
    if (!video) throw new VideoCompressError("no_video");
    const width = await video.getDisplayWidth();
    const height = await video.getDisplayHeight();
    if (!width || !height) throw new VideoCompressError("no_video");
    const end = await probe.computeDuration();
    const start = Math.max(0, await probe.getFirstTimestamp());
    const durationSec = Math.max(0.5, end - start);
    // 이미 가벼우면 그대로 (풀 수 있는 형식인지 보기 전에 — 휴대폰이 못 푸는 작은 영상도 원본으로 올릴 수 있게)
    if (opts.keepIfSmall && isAlreadySmall({ width, height, durationSec, bytes: file.size, maxBytes })) {
      return {
        blob: file,
        contentType: "",
        skipped: true,
        width,
        height,
        durationSec,
        originalBytes: file.size,
        attempts: 0,
        audio: "copied",
      };
    }
    if (!(await video.canDecode())) throw new VideoCompressError("cannot_decode");
    let fps: number | null = null;
    try {
      fps = (await video.computePacketStats(120)).averagePacketRate || null;
    } catch {
      fps = null;
    }
    const audio = await planAudio(mb, await probe.getPrimaryAudioTrack());

    // ── 줄이기 (넘치면 비트레이트를 낮춰서 · 인코더 오류면 한 단계 작게)
    let maxVideoBps: number | undefined;
    let tierDrop = 0;
    let align = 2;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw new VideoCompressError("canceled");
      const plan = planVideoCompression({ durationSec, width, height, fps, audioBps: audio.bps, maxBytes, maxVideoBps, tierDrop, align });
      if (plan.ok === false) throw new VideoCompressError("too_long", undefined, plan.maxDurationSec);
      // 원본이 이미 목표 비트레이트보다 가벼우면(예: 아이폰 HEVC) 다시 만들어도 작아지지 않는다 — 그대로
      if (opts.keepIfSmall && attempt === 1 && file.size <= maxBytes && (file.size * 8) / durationSec <= plan.videoBps + audio.bps) {
        return {
          blob: file,
          contentType: "",
          skipped: true,
          width,
          height,
          durationSec,
          originalBytes: file.size,
          attempts: 0,
          audio: "copied",
        };
      }

      const quality = new mb.Quality({ bitrate: plan.videoBps });
      const codec = await mb.getFirstEncodableVideoCodec(["avc", "hevc"], { width: plan.width, height: plan.height, quality });
      if (!codec) {
        if (attempt === 1 && tierDrop === 0) {
          // 이 크기를 못 받는 인코더 — 한 단계 작게 다시
          tierDrop = 1;
          align = 16;
          continue;
        }
        throw new VideoCompressError("unsupported");
      }

      const input = openInput(mb, file);
      try {
        const target = new mb.BufferTarget();
        const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target });
        const conversion = await mb.Conversion.init({
          input,
          output,
          tracks: "primary",
          showWarnings: false,
          video: {
            width: plan.width,
            height: plan.height,
            fit: "fill",
            frameRate: plan.frameRate ?? undefined,
            codec,
            quality,
            forceTranscode: true,
          },
          audio: audio.options,
        });
        const lostVideo = conversion.discardedTracks.find((d) => d.track.isVideoTrack());
        if (!conversion.isValid || lostVideo) {
          if (lostVideo?.reason === "undecodable_source_codec") throw new VideoCompressError("cannot_decode");
          throw new Error(`conversion invalid: ${conversion.discardedTracks.map((d) => d.reason).join(",") || "unknown"}`);
        }
        conversion.onProgress = (p) => opts.onProgress?.(Math.max(0, Math.min(1, p)), attempt);
        const stop = () => void conversion.cancel();
        signal?.addEventListener("abort", stop, { once: true });
        try {
          await conversion.execute();
        } finally {
          signal?.removeEventListener("abort", stop);
        }
        const buf = target.buffer;
        if (!buf || buf.byteLength === 0) throw new Error("empty output");
        const blob = new Blob([buf], { type: "video/mp4" });
        // 원래 가벼운 영상(예: 아이폰 HEVC)은 다시 만든 쪽이 더 클 수 있다 — 그러면 원본 그대로
        if (opts.keepIfSmall && file.size <= maxBytes && blob.size >= file.size) {
          return {
            blob: file,
            contentType: "",
            skipped: true,
            width,
            height,
            durationSec,
            originalBytes: file.size,
            attempts: attempt,
            audio: "copied",
          };
        }
        if (blob.size <= maxBytes) {
          return {
            blob,
            contentType: "video/mp4",
            skipped: false,
            width: plan.width,
            height: plan.height,
            durationSec,
            originalBytes: file.size,
            attempts: attempt,
            audio: audio.kind,
          };
        }
        // 인코더가 목표보다 크게 만들었다 — 영상 몫이 넘친 비율 + 5% 더 낮춰 다시
        const audioBytes = (audio.bps * durationSec) / 8;
        const ratio = Math.max(1, plan.targetBytes - audioBytes) / Math.max(1, blob.size - audioBytes);
        maxVideoBps = Math.round(plan.videoBps * Math.min(1, ratio) * 0.95);
        lastError = new Error(`still ${blob.size} bytes`);
      } catch (e) {
        if (isCanceled(mb, e, signal)) throw new VideoCompressError("canceled");
        if (e instanceof VideoCompressError) throw e;
        lastError = e;
        tierDrop += 1;
        align = 16;
      } finally {
        input.dispose();
      }
    }
    throw new VideoCompressError("failed", (lastError as Error)?.message);
  } finally {
    probe.dispose();
    try {
      await screen?.release();
    } catch {
      /* noop */
    }
  }
}

/** 화면에 보여 줄 한 줄 */
export function videoCompressErrorMessage(e: unknown): string {
  const err = e instanceof VideoCompressError ? e : null;
  switch (err?.code) {
    case "unsupported":
      return "이 휴대폰(브라우저)에서는 영상을 줄일 수 없어요";
    case "cannot_decode":
      return "이 영상 형식은 이 휴대폰에서 줄일 수 없어요";
    case "no_video":
      return "영상 파일을 읽지 못했어요";
    case "too_long": {
      const min = Math.max(1, Math.floor((err.maxDurationSec ?? 60) / 60));
      return `영상이 너무 길어요 — ${min}분 안으로 잘라서 골라 주세요`;
    }
    case "canceled":
      return "영상 줄이기를 멈췄어요";
    default:
      return "영상을 줄이지 못했어요 — 다시 골라 주세요";
  }
}
