/**
 * 🥊 붕대 감기 그림 — 손등에서 본 왼손 위에 붕대를 단계별로 쌓아 그린다 (2026-10-13 대표님).
 *
 *   · 지금 단계에서 감는 붕대 = 민트, 앞 단계까지 감은 붕대 = 흰 붕대. step = 단계 수면 '완성'(전부 흰 붕대).
 *   · mirrored = 오른손 (그림을 좌우로 뒤집는다 — 감는 방향도 같이 뒤집힌다). 꼬리표 글자는 뒤집지 않는다.
 *   · 붕대 띠는 손 모양으로 잘라(clipPath) 손 밖으로 삐져나오지 않는다. 엄지 고리는 엄지 모양으로만 자른다.
 *   · 단계 문구·층 순서 = data/handWrapGuide.ts (그림과 글이 같은 목록을 쓴다).
 */
import { useId, type ReactNode } from "react";
import { HANDWRAP_STEPS, type WrapLayer } from "@/data/handWrapGuide";

const VIEW_W = 240;
const VIEW_H = 300;

/** 색 — 라이트·다크 어느 바탕에서도 보이게 피부 윤곽선을 두른다 */
const C = {
  skinTop: "#FFE4CD",
  skinBottom: "#F5BC93",
  outline: "#C98B63",
  nail: "#FFF4EA",
  nailEdge: "#E6B38E",
  crease: "#D49470",
  done: { body: "#FBFCFC", edge: "#A9B5B2" },
  now: { body: "#29C39C", edge: "#0B8A6B" },
} as const;

type Tone = "done" | "now";

/** 붕대 한 띠 — d 를 따라 w 두께로 */
interface Band {
  d: string;
  w: number;
}

// ── 손 모양 (왼손 손등 · 엄지가 오른쪽) ─────────────────────────
// 같은 도형을 세 번 쓴다: 윤곽선(밑칠) · 피부 · 붕대 자르기(clipPath)

const FINGER_TF = {
  pinky: "rotate(-7 81.5 134)",
  ring: "rotate(-2.5 104.5 134)",
  middle: "rotate(1 128.5 134)",
  index: "rotate(5 151.5 134)",
} as const;
const THUMB_TF = "translate(166 212) rotate(50)";

const THUMB_SHAPE = <rect x="-12.5" y="-64" width="25" height="72" rx="12.5" transform={THUMB_TF} />;

const HAND_SHAPES = (
  <>
    {/* 팔뚝 */}
    <path d="M86 228 L81 300 H163 L158 228 Z" />
    {/* 손등 */}
    <rect x="68" y="106" width="106" height="136" rx="30" />
    {/* 새끼 · 약지 · 중지 · 검지 */}
    <rect x="72" y="58" width="19" height="76" rx="9.5" transform={FINGER_TF.pinky} />
    <rect x="94" y="36" width="21" height="98" rx="10.5" transform={FINGER_TF.ring} />
    <rect x="117.5" y="26" width="22" height="108" rx="11" transform={FINGER_TF.middle} />
    <rect x="141" y="38" width="21" height="96" rx="10.5" transform={FINGER_TF.index} />
    {THUMB_SHAPE}
  </>
);

const NAILS = (
  <g fill={C.nail} stroke={C.nailEdge} strokeWidth={1}>
    <rect x="75.5" y="62" width="12" height="15" rx="5" transform={FINGER_TF.pinky} />
    <rect x="98" y="40" width="13" height="16" rx="5.5" transform={FINGER_TF.ring} />
    <rect x="121.5" y="30" width="14" height="17" rx="6" transform={FINGER_TF.middle} />
    <rect x="145" y="42" width="13" height="16" rx="5.5" transform={FINGER_TF.index} />
    <rect x="-8" y="-59" width="16" height="17" rx="6.5" transform={THUMB_TF} />
  </g>
);

const CREASES = (
  <g fill="none" stroke={C.crease} strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round">
    <path d="M77 100 q4.5 2 9 0" transform={FINGER_TF.pinky} />
    <path d="M99 82 q5.5 2 11 0" transform={FINGER_TF.ring} />
    <path d="M123 76 q5.5 2 11 0" transform={FINGER_TF.middle} />
    <path d="M146 84 q5.5 2 11 0" transform={FINGER_TF.index} />
  </g>
);

// ── 붕대 층 ────────────────────────────────────────────────
// hand = 손 모양으로 자르는 띠, thumb = 엄지 모양으로만 자르는 띠

/** 손목·주먹 마디를 한 바퀴 도는 띠 — 원통을 위에서 본 것처럼 가운데가 살짝 처진다 */
const around = (y: number, w = 13): Band => ({ d: `M56 ${y} C94 ${y + 7} 150 ${y + 7} 188 ${y}`, w });

const LAYERS: Record<WrapLayer, { hand?: Band[]; thumb?: Band[]; velcro?: boolean }> = {
  loop: {
    thumb: [{ d: "M172 192 L196 221", w: 10 }],
    hand: [{ d: "M182 210 C150 232 112 242 64 246", w: 12 }],
  },
  wrist: { hand: [around(240), around(252), around(264)] },
  diagUp: { hand: [{ d: "M160 238 L70 122", w: 12 }] },
  knuckle: { hand: [around(114), around(126), around(138)] },
  diagDown: { hand: [{ d: "M174 120 L84 238", w: 12 }, around(247, 12)] },
  gaps: {
    hand: [
      { d: "M146 244 L89 98", w: 10 },
      { d: "M154 242 L116 97", w: 10 },
      { d: "M162 238 L142 97", w: 10 },
    ],
  },
  thumbLock: {
    thumb: [{ d: "M175 183 L203 216", w: 13 }],
    hand: [{ d: "M186 210 C156 226 118 240 64 248", w: 11 }],
  },
  knuckle2: { hand: [around(120), around(132)] },
  finish: { hand: [around(244), around(258)], velcro: true },
};

