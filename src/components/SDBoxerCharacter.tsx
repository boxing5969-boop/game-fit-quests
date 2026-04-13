import React, { useEffect, useState } from "react";
import { formatRank } from "@/lib/rankLabels";

type League = "white" | "blue" | "red" | "black";
type CharState = "enter" | "idle" | "exit";

interface SDBoxerCharacterProps {
  league: League;
  nickname: string;
  level: number;
  state: CharState;
  subtitle?: string;
  branchName?: string;
}

const LEAGUE_THEME: Record<League, { glove: string; glow: string; accent: string; highlight: string }> = {
  white: { glove: "#c0c0c0", glow: "rgba(192,192,192,0.3)", accent: "#e0e0e0", highlight: "#ffffff" },
  blue:  { glove: "#3b82f6", glow: "rgba(59,130,246,0.35)", accent: "#60a5fa", highlight: "#93c5fd" },
  red:   { glove: "#ef4444", glow: "rgba(239,68,68,0.35)",  accent: "#f87171", highlight: "#fca5a5" },
  black: { glove: "#1a1a1a", glow: "rgba(234,179,8,0.35)",  accent: "#eab308", highlight: "#fde047" },
};

const SDBoxerCharacter: React.FC<SDBoxerCharacterProps> = ({
  league, nickname, level, state, subtitle, branchName,
}) => {
  const [animState, setAnimState] = useState<CharState>(state);
  const theme = LEAGUE_THEME[league] || LEAGUE_THEME.white;

  useEffect(() => {
    setAnimState(state);
    if (state === "enter") {
      const t = setTimeout(() => setAnimState("idle"), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);

  const wrapperClass =
    animState === "enter"
      ? "animate-boxer-enter"
      : animState === "exit"
      ? "animate-boxer-exit"
      : "";

  return (
    <div className={`flex flex-col items-center select-none ${wrapperClass}`} style={{ willChange: "transform, opacity" }}>
      {/* ── SVG Character ── */}
      <svg
        viewBox="0 0 200 260"
        className="w-[clamp(180px,22vw,320px)] h-auto animate-boxer-idle"
        style={{ willChange: "transform" }}
        aria-label="SD Boxer Character"
      >
        {/* Floor shadow */}
        <ellipse cx="100" cy="252" rx="50" ry="8" fill="rgba(0,0,0,0.25)" className="animate-boxer-shadow" />

        {/* ── Body ── */}
        <g className="animate-boxer-body">
          {/* Legs */}
          <rect x="78" y="195" width="16" height="40" rx="6" fill="#2d2d2d" />
          <rect x="106" y="195" width="16" height="40" rx="6" fill="#2d2d2d" />
          {/* Shoes */}
          <rect x="74" y="228" width="24" height="12" rx="5" fill="#1a1a1a" />
          <rect x="102" y="228" width="24" height="12" rx="5" fill="#1a1a1a" />

          {/* Torso - tank top */}
          <rect x="72" y="140" width="56" height="60" rx="12" fill="#333333" />
          <rect x="80" y="140" width="40" height="55" rx="8" fill="#444444" />
          {/* Shorts */}
          <rect x="72" y="185" width="56" height="22" rx="6" fill={theme.glove} opacity="0.7" />

          {/* Left arm + glove */}
          <g className="animate-boxer-jab-left" style={{ transformOrigin: "68px 160px" }}>
            <rect x="48" y="148" width="16" height="35" rx="6" fill="#c4956a" />
            <circle cx="56" cy="145" r="18" fill={theme.glove} />
            <circle cx="56" cy="145" r="14" fill={theme.accent} opacity="0.5" />
            {/* Glove shine */}
            <ellipse cx="50" cy="139" rx="4" ry="6" fill={theme.highlight} opacity="0.4" />
          </g>

          {/* Right arm + glove */}
          <g className="animate-boxer-jab-right" style={{ transformOrigin: "132px 160px" }}>
            <rect x="136" y="148" width="16" height="35" rx="6" fill="#c4956a" />
            <circle cx="144" cy="145" r="18" fill={theme.glove} />
            <circle cx="144" cy="145" r="14" fill={theme.accent} opacity="0.5" />
            <ellipse cx="138" cy="139" rx="4" ry="6" fill={theme.highlight} opacity="0.4" />
          </g>
        </g>

        {/* ── Head ── */}
        <g className="animate-boxer-head">
          {/* Head circle */}
          <circle cx="100" cy="100" r="52" fill="#d4a574" />
          {/* Hair */}
          <ellipse cx="100" cy="60" rx="45" ry="22" fill="#2d2d2d" />
          <rect x="55" y="55" width="90" height="20" rx="10" fill="#2d2d2d" />

          {/* Face */}
          {/* Eyes - big SD style */}
          <ellipse cx="82" cy="100" rx="9" ry="10" fill="white" />
          <ellipse cx="118" cy="100" rx="9" ry="10" fill="white" />
          <circle cx="84" cy="101" r="5" fill="#1a1a1a" />
          <circle cx="120" cy="101" r="5" fill="#1a1a1a" />
          {/* Eye shine */}
          <circle cx="86" cy="98" r="2" fill="white" />
          <circle cx="122" cy="98" r="2" fill="white" />

          {/* Mouth - determined smile */}
          <path d="M 90 118 Q 100 126 110 118" stroke="#8B4513" strokeWidth="2.5" fill="none" strokeLinecap="round" />

          {/* Headband with league color */}
          <rect x="56" y="78" width="88" height="8" rx="4" fill={theme.glove} />
          <rect x="56" y="78" width="88" height="8" rx="4" fill={theme.glow} />
        </g>

        {/* League glow aura */}
        <circle cx="100" cy="150" r="70" fill="none" stroke={theme.glow} strokeWidth="3" opacity="0.4" className="animate-boxer-aura" />
      </svg>

      {/* ── Nameplate ── */}
      <div className="mt-2 text-center" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        <p className="text-[clamp(2.5rem,5vw,5rem)] font-black leading-none tracking-tight text-white">
          {nickname}
        </p>
        <p className="text-[clamp(1.2rem,2.5vw,2.5rem)] font-black mt-1 opacity-80 text-white">
          {formatRank(league, level)}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-black/20 backdrop-blur-sm px-5 py-2">
          <span className="text-[clamp(1rem,1.8vw,1.5rem)]">🥊</span>
          <span className="text-[clamp(0.9rem,1.6vw,1.3rem)] font-bold text-white/90">
            {subtitle || "복싱 레벨업 중"}
          </span>
        </div>
        {branchName && (
          <p className="mt-1 text-[clamp(0.8rem,1.2vw,1rem)] text-white/50 font-bold">{branchName}</p>
        )}
      </div>
    </div>
  );
};

export default SDBoxerCharacter;
