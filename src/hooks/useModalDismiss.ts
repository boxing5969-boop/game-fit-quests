/**
 * 153 QUEST — 모달/시트 공용 dismiss 훅.
 *
 * open=true 일 때:
 *   · Escape 키 → onClose 호출
 *   · document.body 스크롤 잠금 (모바일 backdrop 뒤 페이지 스크롤 방지)
 *
 * open=false 또는 unmount 시 원복.
 */

import { useEffect } from "react";

export function useModalDismiss(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}
