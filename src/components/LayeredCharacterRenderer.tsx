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
  size = 128,
  className = "",
  animate = true,
}) => {
  const skin    = cfg(parts, "skin")      ?? { fill: "#FFE0BD", shadow: "#E8C9A4" };
  const hairBack  = cfg(parts, "hair_back");
  const hairFront = cfg(parts, "hair_front");
  const eyebrows  = cfg(parts, "eyebrows") ?? { style: "normal", fill: "#333" };
  const eyes    = cfg(parts, "eyes")    ?? { style: "normal", iris: "#4A3728", pupil: "#1A1A1A" };
  const mouth   = cfg(parts, "mouth")   ?? { style: "smile",  fill: "#E74C3C" };
  const gloves  = cfg(parts, "gloves")  ?? { fill: "#E8553A", shadow: "#C4432E", lace: "#FFF" };
  const top     = cfg(parts, "top")     ?? { style: "tank",   fill: "#E8553A", accent: "#FFF", shadow: "#C4432E" };
  const shorts  = cfg(parts, "shorts")  ?? { style: "basic",  fill: "#1A1A2E", stripe: "#FFF", shadow: "#0D0D1A" };
  const shoes   = cfg(parts, "shoes")   ?? { style: "boots",  fill: "#1A1A2E", sole: "#333",   lace: "#FFF" };
  const accessory = cfg(parts, "accessory");
  const effect    = cfg(parts, "effect");

  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <svg
      viewBox="0 0 120 160"
      width={size}
      height={size * (160 / 120)}
      className={`select-none ${className}`}
      style={{ imageRendering: "auto", overflow: "visible" }}
    >
      <defs>
        {/* ── Skin ── */}
        <radialGradient id={`sk-${uid}`} cx="45%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={skin.fill} />
          <stop offset="100%" stopColor={skin.shadow} />
        </radialGradient>

        {/* ── Gloves ── */}
        <radialGradient id={`glL-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={gloves.fill} />
          <stop offset="100%" stopColor={gloves.shadow} />
        </radialGradient>
        <radialGradient id={`glR-${uid}`} cx="65%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={gloves.fill} />
          <stop offset="100%" stopColor={gloves.shadow} />
        </radialGradient>

        {/* ── Top ── */}
        <linearGradient id={`tp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={top.fill} />
          <stop offset="100%" stopColor={top.shadow ?? top.fill} />
        </linearGradient>

        {/* ── Shorts ── */}
        <linearGradient id={`sh-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={shorts.fill} />
          <stop offset="100%" stopColor={shorts.shadow ?? shorts.fill} />
        </linearGradient>

        {/* ── Shoes ── */}
        <linearGradient id={`sw-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={shoes.fill} />
          <stop offset="80%"  stopColor={shoes.sole} stopOpacity="0.7" />
        </linearGradient>

        {/* ── Shadow (ground) ── */}
        <radialGradient id={`gnd-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* ── Body inner shadow ── */}
        <linearGradient id={`bshadow-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.06" />
          <stop offset="40%"  stopColor="#000" stopOpacity="0" />
          <stop offset="60%"  stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>

        {/* ── Clip path for head ── */}
        <clipPath id={`headClip-${uid}`}>
          <ellipse cx="60" cy="36" rx="23" ry="25" />
        </clipPath>

        {/* ── Idle breathing animation ── */}
        {animate && (
          <style>{`
            @keyframes breathe-${uid} {
              0%, 100% { transform: scaleY(1) translateY(0); }
              50%       { transform: scaleY(0.985) translateY(0.4px); }
            }
            @keyframes blink-${uid} {
              0%, 90%, 100% { transform: scaleY(1); }
              95%           { transform: scaleY(0.08); }
            }
            .body-${uid} { animation: breathe-${uid} 3.2s ease-in-out infinite; transform-origin: 60px 90px; }
            .eye-${uid}  { animation: blink-${uid} 5s ease-in-out infinite; transform-origin: center; }
          `}</style>
        )}
      </defs>

      {/* ── Ground shadow ── */}
      <ellipse cx="60" cy="156" rx="28" ry="5" fill={`url(#gnd-${uid})`} />

      {/* ── Whole-body breathing group ── */}
      <g className={animate ? `body-${uid}` : ""}>

        {/* LAYER 1 — Hair Back */}
        {hairBack && <HairBackLayer config={hairBack} uid={uid} />}

        {/* LAYER 2 — Shoes (behind legs) */}
        <ShoesLayer config={shoes} uid={uid} />

        {/* LAYER 3 — Legs */}
        <LegsLayer skin={skin} uid={uid} />

        {/* LAYER 4 — Shorts */}
        <ShortsLayer config={shorts} uid={uid} />

        {/* LAYER 5 — Arms (behind torso) */}
        <ArmsBackLayer skin={skin} top={top} uid={uid} />

        {/* LAYER 6 — Torso */}
        <TorsoLayer top={top} uid={uid} />

        {/* LAYER 7 — Gloves */}
        <GlovesLayer config={gloves} uid={uid} />

        {/* LAYER 8 — Neck */}
        <NeckLayer skin={skin} uid={uid} />

        {/* LAYER 9 — Head */}
        <HeadLayer skin={skin} uid={uid} />

        {/* LAYER 10 — Eyebrows */}
        <EyebrowsLayer config={eyebrows} />

        {/* LAYER 11 — Eyes */}
        <EyesLayer config={eyes} animate={animate} uid={uid} />

        {/* LAYER 12 — Mouth */}
        <MouthLayer config={mouth} skin={skin} />

        {/* LAYER 13 — Hair Front */}
        {hairFront && <HairFrontLayer config={hairFront} uid={uid} />}

        {/* LAYER 14 — Accessory */}
        {accessory && <AccessoryLayer config={accessory} />}

        {/* LAYER 15 — Effect */}
        {effect && <EffectLayer config={effect} />}

      </g>
    </svg>
  );
};

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════ */

/** HEAD */
function HeadLayer({ skin, uid }: { skin: any; uid: string }) {
  return (
    <g>
      {/* Main head shape — slightly wider at cheeks */}
      <path
        d="M38 36 Q38 15, 60 13 Q82 15, 82 36 Q82 52, 72 58 Q66 62, 60 62 Q54 62, 48 58 Q38 52, 38 36 Z"
        fill={`url(#sk-${uid})`}
      />
      {/* Cheek highlight */}
      <ellipse cx="52" cy="46" rx="5" ry="3" fill="#FF9999" opacity="0.18" />
      <ellipse cx="68" cy="46" rx="5" ry="3" fill="#FF9999" opacity="0.18" />
      {/* Left ear */}
      <ellipse cx="38" cy="38" rx="4.5" ry="5.5" fill={skin.fill} />
      <ellipse cx="38" cy="38" rx="2.5" ry="3.5" fill={skin.shadow} opacity="0.35" />
      {/* Right ear */}
      <ellipse cx="82" cy="38" rx="4.5" ry="5.5" fill={skin.fill} />
      <ellipse cx="82" cy="38" rx="2.5" ry="3.5" fill={skin.shadow} opacity="0.35" />
      {/* Nose */}
      <path d="M58 44 Q60 47, 62 44" stroke={skin.shadow} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* Forehead shine */}
      <ellipse cx="56" cy="22" rx="9" ry="6" fill="white" opacity="0.09" />
    </g>
  );
}

/** NECK */
function NeckLayer({ skin, uid }: { skin: any; uid: string }) {
  return (
    <g>
      <rect x="55" y="60" width="10" height="8" rx="3" fill={skin.fill} />
      <rect x="56" y="60" width="3" height="8" rx="1.5" fill="white" opacity="0.07" />
    </g>
  );
}

/** EYEBROWS */
function EyebrowsLayer({ config }: { config: any }) {
  const y = 29;
  const strokeW = config.style === "thick" ? 2.8 : config.style === "thin" ? 1.2 : 2;
  const angL = config.style === "angry" ? -10 : config.style === "arched" ? -6 : 0;
  const angR = config.style === "angry" ? 10  : config.style === "arched" ? 6  : 0;
  const straight = config.style === "straight";
  return (
    <g>
      {/* Left brow */}
      {straight
        ? <line x1="51" y1={y} x2="59" y2={y} stroke={config.fill} strokeWidth={strokeW} strokeLinecap="round" />
        : <path d={`M51 ${y+1} Q55 ${y-2}, 59 ${y+1}`} stroke={config.fill} strokeWidth={strokeW} fill="none" strokeLinecap="round"
            transform={`rotate(${angL} 55 ${y})`} />
      }
      {/* Right brow */}
      {straight
        ? <line x1="61" y1={y} x2="69" y2={y} stroke={config.fill} strokeWidth={strokeW} strokeLinecap="round" />
        : <path d={`M61 ${y+1} Q65 ${y-2}, 69 ${y+1}`} stroke={config.fill} strokeWidth={strokeW} fill="none" strokeLinecap="round"
            transform={`rotate(${angR} 65 ${y})`} />
      }
    </g>
  );
}

/** EYES */
function EyesLayer({ config, animate, uid }: { config: any; animate: boolean; uid: string }) {
  const big  = config.style === "big" || config.style === "cute";
  const rx   = big ? 5 : 3.8;
  const ry   = big ? 5.5 : config.style === "sharp" ? 3.5 : 4.5;
  const eyeClass = animate ? `eye-${uid}` : "";

  const renderEye = (cx: number) => (
    <g key={cx} transform={`translate(${cx}, 37)`}>
      {/* Outer white */}
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="white" />
      {/* Eyelid shadow top */}
      <ellipse cx="0" cy={-ry * 0.3} rx={rx} ry={ry * 0.35} fill={config.iris} opacity="0.2" />
      {/* Iris */}
      <ellipse cx="0" cy="0.5" rx={rx * 0.62} ry={ry * 0.68} fill={config.iris} className={eyeClass} />
      {/* Pupil */}
      <ellipse cx="0" cy="0.5" rx={rx * 0.3} ry={ry * 0.35} fill={config.pupil} className={eyeClass} />
      {/* Catchlight big */}
      <ellipse cx={-rx * 0.3} cy={-ry * 0.2} rx={rx * 0.22} ry={ry * 0.25} fill="white" opacity="0.9" />
      {/* Catchlight small */}
      <ellipse cx={rx * 0.2} cy={ry * 0.15} rx={rx * 0.1} ry={ry * 0.12} fill="white" opacity="0.55" />
      {/* Bottom lash line */}
      <ellipse cx="0" cy={ry * 0.9} rx={rx * 0.8} ry={ry * 0.12} fill={config.iris} opacity="0.3" />
      {/* Top lash */}
      <path d={`M ${-rx} ${-ry * 0.85} Q 0 ${-ry * 1.15}, ${rx} ${-ry * 0.85}`}
        stroke={config.pupil} strokeWidth="1.2" fill="none" opacity="0.7" />
    </g>
  );

  return <g>{renderEye(53)}{renderEye(67)}</g>;
}

/** MOUTH */
function MouthLayer({ config, skin }: { config: any; skin: any }) {
  const y = 52;
  switch (config.style) {
    case "grin":
      return (
        <g>
          <path d={`M55 ${y} Q60 ${y+6}, 65 ${y}`} stroke={config.fill} strokeWidth="1.8" fill={config.fill} opacity="0.9" strokeLinecap="round" />
          <path d={`M57 ${y+1} Q60 ${y+4}, 63 ${y+1}`} fill="white" opacity="0.4" />
        </g>
      );
    case "serious":
      return <line x1="56" y1={y} x2="64" y2={y} stroke={config.fill} strokeWidth="1.8" strokeLinecap="round" />;
    case "shout":
      return (
        <g>
          <ellipse cx="60" cy={y+1} rx="4.5" ry="4" fill={config.fill} />
          <ellipse cx="60" cy={y-0.5} rx="3" ry="2" fill="#1A0000" opacity="0.35" />
          <ellipse cx="60" cy={y-1} rx="2" ry="1" fill="white" opacity="0.15" />
        </g>
      );
    case "smirk":
      return <path d={`M57 ${y} Q61 ${y+3}, 65 ${y-1}`} stroke={config.fill} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    case "pout":
      return <path d={`M56 ${y+2} Q60 ${y-1}, 64 ${y+2}`} stroke={config.fill} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    default: // smile
      return (
        <g>
          <path d={`M56 ${y} Q60 ${y+5}, 64 ${y}`} stroke={config.fill} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy={y+3} rx="3.5" ry="1.5" fill={skin.shadow} opacity="0.08" />
        </g>
      );
  }
}

/** TORSO */
function TorsoLayer({ top, uid }: { top: any; uid: string }) {
  const isHoodie = top.style === "hoodie";
  const isRobe   = top.style === "robe";
  return (
    <g>
      {/* Main torso */}
      <path d="M44 68 Q42 66, 44 64 L76 64 Q78 66, 76 68 L76 96 Q76 98, 74 98 L46 98 Q44 98, 44 96 Z"
        fill={`url(#tp-${uid})`} />
      {/* Shoulder ridge */}
      <path d="M44 64 Q60 60, 76 64" stroke={top.fill} strokeWidth="2" fill="none" opacity="0.3" />
      {/* Shirt side shadow */}
      <path d="M44 64 L44 96 Q46 98, 48 96 L48 66 Z" fill="black" opacity="0.05" />
      <path d="M76 64 L76 96 Q74 98, 72 96 L72 66 Z" fill="black" opacity="0.05" />
      {/* Center line */}
      {!isRobe && <line x1="60" y1="66" x2="60" y2="96" stroke={top.accent} strokeWidth="0.8" opacity="0.2" />}
      {/* Hoodie details */}
      {isHoodie && (
        <>
          <path d="M54 64 Q60 60, 66 64" stroke={top.accent} strokeWidth="1.5" fill="none" opacity="0.5" />
          <rect x="57" y="80" width="6" height="9" rx="1.5" fill={top.shadow ?? top.fill} opacity="0.35" />
        </>
      )}
      {/* Robe lapels */}
      {isRobe && (
        <>
          <path d="M60 64 L55 80 L44 78 L44 64 Z" fill={top.fill} opacity="0.25" />
          <path d="M60 64 L65 80 L76 78 L76 64 Z" fill={top.fill} opacity="0.25" />
          <line x1="60" y1="64" x2="60" y2="98" stroke={top.accent} strokeWidth="2.5" opacity="0.4" />
        </>
      )}
      {/* Highlight band */}
      <rect x="46" y="64" width="28" height="3" rx="1" fill="white" opacity="0.07" />
    </g>
  );
}

/** ARMS (behind torso) */
function ArmsBackLayer({ skin, top, uid }: { skin: any; top: any; uid: string }) {
  return (
    <g>
      {/* Left upper arm */}
      <path d="M40 66 Q36 68, 36 78 Q36 86, 40 88 L44 84 L44 66 Z" fill={skin.fill} />
      <rect x="40" y="64" width="4" height="8" rx="2" fill={top.fill} opacity="0.9" />
      {/* Right upper arm */}
      <path d="M80 66 Q84 68, 84 78 Q84 86, 80 88 L76 84 L76 66 Z" fill={skin.fill} />
      <rect x="76" y="64" width="4" height="8" rx="2" fill={top.fill} opacity="0.9" />
      {/* Arm highlight */}
      <path d="M38 68 Q36 72, 37 78" stroke="white" strokeWidth="1.5" fill="none" opacity="0.1" strokeLinecap="round" />
      <path d="M82 68 Q84 72, 83 78" stroke="white" strokeWidth="1.5" fill="none" opacity="0.1" strokeLinecap="round" />
    </g>
  );
}

/** GLOVES */
function GlovesLayer({ config, uid }: { config: any; uid: string }) {
  const renderGlove = (cx: number, gradId: string, flip: boolean) => (
    <g key={cx}>
      {/* Main glove body — boxing glove shape */}
      <path
        d={flip
          ? `M${cx-4} 84 Q${cx-10} 80, ${cx-10} 88 Q${cx-10} 100, ${cx-4} 102 Q${cx+2} 104, ${cx+6} 100 Q${cx+8} 94, ${cx+6} 88 L${cx+4} 84 Z`
          : `M${cx+4} 84 Q${cx+10} 80, ${cx+10} 88 Q${cx+10} 100, ${cx+4} 102 Q${cx-2} 104, ${cx-6} 100 Q${cx-8} 94, ${cx-6} 88 L${cx-4} 84 Z`
        }
        fill={`url(#${gradId})`}
      />
      {/* Thumb knuckle */}
      <ellipse cx={flip ? cx-7 : cx+7} cy="86" rx="3" ry="2.5" fill={config.fill} opacity="0.9" />
      {/* Wrist cuff band */}
      <rect x={cx - 6} y="98" width="12" height="4" rx="2" fill={config.lace} opacity="0.55" />
      <rect x={cx - 4} y="99" width="8" height="2" rx="1" fill={config.lace} opacity="0.3" />
      {/* Highlight */}
      <ellipse cx={flip ? cx-5 : cx+5} cy="88" rx="2.5" ry="3.5" fill="white" opacity="0.2" />
    </g>
  );
  return (
    <g>
      {renderGlove(36, `glL-${uid}`, true)}
      {renderGlove(84, `glR-${uid}`, false)}
    </g>
  );
}

/** SHORTS */
function ShortsLayer({ config, uid }: { config: any; uid: string }) {
  const hasStripe = config.style === "stripe";
  return (
    <g>
      {/* Waistband */}
      <rect x="44" y="96" width="32" height="4" rx="2" fill={config.stripe ?? config.fill} opacity="0.5" />
      {/* Main shorts body */}
      <path d="M44 100 L44 118 Q48 120, 56 120 L60 104 L64 120 Q72 120, 76 118 L76 100 Z"
        fill={`url(#sh-${uid})`} />
      {/* Center crease */}
      <line x1="60" y1="100" x2="60" y2="120" stroke={config.shadow ?? config.fill} strokeWidth="1" opacity="0.2" />
      {/* Side stripes */}
      {hasStripe && (
        <>
          <line x1="46" y1="102" x2="46" y2="118" stroke={config.stripe} strokeWidth="2.5" opacity="0.65" />
          <line x1="74" y1="102" x2="74" y2="118" stroke={config.stripe} strokeWidth="2.5" opacity="0.65" />
        </>
      )}
      {/* Highlight */}
      <path d="M46 102 L52 100 L52 110 L46 112 Z" fill="white" opacity="0.05" />
    </g>
  );
}

/** LEGS */
function LegsLayer({ skin, uid }: { skin: any; uid: string }) {
  return (
    <g>
      {/* Left leg */}
      <path d="M48 118 Q46 128, 46 140 Q46 144, 50 144 Q54 144, 54 140 L56 118 Z" fill={skin.fill} />
      {/* Right leg */}
      <path d="M64 118 Q66 128, 66 140 Q66 144, 70 144 Q74 144, 74 140 L72 118 Z" fill={skin.fill} />
      {/* Leg highlight */}
      <path d="M49 120 Q47 130, 47 138" stroke="white" strokeWidth="1.5" fill="none" opacity="0.1" strokeLinecap="round" />
      <path d="M71 120 Q73 130, 73 138" stroke="white" strokeWidth="1.5" fill="none" opacity="0.1" strokeLinecap="round" />
    </g>
  );
}

/** SHOES */
function ShoesLayer({ config, uid }: { config: any; uid: string }) {
  const isSneaker = config.style === "sneaker";

  const renderShoe = (isLeft: boolean) => {
    const x = isLeft ? 42 : 62;
    const dir = isLeft ? -1 : 1;
    return (
      <g key={isLeft ? "L" : "R"}>
        {/* Shoe body */}
        <path
          d={isSneaker
            ? `M${x} 140 L${x} 148 Q${x+2} 152, ${x+10} 152 Q${x+14} 152, ${x+14} 148 L${x+14} 140 Z`
            : `M${x} 140 L${x} 150 Q${x+2} 154, ${x+10} 154 Q${x+14} 153, ${x+14} 149 L${x+14} 140 Z`
          }
          fill={config.fill}
        />
        {/* Sole */}
        <path
          d={isSneaker
            ? `M${x} 148 Q${x+2} 152, ${x+10} 152 Q${x+14} 152, ${x+14} 148`
            : `M${x} 150 Q${x+2} 154, ${x+10} 154 Q${x+14} 153, ${x+14} 149`
          }
          stroke={config.sole} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Toe cap highlight */}
        <ellipse cx={x+7} cy="142" rx="5" ry="2.5" fill="white" opacity="0.12" />
        {/* Laces */}
        <line x1={x+3} y1="142" x2={x+11} y2="142" stroke={config.lace} strokeWidth="0.9" opacity="0.7" />
        <line x1={x+3} y1="145" x2={x+11} y2="145" stroke={config.lace} strokeWidth="0.9" opacity="0.7" />
        {/* Ankle highlight */}
        <rect x={x+1} y="140" width={5} height="3" rx="1" fill="white" opacity="0.07" />
      </g>
    );
  };

  return <g>{renderShoe(true)}{renderShoe(false)}</g>;
}

