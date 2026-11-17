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
 *
 * 2026-11-17: { back: true } 면 휴대폰 뒤로가기도 이 창을 닫는다(useBackClose — 훈련 탭 영상 · 시트).
 *   모든 창의 기본으로 하지 않은 까닭: 종료 확인 창(뒤로가기로 열림) · 저장 안 된 편집 창은 뒤로가기로 닫히면 안 된다.
 */

import { useEffect, useRef } from "react";
import { lockBodyScroll } from "@/lib/scrollLock";
import { useBackClose } from "@/hooks/useBackClose";

export function useModalDismiss(open: boolean, onClose: () => void, opts?: { back?: boolean }): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useBackClose(open && !!opts?.back, onClose);

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
