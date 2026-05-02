/**
 * 153 QUEST v2 21단계 — 짐 레이드 진행 라인 (시트 안에서 사용).
 *
 * raid 한 개의 진척바 + 내 기여도 + 보상 정보 표시.
 */

import { CheckCircle2, Trophy } from "lucide-react";

import {
  getRaidTypeEmoji,
  getRaidTypeLabel,
} from "@/data/gymRaidMessages";
import type { GymRaidRow } from "@/services/boxingEngagementService";

export interface GymRaidContributionListProps {
  raid: GymRaidRow;
  onClaim: (raidId: string) => void;
  claimPending: boolean;
}

const GymRaidContributionList = ({
  raid,
  onClaim,
  claimPending,
}: GymRaidContributionListProps) => {
  const completed = raid.status === "completed";
  const canClaim = completed && !raid.reward_claimed && raid.my_contribution > 0;

  return (
    <div className="rounded-card border border-border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="text-[20px]">{getRaidTypeEmoji(raid.raid_type)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-foreground">{raid.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {raid.description}
          </p>
        </div>
        {completed && (
          <span className="badge-pill bg-emerald-400/15 text-emerald-700">
            <Trophy className="mr-0.5 inline h-3 w-3" />
            달성
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{getRaidTypeLabel(raid.raid_type)}</span>
          <span>
            {Math.round(raid.current_value).toLocaleString()} /{" "}
            {Math.round(raid.target_value).toLocaleString()} ·{" "}
            <strong className="text-foreground">{raid.percentage}%</strong>
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${
              completed ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(100, raid.percentage)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="text-[9.5px] uppercase text-muted-foreground">
            내 기여
          </p>
          <p className="number-font mt-0.5 text-[14px] font-black text-foreground">
            {raid.my_contribution}회
          </p>
        </div>
        <div className="rounded-card border border-reward/15 bg-reward/5 px-3 py-2">
          <p className="text-[9.5px] uppercase text-reward">보상</p>
          <p className="mt-0.5 text-[11.5px] font-bold text-reward">
            {raid.reward_quest_xp > 0 && `+${raid.reward_quest_xp} XP `}
            {raid.reward_gems > 0 && `· +${raid.reward_gems} GEM `}
            {raid.reward_respect > 0 && `· +${raid.reward_respect} RP`}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[10.5px] text-muted-foreground">
        {new Date(raid.start_date).toLocaleDateString("ko-KR")} ~{" "}
        {new Date(raid.end_date).toLocaleDateString("ko-KR")}
      </p>

      {completed && (
        <button
          type="button"
          onClick={() => onClaim(raid.id)}
          disabled={!canClaim || claimPending}
          className={`mt-3 w-full rounded-card py-2.5 text-[12.5px] font-bold transition-all ${
            canClaim && !claimPending
              ? "bg-primary text-primary-foreground active:scale-[0.98]"
              : "cursor-not-allowed bg-primary/40 text-primary-foreground opacity-60"
          }`}
        >
          {claimPending
            ? "보상 처리 중…"
            : raid.reward_claimed
              ? "보상 받음"
              : raid.my_contribution > 0
                ? "보상 받기"
                : "기여 기록 없음"}
        </button>
      )}

      {raid.reward_claimed && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          보상 받음
        </p>
      )}
    </div>
  );
};

export default GymRaidContributionList;
