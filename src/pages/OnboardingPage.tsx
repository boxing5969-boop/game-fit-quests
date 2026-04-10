import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { ONBOARDING_SLIDES, INTENSITY_INFO } from "@/data/onboardingData";
import { ChevronRight, ChevronLeft } from "lucide-react";

const OnboardingPage = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingState();
  const slide = ONBOARDING_SLIDES[current];
  const isLast = current === ONBOARDING_SLIDES.length - 1;

  const finish = () => {
    completeOnboarding();
    navigate("/home", { replace: true });
  };

  const next = () => {
    if (isLast) finish();
    else setCurrent(c => c + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Skip */}
      <div className="flex justify-end px-5 pt-5">
        <button onClick={finish} className="text-sm text-muted-foreground active:scale-95">
          건너뛰기
        </button>
      </div>

      {/* Slide content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-5xl shadow-sm"
          style={{ animation: "pulse 2s infinite" }}
        >
          {slide.icon}
        </div>

        {slide.accent && (
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-bold text-primary">
            {slide.accent}
          </span>
        )}

        <h1 className="mb-4 text-2xl font-bold leading-tight text-foreground" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
          {slide.title}
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
          {slide.body}
        </p>

        {/* Intensity info on slide 2 */}
        {current === 1 && (
          <div className="mt-6 w-full max-w-sm space-y-2">
            {INTENSITY_INFO.map(info => (
              <div key={info.label} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm border border-border">
                <span className="text-xs font-bold text-primary whitespace-nowrap">{info.rpe}</span>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: dots + nav */}
      <div className="px-8 pb-10">
        {/* Dots */}
        <div className="mb-6 flex justify-center gap-2">
          {ONBOARDING_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? "w-8 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card transition-all active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          <button
            onClick={next}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
          >
            {isLast ? "🥊 내 성장 시작하기" : "다음"}
            {!isLast && <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* Science badge */}
        <p className="mt-4 text-center text-[10px] text-muted-foreground/60">
          WHO·CDC·ACSM 권고안을 참고해 설계됨
        </p>
      </div>
    </div>
  );
};

export default OnboardingPage;
