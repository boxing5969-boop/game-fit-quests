/**
 * 📷 붕대 감기 12단계 사진 설명서 — 사진마다 방향(시작 → 끝)이 그려지고, 밑에 설명이 모두 보인다.
 *
 *   2026-10-27 대표님: "한눈에 처음부터 끝까지 설명서처럼 · 누르면 상세페이지처럼 · 한 단계씩" (9단계 · 실제 영상 장면)
 *   2026-10-30 대표님: 코팅 설명서 사진 "이사진이랑 동일하게" → 12단계 그림 애니메이션 →
 *     "일러스트 애니메이션 그림이 좀 별로야 · 사진 고화질로 만들고 방향 알려주는 버전 · 밑에 설명까지 같이 · 각 그림마다 설명"
 *
 *   설명서: 위에서 아래로 12단계 + 완성. 단계마다 사진(4:3) 위에 방향 표시(HandWrapGuideDraw — 화면에 들어오면 한 번 그려짐)
 *     + 사진 밑에 설명서 글 · 짧은 설명 · 시작 → 끝 · 자세한 설명 · 팁(줄이지 않음). 사진을 누르면 크게(한 단계씩 따라 하기).
 *   한 단계씩(주소 ?step=N — 뒤로 가기로 닫힌다): 큰 사진 + 방향 그리기(누르면 다시) · 같은 글 · 이전 / 다음(옆으로 밀어도).
 *   왼손은 사진을 거울로 뒤집고 방향 표시도 뒤집는다(글자는 그대로). 글 · 사진 · 좌표는 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, Hand, Maximize2, Play, RotateCcw, X } from "lucide-react";
import HandWrapGuideDraw from "@/components/handwrap/HandWrapGuideDraw";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_STEPS,
  HANDWRAP_VIEW_NOTE,
  handWrapStepLabel,
  handWrapStepParam,
  mirrorArrows,
  type HandSide,
  type HandWrapStep,
} from "@/data/handWrapGuide";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

const SWIPE_PX = 40;

/** 이 기기에서 고른 손 기억 (못 쓰는 브라우저면 그냥 기본값) */
const PREF_HAND = "mb153.handwrap.hand";
const readPref = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writePref = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* 사생활 보호 창 등 — 기억만 못 할 뿐 */
  }
};

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
      "h-8 shrink-0 rounded-full px-3 text-label font-bold transition-colors active:scale-95",
      on ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
    )}
  >
    {children}
  </button>
);

const HandChips = ({ hand, setHand }: { hand: HandSide; setHand: (h: HandSide) => void }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
    <span className="flex items-center gap-1 text-label font-bold text-muted-foreground">
      <Hand className="h-3.5 w-3.5" aria-hidden /> 감는 손
    </span>
    <Chip on={hand === "right"} onClick={() => setHand("right")}>
      오른손
    </Chip>
    <Chip on={hand === "left"} onClick={() => setHand("left")} label="왼손 — 사진을 거울로 뒤집어 보기">
      왼손 (거울)
    </Chip>
  </div>
);

