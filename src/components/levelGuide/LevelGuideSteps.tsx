/**
 * 레벨업 안내 — 화면 5장의 속 (2026-11-27 · 글 · 숫자는 lib/levelGuide.ts)
 *   그림은 홈 「다음 레벨까지」 카드의 부품을 그대로 쓴다 — 안내에서 본 모양이 홈에서 그대로 보이게
 *   (QuestStampRail = 일차 칸 · QuestRewardBox = 보상 상자 · LeagueBadge = 리그 방패 · 153 입체 아이콘).
 *   색: 민트 = 해낸 것 · 금색 = 보상 · 바탕은 흰 카드 (넓은 민트 바탕 · 네온 없이).
 */
import { useEffect, useRef, type RefObject } from "react";
import LeagueBadge from "@/components/badges/LeagueBadge";
import { QuestRewardBox } from "@/components/levelUp/LevelQuestParts";
import { QuestStampRail } from "@/components/levelUp/LevelQuestRail";
import { icon3dSrc } from "@/lib/emoji3d/map";
import type { LeagueRule } from "@/lib/journeyMath";
import {
  DAILY_PERK_LABEL,
  DEMO_DAYS,
  GUIDE_COPY,
  dailyPerkItems,
  dailyPerkLine,
  demoDays,
  demoReward,
  guideLeagues,
  guidePerks,
  leagueRowNote,
  levelUpReward,
} from "@/lib/levelGuide";
import { CHEER_HEADLINE, LEAGUE_ORDER } from "@/lib/levelQuest";
import { RANK_LABELS } from "@/data/sharedConstants";
import type { MileageRules } from "@/services/mileageService";
import { cn } from "@/lib/utils";

const Icon3d = ({ name, className }: { name: string; className?: string }) => (
  <img src={icon3dSrc(name)} alt="" aria-hidden draggable={false} className={cn("shrink-0 select-none", className)} />
);

const Title = ({ children }: { children: string }) => <h2 className="break-keep text-title text-foreground">{children}</h2>;
const Body = ({ children }: { children: string }) => <p className="mt-2 break-keep text-body text-muted-foreground">{children}</p>;

/** 1장 — 화이트 → 블루 → 레드 → 블랙 → 마스터 (40레벨 길) */
const LeagueRoad = () => (
  <ol className="relative mt-6 grid grid-cols-5" aria-label="화이트 리그 레벨 1부터 블랙 리그 레벨 40, 그다음 마스터">
    <span aria-hidden className="absolute left-[10%] right-[10%] top-6 h-1 -translate-y-1/2 rounded-full bg-muted" />
    {LEAGUE_ORDER.map((lg, i) => (
      <li key={lg} className="relative flex flex-col items-center">
        <span className="flex h-12 items-center">
          <LeagueBadge league={lg} className="h-11 w-11 drop-shadow-sm" animated={false} />
        </span>
        <span className="mt-1 text-label font-bold text-foreground">{RANK_LABELS[lg]}</span>
        <span className="number-font text-micro tabular-nums text-muted-foreground">
          {i * 10 + 1}~{i * 10 + 10}
        </span>
      </li>
    ))}
    <li className="relative flex flex-col items-center">
      <span className="flex h-12 items-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-reward/15 ring-2 ring-reward/40">
          <Icon3d name="crown" className="h-7 w-7" />
        </span>
      </span>
      <span className="mt-1 text-label font-bold text-reward">마스터</span>
      <span className="number-font text-micro tabular-nums text-muted-foreground">40 이후</span>
    </li>
  </ol>
);

export const StepWhy = ({ name }: { name: string | null }) => (
  <div>
    <p className="text-label font-bold text-primary">{GUIDE_COPY.why.kicker(name)}</p>
    <div className="mt-1">
      <Title>{GUIDE_COPY.why.title}</Title>
    </div>
    <Body>{GUIDE_COPY.why.body}</Body>
    <LeagueRoad />
    <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted/70 p-3.5">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-elev-1">
        <Icon3d name="glove_red" className="h-7 w-7" />
      </span>
      <p className="break-keep text-heading text-foreground">{CHEER_HEADLINE}</p>
    </div>
  </div>
);

/** 3일차에 닿으면 꽃가루 한 번 — 안내 창(z 118) 위에 보이게 · '움직임 줄이기'면 안 터진다 */
function useDemoBurst(active: boolean, anchor: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void import("canvas-confetti")
        .then(({ default: confetti }) => {
          if (cancelled) return;
          const r = anchor.current?.getBoundingClientRect();
          const x = r ? (r.left + r.width * 0.85) / Math.max(1, window.innerWidth) : 0.7;
          const y = r ? (r.top + r.height / 2) / Math.max(1, window.innerHeight) : 0.4;
          confetti({
            particleCount: 70,
            spread: 80,
            startVelocity: 32,
            gravity: 0.9,
            ticks: 150,
            scalar: 0.9,
            zIndex: 200,
            origin: { x: Math.min(0.95, Math.max(0.05, x)), y: Math.min(0.9, Math.max(0.05, y)) },
            colors: ["#F6C453", "#FFD978", "#29C39C", "#FFFFFF"],
            disableForReducedMotion: true,
          });
        })
        .catch(() => undefined);
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [active, anchor]);
}

