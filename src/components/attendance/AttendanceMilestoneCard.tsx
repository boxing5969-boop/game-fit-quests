/**
 * 🏅 출석 축하(50회마다) 진행 — '내 운동 기록'(상세) 화면 전용 (2026-10-22 대표님)
 *   "총 몇 번 나왔는지는 보여 주지 말고, 이 정보를 알려면 내정보에서 시간을 한 번 더 눌러 상세하게"
 *   → 횟수가 들어간 축하 진행 막대는 내정보 요약 카드에서 여기(상세)로 옮겼다.
 *   보상(챔피언 머니 · 마일리지 · 축하 편지)은 그대로 출석 횟수 기준.
 *   2026-10-28 리디자인: '다음 목표' 하나 — 남은 횟수가 주인공(큰 글씨), 막대, 선물은 한 줄. '이번 주' 바로 밑.
 *   숫자는 서버 get_my_attendance_stats (lib/attendanceMilestone · hooks/useAttendanceStats).
 *   지도진 계정은 축하 보상이 없다 → 안내 한 줄.
 *   2026-11-12 동기부여 1단계(대표님 「추천대로」 · 선릉역점만): 켠 지점 회원은 5 · 10 · 20 · 30번째 이른 축하가 먼저
 *   (보상 없이 축하 편지 — get_my_motivation.early), 지나면 기존 50번마다. 계산은 lib/motivation153 nextCelebration.
 */
import { PartyPopper } from "lucide-react";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";
import { useMotivation } from "@/hooks/useMotivation";
import { celebrationProgress, nextCelebration } from "@/lib/motivation153";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");

const AttendanceMilestoneCard = ({ className }: { className?: string }) => {
  const { data } = useAttendanceStats();
  const { data: motivation } = useMotivation(!!data && !data.isStaff);
  // 불러오는 중 · 실패면 조용히 — 상세 화면의 다른 카드가 상태를 알려 준다
  if (!data) return null;
  if (data.isStaff) {
    return <p className={cn("px-1 text-label leading-relaxed text-muted-foreground", className)}>지도진 계정은 출석 축하 보상이 없어요.</p>;
  }

  const target = nextCelebration(data.total, motivation, { next: data.next, step: data.step });
  const prog = { next: target.next, ...celebrationProgress(data.total, target) };
  // 이른 축하(5 · 10 · 20 · 30번째)는 편지만 — 챔피언 머니 · 마일리지는 50번마다 그대로
  const gift = [
    !target.early && data.nextGems > 0 ? `챔피언 머니 +${n(data.nextGems)}` : "",
    !target.early && data.nextMileage > 0 ? `마일리지 +${n(data.nextMileage)}점` : "",
    "축하 편지",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-label="출석 축하" className={cn("rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-elev-1", className)}>
      <p className="flex items-center gap-1.5 text-label font-bold text-amber-800 dark:text-amber-300">
        <PartyPopper className="h-4 w-4 shrink-0" aria-hidden />
        출석 {n(prog.next)}번 축하까지
      </p>
      <p className="mt-1 text-title tabular-nums text-foreground">{n(prog.left)}번 남았어요</p>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-amber-500/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={prog.span}
        aria-valuenow={prog.done}
        aria-label={`출석 ${prog.next}회까지`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700"
          style={{ width: `${Math.max(2, Math.round(prog.ratio * 100))}%` }}
        />
      </div>
      <p className="mt-3 text-label text-foreground">{gift}</p>
      {/* 받은 축하(50 · 100회 …)는 아래 '받은 출석 축하'에 있다 — 두 번 그리지 않는다 */}
    </section>
  );
};

export default AttendanceMilestoneCard;
