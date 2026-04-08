import { levelMap, currentUser } from "@/lib/mockData";
import RankBadge from "@/components/RankBadge";
import { Lock, Star, Sword } from "lucide-react";

const LevelMapPage = () => {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">🗺️ 레벨맵</h1>
        <RankBadge rank={currentUser.rank} level={currentUser.level} />
      </div>

      <div className="relative flex flex-col items-center gap-3 py-4">
        {/* Render from top (level 10) to bottom (level 1) */}
        {[...levelMap].reverse().map((node, idx) => {
          const isLeft = idx % 2 === 0;
          return (
            <div
              key={node.level}
              className={`flex w-full items-center gap-3 ${isLeft ? "justify-start pl-8" : "justify-end pr-8"}`}
            >
              <div
                className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 transition-all ${
                  node.current
                    ? "border-primary bg-primary/20 glow-gold animate-pulse-glow"
                    : node.unlocked
                    ? "border-border bg-card"
                    : "border-border/30 bg-muted/30 opacity-40"
                }`}
              >
                {node.isBoss ? (
                  <Sword className={`h-6 w-6 ${node.unlocked ? "text-destructive" : "text-muted-foreground"}`} />
                ) : node.unlocked ? (
                  <Star className={`h-5 w-5 ${node.current ? "text-primary" : "text-foreground"}`} />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
                <span className={`mt-0.5 font-display text-xs font-bold ${node.current ? "text-primary" : ""}`}>
                  Lv.{node.level}
                </span>
              </div>

              {node.isBoss && (
                <span className="rounded-md bg-destructive/20 px-2 py-0.5 font-display text-xs font-semibold text-destructive">
                  BOSS
                </span>
              )}
              {node.current && (
                <span className="rounded-md bg-primary/20 px-2 py-0.5 font-display text-xs font-semibold text-primary">
                  현재
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LevelMapPage;
