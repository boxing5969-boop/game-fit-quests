import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import { Undo2, Clock } from "lucide-react";
import { RANK_LABELS } from "@/lib/rankLabels";
import type { Enums } from "@/integrations/supabase/types";

const STATUS_OPTIONS: { value: Enums<"level_status_type">; label: string; emoji: string; color: string }[] = [
  { value: "locked", label: "잠금", emoji: "🔒", color: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "진행중", emoji: "▶️", color: "bg-primary/10 text-primary" },
  { value: "pending", label: "승인대기", emoji: "⏳", color: "bg-status-pending/10 text-status-pending" },
  { value: "approved", label: "완료", emoji: "✅", color: "bg-status-complete/10 text-status-complete" },
  { value: "revision_requested", label: "수정요청", emoji: "✏️", color: "bg-amber-500/10 text-amber-600" },
  { value: "rejected", label: "반려", emoji: "❌", color: "bg-destructive/10 text-destructive" },
  { value: "boss_cleared", label: "보스전 완료", emoji: "🏆", color: "bg-reward/10 text-reward" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  rank: Enums<"rank_name">;
  level: number;
  currentStatus: string;
}

const LevelStatusActionSheet = ({ open, onOpenChange, memberId, rank, level, currentStatus }: Props) => {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  // History
  const { data: history } = useQuery({
    queryKey: ["level-status-history", memberId, rank, level],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("level_status_history" as any)
        .select("*")
        .eq("user_id", memberId)
        .eq("rank_name", rank)
        .eq("level_number", level)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });

  // 회원의 현재 레벨 — '완료/수정요청'을 실제 레벨업 경로로 보낼지 판단.
  const { data: prog } = useQuery({
    queryKey: ["mp-current", memberId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_progress")
        .select("current_rank, current_level")
        .eq("user_id", memberId)
        .maybeSingle();
      return (data as { current_rank: string; current_level: number } | null) ?? null;
    },
  });
  const isCurrentLevel = !!prog && prog.current_rank === rank && prog.current_level === level;

  const setStatusMut = useMutation({
    mutationFn: async (newStatus: string) => {
      // 현재 레벨의 '완료/수정요청' → 실제 레벨업(approve_level_review). 그 외 상태는 기록만.
      if (isCurrentLevel && (newStatus === "approved" || newStatus === "revision_requested")) {
        const { error } = await (supabase.rpc as any)("approve_level_review", {
          _member_id: memberId,
          _approve: newStatus === "approved",
          _note: reason || null,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc("set_level_status", {
        _member_id: memberId,
        _rank: rank as any,
        _level: level,
        _status: newStatus as any,
        _note: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isCurrentLevel ? "처리 완료 (레벨 반영)" : "상태 변경 완료");
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
      qc.invalidateQueries({ queryKey: ["level-status-history", memberId, rank, level] });
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["mp-current", memberId] });
      qc.invalidateQueries({ queryKey: ["member-progress"] });
      qc.invalidateQueries({ queryKey: ["level-cycle"] });
      setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Undo = revert to previous status from history
  const handleUndo = () => {
    if (!history || history.length === 0) return;
    const lastChange = history[0];
    setStatusMut.mutate(lastChange.previous_status);
  };

  const rankLabel = RANK_LABELS[rank] || rank;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg pb-safe">
        <DrawerHeader>
          <DrawerTitle>{rankLabel} 레벨 {level} 상태 변경</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-6">
          {/* Current status */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">현재 상태</p>
            <p className="text-sm font-bold text-foreground">
              {STATUS_OPTIONS.find(s => s.value === currentStatus)?.emoji}{" "}
              {STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus}
            </p>
          </div>

          {/* Status options */}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">상태 변경</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusMut.mutate(opt.value)}
                  disabled={opt.value === currentStatus || setStatusMut.isPending}
                  className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left transition-all active:scale-95 disabled:opacity-30 ${
                    opt.value === currentStatus ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span className="text-base">{opt.emoji}</span>
                  <span className="text-xs font-bold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason input */}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">변경 사유 (선택)</p>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="변경 사유를 입력하세요"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Undo button */}
          {history && history.length > 0 && (
            <button
              onClick={handleUndo}
              disabled={setStatusMut.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" /> 되돌리기 ({STATUS_OPTIONS.find(s => s.value === history[0].previous_status)?.label})
            </button>
          )}

          {/* History timeline */}
          {history && history.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> 변경 이력
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((h: any, i: number) => (
                  <div key={h.id || i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <div className="flex-1">
                      <p className="text-[11px] text-foreground">
                        {STATUS_OPTIONS.find(s => s.value === h.previous_status)?.emoji}{" "}
                        {STATUS_OPTIONS.find(s => s.value === h.previous_status)?.label}
                        {" → "}
                        {STATUS_OPTIONS.find(s => s.value === h.new_status)?.emoji}{" "}
                        {STATUS_OPTIONS.find(s => s.value === h.new_status)?.label}
                      </p>
                      {h.change_reason && (
                        <p className="text-[10px] text-muted-foreground italic">💬 {h.change_reason}</p>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {new Date(h.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default LevelStatusActionSheet;
