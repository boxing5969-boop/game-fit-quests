/**
 * 🎥 내 스파링 영상 — 훈련 탭 「오늘 할 것」 한 줄 (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 내가 나온 영상이 있을 때만 보인다(없으면 아무것도 안 그림).
 *   · 알림 주소 `/missions?sparvid=<영상 id>` → 그 영상, `?sparvid=1` → 목록. 연 뒤 주소에서 지운다.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Video, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { thumbOf, whenLabel } from "@/lib/sparringVideo";
import { useMySparringVideos, type MyVideo } from "@/services/sparringVideoService";
import SparringVideoSheet from "./SparringVideoSheet";

const ListSheet = ({ videos, onPick, onClose }: { videos: MyVideo[]; onPick: (v: MyVideo) => void; onClose: () => void }) => {
  useModalDismiss(true, onClose, { back: true });
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="내 스파링 영상" className="fixed inset-0 z-[118] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Video className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-heading text-foreground">내 스파링 영상</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {videos.map((v) => {
          const thumb = thumbOf(v.provider, v.external_id);
          return (
            <li key={v.video_id}>
              <button
                type="button"
                onClick={() => onPick(v)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left active:scale-[0.99]"
              >
                <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-foreground">
                    {v.opponent_name ? `vs ${v.opponent_name}` : "스파링"}
                  </span>
                  <span className="block truncate text-label text-muted-foreground">{whenLabel(v.recorded_at)}</span>
                  <span className={`block text-label ${v.comment_count > 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {v.comment_count > 0 ? `코치 피드백 ${v.comment_count}` : "피드백 기다리는 중"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
};

const SparringVideoEntry = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const want = params.get("sparvid");
  const { data: videos, isFetched } = useMySparringVideos(!!user);
  const [listOpen, setListOpen] = useState(false);
  const [openVideo, setOpenVideo] = useState<MyVideo | null>(null);

  // 알림으로 들어오면 그 영상(또는 목록)을 연다
  useEffect(() => {
    if (!want || !isFetched) return;
    const hit = (videos ?? []).find((v) => v.video_id === want);
    if (hit) setOpenVideo(hit);
    else if ((videos ?? []).length > 0) setListOpen(true);
    const next = new URLSearchParams(params);
    next.delete("sparvid");
    setParams(next, { replace: true });
  }, [want, isFetched, videos, params, setParams]);

  if (!videos || videos.length === 0) return null;
  const fb = videos.reduce((n, v) => n + (v.comment_count > 0 ? 1 : 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Video className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">내 스파링 영상</span>
          <span className="block truncate text-label text-muted-foreground">
            {videos.length}편 · 최근 {whenLabel(videos[0].recorded_at)}
            {fb > 0 ? ` · 피드백 온 영상 ${fb}` : ""}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>
      {listOpen && <ListSheet videos={videos} onPick={(v) => setOpenVideo(v)} onClose={() => setListOpen(false)} />}
      <SparringVideoSheet video={openVideo} onClose={() => setOpenVideo(null)} />
    </>
  );
};

export default SparringVideoEntry;
