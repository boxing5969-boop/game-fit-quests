import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// 전 지점 수강권 등록 모음 — 전체관리자 대시보드 '등록' 칸 (2026-10-26 대표님: "회원님들 등록한 부분만 정리해서 … 일단 나만 볼 수 있게").
// 데이터는 Edge Function registration-report(전체관리자만) → 153OS registration_report:
//   브로제이 지점은 sales_entries '수강권', 칠금점은 다짐 매출(dagym_sales). 탭 자체도 super_admin 에게만 보인다(SuperAdminDashboard).

type Kind = "new" | "renew" | "daily" | "refund";

interface RegRow {
  id: string;
  day: string;
  branch: string;
  member: string | null;
  product: string | null;
  amount: number;
  method: string | null;
  kind: Kind;
  src: "broj" | "dagym";
}

interface Sums {
  count: number;
  new: number;
  renew: number;
  daily: number;
  refunds: number;
  amount: number;
  refund_amount: number;
}

interface BranchSum extends Sums {
  branch: string;
}

interface Report {
  range: { from: string; to: string };
  total: Sums;
  branches: BranchSum[];
  sources: { branch: string; src: "broj" | "dagym"; synced_at: string | null }[];
  rows: RegRow[];
  truncated?: boolean;
}

type Period = "today" | "yesterday" | "week" | "month" | "last_month" | "three_months";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "last_month", label: "지난달" },
  { key: "three_months", label: "최근 3개월" },
];

const KIND: Record<Kind, { label: string; cls: string }> = {
  new: { label: "신규", cls: "bg-primary/10 text-primary" },
  renew: { label: "재등록", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  daily: { label: "일일권", cls: "bg-muted text-muted-foreground" },
  refund: { label: "환불", cls: "bg-destructive/10 text-destructive" },
};

// ── 날짜(한국 시간) ──────────────────────────────────────────
const kstToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const monthStart = (iso: string, back = 0) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 10);
};

function rangeOf(p: Period): { from: string; to: string } {
  const t = kstToday();
  switch (p) {
    case "today":
      return { from: t, to: t };
    case "yesterday":
      return { from: addDays(t, -1), to: addDays(t, -1) };
    case "week": {
      const [y, m, d] = t.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = 일요일
      return { from: addDays(t, -((dow + 6) % 7)), to: t }; // 월요일부터
    }
    case "month":
      return { from: monthStart(t), to: t };
    case "last_month": {
      const first = monthStart(t, 1);
      return { from: first, to: addDays(monthStart(t), -1) };
    }
    case "three_months":
      return { from: monthStart(t, 2), to: t };
  }
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00+09:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });

const rangeLabel = (from: string, to: string) => {
  const short = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  };
  return from === to ? short(from) : `${short(from)} ~ ${short(to)}`;
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const shortBranch = (b: string) => b.replace(/^153복싱짐\s*/, "");
const syncLabel = (s: string | null) => {
  if (!s) return "아직 없음";
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
  return m ? `${Number(m[1])}/${Number(m[2])}${m[3] ? ` ${m[3]}` : ""}` : s;
};

const emptySums: Sums = { count: 0, new: 0, renew: 0, daily: 0, refunds: 0, amount: 0, refund_amount: 0 };

