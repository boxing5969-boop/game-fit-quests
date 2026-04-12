import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Zap, CheckCircle2, ArrowUp, Trophy, CalendarCheck } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: "xp" | "attendance" | "level_change" | "badge";
  title: string;
  detail?: string;
  date: string;
  icon: React.ReactNode;
  color: string;
}

const MemberTimeline = ({ userId }: { userId: string }) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["member-timeline", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [xpRes, attRes, levelRes] = await Promise.all([
        supabase.from("xp_logs").select("id, amount, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
        supabase.from("attendance_logs").select("id, checked_in_at, branch_name, method").eq("user_id", userId).order("checked_in_at", { ascending: false }).limit(20),
        supabase.from("level_status_history").select("id, rank_name, level_number, previous_status, new_status, change_reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);

      const items: TimelineEvent[] = [];

      (xpRes.data || []).forEach(x => {
        items.push({
          id: `xp-${x.id}`,
          type: "xp",
          title: `+${x.amount} XP`,
          detail: x.reason,
          date: x.created_at,
          icon: <Zap className="h-3.5 w-3.5" />,
          color: "text-primary bg-primary/10",
        });
      });

      (attRes.data || []).forEach(a => {
        items.push({
          id: `att-${a.id}`,
          type: "attendance",
          title: "체크인",
          detail: `${a.branch_name} · ${a.method}`,
          date: a.checked_in_at,
          icon: <CalendarCheck className="h-3.5 w-3.5" />,
          color: "text-status-complete bg-status-complete/10",
        });
      });

      (levelRes.data || []).forEach(l => {
        const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
        const isPromotion = l.new_status === "approved" || l.new_status === "boss_cleared";
        items.push({
          id: `lvl-${l.id}`,
          type: "level_change",
          title: isPromotion
            ? `${RANK_LABELS[l.rank_name] || l.rank_name} 레벨 ${l.level_number} ${l.new_status === "boss_cleared" ? "타이틀매치 클리어" : "완료"}`
            : `${RANK_LABELS[l.rank_name] || l.rank_name} 레벨 ${l.level_number} → ${l.new_status}`,
          detail: l.change_reason || undefined,
          date: l.created_at,
          icon: l.new_status === "boss_cleared" ? <Trophy className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />,
          color: l.new_status === "boss_cleared" ? "text-accent-foreground bg-accent/10" : "text-rank-blue bg-rank-blue/10",
        });
      });

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items.slice(0, 50);
    },
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>;
  }

  if (!events?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-2xl">📋</span>
        <p className="mt-2 text-sm text-muted-foreground">활동 기록이 없습니다</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, TimelineEvent[]>();
  events.forEach(e => {
    const key = new Date(e.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  });

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([dateLabel, items]) => (
        <div key={dateLabel}>
          <p className="mb-2 text-xs font-bold text-muted-foreground">{dateLabel}</p>
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  {item.detail && <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>}
                </div>
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  {new Date(item.date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemberTimeline;
