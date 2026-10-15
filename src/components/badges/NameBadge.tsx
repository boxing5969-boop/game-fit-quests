/**
 * 이름 옆 리그 버튼 — 모든 회원 (2026-10-15 대표님: "블루버튼 PT만 해줘서 차별감을 만들지 말고 모든 회원 버튼을
 * 이름옆에 달아주는데 자신의 리그 레벨에 따라서 화이트·블루·레드·골드 버튼").
 *
 * 모양은 예전 PT 배지와 같은 8잎 로제트 + 체크 — 색만 리그를 따른다. 블랙 리그는 골드(최상위, 반짝이 + 금빛 광채).
 * 코치님(지도진, 'champion')은 버튼 없음 → null.
 */
import { useId } from "react";
import { toLeagueKey, type LeagueKey } from "./LeagueBadge";

const ROSETTE =
  "M12.0 1.0L12.7 1.1 13.4 1.5 14.0 2.1 14.5 2.7 15.0 3.2 15.5 3.5 16.1 3.7 16.8 3.7 17.6 3.6 18.4 3.6 19.2 3.8 19.8 4.2 20.2 4.8 20.4 5.6 20.4 6.4 20.3 7.2 20.3 7.9 20.5 8.5 20.8 9.0 21.3 9.5 21.9 10.0 22.5 10.6 22.9 11.3 23.0 12.0 22.9 12.7 22.5 13.4 21.9 14.0 21.3 14.5 20.8 15.0 20.5 15.5 20.3 16.1 20.3 16.8 20.4 17.6 20.4 18.4 20.2 19.2 19.8 19.8 19.2 20.2 18.4 20.4 17.6 20.4 16.8 20.3 16.1 20.3 15.5 20.5 15.0 20.8 14.5 21.3 14.0 21.9 13.4 22.5 12.7 22.9 12.0 23.0 11.3 22.9 10.6 22.5 10.0 21.9 9.5 21.3 9.0 20.8 8.5 20.5 7.9 20.3 7.2 20.3 6.4 20.4 5.6 20.4 4.8 20.2 4.2 19.8 3.8 19.2 3.6 18.4 3.6 17.6 3.7 16.8 3.7 16.1 3.5 15.5 3.2 15.0 2.7 14.5 2.1 14.0 1.5 13.4 1.1 12.7 1.0 12.0 1.1 11.3 1.5 10.6 2.1 10.0 2.7 9.5 3.2 9.0 3.5 8.5 3.7 7.9 3.7 7.2 3.6 6.4 3.6 5.6 3.8 4.8 4.2 4.2 4.8 3.8 5.6 3.6 6.4 3.6 7.2 3.7 7.9 3.7 8.5 3.5 9.0 3.2 9.5 2.7 10.0 2.1 10.6 1.5 11.3 1.1Z";

interface Tone {
  f1: string;
  f2: string;
  f3: string;
  rim?: string;
  rimW?: number;
  check: string;
  glow: string;
  label: string;
}

const TONE: Record<LeagueKey, Tone> = {
  white: { f1: "#FFFFFF", f2: "#EEF1F5", f3: "#CDD4DE", rim: "#9AA4B2", rimW: 0.7, check: "#4E5968", glow: "", label: "화이트 리그" },
  blue: { f1: "#7DBBFF", f2: "#3D8BF7", f3: "#1F6FEB", check: "#FFFFFF", glow: "drop-shadow(0 0 4px rgba(49,130,246,0.45))", label: "블루 리그" },
  red: { f1: "#FF8A8A", f2: "#F0434F", f3: "#C81E2A", check: "#FFFFFF", glow: "drop-shadow(0 0 4px rgba(240,67,79,0.45))", label: "레드 리그" },
  black: { f1: "#FFF1BF", f2: "#F2C35B", f3: "#B07A1E", rim: "#8A5A12", rimW: 0.5, check: "#4A2E00", glow: "drop-shadow(0 0 5px rgba(242,195,91,0.7))", label: "블랙 리그" },
};

interface NameBadgeProps {
  league: string | null | undefined;
  className?: string;
  /** 은은한 리그색 빛 (기본 켬). 아주 긴 목록에서는 꺼서 가볍게. */
  glow?: boolean;
  title?: string;
}

const NameBadge = ({ league, className = "h-5 w-5", glow = true, title }: NameBadgeProps) => {
  // useId 는 ":r0:" 꼴이라 url(#…) 참조가 깨질 수 있어 영문·숫자만 남긴다 (PtBadge 와 같은 방식)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if ((league ?? "").toLowerCase() === "champion") return null;
  const key = toLeagueKey(league);
  const t = TONE[key];
  const label = title ?? t.label;
  const fill = `nmb-f-${uid}`;
  const shine = `nmb-s-${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 overflow-visible`}
      role="img"
      aria-label={label}
      style={glow && t.glow ? { filter: t.glow } : undefined}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.f1} />
          <stop offset="0.55" stopColor={t.f2} />
          <stop offset="1" stopColor={t.f3} />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={ROSETTE} fill={`url(#${fill})`} stroke={t.rim ?? "none"} strokeWidth={t.rimW ?? 0} />
      <path d={ROSETTE} fill={`url(#${shine})`} />
      <path d="M7.7 12.2l2.8 2.8 5.8-5.9" fill="none" stroke={t.check} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
      {key === "black" && (
        <path d="M21.4 0.4l.45 1.1 1.1.45-1.1.45-.45 1.1-.45-1.1-1.1-.45 1.1-.45z" fill="#FFF4CC">
          {glow && <animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite" />}
        </path>
      )}
    </svg>
  );
};

export default NameBadge;
