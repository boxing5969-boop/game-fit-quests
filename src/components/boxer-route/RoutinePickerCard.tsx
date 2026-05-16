/**
 * 복싱인 루트 — 라운드 선택 카드.
 *
 * 7 라운드를 카드 그리드로 노출. 오늘 완료한 라운드는 옅게.
 */

import {
  ROUTINE_MOOD_LABEL,
  ROUTINE_MOOD_TONE,
  type VisualizationRoutine,
} from "@/data/boxerRouteContent";

export interface RoutinePickerCardProps {
  routine: VisualizationRoutine;
  recommended?: boolean;
  doneToday?: boolean;
  onSelect: (routine: VisualizationRoutine) => void;
}

const RoutinePickerCard = ({
  routine,
  recommended,
  doneToday,
  onSelect,
}: RoutinePickerCardProps) => {
  const moodTone = ROUTINE_MOOD_TONE[routine.mood];
  const moodLabel = ROUTINE_MOOD_LABEL[routine.mood];
  return (
    <button
      type="button"
      onClick={() => onSelect(routine)}
      className={`group relative flex w-full flex-col items-start gap-2 overflow-hidden rounded-2xl border bg-gray-950/70 p-4 text-left transition-all active:scale-[0.99] ${
        recommended
          ? "border-amber-400/50 shadow-[0_0_0_1px_rgba(253,184,92,0.2)_inset]"
          : "border-white/10"
      } ${doneToday ? "opacity-65" : ""}`}
    >
      {recommended && (
        <span className="absolute right-3 top-3 rounded-pill border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black tracking-widest text-amber-200">
          오늘의 추천
        </span>
      )}

      <span
        className={`inline-block rounded-pill border px-2 py-0.5 text-[9px] font-bold tracking-widest ${moodTone}`}
      >
        {moodLabel}
      </span>

      <h3 className="text-[14px] font-black leading-tight text-foreground">
        {routine.title}
      </h3>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {routine.subtitle}
      </p>

      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono tabular-nums">
          {Math.floor(routine.duration_sec / 60)}분 1라운드
        </span>
        {doneToday && (
          <span className="rounded-pill bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
            오늘 완료
          </span>
        )}
      </div>
    </button>
  );
};

export default RoutinePickerCard;
