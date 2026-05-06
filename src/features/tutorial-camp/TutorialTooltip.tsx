/**
 * 7일 스타터 캠프 — 안내 카드 (단계 44).
 *
 * step 의 title / body / osamiMessage / CTA 를 모두 노출.
 * target 옆 placement 따라 위치, fallback 시 화면 중앙.
 *
 * CTA:
 *   · "다음으로" — requireTargetClick && !targetClicked 면 비활성
 *   · "오늘은 건너뛰기" — Day skip
 *   · "입문 캠프 종료" — 캠프 자체 pause
 */

import { motion } from "framer-motion";
import { Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMMON_LABELS, FALLBACK_GENERIC } from "./tutorialCampCopy";
import { COLOR_AMBER } from "./tutorialCampMotion";
import type { TargetRect } from "./useTutorialTarget";
import type { TutorialCampStep } from "./tutorialCampSteps";

export interface TutorialTooltipProps {
  step: TutorialCampStep;
  rect: TargetRect | null;
  targetClicked: boolean;
  routeMatch: boolean;
  onNext: () => void;
  onSkipDay: () => void;
  onPause: () => void;
  onGoToRoute: () => void;
  onMarkClicked: () => void;
}

const TOOLTIP_WIDTH = 320;
const VIEWPORT_MARGIN = 12;
const TARGET_GAP = 16;

function computeTooltipPosition(
  rect: TargetRect | null,
  placement: TutorialCampStep["placement"],
): { top: number; left: number; centered: boolean } {
  if (typeof window === "undefined") {
    return { top: 0, left: 0, centered: true };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // fallback 또는 center placement → 화면 중앙
  if (!rect || !rect.found || placement === "center") {
    return {
      top: Math.max(VIEWPORT_MARGIN, vh / 2 - 140),
      left: Math.max(VIEWPORT_MARGIN, vw / 2 - TOOLTIP_WIDTH / 2),
      centered: true,
    };
  }

  // placement 별 위치 시도
  let top = rect.top + rect.height + TARGET_GAP;
  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;

  if (placement === "top") {
    top = rect.top - TARGET_GAP - 220; // 추정 카드 높이
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - 110;
    left = rect.left - TOOLTIP_WIDTH - TARGET_GAP;
  } else if (placement === "right") {
    top = rect.top + rect.height / 2 - 110;
    left = rect.left + rect.width + TARGET_GAP;
  }

  // viewport clamp
  left = Math.min(vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, left));
  top = Math.min(vh - 240, Math.max(VIEWPORT_MARGIN, top));

  return { top, left, centered: false };
}

const TutorialTooltip = ({
  step,
  rect,
  targetClicked,
  routeMatch,
  onNext,
  onSkipDay,
  onPause,
  onGoToRoute,
  onMarkClicked,
}: TutorialTooltipProps) => {
  const pos = computeTooltipPosition(rect, step.placement);
  const fallbackMode = !rect || !rect.found;
  const blockNext =
    step.requireTargetClick && !targetClicked && !fallbackMode && routeMatch;

  // requireTargetClick=true 인데 fallback 또는 라우트 mismatch 면
  // allowNextWithoutClick 정책에 따라 다음 가능
  const allowFallbackNext = fallbackMode && step.allowNextWithoutClick;
  const allowOffRouteNext = !routeMatch && step.allowNextWithoutClick;
  const nextDisabled = blockNext && !allowFallbackNext && !allowOffRouteNext;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-label={step.title}
      className={cn(
        "fixed z-[93] overflow-hidden rounded-2xl border border-amber-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.55)]",
        "bg-gradient-to-b from-[#0d1530] via-[#0a1024] to-[#0a1024] text-amber-50",
      )}
      style={{
        top: pos.top,
        left: pos.left,
        width: TOOLTIP_WIDTH,
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <div className="px-5 pt-4 pb-2">
        {/* 오삼이 한 줄 */}
        <div className="mb-2 flex items-start gap-2">
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
            style={{ background: COLOR_AMBER, color: "#3a1a00" }}
            aria-hidden
          >
            오
          </span>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            {step.osamiMessage}
          </p>
        </div>

        {/* 제목 + 본문 */}
        <h3 className="text-[15px] font-black leading-tight text-amber-50">
          {step.title}
        </h3>
        <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-amber-100/85">
          {step.body}
        </p>

        {/* fallback 안내 */}
        {fallbackMode && (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-amber-200/70">
            {step.fallbackText || FALLBACK_GENERIC}
          </p>
        )}

        {/* 라우트 mismatch — 이동 CTA */}
        {!routeMatch && (
          <button
            type="button"
            onClick={onGoToRoute}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-pill border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-[12px] font-bold text-amber-100 active:scale-[0.98]"
          >
            {COMMON_LABELS.goToTarget}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {/* requireTargetClick && targetClicked 표시 */}
        {step.requireTargetClick && targetClicked && (
          <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
            <Check className="h-3 w-3" /> 잘했어요 — 다음으로 갈 수 있어요
          </p>
        )}
        {step.requireTargetClick && !targetClicked && routeMatch && !fallbackMode && (
          <p className="mt-2 text-[10px] font-bold text-amber-300/70">
            여기를 눌러보세요
          </p>
        )}
      </div>

      {/* CTA 영역 */}
      <div className="border-t border-amber-400/15 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-10 flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-[12px] font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-40"
          >
            {COMMON_LABELS.next}
            <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-amber-200/55">
          <button
            type="button"
            onClick={onSkipDay}
            className="hover:text-amber-200"
          >
            {COMMON_LABELS.skip} (오늘 Day)
          </button>
          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center gap-0.5 hover:text-amber-200"
          >
            <X className="h-2.5 w-2.5" />
            {COMMON_LABELS.pause}
          </button>
        </div>
      </div>

      {/* Hidden — onMarkClicked 는 외부 target click listener 가 호출 */}
      <span className="sr-only">{onMarkClicked.name}</span>
    </motion.div>
  );
};

export default TutorialTooltip;
