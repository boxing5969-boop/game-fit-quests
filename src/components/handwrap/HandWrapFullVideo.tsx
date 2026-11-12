/**
 * 🎬 붕대 감기 — 전체 영상으로 먼저 보기 + 큰 흐름 3 · 3 · 3 (2026-11-12).
 *
 *   대표님 "내가 찍어 논 영상 있잖아 — 영상도 나오게 해 주고 … 회원님들이 최대한 쉽게 학습할 수 있도록".
 *   배우는 순서: ① 처음부터 끝까지 한 번 본다(이 칸 · 44초) → ② 한 단계씩 따라 감는다(단계 상세) → ③ 다 감고 확인한다.
 *
 *   · 영상은 화면 안에서 바로 돈다(소리 없음 · 누르면 멈춤). 보이기 전에는 받지 않는다(preload none — 표지 그림만).
 *   · '내 눈으로'(내 손을 내려다보는 방향) ↔ '옆에서' — 영상 오른쪽 위 단추.
 *   · 감는 손: 영상에는 왼손이 찍혀 있다 — 오른손을 고르면 좌우를 뒤집는다.
 *   · 영상 아래 '순서는 3 · 3 · 3' 네 칸(손목 3바퀴 → 정권 3바퀴 → 손가락 사이 3번 → 마무리): 영상이 지나가는 칸에 불이 들어오고,
 *     칸 아래 한 줄이 '왜 하는지'로 바뀐다. 칸을 누르면 그 부분부터 다시 본다.
 *     '내 눈으로'는 지금 몇 단계인지도 보여 주고, 누르면 그 단계만 반복하는 상세로 간다.
 *   · 단계 상세가 열리거나 화면 밖으로 밀려나면 멈춘다 (뒤에서 혼자 돌지 않게).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Pause, Play, Repeat2, RotateCcw } from "lucide-react";
import {
  HANDWRAP_FULL,
  HANDWRAP_STAGES,
  HANDWRAP_STAGES_LINE,
  HANDWRAP_STEPS,
  handWrapIndexAt,
  handWrapRealFlip,
  handWrapStageMark,
  handWrapStageName,
  handWrapStepAt,
  handWrapStepLabel,
  type HandWrapAngle,
} from "@/data/handWrapGuide";
import { setHandWrapHand, useHandWrapPrefs } from "@/hooks/useHandWrapPrefs";
import { cn } from "@/lib/utils";
import { Chip, HandChips } from "./HandWrapParts";

interface Props {
  /** 그 단계 상세 열기 (0부터) */
  onOpenStep: (i: number) => void;
  /** 단계 상세가 이 칸을 덮고 있다 — 영상을 멈춘다 */
  covered?: boolean;
  className?: string;
}

const SLOW_RATE = 0.5;

