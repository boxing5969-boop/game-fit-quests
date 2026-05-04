/**
 * 마이복서153 — 홈 화면 "더 보기" 펼침 섹션.
 *
 * 첫 화면에서 우선순위가 낮은 위젯들을 모두 이 안으로 밀어 넣고
 * 사용자가 직접 펼칠 때만 표시 → 피로감 감소.
 *
 * 사용법:
 *   <HomeMoreSection count={5}>
 *     <EngagementSection />
 *     <DietCard />
 *     <RankingPreview />
 *     ...
 *   </HomeMoreSection>
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface HomeMoreSectionProps {
  children: ReactNode;
  /** 안에 들어있는 섹션 개수 (배지 표시) */
  count?: number;
  /** 기본으로 펼친 상태 (default false) */
  defaultOpen?: boolean;
}

const HomeMoreSection = ({
  children,
  count,
  defaultOpen = false,
}: HomeMoreSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-pill border border-white/10 bg-gray-900/40 px-4 py-2.5 text-sm font-bold text-gray-300 transition-colors active:scale-[0.98] hover:border-white/20 hover:bg-gray-900/60"
      >
        <span>{open ? "접기" : "더 보기"}</span>
        {!open && typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-black text-primary tabular-nums">
            {count}
          </span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeMoreSection;
