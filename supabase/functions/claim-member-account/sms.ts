// 생년월일이 없는 회원 계정 — 휴대폰 인증번호 단계 (2026-11-24 보안 점검 ③ · 대표님 「일단 선릉역점만 진행하고 예외 허락할게」)
//
// 생년월일이 등록된 회원은 이름 · 번호 · 생년월일로 본인을 확인한다. 생년월일이 비어 있으면 이름 · 번호만 맞아도
// 남의 계정을 넘겨받을 수 있었다 → 문자 발송이 준비된 지점(지금은 선릉역점)부터 그 번호로 6자리 인증번호를 보내
// 맞게 넣어야 넘어가게 한다. 문자는 153OS 워커(/api/external/otp-sms · 지점 NCP SENS)가 보낸다.
// 다른 지점은 문자 설정이 생기면 SMS_OTP_BRANCHES 에 이름을 더한다(153OS 쪽 허용 목록도 같이).
//
// 순수 함수만 둔다 — src/lib/claimSms.test.ts 가 시험한다.

/** 인증번호를 보내는 지점(앱 profiles.branch_name 그대로). 153OS otp-sms 허용 목록과 같아야 한다. */
export const SMS_OTP_BRANCHES: ReadonlySet<string> = new Set(["153복싱짐 선릉역점"]);

export const SMS_CODE_TTL_MS = 5 * 60_000; // 인증번호 5분
export const SMS_CODE_MAX_TRIES = 5; // 인증번호 하나에 틀릴 수 있는 횟수

/** 보내기 제한 — 번호당 60초에 1번 · 하루 5번, 접속지당 하루 10번, 전체 하루 200번. */
export const SMS_LIMITS = { phoneGapSec: 60, phonePerDay: 5, ipPerDay: 10, allPerDay: 200 } as const;

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

/** 이 계정은 넘겨받기 전에 휴대폰 인증이 필요한가 — 생년월일이 비어 있고, 문자를 보낼 수 있는 지점일 때. */
export function needsSms(t: { birth_date: string | null; branch_name: string | null }): boolean {
  return onlyDigits(t.birth_date) === "" && SMS_OTP_BRANCHES.has(String(t.branch_name ?? "").trim());
}

/** 6자리 인증번호 — 0~999999 고르게(나머지 치우침 없이). */
export function makeCode(rand: (buf: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b)): string {
  const LIMIT = 4_294_000_000; // 1,000,000 의 배수 — 이 밑에서만 써서 치우침을 없앤다
  const buf = new Uint32Array(1);
  for (let i = 0; i < 20; i++) {
    const v = rand(buf)[0];
    if (v < LIMIT) return String(v % 1_000_000).padStart(6, "0");
  }
  throw new Error("random source failed");
}

/** 010-****-5678 — 화면에 보내는 번호(가운데 가림). */
export function maskPhone(phone: string): string {
  const d = onlyDigits(phone);
  if (d.length < 10) return "***";
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

export type SmsLimitReason = "wait" | "phone_day" | "ip_day" | "all_day";

/** 보내기 전 횟수 확인. 막을 이유가 없으면 null. */
export function smsLimitReason(c: {
  secSinceLastToPhone: number | null; // 이 번호로 마지막 보낸 뒤 지난 초(없으면 null)
  phoneDay: number; // 이 번호로 24시간 안에 보낸 수
  ipDay: number; // 이 접속지에서 24시간 안에 보낸 수
  allDay: number; // 전체 24시간 안에 보낸 수
}): SmsLimitReason | null {
  if (c.allDay >= SMS_LIMITS.allPerDay) return "all_day";
  if (c.phoneDay >= SMS_LIMITS.phonePerDay) return "phone_day";
  if (c.ipDay >= SMS_LIMITS.ipPerDay) return "ip_day";
  if (c.secSinceLastToPhone !== null && c.secSinceLastToPhone < SMS_LIMITS.phoneGapSec) return "wait";
  return null;
}

export const SMS_MESSAGES = {
  need_sms: "생년월일이 등록되지 않은 회원이라 휴대폰 인증이 필요해요. 이 번호로 인증번호를 보내 드릴게요.",
  sent: "인증번호를 보냈어요. 문자로 받은 6자리를 5분 안에 넣어 주세요.",
  wait: "인증번호를 방금 보냈어요. 1분 뒤에 다시 받을 수 있어요.",
  phone_day: "오늘은 이 번호로 인증번호를 더 보낼 수 없어요. 내일 다시 하거나 지점 데스크에 문의해 주세요.",
  ip_day: "오늘은 이 기기에서 인증번호를 더 보낼 수 없어요. 내일 다시 하거나 지점 데스크에 문의해 주세요.",
  all_day: "지금은 인증번호를 보낼 수 없어요. 지점 데스크에 문의해 주세요.",
  send_failed: "인증번호 문자를 보내지 못했어요. 잠시 후 다시 하거나 지점 데스크에 문의해 주세요.",
  code_wrong: "인증번호가 맞지 않아요. 문자로 받은 6자리를 다시 확인해 주세요.",
  code_expired: "인증번호가 만료됐어요. 인증번호를 다시 받아 주세요.",
} as const;
