/**
 * 📅 홈 첫 화면 '운동 달력' (2026-11-12 선릉역점 봄 회원 제안 → 대표님 「추천대로 진행하자」 — 회원 모두 기본 켬)
 *   자리 = '내 운동' 바로 아래. 끄기 = 홈 꾸미기 '첫 화면' › 운동 달력 (lib/homeLayout `workoutCalendar`).
 *   출석이 한 번도 없으면 그리지 않는다(빈 것은 그리지 않기). 카드는 WorkoutCalendarCard 하나 — '내 운동 기록'과 같은 조각.
 *   데이터는 홈 '내 운동'(HomeWorkoutCard)과 같은 useAttendanceHistory(null) 캐시라 따로 부르지 않는다.
 */
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import WorkoutCalendarCard from "@/components/attendance/WorkoutCalendar";

const HomeWorkoutCalendar = () => {
  const { data } = useAttendanceHistory(null);
  if (!data || data.total === 0) return null;
  return <WorkoutCalendarCard data={data} title="운동 달력" storageKey="153cal:home:open" />;
};

export default HomeWorkoutCalendar;