/** HAIR BACK */
function HairBackLayer({ config, uid }: { config: any; uid: string }) {
  switch (config.style) {
    case "long":
      return (
        <g>
          <path d="M37 30 Q34 55, 38 80 Q42 90, 50 90 L52 78 Q46 68, 46 50 Q46 32, 50 22 Z"
            fill={config.fill} />
          <path d="M83 30 Q86 55, 82 80 Q78 90, 70 90 L68 78 Q74 68, 74 50 Q74 32, 70 22 Z"
            fill={config.fill} />
          <path d="M37 30 Q34 50, 38 68 Q42 78, 50 80 L52 72 Q46 64, 46 48 Q46 34, 50 22 Z"
            fill={config.highlight} opacity="0.13" />
        </g>
      );
    case "medium":
      return (
        <g>
          <path d="M38 28 Q34 40, 38 60 L48 58 Q44 40, 50 22 Z" fill={config.fill} />
          <path d="M82 28 Q86 40, 82 60 L72 58 Q76 40, 70 22 Z" fill={config.fill} />
          <path d="M38 30 Q36 40, 38 52 L44 50 Q42 40, 46 26 Z" fill={config.highlight} opacity="0.14" />
        </g>
      );
    case "spiky":
      return (
        <g>
          <path d="M44 18 L38 4 L50 16 L46 2 L58 14 L56 0 L60 12 L64 0 L62 14 L74 2 L70 16 L82 4 L76 18 Q60 8, 44 18 Z"
            fill={config.fill} />
          <path d="M50 16 L46 2 L58 14 L56 2 L60 12" fill={config.highlight} opacity="0.18" />
        </g>
      );
    default: // short
      return (
        <g>
          <path d="M40 18 Q60 8, 80 18 Q84 30, 82 38 L38 38 Q36 30, 40 18 Z" fill={config.fill} />
          <path d="M46 16 Q60 10, 74 16 Q78 26, 76 32 L44 32 Q42 26, 46 16 Z"
            fill={config.highlight} opacity="0.11" />
        </g>
      );
  }
}

