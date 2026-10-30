/**
 * 🎞️ 붕대 감기 12단계 설명서 — 한눈에 12칸 + 완성 → 누르면 상세(그림 애니메이션 + 자세한 설명) → 한 단계씩 따라 하기.
 *
 *   2026-10-27 대표님: "한눈에 처음부터 끝까지 설명서처럼 · 누르면 상세페이지처럼 · 움직이는 사진으로 · 한 단계씩" (9단계 · 실제 영상 장면)
 *   2026-10-30 대표님: 코팅 설명서 사진 "이사진이랑 동일하게 붕대 감기 탭에 고화질 애니메이션으로 제작해서 넣어줘"
 *     → 설명서와 같은 12단계 + 완성. 단계마다 깨끗한 그림 손에 붕대가 차례로 감기는 애니메이션.
 *       시작(초록 점) · 끝(주황 점) · 바퀴 수 · 손바닥 쪽 길(남색 점선) · '손가락 사이로 넣어요' 같은 표시는 그림 안에 들어 있다.
 *     → 손마다 따로 만든 그림(오른손 기본 · 왼손) — 거울로 뒤집지 않는다(글자가 바르게).
 *
 *   한눈에: 3칸 × 4줄 + 완성(넓게) — 끝 장면 작은 그림(손 쪽으로 정사각형) + 번호 · 제목 · 짧은 설명.
 *   상세(주소 ?step=N — 뒤로 가기로 닫힌다): 애니메이션이 반복된다(처음 · 끝에 잠깐 멈춤이 그림 안에 있다). 누르면 멈춤 / 다시.
 *     감는 손(오른손 · 왼손) · 속도(아주 천천히 · 천천히 · 보통) · 이전 / 다음 (옆으로 밀어도 넘어간다).
 *     움직임 줄이기 설정이면 끝 장면만 — 누르면 움직인다.
 *   글 · 그림 주소는 data/handWrapGuide.ts HANDWRAP_STEPS 한 곳.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, Hand, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_NOTE,
  handWrapStepLabel,
  handWrapStepParam,
  mirrorArrows,
  type HandSide,
} from "@/data/handWrapGuide";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

const SWIPE_PX = 40;

/** 이 기기에서 고른 손 · 속도 기억 (못 쓰는 브라우저면 그냥 기본값) */
const PREF_HAND = "mb153.handwrap.hand";
const PREF_RATE = "mb153.handwrap.rate2";
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
    <Chip on={hand === "left"} onClick={() => setHand("left")}>
      왼손
    </Chip>
  </div>
);

/** 그림 속 표시 읽는 법 — 한눈에 보기 아래 · 상세 글 아래 */
const Legend = ({ className }: { className?: string }) => (
  <p className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-label font-semibold text-muted-foreground", className)}>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" /> 시작
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#F97316] ring-2 ring-white" /> 끝
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="w-4 border-t-[3px] border-dashed border-[#1E3A5F]" /> 손바닥 쪽으로 지나가는 길
    </span>
  </p>
);

