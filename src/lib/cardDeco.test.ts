import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readFileSync } from "node:fs";
import { DECO_ITEMS, REVIEW_GIFTS, giftLine, isUnlocked, normalizeDeco, resolveDeco } from "./cardDeco";
import { isWeakDevice } from "./tvLite";
import { parseMyReviewMissions, remainingMileage, statusText } from "@/services/reviewMissionService";

describe("카드 꾸미기 (2026-11-21)", () => {
  it("이름이 겹치지 않고 · 칸 앞머리가 맞다(서버 _card_deco_ok 와 같은 규칙)", () => {
    const ids = DECO_ITEMS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DECO_ITEMS) {
      expect(d.id).toMatch(/^[a-z0-9_]{2,40}$/);
      expect(d.id.startsWith(`${d.slot}_`) || d.id.startsWith(`free_${d.slot}_`)).toBe(true);
      expect(d.id.startsWith("free_")).toBe(d.source === "free");
    }
  });

  it("리뷰 선물 = 서버 _review_gifts 와 같은 이름 · 모두 있는 꾸미기", () => {
    // 정본 = 마지막으로 _review_gifts 를 고친 파일(구글은 보상 없이 부탁만 — 선물 없음)
    const sql = readFileSync("supabase/migrations/20261121020741_review_google_ask_only.sql", "utf8");
    expect(REVIEW_GIFTS.google).toEqual([]);
    expect(sql).not.toMatch(/when 'google'\s+then/);
    for (const [k, ids] of Object.entries(REVIEW_GIFTS)) {
      if (k === "google") continue;
      const m = sql.match(new RegExp(`when '${k}'\\s+then array\\[([^\\]]+)\\]`));
      expect(m, k).not.toBeNull();
      const serverIds = m![1].split(",").map((x) => x.trim().replace(/'/g, ""));
      expect(serverIds).toEqual([...ids]);
      for (const id of ids) expect(DECO_ITEMS.some((d) => d.id === id)).toBe(true);
    }
  });

  it("모르는 이름 · 칸이 틀린 이름은 버리고, 낀 게 없으면 null", () => {
    expect(normalizeDeco({ frame: "skin_emerald", skin: "nope" })).toBeNull();
    expect(normalizeDeco({ skin: "skin_emerald", sticker: "sticker_bolt" })).toEqual({ frame: null, skin: "skin_emerald", sticker: "sticker_bolt", title: null });
    expect(resolveDeco({ title: "title_supporter" })?.title?.text).toBe("153 서포터");
  });

  it("기본은 누구나 · 선물은 받은 사람만", () => {
    expect(isUnlocked("free_skin_carbon", new Set())).toBe(true);
    expect(isUnlocked("skin_emerald", new Set())).toBe(false);
    expect(isUnlocked("skin_emerald", new Set(["skin_emerald"]))).toBe(true);
    expect(giftLine(REVIEW_GIFTS.naver)).toBe("에메랄드 바탕 · 번개 스티커");
  });

  it("화면 글에 이모지 · 긴 줄표 · '원' 없음", () => {
    for (const d of DECO_ITEMS) {
      expect(d.name).not.toMatch(/[\u{1F300}-\u{1FAFF}—]/u);
      if (d.text) expect(d.text).not.toMatch(/[\u{1F300}-\u{1FAFF}—]/u);
    }
  });
});

describe("리뷰 미션 서버 값 읽기", () => {
  it("모르는 플랫폼 · 주소 없는 줄은 버리고 남은 마일리지를 센다", () => {
    const d = parseMyReviewMissions({
      on: true,
      missions: [
        { platform: "naver", url: "https://a", mileage: 3000, gifts: ["skin_emerald"], status: "approved" },
        { platform: "google", url: "https://b", mileage: 3000, gifts: [], status: "rejected", reject_reason: "안 보여요" },
        { platform: "kakao", url: "https://c", mileage: 9000 },
        { platform: "daangn", mileage: 3000 },
      ],
      all_gifts: ["frame_supporter"],
      done: 1,
      total: 2,
    });
    expect(d.missions.map((m) => m.platform)).toEqual(["naver", "google"]);
    expect(remainingMileage(d)).toBe(3000);
    expect(statusText(d.missions[1])).toBe("다시 올려 주세요 · 안 보여요");
    expect(parseMyReviewMissions(null).on).toBe(false);
  });
});

describe("TV 가볍게 — 자동", () => {
  it("TV 브라우저 · 코어 4개 이하 · 메모리 3GB 이하면 가볍게", () => {
    expect(isWeakDevice({ userAgent: "Mozilla/5.0 (Web0S; Linux/SmartTV)", hardwareConcurrency: 8 })).toBe(true);
    expect(isWeakDevice({ userAgent: "Mozilla/5.0 (Linux; Android 11)", hardwareConcurrency: 4 })).toBe(true);
    expect(isWeakDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(isWeakDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", hardwareConcurrency: 12, deviceMemory: 8 })).toBe(false);
  });
});
