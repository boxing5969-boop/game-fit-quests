/**
 * ⏱ 홈 '내 운동' (2026-10-22 대표님 · 처음 이름 '내 운동 시간')
 *   + 2026-10-22 대표님 ②: "총 며칠을 운동했고 한 달 동안 몇 시간을 운동했고 지난달 몇 시간을 운동했는지"
 *   "홈 화면에 기존 마일리지 정보 · 오늘의 시작 · 출석은 빼 주고, 한 달 총 몇 시간 · 전달 총 몇 시간 ·
 *    가장 많이 운동에 시간을 쏟은 달이 언제인지 상세하고 직관적으로" + "총 몇 번 나왔는지는 보여 주지 말고"
 *   2026-10-28 리디자인 (대표님 "위보고한 기준대로 전면 리 디자인하자" · 화면 규칙 7가지):
 *     · 홈의 내 운동 카드는 이것 하나 — 예전 '153과 함께하며' 큰 카드는 '내 운동 기록'(자세히)으로 옮겼다
 *     · 주인공 = 이번 달 운동 시간 (이번 달이 아직 0이면 지금까지) · 지난달보다 늘었을 때만 +칩
 *     · 한 줄: 이번 달 펀치 · 칼로리 / 작은 막대: 첫 기록이 있는 달부터 최근 6개월 (두 달째부터)
 *     · 작은 칸 3개(총 운동 · 지난달 · 최고 달)는 뺐다 — 막대가 같은 것을 그림으로 보여 준다
 *     · 맨 아래 '운동 기록 자세히 보기' 한 줄 (카드 어디를 눌러도 같은 곳)
 *   · 오늘 줄: 출석 전 'QR 출석'(칠금점처럼 얼굴 인식이 없는 지점) · 운동 중 '운동 종료' · 끝나면 오늘 시간.
 *   숫자는 서버 get_attendance_history 한 곳(useAttendanceHistory — 내정보 · 운동 기록과 같은 캐시).
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { weightBasis } from "@/lib/fitnessProfile153";
import { valueTotals } from "@/lib/healthGains153";
import { useFinishWorkout, useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { minutesToHours } from "@/lib/achievement153";
import { monthGain } from "@/lib/attendanceCheer";
import { bestMonthAllTime, monthLabel } from "@/lib/attendanceHistory";
import { formatMinutes } from "@/services/workoutTimeService";
import { cn } from "@/lib/utils";

const hrs = (min: number) => `${minutesToHours(min)}시간`;
const n = (v: number) => v.toLocaleString("ko-KR");
/** 최근 몇 달을 막대로 */
const BAR_MONTHS = 6;

/** 오늘 줄 — 출석 전 QR · 운동 중 종료 버튼 · 끝나면 오늘 시간 */
const TodayStrip = () => {
  const navigate = useNavigate();
  const { data, isPlaceholderData } = useMyWorkoutToday();
  const finish = useFinishWorkout();
  if (isPlaceholderData || !data) return null;

  if (!data.checked_in) {
    return (
      <button
        type="button"
        onClick={() => navigate("/qr-checkin")}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-secondary-foreground transition-transform active:scale-95"
        aria-label="QR 출석"
      >
        <QrCode className="h-4 w-4" aria-hidden />
        QR 출석
      </button>
    );
  }
  if (data.finished) {
    return (
      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-label font-bold text-primary">
        오늘 {formatMinutes(data.elapsed_minutes)} ✓
      </span>
    );
  }
  const onFinish = () => {
    if (finish.isPending) return;
    finish.mutate(null, {
      onSuccess: (res) => {
        if (!res.success) {
          toast.error(res.error || "종료 처리에 실패했습니다.");
          return;
        }
        if (res.already_finished) {
          toast.info("이미 종료했어요.");
          return;
        }
        const xp = res.xp_granted ?? 0;
        toast.success(`오늘 ${formatMinutes(res.minutes)} 운동했어요${xp > 0 ? ` · XP +${xp}` : ""} 🥊`);
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "종료 처리에 실패했습니다."),
    });
  };
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-label font-bold tabular-nums text-foreground">{formatMinutes(data.elapsed_minutes)}째</span>
      <button
        type="button"
        onClick={onFinish}
        disabled={finish.isPending}
        className="h-10 rounded-full bg-primary px-4 text-label font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
        aria-label="오늘 운동 종료하기"
      >
        {finish.isPending ? "처리 중" : "운동 종료"}
      </button>
    </span>
  );
};

