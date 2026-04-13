/**
 * useActivitySession — shared challenge start/complete logic.
 * Used by both QR checkin auto-start and manual "오늘 도전 시작" button.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivitySession {
  id: string;
  user_id: string;
  branch_name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  expires_from_board_at: string | null;
}

export function useActivitySession(userId?: string, branchName?: string) {
  const [activeSession, setActiveSession] = useState<ActivitySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load today's active session on mount
  useEffect(() => {
    if (!userId || !branchName) { setLoading(false); return; }

    const loadActive = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("activity_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("branch_name", branchName)
        .eq("status", "active")
        .gte("started_at", todayStart.toISOString())
        .order("started_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const session = data[0] as unknown as ActivitySession;
        setActiveSession(session);
      }
      setLoading(false);
    };

    loadActive();
  }, [userId, branchName]);

  // Timer: tick every second when active session exists
  useEffect(() => {
    if (activeSession && activeSession.status === "active") {
      const updateElapsed = () => {
        const start = new Date(activeSession.started_at).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  /**
   * Start a challenge session. Used by both QR auto-start and manual button.
   * Returns the created session or null if already active.
   */
  const startChallenge = useCallback(async (): Promise<ActivitySession | null> => {
    if (!userId || !branchName) return null;

    // Prevent duplicate: check if already active today
    if (activeSession && activeSession.status === "active") {
      return activeSession;
    }

    const { data, error } = await supabase
      .from("activity_sessions")
      .insert({
        user_id: userId,
        branch_name: branchName,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[useActivitySession] Start failed:", error.message);
      return null;
    }

    const session = data as unknown as ActivitySession;
    setActiveSession(session);
    return session;
  }, [userId, branchName, activeSession]);

  /**
   * Complete the active challenge session.
   * Sets status to 'completed' and expires_from_board_at to now + 1 hour.
   */
  const completeChallenge = useCallback(async (): Promise<{ minutes: number } | null> => {
    if (!activeSession) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

    const { error } = await supabase
      .from("activity_sessions")
      .update({
        status: "completed",
        ended_at: now.toISOString(),
        expires_from_board_at: expiresAt.toISOString(),
      })
      .eq("id", activeSession.id);

    if (error) {
      console.error("[useActivitySession] Complete failed:", error.message);
      return null;
    }

    const minutes = Math.floor((now.getTime() - new Date(activeSession.started_at).getTime()) / 60000);
    setActiveSession(null);
    setElapsed(0);
    return { minutes };
  }, [activeSession]);

  const isActive = !!activeSession && activeSession.status === "active";
  const elapsedMinutes = Math.floor(elapsed / 60);
  const elapsedSeconds = elapsed % 60;

  return {
    activeSession,
    isActive,
    loading,
    elapsed,
    elapsedMinutes,
    elapsedSeconds,
    startChallenge,
    completeChallenge,
  };
}
