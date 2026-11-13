/**
 * 153운영본부 · 「일정」 — 목록 보기 · 캘린더 3-2단계 (2026-11-13 대표님 「3-2 시작」)
 *   고른 날부터 60일 — 일정이 있는 날만 날짜별로 · 한 번 하는 일정은 D-n · 공휴일(빨간 글씨 · 대표님 · 지점장님은 「휴관으로 올리기」) ·
 *   회원 생일(누르면 회원 카드). 근무 시간은 날마다 있어 빼고(일 · 주 보기에서).
 *   3-3 — 초대받은 일정(누가 · 내 답) · 손님 답 셈 · 겹쳐 그린 153 일정 · 정기 회의도 (누르면 답하기 · 보기)
 */
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { openMemberCard } from "@/lib/appEvents";
import { holidayOn } from "@/lib/krHolidays";
import {
  PLAN_AGENDA_DAYS as AGENDA_DAYS,
  addDays,
  dayItems,
  ddayLabel,
  guestLine,
  inviteLine,
  isInvitedPlan,
  isRepeat,
  planColorHex,
  planDay,
  planMeta,
  planOpenable,
  planRepeatLabel,
  planTitle,
  timeLabel,
  type DayItem,
  type OpsPlan,
  type PlanMember,
  type PlansWeek,
} from "@/lib/opsPlans";

const OpsPlanAgenda = ({
  data,
  from,
  me,
  today,
  canHoliday,
  onOpenPlan,
  onHoliday,
}: {
  data: PlansWeek;
  from: string;
  me: Pick<PlanMember, "key" | "user_id">;
  today: string;
  /** 대표님 · 지점장님 — 공휴일을 회원 달력 휴관으로 올릴 수 있다 */
  canHoliday: boolean;
  onOpenPlan: (plan: OpsPlan, date: string | null) => void;
  onHoliday: (date: string, name: string) => void;
}) => {
  const groups = useMemo(() => {
    const out: Array<{ date: string; items: Array<Extract<DayItem, { type: "plan" }>>; holiday: string | null; bdays: NonNullable<PlansWeek["birthdays"]> }> = [];
    for (let i = 0; i < AGENDA_DAYS; i++) {
      const d = addDays(from, i);
      const items = dayItems(data, me, d).filter((it): it is Extract<DayItem, { type: "plan" }> => it.type === "plan");
      const holiday = holidayOn(d);
      const bdays = (data.birthdays ?? []).filter((b) => b.date === d);
      if (items.length || holiday || bdays.length) out.push({ date: d, items, holiday, bdays });
    }
    return out;
  }, [data, from, me]);

  if (groups.length === 0) return <p className="mt-4 text-body text-muted-foreground">앞으로 {AGENDA_DAYS}일은 잡힌 일정이 없어요</p>;

  return (
    <ol className="mt-3 space-y-4">
      {groups.map((g) => {
        const rel = g.date === today ? "오늘" : g.date === addDays(today, 1) ? "내일" : null;
        return (
          <li key={g.date}>
            <div className="flex items-baseline gap-2">
              <h3 className={cn("text-body font-black", g.holiday ? "text-rose-600" : "text-foreground")}>
                {planDay(g.date)}
                {rel ? ` · ${rel}` : ""}
              </h3>
              {g.holiday && <span className="text-label font-bold text-rose-600">{g.holiday}</span>}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {g.items.map((it) => {
                const p = it.plan;
                const hex = planColorHex(p.color);
                const title = planTitle(p);
                const sub = [
                  p.layer === "event" ? (p.layer_kind ?? null) : null,
                  isInvitedPlan(p) ? inviteLine(p) : null,
                  p.focus ? "집중 시간" : null,
                  p.mine && (p.guests ?? []).length ? guestLine(p.guests) : null,
                  isRepeat(p) && !p.layer ? planRepeatLabel(p) : null,
                  p.location,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const open = planOpenable(p);
                // 여러 날 일정은 첫날에만 (둘째 날에 D-9 가 또 붙지 않게)
                const dday = !isRepeat(p) && g.date > today && g.date === p.start_on ? ddayLabel(g.date, today) : null;
                return (
                  <li key={`${p.id}:${g.date}`}>
                    <button
                      type="button"
                      onClick={() => open && onOpenPlan(p, isRepeat(p) ? g.date : null)}
                      className="flex w-full items-start gap-2 rounded-xl px-1 py-1 text-left active:bg-secondary/60"
                    >
                      <span
                        className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", !hex && planMeta(p).dot)}
                        style={hex ? { backgroundColor: hex } : undefined}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{timeLabel(it.allDay, it.start, it.end)}</span>
                          <span className="max-w-full truncate text-body text-foreground">{title}</span>
                        </span>
                        {sub && <span className="block truncate text-label text-muted-foreground">{sub}</span>}
                      </span>
                      {dday && <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 text-label font-black tabular-nums text-foreground">{dday}</span>}
                      {open && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {g.bdays.length > 0 && (
                <li className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-label font-bold text-muted-foreground">생일</span>
                  {g.bdays.map((b) => (
                    <button
                      key={b.user_id}
                      type="button"
                      onClick={() => openMemberCard(b.user_id)}
                      className="rounded-full bg-amber-100 px-2.5 py-0.5 text-label font-bold text-amber-900 active:scale-95 dark:bg-amber-500/20 dark:text-amber-200"
                    >
                      🎂 {b.name}
                    </button>
                  ))}
                </li>
              )}
              {g.holiday && canHoliday && g.date >= today && (
                <li className="px-1">
                  <button
                    type="button"
                    onClick={() => onHoliday(g.date, g.holiday as string)}
                    className="text-label font-bold text-muted-foreground underline underline-offset-2 active:scale-95"
                  >
                    회원 달력에 휴관으로 올리기
                  </button>
                </li>
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
};

export default OpsPlanAgenda;
