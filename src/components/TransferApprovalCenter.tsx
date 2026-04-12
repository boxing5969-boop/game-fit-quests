import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Check, X, ArrowRight, MapPin } from "lucide-react";
import { toast } from "sonner";

const TransferApprovalCenter = () => {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["transfer-requests"],
    enabled: role === "super_admin" || role === "admin" || role === "branch_manager",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_transfer_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = data.map(t => t.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, nickname, name, avatar_url").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return data.map(t => ({
        ...t,
        profile: profileMap.get(t.user_id),
      }));
    },
  });

  const approveMut = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("approve_branch_transfer", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("지점 이전 승인 완료"); qc.invalidateQueries({ queryKey: ["transfer-requests"] }); },
    onError: (e: any) => toast.error(e.message || "승인 실패"),
  });

  const rejectMut = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("reject_branch_transfer", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => { toast.info("지점 이전 반려 완료"); qc.invalidateQueries({ queryKey: ["transfer-requests"] }); },
    onError: (e: any) => toast.error(e.message || "반려 실패"),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>;
  }

  if (!transfers?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-3xl">🔄</span>
        <p className="mt-2 text-sm text-muted-foreground">대기 중인 지점 이전 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-foreground">지점 이전 요청 ({transfers.length}건)</p>
      {transfers.map(t => (
        <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
              {(t.profile as any)?.nickname?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{(t.profile as any)?.nickname || "회원"}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3" />
                <span>{t.from_branch}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-bold text-primary">{t.to_branch}</span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(t.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => approveMut.mutate(t.id)}
              disabled={approveMut.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-status-complete py-2 text-sm font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> 승인
            </button>
            <button
              onClick={() => rejectMut.mutate(t.id)}
              disabled={rejectMut.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive/10 py-2 text-sm font-bold text-destructive active:scale-95 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> 반려
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransferApprovalCenter;
