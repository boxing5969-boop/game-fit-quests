/**
 * 📢 유효회원 전체 메시지 (2026-10-15 대표님: "유효회원 전체한테 앱에서 메시지 보내는 기능 — 나와 지점장만")
 *   · 받는 사람 = 유효회원(수강권·PT 기간이 오늘 이후, 지도진·테스트·관리 계정 제외) — 서버 send_member_broadcast 가 고른다
 *   · 대표님(전체관리자) = 켜진 지점 전체 또는 한 지점 · 지점장 = 우리 지점만 (서버가 막는다)
 *   · 알림함(🔔)에 들어가고, 휴대폰 알림을 켠 회원은 푸시로도 받는다
 *   · 보내기 전에 받는 인원을 보여 주고 한 번 더 확인 → 보낸 기록(최근 10건)
 *   DB: supabase/migrations/20261015240000_member_broadcast.sql
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { translateError } from "@/lib/errorMessages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** 회원이 알림을 누르면 열 화면 — 앱 안 주소만 (DB notifications_link_internal 과 같은 규칙, 2026-10-01) */
const LINK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "없음 — 알림함에서 내용만 보기" },
  { value: "/myboxer/quest", label: "153 챌린지 · 런칭 이벤트" },
  { value: "/halloffame", label: "랭킹" },
  { value: "/halloffame?tab=test153", label: "153 TEST" },
  { value: "/myboxer/community", label: "153 커뮤니티" },
  { value: "/title-match", label: "타이틀매치" },
  { value: "/missions", label: "훈련 (오늘의 코스)" },
  { value: "/myboxer", label: "MY복서 (마일리지·라이센스)" },
  { value: "/survey", label: "설문·소리함" },
  { value: "/membership", label: "수강권" },
  { value: "/membership-plans", label: "멤버십 상품 (재등록·연장)" },
  { value: "/messages", label: "메시지" },
];

const shortBranch = (b: string | null | undefined) => (b ? b.replace(/^153복싱짐\s*/, "") : "전체 지점");

interface BroadcastRow {
  id: string;
  branch_name: string | null;
  title: string;
  recipients: number;
  created_at: string;
}

const BroadcastNotification = () => {
  const { role, profile } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetBranch, setTargetBranch] = useState<string>("all");
  const [link, setLink] = useState<string>("");
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
    queryKey: ["broadcast-target-count", branchArg],
    queryFn: async (): Promise<number> => {
      const { data, error } = await sb.rpc("count_broadcast_targets", { p_branch: branchArg });
      if (error) throw error;
      return Number(data) || 0;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["member-broadcasts"],
    queryFn: async (): Promise<BroadcastRow[]> => {
      const { data, error } = await sb
        .from("member_broadcasts")
        .select("id, branch_name, title, recipients, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as BroadcastRow[];
    },
  });

  const sendMut = useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await sb.rpc("send_member_broadcast", {
        p_branch: branchArg,
        p_title: title.trim(),
        p_body: body.trim() || null,
        p_link: link || null,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: (count) => {
      toast.success(`유효회원 ${count.toLocaleString()}명에게 보냈어요`);
      setTitle("");
      setBody("");
      setLink("");
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["member-broadcasts"] });
    },
    onError: (e) => {
      setConfirming(false);
      toast.error(translateError(e, "보내지 못했어요. 다시 시도해 주세요"));
    },
  });

  const canSend = !!title.trim() && !sendMut.isPending && (targetCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-bold text-foreground">📢 유효회원 전체 메시지</p>
        <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          수강권·PT 기간이 남은 회원에게만 가요 (코치님·관리 계정 제외).{" "}
          {isSuperAdmin ? "지점을 고를 수 있어요." : "지점장님은 우리 지점 회원에게만 보낼 수 있어요."}
        </p>

        {isSuperAdmin && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-muted-foreground">대상 지점</label>
            <select
              value={targetBranch}
              onChange={(e) => {
                setTargetBranch(e.target.value);
                setConfirming(false);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">켜진 지점 전체</option>
              {(branches || []).map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground">
            받는 사람: {counting && targetCount === undefined ? "세는 중…" : `유효회원 ${(targetCount ?? 0).toLocaleString()}명`}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{shortBranch(branchArg)}</span>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">제목 *</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirming(false);
            }}
            placeholder="예: 이번 주 토요일 정상 운영합니다"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            maxLength={100}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">내용</label>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setConfirming(false);
            }}
            placeholder="회원에게 전할 내용 (선택)"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            rows={4}
            maxLength={1000}
          />
          <p className="mt-0.5 text-right text-[11px] text-muted-foreground tabular-nums">{body.length}/1000</p>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-muted-foreground">누르면 열 화면 (선택)</label>
          <select
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
          >
            {LINK_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            회원 앱 오른쪽 위 🔔 알림함에 들어가고, 휴대폰 알림을 켠 회원은 휴대폰으로도 바로 받아요.
          </p>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            보내기
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm font-bold text-foreground">
              {shortBranch(branchArg)} 유효회원 {(targetCount ?? 0).toLocaleString()}명에게 보낼까요?
            </p>
            <p className="text-xs text-muted-foreground">보낸 메시지는 되돌릴 수 없어요.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-border py-2.5 text-sm font-bold text-foreground active:scale-95"
              >
                취소
              </button>
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending}
                className="rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                {sendMut.isPending ? "보내는 중…" : "네, 보낼게요"}
              </button>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">보낸 기록</p>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-foreground">{h.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {shortBranch(h.branch_name)} · {h.recipients.toLocaleString()}명 ·{" "}
                  {new Date(h.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BroadcastNotification;
