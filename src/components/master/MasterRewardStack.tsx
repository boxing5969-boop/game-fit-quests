import { Banknote, Crown, Frame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterLevelDefinition } from "@/data/masterTierData";

interface MasterRewardStackProps {
  def: Pick<
    MasterLevelDefinition,
    "gemReward" | "titleReward" | "frameReward" | "auraReward"
  >;
  dim?: boolean;
  className?: string;
}

/**
 * Inline chip row summarizing the rewards a master-track level grants.
 * Used inside MasterLevelCard and MasterProgressCard. Hidden slots
 * collapse so cards with only a gem reward stay tight.
 */
export const MasterRewardStack = ({
  def,
  dim,
  className,
}: MasterRewardStackProps) => {
  const chips: Array<{ icon: React.ReactNode; text: string; tone: string }> = [];

  if (def.gemReward > 0) {
    chips.push({
      icon: <Banknote className="h-3 w-3" />,
      text: `+${def.gemReward.toLocaleString()}`,
      tone: "bg-reward/12 text-reward",
    });
  }
  if (def.titleReward) {
    chips.push({
      icon: <Crown className="h-3 w-3" />,
      text: "칭호",
      tone: "bg-primary/12 text-primary",
    });
  }
  if (def.frameReward) {
    chips.push({
      icon: <Frame className="h-3 w-3" />,
      text: "프레임",
      tone: "bg-accent/12 text-accent",
    });
  }
  if (def.auraReward) {
    chips.push({
      icon: <Sparkles className="h-3 w-3" />,
      text: "오라",
      tone: "bg-[hsl(280_85%_58%)]/12 text-[hsl(280_85%_70%)]",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
            c.tone,
            dim && "opacity-60",
          )}
        >
          {c.icon}
          <span className="number-font">{c.text}</span>
        </span>
      ))}
    </div>
  );
};

export default MasterRewardStack;
