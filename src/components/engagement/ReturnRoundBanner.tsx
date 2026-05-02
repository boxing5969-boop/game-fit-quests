/**
 * 153 QUEST v1.5 15단계 — 리턴 라운드 진입 배너 (홈 상단).
 *
 * status.active === true 일 때만 표시. on_cooldown 인 경우 톤 다운.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 보상 amount 처리 0 — 클릭 시 시트 열기만
 */

import { Sparkles } from "lucide-react";

import { useReturnRoundStatus } from "@/hooks/useReturnRound";
import { getReturnRoundCopy } from "@/data/returnRoundMessages";

interface Props {
  onOpen: () => void;
}

const ReturnRoundBanner = ({ onOpen }: Props) => {
  const { data: status } = useReturnRoundStatus();

  if (!status?.active || !status.return_type) return null;

  const copy = getReturnRoundCopy(status.return_type);
  if (!copy) return null;

  const claimed = status.already_claimed_today === true;
  const cooldown = status.on_cooldown === true && !claimed;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card border border-primary/30 bg-gradient-to-r from-primary/10 to-reward/10 px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/50"
      aria-label="리턴 라운드 열기"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
          리턴 라운드 · {status.inactive_days}일 만의 복귀
        </p>
        <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
          {copy.bannerHeadline}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {claimed
            ? "오늘 보상은 이미 받았습니다. 기록은 계속 쌓입니다."
            : cooldown
              ? "이번 복귀 보상은 다음 주기에 다시 열립니다."
              : copy.bannerSub}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
          보상
        </p>
        <p className="mt-0.5 text-[10px] font-bold text-reward">
          {claimed || cooldown ? "—" : copy.rewardLine.replace(/QUEST XP /, "")}
        </p>
      </div>
      <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
        열기 →
      </span>
    </button>
  );
};

export default ReturnRoundBanner;
