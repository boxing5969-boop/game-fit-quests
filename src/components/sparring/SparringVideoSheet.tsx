/**
 * 🎥 스파링 영상 한 편 — 영상 · 코치 피드백(영상 시각 + 글) · 회원 공개 동의 (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 회원: 피드백 시각을 누르면 그 자리로 · 커뮤니티 공개 켜기/끄기(같이 나온 사람도 켜야 공개)
 *   · 코치 · 지점장(서버가 staff=true 로 알려 줌): 「여기서 피드백」(영상 멈추고 그 시각) · 오삼코치 초안 승인 · 숨기기 · 영상 내리기
 *   타이머(z-115) 위에서도 열리므로 z-[120].
 */
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { clockOf, whenLabel } from "@/lib/sparringVideo";
import {
  SPARVID_KEY,
  addVideoComment,
  removeVideo,
  setVideoComment,
  setVideoShare,
  useVideoComments,
} from "@/services/sparringVideoService";
import SparringVideoPlayer, { type SparringPlayerHandle } from "./SparringVideoPlayer";

export interface SheetVideo {
  video_id: string;
  provider: string;
  external_id: string;
  title?: string | null;
  recorded_at?: string | null;
  opponent_name?: string | null;
  /** 우리 지점 영상 — "김OO vs 박OO" */
  names?: string | null;
  /** false = 다른 회원 영상(우리 지점 영상에서 엶) — 피드백 · 공개 단추 없이 영상만 */
  is_mine?: boolean | null;
  my_share_ok?: boolean | null;
  others_share_ok?: boolean | null;
}

interface Props {
  video: SheetVideo;
  onClose: () => void;
}

