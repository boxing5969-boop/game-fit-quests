/**
 * 🎯 홈 「다음 레벨까지」 — 리그 막대 · 보상 상자 · 오늘의 퀘스트 · 축하
 * (v1 2026-11-18 대표님 「반복은 천재를 만든다는 말로 응원해주며 레벨업 하는재미를 느낄수있도록」 ·
 *  v2 같은 날 「심리적으로 채우고싶은 느낌이 나고 게임처럼 레벨업 하고싶은 욕구가 강해질수있는 디자인으로」)
 *
 *   · QuestLeagueStrip — 「화이트 리그 ▰▰▰◧▱▱▱▱▱ 🏆 ›」 이미 쌓은 레벨을 먼저 보여 준다(부여된 진전 효과) · 누르면 레벨 지도
 *   · QuestRewardBox   — 「레벨 5 달성 보상」 XP · 챔피언 머니 · 마일리지 칸 + 다음에 배울 기술 한 줄 (보상 기대 · 궁금증)
 *                        레벨업한 날은 「받았어요」 — 칸이 차례로 톡톡 (이 기기에서 한 번)
 *   · QuestDailyBand   — 「반복은 천재를 만든다」 + 그날 한 줄 + 오늘의 퀘스트(오면 바로 받는 것 · 오면 「받았어요」)
 *   · useOncePerDevice — 이 기기에서 한 번만 (도장 찍히는 움직임 · 레벨업 축하)
 *   · useLevelUpBurst  — 레벨업한 날 목표 칸 쪽에서 작은 꽃가루 한 번 ('움직임 줄이기' 설정이면 안 터진다)
 * 숫자는 lib/levelQuest.ts 가 고른 값 그대로 (실제로 받는 값만). 아이콘 = 153 입체 아이콘(번개 XP · 지폐 챔피언 머니 · 동전 마일리지).
 */
import { useEffect, useState, type RefObject } from "react";
import { Check, ChevronRight } from "lucide-react";
import { RANK_LABELS } from "@/data/sharedConstants";
import { icon3dSrc } from "@/lib/emoji3d/map";
import {
  CHEER_HEADLINE,
  type DailyQuest,
  type DailyQuestItem,
  type QuestReward as QuestRewardData,
  type QuestRewardKey,
  type QuestSkill,
} from "@/lib/levelQuest";
import { cn } from "@/lib/utils";

/** 보상 아이콘 — 153 입체 아이콘 (이모지 대신 그림 · map.ts 와 같은 짝: ⚡ 💵 🪙 🏆) */
const REWARD_ICON: Record<QuestRewardKey, string> = { xp: "bolt", money: "money", mileage: "coin", league: "trophy" };

const Icon3d = ({ name, className }: { name: string; className?: string }) => (
  <img src={icon3dSrc(name)} alt="" aria-hidden draggable={false} className={cn("shrink-0 select-none", className)} />
);

/** 리그 막대 — 리그 이름 + 레벨 1~9 막대(지나온 레벨 가득 · 지금 레벨은 진행만큼) + 트로피(레벨 10) · 누르면 레벨 지도 */
export const QuestLeagueStrip = ({ league, bars, onOpen }: { league: string; bars: readonly number[] | null; onOpen: () => void }) => {
  const name = `${RANK_LABELS[league] ?? RANK_LABELS.white} 리그`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name} 레벨 지도 보기`}
      className="-my-2 -ml-2 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full pl-2 pr-1 text-left active:bg-muted"
    >
      <span className="shrink-0 text-label font-bold text-foreground">{name}</span>
      {bars && (
        <span aria-hidden className="flex min-w-0 max-w-[10.5rem] flex-1 items-center gap-[3px]">
          {bars.map((f, k) => (
            <span key={k} className="relative h-1.5 min-w-[5px] flex-1 overflow-hidden rounded-full bg-muted shadow-[inset_0_1px_1px_rgba(15,23,42,0.12)]">
              {f > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.round(Math.min(1, f) * 100)}%` }} />}
            </span>
          ))}
          <Icon3d name="trophy" className="ml-0.5 h-4 w-4" />
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
};

