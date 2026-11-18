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

  it("153 PB 8종목 모두 그림 · 2번(원·투·쓰리 스텝)은 레벨 미션 「원·투·쓰리 스텝」 그림과 같다", () => {
    for (let n = 1; n <= 8; n++) expect(learnIllustOf([pbIllustKey(n)]), `PB ${n}`).not.toBeNull();
    expect(learnIllustOf([pbIllustKey(2)])).toBe(learnIllustOf(["5cbfdc5c-299b-4ec8-b3ea-bc9df819f45d"]));
  });

  it("같은 동작(같은 영상 · 실사 · 애니)은 같은 그림", () => {
    const same = (ids: string[]) => {
      const first = learnIllustOf([ids[0]]);
      expect(first, ids[0]).not.toBeNull();
      for (const id of ids) expect(learnIllustOf([id]), id).toBe(first);
    };
    // L1 백스텝 잽 · L7 잽 · 백스텝 · 잽
    same(["7592a1ce-b90b-462f-a247-7ad9a7c7bc60", "2a5bd8e1-0446-4517-9d60-83de94244210"]);
    // 사이드 잽 · 방향 전환 네 칸
    same([
      "66b9474a-59c7-4233-bb80-1242a091a4cc",
      "a7bdf0f2-4924-4df3-a782-b19125397d50",
      "f05615e2-47bb-41d4-b94a-654189309a40",
      "fd810419-872f-471f-b210-55282ac5395c",
    ]);
    // 블루 콤보 드릴 실사 · 애니 여성 · 애니 소년 = 카드 「원투 · 훅 · 더킹」
    same([
      "b1d7c0a2-3f4e-4c5b-9a6d-7e8f90a1b2c3",
      "c2e8d1b3-4a5f-4d6c-8b7e-8f9a01b2c3d4",
      "d3f9e2c4-5b6a-4e7d-9c8f-9a0b12c3d4e5",
    ]);
    expect(learnIllustOf(["b1d7c0a2-3f4e-4c5b-9a6d-7e8f90a1b2c3"])).toBe(
      "/assets/learn-illust/1530c4d0-0012-4a00-8000-000000001116.webp",
    );
    // 스텝 원투쓰리 · 걷는 스텝 원투쓰리 · 걷는 원투쓰리 = 카드 「원투 · 훅 콤비네이션」
    same([
      "c745e1af-6af4-4648-a1f9-ba1dbc5b81f6",
      "74b8e937-e94f-47eb-97f3-31094b4bdb36",
      "4b7ce5a4-bcee-4d9c-903e-8325b664017e",
    ]);
  });
});
