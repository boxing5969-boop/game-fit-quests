/**
 * 마이복서153 — 워드마크 (CSS 로고).
 *
 * PNG 의존 제거 — 흰색 글자 + 시안 외곽선/글로우 만으로 구성.
 * 다크/라이트 배경 모두 가독성 보장. 캐시/검정픽셀 문제 영구 해결.
 *
 * size:
 *   · sm  — 인라인 (헤더/뱃지 등)
 *   · md  — 로그인 페이지
 *   · lg  — 스플래시
 *
 * 사용:
 *   <MyBoxerWordmark size="md" />
 *   <MyBoxerWordmark size="lg" align="center" />
 */

import { type CSSProperties } from "react";

export type MyBoxerWordmarkSize = "sm" | "md" | "lg";

export interface MyBoxerWordmarkProps {
  size?: MyBoxerWordmarkSize;
  align?: "start" | "center";
  className?: string;
}

interface SizeSpec {
  iconBox: number;        // M3 박스 한 변 px
  iconText: number;       // M3 글자 크기 px
  iconBorder: number;     // M3 외곽선 두께 px
  myBoxer: number;        // "MY BOXER" 글자 크기 px
  hangul: number;         // "마이복서" 글자 크기 px
  byline: number;         // "by 153 BOXING GYM" 글자 크기 px
  gap: number;            // M3 ↔ 텍스트 간격 px
}

const SIZE_MAP: Record<MyBoxerWordmarkSize, SizeSpec> = {
  sm: { iconBox: 36, iconText: 16, iconBorder: 1.5, myBoxer: 18, hangul: 9,  byline: 8,  gap: 8  },
  md: { iconBox: 64, iconText: 28, iconBorder: 2,   myBoxer: 32, hangul: 13, byline: 11, gap: 14 },
  lg: { iconBox: 96, iconText: 44, iconBorder: 3,   myBoxer: 52, hangul: 20, byline: 16, gap: 22 },
};

const CYAN = "rgb(45, 212, 191)";        // tailwind teal-400 톤
const CYAN_SOFT = "rgba(45, 212, 191, 0.55)";
const CYAN_GLOW = "rgba(45, 212, 191, 0.7)";

const MyBoxerWordmark = ({
  size = "md",
  align = "center",
  className = "",
}: MyBoxerWordmarkProps) => {
  const s = SIZE_MAP[size];

  const containerStyle: CSSProperties = {
    gap: s.gap,
    justifyContent: align === "center" ? "center" : "flex-start",
  };

  const iconOuterStyle: CSSProperties = {
    width: s.iconBox,
    height: s.iconBox,
    border: `${s.iconBorder}px solid ${CYAN}`,
    borderRadius: s.iconBox * 0.22,
    boxShadow: `0 0 ${s.iconBox * 0.18}px ${CYAN_GLOW}, inset 0 0 ${s.iconBox * 0.1}px ${CYAN_SOFT}`,
    background:
      "linear-gradient(135deg, rgba(45,212,191,0.12) 0%, rgba(45,212,191,0.02) 100%)",
  };

  const iconInnerStyle: CSSProperties = {
    inset: s.iconBox * 0.13,
    border: `1px solid ${CYAN_SOFT}`,
    borderRadius: s.iconBox * 0.14,
  };

  const iconTextStyle: CSSProperties = {
    fontSize: s.iconText,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    letterSpacing: "-0.04em",
    textShadow: `0 0 ${s.iconText * 0.4}px ${CYAN_GLOW}`,
  };

  const myBoxerStyle: CSSProperties = {
    fontSize: s.myBoxer,
    lineHeight: 1,
    letterSpacing: "0.06em",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    textShadow: `0 0 ${s.myBoxer * 0.4}px ${CYAN_GLOW}, 0 1px 0 rgba(255,255,255,0.1)`,
    WebkitTextStroke: `0.5px ${CYAN}`,
  };

  const hangulStyle: CSSProperties = {
    fontSize: s.hangul,
    color: CYAN,
    letterSpacing: "0.4em",
    textShadow: `0 0 ${s.hangul * 0.3}px ${CYAN_GLOW}`,
  };

  const bylineStyle: CSSProperties = {
    fontSize: s.byline,
    color: "rgba(186, 230, 224, 0.85)",
    letterSpacing: "0.16em",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  };

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={containerStyle}
      role="img"
      aria-label="MY BOXER 마이복서 by 153 BOXING GYM"
    >
      {/* M3 아이콘 박스 */}
      <div
        className="relative inline-flex shrink-0 items-center justify-center"
        style={iconOuterStyle}
      >
        <span className="absolute" style={iconInnerStyle} aria-hidden />
        <span
          className="relative font-black text-white"
          style={iconTextStyle}
        >
          M3
        </span>
      </div>

      {/* 텍스트 영역 */}
      <div className="flex flex-col" style={{ gap: s.byline * 0.35 }}>
        <span
          className="font-black text-white"
          style={myBoxerStyle}
        >
          MY BOXER
        </span>
        <div className="flex items-center" style={{ gap: s.hangul * 0.5 }}>
          <span
            className="block flex-1"
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
            }}
            aria-hidden
          />
          <span className="font-bold" style={hangulStyle}>
            마이복서
          </span>
          <span
            className="block flex-1"
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
            }}
            aria-hidden
          />
        </div>
        <span
          className="text-center font-bold uppercase"
          style={bylineStyle}
        >
          by <span className="text-white">153 BOXING GYM</span>
        </span>
      </div>
    </div>
  );
};

export default MyBoxerWordmark;
