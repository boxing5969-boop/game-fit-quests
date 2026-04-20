import { useState, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { User, Settings2, X, Trophy, Crown } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  useDivisionRanking,
  useWeeklyActivityRanking,
  useMonthlyRisers,
  useStreakRanking,
  useBossConquerors,
  useSetRival,
} from "@/hooks/useRankingData";
import { supabase } from "@/integrations/supabase/client";
import { isHallOfFameMember, HALL_OF_FAME_DESCRIPTION } from "@/lib/rankLabels";
import { cn } from "@/lib/utils";

import {
  AppPage,
  PageHeader,
  SegmentedControl,
  FilterChips,
  RankingItem,
  EmptyState,
} from "@/components/ui/rankingup";

type TopTab = "ranking" | "halloffame";
type RankingTabKey = "weekly" | "streak" | "official" | "monthly" | "boss";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

const RANKING_FILTERS: { value: RankingTabKey; label: string }[] = [
  { value: "weekly", label: "이번 주" },
  { value: "streak", label: "출석" },
  { value: "official", label: "XP" },
  { value: "monthly", label: "상승" },
  { value: "boss", label: "보상" },
];

// Podium tones — spec: 1위 #F6C453, 2위 #C9D1DC, 3위 #C8874A
const PODIUM_TONE = {
  gold: {
    border: "border-[#F6C453]",
    bg: "bg-gradient-to-b from-[#F6C453]/15 to-card",
    glow: "shadow-glow-reward",
    rankClass: "text-[#F6C453]",
    pillClass: "bg-[#F6C453]/20 text-[#F6C453]",
    ring: "ring-[#F6C453]/40",
  },
  silver: {
    border: "border-[#C9D1DC]/60",
    bg: "bg-gradient-to-b from-[#C9D1DC]/10 to-card",
    glow: "",
    rankClass: "text-[#C9D1DC]",
    pillClass: "bg-[#C9D1DC]/15 text-[#C9D1DC]",
    ring: "ring-[#C9D1DC]/30",
  },
  bronze: {
    border: "border-[#C8874A]/60",
    bg: "bg-gradient-to-b from-[#C8874A]/10 to-card",
    glow: "",
    rankClass: "text-[#C8874A]",
    pillClass: "bg-[#C8874A]/15 text-[#C8874A]",
    ring: "ring-[#C8874A]/30",
  },
} as const;

