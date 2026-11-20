import { describe, expect, it } from "vitest";
import { itemPeriod } from "./cartPricing";
import cases from "./passPeriod.cases.json";

// 수강권 · 운동복 · 락카 이용 기간 — 화면 itemPeriod 와 DB _pass_period 가 같은 답 (2026-11-20 시작일 고르기)
//   이 파일의 기대값은 로컬 Postgres 16 에서 _pass_period 로도 같은 답인지 확인했다(supabase/migrations/20261120234555_pass_start_date.sql).
//   식을 바꾸면 화면 · DB · 서버(payssam-create-bill/start.ts) 셋을 같이 고치고 이 파일을 다시 만든다.
type Case = { today: string; cur: string | null; start: string | null; months: number; days: number; expect: { start: string; end: string } };

describe("이용 기간 — 화면 = DB (_pass_period)", () => {
  it(`${(cases as Case[]).length}가지 경우가 기대값과 같다`, () => {
    for (const c of cases as Case[]) {
      expect(itemPeriod({ currentEnd: c.cur, today: c.today, months: c.months, days: c.days, start: c.start })).toEqual(c.expect);
    }
  });
});
