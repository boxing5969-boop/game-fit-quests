/**
 * 153 — 레벨업 셀러브레이션 모달 (Cinematic 업그레이드).
 *
 * 시퀀스 (3.5s 자동 재생, 사용자 클릭으로 닫기 가능):
 *   0.0s — backdrop fade-in + haptic 진입 노크
 *   0.2s — vignette glow 등장 (rank 별)
 *   0.3s — 회전 빛줄기 (conic-gradient)
 *   0.4s — 트로피 spring scale-in + 회전 + haptic 메인 시퀀스
 *   0.4s — 컨페티 양쪽 시작 폭발
 *   0.7s — 중앙 대폭발 (트로피 도착)
 *   1.0s — 좌우 분수 (지속 2초)
 *   1.0s — "LEVEL UP!" 한 글자씩 spring stagger
 *   1.5s — 위에서 별 비 + rank/level 정보 등장
 *   1.9s — XP 카운트업 (1초 ease)
 *   2.7s — CTA 버튼 등장
 *   3.0s — 잔잔한 잔향 폭발
 *
 * 보호 원칙:
 *   · 공식 레벨업 로직 무수정 — 본 모달은 "표시" 만 담당
 *   · isOpen + props 만으로 동작 — 외부 트리거 흐름 변경 0
 *   · navigator.vibrate 가 없으면 silent (데스크톱/iOS Safari 안전)
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { useLevelUpHaptic } from "@/hooks/useLevelUpHaptic";
import LevelUpConfetti from "@/components/levelUp/LevelUpConfetti";
import LevelUpHeadline from "@/components/levelUp/LevelUpHeadline";
import LevelUpStage from "@/components/levelUp/LevelUpStage";
import LevelUpTrophy from "@/components/levelUp/LevelUpTrophy";

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  newRank: string;
  xpGranted: number;
  /** 마스터 등급 (black 10 + 보스 4 클리어) — 더 큰 폭발 */
  isMaster?: boolean;
}

const LevelUpModal = ({
  isOpen,
  onClose,
  newLevel,
  newRank,
  xpGranted,
  isMaster,
}: LevelUpModalProps) => {
  // Haptic — open 시 자동 트리거
  useLevelUpHaptic(isOpen, newRank, isMaster);

  // 자동 닫기 안내음 — open 시 5초 후 옅어지는 효과 가능 (옵션, 지금은 사용자 클릭만)
  useEffect(() => {
    if (!isOpen) return;
    // 자동 닫기는 안 함 — 사용자가 충분히 감상한 후 닫기
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <LevelUpStage rank={newRank} isMaster={isMaster} onClick={onClose}>
          {/* 컨페티 (canvas, 렌더 없음 — 부수효과만) */}
          <LevelUpConfetti rank={newRank} isMaster={isMaster} active={isOpen} />

          {/* 트로피 / 배지 */}
          <LevelUpTrophy rank={newRank} isMaster={isMaster} />

          {/* 헤드라인 + 카운트업 */}
          <LevelUpHeadline
            newLevel={newLevel}
            newRank={newRank}
            xpGranted={xpGranted}
            isMaster={isMaster}
          />

          {/* CTA 버튼 — 등장 지연 2.7s */}
          <motion.button
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 2.7,
              type: "spring",
              damping: 16,
            }}
            onClick={onClose}
            className="mx-auto mt-8 block w-full max-w-xs rounded-2xl bg-gradient-to-r from-primary via-reward to-primary bg-[length:200%_100%] py-4 text-[15px] font-black uppercase tracking-wider text-primary-foreground shadow-[0_8px_32px_rgba(232,85,58,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all active:scale-[0.97]"
            style={{
              animation: "level-up-cta-shimmer 3s ease-in-out infinite",
            }}
          >
            계속 도전하기 🥊
          </motion.button>

          {/* 살짝 페이드인 보조 텍스트 */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 0.6, delay: 3.0 }}
            className="mt-3 text-center text-[11px] font-medium text-white/70"
          >
            화면 아무 곳이나 탭하면 닫힙니다
          </motion.p>

          {/* 인라인 keyframes — CTA shimmer */}
          <style>{`
            @keyframes level-up-cta-shimmer {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </LevelUpStage>
      )}
    </AnimatePresence>
  );
};

export default LevelUpModal;
