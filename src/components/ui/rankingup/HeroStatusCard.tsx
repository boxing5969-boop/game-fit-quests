import { useState, type ReactNode, type CSSProperties } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { XPBar } from "./XPBar";

interface HeroStatusCardProps {
  /** Character artwork / avatar / sprite slot. */
  character?: ReactNode;
  leagueName: string;
  leagueIcon?: ReactNode;
  level: number;
  totalXp: number;
  /** Total XP needed to reach the next level. */
  xpToNext: number;
  streakDays?: number;
  /** Shown under streak — e.g. "🔥 10일 연속 출석" fallback if streakDays omitted. */
  streakLabel?: string;
  /** Extra action slot, renders top-right corner of the card. */
  action?: ReactNode;
  className?: string;
}

// 캐릭터 클릭 시 생성되는 파티클 버스트.
// 각 파티클은 radial 로 밖으로 튀어나가며 서서히 페이드아웃한다.
interface BurstParticle {
  id: number;
  emoji: string;
  endX: number;
  endY: number;
  delay: number;
  size: number;
}
const BURST_EMOJIS = ["✨", "⭐", "🎉", "💥", "👊", "🥊", "💫"] as const;
const BURST_COUNT = 14;
const BURST_DURATION_MS = 900;

const buildBurst = (seed: number): BurstParticle[] =>
  Array.from({ length: BURST_COUNT }, (_, i) => {
    const baseAngle = (i / BURST_COUNT) * Math.PI * 2;
    // 살짝 랜덤 각도·거리로 자연스러운 분산. Math.random 은 매 클릭마다 다른 패턴.
    const angle = baseAngle + (Math.random() - 0.5) * 0.45;
    const distance = 70 + Math.random() * 45;
    return {
      id: seed * 100 + i,
      emoji: BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)],
      endX: Math.cos(angle) * distance,
      endY: Math.sin(angle) * distance,
      delay: Math.random() * 90,
      size: 18 + Math.random() * 10,
    };
  });

/**
 * Hero card: large character on a dark gradient stage, with league /
 * level badge, XP progress to next level, and an optional streak chip.
 */
export const HeroStatusCard = ({
  character,
  leagueName,
  leagueIcon,
  level,
  totalXp,
  xpToNext,
  streakDays,
  streakLabel,
  action,
  className,
}: HeroStatusCardProps) => {
  const streakText =
    streakLabel ??
    (streakDays && streakDays > 0 ? `${streakDays}일 연속 출석 중` : null);

  // 클릭 이펙트 상태 — 같은 애니메이션이 겹치지 않게 debounce.
  const [burst, setBurst] = useState<{ id: number; particles: BurstParticle[] } | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const handleCharacterPop = () => {
    if (pulsing) return;
    const id = Date.now();
    setBurst({ id, particles: buildBurst(id) });
    setPulsing(true);
    // 햅틱 — 모바일에서만 반응. 미지원 기기는 무시.
    try {
      navigator.vibrate?.(30);
    } catch {
      // safari / 미지원 기기 — 무시
    }
    window.setTimeout(() => {
      setBurst(null);
      setPulsing(false);
    }, BURST_DURATION_MS);
  };

  return (
    <section className={cn("hero-card", className)}>
      {/* Ambient glow backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {action && (
        <div className="absolute right-4 top-4 z-10">{action}</div>
      )}

      <div className="relative flex flex-col items-center text-center">
        {/* Character / artwork slot — 탭하면 파티클 버스트 + 캐릭터 팝 애니메이션 */}
        {character && (
          <button
            type="button"
            onClick={handleCharacterPop}
            aria-label="캐릭터 응원 탭"
            className={cn(
              "relative mb-4 flex h-40 w-40 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              "transition-transform select-none",
              pulsing && "animate-[heroPop_0.6s_ease-out]",
            )}
          >
            {character}
            {/* 파티클 버스트 — 상태가 있을 때만 렌더 */}
            {burst?.particles.map((p) => (
              <span
                key={p.id}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                style={{
                  fontSize: `${p.size}px`,
                  animation: `heroBurst ${BURST_DURATION_MS}ms ${p.delay}ms cubic-bezier(0.22,0.61,0.36,1) forwards`,
                  "--end-x": `${p.endX}px`,
                  "--end-y": `${p.endY}px`,
                  transform: "translate(-50%, -50%) scale(0.4)",
                  opacity: 0,
                } as CSSProperties}
              >
                {p.emoji}
              </span>
            ))}
          </button>
        )}

        {/* 로컬 keyframes — Tailwind 설정 확장 없이 인라인 주입 */}
        <style>{`
          @keyframes heroBurst {
            0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
            15%  { opacity: 1; }
            100% { transform: translate(calc(-50% + var(--end-x)), calc(-50% + var(--end-y))) scale(1.15) rotate(20deg); opacity: 0; }
          }
          @keyframes heroPop {
            0%   { transform: scale(1)    rotate(0deg); }
            35%  { transform: scale(1.12) rotate(-4deg); }
            65%  { transform: scale(0.94) rotate(3deg); }
            100% { transform: scale(1)    rotate(0deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes heroBurst { 0%,100% { opacity: 0; } }
            @keyframes heroPop   { 0%,100% { transform: scale(1); } }
          }
        `}</style>

        {/* League + level badge */}
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-background/60 px-3.5 py-1 backdrop-blur">
          {leagueIcon && (
            <span className="flex items-center text-base">{leagueIcon}</span>
          )}
          <span className="text-body-sm font-bold text-foreground">
            {leagueName} · Lv.
            <span className="number-font">{level}</span>
          </span>
        </div>

        {/* Streak chip */}
        {streakText && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-reward/15 px-3 py-1">
            <Flame className="h-3.5 w-3.5 text-reward" />
            <span className="text-caption font-bold text-reward">
              {streakText}
            </span>
          </div>
        )}

        {/* XP progress to next level — spec: primary gradient for XP */}
        <div className="mt-5 w-full">
          <XPBar
            current={totalXp}
            max={xpToNext}
            variant="primary"
            size="md"
            label="다음 승급까지"
            showNumbers
          />
        </div>
      </div>
    </section>
  );
};

export default HeroStatusCard;
