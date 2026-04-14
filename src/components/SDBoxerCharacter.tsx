import React, { useEffect, useState, useMemo } from "react";
import { formatRank } from "@/lib/rankLabels";
import BlackLeagueAura from "@/components/BlackLeagueAura";

import boxer1 from "@/assets/boxers/boxer_1.png";
import boxer2 from "@/assets/boxers/boxer_2.png";
import boxer3 from "@/assets/boxers/boxer_3.png";
import boxer4 from "@/assets/boxers/boxer_4.png";
import boxer5 from "@/assets/boxers/boxer_5.png";
import boxer6 from "@/assets/boxers/boxer_6.png";
import boxer7 from "@/assets/boxers/boxer_7.png";
import boxer8 from "@/assets/boxers/boxer_8.png";
import boxer9 from "@/assets/boxers/boxer_9.png";
import boxer10 from "@/assets/boxers/boxer_10.png";
import boxer11 from "@/assets/boxers/boxer_11.png";
import boxer12 from "@/assets/boxers/boxer_12.png";

const BOXER_IMAGES = [
  boxer1, boxer2, boxer3, boxer4, boxer5, boxer6,
  boxer7, boxer8, boxer9, boxer10, boxer11, boxer12,
];

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

const LEAGUE_GLOW: Record<League, string> = {
  white: "0 0 24px rgba(200,200,200,0.35), 0 0 48px rgba(255,255,255,0.12)",
  blue: "0 0 24px rgba(59,130,246,0.45), 0 0 48px rgba(59,130,246,0.18)",
  red: "0 0 24px rgba(239,68,68,0.45), 0 0 48px rgba(239,68,68,0.18)",
  black: "0 0 24px rgba(234,179,8,0.45), 0 0 48px rgba(234,179,8,0.2)",
};

function getCharacterIndex(nickname: string): number {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = ((hash << 5) - hash + nickname.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BOXER_IMAGES.length;
}

const SDBoxerCharacter: React.FC<SDBoxerCharacterProps> = ({
  league, nickname, level, state, subtitle, branchName,
}) => {
  const [animState, setAnimState] = useState<CharState>(state);
  const [showPunchEffect, setShowPunchEffect] = useState(false);

  const characterImg = useMemo(() => BOXER_IMAGES[getCharacterIndex(nickname)], [nickname]);

  useEffect(() => {
    setAnimState(state);
    if (state === "enter") {
      setShowPunchEffect(true);
      const t1 = setTimeout(() => setAnimState("idle"), 1200);
      const t2 = setTimeout(() => setShowPunchEffect(false), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [state]);

  // Periodic punch effect in idle — every 4-6s
  useEffect(() => {
    if (animState !== "idle") return;
    const interval = setInterval(() => {
      setShowPunchEffect(true);
      setTimeout(() => setShowPunchEffect(false), 700);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [animState]);

  const wrapperAnim =
    animState === "enter" ? "animate-emote-enter"
    : animState === "exit" ? "animate-emote-exit"
    : "";

  return (
    <div className={`flex flex-col items-center select-none ${wrapperAnim}`}>
      {/* Character image with animations */}
      <div className="relative" style={{ transformOrigin: "center bottom" }}>
        {/* Glow ring behind character */}
        <div
          className="absolute inset-0 rounded-full blur-2xl animate-emote-glow"
          style={{ boxShadow: LEAGUE_GLOW[league], transform: "scale(0.6)" }}
        />

        {/* Character image — transform-origin bottom center for natural boxing feel */}
        <div
          className={`relative ${showPunchEffect ? "animate-emote-punch" : "animate-emote-idle"}`}
          style={{ transformOrigin: "center bottom" }}
        >
          <img
            src={characterImg}
            alt={nickname}
            className="w-[clamp(48px,6vw,80px)] h-auto object-contain drop-shadow-lg"
            style={{ imageRendering: "auto", willChange: "transform" }}
            draggable={false}
          />

          {/* Punch effect lines */}
          {showPunchEffect && (
            <>
              <div className="absolute top-1/3 -right-4 animate-emote-speed-line">
                <svg width="28" height="10" viewBox="0 0 28 10">
                  <line x1="0" y1="3" x2="22" y2="3" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
                  <line x1="6" y1="7" x2="16" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                </svg>
              </div>
              <div className="absolute top-1/4 -left-3 animate-emote-speed-line-r">
                <svg width="22" height="8" viewBox="0 0 22 8">
                  <line x1="22" y1="4" x2="6" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* Sparkle */}
        <div className="absolute -top-1 -right-1 animate-emote-sparkle">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M7 0 L8.2 5.8 L14 7 L8.2 8.2 L7 14 L5.8 8.2 L0 7 L5.8 5.8Z" fill="white" opacity="0.55" />
          </svg>
        </div>
      </div>

      {/* Nameplate — close to character */}
      <div className="mt-2 text-center" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        <p className="text-[clamp(1.8rem,3.5vw,3.5rem)] font-black leading-none tracking-tight text-white">
          {nickname}
        </p>
        <p className="text-[clamp(0.9rem,1.8vw,1.6rem)] font-black mt-1 opacity-80 text-white">
          {formatRank(league, level)}
        </p>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/20 backdrop-blur-sm px-3 py-1">
          <span className="text-[clamp(0.75rem,1.2vw,1rem)]">🥊</span>
          <span className="text-[clamp(0.7rem,1.1vw,0.95rem)] font-bold text-white/90">
            {subtitle || "복싱 레벨업 중"}
          </span>
        </div>
        {branchName && (
          <p className="mt-1 text-[clamp(0.65rem,0.9vw,0.8rem)] text-white/50 font-bold">{branchName}</p>
        )}
      </div>
    </div>
  );
};

export default SDBoxerCharacter;
