import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GROWTH_CORNERS, LEGACY_LESSONS, loadGrowthLessons, todayLesson, type GrowthLesson } from "@/data/growthLessons";
import {
  COACH_LINE_MAX,
  COACH_STATE_OFF,
  GROWTH_STAMPS,
  GROWTH_TV_BRANCHES,
  MY_GROWTH_OFF,
  coachLineOf,
  coachSaidLine,
  growthCheckOf,
  growthDaysLine,
  growthFocusOf,
  growthLetter,
  growthStampToast,
  growthTvOn,
  nextStampAfter,
  normalizeCoachState,
  normalizeMyGrowth,
  tvGrowthOf,
  tvSideOf,
} from "./growthStage2";

const SQL = readFileSync("supabase/migrations/20261117013509_growth_stage2.sql", "utf8");
// 153 브랜드 기준 (growthLessons.test.ts 와 같은 낱말 — 편지 서명 '— 153 일동'은 기존 편지와 같은 모양이라 본문 · 제목만 본다)
const BANNED =
  /국가대표|태릉|선수 ?출신|프로 ?출신|엘리트|메달|최고|프리미엄|압도적|무조건|보장|확정 ?혜택|벨트|계급|잽부터|끝까지 ?붙|정성을 다|고객 만족|가족 같은|믿고 맡겨|년 전통|오삼코치|오사미|—/;
/** 감정 설계 — 읽은 날은 누적으로만. 빠진 날 · 끊긴 기록 · 연속을 말하지 않는다 */
const NO_GUILT = /빠진|빠졌|끊긴|끊겼|연속|놓친|놓쳤|못 |안 읽|밀린|실패/;

const tue = async (): Promise<GrowthLesson> => todayLesson("2026-11-17", await loadGrowthLessons("2026-11-17"))!;
const wed = async (): Promise<GrowthLesson> => todayLesson("2026-11-18", await loadGrowthLessons("2026-11-18"))!;

