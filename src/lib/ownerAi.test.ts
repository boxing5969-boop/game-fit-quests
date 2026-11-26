/* eslint-disable @typescript-eslint/no-explicit-any */
// 오삼코치 관장 모드(서버 _shared/ownerAi.ts) 시험 — 범위 · 글 모양 · 도구 결과 정리 · 도구 실행(가짜 DB) · 스트림 조립 · 도구 고리
import { describe, expect, it, vi } from "vitest";
import {
  createAssembler,
  kstText,
  mdText,
  memberStatusText,
  monthLabel,
  OWNER_PROMPT,
  OWNER_TOOLS,
  ownerRoundBody,
  ownerScopeLine,
  parseOwnerScope,
  ppText,
  runOwnerTool,
  runOwnerTurns,
  sseReset,
  sseStatus,
  sseText,
  statusText,
  STATUS_THINK,
  summarizeCandidates,
  summarizeCustomers,
  summarizeMemberDetail,
  summarizeMemberList,
  summarizeNumbers,
  summarizeRenewTrend,
  summarizeTeam,
  summarizeTrendOs,
  sumUsage,
  maskNames,
  toolsOnlyPlan,
  unmatchedNumbers,
  wonText,
  type OwnerScope,
} from "../../supabase/functions/_shared/ownerAi.ts";

const TODAY = "2026-11-27";
const NOW = Date.parse("2026-11-27T01:00:00Z"); // 한국 10:00
const SCOPE: OwnerScope = { role: "admin", branch: "153복싱짐 선릉역점", salesVisible: true, daily: 50, used: 3, left: 47 };

// 11/27 운영 DB 와 같은 모양(숫자만)
const OWNER = {
  v: 1,
  day: "2026-11-27",
  branch: "153복싱짐 선릉역점",
  sync: {
    snap_at: "2026-11-26T16:40:32.668058+00:00",
    sales_at: "2026-11-26T15:05:53.671+00:00",
    members_at: "2026-11-26T15:05:51.149+00:00",
    attendance_at: "2026-11-26T16:20:21.859+00:00",
  },
  todo: { leads_month: 0, no_visit_7d: 26, expiring_14d: 21, leads_overdue: 0 },
  sales: {
    mtd: 21555440,
    month: "2026-11",
    through: "2026-11-26",
    prev_full: 25447500,
    prev_same: 20831000,
    prev_month: "2026-10",
    refunds_mtd: 1028560,
    prev_same_to: "2026-10-26",
  },
  members: { active: 137, holding: 5, new_month: 26, active_all: 142, ended_month: 22 },
  attendance: { n: 92, to: "2026-11-27", base: 137, from: "2026-11-21", rate: 67.2, prev_n: 97, week_avg: 1.5, prev_rate: 70.8, visits_30d: 906 },
};
const RM = (month: string, n: number, renewed30: number, rate: number | null, complete: boolean, settleOn: string, extra: Record<string, number> = {}) => ({
  month,
  n,
  renewed30,
  renewed: renewed30,
  open: 0,
  waiting: 0,
  lost: n - renewed30,
  rate,
  complete,
  settleOn,
  ...extra,
});
const KPI = {
  payload: {
    all: {
      prev: RM("2026-10", 46, 15, 32.6, false, "2026-12-01", { waiting: 3 }),
      prev2: RM("2026-09", 50, 19, 38, true, "2026-10-31"),
      current: RM("2026-11", 34, 5, 14.7, false, "2026-12-31", { open: 7, waiting: 22 }),
      months: [RM("2026-08", 54, 15, 27.8, true, "2026-10-01"), RM("2026-09", 50, 19, 38, true, "2026-10-31"), RM("2026-10", 46, 15, 32.6, false, "2026-12-01")],
      basis: "sales-name",
      graceDays: 30,
    },
    recent: { n: 130, rate: 23.1, months: 6, renewed30: 30 },
    months: [
      { n: 16, open: 0, month: "2026-09", renewed: 3, renewed30: 2, expiredOpen: 13 },
      { n: 20, open: 0, month: "2026-10", renewed: 7, renewed30: 7, expiredOpen: 13 },
      { n: 14, open: 3, month: "2026-11", renewed: 2, renewed30: 2, expiredOpen: 9 },
      { n: 20, open: 19, month: "2026-12", renewed: 1, renewed30: 1, expiredOpen: 0 },
    ],
  },
  computed_at: "2026-11-26T14:47:18.881+00:00",
};
const CRM = {
  v: 1,
  snap_at: "2026-11-26T18:20:22.418275+00:00",
  counts: { hold: 5, soon: 24, ended: 86, shown: 228, valid: 142, active: 113, idle30: 14, ended30: 22, starter: 9, unknown: 0, expiring: 24, novisit7: 26 },
  rows: [
    { id: "a1", name: "김하나", status: "soon", days_left: 2, end: "2026-11-29", last_visit: "2026-11-26", v7: 4, v30: 21, todo: ["exp3"], coach: null, joined: "2026-06-11", last4: "1234" },
    { id: "a2", name: "이두리", status: "soon", days_left: 10, end: "2026-12-07", last_visit: "2026-11-10", v7: 0, v30: 2, todo: ["exp14"], coach: "박코치", joined: "2026-05-01", last4: "2222" },
    { id: "a3", name: "박세나", status: "active", days_left: 60, end: "2027-01-26", last_visit: "2026-11-12", v7: 0, v30: 3, todo: ["novisit7"], coach: null, joined: "2026-03-01", last4: "3333" },
    { id: "a4", name: "최네오", status: "active", days_left: 40, end: "2027-01-06", last_visit: "2026-11-18", v7: 0, v30: 5, todo: ["novisit7"], coach: null, joined: "2026-02-01", last4: "4444" },
    { id: "a5", name: "정다섯", status: "active", days_left: 80, end: "2027-02-15", last_visit: "2026-11-20", v7: 1, v30: 1, todo: ["starter"], coach: null, joined: "2026-11-10", last4: "5555" },
    { id: "a6", name: "한여섯", status: "ended", days_left: -5, end: "2026-11-22", last_visit: "2026-11-20", v7: 0, v30: 6, todo: ["ended7"], coach: null, joined: "2026-08-01", last4: "6666" },
    { id: "a7", name: "오일곱", status: "active", days_left: 30, end: "2026-12-27", last_visit: "2026-10-01", v7: 0, v30: 0, todo: ["idle30"], coach: null, joined: "2026-01-01", last4: "7777" },
    { id: "a8", name: "김하나둘", status: "active", days_left: 50, end: "2027-01-16", last_visit: "2026-11-26", v7: 3, v30: 12, todo: [], coach: null, joined: "2026-04-01", last4: "8888" },
  ],
};

