/**
 * 🎞️ 붕대 감기 — 한 단계씩 따라 하기 (상세 · 주소 ?step=N).
 *
 *   2026-10-30: 그림 애니메이션이 반복된다 — 누르면 멈춤 / 다시 · 감는 손 · 속도 · 이전 / 다음(옆으로 밀어도 넘어간다).
 *   2026-11-12 대표님 "내가 찍어 논 영상도 나오게 · 현재 있는 메뉴얼도 있게 · 글과 영상 이미지 활용해서":
 *     · 맨 위 '실제 영상 | 그림' — 같은 단계를 대표님이 직접 감는 영상(그 단계만 자른 반복 영상)과 그림으로 바꿔 본다.
 *       처음은 실제 영상 · 절반 속도(손이 빨라서). 고른 것은 이 기기에 남는다.
 *     · 실제 영상은 왼손이 찍혀 있다 — 오른손을 고르면 좌우를 뒤집는다(같은 영상이라 끊기지 않고 그대로 이어 돈다).
 *     · 글: 단계 이름 · 큰 흐름(① 손목 …) · 시작 → 끝 옆에 다른 쪽 그림(영상을 볼 땐 그림, 그림을 볼 땐 영상 끝 장면) — 누르면 바뀐다.
 *   움직임 줄이기 설정이면 끝 장면만 — 누르면 움직인다.
 */
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_STEPS,
  HANDWRAP_VIEW_NOTE,
  handWrapRealFlip,
  handWrapStageMark,
  handWrapStageName,
  handWrapStepLabel,
  mirrorArrows,
} from "@/data/handWrapGuide";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { setHandWrapHand, setHandWrapRate, setHandWrapView, useHandWrapPrefs } from "@/hooks/useHandWrapPrefs";
import { cn } from "@/lib/utils";
import { HandChips, Legend, SpeedChips, ViewSwitch } from "./HandWrapParts";

interface Props {
  idx: number;
  onGo: (i: number) => void;
  onClose: () => void;
}

const SWIPE_PX = 40;

