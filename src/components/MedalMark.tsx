/**
 * 🏅 이름 옆 대회 메달 (2026-10-15 대표님: "생활체육대회 수상한 회원은 이름 옆에 금·은·동 메달")
 *   DB: member_medals → get_member_medals() (TV 처럼 로그인 없어도 읽힌다).
 *   라이센스 카드 · TV 라이브보드(운동 중 카드 · 오늘 다녀간 회원 · 코치진 · 랭킹 띠) · 앱 랭킹 이름 옆에 붙는다.
 *
 * 디자인 = 시안 A '클래식 메달' (2026-10-16 대표님 선택 — 시안 3종 중 A, 여러 개면 숫자 표시)
 *   · 동그란 금·은·동 메달 + 빨강·남색 V 리본. 작을 때는 가운데 별, 크게(detail) 그리면 월계수 + 153 각인 + 연도.
 *   · 한 사람이 여러 개면 가장 좋은 메달 하나 + 그 메달을 받은 횟수(×2). 받은 대회는 눌러 보면(title) 다 나온다.
 *   · TV(animated) = 메달 위로 빛이 지나가고 금메달은 반짝임. 기기에서 '동작 줄이기'를 켰으면 멈춘 그림.
 *   · 크기는 글자 크기를 따른다(1.2em) — 쓰는 곳의 text-sm·text-2xl 등이 그대로 크기가 된다.
 */
import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type MedalKind = "gold" | "silver" | "bronze";

export interface MemberMedal {
  /** 가장 좋은 메달 */
  medal: MedalKind;
  /** 그 메달의 대회명 (가장 최근) */
  title: string;
  /** 가장 좋은 메달을 받은 횟수 */
  count: number;
  /** 받은 메달 전부 (좋은 것 → 최근 순) */
  all: { medal: MedalKind; title: string }[];
}

const MEDAL_LABEL: Record<MedalKind, string> = { gold: "우승", silver: "준우승", bronze: "3위" };

export const MEMBER_MEDALS_KEY = ["member-medals"] as const;

/** user_id → 메달 요약 (10분 캐시 · 실패해도 화면은 그대로) */
export const useMemberMedals = () =>
  useQuery({
    queryKey: MEMBER_MEDALS_KEY,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Map<string, MemberMedal>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_member_medals");
      if (error) throw error;
      const map = new Map<string, MemberMedal>();
      // 서버가 사람별로 금 → 은 → 동, 최근 대회 순으로 준다
      for (const r of (data ?? []) as { user_id: string; medal: MedalKind; event_title: string }[]) {
        const cur = map.get(r.user_id);
        if (!cur) {
          map.set(r.user_id, { medal: r.medal, title: r.event_title, count: 1, all: [{ medal: r.medal, title: r.event_title }] });
        } else {
          cur.all.push({ medal: r.medal, title: r.event_title });
          if (r.medal === cur.medal) cur.count += 1;
        }
      }
      return map;
    },
  });

/* ───────────────────────── 메달 그림 ───────────────────────── */

interface Metal {
  hi: string;
  a: string;
  b: string;
  c: string;
  rim: string;
  emb: string;
  embHi: string;
  glow: string;
}

const METAL: Record<MedalKind, Metal> = {
  gold: { hi: "#FFF7D6", a: "#FBDD72", b: "#E3A92F", c: "#9A630F", rim: "#6E4507", emb: "#7F520A", embHi: "#FFF4C8", glow: "rgba(250,205,90,0.55)" },
  silver: { hi: "#FFFFFF", a: "#EDF0F4", b: "#B9C1CB", c: "#6E7783", rim: "#4C5560", emb: "#56606B", embHi: "#FFFFFF", glow: "rgba(205,215,230,0.45)" },
  bronze: { hi: "#FFE6CF", a: "#F1AC6C", b: "#C6763C", c: "#7C4119", rim: "#55290D", emb: "#673412", embHi: "#FFDCBC", glow: "rgba(232,145,80,0.45)" },
};

