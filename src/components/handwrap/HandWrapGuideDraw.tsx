/**
 * 🥊 붕대 감기 방향 표시 — 단계 사진 위에 "어디서 시작해서 어디로" (2026-10-27 대표님: "사진에 방향과 어디에서 시작해서 어디로 오는지")
 *   2026-10-30 대표님 "사진 고화질로 만들고 방향 알려주는 버전 · 밑에 설명까지" → 12단계 사진 설명서에 다시 씀.
 *
 *   시작(초록 점) → 붕대가 지나가는 길(노랑 · 점선 = 손바닥 쪽으로 지나가는 길) → 끝(주황 점) · 바퀴 수 · 확인할 곳(초록).
 *   좌표는 data/handWrapGuide.ts 의 guide (사진 위 %, 오른손 기준). 왼손(mirrored)이면 가로를 뒤집어 그린다 — 글자는 뒤집지 않는다.
 *
 *   mode
 *     anim  — 길이 시작에서 끝으로 그려지고 점 · 글이 차례로 나온다 (index.css hw-draw · hw-pop)
 *     still — 움직임 줄이기: 다 그려진 채
 *     thumb — 작은 사진: 글 없이 길 · 점만 굵게
 *   부모는 4:3 칸이고 position: relative. 영상 · 사진은 부모가 깐다.
 */
import { useId, useMemo, type CSSProperties } from "react";
import { Check } from "lucide-react";
import type { GuideMark, GuidePin, GuidePt, HandWrapGuideDraw as Guide } from "@/data/handWrapGuide";
import { cn } from "@/lib/utils";

type Mode = "anim" | "still" | "thumb";

interface Props {
  guide: Guide;
  mirrored?: boolean;
  mode: Mode;
  className?: string;
}

const VW = 720;
const VH = 540;
/** 길 전체를 그리는 시간(초) — 토막마다 길이만큼 나눠 쓴다 */
const DRAW_S = 1.5;

const YELLOW = "#FDE047";
const GREEN = "#10B981";
const ORANGE = "#F97316";

type XY = [number, number];

const n1 = (v: number) => Math.round(v * 10) / 10;

/** % → 그림 좌표 (왼손은 가로를 뒤집는다) */
const toXY = (p: GuidePt, mirrored: boolean): XY => {
  const x = (p[0] * VW) / 100;
  return [mirrored ? VW - x : x, (p[1] * VH) / 100];
};

/** % 자리 (글 놓기용) */
const toPct = (p: GuidePt, mirrored: boolean): XY => [mirrored ? 100 - p[0] : p[0], p[1]];

/** 점들을 지나는 매끈한 곡선 (Catmull-Rom → 3차 베지어) + 대략 길이 + 끝 방향 */
function smooth(pts: XY[]): { d: string; len: number; end: XY; dir: XY } {
  const end = pts[pts.length - 1] ?? [0, 0];
  if (pts.length < 2) return { d: "", len: 0, end, dir: [1, 0] };
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  let len = 0;
  let dir: XY = [1, 0];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const c1: XY = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: XY = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
    len += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (i === pts.length - 2) {
      let dx = p2[0] - c2[0];
      let dy = p2[1] - c2[1];
      if (Math.hypot(dx, dy) < 0.5) {
        dx = p2[0] - p1[0];
        dy = p2[1] - p1[1];
      }
      const m = Math.hypot(dx, dy) || 1;
      dir = [dx / m, dy / m];
    }
  }
  return { d, len, end, dir };
}

/** 화살촉 — 끝점에서 나가는 방향으로 */
function arrowHead(end: XY, dir: XY, size: number): string {
  const [x, y] = end;
  const [ux, uy] = dir;
  const px = -uy;
  const py = ux;
  const tip: XY = [x + ux * size * 0.35, y + uy * size * 0.35];
  const bx = x - ux * size * 0.75;
  const by = y - uy * size * 0.75;
  const l: XY = [bx + px * size * 0.6, by + py * size * 0.6];
  const r: XY = [bx - px * size * 0.6, by - py * size * 0.6];
  return `M${n1(tip[0])} ${n1(tip[1])} L${n1(l[0])} ${n1(l[1])} L${n1(r[0])} ${n1(r[1])} Z`;
}

/** 글을 점의 어느 쪽에 — 왼손이면 좌우를 바꾼다 */
const PLACE: Record<"r" | "l" | "t" | "b", string> = {
  r: "translate(10px, -50%)",
  l: "translate(calc(-100% - 10px), -50%)",
  t: "translate(-50%, calc(-100% - 10px))",
  b: "translate(-50%, 10px)",
};
const flipSide = (s: GuidePin["side"], mirrored: boolean): "r" | "l" | "t" | "b" => {
  const side = s ?? "r";
  if (!mirrored) return side;
  return side === "r" ? "l" : side === "l" ? "r" : side;
};

