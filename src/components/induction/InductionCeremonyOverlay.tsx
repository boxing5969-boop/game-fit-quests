import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useTutorialProgress } from "@/hooks/useTutorialProgress";
import { InductionStepCard } from "./InductionStepCard";
import { InductionCompleteCelebration } from "./InductionCompleteCelebration";
import { cn } from "@/lib/utils";

/**
 * "랭킹업 입단식" 튜토리얼 오버레이 — 메인 셸.
 *
 * ──────────────────────────────────────────────────────────────
 * 마운트 위치
 * ──────────────────────────────────────────────────────────────
 * `AppRoutes` 내부(글로벌) 단 1곳에 마운트. react-router 내부여서
 * useNavigate/useLocation 가 동작하고, 라우트 전환에도 언마운트 없이
 * 유지된다. 실제 DOM 은 createPortal 로 `document.body` 에 얹어
 * 스태킹 컨텍스트를 격리 (z-[70], legacy TutorialOverlay z-[55] 위).
 *
 * ──────────────────────────────────────────────────────────────
 * 자동 네비게이션 규칙
 * ──────────────────────────────────────────────────────────────
 *   • 각 step 이 current 로 전환될 때 1회만 navTarget 으로 이동.
 *   • 이미 해당 경로면 이동 생략.
 *   • ref-guard 로 동일 step 내 반복 navigate 차단 → 사용자가 튜토리얼
 *     중 수동으로 다른 페이지로 가도 즉시 되돌리지 않는다.
 *
 * ──────────────────────────────────────────────────────────────
 * 단계별 연결
 * ──────────────────────────────────────────────────────────────
 *   Step 1: /mypage (내 캐릭터)         → CTA "확인 완료" → step 2
 *   Step 2: /halloffame (리그/랭킹)     → CTA "확인 완료" → step 3
 *   Step 3: /missions (오늘의 퀘스트)   → CTA "확인 완료" → step 4
 *   Step 4: /rewards (젬/이펙트/상점)   → CTA "확인 완료" → step 5
 *   Step 5: /missions (첫 퀘스트 시작)  → CTA → claim + 축하
 *
 * ──────────────────────────────────────────────────────────────
 * 라우트 게이트
 * ──────────────────────────────────────────────────────────────
 * 셋업/인증/특수 라우트에서는 오버레이를 숨긴다. 이 경로들은
 * ProtectedRoute 가 이미 자체 리다이렉트를 건 상태라 튜토리얼이
 * 올라오면 UX 혼란만 유발.
 *   • "/"                    — 로그인
 *   • "/onboarding"          — 설문 온보딩
 *   • "/select-branch"       — 지점 선택
 *   • "/waiting-approval"    — 코치 승인 대기
 *   • "/safety-check"        — 안전 확인
 *   • "/live-board/*"        — 퍼블릭 전광판 (비로그인도 접근)
 *
 * ──────────────────────────────────────────────────────────────
 * Step 5 완료 함수 — 네이밍/주석/동작 정렬
 * ──────────────────────────────────────────────────────────────
 * 사용자 CTA 는 반드시 `claimTutorialRewardIfEligible()` 을 호출한다.
 * 이는 `finishTutorial()` 의 **상위 래퍼** 로서, 이미 보상이 지급된
 * 유저(재시작 케이스 등)에 대해 네트워크 호출 없이 `{ alreadyClaimed:
 * true }` 로 즉시 반환한다. `finishTutorial()` 을 직접 호출하면 이미
 * 지급된 유저에 대해서도 RPC 왕복이 발생하므로 UI 경로에서는 사용하지
 * 않는다. (서버 RPC 자체는 멱등이라 안전하지만 불필요한 호출)
 *
 * 반환 타입 좁히기:
 *   claimTutorialRewardIfEligible(): Promise<FinishResult | { alreadyClaimed: true }>
 *   → `"alreadyClaimed" in r` 로 분기.
 * ──────────────────────────────────────────────────────────────
 */

