import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import { GYM_NOTICES } from "@/data/gymNotices";
import {
  NOTICE_MAX,
  NOTICE_TAB_MS,
  gymNoticesFor,
  msToNextTurn,
  noticeQrUrl,
  tv2TurnAt,
  type GymNotice,
} from "./gymNotices";
import { APP_ORIGIN, sceneIndexAt } from "./appValueReel";
import { TIMER_PRESETS } from "./boxingTimer";
import { maxMileageUse } from "./mileagePay";
import {
  BIG5_ITEMS,
  BIG5_NAMES,
  PREF_ITEMS,
  STYLE_REWARD_GEMS,
  TYPE_ITEMS,
} from "../../supabase/functions/_shared/memberStyle.ts";

const SUNREUNG = "153복싱짐 선릉역점";
const TODAY = "2026-11-26";

/** TV 글 폭 어림 — 가치 전달 시험(appValueReel.test.ts)과 같은 셈: 한글 1칸 · 숫자 · 영문 0.58 · 빈칸 0.3 · 가운뎃점 0.5 · 꺾쇠 1 */
const units = (t: string) => {
  let u = 0;
  for (const ch of t) {
    if (/[ㄱ-ㆎ가-힣「」]/.test(ch)) u += 1;
    else if (ch === " ") u += 0.3;
    else if (ch === "·") u += 0.5;
    else if (/[,!:.]/.test(ch)) u += 0.35;
    else u += 0.58;
  }
  return u;
};

/** 153 브랜드 금칙 — 가치 전달 시험과 같은 목록 */
const BANNED =
  /국가대표|태릉|선수 ?출신|프로 ?출신|엘리트|메달|최고|프리미엄|압도적|무조건|보장|확정 ?혜택|벨트|계급|급수|잽부터|끝까지 ?붙|정성을 다|고객 만족|가족 같은|믿고 맡겨|년 전통|오삼코치|오사미|—|–|100%|건강 나이|일오삼|실패|밀린|못 ?했|못한/;

const visualText = (n: GymNotice): string[] => {
  const v = n.visual;
  switch (v.kind) {
    case "shower":
      return [v.status];
    case "style":
      return [v.title, ...v.bars.map((b) => b.label), v.foot];
    case "timer":
      return [v.preset, v.clock, v.round, v.sub];
    case "pass":
      return [v.nowLabel, v.nowSub, v.nextLabel, v.nextSub];
  }
};
const allText = (n: GymNotice) => [n.tag, n.kicker, ...n.hook, n.answer, ...n.proofs, n.ease, ...(n.qr?.caption ?? []), ...visualText(n)];

describe("TV 2번 「체육관 공지사항」 — 시간표", () => {
  it("공지가 없으면 늘 가치 전달 · 장면은 1분마다(예전 그대로)", () => {
    expect(tv2TurnAt(0, 0)).toEqual({ tab: "value", round: 0 });
    expect(tv2TurnAt(NOTICE_TAB_MS * 7 + 5, 0)).toEqual({ tab: "value", round: 7 });
    expect(msToNextTurn(NOTICE_TAB_MS * 3 + 20_000, 0)).toBe(40_000);
  });

  it("공지 4장: 짝수 분 = 가치 전달(두 분에 한 장면) · 홀수 분 = 공지 15초씩", () => {
    expect(tv2TurnAt(0, 4)).toEqual({ tab: "value", round: 0 });
    expect(tv2TurnAt(NOTICE_TAB_MS + 1_000, 4)).toEqual({ tab: "notice", index: 0, startedAt: NOTICE_TAB_MS, ms: 15_000 });
    expect(tv2TurnAt(NOTICE_TAB_MS + 15_000, 4)).toMatchObject({ tab: "notice", index: 1, startedAt: NOTICE_TAB_MS + 15_000 });
    expect(tv2TurnAt(NOTICE_TAB_MS * 2 - 1, 4)).toMatchObject({ tab: "notice", index: 3 });
    expect(tv2TurnAt(NOTICE_TAB_MS * 2, 4)).toEqual({ tab: "value", round: 1 });
    expect(tv2TurnAt(NOTICE_TAB_MS * 4 + 30, 4)).toEqual({ tab: "value", round: 2 });
  });

  it("가치 전달 장면은 빠짐없이 차례대로 — 가치 전달 분마다 다음 장면", () => {
    const seen: number[] = [];
    for (let m = 0; m < 40; m += 1) {
      const turn = tv2TurnAt(m * NOTICE_TAB_MS + 10, 4);
      if (turn.tab === "value") seen.push(sceneIndexAt(m * NOTICE_TAB_MS + 10, 9, 2));
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1]);
    // pace 를 안 주면 예전처럼 1분마다
    expect(sceneIndexAt(NOTICE_TAB_MS * 3 + 1, 9)).toBe(3);
  });

  it("공지 수에 따라 한 장 길이 — 3장 20초 · 1장 1분 · 4장 넘으면 4장까지만", () => {
    expect(tv2TurnAt(NOTICE_TAB_MS + 41_000, 3)).toMatchObject({ tab: "notice", index: 2, ms: 20_000 });
    expect(tv2TurnAt(NOTICE_TAB_MS + 59_000, 1)).toMatchObject({ tab: "notice", index: 0, ms: 60_000 });
    const many = tv2TurnAt(NOTICE_TAB_MS + 59_000, 9);
    expect(many).toMatchObject({ tab: "notice", index: NOTICE_MAX - 1, ms: NOTICE_TAB_MS / NOTICE_MAX });
  });

  it("다음 바뀜까지 — 가치 전달 분은 분 끝까지 · 공지는 다음 공지까지", () => {
    expect(msToNextTurn(5_000, 4)).toBe(55_000);
    expect(msToNextTurn(NOTICE_TAB_MS + 1_000, 4)).toBe(14_000);
    expect(msToNextTurn(NOTICE_TAB_MS + 50_000, 4)).toBe(10_000);
    expect(msToNextTurn(NOTICE_TAB_MS * 2 - 1, 4)).toBe(1);
  });
});

