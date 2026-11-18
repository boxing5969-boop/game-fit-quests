/**
 * 라이브보드 TV 2번 「마이복서153 가치 전달」 — 장면 오른쪽 그림 틀 (2026-11-18)
 *   장면마다 다른 틀(큰 숫자 · 리그 길 · 칸 · 사다리 · 달력 · 요일과 알림 · 모집 카드 · 두 카드 · 가격 비교) — 대표님 「같은 템플릿만 쓰지 말고」.
 *   글자는 28px 이상 · 움직임 없음(나타날 때 페이드는 장면 쪽에서) · 예시 숫자에는 「예시」 표시.
 *   칸 높이: 아래 띠 5줄인 날(1920×1080) 그림 칸은 약 250px — level 이 오를수록 간격을 줄이고, 3 이면 서버 숫자 칸(chip)을 뺀다.
 *   글 · 숫자는 모두 src/lib/appValueReel.ts — 이 파일은 그리기만.
 */
import {
  Bell,
  CalendarCheck,
  Check,
  Clock,
  Coins,
  Crown,
  MessageCircle,
  ShoppingBag,
  Star,
  Trophy,
  TrendingUp,
  Umbrella,
  UserRound,
} from "lucide-react";

import type { LeagueId, PulseChip, SceneVisual } from "@/lib/appValueReel";
import { cn } from "@/lib/utils";

/** 0 = 넉넉 · 1 · 2 = 촘촘 · 3 = 서버 숫자 칸까지 뺌 */
export type FitLevel = 0 | 1 | 2 | 3;

const panel = (level: FitLevel) =>
  cn(
    "flex h-full min-h-0 flex-col justify-center rounded-3xl bg-white/[0.04] ring-1 ring-inset ring-white/10",
    level === 0 ? "p-5" : "p-4",
  );

/** 서버 숫자 한 칸 — 한 줄(이름표 + 값) */
const Chip = ({ chip, tone = "mint" }: { chip: PulseChip; tone?: "mint" | "gold" }) => (
  <p
    className={cn(
      "flex flex-wrap items-baseline gap-x-2.5 rounded-2xl px-4 py-1.5 ring-1 ring-inset",
      tone === "gold" ? "bg-yellow-500/10 ring-yellow-400/40" : "bg-primary/10 ring-primary/40",
    )}
  >
    <span className={cn("text-[28px] font-bold leading-snug", tone === "gold" ? "text-yellow-200/90" : "text-primary")}>
      {chip.label}
    </span>
    <span className="text-[30px] font-black leading-snug text-white">{chip.value}</span>
  </p>
);

/** 예시 표시 — 지어낸 숫자가 아니라 화면 모양이라는 것 */
const Sample = () => (
  <span className="shrink-0 rounded-full bg-white/10 px-3 text-[28px] font-bold leading-snug text-gray-300">예시</span>
);

const FLOW_ICON: Record<string, typeof Clock> = {
  출석: CalendarCheck,
  "운동 시간": Clock,
  레벨: TrendingUp,
  마일리지: Coins,
};

const LEAGUE_BAR: Record<LeagueId, string> = {
  white: "bg-[#A9B3B8]",
  blue: "bg-[#2F6FB8]",
  red: "bg-[#C8461F]",
  black: "bg-[#0B0F12] ring-2 ring-yellow-400/80",
};

type CellKind = "none" | "stamp" | "rain" | "star" | "coach" | "promise";
/** 달력 그림 — 날짜 없이 모양만(어느 회원의 달력도 아니다). 4주 · 월요일부터 */
const CAL_CELLS: CellKind[] = [
  "none", "stamp", "none", "stamp", "none", "none", "none",
  "stamp", "none", "rain", "none", "stamp", "none", "none",
  "none", "star", "none", "stamp", "none", "coach", "none",
  "stamp", "none", "promise", "none", "none", "none", "none",
];
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

const CalCell = ({ kind, size }: { kind: CellKind; size: number }) => {
  const box = { width: size, height: size };
  if (kind === "none") return <span className="rounded-xl bg-white/[0.04]" style={box} />;
  if (kind === "promise") return <span className="rounded-full border-[3px] border-dashed border-primary/80" style={box} />;
  if (kind === "star")
    return (
      <span className="flex items-center justify-center rounded-full bg-yellow-400" style={box}>
        <Star className="h-6 w-6 fill-gray-900 text-gray-900" strokeWidth={2.2} />
      </span>
    );
  return (
    <span className="relative flex items-center justify-center rounded-full bg-primary" style={box}>
      {kind === "rain" ? (
        <Umbrella className="h-6 w-6 text-gray-950" strokeWidth={2.6} />
      ) : (
        <Check className="h-6 w-6 text-gray-950" strokeWidth={3.2} />
      )}
      {kind === "coach" && (
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white">
          <MessageCircle className="h-4 w-4 fill-gray-900 text-gray-900" />
        </span>
      )}
    </span>
  );
};

