/**
 * 🎯 홈 「다음 레벨까지」 — 수업 도장 게이지
 * (v1 2026-11-18 대표님 「1일차 수업 2일차 수업 3일차 수업 … 레벨업 하는재미」 ·
 *  v2 같은 날 「심리적으로 채우고싶은 느낌이 나고 게임처럼 레벨업 하고싶은 욕구가 강해질수있는 디자인으로」)
 *
 *   [지금 레벨 방패] ━━ (✓ 10일차) ━━ (✓ 11일차 · 오늘) ━━ (◌ 12일차 · 레벨업) ┅┅ [🎁 레벨 5]
 *
 *   · 칸 사이는 굵은 홈(게이지) — 채운 만큼 민트가 차오른다. 운동 종료 보너스로 미리 찬 몫은 다음 칸 앞 홈에 그만큼
 *   · 채운 칸 = 반짝이는 민트 동전 + 흰 체크 · 빈칸 = 움푹 파인 홈에 흐린 체크 자국 — 채우고 싶게 (미완성 효과)
 *   · 다음 칸 = 점선 테두리 + 숨 쉬는 고리(오늘 아직이면) · 마지막 칸 = 금색 「레벨업」 칸 (목표 기울기 효과)
 *   · 오늘 온 날(이 기기에서 하루 한 번): 홈에 민트가 차오르고 → 도장이 꾹 → 「+1」이 떠오른다
 *   · 목표 = 금색 동전 안 선물 — 1번 남으면 들썩, 다 모으면 둥실 + 금빛 고리 (보상 기대)
 *   · 칸 수는 서버 요건 그대로(화이트 3 · 블루 5 · 레드 8 · 블랙 20) — 많으면 작은 칸 · 일차 이름은 지금 칸에만 · 블랙은 두 줄
 *   · 레벨 10(화이트 · 블루 — 도착하면 타이틀매치)은 도장 대신 리그 길
 * 칸은 크기를 지키고 사이 홈만 늘었다 줄었다(flex) — 좁은 폰 · 큰 글씨에서도 동그라미가 찌그러지지 않게.
 * 색: 민트 = 해낸 것 · 금색 = 목표 · 보상 (153 브랜드 — 넓은 민트 바탕 · 네온 없이). 움직임은 '움직임 줄이기'면 모두 멈춘다.
 */
import { Check } from "lucide-react";
import LeagueBadge from "@/components/badges/LeagueBadge";
import { icon3dSrc } from "@/lib/emoji3d/map";
import type { QuestStamp } from "@/lib/levelQuest";
import { cn } from "@/lib/utils";

interface StampRailProps {
  /** 지금 리그 — 시작 방패 색 */
  league: string;
  /** "레벨 4" — 시작 칸 이름 */
  startLabel: string;
  stamps: readonly QuestStamp[];
  /** 목표 그림 — 다음 레벨 = 선물 · 다음 리그로 가는 칸 = 트로피 */
  goalKind: "level" | "league";
  /** 목표 칸 이름 — "레벨 5" · "블랙 리그" */
  goalLabel: string;
  /** 마지막 칸 — 보이는 이름표("레벨업" · "마지막")와 읽어 주는 이름("레벨업하는 날" · "심사 전 마지막 날" — lastStampLabel) */
  lastTag: { tag: string; aria: string };
  /** 남은 출석 1번 — 선물이 들썩인다 */
  near: boolean;
  /** 도장을 다 모았다 — 마지막 홈까지 차고 선물이 둥실 + 금빛 고리 */
  ready: boolean;
  /** 다음 칸이 숨 쉰다 (오늘 아직 안 왔을 때) */
  invite: boolean;
  /** 오늘 온 날 — 홈이 차오르고 도장이 꾹 · 「+1」 (이 기기에서 하루 한 번) */
  celebrate: boolean;
}

