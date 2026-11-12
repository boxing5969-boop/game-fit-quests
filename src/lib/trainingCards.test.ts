import { describe, expect, it } from "vitest";
import {
  KNOWN_CATEGORIES,
  MEMBER_SHELVES,
  SHELF_INFO,
  STAFF_SHELVES,
  cardMedia,
  cardMinutes,
  cardSpeech,
  cardToBlock,
  categoryToBlockKind,
  categoryToShelf,
  groupByShelf,
  isMemberVisible,
  levelTag,
  matchesCardQuery,
  nextCard,
  normalizeCard,
  orderForMember,
  placeCardInBlocks,
  searchCards,
  programCardIds,
  trainingVideoPath,
  type TrainingCard,
} from "./trainingCards";
import { NEW_CARDS_1112, SAMPLE_TRAINING_CARDS, WEAVING_POLISHED } from "./trainingCardsSample";

// strategyService 의 BlockKind 와 같게 (서비스를 불러오면 Supabase 연결이 필요해서 여기 적어 둔다)
const BLOCK_KINDS = ["warmup", "skill", "mitt", "defense", "conditioning", "cooldown", "etc"];

const mk = (p: Partial<TrainingCard> & Pick<TrainingCard, "id" | "category">): TrainingCard =>
  normalizeCard({ name: p.id, summary: "", cues: [], mistakes: [], level_min: 1, sort_order: 0, is_active: true, ...p });

describe("153 콘텐츠 카드 — 분류 → 칸 · 블록", () => {
  it("운영 DB 의 분류 15개가 모두 칸과 블록 종류를 갖는다", () => {
    expect(KNOWN_CATEGORIES).toHaveLength(15);
    for (const c of KNOWN_CATEGORIES) {
      expect(Object.keys(SHELF_INFO)).toContain(categoryToShelf(c));
      expect(BLOCK_KINDS).toContain(categoryToBlockKind(c));
    }
  });

  it("설계 문서 표 그대로 — 풋워크 = 스텝 · 본운동, 샌드백 = 미트·샌드백 칸 · 마무리운동", () => {
    expect(categoryToShelf("풋워크")).toBe("step");
    expect(categoryToBlockKind("풋워크")).toBe("skill");
    expect(categoryToShelf("샌드백")).toBe("mitt");
    expect(categoryToBlockKind("샌드백")).toBe("conditioning");
    expect(categoryToShelf("줄넘기")).toBe("fitness");
    expect(categoryToShelf("회복")).toBe("cooldown");
    expect(categoryToShelf("준비")).toBe("prep");
    expect(categoryToBlockKind("준비")).toBe("etc");
    // 새 분류(코치가 만든 것)는 기술 칸 · 본운동
    expect(categoryToShelf("새로운분류")).toBe("skill");
    expect(categoryToBlockKind(undefined)).toBe("skill");
  });

  it("회원 칩 7개 · 코치진은 코치 칸까지 — 준비는 칩이 아니라 붕대 감기 한 줄", () => {
    expect(MEMBER_SHELVES.map((s) => SHELF_INFO[s].label)).toEqual(["워밍업", "스텝", "기술", "방어", "미트·샌드백", "체력", "쿨다운"]);
    expect(STAFF_SHELVES).toContain("coach");
    expect(MEMBER_SHELVES).not.toContain("prep");
  });

  it("코칭 카드는 회원에게 안 보이고, 꺼진 카드도 안 보인다", () => {
    expect(isMemberVisible(mk({ id: "a", category: "코칭" }))).toBe(false);
    expect(isMemberVisible(mk({ id: "b", category: "잽", is_active: false }))).toBe(false);
    expect(isMemberVisible(mk({ id: "c", category: "워밍업" }))).toBe(true);
  });
});

