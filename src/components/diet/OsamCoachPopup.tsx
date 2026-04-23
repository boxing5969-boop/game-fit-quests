import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { pickWarmLine } from "@/data/diet/osamCoachWarm";

interface OsamCoachPopupProps {
  /** 팝업 트리거 delay (ms). 기본 3500 — 진입 후 여유있게 뜸 */
  delayMs?: number;
  /** 일일 노출 확률 (0~1). 기본 0.45 — 너무 자주 뜨면 피로감 */
  probability?: number;
}

const LOCAL_KEY = "osam_coach_popup_last_shown_v1";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 오삼 코치 랜덤 위로 팝업.
 *
 * 등장 조건:
 *   1. 오늘 이미 뜬 적 있으면 skip (localStorage 일자 기록)
 *   2. probability 난수 통과 시에만
 *   3. mount 후 delayMs 뒤 페이드 인
 *
 * 메시지: pickWarmLine(userId, today) — 회원별·일자별 결정적 1개.
 * 닫기: 우상단 X · 하단 "고마워요" 버튼. 닫으면 오늘 다시 뜨지 않음.
 */
export const OsamCoachPopup = ({
  delayMs = 3500,
  probability = 0.45,
}: OsamCoachPopupProps) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const warm = useMemo(() => pickWarmLine(user?.id), [user?.id]);

  useEffect(() => {
    // 오늘 이미 노출됐는지 체크
    try {
      const last = localStorage.getItem(LOCAL_KEY);
      if (last === todayStr()) return;
    } catch {
      return;
    }
    // 확률 통과 체크
    if (Math.random() > probability) return;

    const t = window.setTimeout(() => {
      setVisible(true);
      try {
        localStorage.setItem(LOCAL_KEY, todayStr());
      } catch {
        // best-effort
      }
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs, probability]);

  const handleClose = () => {
    setClosing(true);
    window.setTimeout(() => setVisible(false), 300);
  };

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-x-3 bottom-24 z-[68] mx-auto max-w-[420px]",
        "transition-all duration-300",
        closing ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100",
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-card p-4",
          "shadow-[0_12px_40px_-12px_rgba(16,185,129,0.35)]",
          "animate-fade-in",
        )}
      >
        {/* 상단 mint glow line */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-500"
          >
            <Heart className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              오삼 코치님의 한마디
            </p>
            <p className="mt-1 text-[13px] font-extrabold leading-snug text-foreground">
              {warm.text}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className={cn(
            "mt-3 h-9 w-full rounded-xl text-[12.5px] font-bold",
            "bg-emerald-500/90 text-white active:scale-[0.99] hover:bg-emerald-500",
          )}
        >
          고마워요, 오삼 코치님
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default OsamCoachPopup;
