import { describe, expect, it } from "vitest";
import { absorbDmPage, dmBubbleTime, dmDayLabel, dmListTime, kstDayKey, layoutDmBubbles, mergeDmMessages } from "./dmTime";

// 기준: 2026-09-30(수) 오후 3시 KST = 06:00Z
const NOW = new Date("2026-09-30T06:00:00Z");

describe("dmTime — 한국 시간 기준", () => {
  it("KST 날짜 경계: 09-29 15:30Z 는 한국으로 9월 30일 00:30", () => {
    expect(kstDayKey("2026-09-29T15:30:00Z")).toBe("2026-09-30");
    expect(kstDayKey("2026-09-29T14:59:00Z")).toBe("2026-09-29");
  });

  it("목록 시각: 오늘은 시각, 어제는 '어제', 올해는 월일, 작년은 전체 날짜", () => {
    expect(dmListTime("2026-09-30T05:05:00Z", NOW)).toBe("오후 2:05");
    // 한국 자정 직후 = 오늘
    expect(dmListTime("2026-09-29T15:10:00Z", NOW)).toBe("오전 12:10");
    // 한국 자정 직전 = 어제
    expect(dmListTime("2026-09-29T14:50:00Z", NOW)).toBe("어제");
    expect(dmListTime("2026-09-20T03:00:00Z", NOW)).toBe("9월 20일");
    expect(dmListTime("2025-12-31T03:00:00Z", NOW)).toBe("2025. 12. 31.");
  });

  it("말풍선 시각", () => {
    expect(dmBubbleTime("2026-09-30T00:07:00Z")).toBe("오전 9:07");
  });

  it("날짜 구분선에 요일", () => {
    expect(dmDayLabel("2026-09-30T06:00:00Z", NOW)).toBe("9월 30일 수요일");
    expect(dmDayLabel("2025-09-28T06:00:00Z", NOW)).toBe("2025. 9. 28. 일요일");
  });
});

describe("layoutDmBubbles — 날짜 구분선 · 같은 사람 3분 묶기", () => {
  const m = (id: number, mine: boolean, at: string) => ({ id, mine, created_at: at });

  it("빈 목록", () => {
    expect(layoutDmBubbles([], NOW)).toEqual([]);
  });

  it("1개: 구분선 + 덩어리 처음이자 끝", () => {
    const [v] = layoutDmBubbles([m(1, true, "2026-09-30T05:00:00Z")], NOW);
    expect(v.dayLabel).toBe("9월 30일 수요일");
    expect(v.groupStart).toBe(true);
    expect(v.groupEnd).toBe(true);
  });

  it("같은 사람 3분 안 → 묶임, 3분 넘으면 새 덩어리, 상대가 끼면 끊김", () => {
    const out = layoutDmBubbles(
      [
        m(1, true, "2026-09-30T05:00:00Z"),
        m(2, true, "2026-09-30T05:02:00Z"),
        m(3, true, "2026-09-30T05:06:00Z"),
        m(4, false, "2026-09-30T05:06:30Z"),
        m(5, false, "2026-09-30T05:07:00Z"),
      ],
      NOW,
    );
    expect(out.map((v) => [v.groupStart, v.groupEnd])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, false],
      [false, true],
    ]);
    expect(out.filter((v) => v.dayLabel).length).toBe(1);
  });

  it("한국 자정을 넘으면 같은 사람이라도 새 날짜 · 새 덩어리", () => {
    const out = layoutDmBubbles(
      [m(1, true, "2026-09-29T14:59:00Z"), m(2, true, "2026-09-29T15:00:30Z")],
      NOW,
    );
    expect(out[0].groupEnd).toBe(true);
    expect(out[1].dayLabel).toBe("9월 30일 수요일");
    expect(out[1].groupStart).toBe(true);
  });
});

describe("mergeDmMessages", () => {
  it("id 로 중복 없이 합치고 오래된 순으로", () => {
    const a = [{ id: 3, v: "a3" }, { id: 4, v: "a4" }];
    const b = [{ id: 1, v: "b1" }, { id: 3, v: "b3" }];
    expect(mergeDmMessages(a, b).map((x) => `${x.id}${x.v}`)).toEqual(["1b1", "3b3", "4a4"]);
  });
});

describe("absorbDmPage — 받은 메시지는 버리지 않고 쌓는다", () => {
  const ids = (xs: Array<{ id: number }>) => xs.map((x) => x.id);
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => ({ id: a + i }));

  it("처음 = 페이지 그대로", () => {
    const r = absorbDmPage([], range(61, 100), true);
    expect(r.reset).toBe(true);
    expect(ids(r.list)).toEqual(ids(range(61, 100)));
  });

  it("이전 메시지를 불러온 뒤 새 메시지 3개 → 사이 메시지가 사라지지 않는다 (검수 재현: 61~63)", () => {
    const have = range(21, 100); // 이전 40개 + 최신 40개
    const page = range(64, 103); // 새 메시지 3개로 앞이 3개 밀린 최신 40개
    const r = absorbDmPage(have, page, true);
    expect(r.reset).toBe(false);
    expect(ids(r.list)).toEqual(ids(range(21, 103)));
  });

  it("내가 보낸 것만 쌓여 있어도 상대 답장이 빠지지 않는다", () => {
    const have = [...range(1, 40), { id: 45 }]; // 45 = 방금 보낸 것
    const page = range(10, 49);
    expect(ids(absorbDmPage(have, page, true).list)).toEqual(ids(range(1, 49)));
  });

  it("오래 비워 겹치지 않으면 최신부터 새로 (사이가 비었을 수 있다)", () => {
    const r = absorbDmPage(range(1, 40), range(200, 239), true);
    expect(r.reset).toBe(true);
    expect(ids(r.list)).toEqual(ids(range(200, 239)));
  });

  it("겹치지 않아도 그 앞에 더 없으면 그냥 이어 붙인다", () => {
    const r = absorbDmPage(range(1, 3), range(4, 6), false);
    expect(r.reset).toBe(false);
    expect(ids(r.list)).toEqual(ids(range(1, 6)));
  });

  it("빈 페이지(대화 나가기 뒤 등)는 가진 것 유지", () => {
    expect(ids(absorbDmPage(range(1, 3), [], false).list)).toEqual([1, 2, 3]);
  });
});