const pop = (anim: boolean, delay: number): CSSProperties | undefined =>
  anim ? { animation: `hw-pop 0.32s cubic-bezier(.2,.9,.3,1.3) ${delay.toFixed(2)}s both` } : undefined;

const HandWrapGuideDraw = ({ guide, mirrored = false, mode, className }: Props) => {
  const uid = useId().replace(/:/g, "");
  const anim = mode === "anim";
  const thumb = mode === "thumb";

  const drawn = useMemo(() => {
    const segs = guide.segs.map((s) => ({ back: !!s.back, ...smooth(s.pts.map((p) => toXY(p, mirrored))) }));
    const ghost = (guide.ghost ?? []).map((s) => smooth(s.pts.map((p) => toXY(p, mirrored))));
    // 토막마다 그리기 시간 — 길이만큼 (너무 짧은 토막도 보이게 최소 0.22초)
    const total = segs.reduce((a, s) => a + s.len, 0) || 1;
    let t = 0.15;
    const timed = segs.map((s) => {
      const dur = Math.max(0.22, (DRAW_S * s.len) / total);
      const out = { ...s, delay: t, dur };
      t += dur;
      return out;
    });
    return { segs: timed, ghost, doneAt: t };
  }, [guide, mirrored]);

  // 굵기 — 작은 사진은 굵게(줄여 보이므로)
  const W = thumb
    ? { main: 15, out: 25, back: 11, backOut: 19, head: 40, dash: "26 18", dot: 17 }
    : { main: 6.5, out: 12, back: 5, backOut: 9.5, head: 22, dash: "15 11", dot: 0 };

  const leaders: Array<{ from: XY; to: XY; key: string; delay: number }> = [];
  const pins: Array<{ pin: GuidePin; kind: "start" | "end" | GuideMark["kind"]; delay: number; key: string }> = [];
  if (guide.start) pins.push({ pin: guide.start, kind: "start", delay: 0.05, key: "start" });
  if (guide.end) pins.push({ pin: guide.end, kind: "end", delay: drawn.doneAt, key: "end" });
  (guide.marks ?? []).forEach((m, i) =>
    pins.push({ pin: m, kind: m.kind, delay: drawn.doneAt + 0.12 * (i + 1) + (guide.segs.length ? 0 : 0.2 * i), key: `m${i}` }),
  );
  for (const p of pins) {
    if (p.pin.lab && !thumb) leaders.push({ from: toXY(p.pin.at, mirrored), to: toXY(p.pin.lab, mirrored), key: p.key, delay: p.delay });
  }

  return (
    <div
      aria-hidden
      className={cn("hw-guide pointer-events-none absolute inset-0 select-none", className)}
      style={{ containerType: "inline-size" } as CSSProperties}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {anim && (
          <defs>
            {drawn.segs.map((s, i) => (
              <mask key={i} id={`${uid}m${i}`} maskUnits="userSpaceOnUse" x="-40" y="-40" width={VW + 80} height={VH + 80}>
                <path
                  d={s.d}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={40}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1 1"
                  style={{ animation: `hw-draw ${s.dur.toFixed(2)}s linear ${s.delay.toFixed(2)}s both` }}
                />
              </mask>
            ))}
          </defs>
        )}

        {/* 앞 단계에서 지나간 길 — 흐리게 */}
        {drawn.ghost.map((g, i) => (
          <path key={`g${i}`} d={g.d} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={thumb ? 10 : 4.5} strokeLinecap="round" />
        ))}

        {/* 글 자리로 잇는 선 */}
        {leaders.map((l) => (
          <line
            key={`l${l.key}`}
            x1={n1(l.from[0])}
            y1={n1(l.from[1])}
            x2={n1(l.to[0])}
            y2={n1(l.to[1])}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={3}
            strokeLinecap="round"
            style={anim ? { animation: `hw-fade 0.3s ease-out ${l.delay.toFixed(2)}s both` } : undefined}
          />
        ))}

        {/* 붕대가 지나가는 길 */}
        {drawn.segs.map((s, i) => (
          <g key={`s${i}`} mask={anim ? `url(#${uid}m${i})` : undefined}>
            <path
              d={s.d}
              fill="none"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={s.back ? W.backOut : W.out}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.back ? W.dash : undefined}
            />
            <path
              d={s.d}
              fill="none"
              stroke={s.back ? "#FFFFFF" : YELLOW}
              strokeWidth={s.back ? W.back : W.main}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.back ? W.dash : undefined}
            />
          </g>
        ))}

        {/* 화살촉 — 토막 끝마다 (가는 방향) */}
        {drawn.segs.map((s, i) => (
          <path
            key={`h${i}`}
            d={arrowHead(s.end, s.dir, s.back ? W.head * 0.8 : W.head)}
            fill={s.back ? "#FFFFFF" : YELLOW}
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={thumb ? 4 : 2}
            strokeLinejoin="round"
            style={
              anim
                ? { animation: `hw-pop 0.25s ease-out ${(s.delay + s.dur - 0.04).toFixed(2)}s both`, transformBox: "fill-box", transformOrigin: "center" }
                : undefined
            }
          />
        ))}

        {/* 작은 사진 — 점만 */}
        {thumb &&
          pins.map(({ pin, kind, key }) => {
            if (kind === "count" || kind === "note") return null;
            const [x, y] = toXY(pin.at, mirrored);
            if (kind === "x") return null;
            const fill = kind === "end" ? ORANGE : GREEN;
            return <circle key={key} cx={n1(x)} cy={n1(y)} r={W.dot} fill={fill} stroke="#fff" strokeWidth={6} />;
          })}
      </svg>

      {/* 점 · 글 (크게 볼 때만) */}
      {!thumb &&
        pins.map(({ pin, kind, delay, key }) => {
          const [x, y] = toPct(pin.at, mirrored);
          const at: CSSProperties = { left: `${x}%`, top: `${y}%` };
          const fontSize: CSSProperties = { fontSize: "clamp(10px, 3.15cqw, 14px)" };
          if (kind === "count" || kind === "note") {
            return (
              <span key={key} className="absolute" style={{ ...at, transform: "translate(-50%, -50%)" }}>
                <span
                  className="block whitespace-nowrap rounded-full bg-black/70 px-[0.75em] py-[0.3em] font-black leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,.35)] ring-1 ring-white/30"
                  style={{ ...fontSize, ...pop(anim, delay) }}
                >
                  {pin.label}
                </span>
              </span>
            );
          }
          if (kind === "x") {
            return (
              <span key={key} className="absolute" style={{ ...at, transform: "translate(-50%, -50%)" }}>
                <span
                  className="flex h-[1.9em] w-[1.9em] items-center justify-center rounded-full font-black leading-none text-black shadow-[0_2px_8px_rgba(0,0,0,.4)] ring-2 ring-black/50"
                  style={{ ...fontSize, background: YELLOW, ...pop(anim, delay) }}
                >
                  {pin.label}
                </span>
              </span>
            );
          }
          const color = kind === "end" ? ORANGE : GREEN;
          const tag = kind === "start" ? "시작" : kind === "end" ? "끝" : null;
          const labPct = pin.lab ? toPct(pin.lab, mirrored) : null;
          const pillStyle: CSSProperties = labPct
            ? { left: `${labPct[0]}%`, top: `${labPct[1]}%`, transform: "translate(-50%, -50%)" }
            : { ...at, transform: PLACE[flipSide(pin.side, mirrored)] };
          return (
            <span key={key}>
              {/* 점 */}
              <span className="absolute" style={{ ...at, transform: "translate(-50%, -50%)" }}>
                <span
                  className={cn("block h-[14px] w-[14px] rounded-full ring-[2.5px] ring-white", kind === "start" && anim && "hw-pulse")}
                  style={{ background: color, boxShadow: "0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.45)", ...pop(anim, delay) }}
                />
              </span>
              {/* 글 */}
              <span className="absolute" style={pillStyle}>
                <span
                  className="flex items-center gap-[0.35em] whitespace-nowrap rounded-full bg-black/75 py-[0.28em] pl-[0.3em] pr-[0.7em] font-bold leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,.35)] ring-1 ring-white/25"
                  style={{ ...fontSize, ...pop(anim, delay + 0.05) }}
                >
                  {tag ? (
                    <span className="rounded-full px-[0.45em] py-[0.18em] text-[0.88em] font-black" style={{ background: color }}>
                      {tag}
                    </span>
                  ) : (
                    <span className="flex h-[1.15em] w-[1.15em] items-center justify-center rounded-full" style={{ background: color }}>
                      <Check className="h-[0.8em] w-[0.8em]" strokeWidth={4} />
                    </span>
                  )}
                  {pin.label}
                </span>
              </span>
            </span>
          );
        })}
    </div>
  );
};

export default HandWrapGuideDraw;
