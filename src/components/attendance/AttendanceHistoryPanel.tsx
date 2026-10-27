/**
 * 📅 운동 기록 전체 화면 조각 — 회원 상세 '출석' 탭(관리자 · 지점장) · '내 운동 기록'(회원 본인) · 회원 내정보 보기가 같이 쓴다
 *   2026-10-22 대표님: "이번 달 · 지난달 총 몇 회 출석했는지 말고 총 몇 시간 운동했는지로 체크하자"
 *     → 주인공 숫자 = 운동 시간(지금까지), 월별 막대도 시간. 출석 횟수는 한 줄로 같이.
 *     운동 시간 = 서버 workout_minutes (두 번째 체크 · 운동 종료로 잰 시간 최대 180분, 없으면 66분) — 승급 · 랭킹과 같은 숫자.
 *   2026-10-28 리디자인 (대표님 "위보고한 기준대로 전면 리 디자인하자" · UX 보고서 화면 규칙 7가지):
 *     · 카드마다 주인공 하나 — 요약은 '지금까지 운동한 시간' 하나 + 출석 한 줄 (예전 작은 칸 3개는 뺐다: 같은 숫자가 7번 나왔다)
 *     · '이번 주' 7칸 — 온 날은 민트 동그라미, 몇 주 연속인지 · 응원 한 줄
 *     · 빈 것은 그리지 않는다 — 월별 막대는 첫 기록이 있는 달부터, 두 달째부터 보인다. 요일별은 출석 8번부터
 *     · 설명은 접는다 — 세는 규칙은 요약 카드의 ? 안으로 ('막대를 누르면 그 달' 같은 안내 줄도 뺐다)
 *     · 글씨는 6단계(13~40px)만
 *   · AttendanceSummaryCard — 요약 (+ 전체 보기 버튼)
 *   · AttendanceHistoryPanel — 요약 · 이번 주 · (afterWeek) · 월별 · 요일별 · 받은 출석 축하 · (beforeList) · 달별 목록
 *   숫자는 서버 get_attendance_history 한 곳 (hooks/useAttendanceHistory · lib/attendanceHistory).
 *   보는 사람(audience)마다 요약이 다르다:
 *     · member(회원 본인) — 잘한 것만: 지금까지 시간 · 출석 · 몇 월부터 함께 · 이번 주 · 연속 출석 주 · 응원 한 줄
 *       날 수(262일)는 쓰지 않는다 — '그 많은 날 중 겨우'로 읽힌다
 *     · staff(관리자 · 지점장) — 이번 달 · 지난달 운동 시간 · 연속 출석 주 + 최고 달 (줄어드는 회원을 먼저 챙기려고)
 *     · 주 평균은 어디에도 두지 않는다 (2026-10-21 대표님)
 */
import { useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, Check, ChevronDown, ChevronRight, CircleHelp } from "lucide-react";
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
import { attendanceCheer, kstToday, sinceLabel } from "@/lib/attendanceCheer";
import { CHECKOUT_WINDOW_HOURS, DEFAULT_SESSION_MINUTES, minutesToHours, weekMonday } from "@/lib/achievement153";
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
/** 회원 화면 — 요일별 막대는 출석이 이만큼 쌓여야 보인다 (그 전엔 막대 하나 · 0회 여섯 줄) */
const WEEKDAY_MIN_VISITS = 8;
/** 월별 막대 — 최근 몇 달까지 */
const MONTHS_SHOWN = 12;

const Card = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <section aria-label={label} className={cn("rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
    {children}
  </section>
);

const Mini = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl bg-muted/50 px-3 py-2.5">
    <p className="text-label font-bold text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-heading font-black tabular-nums text-foreground">{value}</p>
    {hint && <p className="text-label text-muted-foreground">{hint}</p>}
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
    className="mt-4 flex h-12 w-full items-center justify-center gap-1 rounded-xl bg-muted text-body font-bold text-foreground transition-transform active:scale-[0.98]"
  >
    운동 기록 전체 보기 <ChevronRight className="h-4 w-4" />
  </button>
);

