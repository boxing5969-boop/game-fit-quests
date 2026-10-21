/**
 * 📅 운동 기록 전체 화면 조각 — 회원 상세 '출석' 탭(관리자 · 지점장) · '내 운동 기록'(회원 본인) · 회원 내정보 보기가 같이 쓴다
 *   2026-10-22 대표님: "이번 달 · 지난달 총 몇 회 출석했는지 말고 총 몇 시간 운동했는지로 체크하자"
 *     → 주인공 숫자 = 운동 시간(지금까지), 이번 달 · 지난달 · 월별 막대도 시간. 출석 횟수는 작은 글씨로 같이.
 *     운동 시간 = 서버 workout_minutes (두 번째 체크 · 운동 종료로 잰 시간 최대 180분, 없으면 66분) — 승급 · 랭킹과 같은 숫자.
 *   · AttendanceSummaryCard — 요약 (+ 전체 보기 버튼)
 *   · AttendanceHistoryPanel — 요약 + 월별 운동 시간 막대(누르면 그 달) + 요일별 · 주로 오는 시간 + 받은 출석 축하 + 달별 목록
 *   숫자는 서버 get_attendance_history 한 곳 (hooks/useAttendanceHistory · lib/attendanceHistory).
 *   그래프: 한 계열이라 범례 없음 · 민트 한 색(고른 달 · 가장 많은 요일만 진하게) · 값은 고른 막대와 막대 끝에만 · 목록이 표 역할.
 *   보는 사람(audience)마다 요약이 다르다:
 *     · member(회원 본인) — 잘한 것만: 몇 월부터 함께 · 이번 달(늘었을 때만 +N시간) · 연속 출석 주 · 최고 기록 달 · 응원 한 줄
 *       날 수(262일)는 쓰지 않는다 — '그 많은 날 중 겨우'로 읽힌다
 *     · staff(관리자 · 지점장) — 이번 달 · 지난달 운동 시간 · 연속 출석 주 + 최고 달 (줄어드는 회원을 먼저 챙기려고)
 *     · 주 평균은 어디에도 두지 않는다 (2026-10-21 대표님)
 */
import { useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, ChevronDown, ChevronRight } from "lucide-react";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import {
  WEEKDAY_KO,
  bestMonthAllTime,
  bestMonthByMinutes,
  dayLabel,
  durationLabel,
  groupByMonth,
  kstTime,
  measuredDay,
  methodLabel,
  monthLabel,
  topHourBucket,
  topWeekday,
  type AttendanceHistory,
  type MonthCount,
} from "@/lib/attendanceHistory";
import { attendanceCheer, kstToday, monthGain, sinceLabel } from "@/lib/attendanceCheer";
import { CHECKOUT_WINDOW_HOURS, DEFAULT_SESSION_MINUTES, minutesToHours } from "@/lib/achievement153";
import { cn } from "@/lib/utils";

export type AttendanceAudience = "member" | "staff";

const n = (v: number) => v.toLocaleString("ko-KR");
const hrs = (min: number) => `${minutesToHours(min)}시간`;
const shortBranch = (b: string) => b.replace(/^153복싱짐\s*/, "");
/** '2026-02-01' → '2026년 2월 1일' */
const longDate = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : ymd;
};

const Card = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <section aria-label={label} className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
    {children}
  </section>
);

const Mini = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl bg-muted/50 px-3 py-2.5">
    <p className="text-[11.5px] font-bold text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-[17px] font-black tabular-nums text-foreground">{value}</p>
    {hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}
  </div>
);

/** 요약 카드 — 데이터를 직접 읽는다(같은 캐시). onOpenAll 이 있으면 '운동 기록 전체 보기' 버튼 */
export const AttendanceSummaryCard = ({
  userId,
  onOpenAll,
  enabled = true,
  audience = "member",
}: {
  userId?: string | null;
  onOpenAll?: () => void;
  enabled?: boolean;
  audience?: AttendanceAudience;
}) => {
  const { data, isLoading, isError, refetch } = useAttendanceHistory(userId, enabled);
  if (isLoading) return <div className="h-[178px] animate-pulse rounded-2xl border border-border bg-card" aria-label="운동 기록을 불러오는 중" />;
  if (isError || !data) return <LoadError onRetry={() => void refetch()} />;
  return audience === "staff" ? <SummaryBody data={data} onOpenAll={onOpenAll} /> : <MemberSummary data={data} onOpenAll={onOpenAll} />;
};

const OpenAllButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-muted text-[13.5px] font-bold text-foreground transition-transform active:scale-[0.98]"
  >
    운동 기록 전체 보기 <ChevronRight className="h-4 w-4" />
  </button>
);

/** 주인공 숫자 — 총 운동 시간 + 출석 횟수 한 줄 */
const Hero = ({ data, sub }: { data: AttendanceHistory; sub: string }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[12px] font-bold text-muted-foreground">총 운동 시간</p>
      <p className="mt-1 text-[40px] font-black leading-none tracking-tight tabular-nums text-foreground">
        {minutesToHours(data.totalMinutes)}
        <span className="ml-1 text-[16px] font-bold text-muted-foreground">시간</span>
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        <b className="text-foreground">{n(data.total)}번 출석</b> · {sub}
      </p>
    </div>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <CalendarCheck className="h-5 w-5" />
    </span>
  </div>
);

/** 회원 본인 요약 — 잘한 것만 센다 (주 평균 · 줄어든 비교 없음) */
const MemberSummary = ({ data, onOpenAll }: { data: AttendanceHistory; onOpenAll?: () => void }) => {
  const gain = monthGain(data.monthMinutes, data.lastMonthMinutes);
  const next = (Math.floor(data.total / 50) + 1) * 50;
  const cheer = attendanceCheer({ ...data, next });
  const best = bestMonthAllTime(data.list);
  return (
    <Card label="운동 요약">
      <Hero data={data} sub={sinceLabel(data.firstDay, kstToday()) ?? "첫 출석을 하면 쌓여요"} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini
          label="이번 달"
          value={hrs(data.monthMinutes)}
          hint={gain ? `지난달보다 +${hrs(gain)}` : `${n(data.month)}번 출석${data.thisWeek ? " · 이번 주 ✓" : ""}`}
        />
        <Mini
          label="연속 출석"
          value={`${n(data.weekStreak)}주`}
          hint={data.weekStreak > 0 && data.weekStreak >= data.bestWeekStreak ? "내 최고 기록" : data.bestWeekStreak > 0 ? `최고 ${n(data.bestWeekStreak)}주` : undefined}
        />
        <Mini label="최고 기록" value={best ? `${monthLabel(best.month, true)} ${hrs(best.minutes)}` : "—"} hint="가장 많이 한 달" />
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] font-bold leading-snug text-foreground">
        <span aria-hidden>{cheer.emoji}</span>
        <span className="min-w-0">{cheer.text}</span>
      </p>
      {onOpenAll && <OpenAllButton onClick={onOpenAll} />}
    </Card>
  );
};

/** 관리자 · 지점장 요약 — 이번 달 · 지난달 운동 시간 · 연속 출석 주 + 최고 달 (주 평균 없음) */
const SummaryBody = ({ data, onOpenAll }: { data: AttendanceHistory; onOpenAll?: () => void }) => {
  const best = bestMonthAllTime(data.list);
  return (
    <Card label="운동 요약">
      <Hero
        data={data}
        sub={data.firstDay && data.lastDay ? `첫 기록 ${dayLabel(data.firstDay)} · 마지막 ${dayLabel(data.lastDay)}` : "아직 출석 기록이 없어요"}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label="이번 달" value={hrs(data.monthMinutes)} hint={`${n(data.month)}번 출석`} />
        <Mini label="지난달" value={hrs(data.lastMonthMinutes)} hint={`${n(data.lastMonth)}번 출석`} />
        <Mini label="연속 출석" value={`${n(data.weekStreak)}주`} hint={data.bestWeekStreak > 0 ? `최고 ${n(data.bestWeekStreak)}주` : undefined} />
      </div>
      {data.total > 0 && (
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          {best ? `가장 많이 한 달 ${monthLabel(best.month)} ${hrs(best.minutes)}` : "가장 많이 한 달 —"}
          {data.thisWeek ? " · 이번 주 출석 ✓" : ""}
        </p>
      )}
      {onOpenAll && <OpenAllButton onClick={onOpenAll} />}
    </Card>
  );
};

const LoadError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="rounded-2xl border border-border bg-card p-4 text-center">
    <p className="text-sm text-muted-foreground">출석 기록을 불러오지 못했어요</p>
    <button type="button" onClick={onRetry} className="mt-2 h-10 rounded-xl bg-muted px-4 text-sm font-bold text-foreground active:scale-[0.98]">
      다시 불러오기
    </button>
  </div>
);

