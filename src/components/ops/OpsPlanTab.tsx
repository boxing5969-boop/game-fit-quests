/**
 * 153운영본부 · 「일정」 탭 (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리할 수 있는 기능 · 내가 팀원들의 스케줄을 한눈에")
 *
 *   보기 두 가지 — 「주간 · 달력」 (2026-11-12 대표님 「운동 달력처럼 운영탭에 스케줄관리도 달력처럼 스케줄 한눈에 보고 관리할수있도록」)
 *     달력(기본): 한 달 칸마다 색 점(일정 종류) → 날짜를 누르면 아래 카드가 그날로 · 넣기 · 고치기는 같은 시트.
 *       팀 달력은 근무 시간을 빼고(평일마다 있어서) 휴무 · 외부 · 수업 · PT · 업무 · 개인만, 내 달력은 근무 시간도.
 *       달력 조각은 OpsPlanMonth.tsx, 자료는 useOpsPlansMonth(주마다 받아 합침 — 서버 함수 그대로).
 *     주간: 아래 그대로. 고른 보기는 기기마다 기억(localStorage '153plan:period').
 *
 *   팀 일정(대표님 · 그 지점 관리자 — 서버 ops_plans_week manage):
 *     한 주 일정판(사람 × 월~일, 칸마다 색 막대 — 「근무」 탭 근무 시간 · 수업 · PT · 업무 · 외부 · 휴무 · 개인)
 *     → 고른 날 누가 무엇을(근무 n · 휴무 n · 외부 n · 「+ 내 일정」) → 최근 바뀐 일정(7일)
 *   내 일정(코치님은 이것만 — 서버가 본인 것만 보낸다):
 *     월~일 하루씩 근무 시간 + 내 일정 · 날마다 + · 매주 반복 목록 → 넣기 · 고치기 시트(OpsPlanSheet)
 *   코치님끼리는 서로 일정이 안 보인다(10/29 근무 시간 비공개와 같은 결). 일정은 근무 시간 · 급여와 따로 — 쉰 날 인정 · 대타 · 연장은 「근무」 탭.
 *   계산(반복 펼치기 · 하루 정리 · 달력 표시)은 src/lib/opsPlans.ts 한 곳.
 *   맨 위 「오늘 만날 회원」(2026-11-12 대표님 「추천하는대로 진행할게」 — 스케줄러는 회원을 맞이하는 도구): OpsMeetToday.
 *   맨 아래 「회원 달력」(2026-11-13 운동 달력 2-2단계 · 대표님 「다음」 → 153 일정은 「앱 운영본부에서」): OpsCalEvents —
 *     지점장님 · 대표님이 휴관 · 단축 운영 · 이벤트 · 대회 · 특강을 올리면 그 지점 회원 운동 달력에 바로 + 알림. 코치님은 보기만.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";
import { monthOf as ymOf, shiftMonth as shiftYm } from "@/lib/attendanceCalendar";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import {
  PLAN_KINDS,
  PLAN_KIND_META,
  RECENT_ACTION,
  SHIFT_META,
  addDays,
  agoLabel,
  cellDots,
  dayItems,
  dayMarks,
  daySummary,
  isRepeat,
  itemChip,
  itemLabel,
  mondayOf,
  monthMondays,
  planDay,
  presentMarks,
  recentLine,
  repeatLabel,
  summaryLabel,
  timeLabel,
  weekDates,
  weekRangeLabel,
  type DayItem,
  type DayMark,
  type OpsPlan,
  type PlanMember,
  type PlansWeek,
} from "@/lib/opsPlans";
import { readOpsBranch, saveOpsBranch, shortBranch } from "@/services/opsService";
import { useOpsPlansMonth, useOpsPlansWeek } from "@/services/opsPlanService";
import OpsPlanSheet, { type PlanSheetTarget } from "./OpsPlanSheet";
import { MarkLegend, MonthSwitcher, PlanMonthGrid } from "./OpsPlanMonth";
import OpsMeetToday from "./OpsMeetToday";
import OpsCalEvents from "./OpsCalEvents";
import { OpsChip, kstToday } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

const mdLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

type Period = "week" | "month";
const PERIOD_KEY = "153plan:period";
/** 고른 보기 — 기기마다 (처음엔 달력, 기기 저장이 막혀도 화면은 그대로) */
const readPeriod = (): Period => {
  try {
    return localStorage.getItem(PERIOD_KEY) === "week" ? "week" : "month";
  } catch {
    return "month";
  }
};
const writePeriod = (p: Period) => {
  try {
    localStorage.setItem(PERIOD_KEY, p);
  } catch {
    /* 저장이 막힌 기기 — 이번 화면에서만 기억 */
  }
};

