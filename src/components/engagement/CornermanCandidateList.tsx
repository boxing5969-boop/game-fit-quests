/**
 * 153 QUEST v2 19단계 — 코너맨 후보 리스트.
 *
 * 같은 지점 회원 + active pair 없는 회원만 후보로 보임.
 * 민감정보 미노출 — display_name + rank + level 만.
 *
 * 2026-09-30: 전체관리자 계정은 전 지점 회원이 보인다(showBranch — 이름 옆에 지점).
 * 2026-10-18: 전체관리자도 회원처럼 요청 버튼이 보인다(대표님: "본사 계정도 모든 기능을 해볼 수 있게") —
 *   요청은 서버(request_cornerman_pair)가 같은 지점끼리만 받는다.
 *   이름을 누르면 회원 카드(openMemberCard) · 이름 찾기 결과는 state 로 '짝꿍 있음/대기 중'을 보인다.
 */

import { Loader2, UserPlus } from "lucide-react";

import { RANK_KOREAN_LABEL } from "@/data/cornermanMessages";
import type { CornermanCandidate } from "@/services/boxingEngagementService";
import { toGlobalLevel } from "@/lib/rankLabels";
import { openMemberCard } from "@/lib/appEvents";

export type CornermanListItem = CornermanCandidate & { state?: "available" | "paired" | "pending" };

export interface CornermanCandidateListProps {
  candidates: CornermanListItem[];
  isLoading: boolean;
  pendingUserId: string | null;
  onRequest: (userId: string) => void;
  /** 전 지점 목록 — 이름 옆에 지점 이름 */
  showBranch?: boolean;
  /** 비었을 때 문구 (이름 찾기 결과 등) */
  emptyText?: string;
  emptyHint?: string;
}

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

const CornermanCandidateList = ({
  candidates,
  isLoading,
  pendingUserId,
  onRequest,
  showBranch = false,
  emptyText,
  emptyHint,
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
          {emptyText ?? "지금 매칭 가능한 같은 지점 회원이 없습니다."}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {emptyHint ?? "신규 회원이 가입하거나 다른 회원의 짝꿍 관계가 끝나면 후보로 표시됩니다."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {candidates.map((c) => {
        const isPending = pendingUserId === c.user_id;
        const state = c.state ?? "available";
        return (
          <li
            key={c.user_id}
            className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
          >
            {/* 이름(과 아이콘)을 누르면 회원 카드 — 좋아요 · 메시지 · 응원 · 짝꿍 신청 */}
            <button
              type="button"
              onClick={() => openMemberCard(c.user_id)}
              aria-label={`${c.display_name}님 회원 카드 보기`}
              className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
                <UserPlus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-foreground">
                  {c.display_name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {RANK_KOREAN_LABEL[c.current_rank] ?? c.current_rank} 리그 · Lv.
                  {toGlobalLevel(c.current_rank, c.current_level)}
                  {showBranch && c.branch_name ? ` · ${shortBranch(c.branch_name)}` : ""}
                </span>
              </span>
            </button>
            {state === "paired" ? (
              <span className="shrink-0 rounded-pill bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                짝꿍 있음
              </span>
            ) : state === "pending" ? (
              <span className="shrink-0 rounded-pill bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                요청 대기 중
              </span>
            ) : (
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
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default CornermanCandidateList;