type P<K extends SceneVisual["kind"]> = { v: Extract<SceneVisual, { kind: K }>; level: FitLevel };

const PulseVisual = ({ v, level }: P<"pulse">) => {
  const m = v.hero ? /^([\d,]+)(.*)$/.exec(v.hero) : null;
  if (v.hero && m) {
    return (
      <div className={panel(level)}>
        <p className="text-[28px] font-bold leading-tight text-gray-300">{v.caption}</p>
        <p className="mt-2 flex items-baseline gap-1.5 font-black text-white">
          <span className={cn("tabular-nums tracking-tight", level === 0 ? "text-[88px]" : "text-[76px]", "leading-none")}>
            {m[1]}
          </span>
          <span className="text-[40px] leading-none">{m[2]}</span>
        </p>
        <p className="mt-3 break-keep text-[30px] font-bold leading-snug text-gray-200">{v.heroLabel}</p>
      </div>
    );
  }
  return (
    <div className={cn(panel(level), level === 0 ? "gap-2" : "gap-1.5")}>
      {v.flow.map((f) => {
        const Icon = FLOW_ICON[f] ?? Check;
        return (
          <div key={f} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-1.5">
            <Icon className="h-8 w-8 shrink-0 text-primary" />
            <span className="text-[30px] font-black leading-snug text-white">{f}</span>
          </div>
        );
      })}
    </div>
  );
};

const LeaguesVisual = ({ v, level }: P<"leagues">) => (
  <div className={cn(panel(level), level === 0 ? "gap-3" : "gap-1.5")}>
    {v.leagues.map((l) => (
      <div key={l.id} className="flex items-center gap-3">
        <span className={cn("h-9 w-3 shrink-0 rounded-full", LEAGUE_BAR[l.id])} />
        <span className="w-[88px] shrink-0 text-[30px] font-black leading-tight text-white">{l.name}</span>
        <span className="min-w-0 flex-1 text-[28px] font-bold leading-tight tabular-nums text-gray-300">{l.range}</span>
        {l.id === "black" ? (
          <Crown className="h-8 w-8 shrink-0 text-yellow-300" />
        ) : (
          <Trophy className="h-8 w-8 shrink-0 text-yellow-300/90" />
        )}
      </div>
    ))}
    {v.chip && level < 3 && (
      <div className="mt-1">
        <Chip chip={v.chip} />
      </div>
    )}
  </div>
);

const ShelvesVisual = ({ v, level }: P<"shelves">) => (
  <div className={panel(level)}>
    <div className={cn("grid grid-cols-2", level === 0 ? "gap-2" : "gap-1.5")}>
      {v.shelves.map((s) => (
        <span
          key={s.label}
          className={cn(
            "flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3",
            level === 0 ? "py-1" : level === 1 ? "py-1" : "py-0.5",
          )}
        >
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          <span
            className={cn("truncate text-[28px] font-bold text-white", level === 0 ? "leading-snug" : "leading-tight")}
          >
            {s.label}
          </span>
        </span>
      ))}
    </div>
  </div>
);

const LadderVisual = ({ v, level }: P<"ladder">) => (
  <div
    className={cn(
      "flex h-full min-h-0 flex-col justify-center rounded-3xl bg-gradient-to-b from-yellow-500/15 via-yellow-500/[0.06] to-transparent ring-1 ring-inset ring-yellow-400/35",
      level === 0 ? "gap-2 p-5" : "gap-1 p-4",
    )}
  >
    {v.rows.map((r) => (
      <div key={r.label} className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[30px] font-bold leading-tight text-gray-200">{r.label}</span>
        <span
          className={cn(
            "shrink-0 font-black tabular-nums text-yellow-200",
            r.big ? (level === 0 ? "text-[42px]" : "text-[40px]") : level === 0 ? "text-[36px]" : "text-[32px]",
            "leading-tight",
          )}
        >
          {r.plus}
        </span>
      </div>
    ))}
    {v.chip && level < 3 && (
      <div className="mt-1">
        <Chip chip={v.chip} tone="gold" />
      </div>
    )}
  </div>
);

const CalendarVisual = ({ v, level }: P<"calendar">) => {
  const size = level === 0 ? 46 : 40;
  return (
    <div className={cn(panel(level), "items-center")}>
      <div className="grid grid-cols-7 gap-[6px]">
        {WEEK.map((d) => (
          <span key={d} className="pb-0.5 text-center text-[28px] font-bold leading-none text-gray-400">
            {d}
          </span>
        ))}
        {CAL_CELLS.map((k, i) => {
          const kind: CellKind =
            (k === "rain" && !v.weather) || (k === "coach" && !v.coach)
              ? "stamp"
              : k === "promise" && !v.promise
                ? "none"
                : k;
          return <CalCell key={i} kind={kind} size={size} />;
        })}
      </div>
    </div>
  );
};

