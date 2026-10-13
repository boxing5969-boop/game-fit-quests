/**
 * 🥊 붕대 감기 — 그림 8단계 · 영상 · 집 연습 미션 (2026-10-13 대표님).
 *
 *   신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 이 화면을 보며 직접 감는다.
 *   그리고 집에서 혼자 감아 보는 미션(HandWrapPracticeCard) — 다음 수업 때 코치님이 회원 상세에서 기록을 본다.
 *
 *   · 그림: 지금 단계 붕대는 민트, 앞 단계는 흰 붕대로 쌓인다. 왼손/오른손 전환(기기에 기억). 좌우로 밀어서 넘길 수 있다.
 *   · 영상: 훈련 라이브러리 '복싱 붕대 감기' 항목의 영상 URL (코치·관장이 넣으면 바로 나온다). 없으면 '준비 중'.
 *   · 글: data/handWrapGuide.ts — 그림과 같은 목록을 쓴다.
 */
import { useCallback, useRef, useState, type SyntheticEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Clapperboard, Play, RotateCcw, X } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import VideoPlayer from "@/components/VideoPlayer";
import HandWrapIllustration from "@/components/handwrap/HandWrapIllustration";
import HandWrapPracticeCard from "@/components/handwrap/HandWrapPracticeCard";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useHandWrapVideo } from "@/hooks/useHandWrap";
import { youtubeThumb } from "@/hooks/useLevelVideos";
import { strictYoutubeId } from "@/lib/videoUrl";
import {
  HANDWRAP_DONE,
  HANDWRAP_EXERCISE_NAME,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_STEPS,
} from "@/data/handWrapGuide";
import { isManagerRole } from "@/lib/rankLabels";
import { cn } from "@/lib/utils";

type Hand = "left" | "right";
const HAND_KEY = "153handwrap:hand";
const TOTAL = HANDWRAP_STEPS.length;
/** 이만큼 밀면 다음·이전 단계 */
const SWIPE_PX = 48;

const readHand = (): Hand => {
  try {
    return window.localStorage.getItem(HAND_KEY) === "right" ? "right" : "left";
  } catch {
    return "left";
  }
};

/** VideoPlayer 는 youtu.be·watch 주소만 embed 로 바꾼다 — shorts·embed 주소도 youtu.be 로 맞춰 넘긴다 (유튜브 호스트일 때만) */
const playableUrl = (url: string) => {
  const id = strictYoutubeId(url);
  return id ? `https://youtu.be/${id}` : url;
};

const hideImg = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

