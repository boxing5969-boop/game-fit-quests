/**
 * 153 QUEST — 홈 화면 몰입 섹션 컨테이너.
 *
 * HomePage 에는 본 컴포넌트 하나만 import 한다.
 * 7단계에서 복싱 IQ 모달은 본 컴포넌트가 자체 관리하도록 연결.
 * 챌린지 아레나/챔피언 일기는 8단계에서 onOpenXxx 콜백으로 교체.
 */

import { useState } from "react";
import { Megaphone } from "lucide-react";

import OsamiDailyBriefingCard from "./OsamiDailyBriefingCard";
import TodayQuestMiniPanel from "./TodayQuestMiniPanel";
import BoxingAcademyQuizModal from "./BoxingAcademyQuizModal";
import FunChallengeArenaSheet from "./FunChallengeArenaSheet";
import ChampionJournalSheet from "./ChampionJournalSheet";
import SecondCheerSheet from "./SecondCheerSheet";
import ConditionGaugeCard from "./ConditionGaugeCard";
import ConditionGaugeSheet from "./ConditionGaugeSheet";
import ReturnRoundBanner from "./ReturnRoundBanner";
import ReturnRoundSheet from "./ReturnRoundSheet";
import CornermanCard from "./CornermanCard";
import CornermanSheet from "./CornermanSheet";

export interface HomeEngagementSectionProps {
  /** 외부에서 복싱 IQ 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 모달을 연다. */
  onOpenAcademy?: () => void;
  /** 외부에서 챌린지 아레나 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenChallengeArena?: () => void;
  /** 외부에서 챔피언 일기 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenChampionJournal?: () => void;
  /** 외부에서 세컨드 응원 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenSecondCheer?: () => void;
}

const HomeEngagementSection = ({
  onOpenAcademy,
  onOpenChallengeArena,
  onOpenChampionJournal,
  onOpenSecondCheer,
}: HomeEngagementSectionProps) => {
  const [showAcademy, setShowAcademy] = useState(false);
  const [showArena, setShowArena] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showCheer, setShowCheer] = useState(false);
  // v1.5 14단계 — 컨디션 게이지
  const [showCondition, setShowCondition] = useState(false);
  // v1.5 15단계 — 리턴 라운드
  const [showReturn, setShowReturn] = useState(false);
  // v2 19단계 — 코너맨
  const [showCornerman, setShowCornerman] = useState(false);

  const handleAcademy = onOpenAcademy ?? (() => setShowAcademy(true));
  const handleChallenge = onOpenChallengeArena ?? (() => setShowArena(true));
  const handleJournal = onOpenChampionJournal ?? (() => setShowJournal(true));
  const handleCheer = onOpenSecondCheer ?? (() => setShowCheer(true));

  return (
    <div className="space-y-4">
      <ReturnRoundBanner onOpen={() => setShowReturn(true)} />
      <ConditionGaugeCard onOpen={() => setShowCondition(true)} />
      <OsamiDailyBriefingCard />
      <TodayQuestMiniPanel
        onOpenAcademy={handleAcademy}
        onOpenChallengeArena={handleChallenge}
        onOpenChampionJournal={handleJournal}
      />

      {/* ─── 4번째 카드: 세컨드 응원 (커뮤니티 미션) ─── */}
      <button
        type="button"
        onClick={handleCheer}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            세컨드 응원
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
            오늘 링에 오른 동료에게 박수를 보내세요
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            응원은 공식 레벨업에 영향을 주지 않는 커뮤니티 활동입니다.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
            보상
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-reward">+5 RP</p>
        </div>
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
          열기 →
        </span>
      </button>

      {/* ─── v2 19단계: 코너맨 매칭 ─── */}
      <CornermanCard onOpen={() => setShowCornerman(true)} />

      <BoxingAcademyQuizModal
        open={showAcademy}
        onClose={() => setShowAcademy(false)}
      />

      <FunChallengeArenaSheet
        open={showArena}
        onClose={() => setShowArena(false)}
      />

      <ChampionJournalSheet
        open={showJournal}
        onClose={() => setShowJournal(false)}
      />

      <SecondCheerSheet
        open={showCheer}
        onClose={() => setShowCheer(false)}
      />

      <ConditionGaugeSheet
        open={showCondition}
        onClose={() => setShowCondition(false)}
      />

      <ReturnRoundSheet
        open={showReturn}
        onClose={() => setShowReturn(false)}
      />

      <CornermanSheet
        open={showCornerman}
        onClose={() => setShowCornerman(false)}
      />
    </div>
  );
};

export default HomeEngagementSection;
