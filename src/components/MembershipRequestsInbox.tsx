// 수강권 홀딩·환불 신청 처리 인박스 — 관장(본인 지점)/마스터(전체) 전용.
// 회원이 /membership 에서 신청한 pending 건을 승인/반려. RLS 가 지점 스코프를 강제한다.
// 처리는 process_membership_request RPC(SECURITY DEFINER) — 홀딩 승인 시 만료일 자동 연장.
import { useState, useEffect, useCallback } from "react";
import { Pause, RotateCcw, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PReq {
  id: string;
  user_id: string;
  branch_name: string | null;
  type: string;
  hold_days: number | null;
  reason: string | null;
  created_at: string;
  member_name: string | null;
}

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");

const MembershipRequestsInbox = () => {
  const { role } = useAuth();
  const isStaff = isManagerRole(role);
  const [reqs, setReqs] = useState<PReq[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("membership_requests")
      .select("id, user_id, branch_name, type, hold_days, reason, created_at, member_name")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setReqs((data as PReq[]) || []);
  }, []);

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  if (!isStaff || reqs.length === 0) return null;

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      const { error } = await (supabase as any).rpc("process_membership_request", {
        _request_id: id,
        _approve: approve,
      });
      if (error) throw error;
      toast.success(approve ? "승인 처리했습니다" : "반려했습니다");
      setReqs((p) => p.filter((r) => r.id !== id));
    } catch (e) {
      toast.error("처리 실패: " + ((e as Error)?.message || ""));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-status-pending/30 bg-status-pending/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-status-pending px-1.5 text-[11px] font-bold text-white">
          {reqs.length}
        </span>
        <h3 className="text-sm font-bold text-foreground">수강권 홀딩·환불 신청</h3>
      </div>
      <div className="space-y-2">
        {reqs.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">
              {r.member_name || "회원"}
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {r.type === "hold" ? (
                  <>
                    <Pause className="h-3 w-3" /> 홀딩 {r.hold_days ?? "-"}일
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3" /> 환불
                  </>
                )}
              </span>
            </p>
            {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {r.branch_name ? r.branch_name + " · " : ""}
              {fmt(r.created_at)}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => act(r.id, true)}
                disabled={busy === r.id}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-status-complete py-2 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> 승인
              </button>
              <button
                onClick={() => act(r.id, false)}
                disabled={busy === r.id}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted py-2 text-xs font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> 반려
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        홀딩 승인 시 만료일이 신청 일수만큼 자동 연장됩니다. 환불 승인은 신청 기록만 처리되며, 실제 환불 정산은 별도로 진행하세요.
      </p>
    </div>
  );
};

export default MembershipRequestsInbox;