const prefersReducedMotion = () => {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const HandWrapStepDetail = ({ idx, onGo, onClose }: Props) => {
  const steps = HANDWRAP_STEPS;
  const total = steps.length;
  const step = steps[idx];
  const { hand, view, drawRate, realRate } = useHandWrapPrefs();
  const real = view === "real";
  const media = real ? step.real : step.media[hand];
  /** 실제 영상은 왼손 — 다른 손이면 좌우 뒤집기 (그림은 손마다 따로 만든 것이라 뒤집지 않는다) */
  const flip = real && handWrapRealFlip(hand);
  const rate = real ? realRate : drawRate;
  const label = handWrapStepLabel(idx);
  const txt = (t: string) => (hand === "left" ? mirrorArrows(t) : t);
  useModalDismiss(true, onClose);

  const [still] = useState(prefersReducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rateRef = useRef(rate);
  /** 움직이는 중(첫 장면이 나왔다) — 그 전엔 끝 장면을 덮어 둔다 */
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(still);
  /** 폰이 저절로 트는 걸 막았다 — 누르면 튼다 */
  const [blocked, setBlocked] = useState(false);
  const touchX = useRef<number | null>(null);

  // 영상이 바뀌면(단계 · 보는 방법 · 그림의 손) 처음부터 — 실제 영상에서 손만 바꾸면 같은 영상이라 그대로 이어 돈다
  useEffect(() => {
    setPlaying(false);
    setBlocked(false);
    setPaused(still);
  }, [media.clip, still]);

  // 단계가 바뀌면 글은 맨 위로 (scrollTo 가 없는 옛 브라우저도 되게 scrollTop 으로)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [idx]);

  useEffect(() => {
    rateRef.current = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  // 다음 단계 끝 장면을 미리 받아 둔다 — 넘길 때 바로 뜨게 (한 장 20~40KB)
  useEffect(() => {
    const next = steps[idx + 1];
    if (!next) return;
    const img = new Image();
    img.src = real ? next.real.image : next.media[hand].image;
  }, [idx, steps, hand, real]);

  // 실제 영상은 움직이기 시작하면 다음 단계 영상을 미리 받아 두라고 브라우저에 알린다 (손이 바빠 기다리기 어렵다).
  //   <link rel="prefetch"> — 되는 브라우저(크롬 · 삼성 인터넷)만 한가할 때 받고, 데이터 아끼기 설정이면 브라우저가 건너뛴다.
  //   아이폰 사파리는 이 표시를 무시한다 (직접 fetch 로 받으면 영상 재생기가 그 사본을 못 써서 두 번 받게 된다 — 그래서 쓰지 않는다).
  useEffect(() => {
    if (!real || !playing) return;
    const next = steps[idx + 1];
    if (!next) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = next.real.clip;
    document.head.appendChild(link);
    return () => link.remove();
  }, [real, playing, idx, steps]);

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
  const stageIdx = step.stage - 1;
  /** 시작 → 끝 옆 작은 그림 — 지금 안 보는 쪽 (누르면 그쪽으로 바꾼다) */
  const other = real
    ? { src: step.media[hand].thumb, flip: false, text: "그림 보기", aria: "그림으로 보기" }
    : { src: step.real.image, flip: handWrapRealFlip(hand), text: "영상 보기", aria: "실제 영상으로 보기" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`붕대 감기 ${label} ${step.title}`}
      className="fixed inset-0 z-[60] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      {/* 머리 — 닫기 · 실제 영상 | 그림 · 몇 단계 · 진행 막대 */}
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
          <div className="flex min-w-0 flex-1 justify-center">
            <ViewSwitch view={view} setView={setHandWrapView} />
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
        {/* 영상 · 그림 — 그림은 표시(시작 · 끝 · 바퀴 수 · 손바닥 쪽 길)가 그림 안에 들어 있다 */}
        <div
          className={cn("relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden", real ? "bg-black" : "bg-[#EAF0F3]")}
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
            aria-label={real ? `${label} ${step.title} — 실제로 감는 영상` : `${label} ${step.title} — 붕대가 감기는 그림`}
            className={cn("absolute inset-0 h-full w-full object-cover", flip && "-scale-x-100")}
          />
          {/* 끝 장면 — 움직이기 전 · 움직임 줄이기 */}
          <img
            key={media.image}
            src={media.image}
            alt={`${label} ${step.title} — 다 감은 모습`}
            decoding="async"
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              flip && "-scale-x-100",
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

          {/* 몇 단계 — 그림 위 글 띠(위쪽)와 겹치지 않게 왼쪽 아래 (그림의 완성 칸은 그림 안에 '완성!'이 있다) */}
          {(real || !step.final) && (
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

        {/* 손 · 속도 — 속도는 영상 · 그림 따로 기억한다 */}
        <div className="space-y-2 border-b border-border/60 px-4 py-2.5">
          <HandChips hand={hand} setHand={setHandWrapHand} />
          <SpeedChips rate={rate} setRate={(r) => setHandWrapRate(view, r)} />
        </div>

        {/* 글 — 단계 · 큰 흐름 · 설명서 글 · 시작 → 끝(+ 다른 쪽 그림) · 자세한 설명 · 팁 */}
        <div className="px-4 pb-6 pt-3.5" aria-live="polite">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-label font-black", step.final ? "text-[#EA580C]" : "text-primary")}>{label}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">
              {handWrapStageMark(stageIdx)} {handWrapStageName(stageIdx)}
            </span>
          </p>
          <h3 className="mt-1 text-heading font-black leading-snug text-foreground">{step.title}</h3>
          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-label font-semibold text-muted-foreground">
            <span className="shrink-0 text-micro font-black text-foreground/70">설명서</span>
            <span className="min-w-0 truncate">{step.sheet}</span>
          </p>

          <div className="mt-3 flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setHandWrapView(real ? "draw" : "real")}
              aria-label={other.aria}
              className="relative block min-h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-[#EAF0F3] ring-1 ring-border/70 transition-transform active:scale-[0.97]"
            >
              {/* 아이폰(웹킷): 그림은 left · top · 크기를 모두 준다 (inset 만으로 잡지 않는다) */}
              <img
                key={other.src}
                src={other.src}
                alt=""
                decoding="async"
                className={cn("absolute left-0 top-0 h-full w-full object-cover", other.flip && "-scale-x-100")}
              />
              <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/65 py-0.5 text-center text-micro font-bold text-white">
                {other.text}
              </span>
            </button>
            <div className="grid min-w-0 flex-1 grid-rows-2 gap-1.5">
              <div className="flex flex-col justify-center rounded-xl bg-[#10B981]/10 px-3 py-1.5 ring-1 ring-[#10B981]/35">
                <p className="text-micro font-black text-[#059669]">시작</p>
                <p className="text-label font-bold leading-snug text-foreground">{step.from}</p>
              </div>
              <div className="flex flex-col justify-center rounded-xl bg-[#F97316]/10 px-3 py-1.5 ring-1 ring-[#F97316]/35">
                <p className="text-micro font-black text-[#EA580C]">끝</p>
                <p className="text-label font-bold leading-snug text-foreground">{step.to}</p>
              </div>
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

          <p className="mt-3.5 flex items-center gap-1.5 text-label font-semibold text-muted-foreground">
            <Eye aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {HANDWRAP_VIEW_NOTE[hand]}
          </p>
          {!real && <Legend className="mt-2" />}
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

export default HandWrapStepDetail;
