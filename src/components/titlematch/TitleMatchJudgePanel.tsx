/**
 * 🏆 지점장 심사함 — 타이틀매치 도전 기록 칸 (2026-10-14 대표님: "심사를 진행하는 지점장은 영상 촬영 후 앱에 업로드").
 *
 *   · 도전마다 영상 2개: ① 치는 영상(완벽한 자세로 3번 연속) ② 받는 영상(파트너에게 미트로 3번 받아주기)
 *     — 칸마다 앱으로 촬영 또는 찍어 둔 영상 → 합격·불합격 → 한마디(선택) → 올리기
 *     합격은 두 영상 모두 · 불합격은 치는 영상만으로도 (3번 연속이 안 되면 받기까지 못 간다) — 서버 record_title_match_attempt_v2 와 같은 규칙
 *     (2026-11-12 대표님 「영상도 2개 올려야해 치는거 받는거」)
 *   · 합격이면 서버가 레벨 10 심사 항목을 모두 통과로 남기고 바로 다음 리그로 승급 (기존 승인 경로 approve_level_review)
 *   · 불합격 3번이면 이번 신청은 끝 — 회원은 7일 뒤(한국 날짜)부터 다시 신청
 *   · 회원이 앱에서 신청하지 않았어도 지점장이 바로 시작할 수 있다 (잠금은 서버가 지킨다)
 *   · 50MB(저장소 한도)가 넘는 영상은 휴대폰 안에서 자동으로 줄여서 미리보기에 올린다 — src/lib/videoCompress.ts
 *     (2026-11-12 대표님 「영상올릴때 자동으로 압축해서 50mb이하로줄여줘」) · 한 번에 한 영상씩 줄인다
 * 심사 권한: 지점장·관장 (DB level_gate_authority — 화이트 레벨 10 = manager). 코치 화면에서는 기록만 본다.
 */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FolderOpen, Loader2, Lock, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordTitleAttempt, useTitleMatchState } from "@/hooks/useTitleMatchChallenge";
import { useTitleMatchVideos } from "@/hooks/useTitleMatchVideos";
import { parseVideoTitle } from "@/hooks/useLevelVideos";
import {
  DEFAULT_MAX_ATTEMPTS,
  TITLE_CLIPS,
  TITLE_CLIP_KINDS,
  TITLE_VIDEO_MAX_BYTES,
  attemptUploadBlocker,
  attemptsUsed,
  formatKoMonthDay,
  formatKoShortDateTime,
  formatMb,
  nextLeagueKo,
  openChallenge,
  videoContentType,
  type TitleClipKind,
} from "@/lib/titleMatchChallenge";
import { VideoCompressError, compressVideoToLimit, videoCompressErrorMessage } from "@/lib/videoCompress";
import { cn } from "@/lib/utils";
import TitleAttemptList, { AttemptDots } from "./TitleAttemptList";
import VideoRecorderSheet from "./VideoRecorderSheet";

const FAIL_NOTES = ["가드가 내려가요", "3번 연속이 끊겼어요", "자세가 흔들려요", "미트 받아주기 보완"];
const PASS_NOTES = ["완벽해요! 축하해요 🎉"];

interface Clip {
  blob: Blob;
  contentType: string;
  url: string;
  /** 자동으로 줄였으면 원래 크기 */
  originalBytes?: number;
}

type Clips = Record<TitleClipKind, Clip | null>;
const NO_CLIPS: Clips = { hit: null, receive: null };

/** 자동 줄이기 진행 — 어느 칸 · 몇 % · 몇 번째 시도 · 원래 크기 */
interface Shrink {
  kind: TitleClipKind;
  pct: number;
  attempt: number;
  fromBytes: number;
}

interface SlotProps {
  n: number;
  kind: TitleClipKind;
  clip: Clip | null;
  shrink: Shrink | null;
  /** 다른 칸을 줄이는 중 · 올리는 중 */
  disabled: boolean;
  onRecord: () => void;
  onPick: () => void;
  onClear: () => void;
  onCancelShrink: () => void;
}

