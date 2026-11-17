/**
 * 🎬 카드 시트 안 「영상 고치기」 칸 — 대표님 · 운영진만 (2026-11-17)
 *   · 새 영상이 왔어요(클로드가 다시 만든 영상) — 보고 「이대로 붙이기」 · 「다시 고쳐 주세요」(한 줄)
 *   · 회원에게 숨긴 영상 — 「숨긴 영상 보기」 · 「다시 보이기」
 *   · 보낸 요청 — 시각 · 무엇 · 한 줄 · 상태(보냈어요 · 고치는 중) · 「그만두기」 / 다 고친 것은 답 한 줄
 *   · 「이 장면 고쳐 달라기」 — 영상을 멈추고 그 시각으로 창(VideoFixSheet)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Check, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { FIX_STATE_LABEL, fixLine, fixesForCard, type VideoCandidate, type VideoFixData } from "@/lib/videoFix";
import { trainingVideoUrl } from "@/services/trainingCardService";
import { useVideoFixActions } from "@/services/videoFixService";
import VideoOverlay from "@/components/common/VideoOverlay";
import VideoFixSheet from "./VideoFixSheet";

const useSigned = (path: string | null) =>
  useQuery({
    queryKey: ["training-library", "video", path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    retry: 1,
    queryFn: () => trainingVideoUrl(path as string),
  });

function CandidateCard({ c }: { c: VideoCandidate }) {
  const actions = useVideoFixActions();
  const video = useSigned(c.videoPath);
  const poster = useSigned(c.posterPath);
  const [again, setAgain] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (ok: boolean) => {
    if (!ok && !note.trim()) {
      toast.error("어디를 고칠지 한 줄 써 주세요");
      return;
    }
    setBusy(true);
    try {
      await actions.decide(c.id, ok, ok ? "" : note);
      toast.success(ok ? "새 영상으로 바꿨어요 — 회원님께 바로 보여요" : "다시 고쳐 달라고 보냈어요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "정하지 못했어요");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/5">
      <p className="px-4 pt-3 text-body font-black text-primary">새 영상이 왔어요</p>
      {c.note && <p className="px-4 pt-1 text-label text-foreground">{c.note}</p>}
      <div className="mt-2 bg-black">
        {video.data ? (
          <video src={video.data} poster={poster.data ?? undefined} controls playsInline preload="metadata" className="max-h-80 w-full object-contain" />
        ) : (
          <div className="flex h-40 items-center justify-center text-label text-white/70">{video.isError ? "영상을 불러오지 못했어요" : "영상을 불러오는 중…"}</div>
        )}
      </div>
      {again ? (
        <div className="p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="예) 처음 2초는 빼 주세요 · 이것도 훅이 아니에요"
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-body text-foreground"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAgain(false)}
              className="h-12 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98]"
            >
              돌아가기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide(false)}
              className="h-12 rounded-xl bg-foreground text-body font-bold text-background active:scale-[0.98] disabled:opacity-60"
            >
              다시 고쳐 주세요
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3">
          <button
            type="button"
            onClick={() => setAgain(true)}
            className="h-12 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98]"
          >
            다시 고쳐 주세요
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(true)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> 이대로 붙이기
          </button>
        </div>
      )}
    </div>
  );
}

export default function VideoFixPanel({
  cardId,
  cardName,
  hasVideo,
  data,
  getTime,
  pauseVideo,
}: {
  cardId: string;
  cardName: string;
  /** 카드에 지금 회원용 영상이 있나 */
  hasVideo: boolean;
  data: VideoFixData;
  getTime: () => number;
  pauseVideo: () => void;
}) {
  const actions = useVideoFixActions();
  const { open, held, review, done } = fixesForCard(data, cardId);
  const [sheetAt, setSheetAt] = useState<number | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const heldVideo = useSigned(heldOpen && held ? held.heldVideoPath : null);

  const start = () => {
    pauseVideo();
    setSheetAt(Math.max(0, getTime() || 0));
  };
  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "잠시 뒤 다시 눌러 주세요");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body font-black text-foreground">🎬 영상 고치기</p>
        <span className="text-label text-muted-foreground">대표님 · 운영진만 보여요</span>
      </div>

      {review.map((c) => (
        <CandidateCard key={c.id} c={c} />
      ))}

      {held && (
        <div className="mt-3 rounded-xl bg-secondary px-3.5 py-3">
          <p className="text-body font-bold text-foreground">회원에게 숨긴 영상 · 고치는 중</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setHeldOpen(true)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-label font-bold text-foreground active:scale-[0.98]"
            >
              <Eye className="h-4 w-4" aria-hidden /> 숨긴 영상 보기
            </button>
            {!hasVideo && (
              <button
                type="button"
                onClick={() => void run(() => actions.restore(held.id), "다시 보이게 했어요")}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-label font-bold text-foreground active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> 다시 보이기
              </button>
            )}
          </div>
        </div>
      )}

      {open.length > 0 && (
        <ul className="mt-3 space-y-2">
          {open.map((f) => (
            <li key={f.id} className="rounded-xl border border-border px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-body text-foreground">{fixLine(f)}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-bold ${f.state === "doing" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {FIX_STATE_LABEL[f.state]}
                </span>
              </div>
              {f.state === "requested" && (
                <button
                  type="button"
                  onClick={() => void run(() => actions.cancel(f.id), "그만뒀어요")}
                  className="mt-1 text-label font-bold text-muted-foreground underline underline-offset-2"
                >
                  그만두기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {done.map((f) => (
            <li key={f.id} className="text-label text-muted-foreground">
              {FIX_STATE_LABEL[f.state]} · {f.reply || fixLine(f)}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={start}
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-body font-bold text-background active:scale-[0.98]"
      >
        <Camera className="h-4 w-4" aria-hidden /> 이 장면 고쳐 달라기
      </button>

      <VideoFixSheet
        open={sheetAt != null}
        cardId={cardId}
        cardName={cardName}
        atSec={sheetAt ?? 0}
        hasVideo={hasVideo}
        onClose={() => setSheetAt(null)}
      />
      <VideoOverlay
        video={heldOpen && heldVideo.data ? { url: heldVideo.data, title: `${cardName} · 숨긴 영상` } : null}
        onClose={() => setHeldOpen(false)}
      />
    </div>
  );
}
