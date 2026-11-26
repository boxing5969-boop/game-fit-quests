import { describe, expect, it } from "vitest";
import {
  DEMO_DAYS,
  GUIDE_COPY,
  GUIDE_STEP_COUNT,
  dailyPerkItems,
  dailyPerkLine,
  demoActionLabel,
  demoDays,
  demoReward,
  getGuideGate,
  guideDue,
  guideHoldsLetters,
  guideLeagues,
  guidePerks,
  isGuideAudience,
  isMasterProgress,
  leagueRowNote,
  levelUpReward,
  parseGuideStatus,
  setGuideGate,
  subscribeGuideGate,
  wantsGuideFromUrl,
} from "./levelGuide";

const RULES = [
  { rank: "white", firstLevel: 1, lastLevel: 10, visitsPerLevel: 3, minDaysPerLevel: 0, autoAdvance: true, levelAuthority: "coach", titleAuthority: "manager" },
  { rank: "blue", firstLevel: 11, lastLevel: 20, visitsPerLevel: 5, minDaysPerLevel: 0, autoAdvance: true, levelAuthority: "coach", titleAuthority: "manager" },
  { rank: "red", firstLevel: 21, lastLevel: 30, visitsPerLevel: 8, minDaysPerLevel: 0, autoAdvance: false, levelAuthority: "coach", titleAuthority: "owner" },
  { rank: "black", firstLevel: 31, lastLevel: 40, visitsPerLevel: 20, minDaysPerLevel: 45, autoAdvance: false, levelAuthority: "manager", titleAuthority: "owner" },
];
const MILEAGE = { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 };

describe("레벨업 안내 — 5장", () => {
  it("화면 5장 · 표현은 트레이닝 일차 (도장 · 출석하면 레벨업 아님)", () => {
    expect(GUIDE_STEP_COUNT).toBe(5);
    const all = JSON.stringify(GUIDE_COPY) + [0, 1, 2].map((n) => demoActionLabel(n)).join(" ");
    expect(all).not.toMatch(/도장|출석하면|벨트|계급|국가대표/);
    expect(GUIDE_COPY.days.title).toContain("1일차");
    // 줄표(—)는 회원 글에 쓰지 않는다 (im-not-ai)
    expect(all).not.toContain("—");
  });

  it("이름이 있으면 인사에 넣는다", () => {
    expect(GUIDE_COPY.why.kicker("민수")).toBe("민수님, 반가워요");
    expect(GUIDE_COPY.why.kicker("  ")).toBe("반가워요");
    expect(GUIDE_COPY.why.kicker(null)).toBe("반가워요");
  });
});

describe("2장 연습 — 화이트 레벨 1의 3일", () => {
  it("단추 글 — 1일차 → 2일차 → 3일차 → 끝(null)", () => {
    expect(DEMO_DAYS).toBe(3);
    expect(demoActionLabel(0)).toBe("1일차 트레이닝 해 보기");
    expect(demoActionLabel(2)).toBe("3일차 트레이닝 해 보기");
    expect(demoActionLabel(3)).toBeNull();
  });

  it("일차 칸 — 해 본 날까지 차고 마지막 날이 오늘 · 홈 카드와 같은 1 · 2 · 3일차", () => {
    expect(demoDays(0).map((s) => s.state)).toEqual(["next", "todo", "todo"]);
    expect(demoDays(1).map((s) => s.state)).toEqual(["today", "next", "todo"]);
    expect(demoDays(3).map((s) => s.state)).toEqual(["done", "done", "today"]);
    expect(demoDays(3).map((s) => s.day)).toEqual([1, 2, 3]);
    expect(demoDays(9)).toHaveLength(3);
  });

  it("레벨 2 보상 — 홈 보상 상자와 같은 셈 · 받았어요", () => {
    const r = demoReward(MILEAGE);
    expect(r.label).toBe("레벨 2 달성 보상");
    expect(r.received).toBe(true);
    expect(r.items.map((it) => `${it.name} ${it.value}`)).toEqual(["XP +50", "챔피언 머니 +500", "마일리지 +300"]);
    expect(demoReward({ ...MILEAGE, enabled: false }).items).toHaveLength(2);
  });
});

describe("3장 리그 — 서버 규칙 그대로", () => {
  it("리그마다 필요한 날 · 자동 / 지도진 승급 · 블랙 45일", () => {
    const rows = guideLeagues(RULES);
    expect(rows.map((r) => [r.name, r.range, r.days, r.auto])).toEqual([
      ["화이트 리그", "레벨 1~10", 3, true],
      ["블루 리그", "레벨 11~20", 5, true],
      ["레드 리그", "레벨 21~30", 8, false],
      ["블랙 리그", "레벨 31~40", 20, false],
    ]);
    expect(rows.map(leagueRowNote)).toEqual([
      "자동 레벨업",
      "자동 레벨업",
      "담당 코치님이 보고 승급",
      "지점장·관장님이 보고 승급 · 레벨마다 45일 이상",
    ]);
  });

  it("규칙을 못 읽으면 기본값 3 · 5 · 8 · 20", () => {
    expect(guideLeagues(undefined).map((r) => r.days)).toEqual([3, 5, 8, 20]);
    expect(guideLeagues(null).map((r) => r.auto)).toEqual([true, true, false, false]);
  });
});

