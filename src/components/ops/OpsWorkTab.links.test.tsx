/**
 * 근무 탭 알림 링크 「누르면 바로 그 화면」 (2026-11-26 대표님 「근무 메뉴로는 가는데 PT 확인 메뉴까지는 못 가네」)
 *   실제 근무 탭(OpsWorkTab → ManagerView → 근무자 카드 → PT 기록)을 그리고, 서버는 함수 이름별 가짜 답으로 바꾼다.
 *   지점 · 회원은 지어낸 것(PT 기록 예시 자료 buildPtSample).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Route = (args: Record<string, unknown>) => unknown;
const routes = (): Record<string, Route> => (globalThis as { __rpc?: Record<string, Route> }).__rpc ?? {};

vi.mock("@/integrations/supabase/client", () => {
  // 없는 함수 = 그 기능은 숨는다(화면들이 이미 그렇게 처리한다)
  const missing = { code: "PGRST202", message: "Could not find the function" };
  const builder: Record<string, unknown> = new Proxy(
    {},
    { get: (_t, p) => (p === "then" ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : () => builder) },
  );
  return {
    supabase: {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        const log = ((globalThis as { __rpcLog?: string[] }).__rpcLog ??= []);
        log.push(`${name}:${String(args?.p_branch ?? "")}`);
        const f = ((globalThis as { __rpc?: Record<string, Route> }).__rpc ?? {})[name];
        return f ? { data: f(args ?? {}), error: null } : { data: null, error: missing };
      }),
      from: vi.fn(() => builder),
      channel: vi.fn(() => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) })),
      removeChannel: vi.fn(),
    },
  };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import OpsWorkTab from "./OpsWorkTab";
import { kstToday } from "./OpsParts";
import { buildPtSample, PT_SAMPLE_COACH } from "@/lib/opsPtRecordSample";
import type { OpsStaff } from "@/lib/opsWork";

const SEOL = "153복싱짐 선릉역점";
const CHIL = "153복싱짐 칠금점";
const today = kstToday();
const staff = (id: string, name: string, extra: Partial<OpsStaff> = {}): OpsStaff => ({
  id,
  user_id: null,
  name,
  kind: "parttime",
  pay_type: "hourly",
  hourly_wage: null,
  monthly_salary: null,
  pt_freelancer: false,
  checkin_required: true,
  start_date: null,
  end_date: null,
  active: true,
  ...extra,
});
const monthOf = (branch: string, list: OpsStaff[]) => ({
  branch,
  month: `${today.slice(0, 7)}-01`,
  today,
  now_hm: "10:00",
  manage: true,
  hq: true,
  pay: true,
  staff: list,
  rules: [],
  entries: [],
  checkins: [],
  colleagues: [],
});
const ME = { me: "u-hq", hq: true, manage: [SEOL, CHIL], mine: [] };

const Loc = () => <div data-testid="loc">{useLocation().search}</div>;
const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <OpsWorkTab me={ME as never} />
        <Loc />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const loc = () => screen.getByTestId("loc").textContent ?? "";

const scrolled = vi.fn();
beforeEach(() => {
  (globalThis as { __rpcLog?: string[] }).__rpcLog = [];
  (globalThis as { __rpc?: Record<string, Route> }).__rpc = {
    ops_month: (a) =>
      a.p_branch === SEOL
        ? monthOf(SEOL, [staff(PT_SAMPLE_COACH, "재우 코치", { kind: "freelancer", pay_type: "none", pt_freelancer: true }), staff("s-sy", "성윤 코치")])
        : monthOf(CHIL, [staff("s-cg", "칠금 코치")]),
    ops_pt_month: () => ({ manage: true, pay: true, members: [], events: [], rates: [] }),
    ops_pt_record: () => buildPtSample(today, true),
    ops_pt_member_check_list: () => [],
  };
  // 마지막으로 보던 지점 = 칠금점 — 알림은 선릉역점 것
  window.localStorage.clear();
  window.localStorage.setItem("153ops:branch", CHIL);
  Element.prototype.scrollIntoView = scrolled;
  scrolled.mockClear();
});
afterEach(() => cleanup());

describe("근무 탭 알림 링크", () => {
  it("PT 이틀 넘은 확인 필요 → 그 지점(선릉) PT 코치 카드 'PT' 탭 「확인 필요」로 내려가고 주소를 비운다", async () => {
    renderAt("/office?tab=work&pt=check&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90");
    const tab = await screen.findByRole("tab", { name: "PT", selected: true }, { timeout: 4000 });
    expect(tab).toBeTruthy();
    expect(screen.getAllByText("재우 코치").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^확인 필요/).length).toBeGreaterThan(0);
    await waitFor(() => expect(scrolled).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(loc()).toBe("?tab=work"));
    // 칠금점이 아니라 선릉역점 자료를 읽었다
    expect((globalThis as { __rpcLog?: string[] }).__rpcLog?.some((x) => x === `ops_month:${SEOL}`)).toBe(true);
  });

  it("출근 기록 없음 → 그 코치의 그날 시트", async () => {
    renderAt(`/office?tab=work&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90&staff=s-sy&day=${today}`);
    expect(await screen.findByText(new RegExp(`^성윤 코치 · `), {}, { timeout: 4000 })).toBeTruthy();
    await waitFor(() => expect(loc()).toBe("?tab=work"));
  });

  it("옛 출근 알림(지점 없이 이름만) — 보던 지점에 없으면 다른 지점에서 찾아 연다", async () => {
    window.localStorage.setItem("153ops:branch", SEOL);
    renderAt(`/office?tab=work&staffname=${encodeURIComponent("칠금 코치")}&day=${today}`);
    expect(await screen.findByText(/^칠금 코치 · /, {}, { timeout: 4000 })).toBeTruthy();
    await waitFor(() => expect(loc()).toBe("?tab=work"));
  });

  it("오류 신고 알림(ptcoach) — 다른 지점을 보고 있어도 그 코치 'PT' 탭이 열린다", async () => {
    renderAt(`/office?tab=work&ptcoach=${PT_SAMPLE_COACH}`);
    expect(await screen.findByRole("tab", { name: "PT", selected: true }, { timeout: 4000 })).toBeTruthy();
    await waitFor(() => expect(loc()).toBe("?tab=work"));
  });
});

// 2026-11-26 대표님 「이름이 이상하게 나와」 — 근무자 카드 'PT' 탭 「회원별」 · 차감 기록도 PT 이름표로 (지어낸 회원: 앱 이름 sky_01 → 한하늘, ㄴㅁ → 나무)
describe("근무자 카드 PT 탭 — 회원 이름", () => {
  it("회원별 · 차감 기록이 앱 이름 대신 PT 이름표로 보인다", async () => {
    const r = (globalThis as { __rpc?: Record<string, Route> }).__rpc!;
    const mem = (user_id: string, name: string, remaining: number) => ({ user_id, name, ticket: "퍼스널 트레이닝 20회권", remaining, end_date: null, checked_at: null });
    r.ops_pt_month = () => ({
      manage: true,
      pay: true,
      rates: [],
      members: [mem("sample-m1", "sky_01", 12), mem("sample-m3", "ㄴㅁ", 4)],
      events: [
        {
          id: "e1",
          member_user_id: "sample-m3",
          member_name: "ㄴㅁ",
          ticket_name: "퍼스널 트레이닝 20회권",
          before: 5,
          after: 4,
          used: 1,
          kind: "used",
          status: "auto",
          coach_staff_id: PT_SAMPLE_COACH,
          work_date: today,
          detected_at: `${today}T01:00:00Z`,
          note: null,
        },
      ],
    });
    renderAt(`/office?tab=work&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90&ptcoach=${PT_SAMPLE_COACH}`);
    const label = await screen.findByText("회원별", {}, { timeout: 4000 });
    const list = label.nextElementSibling as HTMLElement;
    await waitFor(() => expect(list.textContent).toContain("나무"));
    expect(list.textContent).toContain("한하늘");
    expect(list.textContent).not.toContain("ㄴㅁ");
    expect(list.textContent).not.toContain("sky_01");
    const deducts = screen.getByText("차감 기록 (브로제이)").nextElementSibling as HTMLElement;
    expect(deducts.textContent).toContain("나무");
    expect(deducts.textContent).not.toContain("ㄴㅁ");
  });
});
