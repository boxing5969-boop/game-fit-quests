/**
 * 메시지(DM) 글자 도우미.
 *   · isEmojiOnly — 이모지만 1~3개 보낸 메시지는 말풍선 없이 크게 보여 준다 (인스타그램처럼)
 */

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
