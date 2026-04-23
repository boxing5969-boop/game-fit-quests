import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  classifyPatterns,
  extendReasonLine,
  PATTERN_HINT_KO,
  PATTERN_LABEL_KO,
  type ExtendPatternTag,
  type ExtendReassessment,
} from "@/lib/diet/extendPatternEngine";
import {
  DIET_HABIT_LABEL_KO,
  type DietExtendGoals,
  type DietPostProgramPlan,
} from "@/lib/diet/postProgramTypes";
import { useSubmitExtendReassessment } from "@/hooks/useDietPostProgram";

interface ExtendReassessmentWizardProps {
  plan: DietPostProgramPlan;
  onDone?: () => void;
}

/**
 * 건강리셋 연장 · 시작 전 재평가 + 목표 재설정 Wizard (3 steps).
 *
 * Step 1 — 최근 21일 상태 점검 (수행률·약점 습관·운동·수면·외식·야식)
 * Step 2 — 내가 느끼는 가장 큰 장애물 선택 + 예상 패턴 프리뷰
 * Step 3 — 연장 목표 6종 재설정 (체중/허리/출석/인증/수면/주말방어)
 *
 * 제출 후 서버가 pattern_tags 자동 분류 + plan 업데이트 → 이후 ExtendHome 진입.
 */