const Body = ({ video, onClose }: Props) => {
  useModalDismiss(true, onClose, { back: true });
  const qc = useQueryClient();
  const playerRef = useRef<SparringPlayerHandle>(null);
  // 다른 회원 영상: 코치 피드백은 영상에 나온 회원 · 코치진에게만(서버도 막는다) — 부르지 않는다
  const others = video.is_mine === false;
  const { data, isLoading } = useVideoComments(others ? null : video.video_id);
  const staff = !!data?.staff;
  const comments = data?.comments ?? [];

  const [share, setShare] = useState<boolean>(!!video.my_share_ok);
  const [draftAt, setDraftAt] = useState<number | null | undefined>(undefined); // undefined = 글쓰기 닫힘
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: SPARVID_KEY });
  }, [qc]);

  const openComposer = () => {
    playerRef.current?.pause();
    const t = playerRef.current?.now();
    setDraftAt(t == null ? null : Math.round(t * 10) / 10);
  };

  const save = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addVideoComment(video.video_id, draftAt ?? null, body);
      setText("");
      setDraftAt(undefined);
      toast.success("피드백을 보냈어요 · 회원님께 알림이 가요");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async () => {
    const next = !share;
    setShare(next);
    try {
      await setVideoShare(video.video_id, next);
      refresh();
    } catch (e) {
      setShare(!next);
      toast.error((e as Error).message);
    }
  };

  const act = async (id: string, action: "approve" | "hide") => {
    try {
      await setVideoComment(id, action);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async () => {
    try {
      await removeVideo(video.video_id, "코치가 내림");
      toast.success("앱에서 내렸어요 · 유튜브 스튜디오에서도 지워 주세요");
      refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="스파링 영상" className="fixed inset-0 z-[120] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-heading text-foreground">🥊 스파링 영상</p>
          <p className="truncate text-label text-muted-foreground">
            {[
              whenLabel(video.recorded_at),
              video.names ?? (video.opponent_name ? `상대 ${video.opponent_name}` : ""),
              others ? "" : (video.title ?? ""),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <SparringVideoPlayer ref={playerRef} provider={video.provider} externalId={video.external_id} />

        {staff && draftAt === undefined && (
          <button
            type="button"
            onClick={openComposer}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.99]"
          >
            <MessageSquarePlus className="h-5 w-5" /> 여기서 피드백
          </button>
        )}
        {staff && draftAt !== undefined && (
          <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-label font-bold text-foreground">
              {draftAt == null ? "피드백" : `${clockOf(draftAt)} 장면 피드백`}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="예: 원투 뒤에 오른손이 늦게 돌아와요 · 턱 당기고 가드 먼저"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftAt(undefined);
                  setText("");
                }}
                className="h-11 rounded-xl border border-border bg-card text-label font-bold text-foreground"
              >
                그만두기
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!text.trim() || busy}
                className="h-11 rounded-xl bg-primary text-label font-bold text-primary-foreground disabled:opacity-40"
              >
                {busy ? "보내는 중…" : "보내기"}
              </button>
            </div>
          </div>
        )}

        {others ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label text-muted-foreground">
            같이 나온 회원 모두가 공개에 동의한 영상이에요 · 코치 피드백은 영상에 나온 회원에게만 보여요
          </p>
        ) : (
        <div>
          <p className="mb-2 text-body font-bold text-foreground">코치 피드백 {comments.length > 0 ? comments.length : ""}</p>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          ) : comments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label text-muted-foreground">
              {staff ? "아직 피드백이 없어요 · 영상을 보다가 「여기서 피드백」을 눌러 주세요" : "코치님 피드백이 오면 알림으로 알려 드릴게요"}
            </p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-2xl border p-3 ${c.status === "draft" ? "border-dashed border-amber-400 bg-amber-50" : "border-border bg-card"}`}
                >
                  <div className="flex items-start gap-2">
                    {c.t_sec != null && (
                      <button
                        type="button"
                        onClick={() => playerRef.current?.seek(Math.max(0, Number(c.t_sec) - 2))}
                        className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-label font-bold text-primary active:scale-95"
                        aria-label={`${clockOf(c.t_sec)} 장면으로`}
                      >
                        ▶ {clockOf(c.t_sec)}
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-body text-foreground">{c.body}</p>
                      <p className="mt-1 text-micro text-muted-foreground">
                        {c.author}
                        {c.status === "draft" ? " · 회원에게 아직 안 보여요" : ""}
                      </p>
                    </div>
                  </div>
                  {staff && (
                    <div className="mt-2 flex justify-end gap-2">
                      {c.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => act(c.id, "approve")}
                          className="h-8 rounded-full bg-primary px-3 text-micro font-bold text-primary-foreground"
                        >
                          승인해서 보내기
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => act(c.id, "hide")}
                        className="h-8 rounded-full bg-secondary px-3 text-micro font-bold text-foreground"
                      >
                        숨기기
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {!others && !staff && !isLoading && (
          <button
            type="button"
            onClick={toggleShare}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-body font-bold text-foreground">우리 지점 회원에게 보여도 돼요</span>
              <span className="block text-label text-muted-foreground">
                같이 나온 사람도 켜야 「우리 지점 영상」에 올라가요
                {video.others_share_ok == null ? "" : video.others_share_ok ? " · 상대는 켰어요" : " · 상대는 아직"}
              </span>
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${share ? "bg-primary" : "bg-muted"}`}>
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${share ? "left-[1.375rem]" : "left-0.5"}`}
              />
            </span>
          </button>
        )}

        <p className="text-micro leading-relaxed text-muted-foreground">
          유튜브 일부공개 영상이에요. 링크를 가진 사람은 누구나 볼 수 있으니 링크를 다른 곳에 올리지 말아 주세요.
          {others ? " 다른 회원님 영상이니 캡처해서 퍼 나르지 말아 주세요." : " 영상을 내리고 싶으면 코치님께 말씀해 주세요."}
        </p>

        {staff &&
          (confirmRemove ? (
            <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-label text-foreground">앱에서 이 영상을 내려요. 유튜브 스튜디오에서도 꼭 지워 주세요.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="h-10 rounded-xl border border-border bg-card text-label font-bold text-foreground"
                >
                  그만두기
                </button>
                <button type="button" onClick={remove} className="h-10 rounded-xl bg-destructive text-label font-bold text-white">
                  내리기
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="w-full py-2 text-center text-label font-bold text-destructive"
            >
              영상 내리기 (동의 철회 · 잘못 올림)
            </button>
          ))}
      </div>
    </div>
  );
};

const SparringVideoSheet = ({ video, onClose }: { video: SheetVideo | null; onClose: () => void }) => {
  if (!video || typeof document === "undefined") return null;
  return createPortal(<Body video={video} onClose={onClose} />, document.body);
};

export default SparringVideoSheet;
