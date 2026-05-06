/**
 * 153 QUEST — 챌린지 아레나: 챌린지 카드 (목록 항목).
 */

import { Flame, ShieldAlert, Timer } from "lucide-react";
import type {
  BoxingFunChallenge,
  QuizDifficulty,
} from "@/services/boxingEngagementService";

const DIFFICULTY_LABEL: Record<QuizDifficulty, string> = {
  beginner: "초급",
  normal: "중급",
  advanced: "고급",
};

const METRIC_UNIT: Record<string, string> = {
  count: "회",
  rounds: "라운드",
  minutes: "분",
  combos: "콤보",
};

export interface FunChallengeCardProps {
  challenge: BoxingFunChallenge;
  onChallenge: (challenge: BoxingFunChallenge) => void;
}

const FunChallengeCard = ({ challenge, onChallenge }: FunChallengeCardProps) => {
  const unit = METRIC_UNIT[challenge.target_metric] ?? "";
  const targets = challenge.difficulty_targets;
  const rewards = challenge.rewards_by_difficulty;

  return (
    <article data-tour="challenge-arena-card" className="rounded-card border border-border bg-card p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="badge-pill bg-primary/10 text-primary text-[10px]">
              {challenge.category}
            </span>
            {challenge.high_intensity && (
              <span className="badge-pill bg-destructive/15 text-destructive text-[10px]">
                <Flame className="h-3 w-3" /> 고강도 · 하루 1회
              </span>
            )}
            {challenge.duration_seconds != null && (
              <span className="badge-pill bg-secondary text-secondary-foreground text-[10px]">
                <Timer className="h-3 w-3" /> {challenge.duration_seconds}초
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-[14px] font-bold text-foreground">
            {challenge.title}
          </h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {challenge.description}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-card border border-border bg-background/40 p-2">
        {(["beginner", "normal", "advanced"] as QuizDifficulty[]).map((d) => {
          const t = targets?.[d];
          const r = rewards?.[d];
          return (
            <div key={d} className="text-center">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                {DIFFICULTY_LABEL[d]}
              </p>
              <p className="number-font mt-0.5 text-[12.5px] font-black text-foreground">
                {t ?? "-"} {unit}
              </p>
              <p className="mt-0.5 text-[9.5px] font-bold text-reward">
                +{r?.quest_xp ?? 0} XP · +{r?.gems ?? 0}
              </p>
            </div>
          );
        })}
      </div>

      {challenge.safety_note && (
        <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-amber-600">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {challenge.safety_note}
        </p>
      )}

      <button
        type="button"
        onClick={() => onChallenge(challenge)}
        className="mt-2.5 w-full rounded-card bg-primary py-2.5 text-[13px] font-bold text-primary-foreground transition-all active:scale-[0.99]"
      >
        도전하기
      </button>
    </article>
  );
};

export default FunChallengeCard;
