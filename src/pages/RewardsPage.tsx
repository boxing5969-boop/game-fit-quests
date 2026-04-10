import { useBadges, useMyBadges, useXpLogs } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import { User, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const RewardsPage = () => {
  const navigate = useNavigate();
  const { progress, role } = useAuth();
  const { data: allBadges, isLoading: badgesLoading } = useBadges();
  const { data: myBadges } = useMyBadges();
  const { data: xpLogs } = useXpLogs(30);

  const earnedIds = new Set((myBadges || []).map(mb => mb.badge_id));
  const earned = (allBadges || []).filter(b => earnedIds.has(b.id));
  const locked = (allBadges || []).filter(b => !earnedIds.has(b.id));

  // MASTER 40 check
  const isMaster40 = progress && progress.current_rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;

  // Level-up logs
  const levelUpLogs = (xpLogs || []).filter(l => l.reason.includes("클리어") || l.reason.includes("타이틀매치"));

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🎁 보상</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* MASTER 40 */}
        {isMaster40 && (
          <div className="animate-bounce-in space-y-4">
            <div className="rounded-2xl border-2 border-accent bg-gradient-to-br from-accent/20 via-primary/10 to-accent/20 p-6 text-center shadow-lg">
              <span className="text-5xl">🏆</span>
              <h2 className="mt-2 text-xl font-bold text-foreground">MASTER 40 달성</h2>
              <p className="text-sm text-muted-foreground">모든 리그와 레벨을 정복한 최종 마스터</p>
            </div>

            {/* Final Master Missions */}
            <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-foreground">🥇 최종 마스터 미션</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 p-4 border border-primary/20">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">한국복싱협회 단증 심사관</p>
                    <p className="mt-1 text-xs text-muted-foreground">한국복싱협회 공인 단증 심사관이 되세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 p-4 border border-primary/20">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">2</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">정식 코치 자격증 취득</p>
                    <p className="mt-1 text-xs text-muted-foreground">한국복싱코치협회 인증 정식 코치 자격증을 취득하세요</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current rank badge */}
        {progress && (
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">현재 리그</p>
                <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} size="lg" isMaster={isManagerRole(role)} />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{progress.total_xp.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">총 XP</p>
              </div>
            </div>
            <div className="mt-3">
              <XPBar current={progress.total_xp} max={getXpToNext(progress.current_level, progress.current_rank)} />
            </div>
          </div>
        )}

        {/* Stats */}
        {progress && (
          <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <StatCard icon="🔥" label="연속 출석" value={`${progress.streak_days}일`} />
            <StatCard icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
            <StatCard icon="🏅" label="배지" value={`${earned.length}개`} />
          </div>
        )}

        {/* Earned Badges */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">🏅 획득한 배지</h2>
          {badgesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : earned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <span className="text-3xl">🥊</span>
              <p className="mt-2 text-sm text-muted-foreground">아직 획득한 배지가 없습니다</p>
              <p className="text-xs text-muted-foreground">미션을 완료하고 배지를 모아보세요!</p>
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
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
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

        {/* Level-up history */}
        {levelUpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">📜 레벨업 기록</h2>
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              {levelUpLogs.slice(0, 10).map((log, idx) => (
                <div key={log.id} className={`flex items-center justify-between px-4 py-3 ${idx < Math.min(levelUpLogs.length, 10) - 1 ? "border-b border-border" : ""}`}>
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
          </div>
        )}

        {/* Recent XP */}
        {xpLogs && xpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
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
