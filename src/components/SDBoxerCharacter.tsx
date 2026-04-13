import React, { useEffect, useState, useMemo } from "react";
import { formatRank } from "@/lib/rankLabels";

// Import all cropped boxer emoticons
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
import boxer13 from "@/assets/boxers/boxer_13.png";
import boxer14 from "@/assets/boxers/boxer_14.png";
import boxer15 from "@/assets/boxers/boxer_15.png";
import boxer16 from "@/assets/boxers/boxer_16.png";
import boxer17 from "@/assets/boxers/boxer_17.png";
import boxer18 from "@/assets/boxers/boxer_18.png";
import boxer19 from "@/assets/boxers/boxer_19.png";
import boxer20 from "@/assets/boxers/boxer_20.png";
import boxer21 from "@/assets/boxers/boxer_21.png";
import boxer22 from "@/assets/boxers/boxer_22.png";
import boxer23 from "@/assets/boxers/boxer_23.png";
import boxer24 from "@/assets/boxers/boxer_24.png";
import boxer25 from "@/assets/boxers/boxer_25.png";
import boxer26 from "@/assets/boxers/boxer_26.png";
import boxer27 from "@/assets/boxers/boxer_27.png";
import boxer28 from "@/assets/boxers/boxer_28.png";
import boxer29 from "@/assets/boxers/boxer_29.png";

const BOXER_IMAGES = [
  boxer1, boxer2, boxer3, boxer4, boxer5, boxer6, boxer7, boxer8, boxer9,
  boxer10, boxer11, boxer12, boxer13, boxer14, boxer15, boxer16, boxer17,
  boxer18, boxer19, boxer20, boxer21, boxer22, boxer23, boxer24, boxer25,
  boxer26, boxer27, boxer28, boxer29,
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
  white: "0 0 30px rgba(200,200,200,0.4), 0 0 60px rgba(255,255,255,0.15)",
  blue: "0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2)",
  red: "0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.2)",
  black: "0 0 30px rgba(234,179,8,0.5), 0 0 60px rgba(234,179,8,0.25)",
};

/** Deterministic character selection based on nickname */
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

  // Periodic punch effect in idle
  useEffect(() => {
    if (animState !== "idle") return;
    const interval = setInterval(() => {
      setShowPunchEffect(true);
      setTimeout(() => setShowPunchEffect(false), 600);
    }, 5000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [animState]);

  const wrapperAnim =
    animState === "enter" ? "animate-emote-enter"
    : animState === "exit" ? "animate-emote-exit"
    : "";

  return (
    <div className={`flex flex-col items-center select-none ${wrapperAnim}`}>
      {/* Character image with animations */}
      <div className="relative">
        {/* Glow ring behind character */}
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-emote-glow"
          style={{ boxShadow: LEAGUE_GLOW[league], transform: "scale(0.7)" }}
        />

        {/* Character image */}
        <div className={`relative ${showPunchEffect ? "animate-emote-punch" : "animate-emote-idle"}`}>
          <img
            src={characterImg}
            alt={nickname}
            className="w-[clamp(80px,10vw,140px)] h-auto object-contain drop-shadow-lg"
            style={{ imageRendering: "auto", willChange: "transform" }}
            draggable={false}
          />

          {/* Punch effect lines */}
          {showPunchEffect && (
            <>
              <div className="absolute top-1/3 -right-3 animate-emote-speed-line">
                <svg width="24" height="8" viewBox="0 0 24 8">
                  <line x1="0" y1="2" x2="18" y2="2" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                  <line x1="4" y1="6" x2="14" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                </svg>
              </div>
              <div className="absolute top-1/4 -left-2 animate-emote-speed-line-r">
                <svg width="20" height="6" viewBox="0 0 20 6">
                  <line x1="20" y1="3" x2="6" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* Sparkle */}
        <div className="absolute -top-1 -right-1 animate-emote-sparkle">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5Z" fill="white" opacity="0.6" />
          </svg>
        </div>
      </div>

      {/* Nameplate */}
      <div className="mt-3 text-center" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
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
