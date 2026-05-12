/**
 * 153 QUEST — 홈 화면 몰입 섹션 컨테이너.
 *
 * HomePage 에는 본 컴포넌트 하나만 import 한다.
 * 7단계에서 복싱 IQ 모달은 본 컴포넌트가 자체 관리하도록 연결.
 * 챌린지 아레나/챔피언 일기는 8단계에서 onOpenXxx 콜백으로 교체.
 */

import { useState } from "react";
import { BookOpen, Megaphone } from "lucide-react";

import OsamiDailyBriefingCard from "./OsamiDailyBriefingCard";
import TodayQuestMiniPanel from "./TodayQuestMiniPanel";
import BoxingAcademyQuizModal from "./BoxingAcademyQuizModal";
import FunChallengeArenaSheet from "./FunChallengeArenaSheet";
import ChampionJournalSheet from "./ChampionJournalSheet";
import SecondCheerSheet from "./SecondCheerSheet";
import ReturnRoundBanner from "./ReturnRoundBanner";
import ReturnRoundSheet from "./ReturnRoundSheet";
import CornermanCard from "./CornermanCard";
import CornermanSheet from "./CornermanSheet";
import GymRaidCard from "./GymRaidCard";

export interface HomeEngagementSectionProps {
  /** 외부에서 복싱 IQ 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 모달을 연다. */
  onOpenAcademy?: () => void;
  /** 외부에서 챌린지 아레나 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenChallengeArena?: () => void;
  /** 외부에서 챔피언 일기 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenChampionJournal?: () => void;
  /** 외부에서 세컨드 응원 진입을 가로채고 싶을 때만 지정. 기본은 본 컴포넌트가 시트를 연다. */
  onOpenSecondCheer?: () => void;
  /**
   * 64-AS: 카드 렌더 모드.
   *   · 'all' (기본) — 홈 등 모든 카드 (개인 + 커뮤니티)
   *   · 'personal' — 153 QUEST: 리턴 라운드 / 컨디션 / 오삼 브리핑 / 오늘의 퀘스트 미니
   *   · 'community' — 153 커뮤니티: 세컨드 응원 / 코너맨 / 짐 레이드
   */
  mode?: "all" | "personal" | "community";
}

const HomeEngagementSection = ({
  onOpenAcademy,
  onOpenChallengeArena,
  onOpenChampionJournal,
  onOpenSecondCheer,
  mode = "all",
}: HomeEngagementSectionProps) => {
  const [showAcademy, setShowAcademy] = useState(false);
  const [showArena, setShowArena] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showCheer, setShowCheer] = useState(false);
  // v1.5 15단계 — 리턴 라운드
  const [showReturn, setShowReturn] = useState(false);
  // v2 19단계 — 코너맨
  const [showCornerman, setShowCornerman] = useState(false);

  const handleAcademy = onOpenAcademy ?? (() => setShowAcademy(true));
  const handleChallenge = onOpenChallengeArena ?? (() => setShowArena(true));
  const handleJournal = onOpenChampionJournal ?? (() => setShowJournal(true));
  const handleCheer = onOpenSecondCheer ?? (() => setShowCheer(true));

  // 64-AS: mode 별 카드 분리
  const showPersonal = mode === "all" || mode === "personal";
  const showCommunity = mode === "all" || mode === "community";

  return (
    <div className="space-y-4">
      {showPersonal && (
        <>
          <ReturnRoundBanner onOpen={() => setShowReturn(true)} />
          {/* 컨디션 게이지는 챔피언 일기 시트로 통합됨 — 일기 작성 시 함께 기록. */}
          <OsamiDailyBriefingCard />
          <TodayQuestMiniPanel
            onOpenAcademy={handleAcademy}
            onOpenChallengeArena={handleChallenge}
            onOpenChampionJournal={handleJournal}
          />
        </>
      )}

      {showCommunity && (
        <>
      {/* ─── 챔피언 일기 (153 챌린지에서 153 커뮤니티 로 이관) ─── */}
      <button
        type="button"
        onClick={handleJournal}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            챔피언 일기
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
            오늘의 컨디션 + 한 줄 회고
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            파트너 (코너맨 / 세컨드) 가 열람하고 댓글로 응원합니다.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
            보상
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-reward">+20 XP · +50</p>
        </div>
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
          열기 →
        </span>
      </button>

      {/* ─── 세컨드 응원 (커뮤니티 미션) ─── */}
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

      {/* ─── v2 21단계: 짐 레이드 (지점 누적 목표) ─── */}
      <GymRaidCard />
        </>
      )}

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
