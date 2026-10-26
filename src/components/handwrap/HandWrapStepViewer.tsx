/**
 * 📷 붕대 감기 — 단계별로 한 장씩 · 한눈에 설명서 (2026-10-20 대표님: "한 장 한 장 사진과 설명을 통해 영상이 어려운 분들은 그림을 보고 배울 수 있도록").
 *   2026-10-20 → 배경 지운 반복 영상 + 감는 방향 화살표 · 2026-10-26 손 테두리 · 이음새 다시.
 *   2026-10-27 대표님: "복싱붕대도 아직 화질도 많이 깨지고 … 영상도 편집을 통해서 방향이랑 속도 조절 등을 통해 좀 더 회원님들이
 *     잘 따라 할 수 있게 · 사진 한 장씩 볼 수도 있지만 한눈에 처음부터 끝까지 설명서 보듯 볼 수 있게도 — 그림과 글로"
 *     → 단계 영상 = 원본에서 그 단계를 실제로 감는 장면(선명하게) · 속도 고르기(아주 천천히 0.4 · 천천히 0.6 기본 · 원래 1)
 *       · 왼손 / 오른손(거울로 뒤집어 보기, 글 속 대각선 화살표도 함께 바꿈) · '감는 방향' 한 줄
 *     → '한눈에 설명서' = 10단계를 위에서 아래로 그림 + 글 (그림을 누르면 그 단계 영상으로).
 *
 *   한 장씩: 큰 영상 + 몇 번째 장인지 + 보는 방향 · 감는 방향 + 제목 · 설명 · 포인트 → 이전 · 다음 (옆으로 밀어도 넘어간다)
 *   → 아래 작은 그림 줄로 바로 가기. '이 장면 영상으로 보기'를 누르면 그 장면이 나오는 각도의 원본 영상을 그 초부터 연다 (onWatch).
 *   영상 · 글은 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Eye, Hand, Move, Play } from "lucide-react";
import {
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_NOTE,
  mirrorArrows,
  type HandSide,
  type HandWrapStep,
} from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

interface Props {
  onWatch: (step: HandWrapStep) => void;
  className?: string;
}

type Mode = "steps" | "manual";

const SWIPE_PX = 40;

const prefersReducedMotion = () => {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const Chip = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    aria-label={label}
    className={cn(
      "h-8 shrink-0 rounded-full px-3 text-[12.5px] font-bold transition-colors active:scale-95",
      on ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
    )}
  >
    {children}
  </button>
);

const HandWrapStepViewer = ({ onWatch, className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const [mode, setMode] = useState<Mode>("steps");
  const [hand, setHand] = useState<HandSide>("left");
  const [rate, setRate] = useState(HANDWRAP_DEFAULT_STEP_RATE);
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const touchX = useRef<number | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still] = useState(prefersReducedMotion);
  const mirrored = hand === "right";
  const txt = (t: string) => (mirrored ? mirrorArrows(t) : t);

  const go = (i: number) => setIdx(Math.min(total - 1, Math.max(0, i)));

  // 속도 — 영상은 원래 속도로 만들었고 여기서 느리게 튼다 (단계가 바뀌어 새 영상이 와도 같은 속도)
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate, idx, mode]);

  // 작은 사진 줄 — 지금 장이 가운데 오게 옆으로만 맞춘다 (화면 전체는 움직이지 않게 scrollIntoView 대신 scrollLeft)
  // + 다음 사진을 미리 받아 둔다
  useEffect(() => {
    if (mode !== "steps") return;
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-step="${idx}"]`);
    if (strip && el) {
      const left = el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2;
      try {
        strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      } catch {
        strip.scrollLeft = Math.max(0, left);
      }
    }
    if (idx + 1 < total) {
      const img = new Image();
      img.src = steps[idx + 1].image;
    }
  }, [idx, steps, total, mode]);

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_PX) return;
    go(dx < 0 ? idx + 1 : idx - 1);
  };

  /** 설명서에서 그림을 누르면 그 단계 영상으로 */
  const openStep = (i: number) => {
    setIdx(i);
    setMode("steps");
    requestAnimationFrame(() => {
      try {
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        /* 옛 브라우저 */
      }
    });
  };

  const flip = mirrored ? "-scale-x-100" : "";

  return (
    <div ref={rootRef} className={cn("scroll-mt-20 overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      {/* 보기 방식 · 손 · 속도 */}
      <div className="space-y-2 border-b border-border/60 px-3 pb-2.5 pt-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="보기 방식">
          {(
            [
              ["steps", "한 장씩 · 영상", Move],
              ["manual", "한눈에 설명서", BookOpen],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-bold transition-colors",
                mode === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground">
            <Hand className="h-3.5 w-3.5" aria-hidden /> 감는 손
          </span>
          <Chip on={hand === "left"} onClick={() => setHand("left")}>
            왼손
          </Chip>
          <Chip on={hand === "right"} onClick={() => setHand("right")} label="오른손 — 영상을 거울로 뒤집어 보기">
            오른손 (거울)
          </Chip>
        </div>
        {mode === "steps" && !still && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[11.5px] font-bold text-muted-foreground">속도</span>
            {HANDWRAP_STEP_SPEEDS.map((s) => (
              <Chip key={s.rate} on={rate === s.rate} onClick={() => setRate(s.rate)}>
                {s.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {mode === "steps" ? (
        <>
          {/* 큰 영상 */}
          <div
            className="relative aspect-[4/3] w-full overflow-hidden bg-black"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            aria-roledescription="단계 넘기기"
          >
            {still ? (
              <img
                key={step.image}
                src={step.image}
                alt={`${idx + 1}단계 ${step.title}`}
                className={cn("h-full w-full object-contain", flip)}
                decoding="async"
              />
            ) : (
              <video
                key={step.clip}
                ref={videoRef}
                src={step.clip}
                poster={step.image}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  e.currentTarget.playbackRate = rate;
                }}
                onPlay={(e) => {
                  // 일부 폰은 처음 재생할 때 속도를 1로 되돌린다 — 다시 건다
                  if (e.currentTarget.playbackRate !== rate) e.currentTarget.playbackRate = rate;
                }}
                aria-label={`${idx + 1}단계 ${step.title} — 실제로 감는 장면 (반복)`}
                className={cn("h-full w-full object-contain", flip)}
              />
            )}
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12.5px] font-black tabular-nums text-white backdrop-blur-sm">
              {idx + 1} / {total}
            </span>
          </div>
          <div className="space-y-1 border-b border-border/60 px-4 py-2 text-[11.5px] font-semibold leading-snug text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Eye aria-hidden className="h-3.5 w-4 shrink-0 text-foreground" />
              {HANDWRAP_VIEW_NOTE[step.view][hand]}
            </p>
            <p className="flex items-start gap-1.5 text-[12.5px] font-bold text-foreground">
              <span aria-hidden className="mt-[7px] h-1.5 w-4 shrink-0 rounded-full bg-[#10B981]" />
              <span className="min-w-0">감는 방향: {txt(step.dir)}</span>
            </p>
          </div>

          {/* 글 */}
          <div className="px-4 pb-3 pt-3.5" aria-live="polite">
            <p className="text-[12px] font-black text-primary">{idx + 1}단계</p>
            <h3 className="mt-0.5 text-[17px] font-black leading-snug text-foreground">{step.title}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-foreground">{txt(step.desc)}</p>
            {step.tip && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-[12.5px] font-semibold leading-relaxed text-foreground">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{txt(step.tip)}</span>
              </p>
            )}
          </div>

          {/* 이전 · 다음 */}
          <div className="flex items-center gap-2 px-4">
            <button
              type="button"
              onClick={() => go(idx - 1)}
              disabled={idx === 0}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-secondary text-[14px] font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> 이전
            </button>
            <button
              type="button"
              onClick={() => go(idx + 1)}
              disabled={idx === total - 1}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-foreground text-[14px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              다음 <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onWatch(step)}
            className="mx-4 mt-2 inline-flex h-10 w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-full text-[13px] font-bold text-primary ring-1 ring-primary/40 transition-transform active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> 이 장면 큰 영상으로 보기
          </button>

          {/* 작은 사진 줄 — 바로 가기 */}
          <ol
            ref={stripRef}
            aria-label="단계 바로 가기"
            className="relative mt-3 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {steps.map((s, i) => (
              <li key={s.image} data-step={i} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${i + 1}단계 ${s.title}`}
                  aria-current={i === idx ? "step" : undefined}
                  className={cn(
                    "relative block h-[54px] w-[72px] overflow-hidden rounded-lg ring-2 transition-transform active:scale-95",
                    i === idx ? "ring-primary" : "ring-transparent opacity-70",
                  )}
                >
                  <img src={s.image} alt="" loading="lazy" decoding="async" className={cn("h-full w-full object-cover", flip)} />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10.5px] font-black tabular-nums text-white">
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        /* 한눈에 설명서 — 처음부터 끝까지 그림 + 글 */
        <div className="px-3 pb-4 pt-3">
          <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
            처음부터 끝까지 순서대로 — 위에서 아래로 따라 감아 보세요. 그림을 누르면 그 단계 영상이 나와요.
          </p>
          <ol className="mt-3 divide-y divide-border/60" aria-label="붕대 감기 설명서">
            {steps.map((s, i) => (
              <li key={s.image} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => openStep(i)}
                  aria-label={`${i + 1}단계 ${s.title} 영상으로 보기`}
                  className="relative block w-[44%] shrink-0 self-start overflow-hidden rounded-xl ring-1 ring-border/70 active:scale-[0.98]"
                >
                  <img
                    src={s.image}
                    alt={`${i + 1}단계 ${s.title}`}
                    loading="lazy"
                    decoding="async"
                    className={cn("aspect-[4/3] w-full bg-black object-cover", flip)}
                  />
                  <span className="absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-[13.5px] font-black tabular-nums text-primary-foreground shadow">
                    {i + 1}
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                    <Play className="h-2.5 w-2.5 fill-current" aria-hidden /> 영상
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14.5px] font-black leading-snug text-foreground">
                    <span className="mr-0.5 text-primary">{i + 1}.</span> {s.title}
                  </h3>
                  <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-bold leading-snug text-foreground">
                    <span aria-hidden className="mt-[5px] h-1.5 w-3 shrink-0 rounded-full bg-[#10B981]" />
                    <span className="min-w-0">{txt(s.dir)}</span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{txt(s.desc)}</p>
                  {s.tip && <p className="mt-1 text-[12px] font-semibold leading-relaxed text-primary">{txt(s.tip)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default HandWrapStepViewer;
