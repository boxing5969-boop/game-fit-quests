import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, X, Trophy, Crown, CircleHelp, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  useDivisionRanking,
  useWeeklyActivityRanking,
  useMonthlyRisers,
  useStreakRanking,
  useBossConquerors,
  useSetRival,
  useBranchesList,
  useMyRankingPositions,
} from "@/hooks/useRankingData";
import { useLevelupRules } from "@/hooks/useLevelupRules";
import {
  RANKING_TAB_LABEL,
  myRankLine,
  rankingHelp,
  rankingResetLabel,
  type RankingTabKey,
} from "@/lib/rankingHelp";
import { supabase } from "@/integrations/supabase/client";
import { isHallOfFameMember, HALL_OF_FAME_DESCRIPTION, toGlobalLevel } from "@/lib/rankLabels";
import { cn } from "@/lib/utils";
import MemberLicenseSheet from "@/components/license/MemberLicenseSheet";

import LeagueBadge from "@/components/badges/LeagueBadge";
import NameBadge from "@/components/badges/NameBadge";
import Record153Board from "@/components/engagement/Record153Board";
import Records153Strip from "@/components/engagement/Records153Strip";
import WorkingOutNowCard from "@/components/engagement/WorkingOutNow";
import Test153Board from "@/components/test153/Test153Board";
import MedalMark from "@/components/MedalMark";
import {
  AppPage,
  PageHeader,
  SegmentedControl,
  FilterChips,
  RankingItem,
  EmptyState,
} from "@/components/ui/rankingup";

type TopTab = "ranking" | "halloffame" | "records" | "test153";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