describe("내 읽은 날 · 누적 도장", () => {
  it("서버 값을 믿지 않고 다듬는다 — 꺼짐 · 잡값 · 틀린 날짜", () => {
    for (const raw of [null, undefined, "x", [], {}, { on: false }, { on: "true" }]) expect(normalizeMyGrowth(raw)).toBe(MY_GROWTH_OFF);
    const g = normalizeMyGrowth({
      on: true,
      days: "9",
      next: 10,
      unseen: 0,
      check_from: "2026-11-18",
      read: ["2026-11-16", "2026-11-17", "bad", 7, null, "2026-11-17"],
    });
    expect(g.on).toBe(true);
    expect([g.days, g.next, g.unseen, g.checkFrom]).toEqual([9, 10, null, "2026-11-18"]);
    // 도장 숫자 — 서버가 안 보내면 기본값 · 보내면 그 값(작은 수부터 · 잡값 빼고)
    expect([...g.stamps]).toEqual([10, 30, 100, 365]);
    expect([...normalizeMyGrowth({ on: true, stamps: [200, "50", 0, -1, "x", 50] }).stamps]).toEqual([50, 200]);
    expect([...normalizeMyGrowth({ on: true, stamps: [] }).stamps]).toEqual([]);
    expect([...g.read].sort()).toEqual(["2026-11-16", "2026-11-17"]);
    // 음수 · 소수 · 틀린 첫날
    const odd = normalizeMyGrowth({ on: true, days: -3, next: 30.9, unseen: "10", check_from: "11/18", read: "x" });
    expect([odd.days, odd.next, odd.unseen, odd.checkFrom, odd.read.size]).toEqual([0, 30, 10, null, 0]);
  });

  it("운동 달력 조각 — 켠 지점 회원이고 첫날이 있을 때만", () => {
    expect(growthCheckOf(null)).toBeNull();
    expect(growthCheckOf(MY_GROWTH_OFF)).toBeNull();
    expect(growthCheckOf(normalizeMyGrowth({ on: true, days: 3, read: ["2026-11-17"] }))).toBeNull();
    const c = growthCheckOf(normalizeMyGrowth({ on: true, days: 3, check_from: "2026-11-18", read: ["2026-11-17"] }));
    expect(c?.from).toBe("2026-11-18");
    expect(c?.days.has("2026-11-17")).toBe(true);
  });

  it("서랍 아래 한 줄 — 쌓인 날과 다음 한 걸음만 (0일이면 말이 없다)", () => {
    expect(growthDaysLine(null)).toBeNull();
    expect(growthDaysLine(MY_GROWTH_OFF)).toBeNull();
    expect(growthDaysLine(normalizeMyGrowth({ on: true, days: 0, next: 10 }))).toBeNull();
    expect(growthDaysLine(normalizeMyGrowth({ on: true, days: 9, next: 10 }))).toBe("지금까지 9일 읽었어요 · 10일째에 축하 편지가 와요");
    expect(growthDaysLine(normalizeMyGrowth({ on: true, days: 400 }))).toBe("지금까지 400일 읽었어요");
    expect(growthDaysLine(normalizeMyGrowth({ on: true, days: 1200 }))).toBe("지금까지 1,200일 읽었어요");
    expect(growthDaysLine(normalizeMyGrowth({ on: true, days: 9, next: 10 }))).not.toMatch(NO_GUILT);
  });

  it("도장 — 10 · 30 · 100 · 365 (서버 기본값과 같다) · 다음 도장", () => {
    expect([...GROWTH_STAMPS]).toEqual([10, 30, 100, 365]);
    expect(SQL).toContain("else array[10, 30, 100, 365]");
    expect(SQL).toContain("'stamps', jsonb_build_array(10, 30, 100, 365)");
    expect([0, 9, 10, 29, 30, 100, 364, 365, 999].map((n) => nextStampAfter(n))).toEqual([10, 10, 30, 30, 100, 365, 365, null, null]);
    expect(nextStampAfter(10, [100, 30, 10])).toBe(30);
    expect(growthStampToast(10)).toBe("읽은 날 10일째예요. 축하해요!");
  });

  it("축하 편지 — 숫자마다 다른 글 · 이름 · 다음 편지 · 쓰지 않는 낱말 없음", () => {
    const letters = GROWTH_STAMPS.map((n) => growthLetter("에이", n));
    expect(new Set(letters.map((l) => l.body)).size).toBe(4);
    letters.forEach((l, i) => {
      const n = GROWTH_STAMPS[i];
      expect(l.title).toBe(`1분 성장 ${n}일을 채운\n에이님께`);
      expect(l.eyebrow).toBe(`${n} Days of 1 Minute`);
      expect(l.body).toContain(String(n));
      expect(`${l.title}\n${l.body}\n${l.cta}`).not.toMatch(BANNED);
      expect(`${l.title}\n${l.body}`).not.toMatch(NO_GUILT);
      // 보상 없이 마음만 — 선물 · 포인트를 말하지 않는다
      expect(l.body).not.toMatch(/마일리지|챔피언 머니|선물|보상|지급/);
      expect(l.sign).toBe("— 153 일동");
    });
    expect(letters[0].body).toContain("다음 30일째에 또 편지할게요.");
    expect(letters[2].body).toContain("다음 365일째에 또 편지할게요.");
    expect(letters[3].body).not.toContain("또 편지할게요");
    // 이름이 없으면 '복서' · 설정으로 도장을 바꿔도 다음 편지가 맞다
    expect(growthLetter("  ", 10).title).toContain("복서님께");
    expect(growthLetter("에이", 50, [50, 200]).body).toContain("다음 200일째에 또 편지할게요.");
  });

  it("주소의 ?growth= — 1 = 오늘 · 지난 날짜 = 그날 · 앞날 · 잡값은 없음", () => {
    expect(growthFocusOf(null, "2026-11-18")).toBeNull();
    expect(growthFocusOf("", "2026-11-18")).toBeNull();
    expect(growthFocusOf("1", "2026-11-18")).toEqual({ day: "2026-11-18" });
    expect(growthFocusOf("today", "2026-11-18")).toEqual({ day: "2026-11-18" });
    expect(growthFocusOf("2026-11-17", "2026-11-18")).toEqual({ day: "2026-11-17" });
    expect(growthFocusOf("2026-11-18", "2026-11-18")).toEqual({ day: "2026-11-18" });
    expect(growthFocusOf("2026-11-19", "2026-11-18")).toBeNull();
    expect(growthFocusOf("abc", "2026-11-18")).toBeNull();
  });
});

