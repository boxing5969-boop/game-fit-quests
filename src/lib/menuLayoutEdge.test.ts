// 내 메뉴 배치 계산(menuLayout.ts)의 가장자리 — 한도(이름 12자 · 첫 화면 48칸 · 폴더 24칸) · 믿지 않는 값 다듬기 ·
// 기본 메뉴가 바뀐 뒤 · 받은 배치를 건드리지 않는지. 기본 동작은 menuLayout.test.ts (2026-11-12 더함).
import { describe, expect, it } from "vitest";
import { APP_MENU, isMenuFolder } from "@/lib/appMenu";
import {
  MAX_FOLDER_ITEMS,
  MAX_LABEL,
  MAX_ROOT_ENTRIES,
  ROOT,
  addEntry,
  addFolder,
  applyOrder,
  baseKnownIds,
  buildMenuView,
  containerOf,
  defaultEntries,
  dissolveFolder,
  isLayoutFolder,
  menuCatalog,
  mergeEntries,
  moveEntry,
  newFolderId,
  parseLayout,
  removeEntry,
  renameEntry,
  resolveEntries,
  toLayout,
  type LayoutEntry,
  type MenuViewer,
} from "@/lib/menuLayout";

const boss: MenuViewer = { diet: true, staff: true, office: true, dm: true, manager: true, admin: true };
const member: MenuViewer = { diet: false, staff: false, office: false, dm: true, manager: false, admin: false };
const flat = (e: LayoutEntry[]) => e.map((x) => (isLayoutFolder(x) ? `[${x.folder}:${x.items.map((i) => i.id).join(",")}]` : x.id));
const many = (n: number, p = "/t") => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));

describe("받은 배치를 건드리지 않는다(새 배열)", () => {
  it("모든 고치기 함수", () => {
    const base = defaultEntries();
    const snap = JSON.stringify(base);
    moveEntry(base, "/mypage", ROOT, "/myboxer");
    applyOrder(base, ROOT, ["me", "/myboxer"]);
    mergeEntries(base, "/rank-up", "/myboxer", "u-x");
    mergeEntries(base, "/rank-up", "me");
    removeEntry(base, "/mypage");
    dissolveFolder(base, "me");
    renameEntry(base, "/mypage", "가나다");
    addEntry(base, "/missions", "me");
    addFolder(base, "새", "u-y");
    resolveEntries({ v: 1, updatedAt: 1, entries: base, known: [] });
    expect(JSON.stringify(base)).toBe(snap);
  });
});

describe("한도", () => {
  it("폴더 24칸 — 넘으면 그대로", () => {
    const e: LayoutEntry[] = [{ id: "/a" }, { folder: "f", label: "F", items: many(MAX_FOLDER_ITEMS) }];
    expect(containerOf(moveEntry(e, "/a", "f", null), "/a")).toBe(ROOT);
    expect(containerOf(addEntry(e, "/a", "f"), "/a")).toBe(ROOT);
    expect(containerOf(addEntry(e, "/new", "f"), "/new")).toBeNull();
    const m = mergeEntries(e, "/a", "f");
    expect(m.folder).toBe("f");
    expect(containerOf(m.entries, "/a")).toBe(ROOT);
    // 같은 폴더 안에서 자리 바꾸기는 꽉 차 있어도 된다
    const r = moveEntry(e, "/t5", "f", "/t0");
    expect((r[1] as { items: { id: string }[] }).items[0].id).toBe("/t5");
  });
  it("첫 화면 48칸 — 새 폴더 · 바로가기 · 꺼내기 · 풀기", () => {
    const full: LayoutEntry[] = [...many(MAX_ROOT_ENTRIES - 1), { folder: "f", label: "F", items: [{ id: "/x" }, { id: "/y" }] }];
    expect(addFolder(full, "새", "u-n").length).toBe(full.length);
    expect(containerOf(addEntry(full, "/new", ROOT), "/new")).toBeNull();
    expect(containerOf(moveEntry(full, "/x", ROOT, null), "/x")).toBe("f");
    expect(dissolveFolder(full, "f").length).toBe(full.length);
    // 마지막 칸을 꺼내면 폴더가 없어져 자리가 난다
    const one: LayoutEntry[] = [...many(MAX_ROOT_ENTRIES - 1), { folder: "f", label: "F", items: [{ id: "/x" }] }];
    const out = moveEntry(one, "/x", ROOT, null);
    expect(containerOf(out, "/x")).toBe(ROOT);
    expect(out.length).toBe(MAX_ROOT_ENTRIES);
    expect(dissolveFolder(one, "f").length).toBe(MAX_ROOT_ENTRIES);
  });
  it("parseLayout — 첫 화면 48 · 폴더 24 · 이름 12자 · known 500", () => {
    const p = parseLayout({
      v: 1,
      updatedAt: 9,
      entries: [{ folder: "big", label: "가".repeat(40), items: many(60, "/i") }, ...many(80)],
      known: [...Array.from({ length: 700 }, (_, i) => `/k${i}`), 3, null, "x".repeat(300)],
    });
    expect(p!.entries!.length).toBe(MAX_ROOT_ENTRIES);
    const f = p!.entries![0];
    expect(isLayoutFolder(f) && f.items.length).toBe(MAX_FOLDER_ITEMS);
    expect(isLayoutFolder(f) && [...f.label].length).toBe(MAX_LABEL);
    expect(p!.known!.length).toBe(500);
    expect(p!.known!.every((k) => typeof k === "string")).toBe(true);
  });
});

