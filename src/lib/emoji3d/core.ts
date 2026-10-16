/**
 * 화면에 그려지는 글자 속 이모지를 153 입체 아이콘으로 바꾼다 (2026-10-16 대표님 — map.ts 참고).
 *
 * 어디서 쓰나:
 *   · jsx-runtime.ts — 앱의 모든 JSX 글자(children)를 그릴 때 자동으로 (vite.config.ts jsxImportSource)
 *   · sonner.ts — 토스트 문구
 *   · main.tsx — alert/confirm/prompt 는 그림을 못 넣으니 이모지를 지운다
 * 규칙:
 *   · 표(EMOJI_ICON)에 있는 이모지 → <img class="emo3d"> (글자 크기를 따라 1.2em)
 *   · 국기(지역 표시 문자 2개) → 지운다
 *   · 글자 기호(▶ ↔ ⚙ …)에 붙은 FE0F → 떼고 글자로 둔다
 *   · 표에 없는 이모지 → 그대로 (회원이 직접 쓴 글은 바꾸지 않는다)
 *   · <option>·<textarea>·SVG 글자처럼 그림이 들어갈 수 없는 곳, title·aria-label·alt·placeholder 속성 → 이모지를 지운다
 * 이 파일은 JSX 를 쓰지 않는다 (jsx-runtime 이 이 파일을 쓰기 때문에 — 서로 부르면 안 된다).
 */
import { createElement, type ReactNode } from "react";
import { EMOJI_ICON, TEXT_SYMBOLS, icon3dSrc } from "./map";

/** 이모지가 하나라도 있나 — 빠른 거름 */
const HAS = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
/** 이모지 묶음: 국기 · 키캡 · (그림 문자 + 선택자 + 피부색) 을 ZWJ 로 이은 것 */
const SEQ =
  /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}[︎️]?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}[︎️]?\p{Emoji_Modifier}?)*/gu;
const MOD = /[︎️\u{1F3FB}-\u{1F3FF}]/gu;
const RI = /^\p{Regional_Indicator}{2}$/u;
/** 지운 자리 표시 (안에서만 쓰는 글자) */
const DROP = "\u0000";
const DROP_RUN = /[ \t]*\u0000+[ \t]*/g;

export const hasEmoji = (s: string) => HAS.test(s);

type Seg = { t: "text"; v: string } | { t: "icon"; v: string; raw: string };

/** 한 이모지 묶음을 어떻게 할지: 아이콘 · 지움 · 글자 기호로 · 그대로({}) */
const decide = (raw: string): { icon?: string; drop?: true; text?: string } => {
  if (RI.test(raw)) return { drop: true };
  const key = raw.replace(MOD, "");
  const hit = EMOJI_ICON[key];
  if (hit === null) return { drop: true };
  if (hit) return { icon: hit };
  if (TEXT_SYMBOLS.has(key)) return key === raw ? {} : { text: key };
  return {};
};

/** 지운 자리 빈칸 정리 — 양옆에 빈칸이 있었으면 하나만, 맨 앞·맨 끝이면 없앤다 */
const cleanDrops = (v: string, isFirst: boolean, isLast: boolean) =>
  v.replace(DROP_RUN, (mm: string, off: number, all: string) => {
    if (!/[ \t]/.test(mm)) return "";
    const end = off + mm.length;
    const atStart = (off === 0 && isFirst) || all[off - 1] === "\n";
    const atEnd = (end >= all.length && isLast) || all[end] === "\n";
    return atStart || atEnd ? "" : " ";
  });

const split = (s: string): Seg[] | null => {
  SEQ.lastIndex = 0;
  let m: RegExpExecArray | null;
  let last = 0;
  let changed = false;
  let dropped = false;
  const out: Seg[] = [];
  const pushText = (v: string) => {
    if (!v) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === "text") prev.v += v;
    else out.push({ t: "text", v });
  };
  while ((m = SEQ.exec(s))) {
    const raw = m[0];
    const before = s.slice(last, m.index);
    const d = decide(raw);
    if (d.icon) {
      pushText(before);
      out.push({ t: "icon", v: d.icon, raw });
      changed = true;
    } else if (d.drop) {
      pushText(before + DROP);
      changed = dropped = true;
    } else if (d.text !== undefined) {
      pushText(before + d.text);
      changed = true;
    } else {
      pushText(before + raw);
    }
    last = SEQ.lastIndex;
  }
  if (!changed) return null;
  pushText(s.slice(last));
  if (!dropped) return out;
  out.forEach((g, i) => {
    if (g.t === "text") g.v = cleanDrops(g.v, i === 0, i === out.length - 1);
  });
  return out.filter((g) => g.t !== "text" || g.v !== "");
};

const iconEl = (name: string, raw: string, key: string) =>
  createElement("img", {
    key,
    src: icon3dSrc(name),
    alt: "",
    "aria-hidden": true,
    draggable: false,
    decoding: "async",
    className: "emo3d",
    "data-emoji": raw,
  });

/**
 * 이어진 글자 덩어리(문자열·숫자) → 글자/아이콘. 바뀐 게 없으면 null.
 * 아이콘과 글자가 섞이면 <span class="emo3d-run"> 하나로 감싼다 — 부모가 flex(justify-between 등)여도
 * 예전처럼 '글자 한 덩어리'로 놓이게 (감싸지 않으면 아이콘과 글자가 따로 떨어진다).
 */
