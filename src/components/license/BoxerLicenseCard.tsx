/**
 * 마이복서153 — 프로복서 라이센스 카드.
 *
 * 홈 캐릭터 hero + 라이브보드 spotlight/compact 모두 동일 디자인 언어.
 *
 * 디자인:
 *   · 검은 base + 골드 트림 (마스터는 골드 풀 그라디언트)
 *   · 좌측: 캐릭터/사진 (정사각 photo frame, 153 워터마크)
 *   · 우측: 닉네임 + 지점 + 리그/레벨 + 라이센스 번호 + 연속일
 *   · 하단: XP 막대 + "MY BOXER 153 · OFFICIAL"
 *   · 헤더 줄: "153 PRO BOXER LICENSE" + Lic.#XXXXXX
 *
 * Size:
 *   · hero      — 홈 메인 (큰 사이즈, 모든 정보)
 *   · spotlight — 라이브보드 스포트라이트 (중간, 핵심 정보)
 *   · compact   — 라이브보드 컴팩트 그리드 (작음, 사진+레벨만)
 */

import { motion } from "framer-motion";
import { Crown, Flame } from "lucide-react";
import type { ReactNode } from "react";

const RANK_LABELS: Record<string, string> = {
  white: "WHITE",
  blue: "BLUE",
  red: "RED",
  black: "BLACK",
};

const RANK_LABELS_KR: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

/** 리그별 카드 색상 (border + accent) */
const RANK_BORDER: Record<string, string> = {
  white: "from-gray-300/60 via-gray-100/30 to-gray-300/60",
  blue: "from-blue-400/70 via-blue-300/40 to-blue-400/70",
  red: "from-red-500/70 via-red-300/40 to-red-500/70",
  black: "from-yellow-400 via-yellow-200 to-yellow-400", // 마스터 = 골드
};

const RANK_BG: Record<string, string> = {
  white: "from-gray-900 via-gray-800 to-gray-900",
  blue: "from-gray-900 via-blue-950/40 to-gray-900",
  red: "from-gray-900 via-red-950/40 to-gray-900",
  black: "from-gray-900 via-yellow-950/30 to-gray-900",
};

const RANK_ACCENT_TEXT: Record<string, string> = {
  white: "text-gray-300",
  blue: "text-blue-300",
  red: "text-red-300",
  black: "text-yellow-300",
};

/** 리그별 사진 frame aurora — conic-gradient 회전 빛줄기 (등급↑ = 화려↑) */
const AURORA_RING: Record<string, string> = {
  white:
    "conic-gradient(from 0deg, hsla(0, 0%, 100%, 0.85), hsla(0, 0%, 90%, 0.4), hsla(0, 0%, 100%, 0.85), hsla(0, 0%, 95%, 0.6), hsla(0, 0%, 100%, 0.85))",
  blue:
    "conic-gradient(from 0deg, hsla(215, 100%, 70%, 0.95), hsla(195, 100%, 80%, 0.7), hsla(215, 100%, 50%, 0.95), hsla(195, 100%, 75%, 0.85), hsla(215, 100%, 70%, 0.95))",
  red:
    "conic-gradient(from 0deg, hsla(0, 84%, 70%, 0.95), hsla(20, 100%, 75%, 0.85), hsla(42, 90%, 70%, 0.9), hsla(0, 84%, 50%, 0.95), hsla(20, 100%, 65%, 0.85), hsla(0, 84%, 70%, 0.95))",
  black:
    // 무지개 + 골드 — 가장 화려
    "conic-gradient(from 0deg, hsla(42, 95%, 65%, 1), hsla(280, 80%, 65%, 0.95), hsla(195, 100%, 70%, 0.95), hsla(140, 80%, 60%, 0.95), hsla(20, 100%, 65%, 1), hsla(330, 85%, 65%, 0.95), hsla(42, 95%, 65%, 1))",
};

/** 리그별 회전 속도 (초) — 등급 올라갈수록 빠르게 */
const AURORA_SPEED: Record<string, number> = {
  white: 16,
  blue: 12,
  red: 9,
  black: 6,
};

/** 카드 외곽 글로우 (등급별 강도 차등) */
const CARD_GLOW: Record<string, string> = {
  white:
    "0 4px 20px rgba(255,255,255,0.1), 0 0 0 1px rgba(255,255,255,0.08)",
  blue:
    "0 6px 28px hsla(215, 100%, 65%, 0.35), 0 0 0 1.5px hsla(215, 100%, 60%, 0.4)",
  red:
    "0 8px 36px hsla(0, 84%, 60%, 0.4), 0 0 0 1.5px hsla(20, 100%, 60%, 0.45), 0 0 80px hsla(20, 100%, 55%, 0.15)",
  black:
    "0 10px 50px hsla(42, 95%, 60%, 0.55), 0 0 0 2px hsla(42, 95%, 60%, 0.6), 0 0 120px hsla(280, 70%, 55%, 0.25)",
};

