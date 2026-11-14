import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BodyGainRows from "./BodyGainRows";
import { bodyGainRows } from "@/lib/bodyGains153";
import { cardioEstimate } from "@/lib/fitnessAge153";
import { healthGains, type HealthDay } from "@/lib/healthGains153";

const start = Date.UTC(2026, 8, 7);
const DAYS: HealthDay[] = [];
for (let w = 0; w < 10; w++) for (const k of [0, 2]) DAYS.push({ day: new Date(start + (w * 7 + k) * 86_400_000).toISOString().slice(0, 10), minutes: 66 });
const G = healthGains(DAYS, DAYS.length * 66);
const cardio = cardioEstimate({ sex: "여", age: 32, active: true })!;

describe("내 몸이 좋아진 정도 — 줄마다 몇 % · 숫자 · 누르면 기준", () => {
  it("추정 줄 — 이름표 '추정' · 숫자 줄 · 누르면 연구 이름과 153 계산 · 직접 재기 단추", () => {
    const onMeasure = vi.fn();
    render(<BodyGainRows rows={bodyGainRows({ gains: G, days: DAYS, cardio, sex: "여", band: cardio.band })} onMeasure={onMeasure} />);
    expect(screen.getAllByText("추정")).toHaveLength(5);
    expect(screen.queryByText("실측")).toBeNull();
    expect(document.body.textContent).toMatch(/최대산소섭취량 [\d.]+ → [\d.]+ · \+[\d.]+/);
    // 펼치기 전에는 기준이 안 보인다
    expect(screen.queryByText(/Milanović 외 2015/)).toBeNull();
    const cardioBtn = screen.getByRole("button", { name: /^심폐지구력/ });
    expect(cardioBtn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(cardioBtn);
    expect(cardioBtn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Milanović 외 2015/)).toBeTruthy();
    expect(screen.getByText(/153이 정한 계산식/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "153 PB 보러 가기" }));
    expect(onMeasure).toHaveBeenCalledWith("pb");
    // 다른 줄을 열면 앞 줄은 닫힌다 (한 번에 한 줄)
    fireEvent.click(screen.getByRole("button", { name: /^체지방률/ }));
    expect(screen.queryByText(/Milanović 외 2015/)).toBeNull();
    expect(screen.getByText(/Jayedi 외 2024/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "내 신체 정보에 넣기" }));
    expect(onMeasure).toHaveBeenCalledWith("body");
  });

  it("실측 줄 — 이름표 '실측' · 처음 → 지금 · 오차보다 크면 '확실한 변화'", () => {
    render(
      <BodyGainRows
        rows={bodyGainRows({
          gains: G,
          days: DAYS,
          grip: { firstValue: 32, firstOn: "2026-09-10", value: 38, on: "2026-11-10" },
          bodyFat: { firstValue: 26.1, firstOn: "2026-09-01", value: 25, on: "2026-11-02" },
          weight: { firstValue: 72.4, firstOn: "2026-09-01", value: 69.3, on: "2026-11-02" },
        })}
      />,
    );
    expect(screen.getAllByText("실측")).toHaveLength(3);
    expect(screen.getByText("악력 32 → 38kg · +6kg")).toBeTruthy();
    expect(screen.getByText("체지방률 26.1% → 25%")).toBeTruthy();
    expect(screen.getByText("몸무게 72.4 → 69.3kg")).toBeTruthy();
    // 악력 +6kg 만 오차(5kg)보다 크다 · 체지방률 1.1%p 는 오차(2.8%p) 안
    expect(screen.getAllByText("확실한 변화")).toHaveLength(1);
    // onMeasure 가 없으면 단추도 없다
    fireEvent.click(screen.getByRole("button", { name: /^근력/ }));
    expect(screen.getByText(/Bohannon 2019/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "내 신체 정보에 넣기" })).toBeNull();
  });
});
