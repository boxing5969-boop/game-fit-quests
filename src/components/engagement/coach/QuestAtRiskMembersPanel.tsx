/**
 * 153 QUEST v2 22단계 — 코치 대시보드: 복귀 필요 회원 패널.
 *
 * RPC 가 inactive_days 기준 정렬 + suggested_action 매핑.
 * 민감정보 미표시 (RPC 화이트리스트로 차단).
 */

import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

import type { CoachAtRiskMember } from "@/services/boxingEngagementService";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

interface Props {
  members: CoachAtRiskMember[];
}

const QuestAtRiskMembersPanel = ({ members }: Props) => {
  const navigate = useNavigate();

  if (members.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          복귀 필요 회원
        </p>
        <div className="rounded-card border border-emerald-400/30 bg-emerald-400/5 p-3">
          <p className="text-[12px] leading-relaxed text-foreground">
            🎉 7일 이상 비활동 회원이 없습니다. 모두 꾸준히 활동 중!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-500" />
        복귀 필요 회원 ({members.length}명)
      </p>
      <ul className="space-y-1.5">
        {members.slice(0, 10).map((m) => (
          <li key={m.user_id}>
            <button
              type="button"
              onClick={() => navigate(`/member/${m.user_id}`)}
              className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 text-left transition-all active:scale-[0.99] hover:border-amber-400/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-foreground">
                  {m.display_name}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {RANK_LABELS[m.current_rank] ?? m.current_rank} Lv.
                  {m.current_level} · 비활동 {m.inactive_days}일
                </p>
                <p className="mt-0.5 text-[10.5px] text-amber-700">
                  {m.suggested_action}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {members.length > 10 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          ... 외 {members.length - 10}명
        </p>
      )}
    </div>
  );
};

export default QuestAtRiskMembersPanel;