const OpsPlanTab = () => {
  const today = kstToday();
  const thisWeek = mondayOf(today);
  const thisMonth = ymOf(today);
  const [branch, setBranchState] = useState<string | null>(readOpsBranch);
  const [period, setPeriodState] = useState<Period>(readPeriod);
  const [monday, setMonday] = useState(thisWeek);
  const [ym, setYm] = useState(thisMonth);
  const [day, setDay] = useState(today);
  const [view, setView] = useState<"team" | "mine">("team");
  const [sheet, setSheet] = useState<PlanSheetTarget | null>(null);
  const weekQ = useOpsPlansWeek(branch, monday, period === "week");
  const monthQ = useOpsPlansMonth(branch, ym, period === "month");
  const q = period === "week" ? weekQ : monthQ;
  const data = q.data;

  // 주를 바꾸면 고른 날도 그 주로 — 오늘이 든 주면 오늘, 아니면 월요일
  useEffect(() => {
    if (period !== "week") return;
    const dates = weekDates(monday);
    setDay((d) => (dates.includes(d) ? d : dates.includes(today) ? today : monday));
  }, [monday, today, period]);

  // 달을 바꾸면 고른 날도 그 달로 — 이번 달이면 오늘, 아니면 1일
  useEffect(() => {
    if (period !== "month") return;
    setDay((d) => (d.startsWith(`${ym}-`) ? d : today.startsWith(`${ym}-`) ? today : `${ym}-01`));
  }, [ym, today, period]);

  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
  };

  /** 주간 ↔ 달력 — 고른 날은 그대로 */
  const changePeriod = (p: Period) => {
    if (p === period) return;
    if (p === "week") setMonday(mondayOf(day));
    else setYm(ymOf(day));
    setPeriodState(p);
    writePeriod(p);
  };

  /** 그날로 가기 (최근 바뀐 일정에서) */
  const goTo = (date: string) => {
    if (period === "week") setMonday(mondayOf(date));
    else setYm(ymOf(date));
    setDay(date);
  };

  if (q.isLoading && !data) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-12 animate-pulse rounded-2xl bg-card" />
        <div className="h-72 animate-pulse rounded-2xl bg-card" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className={cn(card, "text-center")}>
        <p className="text-body font-bold text-foreground">일정을 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const team = data.manage && view === "team";
  const openNew = (date: string) => setSheet({ mode: "new", branch: data.branch, date });
  const openPlan = (plan: OpsPlan, date: string | null) => setSheet({ mode: "edit", plan, date });
  // 주 · 달 넘기기는 큰 카드 안 제목 아래 가운데 — 회원 '운동 달력'과 같은 자리
  const nav =
    period === "week" ? (
      <WeekSwitcher monday={monday} thisWeek={thisWeek} onChange={setMonday} />
    ) : (
      <MonthSwitcher ym={ym} thisMonth={thisMonth} min={shiftYm(thisMonth, -6)} max={shiftYm(thisMonth, 12)} today={today} onChange={setYm} />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {data.branches.length > 1 ? (
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
            {data.branches.map((b) => (
              <OpsChip key={b.branch} on={b.branch === data.branch} onClick={() => setBranch(b.branch)}>
                {shortBranch(b.branch)}
              </OpsChip>
            ))}
          </div>
        ) : (
          <p className="min-w-0 truncate text-body font-black text-foreground">{shortBranch(data.branch)}</p>
        )}
        <PeriodToggle value={period} onChange={changePeriod} />
      </div>

      {data.manage && (
        <div role="tablist" aria-label="일정 보기" className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1">
          {(["team", "mine"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-11 rounded-xl text-body font-black transition-all active:scale-[0.98]",
                view === v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {v === "team" ? "팀 일정" : "내 일정"}
            </button>
          ))}
        </div>
      )}

      {/* 오늘 만날 회원 — 켠 지점 지도진 · 대표님, 없으면 안 그림 */}
      <OpsMeetToday branch={data.branch} />

      <div className={cn("space-y-4 transition-opacity", q.isPlaceholderData && "opacity-60")}>
        {period === "month" ? (
          team ? (
            <TeamMonthView data={data} nav={nav} ym={ym} day={day} setDay={setDay} onOpenPlan={openPlan} onAdd={openNew} onGo={goTo} />
          ) : (
            <MyMonthView data={data} nav={nav} ym={ym} day={day} setDay={setDay} onAdd={openNew} onOpenPlan={openPlan} />
          )
        ) : team ? (
          <TeamView data={data} nav={nav} day={day} setDay={setDay} onOpenPlan={openPlan} onAdd={openNew} onGo={goTo} />
        ) : (
          <MyView data={data} nav={nav} onAdd={openNew} onOpenPlan={openPlan} />
        )}
      </div>

      {/* 회원 달력 153 일정 — 올릴 수 있는 분(대표님 · 지점장님)은 늘, 코치님은 올라간 일정이 있을 때만 */}
      <OpsCalEvents branch={data.branch} date={day} />

      <OpsPlanSheet target={sheet} today={data.today} onClose={() => setSheet(null)} />
    </div>
  );
};

