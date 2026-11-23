/**
 * 🧭 이 동작, 왜 · 언제 · 얼마나 — 효과 · 가치 · 언제 · 얼마나 네 줄 (2026-11-23 대표님
 *   「영상으로 배우기 부분에 각각 어떤 효과가 있고 어떤 가치가 있고 언제 얼마나 해야 좋은지 설명해줘」)
 *   글은 data/learnGuide 한 곳 · 카드 시트(TrainingDrillSheet)와 영상 플레이어(VideoPlayer)가 같이 쓴다
 *   토스 · 배민처럼 큰 글씨 한 줄씩(이름표 + 글) · 맨 아래 「처음 하는 동작은 절반부터」 한 줄
 */
import { cn } from "@/lib/utils";
import type { LearnGuide } from "@/data/learnGuide";

const ROWS: ReadonlyArray<{ key: keyof LearnGuide; icon: string; label: string }> = [
  { key: "effect", icon: "💪", label: "효과" },
  { key: "value", icon: "⭐", label: "가치" },
  { key: "when", icon: "🕒", label: "언제" },
  { key: "amount", icon: "🔁", label: "얼마나" },
];

export default function LearnGuideBox({ guide, className }: { guide: LearnGuide; className?: string }) {
  return (
    <section aria-label="이 동작, 왜 · 언제 · 얼마나" className={cn("rounded-2xl border border-primary/25 bg-primary/5 p-4", className)}>
      <p className="mb-3 text-body font-black text-foreground">🧭 이 동작, 왜 · 언제 · 얼마나</p>
      <dl className="space-y-2.5">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-start gap-3">
            <dt className="flex w-[4.5rem] shrink-0 items-center gap-1 pt-0.5 text-label font-bold text-primary">
              <span aria-hidden>{r.icon}</span>
              {r.label}
            </dt>
            <dd className="min-w-0 flex-1 break-keep text-body text-foreground">{guide[r.key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-label text-muted-foreground">처음 하는 동작은 절반만 해도 괜찮아요. 몸 상태에 맞춰 늘려 가요.</p>
    </section>
  );
}
