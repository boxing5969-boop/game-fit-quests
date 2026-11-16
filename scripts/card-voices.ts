// 카드 설명 목소리 — 읽을 글 계획 (2026-11-16 · lib/cardVoice.ts)
//   bun scripts/card-voices.ts <카드 JSON> [<카드 JSON> …] > plan.json
//   카드 JSON = training_exercises 줄 배열(id · name · summary · cues · is_active) — REST 로 받거나 예시 카드에서.
//   나오는 것: [{ id, hash, text }] — 앱이 읽는 글(voiceText)과 지문(voiceHash)이 같다.
//   그다음: python3 scripts/make-card-voices.py plan.json  → public/voice/cards/*.mp3 + src/data/cardVoices.ts
import { readFileSync } from "node:fs";
import { voiceHash, voiceText } from "../src/lib/cardVoice";
import { normalizeCard } from "../src/lib/trainingCards";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("쓰는 법: bun scripts/card-voices.ts <카드 JSON> …");
  process.exit(2);
}
const seen = new Set<string>();
const out: { id: string; hash: string; text: string }[] = [];
for (const f of files) {
  const rows = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>[];
  for (const raw of rows) {
    const card = normalizeCard(raw);
    if (!card.id || seen.has(card.id) || card.is_active === false) continue;
    const text = voiceText(card);
    if (!text) continue;
    seen.add(card.id);
    out.push({ id: card.id, hash: voiceHash(text), text });
  }
}
process.stdout.write(JSON.stringify(out, null, 1));
