/**
 * 홈 '이번 달 만족도 조사' 안내 카드 (2026-10-15).
 * 보이는 조건: 우리 지점에 설문이 열려 있고(branch_survey_links.survey_slug) · 이번 달 아직 참여 전 · 지도진 아님.
 * 참여하면 다음 달 1일까지 사라진다.
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SURVEY_REWARD, getBranchSurveyLinks, getMySurveyRewards } from "@/services/memberSurveyService";

const SurveyNudgeCard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const branch = profile?.branch_name ?? null;
  const staff = (profile as { is_staff?: boolean } | null)?.is_staff === true;
  const links = useQuery({
    queryKey: ["survey-links", branch],
    queryFn: () => getBranchSurveyLinks(branch),
    enabled: !!branch && !staff,
    staleTime: 10 * 60 * 1000,
  });
  const rewards = useQuery({
    queryKey: ["survey-rewards"],
    queryFn: getMySurveyRewards,
    enabled: !!links.data?.survey_slug,
    staleTime: 5 * 60 * 1000,
  });
  if (staff || !links.data?.survey_slug || !rewards.data || rewards.data.satisfaction) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("/survey")}
      className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.07] px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-heading">⭐</span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-extrabold text-foreground">이번 달 만족도 조사 (1분)</span>
        <span className="mt-0.5 block text-label text-muted-foreground">
          익명으로 전달돼요 · 참여하면 💵 +{SURVEY_REWARD.satisfaction.toLocaleString()} 챔피언 머니
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default SurveyNudgeCard;