const HallOfFamePage = () => {
  const navigate = useNavigate();
  const { user, progress, role } = useAuth();
  const [topTab, setTopTab] = useState<TopTab>("ranking");
  const [activeTab, setActiveTab] = useState<RankingTabKey>("weekly");
  const setRival = useSetRival();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";

  const { data: officialRanking, isLoading: officialLoading } =
    useDivisionRanking();
  const { data: weeklyRanking } = useWeeklyActivityRanking();
  const { data: monthlyRanking } = useMonthlyRisers();
  const { data: streakRanking } = useStreakRanking();
  const { data: bossRanking } = useBossConquerors();

  const myPosition = officialRanking?.find((r) => r.r_user_id === user?.id)
    ?.rank_position;

  const hallOfFameMembers = useMemo(
    () =>
      (officialRanking || []).filter((m) =>
        isHallOfFameMember(m.r_current_rank, m.r_current_level),
      ),
    [officialRanking],
  );

  // Admin: level set modal
  const [levelSetModal, setLevelSetModal] = useState<{
    show: boolean;
    userId: string;
    nickname: string;
    currentRank: string;
    currentLevel: number;
  } | null>(null);
  const [setRank, setSetRank] = useState("white");
  const [setLevel, setSetLevel] = useState(1);
  const [settingLevel, setSettingLevel] = useState(false);

  const handleSetLevel = async () => {
    if (!levelSetModal) return;
    setSettingLevel(true);
    try {
      const { data, error } = await supabase.rpc("set_member_level", {
        _member_id: levelSetModal.userId,
        _rank: setRank as any,
        _level: setLevel,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(
        `${levelSetModal.nickname} → ${
          RANK_LABELS[result.new_rank] || result.new_rank
        } Lv.${result.new_level} 설정 완료`,
      );
      setLevelSetModal(null);
      qc.invalidateQueries({ queryKey: ["division-ranking"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
    } catch (e: any) {
      toast.error(e?.message || "레벨 설정 실패");
    } finally {
      setSettingLevel(false);
    }
  };

  const openLevelSet = (member: any) => {
    setLevelSetModal({
      show: true,
      userId: member.r_user_id,
      nickname: member.r_nickname,
      currentRank: member.r_current_rank,
      currentLevel: member.r_current_level,
    });
    setSetRank(member.r_current_rank);
    setSetLevel(member.r_current_level);
  };

  const currentList = (() => {
    switch (activeTab) {
      case "weekly":
        return weeklyRanking || [];
      case "monthly":
        return monthlyRanking || [];
      case "streak":
        return streakRanking || [];
      case "boss":
        return bossRanking || [];
      case "official":
      default:
        return officialRanking || [];
    }
  })();

  const getScore = (m: any): string | number => {
    switch (activeTab) {
      case "weekly":
        return `${Number(m.weekly_xp ?? 0).toLocaleString()} XP`;
      case "monthly":
        return `+${Number(m.monthly_xp ?? 0).toLocaleString()} XP`;
      case "streak":
        return `${m.r_streak_days ?? 0}일 🔥`;
      case "boss":
        return `${m.r_bosses_cleared ?? 0}회 🏆`;
      case "official":
      default:
        return `${Number(m.r_total_xp ?? 0).toLocaleString()} XP`;
    }
  };

  const getMeta = (m: any) =>
    `${RANK_LABELS[m.r_current_rank]} · Lv.${m.r_current_level}`;

  const handleSetRival = (m: any) => {
    setRival.mutate(m.r_user_id);
    toast.success(`${m.r_nickname}을 추격 목표로 설정! 🎯`);
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="랭킹"
          subtitle={progress ? `${RANK_LABELS[progress.current_rank]} 리그` : "복싱 리그"}
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
      <div className="space-y-6">
        {/* Primary tabs: ranking vs hall of fame */}
        <SegmentedControl<TopTab>
          value={topTab}
          onChange={(v) => setTopTab(v)}
          segments={[
            { value: "ranking", label: "🏆 랭킹" },
            { value: "halloffame", label: "🏅 명예의 전당" },
          ]}
          fullWidth
        />

        {topTab === "ranking" && (
          <>
            {/* My position hero (when placed in the official ranking) */}
            {progress && myPosition && (
              <section className="rounded-card border border-primary/40 bg-primary/5 p-4 shadow-glow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-caption text-muted-foreground">
                      내 공식 순위
                    </p>
                    <p className="number-font text-display-lg text-primary">
                      {myPosition}
                      <span className="ml-1 text-display-sm">위</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-caption text-muted-foreground">
                      {RANK_LABELS[progress.current_rank]} Lv.
                      <span className="number-font">
                        {progress.current_level}
                      </span>
                    </p>
                    <p className="number-font text-body-sm font-bold text-foreground">
                      {progress.total_xp.toLocaleString()} XP
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Sub-filter chips */}
            <FilterChips<RankingTabKey>
              value={activeTab}
              onChange={(v) => setActiveTab(v as RankingTabKey)}
              chips={RANKING_FILTERS}
            />

            {/* Ranking content */}
            {officialLoading && activeTab === "official" ? (
              <SkeletonList />
            ) : currentList.length > 0 ? (
              <RankingList
                list={currentList}
                userId={user?.id}
                myRivalId={progress?.rival_id}
                getScore={getScore}
                getMeta={getMeta}
                isAdmin={isAdmin}
                onRowSetRival={handleSetRival}
                onAdminEdit={openLevelSet}
              />
            ) : (
              <RankingEmpty
                tab={activeTab}
                onCheckin={() => navigate("/home")}
                onMissions={() => navigate("/missions")}
                onBoss={() => navigate("/rank-up")}
              />
            )}
          </>
        )}

        {topTab === "halloffame" && (
          <>
            <HallOfFameHero />

            {officialLoading ? (
              <SkeletonList />
            ) : hallOfFameMembers.length > 0 ? (
              <div className="space-y-3">
                {hallOfFameMembers.map((m, idx) => (
                  <HoFMemberCard
                    key={m.r_user_id}
                    rank={idx + 1}
                    nickname={m.r_nickname}
                    rankName={m.r_current_rank}
                    level={m.r_current_level}
                    totalXp={Number(m.r_total_xp ?? 0)}
                    branch={(m as any).r_branch_name}
                    avatarUrl={m.r_avatar_url}
                    isMe={m.r_user_id === user?.id}
                    admin={
                      isAdmin
                        ? { onEdit: () => openLevelSet(m) }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Crown className="h-8 w-8 text-reward" />}
                title="아직 명예의 전당 멤버가 없습니다"
                description="블랙 리그 Lv.10 달성 + 모든 타이틀매치 클리어 시 입성합니다."
                ctaText="리그맵 보기"
                onCtaClick={() => navigate("/rank-up")}
              />
            )}
          </>
        )}
      </div>

      {/* Admin: Level Set Modal */}
      {levelSetModal?.show && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
          onClick={() => setLevelSetModal(null)}
        >
          <div
            className="w-full max-w-lg animate-slide-up rounded-t-hero border-t border-border bg-card p-6 pb-24 shadow-elev-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-display-sm text-foreground">
                ⚙️ 레벨 설정
              </h3>
              <button
                onClick={() => setLevelSetModal(null)}
                className="rounded-pill bg-secondary p-2 active:scale-95"
              >
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <p className="mb-3 text-body-sm text-muted-foreground">
              대상:{" "}
              <strong className="text-foreground">
                {levelSetModal.nickname}
              </strong>
            </p>
            <p className="mb-3 text-caption text-muted-foreground">
              현재:{" "}
              {RANK_LABELS[levelSetModal.currentRank] ||
                levelSetModal.currentRank}{" "}
              Lv.
              <span className="number-font">
                {levelSetModal.currentLevel}
              </span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  랭크
                </label>
                <div className="flex gap-2">
                  {(["white", "blue", "red", "black"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSetRank(r)}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-body-sm font-bold transition-all",
                        setRank === r
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {RANK_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  레벨 (1~10)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => (
                    <button
                      key={l}
                      onClick={() => setSetLevel(l)}
                      className={cn(
                        "h-9 w-9 rounded-lg text-body-sm font-bold transition-all number-font",
                        setLevel === l
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSetLevel}
                disabled={settingLevel}
                className="primary-button"
              >
                {settingLevel
                  ? "설정 중..."
                  : `${RANK_LABELS[setRank] || setRank} Lv.${setLevel}로 설정`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
};

/* ──────────────────────────────────────────────────────────
 *  Podium — spec: 1위 gold, 2위 silver, 3위 bronze, center
 *  card is taller. Uses number-font for rank digits and the
 *  user's own row gets a subtle primary ring.
 * ────────────────────────────────────────────────────────── */

interface PodiumMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url?: string | null;
  r_current_rank: string;
  r_current_level: number;
}

const PodiumCard = ({
  member,
  rank,
  tone,
  tall,
  isMe,
  score,
}: {
  member: PodiumMember;
  rank: 1 | 2 | 3;
  tone: keyof typeof PODIUM_TONE;
  tall?: boolean;
  isMe?: boolean;
  score: string | number;
}) => {
  const t = PODIUM_TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border bg-card p-3 text-center",
        t.border,
        t.bg,
        t.glow,
        tall ? "pb-5" : "",
        isMe && "ring-2",
        isMe && t.ring,
      )}
    >
      <span className={cn("number-font text-display-md leading-none", t.rankClass)}>
        {rank}
      </span>
      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-pill bg-background/50">
        {member.r_avatar_url ? (
          <img
            src={member.r_avatar_url}
            alt={member.r_nickname}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xl">🥊</span>
        )}
      </div>
      <p className="w-full truncate text-caption font-bold text-foreground">
        {member.r_nickname}
      </p>
      <p className="number-font text-[11px] font-bold text-muted-foreground">
        {score}
      </p>
      {isMe && (
        <span className={cn("badge-pill", t.pillClass)}>내 순위</span>
      )}
    </div>
  );
};

const Podium = ({
  top3,
  userId,
  getScore,
}: {
  top3: any[];
  userId?: string;
  getScore: (m: any) => string | number;
}) => {
  const [first, second, third] = top3;
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {second && (
        <PodiumCard
          member={second}
          rank={2}
          tone="silver"
          score={getScore(second)}
          isMe={second.r_user_id === userId}
        />
      )}
      {first && (
        <PodiumCard
          member={first}
          rank={1}
          tone="gold"
          tall
          score={getScore(first)}
          isMe={first.r_user_id === userId}
        />
      )}
      {third && (
        <PodiumCard
          member={third}
          rank={3}
          tone="bronze"
          score={getScore(third)}
          isMe={third.r_user_id === userId}
        />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
 *  RankingList — Podium for top 3 + RankingItems for the rest.
 * ────────────────────────────────────────────────────────── */

const RankingList = ({
  list,
  userId,
  myRivalId,
  getScore,
  getMeta,
  isAdmin,
  onRowSetRival,
  onAdminEdit,
}: {
  list: any[];
  userId?: string;
  myRivalId?: string | null;
  getScore: (m: any) => string | number;
  getMeta: (m: any) => string;
  isAdmin: boolean;
  onRowSetRival: (m: any) => void;
  onAdminEdit: (m: any) => void;
}) => {
  const showPodium = list.length >= 3;
  const top3 = showPodium ? list.slice(0, 3) : [];
  const rest = showPodium ? list.slice(3) : list;

  return (
    <div className="space-y-4">
      {showPodium && (
        <Podium top3={top3} userId={userId} getScore={getScore} />
      )}
      <div className="space-y-2">
        {rest.map((m) => {
          const isMe = m.r_user_id === userId;
          return (
            <div key={m.r_user_id} className="relative">
              <RankingItem
                rank={Number(m.rank_position) || rest.indexOf(m) + (showPodium ? 4 : 1)}
                name={m.r_nickname}
                score={getScore(m)}
                meta={getMeta(m)}
                isMe={isMe}
                avatar={m.r_avatar_url ?? undefined}
                onClick={
                  !isMe && myRivalId !== m.r_user_id
                    ? () => onRowSetRival(m)
                    : undefined
                }
              />
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdminEdit(m);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-elev-1 active:scale-95 backdrop-blur-sm"
                  aria-label="레벨 수정"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
 *  Empty state — per-tab motivational copy + CTA.
 * ────────────────────────────────────────────────────────── */

const RankingEmpty = ({
  tab,
  onCheckin,
  onMissions,
  onBoss,
}: {
  tab: RankingTabKey;
  onCheckin: () => void;
  onMissions: () => void;
  onBoss: () => void;
}) => {
  const CONFIG: Record<
    RankingTabKey,
    { icon: ReactNode; title: string; description: string; ctaText: string; action: () => void }
  > = {
    weekly: {
      icon: <Trophy className="h-8 w-8 text-reward" />,
      title: "아직 이번 주 랭킹이 없습니다",
      description: "첫 체크인을 완료하면 이번 주 랭킹에 진입합니다.",
      ctaText: "QR 체크인 하러가기",
      action: onCheckin,
    },
    streak: {
      icon: "🔥",
      title: "출석 연속 기록이 없어요",
      description: "매일 체크인하면 연속 출석이 시작됩니다.",
      ctaText: "QR 체크인 하러가기",
      action: onCheckin,
    },
    official: {
      icon: <Trophy className="h-8 w-8 text-reward" />,
      title: "공식 XP 랭킹이 비어 있어요",
      description: "미션과 도전을 완료해 XP를 쌓으면 이름이 올라갑니다.",
      ctaText: "미션 보러가기",
      action: onMissions,
    },
    monthly: {
      icon: "📈",
      title: "이번 달 상승 기록이 없어요",
      description: "이번 달 미션을 완료해 상승 랭킹에 이름을 올리세요.",
      ctaText: "미션 보러가기",
      action: onMissions,
    },
    boss: {
      icon: "🥊",
      title: "아직 보상 기록이 없어요",
      description: "타이틀매치(보스전)를 클리어하면 보상 랭킹에 집계됩니다.",
      ctaText: "리그맵 보기",
      action: onBoss,
    },
  };
  const cfg = CONFIG[tab];
  return (
    <EmptyState
      icon={cfg.icon}
      title={cfg.title}
      description={cfg.description}
      ctaText={cfg.ctaText}
      onCtaClick={cfg.action}
    />
  );
};

/* ──────────────────────────────────────────────────────────
 *  Hall of Fame — premium header + reward-bordered cards.
 * ────────────────────────────────────────────────────────── */

const HallOfFameHero = () => (
  <section
    className="relative overflow-hidden rounded-hero border bg-card p-6 text-center"
    style={{ borderColor: "rgba(246, 196, 83, 0.45)" }}
  >
    <div className="pointer-events-none absolute inset-0 opacity-60">
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reward/10 blur-3xl" />
    </div>
    <div className="relative flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-reward/15">
        <Crown className="h-7 w-7 text-reward" />
      </div>
      <h2 className="text-display-sm text-foreground">명예의 전당</h2>
      <p className="text-body-sm text-muted-foreground">
        {HALL_OF_FAME_DESCRIPTION}
      </p>
    </div>
  </section>
);

const HoFMemberCard = ({
  rank,
  nickname,
  rankName,
  level,
  totalXp,
  branch,
  avatarUrl,
  isMe,
  admin,
}: {
  rank: number;
  nickname: string;
  rankName: string;
  level: number;
  totalXp: number;
  branch?: string | null;
  avatarUrl?: string | null;
  isMe?: boolean;
  admin?: { onEdit: () => void };
}) => (
  <article
    className={cn(
      "relative flex items-center gap-3 rounded-card border bg-card p-4",
      isMe && "ring-2 ring-primary/50 shadow-glow-soft",
    )}
    style={{ borderColor: "rgba(246, 196, 83, 0.45)" }}
  >
    {/* Rank pill */}
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-reward/15">
      <span className="number-font text-body-lg font-bold text-reward">
        {rank}
      </span>
    </div>

    {/* Avatar */}
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-pill border border-reward/30 bg-background/60">
      <Crown className="absolute -top-1 left-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 text-reward drop-shadow-[0_0_6px_rgba(246,196,83,0.6)]" />
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={nickname}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-xl">🥊</span>
      )}
    </div>

    {/* Name + title pill */}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <p className="truncate text-body-sm font-bold text-foreground">
          {nickname}
        </p>
        {isMe && (
          <span className="badge-pill bg-primary/20 text-primary">나</span>
        )}
      </div>
      <p className="text-caption truncate text-muted-foreground">
        {RANK_LABELS[rankName] || rankName} · Lv.
        <span className="number-font">{level}</span>
        {branch && ` · ${branch}`}
      </p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-pill border border-reward/50 bg-reward/10 px-2 py-0.5 text-[10px] font-bold text-reward">
        👑 153명예코치
      </span>
    </div>

    {/* XP / admin */}
    <div className="flex flex-col items-end gap-1">
      <span className="number-font text-body-sm font-bold text-foreground">
        {totalXp.toLocaleString()} XP
      </span>
      {admin && (
        <button
          onClick={admin.onEdit}
          className="rounded-lg bg-secondary/80 p-1.5 text-muted-foreground active:scale-95"
          aria-label="레벨 수정"
        >
          <Settings2 className="h-3 w-3" />
        </button>
      )}
    </div>
  </article>
);

const SkeletonList = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="h-16 animate-pulse rounded-card bg-card border border-border"
      />
    ))}
  </div>
);

export default HallOfFamePage;
