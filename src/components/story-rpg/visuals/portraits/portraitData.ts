/**
 * 153 스토리 RPG — 캐릭터 포트레이트 데이터 (Stage 47A).
 *
 * 8 캐릭터 (오삼이 + 6 NPC + 플레이어) × 3 감정.
 * 모든 외형 묘사는 마이복서153 자체 IP — 외부 캐릭터 일절 차용 X.
 */

export type PortraitKey =
  | "osam"
  | "gwan"
  | "park_senior"
  | "minji"
  | "dohun"
  | "kim_coach"
  | "han_champion"
  | "player";

export type PortraitEmotion =
  | "default"
  | "happy"
  | "serious"
  | "concerned"
  | "smug"
  | "warm"
  | "focused"
  | "hurt"
  | "angry";

export interface PortraitPalette {
  skin: string;
  hair: string;
  outfit: string;
  accent: string;
  bg: string;
}

export const PORTRAIT_PALETTE: Record<PortraitKey, PortraitPalette> = {
  osam: { skin: "#f5d2c0", hair: "#e63946", outfit: "#c41e3a", accent: "#fef3c7", bg: "#fdb85c" },
  gwan: { skin: "#e3c3a4", hair: "#a8a29e", outfit: "#1f2937", accent: "#b87900", bg: "#3f3a36" },
  park_senior: { skin: "#f1d2b8", hair: "#312e2b", outfit: "#0f766e", accent: "#fdb85c", bg: "#1f2a37" },
  minji: { skin: "#fbe2cb", hair: "#3f2c1d", outfit: "#ec4899", accent: "#fce7f3", bg: "#3a2a3a" },
  dohun: { skin: "#dfb897", hair: "#0a0a0a", outfit: "#7f1d1d", accent: "#a40e1a", bg: "#1a0a0a" },
  kim_coach: { skin: "#e7c8ad", hair: "#4a4036", outfit: "#374151", accent: "#fdb85c", bg: "#2a2f3a" },
  han_champion: { skin: "#cca27a", hair: "#0a0a0a", outfit: "#a40e1a", accent: "#fdb85c", bg: "#0d0510" },
  player: { skin: "#f0d2b6", hair: "#2a1f17", outfit: "#b87900", accent: "#fdb85c", bg: "#1a1f4d" },
};

// 한글 speaker 이름 → portrait 키 매핑.
// Stage 44 시나리오의 모든 speaker 를 커버.
export const SPEAKER_TO_PORTRAIT: Record<string, PortraitKey> = {
  오삼이: "osam",
  "강 관장": "gwan",
  "박 선배": "park_senior",
  민지: "minji",
  도훈: "dohun",
  "김 코치": "kim_coach",
  "한 챔피언": "han_champion",
  나: "player",
  플레이어: "player",
  self: "player",
};

export const SPEAKER_DEFAULT_EMOTION: Record<PortraitKey, PortraitEmotion> = {
  osam: "happy",
  gwan: "serious",
  park_senior: "happy",
  minji: "happy",
  dohun: "smug",
  kim_coach: "warm",
  han_champion: "serious",
  player: "default",
};

export function resolvePortrait(speaker: string | null | undefined): PortraitKey {
  if (!speaker) return "osam";
  return SPEAKER_TO_PORTRAIT[speaker] ?? "osam";
}
