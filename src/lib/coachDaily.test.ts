import { describe, expect, it } from "vitest";
import {
  COACH_DAILY_DEMO,
  DAILY_OFF,
  branchLine,
  kstMdHm,
  manualLink,
  mdDow,
  mineLine,
  missionActions,
  missionChips,
  missionName,
  missionProgress,
  missionSay,
  missionTitle,
  monthLine,
  normalizeCoachDaily,
  notifyPreview,
  shortBranchName,
} from "./coachDaily";

// 2026-11-26 운영 DB coach_daily_build(선릉역점, 11/26) 결과 모양 그대로(이름만 가림)
const RAW = {
  on: true,
  role: "admin",
  branch: "153복싱짐 선릉역점",
  day: "2026-11-26",
  preview: true,
  start_date: "2026-12-01",
  has_mine: false,
  report: {
    branch: { day: "2026-11-25", visitors: 37, active: 140, rate: 26.4, first_timers: 2 },
    month: { month: "2026-11", n: 14, renewed: 2, open: 3, target_rate: 70, recent_rate: 23.1, yesterday: null },
  },
  missions: [],
  team: [
    {
      coach: "c-1",
      name: "송코치",
      today: "07:00–09:00",
      sent: false,
      done: 0,
      total: 3,
      mine: { scheduled: true, worked: true, label: "07:00–09:00", visitors: 8, first_timers: 0, contacts: 0, home: 16 },
      missions: [
        { id: "m1", rank: 1, kind: "starter", member: "u1", name: "임○○", real_name: "임○○", reasons: ["gap"], info: { day: 31, gap: 9, goal: 8, count: 7, expected: 8 }, done: false },
        { id: "m2", rank: 2, kind: "manual", book: "book1", chapter: "author", reasons: [], info: { no: "앞글 ①", book: "book1", title: "이 책을 쓴 사람", book_no: "1권", chapter: "author", minutes: 3 }, done: false },
        { id: "m3", rank: 3, kind: "winback", member: "u2", name: "박○○", real_name: "박○○", reasons: ["winback"], info: { end: "2026-11-24", days_since: 2 }, done: true },
      ],
    },
    { coach: "", name: "빈 줄" },
  ],
  last_run: { ran_at: "2026-11-26T21:40:05Z", day: "2026-11-27", error: false },
};

describe("normalizeCoachDaily", () => {
  it("꺼짐 · 이상한 값은 DAILY_OFF", () => {
    expect(normalizeCoachDaily(null)).toEqual(DAILY_OFF);
    expect(normalizeCoachDaily({ on: false, preview: true, start_date: "2026-12-01" })).toMatchObject({ on: false, preview: true, startDate: "2026-12-01" });
    expect(normalizeCoachDaily("x").on).toBe(false);
  });

  it("관리자 미리보기 — 지점 숫자 · 코치님별 미션", () => {
    const d = normalizeCoachDaily(RAW);
    expect(d.on).toBe(true);
    expect(d.role).toBe("admin");
    expect(d.preview).toBe(true);
    expect(d.stats).toEqual({ day: "2026-11-25", visitors: 37, active: 140, rate: 26.4, firstTimers: 2 });
    expect(d.month).toMatchObject({ month: "2026-11", n: 14, renewed: 2, targetRate: 70, recentRate: 23.1 });
    expect(d.team).toHaveLength(1); // 코치 아이디 없는 줄은 버린다
    const t = d.team![0];
    expect(t.mine?.visitors).toBe(8);
    expect(t.missions.map((m) => m.kind)).toEqual(["starter", "manual", "winback"]);
    expect(t.missions[1]).toMatchObject({ book: "book1", chapter: "author" });
    expect(d.lastRun).toEqual({ ranAt: "2026-11-26T21:40:05Z", error: false });
  });

  it("알 수 없는 미션 종류 · id 없는 미션은 버리고 순서대로", () => {
    const d = normalizeCoachDaily({
      on: true,
      missions: [
        { id: "b", rank: 2, kind: "first", member: "u" },
        { id: "a", rank: 1, kind: "expiring", member: "u2", info: { days_left: "3" } },
        { id: "z", rank: 3, kind: "party" },
        { rank: 4, kind: "manual" },
      ],
    });
    expect(d.missions.map((m) => m.id)).toEqual(["a", "b"]);
    expect(d.missions[0].info.daysLeft).toBe(3);
    expect(d.role).toBe("coach");
  });
});

