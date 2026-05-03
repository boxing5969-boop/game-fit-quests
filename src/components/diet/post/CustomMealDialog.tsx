import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MealItem } from "@/data/nutrition/mealLibrary";
import {
  MEAL_SLOT_LABEL_KO,
  type MealSlot,
} from "@/lib/diet/nutritionEngine";

interface CustomMealDialogProps {
  slot: MealSlot;
  onClose: () => void;
  onSave: (item: MealItem) => void;
}

/**
 * 직접 먹는 메뉴를 그대로 입력 — 라이브러리에 없는 음식·외식·홈메이드 대응.
 *
 * 입력 필드 (최소):
 *   · 이름 (text)
 *   · 칼로리 (kcal)
 *   · 단백질·지방·탄수 (g, 선택)
 *   · 발효식품 여부 (유산균 체크)
 *
 * 섬유질·비타민·무기질은 자동으로 0/빈 배열 — 다른 끼니에서 보강되면 OK.
 */
export const CustomMealDialog = ({ slot, onClose, onSave }: CustomMealDialogProps) => {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fiber, setFiber] = useState("");
  const [probiotic, setProbiotic] = useState(false);

  if (typeof document === "undefined") return null;

  const canSave = !!name.trim() && !!kcal && Number(kcal) > 0;

  const handleSave = () => {
    const code = `custom_${slot}_${Date.now()}`;
    const item: MealItem = {
      id: code,
      code,
      name: name.trim(),
      calories: Number(kcal) || 0,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      proteinG: Number(protein) || 0,
      fat: Number(fat) || 0,
      fatG: Number(fat) || 0,
      carbs: Number(carbs) || 0,
      carbsG: Number(carbs) || 0,
      fiberG: Number(fiber) || 0,
      keyVitamins: [],
      keyMinerals: [],
      hasProbiotic: probiotic,
      type: "lunch",
      slots: [slot],
      tags: ["직접 입력"],
      note: "회원이 직접 입력한 메뉴입니다.",
    } as MealItem;
    onSave(item);
  };

  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-border bg-card shadow-elev-3">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-1.5">
            <Pencil className="h-4 w-4 text-primary" />
            <p className="text-[13px] font-extrabold text-foreground">
              {MEAL_SLOT_LABEL_KO[slot]} 직접 입력
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">
              메뉴 이름
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 엄마표 잡채밥 + 김치"
              className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <Num label="칼로리 (kcal)" value={kcal} onChange={setKcal} placeholder="예: 500" />

          <div className="grid grid-cols-3 gap-2">
            <Num label="단백질 (g)" value={protein} onChange={setProtein} placeholder="25" />
            <Num label="지방 (g)" value={fat} onChange={setFat} placeholder="15" />
            <Num label="탄수 (g)" value={carbs} onChange={setCarbs} placeholder="55" />
          </div>

          <Num
            label="섬유질 (g, 선택)"
            value={fiber}
            onChange={setFiber}
            placeholder="예: 4"
          />

          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={probiotic}
              onChange={(e) => setProbiotic(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="font-bold">발효식품 포함 (김치·요거트·된장 등)</span>
          </label>

          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            비타민·무기질은 다른 끼니에서 자동 보강됩니다. 정확한 수치를 모르면 대략적인 숫자로 입력해도 OK.
          </p>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} className="h-10 rounded-xl px-4">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "ml-auto h-10 flex-1 rounded-xl font-bold",
              "bg-primary text-primary-foreground disabled:opacity-60",
            )}
          >
            이 메뉴로 적용
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const Num = ({
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

export default CustomMealDialog;
