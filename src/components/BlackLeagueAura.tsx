import React from "react";

type AuraMode = "compact" | "detail";
type AuraLevel = "halo" | "master";

interface BlackLeagueAuraProps {
  mode?: AuraMode;
  level?: AuraLevel;
  /** Size of container — aura scales to fill */
  className?: string;
}

/**
 * Premium animated rainbow halo for Black League members.
 * - compact: thin ring + subtle glow (for dense rail)
 * - detail: full animated halo + sparkles (for profile/builder)
 * - master: 3-ring system with extra sparkles and stronger glow
 */
const BlackLeagueAura: React.FC<BlackLeagueAuraProps> = ({
  mode = "compact",
  level = "halo",
  className = "",
}) => {
  const isMaster = level === "master";
  const isDetail = mode === "detail";

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {/* Outer ring (master only) — extends beyond container bounds */}
      {isMaster && (
        <div
          className={`absolute rounded-full animate-aura-hue ${isDetail ? "opacity-50" : "opacity-30"}`}
          style={{
            inset: "-8px",
            background: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
            mask: "radial-gradient(circle, transparent 42%, black 47%, black 68%, transparent 73%)",
            WebkitMask: "radial-gradient(circle, transparent 42%, black 47%, black 68%, transparent 73%)",
            filter: "brightness(1.4) saturate(1.3)",
            animationDuration: "6s",
          }}
        />
      )}

      {/* Main rainbow ring */}
      <div
        className={`absolute inset-0 rounded-full animate-aura-hue ${isDetail ? "opacity-60" : "opacity-40"}`}
        style={{
          background: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
          mask: "radial-gradient(circle, transparent 58%, black 62%, black 72%, transparent 76%)",
          WebkitMask: "radial-gradient(circle, transparent 58%, black 62%, black 72%, transparent 76%)",
          ...(isMaster && isDetail ? { filter: "brightness(1.4) saturate(1.2)" } : {}),
        }}
      />

      {/* Inner reverse ring (master only) — slower, tighter, complements main ring */}
      {isMaster && (
        <div
          className={`absolute rounded-full animate-aura-hue-reverse ${isDetail ? "opacity-35" : "opacity-20"}`}
          style={{
            inset: "3px",
            background: "conic-gradient(from 180deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
            mask: "radial-gradient(circle, transparent 62%, black 66%, black 74%, transparent 78%)",
            WebkitMask: "radial-gradient(circle, transparent 62%, black 66%, black 74%, transparent 78%)",
            animationDuration: "12s",
          }}
        />
      )}

      {/* Soft glow pulse */}
      <div
        className={`absolute inset-0 rounded-full animate-aura-pulse ${isDetail ? "opacity-30" : "opacity-15"}`}
        style={{
          background: "radial-gradient(circle, rgba(147,51,234,0.4), rgba(59,130,246,0.2), transparent 70%)",
          ...(isMaster ? { filter: "brightness(1.5) saturate(1.2)" } : {}),
        }}
      />

      {/* Sparkles — detail mode only */}
      {isDetail && (
        <>
          <div className="absolute top-[8%] right-[15%] animate-aura-sparkle">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="white" opacity="0.7" />
            </svg>
          </div>
          <div className="absolute bottom-[12%] left-[10%] animate-aura-sparkle-delayed">
            <svg width="8" height="8" viewBox="0 0 10 10">
              <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="white" opacity="0.6" />
            </svg>
          </div>
          {isMaster && (
            <>
              <div className="absolute top-[20%] left-[18%] animate-aura-sparkle-slow">
                <svg width="7" height="7" viewBox="0 0 10 10">
                  <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="white" opacity="0.55" />
                </svg>
              </div>
              <div className="absolute top-[55%] right-[8%] animate-aura-sparkle">
                <svg width="9" height="9" viewBox="0 0 10 10">
                  <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="#feca57" opacity="0.7" />
                </svg>
              </div>
              <div className="absolute bottom-[20%] right-[18%] animate-aura-sparkle-delayed">
                <svg width="8" height="8" viewBox="0 0 10 10">
                  <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="#48dbfb" opacity="0.65" />
                </svg>
              </div>
              <div className="absolute top-[35%] left-[5%] animate-aura-sparkle-slow">
                <svg width="6" height="6" viewBox="0 0 10 10">
                  <path d="M5 0 L5.8 4.2 L10 5 L5.8 5.8 L5 10 L4.2 5.8 L0 5 L4.2 4.2Z" fill="white" opacity="0.5" />
                </svg>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(BlackLeagueAura);