const starPath = (cx: number, cy: number, R: number, r: number) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    p.push(`${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${p.join("L")}Z`;
};

/** 메달 안쪽 월계수 잎 (detail 일 때만) */
const LEAVES = (() => {
  const out: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];
  const cx = 32, cy = 42, rad = 14.2, from = 112, to = 222, n = 6;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < n; i++) {
      const t = from + (to - from) * (i / (n - 1));
      const deg = side ? 180 - t : t;
      const a = (deg * Math.PI) / 180;
      const s = 1 - i * 0.045;
      out.push({
        x: cx + rad * Math.cos(a),
        y: cy + rad * Math.sin(a),
        rx: 2.5 * s,
        ry: 1.1 * s,
        rot: deg + 90 + (side ? -32 : 32),
      });
    }
  }
  return out;
})();

const STAR_SMALL = starPath(32, 42, 9.5, 9.5 * 0.45);
const STAR_SMALL_HI = starPath(32, 42.6, 9.5, 9.5 * 0.45);
const STAR_TOP = starPath(32, 33.1, 3.2, 1.4);
const SPARKLE = (() => {
  const x = 50.5, y = 27, s = 5.5;
  return `M${x} ${y - s}l${s * 0.28} ${s * 0.72} ${s * 0.72} ${s * 0.28}-${s * 0.72} ${s * 0.28}-${s * 0.28} ${s * 0.72}-${s * 0.28}-${s * 0.72}-${s * 0.72}-${s * 0.28} ${s * 0.72}-${s * 0.28}z`;
})();
const EMBOSS_FONT = "'Arial Black', 'Helvetica Neue', system-ui, sans-serif";

/** 기기의 '동작 줄이기' 설정 */
const useReducedMotion = () => {
  const [reduce, setReduce] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const on = () => setReduce(!!mq?.matches);
    mq.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);
  return reduce;
};

interface MedalBadgeProps {
  kind: MedalKind;
  className?: string;
  /** 크게 그릴 때(약 60px 이상) — 월계수 + 153 각인 + 연도 */
  detail?: boolean;
  /** TV — 빛 지나감 + 금메달 반짝임 */
  animated?: boolean;
  /** 은은한 메달색 빛 */
  glow?: boolean;
  /** 각인 연도 (detail) */
  year?: string;
  title?: string;
}