describe("코치 「오늘의 한마디」", () => {
  it("그날 글의 한 줄 — 코너 · 제목 · O/X 여부", async () => {
    const t = coachLineOf(await tue())!;
    expect(t.line).toBe("링이 왜 ‘링’인지 아세요? 답은 앱 홈에 있어요.");
    expect([t.corner, t.quiz]).toEqual(["복싱 상식 O/X", true]);
    const w = coachLineOf(await wed())!;
    expect([w.corner, w.quiz, w.title]).toEqual(["기술 한 끗", false, "잽은 돌아오는 것까지예요"]);
    expect(coachLineOf(null)).toBeNull();
  });

  it("한 줄이 없는 글이면 '오늘 하나' 제목으로 · 예전 글은 코너 없이", () => {
    const legacy = LEGACY_LESSONS[0];
    const c = coachLineOf(legacy)!;
    expect(c.line).toBe(`오늘 하나, ${legacy.directions[0].title}`);
    expect(c.corner).toBe("");
    const bare: GrowthLesson = { ...legacy, coach: "  ", directions: [] };
    expect(coachLineOf(bare)).toBeNull();
  });

  it("서버 값 다듬기 · 아래 한 줄 — 사람 수만, 단추 글을 되풀이하지 않는다", () => {
    for (const raw of [null, {}, { on: false, mine: true }, "x"]) expect(normalizeCoachState(raw)).toBe(COACH_STATE_OFF);
    expect(normalizeCoachState({ on: true, mine: "yes", count: "3" })).toEqual({ on: true, mine: false, count: 3 });
    expect(coachSaidLine({ on: true, mine: false, count: 0 })).toBe("수업 시작이나 마무리에 한마디, 의무는 아니에요");
    expect(coachSaidLine({ on: true, mine: true, count: 1 })).toBe("오늘 회원님께 한마디가 닿았어요");
    expect(coachSaidLine({ on: true, mine: true, count: 3 })).toBe("오늘 3명이 전했어요");
    expect(coachSaidLine({ on: true, mine: false, count: 2 })).toBe("오늘 2명이 전했어요");
    expect(COACH_LINE_MAX).toBe(40);
  });
});

