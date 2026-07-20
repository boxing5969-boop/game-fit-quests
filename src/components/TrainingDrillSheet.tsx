// 드릴 그림 설명 시트 — 초등학생도 이해할 수 있게: 큰 그림 + 쉬운 한 줄 + 번호 포인트.
// 훈련 라이브러리(training_exercises)의 어떤 드릴이든 이름으로 열 수 있다.
import type { TrainingExercise } from "@/hooks/useTrainingLibrary";
import { X } from "lucide-react";

interface TrainingDrillSheetProps {
  exercise: TrainingExercise | null;
  onClose: () => void;
}

const TrainingDrillSheet = ({ exercise, onClose }: TrainingDrillSheetProps) => {
  if (!exercise) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 + 닫기 */}
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {exercise.category} · {exercise.difficulty}
          </span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 그림 — 없으면 자리만 감춤 */}
        {exercise.image_url && (
          <img
            src={exercise.image_url}
            alt={`${exercise.name} 동작 그림`}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="mb-4 w-full rounded-2xl border border-border bg-card"
          />
        )}

        <h3 className="text-xl font-black text-foreground">{exercise.name}</h3>
        <p className="mt-1 text-[15px] font-bold text-primary">{exercise.summary}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{exercise.description}</p>

        {/* 이렇게 해요 — 번호 포인트 */}
        {exercise.cues?.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-black text-foreground">👣 이렇게 해요</p>
            <ol className="space-y-2">
              {exercise.cues.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-black text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm text-foreground">{c}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 이런 실수 조심! */}
        {exercise.mistakes?.length > 0 && (
          <div className="mt-3 rounded-2xl border border-status-pending/30 bg-status-pending/5 p-4">
            <p className="mb-2 text-sm font-black text-status-pending">⚠️ 이런 실수 조심!</p>
            <ul className="space-y-1.5">
              {exercise.mistakes.map((m, i) => (
                <li key={i} className="text-sm text-foreground">· {m}</li>
              ))}
            </ul>
          </div>
        )}

        {exercise.benefits && (
          <p className="mt-3 text-xs text-muted-foreground">💡 {exercise.benefits}</p>
        )}
      </div>
    </div>
  );
};

export default TrainingDrillSheet;
