/**
 * 📘 153 매뉴얼 — 한 장 읽기 (화면 전체, 엄지로 좌우 넘기기)
 *
 *   쪽 순서 = 장 표지 → 카드 → 오늘 한 가지 → 확인 문제(문제마다 한 쪽) → 서명(필독) 또는 끝 — lib/coachManual/progress readerPages
 *   · 확인 문제는 맞힐 때까지 다시 고른다(틀린 횟수 = quiz_tries) — 3개 다 맞혀야 서명 단추가 열린다(대표님 11/08 「오케이」)
 *   · 이미 지금 판에 서명한 장은 문제를 건너뛰어도 된다(다시 읽기)
 *   · 영상 = 회원 앱 「153 영상」 미션 영상(missions — 읽기만) · 글씨 크게(기기에 기억 `153manual:big`)
 *   · 뒤로 가기 · Esc · ✕ 로 닫힌다(주소 ?ch= 는 ManualTab 이 맡는다)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Type, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useLevelVideosByIds } from "@/hooks/useLevelVideos";
import { overlayVariants } from "@/lib/missionVideos";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import { manualImg, type ManualBook, type ManualChapter, type ManualRead } from "@/lib/coachManual/types";
import { chapterState, latestRead, manualDate, nextChapter, readerPages } from "@/lib/coachManual/progress";
import { useManualSign } from "@/services/coachManualService";
import { ManualBlockView, ManualInline } from "./ManualBlocks";

const BIG_KEY = "153manual:big";
const readBig = () => {
  try {
    return localStorage.getItem(BIG_KEY) === "1";
  } catch {
    return false;
  }
};

interface Props {
  book: ManualBook;
  chapter: ManualChapter;
  reads: ManualRead[];
  reviewer: boolean;
  offline: boolean;
  onClose: () => void;
  onOpenChapter: (id: string) => void;
}

export default function ManualReader({ book, chapter, reads, reviewer, offline, onClose, onOpenChapter }: Props) {
  const pages = useMemo(() => readerPages(chapter), [chapter]);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [picks, setPicks] = useState<Array<number | null>>(() => chapter.quiz.map(() => null));
  const [wrong, setWrong] = useState<Array<number | null>>(() => chapter.quiz.map(() => null));
  const [tries, setTries] = useState(0);
  const [big, setBig] = useState(readBig);
  const [playing, setPlaying] = useState<OverlayVideo | null>(null);
  // Esc · 뒤로 — 영상 창이 떠 있으면 영상 창만 닫힌다(VideoOverlay 가 맡음)
  useModalDismiss(true, () => {
    if (!playing) onClose();
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const sign = useManualSign(book.id);

  // 장이 바뀌면 처음부터
  useEffect(() => {
    setPage(0);
    setDir(1);
    setPicks(chapter.quiz.map(() => null));
    setWrong(chapter.quiz.map(() => null));
    setTries(0);
    sign.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, chapter.id]);

  const last = latestRead(reads, chapter.id);
  const signedNow = !!last && last.version >= chapter.version;
  const state = chapterState(book, reads, chapter.id, { reviewer });
  const cur = pages[Math.min(page, pages.length - 1)];
  const quizDone = chapter.quiz.every((q, i) => picks[i] === q.answer);
  const canNext =
    page < pages.length - 1 && (cur.kind !== "quiz" || signedNow || picks[cur.index] === chapter.quiz[cur.index].answer);
  const next = nextChapter(book, chapter.id);

  const go = (to: number) => {
    if (to < 0 || to >= pages.length || to === page) return;
    if (to > page && !canNext) return;
    setDir(to > page ? 1 : -1);
    setPage(to);
  };

  // 키보드(PC) — ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (playing) return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 영상 — 이 장에 나오는 미션 영상만 미리 받는다
  const videoIds = useMemo(
    () => [...new Set(chapter.cards.flatMap((c) => c.blocks.flatMap((b) => (b.t === "video" ? [b.missionId] : []))))],
    [chapter],
  );
  const { data: videos = [] } = useLevelVideosByIds(videoIds);
  const play = (missionId: string, title: string) => {
    const v = videos.find((x) => x.id === missionId);
    if (!v) {
      toast.message("영상을 불러오지 못했어요", { description: "회원 앱 「153 영상」 1일차에서도 볼 수 있어요" });
      return;
    }
    setPlaying({ url: v.videoUrl, title: title || v.title, variants: overlayVariants(v.variants) });
  };

  const pick = (qi: number, oi: number) => {
    if (picks[qi] === chapter.quiz[qi].answer) return; // 이미 맞힘
    if (oi === chapter.quiz[qi].answer) {
      setPicks((p) => p.map((x, i) => (i === qi ? oi : x)));
      setWrong((w) => w.map((x, i) => (i === qi ? null : x)));
    } else {
      setTries((t) => t + 1);
      setWrong((w) => w.map((x, i) => (i === qi ? oi : x)));
    }
  };

  const doSign = () => {
    sign.mutate(
      { chapter: chapter.id, version: chapter.version, tries },
      {
        onSuccess: (res) => {
          if (res.offline) toast.success("서명했어요 · 지금은 이 휴대폰에만 남아요");
          else toast.success(`${chapter.no} 서명했어요`);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const signedJust = sign.isSuccess;
  const signedAt = last?.signed_at ?? null;
  const label = `${page + 1} / ${pages.length}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${book.no} ${chapter.no} ${chapter.title}`}
      className="fixed inset-0 z-[115] flex flex-col bg-background"
    >
      {/* 머리 — 닫기 · 몇 장 몇 쪽 · 글씨 크게 */}
      <div className="shrink-0 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary active:scale-95"
          >
            <X className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-label font-black text-foreground">
              {chapter.no} · {chapter.title}
            </p>
            <p className="text-micro font-bold tabular-nums text-muted-foreground">{label}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const v = !big;
              setBig(v);
              try {
                localStorage.setItem(BIG_KEY, v ? "1" : "0");
              } catch {
                /* 저장 실패는 무시 */
              }
            }}
            aria-pressed={big}
            aria-label={big ? "글씨 보통으로" : "글씨 크게"}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-95",
              big ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
            )}
          >
            <Type className="h-5 w-5" />
          </button>
        </div>
        <div className="h-1 w-full bg-secondary" aria-hidden>
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((page + 1) / pages.length) * 100}%` }} />
        </div>
      </div>

      {/* 쪽 */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? page + 1 : page - 1);
        }}
      >
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={`${chapter.id}-${page}`}
            custom={dir}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -36 }}
            transition={{ duration: 0.18 }}
            className="mx-auto w-full max-w-md px-5 pb-8 pt-5"
          >
            {cur.kind === "cover" && (
              <div className="space-y-4">
                {chapter.image ? (
                  <img
                    src={manualImg(chapter.image)}
                    alt=""
                    className="block aspect-[4/3] w-full rounded-3xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-secondary">
                    <span className="text-display font-black text-foreground">{chapter.no}</span>
                  </div>
                )}
                <div>
                  <p className="text-label font-black text-primary">
                    {book.no} · {chapter.no}
                  </p>
                  <h2 className="mt-1 text-title font-black text-foreground">{chapter.title}</h2>
                  {chapter.gain && (
                    <p className={cn(big ? "text-heading font-normal leading-8" : "text-body leading-7", "mt-2 text-muted-foreground")}>
                      <ManualInline text={chapter.gain} />
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {chapter.minutes > 0 && (
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">{chapter.minutes}분</span>
                  )}
                  {chapter.quiz.length > 0 && (
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">
                      확인 문제 {chapter.quiz.length}개
                    </span>
                  )}
                  {chapter.required && signedNow && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-label font-black text-primary">
                      <Check className="h-4 w-4" /> {manualDate(signedAt)} 서명
                    </span>
                  )}
                  {state === "resign" && (
                    <span className="rounded-full bg-reward/15 px-3 py-1.5 text-label font-black text-reward">새 판 · 다시 서명</span>
                  )}
                </div>
                <p className="text-label text-muted-foreground">옆으로 넘기거나 아래 「다음」을 눌러요</p>
              </div>
            )}

            {cur.kind === "card" && (
              <div className="space-y-4">
                {chapter.cards[cur.index].title && (
                  <h3 className="text-heading font-black text-foreground">{chapter.cards[cur.index].title}</h3>
                )}
                {chapter.cards[cur.index].blocks.map((b, i) => (
                  <ManualBlockView key={i} block={b} big={big} onPlay={play} />
                ))}
              </div>
            )}

            {cur.kind === "today" && chapter.today && (
              <div className="space-y-4">
                <p className="text-label font-black text-primary">오늘 한 가지</p>
                <div className="rounded-3xl bg-foreground p-6 text-background">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Check className="h-5 w-5 text-primary-foreground" />
                  </span>
                  <p className="text-heading font-black leading-8">{chapter.today}</p>
                </div>
                <p className="text-label text-muted-foreground">다음 수업에서 이것 하나만 해 봐요</p>
              </div>
            )}

            {cur.kind === "quiz" && (
              <QuizPage
                index={cur.index}
                total={chapter.quiz.length}
                q={chapter.quiz[cur.index]}
                picked={picks[cur.index]}
                wrongPick={wrong[cur.index]}
                big={big}
                onPick={(oi) => pick(cur.index, oi)}
                skippable={signedNow}
              />
            )}

            {cur.kind === "sign" && (
              <div className="space-y-4 pt-2">
                <p className="text-label font-black text-primary">
                  {chapter.no} 끝 · {book.no}
                </p>
                <h3 className="text-title font-black text-foreground">
                  {signedNow ? "서명한 장이에요" : "읽고 이해했나요?"}
                </h3>
                {chapter.quiz.length > 0 && !signedNow && (
                  <p className="text-body text-muted-foreground">
                    {quizDone
                      ? `확인 문제 ${chapter.quiz.length}개를 모두 맞혔어요${tries > 0 ? ` · 다시 고른 횟수 ${tries}번` : ""}`
                      : "확인 문제를 모두 맞히면 서명할 수 있어요"}
                  </p>
                )}
                {signedNow ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                      <Check className="h-5 w-5 text-primary-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body font-black text-foreground">{manualDate(signedAt)} 서명</p>
                      <p className="text-label text-muted-foreground">
                        {signedJust && offline ? "지금은 이 휴대폰에만 남아요" : "읽음 현황에 남았어요"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!quizDone || sign.isPending}
                    onClick={doSign}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-40"
                  >
                    <Check className="h-5 w-5" /> {sign.isPending ? "서명하는 중…" : "읽고 이해했어요 — 서명"}
                  </button>
                )}
                {state === "resign" && !signedNow && (
                  <p className="text-label font-bold text-reward">글이 바뀐 새 판이에요 · 한 번 더 서명해 주세요</p>
                )}
                {signedNow && next && (
                  <button
                    type="button"
                    onClick={() => onOpenChapter(next.id)}
                    className="flex h-14 w-full items-center justify-between rounded-2xl border border-border bg-card px-4 text-left active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block text-label font-bold text-muted-foreground">다음 장</span>
                      <span className="block truncate text-body font-black text-foreground">
                        {next.no} · {next.title}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {signedNow && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-12 w-full rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.99]"
                  >
                    목차로
                  </button>
                )}
                {!next && book.signature && signedNow && (
                  <p className="pt-2 text-center text-label font-black text-muted-foreground">{book.signature}</p>
                )}
              </div>
            )}

            {cur.kind === "end" && (
              <div className="space-y-4 pt-2">
                <h3 className="text-title font-black text-foreground">{chapter.no} 끝</h3>
                {book.signature && <p className="text-body font-black text-muted-foreground">{book.signature}</p>}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 w-full rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.99]"
                >
                  목차로
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 아래 — 이전 · 다음 */}
      <div className="shrink-0 border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-md gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={page === 0}
            aria-label="이전 쪽"
            className="flex h-12 w-24 items-center justify-center gap-1 rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" /> 이전
          </button>
          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={!canNext}
            aria-label="다음 쪽"
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.98] disabled:opacity-40"
          >
            {cur.kind === "quiz" && !canNext && page < pages.length - 1 ? "맞히면 넘어가요" : page >= pages.length - 1 ? "마지막 쪽" : "다음"}
            {canNext && <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <VideoOverlay video={playing} onClose={() => setPlaying(null)} />
    </div>,
    document.body,
  );
}

function QuizPage({
  index,
  total,
  q,
  picked,
  wrongPick,
  big,
  onPick,
  skippable,
}: {
  index: number;
  total: number;
  q: ManualChapter["quiz"][number];
  picked: number | null;
  wrongPick: number | null;
  big: boolean;
  onPick: (oi: number) => void;
  skippable: boolean;
}) {
  const solved = picked === q.answer;
  const ox = q.options.length === 2 && q.options.every((o) => o === "O" || o === "X");
  return (
    <div className="space-y-4">
      <p className="text-label font-black text-primary">
        확인 문제 {index + 1}/{total}
        {ox && <span className="ml-1.5 text-muted-foreground">· O / X</span>}
      </p>
      <h3 className={cn(big ? "text-title" : "text-heading", "font-black leading-snug text-foreground")}>
        <ManualInline text={q.q} />
      </h3>
      <div className={cn(ox ? "grid grid-cols-2 gap-2" : "space-y-2")} role="radiogroup" aria-label="보기">
        {q.options.map((o, oi) => {
          const isRight = solved && oi === q.answer;
          const isWrong = !solved && wrongPick === oi;
          return (
            <motion.button
              key={oi}
              type="button"
              role="radio"
              aria-checked={isRight}
              onClick={() => onPick(oi)}
              animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "w-full rounded-2xl border-2 px-4 text-left font-bold transition-colors active:scale-[0.99]",
                ox ? "flex h-20 items-center justify-center text-title" : cn("py-3.5", big ? "text-heading" : "text-body"),
                isRight
                  ? "border-primary bg-primary/10 text-foreground"
                  : isWrong
                    ? "border-destructive bg-destructive/5 text-foreground"
                    : solved
                      ? "border-border bg-card text-muted-foreground"
                      : "border-border bg-card text-foreground",
              )}
            >
              <ManualInline text={o} />
            </motion.button>
          );
        })}
      </div>
      {solved ? (
        <div className="rounded-2xl bg-primary/10 px-4 py-3">
          <p className="text-body font-black text-primary">맞았어요</p>
          <p className="mt-1 text-body leading-relaxed text-foreground">{q.why}</p>
        </div>
      ) : wrongPick !== null ? (
        <p className="text-body font-bold text-destructive">다시 골라 보세요</p>
      ) : skippable ? (
        <p className="text-label text-muted-foreground">서명한 장이라 넘어가도 돼요</p>
      ) : null}
    </div>
  );
}