const HandWrapGuidePage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isStaff = isManagerRole(role);
  const [step, setStep] = useState(0);
  const [hand, setHand] = useState<Hand>(readHand);
  const [playing, setPlaying] = useState(false);
  const closePlayer = useCallback(() => setPlaying(false), []);
  useModalDismiss(playing, closePlayer);
  const video = useHandWrapVideo();
  const stepsRef = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const done = step >= TOTAL;
  const current = done ? null : HANDWRAP_STEPS[step];
  const title = current ? current.title : HANDWRAP_DONE.title;
  const body = current ? current.body : HANDWRAP_DONE.body;
  const handLabel = hand === "left" ? "왼손" : "오른손";

  const go = (next: number) => setStep(Math.max(0, Math.min(TOTAL, next)));
  const prev = () => go(step - 1);
  const next = () => go(done ? 0 : step + 1);

  const pickHand = (h: Hand) => {
    setHand(h);
    try {
      window.localStorage.setItem(HAND_KEY, h);
    } catch {
      /* 저장 못 해도 이번 화면에서는 바뀐다 */
    }
  };

  // 한 손가락으로 가로로 뚜렷하게 밀었을 때만 넘긴다 (세로 스크롤·두 손가락 확대는 무시)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches.length === 1 ? e.touches[0] : null;
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = e.changedTouches[0];
    if (!start || !end || e.touches.length > 0) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && !done) go(step + 1);
    else if (dx > 0) go(step - 1);
  };

  const jumpTo = (i: number) => {
    go(i);
    stepsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const thumb = video.data ? video.data.poster || (strictYoutubeId(video.data.url) ? youtubeThumb(video.data.url) : null) : null;

  return (
    <AppPage
      header={
        <PageHeader
          title="붕대 감기"
          subtitle="그림 8단계 · 영상 · 집 연습 미션"
          sticky
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
        />
      }
    >
      <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
        첫날엔 코치님이 한 손을 빠르게 감아 드려요. 다른 손은 이 화면을 보면서 직접 감아 보세요 — 주로 쓰는 손으로 감는 쪽이
        쉬워요.
      </p>

      {/* ── 단계 그림 ── */}
      <section ref={stepsRef} aria-label="붕대 감는 순서" className="mt-4 scroll-mt-20 overflow-hidden rounded-3xl bg-card shadow-elev-1 ring-1 ring-border/60">
        <div className="relative bg-secondary/70" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <HandWrapIllustration
            step={step}
            mirrored={hand === "right"}
            label={`${handLabel} 손등 그림 — ${done ? "다 감은 모습" : `${step + 1}단계 ${title}`}`}
            className="mx-auto block h-[min(46vh,330px)] w-auto py-2"
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-black tabular-nums text-white backdrop-blur-sm">
            {done ? "완성" : `${step + 1} / ${TOTAL}`}
          </span>
          <div role="group" aria-label="그림 손 고르기" className="absolute right-3 top-3 flex rounded-full bg-card/95 p-0.5 shadow-elev-1 ring-1 ring-border/60">
            {(["left", "right"] as const).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={hand === h}
                onClick={() => pickHand(h)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-bold transition-colors",
                  hand === h ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {h === "left" ? "왼손" : "오른손"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <p className="text-[11.5px] font-bold text-primary">{done ? "다 감았어요" : `${step + 1}단계`}</p>
          <h2 className="text-[19px] font-black leading-tight text-foreground" aria-live="polite">
            {title}
          </h2>
          <p className="mt-1.5 min-h-[3.75rem] text-[13.5px] leading-relaxed text-foreground/85">{body}</p>

          {/* 단계 점 — 눌러서 바로 가기 */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {HANDWRAP_STEPS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}단계 ${s.title}`}
                aria-current={i === step ? "step" : undefined}
                className="flex h-6 w-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block rounded-full transition-all",
                    i === step ? "h-2.5 w-5 bg-primary" : i < step ? "h-2 w-2 bg-primary/45" : "h-2 w-2 bg-border",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={step === 0}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-secondary text-[14.5px] font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
              <ChevronLeft className="h-4 w-4" /> 이전
            </button>
            <button
              type="button"
              onClick={next}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-primary text-[14.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              {done ? (
                <>
                  <RotateCcw className="h-4 w-4" /> 처음부터
                </>
              ) : step === TOTAL - 1 ? (
                <>
                  완성 보기 <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  다음 <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── 영상 ── */}
      <section aria-labelledby="handwrap-video-h" className="mt-7">
        <h2 id="handwrap-video-h" className="px-1 text-[16px] font-black text-foreground">
          영상으로 보기
        </h2>
        <div className="mt-2">
          {video.isLoading ? (
            <div className="overflow-hidden rounded-2xl bg-card shadow-elev-1" aria-busy="true" aria-label="영상 불러오는 중">
              <div className="aspect-video w-full animate-pulse bg-muted" />
            </div>
          ) : video.isError ? (
            <div className="rounded-2xl bg-card px-5 py-6 text-center shadow-elev-1">
              <p className="text-[14px] font-bold text-foreground">영상을 불러오지 못했어요</p>
              <button
                type="button"
                onClick={() => video.refetch()}
                disabled={video.isRefetching}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-[13px] font-bold text-foreground active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className={cn("h-4 w-4", video.isRefetching && "animate-spin")} /> 다시 시도
              </button>
            </div>
          ) : video.data ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="붕대 감기 영상 보기"
              className="group block w-full overflow-hidden rounded-2xl bg-card text-left shadow-elev-1 ring-1 ring-border/60"
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-muted">
                {thumb && <img src={thumb} alt="" loading="lazy" onError={hideImg} className="h-full w-full object-cover" />}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-active:scale-90">
                    <Play className="ml-1 h-6 w-6 fill-white text-white" />
                  </span>
                </span>
              </span>
              <span className="block px-4 py-3">
                <span className="block text-[15px] font-black text-foreground">153 붕대 감기 영상</span>
                <span className="block text-[12.5px] text-muted-foreground">멈춰 가며 한 단계씩 따라 해도 돼요</span>
              </span>
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-7 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                <Clapperboard className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="mt-3 text-[15px] font-bold text-foreground">영상 준비 중이에요</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">지금은 위 그림 8단계로 따라 해요</p>
              {isStaff && (
                <div className="mt-4 rounded-xl bg-secondary px-3 py-2.5 text-left">
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    코치 안내 · 훈련 라이브러리 → ‘준비’ → ‘{HANDWRAP_EXERCISE_NAME}’ → 수정 → 영상 URL에 주소를 넣으면 여기에 바로
                    나와요 (유튜브 주소도 돼요)
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/training-library")}
                    className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-card px-3 text-[12.5px] font-bold text-foreground ring-1 ring-border/60 active:scale-95"
                  >
                    훈련 라이브러리 열기 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 집 연습 미션 ── */}
      <section aria-labelledby="handwrap-home-h" className="mt-7">
        <h2 id="handwrap-home-h" className="px-1 text-[16px] font-black text-foreground">
          집에서 혼자 감아 보기
        </h2>
        <p className="mt-0.5 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
          집에서 붕대를 풀었다 다시 감아 보고, 감아 본 날 눌러 주세요. 다음 수업 때 코치님 앞에서 혼자 감아 보여 주면 끝!
        </p>
        <HandWrapPracticeCard variant="page" className="mt-2" />
      </section>

      {/* ── 흔한 실수 ── */}
      <section aria-labelledby="handwrap-mistakes-h" className="mt-7">
        <h2 id="handwrap-mistakes-h" className="px-1 text-[16px] font-black text-foreground">
          이것만 조심해요
        </h2>
        <ul className="mt-2 space-y-2">
          {HANDWRAP_MISTAKES.map((m) => (
            <li key={m.wrong} className="rounded-2xl bg-card px-4 py-3 shadow-elev-1 ring-1 ring-border/60">
              <p className="flex items-start gap-2 text-[13.5px] font-bold leading-snug text-foreground">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={2.6} />
                {m.wrong}
              </p>
              <p className="mt-1 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
                {m.fix}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 한눈에 ── */}
      <section aria-labelledby="handwrap-all-h" className="mt-7">
        <h2 id="handwrap-all-h" className="px-1 text-[16px] font-black text-foreground">
          8단계 한눈에
        </h2>
        <ol className="mt-2 grid grid-cols-4 gap-2">
          {HANDWRAP_STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => jumpTo(i)}
                aria-label={`${i + 1}단계 ${s.title} 크게 보기`}
                className={cn(
                  "block w-full rounded-xl bg-card p-1 shadow-elev-1 transition-transform active:scale-[0.97]",
                  i === step ? "ring-2 ring-primary" : "ring-1 ring-border/60",
                )}
              >
                <HandWrapIllustration step={i} mirrored={hand === "right"} hideBadge className="block h-auto w-full rounded-lg bg-secondary/70" />
                <span className="mt-1 block truncate px-0.5 text-center text-[10.5px] font-bold text-foreground">
                  {i + 1}. {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 px-1 text-[12px] leading-relaxed text-muted-foreground">
        감은 뒤 손이 저리거나 손목·손가락이 계속 아프면 운동을 멈추고 코치님께 말해 주세요.
      </p>

      {/* 영상 플레이어 — body 로 띄워 어떤 부모 아래서도 화면 전체를 덮는다 */}
      {playing &&
        video.data &&
        createPortal(
          <VideoPlayer
            videoUrl={playableUrl(video.data.url)}
            posterUrl={video.data.poster}
            title="153 붕대 감기"
            keyPoints={[...HANDWRAP_KEY_POINTS]}
            onClose={closePlayer}
          />,
          document.body,
        )}
    </AppPage>
  );
};

export default HandWrapGuidePage;
