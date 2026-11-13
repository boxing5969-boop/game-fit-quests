/**
 * 153운영본부 · 「일정」 탭 (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리할 수 있는 기능 · 내가 팀원들의 스케줄을 한눈에")
 *
 *   팀 일정(대표님 · 그 지점 관리자 — 서버 manage): 「주간 · 달력」 그대로
 *     주간 = 한 주 일정판(사람 × 월~일, 칸마다 색 막대) → 고른 날 누가 무엇을 → 최근 바뀐 일정(7일)
 *     달력 = 한 달 칸마다 색 점(근무 시간은 빼고) → 고른 날 카드 (OpsPlanMonth.tsx)
 *   내 일정(코치님은 이것만 — 서버가 본인 것만 보낸다) · 캘린더 3-2단계(2026-11-13 대표님 「3-2 시작」 · 구글 캘린더처럼):
 *     보기 고르기 한 줄 — 일 · 3일 · 주(시간축 OpsPlanTimeGrid — 끌어 옮기기 · 늘리기) · 월(달력) · 목록(60일 OpsPlanAgenda) · 연간(OpsPlanYear)
 *     · 고른 보기는 기기마다 기억(localStorage '153plan:view', 처음엔 월) · 알림 링크 ?d=날짜 면 그날 하루 보기
 *     · 반복 일정을 끌어 옮기면 '이 일정만 / 이후 모두'(OpsPlanTools PlanScopeAsk) · 검색 · 휴지통 · 아침 8시 브리핑(OpsPlanTools)
 *     · 공휴일(src/lib/krHolidays.ts — 빨간 글씨, 대표님 · 지점장님은 목록에서 「회원 달력에 휴관으로 올리기」) · 회원 생일(「오늘 만날 회원」과 같은 범위)
 *   자료는 한 곳 — useOpsPlansRange(서버 ops_plans_range · 3-2 함수가 없으면 주마다 받아 합침, 연간은 숨김).
 *   코치님끼리는 서로 일정이 안 보인다(10/29 근무 시간 비공개와 같은 결). 일정은 근무 시간 · 급여와 따로 — 쉰 날 인정 · 대타 · 연장은 「근무」 탭.
 *   계산(반복 펼치기 · 하루 정리 · 달력 표시)은 src/lib/opsPlans.ts · opsRecur.ts · opsTimeGrid.ts.
 *   맨 위 「오늘 만날 회원」(2026-11-12): OpsMeetToday · 맨 아래 「회원 달력」(2-2): OpsCalEvents · 맨 끝 「휴대폰 캘린더」(3-1): OpsPhoneCalendar.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Rows3, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { openMemberCard } from "@/lib/appEvents";
import { monthOf as ymOf, shiftMonth as shiftYm } from "@/lib/attendanceCalendar";
import { holidayOn } from "@/lib/krHolidays";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import {
  PLAN_AGENDA_DAYS as AGENDA_DAYS,
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
  draftForScope,
  draftFromPlan,
  draftPayload,
  isRepeat,
  itemChip,
  itemLabel,
  mondayOf,
  monthMondays,
  moveFollowing,
  moveFollowingLabel,
  planDay,
  planRange,
  planRepeatLabel,
  presentMarks,
  recentLine,
  summaryLabel,
  timeLabel,
  weekDates,
  weekRangeLabel,
  type DayItem,
  type DayMark,
  type MineView,
  type OpsPlan,
  type PlanDraft,
  type PlanMember,
  type PlansWeek,
} from "@/lib/opsPlans";
import { readOpsBranch, saveOpsBranch, shortBranch } from "@/services/opsService";
import { useOpsPlanSave, useOpsPlansRange } from "@/services/opsPlanService";
import { useOpsCalEvents } from "@/services/calendarEventService";
import OpsPlanSheet, { type PlanSheetTarget } from "./OpsPlanSheet";
import { MarkLegend, MonthSwitcher, PlanMonthGrid } from "./OpsPlanMonth";
import OpsPlanTimeGrid, { type PlanMove } from "./OpsPlanTimeGrid";
import OpsPlanAgenda from "./OpsPlanAgenda";
import OpsPlanYear from "./OpsPlanYear";
import { PlanScopeAsk, PlanSearchSheet, PlanToolsRow, PlanTrashSheet } from "./OpsPlanTools";
import OpsMeetToday from "./OpsMeetToday";
import OpsCalEvents from "./OpsCalEvents";
import OpsPhoneCalendar from "./OpsPhoneCalendar";
import { OpsChip, kstToday } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

type Period = "week" | "month";
const PERIOD_KEY = "153plan:period";
/** 팀 일정 보기 — 기기마다 (처음엔 달력, 기기 저장이 막혀도 화면은 그대로) */
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

