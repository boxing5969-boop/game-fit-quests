import { describe, expect, it } from "vitest";
import { SCENE_FALLBACK, sceneCardFor, sceneHash, splitHighlight } from "@/lib/learnScene";

const card = (name: string) => ({ id: `id-${name}`, name });
const CARDS = ["어퍼컷", "훅", "원투", "잽 · 스트레이트", "위빙", "위빙-훅 연결", "십자 스텝", "사이드 스텝", "샌드백 구령", "기본 스탠스", "밴드 쉐도우 복싱"].map(card);

describe("릴스 썸네일 장면 — 153 동작 장면", () => {
  it("영상 글의 동작 말로 그 동작 카드", () => {
    expect(sceneCardFor("어퍼컷 잘하는 3가지 방법 레슨 어퍼컷", "1", CARDS)?.name).toBe("어퍼컷");
    expect(["원투", "잽 · 스트레이트"]).toContain(sceneCardFor("원투 잘하는 3가지 방법 레슨 기본기 콤비네이션", "7", CARDS)?.name);
    expect(["위빙", "위빙-훅 연결"]).toContain(sceneCardFor("복싱에서 회피가 중요한 5가지 이유 레슨 디펜스", "3", CARDS)?.name);
    expect(["십자 스텝", "사이드 스텝"]).toContain(sceneCardFor("아웃복싱 잘하기 위한 5가지 방법 레슨 무브먼트 풋워크", "4", CARDS)?.name);
    expect(["기본 스탠스", "원투"]).toContain(sceneCardFor("기본기가 전부인 이유 분석 기본기", "5", CARDS)?.name);
  });

  it("앞 규칙이 먼저 — 어퍼 · 훅이 같이 있으면 어퍼", () => {
    expect(sceneCardFor("레프트 더블(어퍼·훅) 잘하는 3가지 방법", "9", CARDS)?.name).toBe("어퍼컷");
  });

  it("맞는 말이 없으면 돌려 쓰는 장면 · 같은 씨앗 = 같은 장면 · 장면이 없으면 null", () => {
    const a = sceneCardFor("이노우에의 패턴 파괴 — 다운을 만든 수읽기 분석 월드챔피언", "abc", CARDS);
    expect(a && SCENE_FALLBACK.includes(a.name)).toBe(true);
    expect(sceneCardFor("이노우에의 패턴 파괴 — 다운을 만든 수읽기 분석 월드챔피언", "abc", CARDS)?.id).toBe(a?.id);
    expect(sceneCardFor("아무 말", "x", [])).toBeNull();
    expect(sceneCardFor("아무 말", "x", [card("모르는 카드")])).toBeNull();
  });

  it("같은 말 영상 여러 개 → 씨앗으로 돌려 가며 (카드가 둘 이상일 때)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) seen.add(sceneCardFor("훅 레슨", `seed-${i}`, CARDS)?.name ?? "");
    expect(seen.size).toBeGreaterThan(1);
    expect([...seen].every((n) => ["훅", "위빙-훅 연결"].includes(n))).toBe(true);
    expect(sceneHash("a")).toBe(sceneHash("a"));
  });
});

describe("썸네일 제목 강조", () => {
  it("먼저 나오는 동작 말 하나 — 긴 말 먼저", () => {
    expect(splitHighlight("잽을 잘 쓰면 세계를 제패한다")).toEqual(["", "잽", "을 잘 쓰면 세계를 제패한다"]);
    expect(splitHighlight("원투 잘하는 3가지 방법")).toEqual(["", "원투", " 잘하는 3가지 방법"]);
    expect(splitHighlight("복싱에서 밸런스가 중요한 5가지 이유")).toEqual(["복싱에서 ", "밸런스", "가 중요한 5가지 이유"]);
    expect(splitHighlight("크로스 카운터 잘하는 3가지 방법")).toEqual(["", "크로스 카운터", " 잘하는 3가지 방법"]);
    expect(splitHighlight("상대를 알아야 이긴다")).toEqual(["상대를 알아야 이긴다", "", ""]);
  });
});
