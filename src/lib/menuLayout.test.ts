import { describe, expect, it } from "vitest";
import { APP_MENU, buildAppMenu, isMenuFolder } from "@/lib/appMenu";
import {
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
  parseLayout,
  removeEntry,
  renameEntry,
  resolveEntries,
  toLayout,
  type LayoutEntry,
  type MenuViewer,
} from "@/lib/menuLayout";

const member: MenuViewer = { diet: false, staff: false, office: false, dm: true, manager: false, admin: false };
const boss: MenuViewer = { diet: true, staff: true, office: true, dm: true, manager: true, admin: true };

const ids = (v: ReturnType<typeof buildMenuView>) =>
  v.map((e) => (e.kind === "folder" ? `[${e.id}:${e.items.map((i) => i.id).join(",")}]` : e.id));

const appMenuIds = (opts: Parameters<typeof buildAppMenu>[0]) =>
  buildAppMenu(opts).map((e) => (isMenuFolder(e) ? `[${e.folder}:${e.items.map((i) => i.path).join(",")}]` : e.path));

describe("고친 적이 없으면 지금 전체 메뉴와 똑같다", () => {
  const cases: Array<[string, MenuViewer]> = [
    ["회원", member],
    ["다이어트 회원", { ...member, diet: true }],
    ["메시지 못 쓰는 회원", { ...member, dm: false }],
    ["코치님", { ...member, staff: true, manager: true }],
    ["대표님", boss],
  ];
  for (const [name, v] of cases) {
    it(name, () => {
      const view = buildMenuView(resolveEntries(null), v);
      expect(ids(view)).toEqual(
        appMenuIds({ diet: v.diet, staff: v.staff, office: v.office, hide: (p) => !v.dm && p === "/messages" }),
      );
    });
  }
});

describe("바로가기 목록", () => {
  it("같은 곳은 한 번만 · 모두 / 로 시작", () => {
    const { list } = menuCatalog();
    const seen = new Set<string>();
    for (const c of list) {
      expect(c.id.startsWith("/")).toBe(true);
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
    }
  });
  it("라이브보드는 관리자 화면에 들어가는 분만", () => {
    const c = menuCatalog().map.get("/manager/live-board");
    expect(c?.label).toBe("라이브보드");
    expect(c?.requires).toBe("manager");
  });
  it("기본 메뉴 칸은 원래 이름 그대로", () => {
    for (const e of APP_MENU) {
      const items = isMenuFolder(e) ? e.items : [e];
      for (const m of items) expect(menuCatalog().map.get(m.path)?.label).toBe(m.label);
    }
  });
  it("메시지는 메시지를 쓸 수 있는 계정만", () => {
    expect(menuCatalog().map.get("/messages")?.requires).toBe("dm");
  });
});

describe("저장한 배치", () => {
  it("뺀 기본 칸은 다시 생기지 않는다", () => {
    const saved = toLayout(removeEntry(defaultEntries(), "/rank-up"));
    const view = buildMenuView(resolveEntries(saved), member);
    expect(ids(view)).not.toContain("/rank-up");
  });

  it("저장 뒤 새로 생긴 기본 칸은 끝에 붙는다", () => {
    const saved = toLayout(defaultEntries());
    const old = {
      ...saved,
      known: saved.known!.filter((k) => k !== "/membership"),
      entries: removeEntry(saved.entries!, "/membership"),
    };
    const out = resolveEntries(old);
    expect(containerOf(out, "/membership")).toBe(ROOT);
    const last = out[out.length - 1];
    expect(!isLayoutFolder(last) && last.id).toBe("/membership");
  });

  it("저장 뒤 기본 묶음에 새로 생긴 칸은 그 묶음 끝에", () => {
    const saved = toLayout(removeEntry(defaultEntries(), "/handwrap"));
    const old = { ...saved, known: saved.known!.filter((k) => k !== "/handwrap") };
    const out = resolveEntries(old);
    expect(containerOf(out, "/handwrap")).toBe("training");
  });

  it("모양이 틀린 값은 버리고 · 같은 칸은 한 번만 · 이름은 12자까지", () => {
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout({ v: 2, entries: [] })).toBeNull();
    const p = parseLayout({
      v: 1,
      updatedAt: 5,
      entries: [
        { id: "/home" },
        { id: "/home" },
        { id: "javascript:alert(1)" },
        { id: "/mypage", label: "  아주아주아주 긴 내 정보 이름입니다  " },
        { folder: "u-1", label: "", items: [{ id: "/settings" }, { id: "/home" }, 3] },
        { folder: "bad id!", items: [] },
        42,
      ],
    });
    expect(p?.entries).toEqual([
      { id: "/home" },
      { id: "/mypage", label: "아주아주아주 긴 내 정" },
      { folder: "u-1", label: "폴더", items: [{ id: "/settings" }] },
    ]);
  });

  it("처음대로(entries 없음)는 기본 메뉴", () => {
    expect(resolveEntries({ v: 1, updatedAt: 1 })).toEqual(defaultEntries());
  });

  it("known 에는 묶음과 칸이 모두", () => {
    const k = baseKnownIds();
    expect(k).toContain("folder:me");
    expect(k).toContain("/settings");
    expect(k).toContain("/myboxer");
  });
});