const MINE_VIEWS: ReadonlyArray<{ key: MineView; label: string }> = [
  { key: "day", label: "일" },
  { key: "3day", label: "3일" },
  { key: "week", label: "주" },
  { key: "month", label: "월" },
  { key: "list", label: "목록" },
  { key: "year", label: "연간" },
];
const VIEW_KEY = "153plan:view";
const readView = (): MineView => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return MINE_VIEWS.some((m) => m.key === v) ? (v as MineView) : "month";
  } catch {
    return "month";
  }
};
const writeView = (v: MineView) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* 이번 화면에서만 */
  }
};

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const OpsPlanTab = () => {
  const today = kstToday();
  const thisMonth = ymOf(today);
  const [params, setParams] = useSearchParams();
  const linkDay = params.get("d");
  const [branch, setBranchState] = useState<string | null>(readOpsBranch);
  const [period, setPeriodState] = useState<Period>(readPeriod);
  const [mineView, setMineViewState] = useState<MineView>(() => (isDay(linkDay) ? "day" : readView()));
  const [day, setDay] = useState(() => (isDay(linkDay) ? linkDay : today));
  const [ym, setYm] = useState(() => ymOf(isDay(linkDay) ? linkDay : today));
  const [view, setView] = useState<"team" | "mine">(() => (isDay(linkDay) ? "mine" : "team"));
  const [sheet, setSheet] = useState<PlanSheetTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [ask, setAsk] = useState<PlanMove | null>(null);
  const [calPreset, setCalPreset] = useState<{ date: string; title: string; seq: number } | null>(null);
  const [manageKnown, setManageKnown] = useState(false);
  const save = useOpsPlanSave();

  // 알림 링크(?d=날짜)는 한 번만 — 주소에서 지운다
  useEffect(() => {
    if (!isDay(linkDay)) return;
    const next = new URLSearchParams(params);
    next.delete("d");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamMode = manageKnown && view === "team";
  const range = planRange(teamMode ? "team" : "mine", period, mineView, day, ym);
  const q = useOpsPlansRange(branch, range.from, range.to);
  const data = q.data;
  const calQ = useOpsCalEvents(data?.branch ?? null, !!data);
  const canHoliday = !!calQ.data?.on && !!calQ.data?.canEdit;

  useEffect(() => {
    if (data) setManageKnown(data.manage);
  }, [data]);

  // 달을 바꾸면 고른 날도 그 달로 — 이번 달이면 오늘, 아니면 1일
  useEffect(() => {
    const monthView = teamMode ? period === "month" : mineView === "month";
    if (!monthView) return;
    setDay((d) => (d.startsWith(`${ym}-`) ? d : today.startsWith(`${ym}-`) ? today : `${ym}-01`));
  }, [ym, today, period, mineView, teamMode]);

  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
  };

  /** 팀 주간 ↔ 달력 — 고른 날은 그대로 */
  const changePeriod = (p: Period) => {
    if (p === period) return;
    if (p === "month") setYm(ymOf(day));
    setPeriodState(p);
    writePeriod(p);
  };

  const changeMineView = (v: MineView) => {
    if (v === mineView) return;
    if (v === "month") setYm(ymOf(day));
    setMineViewState(v);
    writeView(v);
  };

  /** 그날로 가기 (최근 바뀐 일정 · 검색 · 연간에서) */
  const goTo = (date: string, v?: MineView) => {
    setDay(date);
    setYm(ymOf(date));
    if (v) {
      setView("mine");
      changeMineView(v);
    }
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
  const openNew = (date: string, time?: { start: string; end: string }) => setSheet({ mode: "new", branch: data.branch, date, time });
  const openPlan = (plan: OpsPlan, date: string | null) => setSheet({ mode: "edit", plan, date });

  /** 끌어 옮기기 — 한 번 하는 일정은 바로, 반복은 '이 일정만 / 이후 모두'를 물은 뒤 */
  const doMove = (m: PlanMove, scope: "one" | "following" | "all") => {
    const base = draftFromPlan(m.plan);
    let payload: Record<string, unknown>;
    if (!isRepeat(m.plan)) {
      const span = Math.round((Date.parse(`${m.plan.end_on}T00:00:00Z`) - Date.parse(`${m.plan.start_on}T00:00:00Z`)) / 86_400_000);
      const d: PlanDraft = { ...base, start_on: m.to, end_on: span > 0 ? addDays(m.to, span) : "", start_time: m.start, end_time: m.end };
      payload = draftPayload(d, "all");
    } else if (scope === "one") {
      const d: PlanDraft = { ...draftForScope(base, m.plan, "one", m.from), start_on: m.to, start_time: m.start, end_time: m.end };
      payload = draftPayload(d, "one", m.from);
    } else {
      const f = moveFollowing(m.plan, m.from, m.to, m.start, m.end);
      payload = draftPayload(f.draft, "following", f.split);
    }
    save.mutate(payload, {
      onSuccess: () => {
        setAsk(null);
        toast.success(
          !isRepeat(m.plan)
            ? m.kind === "resize"
              ? "시간을 바꿨어요"
              : "옮겼어요"
            : scope === "one"
              ? `${planDay(m.from)} 일정만 ${m.kind === "resize" ? "바꿨어요" : "옮겼어요"}`
              : `${planDay(m.from)}부터 ${m.kind === "resize" ? "바꿨어요" : "옮겼어요"}`,
        );
      },
      onError: (e) => {
        setAsk(null);
        toast.error((e as Error).message);
      },
    });
  };
  const onMove = (m: PlanMove) => (isRepeat(m.plan) ? setAsk(m) : doMove(m, "all"));

  const onHoliday = (date: string, name: string) => setCalPreset({ date, title: `${name} 휴관`, seq: Date.now() });

  // 반복 일정을 끌어 놓았을 때 — 원래 · 바뀔 회차, 「이후 모두」면 될 반복 한 줄
  const askInfo = ask
    ? {
        from: `${planDay(ask.from)} ${timeLabel(false, ask.plan.start_time, ask.plan.end_time)}`,
        to: `${planDay(ask.to)} ${ask.start}~${ask.end}`,
        following: moveFollowingLabel(moveFollowing(ask.plan, ask.from, ask.to, ask.start, ask.end).draft),
      }
    : null;

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
        {team && <PeriodToggle value={period} onChange={changePeriod} />}
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
        {team ? (
          period === "month" ? (
            <TeamMonthView
              data={data}
              nav={<MonthSwitcher ym={ym} thisMonth={thisMonth} min={shiftYm(thisMonth, -6)} max={shiftYm(thisMonth, 12)} today={today} onChange={setYm} />}
              ym={ym}
              day={day}
              setDay={setDay}
              onOpenPlan={openPlan}
              onAdd={openNew}
              onGo={(d) => goTo(d)}
            />
          ) : (
            <TeamView
              data={data}
              nav={<WeekSwitcher monday={mondayOf(day)} thisWeek={mondayOf(today)} onChange={(m) => setDay(m === mondayOf(today) ? today : m)} />}
              day={day}
              setDay={setDay}
              onOpenPlan={openPlan}
              onAdd={openNew}
              onGo={(d) => goTo(d)}
            />
          )
        ) : (
          <MineSection
            data={data}
            rangeFn={q.data?.rangeFn !== false}
            view={mineView}
            onView={changeMineView}
            day={day}
            setDay={setDay}
            ym={ym}
            setYm={setYm}
            today={today}
            thisMonth={thisMonth}
            canHoliday={canHoliday}
            onAdd={openNew}
            onOpenPlan={openPlan}
            onMove={onMove}
            onGo={goTo}
            onSearch={() => setSearchOpen(true)}
            onTrash={() => setTrashOpen(true)}
            onHoliday={onHoliday}
          />
        )}
      </div>

      {/* 회원 달력 153 일정 — 올릴 수 있는 분(대표님 · 지점장님)은 늘, 코치님은 올라간 일정이 있을 때만 */}
      <OpsCalEvents branch={data.branch} date={day} preset={calPreset} />

      {/* 휴대폰 캘린더 — 구독 주소 · .ics 가져오기 (3-1) */}
      <OpsPhoneCalendar branch={data.branch} me={data.me} today={data.today} plans={data.plans} />

      <OpsPlanSheet target={sheet} today={data.today} onClose={() => setSheet(null)} />
      <PlanSearchSheet
        open={searchOpen}
        branch={data.branch}
        manage={data.manage}
        members={data.members}
        today={data.today}
        onClose={() => setSearchOpen(false)}
        onGo={(date, plan) => {
          setSearchOpen(false);
          goTo(date, "day");
          if (plan.mine) setSheet({ mode: "edit", plan, date: isRepeat(plan) ? date : null });
        }}
      />
      <PlanTrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
      <PlanScopeAsk
        open={!!ask}
        resize={ask?.kind === "resize"}
        from={askInfo?.from ?? ""}
        to={askInfo?.to ?? ""}
        following={askInfo?.following ?? null}
        busy={save.isPending}
        onPick={(s) => ask && doMove(ask, s)}
        onClose={() => setAsk(null)}
      />
    </div>
  );
};

// ───────────────────────── 내 일정 (3-2) — 보기 고르기 · 넘기기 · 보기 · 아래 줄 ─────────────────────────
const MineSection = ({
  data,
  rangeFn,
  view,
  onView,
  day,
  setDay,
  ym,
  setYm,
  today,
  thisMonth,
  canHoliday,
  onAdd,
  onOpenPlan,
  onMove,
  onGo,
  onSearch,
  onTrash,
  onHoliday,
}: {
  data: PlansWeek;
  rangeFn: boolean;
  view: MineView;
  onView: (v: MineView) => void;
  day: string;
  setDay: (d: string) => void;
  ym: string;
  setYm: (ym: string) => void;
  today: string;
  thisMonth: string;
  canHoliday: boolean;
  onAdd: (date: string, time?: { start: string; end: string }) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onMove: (m: PlanMove) => void;
  onGo: (date: string, v?: MineView) => void;
  onSearch: () => void;
  onTrash: () => void;
  onHoliday: (date: string, name: string) => void;
}) => {
  const found = data.members.find((m) => m.me);
  const me: Pick<PlanMember, "key" | "user_id"> = useMemo(
    () => ({ key: found?.key ?? data.me, user_id: found ? found.user_id : data.me }),
    [found, data.me],
  );
  const views = MINE_VIEWS.filter((v) => v.key !== "year" || rangeFn);
  const shown = views.some((v) => v.key === view) ? view : "month";
  const dates = shown === "day" ? [day] : shown === "3day" ? [day, addDays(day, 1), addDays(day, 2)] : weekDates(mondayOf(day));
  const year = Number(day.slice(0, 4));

  const step = (n: number) => {
    if (shown === "day") setDay(addDays(day, n));
    else if (shown === "3day") setDay(addDays(day, 3 * n));
    else if (shown === "week") setDay(addDays(day, 7 * n));
    else if (shown === "list") setDay(addDays(day, AGENDA_DAYS * n));
    else if (shown === "year") setDay(`${year + n}-${day.slice(5)}` <= `${year + n}-12-31` ? `${year + n}-01-01` : day);
  };
  const label =
    shown === "day"
      ? `${planDay(day)}${day === today ? " · 오늘" : ""}`
      : shown === "3day"
        ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 – ${Number(addDays(day, 2).slice(8, 10))}일`
        : shown === "week"
          ? mondayOf(day) === mondayOf(today)
            ? "이번 주"
            : weekRangeLabel(mondayOf(day))
          : shown === "list"
            ? `${day === today ? "오늘" : planDay(day)}부터 ${AGENDA_DAYS}일`
            : `${year}년`;
  const atToday =
    shown === "year" ? year === Number(today.slice(0, 4)) : shown === "week" ? mondayOf(day) === mondayOf(today) : day === today;

  const marks = useMemo(() => {
    const map = new Map<string, DayMark[]>();
    if (shown !== "month") return map;
    for (const mon of monthMondays(ym)) {
      for (let i = 0; i < 7; i++) {
        const d = addDays(mon, i);
        // 내 달력은 근무 시간도 — '일하는 날'이 보이게
        map.set(d, dayMarks([dayItems(data, me, d)], true));
      }
    }
    return map;
  }, [shown, ym, data, me]);

  return (
    <>
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">내 일정</h2>
          <div className="flex items-center gap-1.5">
            {rangeFn && (
              <button
                type="button"
                onClick={onSearch}
                aria-label="일정 찾기"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onAdd(shown === "list" || shown === "year" ? (day < today ? today : day) : day)}
              className="flex h-10 items-center gap-1 rounded-xl bg-foreground px-3.5 text-label font-black text-background active:scale-95"
            >
              <Plus className="h-4 w-4" /> 일정 넣기
            </button>
          </div>
        </div>

        {/* 보기 고르기 */}
        <div role="tablist" aria-label="보기" className="mt-3 flex gap-0.5 rounded-xl bg-secondary/70 p-1">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={shown === v.key}
              onClick={() => onView(v.key)}
              className={cn(
                "h-9 min-w-0 flex-1 rounded-lg text-label font-black transition-all active:scale-[0.98]",
                shown === v.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* 넘기기 */}
        <div className="mt-2 flex justify-center">
          {shown === "month" ? (
            <MonthSwitcher ym={ym} thisMonth={thisMonth} min={shiftYm(thisMonth, -6)} max={shiftYm(thisMonth, 12)} today={today} onChange={setYm} />
          ) : (
            <RangeNav label={label} atToday={atToday} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setDay(shown === "year" ? today : today)} />
          )}
        </div>

        {(shown === "day" || shown === "3day" || shown === "week") && (
          <OpsPlanTimeGrid
            data={data}
            dates={dates}
            me={me}
            today={today}
            onPickDay={(d) => (shown === "day" ? onAdd(d) : onGo(d, "day"))}
            onAdd={onAdd}
            onOpenPlan={onOpenPlan}
            onMove={onMove}
          />
        )}
        {shown === "month" && (
          <>
            <PlanMonthGrid ym={ym} marks={marks} selected={day} today={today} team={false} onPick={setDay} />
            <MarkLegend keys={presentMarks(marks, ym)} empty="이달은 잡힌 일정이 없어요" />
          </>
        )}
        {shown === "list" && (
          <OpsPlanAgenda data={data} from={day} me={me} today={today} canHoliday={canHoliday} onOpenPlan={onOpenPlan} onHoliday={onHoliday} />
        )}
        {shown === "year" && (
          <OpsPlanYear data={data} year={year} meUid={me.user_id} today={today} onPickDay={(d) => onGo(d, "day")} onPickMonth={(m) => { setYm(m); onView("month"); }} />
        )}

        {rangeFn && <PlanToolsRow briefOn={data.prefs?.brief_on !== false} onTrash={onTrash} />}
      </section>

      {shown === "month" && <MyDayCard data={data} me={me} day={day} today={today} canHoliday={canHoliday} onAdd={onAdd} onOpenPlan={onOpenPlan} onHoliday={onHoliday} />}
      <RepeatsCard data={data} onOpenPlan={onOpenPlan} />
      <WorkTabNote data={data} />
    </>
  );
};

/** 넘기기 — 가운데 이름을 누르면 오늘로 */
const RangeNav = ({ label, atToday, onPrev, onNext, onToday }: { label: string; atToday: boolean; onPrev: () => void; onNext: () => void; onToday: () => void }) => (
  <div className="flex items-center gap-1">
    <button type="button" onClick={onPrev} aria-label="앞으로" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95">
      <ChevronLeft className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={onToday}
      aria-label={atToday ? label : `${label} — 오늘로 돌아가기`}
      className="min-w-[9.5rem] text-center text-body font-black tabular-nums text-foreground"
    >
      {label}
    </button>
    <button type="button" onClick={onNext} aria-label="뒤로" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95">
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

/** 그날 공휴일 · 회원 생일 한 줄 (고른 날 카드 맨 위) */
const DayExtras = ({ data, date, today, canHoliday, onHoliday }: { data: PlansWeek; date: string; today: string; canHoliday: boolean; onHoliday: (date: string, name: string) => void }) => {
  const hol = holidayOn(date);
  const bdays = (data.birthdays ?? []).filter((b) => b.date === date);
  if (!hol && bdays.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {hol && <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-label font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{hol}</span>}
      {hol && canHoliday && date >= today && (
        <button type="button" onClick={() => onHoliday(date, hol)} className="text-label font-bold text-muted-foreground underline underline-offset-2">
          휴관으로 올리기
        </button>
      )}
      {bdays.map((b) => (
        <button
          key={b.user_id}
          type="button"
          onClick={() => openMemberCard(b.user_id)}
          className="rounded-full bg-amber-100 px-2.5 py-0.5 text-label font-bold text-amber-900 active:scale-95 dark:bg-amber-500/20 dark:text-amber-200"
        >
          🎂 {b.name}
        </button>
      ))}
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
    plan && isRepeat(plan) ? planRepeatLabel(plan) : null,
    plan?.location ?? null,
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
          <DayExtras data={data} date={date} today={data.today} canHoliday={false} onHoliday={() => undefined} />
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

// ───────────────────────── 반복 일정 (내 일정 — 매일 · 매주 · 매월 · 매년) ─────────────────────────
const RepeatsCard = ({ data, onOpenPlan }: { data: PlansWeek; onOpenPlan: (p: OpsPlan, date: string | null) => void }) => {
  const repeats = data.plans.filter((p) => p.mine && isRepeat(p));
  if (repeats.length === 0) return null;
  return (
    <section className={card}>
      <h2 className="text-heading font-black text-foreground">반복 일정</h2>
      <ul className="mt-2 divide-y divide-border">
        {repeats.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpenPlan(p, null)} className="flex w-full items-center gap-2 py-3 text-left active:bg-secondary/60">
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", PLAN_KIND_META[p.kind].chip)}>
                {PLAN_KIND_META[p.kind].label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{timeLabel(p.all_day, p.start_time, p.end_time)}</span>
                  {p.title && <span className="max-w-full truncate text-body text-foreground">{p.title}</span>}
                </span>
                <span className="block text-label text-muted-foreground">{planRepeatLabel(p)}</span>
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

// ───────────────────────── 내 일정 · 달력의 고른 날 (3-2 — 공휴일 · 생일 한 줄) ─────────────────────────
const MyDayCard = ({
  data,
  me,
  day,
  today,
  canHoliday,
  onAdd,
  onOpenPlan,
  onHoliday,
}: {
  data: PlansWeek;
  me: Pick<PlanMember, "key" | "user_id">;
  day: string;
  today: string;
  canHoliday: boolean;
  onAdd: (date: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onHoliday: (date: string, name: string) => void;
}) => {
  const items = dayItems(data, me, day);
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">
          {planDay(day)}
          {day === today ? " · 오늘" : ""}
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
      <DayExtras data={data} date={day} today={today} canHoliday={canHoliday} onHoliday={onHoliday} />
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
  );
};

export default OpsPlanTab;
