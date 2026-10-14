/**
 * 타이틀매치 도전 기록 — 칸 3개(합격·불합격·남음) + 한 줄씩 기록과 '영상 보기'.
 * 회원 화면(타이틀매치)과 지점장 심사함이 같이 쓴다. 영상은 비공개 저장소 → 누를 때 서명 주소를 받아 연다.
 */
import { useState } from "react";
import { Check, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import { getTitleVideoUrl } from "@/hooks/useTitleMatchChallenge";
import { formatKoShortDateTime, type TitleAttempt } from "@/lib/titleMatchChallenge";
import { cn } from "@/lib/utils";

/** 도전 칸 — ● 합격 · ✕ 불합격 · ○ 남은 기회 */
export const AttemptDots = ({ attempts, max, className }: { attempts: TitleAttempt[]; max: number; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1", className)} aria-label={`도전 ${attempts.length}/${max}`}>
    {Array.from({ length: max }, (_, i) => {
      const a = attempts.find((x) => x.no === i + 1);
      return (
        <span
          key={i}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black",
            !a && "ring-2 ring-inset ring-border",
            a?.passed && "bg-status-complete text-white",
            a && !a.passed && "bg-muted text-muted-foreground",
          )}
        >
          {a ? a.passed ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <X className="h-3 w-3" strokeWidth={3.5} /> : null}
        </span>
      );
    })}
  </span>
);

const TitleAttemptList = ({ attempts, max, className }: { attempts: TitleAttempt[]; max: number; className?: string }) => {
  const [opening, setOpening] = useState<number | null>(null);
  const [video, setVideo] = useState<OverlayVideo | null>(null);

  if (attempts.length === 0) return null;

  const open = async (a: TitleAttempt) => {
    if (!a.videoPath || opening) return;
    setOpening(a.no);
    try {
      const url = await getTitleVideoUrl(a.videoPath);
      setVideo({ url, title: `타이틀매치 도전 ${a.no}/${max}` });
    } catch (e) {
      toast.error((e as Error)?.message || "영상을 열 수 없어요");
    } finally {
      setOpening(null);
    }
  };

  return (
    <>
      <ul className={cn("space-y-1.5", className)} aria-label="도전 기록">
        {attempts.map((a) => (
          <li key={a.no} className="flex items-start gap-2.5 rounded-xl bg-secondary/60 px-3 py-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                a.passed ? "bg-status-complete text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {a.passed ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <X className="h-3 w-3" strokeWidth={3.5} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-foreground">
                도전 {a.no}/{max} · {a.passed ? "합격" : "아쉽게 불합격"}
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">{formatKoShortDateTime(a.recordedAt)}</span>
              {a.note && <span className="mt-0.5 block break-words text-[12px] leading-snug text-muted-foreground">“{a.note}”</span>}
            </span>
            {a.videoPath && (
              <button
                type="button"
                onClick={() => open(a)}
                disabled={opening !== null}
                aria-label={`도전 ${a.no} 영상 보기`}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-2.5 text-[11.5px] font-bold text-foreground ring-1 ring-border transition-transform active:scale-95 disabled:opacity-60"
              >
                {opening === a.no ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                영상
              </button>
            )}
          </li>
        ))}
      </ul>
      <VideoOverlay video={video} onClose={() => setVideo(null)} />
    </>
  );
};

export default TitleAttemptList;