describe("parseLayout — 믿지 않는다", () => {
  it("모양이 틀린 값", () => {
    for (const bad of [undefined, 0, "", "x", [], [1], { v: "1" }, { v: 1.5 }, { entries: [] }]) expect(parseLayout(bad)).toBeNull();
    expect(parseLayout({ v: 1 })).toEqual({ v: 1, updatedAt: 0 });
    expect(parseLayout({ v: 1, updatedAt: "어제", entries: "x", known: "y" })).toEqual({ v: 1, updatedAt: 0 });
    expect(parseLayout({ v: 1, updatedAt: -5 })!.updatedAt).toBe(0);
    expect(parseLayout({ v: 1, updatedAt: Infinity })!.updatedAt).toBe(0);
  });
  it("앱 밖 주소 · 이상한 이름표는 버린다", () => {
    const p = parseLayout({
      v: 1,
      updatedAt: 1,
      entries: [
        { id: "//evil.example/x" },
        { id: "https://evil.example" },
        { id: "/ok?tab=a&b=1" },
        { id: "/한글" },
        { id: "/a b" },
        { id: "/" + "a".repeat(250) },
        { id: 5 },
        { id: "/lbl", label: 7 },
        { id: "/lbl2", label: "  줄\n바꿈\t탭  " },
        { folder: "root", label: "x", items: [] },
        { folder: "__new__", label: "x", items: [] },
        { folder: "u-ok", label: "  내 폴더  ", items: "x" },
        { folder: "u-ok2", label: 3, items: [{ id: "/ok?tab=a&b=1" }, { id: "/in" }, { folder: "nest", items: [] }] },
        { folder: "u-ok2", label: "again", items: [{ id: "/dupfolder" }] },
        null,
        [],
      ],
    });
    expect(p!.entries).toEqual([
      { id: "/ok?tab=a&b=1" },
      { id: "/lbl" },
      { id: "/lbl2", label: "줄 바꿈 탭" },
      { folder: "u-ok2", label: "폴더", items: [{ id: "/in" }] },
    ]);
  });
  it("다듬은 값은 다시 다듬어도 같다(저장 → 읽기)", () => {
    const l = toLayout(addEntry(removeEntry(defaultEntries(), "/rank-up"), "/manager/live-board", "me"));
    const round = parseLayout(JSON.parse(JSON.stringify(l)));
    expect(round).toEqual(l);
    expect(parseLayout(JSON.parse(JSON.stringify(round)))).toEqual(l);
  });
});

describe("resolveEntries — 기본 메뉴가 바뀐 뒤", () => {
  const saved = () => toLayout(defaultEntries());
  it("known 이 없으면(망가진 값) 안 놓인 기본 칸을 다시 붙인다 — 메뉴가 사라지지는 않게", () => {
    const l = { v: 1 as const, updatedAt: 1, entries: removeEntry(defaultEntries(), "/rank-up") };
    expect(containerOf(resolveEntries(l), "/rank-up")).toBe(ROOT);
  });
  it("묶음째 새로 생기면 묶음째 끝에", () => {
    const s = saved();
    const old = { ...s, entries: removeEntry(s.entries!, "voice"), known: s.known!.filter((k) => !["folder:voice", "/inquiries", "/survey", "/feedback"].includes(k)) };
    const out = resolveEntries(old);
    expect(flat(out)[out.length - 1]).toBe("[voice:/inquiries,/survey,/feedback]");
  });
  it("푼 묶음에 새 칸이 생기면 첫 화면 끝에 · 다른 곳으로 옮겨 둔 칸은 그대로", () => {
    const s = saved();
    let e = dissolveFolder(s.entries!, "training");
    e = removeEntry(e, "/handwrap");
    e = moveEntry(e, "/routines", "me", null);
    const out = resolveEntries({ ...s, entries: e, known: s.known!.filter((k) => k !== "/handwrap") });
    expect(flat(out)[out.length - 1]).toBe("/handwrap");
    expect(containerOf(out, "/routines")).toBe("me");
    expect(out.filter((x) => !isLayoutFolder(x) && x.id === "/routines").length).toBe(0);
  });
  it("뺀 묶음(폴더째)은 다시 안 생긴다 · 이미 놓인 칸은 두 번 안 놓인다", () => {
    const s = saved();
    const out = resolveEntries({ ...s, entries: removeEntry(s.entries!, "about") });
    expect(flat(out).some((x) => x.startsWith("[about"))).toBe(false);
    const all = out.flatMap((x) => (isLayoutFolder(x) ? x.items.map((i) => i.id) : [x.id]));
    expect(new Set(all).size).toBe(all.length);
  });
  it("고치지 않고 다시 저장해도 같은 배치(known 이 지금 기본 메뉴)", () => {
    const s = saved();
    expect(resolveEntries(s)).toEqual(defaultEntries());
    expect(s.known).toEqual(baseKnownIds());
    const n = APP_MENU.reduce((a, e) => a + (isMenuFolder(e) ? 1 + e.items.length : 1), 0);
    expect(new Set(baseKnownIds()).size).toBe(n);
  });
});

