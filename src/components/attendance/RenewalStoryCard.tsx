/**
 * 🌱 나의 153 기록 — 수강권이 끝나 갈 때(만료 21일 전 ~ 끝나고 14일) 지금까지 쌓은 출석을 보여 준다 (2026-10-21 대표님:
 *   "회원님들이 출석 데이터를 통해 재등록과 감정이 긍정적으로 생각할 수 있도록 세팅하자")
 *   · 숫자는 잘한 것만: 출석 횟수 · 최고 연속 주 · 가장 많이 온 달 · 다음 축하까지 (lib/attendanceCheer)
 *     날 수는 쓰지 않는다 — "262일 동안 37번"은 "그중 37번밖에"로 읽힌다 (2026-10-21 대표님)
 *   · 압박 문구 · 할인 약속 없음 — '쌓아 온 기록이 이어진다' 는 사실만
 *   · 내정보 · 수강권 · 내 출석 기록에 같은 카드 (수강권 화면에선 버튼 없이)
 *   회원(role member · 지도진 아님)만. 출석이 한 번도 없으면 안 보인다.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";
import { kstToday, renewalBadge, renewalWindow } from "@/lib/attendanceCheer";
import { monthLabel } from "@/lib/attendanceHistory";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");

const RenewalStoryCard = ({ showCta = true, className }: { showCta?: boolean; className?: string }) => {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const memEnd = (profile as { membership_end?: string | null } | null)?.membership_end ?? null;
  const isMember = role === "member" && !isStaffProfile(profile);
  const win = isMember ? renewalWindow(memEnd, kstToday()) : null;
  const { data } = useAttendanceStats(!!win);
  if (!win || !data || data.total <= 0) return null;

  const name = ((profile?.nickname || profile?.name || "") as string).trim() || "회원";
  const left = data.next - data.total;
  const chips = [
    data.bestWeekStreak >= 2 ? `🔥 최고 ${n(data.bestWeekStreak)}주 연속` : null,
    data.bestMonth ? `📅 ${monthLabel(data.bestMonth.month, true)} ${n(data.bestMonth.days)}회 최고` : null,
    left > 0 ? `🏅 ${n(data.next)}회 축하까지 ${n(left)}번` : null,
  ].filter(Boolean) as string[];

  return (
    <section
      aria-label="나의 153 기록"
      className={cn("rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-amber-500/10 p-4 shadow-elev-1", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">My 153 Record</p>
        <span className="shrink-0 rounded-full bg-background/80 px-2.5 py-0.5 text-[11.5px] font-bold text-foreground ring-1 ring-border">
          수강권 {renewalBadge(win)}
        </span>
      </div>
      <h3 className="mt-1.5 text-[17px] font-black leading-snug text-foreground">
        {name}님이 153에서 쌓은 출석
        <br />
        <span className="text-[26px]">{n(data.total)}번</span>
      </h3>
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-background/80 px-2.5 py-1 text-[12px] font-bold text-foreground ring-1 ring-border">
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-foreground">
        {win.ended
          ? `기록은 그대로 있어요. 다시 시작하면 ${n(data.total + 1)}번째 출석부터 이어서 세요.`
          : "지금까지 쌓은 기록은 다음 수강권에서도 그대로 이어져요."}
      </p>
      {showCta && (
        <button
          type="button"
          onClick={() => navigate("/membership")}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-foreground text-[13.5px] font-bold text-background transition-transform active:scale-[0.98]"
        >
          {win.ended ? "다시 시작하기" : "수강권 이어가기"} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
};

export default RenewalStoryCard;