const bandPaths = (bands: Band[], tone: Tone, key: string): ReactNode =>
  bands.map((b, i) => (
    <g key={`${key}-${i}`} fill="none" strokeLinecap="butt" strokeLinejoin="round">
      <path d={b.d} stroke={C[tone].edge} strokeWidth={b.w + 3} />
      <path d={b.d} stroke={C[tone].body} strokeWidth={b.w} />
    </g>
  ));

/** 벨크로 — 손목 띠 위 작은 패치 (점 = 까슬한 면) */
const Velcro = ({ tone }: { tone: Tone }) => (
  <g>
    <rect x="101" y="242" width="36" height="20" rx="4" fill={tone === "now" ? "#0F9E7B" : "#DCE3E1"} stroke={C[tone].edge} strokeWidth={1.5} />
    <g fill={tone === "now" ? "#7DE3C6" : "#AEB9B6"}>
      {[107, 114, 121, 128].map((x) => (
        <g key={x}>
          <circle cx={x + 1.5} cy={248} r={1.2} />
          <circle cx={x + 1.5} cy={256} r={1.2} />
        </g>
      ))}
    </g>
  </g>
);

// ── 꼬리표 (3바퀴 등) — 층별 자리. edge = 손 쪽 끝 x (왼손 기준), 오른손이면 좌우만 바꾼다 ──
const BADGE_SPOT: Partial<Record<WrapLayer, { edge: number; y: number }>> = {
  wrist: { edge: 78, y: 252 },
  knuckle: { edge: 66, y: 126 },
  knuckle2: { edge: 66, y: 126 },
  gaps: { edge: 66, y: 176 },
};

/** 꼬리표 폭 — 한글은 글자 크기만큼, 숫자·기호는 그 절반 남짓 */
const badgeWidth = (text: string) =>
  16 + Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x100 ? 7 : 12), 0);

const Badge = ({ text, x, y }: { text: string; x: number; y: number }) => {
  const w = badgeWidth(text);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - 12}
        width={w}
        height={24}
        rx={12}
        strokeWidth={2}
        style={{ fill: "hsl(var(--card))", stroke: C.now.body }}
      />
      <text
        x={x}
        y={y + 4.2}
        textAnchor="middle"
        fontSize={12}
        fontWeight={800}
        style={{ fill: "hsl(var(--foreground))" }}
      >
        {text}
      </text>
    </g>
  );
};

interface HandWrapIllustrationProps {
  /** 0부터. HANDWRAP_STEPS.length 면 완성 그림 */
  step: number;
  /** 오른손으로 보기 (좌우 반전) */
  mirrored?: boolean;
  /** 꼬리표(3바퀴 등) 숨기기 — 작은 썸네일용 */
  hideBadge?: boolean;
  className?: string;
  /** 화면 읽기 프로그램용 설명 — 없으면 장식으로 숨긴다 */
  label?: string;
}

const HandWrapIllustration = ({ step, mirrored = false, hideBadge = false, className, label }: HandWrapIllustrationProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const total = HANDWRAP_STEPS.length;
  const at = Math.max(0, Math.min(step, total));
  const done = HANDWRAP_STEPS.slice(0, at).flatMap((s) => s.layers);
  const current = at < total ? HANDWRAP_STEPS[at] : null;
  const now = current ? current.layers : [];

  const handClip = `url(#${uid}-hand)`;
  const thumbClip = `url(#${uid}-thumb)`;

  const drawLayer = (layer: WrapLayer, tone: Tone, idx: number) => {
    const def = LAYERS[layer];
    const key = `${tone}-${layer}-${idx}`;
    return (
      <g key={key}>
        {def.hand && <g clipPath={handClip}>{bandPaths(def.hand, tone, `${key}-h`)}</g>}
        {def.thumb && <g clipPath={thumbClip}>{bandPaths(def.thumb, tone, `${key}-t`)}</g>}
        {def.velcro && <Velcro tone={tone} />}
      </g>
    );
  };

  const badgeLayer = current?.badge ? current.layers.find((l) => BADGE_SPOT[l]) : undefined;
  const spot = badgeLayer ? BADGE_SPOT[badgeLayer] : undefined;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.skinTop} />
          <stop offset="1" stopColor={C.skinBottom} />
        </linearGradient>
        <clipPath id={`${uid}-hand`}>{HAND_SHAPES}</clipPath>
        <clipPath id={`${uid}-thumb`}>{THUMB_SHAPE}</clipPath>
      </defs>

      <g transform={mirrored ? `translate(${VIEW_W} 0) scale(-1 1)` : undefined}>
        {/* 윤곽선 — 같은 도형을 굵은 선으로 먼저 깔면 손가락 사이에 선이 생긴다 */}
        <g fill="none" stroke={C.outline} strokeWidth={4.5} strokeLinejoin="round">
          {HAND_SHAPES}
        </g>
        <g fill={`url(#${uid}-skin)`}>{HAND_SHAPES}</g>
        {NAILS}
        {CREASES}

        {done.map((l, i) => drawLayer(l, "done", i))}
        {now.map((l, i) => drawLayer(l, "now", i))}
      </g>

      {!hideBadge && current?.badge && spot && (
        <Badge
          text={current.badge}
          x={mirrored ? VIEW_W - spot.edge + badgeWidth(current.badge) / 2 : spot.edge - badgeWidth(current.badge) / 2}
          y={spot.y}
        />
      )}
    </svg>
  );
};

export default HandWrapIllustration;
