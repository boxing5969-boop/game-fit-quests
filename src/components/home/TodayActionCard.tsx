/**
 * 마이복서153 — 홈 화면 우선순위 액션 카드.
 *
 * 사용자 상태에 따라 자동으로 변형:
 *   1. 미체크인        → QR 체크인 하기 (+XP)
 *   2. 체크인 + 미시작  → 오늘의 미션 시작
 *   3. 활동 세션 진행중  → 운동 중 N분째 (탭하면 challenge UI 열림)
 *   4. 활동 종료, 미션 미완료 → 오늘 활동 평가 (혹은 다음 행동)
 *   5. 모든 미션 완료   → 오늘 잘 해냈어요 (회고/명예의 전당)
 *
 * 디자인:
 *   · 큰 카드 — 첫 화면에서 가장 눈에 띄어야 함
 *   · 1초 안에 "오늘 뭐 해야 하지?" 답이 보이도록
 *   · 보상 텍스트 + 강한 CTA
 */

import { motion } from "framer-motion";
import { QrCode, Zap, Clock, Trophy, Sparkles, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type TodayActionState =
  | "qr_checkin"      // 미체크인
  | "start_mission"   // 체크인 후, 미션 시작 가능
  | "active_session"  // 활동 중
  | "evaluate"        // 활동 종료, 미션 미완료
  | "all_done";       // 모든 미션 완료

export interface TodayActionCardProps {
  state: TodayActionState;
  /** 활동 세션 진행 시간 (분, "active_session" 만 사용) */
  activeMinutes?: number;
  /** 연속 출석일 (체크인 후 표시) */
  streakDays?: number;
  onClick: () => void;
}

interface ActionConfig {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaBg: string;
  glow: string;
}

const TodayActionCard = ({
  state,
  activeMinutes = 0,
  streakDays = 0,
  onClick,
}: TodayActionCardProps) => {
  const config: ActionConfig = (() => {
    switch (state) {
      case "qr_checkin":
        return {
          icon: <QrCode className="h-7 w-7" />,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
          badge: "오늘의 시작",
          badgeColor: "bg-primary/20 text-primary",
          title: "QR 체크인 하기",
          subtitle: "출석 + 오늘 도전이 한 번에 시작돼요",
          cta: "+10 XP",
          ctaBg: "bg-gradient-to-r from-primary to-primary/80",
          glow: "rgba(246, 196, 83, 0.35)",
        };
      case "start_mission":
        return {
          icon: <Zap className="h-7 w-7" />,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-400",
          badge: streakDays > 0 ? `${streakDays}일 연속 ✓` : "체크인 완료",
          badgeColor: "bg-emerald-500/20 text-emerald-400",
          title: "오늘의 미션 시작",
          subtitle: "체력 쌓는 가장 빠른 길이에요",
          cta: "+ XP 보너스",
          ctaBg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
          glow: "rgba(34, 197, 94, 0.35)",
        };
      case "active_session":
        return {
          icon: <Clock className="h-7 w-7" />,
          iconBg: "bg-orange-500/15",
          iconColor: "text-orange-400",
          badge: "🥊 LIVE",
          badgeColor: "bg-orange-500 text-white animate-pulse",
          title: `운동 중 — ${activeMinutes}분째`,
          subtitle: "라이브 보드에 표시되고 있어요",
          cta: "이어하기",
          ctaBg: "bg-gradient-to-r from-orange-500 to-red-500",
          glow: "rgba(249, 115, 22, 0.45)",
        };
      case "evaluate":
        return {
          icon: <Sparkles className="h-7 w-7" />,
          iconBg: "bg-purple-500/15",
          iconColor: "text-purple-400",
          badge: "오늘의 마무리",
          badgeColor: "bg-purple-500/20 text-purple-300",
          title: "오늘 활동 평가",
          subtitle: "수고했어요. 잠깐 회고하면 더 빠르게 성장해요",
          cta: "기록 보기",
          ctaBg: "bg-gradient-to-r from-purple-500 to-pink-500",
          glow: "rgba(168, 85, 247, 0.35)",
        };
      case "all_done":
        return {
          icon: <Trophy className="h-7 w-7" />,
          iconBg: "bg-yellow-500/15",
          iconColor: "text-yellow-400",
          badge: "오늘 모두 완료",
          badgeColor: "bg-yellow-500/20 text-yellow-300",
          title: "오늘 잘 해냈어요",
          subtitle: "내일 또 만나요. 명예의 전당도 둘러볼까요?",
          cta: "전당 보기",
          ctaBg: "bg-gradient-to-r from-yellow-400 to-orange-400",
          glow: "rgba(234, 179, 8, 0.35)",
        };
    }
  })();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      data-tutorial-target={
        state === "qr_checkin" ? "qr-checkin-button" : undefined
      }
      data-tour={state === "qr_checkin" ? "home-qr-checkin" : undefined}
      className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900 to-black p-5 text-left transition-all hover:border-white/20"
      style={{
        boxShadow: `0 8px 32px ${config.glow}, 0 0 0 1px ${config.glow}`,
      }}
    >
      {/* 배경 글로우 (hover/idle 펄스) */}
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: config.glow }}
        aria-hidden="true"
      />

      <div className="relative">
        {/* Top row — badge + CTA pill */}
        <div className="flex items-center justify-between">
          <span
            className={`rounded-pill px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${config.badgeColor}`}
          >
            {config.badge}
          </span>
          <span
            className={`rounded-pill ${config.ctaBg} px-3 py-1 text-[11px] font-black text-white shadow-lg`}
          >
            {config.cta}
          </span>
        </div>

        {/* Main content row */}
        <div className="mt-4 flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.iconBg} ${config.iconColor}`}
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-black text-white">{config.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
              {config.subtitle}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-500 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </motion.button>
  );
};

export default TodayActionCard;