describe("레벨 · 순서 · 다음 동작", () => {
  const cards = [
    mk({ id: "hi", category: "풋워크", level_min: 7, sort_order: 1 }),
    mk({ id: "b", category: "풋워크", level_min: 1, sort_order: 2 }),
    mk({ id: "a", category: "풋워크", level_min: 2, sort_order: 1 }),
    mk({ id: "mid", category: "풋워크", level_min: 5, sort_order: 9 }),
  ];

  it("내 레벨까지 먼저(순서대로) → 위 레벨은 레벨 낮은 것부터 — 잠그지 않는다", () => {
    expect(orderForMember(cards, 3).map((c) => c.id)).toEqual(["a", "b", "mid", "hi"]);
    expect(levelTag(cards[0], 3)).toEqual({ text: "레벨 7부터", upcoming: true });
    expect(levelTag(cards[1], 3)).toEqual({ text: "레벨 1", upcoming: false });
    expect(levelTag(mk({ id: "x", category: "준비", level_min: 0 }), 3)).toBeNull();
  });

  it("다음 동작 = 보던 목록에서 같은 칸의 다음 카드 (끝이면 없음)", () => {
    const list = [
      mk({ id: "w1", category: "워밍업" }),
      mk({ id: "s1", category: "풋워크" }),
      mk({ id: "w2", category: "워밍업" }),
    ];
    expect(nextCard(list, list[0])?.id).toBe("w2");
    expect(nextCard(list, list[2])).toBeNull();
    expect(nextCard(list, mk({ id: "없음", category: "워밍업" }))).toBeNull();
  });

  it("칸으로 나누면 빈 칸은 키가 없다", () => {
    const g = groupByShelf(SAMPLE_TRAINING_CARDS);
    for (const s of MEMBER_SHELVES) expect((g[s] ?? []).length).toBeGreaterThan(0);
    expect(g.prep).toBeUndefined();
  });
});

describe("영상 · 설명 듣기 · 검색", () => {
  it("회원은 회원용 → 예전 링크, 코치진은 코치용 → 없으면 회원용", () => {
    const both = mk({ id: "v", category: "워밍업", video_path: "member/v-1.mp4", coach_video_path: "coach/v-1.mp4", video_url: "https://youtu.be/x" });
    expect(cardMedia(both, "member")).toEqual({ kind: "storage", path: "member/v-1.mp4" });
    expect(cardMedia(both, "coach")).toEqual({ kind: "storage", path: "coach/v-1.mp4" });
    const linkOnly = mk({ id: "l", category: "워밍업", video_url: " https://youtu.be/abc " });
    expect(cardMedia(linkOnly, "coach")).toEqual({ kind: "url", url: "https://youtu.be/abc" });
    expect(cardMedia(mk({ id: "n", category: "워밍업" }), "member")).toBeNull();
  });

  it("설명 듣기 — 이름 · 한 줄 · 포인트 문장, 153 은 '일오삼' · 화살표는 말로", () => {
    const s = cardSpeech({ name: "153 샌드백 구령", summary: "「어이」 → 양훅", cues: ["하나 · 둘", "턱으로"] });
    expect(s[0]).toBe("일오삼 샌드백 구령.");
    expect(s[1]).toContain("그다음 양훅");
    expect(s).toContain("포인트예요.");
    expect(s.at(-1)).toBe("둘, 턱으로");
    expect(s.join(" ")).not.toMatch(/153|→|·/);
  });

  it("검색은 띄어쓰기 · 가운뎃점을 무시하고 칸 이름 · 준비물도 본다", () => {
    const c = mk({ id: "q", category: "샌드백", name: "샌드백 구령", summary: "위빙 위빙 양훅", equipment: "글러브" });
    expect(matchesCardQuery(c, "샌드백구령")).toBe(true);
    expect(matchesCardQuery(c, "미트 샌드백")).toBe(true);
    expect(matchesCardQuery(c, "글러브")).toBe(true);
    expect(matchesCardQuery(c, "줄넘기")).toBe(false);
    expect(matchesCardQuery(c, "  ")).toBe(true);
  });

  it("검색 결과는 이름이 맞는 카드가 먼저 (칸 이름만 맞는 카드는 뒤)", () => {
    const mitt = mk({ id: "m", category: "미트", name: "미트 1-2-3", level_min: 1 });
    const bag = mk({ id: "b", category: "샌드백", name: "샌드백 구령", level_min: 2 });
    expect(searchCards([mitt, bag], "샌드백").map((c) => c.id)).toEqual(["b", "m"]);
    expect(searchCards([mitt, bag], "없는말")).toEqual([]);
  });

  it("저장소 경로 — member/ · coach/ 폴더, 이상한 글자는 빠진다", () => {
    expect(trainingVideoPath("member", "f294e207-515d", "mp4", "ab12")).toBe("member/f294e207-515d-ab12.mp4");
    expect(trainingVideoPath("coach", "x", "mov", "zz")).toBe("coach/x-zz.mp4");
    expect(trainingVideoPath("poster", "x", "PNG", "1")).toBe("member/poster-x-1.png");
    const bad = trainingVideoPath("member", "../../etc", "mp4", "../..");
    expect(bad).not.toContain("..");
    expect(bad.startsWith("member/")).toBe(true);
  });
});

