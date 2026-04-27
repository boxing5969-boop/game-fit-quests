import { useMemo, useState } from "react";
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  recommendPath,
  recommendationLabel,
  type RecommendInput,
} from "@/lib/diet/recommendEngine";
import type {
  DietPostProgramPlan,
  DietPostProgramRecommendation,
} from "@/lib/diet/postProgramTypes";
import { useSelectPostProgramPath } from "@/hooks/useDietPostProgram";
import { buildChooserPreviewFeedback } from "@/lib/diet/postProgramCoachEngine";

interface NextStepChooserProps {
  plan: DietPostProgramPlan;
  recentAdherence7d: number | null;
  lateBingeCount7d?: number | null;
  sugaryDrinkCount7d?: number | null;
  attendanceStable?: boolean | null;
  onDone?: () => void;
}

/**
 * 21일 종료 후 다음 단계 2갈래 선택 UI.
 *
 * 규칙:
 *   - 톤: "실패/성공" 이분법 금지. "지금 상태에 맞는 다음 단계를 고르는" 느낌.
 *   - 서버 추천(plan.recommended_path) + 클라이언트 보강(최근 7일)
 *   - 코치 권장(plan.coach_recommended_path)이 있으면 우선 표기
 *   - target_achieved 는 1회 자기보고
 */
