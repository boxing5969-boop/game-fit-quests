/**
 * 153 — 라이브보드 활동 중 회원 카드 (체육관 모니터용).
 *
 * v2: 적응형 사이즈 ("spotlight" | "medium" | "compact")
 *
 * 시각효과:
 *   · 리그별 conic-gradient 글로우 (레벨업 Cinematic 과 일관)
 *   · framer-motion spring scale-in (새 입실 시 등장)
 *   · 운동 시간 카운터 (props 로 갱신, LiveBoardPage 가 15초마다 currentTime 갱신)
 *   · avatar_url 우선, 없으면 리그 색 그라디언트 + 이니셜 fallback (overflow 차단)
 *
 * 디자인 원칙 (사이즈별):
 *   · spotlight (1~4명): 풀 사이즈, 모든 정보 표시
 *   · medium (5~12명): 중간 사이즈, 핵심 정보
 *   · compact (13명+): 작은 사이즈, 아바타 + 이름 + 시간만
 */

import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import CharacterSprite from "@/components/CharacterSprite";

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

/** Rank → fallback 그라디언트 (avatar_url 없을 때 깔끔한 원형 배경) */
const RANK_FALLBACK_BG: Record<string, string> = {
  white: "hsl(220, 14%, 35%) 0%, hsl(220, 14%, 22%) 100%",
  blue: "hsl(215, 100%, 35%) 0%, hsl(215, 100%, 18%) 100%",
  red: "hsl(0, 84%, 35%) 0%, hsl(0, 84%, 18%) 100%",
  black: "hsl(42, 60%, 22%) 0%, hsl(0, 0%, 8%) 100%",
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
  /** 회원이 설정한 캐릭터 preset (member_character_assignments → character_presets.parts_json) */
  partsJson?: { style?: string; customization?: Record<string, unknown> } | null;
}

export type LiveCardSize = "spotlight" | "medium" | "compact";

export interface LiveActiveMemberCardProps {
  member: LiveActiveMember;
  /** "분" 단위 운동 시간 — LiveBoardPage 가 currentTime 으로 계산 */
  elapsedMinutes: number;
  /** 카드 사이즈 — 인원수에 따라 자동 결정 */
  size?: LiveCardSize;
  /** super_admin/branch_manager 만 보임 */
  showForceExit?: boolean;
  onForceExit?: () => void;
  /** "방금 입실" 글로우 강조 (5분 이내) */
  isFresh?: boolean;
}

const SIZE_CONFIG = {
  spotlight: {
    container: "p-4",
    avatarBox: "h-32 w-32",
    avatar: "h-24 w-24",
    avatarBorder: "border-4",
    avatarFallbackText: "text-3xl",
    sdScale: "scale-[0.55]",
    spriteSize: "md" as const,
    nameText: "text-2xl",
    nameMargin: "mb-2",
    badgeText: "text-sm",
    badgePadding: "px-2.5 py-1",
    levelText: "text-lg",
    badgeMargin: "mb-3",
    timerPadding: "px-3 py-1",
    timerIcon: "h-3.5 w-3.5",
    timerText: "text-base",
    showLive: true,
  },
  medium: {
    container: "p-2",
    avatarBox: "h-14 w-14",
    avatar: "h-12 w-12",
    avatarBorder: "border-2",
    avatarFallbackText: "text-lg",
    sdScale: "scale-[0.32]",
    spriteSize: "sm" as const,
    nameText: "text-sm",
    nameMargin: "mb-0.5",
    badgeText: "text-[10px]",
    badgePadding: "px-1 py-0",
    levelText: "text-[11px]",
    badgeMargin: "mb-1",
    timerPadding: "px-1.5 py-0.5",
    timerIcon: "h-2.5 w-2.5",
    timerText: "text-[10px]",
    showLive: false,
  },
  compact: {
    container: "p-1.5",
    avatarBox: "h-11 w-11",
    avatar: "h-9 w-9",
    avatarBorder: "border",
    avatarFallbackText: "text-sm",
    sdScale: "scale-[0.22]",
    spriteSize: "xs" as const,
    nameText: "text-xs",
    nameMargin: "mb-0.5",
    badgeText: "text-[9px]",
    badgePadding: "px-1 py-0",
    levelText: "text-[9px]",
    badgeMargin: "mb-0.5",
    timerPadding: "px-1 py-0",
    timerIcon: "h-2 w-2",
    timerText: "text-[9px]",
    showLive: false,
  },
} as const;

