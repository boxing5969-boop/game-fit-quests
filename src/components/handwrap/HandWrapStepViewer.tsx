/**
 * 📷 붕대 감기 9단계 설명서 — 한눈에 9칸 → 누르면 상세(움직이는 사진 + 방향 + 자세한 설명) → 한 단계씩 따라 하기.
 *
 *   2026-10-20 대표님: "한 장 한 장 사진과 설명을 통해 영상이 어려운 분들은 그림을 보고 배울 수 있도록" (처음 만듦)
 *   2026-10-27 07:25 대표님: "화질도 많이 깨지고 … 방향이랑 속도 조절 … 한눈에 처음부터 끝까지 설명서 보듯" → 실제 감는 장면 · 속도 · 거울
 *   2026-10-27 10:01 대표님: "한눈에 1번 단계부터 9단계까지 사진 총 9장을 한 번에 볼 수 있고, 각 단계마다 이미지와 설명이 밑에 …
 *     클릭하면 상세페이지처럼 나오고 사진 밑에 설명 자세히, 사진에 방향과 어디에서 시작해서 어디로 오는지 — 사진보다 움직이는 사진으로.
 *     한 단계씩 보고 따라 할 수 있는"
 *
 *   한눈에: 3칸 × 3줄 — 끝 장면 작은 사진 위에 방향(시작 초록 · 끝 주황 · 점선 = 손바닥 쪽) + 번호 · 제목 · 짧은 설명.
 *   상세(주소 ?step=N — 뒤로 가기로 닫힌다): 끝 장면에 방향이 그려짐(3초) → 그 단계를 처음부터 끝까지 실제로 감는 움직이는 사진
 *     → 끝나면 다시 방향 → … 반복. 사진을 누르면 바로 움직임 / 멈춤. 아래 시작 → 끝 · 차례대로 자세한 설명 · 팁.
 *     감는 손(오른손은 거울) · 속도(아주 천천히 · 천천히 · 원래) · 이전 / 다음 (옆으로 밀어도 넘어간다).
 *   글 · 영상 · 방향 좌표는 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳. 방향 그림은 HandWrapGuideDraw.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, Hand, Pause, Play, RotateCcw, X } from "lucide-react";
import HandWrapGuideDraw from "@/components/handwrap/HandWrapGuideDraw";
import {
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_NOTE,
  handWrapStepParam,
  mirrorArrows,
  type HandSide,
  type HandWrapStep,
} from "@/data/handWrapGuide";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";

interface Props {
  onWatch: (step: HandWrapStep) => void;
  className?: string;
}

/** 끝 장면에 방향을 그리고 보여 주는 시간 — 그리기 약 1.7초 + 보기 */
const GUIDE_MS = 3300;
const SWIPE_PX = 40;

/** 이 기기에서 고른 손 · 속도 기억 (못 쓰는 브라우저면 그냥 기본값) */
const PREF_HAND = "mb153.handwrap.hand";
const PREF_RATE = "mb153.handwrap.rate";
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
    <span className="flex items-center gap-1 text-micro font-bold text-muted-foreground">
      <Hand className="h-3.5 w-3.5" aria-hidden /> 감는 손
    </span>
    <Chip on={hand === "left"} onClick={() => setHand("left")}>
      왼손
    </Chip>
    <Chip on={hand === "right"} onClick={() => setHand("right")} label="오른손 — 사진을 거울로 뒤집어 보기">
      오른손 (거울)
    </Chip>
  </div>
);