describe("4장 보상", () => {
  it("레벨업 보상 상자 · 쓰는 곳 · 날마다 쌓이는 것", () => {
    expect(levelUpReward(MILEAGE).label).toBe("레벨업 보상");
    expect(guidePerks(MILEAGE).map((p) => p.name)).toEqual(["마일리지", "챔피언 머니", "리그 승급"]);
    expect(guidePerks(MILEAGE)[0].text).toContain("10%까지");
    expect(guidePerks({ ...MILEAGE, enabled: false }).map((p) => p.name)).toEqual(["챔피언 머니", "리그 승급"]);
    expect(dailyPerkLine(MILEAGE)).toBe("트레이닝한 날마다 챔피언 머니 +100 · 마일리지 +300도 바로 쌓여요");
    expect(dailyPerkLine(null)).toBe("트레이닝한 날마다 챔피언 머니 +100도 바로 쌓여요");
    expect(dailyPerkItems(MILEAGE).map((it) => `${it.icon} ${it.value}`)).toEqual(["money +100", "coin +300"]);
  });
});

describe("누구에게 · 언제", () => {
  it("회원만 — 관리자 · 지도진 · 마스터 · 로그아웃은 아님", () => {
    const base = { signedIn: true, isAdmin: false, isStaff: false, isMaster: false };
    expect(isGuideAudience(base)).toBe(true);
    expect(isGuideAudience({ ...base, isAdmin: true })).toBe(false);
    expect(isGuideAudience({ ...base, isStaff: true })).toBe(false);
    expect(isGuideAudience({ ...base, isMaster: true })).toBe(false);
    expect(isGuideAudience({ ...base, signedIn: false })).toBe(false);
  });

  it("마스터 — 블랙 레벨 10 + 타이틀매치 넷 · 마스터 로드", () => {
    expect(isMasterProgress({ current_rank: "black", current_level: 10, bosses_cleared: 4 })).toBe(true);
    expect(isMasterProgress({ current_rank: "black", current_level: 10, bosses_cleared: 3 })).toBe(false);
    expect(isMasterProgress({ current_rank: "white", current_level: 2, master_track_unlocked: true, master_level: 1 })).toBe(true);
    expect(isMasterProgress(null)).toBe(false);
  });

  it("서버 기록 읽기 — 이상한 모양은 '안 봄'", () => {
    expect(parseGuideStatus({ seen: true, done: true, skipped: false, max_step: 4, opens: 2 })).toEqual({
      seen: true,
      done: true,
      skipped: false,
      maxStep: 4,
      opens: 2,
    });
    expect(parseGuideStatus(null)).toEqual({ seen: false, done: false, skipped: false, maxStep: 0, opens: 0 });
    expect(parseGuideStatus({ seen: "yes", max_step: "x" }).seen).toBe(false);
  });

  it("띄울 차례 — 서버가 정본 · 못 읽으면 이 기기 기록 · 읽는 중 · 이번 접속에 띄웠으면 아님", () => {
    const unseen = parseGuideStatus({ seen: false });
    const seen = parseGuideStatus({ seen: true });
    const base = { audience: true, status: unseen, localSeen: false, shownThisSession: false };
    expect(guideDue(base)).toBe(true);
    expect(guideDue({ ...base, status: seen })).toBe(false);
    expect(guideDue({ ...base, status: null })).toBe(false);
    expect(guideDue({ ...base, status: "error" })).toBe(true);
    expect(guideDue({ ...base, status: "error", localSeen: true })).toBe(false);
    expect(guideDue({ ...base, shownThisSession: true })).toBe(false);
    expect(guideDue({ ...base, audience: false })).toBe(false);
    // 서버에 '안 봄'이면 이 기기 기록과 상관없이 띄운다 (다른 계정이 같은 폰을 쓴 경우)
    expect(guideDue({ ...base, localSeen: true })).toBe(true);
  });

  it("주소로 열기 — ?guide=level", () => {
    expect(wantsGuideFromUrl("?guide=level")).toBe(true);
    expect(wantsGuideFromUrl("?lvdemo=4&guide=level")).toBe(true);
    expect(wantsGuideFromUrl("?guide=other")).toBe(false);
    expect(wantsGuideFromUrl("")).toBe(false);
  });
});

describe("편지와 순서 — 안내가 먼저, 띄운 접속의 편지는 다음 접속에", () => {
  it("확인 중 · 띄울 차례 · 띄우는 중 · 띄웠음이면 편지가 기다린다", () => {
    expect(["checking", "due", "showing", "shown"].every((g) => guideHoldsLetters(g as never))).toBe(true);
    expect(guideHoldsLetters("clear")).toBe(false);
    expect(guideHoldsLetters("idle")).toBe(false);
  });

  it("상태가 바뀌면 구독자에게 알린다 (같은 값이면 조용히)", () => {
    const seen: string[] = [];
    const off = subscribeGuideGate(() => seen.push(getGuideGate()));
    setGuideGate("checking");
    setGuideGate("checking");
    setGuideGate("clear");
    off();
    setGuideGate("idle");
    expect(seen).toEqual(["checking", "clear"]);
    expect(getGuideGate()).toBe("idle");
  });
});
