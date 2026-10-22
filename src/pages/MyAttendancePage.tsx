/**
 * 📅 내 운동 기록 — 회원 본인 (2026-10-21 대표님: "회원님들의 출석 기록도 확인할 수 있게, 그래프랑 UI 깔끔하게")
 *   내정보 '운동 기록' 카드의 시간 칸 · 홈 '내 운동 시간' → 여기. 회원 상세 '출석' 탭(관리자 · 지점장)과 같은 화면 조각을 쓴다.
 *   2026-10-22 대표님: "총 몇 번 나왔는지는 요약에서 빼고, 시간을 한 번 더 누르면 상세하게 그래프와 각종 자신의 정보"
 *     → 순서: 요약 · 월별 · 요일별 그래프 → 받은 축하 → 축하 진행(횟수) · 운동이 내게 준 것 · 이룬 것 → 날짜별 목록.
 */
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import AttendanceHistoryPanel from "@/components/attendance/AttendanceHistoryPanel";
import RenewalStoryCard from "@/components/attendance/RenewalStoryCard";
import AttendanceMilestoneCard from "@/components/attendance/AttendanceMilestoneCard";
import HealthGainsCard from "@/components/home/HealthGainsCard";
import AchievementCard from "@/components/profile/AchievementCard";

const MyAttendancePage = () => {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/mypage", { replace: true });
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="내 운동 기록"
          subtitle="월별 운동 시간 · 요일별 · 날짜별"
          sticky
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
        />
      }
    >
      {/* 수강권이 끝나 갈 때만 — 지금까지의 기록 · 이어가기 (2026-10-21) */}
      <RenewalStoryCard className="mb-3" />
      <AttendanceHistoryPanel
        beforeList={
          <>
            {/* 출석 축하(50회마다) 진행 — 횟수는 상세에서만 (2026-10-22) */}
            <AttendanceMilestoneCard />
            {/* 건강 수명 · 심폐지구력 · 근력 · 행복도 (2026-10-22) */}
            <HealthGainsCard />
            {/* 지금까지 이룬 것 (2026-10-21 대표님: "주평균 빼 주고 지금까지 이룬 것들을 보여 줘") */}
            <AchievementCard />
          </>
        }
      />
    </AppPage>
  );
};

export default MyAttendancePage;
