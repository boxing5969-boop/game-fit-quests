import { describe, expect, it } from "vitest";
import {
  EMPTY_LAYOUT,
  addToFolder,
  arrangeShelves,
  cardKey,
  countHiddenTiles,
  comboCode,
  dismissOverlap,
  dissolveFolder,
  findOverlaps,
  flattenLeaves,
  folderKey,
  layoutSummary,
  leagueMaxLevel,
  makeFolder,
  mergeInto,
  mergedFrom,
  missionKey,
  moveToShelf,
  nameTokens,
  parseShelfLayout,
  preferredMain,
  removeFromFolder,
  renameFolder,
  setFoldUpper,
  setHidden,
  setPinned,
  setShelfItems,
  setShelves,
  shelfOrder,
  suggestFolderName,
  unmerge,
  type ArrangedShelf,
  type ShelfLayout,
  type ShelfMission,
  type ShelfTile,
} from "./shelfLayout";
import { MEMBER_SHELVES, groupByShelf, isMemberVisible, orderForMember, orderForStaff, type TrainingCard } from "./trainingCards";

let seq = 0;
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mk = (category: string, name: string, level: number, sort = 0, extra: Partial<TrainingCard> = {}): TrainingCard => ({
  id: uid(++seq),
  category,
  name,
  summary: "",
  description: "",
  benefits: "",
  target: "",
  difficulty: "초급",
  cues: [],
  mistakes: [],
  level_min: level,
  sort_order: sort,
  image_url: null,
  video_url: null,
  is_active: true,
  video_path: null,
  coach_video_path: null,
  poster_path: null,
  minutes: null,
  equipment: null,
  ...extra,
});

// 운영 이름을 본뜬 작은 카드 묶음
const ladderStep = mk("풋워크", "사다리(래더) 스텝", 1, 4);
const fwd = mk("풋워크", "전진·후진 스텝", 1, 2, { video_path: "member/a.mp4" });
const side = mk("풋워크", "사이드 스텝", 1, 3, { video_path: "member/b.mp4" });
const mirror = mk("풋워크", "미러 풋워크 드릴", 25, 261);
const mirror2 = mk("풋워크", "거리 지배 미러 스텝", 33, 337);
const ladderWarm = mk("워밍업", "사다리 스텝 트레이닝", 2, 70);
const band = mk("워밍업", "밴드 쉐도우 복싱", 1, 20, { video_path: "member/c.mp4" });
const dumbbell = mk("워밍업", "아령 쉐도우 복싱", 2, 30);
const jab = mk("기본기", "잽", 1, 1);
const wallJab = mk("워밍업", "벽 잽 터치", 1, 60);
const combo4 = mk("콤비네이션", "4연타 콤비 (1-2-3-2)", 14, 170);
const mitt4 = mk("미트", "미트 4연타 드릴 (1-2-3-2)", 14, 180);
const combo3 = mk("콤비네이션", "원투쓰리 콤비 (1-2-3)", 12, 120);
const mitt3 = mk("미트", "미트 1-2-3", 2, 1);
const reaction = mk("미트", "미트 리액션 드릴", 25, 260);
const reaction2 = mk("미트", "미트 디펜스 리액션", 25, 262);
const bagRhythm = mk("샌드백", "샌드백 원투 리듬", 4, 230);
const bagShift = mk("샌드백", "리듬 변속 샌드백", 32, 326);
const rope1 = mk("줄넘기", "기본 바운스", 1, 1);
const rope2 = mk("줄넘기", "복서 스텝 줄넘기", 2, 90);
const rope3 = mk("줄넘기", "줄넘기 좌우 흔들기", 3, 100);
const coach = mk("코칭", "후배 미트 잡아주기", 36, 374);
const CARDS = [ladderStep, fwd, side, mirror, mirror2, ladderWarm, band, dumbbell, jab, wallJab, combo4, mitt4, combo3, mitt3, reaction, reaction2, bagRhythm, bagShift, rope1, rope2, rope3, coach];
const MEMBER_CARDS = CARDS.filter(isMemberVisible);
const MISSIONS: ShelfMission[] = [
  { id: uid(901), title: "[복싱/줄넘기] 좌우 리듬ㅣ왼발 2번·오른발 2번 줄넘기", poster: null },
  { id: uid(902), title: "[복싱/줄넘기] 왼발·오른발 털기ㅣ리듬 줄넘기", poster: null },
  { id: uid(903), title: "[복싱/체력] 민첩성 끝판왕! 사다리 스텝 훈련 9가지 완벽 가이드", poster: null },
  { id: uid(904), title: "[복싱/줄넘기] 트위스트ㅣ코어·회전 리듬 줄넘기", poster: null },
];

