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
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMMON_LABELS, FALLBACK_GENERIC } from "./tutorialCampCopy";
import { COLOR_AMBER } from "./tutorialCampMotion";
import type { TargetRect } from "./useTutorialTarget";
import type { TutorialCampStep } from "./tutorialCampSteps";
import OsamMascot, { type OsamState } from "@/components/mascot/OsamMascot";

/** 7일 Day 별 오삼이 표정 매핑. 마지막 step (confetti) 은 Provider 가 별도 처리. */
const DAY_TO_OSAMI_STATE: Record<number, OsamState> = {
  1: "wink",        // Day 1 — 첫 인사
  2: "determined",  // Day 2 — 마스터로드
  3: "smile",       // Day 3 — 153 QUEST
  4: "happy",       // Day 4 — 챌린지
  5: "shy",         // Day 5 — 챔피언 일기
  6: "surprised",   // Day 6 — 세컨드 응원
  7: "victory",     // Day 7 — 마무리
};

export interface TutorialTooltipProps {
  step: TutorialCampStep;
  rect: TargetRect | null;
  targetClicked: boolean;
  routeMatch: boolean;
  /** 이전 step 으로 갈 수 있는지 (Day 1 step 0 이면 false) */
  canGoBack?: boolean;
  onNext: () => void;
  onPrev?: () => void;
  onSkipDay: () => void;
  onPause: () => void;
  onGoToRoute: () => void;
  onMarkClicked: () => void;
  /** 50-A: step.completionRule 만족 여부 (next gating). */
  conditionMet?: boolean;
  /** 50-A: 세부 completion 상태 (helper/success message 분기용). */
  completionState?: Record<string, boolean>;
  /** 64: 다른 모달이 떠있는지 — compact 모드 트리거 */
  modalOpen?: boolean;
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
  canGoBack = false,
  onNext,
  onPrev,
  onSkipDay,
  onPause,
  onGoToRoute,
  onMarkClicked,
  conditionMet,
  completionState,
  modalOpen,
}: TutorialTooltipProps) => {
  // 64: compact 모드 — 다른 모달 떠있는 동안 카드를 화면 하단 작은 알림으로 축소.
  //   회원이 모달 안 컨텐츠(정답 선택지 등)를 자유롭게 보고 누를 수 있음.
  //   행동 완료 → mini "다음으로" 버튼 표시 → 누르면 onNext (모달 자동 닫힘).
  //   회원이 모달 직접 닫으면 modalOpen=false → 일반 카드 복귀.
  const compact = modalOpen === true;
  const pos = computeTooltipPosition(rect, step.placement);
  // route 가 다르면 → 이동 필요 (target rect 자체를 시도 안 함)
  // route 가 같지만 target 매칭 실패 → 진짜 fallback (안전망 발동)
  const trueRouteMismatch = !routeMatch;
  const trueFallback = routeMatch && (!rect || !rect.found);
  const fallbackMode = trueRouteMismatch || trueFallback;

  // 50-A: 새 gating 통합
  //   · step.blockNextUntilComplete=true → conditionMet 만족 시에만 next 가능
  //   · step.blockNextUntilComplete!=true 면 기존 requireTargetClick 폴백
  //   · target 매칭 실패 (route 같음) → 안전망: next 활성 (회원 막힘 방지)
  const legacyBlock =
    step.requireTargetClick &&
    (trueRouteMismatch || (!targetClicked && !trueFallback));
  const newBlock =
    step.blockNextUntilComplete === true &&
    !conditionMet &&
    !trueFallback;
  const blockNext = legacyBlock || newBlock;
  const nextDisabled = blockNext;

  // helper / success message 결정
  const showSuccess = conditionMet === true;
  const helperToShow = showSuccess
    ? step.successMessage
    : step.helperMessage ?? null;

  // 64: compact 모드 — 모달 떠있을 때 화면 하단 작은 카드.
  //   wrapper 는 pointer-events-none → 회원 클릭은 모달 컨텐츠로 그대로 통과.
  //   안의 mini-button 만 pointer-events-auto → 다음으로 누름 가능.
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.25 }}
        role="status"
        aria-label={step.title}
        data-tour-overlay="true"
        className="pointer-events-none fixed inset-x-0 bottom-3 z-[112] flex justify-center px-3"
      >
        <div className="flex max-w-[340px] items-center gap-2 rounded-pill border border-amber-400/40 bg-[#0a1024]/95 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="shrink-0">
            <OsamMascot
              size="xs"
              state={DAY_TO_OSAMI_STATE[step.day] ?? "wink"}
            />
          </div>
          {showSuccess ? (
            <>
              <p className="text-[11px] font-bold leading-snug text-emerald-200">
                <Check className="mr-1 inline h-3 w-3 -translate-y-[1px]" />
                {step.successMessage ?? "잘했어요!"}
              </p>
              <button
                type="button"
                onClick={onNext}
                className="pointer-events-auto ml-1 inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-3 text-[11px] font-black text-amber-950 active:scale-[0.97]"
              >
                다음으로
                <ChevronRight className="h-3 w-3" />
              </button>
            </>
          ) : (
            <p className="text-[11px] font-bold leading-snug text-amber-100">
              {step.helperMessage ?? "모달 안에서 답을 골라주세요."}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-label={step.title}
      data-tour-overlay="true"
      className={cn(
        "fixed z-[112] overflow-hidden rounded-2xl border border-amber-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.55)]",
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
        {/* 오삼이 한 줄 — 미니 PNG 캐릭터 + 메시지 */}
        <div className="mb-2 flex items-start gap-2">
          <div className="shrink-0 -my-1">
            <OsamMascot
              size="xs"
              state={DAY_TO_OSAMI_STATE[step.day] ?? "wink"}
            />
          </div>
          <p className="pt-1 text-[11px] leading-relaxed text-amber-200/90">
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
            <Check className="h-3 w-3" /> 잘하셨어요! 다 보셨으면 "다음으로" 눌러주세요
          </p>
        )}

        {/* 50-A: helper / success 메시지 — completionRule 기반 */}
        {helperToShow && (
          <p
            className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold ${
              showSuccess ? "text-emerald-300" : "text-amber-300/80"
            }`}
          >
            {showSuccess && <Check className="h-3 w-3" />}
            {helperToShow}
          </p>
        )}
      </div>

      {/* CTA 영역 */}
      <div className="border-t border-amber-400/15 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2">
          {canGoBack && onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="이전 단계"
              className="inline-flex h-10 items-center gap-1 rounded-xl border border-amber-400/30 bg-black/40 px-3 text-[11px] font-bold text-amber-200/85 hover:bg-black/60 active:scale-[0.98]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              이전
            </button>
          )}
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
