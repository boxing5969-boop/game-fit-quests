/**
 * 🎥 훈련 영상 올리기 — 회원이 휴대폰에서 직접(인스타처럼) (2026-11-26 · docs/features/64-스파링-영상.md)
 *   대표님 11/25 「일단은 인스타그램처럼 회원님들 스스로가 직접 올리는 기능만 활성화해놓고 노트북 카메라 등등 준비되면 시작하자」
 *   · 60초까지 · 휴대폰에서 720p 로 줄여(videoCompress · keepIfSmall) 비공개 저장소 member-videos 의 내 폴더에 → sparvid_upload_register
 *   · 종류(미트 · 스파링 · 쉐도우·샌드백) · 한 줄 글 · 「우리 지점에 공개 / 나만 보기」 · 「코치님 피드백 받기」
 *   · 「영상에 나온 다른 회원에게 허락받았어요」 확인이 있어야 올린다(서버도 막음) · 만 14세 미만은 서버가 나만 보기로
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Film, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { compressVideoToLimit, isVideoCompressSupported, videoCompressErrorMessage } from "@/lib/videoCompress";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_SEC, VIDEO_KINDS, extOf, uploadPathOf, type VideoKind } from "@/lib/sparringVideo";
import { SPARVID_KEY, putMemberFile, registerUpload } from "@/services/sparringVideoService";

/** 영상 한 장면을 포스터(jpg, 긴 변 480)로 */
async function capturePoster(v: HTMLVideoElement): Promise<Blob | null> {
  try {
    const at = Math.min(0.6, (v.duration || 1) / 2);
    await new Promise<void>((res) => {
      const done = () => {
        v.removeEventListener("seeked", done);
        res();
      };
      v.addEventListener("seeked", done);
      v.currentTime = at;
      window.setTimeout(done, 1500);
    });
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return null;
    const k = 480 / Math.max(w, h);
    const c = document.createElement("canvas");
    c.width = Math.round(w * Math.min(1, k));
    c.height = Math.round(h * Math.min(1, k));
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

const Toggle = ({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-left">
    <span className="min-w-0">
      <span className="block text-body font-bold text-foreground">{title}</span>
      {sub && <span className="block text-label text-muted-foreground">{sub}</span>}
    </span>
    <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
    </span>
  </button>
);

const Body = ({ onClose, onDone }: { onClose: () => void; onDone: (videoId: string) => void }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  useModalDismiss(true, onClose, { back: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [kind, setKind] = useState<VideoKind>("mitt");
  const [caption, setCaption] = useState("");
  const [share, setShare] = useState(true);
  const [feedback, setFeedback] = useState(false);
  const [othersOk, setOthersOk] = useState(false);
  const [busy, setBusy] = useState<null | { step: string; pct: number }>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
    abortRef.current?.abort();
  }, [url]);

  const tooLong = dur != null && dur > UPLOAD_MAX_SEC + 1;
  const canSend = !!file && !tooLong && dur != null && othersOk && !busy && !!user;

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setDur(null);
    setUrl(URL.createObjectURL(f));
  };

  const send = async () => {
    if (!canSend || !file || !user) return;
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let blob: Blob = file;
      let type = file.type || "video/mp4";
      if (isVideoCompressSupported()) {
        setBusy({ step: "영상 줄이는 중", pct: 0 });
        const r = await compressVideoToLimit(file, {
          maxBytes: UPLOAD_MAX_BYTES,
          keepIfSmall: true,
          signal: ac.signal,
          onProgress: (p) => setBusy((b) => (b ? { ...b, pct: Math.min(99, Math.round(p * 100)) } : b)),
        });
        if (!r.skipped) {
          blob = r.blob;
          type = r.contentType || "video/mp4";
        }
      } else if (file.size > UPLOAD_MAX_BYTES) {
        throw new Error("영상이 너무 커요 — 50MB까지예요. 휴대폰 사진첩에서 짧게 잘라 주세요");
      }
      setBusy({ step: "올리는 중", pct: 0 });
      const path = uploadPathOf(user.id, extOf(type, file.name), new Date(), Math.random());
      const poster = videoRef.current ? await capturePoster(videoRef.current) : null;
      await putMemberFile(path, blob, type);
      let posterPath: string | null = null;
      if (poster) {
        posterPath = path.replace(/\.[a-z0-9]+$/, ".jpg");
        try {
          await putMemberFile(posterPath, poster, "image/jpeg");
        } catch {
          posterPath = null;
        }
      }
      setBusy({ step: "등록하는 중", pct: 100 });
      const r = await registerUpload({
        path,
        poster: posterPath,
        kind,
        caption,
        share,
        wantFeedback: feedback,
        othersOk,
        durationSec: dur,
      });
      void qc.invalidateQueries({ queryKey: SPARVID_KEY });
      if (share && r.under14) toast.success("올렸어요 · 만 14세 미만은 「나만 보기」로 올라가요");
      else toast.success(feedback ? "올렸어요 · 코치님께 피드백 요청이 갔어요" : "올렸어요");
      onDone(r.video_id);
    } catch (e) {
      if (ac.signal.aborted) return;
      const msg = e instanceof Error && /[가-힣]/.test(e.message) ? e.message : videoCompressErrorMessage(e);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="영상 올리기" className="fixed inset-0 z-[122] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <p className="min-w-0 flex-1 text-heading text-foreground">영상 올리기</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {url ? (
          <div className="space-y-2">
            <div className="flex justify-center overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                src={url}
                controls
                playsInline
                muted
                preload="metadata"
                onLoadedMetadata={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
                className="max-h-[42vh] w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className={cn("text-label", tooLong ? "font-bold text-destructive" : "text-muted-foreground")}>
                {dur == null ? "영상 길이 확인 중…" : tooLong ? `${Math.round(dur)}초 — ${UPLOAD_MAX_SEC}초까지 올릴 수 있어요. 사진첩에서 잘라 주세요` : `${Math.round(dur)}초`}
              </p>
              <button type="button" onClick={() => inputRef.current?.click()} className="text-label font-bold text-primary">
                다른 영상
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 text-foreground active:scale-[0.99]"
          >
            <Film className="h-8 w-8 text-primary" />
            <span className="text-body font-bold">영상 고르기</span>
            <span className="text-label text-muted-foreground">{UPLOAD_MAX_SEC}초까지 · 휴대폰에서 알맞게 줄여서 올려요</span>
          </button>
        )}

        <div>
          <p className="mb-2 text-label font-bold text-foreground">어떤 영상인가요</p>
          <div className="grid grid-cols-3 gap-2">
            {VIDEO_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={cn(
                  "h-11 rounded-xl border text-label font-bold transition-all",
                  kind === k.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={100}
          placeholder="한 줄 글 (예: 원투 미트 30초 · 오늘 처음 맞춰 봤어요)"
          className="h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        <Toggle
          on={share}
          onClick={() => setShare((v) => !v)}
          title={share ? "우리 지점 회원에게 공개" : "나만 보기"}
          sub={share ? "같은 지점 회원들이 「우리 지점」에서 봐요 · 나중에 바꿀 수 있어요" : "나와 코치님만 봐요"}
        />
        <Toggle
          on={feedback}
          onClick={() => setFeedback((v) => !v)}
          title="코치님 피드백 받기"
          sub="코치님께 알림이 가고, 장면마다 피드백이 와요"
        />

        <button
          type="button"
          onClick={() => setOthersOk((v) => !v)}
          className="flex w-full items-start gap-2.5 rounded-2xl border border-border bg-card p-3 text-left"
        >
          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md", othersOk ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {othersOk && <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>
          <span className="text-label leading-relaxed text-foreground">
            영상에 나온 다른 회원이 있다면, 올려도 된다고 허락받았어요 <span className="text-muted-foreground">(필수 · 허락 없이 찍힌 영상은 신고되면 바로 가려져요)</span>
          </span>
        </button>
        <p className="text-micro leading-relaxed text-muted-foreground">
          올린 영상은 90일 뒤 저절로 지워져요. 언제든 내 영상에서 지울 수 있어요.
        </p>
      </div>

      <div className="border-t border-border bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="h-14 w-full rounded-2xl bg-primary text-heading text-primary-foreground transition-all active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? `${busy.step}${busy.pct > 0 && busy.pct < 100 ? ` ${busy.pct}%` : "…"}` : !file ? "영상을 골라 주세요" : !othersOk ? "허락 확인을 눌러 주세요" : "올리기"}
        </button>
      </div>
    </div>
  );
};

const VideoUploadSheet = ({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (videoId: string) => void }) => {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<Body onClose={onClose} onDone={onDone} />, document.body);
};

export default VideoUploadSheet;
