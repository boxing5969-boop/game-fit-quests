import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ONBOARDING_KEY = "153_onboarding_done";
const SAFETY_KEY = "153_safety_done";
const STARTER_MODE_KEY = "153_starter_mode";

export function useOnboardingState() {
  const { user, profile } = useAuth();

  // Initialize from localStorage as fast fallback
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem(ONBOARDING_KEY) === "true");
  const [safetyDone, setSafetyDone] = useState(() => localStorage.getItem(SAFETY_KEY) === "true");
  const [starterMode, setStarterMode] = useState(() => localStorage.getItem(STARTER_MODE_KEY) === "true");

  // Sync from DB profile when available (DB wins over localStorage)
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.onboarding_done === true) {
      setOnboardingDone(true);
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    if (p.safety_done === true) {
      setSafetyDone(true);
      localStorage.setItem(SAFETY_KEY, "true");
    }
  }, [profile]);

  const completeOnboarding = useCallback(async () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingDone(true);
    // Persist to DB
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ onboarding_done: true } as any)
        .eq("user_id", user.id);
    }
  }, [user?.id]);

  const completeSafety = useCallback(async (recommendStarter: boolean) => {
    localStorage.setItem(SAFETY_KEY, "true");
    if (recommendStarter) {
      localStorage.setItem(STARTER_MODE_KEY, "true");
      setStarterMode(true);
    }
    setSafetyDone(true);
    // Persist to DB
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ safety_done: true } as any)
        .eq("user_id", user.id);
    }
  }, [user?.id]);

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
