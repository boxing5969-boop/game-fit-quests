// 🎬 영상 마스터 — 관장님 훈련 영상으로 집에서 예습하는 탭.
// 큰 썸네일 + 진행 바 + 체크. 회원이 "오늘 뭘 보면 되는지" 3초 안에 알도록 단순하게.
import { useState } from "react";
import { Play, CheckCircle2, X } from "lucide-react";
import {
  useLevelVideos, useWatchedVideos, youtubeId, youtubeThumb, parseVideoTitle,
  type LevelVideo,
} from "@/hooks/useLevelVideos";

interface Props {
  league: string;
  levelNumber: number;
}

const LevelVideoMaster = ({ league, levelNumber }: Props) => {
  const { data: videos = [], isLoading } = useLevelVideos(league, levelNumber);
  const { watched, toggle, countFor } = useWatchedVideos();
  const [playing, setPlaying] = useState<LevelVideo | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">영상 불러오는 중...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-3xl">🎬</span>
        <p className="mt-2 text-sm text-muted-foreground">이 레벨의 훈련 영상은 준비 중이에요</p>
      </div>
    );
  }

  const done = countFor(videos.map((v) => v.id));
  const pct = Math.round((done / videos.length) * 100);

  return (
    <div className="space-y-3">
      {/* 진행 요약 */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-foreground">🎬 이번 레벨 영상 마스터</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              집에서 먼저 보고 오면 수업이 훨씬 쉬워져요
            </p>
          </div>
          <div className="text-right">
            <p className="number-font text-xl font-black text-primary">{done}/{videos.length}</p>
            <p className="text-[10px] text-muted-foreground">시청 완료</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 영상 카드 */}
      {videos.map((v, i) => {
        const t = parseVideoTitle(v.title);
        const thumb = v.posterUrl || youtubeThumb(v.videoUrl);
        const isDone = !!watched[v.id];
        return (
          <div
            key={v.id}
            className={`overflow-hidden rounded-2xl border bg-card shadow-elev-1 transition-all ${
              isDone ? "border-status-complete/40" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => setPlaying(v)}
              className="relative block w-full text-left active:scale-[0.99]"
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={t.name}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted text-3xl">🥊</div>
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                  <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
                </span>
              </span>
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
                {i + 1} · {t.tag || "훈련"}
              </span>
              {isDone && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-status-complete px-2 py-0.5 text-[10px] font-black text-white">
                  <CheckCircle2 className="h-3 w-3" /> 완료
                </span>
              )}
            </button>

            <div className="p-3.5">
              <p className="text-sm font-black text-foreground">{t.name}</p>
              {t.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{t.sub}</p>}
              {v.keyPoints.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {v.keyPoints.slice(0, 3).map((kp, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground">· {kp}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => toggle(v.id)}
                className={`mt-3 w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 ${
                  isDone
                    ? "bg-status-complete/10 text-status-complete"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isDone ? "✓ 따라했어요 (해제)" : "따라했어요 체크"}
              </button>
            </div>
          </div>
        );
      })}

      {/* 재생 모달 */}
      {playing && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-white">{parseVideoTitle(playing.title).name}</p>
              <button
                onClick={() => setPlaying(null)}
                aria-label="닫기"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {youtubeId(playing.videoUrl) ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId(playing.videoUrl)}?autoplay=1&rel=0&playsinline=1`}
                title={playing.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded-2xl bg-black"
              />
            ) : (
              <video src={playing.videoUrl} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
            )}
            <button
              type="button"
              onClick={() => { toggle(playing.id); setPlaying(null); }}
              className="mt-3 w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
            >
              따라했어요 ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelVideoMaster;
