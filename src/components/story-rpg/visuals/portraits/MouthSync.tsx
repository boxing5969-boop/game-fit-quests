/**
 * 153 스토리 RPG — 입 모양 동기화 (Stage 47A).
 *
 * isTyping=true 면 200ms 간격으로 mouth 토글 → return value.
 * CharacterPortrait 안에서 사용.
 */

import { useEffect, useState } from "react";

export function useMouthOpen(isTyping: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!isTyping) {
      setOpen(false);
      return;
    }
    let v = false;
    const id = setInterval(() => {
      v = !v;
      setOpen(v);
    }, 200);
    return () => {
      clearInterval(id);
      setOpen(false);
    };
  }, [isTyping]);
  return open;
}