/** 월별 운동 시간 막대 — 누르면 그 달 숫자. 처음엔 이번 달 */
const MonthlyChart = ({ monthly }: { monthly: MonthCount[] }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const sel = monthly.find((m) => m.month === picked) ?? monthly[monthly.length - 1];
  const max = Math.max(1, ...monthly.map((m) => m.minutes));
  const peak = bestMonthByMinutes(monthly);
  return (
    <Card label="월별 운동 시간">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-black text-foreground">월별 운동 시간</h3>
        <span className="text-[11.5px] text-muted-foreground">막대를 누르면 그 달</span>
      </div>
      <p className="mt-1 text-[13px] text-foreground" aria-live="polite">
        <b>{monthLabel(sel.month)}</b> · {hrs(sel.minutes)} <span className="text-muted-foreground">({n(sel.days)}번 출석)</span>
      </p>
      <div className="relative mt-2 h-[140px]">
        {/* 맨 위 기준선 = 가장 많은 달 */}
        <div className="absolute inset-x-0 top-5 border-t border-border/70" aria-hidden />
        <span className="absolute right-0 top-1 text-[10.5px] tabular-nums text-muted-foreground" aria-hidden>
          {hrs(max)}
        </span>
        <div className="absolute inset-x-0 bottom-0 top-5 flex items-end gap-1 border-b border-border">
          {monthly.map((m) => {
            const h = (m.minutes / max) * 100;
            const on = m.month === sel.month;
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => setPicked(m.month)}
                aria-label={`${monthLabel(m.month)} ${hrs(m.minutes)} · ${m.days}번 출석`}
                aria-pressed={on}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                {on && m.minutes > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black tabular-nums text-foreground"
                    style={{ bottom: `calc(${h}% + 3px)` }}
                  >
                    {minutesToHours(m.minutes)}
                  </span>
                )}
                <span
                  className={cn(
                    "block w-full max-w-[22px] rounded-t-[4px] transition-colors",
                    on ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/45",
                  )}
                  style={{ height: m.minutes > 0 ? `${Math.max(h, 3)}%` : "0%" }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1" aria-hidden>
        {monthly.map((m) => (
          <span
            key={m.month}
            className={cn("min-w-0 flex-1 text-center text-[10.5px]", m.month === sel.month ? "font-black text-foreground" : "text-muted-foreground")}
          >
            {monthLabel(m.month, true)}
          </span>
        ))}
      </div>
      {peak && (
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          가장 많이 한 달 · {monthLabel(peak.month)} {hrs(peak.minutes)} ({n(peak.days)}번 출석)
        </p>
      )}
    </Card>
  );
};

/** 요일별 가로 막대 + 주로 오는 시간 */
const WeekdayChart = ({ data }: { data: AttendanceHistory }) => {
  const max = Math.max(1, ...data.weekday);
  const top = topWeekday(data.weekday);
  const hour = topHourBucket(data.hours);
  const pct = hour && data.total > 0 ? Math.round((hour.count / data.total) * 100) : 0;
  return (
    <Card label="요일별 출석">
      <h3 className="text-[15px] font-black text-foreground">요일별</h3>
      <div className="mt-3 space-y-1.5">
        {data.weekday.map((v, i) => (
          <div key={WEEKDAY_KO[i]} className="flex items-center gap-2.5">
            <span className={cn("w-4 text-[12.5px] font-bold", i === top ? "text-foreground" : "text-muted-foreground")}>{WEEKDAY_KO[i]}</span>
            <div className="h-3.5 min-w-0 flex-1">
              {v > 0 && (
                <div
                  className={cn("h-full rounded-r-[4px]", i === top ? "bg-primary" : "bg-primary/30")}
                  style={{ width: `${Math.max((v / max) * 100, 2)}%` }}
                />
              )}
            </div>
            <span className={cn("w-10 text-right text-[12px] tabular-nums", i === top ? "font-bold text-foreground" : "text-muted-foreground")}>
              {n(v)}회
            </span>
          </div>
        ))}
      </div>
      {hour && (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[12.5px] text-foreground">
          주로 <b>{hour.label}</b>({hour.range})에 와요 · 전체의 {pct}%
        </p>
      )}
    </Card>
  );
};

/** 달별 출석 목록 — 처음엔 최근 달만 펼친다 */
const AttendanceList = ({ data }: { data: AttendanceHistory }) => {
  const groups = useMemo(() => groupByMonth(data.list), [data.list]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.month)));
  const showBranch = useMemo(() => new Set(data.list.map((d) => d.branch ?? "")).size > 1, [data.list]);
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.month));
  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  return (
    <section aria-label="운동 기록 전체">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[15px] font-black text-foreground">운동 기록 전체</h3>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.month)))}
          className="text-[12px] font-bold text-muted-foreground underline-offset-2 active:underline"
        >
          {allOpen ? "모두 접기" : "모두 펼치기"}
        </button>
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        {groups.map((g, gi) => {
          const isOpen = open.has(g.month);
          return (
            <div key={g.month} className={gi > 0 ? "border-t border-border" : ""}>
              <button
                type="button"
                onClick={() => toggle(g.month)}
                aria-expanded={isOpen}
                className="flex h-12 w-full items-center justify-between px-4 active:bg-muted/50"
              >
                <span className="text-[14px] font-bold text-foreground">{monthLabel(g.month)}</span>
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <b className="tabular-nums text-foreground">{hrs(g.items.reduce((a, d) => a + d.minutes, 0))}</b>
                  <span className="tabular-nums">· {n(g.items.length)}번</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              {isOpen && (
                <ul className="divide-y divide-border/60 border-t border-border/60 bg-muted/20">
                  {g.items.map((d) => {
                    const measured = measuredDay(d);
                    return (
                      <li key={d.day} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold tabular-nums text-foreground">
                            {dayLabel(d.day)} <span className="font-medium text-muted-foreground">{kstTime(d.at)}</span>
                          </p>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {methodLabel(d.method)}
                            {showBranch && d.branch ? ` · ${shortBranch(d.branch)}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-[12.5px] font-bold tabular-nums text-foreground">{durationLabel(d.minutes)}</span>
                          <span className="block text-[10.5px] text-muted-foreground">
                            {measured ? (d.endSource === "checkout_scan" ? `~${kstTime(d.end as string)} 두 번째 체크` : `~${kstTime(d.end as string)} 운동 종료`) : "기본"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/** 전체 — 요약 · 그래프 · 받은 축하 · 목록 */
const AttendanceHistoryPanel = ({
  userId,
  enabled = true,
  audience = "member",
}: {
  userId?: string | null;
  enabled?: boolean;
  audience?: AttendanceAudience;
}) => {
  const { data, isLoading, isError, refetch } = useAttendanceHistory(userId, enabled);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="운동 기록을 불러오는 중">
        <div className="h-[178px] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-[230px] animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }
  if (isError || !data) return <LoadError onRetry={() => void refetch()} />;

  return (
    <div className="space-y-3">
      {audience === "staff" ? <SummaryBody data={data} /> : <MemberSummary data={data} />}
      {data.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">아직 출석 기록이 없어요</p>
          <p className="mt-1 text-[12px] text-muted-foreground">체육관 출석(얼굴 인식 · QR)을 하면 여기에 쌓여요</p>
        </div>
      ) : (
        <>
          {data.monthly.length > 0 && <MonthlyChart monthly={data.monthly} />}
          <WeekdayChart data={data} />
          {data.milestones.length > 0 && (
            <Card label="받은 출석 축하">
              <h3 className="text-[15px] font-black text-foreground">받은 출석 축하</h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {data.milestones.map((m) => (
                  <span
                    key={m.milestone}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[12px] font-bold text-foreground ring-1 ring-amber-500/30"
                  >
                    🏅 {n(m.milestone)}회
                    {m.reachedOn ? <span className="font-medium text-muted-foreground">· {dayLabel(m.reachedOn)}</span> : null}
                  </span>
                ))}
              </div>
            </Card>
          )}
          <AttendanceList data={data} />
        </>
      )}
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        운동이 끝나면 입구 얼굴 인식을 한 번 더 하면 그 시간까지(최대 {CHECKOUT_WINDOW_HOURS}시간) 운동 시간으로 쳐요 · 안 하면 {DEFAULT_SESSION_MINUTES}분 ·
        출석은 하루 1번 · {longDate(data.recordsSince)}부터 센 기록이에요
      </p>
    </div>
  );
};

export default AttendanceHistoryPanel;
