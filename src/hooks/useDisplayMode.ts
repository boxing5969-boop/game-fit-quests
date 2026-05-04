/**
 * 마이복서153 — 프로필 카드 표시 모드 환경설정.
 *
 * 라이센스 카드 photo 슬롯에 무엇을 보여줄지 사용자가 선택:
 *   · "auto"      — avatar_url 있으면 사진, 없으면 캐릭터, 없으면 이니셜 (기본)
 *   · "photo"     — 사진 강제 (avatar_url 없으면 이니셜)
 *   · "character" — 캐릭터 강제 (캐릭터 없으면 이니셜)
 *
 * 저장: localStorage (디바이스마다 다름 — DB 마이그레이션 회피)
 */

import { useCallback, useEffect, useState } from "react";

export type DisplayMode = "auto" | "photo" | "character";

const STORAGE_KEY = "myboxer153.displayMode";

const isValidMode = (v: unknown): v is DisplayMode =>
  v === "auto" || v === "photo" || v === "character";

export function useDisplayMode() {
  const [mode, setModeState] = useState<DisplayMode>("auto");

  // 첫 mount 시 localStorage 로부터 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isValidMode(raw)) setModeState(raw);
    } catch {
      // SSR / privacy mode
    }
  }, []);

  const setMode = useCallback((next: DisplayMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

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
