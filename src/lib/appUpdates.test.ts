import { describe, expect, it } from "vitest";
import { APP_UPDATES } from "@/data/appUpdates";
import {
  SEEN_MAX,
  groupUpdatesByDate,
  mergeSeen,
  newBadgeIds,
  parseSeen,
  resolveUpdateLink,
  unseenIds,
  updateDayLabel,
  updateProblems,
  visibleUpdates,
  type AppUpdate,
} from "./appUpdates";

const u = (id: string, extra: Partial<AppUpdate> = {}): AppUpdate => ({
  id,
  date: `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`,
  title: "제목",
  lines: ["한 줄"],
  ...extra,
});

describe("앱 업데이트 내역 — 글 (src/data/appUpdates.ts)", () => {
  it("칸마다 모양 · 길이가 맞다", () => {
    for (const x of APP_UPDATES) expect({ id: x.id, problems: updateProblems(x) }).toEqual({ id: x.id, problems: [] });
  });

  it("id 는 겹치지 않고, 새 것이 맨 위(날짜가 늘지 않는다)", () => {
    const ids = APP_UPDATES.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < APP_UPDATES.length; i++) expect(APP_UPDATES[i].date <= APP_UPDATES[i - 1].date).toBe(true);
  });

  it("회원 화면에 쓰지 않는 낱말 · 금액 · '국가대표' 가 없다", () => {
    for (const x of APP_UPDATES) {
      const text = [x.title, ...x.lines, x.link?.label ?? ""].join(" ");
      expect({ id: x.id, hits: ["못", "빠진", "밀린", "실패", "국가대표"].filter((w) => text.includes(w)) }).toEqual({ id: x.id, hits: [] });
      expect({ id: x.id, money: /\d[\d,]*\s*원/.test(text) }).toEqual({ id: x.id, money: false });
    }
  });

  it("회원 제안 · 코치진 · 시범 지점 칸이 있다 (보기 거르기가 실제로 쓰인다)", () => {
    expect(APP_UPDATES.some((x) => x.fromMember)).toBe(true);
    expect(APP_UPDATES.some((x) => x.audience === "staff")).toBe(true);
    expect(APP_UPDATES.some((x) => x.branches?.length)).toBe(true);
  });
});

describe("앱 업데이트 내역 — 계산", () => {
  const list = [
    u("20261112-a"),
    u("20261115-b", { audience: "staff" }),
    u("20261115-c", { branches: ["153복싱짐 선릉역점"] }),
    u("20261115-d"),
    u("20261113-e", { audience: "staff", branches: ["153복싱짐 칠금점"] }),
  ];

  it("회원 — 코치진 칸 · 다른 지점 칸은 안 보이고, 최신 날짜 먼저 · 같은 날은 파일 순서", () => {
    expect(visibleUpdates(list, { staff: false, branch: "153복싱짐 선릉역점" }).map((x) => x.id)).toEqual(["20261115-c", "20261115-d", "20261112-a"]);
    expect(visibleUpdates(list, { staff: false, branch: "153복싱짐 칠금점" }).map((x) => x.id)).toEqual(["20261115-d", "20261112-a"]);
    expect(visibleUpdates(list, { staff: false, branch: null }).map((x) => x.id)).toEqual(["20261115-d", "20261112-a"]);
  });

  it("코치 — 코치진 칸도 · 지점 칸은 내 지점만 / 대표님 · 운영진 — 모두", () => {
    expect(visibleUpdates(list, { staff: true, branch: "153복싱짐 선릉역점" }).map((x) => x.id)).toEqual(["20261115-b", "20261115-c", "20261115-d", "20261112-a"]);
    expect(visibleUpdates(list, { staff: true, hq: true, branch: "153본사" }).map((x) => x.id)).toEqual(["20261115-b", "20261115-c", "20261115-d", "20261113-e", "20261112-a"]);
  });

  it("본 것 — 믿지 않고 다듬기 · 새로 본 것을 앞에 · 한도", () => {
    expect(parseSeen(null)).toEqual([]);
    expect(parseSeen("x")).toEqual([]);
    expect(parseSeen('{"a":1}')).toEqual([]);
    expect(parseSeen('["20261115-b", 3, "nope", "20261115-b", "20261112-a"]')).toEqual(["20261115-b", "20261112-a"]);
    expect(mergeSeen(["20261112-a"], ["20261115-b", "20261112-a"])).toEqual(["20261115-b", "20261112-a"]);
    const many = Array.from({ length: SEEN_MAX + 20 }, (_, i) => `20261101-n${i}`);
    expect(mergeSeen([], many)).toHaveLength(SEEN_MAX);
    expect(parseSeen(JSON.stringify(many))).toHaveLength(SEEN_MAX);
  });

  it("아직 안 본 것 · 빨간 점 기준", () => {
    const vis = visibleUpdates(list, { staff: false, branch: "153복싱짐 선릉역점" });
    expect([...unseenIds(vis, [])]).toEqual(["20261115-c", "20261115-d", "20261112-a"]);
    expect([...unseenIds(vis, ["20261115-c", "20261112-a", "20261115-b"])]).toEqual(["20261115-d"]);
    expect(unseenIds(vis, vis.map((x) => x.id)).size).toBe(0);
  });

  it("「새」 표시 — 처음 여는 기기는 가장 최근 날짜만 · 그 뒤로는 안 본 것", () => {
    const vis = visibleUpdates(list, { staff: false, branch: "153복싱짐 선릉역점" });
    expect([...newBadgeIds(vis, [])]).toEqual(["20261115-c", "20261115-d"]);
    expect([...newBadgeIds(vis, ["20261115-c"])]).toEqual(["20261115-d", "20261112-a"]);
    expect(newBadgeIds([], []).size).toBe(0);
  });

  it("바로 보기 '{today}' · 날짜 글 · 날짜 묶기", () => {
    expect(resolveUpdateLink("/home?cal={today}", "2026-11-15")).toBe("/home?cal=2026-11-15");
    expect(resolveUpdateLink("/settings", "2026-11-15")).toBe("/settings");
    expect(updateDayLabel("2026-11-15")).toBe("11월 15일 (일)");
    expect(updateDayLabel("2026-11-02")).toBe("11월 2일 (월)");
    const vis = visibleUpdates(list, { staff: true, hq: true, branch: null });
    expect(groupUpdatesByDate(vis).map((g) => [g.date, g.items.length])).toEqual([
      ["2026-11-15", 3],
      ["2026-11-13", 1],
      ["2026-11-12", 1],
    ]);
  });

  it("검사 — 모양이 틀린 칸을 잡는다", () => {
    expect(updateProblems(u("20261115-ok"))).toEqual([]);
    expect(updateProblems({ ...u("20261115-ok"), date: "2026-11-14" })).toContain("id 앞 8자리 = date");
    expect(updateProblems({ ...u("20261115-ok"), lines: [] })).toContain("lines 1~3줄");
    expect(updateProblems({ ...u("20261115-ok"), link: { to: "home", label: "홈" } })).toContain("link 모양");
    expect(updateProblems({ ...u("bad id"), date: "2026-11-15" })).toContain("id 모양");
  });
});
