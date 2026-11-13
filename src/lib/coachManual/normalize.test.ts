import { describe, expect, it } from "vitest";
import { BOOK1_SAMPLE } from "./book1Sample";
import { normalizeBlock, normalizeBook } from "./normalize";

const MISSION = "171fa9f5-226e-4781-aaf8-170b95bcb8be";

/** 지어낸 DB 책 한 권 (실제 책 글 아님) */
const raw = (chapters: unknown[], extra: Record<string, unknown> = {}) => ({
  id: "book1",
  no: "1권",
  title: "시험 책",
  tagline: "한 줄",
  cover: "cover",
  guide: ["하나", "", 3, "둘"],
  signature: "153 건강과 행복. 153복싱짐",
  source: "시험",
  chapters,
  ...extra,
});

const chapter = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  no: "1장",
  title: `장 ${id}`,
  gain: null,
  minutes: 3,
  image: null,
  version: 1,
  required: true,
  cards: [{ title: "장면", blocks: [{ t: "p", text: "글" }] }],
  today: "오늘 한 가지",
  quiz: [{ q: "질문", options: ["O", "X"], answer: 1, why: "까닭" }],
  ...more,
});

describe("153 매뉴얼 — DB 책 거르기", () => {
  it("앱 안 예시 책은 그대로 통과한다 (DB 책과 같은 모양)", () => {
    expect(normalizeBook(BOOK1_SAMPLE)).toEqual(BOOK1_SAMPLE);
  });

  it("책 모양이 아니면 null — 화면은 앱 안 예시를 쓴다", () => {
    expect(normalizeBook(null)).toBeNull();
    expect(normalizeBook([])).toBeNull();
    expect(normalizeBook("book1")).toBeNull();
    expect(normalizeBook(raw([chapter("a")], { id: "Book 1" }))).toBeNull();
    expect(normalizeBook(raw([]))).toBeNull();
    // 필독 장이 하나도 없으면
    expect(normalizeBook(raw([chapter("a", { required: false })]))).toBeNull();
  });

  it("빈 글 · 숫자는 목록에서 빼고, 표지 이름이 틀리면 기본 표지", () => {
    const b = normalizeBook(raw([chapter("a")], { cover: "../cover", tagline: "  " }));
    expect(b?.guide).toEqual(["하나", "둘"]);
    expect(b?.cover).toBe("cover");
    expect(b?.tagline).toBeNull();
  });

  it("틀린 장은 버린다 — 장 id 규칙 · 빈 카드 · 겹친 id(앞의 것만)", () => {
    const b = normalizeBook(
      raw([
        chapter("a"),
        chapter("A-1"),
        chapter("b", { cards: [{ title: "빈 카드", blocks: [{ t: "모름", text: "x" }] }] }),
        chapter("a", { title: "두 번째 a" }),
        chapter("c", { required: false, quiz: [] }),
      ]),
    );
    expect(b?.chapters.map((c) => c.id)).toEqual(["a", "c"]);
    expect(b?.chapters[0].title).toBe("장 a");
  });

  it("판 번호 · 읽는 시간 · 그림 이름을 바로잡는다", () => {
    const b = normalizeBook(raw([chapter("a", { version: 0, minutes: -2, image: "p0/../x" }), chapter("b", { version: 3.7, image: "p1-ch1" })]));
    expect(b?.chapters[0]).toMatchObject({ version: 1, minutes: 0, image: null });
    expect(b?.chapters[1]).toMatchObject({ version: 3, image: "p1-ch1" });
    expect(normalizeBook(raw([chapter("a", { version: "2" })]))?.chapters[0].version).toBe(1);
  });

  it("일반 장은 DB 에 번호 · 판만 두면 앱 안 글을 쓴다 (판 · 필독은 DB 값)", () => {
    const b = normalizeBook(
      raw([
        chapter("a"),
        { id: "prologue", from: "app", version: 2 },
        { id: "ch1", from: "app" },
        { id: "ch2", from: "app", version: 1, required: false },
        { id: "zz", from: "app", version: 1 },
      ]),
      BOOK1_SAMPLE,
    );
    expect(b?.chapters.map((c) => c.id)).toEqual(["a", "prologue", "ch1", "ch2"]);
    expect(b?.chapters[1]).toEqual({ ...BOOK1_SAMPLE.chapters[0], version: 2 });
    expect(b?.chapters[2]).toEqual(BOOK1_SAMPLE.chapters[1]);
    expect(b?.chapters[3].required).toBe(false);
    // 앱 안 책을 안 주면 그런 장은 버린다
    expect(normalizeBook(raw([chapter("a"), { id: "ch1", from: "app" }]))?.chapters.map((c) => c.id)).toEqual(["a"]);
  });

  it("DB 에 장 전체가 있으면 그 글이 앞선다", () => {
    const b = normalizeBook(raw([chapter("ch1", { title: "고친 1장" })]), BOOK1_SAMPLE);
    expect(b?.chapters[0].title).toBe("고친 1장");
  });

  it("확인 문제 — 보기 2개 미만 · 정답 자리가 보기 밖이면 그 문제만 버린다", () => {
    const b = normalizeBook(
      raw([
        chapter("a", {
          quiz: [
            { q: "맞는 문제", options: ["가", "나", "다"], answer: 2, why: "" },
            { q: "정답 밖", options: ["가", "나"], answer: 2, why: "" },
            { q: "보기 하나", options: ["가"], answer: 0, why: "" },
            { q: "", options: ["가", "나"], answer: 0, why: "" },
            { q: "정답 글자", options: ["가", "나"], answer: "0", why: "" },
          ],
        }),
      ]),
    );
    expect(b?.chapters[0].quiz.map((q) => q.q)).toEqual(["맞는 문제"]);
  });
});

