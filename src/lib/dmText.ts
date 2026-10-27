/**
 * 메시지(DM) 글자 도우미.
 *   · isEmojiOnly — 이모지만 1~3개 보낸 메시지는 말풍선 없이 크게 보여 준다 (인스타그램처럼)
 *   · splitDmLinks — 153 선물·체험권 주소(153-boxing-os.pages.dev)만 눌러서 열리게 나눈다.
 *     다른 주소는 지금처럼 누를 수 없는 글자 — 회원끼리 낯선 링크로 낚이지 않게(피싱 방지).
 *     (2026-10-27 대표님: VIP 선물을 마이복서153 메시지로 보낼 때 "고쳐서 배포")
 */

/** 눌러서 열 수 있는 주소 — 153 선물·체험권 페이지만. 경로에는 주소에 쓰는 기본 글자만(한글·괄호·따옴표에서 끊는다) */
const DM_LINK_RE = /https:\/\/153-boxing-os\.pages\.dev\/[A-Za-z0-9\-._~/?#=&%+]*/g;

export type DmTextPart = { text: string; href?: string };

/** 글을 [글자, 주소, 글자 …] 로 나눈다. 주소 끝의 마침표·쉼표는 주소에서 뺀다 */
export const splitDmLinks = (body: string): DmTextPart[] => {
  const parts: DmTextPart[] = [];
  let last = 0;
  for (const m of body.matchAll(DM_LINK_RE)) {
    const start = m.index ?? 0;
    const url = m[0].replace(/[.,]+$/, "");
    if (start > last) parts.push({ text: body.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts.length ? parts : [{ text: body }];
};

// 그림 이모지·피부색·국기·키캡(1️⃣ — 숫자 혼자는 안 된다)·결합 문자(ZWJ)·변형 선택자만으로 된 글
const EMOJI_ONLY_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|[#*0-9]\ufe0f?\u20e3|\s)+$/u;
const HAS_PICTO_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;

type SegmenterCtor = new (locale: string, opts: { granularity: "grapheme" }) => { segment(s: string): Iterable<unknown> };
const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;

/** 글자 묶음(자모·이모지 한 덩어리) 수 — 오래된 기기는 코드포인트 수로 대신 센다 */
const graphemeCount = (s: string): number => {
  if (Segmenter) {
    let n = 0;
    for (const _ of new Segmenter("ko", { granularity: "grapheme" }).segment(s)) n += 1;
    return n;
  }
  return Array.from(s).length;
};

export const isEmojiOnly = (body: string): boolean => {
  const t = body.replace(/\s+/g, "");
  if (!t || t.length > 40) return false;
  if (!EMOJI_ONLY_RE.test(t) || !HAS_PICTO_RE.test(t)) return false;
  return graphemeCount(t) <= 3;
};
