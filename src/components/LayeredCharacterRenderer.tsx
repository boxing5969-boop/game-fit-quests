import React, { useMemo } from "react";
import { getPartByKey, type PartsSelection } from "@/data/characterPartsData";

interface LayeredCharacterRendererProps {
  parts: PartsSelection;
  size?: number; // px
  className?: string;
}

/** Get config for a part key, with fallback */
function cfg(parts: PartsSelection, cat: string): Record<string, any> | null {
  const key = parts[cat];
  if (!key) return null;
  return getPartByKey(key)?.config ?? null;
}

const LayeredCharacterRenderer: React.FC<LayeredCharacterRendererProps> = ({
  parts,
  size = 128,
  className = "",
}) => {
  const skin = cfg(parts, "skin") ?? { fill: "#FFE0BD", shadow: "#E8C9A4" };
  const hairBack = cfg(parts, "hair_back");
  const hairFront = cfg(parts, "hair_front");
  const eyebrows = cfg(parts, "eyebrows") ?? { style: "normal", fill: "#333" };
  const eyes = cfg(parts, "eyes") ?? { style: "normal", iris: "#4A3728", pupil: "#1A1A1A" };
  const mouth = cfg(parts, "mouth") ?? { style: "smile", fill: "#E74C3C" };
  const gloves = cfg(parts, "gloves") ?? { fill: "#E8553A", shadow: "#C4432E", lace: "#FFF" };
  const top = cfg(parts, "top") ?? { style: "tank", fill: "#E8553A", accent: "#FFF", shadow: "#C4432E" };
  const shorts = cfg(parts, "shorts") ?? { style: "basic", fill: "#E8553A", stripe: "#FFF", shadow: "#C4432E" };
  const shoes = cfg(parts, "shoes") ?? { style: "boots", fill: "#E8553A", sole: "#333", lace: "#FFF" };
  const accessory = cfg(parts, "accessory");
  const effect = cfg(parts, "effect");

  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={`select-none ${className}`}
      style={{ imageRendering: "auto" }}
    >
      {/* === HAIR BACK === */}
      {hairBack && <HairBackLayer config={hairBack} />}

      {/* === BODY / TORSO === */}
      <BodyLayer skin={skin} top={top} />

      {/* === SHORTS === */}
      <ShortsLayer config={shorts} />

      {/* === SHOES === */}
      <ShoesLayer config={shoes} />

      {/* === GLOVES === */}
      <GlovesLayer config={gloves} />

      {/* === HEAD === */}
      <HeadLayer skin={skin} />

      {/* === EYEBROWS === */}
      <EyebrowsLayer config={eyebrows} />

      {/* === EYES === */}
      <EyesLayer config={eyes} />

      {/* === MOUTH === */}
      <MouthLayer config={mouth} />

      {/* === HAIR FRONT === */}
      {hairFront && <HairFrontLayer config={hairFront} />}

      {/* === ACCESSORY === */}
      {accessory && <AccessoryLayer config={accessory} />}

      {/* === EFFECT === */}
      {effect && <EffectLayer config={effect} />}
    </svg>
  );
};

// ========== SUB-COMPONENTS ==========

function HeadLayer({ skin }: { skin: Record<string, any> }) {
  return (
    <g>
      {/* Head */}
      <ellipse cx="64" cy="38" rx="22" ry="24" fill={skin.fill} />
      {/* Ear left */}
      <ellipse cx="42" cy="40" rx="4" ry="5" fill={skin.fill} />
      <ellipse cx="42" cy="40" rx="2.5" ry="3" fill={skin.shadow} />
      {/* Ear right */}
      <ellipse cx="86" cy="40" rx="4" ry="5" fill={skin.fill} />
      <ellipse cx="86" cy="40" rx="2.5" ry="3" fill={skin.shadow} />
      {/* Nose */}
      <ellipse cx="64" cy="44" rx="2" ry="1.5" fill={skin.shadow} opacity="0.5" />
      {/* Blush */}
      <ellipse cx="52" cy="46" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.3" />
      <ellipse cx="76" cy="46" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.3" />
    </g>
  );
}

function EyebrowsLayer({ config }: { config: Record<string, any> }) {
  const y = 31;
  const w = config.style === "thick" ? 2.5 : config.style === "thin" ? 1 : 1.8;
  const angle = config.style === "angry" ? -8 : config.style === "arched" ? -5 : 0;
  return (
    <g>
      <line x1="53" y1={y} x2="59" y2={y} stroke={config.fill} strokeWidth={w} strokeLinecap="round"
        transform={`rotate(${angle} 56 ${y})`} />
      <line x1="69" y1={y} x2="75" y2={y} stroke={config.fill} strokeWidth={w} strokeLinecap="round"
        transform={`rotate(${-angle} 72 ${y})`} />
    </g>
  );
}

