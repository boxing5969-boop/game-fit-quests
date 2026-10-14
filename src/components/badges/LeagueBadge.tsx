/**
 * 리그 뱃지 — 모든 회원 이름 옆 (2026-10-15 대표님: "모든 회원에게 뱃지 달아줘 — 화이트 레벨은 화이트 뱃지,
 * 블루는 블루, 레드 리그는 레드, 블랙 리그는 화려한 블랙 뱃지").
 *
 * 모양: 방패 + 글러브. PT 배지(파란 물결 로제트 + 흰 체크)와 모양으로 구분된다 — 두 개가 나란히 붙어도 헷갈리지 않게.
 * 블랙: 흑요석 면 + 골드 테두리·글러브 + 반짝이 별 2개 + 빛이 지나가는 애니메이션(SMIL) + 금빛 광채.
 * 12px 에서도 색 면으로 리그가 읽히고, 24px 이상에서 글러브가 보인다.
 */
import { useId } from "react";

export type LeagueKey = "white" | "blue" | "red" | "black";

const LABEL: Record<LeagueKey, string> = {
  white: "화이트 리그",
  blue: "블루 리그",
  red: "레드 리그",
  black: "블랙 리그",
};

const SHIELD =
  "M12 1.5L20.3 4.5Q20.8 4.7 20.8 5.2V11.2C20.8 16.6 17.1 20.6 12.4 22.4Q12 22.55 11.6 22.4C6.9 20.6 3.2 16.6 3.2 11.2V5.2Q3.2 4.7 3.7 4.5Z";
const INNER = "M12 3.6L18.7 6V11.2C18.7 15.5 15.8 18.8 12 20.3C8.2 18.8 5.3 15.5 5.3 11.2V6Z";

const TONE: Record<Exclude<LeagueKey, "black">, { f1: string; f2: string; rim: string; glyph: string; inner: number }> = {
  white: { f1: "#FFFFFF", f2: "#D5DBE4", rim: "#9AA4B2", glyph: "#6B7684", inner: 0.55 },
  blue: { f1: "#7DB3FF", f2: "#1D4ED8", rim: "#1E3A8A", glyph: "#FFFFFF", inner: 0.18 },
  red: { f1: "#FF7A7A", f2: "#C81E2A", rim: "#7F1018", glyph: "#FFFFFF", inner: 0.18 },
};

/** 문자열 리그 값을 안전하게 키로 — 알 수 없는 값은 화이트 */
export function toLeagueKey(v: string | null | undefined): LeagueKey {
  const k = (v ?? "").toLowerCase();
  return k === "blue" || k === "red" || k === "black" ? k : "white";
}

interface LeagueBadgeProps {
  league: string | null | undefined;
  className?: string;
  /** 블랙 리그 빛 지나가기·금빛 광채 (기본 켬). 목록이 아주 길면 꺼서 가볍게. */
  animated?: boolean;
  title?: string;
}

const Glove = ({ fill }: { fill: string }) => (
  <>
    <path
      d="M9.2 9.1C9.2 7.4 10.4 6.3 12.1 6.3H12.8C14.5 6.3 15.7 7.5 15.7 9.2V12.1C15.7 13.4 14.7 14.4 13.4 14.4H11C9.9 14.4 9.2 13.7 9.2 12.7Z"
      fill={fill}
    />
    <ellipse cx="8.85" cy="11.7" rx="1.4" ry="1.5" fill={fill} />
    <rect x="9.7" y="15.0" width="5.4" height="2.1" rx="0.7" fill={fill} />
  </>
);

const LeagueBadge = ({ league, className = "h-5 w-5", animated = true, title }: LeagueBadgeProps) => {
  const key = toLeagueKey(league);
  const label = title ?? LABEL[key];
  // useId 는 ":r0:" 꼴이라 url(#…) 참조가 깨질 수 있어 영문·숫자만 남긴다 (PtBadge 와 같은 방식)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const f = `lgb-f-${uid}`;
  const sh = `lgb-sh-${uid}`;
  const gd = `lgb-gd-${uid}`;
  const sweep = `lgb-sw-${uid}`;
  const clip = `lgb-cl-${uid}`;

  if (key === "black") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`${className} shrink-0 overflow-visible`}
        role="img"
        aria-label={label}
        style={animated ? { filter: "drop-shadow(0 0 3px rgba(242,195,91,0.65))" } : undefined}
      >
        <title>{label}</title>
        <defs>
          <linearGradient id={f} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A4A55" />
            <stop offset="1" stopColor="#08080B" />
          </linearGradient>
          <linearGradient id={gd} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF1BF" />
            <stop offset="0.45" stopColor="#F2C35B" />
            <stop offset="1" stopColor="#B07A1E" />
          </linearGradient>
          <linearGradient id={sh} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          {/* 빛 지나가기 — 비스듬한 흰 띠가 방패 위를 3.2초마다 한 번 훑는다 */}
          <linearGradient id={sweep} x1="0" y1="0" x2="1" y2="0.35" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clip}>
            <path d={SHIELD} />
          </clipPath>
        </defs>
        <path d={SHIELD} fill={`url(#${f})`} stroke={`url(#${gd})`} strokeWidth={1.5} />
        <path d={INNER} fill="none" stroke={`url(#${gd})`} strokeWidth={0.6} opacity={0.8} />
        <Glove fill={`url(#${gd})`} />
        <path d={SHIELD} fill={`url(#${sh})`} />
        {animated && (
          <g clipPath={`url(#${clip})`}>
            <rect x="-24" y="0" width="24" height="24" fill={`url(#${sweep})`}>
              <animate attributeName="x" values="-24;-24;24" keyTimes="0;0.55;1" dur="3.2s" repeatCount="indefinite" />
            </rect>
          </g>
        )}
        <path d="M20.6 1.2l.45 1.1 1.1.45-1.1.45-.45 1.1-.45-1.1-1.1-.45 1.1-.45z" fill="#FFE7A3">
          {animated && <animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite" />}
        </path>
        <path d="M3.2 17.6l.3.75.75.3-.75.3-.3.75-.3-.75-.75-.3.75-.3z" fill="#FFE7A3">
          {animated && <animate attributeName="opacity" values="0.3;1;0.3" dur="2.3s" repeatCount="indefinite" />}
        </path>
      </svg>
    );
  }

  const t = TONE[key];
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id={f} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.f1} />
          <stop offset="1" stopColor={t.f2} />
        </linearGradient>
        <linearGradient id={sh} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${f})`} stroke={t.rim} strokeWidth={1.1} />
      <path d={INNER} fill="none" stroke="#FFFFFF" strokeWidth={0.6} opacity={t.inner} />
      <Glove fill={t.glyph} />
      <path d={SHIELD} fill={`url(#${sh})`} />
    </svg>
  );
};

export default LeagueBadge;
