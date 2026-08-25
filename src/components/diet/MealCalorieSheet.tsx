import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DIET_MEAL_SLOT_LABEL } from "@/data/dietProgramData";
import type { DietMealSlot } from "@/lib/dietTrack";
import {
  CONFIDENCE_LABEL,
  FACTOR_LABEL,
  PORTION_STEPS,
  itemKcal,
  itemProtein,
  kcalRange,
  makeManualDraft,
  portionLabel,
  sourceOf,
  toDrafts,
  toStoredItems,
  totalKcal as sumKcal,
  totalProtein as sumProtein,
  type MealItemDraft,
  type MealVisionResponse,
} from "@/lib/diet/mealCalories";
import { cn } from "@/lib/utils";

export interface MealCalorieConfirmPayload {
  items: ReturnType<typeof toStoredItems>;
  totalKcal: number;
  totalProteinG: number;
  source: ReturnType<typeof sourceOf>;
}

interface MealCalorieSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealSlot: DietMealSlot;
  vision: MealVisionResponse | null;
  loading: boolean;
  errorMessage?: string | null;
  saving?: boolean;
  onConfirm: (payload: MealCalorieConfirmPayload) => void;
}

/**
 * 사진 → AI 추정 → 회원이 고치고 확정하는 시트.
 *
 * 설계 이유
 *   사진만으로는 어떤 AI 도 칼로리를 정확히 못 맞힌다. 그래서 추정값을 그대로
 *   기록하지 않고, 회원이 양을 한 번 만져보고 확정하게 만든다. 이 한 단계가
 *   정확도를 가장 크게 끌어올린다.
 *
 * 톤 규칙 (기존 다이어트 규칙 승계)
 *   · 숫자 앞에 항상 약(≈) 을 붙인다. 단정하지 않는다.
 *   · 죄책감·벌점 문구 금지. 마지막은 늘 다음 행동 하나로 끝낸다.
 */
export const MealCalorieSheet = ({
  open,
  onOpenChange,
  mealSlot,
  vision,
  loading,
  errorMessage,
  saving = false,
  onConfirm,
}: MealCalorieSheetProps) => {
  const [drafts, setDrafts] = useState<MealItemDraft[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState("");

  // 새 분석 결과가 오면 편집 상태를 새로 깐다.
  useEffect(() => {
    setDrafts(vision ? toDrafts(vision.items) : []);
    setManualName("");
    setManualKcal("");
  }, [vision]);

  const kcal = useMemo(() => sumKcal(drafts), [drafts]);
  const protein = useMemo(() => sumProtein(drafts), [drafts]);
  const range = useMemo(
    () => kcalRange(kcal, vision?.confidence ?? "low"),
    [kcal, vision?.confidence],
  );

  const setFactor = (key: string, factor: number) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, factor } : d)));

  const removeItem = (key: string) =>
    setDrafts((list) => list.filter((d) => d.key !== key));

  const addManual = () => {
    const n = manualName.trim();
    const k = Number(manualKcal);
    if (!n || !Number.isFinite(k) || k <= 0) return;
    setDrafts((list) => [...list, makeManualDraft(n, k)]);
    setManualName("");
    setManualKcal("");
  };

  const handleConfirm = () => {
    if (!vision) return;
    onConfirm({
      items: toStoredItems(drafts),
      totalKcal: kcal,
      totalProteinG: protein,
      source: sourceOf(vision.items, drafts),
    });
  };

  const slotLabel = DIET_MEAL_SLOT_LABEL[mealSlot] ?? "식사";
  const canConfirm = !loading && !saving && !!vision && drafts.length > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="flex items-center gap-1.5 text-[15px] font-black">
            <Sparkles className="h-4 w-4 text-primary" />
            {slotLabel} · 사진으로 본 칼로리
          </DrawerTitle>
          <DrawerDescription className="text-[12px]">
            AI 가 먼저 읽고, 회원님이 고치면 그 값으로 기록됩니다.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-2">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-[13px] font-bold text-foreground">
                사진을 읽고 있어요
              </p>
              <p className="text-[11px] text-muted-foreground">보통 3~6초 걸립니다</p>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-[13px] font-bold text-foreground">{errorMessage}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                사진은 저장됐어요. 잠시 뒤 다시 찍으면 칼로리도 같이 읽어드릴게요.
              </p>
            </div>
          )}

          {!loading && !errorMessage && vision?.notFood && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-[13px] font-bold text-foreground">
                음식이 잘 안 보여요
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                접시가 화면에 다 들어오게 한 번만 다시 찍어주세요.
              </p>
            </div>
          )}

          {!loading && !errorMessage && vision && !vision.notFood && (
            <>
              {/* 합계 — 이 화면의 주인공 숫자 하나 */}
              <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  이 끼니 추정
                </p>
                <p className="mt-0.5 text-[34px] font-black leading-none tracking-tight text-primary">
                  ≈ {kcal.toLocaleString()}
                  <span className="ml-1 text-[15px] font-bold">kcal</span>
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {range.low.toLocaleString()}~{range.high.toLocaleString()} kcal 사이 ·{" "}
                  {CONFIDENCE_LABEL[vision.confidence]}
                </p>
                {protein > 0 && (
                  <p className="mt-1 text-[12px] font-bold text-foreground">
                    단백질 약 {protein}g
                  </p>
                )}
              </div>

              {/* 항목별 양 조절 */}
              <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                먹은 만큼 고쳐주세요
              </p>
              <div className="space-y-2">
                {drafts.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-foreground">
                          {d.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {portionLabel(d)}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-black text-foreground">
                        {itemKcal(d).toLocaleString()}
                        <span className="ml-0.5 text-[10px] font-bold text-muted-foreground">
                          kcal
                        </span>
                      </p>
                      <button
                        type="button"
                        aria-label={`${d.name} 빼기`}
                        onClick={() => removeItem(d.key)}
                        className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {PORTION_STEPS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFactor(d.key, f)}
                          className={cn(
                            "flex-1 rounded-lg border py-1 text-[11px] font-bold transition-colors",
                            d.factor === f
                              ? "border-primary/45 bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {FACTOR_LABEL[f]}
                        </button>
                      ))}
                    </div>
                    {itemProtein(d) > 0 && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        단백질 {itemProtein(d)}g
                      </p>
                    )}
                  </div>
                ))}

                {drafts.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
                    항목이 비었어요. 아래에서 직접 적어주세요.
                  </p>
                )}
              </div>

              {/* 빠진 음식 직접 추가 */}
              <div className="mt-3 flex items-center gap-1.5">
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value.slice(0, 40))}
                  placeholder="빠진 음식"
                  className="h-9 flex-1 rounded-xl text-[12px]"
                />
                <Input
                  value={manualKcal}
                  onChange={(e) => setManualKcal(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="kcal"
                  className="h-9 w-[74px] rounded-xl text-[12px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addManual}
                  className="h-9 shrink-0 rounded-xl px-2.5"
                  aria-label="직접 추가"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* 코치 한 줄 */}
              {vision.feedback && (
                <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
                  {vision.feedback}
                </p>
              )}

              <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                사진으로 잰 칼로리는 참고용 추정치예요. 매일 같은 방식으로 기록하면
                숫자보다 흐름이 더 정확해집니다.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 pb-5 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-2xl px-4 text-[13px] font-bold"
          >
            나중에
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="ml-auto h-11 flex-1 rounded-2xl text-[13px] font-black tracking-wide"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>이대로 기록 · ≈ {kcal.toLocaleString()} kcal</>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MealCalorieSheet;