const HandWrapStepViewer = ({ className }: Props) => {
  const steps = HANDWRAP_STEPS;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openIdx = handWrapStepParam(params.get("step"));
  /** 이 화면에서 눌러 연 상세면 닫을 때 뒤로 가기 (주소로 바로 들어온 상세면 주소만 지운다) */
  const pushedRef = useRef(false);
  const [hand, setHandState] = useState<HandSide>(() => {
    const h = readPref(PREF_HAND);
    return h === "left" || h === "right" ? h : HANDWRAP_DEFAULT_HAND;
  });
  const [rate, setRateState] = useState<number>(() => {
    const r = Number(readPref(PREF_RATE));
    return HANDWRAP_STEP_SPEEDS.some((s) => s.rate === r) ? r : HANDWRAP_DEFAULT_STEP_RATE;
  });
  const txt = (t: string) => (hand === "left" ? mirrorArrows(t) : t);

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

  // 상세에서 다음 단계 끝 장면을 미리 받아 둔다 — 넘길 때 바로 뜨게 (한 장 약 20KB)
  useEffect(() => {
    if (openIdx == null) return;
    const next = steps[openIdx + 1];
    if (next) {
      const img = new Image();
      img.src = next.media[hand].image;
    }
  }, [openIdx, steps, hand]);

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      <div className="border-b border-border/60 px-3 py-2.5">
        <HandChips hand={hand} setHand={setHand} />
      </div>

      {/* 한눈에 12칸 + 완성 */}
      <ol className="grid grid-cols-3 gap-x-2 gap-y-3.5 px-3 pb-2 pt-3" aria-label={`붕대 감기 ${HANDWRAP_NUMBERED_STEPS}단계 — 누르면 자세히`}>
        {steps.map((s, i) => (
          <li key={s.media.right.clip} className={cn("min-w-0", s.final && "col-span-3")}>
            <button
              type="button"
              onClick={() => openStep(i)}
              aria-label={`${handWrapStepLabel(i)} ${s.title} — 자세히 보기`}
              className={cn("group block w-full text-left", s.final && "flex items-center gap-3 rounded-2xl bg-secondary/60 p-2")}
            >
              <span
                className={cn(
                  "relative block aspect-square overflow-hidden rounded-xl bg-[#EAF0F3] ring-1 ring-border/70 transition-transform group-active:scale-[0.97]",
                  s.final && "w-[38%] shrink-0",
                )}
              >
                <img src={s.media[hand].thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span
                  className={cn(
                    "absolute left-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-label font-black tabular-nums shadow",
                    s.final ? "bg-[#F97316] text-white" : "bg-primary text-primary-foreground",
                  )}
                >
                  {s.final ? "완성" : i + 1}
                </span>
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55">
                  <Play className="ml-px h-2.5 w-2.5 fill-white text-white" aria-hidden />
                </span>
              </span>
              <span className={cn("block min-w-0", s.final ? "flex-1" : "mt-1.5")}>
                <span className="block text-label font-black leading-snug text-foreground">{s.title}</span>
                {/* 짧은 글은 두 줄까지 — 나머지는 누르면 상세에 */}
                <span className="mt-0.5 line-clamp-2 text-label leading-snug text-muted-foreground">{txt(s.short)}</span>
              </span>
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
        <Legend className="mt-2 justify-center" />
      </div>

      {openIdx != null &&
        createPortal(
          <StepDetail idx={openIdx} hand={hand} setHand={setHand} rate={rate} setRate={setRate} onGo={goStep} onClose={closeDetail} />,
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
}

const StepDetail = ({ idx, hand, setHand, rate, setRate, onGo, onClose }: DetailProps) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const step = steps[idx];
  const media = step.media[hand];
  const label = handWrapStepLabel(idx);
  const txt = (t: string) => (hand === "left" ? mirrorArrows(t) : t);
  useModalDismiss(true, onClose);

  const [still] = useState(prefersReducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rateRef = useRef(rate);
  /** 움직이는 중(첫 장면이 나왔다) — 그 전엔 끝 장면 그림을 덮어 둔다 */
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(still);
  /** 폰이 저절로 트는 걸 막았다 — 누르면 튼다 */
  const [blocked, setBlocked] = useState(false);
  const touchX = useRef<number | null>(null);

  // 단계 · 손이 바뀌면 처음부터 + 글은 맨 위로
  useEffect(() => {
    setPlaying(false);
    setBlocked(false);
    setPaused(still);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [idx, hand, still]);

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

  const tryPlay = (v: HTMLVideoElement) => {
    v.playbackRate = rateRef.current;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        setBlocked(true);
        setPaused(true);
      });
    }
  };

  const onTapPicture = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setPaused(false);
      setBlocked(false);
      tryPlay(v);
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
              key={s.media.right.clip}
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
        {/* 그림 애니메이션 — 표시(시작 · 끝 · 바퀴 수 · 손바닥 쪽 길)는 그림 안에 들어 있다 */}
        <div
          className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden bg-[#EAF0F3]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-roledescription="단계 넘기기"
        >
          <video
            key={media.clip}
            ref={videoRef}
            src={media.clip}
            poster={media.image}
            muted
            playsInline
            loop
            autoPlay={!still}
            preload="auto"
            onPlaying={() => {
              setPlaying(true);
              setPaused(false);
              setBlocked(false);
            }}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = rateRef.current;
              if (!still && e.currentTarget.paused) tryPlay(e.currentTarget);
            }}
            onPlay={(e) => {
              // 일부 폰은 처음 재생할 때 속도를 1로 되돌린다 — 다시 건다
              if (e.currentTarget.playbackRate !== rateRef.current) e.currentTarget.playbackRate = rateRef.current;
            }}
            aria-label={`${label} ${step.title} — 붕대가 감기는 그림`}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* 끝 장면 — 움직이기 전 · 움직임 줄이기 */}
          <img
            key={media.image}
            src={media.image}
            alt={`${label} ${step.title} — 다 감은 모습`}
            decoding="async"
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              playing ? "opacity-0" : "opacity-100",
            )}
          />

          {/* 누르면 멈춤 / 다시 */}
          <button
            type="button"
            onClick={onTapPicture}
            aria-label={paused ? "움직이는 모습 보기" : "멈추기"}
            className="absolute inset-0"
          />

          {/* 몇 단계 — 그림 위 글 띠(위쪽)와 겹치지 않게 왼쪽 아래 (완성은 그림 안에 '완성!'이 있다) */}
          {!step.final && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-1 text-label font-black text-white shadow backdrop-blur-sm">
              {label}
            </span>
          )}
          {paused || blocked ? (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-label font-black text-black shadow">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 눌러서 움직이기
            </span>
          ) : (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45">
              <Pause className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
            </span>
          )}
        </div>

        {/* 손 · 속도 */}
        <div className="space-y-2 border-b border-border/60 px-4 py-2.5">
          <HandChips hand={hand} setHand={setHand} />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-label font-bold text-muted-foreground">속도</span>
            {HANDWRAP_STEP_SPEEDS.map((s) => (
              <Chip key={s.rate} on={rate === s.rate} onClick={() => setRate(s.rate)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-label font-semibold text-muted-foreground">
            <Eye aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {HANDWRAP_VIEW_NOTE[hand]}
          </p>
        </div>

        {/* 글 — 설명서 글 · 시작 → 끝 · 자세한 설명 · 팁 */}
        <div className="px-4 pb-6 pt-3.5" aria-live="polite">
          <p className={cn("text-label font-black", step.final ? "text-[#EA580C]" : "text-primary")}>{label}</p>
          <h3 className="mt-0.5 text-heading font-black leading-snug text-foreground">{step.title}</h3>
          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-label font-semibold text-muted-foreground">
            <span className="shrink-0 text-micro font-black text-foreground/70">설명서</span>
            <span className="min-w-0 truncate">{step.sheet}</span>
          </p>

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
