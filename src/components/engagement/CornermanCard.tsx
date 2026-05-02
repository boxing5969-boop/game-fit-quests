/**
 * 153 QUEST v2 19단계 — 코너맨 진입 카드 (Home/MyPage).
 *
 * 상태별 표시:
 *   · active: 파트너 이름 + 오늘 활동 상태
 *   · pending received: "수락 대기 중인 요청 N개"
 *   · pending sent: "보낸 요청 응답 대기 중"
 *   · 없음: "코너맨 찾기"
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 카드 클릭은 시트 열기만, 보상 처리 0
 */

import { Users } from "lucide-react";

import { useMyCornermanStatus } from "@/hooks/useCornerman";
import { CORNERMAN_COPY } from "@/data/cornermanMessages";

interface Props {
  onOpen: () => void;
}

const CornermanCard = ({ onOpen }: Props) => {
  const { data: status, isLoading } = useMyCornermanStatus();

  const hasActive = status?.has_active === true;
  const pendingReceivedCount = status?.pending_received.length ?? 0;
  const pendingSentCount = status?.pending_sent.length ?? 0;

  let badgeText: string | null = null;
  let badgeTone: "primary" | "warn" = "primary";
  if (hasActive && status?.today?.both_completed && !status.today.bonus_claimed) {
    badgeText = "보너스 열림";
    badgeTone = "primary";
  } else if (pendingReceivedCount > 0) {
    badgeText = `요청 ${pendingReceivedCount}건 대기`;
    badgeTone = "warn";
  }

  let title: string;
  let subtitle: string;
  if (isLoading) {
    title = "코너맨";
    subtitle = "정보를 불러오는 중…";
  } else if (hasActive) {
    title = `🥊 ${status?.partner_name ?? "코너맨"}`;
    if (status?.today?.bonus_claimed) {
      subtitle = "오늘 보너스 받음";
    } else if (status?.today?.both_completed) {
      subtitle = CORNERMAN_COPY.bothCompletedHint;
    } else if (status?.today?.my_completed || status?.today?.partner_completed) {
      subtitle = CORNERMAN_COPY.oneCompletedHint;
    } else {
      subtitle = CORNERMAN_COPY.noneCompletedHint;
    }
  } else if (pendingReceivedCount > 0) {
    title = "코너맨 요청 도착";
    subtitle = CORNERMAN_COPY.pendingReceivedHint;
  } else if (pendingSentCount > 0) {
    title = "수락 대기 중";
    subtitle = CORNERMAN_COPY.pendingSentHint;
  } else {
    title = CORNERMAN_COPY.cardHeadline;
    subtitle = CORNERMAN_COPY.cardSub;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
      aria-label="코너맨 매칭 열기"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Users className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
          코너맨 · 함께 가는 라운드
        </p>
        <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {badgeText && (
        <div className="shrink-0 text-right">
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${
              badgeTone === "warn" ? "text-amber-600" : "text-reward"
            }`}
          >
            {badgeText}
          </p>
        </div>
      )}
      <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
        열기 →
      </span>
    </button>
  );
};

export default CornermanCard;
