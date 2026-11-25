/**
 * 🎥 훈련 영상 플레이어 — 유튜브(일부공개) · 회원이 올린 영상(비공개 저장소 member-videos) (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 코치 피드백 「여기서 피드백」은 지금 시각(now) · 멈춤(pause)을, 피드백 시각을 누르면 그 자리로(seek).
 *   · provider "storage"(2026-11-26 회원 직접 올리기) = 1시간짜리 서명 주소로 <video> — 보기 권한은 저장소 정책이 본다.
 *   · 2차 플랜(R2 · 기기 · 드라이브)은 provider 로 갈라 여기만 넓힌다.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { loadYouTubeIframeApi } from "@/lib/youtubeIframeApi";
import { signedUrlOf } from "@/services/sparringVideoService";

export interface SparringPlayerHandle {
  now: () => number | null;
  seek: (sec: number) => void;
  pause: () => void;
}

interface Props {
  provider: string;
  externalId: string;
}

const SparringVideoPlayer = forwardRef<SparringPlayerHandle, Props>(({ provider, externalId }, ref) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- YT.Player
  const playerRef = useRef<any>(null);
  // 회원이 올린 영상(provider storage · 2026-11-26) — 비공개 저장소 서명 주소로 <video>
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      now: () => {
        if (videoRef.current) return videoRef.current.currentTime;
        try {
          const t = Number(playerRef.current?.getCurrentTime?.());
          return Number.isFinite(t) ? t : null;
        } catch {
          return null;
        }
      },
      seek: (sec: number) => {
        const v = videoRef.current;
        if (v) {
          v.currentTime = Math.max(0, sec);
          void v.play().catch(() => undefined);
          return;
        }
        try {
          playerRef.current?.seekTo?.(Math.max(0, sec), true);
          playerRef.current?.playVideo?.();
        } catch {
          /* 아직 준비 전 */
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          return;
        }
        try {
          playerRef.current?.pauseVideo?.();
        } catch {
          /* 아직 준비 전 */
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (provider !== "storage") return;
    let alive = true;
    setFailed(false);
    setSrc(null);
    void signedUrlOf(externalId).then((u) => {
      if (!alive) return;
      if (u) setSrc(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [provider, externalId]);

  useEffect(() => {
    if (provider !== "youtube") return;
    let cancelled = false;
    setFailed(false);
    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !wrapRef.current) return;
        const mount = document.createElement("div");
        wrapRef.current.replaceChildren(mount);
        playerRef.current = new YT.Player(mount, {
          host: "https://www.youtube.com",
          videoId: externalId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, iv_load_policy: 3, origin: window.location.origin },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [provider, externalId]);

  if (provider === "storage") {
    return (
      <div className="relative flex min-h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl bg-black">
        {src ? (
          <video ref={videoRef} src={src} controls playsInline preload="metadata" className="max-h-[62vh] w-full object-contain" />
        ) : (
          <p className="text-label text-white/70">{failed ? "영상을 열지 못했어요" : "영상을 불러오는 중…"}</p>
        )}
      </div>
    );
  }

  if (provider !== "youtube") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-muted text-label text-muted-foreground">
        이 영상은 아직 앱에서 열 수 없어요
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={wrapRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {failed && (
        <a
          href={`https://youtu.be/${externalId}`}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-body font-bold text-white"
        >
          <ExternalLink className="h-6 w-6" />
          유튜브에서 보기
        </a>
      )}
    </div>
  );
});
SparringVideoPlayer.displayName = "SparringVideoPlayer";

export default SparringVideoPlayer;
