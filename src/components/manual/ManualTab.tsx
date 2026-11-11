/**
 * 📘 153운영본부 「매뉴얼」 탭 /office?tab=manual (2026-11-11 대표님 「넘어가자」 · 보고서 「153 매뉴얼 책 · 운영본부 「153 매뉴얼」 탭 보고서」)
 *
 *   코치님: 서재(1권 표지 · 내 서명 n/12 · 이어 읽기) → 목차(장 그림 · 읽는 시간 · 서명 · 잠김) → 한 장 읽기(ManualReader)
 *   대표님 · 지점장님: 위에 「책 읽기 · 읽음 현황」 — 현황은 ManualBoard
 *   · 필독 장은 앞 장을 서명해야 열린다(대표님 · 지점장님은 검토용으로 모두 열림) — lib/coachManual/progress
 *   · 주소 ?ch=<장> 이면 그 장을 바로 연다(알림 · 공유). 뒤로 가기로 닫힌다
 *   · 책 글은 DB(coach_manual_book — 코치진만) · 없으면 앱 안 예시 book1Sample(프롤로그~9장)과 안내 한 줄
 *   · 서명은 서버 coach_manual_* (함수가 없으면 이 기기에만 — coachManualService)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/rankingup";
import { manualImg } from "@/lib/coachManual/types";
import { bookProgress, chapterState, latestRead, manualDate } from "@/lib/coachManual/progress";
import { useManualBook, useManualMe } from "@/services/coachManualService";
import ManualReader from "./ManualReader";
import ManualBoard from "./ManualBoard";

type View = "read" | "board";

/** 지금 1권만 있다 — 서명 기록 · DB 책 줄 이름 */
const BOOK_ID = "book1";

/** 예시 책 · 이 기기 서명일 때 안내 한 줄 */
function sampleNote(bookSource: "server" | "offline" | "empty" | undefined, offlineSign: boolean): string | null {
  if (bookSource === "offline")
    return offlineSign
      ? "미리보기 예시예요 — 프롤로그~9장만 보이고, 서명은 이 휴대폰에만 남아요"
      : "미리보기 예시예요 — 프롤로그~9장만 보여요";
  if (bookSource === "empty") return "책 내용을 준비하고 있어요 — 지금은 예시(프롤로그~9장)만 보여요";
  if (offlineSign) return "서명 기록은 준비 중이에요 — 지금 서명은 이 휴대폰에만 남아요";
  return null;
}

