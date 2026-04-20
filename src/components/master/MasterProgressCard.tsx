import { Swords, Trophy, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import { MasterTrackBadge } from "./MasterTrackBadge";
import { MasterRewardStack } from "./MasterRewardStack";
import {
  MASTER_BOSS_LEVELS,
  getMasterLevelDefinition,
} from "@/data/masterTierData";

interface MasterProgressCardProps {
  masterLevel: number;
  className?: string;
}

/**
 * Compact HomePage card shown when master_track_unlocked=true.
 *
 *   ┌──────────────────────────────────────────┐
 *   │  MASTER Lv.45      [진행도 4/10]         │
 *   │  [progress ▓▓▓▓▓▓▓░░░]                   │
 *   │  다음 보스 Lv.50 제1방어전               │
 *   │  [gem +3000] [title] [frame] [aura]      │
 *   │  ▶ 마스터 맵 보기                        │
 *   └──────────────────────────────────────────┘
 *
 * For Lv99 grand champions, the card celebrates rather than pointing
 * toward a next boss.
 */
export const MasterProgressCard = ({
  masterLevel,
  className,
}: MasterProgressCardProps) => {
  const navigate = useNavigate();
  const currentDef = getMasterLevelDefinition(masterLevel);
  const overall = 40 + masterLevel;
  const isGrand = masterLevel >= 59;

  // Next boss milestone (strictly greater than current).
  const nextBoss = MASTER_BOSS_LEVELS.find((n) => n > masterLevel);
  const nextBossDef = nextBoss ? getMasterLevelDefinition(nextBoss) : null;

  // Progress toward next boss (step 0..10 within current "dan").
  // If at boss level already, progress is full.
  const stepsIntoDan = masterLevel % 10 === 0 ? 10 : masterLevel % 10;
  const danTarget = nextBoss ? nextBoss - Math.floor((nextBoss - 1) / 10) * 10 : 10;
  const progressPct = isGrand
    ? 100
    : Math.min(100, Math.round((stepsIntoDan / Math.max(1, danTarget)) * 100));

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-reward/30 bg-gradient-to-br from-[hsl(42_92%_12%)] via-card to-card p-4 shadow-glow-soft",
        className,
      )}
    >
      {/* Decorative rays — GPU friendly */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-reward/15 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <MasterTrackBadge overallLevel={overall} />
          <h2 className="mt-2 truncate text-[15px] font-bold text-foreground">
            {currentDef?.title ?? `마스터 Lv.${masterLevel}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate("/master-track")}
          aria-label="마스터 맵 열기"
          className="flex h-9 items-center gap-1 rounded-full bg-reward/15 px-3 text-[11px] font-bold text-reward transition-colors hover:bg-reward/25"
        >
          맵 보기
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isGrand
              ? "bg-gradient-to-r from-[hsl(42_100%_58%)] via-[hsl(320_80%_60%)] to-[hsl(200_90%_60%)]"
              : "bg-gradient-to-r from-primary to-reward",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="relative mt-2.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {isGrand ? (
            <span className="inline-flex items-center gap-1 text-reward">
              <Trophy className="h-3.5 w-3.5" /> 그랜드 챔피언 달성
            </span>
          ) : nextBossDef ? (
            <span className="inline-flex items-center gap-1">
              <Swords className="h-3 w-3 text-primary" />
              다음 보스 Lv.{nextBossDef.overallLevel} · {nextBossDef.title}
            </span>
          ) : (
            "진행 중"
          )}
        </span>
        <span className="number-font font-bold text-foreground/80">
          {stepsIntoDan}/{danTarget}
        </span>
      </div>

      {/* Upcoming reward preview */}
      {nextBossDef && !isGrand && (
        <div className="relative mt-3 border-t border-reward/20 pt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            다음 보스 보상
          </p>
          <MasterRewardStack def={nextBossDef} />
        </div>
      )}
    </article>
  );
};

export default MasterProgressCard;
