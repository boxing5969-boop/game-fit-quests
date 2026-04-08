import { useState } from "react";
import { badges, currentUser, rewardBoxes } from "@/lib/mockData";
import XPBar from "@/components/XPBar";
import { User, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";

const RewardsPage = () => {
  const navigate = useNavigate();
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🎁 보상</h1>
        <button
          onClick={() => navigate("/mypage")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95"
        >
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up">
          <StatCard icon="⚡" label="누적 XP" value={currentUser.totalXp.toLocaleString()} />
          <StatCard icon="🔥" label="최고 연속" value={`${currentUser.maxStreak}일`} />
          <StatCard icon="🏆" label="보스 클리어" value={`${currentUser.bossCleared}회`} />
        </div>

        {/* Current Title */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: "0.05s" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">현재 칭호</span>
            <span className="rounded-full bg-accent/30 px-3 py-1 text-sm font-bold text-accent-foreground">{currentUser.title}</span>
          </div>
          <XPBar current={currentUser.xp} max={currentUser.xpToNext} />
        </div>

        {/* Reward Boxes */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">📦 보상 상자</h2>
          <div className="space-y-3">
            {rewardBoxes.map((box) => (
              <RewardBoxCard key={box.id} box={box} />
            ))}
          </div>
        </div>

        {/* Earned Badges */}
        <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">🏅 획득한 배지</h2>
          <div className="grid grid-cols-3 gap-3">
            {earned.map((b) => (
              <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-primary/20 bg-card p-3 shadow-sm text-center">
                <span className="text-3xl">{b.icon}</span>
                <span className="text-xs font-bold text-foreground">{b.name}</span>
                {b.earnedDate && (
                  <span className="text-[10px] text-muted-foreground">{b.earnedDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Locked Badges */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="mb-3 text-base font-bold text-muted-foreground">🔒 미획득</h2>
          <div className="grid grid-cols-3 gap-3">
            {locked.map((b) => (
              <div key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-muted/30 p-3 text-center opacity-50">
                <span className="text-3xl grayscale">{b.icon}</span>
                <span className="text-xs font-bold text-foreground">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
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

const RewardBoxCard = ({ box }: { box: typeof rewardBoxes[0] }) => {
  const [opened, setOpened] = useState(box.opened);
  const [reward, setReward] = useState(box.reward || "");

  const handleOpen = () => {
    if (opened) return;
    setOpened(true);
    setReward("칭호: 불굴의 파이터 🥊");
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#E8553A", "#F5A623", "#FFD700"],
    });
  };

  return (
    <div
      onClick={handleOpen}
      className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition-all ${
        opened
          ? "border-border bg-card"
          : "cursor-pointer border-accent/40 bg-accent/5 active:scale-[0.98] hover:shadow-md"
      }`}
    >
      <span className="text-3xl">{opened ? "📭" : box.icon}</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-foreground">{box.name}</p>
        {opened ? (
          <p className="text-xs text-status-complete">{reward || box.reward}</p>
        ) : (
          <p className="text-xs text-accent-foreground">탭하여 열기!</p>
        )}
      </div>
      {!opened && <Gift className="h-5 w-5 text-accent" />}
    </div>
  );
};

export default RewardsPage;
