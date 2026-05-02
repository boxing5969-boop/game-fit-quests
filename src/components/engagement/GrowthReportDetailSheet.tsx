/**
 * 153 QUEST v1.5 17단계 — 성장 리포트 상세 시트.
 *
 * 보호 원칙:
 *   · member_progress 는 SELECT 만
 *   · 보상 amount 처리 0 — 표시 전용 시트
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 */

import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, X } from "lucide-react";

import { useGrowthReport } from "@/hooks/useGrowthReport";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { GROWTH_REPORT_DISCLAIMERS } from "@/data/growthReportMessages";
import { RANK_LABELS } from "@/data/sharedConstants";
import type { Enums } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const GrowthReportDetailSheet = ({ open, onClose }: Props) => {
  // open=false 일 때는 useGrowthReport 의 useQuery 들이 마운트되어 있어도
  // staleTime 으로 보호. 이미 카드에서 동일 키 쿼리가 워밍업되어 있어 추가 RPC 0.
  useModalDismiss(open, onClose);
  const { report } = useGrowthReport(open);

  const rank =
    (report?.official.currentRank ?? "white") as Enums<"rank_name">;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="성장 리포트 상세"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    성장 리포트 상세
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    공식 + QUEST 성장 분리 요약
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {!report ? (
                <p className="text-[12px] text-muted-foreground">
                  리포트를 만드는 중…
                </p>
              ) : (
                <>
                  {/* 공식 */}
                  <div className="rounded-card border border-border bg-background/40 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      공식 성장 (읽기 전용)
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[12.5px] text-foreground">
                      <li>
                        리그 / 레벨: <strong>{RANK_LABELS[rank]} Lv.{report.official.currentLevel}</strong>
                      </li>
                      <li>
                        총 공식 XP:{" "}
                        <strong>{report.official.totalXp.toLocaleString()}</strong>
                      </li>
                      <li>
                        보스 클리어: <strong>{report.official.bossesCleared}회</strong>
                      </li>
                      <li>
                        연속 출석: <strong>{report.official.streakDays}일</strong>
                      </li>
                    </ul>
                  </div>

                  {/* QUEST */}
                  <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                      QUEST 성장 (보조)
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[12.5px] text-foreground">
                      <li>QUEST XP: <strong>{report.quest.questXp.toLocaleString()}</strong></li>
                      <li>RP: <strong>{report.quest.respect.toLocaleString()}</strong></li>
                      <li>
                        퀴즈 정답: <strong>{report.quest.quizCorrect}회</strong> /
                        {" "}{report.quest.quizAttempts}회 시도
                      </li>
                      <li>
                        챌린지 클리어: <strong>{report.quest.challengeClear}회</strong> /
                        {" "}{report.quest.challengeAttempts}회 시도
                      </li>
                      <li>
                        챔피언 일기: <strong>{report.quest.journalCount}회</strong>
                      </li>
                      <li>
                        세컨드 응원: 보냄 <strong>{report.quest.cheerSent}</strong> · 받음{" "}
                        <strong>{report.quest.cheerReceived}</strong>
                      </li>
                      <li>
                        숨겨진 미션 획득:{" "}
                        <strong>{report.quest.hiddenMissionClaimed}개</strong>
                      </li>
                      <li>
                        컨디션 기록:{" "}
                        <strong>{report.quest.conditionLogCount}회</strong>
                      </li>
                      <li>
                        리턴 라운드 활성:{" "}
                        <strong>
                          {report.quest.hasReturnRound ? "예" : "아니오"}
                        </strong>
                      </li>
                    </ul>
                  </div>

                  {/* 코멘트 + 학부모 */}
                  <div className="rounded-card border border-border bg-card p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                      오삼 코치
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">
                      {report.osamiComment}
                    </p>
                  </div>
                  <div className="rounded-card border border-border bg-card p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      학부모 / 코치 한 줄
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">
                      {report.parentCoachOneLiner}
                    </p>
                  </div>

                  {/* 면책 */}
                  <div className="rounded-card border border-amber-400/30 bg-amber-400/5 p-3">
                    <ul className="space-y-1 text-[10.5px] leading-relaxed text-muted-foreground">
                      {GROWTH_REPORT_DISCLAIMERS.map((d) => (
                        <li key={d}>※ {d}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GrowthReportDetailSheet;
