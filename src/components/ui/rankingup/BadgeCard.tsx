import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Rarity = "common" | "rare" | "epic" | "master" | "legend";

interface BadgeCardProps {
  title: string;
  /** Emoji string, icon node, or render result. */
  icon?: ReactNode;
  /** Image source if you prefer artwork over an icon. */
  image?: string;
  rarity?: Rarity;
  locked?: boolean;
  /** Optional subtitle / acquired date / rarity name. */
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-border bg-card",
  rare: "border-accent/40 bg-accent/5",
  epic: "border-[hsl(270_70%_60%)]/40 bg-[hsl(270_70%_60%)]/5",
  master: "border-reward/50 bg-reward/10 shadow-glow-reward",
  legend:
    "border-[hsl(13_100%_62%)]/50 bg-gradient-to-br from-[hsl(13_100%_62%)]/10 via-reward/10 to-accent/10 shadow-glow-reward",
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: "커먼",
  rare: "레어",
  epic: "에픽",
  master: "마스터",
  legend: "레전드",
};

const RARITY_LABEL_TONE: Record<Rarity, string> = {
  common: "text-muted-foreground",
  rare: "text-accent",
  epic: "text-[hsl(270_70%_70%)]",
  master: "text-reward",
  legend: "text-reward",
};

export const BadgeCard = ({
  title,
  icon,
  image,
  rarity = "common",
  locked = false,
  subtitle,
  onClick,
  className,
}: BadgeCardProps) => {
  const Root = onClick ? "button" : "div";
  return (
    <Root
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex min-w-[88px] flex-col items-center gap-1.5 rounded-card border p-3 transition-all",
        RARITY_BORDER[rarity],
        locked && "opacity-55 grayscale",
        onClick && "active:scale-[0.97]",
        className,
      )}
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-pill bg-background/40">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full rounded-pill object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl leading-none">{icon ?? "🏅"}</span>
        )}
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center rounded-pill bg-background/60 backdrop-blur-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
      </div>
      <p className="text-caption line-clamp-1 font-bold text-foreground">
        {title}
      </p>
      <p className={cn("text-[10px] font-bold", RARITY_LABEL_TONE[rarity])}>
        {subtitle ?? RARITY_LABEL[rarity]}
      </p>
    </Root>
  );
};

export default BadgeCard;