// Order drives the visual position of chips. "official" sits first
// because that's the default landing view — full branch roster sorted
// by total XP, i.e. "우리 지점 전체 회원" at a glance.
// 칩 이름 (2026-10-29 랭킹 설명 단추): '출석' → '출석일'(연속이 아니라 출석 체크한 날 수) · '보상' → '타이틀매치'(통과 수)
const RANKING_FILTERS: { value: RankingTabKey; label: string }[] = (
  ["official", "weekly", "streak", "monthly", "boss"] as RankingTabKey[]
).map((value) => ({ value, label: RANKING_TAB_LABEL[value] }));

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
  const { user, profile, progress, role } = useAuth();
  // ?tab=records → 153 레코드 탭으로 바로 (검색·공유 링크)
  const [searchParams] = useSearchParams();
  const [topTab, setTopTab] = useState<TopTab>(() => {
    const t = searchParams.get("tab");
    return t === "records" || t === "halloffame" || t === "test153" ? t : "ranking";
  });
  // Default to the "official" (total XP) view so users land on the
  // full branch roster first instead of the weekly slice.
  const [activeTab, setActiveTab] = useState<RankingTabKey>("official");
  const setRival = useSetRival();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  // Branch switcher state (super_admin only).
  //   undefined → 내 지점 (Regular users are locked here)
  //   null      → 전 지점 통합
  //   "선릉점"  → 특정 지점
  // Default is undefined; a one-shot effect below flips it to null
  // (전 지점 통합) for super_admins once their role finishes loading.
  const [branchFilter, setBranchFilter] = useState<string | null | undefined>(
    undefined,
  );

  // Role arrives async after auth session loads. Switch super_admins to
  // the global-union view on first role resolution so they land on
  // "all members across all branches" by default. Ref-gated so user
  // choices afterward (e.g. picking "내 지점") stick.
  const branchDefaultDoneRef = useRef(false);
  useEffect(() => {
    if (branchDefaultDoneRef.current) return;
    if (!role) return;
    branchDefaultDoneRef.current = true;
    if (role === "super_admin") setBranchFilter(null);
  }, [role]);

  const { data: branches } = useBranchesList();

  const effectiveBranchLabel =
    branchFilter === null
      ? "전 지점 통합"
      : branchFilter ?? profile?.branch_name ?? "내 지점";

  // Forward branchFilter into the five ranking hooks. When undefined,
  // they fall back to the caller's own branch (regular-user path).
  const { data: officialRanking, isLoading: officialLoading } =
    useDivisionRanking(50, branchFilter);
  const { data: weeklyRanking } = useWeeklyActivityRanking(20, branchFilter);
  const { data: monthlyRanking } = useMonthlyRisers(10, branchFilter);
  const { data: streakRanking } = useStreakRanking(10, branchFilter);
  const { data: bossRanking } = useBossConquerors(10, branchFilter);

  // 내 순위 — 지금 보는 칩 기준 · 50위 밖이어도 (get_my_ranking_positions, 2026-10-29)
  //   전 지점/다른 지점을 보는 전체관리자는 그리지 않는다 (서버도 운영진은 eligible:false)
  const { data: myPositions } = useMyRankingPositions(topTab === "ranking");
  const myRank = branchFilter === undefined ? myRankLine(activeTab, myPositions) : null;
  // 랭킹 설명 단추 — 펼치면 지금 칩의 기준 · 올리는 법 · 내려가는 때 · 다시 시작
  const [helpOpen, setHelpOpen] = useState(false);
  const { data: levelupRules } = useLevelupRules(helpOpen);

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
  // 랭킹에서 누른 회원의 라이센스 (2026-09-29 — 킹즈오브아너식 프로필 보기 + 하트. 추격 목표 지정은 그 안의 버튼으로)
  const [licenseMember, setLicenseMember] = useState<{ id: string; nickname: string } | null>(null);
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
        } Lv.${toGlobalLevel(result.new_rank, result.new_level)} 설정 완료`,
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
      // 출석일 = 출석 체크한 날 수(누적) — 연속이 아니라 불꽃을 뺐다 (2026-10-29)
      case "streak":
        return `${m.r_streak_days ?? 0}일`;
      case "boss":
        return `${m.r_bosses_cleared ?? 0}회`;
      // '전체'는 레벨 순이라 점수 칸 = 레벨, XP 는 아래 작은 줄 (예전엔 XP 가 보여 'XP 더 많은데 왜 아래?'가 나왔다)
      case "official":
      default:
        return `Lv.${toGlobalLevel(m.r_current_rank, m.r_current_level)}`;
    }
  };

  const getMeta = (m: any) =>
    activeTab === "official"
      ? `${RANK_LABELS[m.r_current_rank]} · ${Number(m.r_total_xp ?? 0).toLocaleString()} XP`
      : `${RANK_LABELS[m.r_current_rank]} · Lv.${toGlobalLevel(m.r_current_rank, m.r_current_level)}`;

  const handleSetRival = (m: any) => {
    setRival.mutate(m.r_user_id);
    toast.success(`${m.r_nickname}을 추격 목표로 설정! 🎯`);
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="랭킹"
          subtitle={
            isSuperAdmin
              ? `${effectiveBranchLabel} 리그`
              : profile?.branch_name
                ? `${profile.branch_name} 리그`
                : "복싱 리그"
          }
          // 내 정보는 아래 탭에 있다 — 머리글 단추를 겹쳐 두지 않는다 (2026-10-28 리디자인)
          sticky
        />
      }
    >
      <div data-tour="halloffame-leaderboard" className="space-y-6">
        {/* Primary tabs: ranking vs hall of fame */}
        <SegmentedControl<TopTab>
          value={topTab}
          onChange={(v) => setTopTab(v)}
          segments={[
            { value: "ranking", label: "랭킹" },
            { value: "halloffame", label: <span className="whitespace-nowrap">명예의 전당</span> },
            // 153 레코드 — 153복싱짐의 최초 기록 (2026-10-15 대표님)
            { value: "records", label: <span className="whitespace-nowrap">153 레코드</span> },
            // 153 PB — 코치가 재는 153 체력테스트 기록·순위 (2026-10-15 대표님)
            { value: "test153", label: <span className="whitespace-nowrap">153 PB</span> },
          ]}
          fullWidth
          // 칸이 4개라 좁은 폰에서 넘치지 않게 양옆 여백을 줄인다
          className="[&>button]:px-1.5"
        />

        {/* 153 레코드 최초 기록자 — 랭킹·명예의 전당 탭에서도 보이게 (2026-10-16 대표님) */}
        {(topTab === "ranking" || topTab === "halloffame") && (
          <Records153Strip onOpenAll={() => setTopTab("records")} onOpenMember={(m) => setLicenseMember(m)} />
        )}

        {topTab === "ranking" && isSuperAdmin && branches && branches.length > 0 && (
          // Super-admin only: switch between branches or view the global
          // union. Regular members never see this row (server-side RPC
          // also force-scopes them to their own branch).
          <FilterChips<string>
            value={branchFilter === null ? "__all__" : branchFilter ?? "__mine__"}
            onChange={(v) => {
              if (v === "__all__") setBranchFilter(null);
              else if (v === "__mine__") setBranchFilter(undefined);
              else setBranchFilter(v as string);
            }}
            chips={[
              { value: "__all__", label: "전 지점" },
              // 내 지점이 꺼진 지점(예: 153본사)이면 칩을 숨긴다 (2026-10-15 지점 표시 설정)
              ...(profile?.branch_name && branches.some((b) => b.name === profile.branch_name)
                ? [{ value: "__mine__", label: `내 지점 (${profile.branch_name})` }]
                : []),
              ...branches.map((b) => ({ value: b.name, label: b.name })),
            ]}
          />
        )}

        {topTab === "ranking" && (
          <>
            {/* 지금 운동 중 — 체육관 TV 와 같은 기준 (2026-10-16 대표님). 아무도 없으면 그리지 않는다 (2026-10-28) */}
            <WorkingOutNowCard
              branch={branchFilter === undefined ? profile?.branch_name ?? null : branchFilter}
              onOpenMember={(m) => setLicenseMember(m)}
              hideWhenEmpty
            />

            {/* 내 순위 — 숫자 하나 + 바로 앞 사람까지 한 줄. 지금 보는 칩 기준 · 50위 밖이어도 (2026-10-29)
                목록 안에 내 줄이 있으면 누르면 그 줄로 */}
            {myRank && (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("my-rank-row")?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4 text-left active:scale-[0.99]"
              >
                <span className="shrink-0">
                  <span className="block text-label font-bold text-muted-foreground">
                    내 순위 · {RANKING_TAB_LABEL[activeTab]}
                  </span>
                  <span className="number-font text-title text-primary">
                    {myRank.pos != null ? (
                      <>
                        {myRank.pos.toLocaleString()}
                        <span className="ml-0.5 text-heading">위</span>
                      </>
                    ) : (
                      <span className="text-heading">아직 없어요</span>
                    )}
                  </span>
                </span>
                <span className="min-w-0 break-keep text-right text-label font-bold text-foreground">{myRank.line}</span>
              </button>
            )}

            {/* 칩 + 설명 단추(?) — 누르면 지금 칩이 무엇으로 줄을 세우는지 펼친다 (화면 규칙 ④ 설명은 접기) */}
            <div className="flex items-center gap-2">
              <FilterChips<RankingTabKey>
                value={activeTab}
                onChange={(v) => setActiveTab(v as RankingTabKey)}
                chips={RANKING_FILTERS}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                aria-expanded={helpOpen}
                aria-label="순위 정하는 법 보기"
                className={cn(
                  "-mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
                  helpOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <CircleHelp className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {helpOpen && (
              <RankingHelpPanel
                tab={activeTab}
                rules={levelupRules}
                onClose={() => setHelpOpen(false)}
                onRoadmap={() => navigate("/rank-up")}
              />
            )}

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
                onRowOpen={(m) => setLicenseMember({ id: m.r_user_id, nickname: m.r_nickname })}
                onAdminEdit={openLevelSet}
              />
            ) : (
              <RankingEmpty
                tab={activeTab}
                onCheckin={() => navigate("/myboxer")}
                onMissions={() => navigate("/missions")}
                onBoss={() => navigate("/rank-up")}
              />
            )}
          </>
        )}

        {topTab === "halloffame" && (
          <>
            {/* 멤버가 있을 때만 머리 카드 — 비어 있으면 빈 칸 카드 하나가 같은 말을 한다 (2026-10-28 리디자인) */}
            {hallOfFameMembers.length > 0 && <HallOfFameHero />}

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
                title="첫 번째 주인공을 기다려요"
                description="블랙 리그 레벨 10 · 모든 타이틀매치를 통과하면 이름이 새겨져요"
                ctaText="로드맵 보기"
                onCtaClick={() => navigate("/rank-up")}
              />
            )}
          </>
        )}

        {topTab === "records" && (
          <Record153Board onOpenMember={(m) => setLicenseMember(m)} />
        )}

        {topTab === "test153" && <Test153Board onOpenMember={(m) => setLicenseMember(m)} />}
      </div>

      {/* 랭킹에서 누른 회원의 라이센스 — 하트 + (남이면) 추격 목표 지정 */}
      <MemberLicenseSheet
        userId={licenseMember?.id ?? null}
        onClose={() => setLicenseMember(null)}
        extraAction={
          licenseMember && licenseMember.id !== user?.id && progress?.rival_id !== licenseMember.id ? (
            <button
              type="button"
              onClick={() => {
                handleSetRival({ r_user_id: licenseMember.id, r_nickname: licenseMember.nickname });
                setLicenseMember(null);
              }}
              className="h-11 w-full rounded-xl border border-border bg-card text-label font-bold text-foreground transition-transform active:scale-[0.98]"
            >
              🎯 추격 목표로 정하기
            </button>
          ) : licenseMember && progress?.rival_id === licenseMember.id ? (
            <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-center text-label font-semibold text-muted-foreground">
              🎯 지금 추격 중인 회원이에요
            </p>
          ) : null
        }
      />

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
              <h3 className="text-heading text-foreground">
                ⚙️ 레벨 설정
              </h3>
              <button
                onClick={() => setLevelSetModal(null)}
                className="rounded-pill bg-secondary p-2 active:scale-95"
              >
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <p className="mb-3 text-label text-muted-foreground font-medium">
              대상:{" "}
              <strong className="text-foreground">
                {levelSetModal.nickname}
              </strong>
            </p>
            <p className="mb-3 text-label text-muted-foreground font-medium">
              현재:{" "}
              {RANK_LABELS[levelSetModal.currentRank] ||
                levelSetModal.currentRank}{" "}
              Lv.
              <span className="number-font">
                {toGlobalLevel(levelSetModal.currentRank, levelSetModal.currentLevel)}
              </span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-label text-muted-foreground font-medium">
                  랭크
                </label>
                <div className="flex gap-2">
                  {(["white", "blue", "red", "black"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSetRank(r)}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-label font-bold transition-all",
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
                <label className="mb-1 block text-label text-muted-foreground font-medium">
                  레벨 ({toGlobalLevel(setRank, 1)}~{toGlobalLevel(setRank, 10)})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => (
                    <button
                      key={l}
                      onClick={() => setSetLevel(l)}
                      className={cn(
                        "h-9 w-9 rounded-lg text-label font-bold transition-all number-font",
                        setLevel === l
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {toGlobalLevel(setRank, l)}
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
                  : `${RANK_LABELS[setRank] || setRank} Lv.${toGlobalLevel(setRank, setLevel)}로 설정`}
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

/** 라이센스를 여는 데 필요한 최소 정보 — 랭킹 행에서 꺼낸다 */
interface RankRowRef {
  r_user_id: string;
  r_nickname: string;
}

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
  onOpen,
}: {
  member: PodiumMember;
  rank: 1 | 2 | 3;
  tone: keyof typeof PODIUM_TONE;
  tall?: boolean;
  isMe?: boolean;
  score: string | number;
  onOpen?: () => void;
}) => {
  const t = PODIUM_TONE[tone];
  const Root = onOpen ? "button" : "div";
  return (
    <Root
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      aria-label={onOpen ? `${member.r_nickname} 라이센스 보기` : undefined}
      className={cn(
        onOpen && "w-full transition-transform active:scale-[0.98]",
        "flex flex-col items-center gap-2 rounded-card border bg-card p-3 text-center",
        t.border,
        t.bg,
        t.glow,
        tall ? "pb-5" : "",
        isMe && "ring-2",
        isMe && t.ring,
      )}
    >
      <span className={cn("number-font text-title leading-none", t.rankClass)}>
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
          <span className="text-heading">🥊</span>
        )}
      </div>
      <div className="flex w-full min-w-0 items-center justify-center gap-1">
        <p className="min-w-0 truncate text-body font-bold text-foreground">
          {member.r_nickname}
        </p>
        <NameBadge league={member.r_current_rank} className="h-4 w-4" />
        <MedalMark userId={member.r_user_id} className="text-body" />
      </div>
      <p className="number-font text-label font-bold text-muted-foreground">
        {score}
      </p>
      {isMe && (
        <span className={cn("badge-pill", t.pillClass)}>내 순위</span>
      )}
    </Root>
  );
};

const Podium = ({
  top3,
  userId,
  getScore,
  onOpen,
}: {
  top3: any[];
  userId?: string;
  getScore: (m: any) => string | number;
  onOpen?: (m: RankRowRef) => void;
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
          onOpen={onOpen ? () => onOpen(second) : undefined}
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
          onOpen={onOpen ? () => onOpen(first) : undefined}
        />
      )}
      {third && (
        <PodiumCard
          member={third}
          rank={3}
          tone="bronze"
          score={getScore(third)}
          isMe={third.r_user_id === userId}
          onOpen={onOpen ? () => onOpen(third) : undefined}
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
  onRowOpen,
  onAdminEdit,
}: {
  list: any[];
  userId?: string;
  myRivalId?: string | null;
  getScore: (m: any) => string | number;
  getMeta: (m: any) => string;
  isAdmin: boolean;
  /** 행·시상대를 누르면 그 회원 라이센스 (추격 목표 지정은 라이센스 시트 안에서) */
  onRowOpen: (m: RankRowRef) => void;
  onAdminEdit: (m: any) => void;
}) => {
  const showPodium = list.length >= 3;
  const top3 = showPodium ? list.slice(0, 3) : [];
  const rest = showPodium ? list.slice(3) : list;

  return (
    <div className="space-y-4">
      {showPodium && (
        <Podium top3={top3} userId={userId} getScore={getScore} onOpen={onRowOpen} />
      )}
      {/* 4위부터는 카드 하나에 줄로 묶는다 (2026-10-28 리디자인 — 상자 20개 대신 목록 하나) */}
      {rest.length > 0 && (
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rest.map((m) => {
          const isMe = m.r_user_id === userId;
          return (
            <div key={m.r_user_id} id={isMe ? "my-rank-row" : undefined} className="relative scroll-mt-24">
              <RankingItem
                flat
                rank={Number(m.rank_position) || rest.indexOf(m) + (showPodium ? 4 : 1)}
                name={m.r_nickname}
                score={getScore(m)}
                meta={getMeta(m)}
                badge={
                  <>
                    <NameBadge league={m.r_current_rank} className="h-[18px] w-[18px]" glow={false} />
                    <MedalMark userId={m.r_user_id} className="text-body" />
                  </>
                }
                isMe={isMe}
                avatar={m.r_avatar_url ?? undefined}
                onClick={() => onRowOpen(m)}
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
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
 *  RankingHelpPanel — 칩 줄 옆 ? 단추를 누르면 펼쳐지는 설명 (2026-10-29 대표님 · 「랭킹 설명 버튼 보고서」)
 *  지금 보는 칩이 무엇으로 줄을 세우는지 · 올리는 법 · 내려가는 때 · 다시 시작까지. 칩을 바꾸면 내용도 바뀐다.
 *  글은 src/lib/rankingHelp.ts 한 곳 — 숫자 규칙의 정본은 DB 함수.
 * ────────────────────────────────────────────────────────── */

const RankingHelpPanel = ({
  tab,
  rules,
  onClose,
  onRoadmap,
}: {
  tab: RankingTabKey;
  rules?: Parameters<typeof rankingHelp>[1];
  onClose: () => void;
  onRoadmap: () => void;
}) => {
  const help = rankingHelp(tab, rules);
  const reset = rankingResetLabel(tab);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="break-keep text-heading text-foreground">'{RANKING_TAB_LABEL[tab]}' 순위는 이렇게 정해져요</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="설명 닫기"
          className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <dl className="mt-3 space-y-4">
        <div>
          <dt className="text-label font-bold text-muted-foreground">기준</dt>
          <dd className="mt-1 break-keep text-body text-foreground">{help.rule}</dd>
          {help.order && (
            <ol className="mt-1.5 space-y-1">
              {help.order.map((line, i) => (
                <li key={line} className="flex gap-2 break-keep text-body text-foreground">
                  <span className="number-font w-5 shrink-0 font-bold text-primary">{i + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <dt className="text-label font-bold text-muted-foreground">올리려면</dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {help.up.map((line) => (
                <li key={line} className="flex gap-2 break-keep text-body text-foreground">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-label font-bold text-muted-foreground">내려가는 때</dt>
          <dd className="mt-1 break-keep text-body text-foreground">{help.down}</dd>
        </div>
      </dl>

      {reset && (
        <p className="mt-4 break-keep rounded-xl bg-primary/10 px-3 py-2.5 text-label font-bold text-primary">{reset}</p>
      )}

      <p className="mt-4 break-keep text-label text-muted-foreground">
        우리 지점 회원끼리만 겨뤄요. 코치님 · 운영진은 순위에 없어요.
      </p>

      {tab === "official" && (
        <button
          type="button"
          onClick={onRoadmap}
          className="-mx-5 -mb-5 mt-4 flex h-14 w-[calc(100%+2.5rem)] items-center justify-center gap-1 border-t border-border text-body font-bold text-foreground"
        >
          레벨업 조건 자세히 보기 <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}
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
      title: "아직 출석일 기록이 없어요",
      description: "앱 홈을 그날 처음 열면 출석 체크가 돼서 하루씩 쌓여요.",
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
      title: "아직 타이틀매치 통과 기록이 없어요",
      description: "리그 마지막 레벨에서 타이틀매치를 통과하면 이름이 올라가요.",
      ctaText: "로드맵 보기",
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
      <h2 className="text-heading text-foreground">명예의 전당</h2>
      <p className="text-label text-muted-foreground font-medium">
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
      <span className="number-font text-body font-bold text-reward">
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
        <span className="text-heading">🥊</span>
      )}
    </div>

    {/* Name + title pill */}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <p className="truncate text-label font-bold text-foreground">
          {nickname}
        </p>
        <NameBadge league={rankName} className="h-[18px] w-[18px]" />
        {isMe && (
          <span className="badge-pill bg-primary/20 text-primary">나</span>
        )}
      </div>
      <p className="text-label flex items-center gap-1 truncate text-muted-foreground font-medium">
        <LeagueBadge league={rankName} className="h-3.5 w-3.5" animated={false} />
        {RANK_LABELS[rankName] || rankName} · Lv.
        <span className="number-font">{toGlobalLevel(rankName, level)}</span>
        {branch && ` · ${branch}`}
      </p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-pill border border-reward/50 bg-reward/10 px-2 py-0.5 text-micro font-bold text-reward">
        👑 153명예코치
      </span>
    </div>

    {/* XP / admin */}
    <div className="flex flex-col items-end gap-1">
      <span className="number-font text-label font-bold text-foreground">
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