/** user_id 해시 → 6자리 라이센스 번호 */
function licenseNumber(userId?: string): string {
  if (!userId) return "------";
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(6, "0").slice(0, 6);
}

/** 발급일 formatter (created_at or "—") */
function formatIssueDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export type LicenseSize = "hero" | "spotlight" | "compact";

export interface BoxerLicenseCardProps {
  size?: LicenseSize;
  /** 좌측에 들어갈 캐릭터/사진 컴포넌트 (CharacterSprite, Avatar 등) */
  photo: ReactNode;
  /** 회원 닉네임 */
  name: string;
  /** 지점명 */
  branch?: string | null;
  /** 리그 (white/blue/red/black) */
  league: string;
  /** 레벨 */
  level: number;
  /** user_id (라이센스 번호 산출용) */
  userId?: string;
  /** 가입일/발급일 ISO 문자열 (profile.created_at 등) */
  issueDate?: string | null;
  /** 연속 출석일 */
  streakDays?: number;
  /** XP (현재) */
  totalXp?: number;
  /** XP (다음 승급까지) */
  xpToNext?: number;
  /** 마스터 (블랙 Lv.10 + 보스 4클리어) */
  isMaster?: boolean;
  /** 운동중 LIVE 인디케이터 (라이브보드용) */
  isLive?: boolean;
  /** "방금 입실" 강조 (라이브보드 fresh) */
  isFresh?: boolean;
  /** 운동 시간 (분, 라이브보드용) */
  elapsedMinutes?: number;
}

