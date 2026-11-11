import { describe, expect, it } from "vitest";
import { BOOK1_SAMPLE } from "./book1Sample";
import {
  bookProgress,
  canNudge,
  chapterState,
  latestRead,
  manualDate,
  nextChapter,
  personSummary,
  quizAllCorrect,
  readerPages,
} from "./progress";
import type { ManualBook, ManualRead } from "./types";

const read = (chapter: string, version = 1, signed_at = "2026-11-11T03:00:00Z"): ManualRead => ({
  chapter,
  version,
  quiz_tries: 3,
  signed_at,
});

const MINI: ManualBook = {
  id: "t",
  no: "1권",
  title: "시험",
  tagline: null,
  cover: "cover",
  guide: [],
  signature: null,
  source: "",
  chapters: [
    { id: "a", no: "앞글", title: "A", gain: null, minutes: 2, image: null, version: 1, required: true, cards: [], today: null, quiz: [] },
    { id: "b", no: "1장", title: "B", gain: null, minutes: 3, image: null, version: 2, required: true, cards: [{ title: "장면", blocks: [] }], today: "하나", quiz: [{ q: "?", options: ["O", "X"], answer: 0, why: "" }] },
    { id: "c", no: "2장", title: "C", gain: null, minutes: 3, image: null, version: 1, required: true, cards: [], today: null, quiz: [] },
    { id: "z", no: "부록", title: "Z", gain: null, minutes: 0, image: null, version: 1, required: false, cards: [], today: null, quiz: [] },
  ],
};

describe("153 매뉴얼 — 장 상태", () => {
  it("첫 필독 장은 열리고, 앞 장을 서명해야 다음 장이 열린다", () => {
    expect(chapterState(MINI, [], "a")).toBe("open");
    expect(chapterState(MINI, [], "b")).toBe("locked");
    expect(chapterState(MINI, [read("a")], "b")).toBe("open");
    expect(chapterState(MINI, [read("a")], "c")).toBe("locked");
  });

  it("옛 판에만 서명했으면 '다시 서명' — 그래도 뒤 장은 잠기지 않는다", () => {
    const reads = [read("a"), read("b", 1)];
    expect(chapterState(MINI, reads, "b")).toBe("resign");
    expect(chapterState(MINI, reads, "c")).toBe("open");
    expect(chapterState(MINI, [read("a"), read("b", 2)], "b")).toBe("signed");
  });

  it("부록은 늘 열리고, 대표님 · 지점장님은 잠기지 않는다", () => {
    expect(chapterState(MINI, [], "z")).toBe("open");
    expect(chapterState(MINI, [], "c", { reviewer: true })).toBe("open");
    expect(chapterState(MINI, [], "없는장")).toBe("locked");
  });

  it("가장 높은 판의 서명을 고른다", () => {
    expect(latestRead([read("b", 1), read("b", 2), read("a")], "b")?.version).toBe(2);
    expect(latestRead([read("a")], "b")).toBeNull();
  });
});

describe("153 매뉴얼 — 진도 · 현황", () => {
  it("필독 장만 센다 · 다음 장 = 지금 판 서명이 없는 첫 장", () => {
    const p = bookProgress(MINI, [read("a"), read("b", 1, "2026-11-12T01:00:00Z")]);
    expect(p).toMatchObject({ done: 1, total: 3, resign: 1 });
    expect(p.next?.id).toBe("b");
    expect(p.lastSignedAt).toBe("2026-11-12T01:00:00Z");
    expect(bookProgress(MINI, [read("a"), read("b", 2), read("c")]).next).toBeNull();
  });

  it("현황 점 줄 — 필독 장마다 signed · resign · none", () => {
    const s = personSummary(MINI, [read("a"), read("b", 1)]);
    expect(s.marks.map((m) => m.state)).toEqual(["signed", "resign", "none"]);
  });

  it("'읽어 주세요'는 20시간에 한 번", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(canNudge(null, now)).toBe(true);
    expect(canNudge("2026-11-11T00:00:00Z", now)).toBe(false);
    expect(canNudge("2026-11-10T15:00:00Z", now)).toBe(true);
  });

  it("날짜는 한국 시각", () => {
    expect(manualDate("2026-11-10T16:00:00Z")).toBe("11월 11일");
    expect(manualDate(null)).toBe("");
  });
});

