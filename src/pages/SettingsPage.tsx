import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Plus, Trash2, Pencil, Check, X } from "lucide-react";
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
  const { profile, user, role } = useAuth();
  const { data: branches } = useBranches();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [branchName, setBranchName] = useState("");
  const [saving, setSaving] = useState(false);

  // Branch management (admin only)
  const [newBranch, setNewBranch] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setNickname(profile.nickname || "");
      setBranchName(profile.branch_name || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          nickname,
          branch_name: branchName,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("프로필이 저장되었습니다 ✅");
      navigate("/mypage");
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  const isAdmin = role === "admin";

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
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-foreground">👤 프로필 수정</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-muted-foreground">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm text-muted-foreground">닉네임</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">소속 지점</Label>
              {branches && branches.length > 0 ? (
                <Select value={branchName} onValueChange={setBranchName}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="지점을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                  등록된 지점이 없습니다
                </p>
              )}
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

        {/* Admin: Branch Management */}
        {isAdmin && (
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-4 text-base font-bold text-foreground">🏢 지점 관리</h2>

            {/* Add new branch */}
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
                <Plus className="h-4 w-4" />
                추가
              </button>
            </div>

            {/* Branch list */}
            <div className="space-y-2">
              {(branches || []).map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  {editingId === b.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 flex-1 rounded-lg text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleEditBranch(b.id)}
                        autoFocus
                      />
                      <button onClick={() => handleEditBranch(b.id)} className="rounded-lg bg-green-500/20 p-1.5 text-green-600 active:scale-95">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg bg-muted p-1.5 text-muted-foreground active:scale-95">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-foreground">{b.name}</span>
                      <button
                        onClick={() => { setEditingId(b.id); setEditingName(b.name); }}
                        className="rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(b.id, b.name)}
                        className="rounded-lg bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20 active:scale-95"
                      >
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
