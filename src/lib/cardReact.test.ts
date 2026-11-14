import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FEELS,
  applyReact,
  askKey,
  cleanQuery,
  countChips,
  feelLabel,
  hardPercent,
  heartCountText,
  opinionError,
  parseOpinionList,
  parseSocial,
  replyError,
} from "./cardReact";

const SQL = readFileSync("supabase/migrations/20261115010941_training_card_react.sql", "utf8");

describe("영상으로 배우기 3단계 — 반응 · 의견", () => {
  it("♥ 숫자는 5명을 넘을 때만 (결정 5번)", () => {
    expect(heartCountText(null)).toBeNull();
    expect(heartCountText(5)).toBeNull();
    expect(heartCountText(6)).toBe("6");
    // 서버가 가린 값을 믿지 않고 한 번 더 — 5 이하가 와도 숫자를 보이지 않는다
    expect(parseSocial({ hearts: 3 }).hearts).toBeNull();
    expect(parseSocial({ hearts: 12 }).hearts).toBe(12);
    expect(SQL).toContain("case when v_hearts > 5 then v_hearts end");
  });

  it("서버 값을 다듬어 읽는다 — 모르는 값은 버림", () => {
    const s = parseSocial({
      viewer: "member",
      me: { heart: true, feel: "weird", asked: true },
      opinions: [
        { id: "o1", item: "c:1", body: "헷갈려요", at: "2026-11-15T01:00:00Z", reply: null, seen: false },
        { id: "", body: "id 없음" },
        { id: "o2", body: "답 있음", reply: { body: "왼발 먼저", by: { name: "김코치" }, mine: false }, seen: false },
      ],
      staff: null,
    });
    expect(s.viewer).toBe("member");
    expect(s.me).toEqual({ heart: true, feel: null, asked: true });
    expect(s.opinions.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(s.opinions[0].seen).toBe(true); // 답이 없으면 읽을 것도 없다
    expect(s.opinions[1].seen).toBe(false);
    expect(s.opinions[1].reply?.by).toEqual({ name: "김코치", title: "코치" });
    expect(s.staff).toBeNull();
    const st = parseSocial({ viewer: "staff", staff: { counts: { hearts: 2, hard: "4", easy: -1 }, opinions: [{ id: "x", owner: { name: "" } }] } });
    expect(st.staff?.counts).toEqual({ hearts: 2, easy: 0, ok: 0, hard: 4, asks: 0, opinions: 0 });
    expect(st.staff?.opinions[0].owner.name).toBe("회원");
    expect(st.staff?.opinions[0].itemName).toBe("카드");
    expect(parseOpinionList({ branch: "선릉", waiting: 2, opinions: [{ id: "a" }, null] }).opinions).toHaveLength(1);
  });

  it("검사 말은 서버와 같다", () => {
    expect(opinionError("   ")).toBe("의견을 적어 주세요");
    expect(opinionError("가".repeat(301))).toBe("의견은 300자까지 써요");
    expect(opinionError(" 발 순서가 헷갈려요 ")).toBeNull();
    expect(replyError("")).toBe("답을 적어 주세요");
    expect(replyError("가".repeat(301))).toBe("답은 300자까지 써요");
    for (const msg of [
      "의견을 적어 주세요",
      "의견은 300자까지 써요",
      "답을 적어 주세요",
      "답은 300자까지 써요",
      "의견은 하루 5개까지 보낼 수 있어요",
      "쉬워요 · 딱 좋아요 · 어려워요 중에서 골라요",
      "다른 코치님이 먼저 답했어요",
    ])
      expect(SQL).toContain(msg);
  });

  it("검색어 열쇠 — 서버와 같은 셈(띄어쓰기 · 가운뎃점 · 줄표 · 괄호 빼기 · 2글자부터)", () => {
    expect(askKey("  어퍼컷  ")).toBe("q:어퍼컷");
    expect(askKey("어 퍼-컷")).toBe("q:어퍼컷");
    expect(askKey("원·투 (스텝)")).toBe("q:원투스텝");
    expect(askKey("Jab_Cross/1")).toBe("q:jabcross1");
    expect(askKey("어")).toBeNull();
    expect(askKey(" - · ")).toBeNull();
    expect(askKey("가".repeat(60))).toBe(`q:${"가".repeat(40)}`);
    expect(cleanQuery("  잽   원투  ")).toBe("잽 원투");
    expect(SQL).toContain("'[[:space:]·_/()-]+'");
  });

  it("코치진 숫자 한 줄 — 0인 칸은 빼고 · 어려워요가 절반 넘으면 강조", () => {
    expect(countChips({ hearts: 0, easy: 0, ok: 0, hard: 0, asks: 0, opinions: 0 })).toEqual([]);
    const chips = countChips({ hearts: 3, easy: 1, ok: 1, hard: 4, asks: 2, opinions: 1 });
    expect(chips.map((c) => c.label)).toEqual(["♥ 3", "쉬워요 1", "딱 좋아요 1", "어려워요 4", "영상 요청 2"]);
    expect(chips.find((c) => c.key === "hard")?.strong).toBe(true);
    expect(countChips({ hearts: 0, easy: 5, ok: 5, hard: 3, asks: 0, opinions: 0 }).find((c) => c.key === "hard")?.strong).toBe(false);
    expect(hardPercent({ easy: 1, ok: 0, hard: 1 })).toBeNull();
    expect(hardPercent({ easy: 1, ok: 1, hard: 2 })).toBe(50);
  });

  it("누른 뒤 화면 — 먼저 바꾸고 · 쉬워요 다시 누르면 지움", () => {
    const s = parseSocial({ me: { heart: false, feel: "ok" } });
    expect(applyReact(s, { heart: true }).me).toEqual({ heart: true, feel: "ok", asked: false });
    expect(applyReact(s, { feel: null }).me.feel).toBeNull();
    expect(applyReact(s, {}).me.feel).toBe("ok");
    expect(FEELS.map((f) => f.label)).toEqual(["쉬워요", "딱 좋아요", "어려워요"]);
    expect(feelLabel("hard")).toBe("어려워요");
    expect(feelLabel(null)).toBe("");
  });
});
