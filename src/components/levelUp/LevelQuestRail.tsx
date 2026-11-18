/**
 * 🎯 홈 「다음 레벨까지」 — 수업 도장 길 (2026-11-18 대표님 「1일차 수업 2일차 수업 3일차 수업 … 레벨업 하는재미」)
 *
 *   [지금 레벨 방패] ── (10일차 ✓) ── (11일차 · 다음 수업) ┄┄ (12일차) ┄┄ [다음 레벨 금색 🎁]
 *
 *   · 도장 칸 = 이번 레벨에 필요한 출석 (서버 reqSessions) · 칸 이름 = 153 수업 일차 (lib/levelQuest.ts)
 *   · 오늘 왔으면 마지막 칸에 「오늘 수업」 + 도장 찍히는 움직임(이 기기에서 하루 한 번) · 아직이면 다음 칸에 「다음 수업」이 숨 쉰다
 *   · 운동 종료 보너스로 다음 칸이 조금 찼으면 다음 칸 테두리에 그만큼 민트 호
 *   · 칸이 많은 리그(블루 5 · 레드 8)는 일차 이름을 지금 칸에만, 레드부터는 작은 칸 · 블랙 20칸은 두 줄
 *   · 레벨 10(화이트 · 블루 — 도착하면 타이틀매치)은 도장 대신 리그 길: 레벨 1~9 지나온 칸 + 타이틀매치 칸
 * 칸은 크기를 지키고 사이 길만 늘었다 줄었다(flex) — 좁은 폰 · 큰 글씨에서도 동그라미가 찌그러지지 않게.
 * 색: 민트 = 해낸 것 · 금색 = 목표 · 보상 (153 브랜드 — 넓은 민트 바탕 · 네온 없이). 움직임은 '움직임 줄이기' 설정이면 멈춘다.
 */
import { Check } from "lucide-react";
import LeagueBadge from "@/components/badges/LeagueBadge";
import type { QuestStamp } from "@/lib/levelQuest";
import { cn } from "@/lib/utils";

interface StampRailProps {
  /** 지금 리그 — 시작 방패 색 */
  league: string;
  /** "레벨 4" — 시작 칸 이름 */
  startLabel: string;
  stamps: readonly QuestStamp[];
  /** 목표 칸 안 숫자 — 다음 누적 레벨(5) · 다음 리그로 가는 칸이면 null(트로피) */
  goalNumber: number | null;
  /** 목표 칸 이름 — "레벨업" · "블랙 리그" */
  goalLabel: string;
  /** 도장을 다 모았다 — 목표 칸이 살짝 뛴다 */
  goalReady: boolean;
  /** 다음 칸이 「다음 수업」으로 숨 쉰다 (오늘 아직 안 왔을 때) */
  invite: boolean;
  /** 오늘 칸에 도장 찍히는 움직임 (이 기기에서 하루 한 번) */
  stampIn: boolean;
}

/** 다음 칸 테두리의 보너스 호 — 0 ~ 1 */
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

/** 칸 크기 — 칸 수에 따라 (셋 = 큰 칸 · 다섯 = 중간 · 여덟 이상 = 작은 칸). 끝 칸(방패 · 목표)은 한 단계 크게 */
type Tier = "lg" | "md" | "sm";
const tierOf = (n: number): Tier => (n <= 3 ? "lg" : n <= 5 ? "md" : "sm");
const STAMP: Record<Tier, { box: string; check: string; dot: string }> = {
  lg: { box: "h-10 w-10", check: "h-5 w-5", dot: "h-2.5 w-2.5" },
  md: { box: "h-8 w-8", check: "h-4 w-4", dot: "h-2 w-2" },
  sm: { box: "h-5 w-5", check: "h-3 w-3", dot: "h-1.5 w-1.5" },
};
const END: Record<Tier, { box: string; px: number }> = {
  lg: { box: "h-11 w-11", px: 44 },
  md: { box: "h-10 w-10", px: 40 },
  sm: { box: "h-9 w-9", px: 36 },
};

