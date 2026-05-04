/**
 * 153 — 라이브보드 활동 중 회원 카드 (체육관 모니터용).
 *
 * v3: 프로복서 라이센스 카드 디자인 (BoxerLicenseCard wrapper).
 *
 * 동일한 외부 props 유지 (member, elapsedMinutes, size, showForceExit, onForceExit, isFresh).
 * 내부 렌더링은 BoxerLicenseCard 로 통일 — 홈 hero 와 디자인 언어 일치.
 *
 * 사이즈 매핑:
 *   · spotlight  → BoxerLicenseCard size="spotlight"
 *   · medium     → BoxerLicenseCard size="spotlight" (조금 작게 padding 조정)
 *   · compact    → BoxerLicenseCard size="compact"
 */

import { motion } from "framer-motion";
import { X } from "lucide-react";

import CharacterSprite from "@/components/CharacterSprite";
import BoxerLicenseCard, { type LicenseSize } from "@/components/license/BoxerLicenseCard";

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

/** 라이브 카드 photo 우선순위: avatar_url(사진) > 회원 설정 캐릭터(CharacterSprite) > 이니셜 */
const PhotoSlot = ({
  member,
  size,
}: {
  member: LiveActiveMember;
  size: LicenseSize;
}) => {
  const rankKey = (member.league ?? "white").toLowerCase();
  const spriteSize: "xs" | "sm" | "md" = size === "compact" ? "xs" : size === "spotlight" ? "md" : "sm";

  // 1순위 — 본인이 업로드한 사진
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.name}
        className="h-full w-full object-cover"
      />
    );
  }

  // 2순위 — 캐릭터 스튜디오에서 설정한 캐릭터
  if (member.partsJson) {
    return (
      <CharacterSprite
        partsJson={member.partsJson}
        size={spriteSize}
        league={rankKey as "white" | "blue" | "red" | "black"}
        level={member.level}
        animate={false}
      />
    );
  }

  // 3순위 — 이니셜 fallback (리그 색 그라디언트)
  const fallbackBg =
    rankKey === "blue"
      ? "linear-gradient(135deg, hsl(215, 100%, 35%) 0%, hsl(215, 100%, 18%) 100%)"
      : rankKey === "red"
        ? "linear-gradient(135deg, hsl(0, 84%, 35%) 0%, hsl(0, 84%, 18%) 100%)"
        : rankKey === "black"
          ? "linear-gradient(135deg, hsl(42, 60%, 22%) 0%, hsl(0, 0%, 8%) 100%)"
          : "linear-gradient(135deg, hsl(220, 14%, 35%) 0%, hsl(220, 14%, 22%) 100%)";

  return (
    <div
      className="flex h-full w-full items-center justify-center font-black text-white"
      style={{ background: fallbackBg, fontSize: size === "compact" ? "1rem" : size === "spotlight" ? "2.5rem" : "1.5rem" }}
    >
      {member.name.charAt(0)}
    </div>
  );
};

const LiveActiveMemberCard = ({
  member,
  elapsedMinutes,
  size = "spotlight",
  showForceExit,
  onForceExit,
  isFresh,
}: LiveActiveMemberCardProps) => {
  // medium → spotlight 로 매핑 (라이센스 카드의 size 와 일치)
  const licenseSize: LicenseSize = size === "compact" ? "compact" : "spotlight";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{ type: "spring", damping: 18, stiffness: 220 }}
      className="relative group"
    >
      {/* Force exit 버튼 — 라이센스 카드 위 hover 시 노출 */}
      {showForceExit && onForceExit && size !== "compact" && (
        <button
          onClick={onForceExit}
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600/40 text-red-100 opacity-0 transition-opacity hover:bg-red-600/70 group-hover:opacity-100"
          title={`${member.name} 퇴장`}
          aria-label="퇴장"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <BoxerLicenseCard
        size={licenseSize}
        photo={<PhotoSlot member={member} size={licenseSize} />}
        name={member.name}
        league={member.league}
        level={member.level}
        userId={member.user_id}
        isLive
        isFresh={isFresh}
        elapsedMinutes={elapsedMinutes}
      />
    </motion.div>
  );
};

export default LiveActiveMemberCard;