describe("고치기", () => {
  const base = (): LayoutEntry[] => [
    { id: "/a" },
    { id: "/office" },
    { id: "/b" },
    { folder: "me", label: "내 정보", items: [{ id: "/x" }, { id: "/y" }] },
    { id: "/c" },
  ];

  it("보이는 칸끼리만 순서를 바꾸고 안 보이는 칸은 제자리", () => {
    // /office 는 회원에게 안 보인다 — 화면 순서 /c,/a,/b
    const out = applyOrder(base(), ROOT, ["/c", "/a", "/b", "me"]);
    expect(out.map((e) => (isLayoutFolder(e) ? e.folder : e.id))).toEqual(["/c", "/office", "/a", "/b", "me"]);
  });

  it("폴더 안 순서", () => {
    const out = applyOrder(base(), "me", ["/y", "/x"]);
    const f = out.find(isLayoutFolder)!;
    expect(f.items.map((i) => i.id)).toEqual(["/y", "/x"]);
  });

  it("메뉴 위에 놓으면 그 자리에 새 폴더", () => {
    const { entries, folder } = mergeEntries(base(), "/c", "/a", "u-t", "새 폴더");
    expect(folder).toBe("u-t");
    expect(entries[0]).toEqual({ folder: "u-t", label: "새 폴더", items: [{ id: "/a" }, { id: "/c" }] });
    expect(containerOf(entries, "/c")).toBe("u-t");
  });

  it("폴더 위에 놓으면 그 폴더 끝에", () => {
    const { entries } = mergeEntries(base(), "/a", "me");
    expect(containerOf(entries, "/a")).toBe("me");
    expect(entries.find(isLayoutFolder)!.items.map((i) => i.id)).toEqual(["/x", "/y", "/a"]);
  });

  it("폴더는 다른 칸 위에 놓을 수 없다", () => {
    const { folder } = mergeEntries(base(), "me", "/a");
    expect(folder).toBeNull();
  });

  it("폴더에서 꺼내 마지막 칸이면 폴더도 없어진다", () => {
    let e = moveEntry(base(), "/x", ROOT, "/a");
    e = moveEntry(e, "/y", ROOT, null);
    expect(e.some(isLayoutFolder)).toBe(false);
    expect(e.map((x) => (isLayoutFolder(x) ? x.folder : x.id))).toEqual(["/x", "/a", "/office", "/b", "/c", "/y"]);
  });

  it("빼기 — 메뉴 · 폴더째", () => {
    expect(containerOf(removeEntry(base(), "/b"), "/b")).toBeNull();
    const noFolder = removeEntry(base(), "me");
    expect(noFolder.some(isLayoutFolder)).toBe(false);
    expect(containerOf(noFolder, "/x")).toBeNull();
  });

  it("폴더 풀기 — 그 자리에 펼친다", () => {
    const out = dissolveFolder(base(), "me");
    expect(out.map((x) => (isLayoutFolder(x) ? x.folder : x.id))).toEqual(["/a", "/office", "/b", "/x", "/y", "/c"]);
  });

  it("새 폴더 → 바로가기 넣기 → 이미 있는 칸은 옮겨진다", () => {
    let e = addFolder(base(), "운영", "u-ops");
    e = addEntry(e, "/manager/live-board", "u-ops");
    e = addEntry(e, "/b", "u-ops");
    const f = e.find((x) => isLayoutFolder(x) && x.folder === "u-ops");
    expect(f && isLayoutFolder(f) && f.items.map((i) => i.id)).toEqual(["/manager/live-board", "/b"]);
    expect(containerOf(e, "/b")).toBe("u-ops");
  });

  it("이름 바꾸기 — 비우면 원래 이름", () => {
    let e = renameEntry(base(), "/x", "라이브");
    expect(e.find(isLayoutFolder)!.items[0]).toEqual({ id: "/x", label: "라이브" });
    e = renameEntry(e, "/x", "   ");
    expect(e.find(isLayoutFolder)!.items[0]).toEqual({ id: "/x" });
    e = renameEntry(e, "me", "자주 가는 곳");
    expect(e.find(isLayoutFolder)!.label).toBe("자주 가는 곳");
  });

  it("편집 중에는 하나만 남은 폴더도 폴더로 · 빈 새 폴더도 보인다", () => {
    let e = defaultEntries();
    e = addFolder(e, "새 폴더", "u-empty");
    const editing = buildMenuView(e, member, { editing: true });
    expect(editing.some((x) => x.kind === "folder" && x.id === "u-empty")).toBe(true);
    const normal = buildMenuView(e, member);
    expect(normal.some((x) => x.kind === "folder" && x.id === "u-empty")).toBe(false);
  });

  it("라이브보드를 내 정보에 넣으면 대표님에게만 보인다", () => {
    const e = addEntry(defaultEntries(), "/manager/live-board", "me");
    const me = (v: MenuViewer) => buildMenuView(e, v).find((x) => x.kind === "folder" && x.id === "me");
    const bossMe = me(boss);
    expect(bossMe && bossMe.kind === "folder" && bossMe.items.map((i) => i.id)).toContain("/manager/live-board");
    const memberMe = me(member);
    expect(memberMe && memberMe.kind === "folder" && memberMe.items.map((i) => i.id)).not.toContain(
      "/manager/live-board",
    );
  });
});
