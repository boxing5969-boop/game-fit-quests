import React, { useMemo, lazy, Suspense } from "react";
import { getCharacterImage, getCharacterByHash } from "@/data/characterPresets";
import BlackLeagueAura from "@/components/BlackLeagueAura";
import type { PartsSelection } from "@/data/characterPartsData";

const LayeredCharacterRenderer = lazy(() => import("@/components/LayeredCharacterRenderer"));
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import {
  EFFECT_EMOJIS,
  FRAME_STYLES,
  TITLE_LABELS,
  AURA_RADIAL_STYLES,
  AURA_SPIN_DURATIONS,
  MASTER_AURA_KEYS,
  NAMEPLATE_STYLES,
} from "@/data/characterCustomizationData";

interface CharacterSpriteProps {
  style?: string;
  userId?: string;
  partsJson?: { parts?: PartsSelection; style?: string; customization?: CharacterCustomization };
  size?: "xs" | "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
  onClick?: () => void;
  league?: "white" | "blue" | "red" | "black";
  level?: number;
  auraMode?: "compact" | "detail";
  customization?: CharacterCustomization;
}

const SIZE_MAP = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-32 h-32",
};

const SIZE_PX = { xs: 32, sm: 48, md: 80, lg: 128 };

const AURA_INSET: Record<string, string> = {
  xs: "-4px",
  sm: "-4px",
  md: "-8px",
  lg: "-8px",
};

const AURA_ALIAS_MAP: Record<string, string> = {
  // ── basic radial ──
  softglow: "soft_glow",
  rainbow: "aura_rainbow",
  aurarainbow: "aura_rainbow",
  rainbowaura: "aura_rainbow",
  fire: "aura_fire",
  flame: "aura_fire",
  aurafire: "aura_fire",
  ice: "aura_ice",
  frost: "aura_ice",
  auraice: "aura_ice",
  lightning: "aura_lightning",
  thunder: "aura_lightning",
  auralightning: "aura_lightning",
  galaxy: "aura_galaxy",
  auragalaxy: "aura_galaxy",
  blueflame: "blue_flame",
  greenenergy: "green_energy",
  aurasakura: "aura_sakura",
  sakura: "aura_sakura",
  redrage: "red_rage",
  auragold: "aura_gold",
  goldenaura: "golden_aura",
  purplehaze: "purple_haze",
  aurablood: "aura_blood",
  blood: "aura_blood",
  auraneon: "aura_neon",
  neon: "aura_neon",
  auradark: "aura_dark",
  dark: "aura_dark",
  aurashadow: "aura_shadow",
  shadow: "aura_shadow",
  auraholy: "aura_holy",
  holy: "aura_holy",
  darkmatter: "dark_matter",
  infernal: "infernal",
  cosmic: "cosmic",
  divine: "divine",
  voidemperor: "void_emperor",

  // ── master halo ──
  rainbownmaster: "halo_rainbow_master",
  rainbowmaster: "halo_rainbow_master",
  masterrainbow: "halo_rainbow_master",
  halorainbowmaster: "halo_rainbow_master",

  blackgold: "halo_black_gold",
  haloblackgold: "halo_black_gold",

  conqueror: "halo_conqueror",
  haloconqueror: "halo_conqueror",

  galaxymaster: "halo_galaxy_master",
  mastergalaxy: "halo_galaxy_master",
  halogalaxymaster: "halo_galaxy_master",
};

const NAMEPLATE_ALIAS_MAP: Record<string, string> = {
  default: "default",
  basic: "default",
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  neon: "neon",
  purple: "purple",
  violet: "purple",
  blackgold: "blackgold",
  black_gold: "blackgold",
  "black-gold": "blackgold",
};

function normalizeKey(value?: string) {
  return (value ?? "").toLowerCase().replace(/[\W_-]/g, "");
}

function resolveAuraKey(rawKey?: string): string | null {
  if (!rawKey || rawKey === "none") return null;

  if ((MASTER_AURA_KEYS as readonly string[]).includes(rawKey)) return rawKey;
  if (AURA_RADIAL_STYLES[rawKey]) return rawKey;

  const normalized = normalizeKey(rawKey);

  if (AURA_ALIAS_MAP[normalized]) return AURA_ALIAS_MAP[normalized];

  if (normalized.includes("rainbow") && normalized.includes("master")) return "halo_rainbow_master";
  if (normalized.includes("galaxy") && normalized.includes("master")) return "halo_galaxy_master";
  if (normalized.includes("black") && normalized.includes("gold")) return "halo_black_gold";
  if (normalized.includes("conqueror")) return "halo_conqueror";
  if (normalized.includes("rainbow")) return "aura_rainbow";
  if (normalized.includes("galaxy")) return "aura_galaxy";
  if (normalized.includes("lightning") || normalized.includes("thunder")) return "aura_lightning";
  if (normalized.includes("fire") || normalized.includes("flame")) return "aura_fire";
  if (normalized.includes("ice") || normalized.includes("frost")) return "aura_ice";

  // final fallback: match normalized key against all RADIAL keys
  for (const k of Object.keys(AURA_RADIAL_STYLES)) {
    if (normalizeKey(k) === normalized) return k;
  }

  return null;
}

