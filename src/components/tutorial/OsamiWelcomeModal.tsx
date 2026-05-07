/**
 * 마이복서153 — 첫 로그인 오삼이 코치 환영 모달.
 *
 * 신규 회원이 가입 후 첫 진입 시 단 1회 노출.
 * 오삼이가 등장해 인사하고 앱의 핵심 3가지 (마스터로드 / 153 QUEST / 7일 캠프)
 * 를 짧게 안내. "시작하기" 누르면 sessionStorage + localStorage 에 기록되어
 * 다시 안 뜸.
 *
 * 노출 조건:
 *   · 로그인 user 있음
 *   · 셋업 라우트 (`/`, `/onboarding`, `/select-branch`, `/waiting-approval`,
 *     `/live-board/...`) 가 아님
 *   · profile.tutorial_step === 0 (튜토리얼 한 번도 시작 안 함)
 *   · localStorage 'osami-welcome-seen' 미저장
 *
 * 보호 규칙:
 *   · DB / RPC 호출 0
 *   · 다른 모달과 z-index 충돌 X (z-[88])
 *   · 7일 캠프 / TutorialFloatingMascot 와 동시 노출 가능 — 환영 모달은
 *     그 위에 한 번만 떴다 사라지므로 충돌 없음
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, X, Map, Target, Calendar } from "lucide-react";
import { createPortal } from "react-dom";

import OsamMascot from "@/components/mascot/OsamMascot";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "osami-welcome-seen";
const SETUP_ROUTES = ["/", "/onboarding", "/select-branch", "/waiting-approval"];

function isSetupPath(pathname: string): boolean {
  if (SETUP_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/live-board")) return true;
  return false;
}

function hasSeenWelcome(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markWelcomeSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

const OsamiWelcomeModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0=인사, 1=핵심3가지, 2=다짐

  // 노출 결정 — 마운트 시 한 번
  useEffect(() => {
    if (!user) return;
    if (isSetupPath(location.pathname)) return;
    const p = profile as { tutorial_step?: number; tutorial_completed?: boolean } | null;
    if (!p) return;
    // 튜토리얼 이미 진행/완료/스킵한 회원에게는 노출 X
    if (typeof p.tutorial_step === "number" && p.tutorial_step > 0) return;
    if (p.tutorial_completed) return;
    if (hasSeenWelcome()) return;
    // 약간의 지연 — 다른 splash / 모달 끝난 후 등장
    const t = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [user, profile, location.pathname]);

  const handleClose = () => {
    markWelcomeSeen();
    setOpen(false);
  };

  const handleStartTutorial = () => {
    markWelcomeSeen();
    setOpen(false);
    // floating mascot 이 이미 보이므로 별도 navigate 불필요 — 회원이 자유롭게 시작
  };

  const handleNext = () => {
    if (stage < 2) setStage((s) => (s + 1) as 0 | 1 | 2);
    else handleStartTutorial();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[87] bg-black/70 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="fixed inset-0 z-[88] flex items-center justify-center px-4"
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#0d1530] via-[#0a1024] to-[#0a1024] p-6 text-amber-50 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 X */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 rounded-full bg-white/5 p-1.5 text-amber-200/70 hover:bg-white/10"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 큰 오삼이 캐릭터 */}
              <div className="flex justify-center">
                <OsamMascot
                  size="xl"
                  state={stage === 0 ? "wink" : stage === 1 ? "determined" : "victory"}
                />
              </div>

              <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.4em] text-amber-300">
                OSAM · 153복싱짐 코치
              </p>

              {/* 단계별 콘텐츠 */}
              <AnimatePresence mode="wait">
                {stage === 0 && (
                  <motion.div
                    key="stage-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="mt-3 text-center text-2xl font-black leading-tight text-amber-50">
                      안녕하세요!
                      <br />
                      오삼이에요 🥊
                    </h2>
                    <p className="mt-3 text-center text-[13px] leading-relaxed text-amber-100/85">
                      마이복서153 에 오신 것을 환영해요.
                      <br />
                      앞으로 매일 오삼이가 같이 갈게요.
                    </p>
                  </motion.div>
                )}

                {stage === 1 && (
                  <motion.div
                    key="stage-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="mt-3 text-center text-xl font-black leading-tight text-amber-50">
                      이 앱은 이렇게 써요
                    </h2>
                    <div className="mt-4 space-y-2.5">
                      <FeatureRow
                        icon={<Map className="h-4 w-4 text-amber-300" />}
                        title="마스터로드"
                        desc="단계별 공식 훈련. 한 번에 한 단."
                      />
                      <FeatureRow
                        icon={<Target className="h-4 w-4 text-amber-300" />}
                        title="153 QUEST"
                        desc="매일 한 줄, 가벼운 도전 한 가지."
                      />
                      <FeatureRow
                        icon={<Calendar className="h-4 w-4 text-amber-300" />}
                        title="7일 스타터 캠프"
                        desc="처음 7일 동안 오삼이가 안내해드려요."
                      />
                    </div>
                  </motion.div>
                )}

                {stage === 2 && (
                  <motion.div
                    key="stage-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="mt-3 text-center text-xl font-black leading-tight text-amber-50">
                      준비됐어요?
                    </h2>
                    <p className="mt-3 text-center text-[13px] leading-relaxed text-amber-100/85">
                      처음부터 잘하지 않아도 돼요.
                      <br />
                      오늘 한 번만 해도 충분합니다.
                      <br />
                      <span className="text-amber-300">함께 시작해봐요!</span>
                    </p>
                    <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-100/90">
                      좌측 하단 오삼이를 누르면
                      <br />
                      5개 미션을 시작할 수 있어요.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 진행 dots */}
              <div className="mt-5 flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stage
                        ? "w-6 bg-amber-400"
                        : i < stage
                          ? "w-1.5 bg-amber-400/60"
                          : "w-1.5 bg-amber-400/20"
                    }`}
                  />
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleNext}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3 text-sm font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
              >
                {stage === 2 ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    시작하기
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {stage < 2 && (
                <button
                  onClick={handleClose}
                  className="mt-2 w-full text-[11px] text-amber-200/55 hover:text-amber-200/85"
                >
                  나중에 보기
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FeatureRow = ({ icon, title, desc }: FeatureRowProps) => (
  <div className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-black/30 px-3 py-2.5">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-black text-amber-50">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-amber-100/65">{desc}</p>
    </div>
  </div>
);

export default OsamiWelcomeModal;
