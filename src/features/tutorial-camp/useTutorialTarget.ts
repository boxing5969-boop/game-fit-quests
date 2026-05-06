/**
 * 7일 스타터 캠프 — target DOM 추적 hook (단계 44).
 *
 * selector 매칭 → bounding rect 계산 → resize/scroll 시 갱신.
 * 화면 밖일 경우 scrollIntoView 1회 자동.
 *
 * 보호 규칙:
 *   · 기존 컴포넌트 props/state 0 변경 — querySelector read-only
 *   · DB / API 호출 0
 */

import { useEffect, useRef, useState } from "react";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  /** selector 매칭 성공 여부 — false 면 fallback 모드로 표시 */
  found: boolean;
}

const RETRY_COUNT = 6;
const RETRY_INTERVAL_MS = 60;
const VIEWPORT_MARGIN = 40;

export function useTutorialTarget(
  selector: string | null | undefined,
): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!selector) {
      elementRef.current = null;
      setRect(null);
      return;
    }

    let mounted = true;
    let raf = 0;
    scrolledRef.current = false;

    function findElement(): HTMLElement | null {
      try {
        return document.querySelector(selector as string) as HTMLElement | null;
      } catch {
        return null;
      }
    }

    function commitRect(): TargetRect {
      const el = elementRef.current;
      if (!el) return { top: 0, left: 0, width: 0, height: 0, found: false };
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        found: true,
      };
    }

    function ensureVisible() {
      if (scrolledRef.current) return;
      const el = elementRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < VIEWPORT_MARGIN || r.top > vh - VIEWPORT_MARGIN) {
        try {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolledRef.current = true;
        } catch {
          // ignore
        }
      }
    }

    // 초기 찾기 — 라우트 진입 직후 element 가 아직 mount 전일 수 있어 retry
    let retries = RETRY_COUNT;
    function tryFind() {
      if (!mounted) return;
      const el = findElement();
      if (el) {
        elementRef.current = el;
        ensureVisible();
        setRect(commitRect());
        return;
      }
      if (retries > 0) {
        retries -= 1;
        setTimeout(tryFind, RETRY_INTERVAL_MS);
      } else {
        // 끝내 못 찾음 → fallback
        setRect({ top: 0, left: 0, width: 0, height: 0, found: false });
      }
    }
    tryFind();

    // resize/scroll/layout shift 추적 — rAF 기반 polling (저비용)
    function tick() {
      if (!mounted) return;
      const el = elementRef.current;
      if (el) {
        // element 가 dom 에서 제거됐는지 확인
        if (!el.isConnected) {
          elementRef.current = null;
          tryFind();
        } else {
          const next = commitRect();
          setRect((prev) => {
            if (
              prev &&
              prev.found === next.found &&
              prev.top === next.top &&
              prev.left === next.left &&
              prev.width === next.width &&
              prev.height === next.height
            ) {
              return prev;
            }
            return next;
          });
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selector]);

  return rect;
}
