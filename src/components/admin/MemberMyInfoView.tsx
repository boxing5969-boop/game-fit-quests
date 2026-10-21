/**
 * 👤 회원 내정보 보기 — 관리자 · 지점장 (2026-10-21 대표님: "나는 관리자라서 출석이 없는데,
 *   내가 회원 내정보를 볼 수 있게 해 줘 — 이름 클릭해서 들어가면")
 *   회원이 내정보 '내 기록'에서 보는 것을 그대로: 출석 요약(회원 화면 문구) + 지금까지 이룬 것.
 *   쓰는 곳: 회원 상세 '내정보' 탭(/manager/member/:id?tab=myinfo) · 회원 앱 미리보기 '내정보' 탭.
 *   권한은 부르는 쪽이 거른다 (관리자 · 지점장 — 출석 기록 서버 함수와 같은 범위).
 *   키 · 몸무게 · 복싱 시간은 회원 본인만 — AchievementCard 가 읽지 않고 기본 기준으로 계산한다고 밝힌다.
 */
import { AttendanceSummaryCard } from "@/components/attendance/AttendanceHistoryPanel";
import AchievementCard from "@/components/profile/AchievementCard";

const MemberMyInfoView = ({ userId, name, onOpenAttendance }: { userId: string; name?: string | null; onOpenAttendance?: () => void }) => (
  <div className="space-y-3" aria-label="회원 내정보">
    <p className="rounded-xl bg-primary/10 px-3.5 py-2.5 text-[12.5px] font-bold leading-snug text-foreground">
      👤 {(name || "").trim() || "회원"}님이 내정보 &lsquo;내 기록&rsquo;에서 보는 화면이에요
    </p>
    <AttendanceSummaryCard userId={userId} audience="member" onOpenAll={onOpenAttendance} />
    <AchievementCard userId={userId} />
  </div>
);

export default MemberMyInfoView;
