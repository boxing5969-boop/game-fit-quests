// 🎙 카드 설명 듣기 — 자연스러운 목소리 파일 (2026-11-16 대표님 「자연스러운 더빙 기본값 · 설명 듣기 자동」)
//   카드 글(cardSpeech — 이름 · 한 줄 · 포인트, '153'은 '일오삼')을 드라이브 동작 영상과 같은 목소리(인준)로 미리 읽어
//   public/voice/cards/<카드 id>-<글 지문>.mp3 에 둔다. 지문 = 읽은 글 그대로의 해시라
//   대표님이 카드 글을 고치면 지문이 달라져 파일을 안 쓰고 휴대폰 목소리로 읽는다(틀린 설명이 나가지 않게).
//   다시 만들기: bun scripts/card-voices.ts <카드 JSON> → python3 scripts/make-card-voices.py (CLAUDE.md 「영상으로 배우기 — 소리」)
import { cardSpeech, type TrainingCard } from "@/lib/trainingCards";
import { CARD_VOICES } from "@/data/cardVoices";

/** 목소리로 읽을 글 한 덩어리 — 줄마다 문장 끝(.)을 붙여 쉬는 자리를 만든다 */
export function voiceText(card: Pick<TrainingCard, "name" | "summary" | "cues">): string {
  return cardSpeech(card)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`))
    .join(" ");
}

/** 글 지문 — FNV-1a 32비트 · 16진 8자리 (만드는 스크립트와 앱이 같은 함수를 쓴다) */
export function voiceHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const cardVoicePath = (cardId: string, hash: string): string => `/voice/cards/${cardId}-${hash}.mp3`;

/** 이 카드의 지금 글과 맞는 목소리 파일 주소 — 없거나 글이 바뀌었으면 null(휴대폰 목소리로) */
export function cardVoiceUrl(
  card: Pick<TrainingCard, "id" | "name" | "summary" | "cues">,
  voices: Readonly<Record<string, string>> = CARD_VOICES,
): string | null {
  const have = voices[card.id];
  if (!have) return null;
  const text = voiceText(card);
  if (!text) return null;
  return voiceHash(text) === have ? cardVoicePath(card.id, have) : null;
}
