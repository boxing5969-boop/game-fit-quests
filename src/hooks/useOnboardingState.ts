import { useState, useCallback } from "react";

const ONBOARDING_KEY = "153_onboarding_done";
const SAFETY_KEY = "153_safety_done";
const STARTER_MODE_KEY = "153_starter_mode";

export function useOnboardingState() {
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem(ONBOARDING_KEY) === "true");
  const [safetyDone, setSafetyDone] = useState(() => localStorage.getItem(SAFETY_KEY) === "true");
  const [starterMode, setStarterMode] = useState(() => localStorage.getItem(STARTER_MODE_KEY) === "true");

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingDone(true);
  }, []);

  const completeSafety = useCallback((recommendStarter: boolean) => {
    localStorage.setItem(SAFETY_KEY, "true");
    if (recommendStarter) {
      localStorage.setItem(STARTER_MODE_KEY, "true");
      setStarterMode(true);
    }
    setSafetyDone(true);
  }, []);

  const toggleStarterMode = useCallback((on: boolean) => {
    localStorage.setItem(STARTER_MODE_KEY, on ? "true" : "false");
    setStarterMode(on);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setOnboardingDone(false);
  }, []);

  return {
    onboardingDone,
    safetyDone,
    starterMode,
    completeOnboarding,
    completeSafety,
    toggleStarterMode,
    resetOnboarding,
  };
}
