/**
 * 🌱 오늘의 1분 성장 — 홈 (2026-10-27 대표님: "내가 공유한 정보를 복싱에 대입해서 오늘의 1분 성장 교육이라고 하고
 *   방향에 대해 알려주자")
 *   카드는 짧게(이름표 · 제목) — 누르면 아래에서 1분 이야기 + '오늘 하나' + 한 줄 다짐.
 *   2026-10-28 리디자인: 카드는 이름표 + 제목 한 줄 + › · 서랍 속 읽는 글은 본문 16px
 *   '오늘 하나 해 볼게요'를 누르면 이 기기에 오늘 날짜로 남겨 카드에 '오늘 실천 약속 완료' 표시.
 *   2026-11-16 날마다 새 글(0단계 — 대표님 「매일 똑같은 거만 있어서 식상해」): 오늘 해 볼 것이 하나면 번호 없이 '오늘 하나' ·
 *     사실을 다룬 글은 이야기 아래 '출처'(주소가 있으면 누르면 원문).
 *   2026-11-16 1단계(대표님 「다음」) — 새 카드 · 새 화면 없이 이 카드와 서랍 안에서:
 *     · 카드 이름표에 요일 코너 이름 (「오늘의 1분 성장 · 기술 한 끗」)
 *     · O/X 날은 카드 앞면이 문제 + O · X — 누르면 고른 답이 남고 서랍이 열리며 이야기가 나온다.
 *       서랍 안에서도 O · X 하나를 고르면 이야기가 열린다 (틀려도 나무라는 말 · 빨간 표시 없이 · 처음 고른 답만 남는다)
 *     · 제목 옆 ♥ — 숫자는 5명이 넘을 때만(서버가 그 아래는 보내지 않는다 · 4주 뒤 어떤 코너가 좋았는지 보려고)
 *     · 맨 아래 '지난 글 보기' — 지난 7일 글(읽은 글에만 옅은 표시 · 안 읽은 글은 아무 표시 없음)
 *     · 글은 달마다 따로 받는다(data/growthLessons) · 기록은 이 기기(lib/growthRead) + 서버(services/growthService — 없어도 그대로)
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Heart, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import {
  growthDayLabel,
  loadGrowthLessons,
  monthsFor,
  recentLessons,
  todayLesson,
  type GrowthLesson,
  type GrowthQuiz,
} from "@/data/growthLessons";
import { kstToday } from "@/lib/attendanceCheer";
import { markHeart, markOpened, markPick, useGrowthMarks, type GrowthPick } from "@/lib/growthRead";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { cn } from "@/lib/utils";
import { markGrowth, type GrowthMarkKind } from "@/services/growthService";

const doneKey = (uid: string, day: string, id: string) => `mb153.growth.done:${uid}:${day}:${id}`;
const readDone = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/** 바깥 링크 — 아이폰 앱은 앱 안 사파리 창, 그 밖은 새 창 (TitleTeachTab 과 같은 방식) */
const OutLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="underline decoration-border underline-offset-4"
    onClick={(e) => {
      if (!isIosApp()) return;
      e.preventDefault();
      void loadIosAppNative().then((n) => n.openInAppBrowser(href));
    }}
  >
    {children}
  </a>
);

