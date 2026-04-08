interface XPBarProps {
  current: number;
  max: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const XPBar = ({ current, max, showLabel = true, size = "md" }: XPBarProps) => {
  const pct = Math.min((current / max) * 100, 100);
  const h = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">XP</span>
          <span className="font-display font-semibold text-primary">{current} / {max}</span>
        </div>
      )}
      <div className={`${h} w-full overflow-hidden rounded-full bg-xp-bg`}>
        <div
          className={`${h} rounded-full bg-xp-bar transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default XPBar;
