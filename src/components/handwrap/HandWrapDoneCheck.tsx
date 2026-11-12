/**
 * ✅ 붕대 감기 — 다 감았으면 확인 (2026-11-12).
 *
 *   배우는 순서의 마지막: 전체 영상 → 한 단계씩 → '내 손이 맞게 감겼나' 스스로 보기.
 *   실제 사진 두 장(손등 쪽 · 주먹 쥔 모습)과 다섯 가지 — 누르면 체크된다(이 화면에서만 · 저장하지 않는다).
 *   다 체크하면 한 줄 칭찬. 기록은 바로 아래 '집에서 혼자 감아 보기'에서 남긴다.
 *   글 · 사진 주소는 data/handWrapGuide.ts (HANDWRAP_DONE_CHECKS · HANDWRAP_DONE_PHOTOS).
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { HANDWRAP_DONE_CHECKS, HANDWRAP_DONE_PHOTOS, handWrapRealFlip } from "@/data/handWrapGuide";
import { useHandWrapPrefs } from "@/hooks/useHandWrapPrefs";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

const HandWrapDoneCheck = ({ className }: Props) => {
  const { hand } = useHandWrapPrefs();
  const flip = handWrapRealFlip(hand);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const all = done.size === HANDWRAP_DONE_CHECKS.length;

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60", className)}>
      <div className="grid grid-cols-2 gap-2 p-3 pb-0">
        {HANDWRAP_DONE_PHOTOS.map((p) => (
          <figure key={p.src} className="relative aspect-square overflow-hidden rounded-xl bg-black">
            <img
              src={p.src}
              alt={`다 감은 모습 — ${p.label}`}
              loading="lazy"
              decoding="async"
              className={cn("h-full w-full object-cover", flip && "-scale-x-100")}
            />
            <figcaption className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2.5 py-0.5 text-micro font-bold text-white">
              {p.label}
            </figcaption>
          </figure>
        ))}
      </div>

      <ul className="px-3 py-2">
        {HANDWRAP_DONE_CHECKS.map((c, i) => {
          const on = done.has(i);
          return (
            <li key={c}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(i)}
                className="flex min-h-12 w-full items-center gap-3 py-1.5 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-transparent ring-1 ring-border",
                  )}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <span className={cn("min-w-0 text-body leading-snug", on ? "font-bold text-foreground" : "text-foreground")}>{c}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p
        aria-live="polite"
        className={cn(
          "mx-3 mb-3 rounded-xl px-3 py-2.5 text-label font-bold leading-relaxed",
          all ? "bg-primary/10 text-foreground" : "bg-secondary/70 text-muted-foreground",
        )}
      >
        {all
          ? "잘 감았어요! 주먹을 쥐었을 때 편하면 딱 맞게 감은 거예요."
          : `하나라도 아니면 풀고 그 단계부터 다시 감아요 · ${done.size}/${HANDWRAP_DONE_CHECKS.length}`}
      </p>
    </div>
  );
};

export default HandWrapDoneCheck;
