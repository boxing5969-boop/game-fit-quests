/**
 * 🎥 훈련 영상 한 편 — 영상 · 코치 피드백(영상 시각 + 글) · 공개 켜기 (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 회원: 피드백 시각을 누르면 그 자리로 · 우리 지점 공개 켜기/끄기(스파링은 같이 나온 사람도 켜야 공개)
 *   · 코치 · 지점장(서버가 staff=true 로 알려 줌): 「여기서 피드백」(영상 멈추고 그 시각) · 오삼코치 초안 승인 · 숨기기 · 영상 내리기
 *   2026-11-26 회원 직접 올리기:
 *   · 올린 글(caption) · 내가 올린 영상 지우기 · 다른 회원 영상 신고(바로 가려지고 코치진에게 알림)
 *   · 신고로 가려진 영상: 올린 회원에게는 「코치님 확인 중」, 코치진에게는 신고 이유 + 다시 보이기 / 내리기
 *   타이머(z-115) 위에서도 열리므로 z-[120].
 */
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, MessageSquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { clockOf, kindLabel, whenLabel, type VideoKind } from "@/lib/sparringVideo";
import {
  SPARVID_KEY,
  addVideoComment,
  deleteMyVideo,
  moderateVideo,
  removeVideo,
  reportVideo,
  setVideoComment,
  setVideoShare,
  useVideoComments,
} from "@/services/sparringVideoService";
import SparringVideoPlayer, { type SparringPlayerHandle } from "./SparringVideoPlayer";

export interface SheetVideo {
  video_id: string;
  provider: string;
  external_id: string;
  kind?: VideoKind | null;
  title?: string | null;
  /** 회원이 올리며 쓴 한 줄 */
  caption?: string | null;
  recorded_at?: string | null;
  opponent_name?: string | null;
  /** 우리 지점 영상 — "김OO vs 박OO" · 올린 영상은 올린 사람 이름 */
  names?: string | null;
  /** false = 다른 회원 영상(우리 지점 · 코치 칸에서 엶) — 공개 단추 없이 */
  is_mine?: boolean | null;
  my_share_ok?: boolean | null;
  others_share_ok?: boolean | null;
  /** 내가 올린 영상 — 지우기 단추 */
  is_upload?: boolean | null;
  /** hidden = 신고로 가려짐(코치 확인 중) */
  status?: "ready" | "hidden" | null;
  /** 신고 이유 (코치 「신고」 칸에서 엶) */
  reasons?: string[] | null;
  /** 코치진이 엶 — 다른 회원 영상이어도 피드백을 불러온다(권한은 서버가 다시 본다) */
  staff_view?: boolean;
}

/** 신고 이유 — 고르기만 (서버는 200자까지 받는다) */
const REPORT_REASONS = ["허락 없이 찍혔어요", "보기 불편한 내용이에요", "그 밖"] as const;

interface Props {
  video: SheetVideo;
  onClose: () => void;
}

const Confirm = ({
  text,
  yes,
  onYes,
  onNo,
  busy,
}: {
  text: string;
  yes: string;
  onYes: () => void;
  onNo: () => void;
  busy?: boolean;
}) => (
  <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
    <p className="text-label text-foreground">{text}</p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={onNo} className="h-10 rounded-xl border border-border bg-card text-label font-bold text-foreground">
        그만두기
      </button>
      <button
        type="button"
        onClick={onYes}
        disabled={busy}
        className="h-10 rounded-xl bg-destructive text-label font-bold text-white disabled:opacity-50"
      >
        {busy ? "하는 중…" : yes}
      </button>
    </div>
  </div>
);