/** 보상 상자 — 금색 상자 안 흰 칸(아이콘 + 값 + 이름) + 다음에 배울 것 한 줄. 레벨업한 날은 「받았어요」 */
export const QuestRewardBox = ({ reward, skill, celebrate }: { reward: QuestRewardData; skill: QuestSkill | null; celebrate: boolean }) => {
  const n = reward.items.length;
  // 긴 값(+1,000 · 블루 리그)이 세 칸에 들면 한 단계 작게 — 좁은 폰 · 큰 글씨에서 잘리지 않게
  const long = n >= 3 && reward.items.some((it) => it.value.length >= 6);
  const pop = celebrate && reward.received;
  return (
    <div
      className="mt-3 rounded-2xl border border-reward/35 bg-reward/[0.08] p-3"
      aria-label={`${reward.label}${reward.received ? " · 받았어요" : ""} — ${reward.items.map((it) => `${it.name} ${it.value}`).join(" · ")}${
        skill ? ` · ${skill.label} ${skill.value}` : ""
      }`}
    >
      <div className="flex items-center gap-2" aria-hidden>
        <Icon3d name="gift" className="h-6 w-6" />
        <p className="min-w-0 flex-1 truncate text-label font-bold text-foreground">{reward.label}</p>
        {reward.received && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-micro font-bold text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3.4} />
            받았어요
          </span>
        )}
      </div>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {reward.items.map((it, i) => (
          <div
            key={it.key}
            className={cn("relative min-w-0 rounded-xl bg-card px-1.5 pb-1.5 pt-2 text-center shadow-elev-1", pop && "motion-safe:animate-quest-pop")}
            style={pop ? { animationDelay: `${0.9 + i * 0.16}s` } : undefined}
          >
            {/* 아이콘과 값이 한 줄에 안 들어가면(좁은 폰 · 큰 글씨) 값이 아이콘 아래로 — 잘리지 않게 */}
            <div className="flex flex-wrap items-center justify-center gap-x-1">
              <Icon3d name={REWARD_ICON[it.key]} className={long ? "h-4 w-4" : "h-5 w-5"} />
              <span className={cn("number-font whitespace-nowrap font-black tabular-nums leading-tight text-reward", long ? "text-body" : "text-heading")}>
                {it.value}
              </span>
            </div>
            <p className="mt-0.5 break-keep text-micro font-bold leading-tight text-muted-foreground">{it.name}</p>
            {reward.received && (
              <span className="absolute -right-1 -top-1 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-primary ring-2 ring-card">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
              </span>
            )}
          </div>
        ))}
      </div>
      {skill && (
        <p className="mt-2.5 flex min-w-0 items-center gap-1.5 border-t border-reward/25 pt-2.5 text-label" aria-hidden>
          <Icon3d name={skill.label === "다음 단계" ? "trophy" : "sparkles"} className="h-4 w-4" />
          <span className="shrink-0 font-bold text-reward">{skill.label}</span>
          <span className="min-w-0 truncate font-bold text-foreground">{skill.value}</span>
        </p>
      )}
    </div>
  );
};

/** 오늘의 퀘스트 칸 하나 — 아이콘 + 값 (도장은 게이지와 같은 민트 동전) */
const DailyChip = ({ item, done }: { item: DailyQuestItem; done: boolean }) => {
  const gold = item.key === "levelup";
  return (
    <span
      aria-label={`${item.name} ${item.value}`}
      className={cn(
        "flex h-7 items-center gap-1 rounded-full px-2 text-label font-black tabular-nums",
        gold ? "bg-reward/20 text-reward" : done ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
      )}
    >
      {item.key === "stamp" ? (
        <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
        </span>
      ) : (
        <Icon3d name={item.key === "levelup" ? "star" : item.key === "money" ? "money" : "coin"} className="h-4 w-4" />
      )}
      <span className="number-font">{item.value}</span>
    </span>
  );
};

/**
 * 「반복은 천재를 만든다」 띠 + 오늘의 퀘스트 — 153 글러브(입체 아이콘) + 대표님 문구 + 그날 한 줄,
 * 그 아래 흰 칸에 오늘 오면 받는 것(오면 「받았어요」 + 민트 체크). 못 한 날 · 빠진 날은 말하지 않는다.
 */
export const QuestDailyBand = ({ line, quest, celebrate }: { line: string; quest: DailyQuest | null; celebrate: boolean }) => (
  <div className="rounded-2xl bg-muted/70 p-3.5">
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-heading shadow-elev-1">
        🥊
      </span>
      <div className="min-w-0">
        <p className="break-keep text-body font-extrabold leading-snug text-foreground">{CHEER_HEADLINE}</p>
        <p className="break-keep text-label text-muted-foreground">{line}</p>
      </div>
    </div>
    {quest && (
      <div className="mt-3 rounded-xl bg-card px-3 pb-2.5 pt-2 shadow-elev-1" role="group" aria-label={`${quest.title} — ${quest.note}`}>
        {/* 제목과 한마디가 한 줄에 안 들어가면(좁은 폰 · 큰 글씨) 한마디가 아랫줄 오른쪽으로 — 잘리지 않게 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            aria-hidden
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              quest.done ? "bg-primary" : "border-2 border-dashed border-primary/60",
              quest.done && celebrate && "motion-safe:animate-quest-pop",
            )}
            style={quest.done && celebrate ? { animationDelay: "1.3s" } : undefined}
          >
            {quest.done && <Check className="h-4 w-4 text-white" strokeWidth={3.6} />}
          </span>
          <p className="min-w-0 break-keep text-label font-bold text-foreground">{quest.title}</p>
          <span className={cn("ml-auto shrink-0 text-micro font-bold", quest.done ? "text-primary" : "text-muted-foreground")}>{quest.note}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quest.items.map((it) => (
            <DailyChip key={it.key} item={it} done={quest.done} />
          ))}
        </div>
      </div>
    )}
  </div>
);

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
