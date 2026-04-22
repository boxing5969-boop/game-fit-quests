import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Filter, Inbox } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import { usePendingDietLogs } from "@/hooks/useDietCoach";
import DietApprovalCard from "@/components/diet/coach/DietApprovalCard";
import { cn } from "@/lib/utils";

/**
 * /coach/diet — 코치용 식습관 승인 인박스.
 *
 * 기존 ApprovalInbox 를 건드리지 않고 별도 페이지로 구성.
 * (ApprovalInbox 는 미션/퀘스트/가입 승인 전용 — Stage 1 감사 참고)
 *
 * 필터
 *   • 정렬: "오래된 순" (SLA) / "최신 순"
 *   • 필터: 전체 / 사진 있음만 / 사진 없음 / 누락 회원
 *
 * 누락(Stale) 은 서버 권장이 아닌 UI 필터 — 운영 편의.
 * "주의 필요" 플래그는 `warning_flags` 에서 읽어와 칩 표시.
 */
const DietCoachInboxPage = () => {
  const navigate = useNavigate();
  const pending = usePendingDietLogs(40);
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [filter, setFilter] = useState<"all" | "with_photo" | "no_photo">("all");

  // 병렬 조회: log 별 photosCount (간단히 COUNT 쿼리 1회)
  const logIds = (pending.data ?? []).map((p) => p.log.id);
  const photoCounts = usePhotoCounts(logIds);

  const items = useMemo(() => {
    const arr = [...(pending.data ?? [])];
    arr.sort((a, b) => {
      const da = new Date(a.log.submitted_at).getTime();
      const db = new Date(b.log.submitted_at).getTime();
      return sort === "oldest" ? da - db : db - da;
    });
    if (filter === "with_photo") {
      return arr.filter((p) => (photoCounts.data?.[p.log.id] ?? 0) > 0);
    }
    if (filter === "no_photo") {
      return arr.filter((p) => (photoCounts.data?.[p.log.id] ?? 0) === 0);
    }
    return arr;
  }, [pending.data, sort, filter, photoCounts.data]);

  return (
    <AppPage
      header={
        <PageHeader
          title="식습관 승인"
          subtitle="오늘의 회원 체크인을 검토해요"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/coach")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="코치 대시보드로"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-3 pt-2">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleChip
            active={sort === "oldest"}
            onClick={() => setSort("oldest")}
            label="오래된 순"
          />
          <ToggleChip
            active={sort === "newest"}
            onClick={() => setSort("newest")}
            label="최신 순"
          />
          <span className="mx-1 h-4 w-px bg-border" />
          <ToggleChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="전체"
          />
          <ToggleChip
            active={filter === "with_photo"}
            onClick={() => setFilter("with_photo")}
            label="사진 있음"
          />
          <ToggleChip
            active={filter === "no_photo"}
            onClick={() => setFilter("no_photo")}
            label="사진 없음"
          />
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          검토 대기 {items.length}건
        </div>

        {/* 리스트 */}
        {pending.isLoading ? (
          <PlaceholderCard>불러오는 중...</PlaceholderCard>
        ) : items.length === 0 ? (
          <PlaceholderCard>
            <div className="flex flex-col items-center gap-1.5 py-4">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              <p className="text-[13px] font-bold text-foreground">
                검토할 체크인이 없어요
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                승인된 기록은 멤버 상세에서 확인할 수 있어요.
              </p>
            </div>
          </PlaceholderCard>
        ) : (
          <ul className="space-y-2.5">
            {items.map(({ log, nickname, avatar_url }) => (
              <li key={log.id}>
                <DietApprovalCard
                  log={log}
                  nickname={nickname}
                  avatarUrl={avatar_url}
                  photosCount={photoCounts.data?.[log.id] ?? 0}
                  onOpenMember={(uid) => navigate(`/coach/diet/member/${uid}`)}
                  onReviewed={() => pending.refetch()}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => pending.refetch()}>
            새로고침
          </Button>
        </div>
      </div>
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────
const ToggleChip = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-card text-muted-foreground hover:border-primary/40",
    )}
  >
    {label}
  </button>
);

const PlaceholderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
    {children}
  </div>
);

/** 로그 ID 배열로부터 사진 count 를 한 번에 조회 */
function usePhotoCounts(logIds: string[]) {
  return useQuery({
    queryKey: ["diet", "coach", "photoCounts", logIds.slice().sort().join(",")],
    enabled: logIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const map: Record<string, number> = {};
      if (logIds.length === 0) return map;
      const { data, error } = await supabase
        .from("diet_daily_log_photos")
        .select("log_id")
        .in("log_id", logIds);
      if (error) throw error;
      for (const row of data ?? []) {
        map[row.log_id] = (map[row.log_id] ?? 0) + 1;
      }
      return map;
    },
  });
}

export default DietCoachInboxPage;