describe("범위 · 글 모양", () => {
  it("owner_ai_scope 답 → 켜졌을 때만", () => {
    expect(parseOwnerScope({ on: false, role: "manager" })).toBeNull();
    expect(parseOwnerScope(null)).toBeNull();
    expect(parseOwnerScope({ on: true, role: "admin", branch: "153복싱짐 선릉역점", sales_visible: true, daily: 50, used: 2, left: 48 })).toEqual({
      role: "admin",
      branch: "153복싱짐 선릉역점",
      salesVisible: true,
      daily: 50,
      used: 2,
      left: 48,
    });
    expect(parseOwnerScope({ on: true, role: "manager", branch: "153복싱짐 선릉역점" })?.salesVisible).toBe(false);
  });

  it("시각 · 날짜 · 달 · 돈 · 차이 글", () => {
    expect(kstText("2026-11-26T16:40:32Z")).toBe("11/27 01:40");
    expect(kstText("x")).toBeNull();
    expect(mdText("2026-11-29")).toBe("11/29");
    expect(monthLabel("2026-10", TODAY)).toBe("10월");
    expect(monthLabel("2025-12", TODAY)).toBe("2025년 12월");
    expect(wonText(21555440)).toBe("2,156만 원");
    expect(wonText(9800)).toBe("9,800원");
    expect(wonText(-1028560)).toBe("-103만 원");
    expect(ppText(67.2, 70.8, "지난주")).toBe("지난주(70.8%)보다 3.6%p 낮음");
    expect(ppText(80, 80, "목표")).toBe("목표(80%)와 같음");
    expect(ppText(null, 80, "목표")).toBeNull();
  });

  it("질문한 사람 한 줄 — 한도가 적을 때 · 다 썼을 때", () => {
    expect(ownerScopeLine(SCOPE, NOW)).toBe("[질문한 사람] 153복싱짐 선릉역점 · 본사(대표) · 매출 권한 있음 · 오늘 2026-11-27");
    expect(ownerScopeLine({ ...SCOPE, role: "manager", salesVisible: false, left: 3 }, NOW)).toContain("지점장 · 매출 권한 없음 · 오늘 2026-11-27 · 오늘 남은 숫자 질문 3번");
    expect(ownerScopeLine({ ...SCOPE, left: 0 }, NOW, { tools: false })).toContain("한도를 다 썼다");
  });

  it("지시문 — 보고서 규칙 · 바뀌는 곳 · 줄표 없음", () => {
    for (const s of ["숫자는 도구 결과에서만", "기준 시각", "(추정)", "확인해 볼 것", "지점 밖 자료는 없다", "전화번호 · 결제 금액 · 건강 정보", "탓하는 말", "대표님", "지점장님", "8줄 안팎", "초안", "목표 80%", "목표 70%", "77%"]) {
      expect(OWNER_PROMPT).toContain(s);
    }
    expect(OWNER_PROMPT).not.toMatch(/[—–]/);
  });

  it("도구 6개 — 이름이 겹치지 않고 입력 모양이 있다", () => {
    const names = OWNER_TOOLS.map((t) => t.name);
    expect(names).toEqual(["gym_numbers", "monthly_trend", "member_list", "member_detail", "customer_flow", "coach_weekly"]);
    for (const t of OWNER_TOOLS) expect(t.input_schema.type).toBe("object");
    expect(statusText(["member_list", "gym_numbers", "member_list"])).toBe("153OS 회원 명단 · 지금 숫자 보는 중이에요");
  });
});

