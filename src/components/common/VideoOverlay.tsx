/**
 * 영상 크게 보기 — 화면 위에 떠서 바로 재생한다 (검색 결과 · 수업 시트가 같이 쓴다).
 * body 로 띄워서 transform 애니메이션이 걸린 부모 안에서도 화면 기준으로 덮는다.
 * 유튜브 주소면 유튜브 플레이어, 아니면 기본 video. 바깥 누르기 · 닫기 · Esc 로 닫힌다.
 * 같은 동작의 다른 버전(실사 · 애니메이션)이 있으면 영상 아래에서 바꿔 본다 (2026-10-01).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { youtubeId } from "@/hooks/useLevelVideos";
import VideoVariantTabs from "@/components/common/VideoVariantTabs";

export interface OverlayVariant {
  label: string;
  url: string;
}

export interface OverlayVideo {
  url: string;
  title: string;
  /** 대표 영상을 포함한 모든 버전 — 2개 이상이면 '실사 | 애니메이션' 칸이 뜬다 */
  variants?: ReadonlyArray<OverlayVariant>;
}

/**
 * 어두운 모달 안의 영상 칸 + 버전 고르기. 다른 영상을 열 때 처음 버전부터 보이도록
 * 쓰는 쪽에서 영상마다 key 를 달아 준다.
 */
export const OverlayMedia = ({
  url,
  title,
  variants,
}: {
  url: string;
  title: string;
  variants?: ReadonlyArray<OverlayVariant>;
}) => {
  const list = variants && variants.length > 1 ? variants : null;
  const [idx, setIdx] = useState(0);
  const src = list ? list[Math.min(idx, list.length - 1)].url : url;
  const yt = youtubeId(src);
  return (
    <>
      {yt ? (
        <iframe
          key={src}
          src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-2xl bg-black"
        />
      ) : (
        <video key={src} src={src} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
      )}
      {list && (
        <VideoVariantTabs
          labels={list.map((v) => v.label)}
          value={idx}
          onChange={setIdx}
          tone="dark"
          className="mt-3"
        />
      )}
    </>
  );
};

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
  return createPortal(
    <div
      // 뒤 화면(수업 시트 · 검색) 글자가 비쳐 보이지 않게 조금 더 어둡게 + 살짝 흐리게
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <OverlayMedia key={video.url} url={video.url} title={video.title} variants={video.variants} />
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-neutral-800 text-sm font-bold text-white ring-1 ring-white/10 active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default VideoOverlay;
