/**
 * 마이복서153 — 활동 후 30초 마무리 sheet (단계 47).
 *
 * 글로벌 CustomEvent listen → 하루 1회 큰 sheet 노출, 그 외엔 작은 toast 폴백.
 *
 * 보호 규칙:
 *   · DB / RPC / wallet / member_progress / 보상 지급 0
 *   · 153마인드셋 흐름 / localStorage key 0 변경
 *   · BottomNav / 메뉴 0 변경
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  REFLECTION_EVENT_NAME,
  canShowBigReflectionToday,
  getReflectionMessage,
  markReflectionShownToday,
  type ReflectionSource,
  type ReflectionTriggerDetail,
} from "@/data/postActionReflectionMessages";

const AUTO_DISMISS_MS = 30_000;

/**
 * 55단계: 7일 캠프 step 의 suppressReflectionSheet=true 가 발동하면
 * Provider 가 sessionStorage 에 세팅하는 차단 플래그 (Unix ms 만료시각).
 * 이 시각 이전이면 sheet 노출 + toast 폴백 둘 다 건너뜀.
 */
const SUPPRESS_KEY = "tutorial-camp-suppress-reflection-until";
function isSuppressed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(SUPPRESS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

const PostActionReflectionSheet = () => {
  const [active, setActive] = useState<ReflectionSource | null>(null);

  // 자동 닫기 (30초)
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [active]);

  // 글로벌 listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ReflectionTriggerDetail>).detail;
      if (!detail || !detail.source) return;

      // 55단계: 7일 캠프 suppressReflectionSheet 차단 — sheet/toast 모두 skip
      if (isSuppressed()) return;

      // force=true (예: Day 7 캠프 완료) 거나, 오늘 한 번 안 봤으면 큰 sheet
      const force = detail.force === true;
      if (force || canShowBigReflectionToday()) {
        setActive(detail.source);
        markReflectionShownToday();
      } else {
        // 작은 toast 폴백 — 노이즈 최소화
        const msg = getReflectionMessage(detail.source);
        toast(msg.feeling, {
          description: msg.osamiMessage,
          duration: 4000,
        });
      }
    };
    window.addEventListener(REFLECTION_EVENT_NAME, handler);
    return () => window.removeEventListener(REFLECTION_EVENT_NAME, handler);
  }, []);

  const onClose = useCallback(() => setActive(null), []);

  return (
    <AnimatePresence>
      {active && <SheetCard source={active} onClose={onClose} />}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────
// Sheet card
// ─────────────────────────────────────────────────────────────

function SheetCard({
  source,
  onClose,
}: {
  source: ReflectionSource;
  onClose: () => void;
}) {
  const msg = getReflectionMessage(source);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-[88] flex items-end justify-center px-3 pb-4 sm:items-center sm:pb-0"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(253,184,92,0.12) 0%, rgba(10,16,36,0.78) 65%)",
      }}
      role="dialog"
      aria-label={msg.title}
    >
      <motion.section
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-b from-[#0d1530] to-[#0a1024] text-amber-50 shadow-[0_18px_48px_rgba(0,0,0,0.6)]"
      >
        <div className="px-5 pb-2 pt-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/20"
                aria-hidden
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
                30초 마무리
              </p>
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-black/30 p-1.5 text-amber-200 hover:bg-black/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <h3 className="text-lg font-black leading-tight text-amber-50">
            {msg.title}
          </h3>

          {/* 오삼이 한마디 */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-2.5">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ background: "#fdb85c", color: "#3a1a00" }}
              aria-hidden
            >
              오
            </span>
            <p className="text-[12px] leading-relaxed text-amber-100/90">
              {msg.osamiMessage}
            </p>
          </div>

          {/* 오늘 남은 느낌 */}
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/60">
              오늘 남은 느낌
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-50">
              {msg.feeling}
            </p>
          </div>

          {/* 다음 추천 행동 */}
          <div className="mt-3 rounded-xl border-l-2 border-rose-500/55 bg-rose-950/15 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80">
              다음 추천
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-rose-100/85">
              {msg.nextAction}
            </p>
          </div>
        </div>

        <div className="border-t border-amber-400/15 bg-black/25 px-4 py-3">
          <Button
            onClick={onClose}
            className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-[12px] font-black tracking-wider text-amber-950 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
          >
            오늘은 여기까지
          </Button>
          <p className="mt-1.5 text-center text-[9px] text-amber-200/45">
            30초 후 자동으로 닫힙니다.
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default PostActionReflectionSheet;
