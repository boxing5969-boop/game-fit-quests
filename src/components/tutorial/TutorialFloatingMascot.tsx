/**
 * 마이복서153 — 오삼 마스코트 floating 가이드.
 *
 * 신규 회원 가입 후 (tutorial 미완료) 화면 우측 하단에 떠다니는 작은 오삼.
 *
 * 동작:
 *   · idle: 오삼이 작게 떠 있음 (말풍선 미니 미리보기)
 *   · 클릭 → BottomSheet 미션 패널 열림
 *   · 패널에서 5개 미션 진행도 + 자동완료감지 + 수동 "완료했어요" 버튼
 *   · 한 미션 완료 시 advance + 보상 청구 + 축하 토스트
 *   · 모든 미션 완료 시 자동 숨김 + 최종 1000 GEMS 청구
 *
 * 마운트 위치: AppRoutes 내부 1곳 (App.tsx).
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronRight, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

import OsamMascot from "@/components/mascot/OsamMascot";
import { useTutorialState } from "@/hooks/useTutorialState";
import { TUTORIAL_STEPS, TUTORIAL_STEP_REWARDS } from "@/data/unlockRules";

const SETUP_ROUTES = ["/", "/onboarding", "/select-branch", "/waiting-approval"];
const isSetupPath = (pathname: string): boolean => {
  if (SETUP_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/live-board")) return true;
  return false;
};

const TutorialFloatingMascot = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isEligible,
    isFinished,
    stepsCompleted,
    currentStep,
    advance,
    completeReward,
    markSkipped,
    rewardGems,
  } = useTutorialState();
  // 'advance' 는 first_checkin 의 CTA 클릭 자동 통과 시에만 사용.
  // 그 외 미션은 useTutorialAutoDetect 훅이 감지해서 자동 advance.

  const [open, setOpen] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(true);

  // 셋업/특수 라우트에서는 숨김
  if (isSetupPath(location.pathname)) return null;
  if (!isEligible) return null;

  const handleStartMission = (step: typeof currentStep) => {
    setOpen(false);
    if (step.navTarget && location.pathname !== step.navTarget) {
      navigate(step.navTarget);
    }
    // 출석 체크 미션 (first_checkin) 은 QR 이 없을 수도 있어
    // CTA 클릭만으로 자동 통과 (예외).
    // 다른 4개 미션은 실제 행동을 해야만 detector 가 감지하여 advance.
    if (step.key === "first_checkin") {
      // 약간 지연 — navigate 후 toast 가 보이도록
      setTimeout(() => {
        advance();
        toast.success(
          `${step.label} 완료! 🎉 +${TUTORIAL_STEP_REWARDS[step.order]} GEMS`,
        );
      }, 600);
    }
  };

  const handleSkipAll = async () => {
    if (!confirm("튜토리얼을 건너뛰시겠어요? 보상은 받을 수 없어요.")) return;
    await markSkipped();
    setOpen(false);
  };

  const handleClaimFinal = () => {
    completeReward.mutate(undefined, {
      onSuccess: () => {
        toast.success(`튜토리얼 완료! +${rewardGems} GEMS 🎉`);
        setOpen(false);
      },
      onError: (e: unknown) => {
        toast.error(e instanceof Error ? e.message : "보상 지급 실패");
      },
    });
  };

  return createPortal(
    <>
      {/* ── Floating mascot (우측 하단) ── */}
      <div className="fixed bottom-20 right-4 z-[60] pointer-events-none">
        {/* 미니 말풍선 (idle 상태에서 살짝 보임) */}
        <AnimatePresence>
          {bubbleVisible && !open && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-auto absolute bottom-full right-0 mb-2 mr-1 w-44 rounded-2xl bg-gray-900/95 px-3 py-2 shadow-2xl backdrop-blur-md ring-1 ring-yellow-400/40"
            >
              <button
                onClick={() => setBubbleVisible(false)}
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600"
                aria-label="말풍선 닫기"
              >
                <X className="mx-auto h-3 w-3" />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">
                오삼이 가이드
              </p>
              <p className="mt-0.5 text-xs font-bold text-white">
                다음: {currentStep.label}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">탭해서 시작하기 →</p>
              {/* 꼬리 */}
              <div
                className="absolute -bottom-1 right-6 h-3 w-3 rotate-45 bg-gray-900/95 ring-1 ring-yellow-400/40"
                style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 오삼 마스코트 (탭으로 패널 열기) */}
        <motion.button
          onClick={() => {
            setOpen(true);
            setBubbleVisible(false);
          }}
          whileTap={{ scale: 0.92 }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-400 shadow-lg ring-2 ring-yellow-300/50"
          style={{ boxShadow: "0 8px 24px rgba(234, 179, 8, 0.45)" }}
          aria-label="오삼이 — 튜토리얼 미션 보기"
        >
          <OsamMascot size="xs" state="wave" />
          {/* 미션 진행 뱃지 */}
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white ring-2 ring-gray-900">
            {stepsCompleted}/{TUTORIAL_STEPS.length}
          </span>
        </motion.button>
      </div>

      {/* ── BottomSheet 미션 패널 ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="fixed inset-x-0 bottom-0 z-[81] max-h-[88vh] overflow-y-auto rounded-t-3xl border-t-2 border-yellow-400/40 bg-gray-950 pb-8 shadow-2xl"
            >
              {/* Drag handle */}
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-gray-700" />

              {/* Header */}
              <div className="px-5 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <OsamMascot size="md" state={isFinished ? "celebrate" : "wave"} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-300">
                        OSAM · 시작하기
                      </p>
                      <h2 className="text-xl font-black text-white">
                        {isFinished ? "모든 미션 완료! 🎉" : `${currentStep.label}`}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        {isFinished
                          ? `${rewardGems} GEMS 보상을 받아가세요.`
                          : currentStep.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-gray-800 p-1.5 text-gray-400 hover:bg-gray-700"
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mx-5 mt-4 h-2 overflow-hidden rounded-full bg-gray-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(stepsCompleted / TUTORIAL_STEPS.length) * 100}%`,
                  }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-400"
                />
              </div>
              <p className="mt-1 px-5 text-right text-[10px] font-bold tabular-nums text-yellow-300">
                {stepsCompleted} / {TUTORIAL_STEPS.length} ·{" "}
                {Math.round((stepsCompleted / TUTORIAL_STEPS.length) * 100)}%
              </p>

              {/* Mission list */}
              <div className="mt-4 space-y-2 px-5">
                {TUTORIAL_STEPS.map((step, idx) => {
                  const isDone = idx < stepsCompleted;
                  const isCurrent = idx === stepsCompleted && !isFinished;
                  const isLocked = idx > stepsCompleted;
                  const reward = TUTORIAL_STEP_REWARDS[step.order] ?? 0;
                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`relative rounded-2xl border p-3 ${
                        isCurrent
                          ? "border-yellow-400/60 bg-yellow-400/10"
                          : isDone
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-gray-800 bg-gray-900/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-yellow-400 text-gray-900"
                                : "bg-gray-800 text-gray-600"
                          }`}
                        >
                          {isDone ? <Check className="h-5 w-5" /> : isLocked ? <Lock className="h-4 w-4" /> : step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm font-black ${
                                isDone
                                  ? "text-emerald-300 line-through"
                                  : isCurrent
                                    ? "text-white"
                                    : "text-gray-500"
                              }`}
                            >
                              {step.label}
                            </p>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                                isDone
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : isCurrent
                                    ? "bg-yellow-400/20 text-yellow-300"
                                    : "bg-gray-800 text-gray-600"
                              }`}
                            >
                              +{reward} GEMS
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 text-[11px] leading-relaxed ${
                              isCurrent ? "text-gray-300" : "text-gray-500"
                            }`}
                          >
                            {step.description}
                          </p>

                          {/* Current step actions */}
                          {isCurrent && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleStartMission(step)}
                                className="inline-flex items-center gap-1 rounded-pill bg-yellow-400 px-3 py-1.5 text-xs font-black text-gray-900 hover:bg-yellow-300 active:scale-95"
                              >
                                {step.ctaLabel}
                                <ChevronRight className="h-3 w-3" />
                              </button>
                              {/* 안내 — 출석 체크는 클릭만으로 OK, 나머지는 실제 행동 필요 */}
                              <span className="text-[10px] text-gray-500">
                                {step.key === "first_checkin"
                                  ? "버튼 누르면 완료"
                                  : "실제 행동 후 자동 완료"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Final claim button */}
              {isFinished && (
                <div className="mt-5 px-5">
                  <button
                    onClick={handleClaimFinal}
                    disabled={completeReward.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 px-5 py-3.5 text-base font-black text-gray-900 shadow-lg active:scale-95 disabled:opacity-60"
                    style={{
                      boxShadow: "0 0 30px rgba(246,196,83,0.5)",
                    }}
                  >
                    <Sparkles className="h-5 w-5" />
                    {completeReward.isPending ? "지급 중..." : `${rewardGems} GEMS 받기`}
                  </button>
                </div>
              )}

              {/* Skip link */}
              {!isFinished && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleSkipAll}
                    className="text-[11px] text-gray-500 underline-offset-2 hover:text-gray-400 hover:underline"
                  >
                    튜토리얼 건너뛰기 (보상 없음)
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};

export default TutorialFloatingMascot;