/** O/X 문제 — 하나를 고르면 정답에 표시가 붙고 이야기가 열린다 */
const QuizBox = ({ quiz, picked, onPick }: { quiz: GrowthQuiz; picked?: GrowthPick; onPick: (p: GrowthPick) => void }) => {
  const right = picked === quiz.answer;
  return (
    <section aria-label="O/X 문제" className="rounded-2xl bg-card p-4 ring-1 ring-inset ring-border">
      <p className="text-label font-black text-emerald-700 dark:text-emerald-400">문제</p>
      <p className="mt-1 text-heading font-black leading-snug text-foreground">{quiz.q}</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {(["O", "X"] as const).map((c) => {
          const isAnswer = !!picked && c === quiz.answer;
          const isMine = picked === c;
          const note = isAnswer ? (isMine ? "정답 · 내 답" : "정답") : isMine ? "내 답" : "";
          return (
            <button
              key={c}
              type="button"
              disabled={!!picked}
              aria-pressed={isMine}
              aria-label={note ? `${c} · ${note}` : c}
              onClick={() => onPick(c)}
              className={cn(
                "flex h-[4.5rem] flex-col items-center justify-center rounded-2xl border transition-transform",
                !picked && "border-border bg-background text-foreground active:scale-[0.97]",
                isAnswer && "border-emerald-600 bg-emerald-600 text-white",
                !!picked && !isAnswer && "border-border bg-muted text-muted-foreground",
              )}
            >
              <span className="text-title font-black leading-none">{c}</span>
              {note && <span className="mt-1.5 text-micro font-bold leading-none">{note}</span>}
            </button>
          );
        })}
      </div>
      {picked ? (
        <p role="status" className={cn("mt-3 text-center text-body font-black", right ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
          {right ? "맞혔어요!" : "오늘 하나 알아 가요"}
        </p>
      ) : (
        <p className="mt-3 text-center text-label text-muted-foreground">하나를 고르면 이야기가 열려요</p>
      )}
    </section>
  );
};

const GrowthLessonCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const uid = user?.id ?? "anon";
  const today = kstToday();
  // 글은 달마다 따로 받는다 — 오늘이 든 달까지의 최근 두 달
  const { data: lessons } = useQuery({
    queryKey: ["153growth", "lessons", monthsFor(today).join(",")],
    queryFn: () => loadGrowthLessons(today),
    staleTime: Infinity,
    // 달이 넘어가는 순간에도 카드가 사라지지 않게 — 새 달 글을 받을 때까지 앞 글로 그린다
    placeholderData: (prev) => prev,
  });
  const lesson = lessons ? todayLesson(today, lessons) : null;
  const recent = useMemo(() => (lessons ? recentLessons(today, lessons) : []), [lessons, today]);
  const [marks, updateMarks] = useGrowthMarks(uid);
  const [open, setOpen] = useState(false);
  /** 서랍에서 보고 있는 지난 글 (없으면 오늘 글) */
  const [viewId, setViewId] = useState<string | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  /** 방금 약속한 글의 기록 칸 — 날이 바뀌어 다른 글이 되면 저절로 풀린다 */
  const [justDoneKey, setJustDoneKey] = useState<string | null>(null);
  /** 글마다 좋아요 수 — 서버가 5명이 넘을 때만 보낸다 */
  const [heartCounts, setHeartCounts] = useState<Record<string, number>>({});
  const heartCountsRef = useRef(heartCounts);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!lesson) return null;

  const key = doneKey(uid, today, lesson.id);
  const done = justDoneKey === key || readDone(key);
  const viewing = viewId ? recent.find((r) => r.lesson.id === viewId) ?? null : null;
  /** 서랍에 보이는 글 */
  const shown = viewing?.lesson ?? lesson;
  /** 날마다 글은 해 볼 것이 하나 — 번호 없이 */
  const single = shown.directions.length === 1;
  const todoLabel = viewing ? "해 볼 것 하나" : single ? "오늘 하나" : "오늘의 방향";
  const sources = shown.sources ?? [];
  const picked = marks[shown.id]?.q;
  /** O/X 글은 하나를 고른 뒤에 이야기가 열린다 */
  const revealed = !shown.quiz || !!picked;
  const liked = !!marks[shown.id]?.h;
  const heartCount = heartCounts[shown.id] ?? null;
  /** O/X 날 — 아직 고르기 전이면 카드 앞면이 문제 */
  const faceQuiz = !done && lesson.quiz && !marks[lesson.id]?.q ? lesson.quiz : null;

  /** 서버에 남긴다(보이지 않게 · 로그인했을 때만) — 답으로 온 좋아요 수가 달라졌을 때만 적어 둔다 */
  const send = (l: GrowthLesson, kind: GrowthMarkKind, quiz?: { pick: GrowthPick; right: boolean }) => {
    if (!user) return;
    void markGrowth(l, kind, quiz).then((n) => {
      const cur = heartCountsRef.current;
      if ((cur[l.id] ?? null) === n) return;
      const next = { ...cur };
      if (n === null) delete next[l.id];
      else next[l.id] = n;
      heartCountsRef.current = next;
      setHeartCounts(next);
    });
  };

  /** 글을 열었다 — 이 기기 + 서버 */
  const seen = (l: GrowthLesson) => {
    updateMarks((m) => markOpened(m, l.id, today));
    send(l, "open");
  };

  const openDrawer = () => {
    setViewId(null);
    setPastOpen(false);
    setOpen(true);
    seen(lesson);
  };

  /** 지난 글로 · 오늘 글로 */
  const show = (id: string | null) => {
    setViewId(id);
    const target = id ? recent.find((r) => r.lesson.id === id)?.lesson : lesson;
    if (target) seen(target);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  /** O/X 에서 골랐다 — 처음 고른 답만 남는다 */
  const pick = (l: GrowthLesson, p: GrowthPick) => {
    if (!l.quiz) return;
    updateMarks((m) => markPick(m, l.id, p, today));
    send(l, "quiz", { pick: p, right: p === l.quiz.answer });
  };

  const toggleHeart = () => {
    updateMarks((m) => markHeart(m, shown.id, !liked, today));
    send(shown, liked ? "heart_off" : "heart_on");
  };

  const promise = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* 저장 못 하는 브라우저면 이 화면에서만 */
    }
    setJustDoneKey(key);
    setOpen(false);
    send(lesson, "act");
    toast.success(lesson.directions.length === 1 ? "좋아요! 오늘 하나, 응원할게요" : "좋아요! 오늘의 방향 하나, 응원할게요");
  };

  return (
    <>
      <section
        aria-label="오늘의 1분 성장"
        className={cn(
          "overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] via-card to-card shadow-elev-1",
          className,
        )}
      >
        <button
          type="button"
          onClick={openDrawer}
          className={cn("flex w-full items-center gap-3 p-5 text-left transition-transform active:scale-[0.99]", faceQuiz && "pb-3")}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {done ? <Check className="h-6 w-6" aria-hidden /> : <Sprout className="h-6 w-6" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            {/* 좁은 화면 · 큰 글씨에서는 이름과 코너 사이에서 줄이 바뀐다 (코너 이름이 가운데서 끊기지 않게) */}
            <span className="flex flex-wrap gap-x-1 text-label font-bold text-emerald-700 dark:text-emerald-400">
              {done ? (
                "오늘 실천 약속 완료"
              ) : lesson.days === 1 ? (
                <>
                  <span className="whitespace-nowrap">오늘의 1분 성장 ·{" "}</span>
                  <span className="whitespace-nowrap">{lesson.theme}</span>
                </>
              ) : (
                "오늘의 1분 성장"
              )}
            </span>
            <span className="mt-0.5 block text-body font-black leading-snug text-foreground">{faceQuiz ? faceQuiz.q : lesson.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        {faceQuiz && (
          <div role="group" aria-label="O/X 고르기" className="grid grid-cols-2 gap-2.5 px-5 pb-5">
            {(["O", "X"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  pick(lesson, c);
                  openDrawer();
                }}
                className="flex h-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-card text-heading font-black text-foreground transition-transform active:scale-[0.97]"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-1 text-left">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-label font-black text-emerald-700 dark:text-emerald-400">
                  <Sprout className="h-4 w-4 shrink-0" aria-hidden />
                  {viewing ? `지난 글 · ${growthDayLabel(viewing.day)} · ${shown.theme}` : `오늘의 1분 성장 · ${shown.theme}`}
                </p>
                <DrawerTitle className="mt-1 text-heading font-black leading-snug">{shown.title}</DrawerTitle>
                <DrawerDescription className="text-body">{shown.hook}</DrawerDescription>
              </div>
              <button
                type="button"
                onClick={toggleHeart}
                aria-pressed={liked}
                aria-label={liked ? "좋아요 취소" : "이 글 좋아요"}
                className={cn(
                  "flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full border px-3 transition-all active:scale-90",
                  liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-border bg-card text-muted-foreground",
                )}
              >
                <Heart className={cn("h-5 w-5", liked && "fill-current")} aria-hidden />
                {heartCount !== null && <span className="text-label font-bold">{heartCount}</span>}
              </button>
            </div>
          </DrawerHeader>
          <div ref={scrollRef} className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            {viewing && (
              <button
                type="button"
                onClick={() => show(null)}
                className="flex h-10 items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-3.5 text-label font-bold text-foreground active:scale-[0.97]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> 오늘 글로
              </button>
            )}

            {shown.quiz && <QuizBox quiz={shown.quiz} picked={picked} onPick={(p) => pick(shown, p)} />}

            {revealed && (
              <>
                <div className="space-y-2.5">
                  {shown.story.map((p, i) => (
                    <p key={i} className="text-body leading-relaxed text-foreground">
                      {p}
                    </p>
                  ))}
                  {sources.length > 0 && (
                    <p className="break-words text-label leading-relaxed text-muted-foreground">
                      출처 ·{" "}
                      {sources.map((s, i) => (
                        <span key={s.name}>
                          {i > 0 && ", "}
                          {s.url ? <OutLink href={s.url}>{s.name}</OutLink> : s.name}
                        </span>
                      ))}
                    </p>
                  )}
                </div>

                <section aria-label={todoLabel} className="rounded-2xl bg-emerald-500/[0.08] p-3.5 ring-1 ring-inset ring-emerald-500/20">
                  <p className="flex items-center gap-1.5 text-label font-black text-foreground">
                    <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> {todoLabel}
                  </p>
                  <ol className="mt-2.5 space-y-2.5">
                    {shown.directions.map((d, i) => (
                      <li key={d.title} className="flex gap-2.5">
                        {!single && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-micro font-black text-white">
                            {i + 1}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-body font-black leading-snug text-foreground">{d.title}</span>
                          <span className="mt-0.5 block text-label leading-relaxed text-muted-foreground">{d.body}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>

                <p className="rounded-2xl bg-foreground px-4 py-3.5 text-center text-body font-black leading-snug text-background">
                  {shown.pledge}
                </p>

                {!viewing &&
                  (done ? (
                    <p className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-body font-bold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-4 w-4" aria-hidden /> 오늘 실천 약속 완료
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={promise}
                      className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-body font-black text-white transition-transform active:scale-[0.98]"
                    >
                      오늘 하나 해 볼게요
                    </button>
                  ))}
              </>
            )}

            {recent.length > 0 && (
              <section aria-label="지난 글">
                <button
                  type="button"
                  aria-expanded={pastOpen}
                  onClick={() => setPastOpen((v) => !v)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-body font-bold text-foreground"
                >
                  지난 글 보기
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", pastOpen && "rotate-180")} aria-hidden />
                </button>
                {pastOpen && (
                  <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    {recent.map(({ day, lesson: l }) => {
                      const current = viewing?.lesson.id === l.id;
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            aria-current={current ? "true" : undefined}
                            onClick={() => show(l.id)}
                            className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", current && "bg-emerald-500/[0.08]")}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-label text-muted-foreground">
                                {growthDayLabel(day)} · {l.theme}
                              </span>
                              <span className="mt-0.5 block text-body font-bold leading-snug text-foreground">{l.title}</span>
                            </span>
                            {marks[l.id]?.o && (
                              <>
                                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                                <span className="sr-only">읽은 글</span>
                              </>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default GrowthLessonCard;
