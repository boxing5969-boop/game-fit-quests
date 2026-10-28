import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * 글씨 크기 이름 — tailwind.config.ts fontSize 와 같다 (2026-10-28 리디자인 글씨 6단계 · TV 단계 · 옛 이름).
 * tailwind-merge 는 기본 크기(text-sm · text-lg …)만 글씨 크기로 안다. 이 이름들을 알려 주지 않으면 'text-label' 을
 * 글자 색으로 여겨, cn("text-label text-muted-foreground") 가 크기를 지워 버린다(뒤에 오는 색이 이김).
 * 그러면 그 글은 부모 글씨 크기를 물려받아 화면마다 크기가 제멋대로 된다 — 2026-10-28 찾아 고침.
 */
const FONT_SIZES = [
  "micro", "label", "body", "heading", "title", "display",
  "tv-micro", "tv-label", "tv-body", "tv-heading", "tv-title", "tv-display",
  "caption", "badge", "body-sm", "body-lg", "button",
  "display-sm", "display-md", "display-lg", "number-sm", "number-md", "number-lg",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: FONT_SIZES }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
