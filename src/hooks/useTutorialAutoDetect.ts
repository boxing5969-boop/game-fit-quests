/**
 * 마이복서153 — 튜토리얼 미션 자동 완료 감지.
 *
 * 사용자가 미션 행동을 실제로 완료했는지 감지해서 자동 advance.
 * 백업으로 수동 "완료했어요" 버튼은 TutorialFloatingMascot 에 있음.
 *
 * 감지 종류:
 *   · avatar_set       — profile.avatar_url 변경 (null → string)
 *   · viewed_guide     — /guide 페이지 5초 체류
 *   · viewed_missions  — /missions 페이지 5초 체류 (탭 확인 충분)
 *   · mission_done     — daily_quest_completions 첫 row (오늘) — legacy
 *   · first_attendance — attendance_logs 첫 row (이 회원)
 *   · first_challenge  — challenge_participants 첫 row (이 회원)
 *
 * App.tsx 의 AppRoutes 안에 1번만 마운트.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorialState } from "@/hooks/useTutorialState";
import { TUTORIAL_STEPS } from "@/data/unlockRules";
import { supabase } from "@/integrations/supabase/client";

const GUIDE_DWELL_MS = 5000; // 가이드에서 5초 체류 = 봤다고 인정
const MISSIONS_DWELL_MS = 5000; // 훈련 화면에서 5초 체류 = 둘러봤다고 인정

export function useTutorialAutoDetect() {
  const { user, profile } = useAuth();
  const { isEligible, stepsCompleted, advance } = useTutorialState();
  const location = useLocation();

  // 현재 진행 중인 step 의 detector 키
  const currentDetector =
    isEligible && stepsCompleted < TUTORIAL_STEPS.length
      ? TUTORIAL_STEPS[stepsCompleted]?.detector
      : undefined;

  // ── 1) avatar_set: profile.avatar_url 감시 ──
  const lastAvatarRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentDetector !== "avatar_set") return;
    const avatar = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    // 처음 mount 시 기존값 기록 후 다음 변경부터 감지 — 이미 사진 있는 경우는 detector 매치 안 됨
    if (lastAvatarRef.current === null && avatar) {
      // 이미 사진 있음 → 즉시 완료 처리 (이 미션 의미 없음)
      advance();
      return;
    }
    if (lastAvatarRef.current !== avatar && avatar) {
      // null 이었는데 새 url 들어옴 = 업로드 완료
      advance();
    }
    lastAvatarRef.current = avatar;
  }, [currentDetector, profile, advance]);

  // ── 2) viewed_guide: /guide 또는 /guide/* 5초 체류 ──
  useEffect(() => {
    if (currentDetector !== "viewed_guide") return;
    const onGuide = location.pathname.startsWith("/guide") || location.pathname === "/about";
    if (!onGuide) return;
    const t = setTimeout(() => {
      advance();
    }, GUIDE_DWELL_MS);
    return () => clearTimeout(t);
  }, [currentDetector, location.pathname, advance]);

  // ── 2-B) viewed_missions: /missions 5초 체류 = 탭 둘러보기 충분 ──
  useEffect(() => {
    if (currentDetector !== "viewed_missions") return;
    const onMissions = location.pathname.startsWith("/missions");
    if (!onMissions) return;
    const t = setTimeout(() => {
      advance();
    }, MISSIONS_DWELL_MS);
    return () => clearTimeout(t);
  }, [currentDetector, location.pathname, advance]);

  // ── 3-5) DB row 감지: 폴링으로 안전 (Realtime RLS 거부 시 대비) ──
  useEffect(() => {
    if (!user?.id) return;
    if (!currentDetector) return;
    if (
      currentDetector !== "mission_done" &&
      currentDetector !== "first_attendance" &&
      currentDetector !== "first_challenge"
    )
      return;

    let cancelled = false;

    const check = async () => {
      try {
        if (currentDetector === "first_attendance") {
          const { data } = await supabase
            .from("attendance_logs")
            .select("id")
            .eq("user_id", user.id)
            .limit(1);
          if (!cancelled && data && data.length > 0) advance();
        } else if (currentDetector === "first_challenge") {
          // challenge_participants 테이블 RLS 가 본인 row read 허용한다는 가정
          const { data } = await supabase
            .from("challenge_participants" as never)
            .select("id")
            .eq("user_id", user.id)
            .limit(1);
          if (!cancelled && data && (data as unknown[]).length > 0) advance();
        } else if (currentDetector === "mission_done") {
          // daily_quest_completions — 회원의 첫 미션 완료
          // 테이블명이 정확하지 않을 수 있어 try-catch 로 안전 처리
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { data } = await supabase
            .from("daily_quest_completions" as never)
            .select("id")
            .eq("user_id", user.id)
            .gte("completed_at", todayStart.toISOString())
            .limit(1);
          if (!cancelled && data && (data as unknown[]).length > 0) advance();
        }
      } catch {
        // 테이블 없거나 RLS 거부 — silent (수동 완료 버튼이 backup)
      }
    };

    void check();
    const t = setInterval(check, 8000); // 8초마다 폴링
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user?.id, currentDetector, advance]);
}
