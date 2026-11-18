/**
 * 🎯 홈 「다음 레벨까지」 — 응원 · 보상 · 축하 (2026-11-18 대표님 「반복은 천재를 만든다는 말로 응원해주며 레벨업 하는재미를 느낄수있도록」)
 *
 *   · QuestCheer  — 「반복은 천재를 만든다」 + 그날 한 줄 (lib/levelQuest.ts 의 CHEER_HEADLINE · questCheerLine)
 *   · QuestReward — 레벨업하면 받는 것 (금색 칸 — XP · 챔피언 머니 · 마일리지 / 레벨 10 = 다음 리그 · 타이틀매치 마일리지)
 *   · useOncePerDevice — 이 기기에서 한 번만 (도장 찍히는 움직임 · 레벨업 축하 꽃가루)
 *   · useLevelUpBurst — 레벨업한 날 목표 칸 쪽에서 작은 꽃가루 한 번 ('움직임 줄이기' 설정이면 안 터진다)
 */
import { useEffect, useState, type RefObject } from "react";
import { CHEER_HEADLINE, type QuestReward as QuestRewardData } from "@/lib/levelQuest";

/** 「반복은 천재를 만든다」 띠 — 153 글러브(입체 아이콘) + 대표님 문구 + 그날 한 줄 */
export const QuestCheer = ({ line }: { line: string }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-heading shadow-elev-1">
      🥊
    </span>
    <div className="min-w-0">
      <p className="break-keep text-body font-extrabold leading-snug text-foreground">{CHEER_HEADLINE}</p>
      <p className="break-keep text-label text-muted-foreground">{line}</p>
    </div>
  </div>
);

/** 레벨업 보상 — 금색 칸 하나에 2~3칸 (한 줄 · 좁은 폰에서도 꺾이지 않게) */
export const QuestReward = ({ reward }: { reward: QuestRewardData }) => {
  // 긴 값(+1,000 · 블루 리그)이 셋 칸에 들면 한 단계 작게 — 좁은 폰 · 큰 글씨에서 잘리지 않게
  const longValues = reward.items.length >= 3 && reward.items.some((it) => it.value.length >= 6);
  return (
    <div
      className="mt-3 rounded-2xl border border-reward/30 bg-reward/[0.07] px-3 pb-3 pt-2.5"
      aria-label={`${reward.label} — ${reward.items.map((it) => `${it.name} ${it.value}`).join(" · ")}`}
    >
      <p className="flex items-center gap-1 text-label font-bold text-foreground" aria-hidden>
        <span>🎁</span>
        {reward.label}
      </p>
      <div
        className="mt-2 grid divide-x divide-reward/25"
        style={{ gridTemplateColumns: `repeat(${reward.items.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {reward.items.map((it) => (
          <div key={it.name} className="min-w-0 px-1 text-center">
            <p className={`number-font truncate font-black tabular-nums leading-tight text-reward ${longValues ? "text-body" : "text-heading"}`}>
              {it.value}
            </p>
            <p className="truncate text-micro font-bold text-muted-foreground">{it.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 이 기기에서 이 열쇠를 처음 볼 때만 true — 화면을 다시 열어도 같은 움직임이 되풀이되지 않게.
 * 저장소가 막힌 기기는 움직이지 않는다(되풀이보다 조용한 쪽).
 */
export function useOncePerDevice(key: string | null): boolean {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    if (!key) return;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      setFirst(true);
    } catch {
      /* 저장이 막히면 움직이지 않는다 */
    }
  }, [key]);
  return first;
}

/** 레벨업한 날 — 목표 칸 쪽에서 작은 꽃가루 한 번 (금색 · 민트 · 흰색). active 가 true 가 된 뒤 한 번만 */
export function useLevelUpBurst(active: boolean, anchor: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void import("canvas-confetti")
        .then(({ default: confetti }) => {
          if (cancelled) return;
          const el = anchor.current;
          const r = el?.getBoundingClientRect();
          const x = r ? (r.left + r.width / 2) / Math.max(1, window.innerWidth) : 0.5;
          const y = r ? (r.top + r.height / 2) / Math.max(1, window.innerHeight) : 0.4;
          confetti({
            particleCount: 60,
            spread: 75,
            startVelocity: 32,
            gravity: 0.9,
            ticks: 140,
            scalar: 0.9,
            origin: { x: Math.min(0.95, Math.max(0.05, x)), y: Math.min(0.9, Math.max(0.05, y)) },
            colors: ["#F6C453", "#FFD978", "#29C39C", "#FFFFFF"],
            disableForReducedMotion: true,
          });
        })
        .catch(() => undefined);
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [active, anchor]);
}