/** 사진 위 표시 읽는 법 */
const Legend = ({ className }: { className?: string }) => (
  <p className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-label font-semibold text-muted-foreground", className)}>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" /> 시작
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-1 w-4 rounded-full bg-[#FACC15]" /> 붕대 길
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" /> 손바닥 쪽
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#F97316] ring-2 ring-white" /> 끝
    </span>
  </p>
);

/** 사진 + 방향 표시 (4:3). drawKey 가 바뀌면 방향을 처음부터 다시 그린다. 왼손은 사진 · 표시를 거울로 */
const StepPhoto = ({
  step,
  hand,
  draw,
  drawKey,
  still,
  eager,
  className,
}: {
  step: HandWrapStep;
  hand: HandSide;
  /** 방향을 보여 줄지 (화면에 들어오기 전엔 숨겨 두었다가 들어오면 그린다) */
  draw: boolean;
  drawKey: string | number;
  still: boolean;
  eager?: boolean;
  className?: string;
}) => {
  const mirrored = hand === "left";
  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-[#E5ECEF]", className)}>
      <img
        src={step.image}
        alt={`${handWrapStepLabel(HANDWRAP_STEPS.indexOf(step))} ${step.title} — 사진`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("absolute inset-0 h-full w-full object-cover", mirrored && "-scale-x-100")}
      />
      {draw && <HandWrapGuideDraw key={`${drawKey}-${hand}`} guide={step.guide} mirrored={mirrored} mode={still ? "still" : "anim"} />}
    </div>
  );
};

/** 사진 밑 글 — 설명서 글 · 시작 → 끝 · 자세한 설명 · 팁 (줄이지 않고 다 보인다) */
const StepText = ({ step, idx, hand, big }: { step: HandWrapStep; idx: number; hand: HandSide; big?: boolean }) => {
  const txt = (t: string) => (hand === "left" ? mirrorArrows(t) : t);
  const label = handWrapStepLabel(idx);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("text-label font-black", step.final ? "text-[#EA580C]" : "text-primary")}>{label}</span>
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-micro font-bold text-muted-foreground">설명서 · {step.sheet}</span>
      </div>
      <h3 className={cn("mt-0.5 font-black leading-snug text-foreground", big ? "text-heading" : "text-body")}>{step.title}</h3>
      <p className="mt-1 text-label font-semibold leading-relaxed text-foreground/80">{txt(step.short)}</p>

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5">
        <div className="rounded-xl bg-[#10B981]/10 px-3 py-2 ring-1 ring-[#10B981]/35">
          <p className="text-micro font-black text-[#059669]">시작</p>
          <p className="mt-0.5 text-label font-bold leading-snug text-foreground">{step.from}</p>
        </div>
        <div className="flex items-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="rounded-xl bg-[#F97316]/10 px-3 py-2 ring-1 ring-[#F97316]/35">
          <p className="text-micro font-black text-[#EA580C]">끝</p>
          <p className="mt-0.5 text-label font-bold leading-snug text-foreground">{step.to}</p>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {step.how.map((h, i) => (
          <li key={h} className="flex gap-2.5">
            <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-black text-background">
              {i + 1}
            </span>
            <span className="min-w-0 text-label leading-relaxed text-foreground">{txt(h)}</span>
          </li>
        ))}
      </ol>

      {step.tip && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/70 px-3 py-2.5 text-label font-semibold leading-relaxed text-foreground">
          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0">{txt(step.tip)}</span>
        </p>
      )}
    </div>
  );
};

/** 완성 — 더 보여 줄 사진 (주먹 · 손가락 편 모습) */
const ExtraPhotos = ({ step, hand }: { step: HandWrapStep; hand: HandSide }) =>
  step.extras?.length ? (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {step.extras.map((e) => (
        <figure key={e.image} className="min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#E5ECEF] ring-1 ring-border/60">
            <img
              src={e.image}
              alt={`완성된 모습 — ${e.label}`}
              loading="lazy"
              decoding="async"
              className={cn("absolute inset-0 h-full w-full object-cover", hand === "left" && "-scale-x-100")}
            />
          </div>
          <figcaption className="mt-1 text-center text-label font-bold text-muted-foreground">{e.label}</figcaption>
        </figure>
      ))}
    </div>
  ) : null;

