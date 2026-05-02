/**
 * 153 — 라이브보드 활동 중 회원 풀 사이즈 카드 (체육관 모니터용).
 *
 * 시각효과:
 *   · 리그별 conic-gradient 글로우 (레벨업 Cinematic 과 일관)
 *   · framer-motion spring scale-in (새 입실 시 등장)
 *   · 운동 시간 카운터 (props 로 갱신, LiveBoardPage 가 15초마다 currentTime 갱신)
 *   · avatar 우선, 없으면 SDBoxerCharacter fallback
 *
 * 디자인 원칙:
 *   · 60인치 모니터 가시성 — 카드 width 240px+ / 글자 22px+
 *   · 그리드 배치 시 4명 = 한 줄 / 5명 이상 = 2줄
 */

import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import SDBoxerCharacter from "@/components/SDBoxerCharacter";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

const RANK_BADGE: Record<string, string> = {
  white: "bg-gray-200 text-gray-900 border border-gray-400",
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  black: "bg-gray-900 text-yellow-400 border border-yellow-600",
};

/** Rank → conic-gradient 글로우 색 (회전 빛줄기) */
const RING_GRADIENT: Record<string, string> = {
  white:
    "conic-gradient(from 0deg, hsla(220, 14%, 95%, 0.95), hsla(42, 90%, 80%, 0.9), hsla(220, 14%, 85%, 0.95), hsla(220, 14%, 95%, 0.95))",
  blue:
    "conic-gradient(from 0deg, hsla(215, 100%, 70%, 0.95), hsla(195, 100%, 75%, 0.9), hsla(215, 100%, 50%, 0.95), hsla(215, 100%, 70%, 0.95))",
  red:
    "conic-gradient(from 0deg, hsla(0, 84%, 70%, 0.95), hsla(42, 90%, 70%, 0.9), hsla(0, 84%, 50%, 0.95), hsla(0, 84%, 70%, 0.95))",
  black:
    "conic-gradient(from 0deg, hsla(42, 90%, 70%, 1), hsla(280, 70%, 60%, 0.9), hsla(42, 100%, 80%, 1), hsla(42, 90%, 60%, 1))",
};

/** Rank → glow shadow (카드 외곽) */
const CARD_GLOW: Record<string, string> = {
  white:
    "0 0 30px hsla(220, 14%, 95%, 0.25), 0 0 80px hsla(220, 14%, 85%, 0.15)",
  blue:
    "0 0 40px hsla(215, 100%, 70%, 0.5), 0 0 120px hsla(195, 100%, 60%, 0.3)",
  red:
    "0 0 40px hsla(0, 84%, 65%, 0.55), 0 0 120px hsla(20, 100%, 60%, 0.35)",
  black:
    "0 0 50px hsla(42, 90%, 64%, 0.7), 0 0 140px hsla(280, 70%, 60%, 0.4)",
};

export interface LiveActiveMember {
  id: string;
  user_id: string;
  name: string;
  league: string;
  level: number;
  startedAt: number;
  avatar_url?: string | null;
}

export interface LiveActiveMemberCardProps {
  member: LiveActiveMember;
  /** "분" 단위 운동 시간 — LiveBoardPage 가 currentTime 으로 계산 */
  elapsedMinutes: number;
  /** super_admin/branch_manager 만 보임 */
  showForceExit?: boolean;
  onForceExit?: () => void;
}

const LiveActiveMemberCard = ({
  member,
  elapsedMinutes,
  showForceExit,
  onForceExit,
}: LiveActiveMemberCardProps) => {
  const rankKey = (member.league ?? "white").toLowerCase();
  const ring = RING_GRADIENT[rankKey] ?? RING_GRADIENT.white;
  const glow = CARD_GLOW[rankKey] ?? CARD_GLOW.white;
  const rankLabel = RANK_LABELS[rankKey] ?? rankKey;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -20 }}
      transition={{
        type: "spring",
        damping: 18,
        stiffness: 220,
      }}
      className="relative flex flex-col items-center rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900 to-black p-4 group"
      style={{ boxShadow: glow }}
    >
      {/* Force exit 버튼 (관장/super 만) */}
      {showForceExit && onForceExit && (
        <button
          onClick={onForceExit}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/30 text-red-300 opacity-0 transition-opacity hover:bg-red-600/60 hover:text-red-100 group-hover:opacity-100"
          title={`${member.name} 퇴장`}
          aria-label="퇴장"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* 캐릭터 / 아바타 영역 (회전 글로우 + 펄스) */}
      <div className="relative mb-3 flex h-32 w-32 items-center justify-center">
        {/* 외곽 회전 ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: rankKey === "black" ? 6 : 10,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute inset-0 rounded-full"
          style={{ background: ring, filter: "blur(2px)" }}
          aria-hidden="true"
        />
        {/* 안쪽 어두운 배경 */}
        <div className="absolute inset-2 rounded-full bg-gray-950" />

        {/* 펄스 글로우 */}
        <motion.div
          animate={{ opacity: [0.5, 0.95, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-3 rounded-full"
          style={{ boxShadow: glow }}
          aria-hidden="true"
        />

        {/* avatar 또는 SDBoxerCharacter */}
        <div className="relative z-10 flex h-24 w-24 items-center justify-center">
          {member.avatar_url ? (
            <Avatar className="h-24 w-24 border-4 border-white/20 shadow-2xl">
              <AvatarImage src={member.avatar_url} alt={member.name} />
              <AvatarFallback className="bg-gray-800 text-3xl font-black text-white">
                {member.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="scale-[0.55]">
              <SDBoxerCharacter
                league={rankKey as "white" | "blue" | "red" | "black"}
                nickname=""
                level={member.level}
                state="idle"
              />
            </div>
          )}
        </div>
      </div>

      {/* 이름 */}
      <p
        className="mb-2 max-w-full truncate text-center text-2xl font-black text-white"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
      >
        {member.name}
      </p>

      {/* 리그 + 레벨 */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-md px-2.5 py-1 text-sm font-black ${RANK_BADGE[rankKey] ?? RANK_BADGE.white}`}
        >
          {rankLabel}
        </span>
        <span className="text-lg font-black text-gray-300">Lv.{member.level}</span>
      </div>

      {/* 운동 시간 */}
      <div className="flex items-center gap-1.5 rounded-pill border border-white/10 bg-black/40 px-3 py-1">
        <Clock className="h-3.5 w-3.5 text-emerald-400" />
        <span className="number-font text-base font-black text-emerald-300 tabular-nums">
          {elapsedMinutes}분 째 운동중
        </span>
      </div>

      {/* 활동 진행 인디케이터 — 잔잔한 펄스 */}
      <motion.div
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="mt-2 flex items-center gap-1"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          LIVE
        </span>
      </motion.div>
    </motion.div>
  );
};

export default LiveActiveMemberCard;