describe("도구 결과 정리", () => {
  it("지금 숫자 — 관장님 홈과 같은 숫자 · 차이 글 · CRM 할 일 숫자", () => {
    const n = summarizeNumbers({ owner: OWNER, ownerAt: "2026-11-27T01:00:00Z", fresh: true, kpi: KPI, crm: CRM, salesVisible: true, today: TODAY }) as any;
    expect(n.members.active_members).toBe(137);
    expect(n.members.active_with_holding).toBe(142);
    expect(n.attendance.last7_rate_text).toBe("67.2%");
    expect(n.attendance.vs_prev_week_text).toBe("지난주(70.8%)보다 3.6%p 낮음");
    expect(n.attendance.vs_target_text).toBe("목표(80%)보다 12.8%p 낮음");
    expect(n.attendance.range_text).toBe("11/21~11/27");
    expect(n.renew.last_month.label).toBe("10월");
    expect(n.renew.last_month.rate_text).toBe("32.6%");
    expect(n.renew.last_month.complete).toBe(false);
    expect(n.renew.last_month.settles_on).toBe("12/1");
    expect(n.renew.last_month_vs_before_text).toBe("9월(38%)보다 5.4%p 낮음");
    expect(n.renew.new_members_6mo.vs_target_text).toBe("목표(70%)보다 46.9%p 낮음");
    expect(n.sales.to_date_text).toBe("2,156만 원");
    expect(n.sales.vs_prev_same_text).toBe("지난달 같은 기간(~10/26 2,083만 원)보다 72만 원 많음(+3.5%)");
    expect(n.today_todo).toMatchObject({ expiring_14d: 24, no_visit_7_29d: 26, starter_behind: 9, ended_30d: 22, idle_30d_plus: 14 });
    expect(n.as_of.broj_sync_text).toBe("11/27 01:40");
  });

  it("지금 숫자 — 매출 권한 없음 · CRM 못 읽음 · 숫자 없음", () => {
    const n = summarizeNumbers({ owner: OWNER, ownerAt: null, fresh: false, kpi: null, crm: null, salesVisible: false, today: TODAY }) as any;
    expect(n.sales.locked).toBe(true);
    expect(JSON.stringify(n)).not.toContain("2,156만");
    expect(n.today_todo.expiring_14d).toBeNull();
    expect(n.today_todo.no_visit_7_29d).toBe(26);
    expect(n.renew.no_data).toBe(true);
    const e = summarizeNumbers({ owner: null, ownerAt: null, fresh: false, kpi: null, crm: null, salesVisible: true, today: TODAY }) as any;
    expect(e.members.no_data).toBe(true);
    expect(e.note).toBeTruthy();
  });

  it("달마다 흐름 — 153OS owner_trend", () => {
    const s = summarizeTrendOs(
      { metric: "sales", data_from: "2025-01-06", months: [{ month: "2026-10", net: 25447500, refunds: 1350000, payments: 103, partial: false, no_data: false }, { month: "2026-11", net: 21555440, refunds: 1028560, payments: 89, partial: true, no_data: false }] },
      "sales",
      TODAY,
    ) as any;
    expect(s.months[0]).toMatchObject({ label: "10월", net_text: "2,545만 원", payments: 103, partial: false });
    expect(s.months[1].partial).toBe(true);
    expect(s.data_from_text).toBe("2025년 1월 6일부터 기록");
    const q = summarizeTrendOs({ months: [{ month: "2026-09", inquiries: 0, no_data: true, partial: false }] }, "inquiries", TODAY) as any;
    expect(q.months[0]).toMatchObject({ no_data: true, inquiries: 0 });
    expect(summarizeTrendOs({ error: "unknown_metric" }, "visits", TODAY)).toMatchObject({ error: "unknown_metric" });
  });

  it("재등록률 달마다 — 전체 · 신규(정해지지 않은 달은 비율 없음 · 다음 달 뺌)", () => {
    const r = summarizeRenewTrend(KPI, "renew_rate", 6, TODAY) as any;
    expect(r.months.map((m: any) => m.label)).toEqual(["8월", "9월", "10월"]);
    expect(r.estimate).toBe(true);
    const n = summarizeRenewTrend(KPI, "new_renew", 6, TODAY) as any;
    expect(n.months.map((m: any) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(n.months[0]).toMatchObject({ complete: true, rate_text: "12.5%" });
    expect(n.months[1]).toMatchObject({ complete: false, rate_text: null });
    expect(n.recent_6mo.rate_text).toBe("23.1%");
    expect(summarizeRenewTrend(null, "renew_rate", 6, TODAY)).toMatchObject({ error: expect.any(String) });
  });

  it("상태 글", () => {
    expect(memberStatusText("soon", 2)).toBe("2일 남음");
    expect(memberStatusText("soon", 0)).toBe("오늘 끝");
    expect(memberStatusText("active", 60)).toBe("유효 · 60일 남음");
    expect(memberStatusText("hold", 10)).toBe("홀딩");
    expect(memberStatusText("ended", -5)).toBe("끝난 지 5일");
    expect(memberStatusText("unknown", null)).toBe("확인 필요");
  });

  it("할 일 명단 — 묶음 · 챙길 순서 · 전화 없음", () => {
    const e = summarizeMemberList(CRM, "expiring", 15, TODAY) as any;
    expect(e.count).toBe(24);
    expect(e.members.map((m: any) => m.name)).toEqual(["김하나", "이두리"]);
    expect(e.members[1]).toMatchObject({ status: "10일 남음", days_since_visit: 17, coach: "박코치", visits_30d: 2 });
    const v = summarizeMemberList(CRM, "no_visit", 1, TODAY) as any;
    expect(v.members).toHaveLength(1);
    expect(v.members[0].name).toBe("박세나"); // 오래 안 온 순
    expect(v.count).toBe(26);
    expect((summarizeMemberList(CRM, "starter", 15, TODAY) as any).members[0]).toMatchObject({ name: "정다섯", joined: "11/10" });
    expect((summarizeMemberList(CRM, "ended", 15, TODAY) as any).members[0].status).toBe("끝난 지 5일");
    expect((summarizeMemberList(CRM, "idle", 15, TODAY) as any).members[0].days_since_visit).toBe(57);
    expect(JSON.stringify(summarizeMemberList(CRM, "expiring", 15, TODAY))).not.toContain("1234");
  });

  it("이름 후보 · 회원 한 명(전화 · 결제 금액 · 메모 원문 없음)", () => {
    const c = summarizeCandidates({ rows: CRM.rows.slice(0, 2) }, "김") as any;
    expect(c.found).toBe(2);
    expect(c.candidates[0]).toEqual({ name: "김하나", status: "2일 남음", ends: "11/29" });
    const card = {
      name: "김하나",
      phone: "01012341234",
      product: "153복싱짐 프리미엄 무제한 5개월 수강권",
      start: "2026-06-11",
      end: "2026-11-29",
      days_left: 2,
      active: true,
      hold: { status: "NONE", start: null, end: null },
      sessions: { total: null, used: null, remaining: null },
      pt: { active: false, ticket: null, remaining: null, end: null },
      coach: null,
      joined: "2026-06-11",
      route: "NONE",
      purpose: "다이어트",
      last_visit: "2026-11-26",
      visits: ["2026-09-02", "2026-11-01", "2026-11-26"],
      payments: [
        { day: "2026-07-09", product: "개인락커 1개월권", category: "물품", amount: 10000 },
        { day: "2026-06-11", product: "5개월 수강권", category: "수강권", amount: 777000 },
      ],
      same_name: 1,
      followups: [{ at: "2026-11-20T05:00:00Z", status: "연락함", met: false, called: true, texted: true, memo: "무릎이 아프다고 함 010-9999-8888" }],
      updated_at: "2026-11-26T18:20:22Z",
    };
    const d = summarizeMemberDetail(card, CRM.rows[0], TODAY, [{ at: "11/26 15:11", what: "이야기함", topic: "기간 임박", by: "박코치" }]) as any;
    expect(d).toMatchObject({ name: "김하나", status: "2일 남음", period: "6/11~11/29", visits_30d: 2, visits_90d: 3, came_from: null, purpose: "다이어트", pass_payments_2y: 1, last_pass_payment_day: "6/11" });
    expect(d.os_contacts[0]).toEqual({ at: "11/20 14:00", status: "연락함", how: "전화 · 문자" });
    const s = JSON.stringify(d);
    for (const bad of ["0101234", "777000", "10000", "무릎", "9999"]) expect(s).not.toContain(bad);
  });

  it("손님 흐름 — 숫자만", () => {
    const c = summarizeCustomers(
      {
        funnel: { month: "2026-11", talk_new: 101, talk_leads: 2, inquiries: 0, first_buy: 26, rebuy: 24 },
        talk: [{ first: "가격 궁금해요", last4: "1111", member: true }, { first: "주차 되나요", last4: "2222", member: false }],
        inquiries: [{ name: "손님", status: "new", last4: "3333" }],
      },
      TODAY,
    ) as any;
    expect(c).toMatchObject({ label: "11월", talk_first_greetings: 101, talk_left_number: 2, first_buy: 26, rebuy: 24, talk_leads_60d: 2, talk_leads_60d_became_members: 1 });
    expect(c.recent_inquiries_by_status).toEqual({ new: 1 });
    const s = JSON.stringify(c);
    for (const bad of ["가격", "1111", "손님"]) expect(s).not.toContain(bad);
  });

  it("코치별 7일 — 이름별 수", () => {
    const t = summarizeTeam(
      [
        { staff_user_id: "s1", kind: "talk" },
        { staff_user_id: "s1", kind: "rx" },
        { staff_user_id: "s2", kind: "notice" },
      ],
      { s1: "박코치", s2: "이코치" },
    ) as any;
    expect(t.coaches[0]).toEqual({ name: "박코치", talk: 1, notice: 0, rx: 1, total: 2 });
    expect(t.total).toBe(3);
    expect((summarizeTeam([], {}) as any).note).toContain("기록이 없다");
  });
});

// ─── 가짜 DB(supabase-js 모양) ───
function fakeDb(h: { rpc?: Record<string, (args: any) => any>; from?: Record<string, (filters: any[]) => any> }) {
  const calls: Array<{ kind: string; name: string; args: any }> = [];
  const db = {
    calls,
    rpc: async (name: string, args: any) => {
      calls.push({ kind: "rpc", name, args });
      const f = h.rpc?.[name];
      return f ? f(args) : { data: null, error: { message: "no rpc" } };
    },
    from: (table: string) => {
      const filters: any[] = [];
      calls.push({ kind: "from", name: table, args: filters });
      const result = () => (h.from?.[table] ? h.from[table](filters) : { data: null, error: null });
      const b: any = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") return (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
            if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve(result());
            return (...args: any[]) => {
              filters.push([prop, ...args]);
              return b;
            };
          },
        },
      );
      return b;
    },
  };
  return db;
}

