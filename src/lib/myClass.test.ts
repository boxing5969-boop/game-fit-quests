import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS,
  addItem,
  classMinutes,
  classSummary,
  classesWithKey,
  cleanName,
  defaultClassName,
  doneText,
  formatClock,
  itemAmountText,
  itemSeconds,
  missionTitle,
  moveItem,
  nextItemSegment,
  normalizeItems,
  noteWhen,
  parseItems,
  parseMyClass,
  parseSharedClass,
  playedText,
  prevItemSegment,
  removeItemAt,
  savedKeySet,
  segmentsFor,
  setItemN,
  toPlanBlocks,
  toggleUnit,
  validateItems,
  workedSeconds,
  type ClassItem,
} from "@/lib/myClass";
import { normalizeCard } from "@/lib/trainingCards";

const C1 = "c:11111111-1111-4111-8111-111111111111";
const C2 = "c:22222222-2222-4222-8222-222222222222";
const M1 = "m:44444444-4444-4444-8444-444444444444";
const it5: ClassItem = { k: C1, u: "m", n: 5, note: "" };
const r3: ClassItem = { k: C2, u: "r", n: 3, note: "" };

describe("항목 읽기", () => {
  it("모양이 틀린 칸은 버리고 범위 안으로 · 소문자 · 12장까지", () => {
    const raw = [
      { k: C1.toUpperCase().replace("C:", "c:"), u: "m", n: 99, note: "  하나   둘 " },
      { k: "x:1", u: "m", n: 5 },
      { k: C2, u: "r", n: 0 },
      { k: M1, n: "7" },
      null,
      "c:bad",
    ];
    expect(parseItems(raw)).toEqual([
      { k: C1, u: "m", n: 30, note: "하나 둘" },
      { k: C2, u: "r", n: 1, note: "" },
      { k: M1, u: "m", n: 7, note: "" },
    ]);
    expect(parseItems(Array.from({ length: 15 }, () => ({ k: C1, n: 3 })))).toHaveLength(MAX_ITEMS);
    expect(parseItems({})).toEqual([]);
  });

  it("서버 한 줄 → 내 수업 · 보여 준 수업 (코치님 화면엔 재생 기록 없음)", () => {
    const mine = parseMyClass({
      id: "a",
      name: "  퇴근   20분 ",
      items: [it5],
      shared: true,
      plays: 3,
      minutes_total: 60,
      new_notes: 1,
      notes: [{ id: "n1", body: "잽을 끝까지", at: "2026-11-14T05:00:00Z", by: { name: "김코치", title: "코치" }, mine: false }, { id: "", body: "" }],
    });
    expect(mine?.name).toBe("퇴근 20분");
    expect(mine?.plays).toBe(3);
    expect(mine?.notes).toHaveLength(1);
    expect(mine?.notes[0].by).toEqual({ name: "김코치", title: "코치", avatarUrl: null });
    expect(parseMyClass({ name: "x" })).toBeNull();
    const shared = parseSharedClass({ id: "b", name: "", items: [r3], owner: { user_id: "u", name: "복서1" } });
    expect(shared?.name).toBe("내 수업");
    expect(shared?.owner.name).toBe("복서1");
    expect(shared && "plays" in shared).toBe(false);
  });
});

