import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubmitPostProgramCheckin } from "@/hooks/useDietPostProgram";

interface WeeklyCheckinDialogProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  weekIndex: number;
  mode: "maintenance" | "extend";
  onSubmitted?: (needsRecovery: boolean) => void;
}

/**
 * 유지/연장 공용 주간 체크인 다이얼로그.
 *
 * 모드별 표시:
 *   - maintenance: 체중 or 허리 1주 1회 + 자유식/복싱 횟수
 *   - extend: 허리 선택 + 주 4회 운동/인증률
 */
export const WeeklyCheckinDialog = ({
  open,
  onClose,
  planId,
  weekIndex,
  mode,
  onSubmitted,
}: WeeklyCheckinDialogProps) => {
  const submit = useSubmitPostProgramCheckin();

  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [adherence, setAdherence] = useState("");
  const [flexibleMeals, setFlexibleMeals] = useState(0);
  const [lateBinge, setLateBinge] = useState(0);
  const [workouts, setWorkouts] = useState(0);
  const [proteinDays, setProteinDays] = useState(0);
  const [reflection, setReflection] = useState("");

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async () => {
    const res = await submit.mutateAsync({
      planId,
      weekIndex,
      weightKg: weight ? Number(weight) : null,
      waistCm: waist ? Number(waist) : null,
      adherenceScore: adherence ? Number(adherence) : null,
      flexibleMealsCount: flexibleMeals,
      lateBingeCount: lateBinge,
      attendedWorkouts: workouts,
      proteinFirstDays: proteinDays,
      reflection: reflection || null,
    });
    if (res.success) {
      onSubmitted?.(res.needs_recovery);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-border bg-card shadow-elev-3">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-[13px] font-extrabold text-foreground">
            {mode === "maintenance" ? "유지" : "연장"} · {weekIndex}주차 체크인
          </p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <Row
            label="이번 주 체중 (kg, 선택)"
            value={weight}
            onChange={setWeight}
            placeholder="예: 63.2"
          />
          <Row
            label="이번 주 허리 (cm, 선택)"
            value={waist}
            onChange={setWaist}
            placeholder="예: 78"
          />
          <Row
            label="자기 평가 수행률 (0~100, 선택)"
            value={adherence}
            onChange={setAdherence}
            placeholder="예: 82"
          />

          <div className="grid grid-cols-2 gap-2">
            <CounterRow
              label="복싱/운동 횟수"
              value={workouts}
              onChange={setWorkouts}
              max={7}
            />
            <CounterRow
              label="단백질 먼저 먹은 날"
              value={proteinDays}
              onChange={setProteinDays}
              max={7}
            />
            <CounterRow
              label={mode === "maintenance" ? "자유식/외식 횟수" : "외식 횟수"}
              value={flexibleMeals}
              onChange={setFlexibleMeals}
              max={10}
            />
            <CounterRow
              label="늦은 폭식"
              value={lateBinge}
              onChange={setLateBinge}
              max={10}
            />
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">
              이번 주 메모 (선택)
            </span>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="이번 주에 잘한 점, 다음 주 집중할 점"
              className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 rounded-xl px-4"
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submit.isPending}
            className={cn(
              "ml-auto h-10 flex-1 rounded-xl font-bold",
              "bg-primary text-primary-foreground",
            )}
          >
            {submit.isPending ? "저장 중..." : "체크인 저장"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
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

export default WeeklyCheckinDialog;