describe("도구 실행(가짜 DB)", () => {
  const ctxWith = (os: any, app: any, scope: OwnerScope = SCOPE) => ({ scope, os, app, now: NOW });

  it("지금 숫자 — 153OS 를 먼저 · 못 읽으면 앱 캐시 · 지점은 범위에서", async () => {
    const os = fakeDb({ rpc: { owner_home_kpi: () => ({ data: OWNER, error: null }), crm_members: () => ({ data: CRM, error: null }) } });
    const app = fakeDb({ from: { leader_kpi: () => ({ data: KPI, error: null }) } });
    const r = (await runOwnerTool(ctxWith(os, app), "gym_numbers", { branch: "다른 지점" })) as any;
    expect(r.members.active_members).toBe(137);
    expect(r.as_of.fresh).toBe(true);
    expect(os.calls.every((c) => c.args.p_branch_name === "153복싱짐 선릉역점")).toBe(true);

    const os2 = fakeDb({ rpc: { owner_home_kpi: () => ({ data: null, error: { message: "down" } }), crm_members: () => ({ data: CRM, error: null }) } });
    const app2 = fakeDb({
      from: {
        leader_kpi: () => ({ data: KPI, error: null }),
        leader_owner_kpi: () => ({ data: { payload: OWNER, computed_at: "2026-11-26T16:47:55Z" }, error: null }),
      },
    });
    const r2 = (await runOwnerTool(ctxWith(os2, app2), "gym_numbers", {})) as any;
    expect(r2.as_of.fresh).toBe(false);
    expect(r2.as_of.computed_text).toBe("11/27 01:47");
    expect(r2.attendance.last7_rate).toBe(67.2);
  });

  it("달마다 흐름 — 매출 권한 없으면 153OS 를 부르지 않는다 · 재등록은 leader_kpi", async () => {
    const os = fakeDb({ rpc: { owner_trend: () => ({ data: { months: [] }, error: null }) } });
    const app = fakeDb({ from: { leader_kpi: () => ({ data: KPI, error: null }) } });
    const locked = (await runOwnerTool(ctxWith(os, app, { ...SCOPE, salesVisible: false }), "monthly_trend", { metric: "sales" })) as any;
    expect(locked.locked).toBe(true);
    expect(os.calls).toHaveLength(0);
    const rr = (await runOwnerTool(ctxWith(os, app), "monthly_trend", { metric: "renew_rate", months: 3 })) as any;
    expect(rr.months).toHaveLength(3);
    expect(await runOwnerTool(ctxWith(os, app), "monthly_trend", { metric: "nope" })).toMatchObject({ error: "unknown_metric" });
    await runOwnerTool(ctxWith(os, app), "monthly_trend", { metric: "visits", months: 40 });
    expect(os.calls[0].args).toEqual({ p_branch_name: "153복싱짐 선릉역점", p_metric: "visits", p_months: 12 });
  });

  it("회원 한 명 — 이름이 하나면 카드 · 여럿이면 후보 · 숫자는 막음", async () => {
    const os = fakeDb({
      rpc: {
        crm_members: (a: any) => ({ data: { rows: CRM.rows.filter((r) => r.name.includes(a.p_query)) }, error: null }),
        crm_member_card: () => ({ data: { name: "김하나", phone: "01012341234", days_left: 2, active: true, visits: [], payments: [], followups: [], hold: {}, pt: {}, sessions: {} }, error: null }),
      },
    });
    const app = fakeDb({ from: { profiles: () => ({ data: [], error: null }) } });
    const one = (await runOwnerTool(ctxWith(os, app), "member_detail", { name: "김하나" })) as any;
    expect(one.name).toBe("김하나"); // 김하나 · 김하나둘 중 이름이 꼭 같은 사람
    expect(JSON.stringify(one)).not.toContain("0101234");
    const many = (await runOwnerTool(ctxWith(os, app), "member_detail", { name: "김" })) as any;
    expect(many.found).toBe(2);
    expect(await runOwnerTool(ctxWith(os, app), "member_detail", { name: "1234" })).toMatchObject({ error: expect.any(String) });
    expect(await runOwnerTool(ctxWith(os, app), "member_detail", { name: "없는사람" })).toMatchObject({ found: 0 });
  });

  it("명단 · 손님 · 코치별 · 모르는 도구", async () => {
    const os = fakeDb({ rpc: { crm_members: () => ({ data: CRM, error: null }), crm_customers: () => ({ data: { funnel: { talk_new: 3 }, talk: [], inquiries: [] }, error: null }) } });
    const app = fakeDb({
      from: {
        leader_contacts: () => ({ data: [{ staff_user_id: "s1", kind: "talk" }], error: null }),
        profiles: () => ({ data: [{ user_id: "s1", name: "박코치" }], error: null }),
      },
    });
    expect(((await runOwnerTool(ctxWith(os, app), "member_list", { group: "idle" })) as any).members[0].name).toBe("오일곱");
    expect(await runOwnerTool(ctxWith(os, app), "member_list", { group: "all" })).toMatchObject({ error: "unknown_group" });
    expect(((await runOwnerTool(ctxWith(os, app), "customer_flow", {})) as any).talk_first_greetings).toBe(3);
    expect(((await runOwnerTool(ctxWith(os, app), "coach_weekly", {})) as any).coaches[0].name).toBe("박코치");
    expect(await runOwnerTool(ctxWith(os, app), "delete_all", {})).toEqual({ error: "unknown_tool" });
  });
});

