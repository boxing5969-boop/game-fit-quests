/**
 * 153 — 리그 승급 셀러브레이션 (Cinematic 업그레이드).
 *
 * 코치/관장이 회원의 리그를 승급시킬 때 (white → blue / blue → red 등)
 * 또는 자체 승급 흐름에서 표시되는 모달.
 *
 * LevelUpModal 의 sub-component 를 재활용 + 인증서 카드 (memberName) 추가.
 *
 * 시퀀스:
 *   레벨업과 동일한 4-stage 시퀀스
 *   추가: 인증서 카드 (3.0s 등장) — 회원 이름 + 새 리그 + 날짜
 *
 * 보호 원칙:
 *   · 공식 승급 로직 무수정 — 본 모달은 "표시" 만 담당
 *   · isMaster=true 트리거 (black 리그 승급 시 자동)
 */

import { AnimatePresence, motion } from "framer-motion";

import { useLevelUpHaptic } from "@/hooks/useLevelUpHaptic";
import LevelUpConfetti from "@/components/levelUp/LevelUpConfetti";
import LevelUpHeadline from "@/components/levelUp/LevelUpHeadline";
import LevelUpStage from "@/components/levelUp/LevelUpStage";
import LevelUpTrophy from "@/components/levelUp/LevelUpTrophy";
import { RANK_LABELS } from "@/lib/rankLabels";

interface RankUpCeremonyProps {
  isOpen: boolean;
  onClose: () => void;
  oldRank: string;
  newRank: string;
  memberName: string;
}

const RANK_CARD_GRADIENT: Record<string, string> = {
  white: "linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 50%, #FFFFFF 100%)",
  blue: "linear-gradient(135deg, #1E90FF 0%, #4A90E2 50%, #00BFFF 100%)",
  red: "linear-gradient(135deg, #E8553A 0%, #FF6347 50%, #FF4500 100%)",
  black:
    "linear-gradient(135deg, #2C2C2C 0%, #1a1a1a 50%, #000000 100%)",
};

const RankUpCeremony = ({
  isOpen,
  onClose,
  oldRank,
  newRank,
  memberName,
}: RankUpCeremonyProps) => {
  const newRankKey = (newRank ?? "white").toLowerCase();
  // black 리그 승급은 master 시퀀스 (더 큰 폭발)
  const isMaster = newRankKey === "black";

  useLevelUpHaptic(isOpen, newRank, isMaster);

  const cardGradient =
    RANK_CARD_GRADIENT[newRankKey] ?? RANK_CARD_GRADIENT.white;

  return (
    <AnimatePresence>
      {isOpen && (
        <LevelUpStage rank={newRank} isMaster={isMaster} onClick={onClose}>
          <LevelUpConfetti rank={newRank} isMaster={isMaster} active={isOpen} />

          <LevelUpTrophy rank={newRank} isMaster={isMaster} />

          <LevelUpHeadline
            newLevel={1}
            newRank={newRank}
            xpGranted={0}
            isMaster={isMaster}
            oldRank={oldRank}
          />

          {/* 인증서 카드 — 등장 지연 2.4s */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.85, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            transition={{
              duration: 0.7,
              delay: 2.4,
              type: "spring",
              damping: 14,
            }}
            className="mx-auto mt-6 max-w-[300px] rounded-2xl p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.2)]"
            style={{
              background: cardGradient,
              border: "2px solid rgba(255, 255, 255, 0.25)",
            }}
          >
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{
                color:
                  newRankKey === "white"
                    ? "rgba(0, 0, 0, 0.5)"
                    : "rgba(255, 255, 255, 0.7)",
              }}
            >
              153 랭크업 시스템 인증서
            </p>
            <p
              className="text-[20px] font-black"
              style={{
                color: newRankKey === "white" ? "#1a1a1a" : "#FFFFFF",
                textShadow:
                  newRankKey === "white"
                    ? "none"
                    : "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
            >
              {memberName}
            </p>
            <p
              className="mt-1 text-[14px] font-bold"
              style={{
                color:
                  newRankKey === "white"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(255, 255, 255, 0.95)",
              }}
            >
              {RANK_LABELS[newRankKey] ?? newRankKey} 리그 입성
            </p>
            <p
              className="mt-3 text-[10.5px]"
              style={{
                color:
                  newRankKey === "white"
                    ? "rgba(0, 0, 0, 0.4)"
                    : "rgba(255, 255, 255, 0.6)",
              }}
            >
              {new Date().toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              달성
            </p>
          </motion.div>

          {/* CTA 버튼 — 등장 지연 3.0s (인증서 후) */}
          <motion.button
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 3.0,
              type: "spring",
              damping: 16,
            }}
            onClick={onClose}
            className="mx-auto mt-6 block w-full max-w-xs rounded-2xl bg-gradient-to-r from-primary via-reward to-primary bg-[length:200%_100%] py-4 text-[15px] font-black uppercase tracking-wider text-primary-foreground shadow-[0_8px_32px_rgba(232,85,58,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all active:scale-[0.97]"
            style={{
              animation: "rank-up-cta-shimmer 3s ease-in-out infinite",
            }}
          >
            새로운 도전을 시작합니다 🥊
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 0.6, delay: 3.4 }}
            className="mt-3 text-center text-[11px] font-medium text-white/70"
          >
            화면 아무 곳이나 탭하면 닫힙니다
          </motion.p>

          <style>{`
            @keyframes rank-up-cta-shimmer {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </LevelUpStage>
      )}
    </AnimatePresence>
  );
};

export default RankUpCeremony;
