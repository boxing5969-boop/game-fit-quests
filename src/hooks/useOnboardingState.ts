import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ONBOARDING_KEY = "153_onboarding_done";
const STARTER_MODE_KEY = "153_starter_mode";

/**
 * 안전 체크(설문조사) 기능은 제거됨.
 * safetyDone 은 호환을 위해 항상 true 반환하고, completeSafety 는 no-op.
 * 호출처들(HomePage·MyPage 등)은 자연스럽게 통과됨.
 */
export function useOnboardingState() {
  const { user, profile } = useAuth();

  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem(ONBOARDING_KEY) === "true");
  const [starterMode, setStarterMode] = useState(() => localStorage.getItem(STARTER_MODE_KEY) === "true");

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.onboarding_done === true) {
      setOnboardingDone(true);
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
  }, [profile]);

  const completeOnboarding = useCallback(async () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingDone(true);
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ onboarding_done: true } as any)
        .eq("user_id", user.id);
    }
  }, [user?.id]);

  // 안전 체크 제거됨 — 호환을 위해 no-op 유지.
  const completeSafety = useCallback(async (_recommendStarter: boolean) => {
    // no-op
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
    safetyDone: true,        // 안전 체크 제거 — 항상 통과
    starterMode,
    completeOnboarding,
    completeSafety,
    toggleStarterMode,
    resetOnboarding,
  };
}