/** HAIR FRONT */
function HairFrontLayer({ config, uid }: { config: any; uid: string }) {
  switch (config.style) {
    case "side":
      return (
        <g>
          <path d="M40 18 Q50 12, 66 16 L66 30 Q50 28, 42 34 Q38 28, 40 18 Z"
            fill={config.fill} />
          <path d="M40 18 Q50 14, 60 16 L60 26 Q50 24, 42 30 Q38 26, 40 18 Z"
            fill={config.highlight} opacity="0.14" />
        </g>
      );
    case "swept":
      return (
        <g>
          <path d="M40 18 Q58 8, 80 16 Q78 26, 72 28 L54 30 Q46 26, 40 22 Z"
            fill={config.fill} />
          <path d="M54 12 Q68 10, 76 16 L72 24 Q60 18, 54 20 Z"
            fill={config.highlight} opacity="0.14" />
        </g>
      );
    case "curly":
      return (
        <g>
          <path d="M40 20 Q36 14, 44 12 Q50 8, 56 12 Q60 8, 64 12 Q70 8, 76 12 Q82 8, 84 14 Q88 20, 82 22
                   Q78 26, 72 22 Q68 26, 64 22 Q60 26, 56 22 Q52 26, 46 22 Q42 24, 40 20 Z"
            fill={config.fill} />
          <path d="M48 12 Q54 8, 60 12 Q64 8, 70 12" fill="none" stroke={config.highlight} strokeWidth="2" opacity="0.18" />
        </g>
      );
    default: // bangs
      return (
        <g>
          <path d="M40 18 Q52 10, 60 14 Q68 10, 80 18 L80 28 Q68 22, 60 26 Q52 22, 40 28 Z"
            fill={config.fill} />
          <path d="M48 14 Q60 10, 72 14 L72 22 Q60 18, 48 22 Z"
            fill={config.highlight} opacity="0.13" />
        </g>
      );
  }
}