/** ? 단추 — 누르면 아래에 설명이 펼쳐진다 (설명은 접기 — 화면 규칙 4) */
const HelpButton = ({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-label={label}
    className={cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
      open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
    )}
  >
    <CircleHelp className="h-5 w-5" aria-hidden />
  </button>
);

/** 운동 시간 세는 법 — 예전에 화면 맨 아래 작은 글씨 문단이던 것 */
const HowCounted = ({ since }: { since: string }) => (
  <ul className="mt-4 space-y-1.5 rounded-xl bg-muted/60 px-4 py-3 text-label leading-relaxed text-foreground">
    <li>출석은 하루 1번만 세요.</li>
    <li>
      운동이 끝나고 입구 얼굴 인식을 한 번 더 하면 그 시간까지(최대 {CHECKOUT_WINDOW_HOURS}시간) 운동 시간으로 쳐요. 안 하면 {DEFAULT_SESSION_MINUTES}분이에요.
    </li>
    <li>{longDate(since)}부터 센 기록이에요.</li>
  </ul>
);

/** 회원 본인 요약 — 주인공 하나: 지금까지 운동한 시간 (잘한 것만 · 주 평균 · 줄어든 비교 없음) */
const MemberSummary = ({ data, onOpenAll }: { data: AttendanceHistory; onOpenAll?: () => void }) => {
  const [how, setHow] = useState(false);
  const since = sinceLabel(data.firstDay, kstToday());
  return (
    <Card label="운동 요약">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-bold text-muted-foreground">지금까지 운동한 시간</p>
          <p className="mt-1 text-display tracking-tight tabular-nums text-foreground">
            {minutesToHours(data.totalMinutes)}
            <span className="ml-1.5 text-heading font-bold">시간</span>
          </p>
          <p className="mt-2 text-body text-foreground">
            {data.total > 0 ? (
              <>
                출석 <b className="tabular-nums">{n(data.total)}번</b>
                {since ? ` · ${since}` : ""}
              </>
            ) : (
              "첫 출석부터 쌓여요"
            )}
          </p>
        </div>
        <HelpButton open={how} onToggle={() => setHow((v) => !v)} label="운동 시간은 어떻게 세나요?" />
      </div>
      {how && <HowCounted since={data.recordsSince} />}
      {onOpenAll && <OpenAllButton onClick={onOpenAll} />}
    </Card>
  );
};

/** 관리자 · 지점장 요약 — 이번 달 · 지난달 운동 시간 · 연속 출석 주 + 최고 달 (주 평균 없음) */
const SummaryBody = ({ data, onOpenAll }: { data: AttendanceHistory; onOpenAll?: () => void }) => {
  const best = bestMonthAllTime(data.list);
  return (
    <Card label="운동 요약">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-bold text-muted-foreground">총 운동 시간</p>
          <p className="mt-1 text-display tracking-tight tabular-nums text-foreground">
            {minutesToHours(data.totalMinutes)}
            <span className="ml-1.5 text-heading font-bold">시간</span>
          </p>
          <p className="mt-2 text-body text-foreground">
            <b>{n(data.total)}번 출석</b>
            {data.firstDay && data.lastDay ? ` · 첫 기록 ${dayLabel(data.firstDay)} · 마지막 ${dayLabel(data.lastDay)}` : ""}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarCheck className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="이번 달" value={hrs(data.monthMinutes)} hint={`${n(data.month)}번 출석`} />
        <Mini label="지난달" value={hrs(data.lastMonthMinutes)} hint={`${n(data.lastMonth)}번 출석`} />
        <Mini label="연속 출석" value={`${n(data.weekStreak)}주`} hint={data.bestWeekStreak > 0 ? `최고 ${n(data.bestWeekStreak)}주` : undefined} />
      </div>
      {data.total > 0 && (
        <p className="mt-3 text-label text-muted-foreground">
          {best ? `가장 많이 한 달 ${monthLabel(best.month)} ${hrs(best.minutes)}` : "가장 많이 한 달 —"}
          {data.thisWeek ? " · 이번 주 출석 ✓" : ""}
        </p>
      )}
      {onOpenAll && <OpenAllButton onClick={onOpenAll} />}
    </Card>
  );
};

