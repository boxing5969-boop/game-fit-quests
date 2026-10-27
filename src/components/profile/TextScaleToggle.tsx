/**
 * 글씨 크기 — 작게 · 보통 · 크게 (2026-10-28 리디자인 · lib/textScale)
 *   내정보 '계정 · 정보'의 라이센스 카드 표시 바로 아래. 누르면 바로 앱 전체 글씨가 바뀐다(이 기기에만).
 *   '가' 글자 크기로 무엇이 바뀌는지 보여 준다.
 */
import { useState } from "react";
import { readTextScale, saveTextScale, TEXT_SCALE_OPTIONS, type TextScale } from "@/lib/textScale";

const SAMPLE: Record<TextScale, string> = { sm: "text-label", md: "text-body", lg: "text-heading" };

const TextScaleToggle = () => {
  const [scale, setScale] = useState<TextScale>(readTextScale);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
      <h3 className="text-body font-bold text-foreground">글씨 크기</h3>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="글씨 크기">
        {TEXT_SCALE_OPTIONS.map((opt) => {
          const active = scale === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setScale(opt.value);
                saveTextScale(opt.value);
              }}
              className={`flex h-12 items-center justify-center gap-1.5 rounded-lg font-bold transition-all active:scale-95 ${
                active ? "bg-card text-primary shadow-elev-1" : "text-muted-foreground"
              }`}
            >
              <span className={`${SAMPLE[opt.value]} font-black leading-none`} aria-hidden>
                가
              </span>
              <span className="text-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TextScaleToggle;
