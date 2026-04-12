import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";

const BroadcastNotification = () => {
  const { role, profile } = useAuth();
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetBranch, setTargetBranch] = useState<string>("all");

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("name").order("name");
      return data || [];
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력하세요");

      let query = supabase.from("profiles").select("user_id").eq("is_approved", true);
      if (targetBranch !== "all") {
        query = query.eq("branch_name", targetBranch);
      } else if (!isSuperAdmin) {
        query = query.eq("branch_name", profile?.branch_name || "");
      }

      const { data: profiles, error } = await query;
      if (error) throw error;
      if (!profiles?.length) throw new Error("대상 회원이 없습니다");

      // Insert notifications in batches
      const batch = profiles.map(p => ({
        user_id: p.user_id,
        title: title.trim(),
        body: body.trim(),
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const chunk = batch.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await supabase.from("notifications").insert(chunk);
        if (insertErr) throw insertErr;
      }

      return profiles.length;
    },
    onSuccess: (count) => {
      toast.success(`${count}명에게 공지 발송 완료`);
      setTitle("");
      setBody("");
    },
    onError: (e: any) => toast.error(e.message || "발송 실패"),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold text-foreground">📢 전체 공지 발송</p>

        {isSuperAdmin && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-muted-foreground">대상 지점</label>
            <select
              value={targetBranch}
              onChange={e => setTargetBranch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">전체 지점</option>
              {(branches || []).map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">제목 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목 입력..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            maxLength={100}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-muted-foreground">내용</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="공지 내용 입력 (선택)..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none resize-none"
            rows={3}
            maxLength={500}
          />
        </div>

        <button
          onClick={() => sendMut.mutate()}
          disabled={sendMut.isPending || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sendMut.isPending ? "발송 중..." : "공지 발송"}
        </button>
      </div>
    </div>
  );
};

export default BroadcastNotification;