// ───────────────────────── 주간 · 달력 고르기 ─────────────────────────
const PeriodToggle = ({ value, onChange }: { value: Period; onChange: (p: Period) => void }) => (
  <div role="group" aria-label="주간 · 달력 보기" className="flex shrink-0 gap-0.5 rounded-full bg-secondary p-1">
    {(["week", "month"] as const).map((p) => {
      const Icon = p === "week" ? Rows3 : CalendarDays;
      return (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "flex h-8 items-center gap-1 rounded-full px-3 text-label font-bold transition-all active:scale-95",
            value === p ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {p === "week" ? "주간" : "달력"}
        </button>
      );
    })}
  </div>
);

/** 큰 카드 제목 아래 — 주 · 달 넘기기 */
const NavRow = ({ nav }: { nav: ReactNode }) => <div className="mt-2 flex justify-center">{nav}</div>;

// ───────────────────────── 주 고르기 ─────────────────────────
const WeekSwitcher = ({ monday, thisWeek, onChange }: { monday: string; thisWeek: string; onChange: (m: string) => void }) => {
  const shift = (n: number) => {
    const [y, m, d] = monday.split("-").map(Number);
    onChange(new Date(Date.UTC(y, m - 1, d + n * 7)).toISOString().slice(0, 10));
  };
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="지난주"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange(thisWeek)}
        aria-label={monday === thisWeek ? "이번 주" : "이번 주로 돌아가기"}
        className="min-w-[8.5rem] text-center text-body font-black tabular-nums text-foreground"
      >
        {monday === thisWeek ? "이번 주" : weekRangeLabel(monday)}
      </button>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="다음 주"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