const BoxerLicenseCard = ({
  size = "hero",
  photo,
  name,
  branch,
  league,
  level,
  userId,
  issueDate,
  streakDays = 0,
  totalXp,
  xpToNext,
  isMaster = false,
  isLive = false,
  isFresh = false,
  elapsedMinutes,
}: BoxerLicenseCardProps) => {
  const rankKey = (league || "white").toLowerCase();
  const lic = licenseNumber(userId);
  const issuedFmt = formatIssueDate(issueDate);
  const rankLabelKR = isMaster ? "마스터" : RANK_LABELS_KR[rankKey] ?? rankKey;
  const rankLabelEN = isMaster ? "MASTER" : RANK_LABELS[rankKey] ?? rankKey.toUpperCase();
  const accentText = isMaster ? "text-yellow-300" : RANK_ACCENT_TEXT[rankKey] ?? "text-gray-300";
  const borderGrad = isMaster ? RANK_BORDER.black : RANK_BORDER[rankKey] ?? RANK_BORDER.white;
  const bgGrad = isMaster ? RANK_BG.black : RANK_BG[rankKey] ?? RANK_BG.white;

  // ── 사이즈별 dimensions ──
  const cfg = (() => {
    switch (size) {
      case "hero":
        return {
          padding: "p-4",
          headerText: "text-[9px]",
          photoBox: "h-28 w-28",
          nameText: "text-2xl",
          metaText: "text-xs",
          rankBadge: "text-sm px-2.5 py-1",
          levelText: "text-xl",
          licText: "text-[10px]",
          xpHeight: "h-2",
          showXp: true,
          showFooter: true,
          showIssued: true,
          showStreak: true,
        };
      case "spotlight":
        return {
          padding: "p-3",
          headerText: "text-[8px]",
          photoBox: "h-20 w-20",
          nameText: "text-lg",
          metaText: "text-[10px]",
          rankBadge: "text-[10px] px-2 py-0.5",
          levelText: "text-base",
          licText: "text-[9px]",
          xpHeight: "h-1.5",
          showXp: false,
          showFooter: true,
          showIssued: false,
          showStreak: true,
        };
      case "compact":
        return {
          padding: "p-2",
          headerText: "text-[7px]",
          photoBox: "h-14 w-14",
          nameText: "text-xs",
          metaText: "text-[9px]",
          rankBadge: "text-[8px] px-1 py-0",
          levelText: "text-[11px]",
          licText: "text-[7px]",
          xpHeight: "h-1",
          showXp: false,
          showFooter: false,
          showIssued: false,
          showStreak: false,
        };
    }
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative w-full overflow-hidden rounded-2xl ${cfg.padding}`}
      style={{
        background: `linear-gradient(135deg, hsla(0, 0%, 6%, 0.97) 0%, hsla(0, 0%, 10%, 0.95) 100%)`,
        boxShadow: isFresh
          ? "0 8px 24px hsla(160, 80%, 50%, 0.4), 0 0 0 2px hsla(160, 80%, 50%, 0.6)"
          : CARD_GLOW[isMaster ? "black" : rankKey] ?? CARD_GLOW.white,
      }}
    >
      {/* ── 골드 트림 (얇은 외곽 그라디언트 라인) ── */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${borderGrad} opacity-50`}
        style={{ padding: "1.5px", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
        aria-hidden="true"
      />

      {/* ── 배경 그라디언트 ── */}
      <div
        className={`absolute inset-[2px] rounded-2xl bg-gradient-to-br ${bgGrad}`}
        aria-hidden="true"
      />

      {/* ── 마스터 hologram 효과 (블랙 + 마스터만) ── */}
      {isMaster && (
        <motion.div
          animate={{
            background: [
              "linear-gradient(45deg, transparent 30%, rgba(246,196,83,0.15) 50%, transparent 70%)",
              "linear-gradient(45deg, transparent 60%, rgba(246,196,83,0.15) 80%, transparent 100%)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[2px] rounded-2xl pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* ═══ 콘텐츠 ═══ */}
      <div className="relative">
        {/* ── Header — 라이센스 타이틀 + 번호 ── */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`font-black uppercase tracking-[0.2em] ${cfg.headerText} ${accentText}`}>
              {isMaster ? "★ MASTER LICENSE" : "PRO BOXER LICENSE"}
            </span>
          </div>
          <span className={`font-mono font-black ${cfg.licText} text-gray-400 tabular-nums`}>
            #{lic}
          </span>
        </div>

        {/* ── 본문: 사진 + 정보 (가로) ── */}
        <div className="flex items-start gap-3">
          {/* 사진 frame */}
          <div className="relative flex-shrink-0">
            {/* 사진 frame + 회전 aurora ring (리그별 강도) */}
            <div
              className={`${cfg.photoBox} relative flex items-center justify-center rounded-xl`}
            >
              {/* 외곽 회전 aurora — 리그별 conic-gradient (등급↑ 빠르게) */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: AURORA_SPEED[isMaster ? "black" : rankKey] ?? AURORA_SPEED.white,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute inset-0 rounded-xl"
                style={{
                  background: AURORA_RING[isMaster ? "black" : rankKey] ?? AURORA_RING.white,
                  filter: "blur(3px)",
                }}
                aria-hidden="true"
              />

              {/* 안쪽 어두운 padding 영역 (사진 외곽 ring 효과 만들기 위해) */}
              <div className="absolute inset-[3px] rounded-[10px] bg-gradient-to-br from-gray-900 to-black" />

              {/* 펄스 글로우 (블랙/마스터 추가 화려) */}
              {(rankKey === "black" || isMaster) && (
                <motion.div
                  animate={{ opacity: [0.4, 0.95, 0.4] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-[3px] rounded-[10px] pointer-events-none"
                  style={{
                    boxShadow: "inset 0 0 30px hsla(42, 95%, 60%, 0.5), inset 0 0 60px hsla(280, 70%, 55%, 0.3)",
                  }}
                  aria-hidden="true"
                />
              )}

              {/* ★ 별 입자 (블루 이상 — 등급↑ 별 더 많음) */}
              {(rankKey === "blue" || rankKey === "red" || rankKey === "black" || isMaster) && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl" aria-hidden="true">
                  {[...Array(rankKey === "black" || isMaster ? 8 : rankKey === "red" ? 5 : 3)].map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute"
                      style={{
                        left: `${(i * 37) % 90 + 5}%`,
                        top: `${(i * 53) % 85 + 5}%`,
                        fontSize: "8px",
                        color: rankKey === "black" || isMaster ? "#F6C453" : rankKey === "red" ? "#FFB347" : "#A5D8FF",
                      }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0.5, 1.3, 0.5],
                      }}
                      transition={{
                        duration: 1.6 + (i % 3) * 0.4,
                        repeat: Infinity,
                        delay: i * 0.25,
                        ease: "easeInOut",
                      }}
                    >
                      ✦
                    </motion.span>
                  ))}
                </div>
              )}

              {/* 사진/캐릭터 (z-index 위) */}
              <div className="relative z-10 flex items-center justify-center w-full h-full overflow-hidden rounded-[10px]">
                {photo}
              </div>

              {/* "153" 워터마크 (대각선) — hero 만 표시 */}
              {size === "hero" && (
                <span
                  className="pointer-events-none absolute z-20 -bottom-1 -right-1 font-black opacity-15"
                  style={{
                    fontSize: "48px",
                    color: "#fff",
                    transform: "rotate(-15deg)",
                  }}
                  aria-hidden="true"
                >
                  153
                </span>
              )}
            </div>

            {/* LIVE 인디케이터 (라이브보드 활동중) */}
            {isLive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-white shadow-lg whitespace-nowrap">
                ● LIVE
              </span>
            )}
            {/* NEW 인디케이터 */}
            {isFresh && !isLive && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-white shadow-lg whitespace-nowrap">
                ✨ NEW
              </span>
            )}
          </div>

          {/* 정보 영역 */}
          <div className="flex-1 min-w-0">
            <p className={`truncate font-black text-white ${cfg.nameText}`}>
              {name}
            </p>
            {branch && size !== "compact" && (
              <p className={`mt-0.5 truncate text-gray-400 ${cfg.metaText}`}>
                {branch}
              </p>
            )}

            {/* 리그 + 레벨 라인 */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md font-black uppercase tracking-wider ${cfg.rankBadge} ${
                  isMaster
                    ? "bg-yellow-500 text-gray-900"
                    : rankKey === "blue"
                      ? "bg-blue-500 text-white"
                      : rankKey === "red"
                        ? "bg-red-500 text-white"
                        : rankKey === "black"
                          ? "bg-gray-900 text-yellow-400 border border-yellow-600"
                          : "bg-gray-300 text-gray-900"
                }`}
              >
                {isMaster && <Crown className="inline h-3 w-3 -mt-0.5 mr-0.5" />}
                {rankLabelEN}
              </span>
              <span className={`font-black text-white ${cfg.levelText}`}>
                Lv.{level}
              </span>
            </div>

            {/* 메타 정보 (연속일 / 운동시간) */}
            {(cfg.showStreak || elapsedMinutes !== undefined) && size !== "compact" && (
              <div className={`mt-2 flex flex-wrap items-center gap-2 ${cfg.metaText}`}>
                {streakDays > 0 && cfg.showStreak && (
                  <span className="inline-flex items-center gap-1 text-orange-300">
                    <Flame className="h-3 w-3" />
                    <span className="number-font tabular-nums font-black">
                      {streakDays}일 연속
                    </span>
                  </span>
                )}
                {elapsedMinutes !== undefined && (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <span className="number-font tabular-nums font-black">
                      {elapsedMinutes}분 운동중
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* 발급일 (hero 만) */}
            {cfg.showIssued && (
              <p className={`mt-1.5 ${cfg.licText} font-mono text-gray-500`}>
                ISSUED {issuedFmt}
              </p>
            )}
          </div>
        </div>

        {/* ── XP 막대 (hero 만) ── */}
        {cfg.showXp && totalXp !== undefined && xpToNext !== undefined && xpToNext > 0 && (
          <div className="mt-3">
            <div className={`flex items-center justify-between text-[10px] ${accentText} mb-1`}>
              <span className="font-black uppercase tracking-wider">XP</span>
              <span className="font-mono font-black tabular-nums">
                {totalXp.toLocaleString()} / {xpToNext.toLocaleString()}
              </span>
            </div>
            <div className={`overflow-hidden rounded-full bg-black/40 ${cfg.xpHeight}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (totalXp / xpToNext) * 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full ${
                  isMaster
                    ? "bg-gradient-to-r from-yellow-400 to-orange-400"
                    : rankKey === "blue"
                      ? "bg-gradient-to-r from-blue-400 to-cyan-300"
                      : rankKey === "red"
                        ? "bg-gradient-to-r from-red-400 to-orange-400"
                        : rankKey === "black"
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                          : "bg-gradient-to-r from-gray-200 to-gray-400"
                }`}
              />
            </div>
          </div>
        )}

        {/* ── Footer — 153 OFFICIAL 마크 ── */}
        {cfg.showFooter && (
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            <div className="flex items-center gap-1">
              <span className="text-base">🥊</span>
              <span className={`font-black uppercase tracking-[0.2em] ${cfg.headerText} ${accentText}`}>
                MY BOXER 153
              </span>
            </div>
            <span className={`font-mono ${cfg.licText} text-gray-500 uppercase`}>
              · OFFICIAL ·
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BoxerLicenseCard;
