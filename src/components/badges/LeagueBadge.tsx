/**
 * 리그 방패 — 라이센스 카드 리그 줄 'WHITE / 방패 / Lv.10' (2026-10-15 대표님 개편).
 * 이름 옆은 리그 버튼(NameBadge)이 맡고, 방패는 리그·레벨이 적힌 줄에 들어간다.
 *
 * 시안 3종 (디자인 캔버스 '마이복서153 리그 방패·버튼 시안'):
 *   A 챔피언 벨트 — 금속 테두리 + 153 명판 + 윗단 징 3개
 *   B 크레스트   — 윗단 별 3개 띠 + 글러브
 *   C 미니멀     — 단색 면 + 굵은 테두리 + 글러브
 * 대표님이 고른 시안 하나만 SHIELD_DESIGN 에 둔다 — 한 줄만 바꾸면 앱 전체 방패가 바뀐다.
 * 블랙: 흑요석 면 + 골드 테두리 + 반짝이 2개 + 빛 지나가기(SMIL) + 금빛 광채.
 */
import { useId } from "react";

export type LeagueKey = "white" | "blue" | "red" | "black";
export type ShieldDesign = "A" | "B" | "C";

/** 대표님이 고른 방패 시안 */
export const SHIELD_DESIGN: ShieldDesign = "B";

const LABEL: Record<LeagueKey, string> = {
  white: "화이트 리그",
  blue: "블루 리그",
  red: "레드 리그",
  black: "블랙 리그",
};

const SHIELD =
  "M12 1.5L20.3 4.5Q20.8 4.7 20.8 5.2V11.2C20.8 16.6 17.1 20.6 12.4 22.4Q12 22.55 11.6 22.4C6.9 20.6 3.2 16.6 3.2 11.2V5.2Q3.2 4.7 3.7 4.5Z";
const INNER =
  "M12 3.4L18.9 5.9Q19.2 6 19.2 6.4V11.2C19.2 15.7 16.2 19 12.3 20.6Q12 20.7 11.7 20.6C7.8 19 4.8 15.7 4.8 11.2V6.4Q4.8 6 5.1 5.9Z";
const MINIMAL = "M12 2.4L19.6 5.2V11.2C19.6 16.1 16.3 19.8 12 21.5C7.7 19.8 4.4 16.1 4.4 11.2V5.2Z";
const STARS = [
  "M12.00 4.55 L12.36 5.41 L13.28 5.48 L12.58 6.09 L12.79 6.99 L12.00 6.51 L11.21 6.99 L11.42 6.09 L10.72 5.48 L11.64 5.41Z",
  "M8.90 5.75 L9.12 6.29 L9.71 6.34 L9.26 6.72 L9.40 7.29 L8.90 6.98 L8.40 7.29 L8.54 6.72 L8.09 6.34 L8.68 6.29Z",
  "M15.10 5.75 L15.32 6.29 L15.91 6.34 L15.46 6.72 L15.60 7.29 L15.10 6.98 L14.60 7.29 L14.74 6.72 L14.29 6.34 L14.88 6.29Z",
];

interface Palette {
  b1: string; b2: string; r1: string; r2: string; r3: string;
  band: string; plate: string; glyph: string | null; star: string;
  solid: string; solidRim: string; solidGlyph: string;
}

