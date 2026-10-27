/**
 * 🎥 앱 안 촬영 — 지점장이 타이틀매치 도전을 바로 찍는다 (2026-10-14).
 *
 * 휴대폰 기본 카메라 영상은 1분에 60~130MB라 저장소 한도(50MB)를 넘기 쉽다. 그래서 앱 안에서
 * 720p · 2Mbps 로 찍어 1분 ≈ 15MB 로 저장한다 (최대 2분 30초에서 자동으로 멈춘다).
 * 형식은 mp4(아이폰·최신 크롬)를 먼저, 안 되면 webm. 소리는 녹음하지 않는다 (마이크 권한을 묻지 않게).
 * 카메라를 못 열면 '찍어 둔 영상 고르기'로 안내한다 — 화면은 닫히고 부모가 파일 고르기를 보여 준다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw, X } from "lucide-react";
import {
  RECORDER_BITS_PER_SECOND,
  RECORDER_MAX_SECONDS,
  formatClock,
  pickRecorderMime,
} from "@/lib/titleMatchChallenge";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  /** 위에 띄울 한 줄 — "닉네임 · 도전 2/3" */
  title: string;
  onClose: () => void;
  onRecorded: (blob: Blob, contentType: string) => void;
}

type Phase = "starting" | "ready" | "recording" | "error";

const cameraError = (e: unknown): string => {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "카메라 권한이 꺼져 있어요. 휴대폰 설정에서 카메라를 허용하거나, 찍어 둔 영상을 골라 주세요.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "카메라를 찾을 수 없어요. 찍어 둔 영상을 골라 주세요.";
  if (name === "NotReadableError") return "다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 열어 주세요.";
  return "카메라를 열 수 없어요. 찍어 둔 영상을 골라 주세요.";
};

const VideoRecorderSheet = ({ open, title, onClose, onRecorded }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // 카메라 열기 — 열릴 때 · 앞뒤 전환 때
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("starting");
    setError("");
    setElapsed(0);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("error");
      setError("이 기기·브라우저에서는 앱 촬영이 안 돼요. 찍어 둔 영상을 골라 주세요.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().catch(() => {
            /* 자동 재생이 막혀도 촬영은 된다 */
          });
        }
        setPhase("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setPhase("error");
        setError(cameraError(e));
      });
    return () => {
      cancelled = true;
      // 녹화 중에 닫히면 버린다 (onRecorded 를 부르지 않는다)
      discardRef.current = true;
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        /* noop */
      }
      recorderRef.current = null;
      clearTimer();
      stopTracks();
    };
  }, [open, facing]);

  const stop = useCallback(() => {
    clearTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = () => {
    const stream = streamRef.current;
    if (!stream || phase !== "ready") return;
    const pick = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    let rec: MediaRecorder;
    try {
      rec = pick
        ? new MediaRecorder(stream, { mimeType: pick.mimeType, videoBitsPerSecond: RECORDER_BITS_PER_SECOND })
        : new MediaRecorder(stream, { videoBitsPerSecond: RECORDER_BITS_PER_SECOND });
    } catch (e) {
      setPhase("error");
      setError(cameraError(e));
      return;
    }
    const contentType = pick?.contentType ?? ((rec.mimeType || "video/webm").split(";")[0] || "video/webm");
    chunksRef.current = [];
    discardRef.current = false;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      if (discardRef.current) return;
      const blob = new Blob(chunksRef.current, { type: contentType });
      chunksRef.current = [];
      if (blob.size === 0) {
        setPhase("error");
        setError("영상이 비어 있어요. 다시 찍어 주세요.");
        return;
      }
      onRecorded(blob, contentType);
    };
    recorderRef.current = rec;
    rec.start(1000);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(sec);
      if (sec >= RECORDER_MAX_SECONDS) stop();
    }, 250);
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="타이틀매치 도전 촬영"
      className="fixed inset-0 z-[110] flex flex-col bg-black pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate text-label font-bold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="촬영 닫기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
        {phase === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-label="카메라 여는 중" />
          </div>
        )}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-label font-bold leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-full bg-white px-5 text-label font-black text-black active:scale-95"
            >
              닫기
            </button>
          </div>
        )}
        {phase === "recording" && (
          <span className="absolute left-1/2 top-3 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-label font-black tabular-nums">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            {formatClock(elapsed)} / {formatClock(RECORDER_MAX_SECONDS)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between px-8 pb-6 pt-4">
        <span className="w-12" aria-hidden />
        {phase === "recording" ? (
          <button
            type="button"
            onClick={stop}
            aria-label="촬영 끝"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full ring-4 ring-white active:scale-95"
          >
            <span className="h-7 w-7 rounded-md bg-red-500" />
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={phase !== "ready"}
            aria-label="촬영 시작"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full ring-4 ring-white active:scale-95 disabled:opacity-40"
          >
            <span className="h-14 w-14 rounded-full bg-red-500" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          disabled={phase === "recording" || phase === "starting"}
          aria-label="앞뒤 카메라 바꾸기"
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-white/15 active:scale-95 disabled:opacity-30",
          )}
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>
      <p className="px-6 pb-4 text-center text-label text-white/60">
        3번 연속 성공 → 미트 3번 받아주기까지 한 번에 찍어요 · {formatClock(RECORDER_MAX_SECONDS)}에서 자동으로 멈춰요
      </p>
    </div>,
    document.body,
  );
};

export default VideoRecorderSheet;
