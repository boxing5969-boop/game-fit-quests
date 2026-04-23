import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterMenus,
  type MealItem,
} from "@/data/nutrition/mealLibrary";
import {
  MEAL_SLOT_LABEL_KO,
  type MealSlot,
} from "@/lib/diet/nutritionEngine";

interface MealSwapDialogProps {
  slot: MealSlot;
  current: MealItem | null;
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  onClose: () => void;
  onPick: (item: MealItem) => void;
}

/**
 * 끼니 교체 다이얼로그.
 *
 * 회원이 외식·회식·자유식을 할 때 해당 끼니를 선택해 "오늘은 이 메뉴로 교체"를 누르면
 * 다음 끼니가 자동으로 가벼운 복귀 톤으로 재선택된다 (swapMealWithAutoAdjust).
 */
export const MealSwapDialog = ({
  slot,
  current,
  dietaryRestrictions,
  dislikedIngredients,
  onClose,
  onPick,
}: MealSwapDialogProps) => {
  if (typeof document === "undefined") return null;

  // 외식/자유식 후보 + 일반 대안 모두 표시
  const options = filterMenus({
    slot,
    excludeTags:
      dietaryRestrictions?.includes("vegan") ? ["유제품"] : [],
    excludeIngredients: dislikedIngredients,
  }).slice(0, 20);

  // 외식 태그 먼저 정렬
  options.sort((a, b) => {
    const aOut = a.tags.includes("외식OK") ? 0 : 1;
    const bOut = b.tags.includes("외식OK") ? 0 : 1;
    return aOut - bOut;
  });

  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-border bg-card shadow-elev-3">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-[13px] font-extrabold text-foreground">
            {MEAL_SLOT_LABEL_KO[slot]} 교체
          </p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-3">
          {current && (
            <p className="mb-2 text-[11px] text-muted-foreground">
              현재: <span className="font-bold text-foreground">{current.name}</span>
            </p>
          )}
          <ul className="space-y-1.5">
            {options.map((m) => (
              <li key={m.code}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-background p-3 text-left transition-all active:scale-[0.99]",
                    current?.code === m.code && "ring-1 ring-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-extrabold leading-snug text-foreground">
                        {m.name}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                        {m.note}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="number-font text-[12px] font-extrabold text-foreground">
                        {m.kcal}
                      </p>
                      <p className="text-[9.5px] text-muted-foreground">kcal</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold",
                          t === "외식OK"
                            ? "bg-amber-400/15 text-amber-600"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      P {m.proteinG}g · C {m.carbsG}g · F {m.fatG}g
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-border px-5 py-2 text-center text-[10.5px] leading-relaxed text-muted-foreground">
          선택하면 다음 끼니가 자동으로 "복귀 톤(저탄수·고단백)" 메뉴로 재선택됩니다.
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default MealSwapDialog;