describe("buildMenuView", () => {
  it("이 판에 없는 화면 · 같은 칸 두 번은 그리지 않는다", () => {
    const e: LayoutEntry[] = [{ id: "/없는-화면" }, { id: "/myboxer" }, { id: "/myboxer" }, { folder: "f", label: "F", items: [{ id: "/zz" }, { id: "/settings" }] }];
    const v = buildMenuView(e, member);
    expect(v.map((x) => x.id)).toEqual(["/myboxer", "/settings"]);
    const ed = buildMenuView(e, member, { editing: true });
    expect(ed.map((x) => x.id)).toEqual(["/myboxer", "f"]);
  });
  it("바꾼 이름 · 원래 이름 · 그림", () => {
    const v = buildMenuView([{ id: "/rank-up", label: "지도" }], member)[0];
    expect(v.kind === "item" && [v.label, v.defaultLabel, v.path, v.glyph]).toEqual(["지도", "로드맵", "/rank-up", "roadmap"]);
  });
  it("권한이 생기면 그 자리에 나타난다", () => {
    const e = addEntry(defaultEntries(), "/office?tab=sales", ROOT);
    expect(buildMenuView(e, member).some((x) => x.id === "/office?tab=sales")).toBe(false);
    expect(buildMenuView(e, { ...member, staff: true, manager: true }).some((x) => x.id === "/office?tab=sales")).toBe(false);
    const b = buildMenuView(e, boss);
    expect(b[b.length - 1].id).toBe("/office?tab=sales");
  });
  it("모든 바로가기 목록 칸은 그릴 수 있다(그림 이름 · 이름 12자 안)", () => {
    for (const c of menuCatalog().list) {
      expect(c.label.length).toBeGreaterThan(0);
      expect([...c.label].length).toBeLessThanOrEqual(MAX_LABEL + 4);
      expect(parseLayout({ v: 1, updatedAt: 1, entries: [{ id: c.id }] })!.entries).toEqual([{ id: c.id }]);
    }
  });
});

