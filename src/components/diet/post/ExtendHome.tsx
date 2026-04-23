import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  Flag,
  HeartHandshake,
  LineChart,
  Tags,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DietPostProgramCheckin,
  DietPostProgramPlan,
} from "@/lib/diet/postProgramTypes";
import {
  PATTERN_LABEL_KO,
  type ExtendPatternTag,
} from "@/lib/diet/extendPatternEngine";
import { pickWeeklyMissions } from "@/lib/diet/extendMissionEngine";
import WeeklyCheckinDialog from "./WeeklyCheckinDialog";
import ExtendReassessmentWizard from "./ExtendReassessmentWizard";
import ExtendCycleResult from "./ExtendCycleResult";
import AutoMealPlanSection from "./AutoMealPlanSection";

interface ExtendHomeProps {
  plan: DietPostProgramPlan;
  checkins: DietPostProgramCheckin[];
}

/**
 * 건강리셋 연장 프로그램 홈 (11단계 · fat_loss_extend_153 deep).
 *
 * 렌더 분기:
 *   1. extend_started_at 없음 → ExtendReassessmentWizard (재평가 + 목표 설정 3-step)
 *   2. currentWeek > totalWeeks → ExtendCycleResult (유지/재연장/상담)
 *   3. 그 외 → 패턴 기반 주간 미션 + 목표 대시보드 + 주간 체크인
 *
 * 주차 계산: 완료 체크인 중 `week_index` 최댓값 + 1. 시작일 대비 달력 주차가 아니라
 * 체크인 제출 기준으로 잡아야 회원 페이스에 맞게 동작.
 */
export const ExtendHome = ({ plan, checkins }: ExtendHomeProps) => {
  const [checkinOpen, setCheckinOpen] = useState(false);

  const totalWeeks = Math.max(1, Math.floor(plan.extension_cycle_length / 7));
  const currentWeek = useMemo(
    () =>
      checkins.length > 0 ? Math.max(...checkins.map((c) => c.week_index)) + 1 : 1,
    [checkins],
  );
  const cycleDone = currentWeek > totalWeeks;

  // 1) 재평가 미완료 → Wizard
  if (!plan.extend_started_at || !plan.reassessment) {
    return <ExtendReassessmentWizard plan={plan} />;
  }

  // 2) 사이클 완주 → 결과 선택
  if (cycleDone) {
    return <ExtendCycleResult plan={plan} totalWeeks={totalWeeks} />;
  }

  // 3) 일반 진행 상태
  const tags = (plan.pattern_tags ?? []) as ExtendPatternTag[];
  // playbook 은 1, 2 주차만 정의 → 3주차 이상은 2주차 미션 재사용 (정체기 대응 톤)
  const weekForPlaybook = (currentWeek >= 2 ? 2 : 1) as 1 | 2;
  const missions = pickWeeklyMissions(tags, weekForPlaybook);

  const avgAdherence = useMemo(() => {
    const scores = checkins
      .map((c) => c.adherence_score)
      .filter((s): s is number => s != null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [checkins]);

  const goals = plan.extend_goals;

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
          {plan.extension_cycle_length}일 연장 · {Math.min(currentWeek, totalWeeks)} /{" "}
          {totalWeeks}주 · {currentWeek === 1 ? "리듬 재정렬" : "감량 지속 / 정체기 대응"}
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
                  done ? "bg-primary" : active ? "bg-primary/50" : "bg-muted",
                )}
              />
            );
          })}
        </div>
      </section>

      {/* 패턴 태그 */}
      {tags.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            내 약점 패턴
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-bold text-primary"
              >
                {PATTERN_LABEL_KO[t] ?? t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            이번 주 미션은 이 패턴에 맞춰 구성됩니다. 코치가 태그를 조정할 수 있어요.
          </p>
        </section>
      )}

      {/* 목표 대시보드 */}
      {goals && (
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <p className="text-[12px] font-extrabold text-foreground">연장 목표</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <GoalTile
              label="운동"
              value={`${goals.weekly_workouts_target}회/주`}
            />
            <GoalTile
              label="인증률"
              value={`${goals.weekly_checkin_rate_target}%`}
            />
            <GoalTile
              label="수면"
              value={`${goals.sleep_hours_target}h`}
            />
            {goals.weight_kg_target != null && (
              <GoalTile
                label="체중"
                value={`${goals.weight_kg_target}kg`}
              />
            )}
            {goals.waist_cm_target != null && (
              <GoalTile
                label="허리"
                value={`${goals.waist_cm_target}cm`}
              />
            )}
            <GoalTile
              label="주말 방어"
              value={`${goals.weekend_defense_target}일`}
            />
          </div>
        </section>
      )}

      {/* 자동 식단 — 연장 프로그램은 감량 모드 + 약점 패턴 반영 */}
      <AutoMealPlanSection mode="fat_loss" preferPatterns={tags} />

      {/* 요약 지표 — 진행 중 실측 */}
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
          value={
            plan.extension_cycle_index >= 1
              ? `${plan.extension_cycle_index + 1}차`
              : "1차"
          }
        />
      </section>

      {/* 코치 한마디 (이탈 방지 메시지 포함) */}
      {plan.coach_recommendation_note && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
            코치 한마디
          </p>
          <p className="mt-0.5">{plan.coach_recommendation_note}</p>
        </section>
      )}

      {/* 주차별 미션 */}
      <section>
        <p className="mb-2 text-[12px] font-extrabold text-foreground">
          이번 주 미션 · {currentWeek === 1 ? "리듬 재정렬" : "감량 지속 / 정체기 대응"}
        </p>
        <ul className="space-y-1.5">
          {missions.map((m) => (
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
                {c.needs_recovery && <Flag className="h-3.5 w-3.5 text-primary" />}
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

const GoalTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-primary/15 bg-primary/5 p-2.5 text-center">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 number-font text-[13px] font-extrabold text-foreground">
      {value}
    </p>
  </div>
);

export default ExtendHome;
