/**
 * 153 QUEST — 홈 진입 카드: 오늘의 보조 퀘스트 3 카드.
 *
 * 6단계: 카드만 노출. 실제 모달/플레이는 7~8단계에서 onOpenXxx 콜백으로 연결.
 * v1.5 14단계: 컨디션 게이지 선택 시 카드 우선순위가 컨디션별로 재정렬됨.
 *
 * 보호 원칙:
 *   · 공식 미션/공식 XP 무관 — QUEST XP / 파이트 머니만 미리보기
 *   · 카드 클릭은 콜백 → 호출측에서 toast (현재는 "다음 단계에서 열립니다")
 *   · 공식 missions 필터링 / 수정 0 — 본 컴포넌트는 보조 카드 정렬만 담당
 */

import { Brain, Swords, BookOpen } from "lucide-react";

import {
  getConditionRecommendation,
  type ConditionRecommendation,
} from "@/data/boxingConditionMessages";
import { useTodayBoxingCondition } from "@/hooks/useBoxingCondition";

export interface TodayQuestMiniPanelProps {
  onOpenAcademy: () => void;
  onOpenChallengeArena: () => void;
  onOpenChampionJournal: () => void;
}

type CardKey = "academy" | "challenge" | "journal";

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
  // 카드만 표시 — 실제 RPC 는 모달이 열릴 때만 발사 (enabled gate 적용됨).
  // 여기서는 카운트를 호출하지 않고 정적 카피로 표시.

  // v1.5 14단계: 컨디션에 따라 카드 우선순위/문구만 조정.
  // 공식 missions 필터링/수정 0 — 본 컴포넌트는 보조 카드만 다룸.
  const { data: today } = useTodayBoxingCondition();
  const rec: ConditionRecommendation | null = getConditionRecommendation(
    today?.condition_type ?? null,
  );

  const cardDefs: Record<CardKey, React.ReactNode> = {
    academy: (
      <MiniCard
        key="academy"
        icon={<Brain className="h-5 w-5" />}
        badge="복싱 IQ"
        title="오늘의 퀴즈 1문제"
        subtitle="머리로 한 번, 몸으로 한 번 — 두 번 들어갑니다."
        rewardPreview="+30 XP · +100"
        onClick={onOpenAcademy}
      />
    ),
    challenge: (
      <MiniCard
        key="challenge"
        icon={<Swords className="h-5 w-5" />}
        badge="챌린지 아레나"
        title={
          rec?.warnHighIntensity
            ? "오늘은 가벼운 챌린지만 권장"
            : "번개 잽 / 원투 / 스쿼트 외 도전 라운드"
        }
        subtitle={
          rec?.warnHighIntensity
            ? "고강도 챌린지는 컨디션이 회복된 후로 미루세요."
            : "공식 미션과 별개의 재미 챌린지입니다."
        }
        rewardPreview="+150 XP · +500"
        onClick={onOpenChallengeArena}
      />
    ),
    journal: (
      <MiniCard
        key="journal"
        icon={<BookOpen className="h-5 w-5" />}
        badge="챔피언 일기"
        title={
          rec?.emphasizeShortQuest
            ? "5분 안에 한 줄만 — 시간이 없을 때"
            : "오늘 가장 잘한 펀치는?"
        }
        subtitle="한 줄이면 충분합니다 — 하루 첫 작성에만 보상."
        rewardPreview="+20 XP · +50"
        onClick={onOpenChampionJournal}
      />
    ),
  };

  const order: CardKey[] = rec?.recommendation ?? [
    "academy",
    "challenge",
    "journal",
  ];
  // 추천 외 카드도 모두 노출 — 우선순위만 조정 (숨김 처리 안 함)
  const visible: CardKey[] = Array.from(
    new Set([...order, "academy", "challenge", "journal"] as CardKey[]),
  );

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

      <div className="space-y-2">{visible.map((k) => cardDefs[k])}</div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 보조 퀘스트는 공식 1~40 레벨업과 무관합니다. 공식 레벨업은 기존
        코치 승인 기준으로 진행됩니다.
      </p>
    </section>
  );
};

export default TodayQuestMiniPanel;