/** 설명서 한 칸 — 화면에 들어오면 방향을 한 번 그린다 */
const StepCard = ({ step, idx, hand, still, onOpen }: { step: HandWrapStep; idx: number; hand: HandSide; still: boolean; onOpen: () => void }) => {
  /** 사진이 화면에 반 넘게 들어오면 방향을 그린다 (칸 전체를 보면 글이 길어 안 걸리는 칸이 있다) */
  const ref = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(still);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <li id={`handwrap-step-${idx + 1}`} className="scroll-mt-20 overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60">
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-label={`${handWrapStepLabel(idx)} ${step.title} — 크게 보기`}
        className="group relative block w-full"
      >
        <StepPhoto step={step} hand={hand} draw={seen} drawKey={idx} still={still} />
        <span
          className={cn(
            "pointer-events-none absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-label font-black tabular-nums shadow",
            step.final ? "bg-[#F97316] text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {step.final ? "완성" : idx + 1}
        </span>
        {/* 번호는 왼쪽 위 · 크게는 오른쪽 위 — 방향 글은 손목(아래)에 많고, 위쪽 글은 가운데에 둔다(왼손 거울에서도 안 겹치게) */}
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-micro font-bold text-white">
          <Maximize2 className="h-3 w-3" aria-hidden /> 크게
        </span>
      </button>
      <div className="px-4 pb-4 pt-3">
        {step.extras && <ExtraPhotos step={step} hand={hand} />}
        <div className={step.extras ? "mt-3" : undefined}>
          <StepText step={step} idx={idx} hand={hand} />
        </div>
      </div>
    </li>
  );
};

const HandWrapStepViewer = ({ className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openIdx = handWrapStepParam(params.get("step"));
  /** 이 화면에서 눌러 연 상세면 닫을 때 뒤로 가기 (주소로 바로 들어온 상세면 주소만 지운다) */
  const pushedRef = useRef(false);
  const [still] = useState(prefersReducedMotion);
  const [hand, setHandState] = useState<HandSide>(() => {
    const h = readPref(PREF_HAND);
    return h === "left" || h === "right" ? h : HANDWRAP_DEFAULT_HAND;
  });

  const setHand = (h: HandSide) => {
    setHandState(h);
    writePref(PREF_HAND, h);
  };

  const withStep = (i: number | null) => (prev: URLSearchParams) => {
    const next = new URLSearchParams(prev);
    if (i == null) next.delete("step");
    else next.set("step", String(i + 1));
    return next;
  };
  const openStep = (i: number) => {
    pushedRef.current = true;
    setParams(withStep(i));
  };
  const goStep = useCallback(
    (i: number) => setParams(withStep(Math.min(steps.length - 1, Math.max(0, i))), { replace: true }),
    [setParams, steps.length],
  );
  const closeDetail = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      navigate(-1);
      return;
    }
    setParams(withStep(null), { replace: true });
  }, [navigate, setParams]);

  // 뒤로 가기로 닫혔으면 다음엔 다시 '눌러 연 것'부터
  useEffect(() => {
    if (openIdx == null) pushedRef.current = false;
  }, [openIdx]);

  // 상세에서 다음 사진을 미리 받아 둔다 — 넘길 때 바로 뜨게
  useEffect(() => {
    if (openIdx == null) return;
    const next = steps[openIdx + 1];
    if (next) {
      const img = new Image();
      img.src = next.image;
    }
  }, [openIdx, steps]);

  return (
    <div className={className}>
      <div className="rounded-2xl bg-card px-3 py-3 shadow-elev-1 ring-1 ring-border/60">
        <HandChips hand={hand} setHand={setHand} />
        <Legend className="mt-2" />
        <button
          type="button"
          onClick={() => openStep(0)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-label font-black text-background transition-transform active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden /> 1단계부터 한 단계씩 따라 하기
        </button>
      </div>

      {/* 설명서 — 사진마다 방향 + 밑에 설명 */}
      <ol className="mt-3 space-y-3" aria-label={`붕대 감기 ${HANDWRAP_NUMBERED_STEPS}단계 설명서`}>
        {steps.map((s, i) => (
          <StepCard key={s.image} step={s} idx={i} hand={hand} still={still} onOpen={() => openStep(i)} />
        ))}
      </ol>

      {openIdx != null &&
        createPortal(
          <StepDetail idx={openIdx} hand={hand} setHand={setHand} still={still} onGo={goStep} onClose={closeDetail} />,
          document.body,
        )}
    </div>
  );
};

// ── 한 단계씩 따라 하기 ─────────────────────────────

interface DetailProps {
  idx: number;
  hand: HandSide;
  setHand: (h: HandSide) => void;
  still: boolean;
  onGo: (i: number) => void;
  onClose: () => void;
}