/** '2026-10-27' 이 든 주의 월 ~ 일 날짜 7개 (KST 날짜 문자열) */
const weekDates = (today: string): string[] => {
  const mon = weekMonday(today);
  if (!mon) return [];
  const t = Date.parse(`${mon}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(t + i * 86_400_000).toISOString().slice(0, 10));
};

/** 이번 주 — 월 ~ 일 7칸 (온 날은 민트 동그라미) + 몇 주 연속 + 응원 한 줄 (회원 본인) */
const WeekCard = ({ data }: { data: AttendanceHistory }) => {
  const today = kstToday();
  const dates = weekDates(today);
  const came = new Set(data.list.map((d) => d.day));
  const count = dates.filter((d) => came.has(d)).length;
  const cheer = attendanceCheer({ ...data, next: 0 });
  return (
    <Card label="이번 주">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-heading text-foreground">이번 주</h3>
        {data.weekStreak >= 2 ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">{n(data.weekStreak)}주 연속</span>
        ) : count > 0 ? (
          <span className="text-label font-bold text-foreground">{n(count)}번 왔어요</span>
        ) : null}
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={`이번 주 ${count}번 출석`}>
        {dates.map((d, i) => {
          const on = came.has(d);
          const isToday = d === today;
          return (
            <li key={d} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-micro", isToday ? "font-black text-foreground" : "text-muted-foreground")}>{WEEKDAY_KO[i]}</span>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  on ? "bg-primary text-primary-foreground" : isToday ? "ring-2 ring-primary/60" : "bg-muted",
                  !on && d > today && "opacity-50",
                )}
                aria-label={`${WEEKDAY_KO[i]}요일${on ? " 출석" : ""}`}
              >
                {on && <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
              </span>
            </li>
          );
        })}
      </ol>
      {data.total > 0 && (
        <p className="mt-4 flex items-start gap-2 text-body leading-snug text-foreground">
          <span aria-hidden>{cheer.emoji}</span>
          <span className="min-w-0">{cheer.text}</span>
        </p>
      )}
    </Card>
  );
};

const LoadError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="rounded-2xl border border-border bg-card p-5 text-center">
    <p className="text-body text-muted-foreground">출석 기록을 불러오지 못했어요</p>
    <button type="button" onClick={onRetry} className="mt-3 h-11 rounded-xl bg-muted px-5 text-body font-bold text-foreground active:scale-[0.98]">
      다시 불러오기
    </button>
  </div>
);

/** 월별 운동 시간 막대 — 첫 기록이 있는 달부터 (빈 달은 그리지 않는다). 누르면 그 달 숫자. 처음엔 이번 달 */
const MonthlyChart = ({ monthly }: { monthly: MonthCount[] }) => {
  const first = monthly.findIndex((m) => m.minutes > 0);
  const months = first < 0 ? [] : monthly.slice(first).slice(-MONTHS_SHOWN);
  const [picked, setPicked] = useState<string | null>(null);
  if (months.length < 2) return null;
  const sel = months.find((m) => m.month === picked) ?? months[months.length - 1];
  const max = Math.max(1, ...months.map((m) => m.minutes));
  const peak = bestMonthByMinutes(months);
  return (
    <Card label="월별 운동 시간">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-heading text-foreground">월별 운동 시간</h3>
        <p className="shrink-0 text-label text-foreground" aria-live="polite">
          <b>{monthLabel(sel.month, true)}</b> <span className="tabular-nums">{hrs(sel.minutes)}</span>
        </p>
      </div>
      <div className="mt-5 flex h-[132px] items-end gap-1.5 border-b border-border">
        {months.map((m) => {
          const h = (m.minutes / max) * 100;
          const on = m.month === sel.month;
          const isPeak = !!peak && peak.month === m.month && m.minutes > 0;
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => setPicked(m.month)}
              aria-label={`${monthLabel(m.month)} ${hrs(m.minutes)} · ${m.days}번 출석`}
              aria-pressed={on}
              className="relative flex h-full min-w-0 flex-1 items-end justify-center"
            >
              {isPeak && !on && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-micro font-bold text-reward" style={{ bottom: `calc(${h}% + 4px)` }}>
                  최고
                </span>
              )}
              <span
                className={cn(
                  "block w-full max-w-[28px] rounded-t-md transition-colors",
                  on ? "bg-primary" : isPeak ? "bg-reward/70" : "bg-primary/25",
                )}
                style={{ height: m.minutes > 0 ? `${Math.max(h, 3)}%` : "0%" }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {months.map((m) => (
          <span
            key={m.month}
            className={cn("min-w-0 flex-1 whitespace-nowrap text-center text-micro tabular-nums", m.month === sel.month ? "font-black text-foreground" : "text-muted-foreground")}
          >
            {monthLabel(m.month, true)}
          </span>
        ))}
      </div>
    </Card>
  );
};

/** 요일별 가로 막대 + 주로 오는 시간 — 회원은 출석 8번부터 (빈 막대 · 0회 줄 대신) */
const WeekdayChart = ({ data }: { data: AttendanceHistory }) => {
  const max = Math.max(1, ...data.weekday);
  const top = topWeekday(data.weekday);
  const hour = topHourBucket(data.hours);
  return (
    <Card label="요일별 출석">
      <h3 className="text-heading text-foreground">요일별</h3>
      {hour && (
        <p className="mt-1 text-label text-muted-foreground">
          주로 <b className="text-foreground">{hour.label}</b>({hour.range})에 와요
        </p>
      )}
      <div className="mt-4 space-y-2">
        {data.weekday.map((v, i) => (
          <div key={WEEKDAY_KO[i]} className="flex items-center gap-3">
            <span className={cn("w-5 text-label font-bold", i === top ? "text-foreground" : "text-muted-foreground")}>{WEEKDAY_KO[i]}</span>
            <div className="h-4 min-w-0 flex-1">
              {v > 0 && (
                <div
                  className={cn("h-full rounded-r-md", i === top ? "bg-primary" : "bg-primary/30")}
                  style={{ width: `${Math.max((v / max) * 100, 3)}%` }}
                />
              )}
            </div>
            <span className={cn("w-10 text-right text-label tabular-nums", i === top ? "font-bold text-foreground" : "text-muted-foreground")}>
              {v > 0 ? `${n(v)}회` : ""}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

/** 달별 출석 목록 — 처음엔 최근 달만 펼친다. 회원은 날짜 · 시각 · 운동 시간만 (지도진은 출석 방법 · 지점까지) */
const AttendanceList = ({ data, audience }: { data: AttendanceHistory; audience: AttendanceAudience }) => {
  const groups = useMemo(() => groupByMonth(data.list), [data.list]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.month)));
  const showBranch = useMemo(() => new Set(data.list.map((d) => d.branch ?? "")).size > 1, [data.list]);
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.month));
  const staff = audience === "staff";
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
        <h3 className="text-heading text-foreground">운동 기록 전체</h3>
        {groups.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.month)))}
            className="text-label font-bold text-muted-foreground underline-offset-2 active:underline"
          >
            {allOpen ? "모두 접기" : "모두 펼치기"}
          </button>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        {groups.map((g, gi) => {
          const isOpen = open.has(g.month);
          return (
            <div key={g.month} className={gi > 0 ? "border-t border-border" : ""}>
              <button
                type="button"
                onClick={() => toggle(g.month)}
                aria-expanded={isOpen}
                className="flex h-14 w-full items-center justify-between px-5 active:bg-muted/50"
              >
                <span className="text-body font-bold text-foreground">{monthLabel(g.month)}</span>
                <span className="flex items-center gap-2 text-label text-muted-foreground">
                  <span className="tabular-nums">
                    <b className="text-foreground">{hrs(g.items.reduce((a, d) => a + d.minutes, 0))}</b> · {n(g.items.length)}번
                  </span>
                  <ChevronDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              {isOpen && (
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {g.items.map((d) => {
                    const measured = measuredDay(d);
                    return (
                      <li key={d.day} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-body font-semibold tabular-nums text-foreground">
                            {dayLabel(d.day)} <span className="text-label font-medium text-muted-foreground">{kstTime(d.at)}</span>
                          </p>
                          {staff && (
                            <p className="truncate text-label text-muted-foreground">
                              {methodLabel(d.method)}
                              {showBranch && d.branch ? ` · ${shortBranch(d.branch)}` : ""}
                              {measured ? (d.endSource === "checkout_scan" ? ` · ~${kstTime(d.end as string)} 두 번째 체크` : ` · ~${kstTime(d.end as string)} 운동 종료`) : " · 기본 시간"}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{durationLabel(d.minutes)}</span>
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

/** 전체 — 요약 · 이번 주 · 그래프 · 받은 축하 · 목록 */
const AttendanceHistoryPanel = ({
  userId,
  enabled = true,
  audience = "member",
  afterWeek,
  beforeList,
}: {
  userId?: string | null;
  enabled?: boolean;
  audience?: AttendanceAudience;
  /** '이번 주' 바로 다음 — '내 운동 기록'의 다음 출석 축하 (2026-10-28) */
  afterWeek?: ReactNode;
  /** 그래프 · 받은 축하 다음, 날짜별 목록 앞에 끼울 카드 — '내 운동 기록'의 153과 함께하며 · 이룬 것 (2026-10-22) */
  beforeList?: ReactNode;
}) => {
  const { data, isLoading, isError, refetch } = useAttendanceHistory(userId, enabled);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="운동 기록을 불러오는 중">
        <div className="h-[178px] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-[160px] animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }
  if (isError || !data) return <LoadError onRetry={() => void refetch()} />;
  const member = audience !== "staff";

  return (
    <div className="space-y-3">
      {member ? <MemberSummary data={data} /> : <SummaryBody data={data} />}
      {member && <WeekCard data={data} />}
      {member && afterWeek}
      {data.total === 0 ? (
        member ? null : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-body text-muted-foreground">아직 출석 기록이 없어요</p>
          </div>
        )
      ) : (
        <>
          {data.monthly.length > 0 && <MonthlyChart monthly={data.monthly} />}
          {(!member || data.total >= WEEKDAY_MIN_VISITS) && <WeekdayChart data={data} />}
          {data.milestones.length > 0 && (
            <Card label="받은 출석 축하">
              <h3 className="text-heading text-foreground">받은 출석 축하</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.milestones.map((m) => (
                  <span
                    key={m.milestone}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-label font-bold text-foreground ring-1 ring-amber-500/30"
                  >
                    🏅 {n(m.milestone)}회
                    {m.reachedOn ? <span className="font-medium text-muted-foreground">· {dayLabel(m.reachedOn)}</span> : null}
                  </span>
                ))}
              </div>
            </Card>
          )}
          {beforeList}
          <AttendanceList data={data} audience={audience} />
        </>
      )}
      {!member && (
        <p className="px-1 text-label leading-relaxed text-muted-foreground">
          운동이 끝나면 입구 얼굴 인식을 한 번 더 하면 그 시간까지(최대 {CHECKOUT_WINDOW_HOURS}시간) 운동 시간으로 쳐요 · 안 하면 {DEFAULT_SESSION_MINUTES}분 ·
          출석은 하루 1번 · {longDate(data.recordsSince)}부터 센 기록이에요
        </p>
      )}
    </div>
  );
};

export default AttendanceHistoryPanel;
