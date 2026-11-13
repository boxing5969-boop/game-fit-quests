import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DayChecksPanel from "./CalendarChecks";
import { normalizeCalendar } from "@/lib/calendarChecks";
import type { AttendanceDay } from "@/lib/attendanceHistory";

// 2026-11-12 = 목요일
const cal = normalizeCalendar({
  on: true,
  today: "2026-11-12",
  items: [{ id: "jab", label: "잽", target: 100, unit: "번", weekdays: null, created_on: "2026-11-01" }],
  days: [
    { day: "2026-11-03", cheer: true, journal: { id: "j", content: "첫 미트", mood: "🔥 불태움", visibility: "private" }, done: ["jab"], sticker: "fire" },
  ],
});
const att: AttendanceDay = { day: "2026-11-03", at: "2026-11-03T10:40:00Z", end: null, endSource: null, minutes: 70, method: "face", branch: null };
const noop = () => {};
const base = { today: "2026-11-12", cal, onSticker: noop, onWriteLine: noop, onCheer: noop, onManage: noop };

describe("운동 달력 그날 카드", () => {
  it("오늘 — 아무것도 안 했어도 다음 한 걸음만 · 한 줄 쓰기 · 나만의 체크 누르기", () => {
    const onToggle = vi.fn();
    const onWriteLine = vi.fn();
    render(<DayChecksPanel {...base} day="2026-11-12" attended={null} compact onToggle={onToggle} onWriteLine={onWriteLine} />);
    expect(screen.getByText("하나씩 채우면 금색 별이 돼요")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/못|안 했|놓쳤|빠졌|실패/);
    fireEvent.click(screen.getByRole("button", { name: /한 줄 쓰기/ }));
    expect(onWriteLine).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /잽 100번/ }));
    expect(onToggle).toHaveBeenCalledWith("jab", true);
  });

  it("지난 날(고칠 수 없는 날) — 다 채웠으면 금색 별 · 한 줄 · 스티커는 머리에만 · 누를 칸 없음", () => {
    const onToggle = vi.fn();
    render(<DayChecksPanel {...base} day="2026-11-03" attended={att} onToggle={onToggle} />);
    expect(screen.getByText("금색 별")).toBeTruthy();
    expect(screen.getByText("금색 별을 받은 날이에요")).toBeTruthy();
    expect(screen.getByText(/첫 미트/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /기분 스티커/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /잽 100번/ })).toBeNull(); // 6일보다 앞 — 보기만
    expect(screen.queryByRole("button", { name: /나만의 체크/ })).toBeNull();
  });
});

describe("운동 달력 그날 카드 — (2-3) 코치 한마디 · 그날 한 일 · D-day · 기념일", () => {
  const cal3 = normalizeCalendar({
    on: true,
    today: "2026-11-12",
    items: [],
    days: [],
    acts: [
      { day: "2026-11-10", kind: "pt", coach: "김코치" },
      { day: "2026-11-10", kind: "title", passed: true, rank: "white" },
    ],
    notes: [{ id: "n1", day: "2026-11-12", who: "김코치", title: "코치", body: "오늘 잽 거리가 딱 좋았어요" }],
    anniv: [{ day: "2026-11-12", years: 1, basis: "reg" }],
    ddays: [
      { kind: "goal", id: "g1", day: "2026-11-20", title: "바디프로필" },
      { kind: "pb", day: "2026-11-25" },
    ],
  });
  const b3 = { ...base, cal: cal3, onToggle: noop };

  it("오늘의 체크 한 줄에도 코치 한마디 — 이름 + 한 줄", () => {
    render(<DayChecksPanel {...b3} day="2026-11-12" attended={null} compact />);
    expect(screen.getByText("김코치 코치님")).toBeTruthy();
    expect(screen.getByText("오늘 잽 거리가 딱 좋았어요")).toBeTruthy();
  });

  it("오늘(아직 안 옴) — 기념일 한 줄은 '오늘은 153과 함께한 지 1년이에요'", () => {
    render(<DayChecksPanel {...b3} day="2026-11-12" attended={null} />);
    expect(screen.getByText("오늘은 153과 함께한 지 1년이에요")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/못|안 했|놓쳤|빠졌|실패/);
  });

  it("지난 날 — 그날 한 일(타이틀매치가 먼저) · 안 온 기념일은 말하지 않는다", () => {
    render(<DayChecksPanel {...b3} day="2026-11-10" attended={null} />);
    const lines = screen.getByRole("list", { name: "그날 한 일" }).textContent ?? "";
    expect(lines.indexOf("화이트 타이틀매치 통과")).toBeLessThan(lines.indexOf("PT 수업 · 김코치 코치님"));
    expect(screen.queryByText(/함께한 지/)).toBeNull();
  });

  it("앞날 — D-day 한 줄 · 목표일이 있는 날엔 '이 날을 목표일로' 없음 · 없는 날엔 있음", () => {
    const onGoal = vi.fn();
    const { unmount } = render(<DayChecksPanel {...b3} day="2026-11-20" attended={null} onGoal={onGoal} />);
    expect(screen.getByText("D-8 · 바디프로필")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /이 날을 목표일로/ })).toBeNull();
    unmount();
    render(<DayChecksPanel {...b3} day="2026-11-25" attended={null} onGoal={onGoal} />);
    expect(screen.getByText("D-13 · 153 PB 다시 재는 날")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /이 날을 목표일로/ }));
    expect(onGoal).toHaveBeenCalledWith("2026-11-25");
  });
});

describe("운동 달력 그날 카드 — (2-4) 운동 짝꿍 쌍도장", () => {
  const cal4 = normalizeCalendar({
    on: true,
    today: "2026-11-12",
    items: [],
    days: [],
    partner: { name: "비비", days: [3, 5], slot: "morning", together: ["2026-11-11"] },
  });
  const att11: AttendanceDay = { day: "2026-11-11", at: "2026-11-11T10:10:00Z", end: null, endSource: null, minutes: 66, method: "face", branch: null };
  it("둘 다 온 날은 '짝꿍 ○○님과 같이 운동한 날이에요' · 아닌 날 · 접힌 한 줄엔 없음", () => {
    const { unmount } = render(<DayChecksPanel {...base} cal={cal4} day="2026-11-11" attended={att11} onToggle={noop} />);
    expect(screen.getByText("짝꿍 비비님과 같이 운동한 날이에요")).toBeTruthy();
    unmount();
    const r2 = render(<DayChecksPanel {...base} cal={cal4} day="2026-11-10" attended={{ ...att11, day: "2026-11-10" }} onToggle={noop} />);
    expect(screen.queryByText(/짝꿍 비비님과 같이/)).toBeNull();
    r2.unmount();
    render(<DayChecksPanel {...base} cal={cal4} day="2026-11-11" attended={att11} compact onToggle={noop} />);
    expect(screen.queryByText(/짝꿍 비비님과 같이/)).toBeNull();
  });
});
