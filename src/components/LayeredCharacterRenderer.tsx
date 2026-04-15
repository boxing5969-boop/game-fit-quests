import React, { useMemo } from "react";
import { getPartByKey, type PartsSelection } from "@/data/characterPartsData";

interface LayeredCharacterRendererProps {
  parts: PartsSelection;
  size?: number;
  className?: string;
  animate?: boolean;
}

function cfg(parts: PartsSelection, cat: string): Record<string, any> | null {
  const key = parts[cat];
  if (!key) return null;
  return getPartByKey(key)?.config ?? null;
}

const LayeredCharacterRenderer: React.FC<LayeredCharacterRendererProps> = ({
  parts,
  size = 160,
  className = "",
  animate = true,
}) => {
  const skin    = cfg(parts, "skin")      ?? { fill: "#FFE0BD", shadow: "#D4956A" };
  const hairBack  = cfg(parts, "hair_back");
  const hairFront = cfg(parts, "hair_front");
  const eyebrows  = cfg(parts, "eyebrows") ?? { style: "normal", fill: "#2C1810" };
  const eyes    = cfg(parts, "eyes")    ?? { style: "normal", iris: "#4A3728", pupil: "#1A0A00" };
  const mouth   = cfg(parts, "mouth")   ?? { style: "smile",  fill: "#C0392B" };
  const gloves  = cfg(parts, "gloves")  ?? { fill: "#E8553A", shadow: "#C4432E", lace: "#FFF" };
  const top     = cfg(parts, "top")     ?? { style: "tank",   fill: "#E8553A", accent: "#FFF", shadow: "#C4432E" };
  const shorts  = cfg(parts, "shorts")  ?? { style: "basic",  fill: "#1A1A2E", stripe: "#FFF", shadow: "#0D0D1A" };
  const shoes   = cfg(parts, "shoes")   ?? { style: "boots",  fill: "#1A1A2E", sole: "#555",   lace: "#FFF" };
  const accessory = cfg(parts, "accessory");
  const effect    = cfg(parts, "effect");

  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const h = Math.round(size * 1.4);

  return (
    <svg
      viewBox="0 0 200 280"
      width={size}
      height={h}
      className={`select-none ${className}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Skin gradient */}
        <radialGradient id={`sk-${uid}`} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor={lighten(skin.fill, 15)} />
          <stop offset="60%" stopColor={skin.fill} />
          <stop offset="100%" stopColor={skin.shadow} />
        </radialGradient>
        <radialGradient id={`skf-${uid}`} cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor={lighten(skin.fill, 10)} />
          <stop offset="100%" stopColor={skin.fill} />
        </radialGradient>
        {/* Top */}
        <linearGradient id={`tp-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={lighten(top.fill, 20)} />
          <stop offset="40%" stopColor={top.fill} />
          <stop offset="100%" stopColor={top.shadow ?? darken(top.fill, 20)} />
        </linearGradient>
        {/* Shorts */}
        <linearGradient id={`sh-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shorts.fill} />
          <stop offset="100%" stopColor={darken(shorts.fill, 25)} />
        </linearGradient>
        {/* Glove */}
        <radialGradient id={`glL-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={lighten(gloves.fill, 25)} />
          <stop offset="60%" stopColor={gloves.fill} />
          <stop offset="100%" stopColor={gloves.shadow} />
        </radialGradient>
        <radialGradient id={`glR-${uid}`} cx="65%" cy="30%" r="70%">
          <stop offset="0%" stopColor={lighten(gloves.fill, 25)} />
          <stop offset="60%" stopColor={gloves.fill} />
          <stop offset="100%" stopColor={gloves.shadow} />
        </radialGradient>
        {/* Shoe */}
        <linearGradient id={`sw-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(shoes.fill, 15)} />
          <stop offset="100%" stopColor={darken(shoes.fill, 10)} />
        </linearGradient>
        {/* Ground shadow */}
        <radialGradient id={`gnd-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* Body inner shadow */}
        <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#00000033" />
        </filter>
        {/* Animate */}
        {animate && (
          <style>{`
            @keyframes bob-${uid} { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
            @keyframes blink-${uid} { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.05)} }
            .char-${uid} { animation: bob-${uid} 3s ease-in-out infinite; transform-origin: 100px 280px; }
            .eye-l-${uid},.eye-r-${uid} { animation: blink-${uid} 5s ease-in-out infinite; }
            .eye-l-${uid} { transform-origin: 78px 95px; }
            .eye-r-${uid} { transform-origin: 122px 95px; }
          `}</style>
        )}
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy="274" rx="45" ry="8" fill={`url(#gnd-${uid})`} />

      <g className={animate ? `char-${uid}` : ""} filter={`url(#shadow-${uid})`}>

        {/* ── HAIR BACK ── */}
        {hairBack && <HairBack config={hairBack} uid={uid} />}

        {/* ── BODY ── */}
        <Body top={top} skin={skin} uid={uid} />

        {/* ── SHORTS ── */}
        <Shorts config={shorts} uid={uid} />

        {/* ── LEGS ── */}
        <Legs skin={skin} uid={uid} />

        {/* ── SHOES ── */}
        <Shoes config={shoes} uid={uid} />

        {/* ── GLOVES ── */}
        <Gloves config={gloves} uid={uid} />

        {/* ── NECK ── */}
        <rect x="88" y="125" width="24" height="14" rx="6" fill={`url(#skf-${uid})`} />
        <rect x="90" y="125" width="8" height="10" rx="3" fill="white" opacity="0.12" />

        {/* ── HEAD ── */}
        <Head skin={skin} uid={uid} />

        {/* ── FACE ── */}
        <Eyebrows config={eyebrows} />
        <Eyes config={eyes} animate={animate} uid={uid} />
        <Mouth config={mouth} skin={skin} />
        <NoseCheeks skin={skin} />

        {/* ── HAIR FRONT ── */}
        {hairFront && <HairFront config={hairFront} uid={uid} />}

        {/* ── ACCESSORY ── */}
        {accessory && <Accessory config={accessory} />}

        {/* ── EFFECT ── */}
        {effect && <Effect config={effect} />}

      </g>
    </svg>
  );
};

/* ── Colour helpers ── */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amt: number): string {
  return lighten(hex, -amt);
}

/* ── HEAD ── */
function Head({ skin, uid }: { skin: any; uid: string }) {
  return (
    <g>
      {/* Main head */}
      <ellipse cx="100" cy="78" rx="36" ry="40" fill={`url(#sk-${uid})`} />
      {/* Jaw definition */}
      <path d="M68 90 Q70 125 100 128 Q130 125 132 90" fill={skin.fill} opacity="0.5" />
      {/* Ears */}
      <ellipse cx="64" cy="82" rx="7" ry="9" fill={skin.fill} />
      <ellipse cx="64" cy="82" rx="4" ry="6" fill={skin.shadow} opacity="0.3" />
      <ellipse cx="136" cy="82" rx="7" ry="9" fill={skin.fill} />
      <ellipse cx="136" cy="82" rx="4" ry="6" fill={skin.shadow} opacity="0.3" />
      {/* Forehead shine */}
      <ellipse cx="92" cy="58" rx="14" ry="10" fill="white" opacity="0.12" />
      {/* Chin shadow */}
      <ellipse cx="100" cy="122" rx="18" ry="5" fill={skin.shadow} opacity="0.15" />
    </g>
  );
}

/* ── EYEBROWS ── */
function Eyebrows({ config }: { config: any }) {
  const y = 72;
  const w = config.style === "thick" ? 3.5 : config.style === "thin" ? 1.5 : 2.5;
  const angry = config.style === "angry";
  const arched = config.style === "arched";
  return (
    <g>
      <path
        d={angry ? `M70 ${y+3} Q78 ${y-4} 88 ${y+1}` : arched ? `M70 ${y} Q79 ${y-5} 88 ${y+1}` : `M70 ${y+1} Q79 ${y-2} 88 ${y+1}`}
        stroke={config.fill} strokeWidth={w} fill="none" strokeLinecap="round"
      />
      <path
        d={angry ? `M112 ${y+1} Q122 ${y-4} 130 ${y+3}` : arched ? `M112 ${y+1} Q121 ${y-5} 130 ${y}` : `M112 ${y+1} Q121 ${y-2} 130 ${y+1}`}
        stroke={config.fill} strokeWidth={w} fill="none" strokeLinecap="round"
      />
    </g>
  );
}

/* ── EYES ── */
function Eyes({ config, animate, uid }: { config: any; animate: boolean; uid: string }) {
  const big = config.style === "big" || config.style === "cute";
  const sharp = config.style === "sharp";
  const rx = big ? 10 : sharp ? 8 : 9;
  const ry = big ? 11 : sharp ? 7 : 10;

  const renderEye = (cx: number, side: "l" | "r") => (
    <g key={side} className={animate ? `eye-${side}-${uid}` : ""}>
      {/* White */}
      <ellipse cx={cx} cy="95" rx={rx} ry={ry} fill="white" />
      {/* Top shadow */}
      <path d={`M${cx-rx} 95 Q${cx} ${95-ry-2} ${cx+rx} 95`} fill={darken(config.iris, 10)} opacity="0.2" />
      {/* Iris */}
      <ellipse cx={cx} cy="96" rx={rx*0.65} ry={ry*0.7} fill={config.iris} />
      {/* Inner iris */}
      <ellipse cx={cx} cy="96" rx={rx*0.4} ry={ry*0.45} fill={darken(config.iris, 15)} />
      {/* Pupil */}
      <ellipse cx={cx} cy="96" rx={rx*0.22} ry={ry*0.26} fill={config.pupil} />
      {/* Main catchlight */}
      <ellipse cx={cx - rx*0.25} cy={95 - ry*0.25} rx={rx*0.2} ry={ry*0.23} fill="white" opacity="0.95" />
      {/* Small catchlight */}
      <ellipse cx={cx + rx*0.15} cy={95 + ry*0.15} rx={rx*0.09} ry={ry*0.1} fill="white" opacity="0.6" />
      {/* Lashes - top */}
      <path d={`M${cx-rx} 95 Q${cx} ${95-ry-3} ${cx+rx} 95`}
        stroke={config.pupil} strokeWidth="2" fill="none" opacity="0.85" />
      {/* Lashes tips */}
      {[-rx+1, -rx*0.5, 0, rx*0.5, rx-1].map((dx, i) => (
        <line key={i}
          x1={cx+dx} y1={95-Math.sqrt(ry*ry - dx*dx*0.7)*0.95}
          x2={cx+dx} y2={95-Math.sqrt(ry*ry - dx*dx*0.7)*0.95 - 2.5}
          stroke={config.pupil} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      ))}
      {/* Bottom lash line */}
      <path d={`M${cx-rx*0.8} ${95+ry*0.85} Q${cx} ${95+ry+1} ${cx+rx*0.8} ${95+ry*0.85}`}
        stroke={config.iris} strokeWidth="1.2" fill="none" opacity="0.4" />
    </g>
  );

  return <g>{renderEye(78, "l")}{renderEye(122, "r")}</g>;
}

/* ── NOSE & CHEEKS ── */
function NoseCheeks({ skin }: { skin: any }) {
  return (
    <g>
      {/* Nose */}
      <path d="M97 108 Q100 113 103 108" stroke={skin.shadow} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* Cheeks */}
      <ellipse cx="72" cy="108" rx="9" ry="5" fill="#FF8FAB" opacity="0.22" />
      <ellipse cx="128" cy="108" rx="9" ry="5" fill="#FF8FAB" opacity="0.22" />
    </g>
  );
}