// ─── 스트림 ───
const enc = new TextEncoder();
const sse = (events: any[], status = 200) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        // 줄 중간에서 잘려 와도 읽어야 한다 — 두 조각으로 나눠 보낸다
        const all = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
        const cut = Math.floor(all.length / 2);
        c.enqueue(enc.encode(all.slice(0, cut)));
        c.enqueue(enc.encode(all.slice(cut)));
        c.close();
      },
    }),
    { status },
  );
const START = { type: "message_start", message: { usage: { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 } } };
const toolRound = (pre: string | null, tools: Array<{ id: string; name: string; json: string }>) => {
  const ev: any[] = [START];
  let i = 0;
  if (pre !== null) {
    ev.push({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
    ev.push({ type: "content_block_delta", index: i, delta: { type: "text_delta", text: pre } });
    ev.push({ type: "content_block_stop", index: i });
    i++;
  }
  for (const t of tools) {
    ev.push({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: t.id, name: t.name, input: {} } });
    ev.push({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: t.json.slice(0, 3) } });
    ev.push({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: t.json.slice(3) } });
    ev.push({ type: "content_block_stop", index: i });
    i++;
  }
  ev.push({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 30 } });
  ev.push({ type: "message_stop" });
  return ev;
};
const answerRound = (texts: string[]) => [
  START,
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "숫자 확인" } },
  { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-1" } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
  ...texts.map((t) => ({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: t } })),
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 80 } },
  { type: "message_stop" },
];

