/**
 * 153 QUEST v2 22단계 — 코치 대시보드: 칭찬 대상 회원 패널.
 *
 * 이번 주 두드러진 활동 회원 (퀴즈/챌린지/일기/응원/복귀).
 * 코치가 클릭 시 회원 상세 페이지로 이동.
 */

import { useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";

import type { CoachPraiseTarget } from "@/services/boxingEngagementService";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

interface Props {
  targets: CoachPraiseTarget[];
}

const QuestPraiseTargetsPanel = ({ targets }: Props) => {
  const navigate = useNavigate();

  if (targets.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          칭찬 대상 회원
        </p>
        <div className="rounded-card border border-border bg-background/40 p-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            이번 주 활동 데이터가 누적되면 칭찬 대상이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        칭찬 대상 — 오늘 한마디 보내기
      </p>
      <ul className="space-y-1.5">
        {targets.slice(0, 10).map((t) => (
          <li key={t.user_id}>
            <button
              type="button"
              onClick={() => navigate(`/member/${t.user_id}`)}
              className="flex w-full items-center gap-3 rounded-card border border-primary/20 bg-primary/5 px-3 py-2.5 text-left transition-all active:scale-[0.99] hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-foreground">
                  {t.display_name}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {RANK_LABELS[t.current_rank] ?? t.current_rank} Lv.
                  {t.current_level}
                </p>
                <p className="mt-0.5 text-[10.5px] text-primary">{t.reason}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {t.metric}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QuestPraiseTargetsPanel;
