import { Award } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  image_url: string | null;
}

export function EarnedBadgeGrid({ badges, loading }: { badges: Badge[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-3xl">🥊</span>
        <p className="mt-2 text-sm text-muted-foreground">아직 획득한 배지가 없습니다</p>
        <p className="text-xs text-muted-foreground">미션을 완료하고 배지를 모아보세요!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map(b => (
        <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-primary/20 bg-card p-3 shadow-sm text-center">
          <span className="text-3xl">{b.image_url || "🏅"}</span>
          <span className="text-xs font-bold text-foreground">{b.name}</span>
        </div>
      ))}
    </div>
  );
}

export function LockedBadgeGrid({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map(b => (
        <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-muted/30 p-3 text-center opacity-50">
          <span className="text-3xl grayscale">{b.image_url || "🏅"}</span>
          <span className="text-xs font-bold text-foreground">{b.name}</span>
        </div>
      ))}
    </div>
  );
}

export function LevelUpHistory({ logs }: { logs: { id: string; reason: string; created_at: string; amount: number }[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {logs.slice(0, 10).map((log, idx) => (
        <div key={log.id} className={`flex items-center justify-between px-4 py-3 ${idx < Math.min(logs.length, 10) - 1 ? "border-b border-border" : ""}`}>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm text-foreground">{log.reason}</p>
              <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString("ko-KR")}</p>
            </div>
          </div>
          <span className="text-sm font-bold text-primary">+{log.amount} XP</span>
        </div>
      ))}
    </div>
  );
}

export function RecentXpList({ logs }: { logs: { id: string; reason: string; created_at: string; amount: number }[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {logs.slice(0, 5).map((log, idx) => (
        <div key={log.id} className={`flex items-center justify-between px-4 py-3 ${idx < Math.min(logs.length, 5) - 1 ? "border-b border-border" : ""}`}>
          <div>
            <p className="text-sm text-foreground">{log.reason}</p>
            <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString("ko-KR")}</p>
          </div>
          <span className="text-sm font-bold text-primary">+{log.amount} XP</span>
        </div>
      ))}
    </div>
  );
}

export function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm text-center">
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-bold text-foreground">{value}</span>
    </div>
  );
}
