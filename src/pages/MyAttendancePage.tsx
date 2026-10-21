/**
 * 📅 내 출석 기록 — 회원 본인 (2026-10-21 대표님: "회원님들의 출석 기록도 확인할 수 있게, 그래프랑 UI 깔끔하게")
 *   내정보 '출석 기록' 카드 → "출석 기록 전체 보기". 회원 상세 '출석' 탭(관리자 · 지점장)과 같은 화면 조각을 쓴다.
 */
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import AttendanceHistoryPanel from "@/components/attendance/AttendanceHistoryPanel";
import RenewalStoryCard from "@/components/attendance/RenewalStoryCard";
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
          title="내 출석 기록"
          subtitle="월별 · 요일별 · 날짜별 출석"
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
      {/* 지금까지 이룬 것 (2026-10-21 대표님: "주평균 빼 주고 지금까지 이룬 것들을 보여 줘") */}
      <AchievementCard className="mb-3" />
      <AttendanceHistoryPanel />
    </AppPage>
  );
};

export default MyAttendancePage;