const keysOf = (tiles: readonly ShelfTile[]) => tiles.map((t) => t.key);
const shelf = (a: ArrangedShelf[], id: string) => a.find((s) => s.id === id)!;
const member = (layout: ShelfLayout, myLevel = 3, editing = false) =>
  arrangeShelves(MEMBER_CARDS, MISSIONS, layout, { audience: "member", myLevel, editing });
const staff = (layout: ShelfLayout, editing = false) => arrangeShelves(CARDS, MISSIONS, layout, { audience: "staff", myLevel: 40, editing });

describe("정리표가 비면 예전 화면과 같다", () => {
  it("회원 — 칸 · 순서(미션 먼저 · 내 레벨까지 먼저)가 예전 그대로, 위 리그만 접힘", () => {
    const a = member(EMPTY_LAYOUT, 3);
    const groups = groupByShelf(MEMBER_CARDS);
    const expectShelves = MEMBER_SHELVES.filter((s) => (groups[s]?.length ?? 0) > 0 || s === "warmup");
    expect(a.map((s) => s.id)).toEqual(expectShelves);
    for (const s of a) {
      const old = [
        ...(s.id === "warmup" ? MISSIONS.map((m) => missionKey(m.id)) : []),
        ...orderForMember(groups[s.id] ?? [], 3).map((c) => cardKey(c.id)),
      ];
      expect([...keysOf(s.tiles), ...keysOf(s.upper)]).toEqual(old);
      // 화이트(레벨 3) — 레벨 10 넘는 카드만 접힘
      for (const t of s.upper) expect(t.kind === "card" && (t.card.level_min ?? 0) > 10).toBe(true);
      for (const t of s.tiles) if (t.kind === "card") expect(t.card.level_min ?? 0).toBeLessThanOrEqual(10);
    }
    expect(keysOf(shelf(a, "step").upper)).toEqual([cardKey(mirror.id), cardKey(mirror2.id)]);
  });

  it("코치진 — 레벨 낮은 것부터 · 코치 칸 · 접기 없음", () => {
    const a = staff(EMPTY_LAYOUT);
    const groups = groupByShelf(CARDS);
    expect(shelf(a, "coach").tiles.map((t) => t.key)).toEqual([cardKey(coach.id)]);
    expect(keysOf(shelf(a, "skill").tiles)).toEqual(orderForStaff(groups.skill ?? []).map((c) => cardKey(c.id)));
    for (const s of a) expect(s.upper).toEqual([]);
  });

  it("리그 끝 레벨", () => {
    expect([1, 10, 11, 20, 21, 35, 40, 99, 0, NaN].map(leagueMaxLevel)).toEqual([10, 10, 20, 20, 30, 40, 40, 40, 10, 10]);
  });
});