const runOf = (items: readonly unknown[], key: string): ReactNode | null => {
  const nodes: ReactNode[] = [];
  let changed = false;
  let k = 0;
  for (const it of items) {
    if (typeof it === "string" && HAS.test(it)) {
      const segs = split(it);
      if (segs) {
        changed = true;
        for (const g of segs) nodes.push(g.t === "text" ? g.v : iconEl(g.v, g.raw, `${key}-${k++}`));
        continue;
      }
    }
    nodes.push(it as ReactNode);
  }
  if (!changed) return null;
  if (nodes.length === 0) return "";
  if (nodes.length === 1) return nodes[0];
  return createElement("span", { key, className: "emo3d-run" }, ...nodes);
};

/** 글자 → 글자/아이콘 (바꿀 게 없으면 같은 글자를 그대로 돌려준다) — 토스트 등 */
export function renderEmoji3D(s: string): ReactNode {
  if (!s || !HAS.test(s)) return s;
  const r = runOf([s], "emo");
  return r === null ? s : r;
}

/** 이모지를 모두 지운 글자 (표에 없는 이모지도) — 속성 · 알림창 · 그림이 못 들어가는 자리용 */
export function stripEmoji(s: string): string {
  if (!s || !HAS.test(s)) return s;
  SEQ.lastIndex = 0;
  const marked = s.replace(SEQ, (raw) => {
    const key = raw.replace(MOD, "");
    return TEXT_SYMBOLS.has(key) ? key : DROP;
  });
  return cleanDrops(marked, true, true).replace(/\u0000/g, "");
}

/** 표에 없는 이모지만 지운다 (표에 있는 것은 화면에서 입체 아이콘이 된다) — AI 답변처럼 앱이 만든 글용 */
export function dropUnknownEmoji(s: string): string {
  if (!s || !HAS.test(s)) return s;
  SEQ.lastIndex = 0;
  let dropped = false;
  const marked = s.replace(SEQ, (raw) => {
    const d = decide(raw);
    if (d.icon) return raw;
    if (d.text !== undefined) return d.text;
    if (d.drop || !TEXT_SYMBOLS.has(raw.replace(MOD, ""))) {
      dropped = true;
      return DROP;
    }
    return raw;
  });
  return dropped ? cleanDrops(marked, true, true).replace(/\u0000/g, "") : marked;
}

/* ───────── JSX 런타임이 쓰는 변환 ───────── */

/** 그림이 들어갈 수 없는 요소 — 이모지를 지운다 */
const TEXT_ONLY = new Set(["option", "optgroup", "textarea", "title", "style", "script", "text", "tspan", "textPath", "desc"]);
/** 글자만 들어가는 속성 — 이모지를 지운다 */
const STRIP_ATTRS = ["title", "aria-label", "alt", "placeholder", "aria-description", "aria-valuetext"] as const;

const isText = (c: unknown): c is string | number => typeof c === "string" || typeof c === "number";

/** children 글자 고치기 — strip: 이모지 지우기(그림 못 넣는 곳) / 아니면 입체 아이콘. 바뀐 게 없으면 같은 값을 그대로 */
const mapChildren = (ch: unknown, strip: boolean): unknown => {
  if (typeof ch === "string") {
    if (!HAS.test(ch)) return ch;
    if (strip) return stripEmoji(ch);
    const r = runOf([ch], "emo");
    return r === null ? ch : r;
  }
  if (!Array.isArray(ch)) return ch;
  let out: unknown[] | null = null;
  let i = 0;
  while (i < ch.length) {
    const c = ch[i];
    if (Array.isArray(c)) {
      const r = mapChildren(c, strip);
      if (r !== c && !out) out = ch.slice(0, i);
      if (out) out.push(r);
      i++;
      continue;
    }
    if (!isText(c)) {
      if (out) out.push(c);
      i++;
      continue;
    }
    // 이어진 글자 덩어리 [i, j) — 화면에서는 원래 한 덩어리로 놓인다
    let j = i;
    let hit = false;
    while (j < ch.length && isText(ch[j])) {
      if (typeof ch[j] === "string" && HAS.test(ch[j] as string)) hit = true;
      j++;
    }
    const group = ch.slice(i, j);
    let replaced: unknown[] | null = null;
    if (hit) {
      if (strip) {
        const g2 = group.map((g) => (typeof g === "string" ? stripEmoji(g) : g));
        if (g2.some((g, n) => g !== group[n])) replaced = g2;
      } else {
        const r = runOf(group, `emo${i}`);
        if (r !== null) replaced = [r];
      }
    }
    if (replaced && !out) out = ch.slice(0, i);
    if (out) out.push(...(replaced ?? group));
    i = j;
  }
  return out ?? ch;
};

/** JSX 요소를 만들기 전에 props 의 글자를 고친다 — 바꿀 게 없으면 같은 props 를 그대로 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformProps(type: unknown, props: any): any {
  if (!props || typeof props !== "object") return props;
  const host = typeof type === "string";
  let out = props;
  const ch = props.children;
  if (typeof ch === "string" || Array.isArray(ch)) {
    const next = mapChildren(ch, host && TEXT_ONLY.has(type as string));
    if (next !== ch) out = { ...props, children: next };
  }
  if (host) {
    for (const a of STRIP_ATTRS) {
      const v = props[a];
      if (typeof v === "string" && HAS.test(v)) {
        const s = stripEmoji(v);
        if (s !== v) {
          if (out === props) out = { ...props };
          out[a] = s;
        }
      }
    }
  }
  return out;
}
