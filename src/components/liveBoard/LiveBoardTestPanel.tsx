/**
 * 153 — 라이브보드 테스트 패널 (관리자 전용).
 *
 * 실제 회원 없이 라이브보드 시각효과를 검증하는 floating 패널.
 *
 * 기능:
 *   · 가상 회원 빠른 추가 (1 / 2 / 5 / 12 / 30명 프리셋)
 *   · 가상 회원 1명씩 추가 / 1명씩 제거
 *   · "방금 입실" 시뮬레이트 (NEW 배지 강조)
 *   · 레벨업 인터럽트 시뮬레이트 (랜덤 회원 한 명)
 *   · 전체 mock 리셋
 *
 * 표시 조건:
 *   · super_admin 또는 branch_manager 만 보임
 *   · 우측 하단 floating, 접었다 펼 수 있음
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Plus,
  Minus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

export interface LiveBoardTestPanelProps {
  mockCount: number;
  onAdd: (count: number, asFresh?: boolean) => void;
  onRemoveOne: () => void;
  onReset: () => void;
  onTriggerLevelUp: () => void;
}

const PRESETS = [1, 2, 5, 12, 30];

const LiveBoardTestPanel = ({
  mockCount,
  onAdd,
  onRemoveOne,
  onReset,
  onTriggerLevelUp,
}: LiveBoardTestPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 z-[80] select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-purple-500/40 bg-gray-900/95 backdrop-blur-md shadow-2xl"
        style={{
          boxShadow:
            "0 0 30px hsla(280, 70%, 60%, 0.3), 0 8px 30px rgba(0,0,0,0.6)",
        }}
      >
        {/* 헤더 (토글) */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 rounded-t-2xl px-4 py-2.5 text-left hover:bg-purple-500/10 transition-colors"
        >
          <FlaskConical className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-black text-purple-300">
            테스트 모드
          </span>
          <span className="text-[10px] font-bold text-purple-400/60 uppercase tracking-wider">
            (관리자 전용)
          </span>
          <span className="ml-auto rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-black text-purple-300 tabular-nums">
            mock {mockCount}
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-purple-400" />
          )}
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-purple-500/20"
            >
              <div className="space-y-3 p-3">
                {/* 프리셋 행 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    프리셋 — 즉시 N명 추가
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((n) => (
                      <button
                        key={n}
                        onClick={() => onAdd(n)}
                        className="rounded-lg bg-purple-600/20 px-2.5 py-1.5 text-xs font-black text-purple-200 hover:bg-purple-600/40 transition-colors"
                      >
                        +{n}명
                      </button>
                    ))}
                  </div>
                </div>

                {/* 단일 조작 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    조정
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => onAdd(1, true)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-600/40 transition-colors"
                      title="방금 입실 시뮬레이트 (NEW 배지)"
                    >
                      <Sparkles className="h-3 w-3" />
                      NEW 1명
                    </button>
                    <button
                      onClick={() => onAdd(1)}
                      className="flex items-center gap-1 rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-black text-gray-300 hover:bg-gray-600 transition-colors"
                      title="일반 mock 1명 추가"
                    >
                      <Plus className="h-3 w-3" />
                      1명
                    </button>
                    <button
                      onClick={onRemoveOne}
                      disabled={mockCount === 0}
                      className="flex items-center gap-1 rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-black text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="mock 1명 제거"
                    >
                      <Minus className="h-3 w-3" />
                      1명
                    </button>
                  </div>
                </div>

                {/* 인터럽트 + 리셋 */}
                <div className="flex flex-wrap gap-1.5 border-t border-gray-700/50 pt-3">
                  <button
                    onClick={onTriggerLevelUp}
                    disabled={mockCount === 0}
                    className="flex items-center gap-1 rounded-lg bg-yellow-500/20 px-2.5 py-1.5 text-xs font-black text-yellow-300 hover:bg-yellow-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="랜덤 mock 회원 레벨업 인터럽트 발동"
                  >
                    <Zap className="h-3 w-3" />
                    레벨업 테스트
                  </button>
                  <button
                    onClick={onReset}
                    disabled={mockCount === 0}
                    className="ml-auto flex items-center gap-1 rounded-lg bg-red-600/20 px-2.5 py-1.5 text-xs font-black text-red-300 hover:bg-red-600/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="모든 mock 회원 제거"
                  >
                    <Trash2 className="h-3 w-3" />
                    리셋
                  </button>
                </div>

                <p className="text-[10px] leading-relaxed text-gray-500">
                  ⚠️ mock 회원은 화면에만 표시되며 DB 에 저장되지 않습니다.
                  <br />
                  새로고침 시 모두 사라집니다.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LiveBoardTestPanel;
