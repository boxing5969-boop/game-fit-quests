import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHEER_HEADLINE,
  CHEER_LINES,
  LEAGUE_VISITS,
  LEVELUP_MONEY_APPROVAL,
  LEVELUP_MONEY_AUTO,
  LEVELUP_XP,
  cheerMood,
  dayNumber,
  kstDay,
  leagueRoad,
  levelDayOffset,
  levelLabel,
  leveledUpToday,
  nextLeagueLabel,
  questCheerLine,
  questHero,
  questReward,
  questStamps,
  usesStamps,
  type CheerMoodInput,
  type QuestHeroInput,
} from "./levelQuest";

// 홈 「다음 레벨까지」 레벨 퀘스트 (2026-11-18 대표님 「1일차 수업 2일차 수업 3일차 수업 반복은 천재를 만든다 … 레벨업 하는재미」)

describe("153 수업 일차 — 레벨마다 이어서 센다", () => {
  it("화이트 = 한 레벨 3일 · 블루 5일 · 레드 8일 · 블랙 20일 (서버 level_visit_requirement 와 같은 값)", () => {
    expect(LEAGUE_VISITS).toEqual({ white: 3, blue: 5, red: 8, black: 20 });
    expect(levelDayOffset("white", 1)).toBe(0);
    expect(levelDayOffset("white", 2)).toBe(3);
    expect(levelDayOffset("white", 10)).toBe(27);
    expect(levelDayOffset("blue", 1)).toBe(30);
    expect(levelDayOffset("blue", 3)).toBe(40);
    expect(levelDayOffset("red", 1)).toBe(80);
    expect(levelDayOffset("black", 1)).toBe(160);
    expect(levelDayOffset("black", 10)).toBe(340); // 블랙 레벨 10의 마지막 칸 = 360일차
  });

  it("153 수업 매뉴얼(level_lesson_days.day_no)과 같은 셈 — 레벨 1 = 1~3일차, 레벨 2 = 4~6일차", () => {
    const days = (lv: number) => questStamps({ league: "white", level: lv, req: 3, progressFloor: 0, attendedToday: false, leveledUpToday: false }).map((s) => s.day);
    expect(days(1)).toEqual([1, 2, 3]);
    expect(days(2)).toEqual([4, 5, 6]);
    expect(days(4)).toEqual([10, 11, 12]);
  });

  it("모르는 리그는 화이트 · 레벨은 1~10 안으로", () => {
    expect(levelDayOffset("gold", 3)).toBe(6);
    expect(levelDayOffset("white", 0)).toBe(0);
    expect(levelDayOffset("white", 15)).toBe(27);
    expect(levelDayOffset("BLUE", 2)).toBe(35);
  });

  it("서버 규칙 파일과 같은 값 — 출석 수 · 레벨업 보상 (서버가 바뀌면 이 시험이 알린다)", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const latest = (fn: string) => {
      const hit = files.filter((f) =>
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b`, "i").test(readFileSync(`supabase/migrations/${f}`, "utf8")),
      );
      return readFileSync(`supabase/migrations/${hit[hit.length - 1]}`, "utf8");
    };
    const visits = latest("level_visit_requirement");
    for (const [rank, n] of Object.entries(LEAGUE_VISITS)) expect(visits).toMatch(new RegExp(`when '${rank}'\\s+then ${n}`));
    const auto = latest("auto_advance_from_attendance");
    expect(auto).toContain(`values (_user_id, ${LEVELUP_XP}, '레벨업 보상 (출석 자동 승급)')`);
    expect(auto).toContain(`grant_gems(_user_id, ${LEVELUP_MONEY_AUTO}, '레벨업 보상 (출석 자동 승급)')`);
    const approve = latest("approve_level_review");
    expect(approve).toContain(`values (_member_id, ${LEVELUP_XP}, '레벨업 승인 보상')`);
    expect(approve).toContain(`grant_gems(_member_id, ${LEVELUP_MONEY_APPROVAL}, '레벨업 승인 보상')`);
  });
});

describe("수업 도장 칸", () => {
  const base = { league: "white", level: 4, req: 3, attendedToday: false, leveledUpToday: false };

  it("채운 칸 · 다음 칸 · 남은 칸 — 채운 칸 = 진행도 내림값(판정 숫자)", () => {
    expect(questStamps({ ...base, progressFloor: 1, progress: 1 })).toEqual([
      { day: 10, state: "done", partial: 0 },
      { day: 11, state: "next", partial: 0 },
      { day: 12, state: "todo", partial: 0 },
    ]);
    expect(questStamps({ ...base, progressFloor: 0 }).map((s) => s.state)).toEqual(["next", "todo", "todo"]);
  });

  it("오늘 왔으면 마지막으로 채운 칸이 「오늘」 · 운동 종료 보너스는 다음 칸에 미리 찬 몫", () => {
    expect(questStamps({ ...base, progressFloor: 2, progress: 2.25, attendedToday: true })).toEqual([
      { day: 10, state: "done", partial: 0 },
      { day: 11, state: "today", partial: 0 },
      { day: 12, state: "next", partial: 0.25 },
    ]);
  });

  it("오늘 레벨이 올랐으면 오늘 출석은 지난 레벨 몫 — 이번 레벨 칸에 「오늘」이 없다", () => {
    const s = questStamps({ ...base, level: 5, progressFloor: 0, progress: 0, attendedToday: true, leveledUpToday: true });
    expect(s.map((x) => x.state)).toEqual(["next", "todo", "todo"]);
    expect(s.map((x) => x.day)).toEqual([13, 14, 15]);
  });

  it("요건을 넘긴 진행도(심사 대기 중 더 온 출석)는 칸을 넘치지 않는다 · 다음 칸 없음", () => {
    const s = questStamps({ ...base, progressFloor: 5, progress: 5.5 });
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.state === "done")).toBe(true);
    expect(s.some((x) => x.partial > 0)).toBe(false);
  });

  it("칸 수는 서버 요건 그대로 · 1 ~ 20칸 · 이상한 값은 다듬는다", () => {
    expect(questStamps({ ...base, league: "blue", level: 3, req: 5, progressFloor: 2 }).map((s) => s.day)).toEqual([41, 42, 43, 44, 45]);
    expect(questStamps({ ...base, league: "black", level: 1, req: 20, progressFloor: 0 })).toHaveLength(20);
    expect(questStamps({ ...base, req: 50, progressFloor: 0 })).toHaveLength(20);
    expect(questStamps({ ...base, req: 0, progressFloor: 0 })).toHaveLength(1);
    expect(questStamps({ ...base, req: Number.NaN, progressFloor: Number.NaN }).map((s) => s.state)).toEqual(["next"]);
    // 진행도를 모르면 보너스 몫 0
    expect(questStamps({ ...base, progressFloor: 1, progress: null })[1].partial).toBe(0);
    expect(questStamps({ ...base, progressFloor: 1, progress: 1.999 })[1].partial).toBe(0.99);
  });
});

describe("오늘 레벨이 올랐나", () => {
  const base = { today: "2026-11-18", globalLevel: 5, sessions: 0, attendedToday: true };

  it("이번 레벨 시작이 오늘(한국) · 오늘 왔고 · 이번 레벨 출석 0", () => {
    expect(leveledUpToday({ ...base, since: "2026-11-18T09:12:00+09:00" })).toBe(true);
    // 한국 자정 넘김 — UTC 로는 전날
    expect(leveledUpToday({ ...base, since: "2026-11-17T15:30:00.000Z" })).toBe(true);
    expect(leveledUpToday({ ...base, since: "2026-11-17T14:59:00.000Z" })).toBe(false);
  });

  it("어제 올랐거나 · 처음 시작한 레벨 · 이번 레벨 출석이 있거나 · 오늘 안 왔으면 아니다", () => {
    const since = "2026-11-18T01:00:00.000Z";
    expect(leveledUpToday({ ...base, since: "2026-11-16T01:00:00.000Z" })).toBe(false);
    expect(leveledUpToday({ ...base, since, globalLevel: 1 })).toBe(false);
    expect(leveledUpToday({ ...base, since, sessions: 1 })).toBe(false);
    expect(leveledUpToday({ ...base, since, attendedToday: false })).toBe(false);
    expect(leveledUpToday({ ...base, since: null })).toBe(false);
    expect(leveledUpToday({ ...base, since: "엉뚱한 값" })).toBe(false);
  });

  it("한국 날짜 · 날 번호", () => {
    expect(kstDay("2026-11-17T15:00:00.000Z")).toBe("2026-11-18");
    expect(kstDay("2026-11-17T14:59:59.000Z")).toBe("2026-11-17");
    expect(kstDay(null)).toBe("");
    expect(kstDay("")).toBe("");
    expect(dayNumber("2026-11-19") - dayNumber("2026-11-18")).toBe(1);
    expect(dayNumber("모름")).toBe(0);
  });
});

describe("주인공 한 줄", () => {
  const base: QuestHeroInput = {
    nextLabel: "레벨 5",
    reachedLabel: "레벨 4",
    visitsLeft: 2,
    daysLeft: 0,
    meets: false,
    needsReview: false,
    pending: false,
    revision: false,
    leveledUpToday: false,
  };

  it("몇 번 더 오면 되는지 — 숫자는 따로(민트 강조)", () => {
    expect(questHero(base)).toEqual({ text: "2번 더 오면 레벨 5", lead: "2번", rest: " 더 오면 레벨 5", tone: "plain" });
    expect(questHero({ ...base, visitsLeft: 3, needsReview: true }).text).toBe("3번 더 오면 승급 심사");
    expect(questHero({ ...base, visitsLeft: 0, daysLeft: 12, needsReview: true })).toMatchObject({ text: "12일 더 지나면 승급 심사", lead: "12일" });
    expect(questHero({ ...base, visitsLeft: 0 }).text).toBe("거의 다 왔어요");
  });

  it("도장을 다 모았으면 — 자동 승급은 다음 출석 때 · 심사 리그는 심사", () => {
    expect(questHero({ ...base, visitsLeft: 0, meets: true })).toMatchObject({ text: "다음 출석 때 레벨 5!", tone: "reward", lead: null });
    expect(questHero({ ...base, visitsLeft: 0, meets: true, needsReview: true }).text).toBe("승급 심사가 열렸어요");
  });

  it("심사 대기 · 보완 요청 · 오늘 레벨업", () => {
    expect(questHero({ ...base, pending: true })).toMatchObject({ text: "승인을 기다려요", tone: "pending" });
    expect(questHero({ ...base, revision: true })).toMatchObject({ text: "보완 요청이 왔어요", tone: "pending" });
    expect(questHero({ ...base, leveledUpToday: true, reachedLabel: "레벨 5", visitsLeft: 3 })).toMatchObject({ text: "레벨 5 달성!", tone: "reward" });
    expect(questHero({ ...base, leveledUpToday: true, reachedLabel: "블루 리그" }).text).toBe("블루 리그 입성!");
  });
});

describe("응원 — 「반복은 천재를 만든다」 + 그날 한 줄", () => {
  const base: CheerMoodInput = {
    globalLevel: 4,
    filled: 1,
    attendedToday: false,
    leveledUpToday: false,
    meets: false,
    needsReview: false,
    pending: false,
    revision: false,
    visitsLeft: 2,
    daysLeft: 0,
  };

  it("대표님 문구 그대로", () => {
    expect(CHEER_HEADLINE).toBe("반복은 천재를 만든다");
  });

  it("상태 → 응원 종류", () => {
    expect(cheerMood(base)).toBe("between");
    expect(cheerMood({ ...base, attendedToday: true })).toBe("today");
    expect(cheerMood({ ...base, filled: 0 })).toBe("fresh");
    expect(cheerMood({ ...base, filled: 0, globalLevel: 1 })).toBe("first");
    expect(cheerMood({ ...base, leveledUpToday: true, filled: 0, attendedToday: true })).toBe("leveledUp");
    expect(cheerMood({ ...base, meets: true, visitsLeft: 0 })).toBe("full");
    expect(cheerMood({ ...base, meets: true, visitsLeft: 0, needsReview: true })).toBe("review");
    expect(cheerMood({ ...base, pending: true })).toBe("review");
    expect(cheerMood({ ...base, revision: true, pending: true })).toBe("revision");
    expect(cheerMood({ ...base, visitsLeft: 0, daysLeft: 9, needsReview: true, filled: 20 })).toBe("days");
  });

  it("날마다 돌아가며 · 같은 날은 같은 말", () => {
    const day1 = questCheerLine("between", { today: "2026-11-18" });
    expect(questCheerLine("between", { today: "2026-11-18" })).toBe(day1);
    const week = new Set(["18", "19", "20", "21", "22", "23", "24"].map((d) => questCheerLine("between", { today: `2026-11-${d}` })));
    expect(week.size).toBe(CHEER_LINES.between.length);
    expect(CHEER_LINES.between).toContain(day1);
    // 날짜를 못 읽어도 말은 나온다
    expect(CHEER_LINES.today).toContain(questCheerLine("today", { today: "" }));
  });

  it("심사 · 보완 · 최소 날수 — 그 상황 말", () => {
    expect(questCheerLine("review", { today: "2026-11-18", reviewer: "담당 코치님" })).toBe("담당 코치님이 보고 승급해요");
    expect(questCheerLine("review", { today: "2026-11-18" })).toBe("코치님이 보고 승급해요");
    expect(questCheerLine("revision", { today: "2026-11-18" })).toBe("더 연습하고 출석하면 다시 심사에 올라가요");
    expect(questCheerLine("days", { today: "2026-11-18", minDays: 45 })).toBe("레벨마다 최소 45일이에요");
  });

  it("한 줄에 들어가게 짧게 · 숫자 없이 · 못한 것 · 빠진 날은 말하지 않는다 · 브랜드 금지어 없음", () => {
    for (const list of Object.values(CHEER_LINES)) {
      for (const line of list) {
        expect(line.length).toBeLessThanOrEqual(17);
        expect(line).not.toMatch(/\d/);
        expect(line).not.toMatch(/실패|못 |못했|빠진|빠졌|놓친|놓쳤|아직도|벌써|왜 안|벨트|계급|국가대표/);
        expect(line).toMatch(/요$|업$/);
      }
    }
  });
});

describe("레벨업 보상", () => {
  const mileage = { enabled: true, level_up: 300, title_match: 2500 };

  it("레벨 1~9 자동 승급 — XP · 챔피언 머니 · 마일리지(운영 설정)", () => {
    expect(questReward({ boss: false, approval: false, nextLeague: "블루 리그", mileage })).toEqual({
      label: "레벨업하면 받아요",
      items: [
        { name: "XP", value: "+50" },
        { name: "챔피언 머니", value: "+500" },
        { name: "마일리지", value: "+300" },
      ],
    });
  });

  it("코치 승인 리그(레드 · 블랙)는 챔피언 머니 +1,000", () => {
    expect(questReward({ boss: false, approval: true, nextLeague: "블랙 리그", mileage }).items[1]).toEqual({ name: "챔피언 머니", value: "+1,000" });
  });

  it("마일리지를 끄거나 못 읽었으면 마일리지 칸 없이", () => {
    expect(questReward({ boss: false, approval: false, nextLeague: "블루 리그", mileage: { ...mileage, enabled: false } }).items).toHaveLength(2);
    expect(questReward({ boss: false, approval: false, nextLeague: "블루 리그", mileage: null }).items).toHaveLength(2);
    expect(questReward({ boss: false, approval: false, nextLeague: "블루 리그", mileage: { ...mileage, level_up: 0 } }).items).toHaveLength(2);
  });

  it("레벨 10 — 다음 리그 · 타이틀매치 마일리지", () => {
    expect(questReward({ boss: true, approval: false, nextLeague: "블루 리그", mileage })).toEqual({
      label: "타이틀매치를 넘으면",
      items: [
        { name: "승급", value: "블루 리그" },
        { name: "마일리지", value: "+2,500" },
      ],
    });
    expect(questReward({ boss: true, approval: true, nextLeague: "마스터 로드", mileage: null }).items).toEqual([{ name: "승급", value: "마스터 로드" }]);
  });
});

describe("도장 · 리그 길 · 이름", () => {
  it("레벨 1~9는 도장 · 레벨 10은 레드 · 블랙만 도장(출석을 채우면 심사)", () => {
    for (let lv = 1; lv <= 9; lv++) expect(usesStamps("white", lv)).toBe(true);
    expect(usesStamps("white", 10)).toBe(false);
    expect(usesStamps("blue", 10)).toBe(false);
    expect(usesStamps("red", 10)).toBe(true);
    expect(usesStamps("black", 10)).toBe(true);
  });

  it("리그 길 — 레벨 1~9 지나옴 + 레벨 10 타이틀매치 (누적 레벨)", () => {
    const white = leagueRoad("white");
    expect(white.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(white.filter((r) => r.state === "goal").map((r) => r.level)).toEqual([10]);
    expect(leagueRoad("blue").map((r) => r.level)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("다음 리그 · 누적 레벨 이름", () => {
    expect(nextLeagueLabel("white")).toBe("블루 리그");
    expect(nextLeagueLabel("red")).toBe("블랙 리그");
    expect(nextLeagueLabel("black")).toBe("마스터 로드");
    expect(levelLabel("blue", 3)).toBe("레벨 13");
    expect(levelLabel("white", 4)).toBe("레벨 4");
  });
});
