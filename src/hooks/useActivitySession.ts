/**
 * useActivitySession — shared challenge start/complete logic.
 * Used by both QR checkin auto-start and manual "오늘 도전 시작" button.
 *
 * Rules:
 * - QR checkin always creates a new active session (edge function handles this)
 * - Manual start creates a session if none active
 * - Complete ends the active session → immediate removal from live board
 * - Re-entry: after completing, a new QR scan creates a fresh session
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
  const loadActiveSession = useCallback(async (): Promise<ActivitySession | null> => {
    if (!userId || !branchName) {
      setLoading(false);
      return null;
    }

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

    const nextSession = data && data.length > 0 ? (data[0] as unknown as ActivitySession) : null;
    setActiveSession(nextSession);
    setLoading(false);
    return nextSession;
  }, [userId, branchName]);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

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
   * Start a challenge session (manual button).
   * If already active, return existing session.
   */
  const startChallenge = useCallback(async (): Promise<ActivitySession | null> => {
    if (!userId || !branchName) return null;

    // If already active, return it
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
   * Sets status to 'completed' and ended_at to now.
   * No 1-hour retention — immediately removed from live board.
   */
  const completeChallenge = useCallback(async (): Promise<{ minutes: number } | null> => {
    if (!activeSession) return null;

    const now = new Date();

    const { error } = await supabase
      .from("activity_sessions")
      .update({
        status: "completed",
        ended_at: now.toISOString(),
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

  /**
   * Reload session state — called after QR checkin to pick up the new session
   * created by the edge function.
   */
  const refreshSession = useCallback(async () => {
    return loadActiveSession();
  }, [loadActiveSession]);

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
    refreshSession,
  };
}
