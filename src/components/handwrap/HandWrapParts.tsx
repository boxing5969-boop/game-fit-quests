/**
 * 🥊 붕대 감기 — 여러 칸이 같이 쓰는 작은 조각 (감는 손 · 속도 · 보는 방법 · 그림 속 표시 읽는 법).
 *   2026-11-12: 전체 영상 · 12단계 한눈에 · 단계 상세가 같은 단추를 쓰게 HandWrapStepViewer 에서 꺼냈다.
 */
import type { ReactNode } from "react";
import { Gauge, Hand } from "lucide-react";
import { HANDWRAP_STEP_SPEEDS, HANDWRAP_VIEW_LABEL, type HandSide, type HandWrapView } from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

export const Chip = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    aria-label={label}
    className={cn(
      "h-8 shrink-0 rounded-full px-3 text-label font-bold transition-colors active:scale-95",
      on ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
    )}
  >
    {children}
  </button>
);

export const HandChips = ({ hand, setHand, className }: { hand: HandSide; setHand: (h: HandSide) => void; className?: string }) => (
  <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
    <span className="flex items-center gap-1 text-label font-bold text-muted-foreground">
      <Hand className="h-3.5 w-3.5" aria-hidden /> 감는 손
    </span>
    <Chip on={hand === "right"} onClick={() => setHand("right")}>
      오른손
    </Chip>
    <Chip on={hand === "left"} onClick={() => setHand("left")}>
      왼손
    </Chip>
  </div>
);

export const SpeedChips = ({ rate, setRate, className }: { rate: number; setRate: (r: number) => void; className?: string }) => (
  <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
    <span className="flex items-center gap-1 text-label font-bold text-muted-foreground">
      <Gauge className="h-3.5 w-3.5" aria-hidden /> 속도
    </span>
    {HANDWRAP_STEP_SPEEDS.map((s) => (
      <Chip key={s.rate} on={rate === s.rate} onClick={() => setRate(s.rate)}>
        {s.label}
      </Chip>
    ))}
  </div>
);

/** 실제 영상 | 그림 — 단계 상세 맨 위 */
export const ViewSwitch = ({ view, setView, className }: { view: HandWrapView; setView: (v: HandWrapView) => void; className?: string }) => (
  <div role="tablist" aria-label="보는 방법" className={cn("inline-flex shrink-0 rounded-full bg-secondary p-0.5", className)}>
    {(["real", "draw"] as const).map((v) => (
      <button
        key={v}
        type="button"
        role="tab"
        aria-selected={view === v}
        onClick={() => setView(v)}
        className={cn(
          "h-8 rounded-full px-3.5 text-label font-bold transition-colors",
          view === v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
        )}
      >
        {HANDWRAP_VIEW_LABEL[v]}
      </button>
    ))}
  </div>
);

/** 그림 속 표시 읽는 법 — 한눈에 보기 아래 · 상세 글 아래 (그림으로 볼 때) */
export const Legend = ({ className }: { className?: string }) => (
  <p className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-label font-semibold text-muted-foreground", className)}>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" /> 시작
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#F97316] ring-2 ring-white" /> 끝
    </span>
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="w-4 border-t-[3px] border-dashed border-[#1E3A5F]" /> 손바닥 쪽으로 지나가는 길
    </span>
  </p>
);
