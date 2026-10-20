/**
 * 📷 붕대 감기 — 사진으로 한 장씩 (2026-10-20 대표님: "한 장 한 장 사진과 설명을 통해 영상이 어려운 분들은 그림을 보고 배울 수 있도록").
 *
 *   큰 사진 1장 + 몇 번째 장인지 + 제목 · 설명 · 포인트 → 이전 · 다음 (옆으로 밀어도 넘어간다) → 아래 작은 사진 줄로 바로 가기.
 *   '이 장면 영상으로 보기'를 누르면 그 장면이 나오는 각도의 영상을 그 초부터 연다 (onWatch).
 *   사진 · 글은 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { HANDWRAP_STEPS, type HandWrapStep } from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

interface Props {
  onWatch: (step: HandWrapStep) => void;
  className?: string;
}

const SWIPE_PX = 40;

const HandWrapStepViewer = ({ onWatch, className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const touchX = useRef<number | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);

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
        className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="사진 넘기기"
      >
        <img
          key={step.image}
          src={step.image}
          alt={`${idx + 1}단계 ${step.title}`}
          className="h-full w-full object-cover"
          decoding="async"
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12.5px] font-black tabular-nums text-white backdrop-blur-sm">
          {idx + 1} / {total}
        </span>
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