describe("고치기 가장자리", () => {
  const base = (): LayoutEntry[] => [{ id: "/a" }, { id: "/b" }, { folder: "f", label: "F", items: [{ id: "/x" }, { id: "/y" }] }, { id: "/c" }];
  it("applyOrder — 모르는 이름 · 겹친 이름 · 빠진 이름", () => {
    expect(flat(applyOrder(base(), ROOT, ["/c", "/zz", "/c", "/a"]))).toEqual(["/c", "/b", "[f:/x,/y]", "/a"]);
    expect(flat(applyOrder(base(), "없는폴더", ["/y", "/x"]))).toEqual(flat(base()));
    expect(flat(applyOrder(base(), ROOT, []))).toEqual(flat(base()));
  });
  it("moveEntry — 없는 칸 · 없는 폴더 · 자기 앞 · 폴더를 폴더에", () => {
    expect(flat(moveEntry(base(), "/zz", ROOT, null))).toEqual(flat(base()));
    expect(flat(moveEntry(base(), "/a", "없는폴더", null))).toEqual(flat(base()));
    expect(flat(moveEntry(base(), "/a", ROOT, "/a"))).toEqual(flat(base()));
    expect(flat(moveEntry(base(), "f", "f", null))).toEqual(flat(base()));
    expect(flat(moveEntry(base(), "f", ROOT, "/a"))).toEqual(["[f:/x,/y]", "/a", "/b", "/c"]);
    expect(flat(moveEntry(base(), "/y", "f", "/x"))).toEqual(["/a", "/b", "[f:/y,/x]", "/c"]);
    expect(flat(moveEntry(base(), "/a", "f", "/y"))).toEqual(["/b", "[f:/x,/a,/y]", "/c"]);
  });
  it("꺼낸 칸을 자기 폴더 칸 앞에 놓기 — 마지막 칸이면 폴더 자리에", () => {
    const one: LayoutEntry[] = [{ id: "/a" }, { folder: "f", label: "F", items: [{ id: "/x" }] }, { id: "/c" }];
    expect(flat(moveEntry(one, "/x", ROOT, "f"))).toEqual(["/a", "/x", "/c"]);
    expect(flat(moveEntry(base(), "/x", ROOT, "f"))).toEqual(["/a", "/b", "/x", "[f:/y]", "/c"]);
  });
  it("mergeEntries — 폴더 안 칸을 첫 화면 메뉴 위에 · 폴더 안 칸 위에는 못 놓음 · 겹친 폴더 이름표", () => {
    const m = mergeEntries(base(), "/x", "/a", "u-n");
    expect(flat(m.entries)).toEqual(["[u-n:/a,/x]", "/b", "[f:/y]", "/c"]);
    const last: LayoutEntry[] = [{ id: "/a" }, { folder: "f", label: "F", items: [{ id: "/x" }] }];
    expect(flat(mergeEntries(last, "/x", "/a", "u-n").entries)).toEqual(["[u-n:/a,/x]"]);
    expect(mergeEntries(base(), "/a", "/x").folder).toBeNull();
    expect(mergeEntries(base(), "/a", "/a").folder).toBeNull();
    expect(mergeEntries(base(), "/a", "/zz").folder).toBeNull();
    expect(mergeEntries(base(), "/a", "/b", "f").folder).toBeNull();
    expect(mergeEntries(base(), "/a", "/b", "bad id").folder).toBeNull();
    const auto = mergeEntries(base(), "/a", "/b");
    expect(auto.folder).toMatch(/^u-[a-z0-9]+$/);
    const keep = mergeEntries([{ id: "/a", label: "가" }, { id: "/b", label: "나" }], "/a", "/b", "u-k");
    expect(keep.entries[0]).toEqual({ folder: "u-k", label: "새 폴더", items: [{ id: "/b", label: "나" }, { id: "/a", label: "가" }] });
  });
  it("removeEntry — 마지막 칸을 빼면 폴더도 · 빈 새 폴더는 그대로 · 없는 이름", () => {
    const one: LayoutEntry[] = [{ id: "/a" }, { folder: "f", label: "F", items: [{ id: "/x" }] }, { folder: "e", label: "E", items: [] }];
    expect(flat(removeEntry(one, "/x"))).toEqual(["/a", "[e:]"]);
    expect(flat(removeEntry(one, "/zz"))).toEqual(flat(one));
    expect(flat(removeEntry(one, "e"))).toEqual(["/a", "[f:/x]"]);
  });
  it("renameEntry — 원래 이름과 같으면 이름을 지운다 · 12자 · 폴더는 비우면 그대로", () => {
    const e: LayoutEntry[] = [{ id: "/rank-up", label: "지도" }, { folder: "f", label: "F", items: [] }];
    expect(renameEntry(e, "/rank-up", " 로드맵 ")[0]).toEqual({ id: "/rank-up" });
    expect(renameEntry(e, "/rank-up", "가".repeat(30))[0]).toEqual({ id: "/rank-up", label: "가".repeat(12) });
    expect(renameEntry(e, "f", "  ")[1]).toEqual({ folder: "f", label: "F", items: [] });
    expect(renameEntry(e, "f", "새   이름")[1]).toEqual({ folder: "f", label: "새 이름", items: [] });
  });
  it("addEntry · addFolder — 틀린 이름표 · 겹침", () => {
    expect(flat(addEntry(base(), "javascript:alert(1)", ROOT))).toEqual(flat(base()));
    expect(flat(addEntry(base(), "/n", "없는폴더"))).toEqual(flat(base()));
    expect(flat(addEntry(base(), "/x", ROOT))).toEqual(["/a", "/b", "[f:/y]", "/c", "/x"]);
    expect(addFolder(base(), "x", "f").length).toBe(4);
    expect(addFolder(base(), "x", "root").length).toBe(4);
    expect(addFolder(base(), "x", "/a").length).toBe(4);
    expect(addFolder(base(), "   ", "u-1")[4]).toEqual({ folder: "u-1", label: "폴더", items: [] });
    for (let i = 0; i < 50; i += 1) expect(addFolder([], "x", newFolderId()).length).toBe(1);
  });
});
