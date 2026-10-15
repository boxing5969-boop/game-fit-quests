/**
 * 운영 리포트 '오늘 신규' · '오늘 제출' 칸을 누르면 열리는 명단 (2026-10-15 대표님)
 *   · new         — 오늘(KST) 가입한 회원 (지점장 = 우리 지점, 전체관리자 = 켜진 지점 전체)
 *   · submissions — 오늘 들어온 미션 제출 (대기·승인·보완 상태 함께)
 *   이름을 누르면 회원 상세(/manager/member/:id).
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Kind = "new" | "submissions";

const kstTodayStartIso = (): string => {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  return new Date(Math.floor(kstMs / 86400000) * 86400000 - 9 * 3600 * 1000).toISOString();
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "승인 대기", cls: "bg-status-pending/15 text-status-pending" },
  approved: { label: "승인", cls: "bg-primary/15 text-primary" },
  revision_requested: { label: "보완 요청", cls: "bg-amber-500/15 text-amber-600" },
  rejected: { label: "반려", cls: "bg-destructive/15 text-destructive" },
};

interface Row {
  key: string;
  userId: string;
  name: string;
  sub: string;
  at: string;
  status?: string;
}

interface Props {
  kind: Kind;
  branchName: string;
  isSuperAdmin: boolean;
  onBack: () => void;
  onOpenApprovals?: () => void;
}

const TodayListPanel = ({ kind, branchName, isSuperAdmin, onBack, onOpenApprovals }: Props) => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-today-list", kind, branchName, isSuperAdmin],
    queryFn: async (): Promise<Row[]> => {
      const since = kstTodayStartIso();
      if (kind === "new") {
        // 생성된 타입에 is_staff 가 아직 없다 — DB 에는 있음
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any)
          .from("profiles")
          .select("user_id, name, nickname, branch_name, created_at, is_approved, is_staff")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);
        if (!isSuperAdmin) q = q.eq("branch_name", branchName);
        const { data: rows, error } = await q;
        if (error) throw error;
        type P = { user_id: string; name: string | null; nickname: string | null; branch_name: string | null; created_at: string; is_approved: boolean | null; is_staff: boolean | null };
        return ((rows || []) as P[])
          .filter((p) => !p.is_staff)
          .map((p) => ({
            key: p.user_id,
            userId: p.user_id,
            name: p.name || p.nickname || "이름 없음",
            sub: [isSuperAdmin ? shortBranch(p.branch_name) : null, p.is_approved ? "가입 승인됨" : "가입 승인 대기"]
              .filter(Boolean)
              .join(" · "),
            at: p.created_at,
            status: p.is_approved ? undefined : "pending",
          }));
      }
      const { data: subs, error } = await supabase
        .from("mission_submissions")
        .select("id, user_id, status, requested_at, missions(title)")
        .gte("requested_at", since)
        .order("requested_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((subs || []).map((s) => s.user_id)));
      const names = new Map<string, { name: string; branch: string | null }>();
      if (ids.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("user_id, name, nickname, branch_name").in("user_id", ids);
        (ps || []).forEach((p) => names.set(p.user_id, { name: p.name || p.nickname || "회원", branch: p.branch_name }));
      }
      return (subs || [])
        .filter((s) => isSuperAdmin || names.get(s.user_id)?.branch === branchName)
        .map((s) => {
          const who = names.get(s.user_id);
          const title = (s as unknown as { missions?: { title?: string } | null }).missions?.title ?? "미션";
          return {
            key: s.id,
            userId: s.user_id,
            name: who?.name ?? "회원",
            sub: [isSuperAdmin ? shortBranch(who?.branch) : null, title].filter(Boolean).join(" · "),
            at: s.requested_at,
            status: s.status,
          };
        });
    },
  });

  const title = kind === "new" ? "오늘 신규 회원" : "오늘 제출";
  const rows = data ?? [];
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="회원 목록으로"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
        >
          <ChevronLeft className="h-4 w-4 text-secondary-foreground" />
        </button>
        <h3 className="flex-1 text-base font-bold text-foreground">
          {title} <span className="text-muted-foreground">{isLoading ? "" : `${rows.length}명`}</span>
        </h3>
        {pendingCount > 0 && onOpenApprovals && (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="rounded-full bg-status-pending/15 px-3 py-1.5 text-xs font-bold text-status-pending active:scale-95"
          >
            승인 대기 {pendingCount}건 처리 →
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {kind === "new" ? "오늘 새로 가입한 회원이 아직 없어요" : "오늘 들어온 제출이 아직 없어요"}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((r, i) => {
            const st = r.status ? STATUS_LABEL[r.status] : null;
            return (
              <li key={r.key} className={i > 0 ? "border-t border-border" : ""}>
                <button
                  type="button"
                  onClick={() => navigate(`/manager/member/${r.userId}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fmtTime(r.at)}
                      {r.sub ? ` · ${r.sub}` : ""}
                    </p>
                  </div>
                  {st && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default TodayListPanel;
