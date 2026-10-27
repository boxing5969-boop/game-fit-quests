/**
 * 🏅 이름 옆 대회 메달 (2026-10-15 대표님: "생활체육대회 수상한 회원은 이름 옆에 금·은·동 메달")
 *   DB: member_medals → get_member_medals() (TV 처럼 로그인 없어도 읽힌다).
 *   라이센스 카드 · TV 라이브보드(운동 중 카드 · 오늘 다녀간 회원 · 코치진 · 랭킹 띠) · 앱 랭킹 이름 옆에 붙는다.
 *
 * 디자인 = 시안 A '클래식 메달' (2026-10-16 대표님 선택 — 여러 개면 숫자 표시)
 *   · 동그란 금·은·동 메달 + 빨강·남색 V 리본, 별 · 월계수 · 153 각인. Higgsfield 로 그린 실사 이미지(아래 메달 그림).
 *   · 한 사람이 여러 개면 가장 좋은 메달 하나 + 그 메달을 받은 횟수(×2). 받은 대회는 눌러 보면(title) 다 나온다.
 *   · TV(animated) = 메달 위로 빛이 지나가고 금메달은 반짝임. 기기에서 '동작 줄이기'를 켰으면 멈춘 그림.
 *   · 크기는 글자 크기를 따른다(1.2em) — 쓰는 곳의 text-body·text-title 등이 그대로 크기가 된다.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import medalGold from "@/assets/medals/medal-gold.webp";
import medalSilver from "@/assets/medals/medal-silver.webp";
import medalBronze from "@/assets/medals/medal-bronze.webp";

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

/** 라이브보드 테스트 모드 '메달 예시' — 가상 회원에게만, 이 기기 화면에서만 (DB 와 무관) */
const PREVIEW_MEDALS = new Map<string, MemberMedal>();
export const setPreviewMedal = (userId: string, medal: MedalKind, count = 1) => {
  const title = "메달 예시";
  PREVIEW_MEDALS.set(userId, { medal, title, count, all: Array.from({ length: count }, () => ({ medal, title })) });
};

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
// Higgsfield(GPT Image 2.5, 2026-10-16)로 그린 금·은·동 실사 메달 — 같은 모양·같은 리본, 금속만 다르다.
//   앱용 192px webp(배경 투명). 인쇄용 원본 PNG 는 대표님께 따로 드림. SVG 로 그리지 않는다(대표님: "자산은 SVG 말고").

const MEDAL_SRC: Record<MedalKind, string> = { gold: medalGold, silver: medalSilver, bronze: medalBronze };
const MEDAL_GLOW: Record<MedalKind, string> = {
  gold: "drop-shadow(0 0 3px rgba(250,205,90,0.6))",
  silver: "drop-shadow(0 0 3px rgba(205,215,230,0.5))",
  bronze: "drop-shadow(0 0 3px rgba(232,145,80,0.5))",
};

interface MedalBadgeProps {
  kind: MedalKind;
  className?: string;
  /** TV — 빛 지나감 + 금메달 반짝임 (기기 '동작 줄이기'면 멈춤, index.css) */
  animated?: boolean;
  /** 은은한 메달색 빛 */
  glow?: boolean;
  title?: string;
}

export const MedalBadge = ({ kind, className = "h-5 w-5", animated = false, glow = false, title }: MedalBadgeProps) => {
  const src = MEDAL_SRC[kind];
  const mask = `url(${src})`;
  return (
    <span className={cn("relative inline-block shrink-0", className)} title={title}>
      <img
        src={src}
        alt={title ?? `${MEDAL_LABEL[kind]} 메달`}
        draggable={false}
        decoding="async"
        className="block h-full w-full select-none object-contain"
        style={glow ? { filter: MEDAL_GLOW[kind] } : undefined}
      />
      {animated && (
        <span aria-hidden className="medal-shine pointer-events-none absolute inset-0" style={{ WebkitMaskImage: mask, maskImage: mask }} />
      )}
      {animated && kind === "gold" && (
        <span
          aria-hidden
          className="medal-twinkle pointer-events-none absolute -right-[0.18em] top-[0.12em] text-[0.42em] leading-none text-amber-100 drop-shadow-[0_0_2px_rgba(255,230,150,0.9)]"
        >
          ✦
        </span>
      )}
    </span>
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
  const m = userId ? data?.get(userId) ?? PREVIEW_MEDALS.get(userId) : undefined;
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
