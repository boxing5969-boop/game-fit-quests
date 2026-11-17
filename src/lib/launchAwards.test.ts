import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import { AWARDS_QR_URL, awardsView, eventDays, formatPoints, nameSize, normalizeAwards } from "./launchAwards";

// 지어낸 이름만 — 저장소가 공개라 회원 이름을 시험에 쓰지 않는다
const RAW = {
  branch: "153복싱짐 선릉역점",
  status: "ended",
  start_date: "2026-10-01",
  end_date: "2026-11-09",
  items: [
    {
      category: "attendance",
      rows: [
        { rank: 1, name: "Boxer Kim", hidden: false, score: 34, paid_points: null, character: { league: "blue", level: 3, parts: { style: "boxer_a" } } },
        { rank: 2, name: "예시 복서 둘", hidden: false, score: 32 },
        { rank: 3, name: "예시 복서 셋", hidden: false, score: 26 },
      ],
    },
    {
      category: "app",
      rows: [
        { rank: 1, name: "봄비", hidden: false, score: 119, paid_points: 50000, character: { league: "white", level: 7, parts: null } },
        { rank: 2, name: "예시 복서 넷", hidden: false, score: 54 },
      ],
    },
    {
      category: "nickname",
      rows: [
        { rank: 1, name: "예시 복서", hidden: false, score: 8, paid_points: null, character: { league: null, level: null, parts: null } },
        { rank: 3, name: null, hidden: true, score: 7 },
        { rank: 2, name: "예시 복서 둘", hidden: false, score: 7 },
      ],
    },
  ],
  stats: { members_trained: 138, level_ups: 209, earned_points: 747700, members_with_points: 160 },
  rules: { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 },
};

const allText = (v: NonNullable<ReturnType<typeof awardsView>>) =>
  [v.title, v.prizeLine, v.evidence ?? "", v.quote, v.byline, v.signature, ...v.qrCaption, v.band?.title ?? "", ...(v.band?.steps ?? []), v.band?.note ?? "",
    ...v.cards.flatMap((c) => [c.throne, c.name, c.record, c.chip, ...c.others])].join("\n");

