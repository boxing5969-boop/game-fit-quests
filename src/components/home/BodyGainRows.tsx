/**
 * 📏 내 몸이 좋아진 정도 — 줄마다 몇 % · 숫자로 몇 · 얼마나 + 누르면 '기준' (2026-11-14 대표님 「기존에 운동을 향한 신체적 향상도
 *   몇% 좋아졌는지도 있고 숫자로 몇인지 또 얼마나 향상 되었는지 알수있게 해줘 이것도 과학적인 신뢰성이 중요해 사람들이 어떤 기준인지 의심해」)
 *   · 줄 = 이름 + 실측/추정 이름표 + 큰 값 / 숫자 줄(처음 → 지금 · 얼마나) + 확실한 변화 / 막대
 *   · 누르면 그 줄의 '기준' — 연구 · 153 계산 · 숫자가 나온 길 · 직접 재는 법 (한 번에 한 줄만 펼친다)
 *   계산 · 문구는 lib/bodyGains153 한 곳 — 여기는 화면만. '153과 함께하며'(HealthGainsCard)가 넣는다.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GainKey, GainMeasure, GainRow, GainSource } from "@/lib/bodyGains153";
import { cn } from "@/lib/utils";

/** 실측 = 금색 · 추정 = 테두리만 — '같은 나이와 비교'의 추정 이름표와 같은 모양 */
const SourceTag = ({ source }: { source: GainSource }) =>
  source === "measured" ? (
    <span className="shrink-0 rounded-full bg-reward/20 px-2 py-0.5 text-micro font-black text-reward">실측</span>
  ) : (
    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-micro font-bold text-muted-foreground">추정</span>
  );

const MEASURE_LABEL: Record<GainMeasure, string> = { pb: "153 PB 보러 가기", body: "내 신체 정보에 넣기" };

/** 막대 — 채움 = 연구 상한(추정) · 153 PB 20%(구간 · 총 시간) 대비 */
const Bar = ({ ratio, gold }: { ratio: number; gold: boolean }) => {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span
        className={cn("block h-full rounded-full transition-[width] duration-700", gold ? "bg-reward" : "bg-primary")}
        style={{ width: `${Math.max(r > 0 ? 3 : 0, Math.round(r * 100))}%` }}
      />
    </span>
  );
};

export interface BodyGainRowsProps {
  rows: GainRow[];
  /** 기준 아래 단추 — 153 PB 화면 · 내 신체 정보 */
  onMeasure?: (m: GainMeasure) => void;
  className?: string;
}

const BodyGainRows = ({ rows, onMeasure, className }: BodyGainRowsProps) => {
  const [open, setOpen] = useState<GainKey | null>(null);
  return (
    <ul className={cn("divide-y divide-border/60", className)}>
      {rows.map((r) => {
        const isOpen = open === r.key;
        return (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : r.key)}
              aria-expanded={isOpen}
              className="w-full py-3 text-left transition-colors active:bg-muted/40"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-body text-foreground">{r.label}</span>
                  <SourceTag source={r.source} />
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={cn("text-body font-black tabular-nums", r.gold ? "text-reward" : "text-foreground")}>{r.value}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                </span>
              </span>
              {(r.numbers || r.sure) && (
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-label leading-snug tabular-nums text-foreground">
                  {r.numbers && <span className="min-w-0 break-keep">{r.numbers}</span>}
                  {r.sure && <span className="shrink-0 rounded-full bg-reward/20 px-2 py-0.5 text-micro font-black text-reward">확실한 변화</span>}
                </span>
              )}
              {r.ratio != null && <Bar ratio={r.ratio} gold={r.gold} />}
            </button>
            {isOpen && (
              <div className="mb-3 rounded-xl bg-muted/50 px-4 py-3">
                <ul className="space-y-1.5 text-label leading-relaxed text-foreground">
                  {r.basis.map((b, idx) => (
                    <li key={`${b.k}-${idx}`}>
                      <b>{b.k}</b> — {b.v}
                    </li>
                  ))}
                </ul>
                {r.measure && onMeasure && (
                  <button
                    type="button"
                    onClick={() => onMeasure(r.measure!)}
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-card text-body font-bold text-foreground transition-transform active:scale-[0.99]"
                  >
                    {MEASURE_LABEL[r.measure]}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default BodyGainRows;
