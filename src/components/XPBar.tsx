interface XPBarProps {
  current: number;
  max: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

/**
 * Legacy XPBar — kept alive for pages that still import it
 * (MemberPreviewPage, MyPage). Fill uses the design-system primary
 * gradient (#D93620 → #FF6A3D); track follows --xp-bar-bg which is
 * context-aware (dark #2A3344 / light #E1E5EC via .light-surface).
 * Number readouts use the .number-font utility for tabular Space
 * Grotesk digits.
 *
 * New pages should import XPBar from @/components/ui/rankingup for
 * full variant support.
 */
const XPBar = ({ current, max, showLabel = true, size = "md" }: XPBarProps) => {
  const safeMax = Math.max(1, max);
  const pct = Math.min((current / safeMax) * 100, 100);
  const h = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">XP</span>
          <span className="number-font font-semibold text-foreground">
            {current.toLocaleString()}
            <span className="text-muted-foreground"> / {max.toLocaleString()}</span>
          </span>
        </div>
      )}
      <div className={`${h} w-full overflow-hidden rounded-full bg-[hsl(var(--xp-bar-bg))]`}>
        <div
          className={`${h} rounded-full transition-all duration-500`}
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(13 100% 62%) 100%)",
          }}
        />
      </div>
    </div>
  );
};

export default XPBar;
