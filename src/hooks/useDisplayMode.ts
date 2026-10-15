/**
 * 마이복서153 — 프로필 카드 표시 모드 환경설정.
 *
 * 라이센스 카드 photo 슬롯에 무엇을 보여줄지 사용자가 선택:
 *   · "auto"      — avatar_url 있으면 사진, 없으면 캐릭터, 없으면 이니셜 (기본)
 *   · "photo"     — 사진 강제 (avatar_url 없으면 이니셜)
 *   · "character" — 캐릭터 강제 (캐릭터 없으면 이니셜)
 *
 * 저장: localStorage(이 기기 바로 반영) + 서버 member_card_display (2026-10-15 — TV 라이브보드가 같은 선택을 따른다).
 *   로그인한 회원이면 서버 값을 먼저 읽어 다른 기기와 맞추고, 고르면 서버에도 저장한다. 서버가 안 되면 이 기기 값만.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DisplayMode = "auto" | "photo" | "character";

const STORAGE_KEY = "myboxer153.displayMode";

const isValidMode = (v: unknown): v is DisplayMode =>
  v === "auto" || v === "photo" || v === "character";

// 생성된 타입에 아직 없는 테이블 — 느슨한 클라이언트로
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useDisplayMode() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [mode, setModeState] = useState<DisplayMode>("auto");

  // 첫 mount 시 localStorage 로부터 복원 → 로그인했으면 서버 값으로 맞춘다
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isValidMode(raw)) setModeState(raw);
    } catch {
      // SSR / privacy mode
    }
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await sb.from("member_card_display").select("mode").eq("user_id", userId).maybeSingle();
      const m = (data as { mode?: string } | null)?.mode;
      if (!cancelled && isValidMode(m)) {
        setModeState(m);
        try {
          localStorage.setItem(STORAGE_KEY, m);
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = useCallback(
    (next: DisplayMode) => {
      setModeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      if (userId) {
        void sb.from("member_card_display").upsert({ user_id: userId, mode: next, updated_at: new Date().toISOString() });
      }
    },
    [userId],
  );

  /**
   * 우선순위 결정 헬퍼.
   * 입력: avatar_url 존재 여부, partsJson 존재 여부
   * 출력: "photo" | "character" | "letter" 중 어느 걸 보여줄지
   */
  const resolveSlot = useCallback(
    (hasAvatar: boolean, hasCharacter: boolean): "photo" | "character" | "letter" => {
      if (mode === "photo") return hasAvatar ? "photo" : "letter";
      if (mode === "character") return hasCharacter ? "character" : "letter";
      // auto
      if (hasAvatar) return "photo";
      if (hasCharacter) return "character";
      return "letter";
    },
    [mode],
  );

  return { mode, setMode, resolveSlot };
}
