/**
 * 💚 홈 '153과 함께하며' (2026-10-22 대표님 — 처음 이름 '운동이 내게 준 것' → "153과 함께하며"로)
 *   "긍정적인 정보들 — 운동하길 잘했다고 느껴질 수 있고 지속하는 힘이 될 수 있도록:
 *    건강 수명이 얼마나 올랐고, 근력이 얼마나 늘었고, 심폐지구력이 얼마나 좋아졌고, 행복도가 얼마나 올라갔는지"
 *   → 네 가지 모두 숫자로 · "개인 상태에 따라 다를 수 있다"고 함께 쓴다 (대표님 확정).
 *
 *   숫자는 lib/healthGains153 한 곳 (연구 근거 · 계산식은 그 파일 머리말). 앱이 몸을 직접 재지 않으므로
 *   '연구 평균으로 추정'을 늘 같이 쓰고, 153 PB 처럼 실제로 잰 기록이 있으면 그걸 먼저 보여 준다.
 *   잘한 것만 — 줄어든 것 · 손해 · 진단 · 의료 표현은 쓰지 않는다. 출석 횟수도 쓰지 않는다.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Dumbbell, HeartPulse, Smile, Sparkles, Wind } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { minutesToHours } from "@/lib/achievement153";
import { attendanceCheer } from "@/lib/attendanceCheer";
import {
  CARDIO_MAX_PCT,
  HEALTH_GAIN_NOTE,
  LIFE_HOURS_PER_EXERCISE_HOUR,
  MOOD_DAYS_PER_ACTIVE_MONTH,
  STRENGTH_MAX_PCT,
  formatPct,
  healthGains,
} from "@/lib/healthGains153";
import { fetchTest153Summary } from "@/services/test153Service";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");

const Tile = ({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub: ReactNode }) => (
  <div className="rounded-xl bg-muted/50 px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
        {icon}
      </span>
      {label}
    </p>
    <p className="mt-1 text-[22px] font-black leading-none tabular-nums text-foreground">{value}</p>
    <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{sub}</p>
  </div>
);

const HealthGainsCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { data, isLoading, isError } = useAttendanceHistory(null);
  // 153 PB — 지금까지 이룬 것 카드와 같은 캐시 키
  const { data: pb } = useQuery({
    queryKey: ["test153", "summary", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchTest153Summary(undefined),
  });
  const [howOpen, setHowOpen] = useState(false);

  // 불러오는 중 · 실패는 위 '내 운동 시간' 카드가 알려 준다 — 여기는 조용히 둔다
  if (isLoading || isError || !data) return null;

  const g = healthGains(data.list, data.totalMinutes, pb?.records);
  const cheer = data.total > 0 ? attendanceCheer({ ...data, next: 0 }) : null;

  return (
    <section aria-label="153과 함께하며" className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-black text-foreground">153과 함께하며</h2>
        {data.totalMinutes > 0 && (
          <span className="shrink-0 text-[12px] font-bold tabular-nums text-muted-foreground">지금까지 {minutesToHours(data.totalMinutes)}시간</span>
        )}
      </div>

      {data.total <= 0 ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
          운동 1시간마다 건강 수명이 약 {LIFE_HOURS_PER_EXERCISE_HOUR}시간 늘어난다는 연구가 있어요. 첫 운동부터 건강 수명 · 심폐지구력 · 근력 · 행복도가 여기에 쌓여요 💚
        </p>
      ) : (
        <>
          {cheer && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] font-bold leading-snug text-foreground">
              <span aria-hidden>{cheer.emoji}</span>
              <span className="min-w-0">{cheer.text}</span>
            </p>
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Tile
              icon={<HeartPulse className="h-3.5 w-3.5" />}
              label="건강 수명"
              value={`+${g.lifeLabel}`}
              sub={`운동 1시간마다 약 ${LIFE_HOURS_PER_EXERCISE_HOUR}시간씩 늘었어요`}
            />
            <Tile
              icon={<Wind className="h-3.5 w-3.5" />}
              label="심폐지구력"
              value={`+${formatPct(g.cardioPct)}%`}
              sub={
                g.pbFasterPct != null
                  ? `153 PB 실측 ${formatPct(g.pbFasterPct)}% 빨라졌어요`
                  : g.cardioWeeks > 0
                    ? `권장 운동량을 채운 ${n(g.cardioWeeks)}주가 쌓였어요`
                    : "한 주에 2번 오면 쌓이기 시작해요"
              }
            />
            <Tile
              icon={<Dumbbell className="h-3.5 w-3.5" />}
              label="근력"
              value={`+${formatPct(g.strengthPct)}%`}
              sub={g.strengthWeeks > 0 ? `주 2번 이상 운동한 ${n(g.strengthWeeks)}주가 쌓였어요` : "한 주에 2번 오면 쌓이기 시작해요"}
            />
            <Tile
              icon={<Smile className="h-3.5 w-3.5" />}
              label="행복도"
              value={`+${n(g.moodDays)}일`}
              sub={g.activeMonths > 0 ? `마음이 가벼운 날이 늘었어요 (꾸준히 한 ${n(g.activeMonths)}개월)` : "한 달에 4번 오면 쌓이기 시작해요"}
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-2.5 flex w-full items-center justify-between gap-2 text-left text-[11px] leading-relaxed text-muted-foreground"
      >
        <span>{HEALTH_GAIN_NOTE}</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          계산 방법 <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <ul className="mt-2 space-y-1.5 rounded-xl bg-muted/50 px-3.5 py-3 text-[11.5px] leading-relaxed text-foreground">
          <li>
            <b>건강 수명</b> — 운동 1시간 ≈ 기대 수명 {LIFE_HOURS_PER_EXERCISE_HOUR}시간 (최대 약 3년) · 미국 연구(2017) · 대만 41만 명 연구(2011)
          </li>
          <li>
            <b>심폐지구력</b> — 꾸준한 유산소 운동으로 보통 10~15% 좋아져요. 권장 운동량을 채운 주가 쌓일수록 최대 {CARDIO_MAX_PCT}%까지 · 연구 모음(2015)
          </li>
          <li>
            <b>근력</b> — 맨몸 근력 운동 8주에 팔굽혀펴기 +6% · 윗몸일으키기 +8%. 주 2번 이상 운동한 주가 쌓일수록 최대 {STRENGTH_MAX_PCT}%까지
          </li>
          <li>
            <b>행복도</b> — 운동하는 사람은 마음이 힘든 날이 한 달에 약 {MOOD_DAYS_PER_ACTIVE_MONTH}일 적었어요 · 미국 120만 명 연구(2018). 한 달에 4번 이상 온 달마다 셉니다
          </li>
        </ul>
      )}
    </section>
  );
};

export default HealthGainsCard;
