/**
 * PT 회원 블루 배지 — 회원카드 이름 옆 (2026-09-29 대표님: "PT 회원님들에게는 블루뱃지 회원카드에 하나 달아주고").
 *
 * 인증 배지 문법(물결 로제트 + 흰 체크)을 153 글리프 결로 그렸다: 위→아래 블루 그라데이션 면 + 위쪽 하이라이트.
 * 로제트는 r = 10.1 + 0.95·cos(8θ) 를 96점으로 뽑은 8잎 경로(24×24) — 12px 에서도 톱니가 뭉개지지 않는다.
 * 색은 토스 블루 계열. 리그 블루(bg-blue-500 사각 배지)와는 모양으로 구분된다.
 * 이름표(툴팁·읽어 주기)도 "PT 회원" 까지만 — "경험치 2배" 는 화면에 쓰지 않는다(일반 회원 차별감, 대표님 2026-09-29).
 */
import { useId } from "react";

const ROSETTE =
  "M12.0 1.0L12.7 1.1 13.4 1.5 14.0 2.1 14.5 2.7 15.0 3.2 15.5 3.5 16.1 3.7 16.8 3.7 17.6 3.6 18.4 3.6 19.2 3.8 19.8 4.2 20.2 4.8 20.4 5.6 20.4 6.4 20.3 7.2 20.3 7.9 20.5 8.5 20.8 9.0 21.3 9.5 21.9 10.0 22.5 10.6 22.9 11.3 23.0 12.0 22.9 12.7 22.5 13.4 21.9 14.0 21.3 14.5 20.8 15.0 20.5 15.5 20.3 16.1 20.3 16.8 20.4 17.6 20.4 18.4 20.2 19.2 19.8 19.8 19.2 20.2 18.4 20.4 17.6 20.4 16.8 20.3 16.1 20.3 15.5 20.5 15.0 20.8 14.5 21.3 14.0 21.9 13.4 22.5 12.7 22.9 12.0 23.0 11.3 22.9 10.6 22.5 10.0 21.9 9.5 21.3 9.0 20.8 8.5 20.5 7.9 20.3 7.2 20.3 6.4 20.4 5.6 20.4 4.8 20.2 4.2 19.8 3.8 19.2 3.6 18.4 3.6 17.6 3.7 16.8 3.7 16.1 3.5 15.5 3.2 15.0 2.7 14.5 2.1 14.0 1.5 13.4 1.1 12.7 1.0 12.0 1.1 11.3 1.5 10.6 2.1 10.0 2.7 9.5 3.2 9.0 3.5 8.5 3.7 7.9 3.7 7.2 3.6 6.4 3.6 5.6 3.8 4.8 4.2 4.2 4.8 3.8 5.6 3.6 6.4 3.6 7.2 3.7 7.9 3.7 8.5 3.5 9.0 3.2 9.5 2.7 10.0 2.1 10.6 1.5 11.3 1.1Z";

interface PtBadgeProps {
  className?: string;
  /** 어두운 카드 위에서 은은한 파란 빛 (홈 라이센스 카드) */
  glow?: boolean;
  title?: string;
}

const PtBadge = ({ className = "h-5 w-5", glow = false, title = "PT 회원" }: PtBadgeProps) => {
  // useId 는 ":r0:" 꼴이라 url(#…) 참조가 깨질 수 있어 영문·숫자만 남긴다 (GlyphTile 과 같은 방식)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fill = `ptb-fill-${uid}`;
  const shine = `ptb-shine-${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title}
      style={glow ? { filter: "drop-shadow(0 0 5px rgba(49,130,246,0.55))" } : undefined}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5AA9FF" />
          <stop offset="1" stopColor="#1F6FEB" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={ROSETTE} fill={`url(#${fill})`} />
      <path d={ROSETTE} fill={`url(#${shine})`} />
      <path d="M7.7 12.2l2.8 2.8 5.8-5.9" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default PtBadge;