function EyesLayer({ config }: { config: Record<string, any> }) {
  const big = config.style === "big" || config.style === "cute";
  const rx = big ? 4.5 : 3.5;
  const ry = big ? 5 : config.style === "sharp" ? 3.5 : 4;
  return (
    <g>
      {/* Left eye */}
      <ellipse cx="56" cy="38" rx={rx} ry={ry} fill="white" />
      <ellipse cx="56" cy="38" rx={rx * 0.6} ry={ry * 0.65} fill={config.iris} />
      <ellipse cx="56" cy="38" rx={rx * 0.3} ry={ry * 0.35} fill={config.pupil} />
      <ellipse cx="54.5" cy="36" rx="1.2" ry="1.5" fill="white" opacity="0.8" />
      {/* Right eye */}
      <ellipse cx="72" cy="38" rx={rx} ry={ry} fill="white" />
      <ellipse cx="72" cy="38" rx={rx * 0.6} ry={ry * 0.65} fill={config.iris} />
      <ellipse cx="72" cy="38" rx={rx * 0.3} ry={ry * 0.35} fill={config.pupil} />
      <ellipse cx="70.5" cy="36" rx="1.2" ry="1.5" fill="white" opacity="0.8" />
    </g>
  );
}

function MouthLayer({ config }: { config: Record<string, any> }) {
  switch (config.style) {
    case "grin":
      return <path d="M58 48 Q64 54, 70 48" stroke={config.fill} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    case "serious":
      return <line x1="59" y1="49" x2="69" y2="49" stroke={config.fill} strokeWidth="1.5" strokeLinecap="round" />;
    case "shout":
      return <ellipse cx="64" cy="49" rx="4" ry="3.5" fill={config.fill} />;
    case "smirk":
      return <path d="M60 48 Q65 51, 70 47" stroke={config.fill} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    case "pout":
      return <path d="M59 50 Q64 47, 69 50" stroke={config.fill} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    default: // smile
      return <path d="M59 48 Q64 52, 69 48" stroke={config.fill} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  }
}

function BodyLayer({ skin, top }: { skin: Record<string, any>; top: Record<string, any> }) {
  const isHoodie = top.style === "hoodie";
  const isRobe = top.style === "robe";
  return (
    <g>
      {/* Neck */}
      <rect x="59" y="58" width="10" height="6" rx="2" fill={skin.fill} />
      {/* Torso */}
      <path d="M46 64 L48 62 L80 62 L82 64 L82 88 L46 88 Z" fill={top.fill} />
      {/* Shadow */}
      <path d="M46 84 L82 84 L82 88 L46 88 Z" fill={top.shadow} opacity="0.5" />
      {/* Accent stripe or detail */}
      {!isRobe && <line x1="64" y1="64" x2="64" y2="86" stroke={top.accent} strokeWidth="1" opacity="0.3" />}
      {isHoodie && (
        <>
          <path d="M56 62 Q64 58, 72 62" stroke={top.accent} strokeWidth="1" fill="none" opacity="0.5" />
          <rect x="61" y="74" width="6" height="8" rx="1" fill={top.shadow} opacity="0.3" />
        </>
      )}
      {isRobe && (
        <>
          <line x1="64" y1="62" x2="64" y2="88" stroke={top.accent} strokeWidth="2" opacity="0.4" />
          <path d="M48 62 L44 70 L48 68 Z" fill={top.fill} />
          <path d="M80 62 L84 70 L80 68 Z" fill={top.fill} />
        </>
      )}
      {/* Arms */}
      <rect x="38" y="64" width="8" height="20" rx="4" fill={skin.fill} />
      <rect x="82" y="64" width="8" height="20" rx="4" fill={skin.fill} />
      {/* Sleeve cuffs */}
      <rect x="38" y="64" width="8" height="4" rx="2" fill={top.fill} />
      <rect x="82" y="64" width="8" height="4" rx="2" fill={top.fill} />
    </g>
  );
}

function ShortsLayer({ config }: { config: Record<string, any> }) {
  const hasStripe = config.style === "stripe";
  return (
    <g>
      {/* Shorts */}
      <path d="M46 88 L46 100 L62 100 L64 88 L66 100 L82 100 L82 88 Z" fill={config.fill} />
      {/* Shadow/crease */}
      <path d="M64 88 L62 100" stroke={config.shadow} strokeWidth="1" opacity="0.4" />
      <path d="M64 88 L66 100" stroke={config.shadow} strokeWidth="1" opacity="0.4" />
      {/* Stripe */}
      {hasStripe && (
        <>
          <line x1="48" y1="90" x2="48" y2="100" stroke={config.stripe} strokeWidth="2" opacity="0.6" />
          <line x1="80" y1="90" x2="80" y2="100" stroke={config.stripe} strokeWidth="2" opacity="0.6" />
        </>
      )}
      {/* Waistband */}
      <rect x="46" y="87" width="36" height="3" rx="1" fill={config.stripe} opacity="0.3" />
    </g>
  );
}

