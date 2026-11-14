import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// 화면 조각만 그린다 — 데이터 훅이 부르는 서버는 쓰지 않는다
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { MindStatsBody } from "./MindStatsCard";
import MindCheckSheet from "./MindCheckSheet";
import { MIND_SCALE } from "@/data/mindScales";
import { MIND_STEPS, normalizeMindState, scoreConf, scoreHabit, scoreVital, type MindState } from "@/lib/mind153";

const today = "2026-11-14";
const noop = () => {};
const row = (taken_on: string, conf: number, vital: number, habit: number) => ({
  id: taken_on,
  taken_at: `${taken_on}T12:00:00+09:00`,
  taken_on,
  conf,
  vital,
  habit,
});
const st = (checks: ReturnType<typeof row>[], extra: Record<string, unknown> = {}): MindState =>
  normalizeMindState({ active: true, consent: checks.length > 0, remind: true, checks, brand: { ready: false }, ...extra });

/** 잘한 것만 — 내려간 숫자 · 탓하는 말이 없어야 한다 */
const NEGATIVE = /▼|↓|떨어졌|낮아졌|나빠|못 했|부족해요/;

describe("마음 능력치 카드", () => {
  it("기록이 없으면 — 안내 · 검사 3가지 · 첫 체크 단추 · 나만 봐요", () => {
    const onCheck = vi.fn();
    render(<MindStatsBody state={st([])} today={today} onCheck={onCheck} />);
    expect(screen.getByText("운동은 마음도 키워요")).toBeTruthy();
    expect(screen.getByText("로젠버그 자존감 척도")).toBeTruthy();
    expect(screen.getByText("RAND-36 활력")).toBeTruthy();
    expect(screen.getByText("습관 자동성 지수")).toBeTruthy();
    expect(screen.getByText("나만 봐요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "첫 마음 체크 · 2분" }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it("첫 기록 — 세 숫자 · 다음 체크 날짜 · 66일까지", () => {
    render(<MindStatsBody state={st([row("2026-11-11", 56.7, 45, 33.3)])} today={today} onCheck={noop} />);
    expect(screen.getByText("첫 기록 · 11월 11일")).toBeTruthy();
    expect(screen.getByText("57")).toBeTruthy();
    expect(screen.getByText("45")).toBeTruthy();
    expect(screen.getByText("33")).toBeTruthy();
    expect(screen.getByText("다음 체크 12월 9일 · 25일 남았어요")).toBeTruthy();
    expect(screen.getByText("첫 체크 뒤 3일 · 습관 66일까지 63일")).toBeTruthy();
  });

  it("두 번 이상 — 가장 많이 오른 운동 습관이 주인공(금색 +25점) · 줄마다 처음 → 지금", () => {
    const s = st([row("2026-09-14", 56.7, 45, 33.3), row("2026-10-13", 63.3, 55, 50), row("2026-11-12", 70, 60, 58.3)]);
    const { container } = render(<MindStatsBody state={s} today={today} onCheck={noop} />);
    expect(screen.getByText("운동 습관 · 습관 자동성 지수")).toBeTruthy();
    expect(container.textContent).toMatch(/\+25점/);
    expect(screen.getByText("처음 잰 날보다 의미 있는 변화(10점 이상)예요")).toBeTruthy();
    expect(container.textContent).toMatch(/57 → 70/);
    expect(container.textContent).toMatch(/45 → 60/);
    // 주인공이 아닌 줄에는 오른 만큼 · 의미 있는 변화
    expect(screen.getByText(/\+13 · 의미 있는 변화/)).toBeTruthy();
    expect(screen.getByText(/\+15 · 의미 있는 변화/)).toBeTruthy();
    expect(container.querySelector(".text-reward")).toBeTruthy();
    expect(container.textContent).not.toMatch(NEGATIVE);
  });

  it("내려가면 — 화살표 · 처음 값 없이 지금 값만, 흐름을 같이 보는 말 · 4주 지나면 다시 재기", () => {
    const s = st([row("2026-09-01", 70, 70, 70), row("2026-10-01", 66.7, 60, 70)]);
    const { container } = render(<MindStatsBody state={s} today={today} onCheck={noop} />);
    expect(screen.getByText("지금 · 10월 1일")).toBeTruthy();
    expect(container.textContent).toMatch(/흔들려요/);
    expect(container.textContent).not.toMatch(/→/);
    expect(container.textContent).not.toMatch(NEGATIVE);
    expect(screen.getByRole("button", { name: "다시 재기 · 4주가 지났어요" })).toBeTruthy();
  });

  it("근거 · 계산 방법 — 연구 숫자 · 계산법 · 지난 기록 · 알림 · 지우기", () => {
    const onClear = vi.fn();
    const onRemind = vi.fn();
    const s = st([row("2026-10-13", 63.3, 55, 50), row("2026-11-12", 70, 60, 58.3)]);
    const { container } = render(<MindStatsBody state={s} today={today} onCheck={noop} onClear={onClear} onRemind={onRemind} />);
    fireEvent.click(screen.getByRole("button", { name: /근거 · 계산 방법/ }));
    expect(screen.getByText("연구로 보면")).toBeTruthy();
    expect(container.textContent).toMatch(/113개 연구 종합/);
    expect(container.textContent).toMatch(/Wender 외 2022/);
    expect(container.textContent).toMatch(/Bjorner 외 2007/);
    expect(screen.getByText("지난 기록 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onRemind).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: /기록 지우기/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("아주 낮은 자신감이면 상담 전화를 조용히 알려 준다", () => {
    render(<MindStatsBody state={st([row("2026-11-12", 16.7, 50, 50)])} today={today} onCheck={noop} />);
    expect(screen.getByText(/1577-0199 · 자살예방상담 109/)).toBeTruthy();
  });
});

describe("마음 체크 창", () => {
  afterEach(() => vi.useRealTimers());

  it("동의(만 14세 · 민감정보) → 18문항을 하나씩 → 서버 결과로 오늘의 마음 능력치", async () => {
    vi.useFakeTimers();
    const onConsent = vi.fn(() => Promise.resolve());
    let sent: { conf: number[]; vital: number[]; habit: number[] } | null = null;
    const onSave = vi.fn((a: { conf: number[]; vital: number[]; habit: number[] }) => {
      sent = a;
      const state = st([row("2026-10-13", 50, 50, 25), row(today, scoreConf(a.conf)!, scoreVital(a.vital)!, scoreHabit(a.habit)!)]);
      return Promise.resolve({ replaced: false, state });
    });
    render(<MindCheckSheet open onClose={noop} state={st([])} today={today} onConsent={onConsent} onSave={onSave} />);

    const start = screen.getByRole("button", { name: "위 두 가지를 확인해 주세요" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "동의하고 시작 · 2분" }));
    });
    expect(onConsent).toHaveBeenCalledWith(true);
    expect(screen.getByText(MIND_SCALE.conf.items[0].text)).toBeTruthy();

    // 모든 문항에 셋째 보기 — 자신감 '그런 편이다'(3) · 활력 '꽤 자주'(3) · 습관 '조금 아니다'(3)
    for (let i = 0; i < MIND_STEPS.length; i++) {
      const s = MIND_STEPS[i];
      const label = MIND_SCALE[s.key].options[2].label;
      await act(async () => {
        fireEvent.click(screen.getByRole("radio", { name: label }));
        vi.advanceTimersByTime(200);
      });
    }
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(sent).toEqual({ conf: Array(10).fill(3), vital: [3, 3, 3, 3], habit: [3, 3, 3, 3] });
    expect(screen.getByText("오늘의 마음 능력치")).toBeTruthy();
    // 자신감 모두 3 → 50 · 활력 3,3,3,3 → (60+60+40+40)/4 = 50 · 습관 12 → 33.3
    expect(screen.getByText("다음 체크 12월 12일 · 28일 남았어요")).toBeTruthy();
  });

  it("만 14세 아래로 알려진 회원은 시작할 수 없다", () => {
    render(<MindCheckSheet open onClose={noop} state={st([], { age: 12 })} today={today} onConsent={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("마음 체크는 만 14세 이상만 쓸 수 있어요")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
