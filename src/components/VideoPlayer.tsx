import { useState, useRef } from "react";
import { X, Play, Pause, Maximize, RotateCcw } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  posterUrl?: string | null;
  title: string;
  keyPoints: string[];
  onStartChallenge?: () => void;
  onClose: () => void;
  challengeDisabled?: boolean;
  challengeLabel?: string;
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
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);

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
  const isEmbed = videoUrl.includes("youtube") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo");

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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
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
            src={getEmbedUrl(videoUrl)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl || undefined}
              className="h-full w-full object-contain"
              onError={() => setError(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
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
