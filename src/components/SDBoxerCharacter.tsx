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

const LEAGUE_THEME: Record<League, { glove: string; glow: string; accent: string; highlight: string; shorts: string; aura: string }> = {
  white: { glove: "#b8b8b8", glow: "rgba(200,200,200,0.25)", accent: "#d4d4d4", highlight: "#ffffff", shorts: "#e0e0e0", aura: "rgba(255,255,255,0.15)" },
  blue:  { glove: "#3b82f6", glow: "rgba(59,130,246,0.3)",  accent: "#60a5fa", highlight: "#93c5fd", shorts: "#2563eb", aura: "rgba(59,130,246,0.12)" },
  red:   { glove: "#ef4444", glow: "rgba(239,68,68,0.3)",   accent: "#f87171", highlight: "#fca5a5", shorts: "#dc2626", aura: "rgba(239,68,68,0.12)" },
  black: { glove: "#1a1a1a", glow: "rgba(234,179,8,0.35)",  accent: "#eab308", highlight: "#fde047", shorts: "#111111", aura: "rgba(234,179,8,0.12)" },
};

const SDBoxerCharacter: React.FC<SDBoxerCharacterProps> = ({
  league, nickname, level, state, subtitle, branchName,
}) => {
  const [animState, setAnimState] = useState<CharState>(state);
  const [blink, setBlink] = useState(false);
  const theme = LEAGUE_THEME[league] || LEAGUE_THEME.white;

  useEffect(() => {
    setAnimState(state);
    if (state === "enter") {
      const t = setTimeout(() => setAnimState("idle"), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);

  // Blink loop
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const wrapperClass =
    animState === "enter"
      ? "animate-boxer-enter"
      : animState === "exit"
      ? "animate-boxer-exit"
      : "";

  const eyeH = blink ? 1.5 : 11;
  const eyeY = blink ? 105 : 100;

  return (
    <div className={`flex flex-col items-center select-none ${wrapperClass}`} style={{ willChange: "transform, opacity" }}>
      <svg
        viewBox="0 0 200 240"
        className="w-[clamp(120px,15vw,220px)] h-auto animate-boxer-idle"
        style={{ willChange: "transform" }}
        aria-label="SD Boxer Character"
      >
        <defs>
          {/* Glove gradient */}
          <radialGradient id={`gloveGrad-${league}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor={theme.highlight} stopOpacity="0.6" />
            <stop offset="100%" stopColor={theme.glove} />
          </radialGradient>
          {/* Body shadow */}
          <filter id="softShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Floor shadow */}
        <ellipse cx="100" cy="232" rx="38" ry="6" fill="rgba(0,0,0,0.18)" className="animate-boxer-shadow" />

        {/* Aura ring */}
        <circle cx="100" cy="140" r="55" fill="none" stroke={theme.aura} strokeWidth="18" opacity="0.5" className="animate-boxer-aura" />

        {/* ── BODY GROUP ── */}
        <g className="animate-boxer-body" filter="url(#softShadow)">
          {/* Legs - short & cute */}
          <rect x="82" y="188" width="13" height="26" rx="6" fill="#f5d0b0" />
          <rect x="105" y="188" width="13" height="26" rx="6" fill="#f5d0b0" />

          {/* Shoes */}
          <rect x="78" y="210" width="20" height="10" rx="5" fill="#333" />
          <rect x="102" y="210" width="20" height="10" rx="5" fill="#333" />
          <rect x="79" y="210" width="8" height="4" rx="2" fill="#555" />
          <rect x="103" y="210" width="8" height="4" rx="2" fill="#555" />

          {/* Shorts */}
          <path d="M75 178 Q100 184 125 178 L122 196 Q100 200 78 196 Z" fill={theme.shorts} />
          <path d="M75 178 Q100 184 125 178 L124 183 Q100 188 76 183 Z" fill={theme.accent} opacity="0.4" />
          {/* Shorts stripe */}
          <rect x="95" y="178" width="10" height="18" rx="2" fill="white" opacity="0.15" />

          {/* Torso - tank top */}
          <rect x="76" y="148" width="48" height="34" rx="10" fill="#333" />
          {/* Tank top neckline */}
          <path d="M84 148 Q100 156 116 148" fill="#444" />
          <rect x="82" y="148" width="36" height="30" rx="7" fill="#444" />
          {/* Tank top stripe */}
          <rect x="96" y="148" width="8" height="30" rx="2" fill={theme.accent} opacity="0.2" />

          {/* Left arm + glove */}
          <g className="animate-boxer-jab-left" style={{ transformOrigin: "72px 158px" }}>
            <rect x="52" y="152" width="12" height="24" rx="5" fill="#f5d0b0" />
            {/* Wrist wrap */}
            <rect x="50" y="148" width="16" height="6" rx="3" fill="white" opacity="0.7" />
            {/* Glove */}
            <circle cx="58" cy="144" r="16" fill={`url(#gloveGrad-${league})`} />
            <circle cx="58" cy="144" r="12" fill={theme.glove} opacity="0.4" />
            {/* Glove shine */}
            <ellipse cx="52" cy="138" rx="4" ry="5" fill="white" opacity="0.35" />
            {/* Speed line on jab */}
            <line x1="30" y1="142" x2="42" y2="144" stroke={theme.accent} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" className="animate-boxer-speed-line-l" />
          </g>

          {/* Right arm + glove */}
          <g className="animate-boxer-jab-right" style={{ transformOrigin: "128px 158px" }}>
            <rect x="136" y="152" width="12" height="24" rx="5" fill="#f5d0b0" />
            <rect x="134" y="148" width="16" height="6" rx="3" fill="white" opacity="0.7" />
            <circle cx="142" cy="144" r="16" fill={`url(#gloveGrad-${league})`} />
            <circle cx="142" cy="144" r="12" fill={theme.glove} opacity="0.4" />
            <ellipse cx="136" cy="138" rx="4" ry="5" fill="white" opacity="0.35" />
            <line x1="170" y1="142" x2="158" y2="144" stroke={theme.accent} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" className="animate-boxer-speed-line-r" />
          </g>
        </g>

        {/* ── HEAD GROUP (big = cute SD ratio) ── */}
        <g className="animate-boxer-head">
          {/* Head - large for 2:1 ratio */}
          <circle cx="100" cy="96" r="52" fill="#f5d0b0" />
          {/* Cheek blush */}
          <ellipse cx="72" cy="110" rx="8" ry="5" fill="#ffb4a2" opacity="0.45" />
          <ellipse cx="128" cy="110" rx="8" ry="5" fill="#ffb4a2" opacity="0.45" />

          {/* Hair */}
          <ellipse cx="100" cy="56" rx="46" ry="24" fill="#2d2d2d" />
          <rect x="54" y="52" width="92" height="24" rx="12" fill="#2d2d2d" />
          {/* Hair highlights */}
          <ellipse cx="80" cy="50" rx="12" ry="4" fill="#444" opacity="0.5" />
          <ellipse cx="115" cy="48" rx="8" ry="3" fill="#444" opacity="0.4" />
          {/* Side hair tufts */}
          <ellipse cx="56" cy="80" rx="6" ry="14" fill="#2d2d2d" />
          <ellipse cx="144" cy="80" rx="6" ry="14" fill="#2d2d2d" />

          {/* Headband */}
          <rect x="54" y="72" width="92" height="9" rx="4.5" fill={theme.glove} />
          <rect x="54" y="72" width="92" height="9" rx="4.5" fill={theme.glow} />
          {/* Headband knot */}
          <ellipse cx="148" cy="77" rx="6" ry="4" fill={theme.accent} />
          <line x1="150" y1="73" x2="156" y2="68" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="150" y1="81" x2="155" y2="86" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" />

          {/* Eyes - big & sparkly */}
          <ellipse cx="82" cy={eyeY} rx="10" ry={eyeH} fill="white" />
          <ellipse cx="118" cy={eyeY} rx="10" ry={eyeH} fill="white" />
          {!blink && (
            <>
              <circle cx="84" cy="101" r="6" fill="#1a1a1a" />
              <circle cx="120" cy="101" r="6" fill="#1a1a1a" />
              {/* Eye sparkle */}
              <circle cx="87" cy="97" r="2.5" fill="white" />
              <circle cx="123" cy="97" r="2.5" fill="white" />
              <circle cx="82" cy="103" r="1.2" fill="white" opacity="0.6" />
              <circle cx="118" cy="103" r="1.2" fill="white" opacity="0.6" />
            </>
          )}

          {/* Eyebrows - determined */}
          <line x1="74" y1="86" x2="90" y2="88" stroke="#2d2d2d" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="110" y1="88" x2="126" y2="86" stroke="#2d2d2d" strokeWidth="2.5" strokeLinecap="round" />

          {/* Mouth - confident grin */}
          <path d="M 90 118 Q 100 126 110 118" stroke="#8B4513" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Little fang */}
          <path d="M 104 118 L 106 122 L 108 118" fill="white" stroke="#8B4513" strokeWidth="0.5" />

          {/* Nose */}
          <ellipse cx="100" cy="110" rx="2" ry="1.5" fill="#dba88a" />
        </g>
      </svg>

      {/* ── Nameplate ── */}
      <div className="mt-1 text-center" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        <p className="text-[clamp(2rem,4vw,4rem)] font-black leading-none tracking-tight text-white">
          {nickname}
        </p>
        <p className="text-[clamp(1rem,2vw,2rem)] font-black mt-1 opacity-80 text-white">
          {formatRank(league, level)}
        </p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/20 backdrop-blur-sm px-4 py-1.5">
          <span className="text-[clamp(0.85rem,1.5vw,1.2rem)]">🥊</span>
          <span className="text-[clamp(0.8rem,1.3vw,1.1rem)] font-bold text-white/90">
            {subtitle || "복싱 레벨업 중"}
          </span>
        </div>
        {branchName && (
          <p className="mt-1 text-[clamp(0.7rem,1vw,0.9rem)] text-white/50 font-bold">{branchName}</p>
        )}
      </div>
    </div>
  );
};

export default SDBoxerCharacter;
