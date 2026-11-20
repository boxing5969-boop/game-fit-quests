/**
 * 📅 수강권 시작일 고르기 — 결제 확인 창 (2026-11-20 대표님: "회원님들이 수강권 결제할때 시작일을 지정할수있게하자.
 *    미리등록하려는분들도있고 신규인데 다음주부터 하고싶은 사람도 있으니까")
 *
 *   · 기본 시작일(이어서 — 지금 수강권이 끝난 다음 날, 없으면 오늘)부터 30일 — 날짜 칸을 옆으로 넘겨 고른다.
 *   · 주인공은 이용 기간 한 줄("11월 27일(금) ~ 12월 26일(토)"), 회색 설명은 한 줄만.
 *   계산은 lib/cartPricing(startBounds · startDays · itemPeriod) — 서버(payssam-create-bill · DB apply_payment_order)와 같은 식.
 */
import { Fragment, useEffect, useRef } from "react";
import { dayText, startDays, startHint, weekdayOf, type StartBounds } from "@/lib/cartPricing";
import { cn } from "@/lib/utils";

interface Props {
  bounds: StartBounds;
  /** 고른 날 (기본 시작일이면 bounds.min) */
  value: string;
  onChange: (d: string) => void;
  /** 이 수강권 이용 기간 */
  period: { start: string; end: string };
  today: string;
  className?: string;
}

const PassStartPicker = ({ bounds, value, onChange, period, today, className }: Props) => {
  const days = startDays(bounds);
  const stripRef = useRef<HTMLDivElement>(null);
  const picked = days.includes(value) ? value : bounds.min;

  // 다시 열었을 때 고른 날이 보이게 — 가로로만 옮긴다(창이 위아래로 흔들리지 않게)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-day="${picked}"]`);
    if (!strip || !el) return;
    strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2);
    // 처음 열 때만 (고를 때마다 옮기면 손가락 밑에서 칸이 달아난다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={cn("rounded-xl border border-border bg-background p-3", className)} aria-label="수강권 시작일">
      <p className="text-body font-black text-foreground">언제부터 다닐까요?</p>

      <div
        ref={stripRef}
        role="radiogroup"
        aria-label="시작일"
        className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d, i) => {
          const on = d === picked;
          const dayNum = Number(d.slice(8, 10));
          const wd = weekdayOf(d);
          return (
            <Fragment key={d}>
              {(i === 0 || dayNum === 1) && (
                <span className="flex shrink-0 items-center px-0.5 text-label font-black text-muted-foreground" aria-hidden>
                  {Number(d.slice(5, 7))}월
                </span>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={dayText(d, today)}
                data-day={d}
                onClick={() => onChange(d)}
                className={cn(
                  "flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset transition-colors active:scale-95",
                  on ? "bg-primary text-primary-foreground ring-primary" : "bg-muted/40 text-foreground ring-border",
                )}
              >
                <span
                  className={cn(
                    "text-micro font-bold leading-none",
                    on ? "text-primary-foreground" : d === today ? "text-primary" : wd === "일" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {d === today ? "오늘" : wd}
                </span>
                <span className="mt-1 text-body font-black leading-none tabular-nums">{dayNum}</span>
              </button>
            </Fragment>
          );
        })}
      </div>

      <p className="mt-2 text-body font-black tabular-nums text-foreground" aria-live="polite">
        {/* 글씨 크게에서 줄이 바뀌어도 날짜 하나는 한 줄에 */}
        <span className="whitespace-nowrap">{dayText(period.start, today)}</span> ~{" "}
        <span className="whitespace-nowrap">{dayText(period.end, today)}</span>
      </p>
      <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">{startHint(bounds, picked, today)}</p>
    </section>
  );
};

export default PassStartPicker;
