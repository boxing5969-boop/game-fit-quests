import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 화면 조각(PeerCompareBody)만 그린다 — 데이터 훅이 부르는 서버는 쓰지 않는다
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { PeerCompareBody } from "./PeerCompareCard";
import { buildBodyCompare, type BodyCompareInput } from "@/lib/fitnessAge153";

const today = "2026-11-12"; // 목요일
const v = (day: string) => ({ day, minutes: 66 });
const TWICE = ["2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29", "2026-11-03", "2026-11-05", "2026-11-10", "2026-11-11"].map(v);
const ONCE = ["2026-10-20", "2026-11-03"].map(v);
const noop = () => {};
const draw = (i: BodyCompareInput, extra: Partial<Parameters<typeof PeerCompareBody>[0]> = {}) =>
  render(<PeerCompareBody compare={buildBodyCompare(i)} onFill={noop} {...extra} />);

/** 잘한 것만 — 나이 든 쪽 · 못 한 것을 말하는 낱말이 없어야 한다 */
const NEGATIVE = /많아요|늙|못 채|못 했|안 했|뒤처|부족|나빠/;

describe("같은 나이와 비교 카드 — 체력 나이 · 심폐 체력", () => {
  it("권장 운동량을 채운 30대 초반 여성 — 체력 나이 26세 · 153 운동 이름표 · 또래 비율 · 심폐 상위 %", () => {
    draw({ gender: "여", birthYear: 1994, days: TWICE, today });
    expect(screen.getByText("체력 나이")).toBeTruthy();
    expect(document.body.textContent).toMatch(/26세/);
    expect(document.body.textContent).toMatch(/실제 32세보다 6살 젊어요/);
    expect(screen.getByText("153 운동 −6살")).toBeTruthy();
    expect(screen.getByText("또래 100명 중 46명만 권장 운동량을 채워요")).toBeTruthy();
    expect(screen.getByText("심폐 체력")).toBeTruthy();
    expect(screen.getByText("상위 35%")).toBeTruthy();
    expect(screen.getAllByText("추정").length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(NEGATIVE);
  });

  it("아직 못 채우면 — 체력 나이 숫자 대신 다음 목표 · 지난 4주 동그라미 · 심폐 줄은 겹쳐서 뺀다", () => {
    draw({ gender: "여", birthYear: 1994, days: ONCE, today });
    expect(screen.getByText("주 2번씩, 4주 중 3주")).toBeTruthy();
    expect(document.body.textContent).toMatch(/채우면 실제보다 6살 젊은 체력이에요/);
    expect(screen.getByLabelText("지난 4주 중 0주 권장 운동량을 채웠어요")).toBeTruthy();
    expect(screen.queryByText("심폐 체력")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+세보다/);
    expect(document.body.textContent).not.toMatch(NEGATIVE);
  });

  it("성별만 없으면 — 카드에서 바로 고르기 (지금 넣기 대신) · 채운 회원에게는 지난 4주 인사", () => {
    const onPickGender = vi.fn();
    draw({ gender: null, birthYear: 1994, days: TWICE, today }, { onPickGender });
    expect(screen.getByText("지난 4주 중 4주 권장 운동량을 채웠어요")).toBeTruthy();
    expect(screen.getByText("또래는 100명 중 54명만 채워요")).toBeTruthy();
    expect(screen.getByText("성별만 고르면 체력 나이를 알려 드려요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "지금 넣기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "여성" }));
    expect(onPickGender).toHaveBeenCalledWith("여");
  });

  it("출생 연도도 없으면 — 지금 넣기 (내 신체 정보)", () => {
    const onFill = vi.fn();
    draw({ gender: null, birthYear: null, days: [], today }, { onFill, onPickGender: noop });
    expect(screen.getByText("성별 · 출생 연도를 넣으면 체력 나이를 알려 드려요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "남성" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "지금 넣기" }));
    expect(onFill).toHaveBeenCalled();
  });

  it("잰 값이 주인공일 때 — 악력(근력) 상위 % · 심폐 줄 다음 한 걸음", () => {
    draw({
      gender: "남",
      birthYear: 1994,
      days: ONCE,
      bodyFat: { pct: 25.7, on: "2026-11-01", firstPct: null, firstOn: null },
      grip: { kg: 46, on: "2026-11-05", firstKg: null, firstOn: null },
      today,
    });
    expect(document.body.textContent).toMatch(/악력\(근력\) 46kg/);
    expect(screen.getByText("다음 목표")).toBeTruthy();
    expect(screen.getByText("주 2번씩, 4주 중 3주를 채우면 평균에 가까워져요")).toBeTruthy();
  });

  it("계산 방법 — 출처 · 내 숫자 · 추정이라는 말", () => {
    draw({ gender: "여", birthYear: 1994, days: TWICE, today });
    fireEvent.click(screen.getByRole("button", { name: /계산 방법/ }));
    const t = document.body.textContent ?? "";
    expect(t).toMatch(/추정 최대산소섭취량 34\.3mL\/kg\/분/);
    expect(t).toMatch(/이인환 외 2022/);
    expect(t).toMatch(/국민건강영양조사 2025 — 30대 여성 100명 중 46명/);
    expect(t).toMatch(/Park 외\(2022\)/);
    expect(t).toMatch(/실제와 다를 수 있어요/);
  });
});
