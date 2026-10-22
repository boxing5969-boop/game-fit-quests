/**
 * ⏱ 홈 '내 운동 시간' (2026-10-22 대표님)
 *   + 2026-10-22 대표님 ②: "총 며칠을 운동했고 한 달 동안 몇 시간을 운동했고 지난달 몇 시간을 운동했는지"
 *     → 칸 3개(총 운동일 · 지난달 · 가장 많이 한 달) + 이번 달 숫자 밑에 '이번 달 뻗은 펀치 · 칼로리'.
 *     (오전의 "총 몇 번 나왔는지는 보여 주지 말고"를 이 지시로 바꿈 — 횟수가 아니라 '운동한 날'로 쌓인 것만 보여 준다)
 *   "홈 화면에 기존 마일리지 정보 · 오늘의 시작 · 출석은 빼 주고, 한 달 총 몇 시간 · 전달 총 몇 시간 ·
 *    가장 많이 운동에 시간을 쏟은 달이 언제인지 상세하고 직관적으로" + "총 몇 번 나왔는지는 보여 주지 말고"
 *
 *   · 주인공 숫자 = 이번 달 운동 시간. 지난달 · 가장 많이 한 달(지금까지) · 최근 6개월 막대.
 *   · 출석 횟수는 쓰지 않는다 — 횟수 · 날짜별 목록은 '그래프로 자세히 보기'(내 운동 기록)에서만.
 *   · 오늘 줄: 출석 전 'QR 출석'(칠금점처럼 얼굴 인식이 없는 지점) · 운동 중 '운동 종료' · 끝나면 오늘 시간.
 *     (예전 '오늘의 시작' 큰 카드 · '오늘 운동' 카드 대신 — 대표님이 고른 "새 운동 카드 안에 작게")
 *   숫자는 서버 get_attendance_history 한 곳(useAttendanceHistory — 내정보 · 운동 기록과 같은 캐시).
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronRight, Clock, QrCode, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { weightBasis } from "@/lib/fitnessProfile153";
import { valueTotals } from "@/lib/healthGains153";
import { useFinishWorkout, useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { minutesToHours } from "@/lib/achievement153";
import { kstToday, monthGain } from "@/lib/attendanceCheer";
import { bestMonthAllTime, monthLabel } from "@/lib/attendanceHistory";
import { formatMinutes } from "@/services/workoutTimeService";
import { cn } from "@/lib/utils";

const hrs = (min: number) => `${minutesToHours(min)}시간`;
/** 지난달 이름 — '9월' (KST) */
const lastMonthName = () => {
  const t = kstToday();
  const m = Number(t.slice(5, 7)) - 1;
  return `${m === 0 ? 12 : m}월`;
};
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
        className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-[12px] font-bold text-secondary-foreground transition-transform active:scale-95"
        aria-label="QR 출석"
      >
        <QrCode className="h-3.5 w-3.5" aria-hidden />
        QR 출석
      </button>
    );
  }
  if (data.finished) {
    return (
      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-bold text-primary">
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
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="text-[12px] font-bold tabular-nums text-foreground">{formatMinutes(data.elapsed_minutes)}째</span>
      <button
        type="button"
        onClick={onFinish}
        disabled={finish.isPending}
        className="h-9 rounded-full bg-primary px-3 text-[12px] font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
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
    <section aria-label="내 운동 시간" className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clock className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-black text-foreground">내 운동 시간</h2>
        <TodayStrip />
      </div>
      {children}
    </section>
  );

  if (isLoading) return shell(<div className="mt-3 h-[210px] animate-pulse rounded-xl bg-muted/60" aria-label="운동 시간을 불러오는 중" />);
  if (isError || !data) {
    return shell(
      <div className="mt-3 rounded-xl bg-muted/50 px-3.5 py-3 text-center">
        <p className="text-[13px] text-muted-foreground">운동 시간을 불러오지 못했어요</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 h-10 rounded-xl bg-card px-4 text-[13px] font-bold text-foreground ring-1 ring-border active:scale-[0.98]">
          다시 불러오기
        </button>
      </div>,
    );
  }
  if (data.total <= 0) {
    return shell(
      <p className="mt-3 rounded-xl bg-muted/50 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
        첫 운동부터 시간이 쌓여요. 입구 얼굴 인식이나 QR로 출석하면 그날 운동 시간이 기록되고, 끝나고 얼굴 인식을 한 번 더 하면 실제 시간까지 쳐요 🥊
      </p>,
    );
  }

  const gain = monthGain(data.monthMinutes, data.lastMonthMinutes);
  const best = bestMonthAllTime(data.list);
  const bars = data.monthly.slice(-BAR_MONTHS);
  const maxMin = Math.max(1, ...bars.map((m) => m.minutes));
  const thisMonth = bars.length ? bars[bars.length - 1].month : null;
  const monthValue = data.month > 0 && data.monthMinutes > 0 ? valueTotals(data.month, data.monthMinutes, weightBasis(body?.weightKg, extra?.gender).kg) : null;

  return shell(
    <button
      type="button"
      onClick={openDetail}
      aria-label={`이번 달 ${hrs(data.monthMinutes)} 운동 · 그래프로 자세히 보기`}
      className="mt-3 block w-full text-left transition-transform active:scale-[0.99]"
    >
      {/* 주인공 — 이번 달 운동 시간 */}
      <p className="text-[12px] font-bold text-muted-foreground">이번 달</p>
      <div className="mt-0.5 flex flex-wrap items-end gap-x-2 gap-y-1">
        <p className="text-[36px] font-black leading-none tracking-tight tabular-nums text-foreground">
          {minutesToHours(data.monthMinutes)}
          <span className="ml-1 text-[16px] font-bold text-muted-foreground">시간</span>
        </p>
        {gain ? (
          <span className="mb-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-bold text-primary">지난달보다 +{hrs(gain)} 📈</span>
        ) : null}
      </div>
      {monthValue && (
        <p className="mt-1.5 text-[12px] font-bold text-muted-foreground">
          이번 달 뻗은 펀치 <span className="tabular-nums text-foreground">약 {monthValue.punches.toLocaleString("ko-KR")}번</span> · 태운 칼로리{" "}
          <span className="tabular-nums text-foreground">약 {monthValue.kcal.toLocaleString("ko-KR")}kcal</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="min-w-0 rounded-xl bg-primary/10 px-2.5 py-2.5">
          <p className="flex items-center gap-1 text-[11.5px] font-bold text-primary">
            <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            총 운동
          </p>
          <p className="mt-0.5 truncate text-[18px] font-black tabular-nums text-foreground">
            {data.total.toLocaleString("ko-KR")}
            <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">일</span>
          </p>
          <p className="truncate text-[10.5px] text-muted-foreground">{hrs(data.totalMinutes)}</p>
        </div>
        <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2.5">
          <p className="text-[11.5px] font-bold text-muted-foreground">지난달</p>
          <p className="mt-0.5 truncate text-[18px] font-black tabular-nums text-foreground">
            {minutesToHours(data.lastMonthMinutes)}
            <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">시간</span>
          </p>
          <p className="truncate text-[10.5px] text-muted-foreground">{lastMonthName()}</p>
        </div>
        <div className="min-w-0 rounded-xl bg-reward/10 px-2.5 py-2.5">
          <p className="flex items-center gap-1 text-[11.5px] font-bold text-reward">
            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">최고 달</span>
          </p>
          <p className="mt-0.5 truncate text-[18px] font-black tabular-nums text-foreground">
            {best ? (
              <>
                {minutesToHours(best.minutes)}
                <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">시간</span>
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="truncate text-[10.5px] text-muted-foreground">{best ? monthLabel(best.month, true) : "기록 쌓는 중"}</p>
        </div>
      </div>

      {/* 최근 6개월 — 이번 달 민트 · 가장 많이 한 달 금색 */}
      {bars.length > 1 && (
        <div className="mt-3" aria-hidden>
          <div className="flex h-[92px] items-end gap-2">
            {bars.map((m) => {
              const isNow = m.month === thisMonth;
              const isBest = !!best && m.month === best.month;
              const h = m.minutes > 0 ? Math.max(6, Math.round((m.minutes / maxMin) * 70)) : 2;
              return (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <span className={cn("mb-1 text-[10.5px] tabular-nums", isNow ? "font-black text-foreground" : "text-muted-foreground")}>
                    {m.minutes > 0 ? minutesToHours(m.minutes) : ""}
                  </span>
                  <span
                    className={cn("w-full max-w-[36px] rounded-t-md", isBest ? "bg-reward" : isNow ? "bg-primary" : "bg-primary/25")}
                    style={{ height: `${h}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2 border-t border-border/70 pt-1">
            {bars.map((m) => (
              <span
                key={m.month}
                className={cn("min-w-0 flex-1 text-center text-[11px]", m.month === thisMonth ? "font-black text-foreground" : "text-muted-foreground")}
              >
                {monthLabel(m.month, true)}
              </span>
            ))}
          </div>
        </div>
      )}

      <span className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-muted text-[13px] font-bold text-foreground">
        그래프로 자세히 보기 <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>,
  );
};

export default HomeWorkoutCard;