const Body = ({ video, onClose }: Props) => {
  useModalDismiss(true, onClose, { back: true });
  const qc = useQueryClient();
  const playerRef = useRef<SparringPlayerHandle>(null);
  const others = video.is_mine === false;
  const upload = video.provider === "storage";
  const hidden = video.status === "hidden";
  // 다른 회원 영상: 코치 피드백은 영상에 나온 회원 · 코치진에게만(서버도 막는다) — 코치진이 연 게 아니면 부르지 않는다
  const askFeedback = !others || !!video.staff_view;
  const { data, isLoading } = useVideoComments(askFeedback ? video.video_id : null);
  const staff = !!data?.staff;
  const comments = data?.comments ?? [];

  const [share, setShare] = useState<boolean>(!!video.my_share_ok);
  const [draftAt, setDraftAt] = useState<number | null | undefined>(undefined); // undefined = 글쓰기 닫힘
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "remove" | "delete" | "report">(null);
  const [reason, setReason] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: SPARVID_KEY });
  }, [qc]);

  /** 한 번 누르면 끝나는 일들(지우기 · 신고 · 내리기) — 성공하면 창을 닫는다 */
  const run = async (fn: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

  const who = video.names ?? (video.opponent_name ? `상대 ${video.opponent_name}` : "");

  return (
    <div role="dialog" aria-modal="true" aria-label="훈련 영상" className="fixed inset-0 z-[120] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-heading text-foreground">🎥 {kindLabel(video.kind ?? "sparring")} 영상</p>
          <p className="truncate text-label text-muted-foreground">
            {[whenLabel(video.recorded_at), who, others ? "" : (video.title ?? "")].filter(Boolean).join(" · ")}
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
        {hidden && staff && (
          <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-body font-bold text-foreground">🚩 신고로 가려 둔 영상이에요</p>
            {video.reasons && video.reasons.length > 0 && (
              <p className="text-label text-foreground">신고 이유: {Array.from(new Set(video.reasons)).join(" · ")}</p>
            )}
            <p className="text-label text-muted-foreground">영상을 보고 괜찮으면 다시 보이게 하고 문제가 있으면 내려 주세요.</p>
            {confirm === "remove" ? (
              <Confirm
                text="이 영상을 내려요. 올린 회원의 「내 영상」에서도 사라지고 되살릴 수 없어요."
                yes="내리기"
                busy={busy}
                onNo={() => setConfirm(null)}
                onYes={() => run(() => moderateVideo(video.video_id, "remove"), "영상을 내렸어요")}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => moderateVideo(video.video_id, "restore"), "다시 보이게 했어요")}
                  className="h-11 rounded-xl border border-border bg-card text-label font-bold text-foreground disabled:opacity-50"
                >
                  다시 보이기
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm("remove")}
                  className="h-11 rounded-xl bg-destructive text-label font-bold text-white disabled:opacity-50"
                >
                  내리기
                </button>
              </div>
            )}
          </div>
        )}
        {hidden && !staff && !isLoading && (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-label leading-relaxed text-foreground">
            신고가 들어와 잠시 가려 두었어요. 코치님이 확인한 뒤 다시 보이거나 내려가요.
          </p>
        )}

        <SparringVideoPlayer ref={playerRef} provider={video.provider} externalId={video.external_id} />

        {video.caption && <p className="whitespace-pre-wrap text-body text-foreground">{video.caption}</p>}

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

        {others && !staff ? (
          askFeedback && isLoading ? (
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label text-muted-foreground">
              {upload
                ? "회원님이 직접 올린 영상이에요 · 코치 피드백은 올린 회원에게만 보여요"
                : "같이 나온 회원 모두가 공개에 동의한 영상이에요 · 코치 피드백은 영상에 나온 회원에게만 보여요"}
            </p>
          )
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
                    className={cn(
                      "rounded-2xl border p-3",
                      c.status === "draft" ? "border-dashed border-amber-400 bg-amber-50" : "border-border bg-card",
                    )}
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

        {video.is_mine === true && (
          <button
            type="button"
            onClick={toggleShare}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-body font-bold text-foreground">우리 지점 회원에게 보여도 돼요</span>
              <span className="block text-label text-muted-foreground">
                {upload
                  ? "켜면 같은 지점 회원들이 「우리 지점」에서 봐요"
                  : `같이 나온 사람도 켜야 「우리 지점 영상」에 올라가요${
                      video.others_share_ok == null ? "" : video.others_share_ok ? " · 상대는 켰어요" : " · 상대는 아직"
                    }`}
              </span>
            </span>
            <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", share ? "bg-primary" : "bg-muted")}>
              <span
                className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", share ? "left-[1.375rem]" : "left-0.5")}
              />
            </span>
          </button>
        )}

        {/* 신고 — 다른 회원 영상 · 코치진은 신고 대신 바로 내린다 */}
        {others && !staff && !hidden && !isLoading && confirm !== "report" && (
          <button
            type="button"
            onClick={() => setConfirm("report")}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-label font-bold text-muted-foreground"
          >
            <Flag className="h-4 w-4" /> 신고하기
          </button>
        )}
        {confirm === "report" && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-label font-bold text-foreground">어떤 점이 문제인가요</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-label font-bold",
                    reason === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-micro text-muted-foreground">신고하면 영상이 바로 가려지고 코치님이 확인해요. 누가 신고했는지는 알리지 않아요.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setReason(null);
                }}
                className="h-10 rounded-xl border border-border bg-background text-label font-bold text-foreground"
              >
                그만두기
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={() => reason && run(() => reportVideo(video.video_id, reason), "신고했어요 · 영상을 가리고 코치님께 알렸어요")}
                className="h-10 rounded-xl bg-destructive text-label font-bold text-white disabled:opacity-40"
              >
                {busy ? "보내는 중…" : "신고하기"}
              </button>
            </div>
          </div>
        )}

        <p className="text-micro leading-relaxed text-muted-foreground">
          {upload
            ? `앱 안에서만 보이는 영상이에요. 캡처하거나 내려받아 다른 곳에 올리지 말아 주세요.${
                video.is_upload ? " 올린 날부터 90일 뒤 저절로 지워져요." : ""
              }`
            : `유튜브 일부공개 영상이에요. 링크를 가진 사람은 누구나 볼 수 있으니 링크를 다른 곳에 올리지 말아 주세요.${
                others ? " 다른 회원님 영상이니 캡처해서 퍼 나르지 말아 주세요." : " 영상을 내리고 싶으면 코치님께 말씀해 주세요."
              }`}
        </p>

        {video.is_upload &&
          (confirm === "delete" ? (
            <Confirm
              text="이 영상을 지워요. 지운 영상은 되살릴 수 없어요."
              yes="지우기"
              busy={busy}
              onNo={() => setConfirm(null)}
              onYes={() => run(() => deleteMyVideo(video.video_id), "영상을 지웠어요")}
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              className="w-full py-2 text-center text-label font-bold text-destructive"
            >
              내 영상 지우기
            </button>
          ))}

        {staff &&
          !hidden &&
          !video.is_upload &&
          (confirm === "remove" ? (
            <Confirm
              text={
                upload
                  ? "앱에서 이 영상을 내려요. 올린 회원의 「내 영상」에서도 사라져요."
                  : "앱에서 이 영상을 내려요. 유튜브 스튜디오에서도 꼭 지워 주세요."
              }
              yes="내리기"
              busy={busy}
              onNo={() => setConfirm(null)}
              onYes={() =>
                run(
                  () => removeVideo(video.video_id, "코치가 내림"),
                  upload ? "앱에서 내렸어요" : "앱에서 내렸어요 · 유튜브 스튜디오에서도 지워 주세요",
                )
              }
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("remove")}
              className="w-full py-2 text-center text-label font-bold text-destructive"
            >
              {upload ? "영상 내리기" : "영상 내리기 (동의 철회 · 잘못 올림)"}
            </button>
          ))}
      </div>
    </div>
  );
};

const SparringVideoSheet = ({ video, onClose }: { video: SheetVideo | null; onClose: () => void }) => {
  if (!video || typeof document === "undefined") return null;
  return createPortal(<Body key={video.video_id} video={video} onClose={onClose} />, document.body);
};

export default SparringVideoSheet;
