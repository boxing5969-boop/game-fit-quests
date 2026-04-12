import { useState, useEffect, useCallback } from "react";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Plus, Trash2, Pencil, Check, X, ArrowRightLeft, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isManagerRole } from "@/lib/rankLabels";

// ── Home widget toggle helpers ──
const HOME_PREFS_KEY = "home-widget-prefs";

export interface HomeWidgetPrefs {
  showRestartRoutine: boolean;
  showWeeklyPrescription: boolean;
}

export function loadHomeWidgetPrefs(): HomeWidgetPrefs {
  try {
    const raw = localStorage.getItem(HOME_PREFS_KEY);
    if (raw) return { ...{ showRestartRoutine: true, showWeeklyPrescription: true }, ...JSON.parse(raw) };
  } catch {}
  return { showRestartRoutine: true, showWeeklyPrescription: true };
}

function saveHomeWidgetPrefs(prefs: HomeWidgetPrefs) {
  localStorage.setItem(HOME_PREFS_KEY, JSON.stringify(prefs));
}

const useBranches = () =>
  useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

const SettingsPage = () => {
  const navigate = useNavigate();
  const { profile, user, role, refreshProfile } = useAuth();
  const { data: branches } = useBranches();
  const { resetOnboarding } = useOnboardingState();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  // Home widget prefs
  const [widgetPrefs, setWidgetPrefs] = useState<HomeWidgetPrefs>(loadHomeWidgetPrefs);
  const toggleWidget = useCallback((key: keyof HomeWidgetPrefs) => {
    setWidgetPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveHomeWidgetPrefs(next);
      return next;
    });
  }, []);

  // Branch transfer
  const [transferBranch, setTransferBranch] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Branch management (admin only)
  const [newBranch, setNewBranch] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setNickname(profile.nickname || "");
    }
  }, [profile]);

  // Pending transfer requests
  const { data: transferRequests } = useQuery({
    queryKey: ["my-transfer-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("branch_transfer_requests" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as any[];
    },
  });

  // Manager: pending transfer requests for branch
  const { data: branchTransfers } = useQuery({
    queryKey: ["branch-transfer-requests", profile?.branch_name],
    enabled: !!profile && isManagerRole(role),
    queryFn: async () => {
      const { data } = await supabase
        .from("branch_transfer_requests" as any)
        .select("*")
        .eq("status", "pending");
      return (data || []) as any[];
    },
  });

  const requestTransferMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_branch_transfer", { _to_branch: transferBranch });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("지점 이전 요청이 접수되었습니다");
      setTransferBranch("");
      setTransferReason("");
      qc.invalidateQueries({ queryKey: ["my-transfer-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveTransferMut = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase.rpc("approve_branch_transfer", { _request_id: reqId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("지점 이전 승인 완료");
      qc.invalidateQueries({ queryKey: ["branch-transfer-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectTransferMut = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase.rpc("reject_branch_transfer", { _request_id: reqId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("지점 이전 반려 완료");
      qc.invalidateQueries({ queryKey: ["branch-transfer-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name, nickname })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("프로필이 저장되었습니다 ✅");
      navigate("/mypage");
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  const isAdmin = role === "admin" || role === "super_admin";
  const isManager = isManagerRole(role);
  const hasPendingTransfer = (transferRequests || []).some((r: any) => r.status === "pending");
  const otherBranches = (branches || []).filter(b => b.name !== profile.branch_name);

  const handleAddBranch = async () => {
    const trimmed = newBranch.trim();
    if (!trimmed) return;
    setAddingBranch(true);
    try {
      const { error } = await supabase.from("branches").insert({ name: trimmed });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["branches"] });
      setNewBranch("");
      toast.success("지점이 추가되었습니다 ✅");
    } catch {
      toast.error("지점 추가 실패");
    } finally {
      setAddingBranch(false);
    }
  };

  const handleEditBranch = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      const { error } = await supabase.from("branches").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["branches"] });
      setEditingId(null);
      toast.success("지점명이 수정되었습니다 ✅");
    } catch {
      toast.error("수정 실패");
    }
  };

  const handleDeleteBranch = async (id: string, bName: string) => {
    if (!confirm(`"${bName}" 지점을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("지점이 삭제되었습니다");
    } catch {
      toast.error("삭제 실패");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">설정</h1>
      </div>

      <div className="space-y-5">
        {/* Home Widget Toggles */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-foreground">🏠 홈 화면 설정</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">리스타트 루틴</p>
                <p className="text-[11px] text-muted-foreground">복귀 배너 표시 (5일+ 미활동 시)</p>
              </div>
              <Switch checked={widgetPrefs.showRestartRoutine} onCheckedChange={() => toggleWidget("showRestartRoutine")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">이번 주 추천</p>
                <p className="text-[11px] text-muted-foreground">주간 처방 카드 표시</p>
              </div>
              <Switch checked={widgetPrefs.showWeeklyPrescription} onCheckedChange={() => toggleWidget("showWeeklyPrescription")} />
            </div>
          </div>
        </div>

        {/* Onboarding replay */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.01s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">📖 온보딩</h2>
          <p className="mb-3 text-xs text-muted-foreground">153 랭크업 시스템 소개를 다시 볼 수 있습니다.</p>
          <button
            onClick={() => {
              resetOnboarding();
              navigate("/onboarding");
            }}
            className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all active:scale-95"
          >
            온보딩 다시 보기
          </button>
        </div>

        {/* Profile Edit */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.03s" }}>
          <h2 className="mb-4 text-base font-bold text-foreground">👤 프로필 수정</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-muted-foreground">이름</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm text-muted-foreground">닉네임</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임을 입력하세요" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">소속 지점</Label>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                {profile.branch_name || "미지정"}
              </div>
              <p className="text-[10px] text-muted-foreground">지점 변경은 아래 '지점 이전 요청'을 이용해주세요</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "저장 중..." : "저장하기"}
        </button>

        {/* Branch Transfer Request */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.05s" }}>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
            <ArrowRightLeft className="h-4 w-4" /> 지점 이전 요청
          </h2>

          {hasPendingTransfer ? (
            <div className="rounded-xl border border-status-pending/30 bg-status-pending/5 p-4">
              <p className="text-sm font-bold text-status-pending">⏳ 이전 요청 대기 중</p>
              <p className="mt-1 text-xs text-muted-foreground">관장님 승인 후 지점이 변경됩니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherBranches.length > 0 ? (
                <>
                  <Select value={transferBranch} onValueChange={setTransferBranch}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="이전할 지점 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherBranches.map(b => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => transferBranch && requestTransferMut.mutate()}
                    disabled={!transferBranch || requestTransferMut.isPending}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {requestTransferMut.isPending ? "요청 중..." : "이전 요청하기"}
                  </button>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground">이전 가능한 지점이 없습니다</p>
              )}
            </div>
          )}

          {/* Transfer history */}
          {transferRequests && transferRequests.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> 이전 이력
              </p>
              {transferRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-xs text-foreground">{req.from_branch} → {req.to_branch}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className={`text-[10px] font-bold ${
                    req.status === "approved" ? "text-status-complete" :
                    req.status === "rejected" ? "text-destructive" :
                    "text-status-pending"
                  }`}>
                    {req.status === "approved" ? "✅ 승인" : req.status === "rejected" ? "❌ 반려" : "⏳ 대기"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manager: Pending Branch Transfers */}
        {isManager && branchTransfers && branchTransfers.length > 0 && (
          <div className="animate-slide-up rounded-2xl border border-status-pending/20 bg-card p-5 shadow-sm" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-4 text-base font-bold text-foreground">📋 지점 이전 승인 대기</h2>
            <div className="space-y-3">
              {branchTransfers.map((req: any) => (
                <div key={req.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{req.from_branch} → {req.to_branch}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString("ko-KR")}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => approveTransferMut.mutate(req.id)}
                      disabled={approveTransferMut.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-status-complete py-2 text-xs font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> 승인
                    </button>
                    <button
                      onClick={() => rejectTransferMut.mutate(req.id)}
                      disabled={rejectTransferMut.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-destructive py-2 text-xs font-bold text-destructive-foreground active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" /> 반려
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin: Branch Management */}
        {isAdmin && (
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-4 text-base font-bold text-foreground">🏢 지점 관리</h2>
            <div className="mb-4 flex gap-2">
              <Input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="새 지점명 입력"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleAddBranch()}
              />
              <button
                onClick={handleAddBranch}
                disabled={addingBranch || !newBranch.trim()}
                className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> 추가
              </button>
            </div>
            <div className="space-y-2">
              {(branches || []).map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  {editingId === b.id ? (
                    <>
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 flex-1 rounded-lg text-sm" onKeyDown={(e) => e.key === "Enter" && handleEditBranch(b.id)} autoFocus />
                      <button onClick={() => handleEditBranch(b.id)} className="rounded-lg bg-status-complete/20 p-1.5 text-status-complete active:scale-95">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg bg-muted p-1.5 text-muted-foreground active:scale-95">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-foreground">{b.name}</span>
                      <button onClick={() => { setEditingId(b.id); setEditingName(b.name); }}
                        className="rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground active:scale-95">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteBranch(b.id, b.name)}
                        className="rounded-lg bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20 active:scale-95">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {(!branches || branches.length === 0) && (
                <p className="py-3 text-center text-sm text-muted-foreground">등록된 지점이 없습니다</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
