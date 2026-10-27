/**
 * 📅 내정보 '운동 기록' 카드 (2026-10-21 대표님 — 회원님들 요청으로 시작)
 *   2026-10-22 대표님: "이번 달 · 지난달 총 몇 회 출석했는지 말고 총 몇 시간 운동했는지로 체크하자"
 *   2026-10-22 대표님: "이번 달 · 지난달 시간은 보여 주되 총 몇 번 나왔는지는 보여 주지 말고,
 *                     이 정보를 알려면 내정보에서 시간을 한 번 더 누르면 상세하게 그래프와 각종 정보를 볼 수 있게"
 *   2026-10-28 리디자인 (대표님 "위보고한 기준대로 전면 리 디자인하자" · 화면 규칙 7가지):
 *     · 주인공 하나 = 이번 달 운동 시간 · 지난달보다 늘었을 때만 +칩 · 지금까지 시간 한 줄
 *     · 지난달 칸 · 응원 한 줄 · 세는 규칙 문단은 '내 운동 기록'(자세히)으로 — 이번 주 카드 · ? 단추
 *     · 맨 아래 '운동 기록 자세히 보기' 한 줄 (카드 어디를 눌러도 같은 곳)
 *   운동 시간은 서버 workout_minutes 합(두 번째 체크 · 운동 종료로 잰 시간, 없으면 66분) — 승급 · 랭킹 · 홈과 같은 숫자.
 *   숫자는 서버 get_my_attendance_stats (lib/attendanceMilestone · hooks/useAttendanceStats).
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";
import { minutesToHours } from "@/lib/achievement153";
import { kstToday, monthGain, sinceLabel } from "@/lib/attendanceCheer";

const AttendanceRecordCard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAttendanceStats();

  if (isLoading) {
    return <div className="h-[188px] animate-pulse rounded-2xl border border-border bg-card" aria-label="운동 기록을 불러오는 중" />;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-body text-muted-foreground">출석 기록을 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 h-11 rounded-xl bg-muted px-5 text-body font-bold text-foreground active:scale-[0.98]"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const gain = monthGain(data.monthMinutes, data.lastMonthMinutes);
  const since = sinceLabel(data.since, kstToday());
  const openDetail = () => navigate("/mypage/attendance");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1" aria-label="운동 기록">
      <button
        type="button"
        onClick={openDetail}
        aria-label={`이번 달 ${minutesToHours(data.monthMinutes)}시간 · 지금까지 ${minutesToHours(data.totalMinutes)}시간 — 운동 기록 자세히 보기`}
        className="block w-full text-left active:bg-muted/30"
      >
        <div className="p-5">
          <h3 className="text-heading text-foreground">운동 기록</h3>
          <p className="mt-3 text-label font-bold text-muted-foreground">이번 달</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-display tracking-tight tabular-nums text-foreground">
              {minutesToHours(data.monthMinutes)}
              <span className="ml-1.5 text-heading font-bold">시간</span>
            </p>
            {gain ? <span className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">지난달보다 +{minutesToHours(gain)}시간</span> : null}
          </div>
          <p className="mt-2 text-body text-foreground">
            지금까지 <b className="tabular-nums">{minutesToHours(data.totalMinutes)}시간</b>
            {since ? ` · ${since}` : ""}
          </p>
        </div>
        <span className="flex h-14 items-center justify-between border-t border-border px-5 text-body font-bold text-foreground">
          운동 기록 자세히 보기 <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
        </span>
      </button>
    </section>
  );
};

export default AttendanceRecordCard;