export const NextStepChooser = ({
  plan,
  recentAdherence7d,
  lateBingeCount7d = null,
  sugaryDrinkCount7d = null,
  attendanceStable = null,
  onDone,
}: NextStepChooserProps) => {
  const [targetAchieved, setTargetAchieved] = useState<boolean | null>(
    plan.target_achieved,
  );
  const [weight, setWeight] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [cycleLength, setCycleLength] = useState<14 | 21>(14);
  // 추가: 연장 모드 목표 + 현재 체중 (코치 피드백 입력값)
  const [extendTargetWeight, setExtendTargetWeight] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");

  const selectMut = useSelectPostProgramPath();

  // 추가: 연장 사이클 데드라인 미리보기 — 오늘 + cycleLength
  const extendDeadlinePreview = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + cycleLength);
    const iso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return { iso, days: cycleLength };
  }, [cycleLength]);

  // 추가: 입력값 기반 오삼 코치 즉시 피드백 (선택 전 미리보기)
  const previewMaintenance = useMemo(
    () =>
      buildChooserPreviewFeedback({
        path: "maintenance",
        maintenanceTargetWeightKg: weight ? Number(weight) : null,
        currentWeightKg: currentWeight ? Number(currentWeight) : null,
      }),
    [weight, currentWeight],
  );
  const previewExtend = useMemo(
    () =>
      buildChooserPreviewFeedback({
        path: "extend",
        extensionCycleLength: cycleLength,
        extensionTargetWeightKg: extendTargetWeight
          ? Number(extendTargetWeight)
          : null,
        currentWeightKg: currentWeight ? Number(currentWeight) : null,
      }),
    [cycleLength, extendTargetWeight, currentWeight],
  );

  const reco = useMemo(() => {
    const input: RecommendInput = {
      summary: plan.completion_summary,
      targetAchieved,
      recentAdherence7d,
      lateBingeCount7d,
      sugaryDrinkCount7d,
      attendanceStable,
      coachRecommendation: plan.coach_recommended_path ?? plan.recommended_path,
    };
    return recommendPath(input);
  }, [plan, targetAchieved, recentAdherence7d, lateBingeCount7d, sugaryDrinkCount7d, attendanceStable]);

  const handleSelect = async (path: "maintenance" | "extend") => {
    const res = await selectMut.mutateAsync({
      planId: plan.id,
      path,
      targetAchieved,
      maintenanceTargetWeightKg:
        path === "maintenance" && weight ? Number(weight) : null,
      maintenanceTargetWaistCm:
        path === "maintenance" && waist ? Number(waist) : null,
      extensionCycleLength: path === "extend" ? cycleLength : 14,
    });
    if (res.success) onDone?.();
  };

  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
      aria-labelledby="next-step-title"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
          NEXT STEP · 21일 이후
        </p>
        <h2
          id="next-step-title"
          className="mt-1 text-[20px] font-extrabold leading-tight text-foreground"
        >
          이제 내 몸에 맞는 다음 단계를 골라요
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          둘 중 어느 쪽이든 21일 동안 만든 리듬을 이어가는 길입니다.
        </p>
      </div>

      {/* 자기보고: 목표 체중 달성 여부 */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[12px] font-bold text-foreground">
          내가 세운 목표 체중에 도달했나요?
        </p>
        <div className="mt-2 flex gap-2">
          <YesNoPill
            selected={targetAchieved === true}
            onClick={() => setTargetAchieved(true)}
            label="네, 도달했어요"
          />
          <YesNoPill
            selected={targetAchieved === false}
            onClick={() => setTargetAchieved(false)}
            label="아직이에요"
          />
        </div>
      </div>

      {/* 추천 박스 */}
      <div
        className={cn(
          "rounded-xl border px-3 py-2.5 text-[12px]",
          reco.path === "maintenance"
            ? "border-emerald-400/40 bg-emerald-400/10"
            : reco.path === "extend"
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-muted/40",
        )}
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          추천
        </p>
        <p className="mt-0.5 font-extrabold text-foreground">
          {recommendationLabel(reco.path)}
        </p>
        {reco.reasons.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted-foreground">
            {reco.reasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
      </div>

      {plan.coach_recommendation_note && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
            코치 한마디
          </p>
          <p className="mt-0.5">{plan.coach_recommendation_note}</p>
        </div>
      )}

      {/* 두 갈래 카드 */}
      <div className="grid grid-cols-1 gap-3">
        <PathCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="유지 컨설팅 모드"
          subtitle="유연하게 먹으면서도 무너지지 않는 유지 전략"
          bullets={[
            "주 1회 체중 또는 허리 체크",
            "외식·자유식 기록 + 다음 끼니 복귀",
            "유지 범위 급증 시 3일 복귀 미션 자동 제안",
          ]}
          recommended={reco.path === "maintenance"}
          tone="good"
        >
          <div className="mt-2 grid grid-cols-2 gap-2">
            <LabeledInput
              label="유지 기준 체중 (kg)"
              value={weight}
              onChange={setWeight}
              placeholder="예: 62.5"
              type="decimal"
            />
            <LabeledInput
              label="유지 기준 허리 (cm)"
              value={waist}
              onChange={setWaist}
              placeholder="예: 78"
              type="decimal"
            />
          </div>
          <div className="mt-2">
            <LabeledInput
              label="현재 체중 (kg, 선택)"
              value={currentWeight}
              onChange={setCurrentWeight}
              placeholder="예: 63.0"
              type="decimal"
            />
          </div>
          {/* 오삼 코치 동적 피드백 — 입력값 기반 */}
          <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              오삼 코치 한마디
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
              {previewMaintenance}
            </p>
          </div>
          <Button
            onClick={() => handleSelect("maintenance")}
            disabled={selectMut.isPending}
            className={cn(
              "mt-3 h-10 w-full rounded-xl font-bold",
              "bg-emerald-500/90 text-white hover:bg-emerald-500",
            )}
          >
            {selectMut.isPending ? "설정 중..." : "유지 모드로 전환하기"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </PathCard>

        <PathCard
          icon={<HeartHandshake className="h-5 w-5" />}
          title="건강리셋 연장 프로그램"
          subtitle="극단적 제한이 아니라 안정적인 감량 루틴"
          bullets={[
            "14일 또는 21일 연장 사이클",
            "감량기용 미션 재구성 + 식단 체크인 유지",
            "정체기 대응 안내 + 주간 코치 피드백",
          ]}
          recommended={reco.path === "extend"}
          tone="focus"
        >
          <div className="mt-2 flex gap-2">
            <CyclePill
              label="14일"
              selected={cycleLength === 14}
              onClick={() => setCycleLength(14)}
            />
            <CyclePill
              label="21일"
              selected={cycleLength === 21}
              onClick={() => setCycleLength(21)}
            />
          </div>
          {/* 데드라인 미리보기 — 오늘 + cycleLength */}
          <div className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11.5px] text-foreground">
            <span className="font-bold">데드라인:</span>{" "}
            <span className="number-font">{extendDeadlinePreview.iso}</span>
            <span className="ml-1 text-muted-foreground">
              (오늘 시작 시 D-{extendDeadlinePreview.days})
            </span>
          </div>
          {/* 연장 모드 목표 입력 — 새로 추가 */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <LabeledInput
              label="목표 체중 (kg)"
              value={extendTargetWeight}
              onChange={setExtendTargetWeight}
              placeholder="예: 60.0"
              type="decimal"
            />
            <LabeledInput
              label="현재 체중 (kg)"
              value={currentWeight}
              onChange={setCurrentWeight}
              placeholder="예: 63.0"
              type="decimal"
            />
          </div>
          {/* 오삼 코치 동적 피드백 — 사이클·목표·현재 체중 기반 */}
          <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              오삼 코치 한마디
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
              {previewExtend}
            </p>
          </div>
          <Button
            onClick={() => handleSelect("extend")}
            disabled={selectMut.isPending}
            className={cn(
              "mt-3 h-10 w-full rounded-xl font-bold",
              "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {selectMut.isPending ? "설정 중..." : "체지방 감량 계속하기"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </PathCard>
      </div>

      {selectMut.isError && (
        <p className="text-center text-[11px] text-destructive">
          선택을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <p className="pt-1 text-center text-[10.5px] leading-relaxed text-muted-foreground">
        어느 쪽을 골라도 언제든 코치와 상담 후 경로를 바꿀 수 있습니다.
      </p>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
const PathCard = ({
  icon,
  title,
  subtitle,
  bullets,
  recommended,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  recommended: boolean;
  tone: "good" | "focus";
  children?: React.ReactNode;
}) => (
  <div
    className={cn(
      "relative rounded-2xl border p-4 transition-all",
      recommended
        ? tone === "good"
          ? "border-emerald-400/50 bg-emerald-400/5 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
          : "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
        : "border-border bg-card",
    )}
  >
    {recommended && (
      <span
        className={cn(
          "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
          tone === "good"
            ? "bg-emerald-400/20 text-emerald-500"
            : "bg-primary/15 text-primary",
        )}
      >
        <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />
        추천
      </span>
    )}
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          tone === "good"
            ? "bg-emerald-400/15 text-emerald-500"
            : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <div>
        <h3 className="text-[15px] font-extrabold leading-tight text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <ul className="mt-3 space-y-1 text-[12px] text-foreground">
      {bullets.map((b) => (
        <li key={b} className="flex gap-1.5">
          <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="leading-relaxed">{b}</span>
        </li>
      ))}
    </ul>
    {children}
  </div>
);

const YesNoPill = ({
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
      "rounded-full px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95",
      selected
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground",
    )}
  >
    {label}
  </button>
);

const CyclePill = ({
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
      "flex-1 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all active:scale-95",
      selected
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-muted/30 text-muted-foreground",
    )}
  >
    {label}
  </button>
);

const LabeledInput = ({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "decimal" | "text";
}) => (
  <label className="flex flex-col gap-1 text-[11px] font-bold text-muted-foreground">
    {label}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={type === "decimal" ? "decimal" : "text"}
      className="number-font rounded-lg border border-border bg-card px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  </label>
);

export default NextStepChooser;