/** 칸 크기 — 칸 수에 따라 (셋 = 큰 칸 · 다섯 = 중간 · 여덟 이상 = 작은 칸). 높이는 rem — 글씨 '크게'에서도 같은 비율 */
type Tier = "lg" | "md" | "sm";
const tierOf = (n: number): Tier => (n <= 3 ? "lg" : n <= 5 ? "md" : "sm");
const SIZE: Record<Tier, { stamp: string; check: string; start: string; goal: string; gift: string; stampRem: number; goalRem: number }> = {
  lg: { stamp: "h-11 w-11", check: "h-6 w-6", start: "h-10 w-10", goal: "h-[3.25rem] w-[3.25rem]", gift: "h-8 w-8", stampRem: 2.75, goalRem: 3.25 },
  md: { stamp: "h-8 w-8", check: "h-[1.1rem] w-[1.1rem]", start: "h-9 w-9", goal: "h-11 w-11", gift: "h-7 w-7", stampRem: 2, goalRem: 2.75 },
  sm: { stamp: "h-5 w-5", check: "h-3 w-3", start: "h-[1.875rem] w-[1.875rem]", goal: "h-10 w-10", gift: "h-6 w-6", stampRem: 1.25, goalRem: 2.5 },
};

/**
 * 칸 하나(홈 + 동그라미)의 자리 — 기본 너비 = 동그라미 크기, 남는 자리는 모든 칸이 똑같이 나눠 홈 길이가 고르다
 * (큰 목표 칸 앞 홈만 짧아지지 않게). 좁은 폰 · 큰 글씨에서는 홈이 0.2rem 까지 줄어든다(칸은 그대로 — 카드 밖으로 넘치지 않게).
 */
const slot = (nodeRem: number) => ({ flex: `1 1 ${nodeRem}rem`, minWidth: `${nodeRem + 0.2}rem` });

/** 동전 윗부분 반짝임 */
const Gloss = () => <span aria-hidden className="pointer-events-none absolute inset-x-[20%] top-[9%] h-[34%] rounded-full bg-white/35" />;