const StampNode = ({ stamp, tier, invite, stampIn }: { stamp: QuestStamp; tier: Tier; invite: boolean; stampIn: boolean }) => {
  const t = STAMP[tier];
  if (stamp.state === "done" || stamp.state === "today") {
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
          t.box,
          stamp.state === "today" && (tier === "sm" ? "ring-2 ring-primary/25" : "ring-4 ring-primary/20"),
          stamp.state === "today" && stampIn && "motion-safe:animate-quest-stamp",
        )}
      >
        <Check className={t.check} strokeWidth={3.2} aria-hidden />
      </span>
    );
  }
  if (stamp.state === "next") {
    return (
      <span className={cn("relative flex shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-card", t.box)}>
        {invite && <span aria-hidden className="absolute -inset-1 rounded-full border-2 border-primary motion-safe:animate-quest-halo" />}
        {tier !== "sm" && stamp.partial >= 0.05 && <PartialArc value={stamp.partial} />}
        <span aria-hidden className={cn("rounded-full bg-primary", t.dot)} />
      </span>
    );
  }
  return <span className={cn("shrink-0 rounded-full border-2 border-dashed border-border bg-card", t.box)} aria-hidden />;
};

const stampAria = (s: QuestStamp) =>
  `${s.day}일차 수업 · ${
    s.state === "today"
      ? "오늘 완료"
      : s.state === "done"
        ? "완료"
        : s.state === "next"
          ? `다음 수업${s.partial >= 0.05 ? ` · 운동 보너스로 ${Math.round(s.partial * 100)}% 찼어요` : ""}`
          : "남은 수업"
  }`;

/** 칸 사이 길 — 해낸 길은 민트, 남은 길은 점선 (칸 가운데 높이에 · top = 칸 높이의 절반, rem) */
const Link = ({ done, top }: { done: boolean; top: number }) =>
  done ? (
    <span aria-hidden className="h-[3px] min-w-[2px] flex-1 bg-primary" style={{ marginTop: `calc(${top}rem - 1.5px)` }} />
  ) : (
    <span aria-hidden className="h-0 min-w-[2px] flex-1 border-t-2 border-dashed border-border" style={{ marginTop: `calc(${top}rem - 1px)` }} />
  );

/** 칸 위 이름표(오늘 수업 · 다음 수업 · 지금) — 칸 크기를 밀지 않게 띄워 둔다 */
const Tag = ({ children, tone }: { children: string; tone: "solid" | "soft" | "gold" }) => (
  <span
    className={cn(
      "absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-bold",
      tone === "solid" ? "bg-primary text-primary-foreground" : tone === "soft" ? "bg-primary/15 text-primary" : "bg-reward/20 text-reward",
    )}
  >
    {children}
  </span>
);

/** 칸 아래 이름 (일차 · 레벨) — 띄워 둔다 */
const Caption = ({ children, className }: { children: string; className?: string }) => (
  <span aria-hidden className={cn("absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-micro tabular-nums", className)}>
    {children}
  </span>
);