describe("미션 글", () => {
  const t = normalizeCoachDaily(RAW).team![0];
  const [starter, manual, winback] = t.missions;

  it("제목 · 칩 · 할 말", () => {
    expect(missionTitle(starter)).toBe("신규 31일째");
    expect(missionChips(starter)).toEqual(["첫 4주 7/8번", "9일 안 옴"]);
    expect(missionSay(starter)).toContain("다음에 올 날");
    expect(missionTitle(manual)).toBe("매뉴얼 1권 앞글 ①");
    expect(missionChips(manual)).toEqual(["3분"]);
    expect(missionSay(manual)).toBe("「이 책을 쓴 사람」 읽고 서명하기");
    expect(missionTitle(winback)).toBe("끝난 지 2일");
    expect(missionSay(winback)).toContain("다시 보고 싶어요");
  });

  it("기간 임박 — 첫 수강권 · 오늘 끝", () => {
    const d = normalizeCoachDaily({
      on: true,
      missions: [
        { id: "a", rank: 1, kind: "expiring", member: "u", name: "안면무료개방", real_name: "강○○", info: { days_left: 3, first_term: true } },
        { id: "b", rank: 2, kind: "expiring", member: "u2", name: "이○○", info: { days_left: 0 } },
      ],
    });
    const [a, b] = d.missions;
    expect(missionTitle(a)).toBe("수강권 D-3");
    expect(missionChips(a)).toEqual(["첫 수강권"]);
    expect(missionSay(a)).toContain("처음보다 좋아진 것");
    expect(missionName(a)).toBe("강○○(안면무료개방)"); // 별명이 이름과 다르면 이름부터
    expect(missionTitle(b)).toBe("오늘 수강권 끝");
    expect(missionName(b)).toBe("이○○");
  });

  it("단추 — 회원 미션은 이야기함 · 안내 보냄(주제는 지도자 홈과 같게), 매뉴얼은 바로 그 장", () => {
    expect(missionActions(starter).map((a) => [a.kind, a.topic])).toEqual([
      ["talk", "starter"],
      ["notice", "starter"],
    ]);
    expect(missionActions(winback)[0].topic).toBe("winback");
    expect(missionActions(manual)).toEqual([]);
    expect(manualLink(manual)).toBe("/office?tab=manual&ch=author");
    expect(manualLink({ ...manual, book: "book2", chapter: "b2_prep" })).toBe("/office?tab=manual&book=book2&ch=b2_prep");
    expect(manualLink(starter)).toBeNull();
  });

  it("진행", () => {
    expect(missionProgress(t.missions)).toEqual({ done: 1, total: 3 });
  });
});

describe("숫자 줄 · 알림 미리보기", () => {
  const d = normalizeCoachDaily(RAW);
  const mine = d.team![0].mine;

  it("지점 · 내 시간 · 이번 달", () => {
    expect(shortBranchName("153복싱짐 선릉역점")).toBe("선릉");
    expect(branchLine(d.stats, d.branch)).toBe("어제 선릉 37명 출석 · 활동 회원 140명 중 26% · 첫 출석 2명");
    expect(mineLine(mine)).toBe("어제 내 시간(07:00–09:00) 8명");
    expect(mineLine({ ...mine!, worked: false })).toContain("출근 기록이 없어");
    expect(mineLine({ ...mine!, worked: false, scheduled: false })).toBe("어제는 근무가 없었어요");
    expect(monthLine(d.month)).toBe("11월 재등록 2/14명 · 70%까지 8명 더");
    expect(monthLine({ ...d.month!, renewed: 10 })).toBe("11월 재등록 10/14명 · 목표 달성");
    expect(monthLine({ ...d.month!, n: 0 })).toBeNull();
  });

  it("DB coach_daily_send 와 같은 알림 글", () => {
    expect(notifyPreview(d.branch, d.stats, d.month, mine, 3)).toEqual({
      title: "📊 어제 선릉 37명 출석 · 오늘 미션 3개",
      body: "어제 내 시간 8명 · 11월 재등록 목표까지 8명",
    });
    expect(notifyPreview(d.branch, d.stats, d.month, { ...mine!, worked: false }, 2).body).toBe("11월 재등록 목표까지 8명 · 눌러서 오늘 미션 보기");
    expect(notifyPreview(d.branch, d.stats, { ...d.month!, renewed: 12 }, { ...mine!, worked: false }, 0)).toEqual({
      title: "📊 어제 선릉 37명 출석",
      body: "눌러서 어제 숫자 보기",
    });
  });

  it("날짜 글", () => {
    expect(mdDow("2026-12-01")).toBe("12/1(화)");
    expect(kstMdHm("2026-11-26T21:40:05Z")).toBe("11/27 06:40");
    expect(kstMdHm(null)).toBeNull();
  });

  it("예시 화면은 코치 보기", () => {
    expect(COACH_DAILY_DEMO.on).toBe(true);
    expect(COACH_DAILY_DEMO.role).toBe("coach");
    expect(COACH_DAILY_DEMO.missions).toHaveLength(3);
    expect(missionProgress(COACH_DAILY_DEMO.missions)).toEqual({ done: 1, total: 3 });
  });
});
