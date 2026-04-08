import { useBadges, useMyBadges, useXpLogs } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RewardsPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const { data: allBadges, isLoading: badgesLoading } = useBadges();
  const { data: myBadges } = useMyBadges();
  const { data: xpLogs } = useXpLogs();

  const earnedIds = new Set((myBadges || []).map(mb => mb.badge_id));
  const earned = (allBadges || []).filter(b => earnedIds.has(b.id));
  const locked = (allBadges || []).filter(b => !earnedIds.has(b.id));

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🎁 보상</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Stats */}
        {progress && (
          <div className="grid grid-cols-3 gap-3 animate-slide-up">
            <StatCard icon="⚡" label="누적 XP" value={progress.total_xp.toLocaleString()} />
            <StatCard icon="🔥" label="연속 출석" value={`${progress.streak_days}일`} />
            <StatCard icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
          </div>
        )}

        {/* XP Bar */}
        {progress && (
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: "0.05s" }}>
            <p className="mb-2 text-sm text-muted-foreground">다음 레벨까지</p>
            <XPBar current={progress.total_xp} max={getXpToNext(progress.current_level, progress.current_rank)} />
          </div>
        )}

        {/* Recent XP */}
        {xpLogs && xpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">⚡ 최근 XP 획득</h2>
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              {xpLogs.slice(0, 5).map((log, idx) => (
                <div key={log.id} className={`flex items-center justify-between px-4 py-3 ${idx < Math.min(xpLogs.length, 5) - 1 ? "border-b border-border" : ""}`}>
                  <div>
                    <p className="text-sm text-foreground">{log.reason}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">+{log.amount} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Earned Badges */}
        <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">🏅 획득한 배지</h2>
          {badgesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : earned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <span className="text-3xl">🥊</span>
              <p className="mt-2 text-sm text-muted-foreground">아직 획득한 배지가 없습니다</p>
              <p className="text-xs text-muted-foreground">퀘스트를 완료하고 배지를 모아보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {earned.map(b => (
                <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-primary/20 bg-card p-3 shadow-sm text-center">
                  <span className="text-3xl">{b.image_url || "🏅"}</span>
                  <span className="text-xs font-bold text-foreground">{b.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locked Badges */}
        {locked.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-base font-bold text-muted-foreground">🔒 미획득</h2>
            <div className="grid grid-cols-3 gap-3">
              {locked.map(b => (
                <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-muted/30 p-3 text-center opacity-50">
                  <span className="text-3xl grayscale">{b.image_url || "🏅"}</span>
                  <span className="text-xs font-bold text-foreground">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm text-center">
    <span className="text-xl">{icon}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-base font-bold text-foreground">{value}</span>
  </div>
);

function getXpToNext(level: number, rank: string): number {
  const rankIdx = ["white", "blue", "red", "black"].indexOf(rank);
  return ((rankIdx * 10 + level) + 1) * 50;
}

export default RewardsPage;
