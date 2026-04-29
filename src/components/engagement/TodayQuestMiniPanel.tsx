/**
 * 153 QUEST — 홈 진입 카드: 오늘의 보조 퀘스트 3 카드.
 *
 * 6단계: 카드만 노출. 실제 모달/플레이는 7~8단계에서 onOpenXxx 콜백으로 연결.
 *
 * 보호 원칙:
 *   · 공식 미션/공식 XP 무관 — QUEST XP / 파이트 머니만 미리보기
 *   · 카드 클릭은 콜백 → 호출측에서 toast (현재는 "다음 단계에서 열립니다")
 */

import { Brain, Swords, BookOpen } from "lucide-react";

import { useBoxingAcademyQuestions } from "@/hooks/useBoxingAcademy";
import { useBoxingFunChallenges } from "@/hooks/useBoxingFunChallenges";

export interface TodayQuestMiniPanelProps {
  onOpenAcademy: () => void;
  onOpenChallengeArena: () => void;
  onOpenChampionJournal: () => void;
}

interface MiniCardProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  subtitle: string;
  rewardPreview: string;
  onClick: () => void;
}

const MiniCard = ({
  icon,
  badge,
  title,
  subtitle,
  rewardPreview,
  onClick,
}: MiniCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
        {badge}
      </p>
      <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
        {title}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {subtitle}
      </p>
    </div>
    <div className="shrink-0 text-right">
      <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
        보상
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-reward">{rewardPreview}</p>
    </div>
    <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
      열기 →
    </span>
  </button>
);

const TodayQuestMiniPanel = ({
  onOpenAcademy,
  onOpenChallengeArena,
  onOpenChampionJournal,
}: TodayQuestMiniPanelProps) => {
  const { data: questions } = useBoxingAcademyQuestions();
  const { data: funChallenges } = useBoxingFunChallenges();

  const questionCount = questions?.length ?? 0;
  const challengeCount = funChallenges?.length ?? 0;

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="오늘의 보조 퀘스트"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘의 라운드
          </p>
          <h3 className="mt-0.5 text-display-sm">보조 퀘스트</h3>
        </div>
        <span className="badge-pill bg-reward/15 text-reward">
          QUEST XP · 파이트 머니
        </span>
      </div>

      <div className="space-y-2">
        <MiniCard
          icon={<Brain className="h-5 w-5" />}
          badge="복싱 IQ"
          title={
            questionCount > 0
              ? `오늘의 퀴즈 1문제 (총 ${questionCount}개 준비)`
              : "오늘의 퀴즈 1문제"
          }
          subtitle="머리로 한 번, 몸으로 한 번 — 두 번 들어갑니다."
          rewardPreview="+30 XP · +100"
          onClick={onOpenAcademy}
        />
        <MiniCard
          icon={<Swords className="h-5 w-5" />}
          badge="챌린지 아레나"
          title={
            challengeCount > 0
              ? `번개 잽 / 원투 / 스쿼트 외 ${challengeCount}종 도전`
              : "번개 잽 / 원투 / 스쿼트 중 하나 도전"
          }
          subtitle="공식 미션과 별개의 재미 챌린지입니다."
          rewardPreview="+150 XP · +500"
          onClick={onOpenChallengeArena}
        />
        <MiniCard
          icon={<BookOpen className="h-5 w-5" />}
          badge="챔피언 일기"
          title="오늘 가장 잘한 펀치는?"
          subtitle="한 줄이면 충분합니다 — 하루 첫 작성에만 보상."
          rewardPreview="+20 XP · +50"
          onClick={onOpenChampionJournal}
        />
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 보조 퀘스트는 공식 1~40 레벨업과 무관합니다. 공식 레벨업은 기존
        코치 승인 기준으로 진행됩니다.
      </p>
    </section>
  );
};

export default TodayQuestMiniPanel;