/** 이번 레벨 수업 도장 길 */
export const QuestStampRail = ({ league, startLabel, stamps, goalNumber, goalLabel, goalReady, invite, stampIn }: StampRailProps) => {
  const n = stamps.length;
  // 칸이 아주 많으면(블랙 20) 방패 · 목표 칸 없이 두 줄
  if (n > 10) return <QuestStampGrid stamps={stamps} goalLabel={goalLabel} invite={invite} stampIn={stampIn} />;

  const tier = tierOf(n);
  // 모든 칸을 끝 칸(방패 · 목표) 높이에 맞춘다 — 길이 칸 가운데를 지나게 (rem 이라 글씨 '크게'에서도 같은 비율)
  const endSize = END[tier].box;
  const boxH = END[tier].px / 16;
  const center = boxH / 2;
  const focus = stamps.findIndex((s) => s.state === "today");
  const focusIdx = focus >= 0 ? focus : stamps.findIndex((s) => s.state === "next");
  // 일차 이름 — 칸이 셋 이하면 모두, 많으면 지금 칸(오늘 · 다음)에만
  const showCaption = (k: number) => n <= 3 || k === focusIdx;
  const filled = (s: QuestStamp) => s.state === "done" || s.state === "today";

  return (
    <ol className="mt-3 flex items-start pb-6 pt-7" aria-label={`${goalLabel}까지 수업 도장`}>
      {/* 지금 레벨 */}
      <li className="relative flex shrink-0 flex-col items-center" aria-label={`지금 ${startLabel}`}>
        <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
          <LeagueBadge league={league} className={cn(endSize, "drop-shadow-sm")} animated={false} />
        </span>
        <Caption className="font-bold text-muted-foreground">{startLabel}</Caption>
      </li>

      {stamps.map((s, k) => (
        <li key={s.day} className="flex min-w-0 flex-1 items-start" aria-label={stampAria(s)}>
          <Link done={filled(s)} top={center} />
          <span className="relative flex shrink-0 flex-col items-center">
            {k === focusIdx && <Tag tone={s.state === "today" ? "solid" : "soft"}>{s.state === "today" ? "오늘 수업" : "다음 수업"}</Tag>}
            <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
              <StampNode stamp={s} tier={tier} invite={invite} stampIn={stampIn} />
            </span>
            {showCaption(k) && (
              <Caption className={s.state === "todo" ? "text-muted-foreground" : s.state === "next" ? "font-bold text-primary" : "font-bold text-foreground"}>
                {`${s.day}일차`}
              </Caption>
            )}
          </span>
        </li>
      ))}

      {/* 목표 — 다음 레벨 (금색 · 보상 표시) */}
      <li className="flex min-w-0 flex-1 items-start" aria-label={`목표 ${goalLabel}`}>
        <Link done={false} top={center} />
        <span className="relative flex shrink-0 flex-col items-center">
          <span
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full bg-reward text-reward-foreground shadow-elev-2",
              endSize,
              goalReady && "motion-safe:animate-quest-bob",
            )}
          >
            {goalNumber != null ? (
              <span className={cn("number-font font-black tabular-nums leading-none", tier === "sm" ? "text-label" : "text-body")}>{goalNumber}</span>
            ) : (
              <span className={tier === "sm" ? "text-label" : "text-body"}>🏆</span>
            )}
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card text-micro shadow-elev-1 ring-1 ring-reward/40">
              🎁
            </span>
          </span>
          <Caption className="font-bold text-reward">{goalLabel}</Caption>
        </span>
      </li>
    </ol>
  );
};

/** 칸이 아주 많은 레벨(블랙 20) — 작은 도장 두 줄 + 지금 칸 이름 한 줄 */
const QuestStampGrid = ({ stamps, goalLabel, invite, stampIn }: { stamps: readonly QuestStamp[]; goalLabel: string; invite: boolean; stampIn: boolean }) => {
  const focus = stamps.find((s) => s.state === "today") ?? stamps.find((s) => s.state === "next");
  return (
    <div className="mt-4">
      <ol className="grid grid-cols-10 gap-y-2.5" aria-label={`${goalLabel}까지 수업 도장`}>
        {stamps.map((s) => (
          <li key={s.day} className="flex justify-center" aria-label={stampAria(s)}>
            <StampNode stamp={s} tier="sm" invite={invite} stampIn={stampIn} />
          </li>
        ))}
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

/** 레벨 10 — 리그 길: 레벨 1~9 지나온 칸 + 지금 있는 타이틀매치 칸 */
export const QuestLeagueRoad = ({ road }: LeagueRoadProps) => {
  const first = road[0]?.level ?? 1;
  const boxH = 2.75; // rem — 타이틀매치 칸(h-11) 높이
  return (
    <ol className="mt-3 flex items-start pb-6 pt-7" aria-label="리그 길">
      {road.map((r, i) => (
        <li
          key={r.level}
          className={cn("flex items-start", i > 0 && "min-w-0 flex-1")}
          aria-label={r.state === "goal" ? `레벨 ${r.level} 타이틀매치 · 지금` : `레벨 ${r.level} 지나옴`}
        >
          {i > 0 && <Link done={r.state === "done"} top={boxH / 2} />}
          <span className="relative flex shrink-0 flex-col items-center">
            {r.state === "goal" && <Tag tone="gold">지금</Tag>}
            <span className="flex items-center justify-center" style={{ height: `${boxH}rem` }}>
              {r.state === "goal" ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-reward text-body shadow-elev-2">🏆</span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3.4} aria-hidden />
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
