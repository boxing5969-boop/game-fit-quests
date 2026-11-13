/**
 * 153운영본부 · 「일정」 — 연간 보기 · 캘린더 3-2단계 (2026-11-13 대표님 「3-2 시작」)
 *   한 해 12달을 두 줄씩 — 일정이 있는 날 = 민트 점 · 공휴일 = 빨간 글씨 · 오늘 = 테두리. 달 이름 = 그 달 달력, 날짜 = 그날 하루 보기.
 *   근무 시간은 날마다 있어 빼고 내 일정만 센다. 펼치기는 src/lib/opsRecur.ts recurDates(규칙은 한 번만 읽음).
 */
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { holidayOn } from "@/lib/krHolidays";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import { recurDates } from "@/lib/opsRecur";
import { WEEK_MON_FIRST, addDays, mondayOf, type PlansWeek } from "@/lib/opsPlans";

const OpsPlanYear = ({
  data,
  year,
  meUid,
  today,
  onPickDay,
  onPickMonth,
}: {
  data: PlansWeek;
  year: number;
  meUid: string | null;
  today: string;
  onPickDay: (date: string) => void;
  onPickMonth: (ym: string) => void;
}) => {
  const busy = useMemo(() => {
    const set = new Set<string>();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    for (const p of data.plans) {
      if (!meUid || p.user_id !== meUid) continue;
      for (const d of recurDates(p, from, to)) set.add(d);
    }
    return set;
  }, [data.plans, meUid, year]);

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
      {Array.from({ length: 12 }, (_, i) => {
        const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
        const first = `${ym}-01`;
        const last = new Date(Date.UTC(year, i + 1, 0)).toISOString().slice(0, 10);
        const days: string[] = [];
        for (let d = mondayOf(first); d <= last || weekdayOf(d) !== 1; d = addDays(d, 1)) days.push(d);
        const count = days.filter((d) => d.startsWith(`${ym}-`) && busy.has(d)).length;
        return (
          <section key={ym} aria-label={`${i + 1}월`}>
            <button type="button" onClick={() => onPickMonth(ym)} className="flex w-full items-baseline justify-between px-0.5 active:opacity-70">
              <span className={cn("text-body font-black", today.startsWith(ym) ? "text-primary" : "text-foreground")}>{i + 1}월</span>
              {count > 0 && <span className="text-micro font-bold text-muted-foreground">{count}일</span>}
            </button>
            <div className="mt-1 grid grid-cols-7" aria-hidden>
              {WEEK_MON_FIRST.map((wd) => (
                <span key={wd} className="text-center text-micro text-muted-foreground">
                  {OPS_WEEKDAY[wd]}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const inMonth = d.startsWith(`${ym}-`);
                if (!inMonth) return <span key={d} aria-hidden />;
                const hol = holidayOn(d);
                const has = busy.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onPickDay(d)}
                    aria-label={`${i + 1}월 ${Number(d.slice(8, 10))}일${hol ? ` · ${hol}` : ""}${has ? " · 일정 있음" : ""}`}
                    className="flex h-7 flex-col items-center justify-start"
                  >
                    <span
                      className={cn(
                        "whitespace-nowrap text-micro tabular-nums leading-5",
                        d === today ? "rounded-full px-0.5 font-black text-primary ring-1 ring-primary" : hol || weekdayOf(d) === 0 ? "text-rose-600" : "text-foreground",
                        has && d !== today && "font-black",
                      )}
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                    <span className={cn("h-1 w-1 rounded-full", has ? "bg-primary" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default OpsPlanYear;