describe("153 매뉴얼 — 읽기 쪽 · 확인 문제", () => {
  it("표지 → 카드 → 오늘 한 가지 → 문제 → 서명", () => {
    expect(readerPages(MINI.chapters[1]).map((p) => p.kind)).toEqual(["cover", "card", "today", "quiz", "sign"]);
    expect(readerPages(MINI.chapters[3]).map((p) => p.kind)).toEqual(["cover", "end"]);
  });

  it("문제를 모두 맞혀야 서명", () => {
    const quiz = MINI.chapters[1].quiz;
    expect(quizAllCorrect(quiz, [0])).toBe(true);
    expect(quizAllCorrect(quiz, [1])).toBe(false);
    expect(quizAllCorrect(quiz, [null])).toBe(false);
  });

  it("다음 장은 책 순서", () => {
    expect(nextChapter(MINI, "a")?.id).toBe("b");
    expect(nextChapter(MINI, "z")).toBeNull();
  });
});

describe("1권 앱 안 예시 (프롤로그~9장 — 책 전체는 DB)", () => {
  it("장 id 는 겹치지 않고 서버 규칙(소문자 · 숫자 · _ 24자)에 맞다", () => {
    const ids = BOOK1_SAMPLE.chapters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]{1,24}$/);
    expect(BOOK1_SAMPLE.id).toBe("book1");
    expect(ids).toEqual(["prologue", "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9"]);
  });

  it("대표님 이야기 · 지점 운영 숫자가 든 장(앞글 2편 · 부록)은 코드에 없다 (11/11 대표님 「DB에만 두기」)", () => {
    const text = JSON.stringify(BOOK1_SAMPLE);
    for (const id of ["author", "solution", "appendix"]) expect(BOOK1_SAMPLE.chapters.some((c) => c.id === id)).toBe(false);
    expect(text).not.toMatch(/(297|210|206|217)\s?명/);
    expect(text).not.toMatch(/(문화점|용산점|칠금점)/);
  });

  it("모두 필독 · 확인 문제 3개 · 정답 자리가 보기 안에 있다", () => {
    expect(BOOK1_SAMPLE.chapters.filter((c) => c.required)).toHaveLength(10);
    for (const c of BOOK1_SAMPLE.chapters) {
      expect(c.version).toBeGreaterThanOrEqual(1);
      expect(c.cards.length).toBeGreaterThan(0);
      expect(c.quiz).toHaveLength(3);
      expect(c.today).toBeTruthy();
      for (const q of c.quiz) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.why.length).toBeGreaterThan(0);
      }
    }
  });

  it("정답이 늘 첫 자리에 있지 않다 (O/X 빼고)", () => {
    const mc = BOOK1_SAMPLE.chapters.flatMap((c) => c.quiz).filter((q) => q.options.length > 2);
    expect(new Set(mc.map((q) => q.answer)).size).toBeGreaterThan(1);
  });

  it("선릉역점이 약하다는 표현이 없다 (11/09 대표님)", () => {
    const text = JSON.stringify(BOOK1_SAMPLE);
    expect(text).not.toMatch(/선릉[^"]{0,20}(약점|약한|가장 약)/);
    expect(text).not.toMatch(/130명 중 111명/);
  });

  it("그림 · 영상 표지 이름은 파일 이름 규칙에 맞다", () => {
    for (const c of BOOK1_SAMPLE.chapters) {
      if (c.image) expect(c.image).toMatch(/^[a-z0-9-]+$/);
      for (const card of c.cards)
        for (const b of card.blocks) {
          if (b.t === "image") expect(b.src).toMatch(/^[a-z0-9-]+$/);
          if (b.t === "video") {
            expect(b.poster).toMatch(/^[a-z0-9-]+$/);
            expect(b.missionId).toMatch(/^[0-9a-f-]{36}$/);
          }
        }
    }
  });
});
