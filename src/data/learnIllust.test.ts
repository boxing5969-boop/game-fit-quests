import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEARN_ILLUST, learnIllustOf, pbIllustKey } from "@/data/learnIllust";
import { pbExtraId } from "@/lib/learnExtras";

// 레벨 미션 · 153 PB 영상의 2컷 동작 그림 지도 (2026-11-18)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("동작 그림 지도 — 미션 · 153 PB → 그림", () => {
  it("열쇠는 소문자 uuid, 그림은 앱과 함께 배포되는 learn-illust 폴더의 webp", () => {
    const entries = Object.entries(LEARN_ILLUST);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, src] of entries) {
      expect(key).toMatch(UUID);
      expect(src).toMatch(/^\/assets\/learn-illust\/[a-z0-9-]+\.webp$/);
      expect(existsSync(resolve(process.cwd(), "public", src.slice(1))), src).toBe(true);
    }
  });

  it("처음 맞는 id 의 그림 · 대소문자 · 빈칸 정리 · 없으면 null", () => {
    const [key, src] = Object.entries(LEARN_ILLUST)[0];
    expect(learnIllustOf([key])).toBe(src);
    expect(learnIllustOf([null, "nope", ` ${key.toUpperCase()} `])).toBe(src);
    expect(learnIllustOf(["00000000-0000-4000-8000-000000000000"])).toBeNull();
    expect(learnIllustOf([])).toBeNull();
    expect(learnIllustOf([undefined, ""])).toBeNull();
  });

  it("153 PB 열쇠 = 영상으로 배우기의 153 PB 타일 id", () => {
    for (let n = 1; n <= 8; n++) expect(pbIllustKey(n)).toBe(pbExtraId(n));
  });
});