const RegistrationReportPanel = () => {
  const [period, setPeriod] = useState<Period>("month");
  const [branch, setBranch] = useState<string>("all");
  const range = useMemo(() => rangeOf(period), [period]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["registration-report", range.from, range.to],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("registration-report", { body: range });
      if (error) throw error;
      if (!data || (data as { error?: string }).error) throw new Error((data as { error?: string })?.error || "no_data");
      return data as Report;
    },
  });

  const branches = data?.branches ?? [];
  const sums: Sums = useMemo(() => {
    if (!data) return emptySums;
    if (branch === "all") return data.total ?? emptySums;
    return branches.find(b => b.branch === branch) ?? emptySums;
  }, [data, branch, branches]);

  const rows = useMemo(
    () => (data?.rows ?? []).filter(r => branch === "all" || r.branch === branch),
    [data, branch],
  );

  const byDay = useMemo(() => {
    const groups: { day: string; rows: RegRow[]; count: number; amount: number }[] = [];
    for (const r of rows) {
      let g = groups[groups.length - 1];
      if (!g || g.day !== r.day) {
        g = { day: r.day, rows: [], count: 0, amount: 0 };
        groups.push(g);
      }
      g.rows.push(r);
      if (r.kind !== "refund") g.count += 1;
      g.amount += Number(r.amount) || 0;
    }
    return groups;
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* 기간 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-hide">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                period === p.key ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          aria-label="다시 불러오기"
          className="shrink-0 rounded-full bg-secondary p-2 text-secondary-foreground active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">등록 내역을 불러오지 못했어요.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          {/* 합계 */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">
              {rangeLabel(data.range.from, data.range.to)} · {branch === "all" ? "전 지점" : shortBranch(branch)}
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-foreground">
                {sums.count}
                <span className="ml-0.5 text-sm font-medium text-muted-foreground">건</span>
              </p>
              <p className="text-lg font-bold text-foreground">{won(sums.amount)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 font-bold ${KIND.new.cls}`}>신규 {sums.new}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${KIND.renew.cls}`}>재등록 {sums.renew}</span>
              {sums.daily > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${KIND.daily.cls}`}>일일권 {sums.daily}</span>}
              {sums.refunds > 0 && (
                <span className={`rounded-full px-2 py-0.5 font-bold ${KIND.refund.cls}`}>
                  환불 {sums.refunds} · {won(sums.refund_amount)}
                </span>
              )}
            </div>
          </div>

          {/* 지점별 */}
          <div className="rounded-2xl border border-border bg-card">
            <button
              onClick={() => setBranch("all")}
              className={`flex w-full items-center justify-between rounded-t-2xl px-4 py-2.5 text-left text-xs font-bold ${
                branch === "all" ? "bg-primary/5 text-primary" : "text-muted-foreground"
              }`}
            >
              <span>지점별 (누르면 그 지점만)</span>
              {branch !== "all" && <span>전 지점 보기</span>}
            </button>
            {branches.map(b => (
              <button
                key={b.branch}
                onClick={() => setBranch(branch === b.branch ? "all" : b.branch)}
                className={`flex w-full items-center gap-3 border-t border-border/60 px-4 py-2.5 text-left active:bg-muted/50 ${
                  branch === b.branch ? "bg-primary/5" : ""
                }`}
              >
                <span className="w-16 shrink-0 text-sm font-bold text-foreground">{shortBranch(b.branch)}</span>
                <span className="flex-1 text-[11px] text-muted-foreground">
                  {b.count}건 · 신규 {b.new} · 재등록 {b.renew}
                  {b.refunds > 0 ? ` · 환불 ${b.refunds}` : ""}
                </span>
                <span className="text-sm font-bold text-foreground">{won(b.amount)}</span>
              </button>
            ))}
          </div>

          {/* 날짜별 목록 */}
          {byDay.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">이 기간에 들어온 등록이 없어요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {byDay.map(g => (
                <div key={g.day} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                    <span className="text-xs font-bold text-foreground">{dayLabel(g.day)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {g.count}건 · {won(g.amount)}
                    </span>
                  </div>
                  {g.rows.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 border-t border-border/60 px-4 py-2.5">
                      <span className={`min-w-[42px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${KIND[r.kind]?.cls ?? KIND.new.cls}`}>
                        {KIND[r.kind]?.label ?? r.kind}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {r.member || "이름 없음"}
                          {branch === "all" && (
                            <span className="ml-1.5 text-[10px] font-medium text-primary/70">{shortBranch(r.branch)}</span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {r.product || "-"}
                          {r.method ? ` · ${r.method}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${r.kind === "refund" ? "text-destructive" : "text-foreground"}`}>
                        {won(Number(r.amount) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {data.truncated && (
                <p className="text-center text-[11px] text-muted-foreground">
                  너무 많아서 최근 3,000건까지만 보여 드려요. 기간을 줄여 보세요.
                </p>
              )}
            </div>
          )}

          {/* 기준 */}
          <div className="space-y-1 rounded-2xl bg-muted/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              {(data.sources ?? []).map((s, i) => (
                <span key={s.branch}>
                  {i > 0 && " · "}
                  {shortBranch(s.branch)} {syncLabel(s.synced_at)}
                </span>
              ))}
              {" "}기준
            </p>
            <p>브로제이 지점(선릉역·역삼·잠실)은 하루에 한 지점씩 돌아가며 들어와요. 칠금점은 다짐에서 매일 밤 22:49에 받아요.</p>
            <p>
              신규/재등록: 칠금점은 다짐 표시 그대로, 브로제이 지점은 같은 이름의 앞선 결제가 있으면 재등록으로 셌어요.
              금액은 환불을 뺀 받은 돈이에요.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RegistrationReportPanel;
