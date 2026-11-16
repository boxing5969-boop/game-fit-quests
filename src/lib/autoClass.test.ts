import { describe, expect, it } from "vitest";
import {
  AUTO_GOALS,
  autoClass,
  lessonClassName,
  lessonToClassItems,
  matchCardByName,
  parseLessonAmount,
  type AutoCandidate,
} from "@/lib/autoClass";
import { classMinutes, validateItems } from "@/lib/myClass";
import type { Shelf } from "@/lib/trainingCards";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 0;
const cand = (shelf: Shelf, level: number, video = true, kind: "c" | "m" = "c"): AutoCandidate => {
  seq += 1;
  return { key: `${kind}:${uuid(seq)}`, name: `${shelf}-${seq}`, shelf, level, video };
};

/** 칸마다 3장씩 — 화이트(1~10) 회원이 볼 만한 모양 */
const fullPool = (): AutoCandidate[] => {
  const shelves: Shelf[] = ["warmup", "basics", "step", "skill", "defense", "drill", "fitness", "cooldown"];
  return shelves.flatMap((s) => [cand(s, 1), cand(s, 3), cand(s, 6, false)]);
};

describe("자동 짜기", () => {
  it("15 · 30 · 50분 — 합계가 그 시간 · 서버 검사를 통과하는 모양", () => {
    const pool = fullPool();
    for (const minutes of [15, 30, 50] as const) {
      for (const g of AUTO_GOALS) {
        const r = autoClass(pool, { minutes, goal: g.id, myLevel: 5 });
        expect(r).not.toBeNull();
        expect(r!.minutes).toBe(minutes);
        expect(classMinutes(r!.items)).toBe(minutes);
        expect(validateItems(r!.items)).toBeNull();
        expect(new Set(r!.items.map((x) => x.k)).size).toBe(r!.items.length);
        expect(r!.items.length).toBeLessThanOrEqual(12);
        expect(r!.name).toBe(`${minutes}분 ${g.label}`);
      }
    }
  });

  it("목표 칸에서 메인을 고르고 · 처음은 워밍업 · 끝은 쿨다운", () => {
    const pool = fullPool();
    const byKey = new Map(pool.map((c) => [c.key, c]));
    const r = autoClass(pool, { minutes: 30, goal: "defense", myLevel: 5 })!;
    const shelves = r.items.map((x) => byKey.get(x.k)!.shelf);
    expect(shelves[0]).toBe("warmup");
    expect(shelves[shelves.length - 1]).toBe("cooldown");
    expect(shelves.slice(1, 4).every((s) => s === "defense")).toBe(true);
  });

  it("영상이 있는 동작 · 내 레벨까지 먼저", () => {
    const low = cand("skill", 2, true);
    const above = cand("skill", 9, true);
    const noVideo = cand("skill", 3, false);
    const pool = [cand("warmup", 1), low, above, noVideo, cand("cooldown", 1)];
    const r = autoClass(pool, { minutes: 15, goal: "skill", myLevel: 4 })!;
    const keys = r.items.map((x) => x.k);
    expect(keys[1]).toBe(low.key); // 첫 메인 = 영상 있고 내 레벨 안
    expect(keys).toContain(above.key); // 둘째 메인 = 영상 있는 위 레벨이 영상 없는 카드보다 먼저
    expect(keys).not.toContain(noVideo.key);
  });

  it("같은 씨앗 = 같은 수업 · 다른 씨앗 = 다른 카드(고를 카드가 넉넉하면)", () => {
    const pool = [...fullPool(), ...Array.from({ length: 8 }, () => cand("basics", 2))];
    const a = autoClass(pool, { minutes: 30, goal: "basics", myLevel: 5, seed: 1 })!;
    const b = autoClass(pool, { minutes: 30, goal: "basics", myLevel: 5, seed: 1 })!;
    expect(a.items).toEqual(b.items);
    const seen = new Set<string>();
    for (let s = 0; s < 6; s++) seen.add(autoClass(pool, { minutes: 30, goal: "basics", myLevel: 5, seed: s })!.items.map((x) => x.k).join(","));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("빈 칸은 건너뛰고 그 분을 메인에 더해 시간을 지킨다", () => {
    const pool = [cand("basics", 1), cand("basics", 2), cand("step", 1), cand("step", 2)];
    const r = autoClass(pool, { minutes: 30, goal: "basics", myLevel: 3 })!;
    expect(r.items.length).toBe(4);
    expect(r.minutes).toBe(30);
    expect(r.items.every((x) => x.n <= 30)).toBe(true);
  });

  it("동작이 2개 안 되면 만들지 않는다", () => {
    expect(autoClass([cand("skill", 1)], { minutes: 15, goal: "skill", myLevel: 1 })).toBeNull();
    expect(autoClass([], { minutes: 50, goal: "fitness", myLevel: 1 })).toBeNull();
  });

  it("50분 드릴 자리는 라운드(3분 운동 + 30초 쉬기)", () => {
    const r = autoClass(fullPool(), { minutes: 50, goal: "basics", myLevel: 5 })!;
    expect(r.items.some((x) => x.u === "r" && x.n === 2)).toBe(true);
  });
});

describe("오늘 수업 담기 — 153 수업 매뉴얼", () => {
  it("분량 읽기 — 대표님 표현 그대로", () => {
    expect(parseLessonAmount("2분 × 3라운드")).toEqual({ u: "r", n: 3 });
    expect(parseLessonAmount("보통 2라운드 (최대 3라운드)")).toEqual({ u: "r", n: 2 });
    expect(parseLessonAmount("1라운드 정도")).toEqual({ u: "r", n: 1 });
    expect(parseLessonAmount("3~5라운드 정도")).toEqual({ u: "r", n: 3 });
    expect(parseLessonAmount("4라운드")).toEqual({ u: "r", n: 4 });
    expect(parseLessonAmount("20개 × 3세트")).toEqual({ u: "m", n: 6 });
    expect(parseLessonAmount("5분")).toEqual({ u: "m", n: 5 });
    expect(parseLessonAmount("")).toEqual({ u: "m", n: 5 });
    expect(parseLessonAmount("20라운드")).toEqual({ u: "r", n: 12 });
  });

  it("카드 이름 맞추기 — 같은 이름 · 한쪽이 다른 쪽을 다 품을 때만", () => {
    const cards = [
      { key: "c:a", name: "제자리 스텝" },
      { key: "c:b", name: "샌드백 구령 「어이」 · 「대시」" },
      { key: "c:c", name: "줄넘기 기본" },
      { key: "c:d", name: "원투 → 리드 피벗" },
    ];
    expect(matchCardByName("제자리 스텝", cards)).toBe("c:a");
    expect(matchCardByName("샌드백", cards)).toBe("c:b");
    expect(matchCardByName("워밍업 · 줄넘기", cards)).toBeNull();
    expect(matchCardByName("기초 근력", cards)).toBeNull();
    expect(matchCardByName("원", cards)).toBeNull();
  });

  it("영상 미션은 그 영상 + 라운드 · 카드는 이름으로 · 없으면 건너뜀 · 메모 = 동작 이름", () => {
    const vid = uuid(901);
    const steps = [
      { name: "워밍업 · 줄넘기", amount: "2분 × 3라운드", videoMissionId: vid.toUpperCase() },
      { name: "제자리 스텝", amount: "보통 2라운드 (최대 3라운드)", videoMissionId: null },
      { name: "기초 근력", amount: "20개 × 3세트", videoMissionId: null },
      { name: "깨진 영상", amount: "1라운드", videoMissionId: "not-a-uuid" },
    ];
    const find = (n: string) => (n === "제자리 스텝" ? `c:${uuid(902)}` : null);
    const { items, skipped } = lessonToClassItems(steps, find);
    expect(items).toEqual([
      { k: `m:${vid}`, u: "r", n: 3, note: "워밍업 · 줄넘기" },
      { k: `c:${uuid(902)}`, u: "r", n: 2, note: "제자리 스텝" },
    ]);
    expect(skipped).toEqual(["기초 근력", "깨진 영상"]);
    expect(validateItems(items)).toBeNull();
  });

  it("12장까지만 담는다", () => {
    const steps = Array.from({ length: 15 }, (_, i) => ({ name: `동작 ${i}`, amount: "1라운드", videoMissionId: uuid(800 + i) }));
    const { items, skipped } = lessonToClassItems(steps, () => null);
    expect(items.length).toBe(12);
    expect(skipped.length).toBe(3);
  });

  it("이름 — 153 수업 n일차", () => {
    expect(lessonClassName(4)).toBe("153 수업 4일차");
  });
});