describe("오늘 프로그램 · 수업 기록", () => {
  const sandbag = NEW_CARDS_1112.find((c) => c.name === "샌드백 구령")!;

  it("카드를 고르면 이름 · 분 · 블록 종류 · card_id 가 채워진다", () => {
    const b = cardToBlock(sandbag);
    expect(b).toMatchObject({ kind: "conditioning", title: "샌드백 구령", minutes: 6, card_id: sandbag.id, video_id: null, mission_id: null });
    // minutes 칸이 없으면 칸 기본값
    expect(cardMinutes(mk({ id: "m", category: "워밍업" }))).toBe(8);
    expect(cardMinutes(mk({ id: "m2", category: "워밍업", minutes: 500 }))).toBe(120);
  });

  it("「이 카드로 오늘 프로그램 만들기」 — 같은 종류의 빈 블록을 채우고, 없으면 쿨다운 앞에", () => {
    const base = [
      { kind: "warmup" as const, title: "", minutes: 10 },
      { kind: "skill" as const, title: "", minutes: 25 },
      { kind: "conditioning" as const, title: "", minutes: 10 },
      { kind: "cooldown" as const, title: "", minutes: 5 },
    ];
    const filled = placeCardInBlocks(base, sandbag);
    expect(filled[2].card_id).toBe(sandbag.id);
    expect(base[2].title).toBe(""); // 원본은 그대로
    const taken = placeCardInBlocks(filled, sandbag);
    expect(taken).toHaveLength(5);
    expect(taken[3].card_id).toBe(sandbag.id);
    expect(taken[4].kind).toBe("cooldown");
  });

  it("수업 기록 칩 = 프로그램에 붙은 카드 id (겹치면 한 번)", () => {
    expect(programCardIds([{ card_id: "a" }, { card_id: null }, { card_id: "a" }, { card_id: "b" }])).toEqual(["a", "b"]);
    expect(programCardIds(undefined)).toEqual([]);
  });
});

describe("예시 · 새 카드 글 (마이그레이션과 같은 글)", () => {
  it("새 카드 4장 — 포인트 3개 · 실수는 「→ 이렇게 고쳐요」 · 몸에 좋다는 효과 말 없음", () => {
    expect(NEW_CARDS_1112.map((c) => c.name)).toEqual(["십자 스텝", "뛰는 스텝", "워킹 런지", "샌드백 구령"]);
    for (const c of [...NEW_CARDS_1112, { ...WEAVING_POLISHED, name: "위빙", category: "방어" }]) {
      expect(c.cues).toHaveLength(3);
      for (const m of c.mistakes) expect(m).toContain("→");
      const all = [c.summary, c.description, ...c.cues, ...c.mistakes].join(" ");
      expect(all).not.toMatch(/살이 빠|다이어트|부상을 막|예방|국가대표|칼로리|건강해/);
    }
    expect(NEW_CARDS_1112.find((c) => c.name === "워킹 런지")?.cues.join(" ")).toContain("테니스공 하나");
    const sb = NEW_CARDS_1112.find((c) => c.name === "샌드백 구령")!;
    expect(sb.summary).toMatch(/어이/);
    expect(sb.summary).toMatch(/대시/);
  });

  it("예시 카드 id 는 겹치지 않고 모두 uuid 모양", () => {
    const ids = SAMPLE_TRAINING_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("DB 줄 모양이 달라도 카드가 된다 (칸이 없는 옛 DB · 이상한 값)", () => {
    const c = normalizeCard({ id: "z", name: "x", cues: "not-array", level_min: null, minutes: "7", video_path: "" });
    expect(c.cues).toEqual([]);
    expect(c.level_min).toBe(0);
    expect(c.minutes).toBe(7);
    expect(c.video_path).toBeNull();
    expect(c.category).toBe("기본기");
    expect(c.is_active).toBe(true);
  });
});