/** ACCESSORY */
function AccessoryLayer({ config }: { config: any }) {
  switch (config.style) {
    case "headband":
      return (
        <g>
          <rect x="40" y="20" width="40" height="5" rx="2.5" fill={config.fill} opacity="0.92" />
          <rect x="42" y="21" width="16" height="2" rx="1" fill="white" opacity="0.2" />
        </g>
      );
    case "ribbon":
      return (
        <g>
          <path d="M78 16 L86 10 L82 16 L86 22 Z" fill={config.fill} />
          <path d="M78 16 L70 10 L74 16 L70 22 Z" fill={config.fill} opacity="0.8" />
          <circle cx="78" cy="16" r="3" fill={config.fill} />
          <circle cx="78" cy="16" r="1.5" fill="white" opacity="0.3" />
        </g>
      );
    case "scar":
      return (
        <g>
          <line x1="70" y1="40" x2="78" y2="34" stroke={config.fill} strokeWidth="1.2" opacity="0.65" strokeLinecap="round" />
          <line x1="73" y1="38" x2="75" y2="43" stroke={config.fill} strokeWidth="0.7" opacity="0.45" strokeLinecap="round" />
        </g>
      );
    case "star":
      return (
        <polygon
          points="74,17 75.5,21 79.5,21 76.5,23.5 77.5,27.5 74,25 70.5,27.5 71.5,23.5 68.5,21 72.5,21"
          fill={config.fill} opacity="0.85"
        />
      );
    case "bandage":
      return (
        <g>
          <rect x="68" y="40" width="10" height="5" rx="1.5" fill={config.fill} opacity="0.85" />
          <line x1="70" y1="40" x2="70" y2="45" stroke="#D4B896" strokeWidth="0.6" />
          <line x1="74" y1="40" x2="74" y2="45" stroke="#D4B896" strokeWidth="0.6" />
          <rect x="70" y="41" width="8" height="3" rx="0.5" fill="white" opacity="0.2" />
        </g>
      );
    default:
      return null;
  }
}

