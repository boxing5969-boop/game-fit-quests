/**
 * 📋 오늘(또는 다음) 수업 카드 — 훈련 탭·수업 루틴 화면 (2026-09-30 대표님 매뉴얼).
 *
 * 몇 일차인지는 서버(get_lesson_today)가 출석으로 정한다: 오늘 왔으면 그날, 아직이면 다음 날.
 * 오늘 체크인으로 방금 승급했다면 오늘 수업은 지난 레벨의 마지막 날 + 축하 한 줄.
 * 수업이 아직 없는 레벨(3 이상)이면 카드를 숨긴다 (showEmpty 면 '준비 중' 한 줄).
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLessonDays, useLessonToday } from "@/hooks/useLessonDays";
import { levelShort, resolveDay, shortAmount, todayHeadline } from "@/lib/lessonDays";
import { cn } from "@/lib/utils";

interface Props {
  /** 누르면 — 기본은 수업 루틴 화면에서 그날을 연다 */
  onOpen?: (dayNo: number) => void;
  /** 수업이 없는 레벨일 때 '준비 중' 안내를 보여 줄지 */
  showEmpty?: boolean;
  className?: string;
}

const MAX_CHIPS = 5;

const LessonTodayCard = ({ onOpen, showEmpty = false, className }: Props) => {
  const navigate = useNavigate();
  const { data: today, isLoading: todayLoading } = useLessonToday();
  const { byDayNo, isLoading: daysLoading } = useLessonDays();

  if (todayLoading || daysLoading) {
    return <div className={cn("h-[132px] animate-pulse rounded-3xl bg-muted", className)} aria-hidden />;
  }

  const day = today?.dayNo != null ? byDayNo.get(today.dayNo) : undefined;
  if (!today || !day) {
    if (!showEmpty || !today) return null;
    return (
      <p className={cn("rounded-2xl bg-muted/50 px-4 py-3 text-[12.5px] leading-snug text-muted-foreground", className)}>
        {levelShort(today.currentLevel)} 수업 매뉴얼은 준비 중이에요 · 아래에서 지난 수업을 복습할 수 있어요
      </p>
    );
  }

  const { steps, repeatOf } = resolveDay(day, byDayNo);
  const chips = steps.slice(0, MAX_CHIPS);
  const more = steps.length - chips.length;
  const nextDay = byDayNo.get(day.dayNo + 1);
  const open = () => (onOpen ? onOpen(day.dayNo) : navigate(`/routines?day=${day.dayNo}`));

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "block w-full rounded-3xl border border-border bg-card p-4 text-left shadow-elev-1 transition-transform active:scale-[0.99]",
        className,
      )}
      aria-label={`${todayHeadline(today)} ${day.dayNo}일차 — ${day.title}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-black text-primary">
          📋 {todayHeadline(today)} · {levelShort(day.level)}
        </span>
        <span className="flex shrink-0 items-center text-[11.5px] font-bold text-muted-foreground">
          수업 보기 <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[24px] font-black leading-none tabular-nums text-foreground">{day.dayNo}일차</span>
        <span className="min-w-0 truncate text-[14px] font-bold text-foreground">{day.title}</span>
      </p>
      {today.promotedToday && (
        <p className="mt-1.5 text-[12px] font-bold text-reward">
          🎉 오늘 {levelShort(today.currentLevel)} 달성!{nextDay ? ` 다음 수업은 ${nextDay.dayNo}일차` : ""}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {repeatOf && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11.5px] font-bold text-primary">
            {repeatOf.dayNo}일차 반복
          </span>
        )}
        {chips.map((s, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11.5px] font-bold",
              s.isNew && !repeatOf ? "bg-reward/20 text-reward" : "bg-secondary text-muted-foreground",
            )}
          >
            {s.name.replace(/\s*\(.*?\)\s*/g, "")}
            {s.amount ? ` ${shortAmount(s.amount)}` : ""}
          </span>
        ))}
        {more > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">+{more}</span>
        )}
      </div>
    </button>
  );
};

export default LessonTodayCard;
