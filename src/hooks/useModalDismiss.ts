/**
 * 153 QUEST — 모달/시트 공용 dismiss 훅.
 *
 * open=true 일 때:
 *   · Escape 키 → onClose 호출
 *   · 창 뒤 페이지 스크롤 잠금 (모바일 backdrop 뒤 페이지 스크롤 방지) — lockBodyScroll 로 개수를 센다
 *
 * open=false 또는 unmount 시 원복.
 *
 * 2026-10-19: 창이 겹칠 때(지금 운동 중 전체화면 → 회원 카드) 닫은 뒤에도 페이지가 잠겨 있던 문제 수정.
 *   · 잠금은 개수로 센다(lib/scrollLock) — 마지막 창이 닫힐 때만 푼다.
 *   · onClose 는 화면마다 매번 새로 만들어지므로 ref 로 들고, 잠금은 open 이 바뀔 때만 다시 건다.
 */

import { useEffect, useRef } from "react";
import { lockBodyScroll } from "@/lib/scrollLock";

export function useModalDismiss(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const unlock = lockBodyScroll();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
}