describe("TV 2번 「체육관 공지사항」 — 고르기", () => {
  it("선릉역점: 샤워실 → 성향 검사 → 복싱 타이머 → 수강권 결제 (4장)", () => {
    expect(gymNoticesFor(SUNREUNG, TODAY).map((n) => n.tag)).toEqual(["샤워실", "성향 검사", "복싱 타이머", "수강권 결제"]);
    expect(gymNoticesFor(` ${SUNREUNG} `, TODAY)).toHaveLength(4);
  });

  it("다른 지점 · 지점을 모르면 공지 없음(TV 2번은 예전 그대로)", () => {
    expect(gymNoticesFor("153복싱짐 칠금점", TODAY)).toEqual([]);
    expect(gymNoticesFor("153복싱짐 잠실점", TODAY)).toEqual([]);
    expect(gymNoticesFor("", TODAY)).toEqual([]);
    expect(gymNoticesFor(null, TODAY)).toEqual([]);
  });

  it("기간 — from · until 은 그날 포함 · 지난 공지는 빠지고 5장째부터는 잘린다", () => {
    const base = GYM_NOTICES[0];
    const list: GymNotice[] = [
      { ...base, id: "a", from: "2026-11-27" },
      { ...base, id: "b", until: "2026-11-25" },
      { ...base, id: "c", from: "2026-11-26", until: "2026-11-26" },
      { ...base, id: "d" },
      { ...base, id: "e" },
      { ...base, id: "f" },
      { ...base, id: "g" },
    ];
    expect(gymNoticesFor(SUNREUNG, TODAY, list).map((n) => n.id)).toEqual(["c", "d", "e", "f"]);
    expect(gymNoticesFor(SUNREUNG, "2026-11-27", list).map((n) => n.id)).toEqual(["a", "d", "e", "f"]);
  });
});

