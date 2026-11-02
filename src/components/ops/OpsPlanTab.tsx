/**
 * 153운영본부 · 「일정」 탭 (2026-11-02 대표님 "직원 회의 관리 탭에 팀원들 스스로 스케줄 관리할 수 있는 기능 · 내가 팀원들의 스케줄을 한눈에")
 *
 *   팀 일정(대표님 · 그 지점 관리자 — 서버 ops_plans_week manage):
 *     한 주 일정판(사람 × 월~일, 칸마다 색 막대 — 「근무」 탭 근무 시간 · 수업 · PT · 업무 · 외부 · 휴무 · 개인)
 *     → 고른 날 누가 무엇을(근무 n · 휴무 n · 외부 n) → 최근 바뀐 일정(7일)
 *   내 일정(코치님은 이것만 — 서버가 본인 것만 보낸다):
 *     월~일 하루씩 근무 시간 + 내 일정 · 날마다 + · 매주 반복 목록 → 넣기 · 고치기 시트(OpsPlanSheet)
 *   코치님끼리는 서로 일정이 안 보인다(10/29 근무 시간 비공개와 같은 결). 일정은 근무 시간 · 급여와 따로 — 쉰 날 인정 · 대타 · 연장은 「근무」 탭.
 *   계산(반복 펼치기 · 하루 정리)은 src/lib/opsPlans.ts 한 곳.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import {
  PLAN_KINDS,
  PLAN_KIND_META,
  RECENT_ACTION,
  SHIFT_META,
  agoLabel,
  cellDots,
  dayItems,
  daySummary,
  isRepeat,
  itemChip,
  itemLabel,
  mondayOf,
  planDay,
  recentLine,
  repeatLabel,
  summaryLabel,
  timeLabel,
  weekDates,
  weekRangeLabel,
  type DayItem,
  type OpsPlan,
  type PlanMember,
  type PlansWeek,
} from "@/lib/opsPlans";
import { readOpsBranch, saveOpsBranch, shortBranch } from "@/services/opsService";
import { useOpsPlansWeek } from "@/services/opsPlanService";
import OpsPlanSheet, { type PlanSheetTarget } from "./OpsPlanSheet";
import { OpsChip, kstToday } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";

const mdLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

const OpsPlanTab = () => {
  const today = kstToday();
  const thisWeek = mondayOf(today);
  const [branch, setBranchState] = useState<string | null>(readOpsBranch);
  const [monday, setMonday] = useState(thisWeek);
  const [day, setDay] = useState(today);
  const [view, setView] = useState<"team" | "mine">("team");
  const [sheet, setSheet] = useState<PlanSheetTarget | null>(null);
  const q = useOpsPlansWeek(branch, monday);
  const data = q.data;

  // 주를 바꾸면 고른 날도 그 주로 — 오늘이 든 주면 오늘, 아니면 월요일
  useEffect(() => {
    const dates = weekDates(monday);
    setDay((d) => (dates.includes(d) ? d : dates.includes(today) ? today : monday));
  }, [monday, today]);

  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {data.branches.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {data.branches.map((b) => (
              <OpsChip key={b.branch} on={b.branch === data.branch} onClick={() => setBranch(b.branch)}>
                {shortBranch(b.branch)}
              </OpsChip>
            ))}
          </div>
        ) : (
          <p className="text-body font-black text-foreground">{shortBranch(data.branch)}</p>
        )}
        <WeekSwitcher monday={monday} thisWeek={thisWeek} onChange={setMonday} />
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

      <div className={cn("space-y-4 transition-opacity", q.isPlaceholderData && "opacity-60")}>
        {team ? (
          <TeamView data={data} day={day} setDay={setDay} onOpenPlan={openPlan} onJump={(d) => setMonday(mondayOf(d))} />
        ) : (
          <MyView data={data} onAdd={openNew} onOpenPlan={openPlan} />
        )}
      </div>

      <OpsPlanSheet target={sheet} today={data.today} onClose={() => setSheet(null)} />
    </div>
  );
};

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

// ───────────────────────── 팀 일정 (대표님 · 지점장) ─────────────────────────
const TeamView = ({
  data,
  day,
  setDay,
  onOpenPlan,
  onJump,
}: {
  data: PlansWeek;
  day: string;
  setDay: (d: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
  onJump: (date: string) => void;
}) => {
  const dates = useMemo(() => weekDates(data.from), [data.from]);
  const members = data.members;
  const grid = useMemo(() => {
    const m = new Map<string, DayItem[][]>();
    for (const mem of members) m.set(mem.key, dates.map((d) => dayItems(data, mem, d)));
    return m;
  }, [data, members, dates]);
  const selected = dates.includes(day) ? day : dates[0];
  const col = dates.indexOf(selected);
  const busy: Array<{ m: PlanMember; items: DayItem[] }> = [];
  const free: PlanMember[] = [];
  for (const m of members) {
    const items = grid.get(m.key)?.[col] ?? [];
    if (items.length) busy.push({ m, items });
    else free.push(m);
  }
  const summary = summaryLabel(daySummary(data, members, selected));
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.name ?? "팀원";

  return (
    <>
      {/* 주인공 — 한 주 일정판 */}
      <section className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-heading font-black text-foreground">팀 일정</h2>
          <span className="text-label text-muted-foreground">{members.length}명</span>
        </div>
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

      {/* 고른 날 — 누가 무엇을 */}
      <section className={card}>
        <h2 className="text-heading font-black text-foreground">
          {planDay(selected)}
          {selected === data.today ? " · 오늘" : ""}
        </h2>
        {summary && <p className="mt-0.5 text-label text-muted-foreground">{summary}</p>}
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
                      onClick={it.type === "plan" && it.plan.mine ? () => onOpenPlan(it.plan, isRepeat(it.plan) ? selected : null) : undefined}
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

      {/* 최근 바뀐 일정 — 7일 안, 내가 바꾼 것은 빼고 */}
      {data.recent.length > 0 && (
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
                    <button
                      type="button"
                      onClick={() => {
                        onJump(r.start_on);
                        setDay(r.start_on);
                      }}
                      className="block w-full py-2.5 text-left active:bg-secondary/60"
                    >
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
      )}
    </>
  );
};

// ───────────────────────── 내 일정 (코치님 · 관리자 본인) ─────────────────────────
const MyView = ({
  data,
  onAdd,
  onOpenPlan,
}: {
  data: PlansWeek;
  onAdd: (date: string) => void;
  onOpenPlan: (p: OpsPlan, date: string | null) => void;
}) => {
  const dates = weekDates(data.from);
  const me: Pick<PlanMember, "key" | "user_id"> = data.members.find((m) => m.me) ?? { key: data.me, user_id: data.me };
  const repeats = data.plans.filter((p) => p.mine && isRepeat(p));
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

      {repeats.length > 0 && (
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
      )}

      {!data.hq && <p className="px-1 text-label text-muted-foreground">휴무 인정 · 대타 · 연장 근무는 「근무」 탭에서 요청해요</p>}
    </>
  );
};

export default OpsPlanTab;
