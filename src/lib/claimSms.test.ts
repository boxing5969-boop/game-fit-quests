import { describe, expect, it } from "vitest";
import {
  makeCode,
  maskPhone,
  needsSms,
  SMS_LIMITS,
  smsLimitReason,
} from "../../supabase/functions/claim-member-account/sms";
import { SMS_PROOF_TTL_MS, signSmsProof, verifySmsProof } from "../../supabase/functions/_shared/smsProof";
import { signLinkTicket, verifyLinkTicket } from "../../supabase/functions/_shared/linkTicket";

const SECRET = "test-secret";
const UID = "1530c4d0-0001-4a00-8000-000000001122";
const SEOLLEUNG = "153복싱짐 선릉역점";

describe("생년월일 없는 계정 — 휴대폰 인증이 필요한가", () => {
  it("선릉역점 · 생년월일 없음 → 필요", () => {
    expect(needsSms({ birth_date: null, branch_name: SEOLLEUNG })).toBe(true);
    expect(needsSms({ birth_date: "", branch_name: ` ${SEOLLEUNG} ` })).toBe(true);
  });
  it("생년월일이 있으면 지금처럼 생년월일로 확인 → 필요 없음", () => {
    expect(needsSms({ birth_date: "1990-03-15", branch_name: SEOLLEUNG })).toBe(false);
  });
  it("문자 설정이 아직 없는 지점은 지금 그대로", () => {
    expect(needsSms({ birth_date: null, branch_name: "153복싱짐 칠금점" })).toBe(false);
    expect(needsSms({ birth_date: null, branch_name: null })).toBe(false);
  });
});

describe("인증번호 · 가린 번호", () => {
  it("언제나 숫자 6자리 (앞자리 0 도 살림)", () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^\d{6}$/);
    expect(makeCode((b) => { b[0] = 7; return b; })).toBe("000007");
  });
  it("치우치는 구간의 값은 버리고 다시 뽑는다", () => {
    const seq = [4_294_967_000, 123_456];
    let i = 0;
    expect(makeCode((b) => { b[0] = seq[i++]; return b; })).toBe("123456");
  });
  it("번호 가운데를 가린다", () => {
    expect(maskPhone("01012345678")).toBe("010-****-5678");
    expect(maskPhone("0101234567")).toBe("010-****-4567");
    expect(maskPhone("12")).toBe("***");
  });
});

describe("보내기 제한", () => {
  const base = { secSinceLastToPhone: null, phoneDay: 0, ipDay: 0, allDay: 0 };
  it("처음은 보낸다", () => expect(smsLimitReason(base)).toBeNull());
  it("60초 안에 다시 → 기다리기", () => {
    expect(smsLimitReason({ ...base, secSinceLastToPhone: 59, phoneDay: 1 })).toBe("wait");
    expect(smsLimitReason({ ...base, secSinceLastToPhone: 61, phoneDay: 1 })).toBeNull();
  });
  it("번호 하루 5번 · 접속지 하루 10번 · 전체 하루 200번", () => {
    expect(smsLimitReason({ ...base, phoneDay: SMS_LIMITS.phonePerDay })).toBe("phone_day");
    expect(smsLimitReason({ ...base, ipDay: SMS_LIMITS.ipPerDay })).toBe("ip_day");
    expect(smsLimitReason({ ...base, allDay: SMS_LIMITS.allPerDay, phoneDay: 9 })).toBe("all_day");
  });
});

describe("휴대폰 인증 통과 표", () => {
  it("만든 표는 15분 동안 풀린다", async () => {
    const t = await signSmsProof(SECRET, "01012345678", UID, 1_000);
    expect(await verifySmsProof(SECRET, t, 2_000)).toEqual({ p: "01012345678", u: UID, e: 1_000 + SMS_PROOF_TTL_MS });
    expect(await verifySmsProof(SECRET, t, 1_000 + SMS_PROOF_TTL_MS + 1)).toBeNull();
  });
  it("다른 비밀값 · 바꾼 내용 · 이상한 모양은 거른다", async () => {
    const t = await signSmsProof(SECRET, "01012345678", UID, 0);
    expect(await verifySmsProof("other", t, 1)).toBeNull();
    const sig = t.split(".")[1];
    const forged = btoa(JSON.stringify({ p: "01099998888", u: UID, e: 9e15 })).replace(/=+$/, "");
    expect(await verifySmsProof(SECRET, `${forged}.${sig}`, 1)).toBeNull();
    expect(await verifySmsProof(SECRET, 123, 1)).toBeNull();
    expect(await verifySmsProof(SECRET, "a.b.c", 1)).toBeNull();
  });
  it("이어받기 표와 서로 바꿔 쓸 수 없다", async () => {
    const proof = await signSmsProof(SECRET, "01012345678", UID, 0);
    const ticket = await signLinkTicket(SECRET, "01012345678", UID, 0);
    expect(await verifyLinkTicket(SECRET, proof, 1)).toBeNull();
    expect(await verifySmsProof(SECRET, ticket, 1)).toBeNull();
  });
});