const PALETTE: Record<LeagueKey, Palette> = {
  white: { b1: "#FFFFFF", b2: "#DCE2EA", r1: "#F7F9FB", r2: "#A9B3C1", r3: "#6E7A8A", band: "#C9D1DC", plate: "rgba(78,89,104,0.10)", glyph: "#4E5968", star: "#FFFFFF", solid: "#EEF1F5", solidRim: "#8B95A3", solidGlyph: "#4E5968" },
  blue: { b1: "#6AA8FF", b2: "#1D4ED8", r1: "#DCEAFF", r2: "#5B8DEF", r3: "#1E3A8A", band: "#1E40AF", plate: "rgba(8,20,64,0.32)", glyph: "#FFFFFF", star: "#DCEAFF", solid: "#2563EB", solidRim: "#1E3A8A", solidGlyph: "#FFFFFF" },
  red: { b1: "#FF7070", b2: "#C81E2A", r1: "#FFE2E2", r2: "#E05A5A", r3: "#7F1018", band: "#991B1B", plate: "rgba(64,0,8,0.32)", glyph: "#FFFFFF", star: "#FFE2E2", solid: "#DC2626", solidRim: "#7F1018", solidGlyph: "#FFFFFF" },
  black: { b1: "#44444F", b2: "#08080B", r1: "#FFF1BF", r2: "#F2C35B", r3: "#9A6A16", band: "#000000", plate: "rgba(0,0,0,0.45)", glyph: null, star: "#F2C35B", solid: "#15151A", solidRim: "#E9B949", solidGlyph: "#F2C35B" },
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
  /** 시안 비교용 — 평소엔 비워 두면 SHIELD_DESIGN */
  design?: ShieldDesign;
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

const LeagueBadge = ({ league, className = "h-5 w-5", animated = true, title, design = SHIELD_DESIGN }: LeagueBadgeProps) => {
  const key = toLeagueKey(league);
  const label = title ?? LABEL[key];
  const p = PALETTE[key];
  const black = key === "black";
  // useId 는 ":r0:" 꼴이라 url(#…) 참조가 깨질 수 있어 영문·숫자만 남긴다 (PtBadge 와 같은 방식)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = `lgb-b-${uid}`;
  const rim = `lgb-r-${uid}`;
  const sh = `lgb-sh-${uid}`;
  const sweep = `lgb-sw-${uid}`;
  const clip = `lgb-cl-${uid}`;
  const glyph = p.glyph ?? `url(#${rim})`;

  const sparkles = black && (
    <>
      <path d="M21 0.6l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#FFE7A3">
        {animated && <animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite" />}
      </path>
      <path d="M2.6 17.4l.35.85.85.35-.85.35-.35.85-.35-.85-.85-.35.85-.35z" fill="#FFE7A3">
        {animated && <animate attributeName="opacity" values="0.3;1;0.3" dur="2.3s" repeatCount="indefinite" />}
      </path>
    </>
  );

  // 빛 지나가기 — 비스듬한 흰 띠가 방패 위를 3.2초마다 한 번 훑는다 (블랙만)
  const sweepLayer = black && animated && (
    <g clipPath={`url(#${clip})`}>
      <rect x="-24" y="0" width="24" height="24" fill={`url(#${sweep})`}>
        <animate attributeName="x" values="-24;-24;24" keyTimes="0;0.55;1" dur="3.2s" repeatCount="indefinite" />
      </rect>
    </g>
  );

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 overflow-visible`}
      role="img"
      aria-label={label}
      style={black && animated ? { filter: "drop-shadow(0 0 3px rgba(242,195,91,0.65))" } : undefined}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={base} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.b1} />
          <stop offset="1" stopColor={p.b2} />
        </linearGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.r1} />
          <stop offset="0.5" stopColor={p.r2} />
          <stop offset="1" stopColor={p.r3} />
        </linearGradient>
        <linearGradient id={sh} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={sweep} x1="0" y1="0" x2="1" y2="0.35" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={design === "C" ? MINIMAL : design === "B" ? INNER : SHIELD} />
        </clipPath>
      </defs>

      {design === "A" && (
        <>
          <path d={SHIELD} fill={`url(#${rim})`} />
          <path d={INNER} fill={`url(#${base})`} />
          <circle cx="9.4" cy="7" r="0.6" fill={`url(#${rim})`} />
          <circle cx="12" cy="6.3" r="0.75" fill={`url(#${rim})`} />
          <circle cx="14.6" cy="7" r="0.6" fill={`url(#${rim})`} />
          <rect x="6.3" y="8.9" width="11.4" height="5.9" rx="1.5" fill={p.plate} stroke={`url(#${rim})`} strokeWidth={0.7} />
          <text x="12" y="13.45" textAnchor="middle" fontSize="4.4" fontWeight={900} letterSpacing="-0.15" fill={glyph}>
            153
          </text>
          <path d="M9 16.9L12 18.4L15 16.9" fill="none" stroke={p.r2} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />
          {sweepLayer}
          <path d={SHIELD} fill={`url(#${sh})`} />
        </>
      )}

      {design === "B" && (
        <>
          <path d={SHIELD} fill={`url(#${rim})`} />
          <path d={INNER} fill={`url(#${base})`} />
          <g clipPath={`url(#${clip})`}>
            <rect x="0" y="0" width="24" height="8.6" fill={p.band} />
          </g>
          <path d="M4.8 8.6H19.2" stroke={p.r2} strokeWidth={0.6} />
          {STARS.map((d) => (
            <path key={d} d={d} fill={p.star} />
          ))}
          <g transform="translate(12.3 14.1) scale(0.8) translate(-11.6 -11.7)">
            <Glove fill={glyph} />
          </g>
          {sweepLayer}
          <path d={SHIELD} fill={`url(#${sh})`} />
        </>
      )}

      {design === "C" && (
        <>
          <path d={MINIMAL} fill={p.solid} stroke={p.solidRim} strokeWidth={1.9} strokeLinejoin="round" />
          <Glove fill={p.solidGlyph} />
          {sweepLayer}
        </>
      )}

      {sparkles}
    </svg>
  );
};

export default LeagueBadge;