describe("TV 2번 「체육관 공지사항」 — 글", () => {
  it("모양 — id 한 번씩 · 제목 두 줄 · 내용 세 줄 · 지점 이름", () => {
    expect(new Set(GYM_NOTICES.map((n) => n.id)).size).toBe(GYM_NOTICES.length);
    for (const n of GYM_NOTICES) {
      expect(n.id).toMatch(/^\d{8}-[a-z0-9-]+$/);
      expect(n.hook).toHaveLength(2);
      expect(n.proofs).toHaveLength(3);
      expect(n.branches.length).toBeGreaterThan(0);
      for (const b of n.branches) expect(b).toMatch(/^153복싱짐 .+점$/);
      if (n.from) expect(n.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (n.until) expect(n.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("153 금칙 · 긴 줄표 · 보이지 않는 문자 · '원' 금액 없음", () => {
    for (const n of GYM_NOTICES) {
      for (const t of allText(n)) {
        expect(t, `${n.id}: ${t}`).not.toMatch(BANNED);
        expect(t, `${n.id}: ${t}`).not.toMatch(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/);
        expect(t, `${n.id}: ${t}`).not.toMatch(/[0-9,]+ ?원/);
        expect(t.trim(), `${n.id}: 앞뒤 빈칸`).toBe(t);
      }
    }
  });

  it("TV 폭 — 2~4m 에서 한 줄로 읽히는 길이(가치 전달 장면과 같은 기준)", () => {
    for (const n of GYM_NOTICES) {
      for (const h of n.hook) expect(units(h), `${n.id} 제목 「${h}」`).toBeLessThanOrEqual(12.5);
      expect(units(n.kicker), `${n.id} 「${n.kicker}」`).toBeLessThanOrEqual(22);
      expect(units(n.answer), `${n.id} 「${n.answer}」`).toBeLessThanOrEqual(18.5);
      for (const p of n.proofs) expect(units(p), `${n.id} 「${p}」`).toBeLessThanOrEqual(23);
      expect(units(n.ease), `${n.id} 「${n.ease}」`).toBeLessThanOrEqual(22);
      for (const c of n.qr?.caption ?? []) expect(units(c), `${n.id} 「${c}」`).toBeLessThanOrEqual(8);
      expect(units(n.tag), `${n.id} 칩`).toBeLessThanOrEqual(6);
      for (const t of visualText(n)) expect(units(t), `${n.id} 그림 「${t}」`).toBeLessThanOrEqual(13);
    }
  });

  it("한 공지 안에서 같은 끝맺음이 이어지지 않는다(한글 AI 티 지우기)", () => {
    for (const n of GYM_NOTICES) {
      const ends = [n.answer, ...n.proofs, n.ease].map((s) => s.replace(/[?.!]$/, "").slice(-2));
      for (let i = 1; i < ends.length; i += 1) expect(ends[i], `${n.id} 끝맺음 「${ends[i]}」`).not.toBe(ends[i - 1]);
    }
  });

  it("샤워실 — 대표님 말 그대로(최신형 · 린나이 · 대용량 · 끊김 해결) · 앱 QR 없이", () => {
    const n = GYM_NOTICES.find((x) => x.tag === "샤워실")!;
    const text = allText(n).join(" ");
    for (const w of ["최신형", "린나이", "대용량", "온수", "끊기지 않아요"]) expect(text).toContain(w);
    expect(n.qr).toBeUndefined();
  });

  it("앱 기능 공지의 숫자는 코드 값과 같다 — 성향 검사 문항 · 챔피언 머니 · 타이머 틀 · 마일리지 10%", () => {
    const style = GYM_NOTICES.find((x) => x.tag === "성향 검사")!;
    const items = TYPE_ITEMS.length + BIG5_ITEMS.length + PREF_ITEMS.length;
    expect(style.proofs.join(" ")).toContain(`${items}문항`);
    expect(style.proofs.join(" ")).toContain(`챔피언 머니 ${STYLE_REWARD_GEMS.toLocaleString("ko-KR")}`);
    if (style.visual.kind !== "style") throw new Error("style");
    const names = Object.values(BIG5_NAMES);
    for (const b of style.visual.bars) expect(names).toContain(b.label);
    expect(style.qr?.path).toBe("/mypage/attendance?style=1");

    const timer = GYM_NOTICES.find((x) => x.tag === "복싱 타이머")!;
    if (timer.visual.kind !== "timer") throw new Error("timer");
    const free = TIMER_PRESETS[0];
    expect(timer.visual.preset).toBe(free.name);
    expect(timer.visual.sub).toBe(free.sub);
    expect(timer.visual.rounds).toBe(free.s.rounds);
    expect(timer.visual.clock).toBe(`${Math.floor(free.s.roundSec / 60)}:${String(free.s.roundSec % 60).padStart(2, "0")}`);
    expect(timer.qr?.path).toBe("/missions?timer=1");

    const pass = GYM_NOTICES.find((x) => x.tag === "수강권 결제")!;
    expect(pass.proofs.join(" ")).toContain("10%");
    // 한 번 결제에 결제 금액의 10%까지(1,000점 단위) — 넉넉히 가진 회원이 22만 원 수강권을 결제할 때
    expect(maxMileageUse(1_000_000, 220_000)).toBe(22_000);
    expect(pass.qr?.path).toBe("/membership");
  });

  it("QR — 앱 주소 하나 · 어디서 왔는지 표시", () => {
    for (const n of GYM_NOTICES) {
      if (!n.qr) continue;
      expect(n.qr.path.startsWith("/")).toBe(true);
      const url = noticeQrUrl(n.qr.path);
      expect(url.startsWith(`${APP_ORIGIN}/`)).toBe(true);
      expect(url).toMatch(/[?&]from=tv-notice$/);
    }
    expect(noticeQrUrl("/membership")).toBe(`${APP_ORIGIN}/membership?from=tv-notice`);
    expect(noticeQrUrl("/missions?timer=1")).toBe(`${APP_ORIGIN}/missions?timer=1&from=tv-notice`);
  });
});
