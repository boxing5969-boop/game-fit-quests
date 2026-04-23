import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  DIET_LINES,
  pickStartIndex,
  type DietLine,
} from "@/data/diet/dietQuotes";

interface DietLoadingOverlayProps {
  /** 외부에서 로딩 완료 신호 (쿼리 isLoading 반전) — false 일 때 최소 노출 보장 후 사라짐 */
  ready: boolean;
  /** 오버레이 닫힘 콜백 (상위 상태 해제 용) */
  onDone?: () => void;
  /** 최소 노출 ms — 너무 빨리 닫히면 깜빡거림. 기본 1600. */
  minVisibleMs?: number;
  /** 최대 노출 ms — ready 가 안 와도 안전 해제. 기본 3800. */
  maxVisibleMs?: number;
}

const QUOTE_ROTATE_MS = 2200;

/**
 * /diet 진입 시 1회 노출되는 로딩 오버레이.
 *
 * 톤: 민트·과일 이모지 플로팅, 명언/유머 페이드 회전.
 * MinigamePage 의 LoadingOverlay 와 동일한 rhythm 규칙:
 *   1) 최소 노출 시간 보장 (깜빡거림 방지)
 *   2) ready 이후 fade-out
 *   3) maxVisibleMs 로 안전 탈출
 */
export const DietLoadingOverlay = ({
  ready,
  onDone,
  minVisibleMs = 1600,
  maxVisibleMs = 3800,
}: DietLoadingOverlayProps) => {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState<number>(() => pickStartIndex());
  const mountedAt = useRef<number>(Date.now());

  // 명언/유머 rotation — 오버레이가 보이는 동안만
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setQuoteIdx((i) => (i + 1) % DIET_LINES.length);
    }, QUOTE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  // ready 신호 수신 → 최소 노출 시간 보장 후 fade-out
  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, minVisibleMs - elapsed);
    const fadeTimer = window.setTimeout(() => setFadingOut(true), remaining);
    return () => window.clearTimeout(fadeTimer);
  }, [ready, minVisibleMs]);

  // fade-out 애니메이션 끝나면 unmount
  useEffect(() => {
    if (!fadingOut) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 520);
    return () => window.clearTimeout(t);
  }, [fadingOut, onDone]);

  // 안전 폴백 — ready 미수신 대비
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFadingOut(true);
    }, maxVisibleMs);
    return () => window.clearTimeout(t);
  }, [maxVisibleMs]);

  const line: DietLine = useMemo(() => DIET_LINES[quoteIdx] ?? DIET_LINES[0], [quoteIdx]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-6",
        "transition-opacity duration-500",
        fadingOut ? "opacity-0" : "opacity-100",
      )}
    >
      {/* mint glow 링 조명 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, hsl(165 70% 52% / 0.22), transparent 55%)",
        }}
      />

      {/* 과일·샐러드 이모지 플로팅 */}
      <div className="relative mb-7 flex h-16 w-40 items-center justify-center">
        <span
          aria-hidden
          className="absolute left-1 animate-[dietBob_1.4s_ease-in-out_infinite] text-[34px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(16,185,129,0.45))" }}
        >
          🥗
        </span>
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 animate-[dietBob_1.4s_ease-in-out_infinite_0.2s] text-[38px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(16,185,129,0.5))" }}
        >
          🍎
        </span>
        <span
          aria-hidden
          className="absolute right-1 animate-[dietBob_1.4s_ease-in-out_infinite_0.4s] text-[34px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(16,185,129,0.45))" }}
        >
          🥑
        </span>
      </div>

      {/* 명언/유머 카드 — key 변경으로 페이드 인 애니메이션 재시작 */}
      <div className="relative mx-auto flex min-h-[108px] max-w-[340px] flex-col items-center justify-center text-center">
        <span
          key={`tone-${quoteIdx}`}
          className={cn(
            "animate-[quoteIn_520ms_ease-out] rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.2em]",
            line.tone === "quote"
              ? "bg-emerald-400/15 text-emerald-500"
              : "bg-amber-400/15 text-amber-600",
          )}
        >
          {line.tone === "quote" ? "DIET · QUOTE" : "DIET · HUMOR"}
        </span>
        <p
          key={`line-${quoteIdx}`}
          className="mt-2 animate-[quoteIn_520ms_ease-out] text-[16px] font-extrabold leading-snug text-foreground"
        >
          "{line.line}"
        </p>
        <p
          key={`by-${quoteIdx}`}
          className="mt-2 animate-[quoteIn_620ms_ease-out] text-[11px] font-semibold tracking-wide text-muted-foreground"
        >
          — {line.by}
        </p>
      </div>

      {/* 진행 라인 — 리듬용 */}
      <div className="mt-7 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-emerald-400/60" />
        DIET · 21 DAYS
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-emerald-400/60" />
      </div>

      <style>{`
        @keyframes dietBob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%      { transform: translateY(-10px) rotate(6deg); }
        }
        @keyframes quoteIn {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[dietBob_1\\.4s_ease-in-out_infinite\\],
          .animate-\\[dietBob_1\\.4s_ease-in-out_infinite_0\\.2s\\],
          .animate-\\[dietBob_1\\.4s_ease-in-out_infinite_0\\.4s\\],
          .animate-\\[quoteIn_520ms_ease-out\\],
          .animate-\\[quoteIn_620ms_ease-out\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default DietLoadingOverlay;