function ShoesLayer({ config }: { config: Record<string, any> }) {
  const isSneaker = config.style === "sneaker";
  return (
    <g>
      {/* Left shoe */}
      <path d={isSneaker
        ? "M46 110 L46 100 L62 100 L62 110 L58 114 L42 114 L40 112 Z"
        : "M46 108 L46 100 L62 100 L62 108 L58 112 L44 112 L42 110 Z"
      } fill={config.fill} />
      <path d={isSneaker
        ? "M42 114 L40 112 L46 112 L58 114 Z"
        : "M44 112 L42 110 L46 110 L58 112 Z"
      } fill={config.sole} />
      {/* Right shoe */}
      <path d={isSneaker
        ? "M66 110 L66 100 L82 100 L82 110 L86 114 L70 114 L68 112 Z"
        : "M66 108 L66 100 L82 100 L82 108 L84 112 L70 112 L68 110 Z"
      } fill={config.fill} />
      <path d={isSneaker
        ? "M70 114 L68 112 L82 112 L86 114 Z"
        : "M70 112 L68 110 L82 110 L84 112 Z"
      } fill={config.sole} />
      {/* Laces */}
      <line x1="52" y1="102" x2="56" y2="102" stroke={config.lace} strokeWidth="0.8" />
      <line x1="52" y1="105" x2="56" y2="105" stroke={config.lace} strokeWidth="0.8" />
      <line x1="72" y1="102" x2="76" y2="102" stroke={config.lace} strokeWidth="0.8" />
      <line x1="72" y1="105" x2="76" y2="105" stroke={config.lace} strokeWidth="0.8" />
    </g>
  );
}

function GlovesLayer({ config }: { config: Record<string, any> }) {
  return (
    <g>
      {/* Left glove */}
      <ellipse cx="40" cy="88" rx="7" ry="8" fill={config.fill} />
      <ellipse cx="40" cy="88" rx="5" ry="6" fill={config.shadow} opacity="0.3" />
      <line x1="36" y1="82" x2="44" y2="82" stroke={config.lace} strokeWidth="1" />
      {/* Right glove */}
      <ellipse cx="88" cy="88" rx="7" ry="8" fill={config.fill} />
      <ellipse cx="88" cy="88" rx="5" ry="6" fill={config.shadow} opacity="0.3" />
      <line x1="84" y1="82" x2="92" y2="82" stroke={config.lace} strokeWidth="1" />
      {/* Glove highlight */}
      <ellipse cx="38" cy="86" rx="2" ry="2.5" fill="white" opacity="0.15" />
      <ellipse cx="86" cy="86" rx="2" ry="2.5" fill="white" opacity="0.15" />
    </g>
  );
}