describe("수상자 축하 — 서버 값 다듬기", () => {
  it("모양이 다르면 null", () => {
    expect(normalizeAwards(null)).toBeNull();
    expect(normalizeAwards([])).toBeNull();
    expect(normalizeAwards({ status: "ended" })).toBeNull();
    expect(normalizeAwards({ branch: "x" })).toBeNull();
  });
  it("모르는 왕좌 · 틀린 줄은 버리고 순위대로", () => {
    const d = normalizeAwards({ ...RAW, items: [...RAW.items, { category: "boss", rows: [] }, { category: "app", rows: [{ rank: "x" }] }] })!;
    expect(d.items.map((i) => i.category)).toEqual(["attendance", "app", "nickname", "app"]);
    expect(d.items[2].rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(d.items[3].rows).toEqual([]);
  });
  it("받은 마일리지는 0 보다 클 때만", () => {
    const d = normalizeAwards({ ...RAW, items: [{ category: "attendance", rows: [{ rank: 1, name: "a", score: 1, paid_points: 0 }] }] })!;
    expect(d.items[0].rows[0].paidPoints).toBeNull();
  });
});

describe("수상자 축하 — 화면 글", () => {
  const v = awardsView(normalizeAwards(RAW))!;

  it("① 띠: 왕좌 n명 · 1위 혜택은 띠에 한 번", () => {
    expect(v.title).toBe("축하합니다! 런칭 이벤트 왕좌 3명");
    expect(v.prizeLine).toBe("1위께 153 마일리지 50,000점");
    for (const c of v.cards) expect(`${c.chip}${c.record}${c.others.join("")}`).not.toContain("50,000");
  });

  it("② 카드: 왕좌 순서 · 기록 · 받았어요는 받은 분만", () => {
    expect(v.cards.map((c) => c.throne)).toEqual(["출석왕", "앱 활동왕", "좋아요왕"]);
    expect(v.cards.map((c) => c.record)).toEqual(["출석 34일", "활동 119점", "하트 8개"]);
    expect(v.cards.map((c) => c.chip)).toEqual(["드릴 예정", "받았어요", "드릴 예정"]);
    expect(v.cards.map((c) => c.paid)).toEqual([false, true, false]);
    expect(v.cards[0].others).toEqual(["2위 예시 복서 둘", "3위 예시 복서 셋"]);
    expect(v.cards[1].others).toEqual(["2위 예시 복서 넷"]);
    expect(v.cards[2].others).toEqual(["2위 예시 복서 둘", "3위 회원님"]);
    expect(v.cards[0].character?.parts?.style).toBe("boxer_a");
  });

  it("이름을 뺀 1위는 '1위 회원님' · 캐릭터 없음", () => {
    const raw = structuredClone(RAW);
    raw.items[0].rows[0] = { rank: 1, name: null, hidden: true, score: 34, paid_points: null, character: null } as never;
    const h = awardsView(normalizeAwards(raw))!;
    expect(h.cards[0].name).toBe("1위 회원님");
    expect(h.cards[0].character).toBeNull();
    expect(h.title).toBe("축하합니다! 런칭 이벤트 왕좌 3명");
  });

  it("같은 사람이 두 왕좌를 가지면 '왕좌 2명'", () => {
    const raw = structuredClone(RAW);
    raw.items[2].rows[0].name = "Boxer Kim";
    expect(awardsView(normalizeAwards(raw))!.title).toBe("축하합니다! 런칭 이벤트 왕좌 2명");
  });

  it("③ 증거 · 내 마일리지 띠 · ④ QR", () => {
    expect(v.evidence).toBe("40일 동안 레벨업 209번 · 운동으로 쌓인 마일리지 74만 7,700점");
    expect(v.band).toEqual({ title: "회원님 마일리지도 쌓이고 있어요", steps: ["오면 +300", "레벨업 +300", "결제 때 할인으로"], note: "출석은 얼굴 인식으로 저절로 쌓여요" });
    expect(v.qrUrl).toBe(AWARDS_QR_URL);
    expect(v.qrUrl).toContain("/mypage?focus=mileage");
    expect(v.qrCaption.join(" ")).toBe("내 마일리지 보기");
  });

  it("마일리지가 꺼져 있으면 띠 없음 · 숫자가 없으면 증거 없음", () => {
    const off = awardsView(normalizeAwards({ ...RAW, rules: { enabled: false, attendance: 300 } }))!;
    expect(off.band).toBeNull();
    const none = awardsView(normalizeAwards({ ...RAW, stats: { members_trained: 0, level_ups: 0, earned_points: 0 } }))!;
    expect(none.evidence).toBeNull();
  });

  it("한마디 · 서명", () => {
    expect(v.quote).toBe("“자주 와 주신 날들이 왕관이 됐어요. 다음 왕관도 응원할게요.”");
    expect(v.byline).toBe("153복싱짐 선릉역점 코치진");
    expect(v.signature).toBe("153 건강과 행복. 153복싱짐");
  });

  it("끝나지 않았거나 1위가 없으면 화면 없음(예전 보드)", () => {
    expect(awardsView(normalizeAwards({ ...RAW, status: "active" }))).toBeNull();
    expect(awardsView(normalizeAwards({ ...RAW, items: [] }))).toBeNull();
    expect(awardsView(null)).toBeNull();
  });

  it("글 규칙: '원' 금액 · 국가대표 · 긴 줄표 · 못한 말 없음", () => {
    const t = allText(v);
    expect(t).not.toMatch(/\d[\d,]*\s*원/);
    expect(t).not.toContain("국가대표");
    expect(t).not.toContain("—");
    expect(t).not.toMatch(/못|빠진|실패|아직 못/);
  });
});

describe("숫자 · 크기", () => {
  it("마일리지 점수", () => {
    expect(formatPoints(747700)).toBe("74만 7,700점");
    expect(formatPoints(10000)).toBe("1만 점");
    expect(formatPoints(1276200)).toBe("127만 6,200점");
    expect(formatPoints(9800)).toBe("9,800점");
    expect(formatPoints(0)).toBe("0점");
  });
  it("며칠", () => {
    expect(eventDays("2026-10-01", "2026-11-09")).toBe(40);
    expect(eventDays("2026-10-01", null)).toBeNull();
    expect(eventDays("2026-11-09", "2026-10-01")).toBeNull();
  });
  it("이름 글씨는 칸에 맞게 48 → 40 → 34", () => {
    expect(nameSize("봄비")).toBe(48);
    expect(nameSize("1위 회원님")).toBe(48);
    expect(nameSize("Boxer Kim")).toBe(48); // 영문은 한 글자 0.58칸 — 9글자도 한 줄에 들어간다
    expect(nameSize("예시복서 Kim")).toBe(40);
    expect(nameSize("아주긴닉네임여덟자")).toBe(34);
  });
});