/* ── MOUTH ── */
function Mouth({ config, skin }: { config: any; skin: any }) {
  const y = 116;
  switch (config.style) {
    case "grin":
      return (
        <g>
          <path d={`M88 ${y} Q100 ${y+10} 112 ${y}`} stroke={config.fill} strokeWidth="2.5" fill={config.fill} strokeLinecap="round" />
          <path d={`M90 ${y+1} Q100 ${y+7} 110 ${y+1}`} fill="white" opacity="0.5" />
        </g>
      );
    case "serious":
      return <line x1="90" y1={y} x2="110" y2={y} stroke={config.fill} strokeWidth="2.5" strokeLinecap="round" />;
    case "shout":
      return (
        <g>
          <ellipse cx="100" cy={y+3} rx="9" ry="8" fill={config.fill} />
          <ellipse cx="100" cy={y+1} rx="6" ry="4" fill="#2C0000" opacity="0.5" />
          <ellipse cx="100" cy={y} rx="4" ry="2" fill="white" opacity="0.2" />
        </g>
      );
    case "smirk":
      return <path d={`M90 ${y} Q100 ${y+6} 113 ${y-2}`} stroke={config.fill} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    case "pout":
      return (
        <g>
          <path d={`M90 ${y+4} Q100 ${y-1} 110 ${y+4}`} stroke={config.fill} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="100" cy={y+2} rx="5" ry="2" fill={config.fill} opacity="0.3" />
        </g>
      );
    default: // smile
      return (
        <g>
          <path d={`M90 ${y} Q100 ${y+9} 110 ${y}`} stroke={config.fill} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

/* ── HAIR BACK ── */
function HairBack({ config, uid }: { config: any; uid: string }) {
  switch (config.style) {
    case "long":
      return (
        <g>
          <path d="M64 60 Q55 100 60 160 Q70 175 80 170 L82 140 Q72 110 72 75 Z" fill={config.fill} />
          <path d="M136 60 Q145 100 140 160 Q130 175 120 170 L118 140 Q128 110 128 75 Z" fill={config.fill} />
          <path d="M64 62 Q57 95 62 145 Q68 155 76 152 L78 130 Q70 105 72 75 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "medium":
      return (
        <g>
          <path d="M64 60 Q55 90 62 120 L76 118 Q70 90 72 68 Z" fill={config.fill} />
          <path d="M136 60 Q145 90 138 120 L124 118 Q130 90 128 68 Z" fill={config.fill} />
          <path d="M66 62 Q58 88 64 112 L72 110 Q68 88 70 68 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "spiky":
      return (
        <g>
          <path d="M64 55 L56 25 L72 50 L68 20 L84 48 L80 15 L100 45 L120 15 L116 48 L132 20 L128 50 L144 25 L136 55 Q120 42 100 40 Q80 42 64 55 Z"
            fill={config.fill} />
          <path d="M80 15 L84 48 L88 35 L92 48 L96 28 L100 45 L104 28 L108 48 L112 35 L116 48 L120 15"
            fill={config.highlight} opacity="0.25" />
        </g>
      );
    default: // short
      return (
        <g>
          <path d="M64 55 Q64 30 100 25 Q136 30 136 55 Q136 70 132 75 L68 75 Q64 70 64 55 Z" fill={config.fill} />
          <path d="M72 48 Q100 30 128 48 Q130 58 128 65 L72 65 Q70 58 72 48 Z" fill={config.highlight} opacity="0.15" />
        </g>
      );
  }
}

/* ── HAIR FRONT ── */
function HairFront({ config, uid }: { config: any; uid: string }) {
  switch (config.style) {
    case "side":
      return (
        <g>
          <path d="M64 55 Q72 38 96 42 L96 62 Q78 58 68 68 Z" fill={config.fill} />
          <path d="M64 55 Q72 40 90 44 L90 58 Q76 56 68 64 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "swept":
      return (
        <g>
          <path d="M64 55 Q80 35 128 45 Q126 58 120 62 L88 65 Q76 60 64 62 Z" fill={config.fill} />
          <path d="M80 40 Q100 35 120 42 L118 56 Q98 48 80 52 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "curly":
      return (
        <g>
          <path d="M64 56 Q60 42 70 36 Q78 30 86 36 Q90 30 100 32 Q110 30 114 36 Q122 30 130 36 Q140 42 136 56 Q130 62 122 58 Q116 64 108 58 Q104 64 96 60 Q88 66 80 58 Q72 62 64 56 Z"
            fill={config.fill} />
          <path d="M78 36 Q86 30 94 34 Q100 30 106 34" stroke={config.highlight} strokeWidth="2.5" fill="none" opacity="0.25" />
        </g>
      );
    default: // bangs
      return (
        <g>
          <path d="M64 55 Q80 30 100 38 Q120 30 136 55 L136 68 Q120 55 100 62 Q80 55 64 68 Z" fill={config.fill} />
          <path d="M72 48 Q100 32 128 48 L128 60 Q100 48 72 60 Z" fill={config.highlight} opacity="0.18" />
        </g>
      );
  }
}

/* ── BODY ── */
function Body({ top, skin, uid }: { top: any; skin: any; uid: string }) {
  const isHoodie = top.style === "hoodie";
  const isRobe = top.style === "robe";
  return (
    <g>
      {/* Upper arms */}
      <path d="M72 142 Q58 148 54 168 Q54 178 62 182 L70 178 L74 160 Z" fill={skin.fill} />
      <path d="M128 142 Q142 148 146 168 Q146 178 138 182 L130 178 L126 160 Z" fill={skin.fill} />
      {/* Sleeve caps */}
      <path d="M72 142 Q66 148 66 156 L74 158 L76 144 Z" fill={top.fill} opacity="0.9" />
      <path d="M128 142 Q134 148 134 156 L126 158 L124 144 Z" fill={top.fill} opacity="0.9" />
      {/* Torso */}
      <path d="M74 138 L72 140 L72 200 Q72 204 76 206 L124 206 Q128 204 128 200 L128 140 L126 138 Z"
        fill={`url(#tp-${uid})`} />
      {/* Collar/neckline */}
      {isRobe ? (
        <>
          <path d="M100 138 L86 158 L72 155 L72 140 Z" fill={top.fill} opacity="0.3" />
          <path d="M100 138 L114 158 L128 155 L128 140 Z" fill={top.fill} opacity="0.3" />
          <line x1="100" y1="138" x2="100" y2="206" stroke={top.accent} strokeWidth="3" opacity="0.5" />
        </>
      ) : isHoodie ? (
        <>
          <path d="M88 138 Q100 134 112 138" stroke={top.accent} strokeWidth="2" fill="none" opacity="0.6" />
          <rect x="94" y="170" width="12" height="16" rx="3" fill={darken(top.fill, 15)} opacity="0.4" />
        </>
      ) : (
        <path d="M90 138 Q100 133 110 138" stroke={top.accent} strokeWidth="1.5" fill="none" opacity="0.4" />
      )}
      {/* Torso highlight */}
      <path d="M78 140 L84 138 L84 180 L78 182 Z" fill="white" opacity="0.08" />
      {/* Torso shadow right */}
      <path d="M122 140 L116 138 L116 180 L122 182 Z" fill="black" opacity="0.06" />
      {/* Chest muscles subtle */}
      <ellipse cx="88" cy="158" rx="8" ry="6" fill="white" opacity="0.05" />
      <ellipse cx="112" cy="158" rx="8" ry="6" fill="white" opacity="0.05" />
    </g>
  );
}

/* ── SHORTS ── */
function Shorts({ config, uid }: { config: any; uid: string }) {
  const hasStripe = config.style === "stripe";
  return (
    <g>
      <path d="M72 200 L72 230 Q76 236 86 236 L100 216 L114 236 Q124 236 128 230 L128 200 Z"
        fill={`url(#sh-${uid})`} />
      {/* Waistband */}
      <rect x="72" y="198" width="56" height="6" rx="3" fill={config.stripe ?? config.fill} opacity="0.6" />
      {/* Center seam */}
      <line x1="100" y1="204" x2="100" y2="236" stroke={darken(config.fill, 20)} strokeWidth="1.2" opacity="0.3" />
      {/* Stripes */}
      {hasStripe && (
        <>
          <line x1="75" y1="206" x2="75" y2="234" stroke={config.stripe} strokeWidth="3" opacity="0.7" />
          <line x1="125" y1="206" x2="125" y2="234" stroke={config.stripe} strokeWidth="3" opacity="0.7" />
        </>
      )}
      {/* Highlight */}
      <path d="M75 202 L82 200 L82 218 L75 220 Z" fill="white" opacity="0.07" />
    </g>
  );
}

/* ── LEGS ── */
function Legs({ skin, uid }: { skin: any; uid: string }) {
  return (
    <g>
      {/* Left leg */}
      <path d="M80 234 Q78 248 78 260 Q78 268 84 268 Q90 268 92 260 L94 234 Z" fill={skin.fill} />
      {/* Right leg */}
      <path d="M106 234 Q108 248 108 260 Q108 268 116 268 Q122 268 122 260 L120 234 Z" fill={skin.fill} />
      {/* Leg highlights */}
      <path d="M81 236 Q79 250 79 258" stroke="white" strokeWidth="2" fill="none" opacity="0.12" strokeLinecap="round" />
      <path d="M119 236 Q121 250 121 258" stroke="white" strokeWidth="2" fill="none" opacity="0.12" strokeLinecap="round" />
    </g>
  );
}

/* ── SHOES ── */
function Shoes({ config, uid }: { config: any; uid: string }) {
  const isSneaker = config.style === "sneaker";
  const renderShoe = (isLeft: boolean) => {
    const x = isLeft ? 74 : 104;
    return (
      <g key={isLeft ? "L" : "R"}>
        {/* Shoe upper */}
        <path d={isSneaker
          ? `M${x} 260 L${x} 270 Q${x+3} 276 ${x+14} 276 Q${x+20} 276 ${x+20} 270 L${x+20} 260 Z`
          : `M${x} 258 L${x} 270 Q${x+2} 278 ${x+12} 278 Q${x+20} 277 ${x+22} 270 L${x+20} 258 Z`
        } fill={`url(#sw-${uid})`} />
        {/* Sole */}
        <path d={isSneaker
          ? `M${x} 270 Q${x+3} 276 ${x+14} 276 Q${x+20} 276 ${x+20} 270`
          : `M${x} 270 Q${x+2} 278 ${x+12} 278 Q${x+20} 277 ${x+22} 270`
        } stroke={config.sole} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* Toe cap */}
        <ellipse cx={x+11} cy="263" rx="8" ry="4" fill="white" opacity="0.15" />
        {/* Laces */}
        <line x1={x+4} y1="263" x2={x+18} y2="263" stroke={config.lace} strokeWidth="1.2" opacity="0.8" />
        <line x1={x+4} y1="267" x2={x+18} y2="267" stroke={config.lace} strokeWidth="1.2" opacity="0.8" />
      </g>
    );
  };
  return <g>{renderShoe(true)}{renderShoe(false)}</g>;
}

/* ── GLOVES ── */
function Gloves({ config, uid }: { config: any; uid: string }) {
  const renderGlove = (isLeft: boolean) => {
    const cx = isLeft ? 48 : 152;
    const gradId = isLeft ? `glL-${uid}` : `glR-${uid}`;
    const flip = isLeft ? 1 : -1;
    return (
      <g key={isLeft ? "L" : "R"}>
        {/* Main glove body */}
        <path
          d={isLeft
            ? `M${cx+10} 168 Q${cx+20} 162 ${cx+22} 172 Q${cx+24} 188 ${cx+18} 198 Q${cx+10} 206 ${cx} 204 Q${cx-8} 200 ${cx-8} 190 Q${cx-6} 176 ${cx+10} 168 Z`
            : `M${cx-10} 168 Q${cx-20} 162 ${cx-22} 172 Q${cx-24} 188 ${cx-18} 198 Q${cx-10} 206 ${cx} 204 Q${cx+8} 200 ${cx+8} 190 Q${cx+6} 176 ${cx-10} 168 Z`
          }
          fill={`url(#${gradId})`}
        />
        {/* Thumb */}
        <ellipse
          cx={isLeft ? cx+20 : cx-20}
          cy="174" rx="6" ry="9"
          fill={lighten(config.fill, 10)}
          transform={`rotate(${isLeft ? -25 : 25} ${isLeft ? cx+20 : cx-20} 174)`}
        />
        {/* Wrist band */}
        <path
          d={isLeft
            ? `M${cx-6} 196 Q${cx+6} 210 ${cx+20} 206 L${cx+22} 198 Q${cx+10} 204 ${cx-4} 200 Z`
            : `M${cx+6} 196 Q${cx-6} 210 ${cx-20} 206 L${cx-22} 198 Q${cx-10} 204 ${cx+4} 200 Z`
          }
          fill={config.lace} opacity="0.6"
        />
        {/* Knuckle lines */}
        {[0, 1, 2].map(i => (
          <path key={i}
            d={isLeft
              ? `M${cx-2+i*4} 172 Q${cx-2+i*4} 178 ${cx-2+i*4} 184`
              : `M${cx+2-i*4} 172 Q${cx+2-i*4} 178 ${cx+2-i*4} 184`
            }
            stroke={darken(config.fill, 15)} strokeWidth="1" opacity="0.4" strokeLinecap="round"
          />
        ))}
        {/* Glove highlight */}
        <ellipse
          cx={isLeft ? cx+8 : cx-8}
          cy="178" rx="5" ry="7"
          fill="white" opacity="0.22"
        />
      </g>
    );
  };
  return <g>{renderGlove(true)}{renderGlove(false)}</g>;
}

/* ── ACCESSORY ── */
function Accessory({ config }: { config: any }) {
  switch (config.style) {
    case "headband":
      return (
        <g>
          <rect x="64" y="53" width="72" height="8" rx="4" fill={config.fill} opacity="0.95" />
          <rect x="66" y="54" width="26" height="4" rx="2" fill="white" opacity="0.25" />
        </g>
      );
    case "ribbon":
      return (
        <g>
          <path d="M132 52 L146 42 L140 52 L146 62 Z" fill={config.fill} />
          <path d="M132 52 L118 42 L124 52 L118 62 Z" fill={config.fill} opacity="0.8" />
          <circle cx="132" cy="52" r="5" fill={config.fill} />
          <circle cx="132" cy="52" r="2.5" fill="white" opacity="0.4" />
        </g>
      );
    case "scar":
      return (
        <g>
          <line x1="118" y1="90" x2="130" y2="80" stroke={config.fill} strokeWidth="2" opacity="0.7" strokeLinecap="round" />
          <line x1="122" y1="87" x2="126" y2="95" stroke={config.fill} strokeWidth="1" opacity="0.5" strokeLinecap="round" />
        </g>
      );
    case "star":
      return (
        <polygon
          points="126,48 128.5,54 135,54 130,58 132,64 126,60 120,64 122,58 117,54 124,54"
          fill={config.fill} opacity="0.9"
        />
      );
    case "bandage":
      return (
        <g>
          <rect x="116" y="90" width="18" height="9" rx="2.5" fill={config.fill} opacity="0.9" />
          <line x1="119" y1="90" x2="119" y2="99" stroke="#C8A882" strokeWidth="1" />
          <line x1="123" y1="90" x2="123" y2="99" stroke="#C8A882" strokeWidth="1" />
          <rect x="119" y="92" width="12" height="5" rx="1" fill="white" opacity="0.25" />
        </g>
      );
    default:
      return null;
  }
}

/* ── EFFECT ── */
function Effect({ config }: { config: any }) {
  switch (config.style) {
    case "sparkle":
      return (
        <g opacity="0.8">
          {[[28, 32, 6], [166, 42, 4], [32, 110, 3.5]].map(([x, y, r], i) => (
            <Star key={i} cx={x as number} cy={y as number} r={r as number} color={config.color} />
          ))}
        </g>
      );
    case "sweat":
      return (
        <g opacity="0.75">
          <path d="M148 62 Q151 70 148 74 Q145 70 148 62 Z" fill={config.color} />
          <path d="M152 76 Q154 82 152 85 Q150 82 152 76 Z" fill={config.color} opacity="0.6" />
        </g>
      );
    case "hearts":
      return (
        <g opacity="0.75">
          <Heart cx={28} cy={44} r={8} color={config.color} />
          <Heart cx={164} cy={32} r={5.5} color={config.color} />
        </g>
      );
    case "fire":
      return (
        <g opacity="0.65">
          <path d="M38 270 Q34 252 42 244 Q40 256 46 258 Q48 248 52 254 Q56 244 50 270 Z" fill={config.color} />
          <path d="M162 270 Q158 252 166 244 Q164 256 170 258 Q172 248 176 254 Q180 244 174 270 Z" fill={config.color} />
          <path d="M41 270 Q38 256 42 250 Q41 258 46 258 Q47 252 50 270 Z" fill="#FFD700" opacity="0.8" />
          <path d="M165 270 Q162 256 166 250 Q165 258 170 258 Q171 252 174 270 Z" fill="#FFD700" opacity="0.8" />
        </g>
      );
    default:
      return null;
  }
}

function Star({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.4;
    return `${cx + rad * Math.cos(a - Math.PI/2)},${cy + rad * Math.sin(a - Math.PI/2)}`;
  }).join(" ");
  return <polygon points={pts} fill={color} />;
}

function Heart({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <path
      d={`M${cx} ${cy+r*0.7} C${cx} ${cy+r*0.7} ${cx-r*1.2} ${cy+r*0.3} ${cx-r} ${cy-r*0.1} A${r*0.6} ${r*0.6} 0 0 1 ${cx} ${cy} A${r*0.6} ${r*0.6} 0 0 1 ${cx+r} ${cy-r*0.1} C${cx+r*1.2} ${cy+r*0.3} ${cx} ${cy+r*0.7} ${cx} ${cy+r*0.7} Z`}
      fill={color}
    />
  );
}

export default React.memo(LayeredCharacterRenderer);