const HandWrapFullVideo = ({ onOpenStep, covered = false, className }: Props) => {
  const { hand } = useHandWrapPrefs();
  const [angle, setAngle] = useState<HandWrapAngle>("mine");
  const video = HANDWRAP_FULL[angle];
  const otherAngle: HandWrapAngle = angle === "mine" ? "side" : "mine";
  const flip = handWrapRealFlip(hand);

  const ref = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 한 번이라도 틀었다 — 그 전엔 표지 그림 */
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [t, setT] = useState(0);
  const [slow, setSlow] = useState(false);
  const slowRef = useRef(false);
  /** 영상 정보를 받기 전에 고른 자리 — 받으면 그 초로 간다 */
  const seekRef = useRef<number | null>(null);

  // 각도를 바꾸면 새 영상 — 표지부터
  useEffect(() => {
    seekRef.current = null;
    setStarted(false);
    setPlaying(false);
    setEnded(false);
    setFailed(false);
    setT(0);
  }, [angle]);

  // 단계 상세가 덮으면 멈춘다
  useEffect(() => {
    if (covered) ref.current?.pause();
  }, [covered]);

  // 화면 밖으로 밀려나면 멈춘다
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => !e.isIntersecting)) ref.current?.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(box);
    return () => io.disconnect();
  }, []);

  /** 틀기 — from 이 있으면 그 초부터, 다 본 뒤면 처음부터 */
  const start = (from?: number) => {
    const el = ref.current;
    if (!el) return;
    if (failed) el.load();
    const at = from ?? (ended || el.ended ? 0 : null);
    if (at != null) {
      setT(at);
      if (el.readyState >= 1 && !failed) {
        try {
          el.currentTime = at;
        } catch {
          seekRef.current = at;
        }
      } else {
        seekRef.current = at;
      }
    }
    setEnded(false);
    setFailed(false);
    setStarted(true);
    el.playbackRate = slowRef.current ? SLOW_RATE : 1;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => setPlaying(false));
  };

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused || el.ended || failed) start();
    else el.pause();
  };

  const toggleSlow = () => {
    const next = !slowRef.current;
    slowRef.current = next;
    setSlow(next);
    if (ref.current) ref.current.playbackRate = next ? SLOW_RATE : 1;
  };

  const openStep = (i: number) => {
    ref.current?.pause();
    onOpenStep(i);
  };

  const stageIdx = handWrapIndexAt(video.stageAt, t);
  const stepIdx = video.steps ? handWrapStepAt(t) : null;
  const pct = Math.max(0, Math.min(100, (t / video.duration) * 100));

  return (
    <section
      aria-label="붕대 감는 전체 영상"
      className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}
    >
      <div className="border-b border-border/60 px-3 py-2.5">
        <HandChips hand={hand} setHand={setHandWrapHand} />
      </div>

      {/* 영상 — 누르면 틀기 / 멈춤 */}
      <div ref={boxRef} className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video
          key={video.src}
          ref={ref}
          src={video.src}
          poster={video.poster}
          muted
          playsInline
          preload="none"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            el.playbackRate = slowRef.current ? SLOW_RATE : 1;
            const at = seekRef.current;
            if (at != null) {
              seekRef.current = null;
              el.currentTime = at;
            }
          }}
          onPlay={(e) => {
            // 일부 폰은 처음 재생할 때 속도를 1로 되돌린다 — 다시 건다
            const want = slowRef.current ? SLOW_RATE : 1;
            if (e.currentTarget.playbackRate !== want) e.currentTarget.playbackRate = want;
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
          }}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onError={() => {
            setPlaying(false);
            if (started) setFailed(true);
          }}
          aria-label={`붕대 감는 전체 영상 — ${video.label}`}
          className={cn("absolute inset-0 h-full w-full object-cover", flip && "-scale-x-100")}
        />
        <button type="button" onClick={toggle} aria-label={playing ? "멈추기" : "영상 보기"} className="absolute inset-0" />

        {/* 왼쪽 위 — 어느 방향 · 몇 초 */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-micro font-bold text-white backdrop-blur-sm">
          {video.label} · {video.seconds}초
        </span>
        {/* 오른쪽 위 — 다른 각도로 */}
        <button
          type="button"
          onClick={() => setAngle(otherAngle)}
          className="absolute right-2.5 top-2.5 inline-flex h-8 items-center gap-1 rounded-full bg-white/95 px-3 text-label font-bold text-black shadow transition-transform active:scale-95"
        >
          <Repeat2 className="h-3.5 w-3.5" aria-hidden /> {HANDWRAP_FULL[otherAngle].switchLabel}
        </button>

        {/* 처음 · 다 본 뒤 = 가운데 아래 큰 단추 / 보다가 멈춘 때 = 오른쪽 아래 작은 단추 (멈춘 장면을 가리지 않게) */}
        {!playing && (!started || ended || failed) && (
          <span className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-5 text-body font-black text-black shadow-lg">
              {failed ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden /> 다시 불러오기
                </>
              ) : ended ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden /> 처음부터 다시 보기
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" aria-hidden /> 영상 보기
                  {/* 틀어도 소리가 안 나서 고장인 줄 알지 않게 */}
                  <span className="text-label font-bold text-black/55">· 소리 없음</span>
                </>
              )}
            </span>
          </span>
        )}
        {!playing && started && !ended && !failed && (
          <span className="pointer-events-none absolute bottom-3 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-label font-black text-black shadow">
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 이어 보기
          </span>
        )}
        {/* 도는 동안 — 누르면 멈춘다는 표시 (단계 상세와 같은 자리) */}
        {playing && (
          <span className="pointer-events-none absolute bottom-3 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45">
            <Pause className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
          </span>
        )}

        {/* 어디까지 봤나 */}
        {started && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 block h-1 bg-white/25">
            <span className="block h-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>

      {/* 지금 어디 — 누르면 그 단계만 반복 · 천천히 */}
      <div className="flex min-h-[52px] items-center gap-2 px-3 py-2">
        {stepIdx != null ? (
          <button
            type="button"
            onClick={() => openStep(stepIdx)}
            aria-label={`${handWrapStepLabel(stepIdx)} ${HANDWRAP_STEPS[stepIdx].title} — 이 단계만 반복해서 보기`}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-label font-black tabular-nums text-primary">
              {handWrapStepLabel(stepIdx)}
            </span>
            <span className="min-w-0 truncate text-label font-bold text-foreground">{HANDWRAP_STEPS[stepIdx].title}</span>
            <span className="inline-flex shrink-0 items-center text-label font-bold text-muted-foreground">
              이 단계만 <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </button>
        ) : (
          <p className="min-w-0 flex-1 truncate text-label font-bold text-foreground">
            {handWrapStageMark(stageIdx)} {handWrapStageName(stageIdx)}
          </p>
        )}
        <Chip on={slow} onClick={toggleSlow} label={slow ? "천천히 보는 중 — 누르면 보통 속도" : "천천히 보기"}>
          천천히
        </Chip>
      </div>

      {/* 큰 흐름 — 영상이 지나가는 칸에 불 · 누르면 그 부분부터 */}
      <div className="border-t border-border/60 px-3 pb-3 pt-3">
        <p className="text-body font-black text-foreground">순서는 3 · 3 · 3</p>
        <ol className="mt-2 grid grid-cols-4 gap-2">
          {HANDWRAP_STAGES.map((s, i) => {
            const on = started && i === stageIdx;
            return (
              <li key={s.title} className="min-w-0">
                <button
                  type="button"
                  onClick={() => start(video.stageAt[i])}
                  aria-current={on ? "step" : undefined}
                  aria-label={`${i + 1}. ${s.name} — 이 부분부터 보기`}
                  className="group block w-full text-left"
                >
                  <span
                    className={cn(
                      "relative block aspect-square overflow-hidden rounded-xl bg-black transition-transform group-active:scale-[0.97]",
                      on ? "ring-[3px] ring-primary" : "ring-1 ring-border/70",
                    )}
                  >
                    <img
                      src={s.photo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn("h-full w-full object-cover", flip && "-scale-x-100")}
                    />
                    <span
                      className={cn(
                        "absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-label font-black tabular-nums shadow",
                        on ? "bg-primary text-primary-foreground" : "bg-white/95 text-black",
                      )}
                    >
                      {i + 1}
                    </span>
                  </span>
                  <span className="mt-1.5 block break-keep text-label font-black leading-tight text-foreground">{s.title}</span>
                  <span className="block break-keep text-label leading-tight text-muted-foreground">{s.count}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {/* 왜 이 순서인지 — 영상이 돌면 지금 칸의 까닭으로 바뀐다 */}
        <p className="mt-2 min-h-[2.5em] break-keep text-label leading-tight text-muted-foreground" aria-live="polite">
          {started ? `${handWrapStageMark(stageIdx)} ${handWrapStageName(stageIdx)} — ${HANDWRAP_STAGES[stageIdx].why}` : HANDWRAP_STAGES_LINE}
        </p>

        <button
          type="button"
          onClick={() => openStep(0)}
          className="mt-2 flex h-12 w-full items-center justify-center gap-1 rounded-full bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98]"
        >
          한 단계씩 따라 감기 <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
};

export default HandWrapFullVideo;