const LiveActiveMemberCard = ({
  member,
  elapsedMinutes,
  size = "spotlight",
  showForceExit,
  onForceExit,
  isFresh,
}: LiveActiveMemberCardProps) => {
  const rankKey = (member.league ?? "white").toLowerCase();
  const ring = RING_GRADIENT[rankKey] ?? RING_GRADIENT.white;
  const glow = CARD_GLOW[rankKey] ?? CARD_GLOW.white;
  const rankLabel = RANK_LABELS[rankKey] ?? rankKey;
  const cfg = SIZE_CONFIG[size];

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
      className={`relative flex flex-col items-center rounded-3xl border ${
        isFresh ? "border-emerald-400/60" : "border-white/10"
      } bg-gradient-to-br from-gray-900 via-gray-900 to-black ${cfg.container} group`}
      style={{
        boxShadow: isFresh
          ? `${glow}, 0 0 60px hsla(160, 80%, 60%, 0.6)`
          : glow,
      }}
    >
      {/* "방금 입실" 강조 배지 */}
      {isFresh && size !== "compact" && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30">
          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-lg">
            ✨ NEW
          </span>
        </div>
      )}

      {/* Force exit 버튼 (관장/super 만) */}
      {showForceExit && onForceExit && size !== "compact" && (
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
      <div
        className={`relative ${cfg.nameMargin} flex items-center justify-center ${cfg.avatarBox}`}
      >
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

        {/* avatar 영역 — 우선순위: avatar_url > 회원 설정 캐릭터(CharacterSprite) > 이니셜 fallback */}
        <div
          className={`relative z-10 flex items-center justify-center overflow-hidden rounded-full ${cfg.avatar}`}
        >
          {member.avatar_url ? (
            <Avatar
              className={`${cfg.avatar} ${cfg.avatarBorder} border-white/20 shadow-2xl`}
            >
              <AvatarImage src={member.avatar_url} alt={member.name} />
              <AvatarFallback
                className={`${cfg.avatarFallbackText} font-black text-white`}
                style={{
                  background: `linear-gradient(135deg, ${RANK_FALLBACK_BG[rankKey] ?? RANK_FALLBACK_BG.white})`,
                }}
              >
                {member.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : member.partsJson ? (
            <CharacterSprite
              partsJson={member.partsJson}
              size={cfg.spriteSize}
              league={rankKey as "white" | "blue" | "red" | "black"}
              level={member.level}
              animate={false}
            />
          ) : (
            <Avatar
              className={`${cfg.avatar} ${cfg.avatarBorder} border-white/20 shadow-2xl`}
            >
              <AvatarFallback
                className={`${cfg.avatarFallbackText} font-black text-white`}
                style={{
                  background: `linear-gradient(135deg, ${RANK_FALLBACK_BG[rankKey] ?? RANK_FALLBACK_BG.white})`,
                }}
              >
                {member.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      {/* 이름 */}
      <p
        className={`${cfg.nameMargin} max-w-full truncate text-center ${cfg.nameText} font-black text-white`}
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
      >
        {member.name}
      </p>

      {/* 리그 + 레벨 */}
      <div className={`${cfg.badgeMargin} flex items-center gap-1.5`}>
        <span
          className={`rounded-md ${cfg.badgePadding} ${cfg.badgeText} font-black ${
            RANK_BADGE[rankKey] ?? RANK_BADGE.white
          }`}
        >
          {rankLabel}
        </span>
        <span className={`${cfg.levelText} font-black text-gray-300`}>
          Lv.{member.level}
        </span>
      </div>

      {/* 운동 시간 */}
      <div
        className={`flex items-center gap-1 rounded-pill border border-white/10 bg-black/40 ${cfg.timerPadding}`}
      >
        <Clock className={`${cfg.timerIcon} text-emerald-400`} />
        <span
          className={`number-font ${cfg.timerText} font-black text-emerald-300 tabular-nums`}
        >
          {elapsedMinutes}분{size !== "compact" && " 째 운동중"}
        </span>
      </div>

      {/* 활동 진행 인디케이터 — 잔잔한 펄스 (spotlight 만) */}
      {cfg.showLive && (
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
      )}
    </motion.div>
  );
};

export default LiveActiveMemberCard;