/** EFFECT */
function EffectLayer({ config }: { config: any }) {
  switch (config.style) {
    case "sparkle":
      return (
        <g opacity="0.75">
          <StarShape cx={18} cy={18} r={5} color={config.color} pulse />
          <StarShape cx={100} cy={28} r={3.5} color={config.color} pulse delay="0.5s" />
          <StarShape cx={22} cy={72} r={3} color={config.color} pulse delay="1s" />
        </g>
      );
    case "sweat":
      return (
        <g opacity="0.7">
          <path d="M86 26 Q88 32, 86 35 Q84 32, 86 26 Z" fill={config.color} />
          <path d="M90 34 Q91.5 38, 90 40 Q88.5 38, 90 34 Z" fill={config.color} opacity="0.6" />
        </g>
      );
    case "hearts":
      return (
        <g opacity="0.7">
          <HeartShape cx={16} cy={26} r={5} color={config.color} pulse />
          <HeartShape cx={98} cy={20} r={3.5} color={config.color} pulse delay="0.7s" />
        </g>
      );
    case "fire":
      return (
        <g opacity="0.6">
          <path d="M24 150 Q22 138, 28 132 Q26 142, 30 144 Q32 136, 34 142 Q36 132, 32 150 Z" fill={config.color} />
          <path d="M86 150 Q84 138, 90 132 Q88 142, 92 144 Q94 136, 96 142 Q98 132, 94 150 Z" fill={config.color} />
          {/* Inner flame */}
          <path d="M26 150 Q25 142, 28 138 Q27 144, 30 144 Q31 140, 32 150 Z" fill="#FFD700" opacity="0.7" />
          <path d="M88 150 Q87 142, 90 138 Q89 144, 92 144 Q93 140, 94 150 Z" fill="#FFD700" opacity="0.7" />
        </g>
      );
    default:
      return null;
  }
}

