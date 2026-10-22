/**
 * 📅 내정보 '운동 기록' 카드 (2026-10-21 대표님 — 회원님들 요청으로 시작)
 *   2026-10-22 대표님: "이번 달 · 지난달 총 몇 회 출석했는지 말고 총 몇 시간 운동했는지로 체크하자"
 *   2026-10-22 대표님: "이번 달 · 지난달 시간은 보여 주되 총 몇 번 나왔는지는 보여 주지 말고,
 *                     이 정보를 알려면 내정보에서 시간을 한 번 더 누르면 상세하게 그래프와 각종 정보를 볼 수 있게"
 *     → 큰 숫자 = 이번 달 · 지난달 운동 시간. 출석 횟수 · 50회 축하 진행은 상세('내 운동 기록')로 옮겼다.
 *     시간 칸을 누르면 '내 운동 기록'(월별 · 요일별 · 날짜별 그래프 · 이룬 것 · 축하)으로 간다.
 *   운동 시간은 서버 workout_minutes 합(두 번째 체크 · 운동 종료로 잰 시간, 없으면 66분) — 승급 · 랭킹 · 홈과 같은 숫자.
 *   숫자는 서버 get_my_attendance_stats (lib/attendanceMilestone · hooks/useAttendanceStats).
 */
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";
import { CHECKOUT_WINDOW_HOURS, DEFAULT_SESSION_MINUTES, minutesToHours } from "@/lib/achievement153";
import { attendanceCheer, kstToday, monthGain, sinceLabel } from "@/lib/attendanceCheer";

/** '2026-02-01' → '2026년 2월 1일' */
const longDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso;
};

const AttendanceRecordCard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAttendanceStats();

  if (isLoading) {
    return <div className="h-[188px] animate-pulse rounded-2xl border border-border bg-card" aria-label="운동 기록을 불러오는 중" />;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">출석 기록을 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 h-10 rounded-xl bg-muted px-4 text-sm font-bold text-foreground active:scale-[0.98]"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const gain = monthGain(data.monthMinutes, data.lastMonthMinutes);
  // 응원 한 줄 — 축하까지 남은 횟수(횟수)는 상세에서만 (next 0)
  const cheer = attendanceCheer({ ...data, next: 0 });
  const since = sinceLabel(data.since, kstToday());
  const openDetail = () => navigate("/mypage/attendance");

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-elev-1" aria-label="운동 기록">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] font-black text-foreground">운동 기록</h3>
        <span className="shrink-0 text-right text-[11.5px] font-bold leading-tight text-muted-foreground">
          지금까지 <b className="tabular-nums text-foreground">{minutesToHours(data.totalMinutes)}시간</b>
          {since ? (
            <>
              <br />
              {since}
            </>
          ) : null}
        </span>
      </div>

      {/* 시간 칸을 누르면 상세 — 월별 · 요일별 · 날짜별 그래프 · 이룬 것 · 축하 */}
      <button
        type="button"
        onClick={openDetail}
        aria-label={`이번 달 ${minutesToHours(data.monthMinutes)}시간 · 지난달 ${minutesToHours(data.lastMonthMinutes)}시간 — 눌러서 자세히 보기`}
        className="mt-3 block w-full text-left transition-transform active:scale-[0.99]"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-primary/10 px-3.5 py-3">
            <p className="text-[12px] font-bold text-primary">이번 달</p>
            <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-foreground">
              {minutesToHours(data.monthMinutes)}
              <span className="ml-0.5 text-[15px] font-bold text-muted-foreground">시간</span>
            </p>
            <p className="mt-1.5 text-[11.5px] font-bold text-muted-foreground">
              {gain ? <span className="text-foreground">지난달보다 +{minutesToHours(gain)}시간 📈</span> : data.thisWeek ? "이번 주 운동 ✓" : "이번 달도 쌓이는 중"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3.5 py-3">
            <p className="text-[12px] font-bold text-muted-foreground">지난달</p>
            <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-foreground">
              {minutesToHours(data.lastMonthMinutes)}
              <span className="ml-0.5 text-[15px] font-bold text-muted-foreground">시간</span>
            </p>
            <p className="mt-1.5 text-[11.5px] font-bold text-muted-foreground">
              {data.bestMinutesMonth ? `최고 ${Number(data.bestMinutesMonth.month.slice(5))}월 ${minutesToHours(data.bestMinutesMonth.minutes)}시간 🏆` : " "}
            </p>
          </div>
        </div>
        <span className="mt-2 flex items-center justify-end gap-0.5 text-[12px] font-bold text-primary">
          눌러서 그래프 · 날짜별 자세히 보기 <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>

      {/* 응원 한 줄 — 연속 출석 주 · 늘어난 것 · 다시 시작 */}
      <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] font-bold leading-snug text-foreground">
        <span aria-hidden>{cheer.emoji}</span>
        <span className="min-w-0">{cheer.text}</span>
      </p>

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {/* 오래 하신 분은 끝나고 한 번 더 — 그 시각까지가 운동 시간 (2026-10-22 대표님) */}
        <b className="text-foreground">운동이 끝나면 입구 얼굴 인식을 한 번 더</b> 하세요 — 그 시간까지(최대 {CHECKOUT_WINDOW_HOURS}시간) 운동 시간으로 쳐요.
        안 하면 {DEFAULT_SESSION_MINUTES}분으로 세요 · {longDate(data.recordsSince)}부터 센 기록이에요
      </p>
    </section>
  );
};

export default AttendanceRecordCard;
