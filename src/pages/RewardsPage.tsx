import { badges, currentUser } from "@/lib/mockData";
import XPBar from "@/components/XPBar";

const RewardsPage = () => {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-6">
      <h1 className="text-2xl">🎁 보상</h1>

      {/* XP Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">다음 레벨까지</p>
        <XPBar current={currentUser.xp} max={currentUser.xpToNext} />
      </div>

      {/* Earned */}
      <section>
        <h2 className="mb-3 text-base">🏅 획득한 배지</h2>
        <div className="grid grid-cols-3 gap-3">
          {earned.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 rounded-xl border border-primary/20 bg-card p-3 text-center">
              <span className="text-3xl">{b.icon}</span>
              <span className="font-display text-xs font-bold">{b.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Locked */}
      <section>
        <h2 className="mb-3 text-base text-muted-foreground">🔒 미획득</h2>
        <div className="grid grid-cols-3 gap-3">
          {locked.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted/30 p-3 text-center opacity-50">
              <span className="text-3xl grayscale">{b.icon}</span>
              <span className="font-display text-xs font-bold">{b.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default RewardsPage;
