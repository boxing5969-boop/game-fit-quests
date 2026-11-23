// link-imported-by-phone 판정 — 순수 함수(시험: src/lib/linkImported.test.ts).
//
// 2026-11-23 보안 점검(CRITICAL): 예전에는 표(ticket)가 없으면 전화번호 하나로 아직 넘겨받지 않은 회원 계정을
//   내 계정에 합치고 원래 계정을 지웠다 — 남의 번호만 알면 수강권 · 마일리지 · 출석을 가져갈 수 있었다(대상 3,422개).
//   이제는 「기록 찾기」(claim-member-account check — 이름 · 번호 · 생년월일 확인, 틀리면 잠금)를 통과해 받은 표만 받는다.
import type { LinkTicket } from "../_shared/linkTicket.ts";

export const NEED_LOOKUP_MESSAGE =
  "보안을 위해 이제 「기록 찾기」(이름 · 전화번호 · 생년월일)로 확인한 뒤에 기록을 이어받아요. 앱을 새로 고친 뒤 다시 해 주세요.";
export const TICKET_EXPIRED_MESSAGE = "확인한 지 10분이 지났어요. 「기록 찾기」를 다시 해 주세요.";
export const TICKET_OTHER_ACCOUNT_MESSAGE = "다른 계정에서 확인한 기록이에요. 지금 로그인한 계정에서 「기록 찾기」를 다시 해 주세요.";
export const IN_USE_MESSAGE = "이미 사용 중인 계정으로 등록된 번호입니다. 관장님께 문의해주세요.";
export const DESK_MESSAGE = "이 번호는 앱에서 바로 이어받을 수 없어요. 지점 데스크에 문의해 주세요.";

export type TicketCheck =
  | { ok: true; phone: string; expectedFrom: string }
  | { ok: false; reason: "need_lookup" | "ticket_invalid" | "other_account"; message: string };

/** 요청 본문의 표를 판정한다. verified = verifyLinkTicket 결과(표가 없으면 undefined). */
export function checkTicket(hasTicket: boolean, verified: LinkTicket | null | undefined, callerId: string): TicketCheck {
  if (!hasTicket) return { ok: false, reason: "need_lookup", message: NEED_LOOKUP_MESSAGE };
  if (!verified) return { ok: false, reason: "ticket_invalid", message: TICKET_EXPIRED_MESSAGE };
  // 로그인한 상태에서 받은 표(c)는 그 계정만 쓸 수 있다.
  if (verified.c && verified.c !== callerId) return { ok: false, reason: "other_account", message: TICKET_OTHER_ACCOUNT_MESSAGE };
  return { ok: true, phone: verified.p, expectedFrom: verified.u };
}

export interface LinkTarget {
  user_id: string;
  must_change_credentials: boolean | null;
  is_staff: boolean | null;
}

export type TargetCheck = { ok: true } | { ok: false; reason: "in_use" | "desk"; message: string };

/**
 * 합칠 계정(찾은 계정)이 합쳐도 되는 계정인지.
 * · 아직 넘겨받지 않은 계정(must_change_credentials)만
 * · 지도진 표시(is_staff) 계정은 안 된다 — merge 가 is_staff 를 옮겨 운영진 권한이 넘어간다
 * · 한 번이라도 로그인한 계정은 누군가 쓰고 있는 계정이다(claim-member-account 와 같은 기준)
 */
export function checkTarget(t: LinkTarget, lastSignInAt: string | null | undefined): TargetCheck {
  if (t.must_change_credentials !== true) return { ok: false, reason: "in_use", message: IN_USE_MESSAGE };
  if (t.is_staff === true) return { ok: false, reason: "desk", message: DESK_MESSAGE };
  if (lastSignInAt) return { ok: false, reason: "in_use", message: IN_USE_MESSAGE };
  return { ok: true };
}
