/**
 * 153 글리프 타일 — 애플 앱 아이콘처럼 연속 곡률(슈퍼엘립스) 칸 위에 153 글리프를 얹는다.
 *
 * · 칸: 위→아래 은은한 그라데이션 + 머리카락 두께 테두리 + 윗면 하이라이트 (빛이 위에서 드는 느낌).
 * · 글리프: 칸의 64% 크기, 아주 얕은 그림자로 칸에서 살짝 떠 보이게 (.glyph-art — src/index.css).
 * · 색은 전부 CSS 변수(--glyph-*)라 라이트·다크가 자동으로 맞는다.
 * · 장식이므로 aria-hidden — 이름은 옆의 라벨이 읽힌다.
 */
import { useId } from "react";
import { MENU_GLYPHS, type MenuGlyphName } from "@/components/icons/menuGlyphs";
import { cn } from "@/lib/utils";

/** 슈퍼엘립스(n=5) — viewBox 0 0 100 100. 모서리는 촘촘히, 변은 곧게. */
const SQUIRCLE =
  "M100 50 99.9 69.7 99.6 76 99.1 80.5 98.4 84 97.5 87 96.4 89.5 95.1 91.7 93.5 93.5 91.7 95.1 89.5 96.4 87 97.5 84 98.4 80.5 99.1 76 99.6 69.7 99.9 50 100 30.3 99.9 24 99.6 19.5 99.1 16 98.4 13 97.5 10.5 96.4 8.3 95.1 6.5 93.5 4.9 91.7 3.6 89.5 2.5 87 1.6 84 0.9 80.5 0.4 76 0.1 69.7 0 50 0.1 30.3 0.4 24 0.9 19.5 1.6 16 2.5 13 3.6 10.5 4.9 8.3 6.5 6.5 8.3 4.9 10.5 3.6 13 2.5 16 1.6 19.5 0.9 24 0.4 30.3 0.1 50 0 69.7 0.1 76 0.4 80.5 0.9 84 1.6 87 2.5 89.5 3.6 91.7 4.9 93.5 6.5 95.1 8.3 96.4 10.5 97.5 13 98.4 16 99.1 19.5 99.6 24 99.9 30.3Z";

interface GlyphTileProps {
  name: MenuGlyphName;
  /** 한 변 px (기본 56) */
  size?: number;
  className?: string;
}

const GlyphTile = ({ name, size = 56, className }: GlyphTileProps) => {
  // useId 의 ":" 는 url(#…) 참조에서 빼 둔다
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`${uid}-tile`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--glyph-tile-t)" }} />
            <stop offset="1" style={{ stopColor: "var(--glyph-tile-b)" }} />
          </linearGradient>
          <linearGradient id={`${uid}-hl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--glyph-tile-hl)" }} />
            <stop offset="0.35" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={SQUIRCLE} fill={`url(#${uid}-tile)`} strokeWidth={1.2} style={{ stroke: "var(--glyph-tile-edge)" }} />
        <path
          d={SQUIRCLE}
          fill="none"
          stroke={`url(#${uid}-hl)`}
          strokeWidth={1.6}
          transform="translate(50 50) scale(0.985) translate(-50 -50)"
        />
      </svg>
      <svg
        viewBox="0 0 48 48"
        className="glyph-art absolute"
        style={{ inset: "17.9%" }}
        // 고정 마크업(menuGlyphs.ts) — 사용자 입력이 섞이지 않는다
        dangerouslySetInnerHTML={{ __html: MENU_GLYPHS[name](`${uid}-`) }}
      />
    </span>
  );
};

export default GlyphTile;
