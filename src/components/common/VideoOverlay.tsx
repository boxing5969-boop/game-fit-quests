/**
 * 영상 크게 보기 — 화면 위에 떠서 바로 재생한다 (검색 결과 · 수업 시트가 같이 쓴다).
 * body 로 띄워서 transform 애니메이션이 걸린 부모 안에서도 화면 기준으로 덮는다.
 * 유튜브 주소면 유튜브 플레이어, 아니면 기본 video. 바깥 누르기 · 닫기 · Esc 로 닫힌다.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { youtubeId } from "@/hooks/useLevelVideos";

export interface OverlayVideo {
  url: string;
  title: string;
}

interface Props {
  video: OverlayVideo | null;
  onClose: () => void;
}

const VideoOverlay = ({ video, onClose }: Props) => {
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, onClose]);

  if (!video) return null;
  const yt = youtubeId(video.url);
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {yt ? (
          <iframe
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`}
            title={video.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full rounded-2xl bg-black"
          />
        ) : (
          <video src={video.url} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default VideoOverlay;