// ───────────────────────── 일정 한 줄 (팀 · 내 일정 공용) ─────────────────────────
const ItemLine = ({ item, board, onClick, chevron = true }: { item: DayItem; board: string; onClick?: () => void; chevron?: boolean }) => {
  const plan = item.type === "plan" ? item.plan : null;
  const title = plan ? (plan.masked ? "개인 일정" : plan.title) : null;
  const sub = [
    plan && isRepeat(plan) ? repeatLabel(plan.repeat_weekdays) : null,
    item.branch !== board ? shortBranch(item.branch) : null,
    plan?.memo ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", itemChip(item))}>{itemLabel(item)}</span>
      <span className="min-w-0 flex-1">
        {/* 제목이 시각 옆에 안 들어가면 다음 줄로 (그래도 길면 … ) */}
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{timeLabel(item.allDay, item.start, item.end)}</span>
          {title && <span className="max-w-full shrink-0 truncate text-body text-foreground">{title}</span>}
        </span>
        {sub && <span className="block truncate text-label text-muted-foreground">{sub}</span>}
      </span>
      {onClick && chevron && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-start gap-2 rounded-lg text-left active:bg-secondary/60">
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-2">{body}</div>
      )}
    </li>
  );
};

// ───────────────────────── 고른 날 — 누가 무엇을 (팀 주간 · 팀 달력 공용) ─────────────────────────
const TeamDayCard = ({
  data,
  date,
  onOpenPlan,
  onAdd,
}: {
  data: PlansWeek;
  date: string;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onAdd: (date: string) => void;
}) => {
  const members = data.members;
  const busy: Array<{ m: PlanMember; items: DayItem[] }> = [];
  const free: PlanMember[] = [];
  for (const m of members) {
    const items = dayItems(data, m, date);
    if (items.length) busy.push({ m, items });
    else free.push(m);
  }
  const summary = summaryLabel(daySummary(data, members, date));

  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-heading font-black text-foreground">
            {planDay(date)}
            {date === data.today ? " · 오늘" : ""}
          </h2>
          {summary && <p className="mt-0.5 text-label text-muted-foreground">{summary}</p>}
        </div>
        <button
          type="button"
          onClick={() => onAdd(date)}
          aria-label={`${planDay(date)} 내 일정 넣기`}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
        >
          <Plus className="h-4 w-4" /> 내 일정
        </button>
      </div>
      {busy.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">이날은 잡힌 일정이 없어요</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {busy.map(({ m, items }) => (
            <li key={m.key} className="py-3 first:pt-0 last:pb-0">
              <p className="text-body font-black text-foreground">
                {m.name}
                <span className="ml-1.5 text-label font-bold text-muted-foreground">
                  {m.title}
                  {m.me ? " · 나" : ""}
                </span>
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {items.map((it) => (
                  <ItemLine
                    key={it.id}
                    item={it}
                    board={data.branch}
                    onClick={it.type === "plan" && it.plan.mine ? () => onOpenPlan(it.plan, isRepeat(it.plan) ? date : null) : undefined}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 && busy.length > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-label text-muted-foreground">
          일정 없음 · {free.map((m) => m.name).join(" · ")}
        </p>
      )}
    </section>
  );
};

// ───────────────────────── 최근 바뀐 일정 — 7일 안, 내가 바꾼 것은 빼고 ─────────────────────────
const RecentCard = ({ data, onGo }: { data: PlansWeek; onGo: (date: string) => void }) => {
  if (data.recent.length === 0) return null;
  const nameOf = (uid: string) => data.members.find((m) => m.user_id === uid)?.name ?? "팀원";
  return (
    <section className={card}>
      <h2 className="text-heading font-black text-foreground">최근 바뀐 일정</h2>
      <ul className="mt-2 divide-y divide-border">
        {data.recent.slice(0, 5).map((r) => {
          const jump = r.action !== "removed" && r.repeat_weekdays.length === 0;
          const body = (
            <>
              <p className="text-body font-bold text-foreground">
                {nameOf(r.user_id)}
                <span className="font-normal text-muted-foreground"> · {RECENT_ACTION[r.action]} · {agoLabel(r.at)}</span>
              </p>
              <p className="truncate text-label text-muted-foreground">{recentLine(r)}</p>
            </>
          );
          return (
            <li key={`${r.id}:${r.at}`}>
              {jump ? (
                <button type="button" onClick={() => onGo(r.start_on)} className="block w-full py-2.5 text-left active:bg-secondary/60">
                  {body}
                </button>
              ) : (
                <div className="py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// ───────────────────────── 매주 반복 (내 일정 주간 · 달력 공용) ─────────────────────────
const RepeatsCard = ({ data, onOpenPlan }: { data: PlansWeek; onOpenPlan: (p: OpsPlan, date: string | null) => void }) => {
  const repeats = data.plans.filter((p) => p.mine && isRepeat(p));
  if (repeats.length === 0) return null;
  return (
    <section className={card}>
      <h2 className="text-heading font-black text-foreground">매주 반복</h2>
      <ul className="mt-2 divide-y divide-border">
        {repeats.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpenPlan(p, null)} className="flex w-full items-center gap-2 py-3 text-left active:bg-secondary/60">
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", PLAN_KIND_META[p.kind].chip)}>
                {PLAN_KIND_META[p.kind].label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-foreground">
                  {repeatLabel(p.repeat_weekdays, p.until_on)} · {timeLabel(p.all_day, p.start_time, p.end_time)}
                </span>
                {p.title && <span className="block truncate text-label text-muted-foreground">{p.title}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

const WorkTabNote = ({ data }: { data: PlansWeek }) =>
  data.hq ? null : <p className="px-1 text-label text-muted-foreground">휴무 인정 · 대타 · 연장 근무는 「근무」 탭에서 요청해요</p>;

/** 달력에 보이는 날마다 표시 — perDay(날짜) = 사람마다 그날 일정 */
const useMonthMarks = (ym: string, perDay: (date: string) => DayItem[][], withShift: boolean, deps: unknown[]) =>
  useMemo(() => {
    const map = new Map<string, DayMark[]>();
    for (const mon of monthMondays(ym)) {
      for (let i = 0; i < 7; i++) {
        const d = addDays(mon, i);
        map.set(d, dayMarks(perDay(d), withShift));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, withShift, ...deps]);

// ───────────────────────── 팀 일정 · 주간 (대표님 · 지점장) ─────────────────────────
const TeamView = ({
  data,
  nav,
  day,
  setDay,
  onOpenPlan,
  onAdd,
  onGo,
}: {
  data: PlansWeek;
  nav: ReactNode;
  day: string;
  setDay: (d: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onAdd: (date: string) => void;
  onGo: (date: string) => void;
}) => {
  const dates = useMemo(() => weekDates(data.from), [data.from]);
  const members = data.members;
  const grid = useMemo(() => {
    const m = new Map<string, DayItem[][]>();
    for (const mem of members) m.set(mem.key, dates.map((d) => dayItems(data, mem, d)));
    return m;
  }, [data, members, dates]);
  const selected = dates.includes(day) ? day : dates[0];

  return (
    <>
      {/* 주인공 — 한 주 일정판 */}
      <section className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">팀 일정</h2>
          <span className="text-label text-muted-foreground">{members.length}명</span>
        </div>
        <NavRow nav={nav} />
        {members.length === 0 ? (
          <p className="mt-3 text-body text-muted-foreground">이 지점에 아직 코치님이 없어요</p>
        ) : (
          <div className="-mx-1 mt-3 overflow-x-auto">
            <table className="w-full min-w-[19rem] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[4.25rem]" />
                {dates.map((d) => (
                  <col key={d} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    이름
                  </th>
                  {dates.map((d) => {
                    const on = d === selected;
                    const wd = weekdayOf(d);
                    return (
                      <th key={d} scope="col" className="px-0.5 pb-1">
                        <button
                          type="button"
                          onClick={() => setDay(d)}
                          aria-pressed={on}
                          aria-label={planDay(d)}
                          className={cn(
                            "flex w-full flex-col items-center rounded-lg py-1 active:scale-95",
                            on ? "bg-foreground text-background" : d === data.today ? "text-primary" : wd === 0 ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          <span className="text-micro font-bold">{OPS_WEEKDAY[wd]}</span>
                          <span className="text-label font-black tabular-nums">{Number(d.slice(8, 10))}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.key}>
                    <th scope="row" className="truncate py-0.5 pr-1 text-left text-label font-bold text-foreground">
                      {m.name}
                    </th>
                    {dates.map((d, i) => {
                      const items = grid.get(m.key)?.[i] ?? [];
                      const { dots, more } = cellDots(items);
                      return (
                        <td key={d} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => setDay(d)}
                            aria-label={`${m.name} ${planDay(d)} — ${
                              items.length ? items.map((it) => `${itemLabel(it)} ${timeLabel(it.allDay, it.start, it.end)}`).join(", ") : "일정 없음"
                            }`}
                            className={cn(
                              "flex h-11 w-full flex-col items-center justify-center gap-[3px] rounded-lg active:scale-95",
                              d === selected ? "bg-secondary" : d === data.today ? "bg-primary/5" : "",
                            )}
                          >
                            {dots.map((c, j) => (
                              <span key={j} className={cn("h-1.5 w-5 max-w-full rounded-full", c)} />
                            ))}
                            {more > 0 && <span className="text-micro font-bold leading-none text-muted-foreground">+{more}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* 색 이름표 */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {[{ label: SHIFT_META.label, dot: SHIFT_META.dot }, ...PLAN_KINDS.map((k) => PLAN_KIND_META[k])].map((x) => (
            <span key={x.label} className="flex items-center gap-1 text-micro text-muted-foreground">
              <span className={cn("h-1.5 w-3 rounded-full", x.dot)} aria-hidden />
              {x.label}
            </span>
          ))}
        </div>
      </section>

      <TeamDayCard data={data} date={selected} onOpenPlan={onOpenPlan} onAdd={onAdd} />
      <RecentCard data={data} onGo={onGo} />
    </>
  );
};

// ───────────────────────── 팀 일정 · 달력 (대표님 · 지점장) ─────────────────────────
const TeamMonthView = ({
  data,
  nav,
  ym,
  day,
  setDay,
  onOpenPlan,
  onAdd,
  onGo,
}: {
  data: PlansWeek;
  nav: ReactNode;
  ym: string;
  day: string;
  setDay: (d: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onAdd: (date: string) => void;
  onGo: (date: string) => void;
}) => {
  const members = data.members;
  // 팀 달력은 근무 시간을 뺀다 — 평일마다 있어 점이 모두 같아진다(그날 근무 n명은 아래 카드)
  const marks = useMonthMarks(ym, (d) => members.map((m) => dayItems(data, m, d)), false, [data, members]);

  return (
    <>
      <section className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">팀 일정</h2>
          <span className="text-label text-muted-foreground">{members.length}명</span>
        </div>
        <NavRow nav={nav} />
        {members.length === 0 ? (
          <p className="mt-3 text-body text-muted-foreground">이 지점에 아직 코치님이 없어요</p>
        ) : (
          <>
            <PlanMonthGrid ym={ym} marks={marks} selected={day} today={data.today} team onPick={setDay} />
            <MarkLegend keys={presentMarks(marks, ym)} empty="이달은 잡힌 일정이 없어요 — 근무 시간은 날짜를 누르면 보여요" />
          </>
        )}
      </section>

      <TeamDayCard data={data} date={day} onOpenPlan={onOpenPlan} onAdd={onAdd} />
      <RecentCard data={data} onGo={onGo} />
    </>
  );
};

// ───────────────────────── 내 일정 · 주간 (코치님 · 관리자 본인) ─────────────────────────
const MyView = ({
  data,
  nav,
  onAdd,
  onOpenPlan,
}: {
  data: PlansWeek;
  nav: ReactNode;
  onAdd: (date: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
}) => {
  const dates = weekDates(data.from);
  const me: Pick<PlanMember, "key" | "user_id"> = data.members.find((m) => m.me) ?? { key: data.me, user_id: data.me };
  const addDate = dates.includes(data.today) ? data.today : dates[0];

  return (
    <>
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">내 일정</h2>
          <button
            type="button"
            onClick={() => onAdd(addDate)}
            className="flex h-10 items-center gap-1 rounded-xl bg-foreground px-3.5 text-label font-black text-background active:scale-95"
          >
            <Plus className="h-4 w-4" /> 일정 넣기
          </button>
        </div>
        <NavRow nav={nav} />
        <ul className="mt-2 divide-y divide-border">
          {dates.map((d) => {
            const items = dayItems(data, me, d);
            const isToday = d === data.today;
            const wd = weekdayOf(d);
            return (
              <li key={d} className={cn("flex items-start gap-3 py-3", isToday && "-mx-2 rounded-xl border-transparent bg-primary/5 px-2")}>
                <div className="w-11 shrink-0 pt-0.5">
                  <p className={cn("text-body font-black", isToday ? "text-primary" : wd === 0 ? "text-muted-foreground" : "text-foreground")}>
                    {OPS_WEEKDAY[wd]}
                  </p>
                  <p className="text-label tabular-nums text-muted-foreground">{mdLabel(d)}</p>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  {items.map((it) => (
                    <ItemLine
                      key={it.id}
                      item={it}
                      board={data.branch}
                      chevron={false}
                      onClick={it.type === "plan" && it.plan.mine ? () => onOpenPlan(it.plan, isRepeat(it.plan) ? d : null) : undefined}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onAdd(d)}
                  aria-label={`${planDay(d)} 일정 넣기`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <RepeatsCard data={data} onOpenPlan={onOpenPlan} />
      <WorkTabNote data={data} />
    </>
  );
};

// ───────────────────────── 내 일정 · 달력 (코치님 · 관리자 본인) ─────────────────────────
const MyMonthView = ({
  data,
  nav,
  ym,
  day,
  setDay,
  onAdd,
  onOpenPlan,
}: {
  data: PlansWeek;
  nav: ReactNode;
  ym: string;
  day: string;
  setDay: (d: string) => void;
  onAdd: (date: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
}) => {
  const found = data.members.find((m) => m.me);
  const meKey = found?.key ?? data.me;
  const meUid = found ? found.user_id : data.me;
  const me: Pick<PlanMember, "key" | "user_id"> = { key: meKey, user_id: meUid };
  // 내 달력은 근무 시간도 — '일하는 날'이 보이게
  const marks = useMonthMarks(ym, (d) => [dayItems(data, me, d)], true, [data, meKey, meUid]);
  const items = dayItems(data, me, day);

  return (
    <>
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">내 일정</h2>
          <button
            type="button"
            onClick={() => onAdd(day)}
            className="flex h-10 items-center gap-1 rounded-xl bg-foreground px-3.5 text-label font-black text-background active:scale-95"
          >
            <Plus className="h-4 w-4" /> 일정 넣기
          </button>
        </div>
        <NavRow nav={nav} />
        <PlanMonthGrid ym={ym} marks={marks} selected={day} today={data.today} team={false} onPick={setDay} />
        <MarkLegend keys={presentMarks(marks, ym)} empty="이달은 잡힌 일정이 없어요" />
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">
            {planDay(day)}
            {day === data.today ? " · 오늘" : ""}
          </h2>
          <button
            type="button"
            onClick={() => onAdd(day)}
            aria-label={`${planDay(day)} 일정 넣기`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-body text-muted-foreground">이날은 잡힌 일정이 없어요</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it) => (
              <ItemLine
                key={it.id}
                item={it}
                board={data.branch}
                onClick={it.type === "plan" && it.plan.mine ? () => onOpenPlan(it.plan, isRepeat(it.plan) ? day : null) : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      <RepeatsCard data={data} onOpenPlan={onOpenPlan} />
      <WorkTabNote data={data} />
    </>
  );
};

export default OpsPlanTab;
