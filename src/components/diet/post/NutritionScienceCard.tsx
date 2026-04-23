import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NutritionTarget } from "@/lib/diet/nutritionEngine";

interface NutritionScienceCardProps {
  target: NutritionTarget;
  weightKg: number;
  sex: "male" | "female";
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
  sex,
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
            label={`단백질 ${sex === "male" ? "1.5" : "1.2"} g/kg (${sex === "male" ? "남성" : "여성"} 체중 ${weightKg}kg 기준)`}
            body="성별별 베이스라인 — 근손실 방지 + 포만감 확보. 운동 강도에 따라 개인이 상향 조정 가능."
          />
          <Row
            label="지방을 25% 이하로 내리지 않는 이유"
            body="성호르몬·비타민 흡수·세포막 유지에 필요한 최소선. 더 줄이면 컨디션·생리 주기 영향."
          />

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11.5px] font-extrabold text-foreground">
              5대 영양소 + 프로바이오틱스
            </p>
            <ul className="mt-1.5 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">단백질</strong> — 근육·효소·면역세포 재료. 감량기 근손실을 막는 1순위.</li>
              <li><strong className="text-foreground">지방</strong> — 호르몬 전구체, 지용성 비타민(A·D·E·K) 흡수 매개.</li>
              <li><strong className="text-foreground">탄수화물</strong> — 뇌·근육의 주 연료. 섬유질은 장 건강·혈당 안정.</li>
              <li><strong className="text-foreground">비타민</strong> — 대사 반응의 촉매. 수용성(B·C)은 매일, 지용성(A·D·E·K)은 지방과 함께.</li>
              <li><strong className="text-foreground">무기질</strong> — 철(산소 운반)·칼슘(뼈·수축)·마그네슘(300+ 효소)·아연(면역).</li>
              <li><strong className="text-foreground">프로바이오틱스</strong> — 장내 미생물 균형. 요거트·김치·된장·사우어크라우트·케피어 중 1회/일.</li>
            </ul>
          </div>

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