const SETUP_ROUTES = [
  "/",
  "/onboarding",
  "/select-branch",
  "/waiting-approval",
  "/safety-check",
] as const;

const isSetupPath = (pathname: string): boolean => {
  if ((SETUP_ROUTES as readonly string[]).includes(pathname)) return true;
  if (pathname.startsWith("/live-board")) return true;
  return false;
};

interface InductionCeremonyOverlayProps {
  /** 디버그/프리뷰용 강제 마운트. 기본은 서버 상태 기반 자동 판정. */
  forceOpen?: boolean;
  /** 완료/스킵 등으로 오버레이가 닫힐 때 호출. */
  onClose?: () => void;
}

export const InductionCeremonyOverlay = ({
  forceOpen = false,
  onClose,
}: InductionCeremonyOverlayProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const {
    isOpen,
    isCompleted,
    isFinished,
    rewardClaimed,
    stepsCompleted,
    currentStep,
    totalSteps,
    totalReward,
    completeTutorialStep,
    skipTutorial,
    claimTutorialRewardIfEligible,
    isFinishing,
  } = useTutorialProgress();

  const [showCelebration, setShowCelebration] = useState(false);
  const [recentReward, setRecentReward] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ref: step 당 1회만 자동 네비게이션. 사용자가 수동으로 다른 페이지로
  // 이동해도 동일 step 내에서는 강제로 끌어가지 않는다.
  const autoNavDoneForStepRef = useRef<number | null>(null);

  const isGateOpen = !isSetupPath(pathname);
  const shouldRender = forceOpen || (isOpen && !dismissed && isGateOpen);
  const shouldShowCelebration = showCelebration && rewardClaimed;

  // ──────────────────────────────────────────────────────────────
  // 자동 네비게이션
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shouldRender) return;
    if (showCelebration) return; // 축하 중에는 이동 억제
    const target = currentStep.navTarget;
    if (!target) return;
    if (autoNavDoneForStepRef.current === currentStep.order) return;

    autoNavDoneForStepRef.current = currentStep.order;
    if (pathname === target) return;
    navigate(target);
  }, [shouldRender, showCelebration, currentStep.order, currentStep.navTarget, pathname, navigate]);

  // 오버레이가 사라졌다(셋업 라우트 등)가 다시 돌아오면 ref 리셋 금지 —
  // step 이 다시 전진할 때만 재네비. 현재 step 기준 동일 step 재진입
  // 케이스는 이미 path 일치 체크에서 단락된다.

  // ──────────────────────────────────────────────────────────────
  // CTA 핸들러
  // Step 1~4: completeTutorialStep(order) — step_claims 로 멱등 보상
  // Step 5:   claimTutorialRewardIfEligible() — 이미 지급 시 단락
  // ──────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (currentStep.order < totalSteps) {
      const result = await completeTutorialStep(currentStep.order);
      if (result && !result.alreadyGranted && result.amount > 0) {
        setRecentReward(result.amount);
        setTimeout(() => setRecentReward(null), 1800);
      }
      return;
    }

    // Step 5 — 최종 완료. claimTutorialRewardIfEligible 는 `finishTutorial`
    // 의 safe 래퍼: 이미 지급된 유저는 서버 호출 없이 `{ alreadyClaimed: true }`.
    //
    // 방어 레이어
    //   1. rewardClaimed short-circuit (훅 내부, 네트워크 0)
    //   2. useMutation.isPending (UI busy 잠금)
    //   3. 서버 RPC atomic UPDATE WHERE reward_claimed=false RETURNING
    //   4. tutorial_step_claims UNIQUE(user_id, step_order) — step 5 중복 차단
    //   5. try/catch + toast — 네트워크 오류 시 사용자 알림
    try {
      const r = await claimTutorialRewardIfEligible();
      if ("alreadyClaimed" in r) {
        // 재시작 케이스 — 축하 카드 없이 즉시 닫고 퀘스트 화면 유지.
        setDismissed(true);
        onClose?.();
        return;
      }
      if (!r.success) {
        // mutateAsync 는 실패 시 throw 하므로 여기 도달하지 않지만, 서버가
        // success=true + grantedGems=0 으로 응답하는 edge 에서도 안전하게 닫음.
        setDismissed(true);
        onClose?.();
        return;
      }
      setShowCelebration(true);
      if (r.grantedGems > 0) {
        toast.success(`입단식 완료! +${r.grantedGems.toLocaleString()}젬`);
      }
    } catch (err) {
      console.error("[InductionCeremony] final claim failed", err);
      toast.error("입단식 보상 지급에 실패했습니다. 잠시 후 다시 시도해주세요.");
      // 버튼 잠금 상태를 풀어 재시도 가능하게 함 — mutation.isPending 이
      // onError 에서 false 로 돌아가므로 추가 처리 불필요.
    }
  };

  const handleSkip = async () => {
    const ok = await skipTutorial();
    if (!ok) {
      toast.error("스킵 처리 실패. 잠시 후 다시 시도해주세요.");
      return;
    }
    setDismissed(true);
    onClose?.();
  };

  const handleCloseCelebration = () => {
    setShowCelebration(false);
    setDismissed(true);
    onClose?.();
    // 유저가 "시작하기" 를 누른 시점 — 이미 /missions 에 있어야 정상이지만
    // 어떤 이유로 다른 경로라면 명시적으로 미션 페이지로 유도.
    if (pathname !== "/missions") {
      navigate("/missions");
    }
  };

  // 서버에서 isCompleted=true 가 내려왔는데 축하 카드가 떠있지 않다면
  // (다른 기기에서 완료되었거나 외부 RPC 호출 등) 자연스럽게 dismiss.
  useEffect(() => {
    if (isCompleted && !showCelebration && !dismissed) {
      setDismissed(true);
      onClose?.();
    }
  }, [isCompleted, showCelebration, dismissed, onClose]);

  // restart 감지 — 서버에서 eligibility 가 다시 true 로 되면
  // 이전 세션에서 남아있던 로컬 UI state (dismissed, showCelebration,
  // autoNav ref) 을 모두 리셋해 오버레이 재진입을 허용한다.
  //
  // 오버레이는 App.tsx 에서 글로벌 마운트라 절대 언마운트되지 않기 때문에
  // 이 리셋이 없으면 Settings "다시 시작" 을 눌러도 overlay 가 dismissed
  // 상태를 유지해 화면에 올라오지 않는다.
  useEffect(() => {
    if (isOpen && (dismissed || showCelebration)) {
      setDismissed(false);
      setShowCelebration(false);
      autoNavDoneForStepRef.current = null;
    }
  }, [isOpen, dismissed, showCelebration]);

  if (!shouldRender && !shouldShowCelebration) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    // 스크롤 래퍼 + 내부 flex 센터링 패턴.
    //   • 카드 높이 < 뷰포트: items-center 로 화면 중앙 배치 (일반 phone 세로)
    //   • 카드 높이 > 뷰포트: overflow-y-auto 가 발동해 세로 스크롤 (랜드스케이프,
    //     소형 단말, 키보드 올라온 상태). 이 구조가 없으면 CTA 버튼이 화면
    //     바깥으로 밀려 튜토리얼을 완료할 수 없게 됨.
    <div
      className={cn(
        "fixed inset-0 z-[70] overflow-y-auto",
        "bg-background/80 backdrop-blur-sm",
        "animate-fade-in",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="랭킹업 입단식 튜토리얼"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {shouldShowCelebration ? (
          <InductionCompleteCelebration
            totalGems={totalReward}
            onClose={handleCloseCelebration}
          />
        ) : (
          <InductionStepCard
            step={currentStep}
            stepsCompleted={stepsCompleted}
            totalSteps={totalSteps}
            recentReward={recentReward}
            onConfirm={handleConfirm}
            onSkip={handleSkip}
            busy={isFinishing || (isFinished && !rewardClaimed)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default InductionCeremonyOverlay;