/** 시안 A 클래식 메달 — viewBox 64×64 */
export const MedalBadge = ({ kind, className = "h-5 w-5", detail = false, animated = false, glow = false, year = "2026", title }: MedalBadgeProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  const m = METAL[kind];
  const move = animated && !reduce;
  const id = (k: string) => `md-${k}-${uid}`;
  const url = (k: string) => `url(#${id(k)})`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label={title ?? `${MEDAL_LABEL[kind]} 메달`}
      style={glow ? { filter: `drop-shadow(0 0 3px ${m.glow})` } : undefined}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id("face")} gradientUnits="userSpaceOnUse" x1="14" y1="10" x2="50" y2="60">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.28" stopColor={m.a} />
          <stop offset="0.62" stopColor={m.b} />
          <stop offset="1" stopColor={m.c} />
        </linearGradient>
        <linearGradient id={id("rim")} gradientUnits="userSpaceOnUse" x1="50" y1="60" x2="14" y2="10">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.35" stopColor={m.a} />
          <stop offset="0.7" stopColor={m.b} />
          <stop offset="1" stopColor={m.c} />
        </linearGradient>
        <linearGradient id={id("emb")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.c} />
          <stop offset="1" stopColor={m.rim} />
        </linearGradient>
        <linearGradient id={id("rr")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF5C63" />
          <stop offset="1" stopColor="#B3121D" />
        </linearGradient>
        <linearGradient id={id("rn")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3F6DFF" />
          <stop offset="1" stopColor="#142466" />
        </linearGradient>
        {move && (
          <>
            <linearGradient id={id("sweep")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={id("clip")}>
              <circle cx="32" cy="42" r="21" />
            </clipPath>
          </>
        )}
      </defs>
      {/* V 리본 */}
      <path d="M15 1h12l10 26H25z" fill={url("rr")} />
      <path d="M49 1H37L27 27h12z" fill={url("rn")} />
      {detail && (
        <>
          <path d="M21 1l10 26" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" />
          <path d="M43 1L33 27" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" />
        </>
      )}
      <rect x="27" y="21" width="10" height="6" rx="2" fill={url("rim")} stroke={m.rim} strokeWidth="0.6" />
      {/* 메달 */}
      <circle cx="32" cy="42" r="21" fill={url("rim")} stroke={m.rim} strokeWidth="0.8" />
      <circle cx="32" cy="42" r="17.4" fill={url("face")} stroke={m.rim} strokeOpacity="0.45" strokeWidth="0.7" />
      {detail ? (
        <>
          {LEAVES.map((l, i) => (
            <ellipse
              key={i}
              cx={l.x.toFixed(2)}
              cy={l.y.toFixed(2)}
              rx={l.rx.toFixed(2)}
              ry={l.ry.toFixed(2)}
              transform={`rotate(${l.rot.toFixed(1)} ${l.x.toFixed(2)} ${l.y.toFixed(2)})`}
              fill={url("emb")}
            />
          ))}
          <path d={STAR_TOP} fill={url("emb")} />
          <text x="32" y="46.3" textAnchor="middle" fontFamily={EMBOSS_FONT} fontWeight={900} fontSize="9.2" fill={m.embHi} opacity="0.75">153</text>
          <text x="32" y="45.6" textAnchor="middle" fontFamily={EMBOSS_FONT} fontWeight={900} fontSize="9.2" fill={m.emb}>153</text>
          <text x="32" y="50.8" textAnchor="middle" fontFamily={EMBOSS_FONT} fontWeight={900} fontSize="2.8" fill={m.emb}>{year}</text>
        </>
      ) : (
        <>
          <path d={STAR_SMALL_HI} fill={m.embHi} opacity="0.8" />
          <path d={STAR_SMALL} fill={url("emb")} />
        </>
      )}
      {/* 광택 */}
      <ellipse cx="25" cy="34" rx="9" ry="4.6" transform="rotate(-38 25 34)" fill="#fff" opacity="0.32" />
      {move && (
        <g clipPath={url("clip")}>
          <rect x="-30" y="0" width="16" height="64" fill={url("sweep")} transform="skewX(-20)">
            <animate attributeName="x" values="-30;90;90" keyTimes="0;0.45;1" dur="3.6s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
      {kind === "gold" && (animated || detail) && (
        <path d={SPARKLE} fill="#FFF6CF">
          {move && <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />}
        </path>
      )}
    </svg>
  );
};

/* ───────────────────────── 이름 옆 표시 ───────────────────────── */

interface Props {
  userId?: string | null;
  className?: string;
  /** TV 라이브보드 — 빛 지나감 · 금메달 반짝임 */
  animated?: boolean;
}

/** 메달이 있는 회원이면 이름 옆에 메달(+ 같은 메달 횟수), 없으면 아무것도 안 그린다 */
const MedalMark = ({ userId, className, animated = false }: Props) => {
  const { data } = useMemberMedals();
  const m = userId ? data?.get(userId) : undefined;
  if (!m) return null;
  const label = m.all.map((x) => `${x.title} ${MEDAL_LABEL[x.medal]}`).join(" · ");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("relative inline-flex shrink-0 items-center align-middle leading-none", className)}
    >
      <MedalBadge kind={m.medal} className="h-[1.2em] w-[1.2em]" animated={animated} glow={animated} />
      {m.count > 1 && (
        <span className="ml-[0.05em] self-end rounded-[0.3em] bg-neutral-900/85 ring-1 ring-amber-200/40 px-[0.22em] py-[0.08em] text-[0.5em] font-black leading-none text-amber-200 tabular-nums">
          ×{m.count}
        </span>
      )}
    </span>
  );
};

export default MedalMark;
