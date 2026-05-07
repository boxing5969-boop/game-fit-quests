/**
 * 마이복서153 — 오삼이 5개 미션 spotlight 가이드.
 *
 * TutorialFloatingMascot 와 별개로 마운트되는 overlay.
 * 사용자가 미션 패널에서 "미션 보기" 클릭 → navTarget 페이지에 도착하면
 * 해당 페이지의 spotlightSelector element 위에 무지개 그라데이션 펄스
 * + 배경 dim + 안내 말풍선을 표시. 회원이 어떤 element 를 눌러야
 * 하는지 즉각 인식.
 *
 * 동작 규칙:
 *   · isEligible && currentStep.spotlightSelector && pathname === navTarget
 *   · setup/특수 라우트에서는 표시 안 함 (TutorialFloatingMascot 와 동일)
 *   · target click → spotlight 즉시 페이드아웃 (자동 detector 가 advance 처리)
 *   · 8초 동안 한 번도 안 누르면 dim 살짝 흐려져서 화면 가독성 회복
 *   · "이 안내 잠시 끄기" 작은 링크로 명시적 dismiss 가능 (세션 동안)
 *
 * 보호 규칙:
 *   · DB / RPC / wallet 0 변경
 *   · TutorialFloatingMascot 영역 0 침범
 *   · 153마인드셋 / 7일 캠프 / 공식 훈련 0 영향
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Hand } from "lucide-react";
import { createPortal } from "react-dom";

import { useTutorialState } from "@/hooks/useTutorialState";

const SETUP_ROUTES = ["/", "/onboarding", "/select-branch", "/waiting-approval"];
const isSetupPath = (pathname: string): boolean => {
  if (SETUP_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/live-board")) return true;
  return false;
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SESSION_DISMISS_KEY = "tutorial-spotlight-dismissed-step";

const TutorialActionSpotlight = () => {
  const location = useLocation();
  const { isEligible, isFinished, currentStep } = useTutorialState();

  const [rect, setRect] = useState<Rect | null>(null);
  const [dismissedStepKey, setDismissedStepKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(SESSION_DISMISS_KEY);
    } catch {
      return null;
    }
  });
  const [softened, setSoftened] = useState(false);
  const rafRef = useRef<number | null>(null);

  // 라우트 매칭 + 활성 step 결정
  const stepKey = currentStep?.key ?? "";
  const navTarget = currentStep?.navTarget ?? "";
  const selector = currentStep?.spotlightSelector ?? "";
  const isOnTargetRoute = !!navTarget && location.pathname === navTarget;

  const shouldRender =
    !isSetupPath(location.pathname) &&
    isEligible &&
    !isFinished &&
    !!selector &&
    isOnTargetRoute &&
    dismissedStepKey !== stepKey;

  // step 이 바뀌면 dismiss / softened 리셋
  useEffect(() => {
    setSoftened(false);
  }, [stepKey, location.pathname]);

  // target 위치 측정 — RAF 폴링 (DOM 변동/스크롤/애니메이션 대응)
  useEffect(() => {
    if (!shouldRender) {
      setRect(null);
      return;
    }
    if (typeof document === "undefined") return;

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      let el: Element | null = null;
      try {
        el = document.querySelector(selector);
      } catch {
        el = null;
      }
      if (!el) {
        setRect(null);
      } else {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect((prev) => {
            // 같으면 set 호출 안 함 — 불필요 리렌더 방지
            if (
              prev &&
              Math.abs(prev.top - r.top) < 0.5 &&
              Math.abs(prev.left - r.left) < 0.5 &&
              Math.abs(prev.width - r.width) < 0.5 &&
              Math.abs(prev.height - r.height) < 0.5
            ) {
              return prev;
            }
            return {
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
            };
          });
        } else {
          setRect(null);
        }
      }
      rafRef.current = window.requestAnimationFrame(measure);
    };
    rafRef.current = window.requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [shouldRender, selector, location.pathname]);

  // 8초 동안 안 누르면 dim 살짝 옅게 (가독성 회복)
  useEffect(() => {
    if (!shouldRender || !rect) {
      setSoftened(false);
      return;
    }
    const t = window.setTimeout(() => setSoftened(true), 8000);
    return () => window.clearTimeout(t);
  }, [shouldRender, rect, stepKey]);

  // target click 감지 → spotlight 즉시 페이드아웃 (시각 피드백)
  useEffect(() => {
    if (!shouldRender || !rect) return;
    if (typeof document === "undefined") return;
    let element: Element | null = null;
    try {
      element = document.querySelector(selector);
    } catch {
      element = null;
    }
    if (!element) return;
    const onClick = () => {
      // detector 가 알아서 advance 시키므로 여기선 일시 dismiss 만.
      setDismissedStepKey(stepKey);
      try {
        window.sessionStorage.setItem(SESSION_DISMISS_KEY, stepKey);
      } catch {
        // ignore
      }
    };
    element.addEventListener("click", onClick, { capture: true });
    return () => {
      element?.removeEventListener("click", onClick, { capture: true });
    };
  }, [shouldRender, rect, selector, stepKey]);

  const handleDismiss = useCallback(() => {
    setDismissedStepKey(stepKey);
    try {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, stepKey);
    } catch {
      // ignore
    }
  }, [stepKey]);

  if (!shouldRender || !rect) return null;

  const padding = 10;
  const tipTop = rect.top + rect.height + 14;
  const tipBelow = tipTop + 120 < (typeof window !== "undefined" ? window.innerHeight : 800);
  const dimOpacity = softened ? 0.45 : 0.78;

  // SVG mask spotlight: full screen rect minus rounded hole
  const w = typeof window !== "undefined" ? window.innerWidth : 800;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed inset-0 z-[85]"
      >
        {/* SVG dim with cutout */}
        <svg
          className="absolute inset-0"
          width={w}
          height={h}
          style={{ pointerEvents: "auto" }}
          onClick={handleDismiss}
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              <rect width={w} height={h} fill="white" />
              <rect
                x={rect.left - padding}
                y={rect.top - padding}
                width={rect.width + padding * 2}
                height={rect.height + padding * 2}
                rx={16}
                ry={16}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width={w}
            height={h}
            fill={`rgba(8, 12, 28, ${dimOpacity})`}
            mask="url(#tutorial-spotlight-mask)"
          />
        </svg>

        {/* 무지개 그라데이션 광원 (rect 외곽 강조) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: [0.85, 1, 0.85],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            borderRadius: 16,
            // 무지개 그라데이션 외곽선 + 글로우
            background:
              "linear-gradient(120deg, #ff5f7e, #ffae3b, #ffe66d, #5fff8e, #5fd7ff, #a980ff, #ff5f7e) border-box",
            backgroundSize: "300% 300%",
            animation: "tutorial-rainbow-flow 3.2s linear infinite",
            // 두꺼운 외곽선 효과: padding 만큼의 border 대신 box-shadow 합성
            boxShadow:
              "0 0 0 3px rgba(255,255,255,0.15) inset, 0 0 32px 8px rgba(255,180,80,0.55), 0 0 64px 18px rgba(255,120,200,0.35)",
          }}
        />

        {/* 안쪽 빈 공간 — 실제 element 가 보이도록 mask out */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: rect.top - padding + 3,
            left: rect.left - padding + 3,
            width: rect.width + padding * 2 - 6,
            height: rect.height + padding * 2 - 6,
            borderRadius: 14,
            background: "transparent",
            // 안쪽은 dim 가리지 않음 — SVG mask 가 이미 cutout 했으므로 비어있음
          }}
        />

        {/* 손가락 포인터 (rect 위쪽 또는 아래쪽 가장자리) */}
        <motion.div
          initial={{ y: tipBelow ? -6 : 6, opacity: 0 }}
          animate={{ y: tipBelow ? [-6, 2, -6] : [6, -2, 6], opacity: 1 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute"
          style={{
            top: tipBelow
              ? rect.top + rect.height + 4
              : rect.top - 36,
            left: rect.left + rect.width / 2 - 16,
          }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-2xl"
            style={{
              boxShadow:
                "0 0 0 3px rgba(255,180,60,0.7), 0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <Hand className="h-5 w-5 rotate-180 text-amber-500" />
          </div>
        </motion.div>

        {/* 안내 말풍선 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="pointer-events-auto absolute z-[86] max-w-[88vw] sm:max-w-sm"
          style={{
            top: tipBelow ? tipTop : Math.max(16, rect.top - 116),
            left: Math.max(
              12,
              Math.min(
                rect.left + rect.width / 2 - 160,
                w - 332,
              ),
            ),
          }}
        >
          <div
            className="rounded-2xl border border-amber-300/60 bg-gray-950/95 p-3.5 shadow-2xl backdrop-blur-md"
            style={{
              boxShadow:
                "0 0 0 1px rgba(251,191,36,0.4), 0 18px 48px rgba(0,0,0,0.55)",
            }}
          >
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-base">
                {currentStep.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  오삼이 가이드
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {currentStep.label}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-gray-200">
                  {currentStep.spotlightHint ?? currentStep.hint}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded-full bg-gray-800/80 p-1 text-gray-400 hover:bg-gray-700"
                aria-label="안내 닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              완료하면 다음 미션이 자동으로 열려요.
            </p>
          </div>
        </motion.div>

        {/* keyframes — Tailwind 안 거치고 직접 주입 */}
        <style>{`
          @keyframes tutorial-rainbow-flow {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default TutorialActionSpotlight;
