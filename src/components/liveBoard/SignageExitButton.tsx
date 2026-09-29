/**
 * 라이브보드 미리보기의 '나가기' 버튼 (2026-09-29) — 어두운 반투명 알약, 왼쪽 위 고정.
 * 사이니지 화면엔 탭바·뒤로가기가 없어서 미리보기에서 돌아갈 길을 따로 둔다.
 * TV 보드 자체에는 넣지 않는다 — TV 에는 절대 보이면 안 되는 버튼이라 미리보기 화면만 그린다.
 * compact: 가로 화면에서 보드 옆 여백에 들어가도록 화살표만 (보드를 가리지 않게).
 */
import type { CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";

interface SignageExitButtonProps {
  onExit: () => void;
  compact?: boolean;
  style?: CSSProperties;
}

const SignageExitButton = ({ onExit, compact = false, style }: SignageExitButtonProps) => (
  <button
    type="button"
    onClick={onExit}
    className={`fixed z-[100] flex h-11 items-center justify-center gap-1 rounded-full bg-black/65 text-[14px] font-bold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition-transform active:scale-95 ${
      compact ? "w-11" : "pl-2.5 pr-4"
    }`}
    style={{ left: 12, top: "max(12px, env(safe-area-inset-top))", ...style }}
    aria-label="라이브보드 미리보기 나가기"
  >
    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
    {!compact && "나가기"}
  </button>
);

export default SignageExitButton;
