/**
 * 153 — 라이브보드 레벨업 인터럽트 (Cinematic 미니버전).
 *
 * 회원이 레벨업하면 5초간 라이브보드 전체가 그 사람을 비추는 무대로 전환.
 *
 * 동작:
 *   · LiveBoardPage 가 member_progress 변경을 Realtime 으로 감지
 *   · current_level 이 oldLevel 보다 큰 경우만 발동
 *   · 한 번에 하나만 큐 처리 (현재 표시 중이면 5초 후 다음)
 *
 * 시각:
 *   · 풀스크린 backdrop (검은색 + vignette)
 *   · 회전 빛줄기 (리그별 색)
 *   · 큰 캐릭터/아바타 + "LEVEL UP!" + Lv.N → Lv.N+1
 *   · 컨페티 미니
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import SDBoxerCharacter from "@/components/SDBoxerCharacter";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

const RANK_GLOW_COLOR: Record<string, string> = {
  white: "hsla(220, 14%, 95%, 0.5)",
  blue: "hsla(215, 100%, 70%, 0.7)",
  red: "hsla(0, 84%, 65%, 0.7)",
  black: "hsla(42, 90%, 64%, 0.85)",
};

const RANK_CONFETTI_COLORS: Record<string, string[]> = {
  white: ["#F6C453", "#FFFFFF", "#E5E7EB"],
  blue: ["#3B82F6", "#06B6D4", "#FFFFFF"],
  red: ["#EF4444", "#F97316", "#F6C453"],
  black: ["#F6C453", "#FFFFFF", "#A855F7", "#EAB308"],
};

export interface LevelUpEvent {
  user_id: string;
  name: string;
  league: string;
  oldLevel: number;
  newLevel: number;
  avatar_url?: string | null;
  /** Unique ID — Realtime payload PK 또는 timestamp */
  eventId: string;
}

const DISPLAY_DURATION_MS = 5000;

export interface LiveLevelUpInterruptProps {
  /** LiveBoardPage 가 push, 표시되면 자동 소진 */
  event: LevelUpEvent | null;
  onDismiss: () => void;
}

const LiveLevelUpInterrupt = ({
  event,
  onDismiss,
}: LiveLevelUpInterruptProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) {
      setVisible(false);
      return;
    }
    setVisible(true);

    // 컨페티 미니 — 양쪽에서 풀어 줌
    const colors =
      RANK_CONFETTI_COLORS[event.league.toLowerCase()] ??
      RANK_CONFETTI_COLORS.white;
    const fire = (origin: { x: number; y: number }) => {
      confetti({
        particleCount: 60,
        spread: 70,
        startVelocity: 35,
        origin,
        colors,
        scalar: 1.1,
      });
    };
    fire({ x: 0.2, y: 0.55 });
    fire({ x: 0.8, y: 0.55 });
    setTimeout(() => fire({ x: 0.5, y: 0.4 }), 250);

    const t = setTimeout(() => {
      setVisible(false);
      // exit animation 끝나고 dismiss
      setTimeout(onDismiss, 500);
    }, DISPLAY_DURATION_MS);
    return () => clearTimeout(t);
  }, [event, onDismiss]);

  if (!event) return null;

  const rankKey = event.league.toLowerCase();
  const rankLabel = RANK_LABELS[rankKey] ?? rankKey;
  const glowColor = RANK_GLOW_COLOR[rankKey] ?? RANK_GLOW_COLOR.white;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(10,10,15,0.85) 0%, rgba(0,0,0,0.97) 70%)",
          }}
          aria-live="assertive"
          role="status"
        >
          {/* 회전 빛줄기 */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, ease: "linear", repeat: Infinity }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${glowColor} 45deg, transparent 90deg, transparent 180deg, ${glowColor} 225deg, transparent 270deg)`,
              opacity: 0.35,
              filter: "blur(40px)",
            }}
            aria-hidden="true"
          />

          {/* 중앙 콘텐츠 */}
          <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
            {/* 캐릭터/아바타 (크게) */}
            <motion.div
              initial={{ scale: 0.4, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              transition={{
                type: "spring",
                damping: 14,
                stiffness: 180,
                delay: 0.15,
              }}
              className="relative flex h-56 w-56 items-center justify-center"
            >
              {/* 글로우 펄스 */}
              <motion.div
                animate={{
                  opacity: [0.4, 1, 0.4],
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: `0 0 90px ${glowColor}, 0 0 180px ${glowColor}`,
                }}
                aria-hidden="true"
              />

              <div className="relative z-10">
                {event.avatar_url ? (
                  <Avatar className="h-44 w-44 border-4 border-white/30 shadow-2xl">
                    <AvatarImage
                      src={event.avatar_url}
                      alt={event.name}
                    />
                    <AvatarFallback className="bg-gray-900 text-6xl font-black text-white">
                      {event.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="scale-100">
                    <SDBoxerCharacter
                      league={
                        rankKey as "white" | "blue" | "red" | "black"
                      }
                      nickname=""
                      level={event.newLevel}
                      state="enter"
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* "LEVEL UP!" 헤드라인 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
              className="space-y-3"
            >
              <p
                className="text-7xl font-black tracking-wider"
                style={{
                  background:
                    "linear-gradient(180deg, #F6C453 0%, #FBBF24 50%, #F59E0B 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 20px ${glowColor})`,
                }}
              >
                LEVEL UP!
              </p>
              <p
                className="text-4xl font-black text-white"
                style={{ textShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
              >
                {event.name}
              </p>
              <div className="flex items-center justify-center gap-5">
                <span className="rounded-xl bg-white/10 px-4 py-2 text-2xl font-black text-gray-300">
                  Lv.{event.oldLevel}
                </span>
                <span className="text-5xl font-black text-yellow-400">
                  →
                </span>
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.8,
                    type: "spring",
                    damping: 10,
                    stiffness: 200,
                  }}
                  className="rounded-xl bg-yellow-500/20 border-2 border-yellow-400/50 px-5 py-2 text-3xl font-black text-yellow-300"
                  style={{
                    boxShadow: "0 0 40px hsla(42, 90%, 64%, 0.5)",
                  }}
                >
                  Lv.{event.newLevel}
                </motion.span>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-400">
                {rankLabel} 리그
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveLevelUpInterrupt;
