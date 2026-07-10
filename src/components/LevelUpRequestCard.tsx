// 레벨업 신청 카드 — 서버 집계(get_level_cycle_progress) 3·3·3 표시 + 신청(request_level_review).
// 회원이 출석 3회·3일·훈련 180분을 채우면 코치/관장에게 레벨업 심사를 신청한다.
// 코치 승인은 CoachLevelReviewInbox → approve_level_review 로 실제 레벨을 올린다.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface Cycle {
  sessions: number; days: number; minutes: number;
  reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean;
}

const Bar = ({ label, cur, req, unit }: { label: string; cur: number; req: number; unit: string }) => {
  const pct = Math.min(100, Math.round((cur / Math.max(1, req)) * 100));
  const done = cur >= req;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className={done ? "font-bold text-status-complete" : "text-muted-foreground"}>
          {cur}/{req}{unit}{done ? " ✓" : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${done ? "bg-status-complete" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const LevelUpRequestCard = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  // 현재 레벨 심사 상태 (pending 이면 이미 신청됨)
  const { data: statusNow } = useQuery({
    queryKey: ["my-level-status", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: mp } = await supabase
        .from("member_progress")
        .select("current_rank, current_level")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!mp) return null;
      const m = mp as { current_rank: string; current_level: number };
      const { data } = await (supabase as any)
        .from("level_status")
        .select("status")
        .eq("user_id", user!.id)
        .eq("rank_name", m.current_rank)
        .eq("level_number", m.current_level)
        .maybeSingle();
      return (data?.status as string) ?? null;
    },
  });

  const req = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("request_level_review", {});
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("레벨업 신청 완료 — 코치님 승인을 기다려주세요!");
      qc.invalidateQueries({ queryKey: ["my-level-status"] });
      qc.invalidateQueries({ queryKey: ["level-cycle"] });
    },
    onError: (e: any) => toast.error(e?.message || "신청 실패"),
  });

  if (!cycle) return null;
  const isPending = statusNow === "pending";
  const isRevision = statusNow === "revision_requested";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
      <p className="mb-1 text-sm font-black text-foreground">레벨업 조건</p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        출석 3회 · 서로 다른 3일 · 훈련 180분을 채우면 코치님께 레벨업을 신청할 수 있어요. 코치님이 자세를 확인하고 승인하면 레벨이 오릅니다.
      </p>
      <div className="space-y-2.5">
        <Bar label="출석" cur={cycle.sessions} req={cycle.reqSessions} unit="회" />
        <Bar label="출석일" cur={cycle.days} req={cycle.reqDays} unit="일" />
        <Bar label="훈련시간" cur={cycle.minutes} req={cycle.reqMinutes} unit="분" />
      </div>

      {isRevision && (
        <p className="mt-3 rounded-lg bg-status-pending/10 px-3 py-2 text-[11px] font-semibold text-status-pending">
          ✏️ 코치님이 보완을 요청했어요. 부족한 부분을 더 연습한 뒤 다시 신청해 주세요.
        </p>
      )}

      {isPending ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-status-pending/10 py-3 text-sm font-bold text-status-pending">
          ⏳ 심사 대기중 — 코치님 승인을 기다리는 중
        </div>
      ) : (
        <button
          onClick={() => req.mutate()}
          disabled={!cycle.meets || req.isPending}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> {cycle.meets ? "레벨업 신청하기" : "조건을 더 채워주세요"}
        </button>
      )}
    </div>
  );
};

export default LevelUpRequestCard;
