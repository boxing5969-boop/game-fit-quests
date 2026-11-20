import { describe, expect, it } from "vitest";
import {
  FIX_WINDOW_DAYS,
  addDays,
  calendarFix,
  fixChoices,
  fixDayLabel,
  fixDayWord,
  fixDaysAgo,
  fixDoneText,
  fixEndLabel,
  fixLastDay,
  fixNoticeSub,
  fixNoticeTitle,
  fixUntilText,
  fixable,
  kstYmd,
  parseWorkoutFix,
  todayFix,
  yesterdayFix,
  type WorkoutFixItem,
} from "@/lib/workoutFix";

// 운동 시간 고치기 (2026-11-19 선릉역점 회원 제안 「깜박잊고 운동종료를 안눌렀는데 12시 지나니까 자동반영」)
//   2026-11-21 대표님 「운동시간 고르기는 7일까지수정할수있게 해줘」 → 출석한 날부터 7일째 밤 12시까지.
//   서버 get_my_workout_fix 값 → 고를 칸(10분) · 어디에 띄우나 · 안내 글. 규칙은 서버(fix_my_workout_end)에 있다.

const NOW = Date.parse("2026-11-19T02:10:00+09:00");
/** 서버 until = 출석한 날 + 8일 0시(한국) */
const untilOf = (day: string) => new Date(Date.parse(`${addDays(day, FIX_WINDOW_DAYS + 1)}T00:00:00+09:00`)).toISOString();
const yesterday: WorkoutFixItem = {
  day: "2026-11-18",
  today: false,
  startedAt: "2026-11-18T12:04:00.000Z", // 21:04 KST
  defaultMinutes: 66,
  minMinutes: 67,
  maxMinutes: 180,
  until: untilOf("2026-11-18"), // 11/26 00:00 KST
};
const today: WorkoutFixItem = {
  day: "2026-11-19",
  today: true,
  startedAt: "2026-11-18T15:05:00.000Z", // 00:05 KST
  defaultMinutes: 66,
  minMinutes: 67,
  maxMinutes: 125,
  until: untilOf("2026-11-19"),
};
const fourDaysAgo: WorkoutFixItem = {
  day: "2026-11-15",
  today: false,
  startedAt: "2026-11-15T10:30:00.000Z", // 19:30 KST
  defaultMinutes: 66,
  minMinutes: 67,
  maxMinutes: 180,
  until: untilOf("2026-11-15"), // 11/23 00:00 KST
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
        { day: "2026-11-12", started_at: yesterday.startedAt, max_minutes: 999 },
      ],
    });
    expect(rows.map((r) => r.day)).toEqual(["2026-11-19", "2026-11-18", "2026-11-12"]);
    expect(rows[0]).toMatchObject({ today: true, minMinutes: 67, maxMinutes: 125 }); // 60 → 기본 + 1 아래로는 안 내려감
    expect(rows[2].maxMinutes).toBe(180); // 180 위로는 안 올라감
  });

  it("함수가 없는 DB · 이상한 값 = 빈 목록", () => {
    expect(parseWorkoutFix({ ok: false, items: [] })).toEqual([]);
    expect(parseWorkoutFix(null)).toEqual([]);
    expect(parseWorkoutFix({ items: "x" })).toEqual([]);
  });
});