const PromiseVisual = ({ v, level }: P<"promise">) => (
  <div className={cn(panel(level), level === 0 ? "gap-4" : "gap-3")}>
    <div className="flex justify-between">
      {v.days.map((d, i) => {
        const picked = v.picked.includes(i);
        const done = v.done.includes(i);
        return (
          <span
            key={d}
            className={cn(
              "flex h-[46px] w-[46px] items-center justify-center rounded-full text-[28px] font-black",
              done
                ? "bg-primary text-gray-950"
                : picked
                  ? "border-[3px] border-dashed border-primary text-white"
                  : "bg-white/[0.05] text-gray-400",
            )}
          >
            {done ? <Check className="h-7 w-7" strokeWidth={3.2} /> : d}
          </span>
        );
      })}
    </div>
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-inset ring-white/10">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
        <Bell className="h-7 w-7 text-primary" />
      </span>
      <div className="min-w-0">
        {level === 0 && <p className="text-[28px] font-bold leading-tight text-gray-400">마이복서153</p>}
        <p className="break-keep text-[28px] font-black leading-snug text-white">{v.notice}</p>
      </div>
    </div>
  </div>
);

const TogetherVisual = ({ v, level }: P<"together">) => (
  <div className={cn(panel(level), level === 0 ? "gap-4" : "gap-3")}>
    <span className="self-start rounded-full bg-primary/15 px-4 py-0.5 text-[28px] font-black leading-snug text-primary">
      {v.title}
    </span>
    <p className="break-keep text-[36px] font-black leading-tight text-white">{v.call}</p>
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 ring-4 ring-gray-900">
            <UserRound className="h-7 w-7 text-gray-300" />
          </span>
        ))}
      </div>
      <span className="text-[30px] font-black text-white">{v.joined}</span>
      {level === 0 && (
        <span className="ml-auto rounded-2xl bg-primary px-5 py-1 text-[28px] font-black text-gray-950">저요!</span>
      )}
    </div>
  </div>
);

const BodyMindVisual = ({ v, level }: P<"bodymind">) => (
  <div className={cn("flex h-full min-h-0 flex-col justify-center", level === 0 ? "gap-3" : "gap-2")}>
    {v.cards.map((c, i) => (
      <div key={c.tag} className={cn("rounded-3xl bg-white/[0.05] ring-1 ring-inset ring-white/10", level === 0 ? "p-4" : "px-4 py-3")}>
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "rounded-full px-3 text-[28px] font-black leading-snug",
              i === 0 ? "bg-sky-400/15 text-sky-300" : "bg-primary/15 text-primary",
            )}
          >
            {c.tag}
          </span>
          <span className="min-w-0 flex-1 truncate text-[28px] font-bold leading-snug text-gray-300">{c.label}</span>
          <Sample />
        </div>
        <p className={cn("mt-1 break-keep font-black text-white", level === 0 ? "text-[34px]" : "text-[32px]", "leading-tight")}>
          {c.value}
        </p>
      </div>
    ))}
    {/* shrink-0: 세로 flex 안에서 truncate(넘침 숨김) 칸은 0 까지 줄어 사라진다 — 줄지 않게 해 넘침을 잴 수 있게 */}
    <p className="shrink-0 truncate text-[28px] font-bold leading-snug text-gray-400">{v.source}</p>
  </div>
);

const MarketVisual = ({ v, level }: P<"market">) => (
  <div className={cn(panel(level), level === 0 ? "gap-3" : "gap-2")}>
    <div className="flex items-center gap-2">
      <ShoppingBag className="h-8 w-8 shrink-0 text-primary" />
      <span className="text-[28px] font-black text-white">153 마켓</span>
      {v.count && (
        <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-3 text-[28px] font-black leading-snug text-primary">
          {v.count}
        </span>
      )}
    </div>
    {v.rows.map((r) => (
      <div key={r.label} className={cn("rounded-2xl bg-white/[0.05] px-4", level === 0 ? "py-2.5" : "py-1.5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[30px] font-black leading-tight text-white">{r.label}</span>
          <Sample />
        </div>
        <p className="text-[28px] font-bold leading-snug text-primary">{r.save}</p>
      </div>
    ))}
  </div>
);

export const AppValueVisual = ({ visual, level = 0 }: { visual: SceneVisual; level?: FitLevel }) => {
  switch (visual.kind) {
    case "pulse":
      return <PulseVisual v={visual} level={level} />;
    case "leagues":
      return <LeaguesVisual v={visual} level={level} />;
    case "shelves":
      return <ShelvesVisual v={visual} level={level} />;
    case "ladder":
      return <LadderVisual v={visual} level={level} />;
    case "calendar":
      return <CalendarVisual v={visual} level={level} />;
    case "promise":
      return <PromiseVisual v={visual} level={level} />;
    case "together":
      return <TogetherVisual v={visual} level={level} />;
    case "bodymind":
      return <BodyMindVisual v={visual} level={level} />;
    case "market":
      return <MarketVisual v={visual} level={level} />;
    default:
      return null;
  }
};
