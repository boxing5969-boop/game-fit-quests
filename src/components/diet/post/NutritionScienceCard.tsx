import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NutritionTarget } from "@/lib/diet/nutritionEngine";

interface NutritionScienceCardProps {
  target: NutritionTarget;
  weightKg: number;
  mode: "maintenance" | "fat_loss";
}

/**
 * "왜 이 숫자인가?" 과학 설명 카드. 접고 펼 수 있음.
 *
 * 톤:
 *   · 권위적·잔소리 X. "당신의 몸은 이렇게 작동합니다" 설명체.
 *   · 근거 인용은 짧게 (Mifflin 1990, ISSN 2017, Lancet 2011).
 */
export const NutritionScienceCard = ({
  target,
  weightKg,
  mode,
}: NutritionScienceCardProps) => {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 active:scale-[0.99]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-extrabold text-foreground">왜 이 숫자인가요?</p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3 text-[12px] leading-relaxed text-foreground">
          <Row
            label={`기초 대사량 ${target.bmr} kcal`}
            body="숨만 쉬고 체온을 유지하는 데 쓰는 에너지예요. Mifflin-St Jeor 공식 (성별·키·몸무게·나이) 을 사용합니다."
          />
          <Row
            label={`하루 총 에너지 ${target.tdee} kcal`}
            body="BMR 에 활동 계수를 곱한 값. 출퇴근·운동·일상 움직임을 포함한 하루 총 소비입니다."
          />
          <Row
            label={`오늘의 목표 ${target.kcalTarget} kcal`}
            body={target.kcalReason}
          />
          <Row
            label={`단백질 ${target.proteinG}g · 지방 ${target.fatG}g · 탄수 ${target.carbsG}g`}
            body={target.macroReason}
          />
          <Row
            label="왜 감량은 주당 0.3~0.5 kg 인가"
            body="더 빠른 감량은 근육량·기초 대사량이 함께 빠져 요요 가능성이 급격히 올라갑니다. Hall 2011 Lancet 연구 기반 권장."
          />
          <Row
            label={`단백질 ${mode === "fat_loss" ? "1.8" : "1.6"} g/kg (체중 ${weightKg}kg)`}
            body="감량기 근손실 방지 + 포만감 확보. ISSN (국제스포츠영양학회) 2017 성명 권장선."
          />
          <Row
            label="지방을 25% 이하로 내리지 않는 이유"
            body="성호르몬·비타민 흡수·세포막 유지에 필요한 최소선. 더 줄이면 컨디션·생리 주기 영향."
          />
          <p className="text-[11px] italic text-muted-foreground">
            * 값은 계산 기반 가이드입니다. 임신·수유·질환 시 담당의와 상담하세요.
          </p>
        </div>
      )}
    </section>
  );
};

const Row = ({ label, body }: { label: string; body: string }) => (
  <div>
    <p className="text-[12px] font-extrabold text-foreground">{label}</p>
    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
  </div>
);

export default NutritionScienceCard;