const StepDetail = ({ idx, hand, setHand, still, onGo, onClose }: DetailProps) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const step = steps[idx];
  const label = handWrapStepLabel(idx);
  useModalDismiss(true, onClose);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const touchX = useRef<number | null>(null);

  // 단계가 바뀌면 글은 맨 위로
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [idx]);

  // 키보드(컴퓨터): ← → 로 넘기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onGo(idx + 1);
      else if (e.key === "ArrowLeft") onGo(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, onGo]);

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
    onGo(dx < 0 ? idx + 1 : idx - 1);
  };

  const last = idx === total - 1;
  const nextLabel = last ? "" : handWrapStepLabel(idx + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`붕대 감기 ${label} ${step.title}`}
      className="fixed inset-0 z-[60] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      {/* 머리 — 닫기 · 몇 단계 · 진행 막대 */}
      <div className="shrink-0 border-b border-border px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
          >
            <X className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-black leading-tight text-foreground">붕대 감기 {HANDWRAP_NUMBERED_STEPS}단계</p>
            <p className="truncate text-label text-muted-foreground">한 단계씩 보고 따라 감아 보세요</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-label font-black tabular-nums",
              step.final ? "bg-[#F97316]/15 text-[#EA580C]" : "bg-primary/10 text-primary",
            )}
          >
            {step.final ? "완성" : `${idx + 1} / ${HANDWRAP_NUMBERED_STEPS}`}
          </span>
        </div>
        <div className="mt-2.5 flex gap-1" role="tablist" aria-label="단계 바로 가기">
          {steps.map((s, i) => (
            <button
              key={s.image}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${handWrapStepLabel(i)} ${s.title}`}
              onClick={() => onGo(i)}
              className="flex h-4 flex-1 items-center"
            >
              <span
                className={cn(
                  "block h-1.5 w-full rounded-full transition-colors",
                  i < idx ? "bg-primary/60" : i === idx ? (s.final ? "bg-[#F97316]" : "bg-primary") : "bg-muted",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* 사진 + 방향 — 누르면 방향을 다시 그린다 */}
        <div className="relative mx-auto w-full max-w-xl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-roledescription="단계 넘기기">
          <StepPhoto step={step} hand={hand} draw drawKey={`${idx}-${run}`} still={still} eager />
          <button type="button" onClick={() => setRun((r) => r + 1)} aria-label="방향 다시 보기" className="absolute inset-0" />
          {!still && (
            <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-micro font-bold text-white">
              <RotateCcw className="h-3 w-3" aria-hidden /> 누르면 다시
            </span>
          )}
        </div>

        <div className="mx-auto max-w-xl px-4 pb-6 pt-3">
          <div className="space-y-2">
            <HandChips hand={hand} setHand={setHand} />
            <p className="flex items-center gap-1.5 text-label font-semibold text-muted-foreground">
              <Eye aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {HANDWRAP_VIEW_NOTE[hand]}
            </p>
          </div>
          {step.extras && <ExtraPhotos step={step} hand={hand} />}
          <div className="mt-3.5 border-t border-border/60 pt-3.5" aria-live="polite">
            <StepText step={step} idx={idx} hand={hand} big />
          </div>
          <Legend className="mt-3" />
        </div>
      </div>

      {/* 이전 · 다음 */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-4 py-2.5">
        <button
          type="button"
          onClick={() => onGo(idx - 1)}
          disabled={idx === 0}
          className="inline-flex h-12 w-[34%] items-center justify-center gap-1 rounded-full bg-secondary text-label font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
        </button>
        {last ? (
          <button
            type="button"
            onClick={() => onGo(0)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground text-label font-black text-background transition-transform active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> 처음부터 다시
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onGo(idx + 1)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-foreground text-label font-black text-background transition-transform active:scale-[0.98]"
          >
            다음 {nextLabel === "완성" ? "완성된 모습" : nextLabel} <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};

export default HandWrapStepViewer;
