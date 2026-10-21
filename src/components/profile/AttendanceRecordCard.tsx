/**
 * 📅 내정보 '출석 기록' 카드 (2026-10-21 대표님 — 회원님들 요청: "한 달 출석 수 · 지금까지 총 출석 수 확인할 수 있게")
 *   · 이번 달 · 지금까지(총) 출석 — 그날 첫 인정 출석 1번 (같은 날 여러 번 찍어도 1번)
 *   · 다음 축하(50회마다)까지 남은 횟수 · 받을 선물 · 이미 받은 축하
 *   숫자는 서버 get_my_attendance_stats (lib/attendanceMilestone · hooks/useAttendanceStats).
 *   지도진 계정은 축하 보상이 없다 → 진행 막대 대신 안내 한 줄.
 */
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronRight, PartyPopper } from "lucide-react";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";
import { milestoneProgress, shortDate } from "@/lib/attendanceMilestone";

const n = (v: number) => v.toLocaleString("ko-KR");

/** '2026-02-01' → '2026년 2월 1일' */
const longDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso;
};

const AttendanceRecordCard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAttendanceStats();

  if (isLoading) {
    return <div className="h-[188px] animate-pulse rounded-2xl border border-border bg-card" aria-label="출석 기록을 불러오는 중" />;
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

  const prog = milestoneProgress(data.total, data.step);
  const gift = [
    data.nextGems > 0 ? `챔피언 머니 +${n(data.nextGems)}` : "",
    data.nextMileage > 0 ? `마일리지 +${n(data.nextMileage)}점` : "",
  ].filter(Boolean).join(" · ");

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-elev-1" aria-label="출석 기록">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <h3 className="text-[15px] font-black text-foreground">출석 기록</h3>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-muted/50 px-3.5 py-3">
          <p className="text-[12px] font-bold text-muted-foreground">이번 달</p>
          <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-foreground">
            {n(data.month)}
            <span className="ml-0.5 text-[15px] font-bold text-muted-foreground">회</span>
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">지난달 {n(data.lastMonth)}회</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3.5 py-3">
          <p className="text-[12px] font-bold text-muted-foreground">지금까지</p>
          <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-foreground">
            {n(data.total)}
            <span className="ml-0.5 text-[15px] font-bold text-muted-foreground">회</span>
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {data.since ? `첫 기록 ${shortDate(data.since)}` : "첫 출석을 하면 쌓여요"}
          </p>
        </div>
      </div>

      {data.isStaff ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">지도진 계정은 출석 축하 보상이 없어요.</p>
      ) : (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-black text-foreground">
              <PartyPopper className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span className="truncate">출석 {n(prog.next)}회 축하까지</span>
            </p>
            <span className="shrink-0 text-[13.5px] font-black tabular-nums text-amber-700">{n(prog.left)}회 남음</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-amber-500/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={data.step}
            aria-valuenow={data.step - prog.left}
            aria-label={`출석 ${prog.next}회까지`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700"
              style={{ width: `${Math.round(prog.ratio * 100)}%` }}
            />
          </div>
          {gift && <p className="mt-2 text-[12px] text-foreground">채우면 {gift} · 축하 편지</p>}
          {data.milestones.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="받은 출석 축하">
              {data.milestones.map((m) => (
                <span
                  key={m.milestone}
                  className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-foreground ring-1 ring-amber-500/30"
                >
                  🏅 {n(m.milestone)}회{m.reachedOn ? <span className="font-medium text-muted-foreground">· {shortDate(m.reachedOn)}</span> : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 날짜별 출석 · 월별 · 요일별 그래프 (2026-10-21 대표님: 회원님들 출석 기록도 확인할 수 있게) */}
      <button
        type="button"
        onClick={() => navigate("/mypage/attendance")}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-muted text-[13.5px] font-bold text-foreground transition-transform active:scale-[0.98]"
      >
        출석 기록 전체 보기 <ChevronRight className="h-4 w-4" />
      </button>

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        하루에 여러 번 찍어도 1번으로 세요 · {longDate(data.recordsSince)}부터 센 기록이에요
      </p>
    </section>
  );
};

export default AttendanceRecordCard;
