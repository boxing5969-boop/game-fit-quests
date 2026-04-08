import { currentUser, clearHistory, RANK_LABELS, RANK_ICONS } from "@/lib/mockData";
import RankBadge from "@/components/RankBadge";
import { ArrowLeft, MapPin, Calendar, LogOut, Settings, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              🥊
            </div>
            <div className="flex-1">
              <h2 className="text-lg text-foreground">{currentUser.name}</h2>
              <p className="text-sm text-muted-foreground">{currentUser.title}</p>
              <RankBadge rank={currentUser.rank} level={currentUser.level} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.05s" }}>
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="소속 지점" value={currentUser.branch} />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="가입일" value={currentUser.joinDate} />
          <InfoRow icon={<span className="text-sm">🔥</span>} label="최고 연속 출석" value={`${currentUser.maxStreak}일`} />
          <InfoRow icon={<span className="text-sm">⚡</span>} label="누적 XP" value={`${currentUser.totalXp.toLocaleString()} XP`} last />
        </div>

        {/* Recent Clears */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">📋 최근 클리어 이력</h2>
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            {clearHistory.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== clearHistory.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
                <span className="text-xs font-bold text-primary">+{item.xp} XP</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.15s" }}>
          <button className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">설정</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex w-full items-center gap-3 px-4 py-4 active:bg-secondary/50"
          >
            <LogOut className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) => (
  <div className={`flex items-center justify-between px-4 py-3.5 ${!last ? "border-b border-border" : ""}`}>
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

export default MyPage;