export default function ManualTab({ reviewerFallback }: { reviewerFallback: boolean }) {
  const navigate = useNavigate();
  const bookQ = useManualBook(BOOK_ID);
  const book = bookQ.data?.book ?? null;
  const meQ = useManualMe(BOOK_ID);
  const me = meQ.data;
  const reads = useMemo(() => me?.reads ?? [], [me]);
  // 서버 함수가 없을 때(미리보기)는 앱 권한(지점장 · 운영진)으로 검토자를 정한다
  const reviewer = me ? (me.offline ? reviewerFallback : !!me.can_direct) : false;
  const [view, setView] = useState<View>("read");
  const [showGuide, setShowGuide] = useState(false);
  const progress = useMemo(() => (book ? bookProgress(book, reads) : null), [book, reads]);

  // 읽기 화면 = 주소 ?ch=<장>
  const [params, setParams] = useSearchParams();
  const chId = params.get("ch");
  const chapter = book && chId ? book.chapters.find((c) => c.id === chId) ?? null : null;
  const pushed = useRef(false);
  useEffect(() => {
    if (!chId) pushed.current = false;
  }, [chId]);

  const openChapter = (id: string) => {
    if (!book) return;
    if (chapterState(book, reads, id, { reviewer }) === "locked") {
      toast.message("앞 장을 먼저 읽고 서명해 주세요");
      return;
    }
    if (chId) {
      // 읽는 중에 다음 장으로 — 기록을 쌓지 않아 뒤로 가기 한 번이면 목차
      setParams((p) => {
        p.set("ch", id);
        return p;
      }, { replace: true });
      return;
    }
    pushed.current = true;
    setParams((p) => {
      p.set("ch", id);
      return p;
    });
  };

  const closeReader = () => {
    if (pushed.current) {
      pushed.current = false;
      navigate(-1);
    } else {
      setParams((p) => {
        p.delete("ch");
        return p;
      }, { replace: true });
    }
  };

  // 주소로 잠긴 장을 열려고 하면 알리고 닫는다 (책 · 기록을 불러온 뒤에만 판단)
  const chapterLocked = !!book && !!chapter && !!me && chapterState(book, reads, chapter.id, { reviewer }) === "locked";
  useEffect(() => {
    if (chapterLocked) {
      toast.message("앞 장을 먼저 읽고 서명해 주세요");
      setParams((p) => {
        p.delete("ch");
        return p;
      }, { replace: true });
    }
  }, [chapterLocked, setParams]);
  // 이 책에 없는 장 — 책을 받은 뒤에만 (예시 책으로 미리 지우지 않게)
  useEffect(() => {
    if (book && chId && !chapter) {
      setParams((p) => {
        p.delete("ch");
        return p;
      }, { replace: true });
    }
  }, [book, chId, chapter, setParams]);

  if (meQ.isLoading || bookQ.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-48 animate-pulse rounded-3xl bg-card shadow-elev-1" />
        <div className="h-72 animate-pulse rounded-3xl bg-card shadow-elev-1" />
      </div>
    );
  }

  // 서버가 코치진이 아니라고 했다 (탭은 앱 권한으로 보였지만 서버 기준과 다를 때)
  if (me && !me.offline && !me.staff) {
    return (
      <p className="rounded-2xl bg-secondary px-4 py-3 text-body leading-relaxed text-muted-foreground">
        153 매뉴얼은 코치진만 볼 수 있어요
      </p>
    );
  }

  if (!book || !progress) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
        <p className="text-label text-muted-foreground">매뉴얼을 불러오지 못했어요</p>
        <button type="button" onClick={() => void bookQ.refetch()} className="shrink-0 text-label font-black text-foreground">
          다시 불러오기
        </button>
      </div>
    );
  }

  const next = progress.next;
  const allDone = progress.total > 0 && progress.done === progress.total;
  const note = sampleNote(bookQ.data?.source, !!me?.offline);

  return (
    <div className="space-y-4">
      {reviewer && (
        <SegmentedControl<View>
          value={view}
          onChange={setView}
          fullWidth
          size="lg"
          segments={[
            { value: "read", label: "책 읽기" },
            { value: "board", label: "읽음 현황" },
          ]}
        />
      )}

      {view === "board" && reviewer ? (
        <ManualBoard book={book} />
      ) : (
        <>
          {/* 서재 — 1권 */}
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex gap-4 p-5">
              <img
                src={manualImg(book.cover, true)}
                alt=""
                className="h-32 w-24 shrink-0 rounded-xl border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-label font-black text-primary">153 매뉴얼 {book.no} · 필독</p>
                <h2 className="mt-1 text-heading font-black text-foreground">{book.title}</h2>
                {book.tagline && <p className="mt-1.5 line-clamp-3 text-label leading-relaxed text-muted-foreground">{book.tagline}</p>}
              </div>
            </div>
            <div className="px-5 pb-5">
              <div className="flex items-baseline justify-between">
                <p className="text-label font-bold text-muted-foreground">내 서명</p>
                <p className="text-body font-black tabular-nums text-foreground">
                  {progress.done}
                  <span className="text-label font-bold text-muted-foreground"> / {progress.total}장</span>
                </p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => openChapter(next ? next.id : book.chapters[0].id)}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99]"
              >
                {allDone ? (
                  <>
                    <Check className="h-5 w-5" /> 다 읽었어요 · 처음부터 다시 보기
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5" />
                    {progress.done === 0 && !progress.resign ? "처음부터 읽기" : `이어 읽기 · ${next?.no ?? ""}`}
                  </>
                )}
              </button>
              {progress.resign > 0 && (
                <p className="mt-2 text-label font-bold text-reward">글이 바뀐 새 판이 {progress.resign}장 있어요 · 다시 서명해 주세요</p>
              )}
            </div>
          </div>

          {note && (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-label leading-relaxed text-muted-foreground">{note}</p>
          )}
          {meQ.isError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
              <p className="text-label text-muted-foreground">서명 기록을 불러오지 못했어요</p>
              <button type="button" onClick={() => void meQ.refetch()} className="shrink-0 text-label font-black text-foreground">
                다시 불러오기
              </button>
            </div>
          )}

          {/* 이 책을 읽는 법 */}
          {book.guide.length > 0 && (
            <div className="rounded-2xl border bg-card">
              <button
                type="button"
                onClick={() => setShowGuide((v) => !v)}
                aria-expanded={showGuide}
                className="flex h-14 w-full items-center justify-between px-5 text-left"
              >
                <span className="text-body font-bold text-foreground">이 책을 읽는 법</span>
                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showGuide && "rotate-180")} />
              </button>
              {showGuide && (
                <ul className="space-y-2 px-5 pb-5">
                  {book.guide.map((g, i) => (
                    <li key={i} className="flex gap-2.5 text-body leading-relaxed text-foreground">
                      <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="min-w-0">{g}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 목차 */}
          <div>
            <p className="mb-2 px-1 text-label font-bold text-muted-foreground">목차</p>
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {book.chapters.map((c) => {
                const st = chapterState(book, reads, c.id, { reviewer });
                const isNext = next?.id === c.id;
                const signedAt = latestRead(reads, c.id)?.signed_at ?? null;
                return (
                  <li key={c.id} className="border-b border-border/70 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openChapter(c.id)}
                      className={cn("flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60", st === "locked" && "opacity-60")}
                    >
                      {c.image ? (
                        <img
                          src={manualImg(c.image, true)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-[72px] shrink-0 rounded-xl border border-border object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-xl bg-secondary text-label font-black text-foreground">
                          {c.no}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-label font-bold text-muted-foreground">
                          {c.no}
                          {c.minutes > 0 ? ` · ${c.minutes}분` : " · 필요할 때"}
                        </span>
                        <span className="line-clamp-2 block text-body font-black leading-snug text-foreground">{c.title}</span>
                      </span>
                      {st === "signed" ? (
                        <span className="flex shrink-0 flex-col items-end">
                          <Check className="h-5 w-5 text-primary" aria-label="서명" />
                          <span className="text-micro font-bold text-muted-foreground">{manualDate(signedAt)}</span>
                        </span>
                      ) : st === "resign" ? (
                        <span className="shrink-0 rounded-full bg-reward/15 px-2.5 py-1 text-micro font-black text-reward">새 판</span>
                      ) : st === "locked" ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="잠김" />
                      ) : isNext ? (
                        <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-micro font-black text-background">읽을 차례</span>
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {book.signature && <p className="pb-2 text-center text-label font-black text-muted-foreground">{book.signature}</p>}
        </>
      )}

      {chapter && !chapterLocked && (
        <ManualReader
          book={book}
          chapter={chapter}
          reads={reads}
          reviewer={reviewer}
          offline={!!me?.offline}
          onClose={closeReader}
          onOpenChapter={openChapter}
        />
      )}
    </div>
  );
}
