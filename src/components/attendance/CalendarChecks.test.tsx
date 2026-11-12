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
