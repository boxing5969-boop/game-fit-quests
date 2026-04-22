import { Gem, Crown, Sparkles, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface InductionRewardPreviewProps {
  totalGems: number;
  /** 강조 플래시 on 모드 — 완료 화면에서 사용. */
  celebrated?: boolean;
  className?: string;
}

interface RewardTile {
  icon: typeof Gem;
  label: string;
  value: string;
  tint: "reward" | "primary" | "accent" | "muted";
}

/**
 * 입단식 완료 보상 4종 미리보기.
 *
 * 카드 4-grid (2x2) 고정. 스크롤 없이 한눈에.
 * `celebrated=true` 시 플래시 + glow 로 보상 확정 느낌 강화.
 */
export const InductionRewardPreview = ({
  totalGems,
  celebrated = false,
  className,
}: InductionRewardPreviewProps) => {
  const tiles: RewardTile[] = [
    { icon: Gem,         label: "파이트 머니", value: `${totalGems.toLocaleString()}젬`, tint: "reward"  },
    { icon: Crown,       label: "칭호",       value: "신입 챌린저",                  tint: "primary" },
    { icon: Sparkles,    label: "이펙트",     value: "반짝임 1종",                    tint: "accent"  },
    { icon: BadgeCheck,  label: "배지",       value: "튜토리얼 완료",                 tint: "muted"   },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground">
        <span>완료 보상 미리보기</span>
        {celebrated && <span className="text-reward">지급 완료</span>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-card/80 p-2.5 transition-all duration-300",
                t.tint === "reward"  && "border-reward/30",
                t.tint === "primary" && "border-primary/30",
                t.tint === "accent"  && "border-accent/30",
                t.tint === "muted"   && "border-border",
                celebrated && "animate-bounce-in shadow-[0_0_18px_rgba(246,196,83,0.35)]",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  t.tint === "reward"  && "bg-reward/15 text-reward",
                  t.tint === "primary" && "bg-primary/15 text-primary",
                  t.tint === "accent"  && "bg-accent/15 text-accent",
                  t.tint === "muted"   && "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[10px] text-muted-foreground">{t.label}</div>
                <div className="truncate text-[12px] font-bold text-foreground">{t.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InductionRewardPreview;
