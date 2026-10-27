/**
 * 🏆 지점장 심사함 — 타이틀매치 도전 기록 칸 (2026-10-14 대표님: "심사를 진행하는 지점장은 영상 촬영 후 앱에 업로드").
 *
 *   · 도전마다: 영상(앱으로 촬영 또는 찍어 둔 영상) → 합격·불합격 → 한마디(선택) → 올리기
 *   · 합격이면 서버가 레벨 10 심사 항목을 모두 통과로 남기고 바로 다음 리그로 승급 (기존 승인 경로 approve_level_review)
 *   · 불합격 3번이면 이번 신청은 끝 — 회원은 7일 뒤(한국 날짜)부터 다시 신청
 *   · 회원이 앱에서 신청하지 않았어도 지점장이 바로 시작할 수 있다 (잠금은 서버가 지킨다)
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
  TITLE_VIDEO_MAX_BYTES,
  attemptsUsed,
  formatKoMonthDay,
  formatKoShortDateTime,
  formatMb,
  nextLeagueKo,
  openChallenge,
  videoContentType,
} from "@/lib/titleMatchChallenge";
import { cn } from "@/lib/utils";
import TitleAttemptList, { AttemptDots } from "./TitleAttemptList";
import VideoRecorderSheet from "./VideoRecorderSheet";

const FAIL_NOTES = ["가드가 내려가요", "3번 연속이 끊겼어요", "자세가 흔들려요", "미트 받아주기 보완"];
const PASS_NOTES = ["완벽해요! 축하해요 🎉"];

interface Clip {
  blob: Blob;
  contentType: string;
  url: string;
}

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
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [clip, setClip] = useState<Clip | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  // 미리보기 주소는 바뀌거나 닫힐 때 풀어 준다
  useEffect(() => () => {
    if (clip) URL.revokeObjectURL(clip.url);
  }, [clip]);

  const moves = titleVideos.filter((v) => v.league === rank).map((v) => parseVideoTitle(v.title).name || v.title);
  const max = state?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const open = openChallenge(state);
  const used = attemptsUsed(open);
  const nextNo = used + 1;
  const locked = !open && !!state?.retryAt;
  const cleared = !!state?.cleared;
  const shownAttempts = open?.attempts ?? (locked ? state?.challenge?.attempts ?? [] : []);
  const next = nextLeagueKo(rank);

  const takeClip = (blob: Blob, contentType: string) => {
    if (blob.size > TITLE_VIDEO_MAX_BYTES) {
      toast.error(`영상이 너무 커요 (${formatMb(blob.size)})`, {
        description: "50MB까지 올릴 수 있어요. '앱으로 촬영'을 쓰면 작게 저장돼요.",
      });
      return;
    }
    setClip({ blob, contentType, url: URL.createObjectURL(blob) });
    setVerdict(null);
    setNote("");
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
    takeClip(f, ct);
  };

  const submit = () => {
    if (!clip || verdict === null) return;
    record.mutate(
      { memberId, video: clip.blob, contentType: clip.contentType, passed: verdict, note },
      {
        onSuccess: (r) => {
          setClip(null);
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

  return (
    <div className="mb-3 rounded-xl border border-reward/30 bg-reward/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-micro font-black text-foreground">🏆 타이틀매치 심사 · 영상</p>
        <AttemptDots attempts={shownAttempts} max={max} />
      </div>

      <p className="text-micro leading-relaxed text-foreground">
        아래 동작을 <b>완벽한 자세로 3번 연속 성공</b> → 똑같은 동작을 <b>파트너에게 미트로 3번 받아주기</b>.
        한 번에 찍어 올려요 · 도전 {max}번까지
      </p>
      {moves.length > 0 && (
        <ol className="mt-1.5 space-y-0.5">
          {moves.map((m, i) => (
            <li key={i} className="truncate text-micro text-muted-foreground">
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
        clip ? (
          <div className="mt-3 space-y-2.5">
            <video src={clip.url} controls playsInline className="max-h-64 w-full rounded-xl bg-black" />
            <div className="flex items-center justify-between text-micro text-muted-foreground">
              <span>
                도전 {nextNo}/{max} 영상 · {formatMb(clip.blob.size)}
              </span>
              <button
                type="button"
                onClick={() => setClip(null)}
                disabled={record.isPending}
                className="font-bold text-foreground underline underline-offset-2 disabled:opacity-50"
              >
                다시 찍기
              </button>
            </div>

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
              disabled={verdict === null || record.isPending}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-label font-black transition-all active:scale-[0.98] disabled:opacity-40",
                verdict === true ? "bg-status-complete text-white" : "bg-primary text-primary-foreground",
              )}
            >
              {record.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 영상 올리는 중… 화면을 닫지 마세요
                </>
              ) : verdict === null ? (
                "합격·불합격을 골라 주세요"
              ) : verdict ? (
                `도전 ${nextNo}/${max} 합격으로 올리기 · ${next} 리그로 승급`
              ) : (
                `도전 ${nextNo}/${max} 불합격으로 올리기`
              )}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecorderOpen(true)}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-label font-black text-primary-foreground transition-all active:scale-95"
              >
                <Video className="h-4 w-4" /> 앱으로 촬영
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-card text-label font-black text-foreground ring-1 ring-border transition-all active:scale-95"
              >
                <FolderOpen className="h-4 w-4" /> 찍어 둔 영상
              </button>
            </div>
            <p className="mt-1.5 text-center text-micro text-muted-foreground">
              도전 {nextNo}/{max} · 앱 촬영은 작게 저장돼요 (찍어 둔 영상은 50MB까지)
            </p>
          </div>
        )
      ) : null}

      <input ref={fileRef} type="file" accept="video/*" className="hidden" aria-hidden="true" tabIndex={-1} onChange={onPickFile} />
      <VideoRecorderSheet
        open={recorderOpen}
        title={`${nickname} · 도전 ${nextNo}/${max}`}
        onClose={() => setRecorderOpen(false)}
        onRecorded={(blob, ct) => {
          setRecorderOpen(false);
          takeClip(blob, ct);
        }}
      />
    </div>
  );
};

export default TitleMatchJudgePanel;
