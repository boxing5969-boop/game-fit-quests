import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCcw } from "lucide-react";
import { DIET_MEAL_SLOT_LABEL } from "@/data/dietProgramData";
import type { DietMealSlot } from "@/lib/dietTrack";
import type { DietDailyLogPhotoRow } from "@/services/dietService";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";

interface DietPhotoUploadProps {
  /** 이미 업로드된 사진 리스트 (slot 별 최대 1장만 표시) */
  photos: DietDailyLogPhotoRow[];
  /** 업로드 실행 — 슬롯과 압축된 Blob 전달 */
  onUpload: (slot: DietMealSlot, file: Blob) => Promise<void>;
  /** 로그가 아직 없어 슬롯 사용 불가한 경우 (제출 전) */
  disabled?: boolean;
  className?: string;
}

const SLOTS: DietMealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

interface SlotState {
  pending: boolean;
  error: string | null;
}

/**
 * 4-슬롯(아침·점심·저녁·간식) 식단 사진 업로드.
 *
 * 동작
 *   • 슬롯별 `input[type=file]` → compressImage(800px, 0.7) → onUpload()
 *   • 슬롯 단위 독립 상태 — 한 장 실패해도 다른 슬롯 유지
 *   • 이미 업로드된 슬롯은 "다시 올리기" 로 덮어쓰기 (기존 사진 DB 유지,
 *     서버가 다중 허용. UX 상으로는 가장 최근 1장을 노출)
 */
export const DietPhotoUpload = ({
  photos,
  onUpload,
  disabled = false,
  className,
}: DietPhotoUploadProps) => {
  const latestPerSlot = useRef(indexLatestBySlot(photos)).current;
  // photos prop 이 바뀌면 재계산
  const latestBySlot = indexLatestBySlot(photos);

  const [states, setStates] = useState<Record<DietMealSlot, SlotState>>({
    breakfast: { pending: false, error: null },
    lunch: { pending: false, error: null },
    dinner: { pending: false, error: null },
    snack: { pending: false, error: null },
  });

  // latestPerSlot 는 참조용으로만 유지 (ref 로 mount 시 1회 기록)
  void latestPerSlot;

  const handleFile = async (slot: DietMealSlot, file: File) => {
    setStates((s) => ({ ...s, [slot]: { pending: true, error: null } }));
    try {
      const blob = await compressImage(file, 800, 0.75);
      await onUpload(slot, blob);
      setStates((s) => ({ ...s, [slot]: { pending: false, error: null } }));
    } catch (e) {
      setStates((s) => ({
        ...s,
        [slot]: {
          pending: false,
          error: e instanceof Error ? e.message : "업로드 실패",
        },
      }));
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        식단 사진 (선택)
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SLOTS.map((slot) => {
          const existing = latestBySlot[slot];
          const state = states[slot];
          return (
            <SlotTile
              key={slot}
              slot={slot}
              existing={existing}
              pending={state.pending}
              error={state.error}
              disabled={disabled}
              onPick={(file) => void handleFile(slot, file)}
              onRetry={() =>
                setStates((s) => ({ ...s, [slot]: { pending: false, error: null } }))
              }
            />
          );
        })}
      </div>
      {disabled && (
        <p className="text-[11px] text-muted-foreground">
          체크인을 먼저 저장하면 사진 업로드가 열립니다.
        </p>
      )}
    </div>
  );
};

const SlotTile = ({
  slot,
  existing,
  pending,
  error,
  disabled,
  onPick,
  onRetry,
}: {
  slot: DietMealSlot;
  existing?: DietDailyLogPhotoRow;
  pending: boolean;
  error: string | null;
  disabled: boolean;
  onPick: (file: File) => void;
  onRetry: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = DIET_MEAL_SLOT_LABEL[slot];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card",
        error ? "border-destructive/50" : "border-border",
      )}
    >
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-24 w-full items-center justify-center gap-1.5",
          "text-[12px] font-bold text-muted-foreground",
          "hover:bg-muted active:scale-[0.98] transition-transform",
          disabled && "opacity-50",
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : existing ? (
          <Camera className="h-4 w-4 text-primary" />
        ) : (
          <ImagePlus className="h-4 w-4 text-primary" />
        )}
        <span className="text-foreground">{label}</span>
        {existing && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-primary">
            완료
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="flex items-center justify-between border-t border-destructive/40 bg-destructive/10 px-2 py-1">
          <span className="truncate text-[10px] text-destructive">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-bold text-destructive hover:bg-destructive/20"
          >
            <RefreshCcw className="h-2.5 w-2.5" />
            재시도
          </button>
        </div>
      )}
    </div>
  );
};

function indexLatestBySlot(
  photos: DietDailyLogPhotoRow[],
): Partial<Record<DietMealSlot, DietDailyLogPhotoRow>> {
  const out: Partial<Record<DietMealSlot, DietDailyLogPhotoRow>> = {};
  for (const p of photos) {
    const existing = out[p.meal_slot];
    if (!existing || new Date(p.uploaded_at) > new Date(existing.uploaded_at)) {
      out[p.meal_slot] = p;
    }
  }
  return out;
}

export default DietPhotoUpload;