describe("시간", () => {
  it("분 = n분 · 라운드 = 3분 운동 + 사이 30초 쉬기 (서버 _my_class_minutes 와 같은 수)", () => {
    expect(itemSeconds(it5)).toBe(300);
    expect(itemSeconds(r3)).toBe(3 * 180 + 2 * 30);
    expect(classMinutes([it5, r3])).toBe(15);
    expect(classMinutes([{ k: C2, u: "r", n: 2, note: "" }])).toBe(7);
    expect(classMinutes([])).toBe(0);
    expect(classSummary([it5, r3])).toBe("카드 2장 · 15분");
    expect(classSummary([it5, r3], (k) => k === C1)).toBe("카드 1장 · 5분");
    expect(itemAmountText(it5)).toBe("5분");
    expect(itemAmountText(r3)).toBe("3라운드");
  });

  it("글 — 재생 횟수는 한 적이 있을 때만 · 오늘 n분(1분 아래는 1분) · 시계", () => {
    expect(playedText(0)).toBeNull();
    expect(playedText(4)).toBe("4번 했어요");
    expect(doneText(29)).toBe("오늘 1분 했어요");
    expect(doneText(1500)).toBe("오늘 25분 했어요");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(0.2)).toBe("0:01");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("이름 · 고치기", () => {
  it("기본 이름은 비어 있는 번호 · 이름 다듬기 24자", () => {
    expect(defaultClassName([])).toBe("내 수업 1");
    expect(defaultClassName([{ name: "내 수업 1" }])).toBe("내 수업 2");
    expect(defaultClassName([{ name: "내 수업 2" }])).toBe("내 수업 1");
    expect(cleanName("  가 ".repeat(20))).toHaveLength(24);
  });

  it("담기 — 이미 있으면 그대로 · 12장이면 못 담음 · 분은 1~30", () => {
    const a = addItem([it5], C1, 7);
    expect(a.added).toBe(false);
    const b = addItem([it5], C2, 99);
    expect(b).toEqual({ items: [it5, { k: C2, u: "m", n: 30, note: "" }], added: true, full: false });
    const full = Array.from({ length: MAX_ITEMS }, (_, i) => ({ ...it5, k: `c:${String(i).padStart(8, "0")}-1111-4111-8111-111111111111` }));
    expect(addItem(full, C2, 5).full).toBe(true);
  });

  it("옮기기 · 빼기 · 분 바꾸기 · 분 ↔ 라운드", () => {
    expect(moveItem([it5, r3], 0, 1)).toEqual([r3, it5]);
    expect(moveItem([it5, r3], 0, -1)).toEqual([it5, r3]);
    expect(removeItemAt([it5, r3], 0)).toEqual([r3]);
    expect(setItemN([it5], 0, 0)[0].n).toBe(1);
    expect(setItemN([r3], 0, 20)[0].n).toBe(12);
    expect(toggleUnit([{ ...it5, n: 7 }], 0)[0]).toMatchObject({ u: "r", n: 2 });
    expect(toggleUnit([{ ...it5, n: 1 }], 0)[0]).toMatchObject({ u: "r", n: 1 });
    expect(toggleUnit([{ ...r3, n: 2 }], 0)[0]).toMatchObject({ u: "m", n: 6 });
    expect(toggleUnit([{ ...r3, n: 12 }], 0)[0]).toMatchObject({ u: "m", n: 30 });
    expect(normalizeItems([{ ...it5, note: "  메모  " }])[0].note).toBe("메모");
  });

  it("검사 말은 서버 마이그레이션과 같다", () => {
    expect(validateItems([it5, r3])).toBeNull();
    expect(validateItems([{ ...it5, n: 0 }])).toBe("시간은 1~30분 · 1~12라운드로 정해요");
    expect(validateItems([{ ...r3, n: 13 }])).toBe("시간은 1~30분 · 1~12라운드로 정해요");
    expect(validateItems([{ ...it5, note: "가".repeat(61) }])).toBe("메모는 60자까지 써요");
    expect(validateItems([{ ...it5, k: "c:x" }])).toBe("수업에 넣을 수 없는 카드예요");
    expect(validateItems(Array.from({ length: 13 }, () => it5))).toBe("한 수업에 12장까지 담을 수 있어요");
    const sql = readFileSync("supabase/migrations/20261114230326_training_my_classes.sql", "utf8");
    for (const msg of [
      "시간은 1~30분 · 1~12라운드로 정해요",
      "메모는 60자까지 써요",
      "수업에 넣을 수 없는 카드예요",
      "한 수업에 12장까지 담을 수 있어요",
      "분 또는 라운드로 정해요",
      "내 수업은 20개까지 만들 수 있어요",
      "한마디는 300자까지 써요",
    ])
      expect(sql).toContain(msg);
  });

  it("담겨 있나", () => {
    const classes = [{ items: [it5] }, { items: [r3, it5] }];
    expect(classesWithKey(classes, C1)).toHaveLength(2);
    expect(classesWithKey(classes, M1)).toHaveLength(0);
    expect([...savedKeySet(classes)].sort()).toEqual([C1, C2].sort());
  });
});

describe("재생 구간", () => {
  const items = [it5, { k: C2, u: "r" as const, n: 2, note: "" }];
  const segs = segmentsFor(items);

  it("분 = 한 구간 · 라운드 = 운동 · 쉬기 · 운동 (마지막 라운드 뒤 쉬기 없음)", () => {
    expect(segs.map((s) => [s.item, s.kind, s.round, s.sec])).toEqual([
      [0, "work", 1, 300],
      [1, "work", 1, 180],
      [1, "rest", 1, 30],
      [1, "work", 2, 180],
    ]);
    expect(segmentsFor(items, (k) => k !== C1).map((s) => s.item)).toEqual([1, 1, 1]);
  });

  it("한 운동 초 — 쉬기는 빼고", () => {
    expect(workedSeconds(segs, 0, 100)).toBe(100);
    expect(workedSeconds(segs, 2, 10)).toBe(480);
    expect(workedSeconds(segs, 3, 60)).toBe(540);
    expect(workedSeconds(segs, 4, 0)).toBe(660);
  });

  it("다음 → 는 다음 카드 · ← 는 지금 카드 처음, 처음이면 앞 카드", () => {
    expect(nextItemSegment(segs, 0)).toBe(1);
    expect(nextItemSegment(segs, 1)).toBe(-1);
    expect(prevItemSegment(segs, 3, 0)).toBe(1);
    expect(prevItemSegment(segs, 1, 0.5)).toBe(0);
    expect(prevItemSegment(segs, 1, 5)).toBe(1);
    expect(prevItemSegment(segs, 0, 0)).toBe(0);
  });
});

describe("코치님 「이 수업으로 수업안 만들기」", () => {
  it("카드 → 블록(분 · 메모) · 레벨 미션 → 워밍업 블록 · 못 찾은 것은 뺀다", () => {
    const card = normalizeCard({ id: C1.slice(2), name: "사다리 스텝", category: "풋워크", minutes: 5 });
    const blocks = toPlanBlocks(
      [
        { ...it5, note: "천천히" },
        { k: M1, u: "m", n: 4, note: "" },
        { k: C2, u: "r", n: 3, note: "" },
      ],
      {
        card: (id) => (id === card.id ? card : undefined),
        mission: (id) => (id === M1.slice(2) ? { id, title: "[복싱/워밍업] 밴드 쉐도우" } : undefined),
      },
    );
    expect(blocks).toEqual([
      { kind: "skill", title: "사다리 스텝", minutes: 5, card_id: card.id, mission_id: null, video_id: null, note: "천천히" },
      { kind: "warmup", title: "밴드 쉐도우", minutes: 4, card_id: null, mission_id: M1.slice(2), video_id: null, note: "" },
    ]);
    expect(missionTitle("[복싱/풋워크] 사다리")).toBe("사다리");
  });
});

describe("한마디 시각", () => {
  it("오늘이면 오전/오후 시각 · 아니면 월/일 (한국 시간)", () => {
    const now = new Date("2026-11-14T10:00:00Z"); // 19:00 KST
    expect(noteWhen("2026-11-14T06:20:00Z", now)).toBe("오후 3:20");
    expect(noteWhen("2026-11-14T00:05:00Z", now)).toBe("오전 9:05");
    expect(noteWhen("2026-11-13T14:59:00Z", now)).toBe("11/13");
    expect(noteWhen("x", now)).toBe("");
  });
});
