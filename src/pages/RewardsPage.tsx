import { useNavigate } from "react-router-dom";
import { User, Crown, Trophy, Flame, Medal } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useBadges, useMyBadges, useXpLogs } from "@/hooks/useQuestData";
import { isManagerRole } from "@/lib/rankLabels";
import { RANK_LABELS } from "@/data/sharedConstants";
import { cn } from "@/lib/utils";

import RankBadge from "@/components/RankBadge";
import type { Enums } from "@/integrations/supabase/types";
import {
  EarnedBadgeGrid,
  LockedBadgeGrid,
  LevelUpHistory,
  RecentXpList,
} from "@/components/shared/BadgeGrid";

import {
  AppPage,
  PageHeader,
  XPBar,
  StatCard,
} from "@/components/ui/rankingup";

/* Spec: rgba(246, 196, 83, 0.45) border + rgba(246, 196, 83, 0.24) glow */
const REWARD_HERO_STYLE: React.CSSProperties = {
  borderColor: "rgba(246, 196, 83, 0.45)",
  boxShadow: "0 0 28px rgba(246, 196, 83, 0.24)",
};

const RewardsPage = () => {
  const navigate = useNavigate();
  const { progress, role } = useAuth();
  const { data: allBadges, isLoading: badgesLoading } = useBadges();
  const { data: myBadges } = useMyBadges();
  const { data: xpLogs } = useXpLogs(30);

  const earnedIds = new Set((myBadges || []).map((mb) => mb.badge_id));
  const earned = (allBadges || []).filter((b) => earnedIds.has(b.id));
  const locked = (allBadges || []).filter((b) => !earnedIds.has(b.id));

  const isMaster40 =
    !!progress &&
    progress.current_rank === "black" &&
    progress.current_level === 10 &&
    progress.bosses_cleared >= 4;

  const levelUpLogs = (xpLogs || []).filter(
    (l) => l.reason.includes("클리어") || l.reason.includes("타이틀매치"),
  );

  // XP progression to next level
  const xpToNext = progress
    ? getXpToNext(progress.current_level, progress.current_rank)
    : 0;
  const xpRemaining = progress ? Math.max(0, xpToNext - progress.total_xp) : 0;
  const xpPct = progress && xpToNext > 0 ? (progress.total_xp / xpToNext) * 100 : 0;
  const nearPromotion = progress && !isMaster40 && xpPct >= 90;

  const isBlackMaxed =
    progress?.current_rank === "black" && progress.current_level === 10;
  const nextRankLabel = isBlackMaxed
    ? "마스터"
    : progress
      ? getNextRankLabel(progress.current_rank, progress.current_level)
      : "";

  return (
    <AppPage
      header={
        <PageHeader
          title="보상"
          subtitle="성취를 수집하고 다음 보상을 준비하세요"
          rightAction={
            <button
              onClick={() => navigate("/mypage")}
              aria-label="내 정보"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
            >
              <User className="h-4 w-4 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-5">
        {/* ─── Master-40 Hero Reward + final missions ─── */}
        {isMaster40 && (
          <div className="animate-bounce-in space-y-4">
            <section
              className="relative overflow-hidden rounded-hero border bg-card p-6 text-center"
              style={REWARD_HERO_STYLE}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reward/15 blur-3xl" />
              </div>
              <div className="relative flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-reward/20">
                  <Crown className="h-8 w-8 text-reward" />
                </div>
                <h2 className="text-[24px] font-extrabold leading-tight text-foreground">
                  마스터 리그 달성
                </h2>
                <p className="text-body-sm text-muted-foreground">
                  블랙 리그 Lv.10 + 모든 타이틀매치 클리어
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-pill border border-reward/50 bg-reward/10 px-3 py-0.5 text-caption font-bold text-reward">
                  👑 153명예코치
                </span>
              </div>
            </section>

            {/* 최종 미션 */}
            <section className="surface-card">
              <h3 className="mb-4 text-body-lg font-bold text-foreground">
                마스터 리그 최종 미션
              </h3>
              <div className="space-y-3">
                <FinalMissionRow
                  number={1}
                  title="한국복싱협회 단증 심사관"
                  description="한국복싱협회 공인 단증 심사관이 되세요"
                  tone="reward"
                />
                <FinalMissionRow
                  number={2}
                  title="정식 코치 자격증 취득"
                  description="한국복싱코치협회 인증 정식 코치 자격증을 취득하세요"
                  tone="reward"
                />
              </div>
            </section>
          </div>
        )}

        {/* ─── Current league + XP card ─── */}
        {progress && (
          <section
            className={cn(
              "rounded-card border border-border bg-card p-5",
              nearPromotion ? "shadow-glow-reward" : "shadow-elev-1",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-muted-foreground">현재 리그</p>
                <div className="mt-1">
                  <RankBadge
                    rank={progress.current_rank as Enums<"rank_name">}
                    level={progress.current_level}
                    size="lg"
                    isMaster={isManagerRole(role)}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-caption text-muted-foreground">총 XP</p>
                <p className="number-font text-display-md leading-none text-foreground">
                  {progress.total_xp.toLocaleString()}
                </p>
              </div>
            </div>

            {/* XP progress to next promotion */}
            {!isMaster40 && (
              <div className="mt-4">
                <XPBar
                  current={progress.total_xp}
                  max={xpToNext}
                  label={
                    isBlackMaxed
                      ? "마스터 승급 조건"
                      : `${nextRankLabel}까지`
                  }
                  variant={nearPromotion ? "reward" : "primary"}
                  showNumbers
                />
                <p
                  className={cn(
                    "mt-2 text-caption font-bold",
                    nearPromotion ? "text-reward" : "text-muted-foreground",
                  )}
                >
                  {xpRemaining > 0 ? (
                    <>
                      {nextRankLabel}까지{" "}
                      <span className="number-font">
                        {xpRemaining.toLocaleString()}
                      </span>{" "}
                      XP
                    </>
                  ) : (
                    "승급 조건 충족"
                  )}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ─── Stat tiles ─── */}
        {progress && (
          <div className="grid grid-cols-3 gap-2 animate-slide-up">
            <StatCard
              label="연속 출석"
              value={`${progress.streak_days}일`}
              accent="reward"
              icon={<Flame className="h-5 w-5" />}
            />
            <StatCard
              label="보스 클리어"
              value={`${progress.bosses_cleared}회`}
              accent="primary"
              icon={<Trophy className="h-5 w-5" />}
            />
            <StatCard
              label="배지"
              value={`${earned.length}개`}
              accent="accent"
              icon={<Medal className="h-5 w-5" />}
            />
          </div>
        )}

        {/* ─── Earned badges ─── */}
        <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 text-body-lg font-bold text-foreground">
            획득한 배지
          </h2>
          <EarnedBadgeGrid badges={earned} loading={badgesLoading} />
        </section>

        {/* ─── Locked badges ─── */}
        {locked.length > 0 && (
          <section
            className="animate-slide-up"
            style={{ animationDelay: "0.15s" }}
          >
            <h2 className="mb-3 text-body-lg font-bold text-muted-foreground">
              미획득
            </h2>
            <LockedBadgeGrid badges={locked} />
          </section>
        )}

        {/* ─── Level-up history ─── */}
        {levelUpLogs.length > 0 && (
          <section
            className="animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h2 className="mb-3 text-body-lg font-bold text-foreground">
              레벨업 기록
            </h2>
            <LevelUpHistory logs={levelUpLogs} />
          </section>
        )}

        {/* ─── Recent XP ─── */}
        {xpLogs && xpLogs.length > 0 && (
          <section
            className="animate-slide-up"
            style={{ animationDelay: "0.25s" }}
          >
            <h2 className="mb-3 text-body-lg font-bold text-foreground">
              최근 XP 획득
            </h2>
            <RecentXpList logs={xpLogs} />
          </section>
        )}
      </div>
    </AppPage>
  );
};

/* ──────────────────────────────────────────────────────────
 *  Final mission row — numbered pill per reward tone.
 *    primary → 일반 XP     (primary-light ember tint)
 *    reward  → 마스터/칭호  (gold)
 *    success → 완료        (#22C55E)
 * ────────────────────────────────────────────────────────── */

type RewardTone = "primary" | "reward" | "success";

const ROW_TONE: Record<RewardTone, { number: string; bg: string }> = {
  primary: {
    number: "bg-[#FF6A3D] text-[#0B0F17]",
    bg: "bg-gradient-to-r from-primary/5 to-[#FF6A3D]/5 border-primary/20",
  },
  reward: {
    number: "bg-reward text-reward-foreground",
    bg: "bg-gradient-to-r from-reward/5 to-primary/5 border-reward/30",
  },
  success: {
    number: "bg-[#22C55E] text-[#0B0F17]",
    bg: "bg-[#22C55E]/5 border-[#22C55E]/30",
  },
};

const FinalMissionRow = ({
  number,
  title,
  description,
  tone,
  complete = false,
}: {
  number: number;
  title: string;
  description: string;
  tone: RewardTone;
  complete?: boolean;
}) => {
  const t = complete ? ROW_TONE.success : ROW_TONE[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-card border p-4",
        t.bg,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill number-font text-caption font-bold",
          t.number,
        )}
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-caption text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────── */

function getXpToNext(level: number, rank: string): number {
  const rankIdx = ["white", "blue", "red", "black"].indexOf(rank);
  return ((rankIdx * 10 + level) + 1) * 50;
}

function getNextRankLabel(rank: string, level: number): string {
  // Next level within the same league
  if (level < 10) return `Lv.${level + 1}`;
  // End of league → next league label
  const rankIdx = ["white", "blue", "red", "black"].indexOf(rank);
  if (rankIdx === -1 || rankIdx >= 3) return "마스터";
  const nextRank = ["white", "blue", "red", "black"][rankIdx + 1];
  return `${RANK_LABELS[nextRank] || nextRank} 리그`;
}

export default RewardsPage;