const HandWrapStepViewer = ({ onWatch, className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openIdx = handWrapStepParam(params.get("step"));
  /** 이 화면에서 눌러 연 상세면 닫을 때 뒤로 가기 (주소로 바로 들어온 상세면 주소만 지운다) */
  const pushedRef = useRef(false);
  const [hand, setHandState] = useState<HandSide>(() => (readPref(PREF_HAND) === "right" ? "right" : "left"));
  const [rate, setRateState] = useState<number>(() => {
    const r = Number(readPref(PREF_RATE));
    return HANDWRAP_STEP_SPEEDS.some((s) => s.rate === r) ? r : HANDWRAP_DEFAULT_STEP_RATE;
  });
  const mirrored = hand === "right";
  const txt = (t: string) => (mirrored ? mirrorArrows(t) : t);

  const setHand = (h: HandSide) => {
    setHandState(h);
    writePref(PREF_HAND, h);
  };
  const setRate = (r: number) => {
    setRateState(r);
    writePref(PREF_RATE, String(r));
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

  // 한눈에 9칸 사진을 미리 받아 둔다 — 상세에서 넘길 때 바로 뜨게 큰 사진도 (작아서 9장 합쳐 약 250KB)
  useEffect(() => {
    if (openIdx == null) return;
    const next = steps[openIdx + 1];
    if (next) {
      const img = new Image();
      img.src = next.image;
    }
  }, [openIdx, steps]);

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      <div className="border-b border-border/60 px-3 py-2.5">
        <HandChips hand={hand} setHand={setHand} />
      </div>

      {/* 한눈에 9칸 */}
      <ol className="grid grid-cols-3 gap-x-2 gap-y-3.5 px-3 pb-2 pt-3" aria-label="붕대 감기 9단계 — 누르면 자세히">
        {steps.map((s, i) => (
          <li key={s.image} className="min-w-0">
            <button
              type="button"
              onClick={() => openStep(i)}
              aria-label={`${i + 1}단계 ${s.title} — 자세히 보기`}
              className="group block w-full text-left"
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-black ring-1 ring-border/70 transition-transform group-active:scale-[0.97]">
                <img
                  src={s.thumb}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn("h-full w-full object-cover", mirrored && "-scale-x-100")}
                />
                <HandWrapGuideDraw guide={s.guide} mirrored={mirrored} mode="thumb" />
                <span className="absolute left-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-label font-black tabular-nums text-primary-foreground shadow">
                  {i + 1}
                </span>
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55">
                  <Play className="ml-px h-2.5 w-2.5 fill-white text-white" aria-hidden />
                </span>
              </span>
              <span className="mt-1.5 block text-label font-black leading-snug text-foreground">{s.title}</span>
              <span className="mt-0.5 block text-micro leading-snug text-muted-foreground">{txt(s.short)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => openStep(0)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-label font-black text-background transition-transform active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden /> 1단계부터 한 단계씩 따라 하기
        </button>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-micro font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" /> 시작
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#F97316] ring-2 ring-white" /> 끝
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-1 w-4 rounded-full bg-[#FACC15]" /> 붕대 길
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" /> 손바닥 쪽
          </span>
        </p>
      </div>

      {openIdx != null &&
        createPortal(
          <StepDetail
            idx={openIdx}
            hand={hand}
            setHand={setHand}
            rate={rate}
            setRate={setRate}
            onGo={goStep}
            onClose={closeDetail}
            onWatch={onWatch}
          />,
          document.body,
        )}
    </div>
  );
};

// ── 상세 — 한 단계씩 따라 하기 ─────────────────────────────

interface DetailProps {
  idx: number;
  hand: HandSide;
  setHand: (h: HandSide) => void;
  rate: number;
  setRate: (r: number) => void;
  onGo: (i: number) => void;
  onClose: () => void;
  onWatch: (step: HandWrapStep) => void;
}

/** guide: 끝 장면에 방향 그리기 · starting: 움직이는 사진을 막 트는 중(끝 장면 그대로) · play: 움직이는 사진 */
type Phase = "guide" | "starting" | "play";

const StepDetail = ({ idx, hand, setHand, rate, setRate, onGo, onClose, onWatch }: DetailProps) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const step = steps[idx];
  const mirrored = hand === "right";
  const txt = (t: string) => (mirrored ? mirrorArrows(t) : t);
  useModalDismiss(true, onClose);

  const [still] = useState(prefersReducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const rateRef = useRef(rate);
  const pausedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("guide");
  const [run, setRun] = useState(0);
  const [paused, setPausedState] = useState(false);
  /** 폰이 저절로 트는 걸 막았다 — 누르면 튼다 */
  const [blocked, setBlocked] = useState(false);
  const touchX = useRef<number | null>(null);

  const setPaused = (v: boolean) => {
    pausedRef.current = v;
    setPausedState(v);
  };
  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /** 움직이는 사진 — 처음부터 */
  const play = useCallback(() => {
    clearTimer();
    const v = videoRef.current;
    if (!v) return;
    setPaused(false);
    setBlocked(false);
    setPhase("starting");
    try {
      v.currentTime = 0;
    } catch {
      /* 아직 못 받았으면 처음부터 튼다 */
    }
    v.playbackRate = rateRef.current;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        setPhase("guide");
        setBlocked(true);
      });
    }
  }, []);

  /** 끝 장면에 방향 — 다 그리고 잠깐 보여 준 뒤 다시 움직이는 사진 */
  const showGuide = useCallback(() => {
    clearTimer();
    setPhase("guide");
    setRun((r) => r + 1);
    if (!still && !pausedRef.current) timer.current = window.setTimeout(play, GUIDE_MS);
  }, [play, still]);

  // 단계가 바뀌면 방향부터 다시 + 글은 맨 위로
  useEffect(() => {
    setPaused(false);
    setBlocked(false);
    showGuide();
    scrollRef.current?.scrollTo({ top: 0 });
    return clearTimer;
  }, [idx, showGuide]);

  useEffect(() => {
    rateRef.current = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  // 키보드(컴퓨터): ← → 로 넘기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onGo(idx + 1);
      else if (e.key === "ArrowLeft") onGo(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, onGo]);

  const onTapPicture = () => {
    const v = videoRef.current;
    if (phase !== "play" || !v) {
      play();
      return;
    }
    if (v.paused) {
      setPaused(false);
      v.play().catch(() => setBlocked(true));
    } else {
      v.pause();
      setPaused(true);
    }
  };

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

  const flip = mirrored ? "-scale-x-100" : "";
  const showPoster = phase !== "play";
  const last = idx === total - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`붕대 감기 ${idx + 1}단계 ${step.title}`}
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
            <p className="truncate text-body font-black leading-tight text-foreground">붕대 감기 9단계</p>
            <p className="truncate text-micro text-muted-foreground">한 단계씩 보고 따라 감아 보세요</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-label font-black tabular-nums text-primary">
            {idx + 1} / {total}
          </span>
        </div>
        <div className="mt-2.5 flex gap-1" role="tablist" aria-label="단계 바로 가기">
          {steps.map((s, i) => (
            <button
              key={s.image}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${i + 1}단계 ${s.title}`}
              onClick={() => onGo(i)}
              className="flex h-4 flex-1 items-center"
            >
              <span className={cn("block h-1.5 w-full rounded-full transition-colors", i < idx ? "bg-primary/60" : i === idx ? "bg-primary" : "bg-muted")} />
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* 움직이는 사진 + 방향 */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden bg-black"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-roledescription="단계 넘기기"
        >
          <video
            key={step.clip}
            ref={videoRef}
            src={step.clip}
            muted
            playsInline
            preload="auto"
            onPlaying={() => setPhase("play")}
            onEnded={showGuide}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = rateRef.current;
            }}
            onPlay={(e) => {
              // 일부 폰은 처음 재생할 때 속도를 1로 되돌린다 — 다시 건다
              if (e.currentTarget.playbackRate !== rateRef.current) e.currentTarget.playbackRate = rateRef.current;
            }}
            aria-label={`${idx + 1}단계 ${step.title} — 실제로 감는 모습`}
            className={cn("absolute inset-0 h-full w-full object-cover", flip)}
          />
          {/* 끝 장면 (영상의 마지막 그림과 같다) — 방향을 그리는 동안 */}
          <img
            key={step.image}
            src={step.image}
            alt={`${idx + 1}단계 ${step.title} — 다 감은 모습`}
            decoding="async"
            className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", flip, showPoster ? "opacity-100" : "opacity-0")}
          />
          {phase === "guide" && <HandWrapGuideDraw key={`${idx}-${run}-${hand}`} guide={step.guide} mirrored={mirrored} mode={still ? "still" : "anim"} />}

          {/* 누르면 움직임 / 멈춤 */}
          <button
            type="button"
            onClick={onTapPicture}
            aria-label={phase === "play" ? (paused ? "다시 움직이기" : "멈추기") : "움직이는 모습 보기"}
            className="absolute inset-0"
          />

          {/* 몇 단계 · 지금 보는 것 — 방향 글과 겹치지 않게 왼쪽 위 한 곳에 */}
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/60 py-1 pl-2.5 pr-3 text-label font-black text-white backdrop-blur-sm">
            <span className="tabular-nums">{idx + 1}단계</span>
            <span aria-hidden className="h-3 w-px bg-white/40" />
            {phase === "play" ? (
              <span className="inline-flex items-center gap-1 text-micro font-bold">
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> 움직이는 모습
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-micro font-bold">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[#10B981]" /> 시작
                <ArrowRight className="h-3 w-3" aria-hidden />
                <span aria-hidden className="h-2 w-2 rounded-full bg-[#F97316]" /> 끝
              </span>
            )}
          </span>
          {(paused || blocked || (still && phase === "guide")) && (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-label font-black text-black shadow">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 눌러서 움직이는 모습
            </span>
          )}
          {phase === "play" && !paused && (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
              <Pause className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
            </span>
          )}
        </div>

        {/* 손 · 속도 */}
        <div className="space-y-2 border-b border-border/60 px-4 py-2.5">
          <HandChips hand={hand} setHand={setHand} />
          {!still && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-micro font-bold text-muted-foreground">속도</span>
              {HANDWRAP_STEP_SPEEDS.map((s) => (
                <Chip key={s.rate} on={rate === s.rate} onClick={() => setRate(s.rate)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-micro font-semibold text-muted-foreground">
            <Eye aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {HANDWRAP_VIEW_NOTE[step.view][hand]}
          </p>
        </div>

        {/* 글 — 시작 → 끝 · 자세한 설명 · 팁 */}
        <div className="px-4 pb-6 pt-3.5" aria-live="polite">
          <p className="text-label font-black text-primary">{idx + 1}단계</p>
          <h3 className="mt-0.5 text-heading font-black leading-snug text-foreground">{step.title}</h3>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5">
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

          <ol className="mt-3.5 space-y-2.5">
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
            <p className="mt-3.5 flex items-start gap-2 rounded-xl bg-secondary/70 px-3 py-2.5 text-label font-semibold leading-relaxed text-foreground">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0">{txt(step.tip)}</span>
            </p>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-label leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-[5px] h-1 w-4 shrink-0 rounded-full bg-[#FACC15]" />
            <span className="min-w-0">
              노란 길이 붕대가 지나가는 길이에요. 흰 점선은 손바닥 쪽(안 보이는 쪽)으로 지나가요.
            </span>
          </p>

          <button
            type="button"
            onClick={() => onWatch(step)}
            className="mt-3.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-label font-bold text-primary ring-1 ring-primary/40 transition-transform active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 이 장면 큰 영상으로 보기
          </button>
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
            다음 {idx + 2}단계 <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};

export default HandWrapStepViewer;