function resolveNameplateClass(rawKey?: string): string {
  if (!rawKey || rawKey === "none") return "";

  const direct = NAMEPLATE_STYLES[rawKey];
  if (direct !== undefined) return direct;

  const normalized = normalizeKey(rawKey);
  const mapped = NAMEPLATE_ALIAS_MAP[normalized];

  if (mapped && NAMEPLATE_STYLES[mapped]) return NAMEPLATE_STYLES[mapped];

  if (normalized.includes("gold")) return NAMEPLATE_STYLES.blackgold || NAMEPLATE_STYLES.gold || "";
  if (normalized.includes("purple") || normalized.includes("violet")) return NAMEPLATE_STYLES.purple || "";
  if (normalized.includes("neon")) return NAMEPLATE_STYLES.neon || "";
  if (normalized.includes("silver")) return NAMEPLATE_STYLES.silver || "";
  if (normalized.includes("bronze")) return NAMEPLATE_STYLES.bronze || "";

  return NAMEPLATE_STYLES.default || "";
}

const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  style,
  userId,
  partsJson,
  size = "sm",
  animate = false,
  className = "",
  onClick,
  league,
  level,
  auraMode,
  customization: customizationProp,
}) => {
  const isLayered = !!(partsJson?.parts && Object.keys(partsJson.parts).length > 0);
  const presetStyle = partsJson?.style || style;
  const customization = customizationProp || partsJson?.customization;
  const imgSrc = useMemo(() => {
    if (isLayered) return null;
    if (presetStyle) return getCharacterImage(presetStyle);
    if (userId) return getCharacterByHash(userId).image;
    return getCharacterImage();
  }, [presetStyle, userId, isLayered]);

  const isBlack = league === "black";
  const isMaster = isBlack && (level ?? 0) >= 10;
  const effectiveAuraMode = auraMode ?? (size === "xs" || size === "sm" ? "compact" : "detail");

  const showOverlays = size === "md" || size === "lg";
  const showEffectSmall = size === "sm";
  const frameClass = customization?.frame ? FRAME_STYLES[customization.frame] || "" : "";

  const resolvedAuraKey = resolveAuraKey(customization?.aura);
  const isMasterAura = !!resolvedAuraKey && (MASTER_AURA_KEYS as readonly string[]).includes(resolvedAuraKey);
  const nameplateClass = resolveNameplateClass(customization?.nameplate);

  const shouldShowLabel = size !== "xs" && !!(customization?.title || customization?.nameplate);
  const labelText =
    customization?.title
      ? (TITLE_LABELS[customization.title]?.text || customization.title)
      : "칭호";

  const labelColorClass =
    nameplateClass || (customization?.title ? TITLE_LABELS[customization.title]?.color : "") || "text-foreground";

  const labelWrapClass =
    size === "sm"
      ? "absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap"
      : "absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap";

  const labelTextClass = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >
      {isBlack && (
        <BlackLeagueAura
          mode={effectiveAuraMode}
          level={isMaster ? "master" : "halo"}
        />
      )}

      {resolvedAuraKey && size !== "xs" && (
        isMasterAura ? (
          <MasterAuraOverlay auraKey={resolvedAuraKey} size={size} />
        ) : AURA_RADIAL_STYLES[resolvedAuraKey] ? (
          <div
            className={`absolute rounded-full pointer-events-none z-[3] ${
              AURA_SPIN_DURATIONS[resolvedAuraKey]
                ? "animate-spin"
                : resolvedAuraKey === "aura_lightning"
                  ? "animate-ping"
                  : "animate-pulse"
            }`}
            style={{
              inset: AURA_INSET[size],
              background: AURA_RADIAL_STYLES[resolvedAuraKey],
              animationDuration: resolvedAuraKey ? AURA_SPIN_DURATIONS[resolvedAuraKey] : undefined,
            }}
          />
        ) : null
      )}

      {customization?.frame && showOverlays && (
        <div className={`absolute inset-0 rounded-full z-[5] ${frameClass}`} />
      )}

      <div
        className={`relative z-10 h-full w-full ${animate ? "animate-emote-idle" : ""}`}
        style={{ willChange: animate ? "transform" : undefined }}
      >
        {isLayered ? (
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-muted" />}>
            <LayeredCharacterRenderer
              parts={partsJson!.parts!}
              size={SIZE_PX[size]}
              className="h-full w-full"
            />
          </Suspense>
        ) : (
          <img
            src={imgSrc!}
            alt="캐릭터"
            className="h-full w-full object-contain drop-shadow-sm"
            style={{ imageRendering: "auto" }}
            draggable={false}
            loading="lazy"
          />
        )}

        {customization?.effect && (showOverlays || showEffectSmall) && (
          <EffectOverlay effect={customization.effect} size={size} />
        )}
      </div>

      {shouldShowLabel && (
        <div className={labelWrapClass}>
          <span className={`${labelTextClass} font-bold ${labelColorClass}`}>
            {labelText}
          </span>
        </div>
      )}
    </div>
  );
};