/** 2장 — 직접 눌러 보는 연습: 1일차 → 2일차 → 3일차 = 레벨 2 (홈 카드와 같은 일차 칸) */
export const StepDays = ({ done, mileage }: { done: number; mileage: MileageRules | null | undefined }) => {
  const ready = done >= DEMO_DAYS;
  const railRef = useRef<HTMLDivElement>(null);
  useDemoBurst(ready, railRef);
  return (
    <div>
      <Title>{GUIDE_COPY.days.title}</Title>
      <Body>{GUIDE_COPY.days.body}</Body>
      <div ref={railRef} className="mt-3 rounded-2xl border border-border bg-card px-4 shadow-elev-1">
        <QuestStampRail
          key={done}
          league="white"
          startLabel="레벨 1"
          stamps={demoDays(done)}
          goalKind="level"
          goalLabel="레벨 2"
          lastTag={{ tag: "레벨업", aria: "레벨업하는 날" }}
          near={done === DEMO_DAYS - 1}
          ready={ready}
          invite={!ready}
          celebrate={done > 0}
        />
      </div>
      {ready && (
        <div className="motion-safe:animate-quest-pop">
          <p className="mt-4 text-title text-reward" role="status">
            {GUIDE_COPY.days.reached}
          </p>
          <QuestRewardBox reward={demoReward(mileage)} skill={null} celebrate />
        </div>
      )}
      <p className="mt-3 break-keep text-micro text-muted-foreground">{GUIDE_COPY.days.note}</p>
    </div>
  );
};

/** 3장 — 리그마다 레벨업까지 필요한 날 (서버 규칙) · 타이틀매치 · 운동 종료 팁 */
export const StepLeagues = ({ rules }: { rules: readonly LeagueRule[] | null | undefined }) => {
  const rows = guideLeagues(rules);
  return (
    <div>
      <Title>{GUIDE_COPY.leagues.title}</Title>
      <Body>{GUIDE_COPY.leagues.body}</Body>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        {rows.map((r) => (
          <li key={r.league} className="flex items-center gap-3 px-3.5 py-2.5">
            <LeagueBadge league={r.league} className="h-8 w-8 shrink-0" animated={false} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-bold text-foreground">{r.name}</p>
              <p className="break-keep text-micro text-muted-foreground">
                {r.range} · {leagueRowNote(r)}
              </p>
            </div>
            <p className="shrink-0 text-right" aria-label={`레벨마다 트레이닝 ${r.days}일`}>
              <span className="number-font block text-heading tabular-nums text-primary">{r.days}일</span>
              <span className="block text-micro text-muted-foreground">트레이닝</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-3 rounded-2xl border border-reward/35 bg-reward/[0.08] p-3.5">
        <Icon3d name="trophy" className="mt-0.5 h-8 w-8" />
        <div className="min-w-0">
          <p className="break-keep text-body font-bold text-foreground">{GUIDE_COPY.leagues.titleMatch}</p>
          <p className="mt-0.5 break-keep text-label text-muted-foreground">{GUIDE_COPY.leagues.titleMatchBody}</p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-muted/70 p-3.5">
        <Icon3d name="stopwatch" className="h-7 w-7" />
        <p className="break-keep text-label text-foreground">{GUIDE_COPY.leagues.tip}</p>
      </div>
    </div>
  );
};

/** 4장 — 레벨업 보상 상자(홈과 같은 셈) · 어디에 쓰는지 · 날마다 쌓이는 것 */
export const StepRewards = ({ mileage }: { mileage: MileageRules | null | undefined }) => (
  <div>
    <Title>{GUIDE_COPY.rewards.title}</Title>
    <QuestRewardBox reward={levelUpReward(mileage)} skill={null} celebrate={false} />
    <ul className="mt-4 space-y-3">
      {guidePerks(mileage).map((p) => (
        <li key={p.name} className="flex items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon3d name={p.icon} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-body font-bold text-foreground">{p.name}</p>
            <p className="break-keep text-label text-muted-foreground">{p.text}</p>
          </div>
        </li>
      ))}
    </ul>
    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-primary/[0.07] px-3.5 py-2.5" aria-label={dailyPerkLine(mileage)}>
      <p aria-hidden className="mr-1 text-label font-bold text-foreground">
        {DAILY_PERK_LABEL}
      </p>
      {dailyPerkItems(mileage).map((it) => (
        <span key={it.name} aria-hidden className="flex h-7 items-center gap-1 rounded-full bg-card px-2.5 text-label font-black tabular-nums text-foreground shadow-elev-1">
          <Icon3d name={it.icon} className="h-4 w-4" />
          <span className="number-font">{it.value}</span>
          <span className="text-micro font-bold text-muted-foreground">{it.name}</span>
        </span>
      ))}
    </div>
  </div>
);

/** 5장 — 내 일차는 홈 카드에 · 알림 켜기(레벨업 소식) */
export const StepStart = ({ showPush, pushReward }: { showPush: boolean; pushReward: string | null }) => (
  <div className="flex min-h-[26rem] flex-col items-center justify-center pb-6 text-center">
    <span aria-hidden className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/70">
      <Icon3d name="glove_red" className="h-16 w-16" />
    </span>
    <div className="mt-4">
      <Title>{GUIDE_COPY.start.title}</Title>
    </div>
    <Body>{GUIDE_COPY.start.body}</Body>
    {showPush && (
      <div className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-elev-1">
        <Icon3d name="bell" className="h-9 w-9" />
        <div className="min-w-0">
          <p className="break-keep text-body font-bold text-foreground">{GUIDE_COPY.start.pushTitle}</p>
          {pushReward && <p className="mt-0.5 text-label font-semibold text-primary">켜면 {pushReward}</p>}
        </div>
      </div>
    )}
  </div>
);