function HairBackLayer({ config }: { config: Record<string, any> }) {
  switch (config.style) {
    case "long":
      return (
        <g>
          <path d="M40 24 Q38 50, 42 72 L50 72 Q46 50, 48 28 Z" fill={config.fill} />
          <path d="M88 24 Q90 50, 86 72 L78 72 Q82 50, 80 28 Z" fill={config.fill} />
          <path d="M40 24 Q38 50, 42 72 L50 72 Q46 50, 48 28 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "medium":
      return (
        <g>
          <path d="M42 20 Q38 35, 42 55 L50 55 Q48 35, 50 24 Z" fill={config.fill} />
          <path d="M86 20 Q90 35, 86 55 L78 55 Q80 35, 78 24 Z" fill={config.fill} />
        </g>
      );
    case "spiky":
      return (
        <g>
          <path d="M44 20 L40 8 L50 18 L48 6 L58 16 L56 4 L64 14 L72 4 L70 16 L80 6 L78 18 L88 8 L84 20 Z" fill={config.fill} />
          <path d="M48 6 L58 16 L56 4 L64 14" fill={config.highlight} opacity="0.25" />
        </g>
      );
    default: // short
      return (
        <path d="M42 18 Q64 10, 86 18 Q88 30, 86 35 L42 35 Q40 30, 42 18 Z" fill={config.fill} />
      );
  }
}

function HairFrontLayer({ config }: { config: Record<string, any> }) {
  switch (config.style) {
    case "side":
      return (
        <g>
          <path d="M42 18 Q50 14, 64 16 L64 28 Q50 26, 44 30 Z" fill={config.fill} />
          <path d="M42 18 Q50 14, 56 16 L56 24 Q50 22, 44 28 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "swept":
      return (
        <g>
          <path d="M42 18 Q56 10, 78 16 Q76 24, 70 26 L56 28 Q48 24, 42 22 Z" fill={config.fill} />
          <path d="M56 14 Q66 12, 74 16 L70 22 Q62 18, 56 20 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
    case "curly":
      return (
        <g>
          <path d="M42 20 Q38 16, 44 14 Q48 10, 54 14 Q58 10, 64 14 Q68 10, 74 14 Q80 10, 84 14 Q90 16, 86 20 Q82 24, 78 22 Q74 26, 70 22 Q66 26, 60 24 Q54 28, 48 24 Q44 26, 42 20 Z" fill={config.fill} />
          <path d="M48 14 Q54 10, 58 14 Q62 12, 66 14" fill={config.highlight} opacity="0.25" stroke="none" />
        </g>
      );
    default: // bangs
      return (
        <g>
          <path d="M42 18 Q52 12, 64 16 Q76 12, 86 18 L86 26 Q76 22, 64 24 Q52 22, 42 26 Z" fill={config.fill} />
          <path d="M50 16 Q58 14, 64 16 Q70 14, 78 16 L78 22 Q70 20, 64 22 Q58 20, 50 22 Z" fill={config.highlight} opacity="0.2" />
        </g>
      );
  }
}

function AccessoryLayer({ config }: { config: Record<string, any> }) {
  switch (config.style) {
    case "headband":
      return <rect x="42" y="22" width="44" height="3" rx="1.5" fill={config.fill} opacity="0.9" />;
    case "ribbon":
      return (
        <g>
          <path d="M80 18 L88 12 L84 18 L88 24 Z" fill={config.fill} />
          <circle cx="80" cy="18" r="2" fill={config.fill} />
        </g>
      );
    case "scar":
      return (
        <g>
          <line x1="72" y1="42" x2="78" y2="38" stroke={config.fill} strokeWidth="1" opacity="0.6" />
          <line x1="74" y1="40" x2="76" y2="44" stroke={config.fill} strokeWidth="0.5" opacity="0.4" />
        </g>
      );
    case "star":
      return (
        <g>
          <polygon points="76,20 77.5,23 81,23.5 78.5,25.5 79,29 76,27.5 73,29 73.5,25.5 71,23.5 74.5,23" fill={config.fill} opacity="0.8" />
        </g>
      );
    case "bandage":
      return (
        <g>
          <rect x="70" y="42" width="8" height="4" rx="1" fill={config.fill} opacity="0.8" />
          <line x1="72" y1="42" x2="72" y2="46" stroke="#CCC" strokeWidth="0.5" />
          <line x1="76" y1="42" x2="76" y2="46" stroke="#CCC" strokeWidth="0.5" />
        </g>
      );
    default:
      return null;
  }
}

function EffectLayer({ config }: { config: Record<string, any> }) {
  switch (config.style) {
    case "sparkle":
      return (
        <g className="animate-pulse" opacity="0.7">
          <polygon points="20,20 21,23 24,23 21.5,25 22.5,28 20,26 17.5,28 18.5,25 16,23 19,23" fill={config.color} />
          <polygon points="100,30 101,32.5 103.5,32.5 101.5,34 102,36 100,34.5 98,36 98.5,34 96.5,32.5 99,32.5" fill={config.color} />
          <polygon points="24,70 25,72 27,72 25.5,73.5 26,75.5 24,74 22,75.5 22.5,73.5 21,72 23,72" fill={config.color} />
        </g>
      );
    case "sweat":
      return (
        <g opacity="0.6">
          <path d="M88 30 Q89 34, 88 36 Q86 34, 88 30 Z" fill={config.color} />
        </g>
      );
    case "hearts":
      return (
        <g className="animate-pulse" opacity="0.6">
          <path d="M18 28 C18 26, 20 24, 22 26 C24 24, 26 26, 26 28 C26 31, 22 34, 22 34 C22 34, 18 31, 18 28 Z" fill={config.color} />
          <path d="M96 22 C96 20.5, 97.5 19, 99 20.5 C100.5 19, 102 20.5, 102 22 C102 24, 99 26, 99 26 C99 26, 96 24, 96 22 Z" fill={config.color} />
        </g>
      );
    case "fire":
      return (
        <g opacity="0.5">
          <path d="M30 118 Q28 110, 32 106 Q30 112, 34 114 Q36 108, 38 112 Q40 106, 38 118 Z" fill={config.color} />
          <path d="M90 118 Q88 110, 92 106 Q90 112, 94 114 Q96 108, 98 112 Q100 106, 98 118 Z" fill={config.color} />
        </g>
      );
    default:
      return null;
  }
}

export default React.memo(LayeredCharacterRenderer);
