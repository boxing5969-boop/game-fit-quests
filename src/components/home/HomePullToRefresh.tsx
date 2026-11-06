import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 홈 — 맨 위에서 한 번 더 당기면 새로고침
 * (2026-11-06 대표님 「마이복서 153홈에서 위로 한번더 올리면 새로고침되게 해줘」)
 *
 * 브라우저 기본 '당겨서 새로고침'은 index.css(html, body { overscroll-behavior: none })로 일부러 꺼 두었다
 * (앱처럼 화면이 고무줄처럼 늘지 않게 · 게임·밀기 화면에서 잘못 새로고침되지 않게). 아이폰 앱 · 홈 화면 앱(PWA)에는
 * 주소창도 없다. 그래서 홈 화면에만 앱 안에서 직접 만든다.
 *
 * - 화면이 맨 위(스크롤 0)일 때 손가락을 아래로 끌면 위에서 알약 모양 표시가 내려온다.
 * - 충분히(READY_PX) 끌고 놓으면 onRefresh — 홈은 화면에 떠 있는 자료(React Query) + 내 정보 · 진행도를 다시 받는다.
 *   페이지를 통째로 다시 여는 것(location.reload)보다 빠르고 흰 화면이 없다.
 * - 하지 않는 때: 창(대화상자 · 시트)이 열려 있음 · 가로로 넘기는 띠를 밂 · 안쪽 스크롤 칸이 맨 위가 아님 · 손가락 두 개.
 * - 끄는 동안에는 React 다시 그리기 없이 표시만 움직인다 — 홈 전체가 손가락을 따라 다시 그려지지 않게.
 */

export const PULL_READY_PX = 72; // 이만큼 끌면(저항 적용 뒤) 놓았을 때 새로고침
const MAX_PX = 120;
const RESIST = 0.5; // 손가락 이동의 절반만 따라온다
const START_PX = 8; // 이만큼은 그냥 손 떨림으로 본다
const HIDDEN_Y = -64; // 숨어 있을 때 위치(화면 위 밖)
const MIN_SPIN_MS = 600; // 너무 빨리 끝나도 도는 표시를 잠깐은 보여 준다
const DONE_MS = 500;

type Phase = "idle" | "pull" | "ready" | "refreshing" | "done";

const LABEL: Record<Phase, string> = {
  idle: "당겨서 새로고침",
  pull: "당겨서 새로고침",
  ready: "놓으면 새로고침",
  refreshing: "새로 불러오는 중",
  done: "새로고침 완료",
};

/** 창(대화상자 · 시트)이 열려 있으면 홈을 당기는 손짓이 아니다 */
function modalOpen(): boolean {
  const b = document.body;
  return (
    b.style.overflow === "hidden" ||
    b.hasAttribute("data-scroll-locked") ||
    !!document.querySelector('[aria-modal="true"]')
  );
}

/** 손가락 아래 안쪽 스크롤 칸이 맨 위가 아니면 그 칸을 올리는 손짓이다 */
function insideScrolledBox(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el instanceof HTMLElement && el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

const pageAtTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

interface HomePullToRefreshProps {
  /** 놓았을 때 할 일 — 끝날 때까지 도는 표시가 보인다(실패해도 표시는 닫힌다) */
  onRefresh: () => Promise<unknown>;
  /** false 면 손짓을 받지 않는다(홈의 전체 화면 · 시트가 열렸을 때 등) */
  enabled?: boolean;
}

export default function HomePullToRefresh({ onRefresh, enabled = true }: HomePullToRefreshProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const boxRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let alive = true;
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    let dist = 0;
    let doneTimer: number | undefined;

    const setP = (p: Phase) => {
      if (!alive || phaseRef.current === p) return;
      phaseRef.current = p;
      setPhase(p);
    };

    // 표시 위치 · 투명도 · 화살표 회전을 바로 바꾼다(React 다시 그리기 없음)
    const paint = (d: number, animate: boolean) => {
      const box = boxRef.current;
      if (box) {
        box.style.transition = animate ? "transform 220ms ease, opacity 220ms ease" : "none";
        box.style.transform = `translate3d(-50%, ${HIDDEN_Y + Math.min(d, MAX_PX)}px, 0)`;
        box.style.opacity = d <= 0 ? "0" : String(Math.min(1, d / 36));
      }
      const turn = turnRef.current;
      if (turn) turn.style.transform = `rotate(${Math.round(d * 3)}deg)`;
    };

    const reset = () => {
      start = null;
      dragging = false;
      dist = 0;
      paint(0, true);
      setP("idle");
    };

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === "refreshing" || phaseRef.current === "done") return;
      if (e.touches.length !== 1 || !pageAtTop() || modalOpen() || insideScrolledBox(e.target)) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragging = false;
      dist = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1) {
        if (dragging) reset();
        start = null;
        return;
      }
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          start = null; // 가로로 넘기는 손짓
          return;
        }
        if (dy < -6) {
          start = null; // 위로 올리는 손짓 = 그냥 스크롤
          return;
        }
        if (dy < START_PX) return;
        if (!pageAtTop()) {
          start = null;
          return;
        }
        dragging = true;
        setP("pull");
      }
      dist = Math.max(0, Math.min(MAX_PX, (dy - START_PX) * RESIST));
      paint(dist, false);
      const next: Phase = dist >= PULL_READY_PX ? "ready" : "pull";
      if (next === "ready" && phaseRef.current !== "ready") {
        try {
          navigator.vibrate?.(8);
        } catch {
          /* 진동이 없는 기기 */
        }
      }
      setP(next);
    };

    const onEnd = () => {
      if (!start || !dragging) {
        start = null;
        return;
      }
      const pulled = dist;
      start = null;
      dragging = false;
      if (pulled < PULL_READY_PX) {
        reset();
        return;
      }
      setP("refreshing");
      paint(PULL_READY_PX, true);
      const t0 = Date.now();
      Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => undefined)
        .then(() => new Promise((r) => window.setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - t0)))))
        .then(() => {
          if (!alive) return;
          setP("done");
          doneTimer = window.setTimeout(() => {
            dist = 0;
            paint(0, true);
            setP("idle");
          }, DONE_MS);
        });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      if (doneTimer) window.clearTimeout(doneTimer);
      paint(0, false);
      phaseRef.current = "idle";
      alive = false;
      setPhase("idle");
    };
  }, [enabled]);

  const Icon = phase === "done" ? Check : RefreshCw;
  const strong = phase === "ready" || phase === "refreshing" || phase === "done";

  return (
    <>
      <div
        ref={boxRef}
        aria-hidden="true"
        data-testid="home-pull-refresh"
        data-phase={phase}
        className="pointer-events-none fixed left-1/2 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 shadow-md"
        style={{
          top: "calc(env(safe-area-inset-top) + 6px)",
          transform: `translate3d(-50%, ${HIDDEN_Y}px, 0)`,
          opacity: 0,
        }}
      >
        <span ref={turnRef} className="flex">
          <Icon
            className={cn(
              "h-4 w-4",
              strong ? "text-primary" : "text-muted-foreground",
              phase === "refreshing" && "animate-spin",
            )}
            strokeWidth={2.5}
          />
        </span>
        <span className="text-label font-bold text-foreground">{LABEL[phase]}</span>
      </div>
      <span className="sr-only" aria-live="polite">
        {phase === "refreshing" ? LABEL.refreshing : phase === "done" ? LABEL.done : ""}
      </span>
    </>
  );
}