describe("스트림 조립", () => {
  it("글 · 도구 · 생각(서명) 블록을 다시 짓는다", () => {
    const a = createAssembler();
    const out: string[] = [];
    for (const ev of [...toolRound("볼게요", [{ id: "t1", name: "member_list", json: '{"group":"expiring","limit":5}' }])]) {
      const r = a.feed(ev);
      if (r.text) out.push(r.text);
    }
    expect(out).toEqual(["볼게요"]);
    expect(a.stop).toBe("tool_use");
    expect(a.toolUses()).toEqual([{ id: "t1", name: "member_list", input: { group: "expiring", limit: 5 } }]);
    expect(a.usage).toEqual({ input_tokens: 100, output_tokens: 30, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 });
    const b = createAssembler();
    for (const ev of answerRound(["안", "녕"])) b.feed(ev);
    expect(b.blocks()).toEqual([
      { type: "thinking", thinking: "숫자 확인", signature: "sig-1" },
      { type: "text", text: "안녕" },
    ]);
    const c = createAssembler();
    c.feed({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    c.feed({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "x", name: "gym_numbers", input: {} } });
    c.feed({ type: "content_block_stop", index: 1 });
    expect(c.blocks()).toEqual([{ type: "tool_use", id: "x", name: "gym_numbers", input: {} }]); // 빈 글 블록은 돌려주지 않는다
    expect(c.feed({ type: "error", error: { type: "overloaded_error" } }).error).toContain("overloaded");
  });

  it("SSE 글 · 진행 · 지우기 · 사용량 합", () => {
    expect(sseText("가")).toBe('data: {"choices":[{"index":0,"delta":{"content":"가"}}]}\n\n');
    expect(sseStatus("보는 중")).toBe('data: {"status":"보는 중"}\n\n');
    expect(sseReset()).toBe('data: {"reset":true}\n\n');
    expect(sumUsage([{ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }, { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 }])).toEqual({
      input_tokens: 2,
      output_tokens: 3,
      cache_read_input_tokens: 4,
      cache_creation_input_tokens: 5,
    });
    const b = ownerRoundBody({ model: "m", max_tokens: 10, messages: [] }, [{ role: "user", content: "q" }], true, true);
    expect(b).toMatchObject({ stream: true, tool_choice: { type: "none" }, messages: [{ role: "user", content: "q" }] });
    expect((b as any).tools).toHaveLength(6);
    expect(ownerRoundBody({}, [], false, false)).not.toHaveProperty("tools");
  });
});

describe("도구 고리", () => {
  const os = fakeDb({ rpc: { owner_home_kpi: () => ({ data: OWNER, error: null }), crm_members: () => ({ data: CRM, error: null }) } });
  const app = fakeDb({ from: { leader_kpi: () => ({ data: KPI, error: null }) } });
  const ctx = { scope: SCOPE, os, app, now: NOW };

  it("앞말은 지우고 · 도구를 돌리고 · 답은 바로 흘려보낸다", async () => {
    const texts: string[] = [];
    const statuses: string[] = [];
    const resets = vi.fn();
    const take = vi.fn(async () => ({ ok: true }));
    const bodies: any[] = [];
    const r = await runOwnerTurns({
      base: { model: "claude-sonnet-5-5", max_tokens: 3000, system: [{ type: "text", text: "s" }] },
      messages: [{ role: "user", content: "출석률 왜 떨어졌어?" }],
      ctx,
      tools: true,
      first: sse(toolRound("숫자를 볼게요.", [{ id: "t1", name: "gym_numbers", json: "{}" }, { id: "t2", name: "member_list", json: '{"group":"no_visit"}' }])),
      fetchRound: async (body) => {
        bodies.push(body);
        return sse(answerRound(["출석률은 67.2%예요.", "\n기준 · 11/27 01:40 브로제이"]));
      },
      take,
      onText: (t) => texts.push(t),
      onStatus: (t) => statuses.push(t),
      onReset: resets,
    });
    expect(resets).toHaveBeenCalledTimes(1);
    expect(texts).toEqual(["숫자를 볼게요.", "출석률은 67.2%예요.", "\n기준 · 11/27 01:40 브로제이"]);
    expect(r.text).toBe("출석률은 67.2%예요.\n기준 · 11/27 01:40 브로제이");
    expect(statuses).toEqual(["153OS 지금 숫자 · 회원 명단 보는 중이에요", STATUS_THINK]);
    expect(take).toHaveBeenCalledTimes(1);
    expect(r.quota).toBe("ok");
    expect(r.rounds).toBe(1);
    expect(r.calls.map((c) => c.name).sort()).toEqual(["gym_numbers", "member_list"]);
    expect(r.usages).toHaveLength(2);
    expect(r.error).toBeNull();
    // 다음 바퀴 — 앞 응답(앞말 · 도구 부름)을 그대로 돌려주고 도구 결과를 같은 순서로
    expect(bodies).toHaveLength(1);
    const m = bodies[0].messages;
    expect(m[1].role).toBe("assistant");
    expect(m[1].content.map((b: any) => b.type)).toEqual(["text", "tool_use", "tool_use"]);
    expect(m[2].content.map((b: any) => b.tool_use_id)).toEqual(["t1", "t2"]);
    expect(JSON.parse(m[2].content[0].content).members.active_members).toBe(137);
    expect(bodies[0].tools).toHaveLength(6);
    expect(bodies[0].tool_choice).toBeUndefined();
  });

  it("도구 바퀴가 다 차면 도구 없이 답만 · 한도가 끝나면 숫자 대신 안내", async () => {
    const bodies: any[] = [];
    const r = await runOwnerTurns({
      base: {},
      messages: [{ role: "user", content: "q" }],
      ctx,
      tools: true,
      first: sse(toolRound(null, [{ id: "t1", name: "gym_numbers", json: "{}" }])),
      fetchRound: async (body) => {
        bodies.push(body);
        return sse(answerRound(["오늘 숫자 질문을 다 쓰셨어요."]));
      },
      take: async () => ({ ok: false }),
      onText: () => {},
      onStatus: () => {},
      onReset: () => {},
    });
    expect(r.quota).toBe("over");
    expect(bodies[0].tool_choice).toEqual({ type: "none" });
    expect(JSON.parse(bodies[0].messages[2].content[0].content).error).toBe("quota_over");
    expect(r.calls[0].output).toMatchObject({ error: "quota_over" });

    const b2: any[] = [];
    let n = 0;
    const r2 = await runOwnerTurns({
      base: {},
      messages: [{ role: "user", content: "q" }],
      ctx,
      tools: true,
      maxToolRounds: 2,
      first: sse(toolRound(null, [{ id: "a", name: "gym_numbers", json: "{}" }])),
      fetchRound: async (body) => {
        b2.push(body);
        n++;
        return n === 1 ? sse(toolRound(null, [{ id: "b", name: "member_list", json: '{"group":"expiring"}' }])) : sse(answerRound(["끝"]));
      },
      take: async () => ({ ok: true }),
      onText: () => {},
      onStatus: () => {},
      onReset: () => {},
    });
    expect(r2.rounds).toBe(2);
    expect(b2[0].tool_choice).toBeUndefined();
    expect(b2[1].tool_choice).toEqual({ type: "none" });
    expect(r2.text).toBe("끝");
  });

  it("도구가 없으면 한 바퀴로 끝 · 다음 바퀴 실패 · 스트림 오류", async () => {
    const r = await runOwnerTurns({
      base: {},
      messages: [{ role: "user", content: "잽 잘 치는 법" }],
      ctx,
      tools: true,
      first: sse(answerRound(["잽은 "])),
      fetchRound: async () => {
        throw new Error("should not be called");
      },
      take: async () => ({ ok: true }),
      onText: () => {},
      onStatus: () => {},
      onReset: () => {},
    });
    expect(r).toMatchObject({ text: "잽은 ", rounds: 0, quota: "unused", error: null, stop: "end_turn" });

    const r2 = await runOwnerTurns({
      base: {},
      messages: [{ role: "user", content: "q" }],
      ctx,
      tools: true,
      first: sse(toolRound(null, [{ id: "t1", name: "gym_numbers", json: "{}" }])),
      fetchRound: async () => new Response("overloaded", { status: 529 }),
      take: async () => ({ ok: true }),
      onText: () => {},
      onStatus: () => {},
      onReset: () => {},
    });
    expect(r2.text).toBe("");
    expect(r2.error).toContain("529");

    const r3 = await runOwnerTurns({
      base: {},
      messages: [{ role: "user", content: "q" }],
      ctx,
      tools: true,
      first: sse([START, { type: "error", error: { type: "overloaded_error" } }]),
      fetchRound: async () => sse([]),
      take: async () => ({ ok: true }),
      onText: () => {},
      onStatus: () => {},
      onReset: () => {},
    });
    expect(r3.error).toContain("overloaded");
  });
});

describe("평가 — 답의 숫자가 도구 결과에 있나", () => {
  it("도구 · 허용 글에 없는 숫자만 걸린다(번호 글머리 · 쉼표 · 앞 0 무시)", () => {
    const outputs = [{ attendance: { last7_rate_text: "67.2%", range_text: "11/21~11/27" }, sales: { to_date_text: "2,156만 원" } }];
    expect(unmatchedNumbers("1. 출석률 67.2%(11/21~11/27)\n2. 매출 2,156만 원 · 목표 80%", outputs, "목표 80%")).toEqual([]);
    expect(unmatchedNumbers("출석률 67%예요. 기준 · 11/27 01:40", outputs, "")).toEqual(["67", "01", "40"].map((n) => n.replace(/^0+(?=\d)/, "")));
    expect(unmatchedNumbers("", [], "")).toEqual([]);
  });
});

describe("평가 — 이름 가리기 · 도구만 시험 목록", () => {
  it("name · by · coach 는 첫 글자만", () => {
    expect(maskNames({ members: [{ name: "김하나", status: "2일 남음", coach: "박코치" }], records: [{ by: "이코치" }], n: 3 })).toEqual({
      members: [{ name: "김○○", status: "2일 남음", coach: "박○○" }],
      records: [{ by: "이○○" }],
      n: 3,
    });
  });
  it("도구 6개를 모두 한 번 이상", () => {
    const plan = toolsOnlyPlan("김하나");
    expect(new Set(plan.map(([n]) => n))).toEqual(new Set(OWNER_TOOLS.map((t) => t.name)));
    expect(plan.filter(([n]) => n === "monthly_trend")).toHaveLength(8);
  });
});

