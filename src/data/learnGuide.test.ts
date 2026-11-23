import { describe, expect, it } from "vitest";
import { LEARN_GUIDE, learnGuideOf, type LearnGuide } from "@/data/learnGuide";
import { LEARN_ILLUST } from "@/data/learnIllust";
import { CARD_VOICES } from "@/data/cardVoices";
import { pbExtraId } from "@/lib/learnExtras";
import { videoWip } from "@/lib/trainingCards";

// 영상으로 배우기 — 효과 · 가치 · 언제 · 얼마나 (2026-11-23 대표님)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS: ReadonlyArray<keyof LearnGuide> = ["effect", "value", "when", "amount"];

describe("동작 안내 — 효과 · 가치 · 언제 · 얼마나", () => {
  it("열쇠는 소문자 uuid · 네 칸 모두 글이 있다", () => {
    const entries = Object.entries(LEARN_GUIDE);
    expect(entries.length).toBeGreaterThan(150);
    for (const [key, g] of entries) {
      expect(key).toMatch(UUID);
      for (const f of FIELDS) expect(g[f].trim().length, `${key} ${f}`).toBeGreaterThan(1);
    }
  });

  it("운영 카드(설명 목소리 목록 = 2026-11-23 카드 118장)마다 안내가 있다", () => {
    const missing = Object.keys(CARD_VOICES).filter((id) => !LEARN_GUIDE[id]);
    expect(missing).toEqual([]);
  });

  it("그림이 있는 레벨 미션 영상 · 153 PB 8종목마다 안내가 있다", () => {
    const missing = Object.keys(LEARN_ILLUST).filter((id) => !LEARN_GUIDE[id]);
    expect(missing).toEqual([]);
    for (let n = 1; n <= 8; n++) expect(learnGuideOf([pbExtraId(n)])).not.toBeNull();
  });

  it("휴대폰에서 읽기 좋은 길이 · 한글 AI 티(줄표 · 보이지 않는 문자 · 상투어) 없음 · 회원 글 금지어 없음", () => {
    const banned = /[—–​‌⁠﻿]|국가대표|결론적으로|시사하는|완벽한|놀라운|강력 추천|꿀팁/;
    // 연결어미 뒤 쉼표(「배우고, 」「하면서, 」) — im-not-ai C-11
    const commaAfterEnding = /(고|며|면서|지만|는데|어서|아서|해서), /;
    for (const [key, g] of Object.entries(LEARN_GUIDE)) {
      for (const f of FIELDS) {
        const t = g[f];
        expect(t.length, `${key} ${f}: ${t}`).toBeLessThanOrEqual(f === "effect" || f === "value" ? 60 : 48);
        expect(banned.test(t), `${key} ${f}: ${t}`).toBe(false);
        expect(commaAfterEnding.test(t), `${key} ${f}: ${t}`).toBe(false);
      }
      // 효과 · 가치는 해요체 문장
      expect(g.effect.endsWith("요."), `${key} effect`).toBe(true);
      expect(g.value.endsWith("요."), `${key} value`).toBe(true);
    }
  });

  it("처음 맞는 id · 대소문자 · 빈칸 정리 · 없으면 null", () => {
    const [key, g] = Object.entries(LEARN_GUIDE)[0];
    expect(learnGuideOf([key])).toBe(g);
    expect(learnGuideOf([null, "nope", ` ${key.toUpperCase()} `])).toBe(g);
    expect(learnGuideOf(["00000000-0000-4000-8000-000000000000"])).toBeNull();
    expect(learnGuideOf([])).toBeNull();
  });
});

describe("영상 작업중 — 회원용 영상이 없는 카드", () => {
  it("회원용 영상(저장소 · 주소)이 있으면 아님 · 없으면 영상 작업중 · 준비 칸(붕대 감기)은 뺀다", () => {
    expect(videoWip({ video_path: "member/a.mp4", video_url: null, category: "기본기" })).toBe(false);
    expect(videoWip({ video_path: null, video_url: "https://youtu.be/x", category: "기본기" })).toBe(false);
    expect(videoWip({ video_path: null, video_url: "  ", category: "방어" })).toBe(true);
    expect(videoWip({ video_path: null, video_url: null, category: "준비" })).toBe(false);
  });
});
