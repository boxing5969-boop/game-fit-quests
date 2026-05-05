/**
 * 153 스토리 RPG — 능력치 HUD (단계 46).
 *
 * 6 stat (체력/집중/기술/가드/투지/리스펙트) + 스토리 XP / 링 코인.
 */

import type { StoryPlayerStats } from "@/types/storyRpg";

const STAT_META: Array<{
  key: keyof Pick<StoryPlayerStats, "hp" | "focus" | "skill" | "guard" | "grit" | "respect">;
  maxKey: keyof Pick<StoryPlayerStats, "hp_max" | "focus_max" | "skill_max" | "guard_max" | "grit_max" | "respect_max">;
  label: string;
  color: string;
}> = [
  { key: "hp", maxKey: "hp_max", label: "체력", color: "from-rose-500 to-rose-300" },
  { key: "focus", maxKey: "focus_max", label: "집중", color: "from-yellow-400 to-amber-300" },
  { key: "skill", maxKey: "skill_max", label: "기술", color: "from-sky-500 to-sky-300" },
  { key: "guard", maxKey: "guard_max", label: "가드", color: "from-zinc-400 to-zinc-200" },
  { key: "grit", maxKey: "grit_max", label: "투지", color: "from-orange-500 to-orange-300" },
  { key: "respect", maxKey: "respect_max", label: "리스펙트", color: "from-violet-500 to-violet-300" },
];

export interface StoryPlayerStatsHudProps {
  stats: StoryPlayerStats | null | undefined;
  compact?: boolean;
}

const StoryPlayerStatsHud = ({ stats, compact }: StoryPlayerStatsHudProps) => {
  if (!stats) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-3 text-center text-[11px] text-muted-foreground">
        세션 준비 중…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-gray-950/80 via-slate-900/60 to-gray-950/80 p-3">
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {STAT_META.map((m) => {
          const cur = stats[m.key] as number;
          const max = stats[m.maxKey] as number;
          const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
          return (
            <div key={m.key} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[10px] tabular-nums">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-bold text-foreground">
                  {cur}/{max}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-900/80">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${m.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
        <span className="font-bold text-amber-300 tabular-nums">
          STORY XP {stats.story_xp.toLocaleString()}
        </span>
        <span className="font-bold text-rose-300 tabular-nums">
          링 코인 {stats.ring_coins.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default StoryPlayerStatsHud;
