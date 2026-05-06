/**
 * 153 QUEST v1.5 17단계 — 성장 리포트 카드 (MyPage).
 *
 * 공식 성장 (읽기 전용) + QUEST 성장 분리 표시 + 오삼 코멘트 + 학부모/코치 한 줄.
 *
 * 보호 원칙:
 *   · member_progress 는 SELECT 만 (useAuth().progress)
 *   · 데이터는 useGrowthReport (서버 RPC + 표시용 합산)
 *   · 본 카드는 표시 전용 — 보상 / mutation 0
 */

import { useState } from "react";
import { ClipboardList, Eye } from "lucide-react";

import { useGrowthReport } from "@/hooks/useGrowthReport";
import { GROWTH_REPORT_DISCLAIMERS } from "@/data/growthReportMessages";
import { RANK_LABELS } from "@/data/sharedConstants";
import type { Enums } from "@/integrations/supabase/types";

import GrowthReportDetailSheet from "./GrowthReportDetailSheet";

const GrowthReportCard = () => {
  const { report, isLoading } = useGrowthReport();
  const [showDetail, setShowDetail] = useState(false);

  const rank =
    (report?.official.currentRank ?? "white") as Enums<"rank_name">;

  return (
    <>
      <section
        data-tour="growth-report-card"
        className="surface-card border border-border bg-card"
        aria-label="성장 리포트"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              성장 리포트
            </p>
            <h3 className="mt-0.5 text-[15px] font-bold text-foreground">
              공식 성장 + QUEST 성장 분리 요약
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              회원 / 학부모 / 코치 모두 보기 좋은 성장 한 페이지.
            </p>
          </div>
        </div>

        {isLoading || !report ? (
          <p className="text-[11.5px] text-muted-foreground">
            리포트를 만드는 중…
          </p>
        ) : (
          <>
            {/* 공식 성장 */}
            <div className="mb-2">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                공식 성장 · 읽기 전용
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    리그·레벨
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {RANK_LABELS[rank]} {report.official.currentLevel}
                  </p>
                </div>
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    공식 XP
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {report.official.totalXp.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    출석/보스
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {report.official.streakDays}일·
                    {report.official.bossesCleared}회
                  </p>
                </div>
              </div>
            </div>

            {/* QUEST 성장 */}
            <div className="mb-2">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                QUEST 성장 · 보조 경험치
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    QUEST XP
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {report.quest.questXp.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    퀴즈 정답
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {report.quest.quizCorrect} / {report.quest.quizAttempts}
                  </p>
                </div>
                <div className="rounded-card border border-border bg-background/40 px-3 py-2">
                  <p className="text-[9.5px] uppercase text-muted-foreground">
                    챌린지·일기
                  </p>
                  <p className="number-font mt-0.5 text-[13px] font-black text-foreground">
                    {report.quest.challengeClear}·{report.quest.journalCount}
                  </p>
                </div>
              </div>
            </div>

            {/* 오삼 코멘트 */}
            <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                오삼 코치
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-foreground">
                {report.osamiComment}
              </p>
            </div>

            {/* 학부모/코치 한 줄 */}
            <div className="mt-2 rounded-card border border-border bg-background/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                학부모 / 코치 한 줄
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
                {report.parentCoachOneLiner}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-card border border-border bg-card py-2.5 text-[12.5px] font-bold text-primary transition-all active:scale-[0.99] hover:border-primary/40"
            >
              <Eye className="h-3.5 w-3.5" />
              성장 리포트 보기
            </button>
          </>
        )}

        <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          {GROWTH_REPORT_DISCLAIMERS[0]}
        </p>
      </section>

      <GrowthReportDetailSheet
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
};

export default GrowthReportCard;