const HomeWorkoutCard = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAttendanceHistory(null);
  // 이번 달 펀치 · 칼로리 — '153과 함께하며'와 같은 몸무게 기준(내 몸무게 → 남녀 평균 → 65kg)
  const { data: body } = useMyBodyInfo();
  const { data: extra } = useMyFitnessExtra();
  const openDetail = () => navigate("/mypage/attendance");

  const shell = (children: ReactNode) => (
    <section aria-label="내 운동" className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1", className)}>
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="min-w-0 truncate text-heading text-foreground">내 운동</h2>
        <TodayStrip />
      </div>
      {children}
    </section>
  );

  if (isLoading) return shell(<div className="mx-5 my-5 h-[150px] animate-pulse rounded-xl bg-muted/60" aria-label="운동 시간을 불러오는 중" />);
  if (isError || !data) {
    return shell(
      <div className="px-5 pb-5 pt-3">
        <p className="text-body text-muted-foreground">운동 시간을 불러오지 못했어요</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 h-11 rounded-xl bg-muted px-5 text-body font-bold text-foreground active:scale-[0.98]">
          다시 불러오기
        </button>
      </div>,
    );
  }
  if (data.total <= 0) {
    return shell(<p className="px-5 pb-5 pt-3 text-body leading-relaxed text-foreground">첫 출석부터 운동 시간이 쌓여요 🥊</p>);
  }

  // 이번 달이 아직 0이면(달이 막 바뀐 날) 지금까지 시간을 주인공으로
  const monthly = data.monthMinutes > 0;
  const gain = monthly ? monthGain(data.monthMinutes, data.lastMonthMinutes) : null;
  const first = data.monthly.findIndex((m) => m.minutes > 0);
  const bars = first < 0 ? [] : data.monthly.slice(first).slice(-BAR_MONTHS);
  const maxMin = Math.max(1, ...bars.map((m) => m.minutes));
  const thisMonth = data.monthly.length ? data.monthly[data.monthly.length - 1].month : null;
  const best = bestMonthAllTime(data.list);
  const monthValue = monthly && data.month > 0 ? valueTotals(data.month, data.monthMinutes, weightBasis(body?.weightKg, extra?.gender).kg) : null;

  return shell(
    <button
      type="button"
      onClick={openDetail}
      aria-label={`${monthly ? "이번 달" : "지금까지"} ${hrs(monthly ? data.monthMinutes : data.totalMinutes)} 운동 · 운동 기록 자세히 보기`}
      className="block w-full text-left active:bg-muted/30"
    >
      <div className="px-5 pb-5 pt-3">
        {/* 주인공 — 이번 달 운동 시간 */}
        <p className="text-label font-bold text-muted-foreground">{monthly ? "이번 달" : "지금까지"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-display tracking-tight tabular-nums text-foreground">
            {minutesToHours(monthly ? data.monthMinutes : data.totalMinutes)}
            <span className="ml-1.5 text-heading font-bold">시간</span>
          </p>
          {gain ? <span className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">지난달보다 +{hrs(gain)}</span> : null}
        </div>
        {monthValue && (
          <p className="mt-2 text-body text-foreground">
            펀치 <b className="tabular-nums">약 {n(monthValue.punches)}번</b> · <b className="tabular-nums">약 {n(monthValue.kcal)}kcal</b>
          </p>
        )}

        {/* 최근 몇 달 — 첫 기록이 있는 달부터 (이번 달 민트 · 가장 많이 한 달 금색) */}
        {bars.length > 1 && (
          <div className="mt-4" aria-hidden>
            <div className="flex h-16 items-end gap-2">
              {bars.map((m) => {
                const isNow = m.month === thisMonth;
                const isBest = !!best && m.month === best.month && !isNow;
                const h = m.minutes > 0 ? Math.max(6, Math.round((m.minutes / maxMin) * 64)) : 0;
                return (
                  <div key={m.month} className="flex min-w-0 flex-1 justify-center">
                    <span
                      className={cn("w-full max-w-[32px] rounded-t-md", isNow ? "bg-primary" : isBest ? "bg-reward/70" : "bg-primary/25")}
                      style={{ height: `${h}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-2 border-t border-border/70 pt-1.5">
              {bars.map((m) => (
                <span
                  key={m.month}
                  className={cn("min-w-0 flex-1 whitespace-nowrap text-center text-micro", m.month === thisMonth ? "font-black text-foreground" : "text-muted-foreground")}
                >
                  {monthLabel(m.month, true)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <span className="flex h-14 items-center justify-between border-t border-border px-5 text-body font-bold text-foreground">
        운동 기록 자세히 보기 <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
    </button>,
  );
};

export default HomeWorkoutCard;
