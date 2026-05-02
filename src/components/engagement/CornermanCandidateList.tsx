/**
 * 153 QUEST v2 19단계 — 코너맨 후보 리스트.
 *
 * 같은 지점 회원 + active pair 없는 회원만 후보로 보임.
 * 민감정보 미노출 — display_name + rank + level 만.
 */

import { Loader2, UserPlus } from "lucide-react";

import { RANK_KOREAN_LABEL } from "@/data/cornermanMessages";
import type { CornermanCandidate } from "@/services/boxingEngagementService";

export interface CornermanCandidateListProps {
  candidates: CornermanCandidate[];
  isLoading: boolean;
  pendingUserId: string | null;
  onRequest: (userId: string) => void;
}

const CornermanCandidateList = ({
  candidates,
  isLoading,
  pendingUserId,
  onRequest,
}: CornermanCandidateListProps) => {
  if (isLoading) {
    return (
      <p className="text-[12px] text-muted-foreground">후보를 불러오는 중…</p>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-card border border-border bg-background/40 p-3.5">
        <p className="text-[12.5px] leading-relaxed text-foreground">
          지금 매칭 가능한 같은 지점 회원이 없습니다.
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          신규 회원이 가입하거나 다른 회원의 코너맨 관계가 종료되면 후보로
          표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {candidates.map((c) => {
        const isPending = pendingUserId === c.user_id;
        return (
          <li
            key={c.user_id}
            className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-foreground">
                {c.display_name}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {RANK_KOREAN_LABEL[c.current_rank] ?? c.current_rank} 리그 · Lv.
                {c.current_level}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRequest(c.user_id)}
              disabled={isPending}
              className={`shrink-0 rounded-card border px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                isPending
                  ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                  : "border-primary bg-primary text-primary-foreground active:scale-[0.98]"
              }`}
            >
              {isPending ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  요청 중
                </span>
              ) : (
                "요청 보내기"
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default CornermanCandidateList;
