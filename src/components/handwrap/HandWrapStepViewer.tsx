/**
 * 📷 붕대 감기 — 단계별로 한 장씩 (2026-10-20 대표님: "한 장 한 장 사진과 설명을 통해 영상이 어려운 분들은 그림을 보고 배울 수 있도록").
 *   2026-10-20 대표님: "애니메이션화 시키고 배경 없애 줘 — 감는 방향, 올라가는 대각선, 내려가는 방향 등등 상세하게"
 *   → 큰 그림 자리가 배경 지운 4~5초 반복 영상(소리 없음)이 됐다. 마지막 장면에서 멈추고 감는 방향 화살표가 그려진다.
 *     움직임 줄이기 설정이면 화살표까지 그려진 마지막 장면(포스터)만 보여 준다.
 *   2026-10-26 대표님 "복싱붕대감기 지금 이상하게나와" → 영상 10개를 다시 만들었다(파일 이름 · 화살표 · 글 · 박자는 그대로):
 *     손 테두리를 매끈하게(배경 조각 · 흰 테두리 없앰, 옅은 그림자) · 흔들린 순간 대신 멈춘 손이 바탕에서 나타남 ·
 *     끝에서 처음 장면과 겹치며 손이 두 개로 보이던 이음새 대신 바탕색으로 사라졌다 다시 나타난다.
 *
 *   큰 영상 + 몇 번째 장인지 + 보는 방향 · 화살표 읽는 법 + 제목 · 설명 · 포인트 → 이전 · 다음 (옆으로 밀어도 넘어간다)
 *   → 아래 작은 그림 줄로 바로 가기.
 *   '이 장면 영상으로 보기'를 누르면 그 장면이 나오는 각도의 원본 영상을 그 초부터 연다 (onWatch).
 *   영상 · 글은 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, Play } from "lucide-react";
import { HANDWRAP_ARROW_LEGEND, HANDWRAP_STEPS, HANDWRAP_VIEW_NOTE, type HandWrapStep } from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

interface Props {
  onWatch: (step: HandWrapStep) => void;
  className?: string;
}

const SWIPE_PX = 40;

const prefersReducedMotion = () => {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const HandWrapStepViewer = ({ onWatch, className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const touchX = useRef<number | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const [still] = useState(prefersReducedMotion);

  const go = (i: number) => setIdx(Math.min(total - 1, Math.max(0, i)));

  // 작은 사진 줄 — 지금 장이 가운데 오게 옆으로만 맞춘다 (화면 전체는 움직이지 않게 scrollIntoView 대신 scrollLeft)
  // + 다음 사진을 미리 받아 둔다
  useEffect(() => {
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
  }, [idx, steps, total]);

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

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      {/* 큰 사진 */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-[#F5F8F7]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="단계 넘기기"
      >
        {still ? (
          <img
            key={step.image}
            src={step.image}
            alt={`${idx + 1}단계 ${step.title} — 감는 방향 화살표`}
            className="h-full w-full object-contain"
            decoding="async"
          />
        ) : (
          <video
            key={step.clip}
            src={step.clip}
            poster={step.image}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label={`${idx + 1}단계 ${step.title} — 감는 방향 화살표가 나오는 짧은 영상`}
            className="h-full w-full object-contain"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12.5px] font-black tabular-nums text-white backdrop-blur-sm">
          {idx + 1} / {total}
        </span>
      </div>
      <div className="space-y-0.5 border-b border-border/60 px-4 py-2 text-[11.5px] font-semibold leading-snug text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Eye aria-hidden className="h-3.5 w-4 shrink-0 text-foreground" />
          {HANDWRAP_VIEW_NOTE[step.view]}
        </p>
        <p className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-4 shrink-0 rounded-full bg-[#10B981]" />
          {HANDWRAP_ARROW_LEGEND}
        </p>
      </div>

      {/* 글 */}
      <div className="px-4 pb-3 pt-3.5" aria-live="polite">
        <p className="text-[12px] font-black text-primary">{idx + 1}단계</p>
        <h3 className="mt-0.5 text-[17px] font-black leading-snug text-foreground">{step.title}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-foreground">{step.desc}</p>
        {step.tip && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-[12.5px] font-semibold leading-relaxed text-foreground">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">{step.tip}</span>
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
        <Play className="h-3.5 w-3.5 fill-current" /> 이 장면 영상으로 보기
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
              <img src={s.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10.5px] font-black tabular-nums text-white">
                {i + 1}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default HandWrapStepViewer;
