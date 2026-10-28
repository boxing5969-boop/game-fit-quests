/**
 * 📢 단체 메시지 — 메시지 탭 '단체' (2026-10-15 대표님: "전체 회원·유효회원에게 보내는 메시지 등등 — 메시지 탭에서, DM 처럼")
 *   · 받는 사람: 유효회원(수강권·PT 기간 남음) · 전체 회원 · 만료 회원 · PT 회원 — 지도진·테스트·관리 계정은 빠진다
 *   · 대표님(전체관리자) = 켜진 지점 전체 또는 한 지점 · 지점장 = 우리 지점만 (서버가 막는다)
 *   · 보내기 = 회원마다 나와의 1:1 대화방에 메시지 한 통 + 알림함(🔔)·푸시(누르면 그 대화방). 회원 답장은 보통 DM 처럼 온다
 *   · 보내기 전에 받는 인원을 보여 주고 한 번 더 확인 → 보낸 기록(최근 10건)
 *   DB: supabase/migrations/20261015241000_member_broadcast_dm.sql (send_member_dm_broadcast)
 *   관리자 홈 카드 · 관리자 대시보드 공지 탭도 이 화면을 쓴다.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/errorMessages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Audience = "valid" | "all" | "expired" | "pt";

const AUDIENCES: ReadonlyArray<{ value: Audience; label: string; hint: string }> = [
  { value: "valid", label: "유효회원", hint: "수강권·PT 기간이 남은 회원" },
  { value: "all", label: "전체 회원", hint: "가입 승인된 모든 회원 (만료 포함)" },
  { value: "expired", label: "만료 회원", hint: "수강권·PT 기간이 끝난 회원 — 재등록 안내에" },
  { value: "pt", label: "PT 회원", hint: "PT 기간이 남은 회원" },
];
const AUDIENCE_LABEL: Record<string, string> = { valid: "유효회원", all: "전체 회원", expired: "만료 회원", pt: "PT 회원" };

const shortBranch = (b: string | null | undefined) => (b ? b.replace(/^153복싱짐\s*/, "") : "전체 지점");

interface BroadcastRow {
  id: string;
  branch_name: string | null;
  title: string;
  recipients: number;
  audience: string;
  mode: string;
  created_at: string;
}

const BroadcastNotification = () => {
  const { role, profile } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const [audience, setAudience] = useState<Audience>("valid");
  const [body, setBody] = useState("");
  const [targetBranch, setTargetBranch] = useState<string>("all");
  const [confirming, setConfirming] = useState(false);

  /** 서버에 넘기는 지점 — 대표님 '전체'는 null, 지점장은 내 지점 */
  const branchArg = isSuperAdmin ? (targetBranch === "all" ? null : targetBranch) : profile?.branch_name ?? null;

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").order("name");
      // 꺼진 지점(설정 > 지점 관리)은 보내기 대상에서 뺀다 (2026-10-15)
      return (data || []).filter((b) => (b as { is_visible?: boolean }).is_visible !== false).map((b) => ({ name: b.name }));
    },
  });

  const { data: targetCount, isFetching: counting } = useQuery({
    queryKey: ["broadcast-target-count2", branchArg, audience],
    queryFn: async (): Promise<number> => {
      const { data, error } = await sb.rpc("count_broadcast_targets2", { p_branch: branchArg, p_audience: audience });
      if (error) throw error;
      return Number(data) || 0;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["member-broadcasts"],
    queryFn: async (): Promise<BroadcastRow[]> => {
      const { data, error } = await sb
        .from("member_broadcasts")
        .select("id, branch_name, title, recipients, audience, mode, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as BroadcastRow[];
    },
  });

  const sendMut = useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await sb.rpc("send_member_dm_broadcast", {
        p_branch: branchArg,
        p_audience: audience,
        p_body: body.trim(),
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: (count) => {
      toast.success(`${AUDIENCE_LABEL[audience]} ${count.toLocaleString()}명에게 메시지를 보냈어요`);
      setBody("");
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["member-broadcasts"] });
      qc.invalidateQueries({ queryKey: ["dm"] });
    },
    onError: (e) => {
      setConfirming(false);
      toast.error(translateError(e, "보내지 못했어요. 다시 시도해 주세요"));
    },
  });

  const canSend = !!body.trim() && !sendMut.isPending && (targetCount ?? 0) > 0;
  const resetConfirm = () => setConfirming(false);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-card p-4 shadow-elev-1">
        <p className="text-body font-bold text-foreground">📢 단체 메시지</p>
        <p className="mb-3 mt-0.5 text-label leading-relaxed text-muted-foreground">
          회원마다 1:1 대화방으로 들어가고, 휴대폰 알림을 켠 회원은 푸시로도 받아요. 답장은 '대화' 탭으로 와요.
          {isSuperAdmin ? "" : " 지점장님은 우리 지점 회원에게만 보낼 수 있어요."}
        </p>

        <p className="mb-1.5 text-label font-bold text-muted-foreground">받는 사람</p>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => {
                setAudience(a.value);
                resetConfirm();
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-left active:scale-[0.98]",
                audience === a.value ? "border-primary bg-primary/10" : "border-border bg-background",
              )}
            >
              <span className={cn("block text-body font-bold", audience === a.value ? "text-primary" : "text-foreground")}>{a.label}</span>
              <span className="block text-label leading-snug text-muted-foreground">{a.hint}</span>
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <select
            value={targetBranch}
            onChange={(e) => {
              setTargetBranch(e.target.value);
              resetConfirm();
            }}
            className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-body outline-none"
          >
            <option value="all">켜진 지점 전체</option>
            {(branches || []).map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-body">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground">
            {counting && targetCount === undefined
              ? "세는 중…"
              : `${AUDIENCE_LABEL[audience]} ${(targetCount ?? 0).toLocaleString()}명`}
          </span>
          <span className="ml-auto text-label text-muted-foreground">{shortBranch(branchArg)}</span>
        </div>

        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            resetConfirm();
          }}
          placeholder="회원에게 보낼 메시지를 써 주세요"
          className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-label outline-none"
          rows={5}
          maxLength={1000}
        />
        <p className="mb-3 mt-0.5 text-right text-label text-muted-foreground tabular-nums">{body.length}/1000</p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            보내기
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="text-body font-bold text-foreground">
              {shortBranch(branchArg)} {AUDIENCE_LABEL[audience]} {(targetCount ?? 0).toLocaleString()}명에게 보낼까요?
            </p>
            <p className="text-label text-muted-foreground">보낸 메시지는 되돌릴 수 없어요.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={resetConfirm} className="rounded-xl border border-border py-2.5 text-body font-bold text-foreground active:scale-95">
                취소
              </button>
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending}
                className="rounded-xl bg-primary py-2.5 text-body font-black text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                {sendMut.isPending ? "보내는 중…" : "네, 보낼게요"}
              </button>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-3xl bg-card p-4 shadow-elev-1">
          <p className="mb-2 text-label font-bold text-muted-foreground">보낸 기록</p>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-label">
                <p className="truncate text-foreground">{h.title}</p>
                <p className="text-label text-muted-foreground">
                  {shortBranch(h.branch_name)} · {AUDIENCE_LABEL[h.audience] ?? "유효회원"} {h.recipients.toLocaleString()}명 ·{" "}
                  {h.mode === "dm" ? "메시지" : "알림"} ·{" "}
                  {new Date(h.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BroadcastNotification;
