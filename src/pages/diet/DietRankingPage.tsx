import { useNavigate } from "react-router-dom";
import { ChevronLeft, Info, Medal, Sparkles } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";

import { useAuth } from "@/contexts/AuthContext";
import { useDietRanking } from "@/hooks/useDietRanking";
import { cn } from "@/lib/utils";

/**
 * /diet/ranking — 습관 수행률 리더보드.
 *
 * 정렬 기준 (서버 RPC):
 *   approved_days_total DESC → best_streak DESC → nickname ASC
 *
 * 체중/감량 관련 수치는 절대 노출하지 않는다 (절대 규칙 9).
 * 닉네임/아바타/승인일수/최고 스트릭/완주율만.
 */
const DietRankingPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const branchName = profile?.branch_name ?? null;
  const featureEnabled = !!profile?.diet_program_enabled;

  const rankingQuery = useDietRanking(branchName, 50);

  return (
    <AppPage
      header={
        <PageHeader
          title="습관 랭킹"
          subtitle="체중이 아닌, 꾸준함으로 정렬했어요"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-4 pt-2">
        {!featureEnabled ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            153 다이어트 프로그램이 아직 활성화되지 않았어요.
          </div>
        ) : !branchName ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            지점을 먼저 설정해 주세요.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
                <Info className="h-3.5 w-3.5" />
                <span>정렬 기준</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                코치가 승인한 체크인 일수 → 최고 스트릭 → 닉네임 순.
                체중·감량 수치는 사용하지 않아요. 개인 사진·메모는 비공개입니다.
              </p>
            </div>

            {rankingQuery.isLoading ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12px] text-muted-foreground">
                불러오는 중...
              </div>
            ) : !rankingQuery.data?.success ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12px] text-muted-foreground">
                랭킹을 불러오지 못했어요.
              </div>
            ) : rankingQuery.data.rows.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-1.5 text-[13px] font-bold text-foreground">
                  아직 기록이 쌓이지 않았어요
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  첫 승인된 체크인이 있으면 바로 표시돼요.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {rankingQuery.data.rows.map((row) => (
                  <RankingRow
                    key={row.r_user_id}
                    rank={row.rank_position}
                    nickname={row.r_nickname}
                    avatarUrl={row.r_avatar_url}
                    approvedDays={row.r_approved_days}
                    bestStreak={row.r_best_streak}
                    completionRate={row.r_completion_rate}
                    highlight={row.r_user_id === profile?.user_id}
                  />
                ))}
              </ul>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              리더보드 노출이 부담스럽다면 설정에서 코치에게 비공개 요청을 남겨 주세요.
            </p>
          </>
        )}
      </div>
    </AppPage>
  );
};

const RankingRow = ({
  rank,
  nickname,
  avatarUrl,
  approvedDays,
  bestStreak,
  completionRate,
  highlight,
}: {
  rank: number;
  nickname: string;
  avatarUrl: string | null;
  approvedDays: number;
  bestStreak: number;
  completionRate: number;
  highlight: boolean;
}) => {
  const medal = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        highlight
          ? "border-primary bg-primary/5 shadow-[0_0_0_2px_rgba(217,54,32,0.1)]"
          : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
          medal === "gold" && "bg-reward/25 text-reward-foreground",
          medal === "silver" && "bg-muted text-foreground",
          medal === "bronze" && "bg-primary/15 text-primary",
          !medal && "bg-muted text-muted-foreground",
        )}
      >
        {medal ? <Medal className="h-3.5 w-3.5" /> : rank}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[13px] font-bold text-muted-foreground">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          nickname.slice(0, 1)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground">
          {nickname}
          {highlight && (
            <span className="ml-1.5 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-black uppercase text-primary">
              나
            </span>
          )}
        </p>
        <p className="text-[10.5px] text-muted-foreground">
          승인 {approvedDays}일 · 최고 {bestStreak}일 연속
        </p>
      </div>
      <div className="text-right">
        <p className="number-font text-[14px] font-extrabold text-primary">
          {completionRate}%
        </p>
        <p className="text-[10px] text-muted-foreground">완주율</p>
      </div>
    </li>
  );
};

export default DietRankingPage;
