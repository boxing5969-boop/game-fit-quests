import { describe, expect, it } from "vitest";
import {
  DESK_MESSAGE,
  IN_USE_MESSAGE,
  NEED_LOOKUP_MESSAGE,
  TICKET_EXPIRED_MESSAGE,
  TICKET_OTHER_ACCOUNT_MESSAGE,
  checkTarget,
  checkTicket,
} from "../../supabase/functions/link-imported-by-phone/logic";

const ME = "1530c4d0-0002-4a00-8000-000000000001";
const OTHER = "1530c4d0-0002-4a00-8000-000000000002";
const FOUND = "1530c4d0-0001-4a00-8000-000000001122";

// 2026-11-23 보안 점검 — 번호만으로 남의 계정을 합치던 구멍(CRITICAL)
describe("link-imported-by-phone 표 판정", () => {
  it("표 없이 번호만 오면 합치지 않고 「기록 찾기」로 보낸다", () => {
    expect(checkTicket(false, undefined, ME)).toEqual({ ok: false, reason: "need_lookup", message: NEED_LOOKUP_MESSAGE });
  });
  it("지났거나 위조된 표는 거른다", () => {
    expect(checkTicket(true, null, ME)).toEqual({ ok: false, reason: "ticket_invalid", message: TICKET_EXPIRED_MESSAGE });
  });
  it("로그인한 상태에서 받은 표는 그 계정만 쓴다", () => {
    const t = { p: "01012345678", u: FOUND, e: 9e15, c: OTHER };
    expect(checkTicket(true, t, ME)).toEqual({ ok: false, reason: "other_account", message: TICKET_OTHER_ACCOUNT_MESSAGE });
    expect(checkTicket(true, { ...t, c: ME }, ME)).toEqual({ ok: true, phone: "01012345678", expectedFrom: FOUND });
  });
  it("첫 화면(로그인 전)에서 받은 표는 c 없이 통과 — 앱이 합치기 전에 한 번 묻는다", () => {
    expect(checkTicket(true, { p: "01012345678", u: FOUND, e: 9e15 }, ME)).toEqual({ ok: true, phone: "01012345678", expectedFrom: FOUND });
  });
});

describe("합칠 계정 판정", () => {
  const base = { user_id: FOUND, must_change_credentials: true, is_staff: false };
  it("아직 넘겨받지 않았고 로그인한 적 없는 회원 계정만 합친다", () => {
    expect(checkTarget(base, null)).toEqual({ ok: true });
  });
  it("이미 넘겨받은 계정 · 로그인한 적 있는 계정은 안 된다", () => {
    expect(checkTarget({ ...base, must_change_credentials: false }, null)).toEqual({ ok: false, reason: "in_use", message: IN_USE_MESSAGE });
    expect(checkTarget(base, "2026-11-01T00:00:00Z")).toEqual({ ok: false, reason: "in_use", message: IN_USE_MESSAGE });
  });
  it("지도진 표시 계정은 데스크로 — 운영진 권한이 넘어가지 않게", () => {
    expect(checkTarget({ ...base, is_staff: true }, null)).toEqual({ ok: false, reason: "desk", message: DESK_MESSAGE });
  });
});