/** Helper: Star shape */
function StarShape({ cx, cy, r, color, pulse, delay = "0s" }: {
  cx: number; cy: number; r: number; color: string; pulse?: boolean; delay?: string;
}) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const radius = i % 2 === 0 ? r : r * 0.4;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
  return (
    <polygon
      points={pts}
      fill={color}
      style={pulse ? { animation: `pulse 2s ease-in-out ${delay} infinite` } : {}}
    />
  );
}

/** Helper: Heart shape */
function HeartShape({ cx, cy, r, color, pulse, delay = "0s" }: {
  cx: number; cy: number; r: number; color: string; pulse?: boolean; delay?: string;
}) {
  const s = r / 5;
  return (
    <path
      d={`M${cx} ${cy + r * 0.6}
          C${cx} ${cy + r * 0.6}, ${cx - r * 1.1} ${cy + r * 0.2}, ${cx - r} ${cy - r * 0.2}
          A${r * 0.6} ${r * 0.6} 0 0 1 ${cx} ${cy - r * 0.1}
          A${r * 0.6} ${r * 0.6} 0 0 1 ${cx + r} ${cy - r * 0.2}
          C${cx + r * 1.1} ${cy + r * 0.2}, ${cx} ${cy + r * 0.6}, ${cx} ${cy + r * 0.6} Z`}
      fill={color}
      style={pulse ? { animation: `pulse 1.8s ease-in-out ${delay} infinite` } : {}}
    />
  );
}

export default React.memo(LayeredCharacterRenderer);
