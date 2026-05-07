import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { ONBOARDING_SLIDES } from "@/data/onboardingData";
import { ChevronRight, ChevronLeft } from "lucide-react";
import OsamMascot, { type OsamState } from "@/components/mascot/OsamMascot";

// 슬라이드별 오삼이 표정 (총 슬라이드 수에 맞게 회전)
const ONBOARDING_OSAMI_STATES: OsamState[] = [
  "wink",       // 1 — 첫 인사
  "smile",      // 2
  "determined", // 3
  "happy",      // 4
  "surprised",  // 5
  "victory",    // 6 — 마지막 슬라이드 / 결심
];

const RANK_COLORS = [
  "from-primary/80 to-primary",
  "from-blue-600 to-blue-500",
  "from-red-600 to-red-500",
  "from-amber-500 to-yellow-400",
];

const OnboardingPage = () => {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingState();
  const slide = ONBOARDING_SLIDES[current];
  const isLast = current === ONBOARDING_SLIDES.length - 1;
  const total = ONBOARDING_SLIDES.length;

  const finish = () => {
    completeOnboarding();
    navigate("/home", { replace: true });
  };

  const goTo = (idx: number) => {
    if (animating || idx === current) return;
    setAnimating(true);
    setCurrent(idx);
  };

  useEffect(() => {
    if (animating) {
      const t = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(t);
    }
  }, [animating]);

  const next = () => {
    if (isLast) finish();
    else goTo(current + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0C0C0E] text-white overflow-hidden">
      {/* Top bar: progress + skip */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <span className="text-xs font-medium text-white/40 tracking-wider">
          {current + 1} / {total}
        </span>
        <button
          onClick={finish}
          className="text-xs font-medium text-white/40 hover:text-white/60 transition-colors active:scale-95"
        >
          건너뛰기
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-5 mb-2 flex gap-1">
        {ONBOARDING_SLIDES.map((_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= current
                ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))"
                : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* Slide content */}
      <div
        className={`flex flex-1 flex-col items-center justify-center px-7 text-center transition-all duration-300 ${
          animating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}
      >
        {/* 오삼이 코치 — 슬라이드마다 다른 표정으로 동행 */}
        <div className="mb-3 flex justify-center">
          <OsamMascot
            size="lg"
            state={
              ONBOARDING_OSAMI_STATES[current] ??
              ONBOARDING_OSAMI_STATES[ONBOARDING_OSAMI_STATES.length - 1]
            }
          />
        </div>

        {/* 슬라이드 아이콘 — 작게 보조 표시 */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl backdrop-blur-sm border border-white/10">
          {slide.icon}
        </div>

        {/* Title */}
        <h1 className="mb-4 text-[1.6rem] font-extrabold leading-tight tracking-tight whitespace-pre-line">
          {slide.title}
        </h1>

        {/* Body */}
        <p className="max-w-sm text-[0.95rem] leading-relaxed text-white/60 whitespace-pre-line">
          {slide.body}
        </p>

        {/* Sub body */}
        {slide.subBody && (
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/40 whitespace-pre-line">
            {slide.subBody}
          </p>
        )}

        {/* Keywords */}
        {slide.keywords.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {slide.keywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-primary/15 border border-primary/25 px-4 py-1.5 text-xs font-bold text-primary tracking-wide"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Trust note */}
        {slide.trustNote && (
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
            <p className="text-[10px] text-white/30 leading-relaxed">
              📋 {slide.trustNote}
            </p>
          </div>
        )}

        {/* League preview on slide 5 */}
        {current === 4 && (
          <div className="mt-6 flex gap-2">
            {["화이트", "블루", "레드", "블랙"].map((name, i) => (
              <div
                key={name}
                className={`rounded-xl bg-gradient-to-br ${RANK_COLORS[i]} px-3 py-2 text-xs font-bold text-white shadow-lg`}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-8">
        {isLast ? (
          <div className="space-y-3">
            <button
              onClick={finish}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-base font-bold text-white shadow-glow-primary transition-all active:scale-[0.98]"
            >
              {slide.cta || "🥊 시작하기"}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {current > 0 && (
              <button
                onClick={() => goTo(current - 1)}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all active:scale-95"
              >
                <ChevronLeft className="h-5 w-5 text-white/60" />
              </button>
            )}
            <button
              onClick={next}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-base font-bold text-white backdrop-blur-sm transition-all active:scale-[0.98] hover:bg-white/15"
            >
              다음
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Bottom trust badge */}
        <p className="mt-4 text-center text-[10px] text-white/20">
          과학적 운동 원리와 단계적 성장 설계 반영
        </p>
      </div>
    </div>
  );
};

export default OnboardingPage;
