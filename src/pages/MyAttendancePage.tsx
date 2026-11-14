/**
 * 📅 내 운동 기록 — 회원 본인 (2026-10-21 대표님: "회원님들의 출석 기록도 확인할 수 있게, 그래프랑 UI 깔끔하게")
 *   내정보 '운동 기록' 카드의 시간 칸 · 홈 '내 운동 시간' → 여기. 회원 상세 '출석' 탭(관리자 · 지점장)과 같은 화면 조각을 쓴다.
 *   2026-10-22 대표님: "총 몇 번 나왔는지는 요약에서 빼고, 시간을 한 번 더 누르면 상세하게 그래프와 각종 자신의 정보"
 *     → 순서: 요약 · 월별 · 요일별 그래프 → 받은 축하 → 축하 진행(횟수) · 153과 함께하며 · 이룬 것 → 날짜별 목록.
 *   2026-10-28 리디자인: 요약(주인공 하나) → 이번 주 → 다음 축하 → 월별 · 요일별(기록이 쌓이면) → 153과 함께하며 → 이룬 것 → 목록.
 *     머리글 부제목(월별 운동 시간 · 요일별 · 날짜별)은 뺐다 — 화면 이름만.
 *   2026-11-12 대표님 "운동기록에 비교할 수 있는 대상 — 내 나이 평균 · 나는 평균에서 어느 정도 · 상위 몇 %"
 *     → 153과 함께하며 다음에 '같은 나이와 비교'(PeerCompareCard — 국민체력100 나이 · 성별 백분위).
 *   2026-11-13 대표님 「심폐지구력 근력 건강나이등등도 모두 같은나이 평균과 비교 … 153복싱짐의 가치 전달」
 *     → 같은 카드에 체력 나이(심폐 기준 · 추정 — '153 운동 −N살') · 심폐 체력 상위 %(추정) · 악력(근력) · 체지방률.
 *   2026-11-14 대표님 「마이복서 153 정신적인 향상도 넣자 · 운동을 통한 자신감 힘 · 과학적이고 설득력이 정말 중요해」
 *     → 같은 나이와 비교 다음에 '마음 능력치'(MindStatsCard — 로젠버그 자존감 척도 · RAND-36 활력 · 습관 자동성 지수, 4주마다 2분 체크).
 */
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import AttendanceHistoryPanel from "@/components/attendance/AttendanceHistoryPanel";
import RenewalStoryCard from "@/components/attendance/RenewalStoryCard";
import AttendanceMilestoneCard from "@/components/attendance/AttendanceMilestoneCard";
import PeerCompareCard from "@/components/attendance/PeerCompareCard";
import MindStatsCard from "@/components/attendance/MindStatsCard";
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
        // 출석 축하(50회마다) 진행 — '이번 주' 바로 밑 (2026-10-28 리디자인: 다음 목표를 위로)
        afterWeek={<AttendanceMilestoneCard />}
        beforeList={
          <>
            {/* 건강 수명 · 심폐지구력 · 근력 · 행복도 (2026-10-22) */}
            <HealthGainsCard />
            {/* 같은 나이와 비교 — 체력 나이 · 심폐 체력(추정) · 체지방률 · 악력 상위 % · 처음보다 (2026-11-12 · 11-13 대표님) */}
            <PeerCompareCard />
            {/* 마음 능력치 — 자신감 · 힘(활력) · 운동 습관, 검증된 척도로 4주마다 (2026-11-14 대표님) */}
            <MindStatsCard />
            {/* 지금까지 이룬 것 (2026-10-21 대표님: "주평균 빼 주고 지금까지 이룬 것들을 보여 줘")
                — 몸무게 · 153 PB 가 얼마나 좋아졌는지는 위 '153과 함께하며'가 보여 줘서 뺀다 (2026-11-14) */}
            <AchievementCard showInvite={false} hideBodyGains />
          </>
        }
      />
    </AppPage>
  );
};

export default MyAttendancePage;