describe("정리표 읽기 — DB 값을 믿지 않는다", () => {
  it("이상한 값은 버리고, 두 번 읽어도 같다", () => {
    const raw = {
      v: 9,
      shelves: [{ id: "step", label: "  스텝 · 거리   감각  " }, { id: "nope" }, { id: "step" }, { id: "warmup", label: "워밍업" }, null],
      items: {
        step: [cardKey(fwd.id), cardKey(fwd.id), "c:not-a-uuid", folderKey("gone"), cardKey(side.id)],
        warmup: [cardKey(fwd.id), missionKey(MISSIONS[0].id)],
        nope: [cardKey(jab.id)],
      },
      hidden: [cardKey(jab.id), 3, "x"],
      merged: { [cardKey(side.id)]: cardKey(fwd.id), [cardKey(fwd.id)]: cardKey(fwd.id), [cardKey(mitt3.id)]: cardKey(combo3.id), [cardKey(combo3.id)]: cardKey(mitt3.id) },
      folders: [
        { id: "f1", name: "x".repeat(40), items: [cardKey(rope1.id), cardKey(rope2.id)] },
        { id: "f1", name: "dup", items: [cardKey(rope3.id)] },
        { id: "f2", name: "", items: [cardKey(rope1.id)] },
        { id: "Bad Id", items: [cardKey(rope3.id)] },
      ],
      foldUpper: "no",
      notDup: [`${cardKey(fwd.id)}|${cardKey(side.id)}`, "family:줄넘기", "zz"],
    };
    const l = parseShelfLayout(raw);
    expect(l.shelves).toEqual([{ id: "step", label: "스텝 · 거리" }, { id: "warmup" }]);
    expect(l.items).toEqual({ step: [cardKey(fwd.id), cardKey(side.id)], warmup: [missionKey(MISSIONS[0].id)] });
    expect(l.hidden).toEqual([cardKey(jab.id)]);
    // 합친 짝이 서로를 가리키면(고리) 둘 다 버린다
    expect(l.merged).toEqual({ [cardKey(side.id)]: cardKey(fwd.id) });
    expect(l.folders).toEqual([{ id: "f1", name: "x".repeat(14), items: [cardKey(rope1.id), cardKey(rope2.id)] }]);
    expect(l.foldUpper).toBeUndefined();
    expect(l.notDup).toEqual([`${cardKey(fwd.id)}|${cardKey(side.id)}`, "family:줄넘기"]);
    expect(parseShelfLayout(l)).toEqual(l);
    expect(parseShelfLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });

  it("줄줄이 합친 것은 맨 끝 카드로", () => {
    const l = parseShelfLayout({ merged: { [cardKey(ladderWarm.id)]: cardKey(ladderStep.id), [cardKey(ladderStep.id)]: cardKey(fwd.id) } });
    expect(l.merged).toEqual({ [cardKey(ladderWarm.id)]: cardKey(fwd.id), [cardKey(ladderStep.id)]: cardKey(fwd.id) });
  });

  it("빈 값 · 배열 · null → 빈 정리표", () => {
    for (const x of [null, undefined, [], "x", 3, { shelves: "x", items: [], folders: {} }]) expect(parseShelfLayout(x)).toEqual(EMPTY_LAYOUT);
  });
});

describe("고치기", () => {
  it("칸 안 순서 · 새 카드는 맨 뒤", () => {
    // 일부만 적어도 — 적은 것 먼저, 나머지는 예전 순서로 뒤에
    const part = setShelfItems(EMPTY_LAYOUT, "step", [cardKey(side.id), cardKey(ladderStep.id)]);
    expect(keysOf(shelf(member(part, 3), "step").tiles)).toEqual([cardKey(side.id), cardKey(ladderStep.id), cardKey(fwd.id)]);
    // 편집 화면에서 끌어 놓으면 그 칸 전체 순서가 적힌다 → 정리표에 없는 새 카드는 그 칸 맨 뒤에 저절로
    const full = setShelfItems(EMPTY_LAYOUT, "step", keysOf(shelf(member(part, 3, true), "step").tiles));
    const fresh = mk("풋워크", "새 스텝", 1, 0);
    const b = arrangeShelves([...MEMBER_CARDS, fresh], MISSIONS, full, { audience: "member", myLevel: 3 });
    expect(keysOf(shelf(b, "step").tiles).slice(-1)).toEqual([cardKey(fresh.id)]);
    expect(keysOf(shelf(b, "step").tiles).slice(0, 3)).toEqual([cardKey(side.id), cardKey(ladderStep.id), cardKey(fwd.id)]);
  });

  it("다른 칸으로 옮기기 — 그 칸 맨 뒤 · 원래 칸에서 빠짐 · 다음 동작도 그 칸 안에서", () => {
    const before = member(EMPTY_LAYOUT, 3);
    const l = moveToShelf(EMPTY_LAYOUT, cardKey(ladderStep.id), "warmup", keysOf(shelf(before, "warmup").tiles));
    const a = member(l, 3);
    expect(keysOf(shelf(a, "warmup").tiles).slice(-1)).toEqual([cardKey(ladderStep.id)]);
    expect(keysOf(shelf(a, "step").tiles)).not.toContain(cardKey(ladderStep.id));
    expect(flattenLeaves(shelf(a, "warmup").tiles).map((x) => x.key)).toContain(cardKey(ladderStep.id));
  });

  it("숨기기 — 회원 빠짐 · 코치진 맨 뒤 흐리게 · 편집 중 제자리 흐리게", () => {
    const l = setHidden(EMPTY_LAYOUT, cardKey(fwd.id), true);
    expect(keysOf(shelf(member(l, 3), "step").tiles)).not.toContain(cardKey(fwd.id));
    const st = shelf(staff(l), "step").tiles;
    expect(st[st.length - 1].key).toBe(cardKey(fwd.id));
    expect(st[st.length - 1].hidden).toBe(true);
    const ed = shelf(member(l, 3, true), "step").tiles;
    expect(keysOf(ed)).toEqual(keysOf(shelf(member(EMPTY_LAYOUT, 3, true), "step").tiles));
    expect(ed.find((t) => t.key === cardKey(fwd.id))!.hidden).toBe(true);
    expect(setHidden(l, cardKey(fwd.id), false)).toEqual(EMPTY_LAYOUT);
    // 숨긴 카드 숫자 = 숨김 + 합침 (묶음 안도)
    const m = mergeInto(l, cardKey(side.id), cardKey(ladderStep.id));
    expect(countHiddenTiles(member(m, 3, true))).toBe(2);
    expect(countHiddenTiles(member(EMPTY_LAYOUT, 3, true))).toBe(0);
  });

  it("맨 앞 고정 — 고정한 차례대로 앞 · 위 리그여도 접지 않음", () => {
    let l = setPinned(EMPTY_LAYOUT, cardKey(mirror2.id), true);
    l = setPinned(l, cardKey(side.id), true);
    const s = shelf(member(l, 3), "step");
    expect(keysOf(s.tiles).slice(0, 2)).toEqual([cardKey(mirror2.id), cardKey(side.id)]);
    expect(keysOf(s.upper)).toEqual([cardKey(mirror.id)]);
    expect(s.tiles[0].pinned).toBe(true);
  });

  it("합치기 — 회원에겐 한 장 · 보일 카드에 이어짐 · 풀기", () => {
    const l = mergeInto(EMPTY_LAYOUT, cardKey(side.id), cardKey(fwd.id));
    expect(keysOf(shelf(member(l, 3), "step").tiles)).not.toContain(cardKey(side.id));
    expect(mergedFrom(l, cardKey(fwd.id))).toEqual([cardKey(side.id)]);
    const st = shelf(staff(l), "step").tiles;
    expect(st[st.length - 1]).toMatchObject({ key: cardKey(side.id), mergedInto: cardKey(fwd.id) });
    // 보일 카드를 다시 다른 카드에 합치면 줄줄이 맨 끝으로
    const l2 = mergeInto(l, cardKey(fwd.id), cardKey(ladderStep.id));
    expect(l2.merged).toEqual({ [cardKey(side.id)]: cardKey(ladderStep.id), [cardKey(fwd.id)]: cardKey(ladderStep.id) });
    // 고리는 안 만든다
    expect(mergeInto(l2, cardKey(ladderStep.id), cardKey(side.id))).toBe(l2);
    expect(unmerge(l, cardKey(side.id))).toEqual(EMPTY_LAYOUT);
  });

  it("묶기 — 놓은 카드 자리에 묶음 · 회원은 묶음 한 칸 · 하나만 남으면 그 카드로", () => {
    const keys = keysOf(shelf(member(EMPTY_LAYOUT, 3, true), "fitness").tiles);
    const l = makeFolder(EMPTY_LAYOUT, "fitness", keys, cardKey(rope2.id), cardKey(rope3.id), "rope1", "줄넘기");
    const s = shelf(member(l, 3), "fitness");
    const f = s.tiles.find((t) => t.kind === "folder")!;
    expect(f.kind === "folder" && f.tiles.map((x) => x.key)).toEqual([cardKey(rope2.id), cardKey(rope3.id)]);
    expect(keysOf(s.tiles).indexOf(folderKey("rope1"))).toBe(keys.indexOf(cardKey(rope2.id)));
    expect(keysOf(s.tiles)).not.toContain(cardKey(rope3.id));
    // 하나를 숨기면 회원에겐 남은 카드 한 장
    const hid = setHidden(l, cardKey(rope3.id), true);
    expect(keysOf(shelf(member(hid, 3), "fitness").tiles)).toContain(cardKey(rope2.id));
    expect(keysOf(shelf(member(hid, 3), "fitness").tiles)).not.toContain(folderKey("rope1"));
    // 묶음에 넣기 · 빼기 · 이름 · 풀기
    const k2 = keysOf(shelf(member(l, 3, true), "fitness").tiles);
    const l3 = addToFolder(l, "fitness", k2, "rope1", cardKey(rope1.id));
    expect(l3.folders![0].items).toEqual([cardKey(rope2.id), cardKey(rope3.id), cardKey(rope1.id)]);
    expect(l3.items!.fitness).not.toContain(cardKey(rope1.id));
    const k3 = keysOf(shelf(member(l3, 3, true), "fitness").tiles);
    const l4 = removeFromFolder(l3, "fitness", k3, cardKey(rope1.id));
    expect(l4.items!.fitness![l4.items!.fitness!.indexOf(folderKey("rope1")) + 1]).toBe(cardKey(rope1.id));
    expect(renameFolder(l4, "rope1", "  줄넘기 모음  ").folders![0].name).toBe("줄넘기 모음");
    const l5 = dissolveFolder(l4, "fitness", keysOf(shelf(member(l4, 3, true), "fitness").tiles), "rope1");
    expect(l5.folders).toBeUndefined();
    expect(l5.items!.fitness).toEqual(expect.arrayContaining([cardKey(rope2.id), cardKey(rope3.id), cardKey(rope1.id)]));
    // 묶음 위에 놓으면 그 묶음에 넣기
    const l6 = makeFolder(l, "fitness", keysOf(shelf(member(l, 3, true), "fitness").tiles), folderKey("rope1"), cardKey(rope1.id), "x2", "새");
    expect(l6.folders).toHaveLength(1);
    expect(l6.folders![0].items).toContain(cardKey(rope1.id));
    // 마지막 카드를 빼면 묶음도 사라짐
    let l7 = removeFromFolder(l, "fitness", keysOf(shelf(member(l, 3, true), "fitness").tiles), cardKey(rope2.id));
    l7 = removeFromFolder(l7, "fitness", keysOf(shelf(member(l7, 3, true), "fitness").tiles), cardKey(rope3.id));
    expect(l7.folders).toBeUndefined();
    expect(l7.items?.fitness ?? []).not.toContain(folderKey("rope1"));
  });

  it("칸 순서 · 이름 · 위 리그 접기 끄기 · 겹침 아님", () => {
    const l = setShelves(EMPTY_LAYOUT, [{ id: "skill", label: "기술 콤비" }, { id: "warmup", label: "워밍업" }]);
    expect(l.shelves).toEqual([{ id: "skill", label: "기술 콤비" }, { id: "warmup" }]);
    expect(shelfOrder(l, MEMBER_SHELVES).map((s) => s.id).slice(0, 3)).toEqual(["skill", "warmup", "basics"]);
    expect(member(l, 3)[0]).toMatchObject({ id: "skill", label: "기술 콤비" });
    const open = setFoldUpper(EMPTY_LAYOUT, false);
    for (const s of member(open, 3)) expect(s.upper).toEqual([]);
    expect(setFoldUpper(open, true)).toEqual(EMPTY_LAYOUT);
    const d = dismissOverlap(EMPTY_LAYOUT, "family:줄넘기");
    expect(d.notDup).toEqual(["family:줄넘기"]);
    expect(dismissOverlap(EMPTY_LAYOUT, "아무거나")).toEqual(EMPTY_LAYOUT);
    expect(layoutSummary(EMPTY_LAYOUT)).toBe("처음 정리");
    expect(layoutSummary(setHidden(d, cardKey(jab.id), true))).toBe("숨김 1");
  });

  it("고친 정리표는 늘 다시 읽어도 같다(다듬은 모양)", () => {
    const keys = keysOf(shelf(member(EMPTY_LAYOUT, 3, true), "fitness").tiles);
    let l = makeFolder(EMPTY_LAYOUT, "fitness", keys, cardKey(rope2.id), cardKey(rope3.id), "rope1", "줄넘기");
    l = setHidden(l, cardKey(jab.id), true);
    l = mergeInto(l, cardKey(side.id), cardKey(fwd.id));
    l = setPinned(l, folderKey("rope1"), true);
    expect(parseShelfLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });
});

describe("겹쳐 보이는 카드", () => {
  const all = findOverlaps(member(EMPTY_LAYOUT, 40, true), EMPTY_LAYOUT);
  const pairs = all.filter((o) => o.kind === "pair");
  const has = (x: TrainingCard | ShelfMission, y: TrainingCard | ShelfMission) => {
    const kx = "title" in x ? missionKey(x.id) : cardKey(x.id);
    const ky = "title" in y ? missionKey(y.id) : cardKey(y.id);
    return pairs.some((p) => p.kind === "pair" && ((p.a === kx && p.b === ky) || (p.a === ky && p.b === kx)));
  };

  it("보고서 표의 겹침 — 사다리 세 곳 · 같은 콤비 번호 · 이름만 조금 다름", () => {
    expect(has(ladderStep, ladderWarm)).toBe(true);
    expect(has(ladderStep, MISSIONS[2])).toBe(true);
    expect(has(ladderWarm, MISSIONS[2])).toBe(true);
    expect(has(combo4, mitt4)).toBe(true);
    expect(has(combo3, mitt3)).toBe(true);
    expect(has(reaction, reaction2)).toBe(true);
    expect(has(mirror, mirror2)).toBe(true);
    expect(pairs.find((p) => p.kind === "pair" && p.a === [cardKey(combo4.id), cardKey(mitt4.id)].sort()[0])?.reason).toBe("combo");
  });

  it("다른 동작은 겹침으로 보지 않음", () => {
    expect(has(bagRhythm, bagShift)).toBe(false);
    expect(has(band, dumbbell)).toBe(false);
    expect(has(jab, wallJab)).toBe(false);
    expect(has(MISSIONS[0], MISSIONS[1])).toBe(false);
    expect(has(fwd, side)).toBe(false); // 영상 파일이 다르면 이름으로만
  });

  it("같은 영상 파일이면 짝", () => {
    const a = mk("풋워크", "앞뒤 스텝", 1, 0, { video_path: "member/same.mp4" });
    const b = mk("풋워크", "옆 스텝", 1, 0, { video_path: "member/same.mp4" });
    const o = findOverlaps(arrangeShelves([a, b], [], EMPTY_LAYOUT, { audience: "member", myLevel: 1, editing: true }), EMPTY_LAYOUT);
    expect(o).toEqual([expect.objectContaining({ kind: "pair", reason: "video" })]);
  });

  it("두 칸에 흩어진 계열 — 줄넘기(체력 카드 3 · 워밍업 미션 3)", () => {
    const spread = all.find((o) => o.kind === "spread" && o.family === "줄넘기");
    // 많은 칸부터 · 같으면 칸 순서
    expect(spread && spread.kind === "spread" && spread.shelves).toEqual([
      { id: "warmup", count: 3 },
      { id: "fitness", count: 3 },
    ]);
    expect(all.some((o) => o.kind === "spread" && o.family === "체력")).toBe(false);
  });

  it("합치거나 · 숨기거나 · 묶거나 · 겹침 아님이면 목록에서 빠짐", () => {
    const pairId = [cardKey(reaction.id), cardKey(reaction2.id)].sort().join("|");
    const count = (l: ShelfLayout) => findOverlaps(member(l, 40, true), l).filter((o) => o.id === pairId).length;
    expect(count(EMPTY_LAYOUT)).toBe(1);
    expect(count(mergeInto(EMPTY_LAYOUT, cardKey(reaction2.id), cardKey(reaction.id)))).toBe(0);
    expect(count(setHidden(EMPTY_LAYOUT, cardKey(reaction2.id), true))).toBe(0);
    expect(count(dismissOverlap(EMPTY_LAYOUT, pairId))).toBe(0);
    const keys = keysOf(shelf(member(EMPTY_LAYOUT, 40, true), "drill").tiles);
    expect(count(makeFolder(EMPTY_LAYOUT, "drill", keys, cardKey(reaction.id), cardKey(reaction2.id), "rx", "리액션"))).toBe(0);
    expect(findOverlaps(member(EMPTY_LAYOUT, 40, true), dismissOverlap(EMPTY_LAYOUT, "family:줄넘기")).some((o) => o.kind === "spread")).toBe(false);
  });

  it("낱말 · 콤비 번호 · 남길 카드 · 묶음 이름", () => {
    expect(nameTokens("사다리(래더) 스텝")).toEqual(["사다리", "스텝"]);
    expect(nameTokens("[복싱/체력] 민첩성 끝판왕! 사다리 스텝 훈련 9가지 완벽 가이드")).toEqual(["민첩성", "사다리", "스텝"]);
    expect(nameTokens("인-아웃 스텝 드릴")).toEqual(["인앤아웃", "스텝"]);
    expect(nameTokens("슬립 카운터 입문 (슬립-2)")).toEqual(["슬립", "카운터"]);
    expect(comboCode("미트 4연타 드릴 (1-2-3-2)")).toBe("1-2-3-2");
    expect(comboCode("슬립 카운터 입문 (슬립-2)")).toBeNull();
    const leaves = flattenLeaves(shelf(member(EMPTY_LAYOUT, 40, true), "step").tiles);
    const lf = (c: TrainingCard) => leaves.find((x) => x.key === cardKey(c.id))!;
    expect(preferredMain(lf(ladderStep), lf(fwd))[0].key).toBe(cardKey(fwd.id)); // 영상 있는 카드가 남음
    expect(suggestFolderName("미트 리액션 드릴", "미트 디펜스 리액션")).toBe("미트 리액션");
    expect(suggestFolderName("[복싱/줄넘기] 트위스트ㅣ코어", "기본 바운스")).toBe("트위스트");
    expect(suggestFolderName("십자 스텝", "뛰는 스텝")).toBe("십자 스텝");
  });
});
