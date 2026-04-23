import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  HeartHandshake,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXTEND_MISSIONS } from "@/data/postProgramMissions";
import type {
  DietPostProgramCheckin,
  DietPostProgramPlan,
} from "@/lib/diet/postProgramTypes";
import WeeklyCheckinDialog from "./WeeklyCheckinDialog";

interface ExtendHomeProps {
  plan: DietPostProgramPlan;
  checkins: DietPostProgramCheckin[];
}

/**
 * 건강리셋 연장 프로그램 홈.
 *
 * 구조:
 *   - 14 또는 21일 연장 사이클 (plan.extension_cycle_length)
 *   - 현재 주차 = 완료된 체크인 수 + 1
 *   - 주간 식단 인증률·출석·수면 안정화 중심. 체중 경쟁 금지.
 */
export const ExtendHome = ({ plan, checkins }: ExtendHomeProps) => {
  const [checkinOpen, setCheckinOpen] = useState(false);

  const totalWeeks = plan.extension_cycle_length === 21 ? 3 : 2;
  const currentWeek = useMemo(
    () =>
      checkins.length > 0 ? Math.max(...checkins.map((c) => c.week_index)) + 1 : 1,
    [checkins],
  );
  const cycleDone = currentWeek > totalWeeks;

  const avgAdherence = useMemo(() => {
    const scores = checkins
      .map((c) => c.adherence_score)
      .filter((s): s is number => s != null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [checkins]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 p-1.5">
            <HeartHandshake className="h-4 w-4 text-primary" />
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            RESET · 건강리셋 연장 프로그램
          </p>
        </div>
        <h2 className="mt-1 text-[20px] font-extrabold leading-tight text-foreground">
          {plan.extension_cycle_length}일 연장 · {Math.min(currentWeek, totalWeeks)} / {totalWeeks}주
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          지금 필요한 것은 더 극단적인 제한이 아니라
          <br />더 안정적인 감량 루틴입니다.
        </p>

        {/* 사이클 진행 바 */}
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
            const done = w < currentWeek;
            const active = w === currentWeek && !cycleDone;
            return (
              <div
                key={w}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  done
                    ? "bg-primary"
                    : active
                      ? "bg-primary/50"
                      : "bg-muted",
                )}
              />
            );
          })}
        </div>
      </section>

      {/* 요약 지표 */}
      <section className="grid grid-cols-3 gap-2">
        <MiniStat
          icon={<LineChart className="h-3.5 w-3.5" />}
          label="인증률 평균"
          value={avgAdherence != null ? `${avgAdherence}%` : "—"}
        />
        <MiniStat
          icon={<Dumbbell className="h-3.5 w-3.5" />}
          label="누적 운동"
          value={`${checkins.reduce((a, c) => a + c.attended_workouts, 0)}회`}
        />
        <MiniStat
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          label="사이클"
          value={plan.extension_cycle_index >= 1
            ? `${plan.extension_cycle_index + 1}차`
            : "1차"}
        />
      </section>

      {/* 미션 */}
      <section>
        <p className="mb-2 text-[12px] font-extrabold text-foreground">
          이번 사이클 미션
        </p>
        <ul className="space-y-1.5">
          {EXTEND_MISSIONS.map((m) => (
            <li
              key={m.code}
              className="rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[12.5px] font-bold text-foreground">{m.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {m.hint}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 정체기 안내 */}
      <section className="rounded-2xl border border-border bg-muted/30 p-3 text-[12px] leading-relaxed text-muted-foreground">
        <p className="text-[11px] font-bold text-foreground">정체기가 오면</p>
        <p className="mt-0.5">
          식사량 추가 제한보다 수면 · 단백질 · 걸음 수를 먼저 안정화하세요.
          일주일 이상 정체 시 코치와 개별 상담을 권합니다.
        </p>
      </section>

      {/* 주간 체크인 CTA */}
      {!cycleDone ? (
        <Button
          onClick={() => setCheckinOpen(true)}
          className={cn(
            "h-12 w-full rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
            "shadow-[0_6px_22px_-6px_hsl(var(--primary)/0.6)]",
          )}
        >
          <CalendarCheck className="mr-1.5 h-4 w-4" />
          {currentWeek}주차 체크인 시작
        </Button>
      ) : (
        <div className="rounded-2xl border border-reward/30 bg-reward/10 p-4 text-center">
          <p className="text-[12px] font-extrabold text-[#F6C453]">
            🏅 연장 사이클 완주
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            한 번 더 이어갈지, 유지 모드로 전환할지 코치와 상담해 주세요.
          </p>
        </div>
      )}

      {/* 체크인 히스토리 */}
      {checkins.length > 0 && (
        <section className="space-y-2">
          <p className="text-[12px] font-extrabold text-foreground">체크인 히스토리</p>
          <ul className="space-y-1.5">
            {checkins.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
              >
                <div>
                  <p className="font-bold text-foreground">{c.week_index}주차</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.checkin_date} · 운동 {c.attended_workouts}회
                    {c.waist_cm != null && ` · ${c.waist_cm.toFixed(1)} cm`}
                  </p>
                </div>
                {c.adherence_score != null && (
                  <span className="number-font rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {c.adherence_score}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeeklyCheckinDialog
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        planId={plan.id}
        weekIndex={currentWeek}
        mode="extend"
      />
    </div>
  );
};

const MiniStat = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-2.5 text-center">
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </span>
    <p className="mt-0.5 number-font text-[14px] font-extrabold text-foreground">
      {value}
    </p>
  </div>
);

export default ExtendHome;
