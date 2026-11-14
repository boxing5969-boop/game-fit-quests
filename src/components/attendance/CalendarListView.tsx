/**
 * 📋 운동 달력 '목록' 보기 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5 '보기: 목록')
 *   오늘부터 30일 — 날마다 내 일정 · 153 일정 · 같이 운동 · 할 일 마감 · D-day · 기념일 · 공휴일 · 내 생일 · 약속한 날(lib/calendarViews agendaDays).
 *   내 일정을 누르면 고치기 시트 · 그 밖은 그날 달력으로. 지난 날은 보이지 않는다(기대를 만드는 칸).
 *   WorkoutCalendar 가 '목록'을 고를 때만 받는 조각.
 */
import { Flag, Gift, Handshake, Plus, Star, Users } from "lucide-react";

import type { CalState } from "@/lib/calendarChecks";
import { agendaDays, type AgendaItem } from "@/lib/calendarViews";
import { REST_LABEL, mdwShort, type CalView, type MyEvent } from "@/lib/memberEvents";
import type { Promise153 } from "@/lib/promise153";
import { cn } from "@/lib/utils";

export interface CalendarListViewProps {
  cal: CalState | null;
  view: CalView;
  from: string;
  to: string;
  today: string;
  promise?: Promise153 | null;
  attended?: ReadonlySet<string>;
  loading?: boolean;
  onOpenEvent: (e: MyEvent, day: string) => void;
  onPickDay: (day: string) => void;
  onNew: (day: string) => void;
}

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};

const dayHead = (day: string, today: string): string => (day === today ? "오늘" : day === addDays(today, 1) ? "내일" : "");

const Lead = ({ item }: { item: AgendaItem }) => {
  switch (item.kind) {
    case "mine":
      return <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.hex }} aria-hidden />;
    case "event":
      return item.chip ? <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", item.chip.cls)}>{item.chip.label}</span> : null;
    case "call":
      return <Users className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />;
    case "todo":
      return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary" aria-hidden />;
    case "dday":
      return <Flag className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />;
    case "anniv":
      return <Star className="h-4 w-4 shrink-0 text-reward" fill="currentColor" aria-hidden />;
    case "birthday":
      return <Gift className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />;
    case "promise":
      return <Handshake className="h-4 w-4 shrink-0 text-primary" aria-hidden />;
    case "holiday":
      return <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />;
  }
};

const CalendarListView = ({ cal, view, from, to, today, promise, attended, loading, onOpenEvent, onPickDay, onNew }: CalendarListViewProps) => {
  const groups = cal ? agendaDays({ cal, view, from, to, today, promise, attended }) : [];
  return (
    <div className="mt-3" aria-label="앞으로 30일 목록">
      <button
        type="button"
        onClick={() => onNew(today)}
        className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50 bg-primary/5 text-body font-bold text-primary active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />내 일정 넣기
      </button>
      {loading && !cal ? (
        <p className="mt-3 text-label text-muted-foreground">불러오는 중…</p>
      ) : groups.length === 0 ? (
        <p className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">앞으로 30일은 비어 있어요 · 기대되는 날을 넣어 보세요</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {groups.map((g) => {
            const head = dayHead(g.day, today);
            const holiday = g.items.some((i) => i.kind === "holiday");
            return (
              <li key={g.day}>
                <p className={cn("flex items-baseline gap-1.5 text-label font-bold tabular-nums", holiday ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground")}>
                  {mdwShort(g.day)}
                  {head && <span className="text-foreground">{head}</span>}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {g.items.map((it) => (
                    <li key={it.key}>
                      <button
                        type="button"
                        onClick={() => (it.event ? onOpenEvent(it.event, g.day) : onPickDay(g.day))}
                        className="flex w-full items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2 text-left active:bg-muted"
                      >
                        <Lead item={it} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-body font-bold leading-snug", it.kind === "holiday" ? "text-rose-600 dark:text-rose-300" : "text-foreground")}>
                            {it.title}
                          </span>
                          {it.sub && <span className="block truncate text-label text-muted-foreground">{it.sub}</span>}
                        </span>
                        {it.rest && (
                          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-micro font-bold text-primary">{REST_LABEL}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default CalendarListView;
