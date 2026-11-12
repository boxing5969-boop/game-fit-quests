/**
 * 타이틀매치 도전 기록 — 칸 3개(합격·불합격·남음) + 한 줄씩 기록과 '영상 보기'.
 * 회원 화면(타이틀매치)과 지점장 심사함이 같이 쓴다. 영상은 비공개 저장소 → 누를 때 서명 주소를 받아 연다.
 * 2026-11-12 부터 도전마다 영상 2개(치기 · 받기) — 받는 영상이 있으면 단추 2개, 영상이 하나면(예전 기록 · 치는 영상만 올린 불합격) '영상' 하나.
 * 보관 기간(도전이 끝나고 한 달)이 지나 지운 영상은 단추 대신 '영상 보관 끝' 한 줄.
 */
import { useState } from "react";
import { Check, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import { getTitleVideoUrl } from "@/hooks/useTitleMatchChallenge";
import { TITLE_CLIPS, formatKoShortDateTime, type TitleAttempt, type TitleClipKind } from "@/lib/titleMatchChallenge";
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
            "flex h-5 w-5 items-center justify-center rounded-full text-micro font-black",
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
  const [opening, setOpening] = useState<string | null>(null);
  const [video, setVideo] = useState<OverlayVideo | null>(null);

  if (attempts.length === 0) return null;

  // kind 가 없으면 영상 하나 — 예전 기록(치기 · 받기를 한 영상에) 또는 치는 영상만 올린 불합격
  const open = async (a: TitleAttempt, kind?: TitleClipKind) => {
    const path = kind === "receive" ? a.receiveVideoPath : a.videoPath;
    if (!path || opening) return;
    setOpening(`${a.no}:${kind ?? "one"}`);
    try {
      const url = await getTitleVideoUrl(path);
      setVideo({ url, title: `타이틀매치 도전 ${a.no}/${max}${kind ? ` · ${TITLE_CLIPS[kind].label}` : ""}` });
    } catch (e) {
      toast.error((e as Error)?.message || "영상을 열 수 없어요");
    } finally {
      setOpening(null);
    }
  };

  const videoButton = (a: TitleAttempt, kind: TitleClipKind | undefined, text: string) => (
    <button
      type="button"
      onClick={() => open(a, kind)}
      disabled={opening !== null}
      aria-label={`도전 ${a.no} ${kind ? TITLE_CLIPS[kind].label : "영상"} 보기`}
      className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-2.5 text-micro font-bold text-foreground ring-1 ring-border transition-transform active:scale-95 disabled:opacity-60"
    >
      {opening === `${a.no}:${kind ?? "one"}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      {text}
    </button>
  );

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
              <span className="block text-label font-bold text-foreground">
                도전 {a.no}/{max} · {a.passed ? "합격" : "아쉽게 불합격"}
              </span>
              <span className="mt-0.5 block text-label font-semibold text-muted-foreground">{formatKoShortDateTime(a.recordedAt)}</span>
              {a.note && <span className="mt-0.5 block break-words text-label leading-snug text-muted-foreground">“{a.note}”</span>}
            </span>
            {a.videoDeletedAt ? (
              <span className="mt-0.5 shrink-0 text-micro font-semibold text-muted-foreground">영상 보관 끝</span>
            ) : a.videoPath && a.receiveVideoPath ? (
              <span className="flex shrink-0 flex-col gap-1.5">
                {videoButton(a, "hit", TITLE_CLIPS.hit.short)}
                {videoButton(a, "receive", TITLE_CLIPS.receive.short)}
              </span>
            ) : a.videoPath ? (
              videoButton(a, undefined, "영상")
            ) : null}
          </li>
        ))}
      </ul>
      <VideoOverlay video={video} onClose={() => setVideo(null)} />
    </>
  );
};

export default TitleAttemptList;