describe("153 매뉴얼 — 블록 거르기", () => {
  it("아는 블록만 · 빈 블록은 버린다", () => {
    expect(normalizeBlock({ t: "p", text: " 글 " })).toEqual({ t: "p", text: "글" });
    expect(normalizeBlock({ t: "quote", text: "" })).toBeNull();
    expect(normalizeBlock({ t: "html", text: "<b>x</b>" })).toBeNull();
    expect(normalizeBlock({ t: "ul", items: ["가", "", 1] })).toEqual({ t: "ul", items: ["가"] });
    expect(normalizeBlock({ t: "ol", items: ["가"], start: 4 })).toEqual({ t: "ol", items: ["가"], start: 4 });
    expect(normalizeBlock({ t: "ol", items: ["가"], start: 0 })).toEqual({ t: "ol", items: ["가"] });
    expect(normalizeBlock({ t: "ol", items: ["가"] })).toEqual({ t: "ol", items: ["가"] });
  });

  it("표 — 빈 줄은 빼고 칸은 글로", () => {
    expect(normalizeBlock({ t: "table", head: ["항목", "내용"], rows: [["가", "나"], ["", ""], "줄 아님"] })).toEqual({
      t: "table",
      head: ["항목", "내용"],
      rows: [["가", "나"]],
    });
    expect(normalizeBlock({ t: "table", head: [], rows: [] })).toBeNull();
  });

  it("그림 · 영상 — 파일 이름 · 영상 id 규칙이 틀리면 버린다 (주소에 쓰이는 이름)", () => {
    expect(normalizeBlock({ t: "image", src: "p10-sandbag", alt: "샌드백" })).toEqual({ t: "image", src: "p10-sandbag", alt: "샌드백" });
    expect(normalizeBlock({ t: "image", src: "https://x.com/a.png", alt: "" })).toBeNull();
    expect(normalizeBlock({ t: "image", src: "../../secret", alt: "" })).toBeNull();
    expect(normalizeBlock({ t: "video", missionId: MISSION, poster: "v1-step", title: "제자리 스텝" })).toEqual({
      t: "video",
      missionId: MISSION,
      poster: "v1-step",
      title: "제자리 스텝",
    });
    expect(normalizeBlock({ t: "video", missionId: "not-a-uuid", poster: "v1-step", title: "x" })).toBeNull();
    expect(normalizeBlock({ t: "video", missionId: MISSION, poster: "V1 STEP", title: "x" })).toBeNull();
  });

  it("카드 영상 — 카드 id(uuid)만 받는다 · 설명 한 줄은 있으면", () => {
    expect(normalizeBlock({ t: "card", cardId: MISSION })).toEqual({ t: "card", cardId: MISSION });
    expect(normalizeBlock({ t: "card", cardId: ` ${MISSION} `, caption: " 코치용 영상 " })).toEqual({
      t: "card",
      cardId: MISSION,
      caption: "코치용 영상",
    });
    expect(normalizeBlock({ t: "card", cardId: "위빙" })).toBeNull();
    expect(normalizeBlock({ t: "card" })).toBeNull();
  });

  it("순서 영상 — 템플릿 id 규칙 · 자리 0~20 · 제목이 있어야", () => {
    expect(normalizeBlock({ t: "tplvideo", template: "weave-hook-call", step: 6, title: "샌드백 구령" })).toEqual({
      t: "tplvideo",
      template: "weave-hook-call",
      step: 6,
      title: "샌드백 구령",
    });
    expect(normalizeBlock({ t: "tplvideo", template: "mitt2-sandbag-call", step: 0, title: "수업 요약", caption: "3분" })).toEqual({
      t: "tplvideo",
      template: "mitt2-sandbag-call",
      step: 0,
      title: "수업 요약",
      caption: "3분",
    });
    expect(normalizeBlock({ t: "tplvideo", template: "Weave Hook", step: 1, title: "x" })).toBeNull();
    expect(normalizeBlock({ t: "tplvideo", template: "weave-hook-call", step: 21, title: "x" })).toBeNull();
    expect(normalizeBlock({ t: "tplvideo", template: "weave-hook-call", step: 1.5, title: "x" })).toBeNull();
    expect(normalizeBlock({ t: "tplvideo", template: "weave-hook-call", step: "3", title: "x" })).toBeNull();
    expect(normalizeBlock({ t: "tplvideo", template: "weave-hook-call", step: 3, title: " " })).toBeNull();
  });
});