/** 영상 한 칸 — 번호 · 이름 · 무엇을 찍는지, 그리고 (고르기 단추 | 줄이는 중 | 미리보기) */
const ClipSlot = ({ n, kind, clip, shrink, disabled, onRecord, onPick, onClear, onCancelShrink }: SlotProps) => {
  const info = TITLE_CLIPS[kind];
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-black text-background">
            {n}
          </span>
          <div className="min-w-0">
            <p className="text-label font-black text-foreground">{info.label}</p>
            <p className="text-label text-muted-foreground">{info.hint}</p>
          </div>
        </div>
        {clip && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="h-8 shrink-0 px-1 text-label font-bold text-foreground underline underline-offset-2 disabled:opacity-50"
          >
            다시 찍기
          </button>
        )}
      </div>

      {shrink ? (
        <div className="mt-2.5" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-label font-black text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {shrink.attempt > 1 ? "한 번 더 줄이는 중" : "영상 줄이는 중"} {shrink.pct}%
            </span>
            <button
              type="button"
              onClick={onCancelShrink}
              className="h-9 shrink-0 px-1 text-label font-bold text-muted-foreground underline underline-offset-2"
            >
              멈추기
            </button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.max(3, shrink.pct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-label text-muted-foreground">{formatMb(shrink.fromBytes)} → 50MB 아래로 · 화면을 켜 두세요</p>
        </div>
      ) : clip ? (
        <div className="mt-2.5">
          <video src={clip.url} controls playsInline className="max-h-56 w-full rounded-lg bg-black" />
          <p className="mt-1 text-label text-muted-foreground">
            {formatMb(clip.blob.size)}
            {clip.originalBytes ? ` (원래 ${formatMb(clip.originalBytes)})` : ""}
          </p>
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRecord}
            disabled={disabled}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-label font-black text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            <Video className="h-4 w-4" /> 앱으로 촬영
          </button>
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-card text-label font-black text-foreground ring-1 ring-border transition-all active:scale-95 disabled:opacity-40"
          >
            <FolderOpen className="h-4 w-4" /> 찍어 둔 영상
          </button>
        </div>
      )}
    </div>
  );
};

interface Props {
  memberId: string;
  nickname: string;
  rank: string;
}