/** 다음 칸 테두리의 보너스 호 (블랙 두 줄 칸에서만 — 줄 칸에는 홈이 없다) */
const PartialArc = ({ value }: { value: number }) => {
  const r = 18.5;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(c * value).toFixed(2)} ${c.toFixed(2)}`}
      />
    </svg>
  );
};

const StampNode = ({
  stamp,
  tier,
  last,
  invite,
  celebrate,
}: {
  stamp: QuestStamp;
  tier: Tier;
  last: boolean;
  invite: boolean;
  celebrate: boolean;
}) => {
  const t = SIZE[tier];
  if (stamp.state === "done" || stamp.state === "today") {
    const today = stamp.state === "today";
    const landing = today && celebrate;
    const coin = (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-primary shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]",
          landing ? "absolute inset-0 motion-safe:animate-quest-stamp" : cn("relative z-10 shrink-0", t.stamp),
          today && (tier === "sm" ? "ring-2 ring-primary/30" : "ring-4 ring-primary/25"),
        )}
      >
        <Gloss />
        <Check className={cn(t.check, "relative text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]")} strokeWidth={3.4} aria-hidden />
      </span>
    );
    if (!landing) return coin;
    return (
      <span className={cn("relative z-10 flex shrink-0", t.stamp)}>
        {/* 도장이 찍히기 전에는 오늘 칸이 빈 홈으로 보인다 — 빈칸이 채워지는 순간을 보여 준다 (움직임 줄이기면 도장에 가려 안 보인다) */}
        <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-card">
          {tier !== "sm" ? (
            <Check className={cn(t.check, "text-primary/30")} strokeWidth={3.4} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </span>
        {coin}
        {/* 오늘 도장 — 「+1」이 떠올랐다 사라진다 (움직임 줄이기면 보이지 않는다) */}
        <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
          <span className="block whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-micro font-black text-primary-foreground opacity-0 shadow-elev-2 motion-safe:animate-quest-float">
            +1
          </span>
        </span>
      </span>
    );
  }
  if (stamp.state === "next") {
    return (
      <span
        className={cn(
          "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 border-dashed",
          last ? "border-reward bg-reward/10" : "border-primary/60 bg-card",
          t.stamp,
        )}
      >
        {invite && (
          <span
            aria-hidden
            className={cn("absolute -inset-1 rounded-full border-2 motion-safe:animate-quest-halo", last ? "border-reward" : "border-primary")}
          />
        )}
        {tier !== "sm" ? (
          <Check className={cn(t.check, last ? "text-reward/45" : "text-primary/30")} strokeWidth={3.4} aria-hidden />
        ) : (
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", last ? "bg-reward" : "bg-primary")} />
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full",
        last ? "border-2 border-dashed border-reward/55 bg-reward/[0.07]" : "bg-muted shadow-[inset_0_2px_3px_rgba(15,23,42,0.10)]",
        t.stamp,
      )}
    >
      {tier !== "sm" && <Check className={cn(t.check, last ? "text-reward/30" : "text-muted-foreground/20")} strokeWidth={3.4} />}
    </span>
  );
};

const stampAria = (s: QuestStamp, lastAria: string | null) =>
  `${s.day}일차 수업 · ${
    s.state === "today"
      ? "오늘 완료"
      : s.state === "done"
        ? "완료"
        : s.state === "next"
          ? `다음 수업${s.partial >= 0.05 ? ` · 운동 보너스로 ${Math.round(s.partial * 100)}% 찼어요` : ""}`
          : "남은 수업"
  }${lastAria ? ` · ${lastAria}` : ""}`;

/**
 * 칸 사이 홈 — 움푹 파인 길에 채운 만큼 민트가 찬다 (0 ~ 1). 양 끝은 옆 칸 밑으로 조금 들어가 한 줄로 이어 보인다.
 * top = 칸 가운데 높이(rem) · fill 이 움직이면(오늘 온 날) 왼쪽부터 차오른다.
 */
const Groove = ({ fill, top, animate }: { fill: number; top: number; animate?: boolean }) => (
  <span
    aria-hidden
    className="relative z-0 -mx-1 h-2.5 min-w-[0.7rem] flex-1 overflow-hidden rounded-full bg-muted shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]"
    style={{ marginTop: `calc(${top}rem - 5px)` }}
  >
    {fill > 0 && (
      <span
        className={cn("absolute inset-y-0 left-0 origin-left rounded-full bg-primary", animate && "motion-safe:animate-quest-fill")}
        style={{ width: `${Math.round(Math.min(1, fill) * 100)}%` }}
      >
        <span className="absolute inset-x-1 top-[2px] h-[2px] rounded-full bg-white/40" />
      </span>
    )}
  </span>
);

/**
 * 칸 위 이름표(오늘 · 다음 수업 · 레벨업 · 지금) — 칸 크기를 밀지 않게 띄워 둔다.
 * 오늘 온 날은 「+1」이 떠올랐다 사라진 뒤에 「오늘」이 톡 (바깥 칸은 가운데 맞춤만 · 안 칸이 움직인다)
 */
const Tag = ({ children, tone, pop }: { children: string; tone: "solid" | "soft" | "gold"; pop?: boolean }) => (
  <span className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2">
    <span
      className={cn(
        "block whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-bold",
        tone === "solid" ? "bg-primary text-primary-foreground" : tone === "soft" ? "bg-primary/15 text-primary" : "bg-reward text-reward-foreground",
        pop && "motion-safe:animate-quest-pop",
      )}
      style={pop ? { animationDelay: "2.35s" } : undefined}
    >
      {children}
    </span>
  </span>
);

/** 칸 아래 이름 (일차 · 레벨) — 띄워 둔다 */
const Caption = ({ children, className }: { children: string; className?: string }) => (
  <span aria-hidden className={cn("absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-micro tabular-nums", className)}>
    {children}
  </span>
);

/** 목표 칸 — 금색 동전 안 선물(다음 레벨) · 트로피(다음 리그) */
const GoalNode = ({ kind, tier, near, ready }: { kind: "level" | "league"; tier: Tier; near: boolean; ready: boolean }) => {
  const t = SIZE[tier];
  return (
    <span
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full bg-reward shadow-elev-2 ring-[3px] ring-card",
        t.goal,
        ready ? "motion-safe:animate-quest-bob" : near && "motion-safe:animate-quest-wiggle",
      )}
    >
      <Gloss />
      {ready && <span aria-hidden className="absolute -inset-2 rounded-full border-2 border-reward motion-safe:animate-quest-halo" />}
      <img src={icon3dSrc(kind === "league" ? "trophy" : "gift")} alt="" draggable={false} className={cn("relative select-none", t.gift)} />
    </span>
  );
};

/** 이번 레벨 수업 도장 게이지 */
export const QuestStampRail = ({ league, startLabel, stamps, goalKind, goalLabel, lastTag, near, ready, invite, celebrate }: StampRailProps) => {
  const n = stamps.length;
  // 칸이 아주 많으면(블랙 20) 방패 · 목표 칸 없이 두 줄
  if (n > 10) return <QuestStampGrid stamps={stamps} goalLabel={goalLabel} lastTag={lastTag} invite={invite} celebrate={celebrate} />;

  const tier = tierOf(n);
  const t = SIZE[tier];
  // 모든 칸을 목표 칸 높이에 맞춘다 — 홈이 칸 가운데를 지나게
  const boxH = t.goalRem;
  const center = boxH / 2;
  const todayIdx = stamps.findIndex((s) => s.state === "today");
  const nextIdx = stamps.findIndex((s) => s.state === "next");
  const filled = (s: QuestStamp) => s.state === "done" || s.state === "today";
  // 이름표 — 칸이 셋이면 오늘 · 마지막(레벨업)을 함께, 많으면 하나만(오늘 → 다음 칸)
  const tagOf = (k: number): { text: string; tone: "solid" | "soft" | "gold"; pop?: boolean } | null => {
    const s = stamps[k];
    const isLast = k === n - 1;
    if (k === todayIdx) return { text: "오늘", tone: "solid", pop: celebrate };
    if (k !== nextIdx) return null;
    if (todayIdx >= 0 && n > 3) return null;
    if (isLast) return { text: lastTag.tag, tone: "gold" };
    if (todayIdx >= 0) return null;
    return s.state === "next" ? { text: "다음 수업", tone: "soft" } : null;
  };
  // 일차 이름 — 칸이 셋 이하면 모두, 많으면 지금 칸(오늘 · 다음)에만
  const focusIdx = todayIdx >= 0 ? todayIdx : nextIdx;
  const showCaption = (k: number) => n <= 3 || k === focusIdx;

  return (
    <ol className="mt-3 flex items-start pb-6 pt-8" aria-label={`${goalLabel}까지 트레이닝 일차`}>
      {/* 지금 레벨 */}
      <li className="relative z-10 flex shrink-0 flex-col items-center" aria-label={`지금 ${startLabel}`}>
        <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
          <LeagueBadge league={league} className={cn(t.start, "drop-shadow-sm")} animated={false} />
        </span>
        <Caption className="font-bold text-muted-foreground">{startLabel}</Caption>
      </li>

      {stamps.map((s, k) => {
        const isLast = k === n - 1;
        const tag = tagOf(k);
        // 이 칸 앞 홈 — 채운 칸이면 가득 · 다음 칸이면 운동 보너스 몫만큼
        const fill = filled(s) ? 1 : s.state === "next" ? s.partial : 0;
        return (
          <li
            key={s.day}
            className="flex items-start"
            style={slot(t.stampRem)}
            aria-label={stampAria(s, isLast && !filled(s) ? lastTag.aria : null)}
          >
            <Groove fill={fill} top={center} animate={celebrate && s.state === "today"} />
            <span className="relative z-10 flex shrink-0 flex-col items-center">
              {tag && (
                <Tag tone={tag.tone} pop={tag.pop}>
                  {tag.text}
                </Tag>
              )}
              <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
                <StampNode stamp={s} tier={tier} last={isLast} invite={invite} celebrate={celebrate} />
              </span>
              {showCaption(k) && (
                <Caption
                  className={
                    filled(s)
                      ? "font-bold text-foreground"
                      : isLast
                        ? "font-bold text-reward"
                        : s.state === "next"
                          ? "font-bold text-primary"
                          : "text-muted-foreground"
                  }
                >
                  {`${s.day}일차`}
                </Caption>
              )}
            </span>
          </li>
        );
      })}

      {/* 목표 — 다음 레벨(선물) · 다음 리그(트로피) */}
      <li className="flex items-start" style={slot(t.goalRem)} aria-label={`목표 ${goalLabel}`}>
        <Groove fill={ready ? 1 : 0} top={center} />
        <span className="relative z-10 flex shrink-0 flex-col items-center">
          <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
            <GoalNode kind={goalKind} tier={tier} near={near} ready={ready} />
          </span>
          <Caption className="font-bold text-reward">{goalLabel}</Caption>
        </span>
      </li>
    </ol>
  );
};

/** 칸이 아주 많은 레벨(블랙 20) — 작은 도장 두 줄 + 지금 칸 이름 한 줄 */
const QuestStampGrid = ({
  stamps,
  goalLabel,
  lastTag,
  invite,
  celebrate,
}: {
  stamps: readonly QuestStamp[];
  goalLabel: string;
  lastTag: { tag: string; aria: string };
  invite: boolean;
  celebrate: boolean;
}) => {
  const focus = stamps.find((s) => s.state === "today") ?? stamps.find((s) => s.state === "next");
  const n = stamps.length;
  return (
    <div className="mt-4">
      <ol className="grid grid-cols-10 gap-y-2.5" aria-label={`${goalLabel}까지 트레이닝 일차`}>
        {stamps.map((s, k) => {
          const isLast = k === n - 1;
          const isFilled = s.state === "done" || s.state === "today";
          return (
            <li key={s.day} className="relative flex justify-center" aria-label={stampAria(s, isLast && !isFilled ? lastTag.aria : null)}>
              <span className="relative">
                <StampNode stamp={s} tier="sm" last={isLast} invite={invite} celebrate={celebrate} />
                {s.state === "next" && s.partial >= 0.05 && <PartialArc value={s.partial} />}
              </span>
            </li>
          );
        })}
      </ol>
      {focus && (
        <p className="mt-2.5 text-center text-label font-bold text-primary">
          {focus.state === "today" ? "오늘 수업" : "다음 수업"} · {focus.day}일차
        </p>
      )}
    </div>
  );
};

interface LeagueRoadProps {
  /** 이 리그 레벨 1~10 (누적 레벨) */
  road: readonly { level: number; state: "done" | "goal" }[];
}

/** 레벨 10 — 리그 길: 레벨 1~9 지나온 칸(가득 찬 홈) + 지금 있는 타이틀매치 칸 */
export const QuestLeagueRoad = ({ road }: LeagueRoadProps) => {
  const first = road[0]?.level ?? 1;
  const boxH = 2.75; // rem — 타이틀매치 칸 높이 (지나온 칸 9개 + 타이틀매치가 360px 폰 · 큰 글씨에서도 한 줄에)
  return (
    <ol className="mt-3 flex items-start pb-6 pt-8" aria-label="리그 길">
      {road.map((r, i) => (
        <li
          key={r.level}
          className="flex items-start"
          style={i > 0 ? slot(r.state === "goal" ? 2.75 : 1.125) : undefined}
          aria-label={r.state === "goal" ? `레벨 ${r.level} 타이틀매치 · 지금` : `레벨 ${r.level} 지나옴`}
        >
          {i > 0 && <Groove fill={1} top={boxH / 2} />}
          <span className="relative z-10 flex shrink-0 flex-col items-center">
            {r.state === "goal" && <Tag tone="gold">지금</Tag>}
            <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
              {r.state === "goal" ? (
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-reward shadow-elev-2 ring-[3px] ring-card">
                  <Gloss />
                  <img src={icon3dSrc("trophy")} alt="" draggable={false} className="relative h-7 w-7 select-none" />
                </span>
              ) : (
                <span className="relative flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.8} aria-hidden />
                </span>
              )}
            </span>
            {i === 0 && (
              <span aria-hidden className="absolute left-0 top-full mt-1.5 whitespace-nowrap text-micro font-bold text-muted-foreground">
                {`레벨 ${first}`}
              </span>
            )}
            {r.state === "goal" && (
              <span aria-hidden className="absolute right-0 top-full mt-1.5 whitespace-nowrap text-micro font-bold text-reward">
                타이틀매치
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
};