describe("TV 「오늘의 1분」", () => {
  it("켠 지점 TV 만 — 서버 설정의 지점과 같다", () => {
    expect(growthTvOn("153복싱짐 선릉역점")).toBe(true);
    expect(growthTvOn(" 153복싱짐 선릉역점 ")).toBe(true);
    expect(growthTvOn("153복싱짐 칠금점")).toBe(false);
    expect(growthTvOn("")).toBe(false);
    expect(growthTvOn(undefined)).toBe(false);
    for (const b of GROWTH_TV_BRANCHES) expect(SQL).toContain(`'branches', jsonb_build_array('${b}')`);
  });

  it("사이니지에는 퀴즈를 올리지 않는다 — O/X 날도 다른 날처럼 제목 · 한 줄 · 오늘 하나 (2026-11-17 대표님)", async () => {
    const t = tvGrowthOf(await tue(), "2026-11-17")!;
    expect(t).toEqual({
      corner: "복싱 상식",
      headline: "네모난데 왜 ‘링’일까요",
      sub: "180년 넘게 이어진 이름 이야기",
      actionTitle: "한 사람에게 물어보기",
      actionBody: "같이 운동하는 분께 “링이 왜 링인지 아세요?” 하고 물어보세요.",
      foot: "이야기는 마이복서153 앱 홈에서",
    });
    const w = tvGrowthOf(await wed(), "2026-11-18")!;
    expect([w.corner, w.headline, w.sub]).toEqual(["기술 한 끗", "잽은 돌아오는 것까지예요", "뻗는 것이 반, 돌아오는 것이 반"]);
    expect(w.actionTitle).toBe("거울 앞 잽 10번");
    expect(w.foot).toBe("이야기는 마이복서153 앱 홈에서");
    expect(tvGrowthOf(null, "2026-11-18")).toBeNull();
  });

  it("달 파일의 O/X 글 모두 — TV 글에 문제 · 정답 · O/X 가 없다 (다음 달 글도 저절로)", async () => {
    const months = import.meta.glob<{ default: readonly GrowthLesson[] }>("../data/growth/20??-??.ts", { eager: true });
    const quizDays = Object.values(months).flatMap((m) => m.default.filter((l) => l.quiz));
    expect(quizDays.length).toBeGreaterThanOrEqual(2);
    for (const l of quizDays) {
      const tv = tvGrowthOf(l, l.from)!;
      const text = Object.values(tv).join(" ");
      expect(text).not.toContain(l.quiz!.q);
      expect(text).not.toMatch(/정답|O\/X|[OX]일까요|맞을까요|틀릴까요/);
      expect(tv.corner).toBe("복싱 상식");
    }
  });

  it("예전 글이면 그날 요일 코너로(TV 는 「O/X」 없이) · 오늘 하나가 없어도 그린다", () => {
    const legacy = LEGACY_LESSONS[0];
    expect(tvGrowthOf(legacy, "2026-11-10")!.corner).toBe("복싱 상식");
    const none = tvGrowthOf({ ...legacy, directions: [] }, "2026-11-10")!;
    expect([none.actionTitle, none.actionBody]).toEqual(["", ""]);
  });

  it("TV 오른쪽 칸 — 사전예약이 열린 동안은 플리스만 · 닫히면 「오늘의 1분」 · 둘 다 없으면 칸이 없다", () => {
    expect(tvSideOf(false, false)).toBeNull();
    expect(tvSideOf(true, false)).toBe("goods");
    expect(tvSideOf(false, true)).toBe("growth");
    // 2026-11-17 13시 대표님 「폴리스집업 그대로 나오게」 — 둘 다 있어도 번갈아 보이지 않고 플리스만
    expect(tvSideOf(true, true)).toBe("goods");
  });
});

describe("서버와 같은 말", () => {
  it("월요일 요약의 요일 코너 이름 = 앱의 요일 코너 (일요일부터)", () => {
    const m = SQL.match(/\|\| \(array\[([^\]]+)\]\)\[extract\(dow from _day\)::integer \+ 1\]\s*\$\$/);
    expect(m).toBeTruthy();
    const names = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(names).toEqual([...GROWTH_CORNERS]);
  });

  it("마이그레이션 — 줄을 지우는 문장이 없고, 화면 함수만 로그인한 사람이 부른다", () => {
    const code = SQL.replace(/--[^\n]*/g, "");
    expect(code).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|function)\b/i);
    for (const fn of ["get_my_growth", "mark_my_growth_seen", "growth_coach_state", "growth_coach_say", "growth_mark"]) {
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`));
    }
    for (const fn of ["_growth_conf", "_growth_member", "_growth_stamps", "_growth_check_on", "_growth_weekly", "_cal_check_count"]) {
      expect(code).not.toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to (authenticated|anon)`));
    }
  });
});
