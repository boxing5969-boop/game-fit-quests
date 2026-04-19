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
  NAMEPLATE_STYLES,
  AURA_CONFIG,
  AURA_INSET,
  HALO_CONFIGS,
} from "@/data/characterCustomizationData";

/*
 * ═══ z-index 계층 ═══
 * z-[1]  일반 오라 글로우 (캐릭터 뒤)
 * z-[3]  캐릭터 이미지
 * z-[4]  프레임 링
 * z-[5]  이펙트 이모지
 * z-[7]  BlackLeagueAura (후광)
 * z-[8]  마스터 오라 (최상단 후광)
 * z-20   라벨
 */

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

const MASTER_AURA_KEYS = [
  "halo_rainbow_master",
  "halo_black_gold",
  "halo_conqueror",
  "halo_galaxy_master",
];

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

  const auraKey = customization?.aura;
  const isMasterAura = !!auraKey && MASTER_AURA_KEYS.includes(auraKey);
  const auraTier = auraKey && auraKey !== "none" ? AURA_CONFIG[auraKey] : null;
  const hasAura = !!auraTier && auraTier.layers.length > 0 && size !== "xs" && !isMasterAura;

  // 후광: 마스터만 사용 가능, 선택된 후광 또는 마스터 기본(무지개)
  const haloKey = customization?.halo;
  const haloConfig = isMaster
    ? (haloKey && haloKey !== "none" ? HALO_CONFIGS[haloKey] : HALO_CONFIGS["halo_rainbow"])
    : null;
  const isDetail = size === "md" || size === "lg";

  return (
    <div
      className={`relative flex-shrink-0 select-none ${SIZE_MAP[size]} ${onClick ? "cursor-pointer active:scale-95" : ""} ${className}`}
      onClick={onClick}
    >

      {/* ── 1. 오라 글로우 — z-[1] ── */}
      {hasAura && (() => {
        const baseInset = AURA_INSET[size] ?? -5;
        return auraTier!.layers.map((layer, i) => (
          <div
            key={`aura-${i}`}
            className={`absolute rounded-full pointer-events-none z-[1] ${auraTier!.holo ? "animate-[aura-holo_4s_linear_infinite]" : ""} ${layer.animation}`}
            style={{
              inset: `${baseInset - layer.insetOffset}px`,
              background: layer.background,
              opacity: layer.opacity,
              ...(layer.mask ? { maskImage: layer.mask, WebkitMaskImage: layer.mask } : {}),
            }}
          />
        ));
      })()}

      {/* ── 2. 후광 — z-[2] ── */}
      {isBlack && !haloConfig && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <BlackLeagueAura
            mode={effectiveAuraMode}
            level={isMaster ? "master" : "halo"}
          />
        </div>
      )}
      {haloConfig && (
        <div className="absolute inset-0 z-[2] pointer-events-none" aria-hidden>
          {haloConfig.rings.map((ring, i) => (
            <div
              key={`halo-ring-${i}`}
              className={`absolute rounded-full ${ring.animation}`}
              style={{
                inset: ring.inset,
                background: ring.gradient,
                mask: ring.mask,
                WebkitMask: ring.mask,
                opacity: isDetail ? ring.opacity : ring.opacity * 0.6,
                filter: isDetail ? "brightness(1.4) saturate(1.3)" : undefined,
              }}
            />
          ))}
          <div
            className="absolute inset-0 rounded-full animate-[aura-pulse-slow_3s_ease-in-out_infinite]"
            style={{
              background: `radial-gradient(circle, ${haloConfig.glowColor}, transparent 70%)`,
              opacity: haloConfig.glowOpacity,
            }}
          />
          {isDetail && (
            <>
              <div className="absolute top-[8%] right-[15%] animate-[aura-sparkle_3.5s_ease-in-out_infinite]">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z" fill={haloConfig.sparkleColor || "white"} opacity="0.7" />
                </svg>
              </div>
              <div className="absolute bottom-[12%] left-[10%] animate-[aura-sparkle-delayed_4s_ease-in-out_infinite]">
                <svg width="8" height="8" viewBox="0 0 10 10">
                  <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z" fill={haloConfig.sparkleColor || "white"} opacity="0.6" />
                </svg>
              </div>
              <div className="absolute top-[55%] right-[8%] animate-[aura-sparkle_3s_ease-in-out_infinite]">
                <svg width="9" height="9" viewBox="0 0 10 10">
                  <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z" fill={haloConfig.sparkleColor || "white"} opacity="0.65" />
                </svg>
              </div>
              <div className="absolute top-[35%] left-[5%] animate-[aura-sparkle-delayed_5s_ease-in-out_infinite]">
                <svg width="7" height="7" viewBox="0 0 10 10">
                  <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z" fill="white" opacity="0.5" />
                </svg>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 3. 프레임 링 — z-[3] ── */}
      {customization?.frame && showOverlays && (
        <div className={`absolute inset-0 rounded-full z-[3] ${frameClass}`} />
      )}

      {/* ── 4. 캐릭터 이미지 — z-[10] 항상 맨 앞 ── */}
      <div
        className={`relative z-[10] h-full w-full ${animate ? "animate-emote-idle" : ""}`}
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
            className="h-full w-full object-contain drop-shadow-elev-1"
            style={{ imageRendering: "auto" }}
            draggable={false}
            // Hero-size sprites (lg/md) are the visible above-the-fold
            // character on Home/MyPage — load eager + high priority so
            // they drive LCP, not deprioritized like the list thumbnails.
            loading={size === "lg" || size === "md" ? "eager" : "lazy"}
            fetchPriority={size === "lg" ? "high" : "auto"}
            decoding="async"
          />
        )}
      </div>

      {/* ── 5. 이펙트 이모지 — z-[11] ── */}
      {customization?.effect && (showOverlays || showEffectSmall) && (
        <div className="absolute inset-0 z-[11] pointer-events-none">
          <EffectOverlay effect={customization.effect} size={size} />
        </div>
      )}

      {/* ── 6. 마스터 오라 sparkle — z-[12] ── */}
      {isMasterAura && auraTier?.sparkles && size === "lg" && (
        <div className="absolute inset-0 z-[12] pointer-events-none">
          <div className="absolute" style={{ top: "5%", left: "50%", transform: "translateX(-50%)" }}>
            <svg width="8" height="8" viewBox="0 0 10 10">
              <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z"
                fill="white" opacity="0.9"
                className="animate-[aura-sparkle_1.5s_ease-in-out_infinite]"/>
            </svg>
          </div>
          <div className="absolute" style={{ top: "50%", right: "3%", transform: "translateY(-50%)" }}>
            <svg width="6" height="6" viewBox="0 0 10 10">
              <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z"
                fill="white" opacity="0.8"
                className="animate-[aura-sparkle-delayed_2s_ease-in-out_infinite]"/>
            </svg>
          </div>
          <div className="absolute" style={{ bottom: "8%", left: "15%" }}>
            <svg width="7" height="7" viewBox="0 0 10 10">
              <path d="M5 0L5.8 4.2L10 5L5.8 5.8L5 10L4.2 5.8L0 5L4.2 4.2Z"
                fill="white" opacity="0.7"
                className="animate-[aura-sparkle_2.5s_ease-in-out_infinite]"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── 7. 라벨 — z-20 ── */}
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

// 프리미엄 이펙트: 이모지 2종 교차 + 8개 + 더 넓은 범위
const PREMIUM_EFFECTS: Record<string, [string, string]> = {
  inferno_dual: ["🔥", "🔵"],
  thunder_god:  ["⚡", "⛈️"],
  cosmic_dust:  ["✨", "🌌"],
  sword_aura:   ["⚔️", "💫"],
  dark_flame:   ["🖤", "🔥"],
  lotus:        ["🪷", "✨"],
  sakura_storm: ["🌸", "💮"],
  rose_gold:    ["🌹", "✨"],
};

const EffectOverlay: React.FC<{ effect: string; size: string }> = ({ effect, size }) => {
  const emoji = EFFECT_EMOJIS[effect] || "✨";
  const premium = PREMIUM_EFFECTS[effect];

  if (size === "sm" || size === "xs") {
    return (
      <span className="absolute -top-1 -right-1 text-xs animate-pulse">
        {emoji}
      </span>
    );
  }

  // 프리미엄 이펙트: 8개, 2종 이모지 교차, 더 넓게
  if (premium) {
    const [e1, e2] = premium;
    const emojiSize = size === "lg" ? "text-xl" : "text-base";
    return (
      <div className="absolute inset-0 overflow-visible">
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-18%", left: "50%", transform: "translateX(-50%)", animationDelay: "0s", animationDuration: "1.3s" }}>{e1}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-12%", right: "-2%", animationDelay: "0.4s", animationDuration: "1.6s" }}>{e2}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "25%", right: "-18%", animationDelay: "0.8s", animationDuration: "1.4s" }}>{e1}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "10%", right: "-12%", animationDelay: "1.2s", animationDuration: "1.7s" }}>{e2}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "-12%", left: "50%", transform: "translateX(-50%)", animationDelay: "0.2s", animationDuration: "1.5s" }}>{e1}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "10%", left: "-12%", animationDelay: "0.6s", animationDuration: "1.8s" }}>{e2}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "25%", left: "-18%", animationDelay: "1.0s", animationDuration: "1.3s" }}>{e1}</span>
        <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-12%", left: "-2%", animationDelay: "0.3s", animationDuration: "2s" }}>{e2}</span>
      </div>
    );
  }

  // 일반 이펙트: 6개
  const emojiSize = size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className="absolute inset-0 overflow-visible">
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-14%", left: "8%", animationDelay: "0s", animationDuration: "1.5s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "-14%", right: "8%", animationDelay: "0.5s", animationDuration: "1.8s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "38%", left: "-14%", animationDelay: "0.2s", animationDuration: "1.6s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ top: "38%", right: "-14%", animationDelay: "0.7s", animationDuration: "1.4s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "-8%", left: "12%", animationDelay: "0.4s", animationDuration: "2s" }}>{emoji}</span>
      <span className={`absolute ${emojiSize} animate-bounce`} style={{ bottom: "-8%", right: "12%", animationDelay: "0.9s", animationDuration: "1.7s" }}>{emoji}</span>
    </div>
  );
};

export default React.memo(CharacterSprite);