const TitleMatchJudgePanel = ({ memberId, nickname, rank }: Props) => {
  const { role } = useAuth();
  // 화이트 타이틀매치 = 지점장·관장 (서버도 같은 조건으로 막는다)
  const canJudge = role === "super_admin" || role === "branch_manager";
  const { data: state, isLoading, isError, refetch } = useTitleMatchState(memberId);
  const { data: titleVideos = [] } = useTitleMatchVideos();
  const record = useRecordTitleAttempt();
  const fileRef = useRef<HTMLInputElement>(null);
  const pickKindRef = useRef<TitleClipKind>("hit");
  const [recorderFor, setRecorderFor] = useState<TitleClipKind | null>(null);
  const [clips, setClips] = useState<Clips>(NO_CLIPS);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [shrink, setShrink] = useState<Shrink | null>(null);
  const shrinkAbortRef = useRef<AbortController | null>(null);

  // 바뀐 칸의 미리보기 주소는 화면이 바뀐 뒤에 풀어 준다 (먼저 풀면 아직 붙어 있는 영상이 깨진 주소를 읽는다)
  const shownClipsRef = useRef<Clips>(NO_CLIPS);
  useEffect(() => {
    const prev = shownClipsRef.current;
    for (const k of TITLE_CLIP_KINDS) {
      const old = prev[k];
      if (old && old !== clips[k]) URL.revokeObjectURL(old.url);
    }
    shownClipsRef.current = clips;
  }, [clips]);

  // 화면을 떠나면 줄이던 것을 멈추고 남은 미리보기 주소를 풀어 준다
  useEffect(
    () => () => {
      shrinkAbortRef.current?.abort();
      for (const c of Object.values(shownClipsRef.current)) if (c) URL.revokeObjectURL(c.url);
    },
    [],
  );

  const moves = titleVideos.filter((v) => v.league === rank).map((v) => parseVideoTitle(v.title).name || v.title);
  const max = state?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const open = openChallenge(state);
  const used = attemptsUsed(open);
  const nextNo = used + 1;
  const locked = !open && !!state?.retryAt;
  const cleared = !!state?.cleared;
  const shownAttempts = open?.attempts ?? (locked ? state?.challenge?.attempts ?? [] : []);
  const next = nextLeagueKo(rank);
  const blocker = attemptUploadBlocker(verdict, !!clips.hit, !!clips.receive);

  /** 칸 하나 바꾸기 (옛 미리보기 주소는 위 effect 가 풀어 준다) */
  const putClip = (kind: TitleClipKind, nextClip: Clip | null) => setClips((prev) => ({ ...prev, [kind]: nextClip }));

  const showClip = (kind: TitleClipKind, blob: Blob, contentType: string, originalBytes?: number) =>
    putClip(kind, { blob, contentType, url: URL.createObjectURL(blob), originalBytes });

  // 50MB 넘는 영상 → 휴대폰 안에서 한도 아래 mp4 로 줄인 뒤 미리보기 (원본은 서버로 보내지 않는다)
  const shrinkThenShow = async (kind: TitleClipKind, blob: Blob) => {
    shrinkAbortRef.current?.abort();
    const ac = new AbortController();
    shrinkAbortRef.current = ac;
    setShrink({ kind, pct: 0, attempt: 1, fromBytes: blob.size });
    try {
      const r = await compressVideoToLimit(blob, {
        maxBytes: TITLE_VIDEO_MAX_BYTES,
        signal: ac.signal,
        // 프레임마다 불린다 — % 가 바뀔 때만 다시 그린다
        onProgress: (p, attempt) => {
          if (ac.signal.aborted) return;
          const pct = Math.min(99, Math.round(p * 100));
          setShrink((s) => (s && (s.pct !== pct || s.attempt !== attempt) ? { ...s, pct, attempt } : s));
        },
      });
      if (ac.signal.aborted) return;
      showClip(kind, r.blob, r.contentType, blob.size);
      toast.success(`${TITLE_CLIPS[kind].label}을 줄였어요 · ${formatMb(blob.size)} → ${formatMb(r.blob.size)}`);
    } catch (e) {
      if (ac.signal.aborted || (e instanceof VideoCompressError && e.code === "canceled")) return;
      toast.error(videoCompressErrorMessage(e), { description: "'앱으로 촬영'을 쓰면 처음부터 작게 저장돼요." });
    } finally {
      if (shrinkAbortRef.current === ac) {
        shrinkAbortRef.current = null;
        setShrink(null);
      }
    }
  };

  const cancelShrink = () => {
    shrinkAbortRef.current?.abort();
    shrinkAbortRef.current = null;
    setShrink(null);
  };

  const takeClip = (kind: TitleClipKind, blob: Blob, contentType: string) => {
    if (blob.size > TITLE_VIDEO_MAX_BYTES) {
      void shrinkThenShow(kind, blob);
      return;
    }
    showClip(kind, blob, contentType);
  };

  const pickFile = (kind: TitleClipKind) => {
    pickKindRef.current = kind;
    fileRef.current?.click();
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ct = videoContentType(f);
    if (!ct) {
      toast.error("영상 파일만 올릴 수 있어요 (mp4·mov·webm)");
      return;
    }
    takeClip(pickKindRef.current, f, ct);
  };

  const submit = () => {
    const { hit, receive } = clips;
    if (blocker || !hit || verdict === null) return;
    record.mutate(
      {
        memberId,
        hit: { blob: hit.blob, contentType: hit.contentType },
        receive: receive ? { blob: receive.blob, contentType: receive.contentType } : null,
        passed: verdict,
        note,
      },
      {
        onSuccess: (r) => {
          putClip("hit", null);
          putClip("receive", null);
          setVerdict(null);
          setNote("");
          if (r.result === "passed") {
            toast.success(`🎉 합격! ${nickname}님 ${r.promotion?.fast_track ? "다음 타이틀매치로 바로 갑니다" : `${next} 리그로 승급했어요`}`);
          } else if (r.result === "failed_final") {
            toast(`도전 ${r.attemptNo}/${r.maxAttempts} 마감`, {
              description: `${formatKoMonthDay(r.retryAt)}부터 다시 신청할 수 있어요 · 회원에게 알림이 갔어요`,
            });
          } else {
            toast(`도전 ${r.attemptNo}/${r.maxAttempts} 불합격으로 기록했어요`, {
              description: `남은 기회 ${r.attemptsLeft ?? 0}번 · 회원에게 알림이 갔어요`,
            });
          }
        },
        onError: (e) => toast.error((e as Error)?.message || "올리지 못했어요 — 다시 눌러 주세요"),
      },
    );
  };

  const recKind = recorderFor ?? "hit";

  return (
    <div className="mb-3 rounded-xl border border-reward/30 bg-reward/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-micro font-black text-foreground">🏆 타이틀매치 심사 · 영상</p>
        <AttemptDots attempts={shownAttempts} max={max} />
      </div>

      <p className="text-label leading-relaxed text-foreground">
        아래 동작을 <b>완벽한 자세로 3번 연속 성공</b> → 똑같은 동작을 <b>파트너에게 미트로 3번 받아주기</b>.
        치는 영상 · 받는 영상을 따로 올려요 · 도전 {max}번까지
      </p>
      {moves.length > 0 && (
        <ol className="mt-1.5 space-y-0.5">
          {moves.map((m, i) => (
            <li key={i} className="truncate text-label text-muted-foreground">
              {i + 1}. {m}
            </li>
          ))}
        </ol>
      )}

      {/* 지금 상태 */}
      <div className="mt-2.5 text-micro font-semibold">
        {isLoading ? (
          <span className="text-muted-foreground">불러오는 중…</span>
        ) : isError ? (
          <button type="button" onClick={() => refetch()} className="font-bold text-primary underline underline-offset-2">
            상태를 못 불러왔어요 — 다시 시도
          </button>
        ) : cleared ? (
          <span className="text-status-complete">통과한 타이틀매치입니다</span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> 도전 {max}번 마감 · {formatKoMonthDay(state?.retryAt)}부터 회원이 다시 신청할 수 있어요
          </span>
        ) : open ? (
          <span className="text-primary">
            {open.requestedBySelf ? `🙋 회원 신청 ${formatKoShortDateTime(open.requestedAt)}` : "심사 진행 중"} · 도전 {used}/{max}
          </span>
        ) : (
          <span className="text-muted-foreground">아직 회원 신청 전이에요 — 바로 심사를 시작해도 돼요</span>
        )}
      </div>

      <TitleAttemptList attempts={shownAttempts} max={max} className="mt-2" />

      {!canJudge ? (
        <p className="mt-2.5 rounded-lg bg-muted/50 px-2.5 py-2 text-micro font-semibold text-muted-foreground">
          이 타이틀매치는 지점장·관장님이 영상으로 심사해요
        </p>
      ) : !isLoading && !isError && !cleared && !locked ? (
        <div className="mt-3 space-y-2">
          {TITLE_CLIP_KINDS.map((kind, i) => (
            <ClipSlot
              key={kind}
              n={i + 1}
              kind={kind}
              clip={clips[kind]}
              shrink={shrink?.kind === kind ? shrink : null}
              disabled={record.isPending || (!!shrink && shrink.kind !== kind)}
              onRecord={() => setRecorderFor(kind)}
              onPick={() => pickFile(kind)}
              onClear={() => putClip(kind, null)}
              onCancelShrink={cancelShrink}
            />
          ))}
          <p className="text-center text-label text-muted-foreground">
            도전 {nextNo}/{max} · 50MB가 넘는 영상은 자동으로 줄여서 올려요
          </p>

          {clips.hit && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="심사 결과">
                <button
                  type="button"
                  role="radio"
                  aria-checked={verdict === true}
                  onClick={() => setVerdict(true)}
                  disabled={record.isPending}
                  className={cn(
                    "h-11 rounded-xl text-label font-black transition-all active:scale-95",
                    verdict === true ? "bg-status-complete text-white" : "bg-card text-foreground ring-1 ring-border",
                  )}
                >
                  ⭕ 합격
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={verdict === false}
                  onClick={() => setVerdict(false)}
                  disabled={record.isPending}
                  className={cn(
                    "h-11 rounded-xl text-label font-black transition-all active:scale-95",
                    verdict === false ? "bg-foreground text-background" : "bg-card text-foreground ring-1 ring-border",
                  )}
                >
                  ✖ 불합격
                </button>
              </div>

              {verdict !== null && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(verdict ? PASS_NOTES : FAIL_NOTES).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNote(n)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-micro transition-all active:scale-95",
                          note === n ? "border-primary bg-primary/10 font-bold text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 120))}
                    placeholder="한마디 (선택) — 회원 알림에 같이 가요"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-label text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!!blocker || record.isPending || !!shrink}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-label font-black transition-all active:scale-[0.98] disabled:opacity-40",
                  verdict === true ? "bg-status-complete text-white" : "bg-primary text-primary-foreground",
                )}
              >
                {record.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 영상 {clips.receive ? "2개 " : ""}올리는 중… 화면을 닫지 마세요
                  </>
                ) : blocker ? (
                  blocker
                ) : verdict ? (
                  `도전 ${nextNo}/${max} 합격으로 올리기 · ${next} 리그로 승급`
                ) : (
                  `도전 ${nextNo}/${max} 불합격으로 올리기`
                )}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <input ref={fileRef} type="file" accept="video/*" className="hidden" aria-hidden="true" tabIndex={-1} onChange={onPickFile} />
      <VideoRecorderSheet
        open={recorderFor !== null}
        title={`${nickname} · 도전 ${nextNo}/${max} · ${TITLE_CLIPS[recKind].label}`}
        hint={TITLE_CLIPS[recKind].recorderHint}
        onClose={() => setRecorderFor(null)}
        onRecorded={(blob, ct) => {
          setRecorderFor(null);
          takeClip(recKind, blob, ct);
        }}
      />
    </div>
  );
};

export default TitleMatchJudgePanel;
