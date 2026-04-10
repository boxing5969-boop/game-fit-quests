import { useAuth } from "@/contexts/AuthContext";
import RankBadge from "@/components/RankBadge";
import AvatarUpload from "@/components/AvatarUpload";
import { ArrowLeft, MapPin, Calendar, LogOut, Settings, ChevronRight } from "lucide-react";
import { isManagerRole } from "@/lib/rankLabels";
import { useNavigate } from "react-router-dom";
import { useXpLogs } from "@/hooks/useQuestData";
import type { Enums } from "@/integrations/supabase/types";

const MyPage = () => {
  const navigate = useNavigate();
  const { profile, progress, role, signOut } = useAuth();
  const { data: xpLogs } = useXpLogs();

  if (!profile || !progress) return null;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">마이페이지</h1>
      </div>

      <div className="space-y-5">
        {/* Profile Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <AvatarUpload size="lg" />
            <div className="flex-1">
              <h2 className="text-lg text-foreground">{profile.nickname || profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} isMaster={isManagerRole(role)} />
                {role && role !== "member" && (
                  <span className="rounded-full bg-accent/30 px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    {role === "branch_manager" || role === "coach" ? "관장님" : role === "super_admin" || role === "admin" ? "전체 관리자" : role}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.05s" }}>
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="소속 지점" value={profile.branch_name || "미설정"} />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="가입일" value={new Date(profile.created_at).toLocaleDateString("ko-KR")} />
          <InfoRow icon={<span className="text-sm">🔥</span>} label="연속 출석" value={`${progress.streak_days}일`} />
          <InfoRow icon={<span className="text-sm">⚡</span>} label="누적 XP" value={`${progress.total_xp.toLocaleString()} XP`} last />
        </div>

        {/* Recent Clears */}
        {xpLogs && xpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">📋 최근 클리어 이력</h2>
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              {xpLogs.slice(0, 5).map((item, idx) => (
                <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${idx < Math.min(xpLogs.length, 5) - 1 ? "border-b border-border" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.reason}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className="text-xs font-bold text-primary">+{item.amount} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.15s" }}>
          <button onClick={() => navigate("/guide")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">📖</span>
              <span className="text-sm text-foreground">가이드</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/safety-check")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">🛡️</span>
              <span className="text-sm text-foreground">안전 체크 수정</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/settings")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">설정</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-4 active:bg-secondary/50">
            <LogOut className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value, last = false }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) => (
  <div className={`flex items-center justify-between px-4 py-3.5 ${!last ? "border-b border-border" : ""}`}>
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

export default MyPage;
