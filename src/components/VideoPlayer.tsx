import { useState, useRef } from "react";
import { X, Play, Pause, Maximize, RotateCcw } from "lucide-react";
import VideoVariantTabs from "@/components/common/VideoVariantTabs";

/** 같은 동작의 다른 버전 (실사 · 애니메이션 — 2026-10-01) */
export interface PlayerVariant {
  label: string;
  videoUrl: string;
  posterUrl?: string | null;
}

interface VideoPlayerProps {
  videoUrl: string;
  posterUrl?: string | null;
  title: string;
  keyPoints: string[];
  onStartChallenge?: () => void;
  onClose: () => void;
  challengeDisabled?: boolean;
  challengeLabel?: string;
  /** 대표 영상을 포함한 모든 버전 — 2개 이상이면 영상 아래에 '실사 | 애니메이션' 칸이 뜬다 */
  variants?: ReadonlyArray<PlayerVariant>;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const VideoPlayer = ({
  videoUrl,
  posterUrl,
  title,
  keyPoints,
  onStartChallenge,
  onClose,
  challengeDisabled,
  challengeLabel = "🥊 도전 시작",
  variants,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);
  // 실사 | 애니메이션 — 고른 버전 (버전이 하나면 videoUrl 그대로)
  const versions = variants && variants.length > 1 ? variants : null;
  const [versionIdx, setVersionIdx] = useState(0);
  const current = versions ? versions[Math.min(versionIdx, versions.length - 1)] : null;
  const src = current ? current.videoUrl : videoUrl;
  const poster = current ? current.posterUrl ?? null : posterUrl;

  const pickVersion = (i: number) => {
    if (i === versionIdx) return;
    videoRef.current?.pause();
    setVersionIdx(i);
    // 새 영상은 처음부터 — 큰 재생 버튼이 다시 보인다 (속도는 그대로 이어간다)
    setPlaying(false);
    setError(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const goFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  // Detect if it's a YouTube/external embed
  const isEmbed = src.includes("youtube") || src.includes("youtu.be") || src.includes("vimeo");

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes("youtube.com/watch")) {
      const id = new URL(url).searchParams.get("v");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    return url;
  };

  return (
    // 아이폰: 위 X 가 시계 밑에 깔리지 않게 상태바·홈 막대 자리만큼 비운다 (2026-10-01)
    <div className="fixed inset-0 z-[70] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="truncate text-base font-bold text-foreground">{title}</h2>
        <button onClick={onClose} className="rounded-full bg-secondary p-2 active:scale-95">
          <X className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Video */}
      <div className="relative w-full bg-foreground/5" style={{ aspectRatio: "16/9" }}>
        {error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted">
            <span className="text-4xl">📹</span>
            <p className="text-sm text-muted-foreground">영상을 불러올 수 없습니다</p>
            <button
              onClick={() => { setError(false); videoRef.current?.load(); }}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-sm text-secondary-foreground active:scale-95"
            >
              <RotateCcw className="h-4 w-4" /> 다시 시도
            </button>
          </div>
        ) : isEmbed ? (
          <iframe
            key={src}
            src={getEmbedUrl(src)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <video
              key={src}
              ref={videoRef}
              src={src}
              poster={poster || undefined}
              className="h-full w-full object-contain"
              onError={() => setError(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              // 버전을 바꾸면 새 영상이 기본 속도로 돌아가므로 고른 속도를 다시 건다
              onLoadedMetadata={(e) => { e.currentTarget.playbackRate = speed; }}
              playsInline
            />
            {/* Big play button overlay */}
            {!playing && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 shadow-lg transition-transform active:scale-90">
                  <Play className="ml-1 h-10 w-10 text-primary-foreground" fill="currentColor" />
                </div>
              </button>
            )}
          </>
        )}
      </div>

      {/* 실사 | 애니메이션 — 같은 동작의 다른 버전 */}
      {versions && (
        <div className="border-b border-border bg-card px-4 py-2.5">
          <VideoVariantTabs labels={versions.map((v) => v.label)} value={versionIdx} onChange={pickVersion} />
        </div>
      )}

      {/* Controls (for native video only) */}
      {!isEmbed && !error && (
        <div className="flex items-center justify-center gap-4 border-b border-border bg-card px-4 py-2.5">
          <button onClick={togglePlay} className="rounded-full bg-secondary p-2.5 active:scale-95">
            {playing ? <Pause className="h-5 w-5 text-secondary-foreground" /> : <Play className="h-5 w-5 text-secondary-foreground" />}
          </button>
          <button
            onClick={cycleSpeed}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground active:scale-95"
          >
            {speed}x
          </button>
          <button onClick={goFullscreen} className="rounded-full bg-secondary p-2.5 active:scale-95">
            <Maximize className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      )}

      {/* Key Points + CTA */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {keyPoints.filter(Boolean).length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-bold text-foreground">💡 핵심 포인트</h3>
            <div className="space-y-2">
              {keyPoints.filter(Boolean).map((point, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-primary/5 p-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {onStartChallenge && (
          <button
            onClick={onStartChallenge}
            disabled={challengeDisabled}
            className="w-full rounded-2xl bg-primary py-4 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {challengeLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