describe("날짜 셈 (한국 시각)", () => {
  it("그날 · 며칠 전 · 더하기", () => {
    expect(kstYmd(NOW)).toBe("2026-11-19");
    expect(kstYmd(Date.parse("2026-11-19T23:59:59+09:00"))).toBe("2026-11-19");
    expect(kstYmd(Date.parse("2026-11-20T00:00:00+09:00"))).toBe("2026-11-20");
    expect(fixDaysAgo("2026-11-19", NOW)).toBe(0);
    expect(fixDaysAgo("2026-11-18", NOW)).toBe(1);
    expect(fixDaysAgo("2026-11-12", NOW)).toBe(7);
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05"); // 달을 넘김
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02"); // 해를 넘김
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

describe("고칠 수 있는 기간 — 출석한 날부터 7일째 밤 12시까지", () => {
  it("마지막 날 = 그날 + 7일 · 그다음 날 0시부터는 못 고침", () => {
    expect(fixLastDay(yesterday)).toBe("2026-11-25");
    expect(fixLastDay({ day: "2026-11-18", until: null })).toBe("2026-11-25"); // until 이 없어도 같은 날
    expect(fixable(yesterday, Date.parse("2026-11-25T23:59:00+09:00"))).toBe(true);
    expect(fixable(yesterday, Date.parse("2026-11-26T00:00:00+09:00"))).toBe(false);
  });
});

describe("어디에 띄우나", () => {
  it("홈 안내 줄 = 어제 기록만 (그 앞 날은 운동 달력)", () => {
    expect(yesterdayFix([today, yesterday, fourDaysAgo], NOW)).toBe(yesterday);
    expect(yesterdayFix([today, fourDaysAgo], NOW)).toBeNull();
    // 다음 날이 되면 그 기록은 '그제' — 안내 줄에서 빠진다(운동 달력에서는 고칠 수 있다)
    expect(yesterdayFix([yesterday], Date.parse("2026-11-20T00:00:01+09:00"))).toBeNull();
  });
  it("오늘 기록 = 입장 3시간이 지났을 때만 '끝난 시각 고르기'", () => {
    const longToday = { ...today, maxMinutes: 180 };
    expect(todayFix([longToday, yesterday], 200, NOW)).toBe(longToday);
    expect(todayFix([longToday], 180, NOW)).toBeNull(); // 3시간까지는 '운동 종료' 그대로
    expect(todayFix([longToday], null, NOW)).toBeNull();
    expect(todayFix([yesterday], 250, NOW)).toBeNull();
  });
  it("운동 달력 그날 카드 = 그날 고칠 기록이 있을 때 · 오늘은 입장 3시간 뒤에만", () => {
    expect(calendarFix([today, yesterday, fourDaysAgo], "2026-11-15", NOW)).toBe(fourDaysAgo);
    expect(calendarFix([today, yesterday, fourDaysAgo], "2026-11-18", NOW)).toBe(yesterday);
    expect(calendarFix([yesterday], "2026-11-16", NOW)).toBeNull(); // 그날 기록 없음
    // 오늘 00:05 입장 · 지금 02:10 (2시간 5분) = 아직 '운동 종료'가 맡는다
    expect(calendarFix([today], "2026-11-19", NOW)).toBeNull();
    const longToday = { ...today, maxMinutes: 180 };
    expect(calendarFix([longToday], "2026-11-19", Date.parse("2026-11-19T03:10:00+09:00"))).toBe(longToday);
    // 7일이 지나면 없음
    expect(calendarFix([fourDaysAgo], "2026-11-15", Date.parse("2026-11-23T00:00:00+09:00"))).toBeNull();
  });
});

describe("글", () => {
  it("끝난 시각 · 날 · 안내", () => {
    expect(fixEndLabel(yesterday.startedAt, 100)).toBe("22:44");
    expect(fixEndLabel(yesterday.startedAt, 180)).toBe("00:04"); // 자정을 넘김
    expect(fixDayLabel("2026-11-18")).toBe("11월 18일(수)");
    expect(fixNoticeTitle(yesterday, NOW)).toBe("어제 운동이 기본 1시간 6분으로 기록됐어요");
    expect(fixNoticeSub(yesterday, NOW)).toBe("운동 종료를 깜빡했다면 11월 25일(수)까지 고칠 수 있어요");
    expect(fixDoneText(yesterday, 120, 6, NOW)).toBe("어제 운동 2시간으로 기록했어요 · XP +6 🥊");
    expect(fixDoneText(today, 100, 0, NOW)).toBe("오늘 운동 1시간 40분으로 기록했어요 🥊");
    expect(fixDoneText(fourDaysAgo, 90, 3, NOW)).toBe("11월 15일(일) 운동 1시간 30분으로 기록했어요 · XP +3 🥊");
  });
  it("날 이름 — 오늘 · 어제 · 그 앞은 날짜", () => {
    expect(fixDayWord(today, NOW)).toBe("오늘");
    expect(fixDayWord(yesterday, NOW)).toBe("어제");
    expect(fixDayWord(fourDaysAgo, NOW)).toBe("11월 15일(일)");
    // 자정을 넘기면 어제 것이 '11월 18일(수)'
    expect(fixDayWord(yesterday, Date.parse("2026-11-20T00:30:00+09:00"))).toBe("11월 18일(수)");
  });
  it("언제까지 — 마지막 날이 오늘 · 내일 · 그 뒤", () => {
    expect(fixUntilText(yesterday, NOW)).toBe("11월 25일(수)까지");
    expect(fixUntilText(yesterday, Date.parse("2026-11-24T10:00:00+09:00"))).toBe("내일 밤 12시까지");
    expect(fixUntilText(yesterday, Date.parse("2026-11-25T10:00:00+09:00"))).toBe("오늘 밤 12시까지");
    expect(fixUntilText(today, NOW)).toBe("11월 26일(목)까지");
  });
});
