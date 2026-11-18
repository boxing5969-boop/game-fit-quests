import { describe, expect, it } from "vitest";
import {
  fixChoices,
  fixDayLabel,
  fixDoneText,
  fixEndLabel,
  fixNoticeSub,
  fixNoticeTitle,
  fixable,
  parseWorkoutFix,
  todayFix,
  yesterdayFix,
  type WorkoutFixItem,
} from "@/lib/workoutFix";

// 운동 시간 고치기 (2026-11-19 선릉역점 회원 제안 「깜박잊고 운동종료를 안눌렀는데 12시 지나니까 자동반영」)
//   서버 get_my_workout_fix 값 → 고를 칸(10분) · 안내 글. 규칙은 서버(fix_my_workout_end)에 있다.

const NOW = Date.parse("2026-11-19T02:10:00+09:00");
const yesterday: WorkoutFixItem = {
  day: "2026-11-18",
  today: false,
  startedAt: "2026-11-18T12:04:00.000Z", // 21:04 KST
  defaultMinutes: 66,
  minMinutes: 67,
  maxMinutes: 180,
  until: "2026-11-19T15:00:00.000Z", // 11/20 00:00 KST
};
const today: WorkoutFixItem = {
  day: "2026-11-19",
  today: true,
  startedAt: "2026-11-18T15:05:00.000Z", // 00:05 KST
  defaultMinutes: 66,
  minMinutes: 67,
  maxMinutes: 125,
  until: "2026-11-20T15:00:00.000Z",
};

describe("운동 시간 고치기 — 서버 값 읽기", () => {
  it("모양이 맞는 줄만 · 최근 날 먼저 · 숫자 다듬기", () => {
    const rows = parseWorkoutFix({
      ok: true,
      items: [
        { day: "2026-11-18", today: false, started_at: yesterday.startedAt, default_minutes: 66, min_minutes: 67, max_minutes: 180, until: yesterday.until },
        { day: "2026-11-19", today: true, started_at: today.startedAt, default_minutes: 66, min_minutes: 60, max_minutes: "125", until: today.until },
        { day: "11/18", started_at: yesterday.startedAt },
        { day: "2026-11-17", started_at: "어제" },
        null,
        { day: "2026-11-16", started_at: yesterday.startedAt, max_minutes: 999 },
      ],
    });
    expect(rows.map((r) => r.day)).toEqual(["2026-11-19", "2026-11-18", "2026-11-16"]);
    expect(rows[0]).toMatchObject({ today: true, minMinutes: 67, maxMinutes: 125 }); // 60 → 기본 + 1 아래로는 안 내려감
    expect(rows[2].maxMinutes).toBe(180); // 180 위로는 안 올라감
  });

  it("함수가 없는 DB · 이상한 값 = 빈 목록", () => {
    expect(parseWorkoutFix({ ok: false, items: [] })).toEqual([]);
    expect(parseWorkoutFix(null)).toEqual([]);
    expect(parseWorkoutFix({ items: "x" })).toEqual([]);
  });
});

describe("고를 칸 — 10분 단위", () => {
  it("어제 기록 = 1시간 10분 ~ 3시간 (12칸)", () => {
    const c = fixChoices(yesterday);
    expect(c[0]).toBe(70);
    expect(c[c.length - 1]).toBe(180);
    expect(c).toHaveLength(12);
  });
  it("오늘 기록 = 지난 시간까지만 (125분 → 120분까지)", () => {
    expect(fixChoices(today)).toEqual([70, 80, 90, 100, 110, 120]);
  });
  it("아직 70분이 안 됐으면 칸 없음 → 고칠 것 없음", () => {
    const early = { ...today, maxMinutes: 68 };
    expect(fixChoices(early)).toEqual([]);
    expect(fixable(early, NOW)).toBe(false);
  });
});

describe("어디에 띄우나", () => {
  it("홈 안내 줄 = 어제 기록 · 오늘 밤 12시가 지나면 없음", () => {
    expect(yesterdayFix([today, yesterday], NOW)).toBe(yesterday);
    expect(yesterdayFix([today], NOW)).toBeNull();
    expect(yesterdayFix([yesterday], Date.parse("2026-11-20T00:00:01+09:00"))).toBeNull();
  });
  it("오늘 기록 = 입장 3시간이 지났을 때만 '끝난 시각 고르기'", () => {
    const longToday = { ...today, maxMinutes: 180 };
    expect(todayFix([longToday, yesterday], 200, NOW)).toBe(longToday);
    expect(todayFix([longToday], 180, NOW)).toBeNull(); // 3시간까지는 '운동 종료' 그대로
    expect(todayFix([longToday], null, NOW)).toBeNull();
    expect(todayFix([yesterday], 250, NOW)).toBeNull();
  });
});

describe("글", () => {
  it("끝난 시각 · 날 · 안내", () => {
    expect(fixEndLabel(yesterday.startedAt, 100)).toBe("22:44");
    expect(fixEndLabel(yesterday.startedAt, 180)).toBe("00:04"); // 자정을 넘김
    expect(fixDayLabel("2026-11-18")).toBe("11월 18일(수)");
    expect(fixNoticeTitle(yesterday)).toBe("어제 운동이 기본 1시간 6분으로 기록됐어요");
    expect(fixNoticeSub(yesterday)).toBe("운동 종료를 깜빡했다면 오늘 밤 12시까지 고칠 수 있어요");
    expect(fixDoneText(yesterday, 120, 6)).toBe("어제 운동 2시간으로 기록했어요 · XP +6 🥊");
    expect(fixDoneText(today, 100, 0)).toBe("오늘 운동 1시간 40분으로 기록했어요 🥊");
  });
});