type MasterAuraLayer = {
  gradient: string;
  mask?: string;
  animClass: string;
  opacity: number;
  inset: string;
  duration?: string;
};

const MASTER_AURA_CONFIG: Record<string, MasterAuraLayer[]> = {
  halo_rainbow_master: [
    {
      gradient: "conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd, #ff6b6b)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.75,
      inset: "-14px",
      duration: "4s",
    },
    {
      gradient: "conic-gradient(from 180deg, #ff9ff3, #54a0ff, #48dbfb, #feca57, #ff6b6b, #5f27cd, #ff9ff3)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.5,
      inset: "-7px",
      duration: "6s",
    },
    {
      gradient: "radial-gradient(circle, rgba(147,51,234,0.5), rgba(59,130,246,0.3), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.4,
      inset: "-5px",
    },
  ],
  halo_black_gold: [
    {
      gradient: "conic-gradient(from 0deg, #fbbf24, #78350f, #fbbf24, #1c1917, #fbbf24, #78350f, #fbbf24)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.85,
      inset: "-14px",
      duration: "5s",
    },
    {
      gradient: "conic-gradient(from 90deg, #1c1917, #fbbf24, #78350f, #fbbf24, #1c1917)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.6,
      inset: "-7px",
      duration: "7s",
    },
    {
      gradient: "radial-gradient(circle, rgba(251,191,36,0.6), rgba(28,25,23,0.5), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.45,
      inset: "-5px",
    },
  ],
  halo_conqueror: [
    {
      gradient: "conic-gradient(from 0deg, #ef4444, #f97316, #7c2d12, #ef4444, #b91c1c, #f97316, #ef4444)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.85,
      inset: "-14px",
      duration: "3s",
    },
    {
      gradient: "conic-gradient(from 180deg, #7c2d12, #ef4444, #f97316, #b91c1c, #7c2d12)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.55,
      inset: "-7px",
      duration: "5s",
    },
    {
      gradient: "radial-gradient(circle, rgba(239,68,68,0.7), rgba(249,115,22,0.4), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.45,
      inset: "-5px",
    },
  ],
  halo_galaxy_master: [
    {
      gradient: "conic-gradient(from 0deg, #4f46e5, #7c3aed, #0f172a, #1d4ed8, #7c3aed, #0f172a, #4f46e5)",
      mask: "radial-gradient(circle, transparent 44%, black 49%, black 70%, transparent 75%)",
      animClass: "animate-aura-hue",
      opacity: 0.75,
      inset: "-14px",
      duration: "6s",
    },
    {
      gradient: "conic-gradient(from 270deg, #1e1b4b, #4f46e5, #7c3aed, #1e40af, #1e1b4b)",
      mask: "radial-gradient(circle, transparent 52%, black 56%, black 66%, transparent 71%)",
      animClass: "animate-aura-hue-reverse",
      opacity: 0.5,
      inset: "-7px",
      duration: "8s",
    },
    {
      gradient: "radial-gradient(circle, rgba(99,102,241,0.5), rgba(124,58,237,0.35), transparent 70%)",
      animClass: "animate-aura-pulse",
      opacity: 0.4,
      inset: "-5px",
    },
  ],
};

const MasterAuraOverlay: React.FC<{ auraKey: string; size: string }> = ({ auraKey, size }) => {
  const layers = MASTER_AURA_CONFIG[auraKey];
  if (!layers) return null;

  const outerInset = size === "sm" ? "-8px" : "-14px";

  return (
    <>
      {layers.map((layer, i) => (
        <div
          key={i}
          className={`absolute rounded-full pointer-events-none z-[3] ${layer.animClass}`}
          style={{
            inset: i === 0 ? outerInset : layer.inset,
            background: layer.gradient,
            opacity: layer.opacity,
            ...(layer.mask ? { mask: layer.mask, WebkitMask: layer.mask } : {}),
            ...(layer.duration ? { animationDuration: layer.duration } : {}),
          }}
        />
      ))}
    </>
  );
};

const EffectOverlay: React.FC<{ effect: string; size: string }> = ({ effect, size }) => {
  const emoji = EFFECT_EMOJIS[effect] || "✨";

  if (size === "sm" || size === "xs") {
    return (
      <span className="absolute -top-1 -right-1 z-20 text-xs animate-pulse pointer-events-none">
        {emoji}
      </span>
    );
  }

  const emojiSize = size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-8%", left: "5%", animationDelay: "0s", animationDuration: "1.5s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-8%", right: "5%", animationDelay: "0.4s", animationDuration: "1.8s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "5%", left: "50%", transform: "translateX(-50%)", animationDelay: "0.8s", animationDuration: "2s" }}>{emoji}</span>
      {size === "lg" && (
        <>
          <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "30%", left: "-10%", animationDelay: "0.2s", animationDuration: "1.6s" }}>{emoji}</span>
          <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "30%", right: "-10%", animationDelay: "0.6s", animationDuration: "1.4s" }}>{emoji}</span>
        </>
      )}
    </div>
  );
};

export default React.memo(CharacterSprite);

