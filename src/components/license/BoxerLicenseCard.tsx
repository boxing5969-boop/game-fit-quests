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
 *   · 헤더 줄: "153 BOXER LICENSE" + Lic.#XXXXXX (2026-09-29 대표님: PRO BOXER → 153 BOXER)
 *   · 하트(2026-09-29): 아래 줄 오른쪽 — 받은 하트 수. 닉네임 좋아요와 같은 하트(한 사람에게 하나).
 *   · onCardClick 이 오면 카드 전체가 버튼 — 내 카드는 누르면 닉네임 바꾸기.
 *   · onPhotoClick 이 오면 사진이 따로 버튼 (2026-10-14) — 내 카드는 누르면 프로필 사진 올리기·바꾸기.
 *     photoBadge 가 오면 사진 위에 금색 알약 (처음 올리면 받는 챔피언 머니).
 *
 * Size:
 *   · hero      — 홈 메인 (큰 사이즈, 모든 정보)
 *   · spotlight — 라이브보드 스포트라이트 (중간, 핵심 정보)
 *   · compact   — 라이브보드 컴팩트 그리드 (작음, 사진+레벨만)
 */

import MedalMark from "@/components/MedalMark";
import { motion } from "framer-motion";
import { Camera, Crown, Flame, Heart, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { STAFF_CHAMPION_LEVEL } from "@/lib/staffDisplay";
import LeagueBadge from "@/components/badges/LeagueBadge";
import NameBadge from "@/components/badges/NameBadge";
import { toGlobalLevel } from "@/lib/rankLabels";
import birthdayCake from "@/assets/birthday/cake.webp";
import fxAurora from "@/assets/effects/fx_aurora.png";

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

/** 🎂 생일 회원 (라이브보드, 2026-10-16 대표님: "오로라 표시와 황금버튼, 생일축하 표시") */
const BIRTHDAY_RING =
  "conic-gradient(from 0deg, #34f5c5, #22d3ee, #a78bfa, #f472b6, #fbbf24, #34f5c5)";
const BIRTHDAY_GLOW =
  "0 0 0 2px hsla(165, 90%, 60%, 0.55), 0 8px 30px hsla(165, 90%, 50%, 0.35), 0 0 64px hsla(270, 85%, 65%, 0.4)";

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
  /** 승급 진행도 (출석 횟수 + 운동시간 보너스). 있으면 XP 막대 대신 이 막대를 그린다 (2026-09-22) */
  promotion?: {
    /** 예: 2.25 */
    current: number;
    /** 필요 횟수, 예: 3 */
    target: number;
    /** 막대 아래 한 줄 — 가득 차면 무슨 일이 생기는지 */
    hint?: string;
  };
  /** 마스터 (블랙 Lv.10 + 보스 4클리어) */
  isMaster?: boolean;
  /** 마스터 트랙 타이틀 (예: "그랜드 챔피언") — 있으면 isMaster 일 때 "MASTER" 대신 표시 */
  masterTitle?: string;
  /** 운동중 LIVE 인디케이터 (라이브보드용) */
  isLive?: boolean;
  /** "방금 입실" 강조 (라이브보드 fresh) */
  isFresh?: boolean;
  /** 운동 시간 (분, 라이브보드용) */
  elapsedMinutes?: number;
  /** 지도진 카드 (2026-09-22): 리그·레벨·승급 막대 대신 직함("지점장님")을 보인다. name 에는 이름+직함을 넘긴다. */
  staff?: { title: string } | null;
  /** PT(퍼스널 트레이닝) 회원 (2026-09-29) — 이름 옆 파란 배지만. 경험치 2배는 서버(DB 트리거)가 조용히 준다 —
   *  화면에 "경험치 2배" 같은 글은 쓰지 않는다(대표님: 일반 회원님들이 차별로 느낄 수 있다). */
  pt?: boolean;
  /** 받은 하트 수 (2026-09-29) — 있으면 아래 줄 오른쪽에 하트 알약. 없으면 예전처럼 "· OFFICIAL ·" */
  likes?: number;
  /** 내가 이 카드에 하트를 보냈는가 — 알약이 금색으로 꽉 찬다 */
  liked?: boolean;
  /** 하트 알약을 눌렀을 때 (내 카드: 추천 복서 목록 열기 · 다른 회원 카드: 하트 보내기/취소) */
  onLikeClick?: () => void;
  /** 하트 처리 중 — 알약을 잠근다 (연타로 보내기→취소 방지) */
  likeBusy?: boolean;
  /** 카드 전체를 눌렀을 때 (내 카드: 닉네임 바꾸기). 오면 이름 옆에 연필 표시가 붙는다 */
  onCardClick?: () => void;
  /** 승급 진행도 막대를 눌렀을 때 (2026-10-10 — 하단 랭크업 탭 대체: 누르면 랭크업 로드맵).
   *  카드 전체 클릭(onCardClick)과 겹치면 막대 클릭이 우선한다 (stopPropagation). */
  onPromotionClick?: () => void;
  /** 사진을 눌렀을 때 (2026-10-14 대표님 — 내 카드: 프로필 사진 올리기·바꾸기). 오면 사진 모서리에 카메라 표시.
   *  카드 전체 클릭(onCardClick)과 겹치면 사진 클릭이 우선한다 (stopPropagation). */
  onPhotoClick?: () => void;
  /** 사진 올리는 중 — 사진 위에 도는 표시, 다시 누르기 잠금 */
  photoBusy?: boolean;
  /** 사진 위 금색 알약 (2026-10-14 — 처음 올리면 받는 챔피언 머니, 예: "+5,000"). onPhotoClick 이 있을 때만 보인다 */
  photoBadge?: string;
  /** 🎂 오늘 생일 (라이브보드, 2026-10-16) — 오로라 테두리·광채, 이름 옆 황금 버튼, 머리줄 HAPPY BIRTHDAY,
   *  사진 모서리 케이크, (spotlight 이상) 아래 줄 "생일 축하해 주세요". 카드 높이는 그대로 (자동 크기 그리드가 잰다) */
  birthday?: boolean;
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
  promotion,
  isMaster = false,
  masterTitle,
  isLive = false,
  isFresh = false,
  elapsedMinutes,
  staff = null,
  pt = false,
  likes,
  liked = false,
  onLikeClick,
  likeBusy = false,
  onCardClick,
  onPromotionClick,
  onPhotoClick,
  photoBusy = false,
  photoBadge,
  birthday: birthdayProp = false,
}: BoxerLicenseCardProps) => {
  // 지도진 카드에는 생일 연출을 하지 않는다 (회원 카드 전용)
  const birthday = birthdayProp && !staff;
  const rankKey = (league || "white").toLowerCase();
  const lic = licenseNumber(userId);
  const issuedFmt = formatIssueDate(issueDate);
  const rankLabelKR = isMaster ? "마스터" : RANK_LABELS_KR[rankKey] ?? rankKey;
  const rankLabelEN = isMaster ? (masterTitle || "MASTER") : (RANK_LABELS[rankKey] ?? rankKey.toUpperCase());
  const accentText = isMaster ? "text-yellow-300" : RANK_ACCENT_TEXT[rankKey] ?? "text-gray-300";
  const borderGrad = isMaster ? RANK_BORDER.black : RANK_BORDER[rankKey] ?? RANK_BORDER.white;
  const bgGrad = isMaster ? RANK_BG.black : RANK_BG[rankKey] ?? RANK_BG.white;
  // 막대 — promotion(승급 진행도)이 오면 그것, 아니면 예전 XP 막대.
  // 숫자는 한 자리 내림(2.96 → 2.9): 판정이 floor 라 "가득 찼는데 왜 안 올라가요" 를 만들지 않는다.
  const bar = promotion
    ? {
        show: promotion.target > 0,
        label: "승급 진행도",
        value: `${(Math.floor(promotion.current * 10) / 10).toLocaleString()} / ${promotion.target}회`,
        ratio: promotion.target > 0 ? promotion.current / promotion.target : 0,
      }
    : {
        show: totalXp !== undefined && xpToNext !== undefined && xpToNext > 0,
        label: "XP",
        value: `${(totalXp ?? 0).toLocaleString()} / ${(xpToNext ?? 0).toLocaleString()}`,
        ratio: xpToNext ? (totalXp ?? 0) / xpToNext : 0,
      };

  // ── 사이즈별 dimensions ──
  const cfg = (() => {
    switch (size) {
      case "hero":
        return {
          padding: "p-4",
          headerText: "text-[9px]",
          photoBox: "h-28 w-28",
          nameText: "text-2xl",
          ptBadge: "h-5 w-5",
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
          ptBadge: "h-4 w-4",
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
          ptBadge: "h-3 w-3",
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
      whileTap={onCardClick ? { scale: 0.985 } : undefined}
      onClick={onCardClick}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCardClick();
              }
            }
          : undefined
      }
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      aria-label={onCardClick ? `${name} 라이센스 — 눌러서 닉네임 바꾸기` : undefined}
      className={`relative w-full overflow-hidden rounded-2xl ${cfg.padding} ${
        onCardClick ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/70" : ""
      }`}
      style={{
        background: `linear-gradient(135deg, hsla(0, 0%, 6%, 0.97) 0%, hsla(0, 0%, 10%, 0.95) 100%)`,
        boxShadow: birthday
          ? BIRTHDAY_GLOW
          : isFresh
            ? "0 8px 24px hsla(160, 80%, 50%, 0.4), 0 0 0 2px hsla(160, 80%, 50%, 0.6)"
            : CARD_GLOW[isMaster ? "black" : rankKey] ?? CARD_GLOW.white,
      }}
    >
      {/* ── 골드 트림 (얇은 외곽 그라디언트 라인) — 생일이면 흐르는 오로라 테두리 ── */}
      <div
        className={`absolute inset-0 rounded-2xl ${birthday ? "bday-aurora-ring" : `bg-gradient-to-br ${borderGrad} opacity-50`}`}
        style={{ padding: birthday ? "2px" : "1.5px", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
        aria-hidden="true"
      />

      {/* ── 배경 그라디언트 — 생일이면 오로라 빛이 은은하게 ── */}
      <div
        className={`absolute inset-[2px] rounded-2xl bg-gradient-to-br ${birthday ? "from-gray-900 via-emerald-950/50 to-violet-950/50" : bgGrad}`}
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
          {/* 생일 — 왼쪽은 사진 위 케이크 자리라 비우고, 오른쪽(번호 자리)에 금빛 HAPPY BIRTHDAY */}
          <div className="flex items-center gap-1.5">
            {!birthday && (
              <span className={`font-black uppercase tracking-[0.2em] ${cfg.headerText} ${accentText}`}>
                {staff ? "153 COACHING STAFF" : isMaster ? "★ MASTER LICENSE" : "153 BOXER LICENSE"}
              </span>
            )}
          </div>
          {birthday ? (
            // 번호와 같은 글자 크기 — 머리줄 높이가 그대로라 카드 키가 같다
            <span className={`bday-gold-text font-black uppercase tracking-[0.2em] ${cfg.licText}`}>
              ✦ HAPPY BIRTHDAY ✦
            </span>
          ) : (
            <span className={`font-mono font-black ${cfg.licText} text-gray-400 tabular-nums`}>
              #{lic}
            </span>
          )}
        </div>

        {/* ── 본문: 사진 + 정보 (가로) ── */}
        <div className="flex items-start gap-3">
          {/* 사진 frame — onPhotoClick 이 오면 사진만 따로 버튼 (카드 클릭·눌림 효과로 번지지 않게 막는다) */}
          <div
            className={`relative flex-shrink-0 ${onPhotoClick ? "cursor-pointer rounded-xl transition-transform active:scale-95" : ""}`}
            role={onPhotoClick ? "button" : undefined}
            tabIndex={onPhotoClick ? 0 : undefined}
            aria-label={
              onPhotoClick
                ? photoBadge
                  ? `프로필 사진 올리기·바꾸기 (처음 올리면 챔피언 머니 ${photoBadge})`
                  : "프로필 사진 올리기·바꾸기"
                : undefined
            }
            aria-busy={onPhotoClick ? photoBusy : undefined}
            onPointerDown={onPhotoClick ? (e) => e.stopPropagation() : undefined}
            onClick={
              onPhotoClick
                ? (e) => {
                    e.stopPropagation();
                    if (!photoBusy) onPhotoClick();
                  }
                : undefined
            }
            onKeyDown={
              onPhotoClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!photoBusy) onPhotoClick();
                    }
                  }
                : undefined
            }
          >
            {/* 🎂 생일 — 사진 뒤로 오로라 빛무리가 천천히 돈다 (캐릭터 효과 '오로라'와 같은 그림) */}
            {birthday && (
              <img
                src={fxAurora}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="bday-halo pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{ width: "185%", height: "185%", marginLeft: "-92.5%", marginTop: "-92.5%", mixBlendMode: "screen", opacity: 0.95 }}
              />
            )}

            {/* 사진 frame + 회전 aurora ring (리그별 강도) */}
            <div
              className={`${cfg.photoBox} relative flex items-center justify-center rounded-xl`}
            >
              {/* 외곽 회전 aurora — 리그별 conic-gradient (등급↑ 빠르게). 생일이면 오로라 색 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: birthday ? 5 : AURORA_SPEED[isMaster ? "black" : rankKey] ?? AURORA_SPEED.white,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute inset-0 rounded-xl"
                style={{
                  background: birthday ? BIRTHDAY_RING : AURORA_RING[isMaster ? "black" : rankKey] ?? AURORA_RING.white,
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

            {/* 올리는 중 — 사진 위를 어둡게 덮고 돈다 */}
            {onPhotoClick && photoBusy && (
              <div className="absolute inset-[3px] z-30 flex items-center justify-center rounded-[10px] bg-black/55" aria-hidden="true">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/90 border-t-transparent" />
              </div>
            )}
            {/* 카메라 표시 — 누르면 사진을 바꿀 수 있다는 신호 (내정보 사진의 카메라 버튼과 같은 모양) */}
            {onPhotoClick && !photoBusy && (
              <span
                className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-black/70"
                aria-hidden="true"
              >
                <Camera className="h-3.5 w-3.5" />
              </span>
            )}

            {/* 처음 올리면 받는 보상 — 금색 알약 (보상은 금색 · 브랜드 규칙) */}
            {onPhotoClick && !photoBusy && photoBadge && (
              <span
                className="pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-reward px-2 py-0.5 text-[10px] font-black text-reward-foreground shadow-md ring-2 ring-black/60"
                aria-hidden="true"
              >
                🎁 {photoBadge}
              </span>
            )}

            {/* 🎂 생일 케이크 — 사진 오른쪽 위 모서리에 살짝 흔들리며 */}
            {birthday && (
              <img
                src={birthdayCake}
                alt="오늘 생일"
                draggable={false}
                className="bday-bob pointer-events-none absolute -right-3 -top-3.5 z-30 w-[58%] select-none"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}
              />
            )}

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
            {/* 이름은 길면 말줄임, 리그 버튼은 항상 보인다 */}
            <div className="flex min-w-0 items-center gap-1">
              <p className={`min-w-0 truncate font-black text-white ${cfg.nameText}`}>
                {name}
              </p>
              {/* 리그 버튼 (2026-10-15 대표님) — 모든 회원, 색 = 내 리그 (화이트·블루·레드·골드). PT 전용 배지는 없앰.
                  지도진(코치님)은 '챔피언' 표기라 버튼 없음 */}
              {/* 생일이면 황금 버튼 (2026-10-16 대표님) — 리그는 아래 'WHITE · 방패 · Lv' 줄에 그대로 보인다 */}
              {!staff && (
                <NameBadge league={rankKey} birthday={birthday} className={`${cfg.ptBadge} shrink-0`} glow={size === "hero" || birthday} />
              )}
              {/* 대회 메달 — 리그 버튼 다음 자리 (2026-10-16 대표님: "이름 옆 버튼, 메달은 그 옆") */}
              <MedalMark userId={userId} className={cfg.nameText} />
              {onCardClick && <PenLine className="ml-0.5 h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />}
            </div>
            {branch && size !== "compact" && (
              <p className={`mt-0.5 truncate text-gray-400 ${cfg.metaText}`}>
                {branch}
              </p>
            )}

            {/* 리그 + 레벨 라인 — 지도진은 회원 리그 대신 챔피언 · Lv.77 (2026-09-23 대표님 지시, 화면 전용) */}
            {staff ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-md font-black uppercase tracking-wider bg-yellow-500 text-gray-900 ${cfg.rankBadge}`}>
                  CHAMPION
                </span>
                <span className={`font-black text-white ${cfg.levelText}`}>Lv.{STAFF_CHAMPION_LEVEL} · {staff.title}</span>
              </div>
            ) : (
            // TV 카드는 'WHITE · 방패 · Lv.10' 을 한 줄로 — 줄이 넘어가면 카드마다 키가 달라졌다 (2026-10-15 대표님)
            <div className={`mt-1.5 flex items-center gap-1.5 ${isLive ? "flex-nowrap whitespace-nowrap" : "flex-wrap"}`}>
              <span
                className={`shrink-0 rounded-md font-black uppercase tracking-wider ${cfg.rankBadge} ${
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
              {/* 리그 방패 — 'WHITE / 방패 / Lv.10' 줄 (2026-10-15 대표님) */}
              <LeagueBadge league={rankKey} className={`${cfg.ptBadge} shrink-0`} />
              <span className={`font-black text-white ${cfg.levelText}`}>
                {/* 누적 레벨 표시 — 마스터 트랙의 전체 레벨(>10)은 그대로, 블랙 10 은 40 */}
                Lv.{toGlobalLevel(rankKey, level)}
              </span>
            </div>
            )}

            {/* 메타 정보 (연속일 / 운동시간) — 지도진은 연속 출석을 세지 않는다 */}
            {!staff && (cfg.showStreak || elapsedMinutes !== undefined) && size !== "compact" && (
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

        {/* ── 승급 진행도 막대 (hero 만) ── promotion 이 오면 그것, 아니면 예전 XP 막대. 지도진은 없음.
             onPromotionClick 이 오면 막대 영역이 버튼 — 누르면 랭크업 로드맵 (하단 탭 대체, 2026-10-10) */}
        {!staff && cfg.showXp && (bar.show) && (
          <div
            className={`mt-3 ${onPromotionClick ? "-m-1.5 cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/5 active:bg-white/10" : ""}`}
            role={onPromotionClick ? "button" : undefined}
            tabIndex={onPromotionClick ? 0 : undefined}
            aria-label={onPromotionClick ? "승급 진행도 — 눌러서 랭크업 로드맵 보기" : undefined}
            onClick={
              onPromotionClick
                ? (e) => {
                    e.stopPropagation();
                    onPromotionClick();
                  }
                : undefined
            }
            onKeyDown={
              onPromotionClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onPromotionClick();
                    }
                  }
                : undefined
            }
          >
            <div className={`flex items-center justify-between text-[10px] ${accentText} mb-1`}>
              <span className="font-black uppercase tracking-wider">
                {bar.label}
                {onPromotionClick && <span className="ml-1.5 font-bold normal-case opacity-80">랭크업 →</span>}
              </span>
              <span className="font-mono font-black tabular-nums">{bar.value}</span>
            </div>
            <div className={`overflow-hidden rounded-full bg-black/40 ${cfg.xpHeight}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, bar.ratio * 100)}%` }}
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
            {promotion?.hint && (
              <div className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${accentText} opacity-80`}>
                <span className="min-w-0 flex-1 truncate">{promotion.hint}</span>
                {totalXp !== undefined && (
                  <span className="shrink-0 font-mono tabular-nums">XP {totalXp.toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer — 153 OFFICIAL 마크 ── */}
        {cfg.showFooter && (
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            {birthday ? (
              // 생일 — 다른 회원님들께 축하를 부탁하는 한 줄 (같은 높이: 이모지 text-base 한 칸)
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-base">🎉</span>
                <span className={`truncate font-black text-amber-200 ${cfg.metaText}`}>오늘 생일이에요 · 축하해 주세요!</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-base">🥊</span>
                <span className={`font-black uppercase tracking-[0.2em] ${cfg.headerText} ${accentText}`}>
                  MY BOXER 153
                </span>
              </div>
            )}
            {likes !== undefined ? (
              // 하트 알약 — 카드 누르기(닉네임 바꾸기)와 겹치지 않게 이벤트를 여기서 멈춘다
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLikeClick?.();
                }}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={!onLikeClick || likeBusy}
                aria-pressed={onLikeClick ? liked : undefined}
                aria-label={liked ? `하트 ${likes}개 · 내가 하트를 보냈어요` : `받은 하트 ${likes}개`}
                className={`-my-1.5 inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 transition-transform active:scale-95 disabled:cursor-default ${
                  liked ? "bg-[#F5C542] text-[#1A1206]" : "bg-white/10 text-white ring-1 ring-inset ring-white/15"
                }`}
              >
                <Heart
                  className={`h-3.5 w-3.5 ${liked ? "fill-current" : "fill-[#F5C542]/25 text-[#F5C542]"} ${likeBusy ? "animate-pulse" : ""}`}
                  aria-hidden="true"
                />
                <span className="text-[12px] font-black tabular-nums">{likes.toLocaleString("ko-KR")}</span>
              </button>
            ) : (
              <span className={`font-mono ${cfg.licText} text-gray-500 uppercase`}>
                · OFFICIAL ·
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BoxerLicenseCard;