export const ExtendReassessmentWizard = ({
  plan,
  onDone,
}: ExtendReassessmentWizardProps) => {
  const submit = useSubmitExtendReassessment();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — 21일 요약에서 초기값 채우기
  const [adherence, setAdherence] = useState<string>(
    String(Math.round(plan.completion_summary.habit_score ?? 0)),
  );
  const [weakestHabit, setWeakestHabit] = useState<string>(
    plan.completion_summary.weakest_habit ?? "late_night_snack_avoided",
  );
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<number>(3);
  const [sleepHours, setSleepHours] = useState<string>("6.5");
  const [eatingOut, setEatingOut] = useState<number>(2);
  const [lateBinge, setLateBinge] = useState<number>(1);

  // Step 2 — 장애물 + override 패턴
  const [obstacle, setObstacle] = useState<ExtendReassessment["biggest_obstacle"]>(
    "weekend_crash",
  );
  const [userOverrides, setUserOverrides] = useState<ExtendPatternTag[]>([]);

  // Step 3 — 목표 6종 (초기값은 21일 수치 기반 보수적 세팅)
  const [weightTarget, setWeightTarget] = useState<string>(
    plan.maintenance_target_weight_kg
      ? plan.maintenance_target_weight_kg.toFixed(1)
      : "",
  );
  const [waistTarget, setWaistTarget] = useState<string>(
    plan.maintenance_waist_target_cm
      ? plan.maintenance_waist_target_cm.toFixed(1)
      : "",
  );
  const [workoutTarget, setWorkoutTarget] = useState<number>(4);
  const [checkinTarget, setCheckinTarget] = useState<number>(85);
  const [sleepTarget, setSleepTarget] = useState<string>("7");
  const [weekendDefense, setWeekendDefense] = useState<number>(2);

  const reassessment = useMemo<ExtendReassessment>(
    () => ({
      recent_21d_adherence: Number(adherence) || 0,
      weakest_habit: weakestHabit,
      weekly_workouts: weeklyWorkouts,
      sleep_hours: Number(sleepHours) || 0,
      eating_out_weekly: eatingOut,
      late_binge_weekly: lateBinge,
      biggest_obstacle: obstacle,
    }),
    [adherence, weakestHabit, weeklyWorkouts, sleepHours, eatingOut, lateBinge, obstacle],
  );

  const autoTags = useMemo(() => classifyPatterns(reassessment), [reassessment]);
  const mergedTags = useMemo(() => {
    const set = new Set<ExtendPatternTag>([...autoTags, ...userOverrides]);
    return Array.from(set);
  }, [autoTags, userOverrides]);

  const reasonLine = useMemo(
    () => extendReasonLine(reassessment, mergedTags),
    [reassessment, mergedTags],
  );

  const submitAll = async () => {
    const goals: DietExtendGoals = {
      weight_kg_target: weightTarget ? Number(weightTarget) : null,
      waist_cm_target: waistTarget ? Number(waistTarget) : null,
      weekly_workouts_target: workoutTarget,
      weekly_checkin_rate_target: checkinTarget,
      sleep_hours_target: Number(sleepTarget) || 7,
      weekend_defense_target: weekendDefense,
    };

    const res = await submit.mutateAsync({
      planId: plan.id,
      reassessment,
      extendGoals: goals,
      userPatternOverrides: userOverrides,
    });
    if (res.success) onDone?.();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-card p-5">
      {/* 헤더 */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
          EXTEND · 재평가 {step} / 3
        </p>
        <h2 className="mt-1 text-[18px] font-extrabold leading-tight text-foreground">
          {step === 1 && "지난 21일 어떤 흐름이었나요?"}
          {step === 2 && "가장 큰 장애물은 무엇인가요?"}
          {step === 3 && "이번 연장 목표를 정리해요"}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          아직 끝난 것이 아니라 다음 단계입니다. 더 독하게가 아니라 더 안정적으로.
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              step >= s ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-3">
          <Row
            label="최근 21일 수행률 (%)"
            value={adherence}
            onChange={setAdherence}
            placeholder="예: 68"
          />
          <SelectRow
            label="가장 자주 무너진 습관"
            value={weakestHabit}
            onChange={setWeakestHabit}
            options={Object.entries(DIET_HABIT_LABEL_KO).map(([v, k]) => ({
              value: v,
              label: k,
            }))}
          />
          <CounterRow
            label="주간 운동 횟수 (복싱 포함)"
            value={weeklyWorkouts}
            onChange={setWeeklyWorkouts}
            max={7}
          />
          <Row
            label="평균 수면 시간"
            value={sleepHours}
            onChange={setSleepHours}
            placeholder="예: 6.5"
          />
          <CounterRow
            label="외식/회식 횟수 (주간)"
            value={eatingOut}
            onChange={setEatingOut}
            max={14}
          />
          <CounterRow
            label="늦은 폭식 횟수 (주간)"
            value={lateBinge}
            onChange={setLateBinge}
            max={14}
          />
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <p className="text-[12px] font-bold text-foreground">
              지금 가장 큰 장애물 하나를 골라주세요
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(
                [
                  ["late_binge", "야식 습관"],
                  ["eating_out", "잦은 외식"],
                  ["weekend_crash", "주말 붕괴"],
                  ["sleep_short", "수면 부족"],
                  ["stress", "스트레스"],
                  ["other", "기타"],
                ] as const
              ).map(([v, l]) => (
                <ObstaclePill
                  key={v}
                  selected={obstacle === v}
                  onClick={() => setObstacle(v)}
                  label={l}
                />
              ))}
            </div>
          </div>

          {/* 자동 패턴 프리뷰 */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[12px] leading-relaxed">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              예상 패턴
            </p>
            <p className="mt-1 font-bold text-foreground">{reasonLine}</p>
            {mergedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {mergedTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary"
                  >
                    {PATTERN_LABEL_KO[t]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 사용자 override — 추가 체감 */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">
              추가로 체감하는 패턴 (선택)
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(Object.keys(PATTERN_LABEL_KO) as ExtendPatternTag[]).map((t) => {
                const selected = userOverrides.includes(t);
                const autoIncluded = autoTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setUserOverrides((prev) =>
                        selected ? prev.filter((x) => x !== t) : [...prev, t],
                      );
                    }}
                    disabled={autoIncluded}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-left text-[11.5px] font-bold transition-all",
                      autoIncluded
                        ? "border-primary/20 bg-primary/5 text-primary opacity-70"
                        : selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {PATTERN_LABEL_KO[t]}
                    {autoIncluded && (
                      <span className="ml-1 text-[9px] font-bold opacity-80">
                        자동
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
              {PATTERN_HINT_KO[
                (mergedTags[0] as ExtendPatternTag) ?? "weekend_crash"
              ]}
            </p>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Row
              label="체중 목표 (kg)"
              value={weightTarget}
              onChange={setWeightTarget}
              placeholder="예: 62"
            />
            <Row
              label="허리 목표 (cm)"
              value={waistTarget}
              onChange={setWaistTarget}
              placeholder="예: 75"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CounterRow
              label="주 운동 목표"
              value={workoutTarget}
              onChange={setWorkoutTarget}
              max={7}
              suffix="회"
            />
            <CounterRow
              label="주말 방어"
              value={weekendDefense}
              onChange={setWeekendDefense}
              max={2}
              suffix="일"
            />
          </div>
          <Row
            label="주간 식단 인증 목표 (%)"
            value={String(checkinTarget)}
            onChange={(v) => setCheckinTarget(Math.max(0, Math.min(100, Number(v) || 0)))}
            placeholder="기본 85"
          />
          <Row
            label="수면 목표 (시간)"
            value={sleepTarget}
            onChange={setSleepTarget}
            placeholder="예: 7"
          />
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
            극단적 제한 대신 습관 목표 중심. 주말 방어·수면 안정화만 잡아도 체지방이 풀립니다.
          </p>
        </div>
      )}

      {/* 네비 */}
      <div className="flex gap-2 pt-1">
        {step > 1 ? (
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
            className="h-11 rounded-xl px-3"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            이전
          </Button>
        ) : (
          <div className="w-[84px]" />
        )}
        <Button
          onClick={() => {
            if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
            else submitAll();
          }}
          disabled={submit.isPending}
          className={cn(
            "ml-auto h-11 flex-1 rounded-xl font-bold",
            "bg-primary text-primary-foreground",
          )}
        >
          {submit.isPending
            ? "저장 중..."
            : step < 3
              ? "다음"
              : "연장 시작하기"}
          {step === 3 ? (
            <Sparkles className="ml-1 h-4 w-4" />
          ) : (
            <ArrowRight className="ml-1 h-4 w-4" />
          )}
        </Button>
      </div>

      {submit.isError && (
        <p className="text-center text-[11px] text-destructive">
          저장에 실패했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
const Row = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <label className="block">
    <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      placeholder={placeholder}
      className="number-font mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  </label>
);

const CounterRow = ({
  label,
  value,
  onChange,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  suffix?: string;
}) => (
  <div>
    <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    <div className="mt-0.5 flex items-center overflow-hidden rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex-1 py-1.5 text-[14px] font-bold text-muted-foreground active:bg-muted"
      >
        -
      </button>
      <span className="number-font px-2 text-[14px] font-extrabold text-foreground">
        {value}
        {suffix && (
          <span className="ml-0.5 text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex-1 py-1.5 text-[14px] font-bold text-primary active:bg-muted"
      >
        +
      </button>
    </div>
  </div>
);

const SelectRow = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className="block">
    <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const ObstaclePill = ({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border px-2.5 py-2 text-left text-[12px] font-bold transition-all active:scale-95",
      selected
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-muted/30 text-muted-foreground",
    )}
  >
    {label}
  </button>
);

export default ExtendReassessmentWizard;
