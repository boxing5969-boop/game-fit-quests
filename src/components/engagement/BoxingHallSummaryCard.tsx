/**
 * 153 QUEST — 나만의 복싱 전당 요약 카드 (MyPage 삽입용).
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 일절 미수정 — 읽기만
 *   · user_wallets 미수정 — 표시 전용
 *   · ChatAssistant 미참조 / 새 AI 챗박스 0건
 *   · 새 route 0건 — 캐릭터 스튜디오 navigate 만 호출
 *
 * 데이터:
 *   useAuth().progress (공식 — 읽기만)
 *   useWallet() (파이트 머니 — 읽기만)
 *   useBoxingEngagementSummary() (QUEST 보조)
 */

import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Brain,
  ClipboardList,
  Megaphone,
  Swords,
  Trophy,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useBoxingEngagementSummary } from "@/hooks/useBoxingEngagement";

import BoxingHallStatTile from "./BoxingHallStatTile";
import LeagueStoryBadge from "./LeagueStoryBadge";
import OsamiHallComment from "./OsamiHallComment";

const BoxingHallSummaryCard = () => {
  const navigate = useNavigate();
  const { progress, role } = useAuth();
  const { data: wallet } = useWallet();
  const { data: summary, isLoading: summaryLoading } =
    useBoxingEngagementSummary();

  if (!progress) return null;

  const rank = progress.current_rank ?? "white";
  const level = progress.current_level ?? 1;
  const totalXp = progress.total_xp ?? 0;
  const bossesCleared = progress.bosses_cleared ?? 0;

  const questXp = summary?.quest_xp ?? 0;
  const respect = summary?.respect_points ?? 0;
  const quizCorrect = summary?.quiz_correct_count ?? 0;
  const challengeClear = summary?.challenge_clear_count ?? 0;
  const journalCount = summary?.journal_count ?? 0;
  const cheerSent = summary?.cheer_sent_count ?? 0;
  const cheerReceived = summary?.cheer_received_count ?? 0;

  const isAdmin = role === "admin" || role === "super_admin";
  const gemsBalance = wallet?.gems_balance ?? 0;
  const gemsDisplay = isAdmin ? "∞" : gemsBalance.toLocaleString();

  return (
    <section
      className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1"
      aria-label="나만의 복싱 전당"
    >
      {/* Header */}
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
          나의 트로피 룸
        </p>
        <h2 className="mt-0.5 text-[16px] font-bold text-foreground">
          나만의 복싱 전당
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          공식 성장은 코치 기준으로, QUEST 기록은 습관과 몰입으로 쌓입니다.
        </p>
      </div>

      {/* A. 계급 스토리 */}
      <LeagueStoryBadge rank={rank} level={level} />

      {/* A. 공식 성장 (읽기만) */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          공식 성장 · 읽기 전용
        </p>
        <div className="grid grid-cols-3 gap-2">
          <BoxingHallStatTile
            icon={<Trophy className="h-3 w-3" />}
            label="공식 XP"
            value={totalXp}
          />
          <BoxingHallStatTile
            icon="🥊"
            label="레벨"
            value={`Lv.${level}`}
          />
          <BoxingHallStatTile
            icon="🏆"
            label="보스 클리어"
            value={`${bossesCleared}회`}
          />
        </div>
      </div>

      {/* B. QUEST 성장 (보조) — 초기 로드 시 skeleton */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          QUEST 성장 · 보조 경험치
        </p>
        <div className="grid grid-cols-3 gap-2">
          <BoxingHallStatTile
            icon={<Brain className="h-3 w-3" />}
            label="QUEST XP"
            value={questXp}
            tone="primary"
            loading={summaryLoading}
          />
          <BoxingHallStatTile
            icon="🎖"
            label="RP"
            value={respect}
            tone="primary"
            loading={summaryLoading}
          />
          <BoxingHallStatTile
            icon={<Brain className="h-3 w-3" />}
            label="퀴즈 정답"
            value={quizCorrect}
            loading={summaryLoading}
          />
          <BoxingHallStatTile
            icon={<Swords className="h-3 w-3" />}
            label="챌린지 클리어"
            value={challengeClear}
            loading={summaryLoading}
          />
          <BoxingHallStatTile
            icon={<ClipboardList className="h-3 w-3" />}
            label="일기"
            value={journalCount}
            loading={summaryLoading}
          />
          <BoxingHallStatTile
            icon={<Megaphone className="h-3 w-3" />}
            label="응원 보냄/받음"
            value={`${cheerSent}/${cheerReceived}`}
            loading={summaryLoading}
          />
        </div>
      </div>

      {/* C. 파이트 머니 + CTA */}
      <button
        type="button"
        onClick={() => navigate("/character-studio")}
        className="mt-3 flex w-full items-center gap-3 rounded-card border border-border bg-gradient-to-r from-primary/10 to-reward/10 px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Banknote className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-reward">
            파이트 머니
          </p>
          <p className="number-font mt-0.5 text-[16px] font-black text-foreground">
            {gemsDisplay}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-primary">
          캐릭터 스튜디오 →
        </span>
      </button>

      {/* E. 오삼 코멘트 */}
      <div className="mt-3">
        <OsamiHallComment
          summary={{
            questXp,
            questCorrect: quizCorrect,
            challengeClear,
            respect,
            journalCount,
          }}
        />
      </div>

      {/* 안내 문구 */}
      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ QUEST XP 는 공식 레벨 XP 와 분리된 보조 경험치입니다. 공식 레벨업은
        기존 훈련 미션과 코치 승인 기준으로 진행됩니다.
      </p>
    </section>
  );
};

export default BoxingHallSummaryCard;
